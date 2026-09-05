"""CLI Benchmark Runner.
Executes systematic benchmarking comparing GNN, Classical PSO, and QPSO.
"""

import argparse
import sys
from pathlib import Path

# Add src to python path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir / "src"))

from traffic_routing.benchmark import BenchmarkEngine
from traffic_routing.config import CongestionConfig, NetworkConfig, PenaltyConfig, VRPConfig
from traffic_routing.congestion_engine import DynamicCongestionEngine
from traffic_routing.cost_matrix import CostMatrixCalculator
from traffic_routing.graph_generator import generate_road_network
from traffic_routing.vrp_model import create_vrp_problem


def main():
    parser = argparse.ArgumentParser(description="Run Traffic Routing Metaheuristic Benchmark")
    parser.add_argument("--customers", type=int, default=15, help="Number of customer stops")
    parser.add_argument("--vehicles", type=int, default=4, help="Fleet vehicle count")
    parser.add_argument("--capacity", type=float, default=100.0, help="Vehicle capacity")
    parser.add_argument("--swarm", type=int, default=40, help="Swarm size for PSO and QPSO")
    parser.add_argument("--iterations", type=int, default=150, help="Max iterations per run")
    parser.add_argument("--runs", type=int, default=5, help="Number of repeated runs for statistics")
    parser.add_argument("--seed", type=int, default=42, help="Base random seed")
    args = parser.parse_args()

    print("\n=========================================================================")
    print("  QUANTUM-INSPIRED INTELLIGENT TRAFFIC ROUTING ENGINE — BENCHMARK")
    print("  SIH 2026 Problem Statement 26137")
    print("=========================================================================\n")
    print(f"Configuration: {args.customers} Customers | {args.vehicles} Vehicles | "
          f"Capacity: {args.capacity} | Swarm: {args.swarm} | Iterations: {args.iterations} | Runs: {args.runs}\n")

    # 1. Generate road network and dynamic congestion
    net_config = NetworkConfig(num_nodes=args.customers + 15, num_customers=args.customers, seed=args.seed)
    net = generate_road_network(net_config)

    c_engine = DynamicCongestionEngine(net, CongestionConfig())
    c_state = c_engine.evaluate(t=8.0)  # Morning rush hour
    dyn_graph = c_engine.create_weighted_graph(c_state)

    # 2. Compute cost matrix & VRP problem
    calc = CostMatrixCalculator(net)
    cost_matrix = calc.compute(dyn_graph, sim_time=8.0)

    vrp_config = VRPConfig(vehicle_capacity=args.capacity, num_vehicles=args.vehicles)
    problem = create_vrp_problem(cost_matrix, vrp_config, seed=args.seed)

    # 3. Run Benchmark
    engine = BenchmarkEngine(problem, PenaltyConfig())
    print("[BENCHMARK] Executing multi-run trials...")
    report = engine.run_benchmark(
        num_runs=args.runs,
        swarm_size=args.swarm,
        max_iterations=args.iterations,
        base_seed=args.seed
    )

    print("\n========================= PERFORMANCE SCORECARD =========================")
    print(report.scorecard_df.to_string(index=False))
    print("=========================================================================\n")

    qpso_stat = report.stats.get("Quantum-Inspired PSO (QPSO)")
    gnn_stat = report.stats.get("GNN")
    pso_stat = report.stats.get("Classical PSO")

    if qpso_stat and gnn_stat:
        fit_imp = ((gnn_stat.mean_fitness - qpso_stat.mean_fitness) / gnn_stat.mean_fitness) * 100.0
        print(f">> QPSO Solution Quality (Fitness) Improvement vs GNN: {fit_imp:.2f}% (GNN Feasibility: {gnn_stat.feasibility_rate:.1f}%)")
    if qpso_stat and pso_stat:
        improvement_pso = ((pso_stat.mean_time_hours - qpso_stat.mean_time_hours) / pso_stat.mean_time_hours) * 100.0
        print(f">> QPSO Average Travel Time Improvement vs Classical PSO: {improvement_pso:.2f}%")
        print(f">> QPSO Average Wall-Clock Compute Time: {qpso_stat.mean_compute_ms:.2f} ms")


if __name__ == "__main__":
    main()
