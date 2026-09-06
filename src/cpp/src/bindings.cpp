#include <pybind11/pybind11.h>
#include <pybind11/stl.h>

#include "types.hpp"
#include "gnn_solver.hpp"
#include "pso_solver.hpp"
#include "qpso_solver.hpp"

namespace py = pybind11;
using namespace traffic_routing;

SolverResult run_gnn_binding(const ProblemData& prob, const PenaltyWeights& weights) {
    GNNSolver solver(prob, weights);
    return solver.solve();
}

SolverResult run_pso_binding(
    const ProblemData& prob,
    const PenaltyWeights& weights,
    int swarm_size,
    int max_iter,
    double w,
    double c1,
    double c2,
    unsigned int seed,
    const std::vector<double>& warm_start
) {
    PSOSolver solver(prob, weights, swarm_size, max_iter, w, c1, c2, seed);
    return solver.solve(warm_start);
}

SolverResult run_qpso_binding(
    const ProblemData& prob,
    const PenaltyWeights& weights,
    int swarm_size,
    int max_iter,
    double beta_max,
    double beta_min,
    unsigned int seed,
    const std::vector<double>& warm_start
) {
    QPSOSolver solver(prob, weights, swarm_size, max_iter, beta_max, beta_min, seed);
    return solver.solve(warm_start);
}

Solution evaluate_solution_binding(
    const ProblemData& prob,
    const PenaltyWeights& weights,
    const std::vector<std::vector<int>>& routes
) {
    FitnessEvaluator evaluator(prob, weights);
    return evaluator.evaluate(routes);
}

PYBIND11_MODULE(qpso_engine, m) {
    m.doc() = "Quantum-Inspired Intelligent Traffic Route Optimization C++ Core Solvers";

    py::class_<ProblemData>(m, "ProblemData")
        .def(py::init<>())
        .def_readwrite("num_stops", &ProblemData::num_stops)
        .def_readwrite("num_customers", &ProblemData::num_customers)
        .def_readwrite("num_vehicles", &ProblemData::num_vehicles)
        .def_readwrite("capacity", &ProblemData::capacity)
        .def_readwrite("demands", &ProblemData::demands)
        .def_readwrite("time_matrix", &ProblemData::time_matrix)
        .def_readwrite("dist_matrix", &ProblemData::dist_matrix)
        .def_readwrite("time_windows", &ProblemData::time_windows)
        .def_readwrite("service_times", &ProblemData::service_times);

    py::class_<PenaltyWeights>(m, "PenaltyWeights")
        .def(py::init<>())
        .def_readwrite("lambda_cap", &PenaltyWeights::lambda_cap)
        .def_readwrite("lambda_route", &PenaltyWeights::lambda_route)
        .def_readwrite("lambda_tw", &PenaltyWeights::lambda_tw)
        .def_readwrite("rho_early", &PenaltyWeights::rho_early)
        .def_readwrite("rho_late", &PenaltyWeights::rho_late)
        .def_readwrite("vehicle_cost", &PenaltyWeights::vehicle_cost)
        .def("auto_scale", &PenaltyWeights::auto_scale);

    py::class_<RouteInfo>(m, "RouteInfo")
        .def(py::init<>())
        .def_readonly("stops", &RouteInfo::stops)
        .def_readonly("total_time", &RouteInfo::total_time)
        .def_readonly("total_distance", &RouteInfo::total_distance)
        .def_readonly("total_load", &RouteInfo::total_load)
        .def_readonly("capacity_violation", &RouteInfo::capacity_violation)
        .def_readonly("tw_penalty", &RouteInfo::tw_penalty)
        .def_readonly("arrival_times", &RouteInfo::arrival_times);

    py::class_<Solution>(m, "Solution")
        .def(py::init<>())
        .def_readonly("routes", &Solution::routes)
        .def_readonly("route_details", &Solution::route_details)
        .def_readonly("total_time", &Solution::total_time)
        .def_readonly("total_distance", &Solution::total_distance)
        .def_readonly("total_load", &Solution::total_load)
        .def_readonly("total_cap_viol", &Solution::total_cap_viol)
        .def_readonly("total_tw_viol", &Solution::total_tw_viol)
        .def_readonly("route_viol", &Solution::route_viol)
        .def_readonly("vehicle_cost", &Solution::vehicle_cost)
        .def_readonly("penalized_fitness", &Solution::penalized_fitness)
        .def_readonly("is_feasible", &Solution::is_feasible);

    py::class_<ConvergencePoint>(m, "ConvergencePoint")
        .def(py::init<>())
        .def_readonly("iteration", &ConvergencePoint::iteration)
        .def_readonly("best_fitness", &ConvergencePoint::best_fitness)
        .def_readonly("current_fitness", &ConvergencePoint::current_fitness)
        .def_readonly("elapsed_ms", &ConvergencePoint::elapsed_ms);

    py::class_<SolverResult>(m, "SolverResult")
        .def(py::init<>())
        .def_readonly("algorithm_name", &SolverResult::algorithm_name)
        .def_readonly("best_solution", &SolverResult::best_solution)
        .def_readonly("best_fitness", &SolverResult::best_fitness)
        .def_readonly("total_compute_ms", &SolverResult::total_compute_ms)
        .def_readonly("history", &SolverResult::history);

    m.def("solve_gnn", &run_gnn_binding, "Run Greedy Nearest Neighbor solver",
          py::arg("problem"), py::arg("weights"));

    m.def("solve_pso", &run_pso_binding, "Run Classical Particle Swarm Optimization solver",
          py::arg("problem"), py::arg("weights"),
          py::arg("swarm_size") = 40, py::arg("max_iter") = 150,
          py::arg("w") = 0.7298, py::arg("c1") = 1.49618, py::arg("c2") = 1.49618,
          py::arg("seed") = 42,
          py::arg("warm_start") = std::vector<double>());

    m.def("solve_qpso", &run_qpso_binding, "Run Quantum-Inspired Particle Swarm Optimization solver",
          py::arg("problem"), py::arg("weights"),
          py::arg("swarm_size") = 40, py::arg("max_iter") = 150,
          py::arg("beta_max") = 1.0, py::arg("beta_min") = 0.4,
          py::arg("seed") = 42,
          py::arg("warm_start") = std::vector<double>());

    m.def("evaluate_solution", &evaluate_solution_binding, "Evaluate full fleet routing solution",
          py::arg("problem"), py::arg("weights"), py::arg("routes"));
}
