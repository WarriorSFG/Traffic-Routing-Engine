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

        // Particle states: position X and personal best P
        std::vector<std::vector<double>> X(swarm_size_, std::vector<double>(D));
        std::vector<std::vector<double>> P(swarm_size_, std::vector<double>(D));
        std::vector<double> pbest_fit(swarm_size_, std::numeric_limits<double>::infinity());

        std::vector<double> G(D);
        double gbest_fit = std::numeric_limits<double>::infinity();

        // ── Bug Fix 1: GNN-Seeded Initialization ──
        // Run GNN internally and encode its solution as particle 0.
        // This ensures QPSO starts no worse than the GNN baseline.
        GNNSolver gnn_solver(prob_, weights_);
        SolverResult gnn_res = gnn_solver.solve();

        // Extract customer visitation order from GNN routes
        std::vector<int> gnn_sequence;
        for (const auto& route : gnn_res.best_solution.routes) {
            for (int stop : route) {
                if (stop != 0) {
                    gnn_sequence.push_back(stop);
                }
            }
        }

        // Encode GNN sequence as random keys
        std::vector<double> gnn_keys = decoder_.encode(gnn_sequence);

        // 1. Swarm Initialization (§11.6 Step 1)
        // Particle 0 = GNN solution
        X[0] = gnn_keys;
        P[0] = gnn_keys;

        // Particles 1..4 = small perturbations of GNN (neighborhood exploration)
        for (int i = 1; i < std::min(swarm_size_, 5); ++i) {
            for (int j = 0; j < D; ++j) {
                double noise = (dist01(rng) - 0.5) * 0.08;
                X[i][j] = gnn_keys[j] + noise;
                // Modular wrap into [0, 1]
                X[i][j] = X[i][j] - std::floor(X[i][j]);
                P[i][j] = X[i][j];
            }
        }

        // Remaining particles = random initialization
        for (int i = 5; i < swarm_size_; ++i) {
            for (int j = 0; j < D; ++j) {
                X[i][j] = dist01(rng);
                P[i][j] = X[i][j];
            }
        }

        // Apply external warm start if provided (e.g. from dynamic re-routing §12.2)
        // This overrides particle 0 if provided
        if (!warm_start_keys.empty() && (int)warm_start_keys.size() == D) {
            X[0] = warm_start_keys;
            P[0] = warm_start_keys;
            for (int i = 1; i < std::min(swarm_size_, 5); ++i) {
                for (int j = 0; j < D; ++j) {
                    double noise = (dist01(rng) - 0.5) * 0.1;
                    X[i][j] = warm_start_keys[j] + noise;
                    X[i][j] = X[i][j] - std::floor(X[i][j]);
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
            }
        }

        SolverResult res;
        res.algorithm_name = "Quantum-Inspired PSO (QPSO)";

        auto init_time = std::chrono::high_resolution_clock::now();
        double init_elapsed = std::chrono::duration<double, std::milli>(init_time - start_time).count();
        res.history.push_back({0, gbest_fit, gbest_fit, init_elapsed});

        std::vector<double> mbest(D, 0.0);
        std::vector<double> current_fit(swarm_size_);

        // ── Bug Fix 3: Correct QPSO Iteration Order (§11.6) ──
        // The reference specifies:
        //   1. Evaluate fitness F(X_i^t)
        //   2. Update P_i if improved; update G if improved
        //   3. Compute mbest
        //   4. Update beta(t)
        //   5. Update positions X via quantum sampling
        //   6. Clamp X into [0,1]

        for (int iter = 1; iter <= max_iter_; ++iter) {

            // Step 1: Evaluate fitness for every particle (§11.6 Step 1)
            #pragma omp parallel for
            for (int i = 0; i < swarm_size_; ++i) {
                auto routes = decoder_.decode(X[i]);
                current_fit[i] = evaluator_.evaluate_fitness_fast(routes);
            }

            // Step 2: Update personal bests P_i and global best G (§11.6 Step 2)
            double iter_best = std::numeric_limits<double>::infinity();
            for (int i = 0; i < swarm_size_; ++i) {
                if (current_fit[i] < pbest_fit[i]) {
                    pbest_fit[i] = current_fit[i];
                    P[i] = X[i];
                }
                if (pbest_fit[i] < gbest_fit) {
                    gbest_fit = pbest_fit[i];
                    G = P[i];
                }
                if (current_fit[i] < iter_best) {
                    iter_best = current_fit[i];
                }
            }

            // ── Bug Fix 4: Periodic 2-opt local search on global best ──
            // Every 10 iterations, apply intra-route 2-opt refinement to the
            // global best decoded routes, then re-encode and update G if improved.
            if (iter % 10 == 0) {
                auto g_routes = decoder_.decode(G);
                bool improved = false;
                for (auto& route : g_routes) {
                    if (route.size() <= 4) continue; // depot + 2 customers + depot minimum
                    improved |= apply_2opt(route);
                }
                if (improved) {
                    double new_fit = evaluator_.evaluate_fitness_fast(g_routes);
                    if (new_fit < gbest_fit) {
                        // Re-encode the improved routes back to random keys
                        std::vector<int> improved_seq;
                        for (const auto& route : g_routes) {
                            for (int stop : route) {
                                if (stop != 0) improved_seq.push_back(stop);
                            }
                        }
                        G = decoder_.encode(improved_seq);
                        gbest_fit = new_fit;
                    }
                }
            }

            // Step 3: Compute mean best position mbest (§11.2)
            // mbest_j = (1 / M) * sum_{i=1}^M P_{ij}
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

            // Step 4: Update contraction-expansion coefficient beta(t) (§11.5)
            // beta(t) = beta_max - (beta_max - beta_min) * (t / T_max)
            double beta = beta_max_ - (beta_max_ - beta_min_) * ((double)iter / (double)max_iter_);

            // Step 5: Quantum position sampling update (§11.3, §11.4)
            for (int i = 0; i < swarm_size_; ++i) {
                for (int j = 0; j < D; ++j) {
                    // Local attractor: p_ij = phi * P_ij + (1 - phi) * G_j
                    double phi = dist01(rng);
                    double p_ij = phi * P[i][j] + (1.0 - phi) * G[j];

                    // Quantum delta-potential well wave equation collapse:
                    // X_{ij}^{t+1} = p_{ij} +/- beta * |mbest_j - X_{ij}^t| * ln(1 / u)
                    double u = std::max(1e-12, dist01(rng));
                    double log_term = std::log(1.0 / u);
                    double jump = beta * std::abs(mbest[j] - X[i][j]) * log_term;

                    double sign = coin(rng) ? 1.0 : -1.0;
                    double next_val = p_ij + sign * jump;

                    // ── Bug Fix 2: Modular wrapping instead of hard clamping ──
                    // Preserves relative ordering information by wrapping around
                    // [0, 1] instead of crushing values to the boundary.
                    // Step 6: Wrap X into [0, 1] (replaces §11.6 Step 6 clamping)
                    next_val = next_val - std::floor(next_val);

                    X[i][j] = next_val;
                }
            }

            auto iter_now = std::chrono::high_resolution_clock::now();
            double iter_elapsed = std::chrono::duration<double, std::milli>(iter_now - start_time).count();
            res.history.push_back({iter, gbest_fit, iter_best, iter_elapsed});
        }

        auto end_time = std::chrono::high_resolution_clock::now();
        res.total_compute_ms = std::chrono::duration<double, std::milli>(end_time - start_time).count();
        res.best_fitness = gbest_fit;
        res.best_solution = evaluator_.evaluate(decoder_.decode(G));

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

    // Intra-route 2-opt improvement (Bug Fix 4)
    // Reverses a segment of the route if it reduces travel time.
    // Returns true if any improvement was made.
    bool apply_2opt(std::vector<int>& route) const {
        if (route.size() < 4) return false;
        int n = (int)route.size();
        bool improved = false;
        bool changed = true;

        while (changed) {
            changed = false;
            for (int i = 1; i < n - 2; ++i) {
                for (int j = i + 1; j < n - 1; ++j) {
                    // Current edges: (route[i-1], route[i]) and (route[j], route[j+1])
                    // Candidate edges: (route[i-1], route[j]) and (route[i], route[j+1])
                    double d_old = prob_.get_time(route[i - 1], route[i])
                                 + prob_.get_time(route[j], route[j + 1]);
                    double d_new = prob_.get_time(route[i - 1], route[j])
                                 + prob_.get_time(route[i], route[j + 1]);

                    if (d_new < d_old - 1e-10) {
                        // Reverse the segment [i..j]
                        std::reverse(route.begin() + i, route.begin() + j + 1);
                        changed = true;
                        improved = true;
                    }
                }
            }
        }
        return improved;
    }
};

} // namespace traffic_routing

