#pragma once

#include "types.hpp"
#include "encoding.hpp"
#include "fitness.hpp"
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

        // 1. Swarm Initialization (§11.6 Step 1)
        for (int i = 0; i < swarm_size_; ++i) {
            for (int j = 0; j < D; ++j) {
                X[i][j] = dist01(rng);
                P[i][j] = X[i][j];
            }
        }

        // Apply warm start if provided (e.g. from prior time step during dynamic re-routing)
        if (!warm_start_keys.empty() && (int)warm_start_keys.size() == D) {
            X[0] = warm_start_keys;
            P[0] = warm_start_keys;
            // Seed a few neighboring particles around the warm start with small perturbations
            for (int i = 1; i < std::min(swarm_size_, 5); ++i) {
                for (int j = 0; j < D; ++j) {
                    double noise = (dist01(rng) - 0.5) * 0.1;
                    X[i][j] = std::clamp(warm_start_keys[j] + noise, 0.0, 1.0);
                    P[i][j] = X[i][j];
                }
            }
        }

        // Initial swarm evaluation
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

        // 2. QPSO Iteration Loop (§11.6)
        for (int iter = 1; iter <= max_iter_; ++iter) {
            // Step A: Compute mean best position (mbest) (§11.2)
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

            // Step B: Update contraction-expansion coefficient beta(t) (§11.5)
            // beta(t) = beta_max - (beta_max - beta_min) * (t / T_max)
            double beta = beta_max_ - (beta_max_ - beta_min_) * ((double)iter / (double)max_iter_);

            // Step C: Quantum position sampling update (§11.3, §11.4)
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

                    // Clamping into [0, 1] (§11.6 Step 6)
                    if (next_val < 0.0) next_val = 0.0;
                    else if (next_val > 1.0) next_val = 1.0;

                    X[i][j] = next_val;
                }
            }

            // Step D: Parallel fitness evaluation
            #pragma omp parallel for
            for (int i = 0; i < swarm_size_; ++i) {
                auto routes = decoder_.decode(X[i]);
                current_fit[i] = evaluator_.evaluate_fitness_fast(routes);
            }

            // Step E: Update personal bests P_i and global best G (§11.6 Step 2)
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
};

} // namespace traffic_routing
