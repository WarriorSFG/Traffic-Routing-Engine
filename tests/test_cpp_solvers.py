"""Unit tests for High-Performance C++ Core Solvers (Chapters 8, 9, 10, 11).
"""

import pytest

from traffic_routing.config import CongestionConfig, NetworkConfig, PenaltyConfig, SolverConfig, VRPConfig
from traffic_routing.congestion_engine import DynamicCongestionEngine
from traffic_routing.cost_matrix import CostMatrixCalculator
from traffic_routing.graph_generator import generate_road_network
from traffic_routing.solvers import GNNSolver, PSOSolver, QPSOSolver
from traffic_routing.vrp_model import create_vrp_problem


@pytest.fixture
def test_problem():
    config = NetworkConfig(num_nodes=15, num_customers=8, seed=42)
    network = generate_road_network(config)
    engine = DynamicCongestionEngine(network, CongestionConfig())
    calc = CostMatrixCalculator(network)
    dyn_graph = engine.create_weighted_graph(engine.evaluate(t=8.0))
    cost_matrix = calc.compute(dyn_graph, sim_time=8.0)

    vrp_config = VRPConfig(vehicle_capacity=100.0, num_vehicles=3)
    return create_vrp_problem(cost_matrix, vrp_config, seed=42)


def test_gnn_solver_execution(test_problem):
    penalties = PenaltyConfig()
    solver = GNNSolver(test_problem, penalties)
    res = solver.solve()

    assert res.algorithm_name == "Greedy Nearest Neighbor (GNN)"
    assert res.compute_time_ms >= 0.0
    assert len(res.solution.routes) > 0

    # Ensure all 8 customers are visited
    visited = [node for r in res.solution.routes for node in r if node != 0]
    assert sorted(visited) == list(range(1, 9))


def test_pso_solver_convergence(test_problem):
    penalties = PenaltyConfig()
    cfg = SolverConfig(swarm_size=25, max_iterations=40, seed=42)
    solver = PSOSolver(test_problem, penalties, cfg)
    res = solver.solve()

    assert res.algorithm_name == "Classical PSO"
    assert len(res.history) == 41  # 0 to 40
    # Fitness should monotonically decrease or stay flat across iterations
    fitnesses = [cp.best_fitness for cp in res.history]
    assert fitnesses[-1] <= fitnesses[0]


def test_qpso_solver_convergence(test_problem):
    penalties = PenaltyConfig()
    cfg = SolverConfig(swarm_size=25, max_iterations=40, seed=42)
    solver = QPSOSolver(test_problem, penalties, cfg)
    res = solver.solve()

    assert res.algorithm_name == "Quantum-Inspired PSO (QPSO)"
    assert len(res.history) == 41
    fitnesses = [cp.best_fitness for cp in res.history]
    assert fitnesses[-1] <= fitnesses[0]
    assert res.compute_time_ms < 500.0  # Should run in < 500ms on multi-core C++


def test_qpso_warm_start(test_problem):
    penalties = PenaltyConfig()
    cfg = SolverConfig(swarm_size=20, max_iterations=20, seed=42)
    solver = QPSOSolver(test_problem, penalties, cfg)

    # Initial run
    res1 = solver.solve()

    # Warm-started run with dummy continuous key vector
    warm_keys = [0.1 * i for i in range(test_problem.num_customers)]
    res2 = solver.solve(warm_start=warm_keys)

    assert len(res2.solution.routes) > 0
    assert res2.compute_time_ms >= 0.0
