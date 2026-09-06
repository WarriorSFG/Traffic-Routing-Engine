#pragma once

#include "types.hpp"
#include "encoding.hpp"
#include "fitness.hpp"
#include <vector>
#include <random>
#include <chrono>
#include <limits>
#include <algorithm>
#include <omp.h>

namespace traffic_routing {

class PSOSolver {
public:
    PSOSolver(
        const ProblemData& prob,
        const PenaltyWeights& weights,
        int swarm_size = 40,
        int max_iter = 150,
        double w = 0.7298,
        double c1 = 1.49618,
        double c2 = 1.49618,
        unsigned int seed = 42
    ) : prob_(prob),
        weights_(weights),
        decoder_(prob, weights.vehicle_cost),
        evaluator_(prob, weights),
        swarm_size_(swarm_size),
        max_iter_(max_iter),
        w_(w),
        c1_(c1),
        c2_(c2),
        seed_(seed) {}

    SolverResult solve(const std::vector<double>& warm_start_keys = {}) {
        auto start_time = std::chrono::high_resolution_clock::now();

        int D = prob_.num_customers;
        std::mt19937 rng(seed_);
        std::uniform_real_distribution<double> dist01(0.0, 1.0);
        std::uniform_real_distribution<double> dist_vel(-0.1, 0.1);
        double v_max = 0.2;

        // Particle states
        std::vector<std::vector<double>> X(swarm_size_, std::vector<double>(D));
        std::vector<std::vector<double>> V(swarm_size_, std::vector<double>(D));
        std::vector<std::vector<double>> P(swarm_size_, std::vector<double>(D));
        std::vector<double> pbest_fit(swarm_size_, std::numeric_limits<double>::infinity());

        std::vector<double> G(D);
        double gbest_fit = std::numeric_limits<double>::infinity();

        // Initialize particles
        for (int i = 0; i < swarm_size_; ++i) {
            for (int j = 0; j < D; ++j) {
                X[i][j] = dist01(rng);
                V[i][j] = dist_vel(rng);
                P[i][j] = X[i][j];
            }
        }

        // Apply warm start if provided
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
        }

        // Initial evaluation
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
        res.algorithm_name = "Classical PSO";

        auto init_time = std::chrono::high_resolution_clock::now();
        double init_elapsed = std::chrono::duration<double, std::milli>(init_time - start_time).count();
        res.history.push_back({0, gbest_fit, gbest_fit, init_elapsed});

        // Iteration Loop
        std::vector<double> current_fit(swarm_size_);

        for (int iter = 1; iter <= max_iter_; ++iter) {
            // Dynamic inertia weight annealing: w_max -> w_min (Reference.md §9.3)
            double w_curr = w_ - (w_ - 0.4) * ((double)iter / (double)max_iter_);

            // Velocity & Position update (§9.3, §9.4)
            for (int i = 0; i < swarm_size_; ++i) {
                for (int j = 0; j < D; ++j) {
                    double r1 = dist01(rng);
                    double r2 = dist01(rng);
                    double v = w_curr * V[i][j] + c1_ * r1 * (P[i][j] - X[i][j]) + c2_ * r2 * (G[j] - X[i][j]);

                    // Velocity clamping
                    if (v > v_max) v = v_max;
                    else if (v < -v_max) v = -v_max;
                    V[i][j] = v;

                    double x = X[i][j] + v;
                    // Reflective boundary handling to prevent clumping
                    if (x < 0.0) {
                        x = -x;
                        V[i][j] = -V[i][j] * 0.5;
                    } else if (x > 1.0) {
                        x = 2.0 - x;
                        V[i][j] = -V[i][j] * 0.5;
                    }
                    X[i][j] = std::clamp(x, 0.0, 1.0);
                }
            }

            // Parallel fitness evaluation
            #pragma omp parallel for
            for (int i = 0; i < swarm_size_; ++i) {
                auto routes = decoder_.decode(X[i]);
                current_fit[i] = evaluator_.evaluate_fitness_fast(routes);
            }

            // Update personal and global bests (§9.2)
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
    double w_;
    double c1_;
    double c2_;
    unsigned int seed_;
};

} // namespace traffic_routing
