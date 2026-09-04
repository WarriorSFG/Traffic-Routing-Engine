#include <iostream>
#include <iomanip>
#include <vector>
#include <random>

#include "types.hpp"
#include "gnn_solver.hpp"
#include "pso_solver.hpp"
#include "qpso_solver.hpp"

using namespace traffic_routing;

ProblemData generate_synthetic_problem(int num_stops, int num_vehicles, double capacity, unsigned int seed = 42) {
    ProblemData prob;
    prob.num_stops = num_stops;
    prob.num_customers = num_stops - 1;
    prob.num_vehicles = num_vehicles;
    prob.capacity = capacity;

    std::mt19937 rng(seed);
    std::uniform_real_distribution<double> coord_dist(0.0, 100.0);
    std::uniform_real_distribution<double> demand_dist(10.0, 30.0);

    std::vector<std::pair<double, double>> coords(num_stops);
    coords[0] = {50.0, 50.0}; // Depot at center
    for (int i = 1; i < num_stops; ++i) {
        coords[i] = {coord_dist(rng), coord_dist(rng)};
    }

    prob.demands.resize(num_stops, 0.0);
    for (int i = 1; i < num_stops; ++i) {
        prob.demands[i] = demand_dist(rng);
    }

    prob.time_matrix.resize(num_stops * num_stops, 0.0);
    prob.dist_matrix.resize(num_stops * num_stops, 0.0);
    double speed = 40.0; // km/h

    for (int i = 0; i < num_stops; ++i) {
        for (int j = 0; j < num_stops; ++j) {
            double dx = coords[i].first - coords[j].first;
            double dy = coords[i].second - coords[j].second;
            double dist = std::sqrt(dx * dx + dy * dy);
            prob.dist_matrix[i * num_stops + j] = dist;
            prob.time_matrix[i * num_stops + j] = dist / speed;
        }
    }

    prob.time_windows.resize(num_stops);
    prob.time_windows[0] = {6.0, 18.0};
    prob.service_times.resize(num_stops, 0.15);
    prob.service_times[0] = 0.0;

    for (int i = 1; i < num_stops; ++i) {
        double t_from_depot = prob.get_time(0, i);
        double e_i = 6.0 + t_from_depot + 0.5;
        double l_i = e_i + 3.0;
        prob.time_windows[i] = {e_i, l_i};
    }

    return prob;
}

void print_solution(const SolverResult& res) {
    std::cout << "\n=======================================================\n";
    std::cout << "Algorithm: " << res.algorithm_name << "\n";
    std::cout << "Wall-Clock Compute Time: " << std::fixed << std::setprecision(2) 
              << res.total_compute_ms << " ms\n";
    std::cout << "Best Fitness: " << res.best_fitness << "\n";
    std::cout << "Total Fleet Travel Time: " << res.best_solution.total_time << " hours\n";
    std::cout << "Total Physical Distance: " << res.best_solution.total_distance << " km\n";
    std::cout << "Total Capacity Violations: " << res.best_solution.total_cap_viol << "\n";
    std::cout << "Total Time Window Penalty: " << res.best_solution.total_tw_viol << "\n";
    std::cout << "Solution Feasible: " << (res.best_solution.is_feasible ? "YES" : "NO") << "\n";
    std::cout << "Routes (" << res.best_solution.routes.size() << " vehicles):\n";
    for (size_t k = 0; k < res.best_solution.routes.size(); ++k) {
        std::cout << "  Vehicle " << (k + 1) << ": ";
        for (int node : res.best_solution.routes[k]) {
            std::cout << node << " ";
        }
        std::cout << " (Load: " << res.best_solution.route_details[k].total_load 
                  << ", Time: " << res.best_solution.route_details[k].total_time << "h)\n";
    }
    std::cout << "=======================================================\n";
}

int main(int argc, char* argv[]) {
    int num_customers = 15;
    int num_vehicles = 4;
    double capacity = 100.0;
    int swarm_size = 50;
    int max_iter = 200;

    std::cout << "Traffic Routing Engine — Native C++ High-Performance Solvers\n";
    std::cout << "SIH 2026 Problem Statement 26137\n";
    std::cout << "Customers: " << num_customers << " | Vehicles: " << num_vehicles 
              << " | Capacity: " << capacity << " | Max Iterations: " << max_iter << "\n";

    ProblemData prob = generate_synthetic_problem(num_customers + 1, num_vehicles, capacity);
    PenaltyWeights weights;
    weights.auto_scale(prob);

    // 1. Solve with GNN
    GNNSolver gnn_solver(prob, weights);
    SolverResult gnn_res = gnn_solver.solve();
    print_solution(gnn_res);

    // 2. Solve with Classical PSO
    PSOSolver pso_solver(prob, weights, swarm_size, max_iter, 0.7298, 1.49618, 1.49618, 42);
    SolverResult pso_res = pso_solver.solve();
    print_solution(pso_res);

    // 3. Solve with Quantum-Inspired PSO (QPSO)
    QPSOSolver qpso_solver(prob, weights, swarm_size, max_iter, 1.0, 0.4, 42);
    SolverResult qpso_res = qpso_solver.solve();
    print_solution(qpso_res);

    std::cout << "\nComparison Summary:\n";
    std::cout << "GNN Time: " << gnn_res.best_solution.total_time << " h | Compute: " << gnn_res.total_compute_ms << " ms\n";
    std::cout << "PSO Time: " << pso_res.best_solution.total_time << " h | Compute: " << pso_res.total_compute_ms << " ms\n";
    std::cout << "QPSO Time: " << qpso_res.best_solution.total_time << " h | Compute: " << qpso_res.total_compute_ms << " ms\n";
    double gap_qpso_vs_gnn = (gnn_res.best_solution.total_time - qpso_res.best_solution.total_time) / gnn_res.best_solution.total_time * 100.0;
    std::cout << "QPSO Travel Time Improvement vs GNN: " << std::fixed << std::setprecision(2) << gap_qpso_vs_gnn << "%\n";

    return 0;
}
