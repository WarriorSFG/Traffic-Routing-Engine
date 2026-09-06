#pragma once

#include "types.hpp"
#include "encoding.hpp"
#include "fitness.hpp"
#include "gnn_solver.hpp"
#include <vector>
#include <random>
#include <chrono>
#include <limits>
#include <cmath>
#include <algorithm>
#include <numeric>
#include <omp.h>

namespace traffic_routing {

class QPSOSolver {
public:
    QPSOSolver(
        const ProblemData& prob,
        const PenaltyWeights& weights,
        int swarm_size = 40,
        int max_iter = 150,
        double beta_max = 1.0,
        double beta_min = 0.4,
        unsigned int seed = 42
    ) : prob_(prob),
        weights_(weights),
        decoder_(prob),
        evaluator_(prob, weights),
        swarm_size_(swarm_size),
        max_iter_(max_iter),
        beta_max_(beta_max),
        beta_min_(beta_min),
        seed_(seed) {}

    SolverResult solve(const std::vector<double>& warm_start_keys = {}) {
        auto start_time = std::chrono::high_resolution_clock::now();

        int D = prob_.num_customers;
        std::mt19937 rng(seed_);
        std::uniform_real_distribution<double> dist01(0.0, 1.0);
        std::bernoulli_distribution coin(0.5);
        const double PI = 3.14159265358979323846;

        // Particle states: position X and personal best P
        std::vector<std::vector<double>> X(swarm_size_, std::vector<double>(D));
        std::vector<std::vector<double>> P(swarm_size_, std::vector<double>(D));
        std::vector<double> pbest_fit(swarm_size_, std::numeric_limits<double>::infinity());

        std::vector<double> G(D);
        double gbest_fit = std::numeric_limits<double>::infinity();
        std::vector<std::vector<int>> best_routes;

        // 1. Swarm Initialization (§11.6 Step 1)
        if (!warm_start_keys.empty() && (int)warm_start_keys.size() == D) {
            X[0] = warm_start_keys;
            P[0] = warm_start_keys;
            for (int i = 1; i < std::min(swarm_size_, 5); ++i) {
                for (int j = 0; j < D; ++j) {
                    double noise = (dist01(rng) - 0.5) * 0.05;
                    double val = warm_start_keys[j] + noise;
                    if (val < 0.0) val = -val;
                    if (val > 1.0) val = 2.0 - val;
                    val = std::clamp(val, 0.0, 1.0);
                    X[i][j] = val;
                    P[i][j] = val;
                }
            }
            for (int i = 5; i < swarm_size_; ++i) {
                for (int j = 0; j < D; ++j) {
                    X[i][j] = dist01(rng);
                    P[i][j] = X[i][j];
                }
            }
        } else {
            // Seed Particle 0 with GNN solution
            GNNSolver gnn_solver(prob_, weights_);
            SolverResult gnn_res = gnn_solver.solve();
            std::vector<int> gnn_sequence;
            for (const auto& route : gnn_res.best_solution.routes) {
                for (int stop : route) {
                    if (stop != 0) gnn_sequence.push_back(stop);
                }
            }
            std::vector<double> gnn_keys = decoder_.encode(gnn_sequence);
            X[0] = gnn_keys;
            P[0] = gnn_keys;

            for (int i = 1; i < std::min(swarm_size_, 5); ++i) {
                for (int j = 0; j < D; ++j) {
                    double noise = (dist01(rng) - 0.5) * 0.05;
                    double val = gnn_keys[j] + noise;
                    if (val < 0.0) val = -val;
                    if (val > 1.0) val = 2.0 - val;
                    val = std::clamp(val, 0.0, 1.0);
                    X[i][j] = val;
                    P[i][j] = val;
                }
            }
            for (int i = 5; i < swarm_size_; ++i) {
                for (int j = 0; j < D; ++j) {
                    X[i][j] = dist01(rng);
                    P[i][j] = X[i][j];
                }
            }
        }

        // Initial swarm evaluation (§11.6 Step 1)
        #pragma omp parallel for
        for (int i = 0; i < swarm_size_; ++i) {
            auto routes = decoder_.decode(X[i]);
            double fit = evaluator_.evaluate_fitness_fast(routes);
            pbest_fit[i] = fit;
        }

        for (int i = 0; i < swarm_size_; ++i) {
            if (pbest_fit[i] < gbest_fit) {
                gbest_fit = pbest_fit[i];
                G = P[i];
                best_routes = decoder_.decode(P[i]);
            }
        }

        // Initial Memetic refinement on global best
        double refined_fit = gbest_fit;
        if (vns_local_search(best_routes, refined_fit, 2)) {
            G = decoder_.encode_routes(best_routes);
            gbest_fit = refined_fit;
            P[0] = G;
            pbest_fit[0] = gbest_fit;
        }

        SolverResult res;
        res.algorithm_name = "Quantum-Inspired PSO (QPSO)";

        auto init_time = std::chrono::high_resolution_clock::now();
        double init_elapsed = std::chrono::duration<double, std::milli>(init_time - start_time).count();
        res.history.push_back({0, gbest_fit, gbest_fit, init_elapsed});

        std::vector<double> mbest(D, 0.0);
        std::vector<double> current_fit(swarm_size_);

        for (int iter = 1; iter <= max_iter_; ++iter) {
            // Step 1: Compute mean best position mbest (§11.2)
            std::fill(mbest.begin(), mbest.end(), 0.0);
            for (int i = 0; i < swarm_size_; ++i) {
                for (int j = 0; j < D; ++j) {
                    mbest[j] += P[i][j];
                }
            }
            double inv_M = 1.0 / swarm_size_;
            for (int j = 0; j < D; ++j) {
                mbest[j] *= inv_M;
            }

            // Swarm spatial diversity monitor
            double diversity = 0.0;
            for (int i = 0; i < swarm_size_; ++i) {
                for (int j = 0; j < D; ++j) {
                    diversity += std::abs(P[i][j] - mbest[j]);
                }
            }
            diversity /= (swarm_size_ * D);

            // Step 2: Adaptive non-linear contraction-expansion coefficient beta(t) (§11.5)
            double progress = (double)iter / (double)max_iter_;
            double beta = beta_min_ + (beta_max_ - beta_min_) * std::exp(-2.0 * progress * progress);

            // Step 3: Quantum position sampling update (§11.3, §11.4)
            for (int i = 0; i < swarm_size_; ++i) {
                for (int j = 0; j < D; ++j) {
                    double phi = dist01(rng);
                    double p_ij = phi * P[i][j] + (1.0 - phi) * G[j];

                    double u = std::max(1e-12, dist01(rng));
                    double log_term = std::log(1.0 / u);
                    double jump = beta * std::abs(mbest[j] - X[i][j]) * log_term;

                    double sign = coin(rng) ? 1.0 : -1.0;
                    double next_val = p_ij + sign * jump;

                    // Reflective boundary handling
                    if (next_val < 0.0) next_val = -next_val;
                    if (next_val > 1.0) next_val = 2.0 - next_val;
                    X[i][j] = std::clamp(next_val, 0.0, 1.0);
                }
            }

            // Step 3b: Anti-Stagnation Quantum Wave Packet Tunneling (Cauchy jump)
            if (diversity < 0.03 || iter % 15 == 0) {
                std::vector<size_t> idx(swarm_size_);
                std::iota(idx.begin(), idx.end(), 0);
                std::sort(idx.begin(), idx.end(), [&pbest_fit](size_t a, size_t b) {
                    return pbest_fit[a] < pbest_fit[b];
                });

                int num_tunnel = std::max(1, swarm_size_ / 4);
                for (int k = swarm_size_ - num_tunnel; k < swarm_size_; ++k) {
                    size_t p_idx = idx[k];
                    for (int j = 0; j < D; ++j) {
                        double u = dist01(rng);
                        double cauchy_step = std::tan(PI * (u - 0.5));
                        cauchy_step = std::clamp(cauchy_step, -1.0, 1.0);
                        double tunnel_val = G[j] + 0.20 * cauchy_step;
                        if (tunnel_val < 0.0) tunnel_val = -tunnel_val;
                        if (tunnel_val > 1.0) tunnel_val = 2.0 - tunnel_val;
                        X[p_idx][j] = std::clamp(tunnel_val, 0.0, 1.0);
                    }
                }
            }

            // Step 4: Parallel fitness evaluation (§11.6 Step 1)
            #pragma omp parallel for
            for (int i = 0; i < swarm_size_; ++i) {
                auto routes = decoder_.decode(X[i]);
                current_fit[i] = evaluator_.evaluate_fitness_fast(routes);
            }

            // Step 5: Update personal bests P_i and global best G (§11.6 Step 2)
            double iter_best = std::numeric_limits<double>::infinity();
            for (int i = 0; i < swarm_size_; ++i) {
                if (current_fit[i] < pbest_fit[i]) {
                    pbest_fit[i] = current_fit[i];
                    P[i] = X[i];
                }
                if (pbest_fit[i] < gbest_fit) {
                    gbest_fit = pbest_fit[i];
                    G = P[i];
                    best_routes = decoder_.decode(P[i]);
                }
                if (current_fit[i] < iter_best) {
                    iter_best = current_fit[i];
                }
            }

            // Step 6: Hybrid Memetic VNS Local Search on Global Best
            if (iter % 5 == 0 || iter == max_iter_) {
                auto candidate_routes = best_routes;
                double vns_fit = gbest_fit;
                if (vns_local_search(candidate_routes, vns_fit, 2)) {
                    if (vns_fit < gbest_fit) {
                        best_routes = candidate_routes;
                        gbest_fit = vns_fit;
                        G = decoder_.encode_routes(candidate_routes);

                        // Re-seed worst particle in swarm with new global best
                        size_t worst_idx = 0;
                        double worst_val = -1.0;
                        for (size_t i = 0; i < (size_t)swarm_size_; ++i) {
                            if (pbest_fit[i] > worst_val) {
                                worst_val = pbest_fit[i];
                                worst_idx = i;
                            }
                        }
                        P[worst_idx] = G;
                        X[worst_idx] = G;
                        pbest_fit[worst_idx] = gbest_fit;
                    }
                }
            }

            auto iter_now = std::chrono::high_resolution_clock::now();
            double iter_elapsed = std::chrono::duration<double, std::milli>(iter_now - start_time).count();
            res.history.push_back({iter, gbest_fit, iter_best, iter_elapsed});
        }

        auto end_time = std::chrono::high_resolution_clock::now();
        res.total_compute_ms = std::chrono::duration<double, std::milli>(end_time - start_time).count();
        res.best_solution = evaluator_.evaluate(best_routes);
        res.best_fitness = res.best_solution.penalized_fitness;

        return res;
    }

private:
    const ProblemData& prob_;
    const PenaltyWeights& weights_;
    RandomKeyDecoder decoder_;
    FitnessEvaluator evaluator_;
    int swarm_size_;
    int max_iter_;
    double beta_max_;
    double beta_min_;
    unsigned int seed_;

