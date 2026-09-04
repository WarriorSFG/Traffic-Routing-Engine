"""Unit tests for Cost Matrix & APSP Precomputation (Chapter 4).
"""

import numpy as np
import pytest

from traffic_routing.config import CongestionConfig, NetworkConfig
from traffic_routing.congestion_engine import DynamicCongestionEngine
from traffic_routing.cost_matrix import CostMatrixCalculator
from traffic_routing.graph_generator import generate_road_network


def test_cost_matrix_computation():
    config = NetworkConfig(num_nodes=20, num_customers=8, seed=42)
    network = generate_road_network(config)
    engine = DynamicCongestionEngine(network, CongestionConfig())
    state = engine.evaluate(t=8.0)
    dyn_graph = engine.create_weighted_graph(state)

    calc = CostMatrixCalculator(network)
    cost_matrix = calc.compute(dyn_graph, sim_time=8.0)

    num_stops = len(network.stops)
    assert cost_matrix.num_stops == num_stops
    assert cost_matrix.time_matrix.shape == (num_stops, num_stops)
    assert cost_matrix.distance_matrix.shape == (num_stops, num_stops)

    # Diagonal must be 0
    for i in range(num_stops):
        assert cost_matrix.time_matrix[i, i] == 0.0
        assert cost_matrix.distance_matrix[i, i] == 0.0

    # Off-diagonal should be positive
    for i in range(num_stops):
        for j in range(num_stops):
            if i != j:
                assert cost_matrix.time_matrix[i, j] > 0.0
                assert cost_matrix.distance_matrix[i, j] > 0.0
                assert len(cost_matrix.get_path_nodes(i, j)) >= 2


def test_cost_matrix_material_change():
    config = NetworkConfig(num_nodes=15, num_customers=6, seed=42)
    network = generate_road_network(config)
    calc = CostMatrixCalculator(network)

    engine1 = DynamicCongestionEngine(network, CongestionConfig())
    mat1 = calc.compute(engine1.create_weighted_graph(engine1.evaluate(t=6.0)), sim_time=6.0)

    # Trigger rush hour
    from traffic_routing.config import TrafficPreset
    engine2 = DynamicCongestionEngine(network, CongestionConfig(preset=TrafficPreset.RUSH_HOUR, rush_hour_alpha_max=5.0))
    mat2 = calc.compute(engine2.create_weighted_graph(engine2.evaluate(t=8.5)), sim_time=8.5)

    assert calc.has_material_change(mat1, mat2, threshold=0.01)
