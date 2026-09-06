#pragma once

#include "types.hpp"
#include <vector>
#include <algorithm>
#include <numeric>

namespace traffic_routing {

class RandomKeyDecoder {
public:
    explicit RandomKeyDecoder(const ProblemData& prob) : prob_(prob) {}

    // Extracts customer permutation (indices 1..n) from continuous keys in [0, 1]^D
    std::vector<int> decode_sequence(const std::vector<double>& keys) const {
        int D = prob_.num_customers;
        std::vector<int> perm(D);
        std::iota(perm.begin(), perm.end(), 0);

        std::stable_sort(perm.begin(), perm.end(), [&keys](int a, int b) {
            return keys[a] < keys[b];
        });

        // Shift 0..D-1 to 1..D
        for (int i = 0; i < D; ++i) {
            perm[i] += 1;
        }
        return perm;
    }

    // Splits customer permutation into vehicle routes respecting capacity, time, and fleet size
    std::vector<std::vector<int>> split_routes(const std::vector<int>& sequence) const {
        std::vector<std::vector<int>> routes;
        std::vector<int> curr_route = {0};
        double curr_load = 0.0;
        double curr_time = prob_.time_windows[0].first;
        int curr_node = 0;
        double capacity = prob_.capacity;
        double depot_close = prob_.time_windows[0].second;
        int max_vehicles = prob_.num_vehicles > 0 ? prob_.num_vehicles : 1;

        for (int cust_idx : sequence) {
            double demand = prob_.demands[cust_idx];
            double travel_t = prob_.get_time(curr_node, cust_idx);
            double arr_t = curr_time + travel_t;
            double e_i = prob_.time_windows[cust_idx].first;
            double s_i = prob_.service_times[cust_idx];
            double eff_start = std::max(arr_t, e_i);
            double ret_depot_arr = eff_start + s_i + prob_.get_time(cust_idx, 0);

            // Can we split into a new vehicle if current one cannot serve feasibly?
            bool can_open_new_vehicle = ((int)routes.size() + 1 < max_vehicles);

            bool cap_ok = (curr_load + demand <= capacity);
            bool time_ok = (ret_depot_arr <= depot_close);

            if (curr_route.size() == 1 || (cap_ok && (time_ok || !can_open_new_vehicle))) {
                // Keep in current route
                curr_route.push_back(cust_idx);
                curr_load += demand;
                curr_time = eff_start + s_i;
                curr_node = cust_idx;
            } else {
                // Close current route and start next vehicle
                curr_route.push_back(0);
                routes.push_back(curr_route);

                double travel_from_depot = prob_.get_time(0, cust_idx);
                double new_arr = prob_.time_windows[0].first + travel_from_depot;
                double new_start = std::max(new_arr, e_i);

                curr_route = {0, cust_idx};
                curr_load = demand;
                curr_time = new_start + s_i;
                curr_node = cust_idx;
            }
        }

        if (curr_route.size() > 1) {
            curr_route.push_back(0);
            routes.push_back(curr_route);
        }

        return routes;
    }

