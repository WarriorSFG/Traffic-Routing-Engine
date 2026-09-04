"""Unit tests for VRP Model, Constraints, and Fitness Evaluation (Chapters 5, 6, 7).
"""

import pytest

from traffic_routing.config import CongestionConfig, NetworkConfig, PenaltyConfig, VRPConfig
from traffic_routing.congestion_engine import DynamicCongestionEngine
from traffic_routing.cost_matrix import CostMatrixCalculator
from traffic_routing.fitness import FitnessEvaluator
from traffic_routing.graph_generator import generate_road_network
from traffic_routing.vrp_model import create_vrp_problem


@pytest.fixture
def sample_problem():
    config = NetworkConfig(num_nodes=15, num_customers=6, seed=42)
    network = generate_road_network(config)
    engine = DynamicCongestionEngine(network, CongestionConfig())
    calc = CostMatrixCalculator(network)
    dyn_graph = engine.create_weighted_graph(engine.evaluate(t=8.0))
    cost_matrix = calc.compute(dyn_graph, sim_time=8.0)

    vrp_config = VRPConfig(vehicle_capacity=100.0, num_vehicles=3)
    return create_vrp_problem(cost_matrix, vrp_config, seed=42)


def test_vrp_problem_structure(sample_problem):
    assert sample_problem.num_customers == 6
    assert sample_problem.num_stops == 7
    assert sample_problem.stops_info[0].demand == 0.0
    assert sample_problem.stops_info[0].stop_idx == 0

    for i in range(1, 7):
        assert sample_problem.stops_info[i].demand > 0.0
        e_i, l_i = sample_problem.stops_info[i].time_window
        assert e_i < l_i


def test_fitness_evaluator(sample_problem):
    evaluator = FitnessEvaluator(sample_problem, PenaltyConfig())
    
    # Valid routes visiting all 6 customers
    routes = [
        [0, 1, 2, 3, 0],
        [0, 4, 5, 6, 0]
    ]
    sol = evaluator.evaluate_solution(routes)

    assert sol.total_time > 0.0
    assert sol.total_distance > 0.0
    assert sol.total_load > 0.0
    assert sol.route_structure_violations == 0

    # Route with missing customer (missing customer 6)
    incomplete_routes = [
        [0, 1, 2, 3, 0],
        [0, 4, 5, 0]
    ]
    sol_inc = evaluator.evaluate_solution(incomplete_routes)
    assert sol_inc.route_structure_violations > 0
    assert sol_inc.penalized_fitness > sol.penalized_fitness