    // Helper to evaluate validity and feasibility preservation
    bool is_valid_candidate(const std::vector<std::vector<int>>& routes, double cand_fit, double best_fit, bool was_feasible) const {
        if (cand_fit >= best_fit - 1e-6) return false;
        if (was_feasible) {
            Solution sol = evaluator_.evaluate(routes);
            return sol.is_feasible;
        }
        return true;
    }

    // 1. Intra-route 2-Opt move evaluated with exact dynamic time-window penalties
    bool apply_intra_2opt(std::vector<std::vector<int>>& routes, double& best_fit, bool was_feasible) const {
        bool any_improved = false;
        for (auto& route : routes) {
            int n = (int)route.size();
            if (n < 4) continue;
            bool route_improved = true;
            while (route_improved) {
                route_improved = false;
                for (int i = 1; i < n - 2; ++i) {
                    for (int j = i + 1; j < n - 1; ++j) {
                        std::reverse(route.begin() + i, route.begin() + j + 1);
                        double cand = evaluator_.evaluate_fitness_fast(routes);
                        if (is_valid_candidate(routes, cand, best_fit, was_feasible)) {
                            best_fit = cand;
                            route_improved = true;
                            any_improved = true;
                            break;
                        } else {
                            std::reverse(route.begin() + i, route.begin() + j + 1);
                        }
                    }
                    if (route_improved) break;
                }
            }
        }
        return any_improved;
    }

