"""Unit tests for Dynamic Congestion Engine (Chapter 3).
"""

import math
import pytest

from traffic_routing.config import CongestionConfig, NetworkConfig, TrafficPreset
from traffic_routing.congestion_engine import DynamicCongestionEngine
from traffic_routing.graph_generator import generate_road_network


@pytest.fixture
def sample_network():
    config = NetworkConfig(num_nodes=20, num_customers=8, seed=42)
    return generate_road_network(config)


def test_uniform_flow_congestion(sample_network):
    config = CongestionConfig(preset=TrafficPreset.UNIFORM, uniform_eps_max=0.15)
    engine = DynamicCongestionEngine(sample_network, config)
    state = engine.evaluate(t=8.0)

    for (u, v), alpha in state.multipliers.items():
        assert 1.0 <= alpha <= 1.0 + 0.15 + 1e-6
        assert state.dynamic_weights[(u, v)] == pytest.approx(sample_network.edges[(u, v)].base_time * alpha)


def test_rush_hour_bottleneck_envelope(sample_network):
    config = CongestionConfig(
        preset=TrafficPreset.RUSH_HOUR,
        rush_hour_alpha_max=4.0,
        rush_hour_t_start=7.0,
        rush_hour_t_end=9.0
    )
    engine = DynamicCongestionEngine(sample_network, config)

    # Before rush hour (t = 6.0) -> alpha must be 1.0
    state_before = engine.evaluate(t=6.0)
    for alpha in state_before.multipliers.values():
        assert pytest.approx(alpha, abs=1e-5) == 1.0

    # Peak rush hour (t = 8.0, halfway through) -> sigma should be 1.0
    state_peak = engine.evaluate(t=8.0)
    peak_alphas = list(state_peak.multipliers.values())
    assert max(peak_alphas) > 1.5

    # After rush hour (t = 10.0) -> alpha must return to 1.0
    state_after = engine.evaluate(t=10.0)
    for alpha in state_after.multipliers.values():
        assert pytest.approx(alpha, abs=1e-5) == 1.0


def test_incident_disruption(sample_network):
    test_edge = list(sample_network.edges.keys())[0]
    config = CongestionConfig(
        preset=TrafficPreset.INCIDENT,
        incident_edges=[test_edge],
        incident_alpha=9.0,
        incident_hard_closure=True,
        incident_t_start=8.0,
        incident_t_end=9.0
    )
    engine = DynamicCongestionEngine(sample_network, config)

    # Active during 8.5
    state = engine.evaluate(t=8.5)
    assert test_edge in state.closed_edges
    assert math.isinf(state.dynamic_weights[test_edge])

    # Inactive at 10.0
    state_clear = engine.evaluate(t=10.0)
    assert test_edge not in state_clear.closed_edges
    assert not math.isinf(state_clear.dynamic_weights[test_edge])