    // Prins' Optimal DAG Split Algorithm (Prins 2004, Vidal 2014)
    // Solves the optimal vehicle route partition of a customer sequence in O(B*N) via Bellman-Ford DAG shortest path.
    std::vector<std::vector<int>> split_routes_prins(const std::vector<int>& sequence) const {
        int n = (int)sequence.size();
        if (n == 0) return {};

        int max_vehicles = prob_.num_vehicles > 0 ? prob_.num_vehicles : 1;
        double capacity = prob_.capacity;
        double depot_start = prob_.time_windows[0].first;
        double depot_close = prob_.time_windows[0].second;

        // DP state: V[i] is min cost to serve prefix sequence[0..i-1]
        std::vector<double> V(n + 1, std::numeric_limits<double>::infinity());
        std::vector<int> pred(n + 1, -1);
        V[0] = 0.0;

        for (int i = 0; i < n; ++i) {
            if (V[i] == std::numeric_limits<double>::infinity()) continue;

            double load = 0.0;
            double route_time = 0.0;
            double current_t = depot_start;
            double tw_penalty = 0.0;
            int prev = 0;

            for (int j = i + 1; j <= n; ++j) {
                int cust = sequence[j - 1];
                load += prob_.demands[cust];

                // Capacity constraint pruning
                if (load > capacity) break;

                // Incremental travel time
                double travel_ij = prob_.get_time(prev, cust);
                double arr_t = current_t + travel_ij;

                double e_i = prob_.time_windows[cust].first;
                double l_i = prob_.time_windows[cust].second;
                double s_i = prob_.service_times[cust];

                double early_wait = std::max(0.0, e_i - arr_t);
                double late_time = std::max(0.0, arr_t - l_i);
                tw_penalty += early_wait * 0.0 + late_time * 50.0;

                double eff_start = std::max(arr_t, e_i);
                current_t = eff_start + s_i;
                route_time += travel_ij;
                prev = cust;

                // Return to depot
                double ret_depot = prob_.get_time(prev, 0);
                double depot_arr = current_t + ret_depot;
                double late_depot = std::max(0.0, depot_arr - depot_close);
                double total_tw = tw_penalty + late_depot * 50.0;

                double total_arc_cost = route_time + ret_depot + 500.0 * total_tw;

                if (V[i] + total_arc_cost < V[j]) {
                    V[j] = V[i] + total_arc_cost;
                    pred[j] = i;
                }
            }
        }

        // If DAG shortest path reached end node n, backtrack routes
        if (V[n] < std::numeric_limits<double>::infinity()) {
            std::vector<std::vector<int>> reversed_routes;
            int curr = n;
            while (curr > 0) {
                int p = pred[curr];
                if (p < 0) break;
                std::vector<int> r = {0};
                for (int k = p; k < curr; ++k) {
                    r.push_back(sequence[k]);
                }
                r.push_back(0);
                reversed_routes.push_back(r);
                curr = p;
            }

            // Check if fleet size constraint is satisfied
            if ((int)reversed_routes.size() <= max_vehicles) {
                std::reverse(reversed_routes.begin(), reversed_routes.end());
                return reversed_routes;
            }
        }

        // Fallback to greedy split if fleet limit exceeded or unreachable
        return split_routes(sequence);
    }

    // Full decode: keys -> routes using Prins' Optimal DAG Split
    std::vector<std::vector<int>> decode(const std::vector<double>& keys) const {
        std::vector<int> seq = decode_sequence(keys);
        return split_routes_prins(seq);
    }

    // Inverse of decode: customer visitation sequence -> random keys in [0, 1]^D
    // Given sequence [c_1, c_2, ..., c_D] (1-indexed customer IDs),
    // produce keys such that argsort(keys) recovers this sequence.
    std::vector<double> encode(const std::vector<int>& sequence) const {
        int D = prob_.num_customers;
        std::vector<double> keys(D, 0.5);
        double step = 1.0 / (double)(D + 1);
        for (int rank = 0; rank < (int)sequence.size(); ++rank) {
            int cust = sequence[rank];  // 1-indexed customer ID
            int idx = cust - 1;         // 0-indexed into keys
            if (idx >= 0 && idx < D) {
                keys[idx] = (rank + 1) * step;
            }
        }
        return keys;
    }

    // Encodes segmented multi-vehicle routes directly into continuous keys in [0, 1]^D
    // Preserves vehicle route clustering by spacing route partitions across disjoint key intervals.
    std::vector<double> encode_routes(const std::vector<std::vector<int>>& routes) const {
        int D = prob_.num_customers;
        std::vector<double> keys(D, 0.5);
        int valid_routes = 0;
        for (const auto& r : routes) {
            int c = 0;
            for (int s : r) if (s != 0) c++;
            if (c > 0) valid_routes++;
        }
        if (valid_routes == 0) return keys;

        double r_width = 0.98 / (double)valid_routes;
        int r_idx = 0;
        for (const auto& r : routes) {
            std::vector<int> custs;
            for (int s : r) if (s != 0) custs.push_back(s);
            if (custs.empty()) continue;

            double r_base = 0.01 + r_idx * r_width;
            double step = r_width / (double)(custs.size() + 1);
            for (size_t i = 0; i < custs.size(); ++i) {
                int cust = custs[i];
                int idx = cust - 1;
                if (idx >= 0 && idx < D) {
                    keys[idx] = r_base + (i + 1) * step;
                }
            }
            r_idx++;
        }
        return keys;
    }

private:
    const ProblemData& prob_;
};

} // namespace traffic_routing
