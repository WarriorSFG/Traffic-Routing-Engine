#pragma once

#include "types.hpp"
#include <vector>
#include <cmath>
#include <algorithm>

namespace traffic_routing {

class FitnessEvaluator {
public:
    FitnessEvaluator(const ProblemData& prob, const PenaltyWeights& weights)
        : prob_(prob), weights_(weights) {}

    RouteInfo evaluate_single_route(const std::vector<int>& route) const {
        RouteInfo info;
        info.stops = route;
        if (route.size() < 2) return info;

        double depot_start = prob_.time_windows[0].first;
        double current_time = depot_start;
        info.arrival_times.push_back(current_time);

        for (size_t i = 0; i < route.size() - 1; ++i) {
            int u = route[i];
            int v = route[i + 1];

            double travel_t = prob_.get_time(u, v);
            double travel_d = prob_.get_dist(u, v);
            info.total_time += travel_t;
            info.total_distance += travel_d;

            double arr_t = current_time + travel_t;
            info.arrival_times.push_back(arr_t);

            if (v != 0) {
                double demand = prob_.demands[v];
                info.total_load += demand;

                double e_i = prob_.time_windows[v].first;
                double l_i = prob_.time_windows[v].second;
                double s_i = prob_.service_times[v];

                double early_w = std::max(0.0, e_i - arr_t);
                double late_v = std::max(0.0, arr_t - l_i);
                info.tw_penalty += early_w * weights_.rho_early + late_v * weights_.rho_late;

                double eff_start = std::max(arr_t, e_i);
                current_time = eff_start + s_i;
            } else {
                double depot_close = prob_.time_windows[0].second;
                double late_depot = std::max(0.0, arr_t - depot_close);
                info.tw_penalty += late_depot * weights_.rho_late;
                current_time = arr_t;
            }
        }

        info.capacity_violation = std::max(0.0, info.total_load - prob_.capacity);
        return info;
    }

    Solution evaluate(const std::vector<std::vector<int>>& routes) const {
        Solution sol;
        sol.routes = routes;

        std::vector<int> visit_counts(prob_.num_stops, 0);

        for (const auto& r : routes) {
            // Filter non-depot stops
            std::vector<int> filtered = {0};
            for (int stop : r) {
                if (stop != 0) {
                    filtered.push_back(stop);
                    if (stop < prob_.num_stops) {
                        visit_counts[stop]++;
                    }
                }
            }
            if (filtered.size() <= 1) continue;
            filtered.push_back(0);

            RouteInfo rinfo = evaluate_single_route(filtered);
            sol.route_details.push_back(rinfo);
            sol.total_time += rinfo.total_time;
            sol.total_distance += rinfo.total_distance;
            sol.total_load += rinfo.total_load;
            sol.total_cap_viol += rinfo.capacity_violation;
            sol.total_tw_viol += rinfo.tw_penalty;
        }

        int missing = 0;
        int duplicates = 0;
        for (int i = 1; i < prob_.num_stops; ++i) {
            if (visit_counts[i] == 0) missing++;
            else if (visit_counts[i] > 1) duplicates += (visit_counts[i] - 1);
        }
        int fleet_viol = std::max(0, (int)sol.route_details.size() - prob_.num_vehicles);
        sol.route_viol = missing + duplicates + fleet_viol;

        double dispatch_cost = (double)sol.route_details.size() * weights_.vehicle_cost;
        sol.vehicle_cost = dispatch_cost;

        sol.penalized_fitness = sol.total_time 
            + dispatch_cost
            + weights_.lambda_cap * sol.total_cap_viol
            + weights_.lambda_route * sol.route_viol
            + weights_.lambda_tw * sol.total_tw_viol;

        sol.is_feasible = (sol.total_cap_viol == 0.0 && sol.route_viol == 0 && sol.total_tw_viol == 0.0);
        return sol;
    }

    // Fast scalar fitness calculation for inner loops
    double evaluate_fitness_fast(const std::vector<std::vector<int>>& routes) const {
        return evaluate(routes).penalized_fitness;
    }

private:
    const ProblemData& prob_;
    const PenaltyWeights& weights_;
};

} // namespace traffic_routing
