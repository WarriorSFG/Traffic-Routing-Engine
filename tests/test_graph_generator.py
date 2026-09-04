"""Unit tests for Graph Topology & Road Network Generator (Chapter 2).
"""

import numpy as np
import pytest

from traffic_routing.config import NetworkConfig
from traffic_routing.graph_generator import NodeType, generate_road_network


def test_graph_generation_basic():
    config = NetworkConfig(num_nodes=25, num_customers=10, seed=42)
    network = generate_road_network(config)

    assert network.num_nodes == 25
    assert len(network.customer_ids) == 10
    assert network.depot_id == 0
    assert network.node_types[0] == NodeType.DEPOT
    assert len(network.intersection_ids) == 14  # 25 - 1 - 10 = 14

    # Check stops list
    assert network.stops[0] == 0
    assert len(network.stops) == 11  # Depot + 10 customers


def test_delaunay_edges_and_distances():
    config = NetworkConfig(num_nodes=20, num_customers=8, seed=42)
    network = generate_road_network(config)

    assert network.num_edges > 0
    # Verify distance is positive and matches Euclidean distance
    for (u, v), edge in network.edges.items():
        assert u < v
        expected_dist = float(np.linalg.norm(network.coordinates[u] - network.coordinates[v]))
        assert pytest.approx(edge.distance, rel=1e-4) == expected_dist
        assert edge.base_time > 0.0
        assert edge.speed_limit in (config.arterial_speed, config.residential_speed)
