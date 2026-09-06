"""Unit & Integration Tests for Randomized Parameter Benchmarking.
Evaluates QPSO against Classical PSO and GNN across random topologies, fleets, and seeds.
"""

from pathlib import Path
import pytest

from traffic_routing.benchmark import (
    MultiScenarioBenchmarkReport,
    RandomBenchmarkSuite,
    RandomScenarioConfig,
)
from traffic_routing.config import TrafficPreset


def test_random_scenario_generation():
    """Verifies reproducibility and boundary constraints of randomized scenario generator."""
    scenarios_a = RandomBenchmarkSuite.generate_random_scenarios(
        num_scenarios=4,
        base_seed=12345,
        customer_range=(8, 16),
        vehicle_range=(2, 4),
        capacity_range=(80.0, 120.0),
        swarm_range=(20, 30),
        iter_range=(30, 50),
        runs_per_scenario=2
    )
    assert len(scenarios_a) == 4

    # Check reproducibility with identical base seed
    scenarios_b = RandomBenchmarkSuite.generate_random_scenarios(
        num_scenarios=4,
        base_seed=12345,
        customer_range=(8, 16),
        vehicle_range=(2, 4),
        capacity_range=(80.0, 120.0),
        swarm_range=(20, 30),
        iter_range=(30, 50),
        runs_per_scenario=2
    )

    for a, b in zip(scenarios_a, scenarios_b):
        assert a.seed == b.seed
        assert a.num_customers == b.num_customers
        assert a.num_vehicles == b.num_vehicles
        assert a.vehicle_capacity == b.vehicle_capacity
        assert a.swarm_size == b.swarm_size
        assert a.max_iterations == b.max_iterations
        assert 8 <= a.num_customers <= 16
        assert 2 <= a.num_vehicles <= 6
        assert 80.0 <= a.vehicle_capacity <= 120.0
        assert a.preset in [TrafficPreset.UNIFORM, TrafficPreset.RUSH_HOUR, TrafficPreset.INCIDENT]


def test_random_parameter_benchmark_execution(tmp_path):
    """Executes randomized parameter trials comparing QPSO against Classical PSO and GNN."""
    suite = RandomBenchmarkSuite()

    # Generate 3 distinct randomized test scenarios with controlled scale for rapid test execution
    scenarios = [
        RandomScenarioConfig(
            scenario_id=1,
            seed=701,
            num_customers=8,
            num_nodes=16,
            num_vehicles=2,
            vehicle_capacity=90.0,
            sim_time=8.5,
            preset=TrafficPreset.RUSH_HOUR,
            swarm_size=20,
            max_iterations=30,
            num_runs=2
        ),
        RandomScenarioConfig(
            scenario_id=2,
            seed=802,
            num_customers=10,
            num_nodes=20,
            num_vehicles=3,
            vehicle_capacity=100.0,
            sim_time=13.0,
            preset=TrafficPreset.UNIFORM,
            swarm_size=20,
            max_iterations=30,
            num_runs=2
        ),
        RandomScenarioConfig(
            scenario_id=3,
            seed=903,
            num_customers=12,
            num_nodes=22,
            num_vehicles=3,
            vehicle_capacity=110.0,
            sim_time=18.0,
            preset=TrafficPreset.INCIDENT,
            swarm_size=25,
            max_iterations=35,
            num_runs=2
        )
    ]

    report: MultiScenarioBenchmarkReport = suite.run_suite(
        scenarios=scenarios,
        verbose=True
    )

    # 1. Structural assertions
    assert report.total_scenarios == 3
    assert len(report.scenarios) == 3
    assert len(report.scenario_table_df) == 3

    # 2. Metric assertions
    sm = report.summary_metrics
    assert "qpso_win_rate_vs_pso" in sm
    assert "qpso_win_rate_vs_gnn" in sm
    assert "avg_fit_imp_vs_pso" in sm
    assert "avg_fit_imp_vs_gnn" in sm
    assert "qpso_mean_feasibility" in sm

    # QPSO should achieve high feasibility across randomized scenarios
    assert sm["qpso_mean_feasibility"] >= 75.0

    # QPSO should outperform or match Classical PSO in win rate and mean fitness
    assert sm["qpso_win_rate_vs_pso"] >= 50.0

    # Check each individual scenario result
    for s in report.scenarios:
        assert "Quantum-Inspired PSO (QPSO)" in s.stats
        assert "Classical PSO" in s.stats
        assert "GNN" in s.stats
        assert s.pso_winner in ["QPSO", "Classical PSO", "Tie"]
        assert s.gnn_winner in ["QPSO", "GNN", "Tie"]

        qpso_stat = s.stats["Quantum-Inspired PSO (QPSO)"]
        assert qpso_stat.best_fitness > 0

    # 3. Report generation and export assertions
    md_content = report.to_markdown()
    assert "# Quantum-Inspired PSO (QPSO) Multi-Scenario Comparative Benchmark Report" in md_content
    assert "Executive Summary & Aggregate Scorecard" in md_content
    assert "Detailed Randomized Scenario Breakdown" in md_content
    assert "Quantum-Inspired PSO (QPSO)" in md_content
    assert "Classical PSO" in md_content
    assert "Greedy Nearest Neighbor (GNN)" in md_content

    # Export report to reports directory in project root
    project_report_file = Path(__file__).resolve().parent.parent / "reports" / "random_parameter_benchmark_report.md"
    project_report_file.parent.mkdir(parents=True, exist_ok=True)
    report.to_markdown(str(project_report_file))
    assert project_report_file.exists()
    assert project_report_file.stat().st_size > 500

    # Test CSV export
    csv_file = tmp_path / "scenario_results.csv"
    report.to_csv(str(csv_file))
    assert csv_file.exists()
    assert csv_file.stat().st_size > 200

    # Test console text output
    txt = report.to_text()
    assert "QUANTUM-INSPIRED PSO (QPSO) MULTI-SCENARIO BENCHMARK REPORT" in txt


