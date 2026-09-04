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

    // Splits customer permutation into capacitated vehicle routes (Chapter 10.3)
    std::vector<std::vector<int>> split_routes(const std::vector<int>& sequence) const {
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

    // Full decode: keys -> routes
    std::vector<std::vector<int>> decode(const std::vector<double>& keys) const {
        std::vector<int> seq = decode_sequence(keys);
        return split_routes(seq);
    }

private:
    const ProblemData& prob_;
};

} // namespace traffic_routing
