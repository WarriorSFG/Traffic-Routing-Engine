#pragma once

#include <vector>
#include <string>
#include <utility>

namespace traffic_routing {

struct ProblemData {
    int num_stops = 0;              // Total stops (0 is depot, 1..n are customers)
    int num_customers = 0;          // num_stops - 1
    int num_vehicles = 0;
    double capacity = 0.0;
    
    std::vector<double> demands;          // Size: num_stops (demands[0] = 0.0)
    std::vector<double> time_matrix;      // Size: num_stops * num_stops
    std::vector<double> dist_matrix;      // Size: num_stops * num_stops
    std::vector<std::pair<double, double>> time_windows; // Size: num_stops [e_i, l_i]
    std::vector<double> service_times;    // Size: num_stops

    inline double get_time(int p, int q) const {
        return time_matrix[p * num_stops + q];
    }

    inline double get_dist(int p, int q) const {
        return dist_matrix[p * num_stops + q];
    }
};

struct PenaltyWeights {
    double lambda_cap = 1000.0;
    double lambda_route = 1000.0;
    double lambda_tw = 500.0;
    double rho_early = 10.0;
    double rho_late = 50.0;

    void auto_scale(const ProblemData& prob) {
        double max_t = 0.0;
        for (double t : prob.time_matrix) {
            if (t > max_t) max_t = t;
        }
        double scale = 10.0 * max_t * prob.num_stops;
        lambda_cap = scale * 10.0;
        lambda_route = scale * 500.0;
        lambda_tw = 1.0;
    }
};

struct RouteInfo {
    std::vector<int> stops;         // Sequence: [0, c_1, ..., 0]
    double total_time = 0.0;
    double total_distance = 0.0;
    double total_load = 0.0;
    double capacity_violation = 0.0;
    double tw_penalty = 0.0;
    std::vector<double> arrival_times;
};

struct Solution {
    std::vector<std::vector<int>> routes;
    std::vector<RouteInfo> route_details;
    double total_time = 0.0;
    double total_distance = 0.0;
    double total_load = 0.0;
    double total_cap_viol = 0.0;
    double total_tw_viol = 0.0;
    int route_viol = 0;
    double penalized_fitness = 0.0;
    bool is_feasible = false;
};

struct ConvergencePoint {
    int iteration = 0;
    double best_fitness = 0.0;
    double current_fitness = 0.0;
    double elapsed_ms = 0.0;
};

struct SolverResult {
    std::string algorithm_name;
    Solution best_solution;
    double best_fitness = 0.0;
    double total_compute_ms = 0.0;
    std::vector<ConvergencePoint> history;
};

} // namespace traffic_routing
