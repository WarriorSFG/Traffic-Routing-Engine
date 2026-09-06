"""Python wrapper for high-performance C++ core solvers via pybind11.
"""

from typing import List, Optional
import numpy as np

try:
    import qpso_engine
except ImportError:
    # Attempt import from solvers package directory
    from . import qpso_engine

from ..config import PenaltyConfig, SolverConfig
from ..vrp_model import RouteEvaluation, SolutionEvaluation, VRPProblem
from .base import BaseSolver, ConvergencePoint, SolverResult


def _convert_problem_to_cpp(problem: VRPProblem) -> qpso_engine.ProblemData:
    """Converts a Python VRPProblem into C++ ProblemData."""
    prob_cpp = qpso_engine.ProblemData()
    prob_cpp.num_stops = problem.num_stops
    prob_cpp.num_customers = problem.num_customers
    prob_cpp.num_vehicles = problem.num_vehicles
    prob_cpp.capacity = float(problem.capacity)

    prob_cpp.demands = [float(s.demand) for s in problem.stops_info]
    prob_cpp.time_matrix = problem.cost_matrix.time_matrix.flatten().tolist()
    prob_cpp.dist_matrix = problem.cost_matrix.distance_matrix.flatten().tolist()
    prob_cpp.time_windows = [(float(s.time_window[0]), float(s.time_window[1])) for s in problem.stops_info]
    prob_cpp.service_times = [float(s.service_time) for s in problem.stops_info]

    return prob_cpp


def _convert_penalties_to_cpp(config: PenaltyConfig, problem: VRPProblem) -> qpso_engine.PenaltyWeights:
    """Converts a Python PenaltyConfig into C++ PenaltyWeights."""
    weights = qpso_engine.PenaltyWeights()
    weights.lambda_cap = float(config.lambda_capacity)
    weights.lambda_route = float(config.lambda_route)
    weights.lambda_tw = float(config.lambda_tw)
    weights.rho_early = float(config.rho_early)
    weights.rho_late = float(config.rho_late)

    if config.auto_scale:
        prob_cpp = _convert_problem_to_cpp(problem)
        weights.auto_scale(prob_cpp)

    return weights


def _convert_cpp_result_to_py(res_cpp) -> SolverResult:
    """Converts C++ SolverResult to Python SolverResult."""
    sol_cpp = res_cpp.best_solution
    route_evals = []
    for rd in sol_cpp.route_details:
        route_evals.append(
            RouteEvaluation(
                route=list(rd.stops),
                total_time=float(rd.total_time),
                total_distance=float(rd.total_distance),
                total_load=float(rd.total_load),
                capacity_violation=float(rd.capacity_violation),
                arrival_times=list(rd.arrival_times),
                early_wait_times=[],
                late_times=[],
                time_window_penalty=float(rd.tw_penalty)
            )
        )

    solution_eval = SolutionEvaluation(
        routes=list(sol_cpp.routes),
        route_evaluations=route_evals,
        total_time=float(sol_cpp.total_time),
        total_distance=float(sol_cpp.total_distance),
        total_load=float(sol_cpp.total_load),
        total_capacity_violation=float(sol_cpp.total_cap_viol),
        total_tw_penalty=float(sol_cpp.total_tw_viol),
        route_structure_violations=int(sol_cpp.route_viol),
        is_feasible=bool(sol_cpp.is_feasible),
        unpenalized_cost=float(sol_cpp.total_time),
        penalized_fitness=float(sol_cpp.penalized_fitness)
    )

    history = [
        ConvergencePoint(
            iteration=cp.iteration,
            best_fitness=cp.best_fitness,
            current_fitness=cp.current_fitness,
            elapsed_ms=cp.elapsed_ms
        )
        for cp in res_cpp.history
    ]

    return SolverResult(
        algorithm_name=res_cpp.algorithm_name,
        solution=solution_eval,
        best_fitness=float(res_cpp.best_fitness),
        compute_time_ms=float(res_cpp.total_compute_ms),
        history=history
    )


class CPP_GNNSolver(BaseSolver):
    """C++ Greedy Nearest Neighbor baseline solver."""

    def __init__(self, problem: VRPProblem, penalty_config: PenaltyConfig, config: Optional[SolverConfig] = None):
        super().__init__(problem, config or SolverConfig())
        self.penalty_config = penalty_config
        self._prob_cpp = _convert_problem_to_cpp(problem)
        self._weights_cpp = _convert_penalties_to_cpp(penalty_config, problem)

    def solve(self, warm_start: Optional[List[float]] = None) -> SolverResult:
        res_cpp = qpso_engine.solve_gnn(self._prob_cpp, self._weights_cpp)
        return _convert_cpp_result_to_py(res_cpp)


class CPP_PSOSolver(BaseSolver):
    """C++ Classical Particle Swarm Optimization solver."""

    def __init__(self, problem: VRPProblem, penalty_config: PenaltyConfig, config: Optional[SolverConfig] = None):
        cfg = config or SolverConfig()
        super().__init__(problem, cfg)
        self.penalty_config = penalty_config
        self._prob_cpp = _convert_problem_to_cpp(problem)
        self._weights_cpp = _convert_penalties_to_cpp(penalty_config, problem)

    def solve(self, warm_start: Optional[List[float]] = None) -> SolverResult:
        warm_start_vec = warm_start or []
        res_cpp = qpso_engine.solve_pso(
            self._prob_cpp,
            self._weights_cpp,
            swarm_size=self.config.swarm_size,
            max_iter=self.config.max_iterations,
            w=self.config.pso_w,
            c1=self.config.pso_c1,
            c2=self.config.pso_c2,
            seed=self.config.seed or 42,
            warm_start=warm_start_vec
        )
        return _convert_cpp_result_to_py(res_cpp)


class CPP_QPSOSolver(BaseSolver):
    """C++ Quantum-Inspired Particle Swarm Optimization solver."""

    def __init__(self, problem: VRPProblem, penalty_config: PenaltyConfig, config: Optional[SolverConfig] = None):
        cfg = config or SolverConfig()
        super().__init__(problem, cfg)
        self.penalty_config = penalty_config
        self._prob_cpp = _convert_problem_to_cpp(problem)
        self._weights_cpp = _convert_penalties_to_cpp(penalty_config, problem)

    def solve(self, warm_start: Optional[List[float]] = None) -> SolverResult:
        warm_start_vec = warm_start or []
        res_cpp = qpso_engine.solve_qpso(
            self._prob_cpp,
            self._weights_cpp,
            swarm_size=self.config.swarm_size,
            max_iter=self.config.max_iterations,
            beta_max=self.config.qpso_beta_max,
            beta_min=self.config.qpso_beta_min,
            seed=self.config.seed or 42,
            warm_start=warm_start_vec
        )
        return _convert_cpp_result_to_py(res_cpp)
