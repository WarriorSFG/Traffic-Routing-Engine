"""CLI Randomized Parameter Benchmark Runner.
Executes systematic randomized parameter series comparing QPSO against Classical PSO and GNN.
"""

import argparse
from pathlib import Path
import sys

# Add src to python path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir / "src"))

from traffic_routing.benchmark import MultiScenarioBenchmarkReport, RandomBenchmarkSuite


def main():
    parser = argparse.ArgumentParser(
        description="Run Randomized Parameter Benchmark comparing QPSO with Classical PSO and GNN"
    )
    parser.add_argument("--scenarios", type=int, default=5, help="Number of random parameter scenarios")
    parser.add_argument("--runs", type=int, default=3, help="Runs per scenario for stochastic algorithms")
    parser.add_argument("--seed", type=int, default=42, help="Master random seed")
    parser.add_argument("--customers-min", type=int, default=10, help="Minimum number of customer stops")
    parser.add_argument("--customers-max", type=int, default=20, help="Maximum number of customer stops")
    parser.add_argument("--vehicles-min", type=int, default=2, help="Minimum number of vehicles")
    parser.add_argument("--vehicles-max", type=int, default=4, help="Maximum number of vehicles")
    parser.add_argument("--capacity-min", type=float, default=70.0, help="Minimum vehicle capacity")
    parser.add_argument("--capacity-max", type=float, default=120.0, help="Maximum vehicle capacity")
    parser.add_argument("--swarm-min", type=int, default=25, help="Minimum swarm size")
    parser.add_argument("--swarm-max", type=int, default=45, help="Maximum swarm size")
    parser.add_argument("--iter-min", type=int, default=40, help="Minimum iterations")
    parser.add_argument("--iter-max", type=int, default=80, help="Maximum iterations")
    parser.add_argument(
        "--output",
        type=str,
        default="reports/random_parameter_benchmark_report.md",
        help="Path to save markdown comparison report"
    )
    parser.add_argument(
        "--export-csv",
        type=str,
        default=None,
        help="Optional path to save trial results as CSV"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=8,
        help="Number of parallel worker processes (default: 8)"
    )
    args = parser.parse_args()

    print("\n=========================================================================")
    print("  QUANTUM-INSPIRED INTELLIGENT TRAFFIC ROUTING ENGINE")
    print("  RANDOMIZED PARAMETER BENCHMARK & COMPARATIVE ANALYSIS")
    print("  Comparing: QPSO vs Classical PSO vs GNN Heuristic")
    print("=========================================================================\n")
    print(f"Configuration: {args.scenarios} Scenarios | {args.runs} Runs/Scenario | Master Seed: {args.seed}")
    print(f"Customer Range: [{args.customers_min}, {args.customers_max}] | Vehicles: [{args.vehicles_min}, {args.vehicles_max}]")
    print(f"Capacity Range: [{args.capacity_min}, {args.capacity_max}] | Swarm: [{args.swarm_min}, {args.swarm_max}] | Iterations: [{args.iter_min}, {args.iter_max}]\n")

    suite = RandomBenchmarkSuite()

    # 1. Generate randomized scenarios
    scenarios = suite.generate_random_scenarios(
        num_scenarios=args.scenarios,
        base_seed=args.seed,
        customer_range=(args.customers_min, args.customers_max),
        vehicle_range=(args.vehicles_min, args.vehicles_max),
        capacity_range=(args.capacity_min, args.capacity_max),
        swarm_range=(args.swarm_min, args.swarm_max),
        iter_range=(args.iter_min, args.iter_max),
        runs_per_scenario=args.runs
    )

    # 2. Run the suite
    report: MultiScenarioBenchmarkReport = suite.run_suite(
        scenarios=scenarios,
        verbose=True,
        workers=args.workers
    )

    # 3. Print text scorecard to terminal
    print("\n" + report.to_text() + "\n")

    # 4. Save markdown report
    output_path = root_dir / args.output if not Path(args.output).is_absolute() else Path(args.output)
    report.to_markdown(str(output_path))
    print(f"[REPORT] Saved full Markdown comparison report to: {output_path}")

    # 5. Export CSV if requested
    if args.export_csv:
        csv_path = root_dir / args.export_csv if not Path(args.export_csv).is_absolute() else Path(args.export_csv)
        report.to_csv(str(csv_path))
        print(f"[REPORT] Saved CSV trial dataset to: {csv_path}")

    print("\n========================= RANDOMIZED BENCHMARK COMPLETE =========================\n")


if __name__ == "__main__":
    main()
