"""Unit tests for Live Dynamic Re-Routing (Chapter 12).
"""

import pytest

from traffic_routing.config import CongestionConfig, NetworkConfig, PenaltyConfig, SolverConfig, TrafficPreset, VRPConfig
from traffic_routing.congestion_engine import DynamicCongestionEngine
from traffic_routing.cost_matrix import CostMatrixCalculator
from traffic_routing.graph_generator import generate_road_network
from traffic_routing.rerouting_loop import DynamicRerouter
from traffic_routing.solvers import QPSOSolver
from traffic_routing.vrp_model import create_vrp_problem


def test_dynamic_rerouting_flow():
    config = NetworkConfig(num_nodes=15, num_customers=6, seed=42)
    network = generate_road_network(config)
    engine = DynamicCongestionEngine(network, CongestionConfig())
    calc = CostMatrixCalculator(network)
    dyn_graph = engine.create_weighted_graph(engine.evaluate(t=6.0))
    cost_matrix = calc.compute(dyn_graph, sim_time=6.0)

    problem = create_vrp_problem(cost_matrix, VRPConfig(vehicle_capacity=100.0, num_vehicles=2), seed=42)
    penalties = PenaltyConfig()

    # Initial solve
    solver = QPSOSolver(problem, penalties, SolverConfig(swarm_size=20, max_iterations=30))
    init_res = solver.solve()

    rerouter = DynamicRerouter(network, engine, problem, penalties)
    rerouter.set_initial_routes(init_res.solution.routes)

    # Step simulation without incident
    event_normal = rerouter.step_simulation(dt=0.1, incident_occurred=False)
    # Depending on threshold, normal minor noise may or may not trigger re-routing
    assert rerouter.current_time == pytest.approx(6.1)

    # Step simulation WITH an incident
    event_incident = rerouter.step_simulation(dt=0.1, incident_occurred=True)
    assert event_incident is not None
    assert event_incident.trigger_reason == "Incident Disruption"
    assert len(event_incident.new_routes) > 0
    assert len(rerouter.reroute_history) >= 1


def test_warm_start_key_extraction():
    config = NetworkConfig(num_nodes=15, num_customers=5, seed=42)
    network = generate_road_network(config)
    engine = DynamicCongestionEngine(network, CongestionConfig())
    calc = CostMatrixCalculator(network)
    dyn_graph = engine.create_weighted_graph(engine.evaluate(t=6.0))
    cost_matrix = calc.compute(dyn_graph, sim_time=6.0)

    problem = create_vrp_problem(cost_matrix, VRPConfig(vehicle_capacity=100.0, num_vehicles=2), seed=42)
    rerouter = DynamicRerouter(network, engine, problem, PenaltyConfig())

    routes = [[0, 3, 1, 0], [0, 4, 2, 5, 0]]
    keys = rerouter._extract_warm_start_keys(routes)
    assert len(keys) == 5

    # Decoded sequence from keys should match original order: 3, 1, 4, 2, 5
    from traffic_routing.encoding import RandomKeyDecoder
    decoder = RandomKeyDecoder(problem)
    seq = decoder.decode_sequence(keys)
    assert seq == [3, 1, 4, 2, 5]


def test_dynamic_rerouting_vehicle_state_progression():
    config = NetworkConfig(num_nodes=12, num_customers=4, seed=42)
    network = generate_road_network(config)
    engine = DynamicCongestionEngine(network, CongestionConfig())
    calc = CostMatrixCalculator(network)
    dyn_graph = engine.create_weighted_graph(engine.evaluate(t=6.0))
    cost_matrix = calc.compute(dyn_graph, sim_time=6.0)

    problem = create_vrp_problem(cost_matrix, VRPConfig(vehicle_capacity=100.0, num_vehicles=1), seed=42)
    rerouter = DynamicRerouter(network, engine, problem, PenaltyConfig())

    initial_routes = [[0, 1, 2, 3, 4, 0]]
    rerouter.set_initial_routes(initial_routes)

    # Step simulation with a large dt so vehicle reaches first stop
    leg1_time = cost_matrix.get_time(0, 1)
    rerouter.step_simulation(dt=leg1_time + 0.1)

    assert 1 in rerouter.vehicles[0].completed_stops
    assert rerouter.vehicles[0].current_node == 1
    assert 1 not in rerouter.vehicles[0].remaining_stops