    // 2. Inter-route Relocate: Moves customer c from route r1 into route r2
    bool apply_inter_relocate(std::vector<std::vector<int>>& routes, double& best_fit, bool was_feasible) const {
        int num_r = (int)routes.size();
        for (int r1 = 0; r1 < num_r; ++r1) {
            int len1 = (int)routes[r1].size();
            if (len1 <= 3) continue;

            for (int i1 = 1; i1 < len1 - 1; ++i1) {
                int cust = routes[r1][i1];
                routes[r1].erase(routes[r1].begin() + i1);

                bool inserted = false;
                for (int r2 = 0; r2 < num_r; ++r2) {
                    if (r2 == r1) continue;
                    int len2 = (int)routes[r2].size();

                    for (int pos = 1; pos < len2; ++pos) {
                        routes[r2].insert(routes[r2].begin() + pos, cust);
                        double cand = evaluator_.evaluate_fitness_fast(routes);
                        if (is_valid_candidate(routes, cand, best_fit, was_feasible)) {
                            best_fit = cand;
                            inserted = true;
                            return true;
                        }
                        routes[r2].erase(routes[r2].begin() + pos);
                    }
                }

                if (!inserted) {
                    routes[r1].insert(routes[r1].begin() + i1, cust);
                }
            }
        }
        return false;
    }

