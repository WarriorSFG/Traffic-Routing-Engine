#pragma once

#include "types.hpp"
#include "fitness.hpp"
#include <chrono>
#include <vector>
#include <limits>
#include <unordered_set>

namespace traffic_routing {

class GNNSolver {
public:
    explicit GNNSolver(const ProblemData& prob, const PenaltyWeights& weights)
        : prob_(prob), evaluator_(prob, weights) {}

    SolverResult solve() {
        auto start_time = std::chrono::high_resolution_clock::now();

        std::unordered_set<int> unvisited;
        for (int i = 1; i < prob_.num_stops; ++i) {
            unvisited.insert(i);
        }

        std::vector<std::vector<int>> routes;
        std::vector<int> curr_route = {0};
        double curr_load = 0.0;
        int curr_node = 0;

        while (!unvisited.empty()) {
            int best_next = -1;
            double min_time = std::numeric_limits<double>::infinity();

            for (int cand : unvisited) {
                double demand = prob_.demands[cand];
                if (curr_load + demand <= prob_.capacity) {
                    double t = prob_.get_time(curr_node, cand);
                    if (t < min_time) {
                        min_time = t;
                        best_next = cand;
                    }
                }
            }

            if (best_next != -1) {
                curr_route.push_back(best_next);
                curr_load += prob_.demands[best_next];
                curr_node = best_next;
                unvisited.erase(best_next);
            } else {
                // Return to depot and start a new vehicle route
                curr_route.push_back(0);
                routes.push_back(curr_route);
                curr_route = {0};
                curr_load = 0.0;
                curr_node = 0;
            }
        }

        if (curr_route.size() > 1) {
            curr_route.push_back(0);
            routes.push_back(curr_route);
        }

        auto end_time = std::chrono::high_resolution_clock::now();
        double elapsed_ms = std::chrono::duration<double, std::milli>(end_time - start_time).count();

        Solution best_sol = evaluator_.evaluate(routes);

        SolverResult res;
        res.algorithm_name = "Greedy Nearest Neighbor (GNN)";
        res.best_solution = best_sol;
        res.best_fitness = best_sol.penalized_fitness;
        res.total_compute_ms = elapsed_ms;
        res.history.push_back({0, best_sol.penalized_fitness, best_sol.penalized_fitness, elapsed_ms});

        return res;
    }

private:
    const ProblemData& prob_;
    FitnessEvaluator evaluator_;
};

} // namespace traffic_routing
