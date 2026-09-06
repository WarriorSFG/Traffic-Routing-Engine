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
        std::uniform_real_distribution<double> dist_angle(0.0, 2.0 * 3.14159265358979323846);
        std::bernoulli_distribution coin(0.5);
        const double PI = 3.14159265358979323846;
        const double TWO_PI = 2.0 * PI;

        // Bloch-sphere Qubit Phase Representation: Theta[i][j] in [0, 2*PI)
        // Position in [0, 1]^D derived via probability amplitude: X[i][j] = cos^2(Theta[i][j])
        std::vector<std::vector<double>> Theta(swarm_size_, std::vector<double>(D));
        std::vector<std::vector<double>> X(swarm_size_, std::vector<double>(D));
        std::vector<std::vector<double>> P(swarm_size_, std::vector<double>(D));
        std::vector<std::vector<double>> P_Theta(swarm_size_, std::vector<double>(D));
        std::vector<double> pbest_fit(swarm_size_, std::numeric_limits<double>::infinity());

        std::vector<double> G(D);
        std::vector<double> G_Theta(D);
        double gbest_fit = std::numeric_limits<double>::infinity();
        std::vector<std::vector<int>> best_routes;

        // 1. Swarm Initialization with Qubit Amplitude Angles
        if (!warm_start_keys.empty() && (int)warm_start_keys.size() == D) {
            for (int j = 0; j < D; ++j) {
                double key = std::clamp(warm_start_keys[j], 0.0001, 0.9999);
                Theta[0][j] = std::acos(std::sqrt(key));
                X[0][j] = key;
                P[0][j] = key;
                P_Theta[0][j] = Theta[0][j];
            }
            for (int i = 1; i < std::min(swarm_size_, 5); ++i) {
                for (int j = 0; j < D; ++j) {
                    double angle = Theta[0][j] + (dist01(rng) - 0.5) * 0.1;
                    Theta[i][j] = std::fmod(angle + TWO_PI, TWO_PI);
                    double c = std::cos(Theta[i][j]);
                    X[i][j] = c * c;
                    P[i][j] = X[i][j];
                    P_Theta[i][j] = Theta[i][j];
                }
            }
            for (int i = 5; i < swarm_size_; ++i) {
                for (int j = 0; j < D; ++j) {
                    Theta[i][j] = dist_angle(rng);
                    double c = std::cos(Theta[i][j]);
                    X[i][j] = c * c;
                    P[i][j] = X[i][j];
                    P_Theta[i][j] = Theta[i][j];
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
            for (int j = 0; j < D; ++j) {
                double key = std::clamp(gnn_keys[j], 0.0001, 0.9999);
                Theta[0][j] = std::acos(std::sqrt(key));
                X[0][j] = key;
                P[0][j] = key;
                P_Theta[0][j] = Theta[0][j];
            }

            for (int i = 1; i < std::min(swarm_size_, 5); ++i) {
                for (int j = 0; j < D; ++j) {
                    double angle = Theta[0][j] + (dist01(rng) - 0.5) * 0.1;
                    Theta[i][j] = std::fmod(angle + TWO_PI, TWO_PI);
                    double c = std::cos(Theta[i][j]);
                    X[i][j] = c * c;
                    P[i][j] = X[i][j];
                    P_Theta[i][j] = Theta[i][j];
                }
            }
            for (int i = 5; i < swarm_size_; ++i) {
                for (int j = 0; j < D; ++j) {
                    Theta[i][j] = dist_angle(rng);
                    double c = std::cos(Theta[i][j]);
                    X[i][j] = c * c;
                    P[i][j] = X[i][j];
                    P_Theta[i][j] = Theta[i][j];
                }
            }
        }

        // Initial swarm evaluation with Prins' Optimal Split
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
                G_Theta = P_Theta[i];
                best_routes = decoder_.decode(P[i]);
            }
        }

        // Initial Memetic refinement on global best
        double refined_fit = gbest_fit;
        if (vns_local_search(best_routes, refined_fit, 2)) {
            G = decoder_.encode_routes(best_routes);
            for (int j = 0; j < D; ++j) {
                G_Theta[j] = std::acos(std::sqrt(std::clamp(G[j], 0.0001, 0.9999)));
            }
            gbest_fit = refined_fit;
            P[0] = G;
            P_Theta[0] = G_Theta;
            pbest_fit[0] = gbest_fit;
        }

        SolverResult res;
        res.algorithm_name = "Quantum-Inspired PSO (QPSO)";

        auto init_time = std::chrono::high_resolution_clock::now();
        double init_elapsed = std::chrono::duration<double, std::milli>(init_time - start_time).count();
        res.history.push_back({0, gbest_fit, gbest_fit, init_elapsed});

        std::vector<double> mbest_theta(D, 0.0);
        std::vector<double> current_fit(swarm_size_);

        for (int iter = 1; iter <= max_iter_; ++iter) {
            // Step 1: Compute mean best phase angle mbest_theta
            std::fill(mbest_theta.begin(), mbest_theta.end(), 0.0);
            for (int i = 0; i < swarm_size_; ++i) {
                for (int j = 0; j < D; ++j) {
                    mbest_theta[j] += P_Theta[i][j];
                }
            }
            double inv_M = 1.0 / swarm_size_;
            for (int j = 0; j < D; ++j) {
                mbest_theta[j] *= inv_M;
            }

            // Step 2: Adaptive non-linear contraction-expansion coefficient beta(t)
            double progress = (double)iter / (double)max_iter_;
            double beta = beta_min_ + (beta_max_ - beta_min_) * std::exp(-2.2 * progress * progress);

            // Step 3: Quantum Rotation Gate Dynamic Update
            for (int i = 0; i < swarm_size_; ++i) {
                for (int j = 0; j < D; ++j) {
                    double phi = dist01(rng);
                    double p_theta_ij = phi * P_Theta[i][j] + (1.0 - phi) * G_Theta[j];

                    double u = std::max(1e-12, dist01(rng));
                    double log_term = std::log(1.0 / u);
                    double angle_diff = std::abs(mbest_theta[j] - Theta[i][j]);
                    double delta_theta = beta * angle_diff * log_term;

                    double sign = coin(rng) ? 1.0 : -1.0;
                    double next_theta = p_theta_ij + sign * delta_theta;

                    // Periodic phase wrap on Bloch sphere: [0, 2*PI)
                    next_theta = std::fmod(next_theta, TWO_PI);
                    if (next_theta < 0.0) next_theta += TWO_PI;

                    Theta[i][j] = next_theta;
                    double c = std::cos(next_theta);
                    X[i][j] = c * c;
                }
            }

            // Step 3b: Kendall-Tau Permutation Swarm Entropy & Cataclysm
            if (iter % 12 == 0) {
                double avg_tau = compute_swarm_kendall_tau(P);
                if (avg_tau < 0.12) {
                    // Quantum phase cataclysm: re-superpose 60% of swarm angles
                    int start_k = std::max(2, swarm_size_ / 3);
                    for (int k = start_k; k < swarm_size_; ++k) {
                        for (int j = 0; j < D; ++j) {
                            Theta[k][j] = dist_angle(rng);
                            double c = std::cos(Theta[k][j]);
                            X[k][j] = c * c;
                        }
                    }
                }
            }

            // Step 4: Parallel fitness evaluation using Prins' Optimal Split
            #pragma omp parallel for
            for (int i = 0; i < swarm_size_; ++i) {
                auto routes = decoder_.decode(X[i]);
                current_fit[i] = evaluator_.evaluate_fitness_fast(routes);
            }

            // Step 5: Update personal bests and global best
            double iter_best = std::numeric_limits<double>::infinity();
            for (int i = 0; i < swarm_size_; ++i) {
                if (current_fit[i] < pbest_fit[i]) {
                    pbest_fit[i] = current_fit[i];
                    P[i] = X[i];
                    P_Theta[i] = Theta[i];
                }
                if (pbest_fit[i] < gbest_fit) {
                    gbest_fit = pbest_fit[i];
                    G = P[i];
                    G_Theta = P_Theta[i];
                    best_routes = decoder_.decode(P[i]);
                }
                if (current_fit[i] < iter_best) {
                    iter_best = current_fit[i];
                }
            }

            // Step 6: Hybrid Memetic VNS Local Search on Global Best
            if (iter % 4 == 0 || iter == max_iter_) {
                auto candidate_routes = best_routes;
                double vns_fit = gbest_fit;
                if (vns_local_search(candidate_routes, vns_fit, 2)) {
                    if (vns_fit < gbest_fit) {
                        best_routes = candidate_routes;
                        gbest_fit = vns_fit;
                        G = decoder_.encode_routes(candidate_routes);
                        for (int j = 0; j < D; ++j) {
                            G_Theta[j] = std::acos(std::sqrt(std::clamp(G[j], 0.0001, 0.9999)));
                        }

                        // Re-seed worst particle with global best
                        size_t worst_idx = 0;
                        double worst_val = -1.0;
                        for (size_t i = 0; i < (size_t)swarm_size_; ++i) {
                            if (pbest_fit[i] > worst_val) {
                                worst_val = pbest_fit[i];
                                worst_idx = i;
                            }
                        }
                        P[worst_idx] = G;
                        P_Theta[worst_idx] = G_Theta;
                        X[worst_idx] = G;
                        Theta[worst_idx] = G_Theta;
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

    // Computes average normalized Kendall-Tau distance between personal best permutations and G
    double compute_swarm_kendall_tau(const std::vector<std::vector<double>>& P) const {
        int D = prob_.num_customers;
        if (D <= 1) return 1.0;
        int total_pairs = D * (D - 1) / 2;

        std::vector<int> g_seq = decoder_.decode_sequence(P[0]);
        std::vector<int> g_rank(D + 1);
        for (int r = 0; r < D; ++r) {
            g_rank[g_seq[r]] = r;
        }

        double total_norm_dist = 0.0;
        int count = 0;

        for (int i = 1; i < swarm_size_; ++i) {
            std::vector<int> p_seq = decoder_.decode_sequence(P[i]);
            std::vector<int> p_rank(D + 1);
            for (int r = 0; r < D; ++r) {
                p_rank[p_seq[r]] = r;
            }

            int inversions = 0;
            for (int a = 1; a < D; ++a) {
                for (int b = a + 1; b <= D; ++b) {
                    bool g_order = (g_rank[a] < g_rank[b]);
                    bool p_order = (p_rank[a] < p_rank[b]);
                    if (g_order != p_order) inversions++;
                }
            }
            total_norm_dist += (double)inversions / (double)total_pairs;
            count++;
        }
        return count > 0 ? (total_norm_dist / count) : 1.0;
    }

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