    // 3. Inter-route Swap: Exchanges customer u in route r1 with customer v in route r2
    bool apply_inter_swap(std::vector<std::vector<int>>& routes, double& best_fit, bool was_feasible) const {
        int num_r = (int)routes.size();
        for (int r1 = 0; r1 < num_r - 1; ++r1) {
            int len1 = (int)routes[r1].size();
            for (int r2 = r1 + 1; r2 < num_r; ++r2) {
                int len2 = (int)routes[r2].size();

                for (int i1 = 1; i1 < len1 - 1; ++i1) {
                    for (int i2 = 1; i2 < len2 - 1; ++i2) {
                        std::swap(routes[r1][i1], routes[r2][i2]);
                        double cand = evaluator_.evaluate_fitness_fast(routes);
                        if (is_valid_candidate(routes, cand, best_fit, was_feasible)) {
                            best_fit = cand;
                            return true;
                        }
                        std::swap(routes[r1][i1], routes[r2][i2]);
                    }
                }
            }
        }
        return false;
    }

    // Variable Neighborhood Search coordinator
    bool vns_local_search(std::vector<std::vector<int>>& routes, double& best_fit, int max_passes = 2) const {
        bool overall_improved = false;
        bool was_feasible = evaluator_.evaluate(routes).is_feasible;

        for (int pass = 0; pass < max_passes; ++pass) {
            bool pass_improved = false;

            // N1: Intra-route 2-Opt
            if (apply_intra_2opt(routes, best_fit, was_feasible)) {
                pass_improved = true;
                overall_improved = true;
            }

            // N2: Inter-route Relocate
            if (apply_inter_relocate(routes, best_fit, was_feasible)) {
                pass_improved = true;
                overall_improved = true;
                apply_intra_2opt(routes, best_fit, was_feasible);
            }

            // N3: Inter-route Swap
            if (apply_inter_swap(routes, best_fit, was_feasible)) {
                pass_improved = true;
                overall_improved = true;
                apply_intra_2opt(routes, best_fit, was_feasible);
            }

            if (!pass_improved) break;
        }
        return overall_improved;
    }
};

} // namespace traffic_routing
