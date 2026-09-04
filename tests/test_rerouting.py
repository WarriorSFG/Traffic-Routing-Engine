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