def test_random_parameter_benchmark_100x_scale(tmp_path):
    """Executes 100x scale randomized parameter test suite (300 randomized scenarios).
    Systematically benchmarks QPSO against Classical PSO and GNN across 300 distinct instances.
    """
    suite = RandomBenchmarkSuite()

    # Generate 300 randomized parameter configurations (100x original 3 cases)
    scenarios = suite.generate_random_scenarios(
        num_scenarios=300,
        base_seed=42,
        customer_range=(8, 18),
        vehicle_range=(2, 5),
        capacity_range=(70.0, 130.0),
        swarm_range=(20, 35),
        iter_range=(25, 50),
        runs_per_scenario=1
    )
    assert len(scenarios) == 300

    report: MultiScenarioBenchmarkReport = suite.run_suite(
        scenarios=scenarios,
        verbose=False
    )

    # 1. Structural assertions on 100x scale
    assert report.total_scenarios == 300
    assert len(report.scenarios) == 300
    assert len(report.scenario_table_df) == 300

    # 2. Metric assertions across 300 instances
    sm = report.summary_metrics

    # Statistical superiority of QPSO across 300 randomized instances
    assert sm["qpso_win_rate_vs_pso"] >= 60.0  # QPSO beats Classical PSO in majority of cases
    assert sm["qpso_win_rate_vs_gnn"] >= 85.0  # QPSO beats GNN in vast majority of cases
    assert sm["avg_fit_imp_vs_pso"] > 0.0      # Positive average fitness improvement vs PSO
    assert sm["avg_fit_imp_vs_gnn"] > 10.0     # Significant fitness improvement vs GNN
    assert sm["qpso_mean_feasibility"] >= 90.0 # High feasibility across 300 random problems

    # 3. Export 100x scale markdown report and CSV dataset
    rep_100x_md = Path(__file__).resolve().parent.parent / "reports" / "random_parameter_benchmark_100x_report.md"
    rep_100x_md.parent.mkdir(parents=True, exist_ok=True)
    report.to_markdown(str(rep_100x_md))
    assert rep_100x_md.exists()
    assert rep_100x_md.stat().st_size > 1000

    rep_100x_csv = Path(__file__).resolve().parent.parent / "reports" / "random_scenarios_100x_data.csv"
    report.to_csv(str(rep_100x_csv))
    assert rep_100x_csv.exists()
    assert rep_100x_csv.stat().st_size > 5000


def test_random_parameter_benchmark_ultra_scale():
    """Ultra-scale randomized test suite evaluating 1,000 distinct randomized scenarios.
    Uses multi-core parallel execution to benchmark QPSO, PSO, and GNN at scale.
    """
    suite = RandomBenchmarkSuite()

    scenarios = suite.generate_random_scenarios(
        num_scenarios=1000,
        base_seed=999,
        customer_range=(8, 16),
        vehicle_range=(2, 4),
        capacity_range=(75.0, 125.0),
        swarm_range=(15, 30),
        iter_range=(20, 40),
        runs_per_scenario=1
    )
    assert len(scenarios) == 1000

    report = suite.run_suite(
        scenarios=scenarios,
        verbose=False,
        workers=8
    )

    assert report.total_scenarios == 1000
    assert len(report.scenarios) == 1000
    sm = report.summary_metrics

    assert sm["qpso_win_rate_vs_pso"] >= 60.0
    assert sm["qpso_win_rate_vs_gnn"] >= 85.0
    assert sm["avg_fit_imp_vs_pso"] > 0.0
    assert sm["avg_fit_imp_vs_gnn"] > 10.0
    assert sm["qpso_mean_feasibility"] >= 88.0
