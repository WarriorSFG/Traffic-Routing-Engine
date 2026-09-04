"""Unit tests for Performance Benchmarking (Chapters 13 & 14).
"""

import pytest

from traffic_routing.benchmark import BenchmarkEngine
from traffic_routing.config import CongestionConfig, NetworkConfig, PenaltyConfig, VRPConfig
from traffic_routing.congestion_engine import DynamicCongestionEngine
from traffic_routing.cost_matrix import CostMatrixCalculator
from traffic_routing.graph_generator import generate_road_network
from traffic_routing.vrp_model import create_vrp_problem


def test_benchmark_engine_run():
    config = NetworkConfig(num_nodes=12, num_customers=5, seed=42)
    network = generate_road_network(config)
    engine = DynamicCongestionEngine(network, CongestionConfig())
    calc = CostMatrixCalculator(network)
    dyn_graph = engine.create_weighted_graph(engine.evaluate(t=8.0))
    cost_matrix = calc.compute(dyn_graph, sim_time=8.0)

    problem = create_vrp_problem(cost_matrix, VRPConfig(vehicle_capacity=100.0, num_vehicles=2), seed=42)
    penalties = PenaltyConfig()

    bench = BenchmarkEngine(problem, penalties)
    report = bench.run_benchmark(num_runs=2, swarm_size=15, max_iterations=20, base_seed=42)

    assert "GNN" in report.stats
    assert "Classical PSO" in report.stats
    assert "Quantum-Inspired PSO (QPSO)" in report.stats

    # Check scorecard DataFrame
    assert len(report.scorecard_df) == 3
    assert "Algorithm" in report.scorecard_df.columns
    assert "Wall-Clock Time (ms)" in report.scorecard_df.columns

    # Check convergence DataFrame
    assert len(report.convergence_df) == 21  # 0 to 20
    assert "Quantum-Inspired PSO (QPSO)" in report.convergence_df.columns
