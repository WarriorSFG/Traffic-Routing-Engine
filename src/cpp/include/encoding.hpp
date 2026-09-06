#pragma once

#include "types.hpp"
#include <vector>
#include <algorithm>
#include <numeric>
#include <limits>
#include <cmath>

namespace traffic_routing {

class RandomKeyDecoder {
public:
    explicit RandomKeyDecoder(const ProblemData& prob, double vehicle_cost = 0.5)
        : prob_(prob), vehicle_cost_(vehicle_cost) {}

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

    // Fallback: Naive greedy capacity split
    std::vector<std::vector<int>> greedy_split(const std::vector<int>& sequence) const {
        std::vector<std::vector<int>> routes;
        std::vector<int> curr_route = {0};
        double curr_load = 0.0;
        double capacity = prob_.capacity;

        for (int cust_idx : sequence) {
            double demand = prob_.demands[cust_idx];
            if (curr_load + demand <= capacity) {
                curr_route.push_back(cust_idx);
                curr_load += demand;
            } else {
                curr_route.push_back(0);
                routes.push_back(curr_route);
                curr_route = {0, cust_idx};
                curr_load = demand;
            }
        }

        if (curr_route.size() > 1) {
            curr_route.push_back(0);
            routes.push_back(curr_route);
        }

        return routes;
    }

    // Bounded Prins Dynamic Programming Route Split:
    // Optimally partitions customer sequence into k <= num_vehicles routes,
    // balancing route travel times, time-window penalties, and fixed vehicle dispatch costs C_veh.
    std::vector<std::vector<int>> split_routes(const std::vector<int>& sequence) const {
        int n = sequence.size();
        if (n == 0) return {};

        int K = std::max(1, prob_.num_vehicles);

        // V[j][k]: min cost to serve first j customers using exactly k vehicles
        // P[j][k]: predecessor customer index i in 0..j-1
        std::vector<std::vector<double>> V(n + 1, std::vector<double>(K + 1, std::numeric_limits<double>::infinity()));
        std::vector<std::vector<int>> P(n + 1, std::vector<int>(K + 1, 0));
        V[0][0] = 0.0;

        double depot_start = prob_.time_windows.empty() ? 6.0 : prob_.time_windows[0].first;
        double depot_close = prob_.time_windows.empty() ? 18.0 : prob_.time_windows[0].second;

        for (int k = 1; k <= K; ++k) {
            for (int i = 0; i < n; ++i) {
                if (V[i][k - 1] >= std::numeric_limits<double>::infinity()) continue;

                double load = 0.0;
                double route_time = 0.0;
                double current_time = depot_start;
                double tw_penalty = 0.0;
                int prev_stop = 0;

                for (int j = i + 1; j <= n; ++j) {
                    int cust = sequence[j - 1];
                    load += prob_.demands[cust];
                    if (load > prob_.capacity) {
                        break; // Truck capacity exceeded
                    }

                    double leg_t = prob_.get_time(prev_stop, cust);
                    route_time += leg_t;
                    double arr_t = current_time + leg_t;

                    double e_i = prob_.time_windows[cust].first;
                    double l_i = prob_.time_windows[cust].second;
                    double s_i = prob_.service_times[cust];

                    double early_w = std::max(0.0, e_i - arr_t);
                    double late_v = std::max(0.0, arr_t - l_i);
                    tw_penalty += early_w * 10.0 + late_v * 50.0;

                    double eff_start = std::max(arr_t, e_i);
                    current_time = eff_start + s_i;
                    prev_stop = cust;

                    double return_t = prob_.get_time(cust, 0);
                    double total_r_time = route_time + return_t;
                    double depot_arr = current_time + return_t;
                    double late_depot = std::max(0.0, depot_arr - depot_close);
                    double total_tw = tw_penalty + late_depot * 50.0;

                    // Total candidate route cost: Travel Time + Vehicle Fixed Deployment Cost + TW Delay
                    double route_cost = total_r_time + vehicle_cost_ + total_tw;

                    if (V[i][k - 1] + route_cost < V[j][k]) {
                        V[j][k] = V[i][k - 1] + route_cost;
                        P[j][k] = i;
                    }
                }
            }
        }

        // Find the best vehicle count k in 1..K that achieved a complete valid partition
        double best_cost = std::numeric_limits<double>::infinity();
        int best_k = 0;
        for (int k = 1; k <= K; ++k) {
            if (V[n][k] < best_cost) {
                best_cost = V[n][k];
                best_k = k;
            }
        }

        // Fallback: If customer demand physically requires more than K vehicles,
        // use greedy capacity split to generate all necessary routes (fleet shortage violation handled by evaluator)
        if (best_k == 0) {
            return greedy_split(sequence);
        }

        // Backtrack optimal routes from P[n][best_k]
        std::vector<std::vector<int>> routes;
        int curr_j = n;
        int curr_k = best_k;
        while (curr_j > 0 && curr_k > 0) {
            int prev_j = P[curr_j][curr_k];
            std::vector<int> r = {0};
            for (int idx = prev_j; idx < curr_j; ++idx) {
                r.push_back(sequence[idx]);
            }
            r.push_back(0);
            routes.push_back(r);
            curr_j = prev_j;
            curr_k = curr_k - 1;
        }
        std::reverse(routes.begin(), routes.end());
        return routes;
    }

    // Full decode: keys -> routes
    std::vector<std::vector<int>> decode(const std::vector<double>& keys) const {
        std::vector<int> seq = decode_sequence(keys);
        return split_routes(seq);
    }

    // Inverse of decode: customer visitation sequence -> random keys in [0, 1]^D
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

private:
    const ProblemData& prob_;
    double vehicle_cost_ = 0.5;
};

} // namespace traffic_routing
