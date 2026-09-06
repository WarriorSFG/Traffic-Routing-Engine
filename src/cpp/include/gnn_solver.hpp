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
        : prob_(prob), weights_(weights), evaluator_(prob, weights) {}

    SolverResult solve() {
        auto start_time = std::chrono::high_resolution_clock::now();

        std::vector<int> unvisited;
        unvisited.reserve(prob_.num_stops - 1);
        for (int i = 1; i < prob_.num_stops; ++i) {
            unvisited.push_back(i);
        }

        std::vector<std::vector<int>> routes;
        std::vector<int> curr_route = {0};
        double curr_load = 0.0;
        double curr_time = prob_.time_windows[0].first;
        int curr_node = 0;
        double depot_close = prob_.time_windows[0].second;
        int max_vehicles = prob_.num_vehicles > 0 ? prob_.num_vehicles : 1;

        while (!unvisited.empty()) {
            int best_cand_idx = -1;
            double best_score = std::numeric_limits<double>::infinity();
            bool found_feasible = false;

            // 1. Search for strictly feasible candidate
            for (size_t i = 0; i < unvisited.size(); ++i) {
                int cand = unvisited[i];
                double demand = prob_.demands[cand];
                double travel_t = prob_.get_time(curr_node, cand);
                double arr_t = curr_time + travel_t;
                double e_i = prob_.time_windows[cand].first;
                double l_i = prob_.time_windows[cand].second;
                double s_i = prob_.service_times[cand];
                double eff_start = std::max(arr_t, e_i);
                double ret_depot_arr = eff_start + s_i + prob_.get_time(cand, 0);

                bool cap_ok = (curr_load + demand <= prob_.capacity);
                bool tw_ok = (arr_t <= l_i);
                bool depot_ok = (ret_depot_arr <= depot_close);

                if (cap_ok && tw_ok && depot_ok) {
                    double score = travel_t + 0.5 * std::max(0.0, e_i - arr_t) + 0.1 * (l_i - arr_t);
                    if (!found_feasible || score < best_score) {
                        best_score = score;
                        best_cand_idx = (int)i;
                        found_feasible = true;
                    }
                }
            }

            if (found_feasible) {
                int cand = unvisited[best_cand_idx];
                curr_route.push_back(cand);
                curr_load += prob_.demands[cand];
                double arr_t = curr_time + prob_.get_time(curr_node, cand);
                double eff_start = std::max(arr_t, prob_.time_windows[cand].first);
                curr_time = eff_start + prob_.service_times[cand];
                curr_node = cand;
                unvisited.erase(unvisited.begin() + best_cand_idx);
            } else if ((int)routes.size() + 1 < max_vehicles && curr_route.size() > 1) {
                // Close current vehicle route and start a new vehicle from depot
                curr_route.push_back(0);
                routes.push_back(curr_route);
                curr_route = {0};
                curr_load = 0.0;
                curr_time = prob_.time_windows[0].first;
                curr_node = 0;
            } else {
                // All vehicles exhausted or vehicle at depot cannot serve feasibly: pick candidate minimizing soft penalty
                double min_penalty_score = std::numeric_limits<double>::infinity();
                int fallback_idx = 0;

                for (size_t i = 0; i < unvisited.size(); ++i) {
                    int cand = unvisited[i];
                    double demand = prob_.demands[cand];
                    double travel_t = prob_.get_time(curr_node, cand);
                    double arr_t = curr_time + travel_t;
                    double e_i = prob_.time_windows[cand].first;
                    double l_i = prob_.time_windows[cand].second;
                    double s_i = prob_.service_times[cand];
                    double eff_start = std::max(arr_t, e_i);
                    double ret_depot_arr = eff_start + s_i + prob_.get_time(cand, 0);

                    double cap_viol = std::max(0.0, curr_load + demand - prob_.capacity);
                    double late_viol = std::max(0.0, arr_t - l_i) + std::max(0.0, ret_depot_arr - depot_close);
                    double penalty_score = travel_t + weights_.lambda_cap * cap_viol + weights_.rho_late * late_viol;

                    if (penalty_score < min_penalty_score) {
                        min_penalty_score = penalty_score;
                        fallback_idx = (int)i;
                    }
                }

                int cand = unvisited[fallback_idx];
                curr_route.push_back(cand);
                curr_load += prob_.demands[cand];
                double arr_t = curr_time + prob_.get_time(curr_node, cand);
                double eff_start = std::max(arr_t, prob_.time_windows[cand].first);
                curr_time = eff_start + prob_.service_times[cand];
                curr_node = cand;
                unvisited.erase(unvisited.begin() + fallback_idx);
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
    const PenaltyWeights& weights_;
    FitnessEvaluator evaluator_;
};

} // namespace traffic_routing
