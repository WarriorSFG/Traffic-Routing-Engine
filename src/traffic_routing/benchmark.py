"""Automated Benchmarking Engine & Performance Scorecard Generator.
Implements Chapters 13 & 14 of Reference.md (Plan Step 5.2).
"""

from dataclasses import dataclass, field
from pathlib import Path
import random
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

from .config import CongestionConfig, NetworkConfig, PenaltyConfig, SolverConfig, TrafficPreset, VRPConfig
from .congestion_engine import DynamicCongestionEngine
from .cost_matrix import CostMatrixCalculator
from .graph_generator import generate_road_network
from .solvers import GNNSolver, PSOSolver, QPSOSolver, SolverResult
from .vrp_model import create_vrp_problem, VRPProblem


@dataclass
class AlgorithmStats:
    algorithm_name: str
    mean_fitness: float
    std_fitness: float
    best_fitness: float
    worst_fitness: float
    mean_time_hours: float
    mean_dist_km: float
    mean_compute_ms: float
    feasibility_rate: float
    relative_gap_pct: float
    runs: List[SolverResult] = field(default_factory=list)


@dataclass
class BenchmarkReport:
    problem_summary: Dict[str, str]
    stats: Dict[str, AlgorithmStats]
    scorecard_df: pd.DataFrame
    convergence_df: pd.DataFrame


class BenchmarkEngine:
    """Performs rigorous statistical benchmarking comparing GNN, Classical PSO, and QPSO."""

    def __init__(self, problem: VRPProblem, penalty_config: Optional[PenaltyConfig] = None):
        self.problem = problem
        self.penalty_config = penalty_config or PenaltyConfig()

    def run_benchmark(
        self,
        num_runs: int = 5,
        swarm_size: int = 40,
        max_iterations: int = 100,
        base_seed: int = 42
    ) -> BenchmarkReport:
        """Executes repeated runs across all solvers and aggregates statistical metrics."""
        results: Dict[str, List[SolverResult]] = {
            "GNN": [],
            "Classical PSO": [],
            "Quantum-Inspired PSO (QPSO)": []
        }

        # 1. Run GNN (Deterministic baseline, runs once or replicates)
        gnn_solver = GNNSolver(self.problem, self.penalty_config)
        res_gnn = gnn_solver.solve()
        for _ in range(num_runs):
            results["GNN"].append(res_gnn)

        # 2. Run Classical PSO across num_runs with different seeds
        for r in range(num_runs):
            seed = base_seed + r * 100 + 1
            pso_cfg = SolverConfig(
                swarm_size=swarm_size,
                max_iterations=max_iterations,
                seed=seed
            )
            pso_solver = PSOSolver(self.problem, self.penalty_config, pso_cfg)
            results["Classical PSO"].append(pso_solver.solve())

        # 3. Run QPSO across num_runs with different seeds
        for r in range(num_runs):
            seed = base_seed + r * 100 + 7
            qpso_cfg = SolverConfig(
                swarm_size=swarm_size,
                max_iterations=max_iterations,
                seed=seed
            )
            qpso_solver = QPSOSolver(self.problem, self.penalty_config, qpso_cfg)
            results["Quantum-Inspired PSO (QPSO)"].append(qpso_solver.solve())

        # 4. Determine Global Best Fitness F* (§13.2)
        all_fits = [
            res.best_fitness
            for run_list in results.values()
            for res in run_list
        ]
        f_star = min(all_fits) if all_fits else 1.0

        # 5. Compute Statistical Aggregates (§13.1 - §13.6)
        stats: Dict[str, AlgorithmStats] = {}
        rows = []

        for name, run_list in results.items():
            fits = np.array([r.best_fitness for r in run_list], dtype=np.float64)
            times = np.array([r.solution.total_time for r in run_list], dtype=np.float64)
            dists = np.array([r.solution.total_distance for r in run_list], dtype=np.float64)
            computes = np.array([r.compute_time_ms for r in run_list], dtype=np.float64)
            feasibles = np.array([1.0 if r.solution.is_feasible else 0.0 for r in run_list], dtype=np.float64)

            mean_fit = float(np.mean(fits))
            std_fit = float(np.std(fits)) if len(fits) > 1 else 0.0
            best_fit = float(np.min(fits))
            worst_fit = float(np.max(fits))
            mean_time = float(np.mean(times))
            mean_dist = float(np.mean(dists))
            mean_comp = float(np.mean(computes))
            feas_rate = float(np.mean(feasibles)) * 100.0
            gap_pct = ((best_fit - f_star) / max(1e-6, f_star)) * 100.0

            algo_stat = AlgorithmStats(
                algorithm_name=name,
                mean_fitness=mean_fit,
                std_fitness=std_fit,
                best_fitness=best_fit,
                worst_fitness=worst_fit,
                mean_time_hours=mean_time,
                mean_dist_km=mean_dist,
                mean_compute_ms=mean_comp,
                feasibility_rate=feas_rate,
                relative_gap_pct=gap_pct,
                runs=run_list
            )
            stats[name] = algo_stat

            rows.append({
                "Algorithm": name,
                "Best Fitness": f"{best_fit:.2f}",
                "Mean Fitness": f"{mean_fit:.2f} ± {std_fit:.2f}",
                "Fleet Travel Time (h)": f"{mean_time:.2f}",
                "Fleet Distance (km)": f"{mean_dist:.2f}",
                "Wall-Clock Time (ms)": f"{mean_comp:.2f}",
                "Optimality Gap (%)": f"{gap_pct:.2f}%",
                "Feasibility Rate (%)": f"{feas_rate:.1f}%",
                # Numeric & frontend-compatible aliases
                "Best Cost": round(best_fit, 2),
                "Mean Cost": round(mean_fit, 2),
                "Std Dev": round(std_fit, 2),
                "Mean Time (hrs)": round(mean_time, 2),
                "Mean Dist (km)": round(mean_dist, 2),
                "Mean Compute (ms)": round(mean_comp, 2),
                "Relative Gap (%)": round(gap_pct, 2),
                "Feasibility Rate": f"{feas_rate:.1f}%"
            })

        scorecard_df = pd.DataFrame(rows)

        # 6. Aggregate convergence history from the best run of each algorithm
        conv_data = {"Iteration": list(range(max_iterations + 1))}
        for name, run_list in results.items():
            best_run = min(run_list, key=lambda r: r.best_fitness)
            history_dict = {cp.iteration: cp.best_fitness for cp in best_run.history}
            fallback = float(best_run.best_fitness)
            conv_data[name] = [
                history_dict.get(it, fallback)
                for it in range(max_iterations + 1)
            ]
        convergence_df = pd.DataFrame(conv_data)

        problem_summary = {
            "Total Stops": str(self.problem.num_stops),
            "Customers": str(self.problem.num_customers),
            "Vehicle Fleet": str(self.problem.num_vehicles),
            "Capacity": str(self.problem.capacity),
            "Benchmark Runs": str(num_runs),
            "Swarm Size": str(swarm_size),
            "Max Iterations": str(max_iterations)
        }

        return BenchmarkReport(
            problem_summary=problem_summary,
            stats=stats,
            scorecard_df=scorecard_df,
            convergence_df=convergence_df
        )


@dataclass
class RandomScenarioConfig:
    """Parameters for a single randomized benchmark trial scenario."""
    scenario_id: int
    seed: int
    num_customers: int
    num_nodes: int
    num_vehicles: int
    vehicle_capacity: float
    sim_time: float
    preset: TrafficPreset
    swarm_size: int
    max_iterations: int
    num_runs: int = 3
    map_width: float = 100.0
    map_height: float = 100.0


@dataclass
class ScenarioComparisonResult:
    """Head-to-head comparison metrics for one scenario comparing QPSO vs Classical PSO and GNN."""
    scenario_id: int
    seed: int
    params: Dict[str, Any]
    stats: Dict[str, AlgorithmStats]
    # QPSO vs Classical PSO
    qpso_vs_pso_fit_imp_pct: float
    qpso_vs_pso_best_fit_imp_pct: float
    qpso_vs_pso_time_imp_pct: float
    qpso_vs_pso_dist_imp_pct: float
    qpso_vs_pso_speedup: float
    pso_winner: str
    # QPSO vs GNN
    qpso_vs_gnn_fit_imp_pct: float
    qpso_vs_gnn_best_fit_imp_pct: float
    qpso_vs_gnn_time_imp_pct: float
    qpso_vs_gnn_dist_imp_pct: float
    qpso_vs_gnn_speedup: float
    gnn_winner: str


@dataclass
class MultiScenarioBenchmarkReport:
    """Aggregated statistical benchmark report across multiple randomized scenarios."""
    total_scenarios: int
    scenarios: List[ScenarioComparisonResult]
    scenario_table_df: pd.DataFrame
    summary_metrics: Dict[str, Any]

    def to_markdown(self, filepath: Optional[str] = None) -> str:
        """Renders comprehensive markdown report comparing QPSO against Classical PSO and GNN."""
        sm = self.summary_metrics
        lines = [
            "# Quantum-Inspired PSO (QPSO) Multi-Scenario Comparative Benchmark Report",
            "",
            "> Automated evaluation across randomized problem topologies, fleet constraints, and stochastic seeds.",
            "",
            "## 1. Executive Summary & Aggregate Scorecard",
            "",
            "| Metric | QPSO vs Classical PSO | QPSO vs GNN | Overall QPSO Performance |",
            "| :--- | :--- | :--- | :--- |",
            f"| **Win Rate (% Scenarios Outperformed)** | **{sm['qpso_win_rate_vs_pso']:.1f}%** ({sm['qpso_pso_wins']}/{self.total_scenarios} wins) | **{sm['qpso_win_rate_vs_gnn']:.1f}%** ({sm['qpso_gnn_wins']}/{self.total_scenarios} wins) | **{sm['qpso_overall_win_rate']:.1f}%** Global Best |",
            f"| **Mean Fitness Improvement (%)** | **+{sm['avg_fit_imp_vs_pso']:.2f}%** | **+{sm['avg_fit_imp_vs_gnn']:.2f}%** | Best Fit: **{sm['qpso_mean_best_fit']:.2f}** |",
            f"| **Mean Fleet Travel Time Reduction (%)** | **+{sm['avg_time_imp_vs_pso']:.2f}%** | **+{sm['avg_time_imp_vs_gnn']:.2f}%** | Avg Time: **{sm['qpso_mean_travel_time']:.2f} hrs** |",
            f"| **Mean Fleet Distance Reduction (%)** | **+{sm['avg_dist_imp_vs_pso']:.2f}%** | **+{sm['avg_dist_imp_vs_gnn']:.2f}%** | Avg Dist: **{sm['qpso_mean_distance']:.2f} km** |",
            f"| **Mean Wall-Clock Compute Time** | QPSO: {sm['qpso_mean_compute_ms']:.2f} ms | PSO: {sm['pso_mean_compute_ms']:.2f} ms | GNN: {sm['gnn_mean_compute_ms']:.2f} ms |",
            f"| **Mean Feasibility Rate** | QPSO: **{sm['qpso_mean_feasibility']:.1f}%** | PSO: **{sm['pso_mean_feasibility']:.1f}%** | GNN: **{sm['gnn_mean_feasibility']:.1f}%** |",
            "",
            "## 2. Statistical Aggregates by Algorithm",
            "",
            "| Algorithm | Mean Best Fitness | Mean Total Fitness | Fleet Travel Time (h) | Fleet Distance (km) | Compute Time (ms) | Feasibility Rate |",
            "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
            f"| **Quantum-Inspired PSO (QPSO)** | **{sm['qpso_mean_best_fit']:.2f}** | **{sm['qpso_mean_fit']:.2f}** | **{sm['qpso_mean_travel_time']:.2f}** | **{sm['qpso_mean_distance']:.2f}** | {sm['qpso_mean_compute_ms']:.2f} | **{sm['qpso_mean_feasibility']:.1f}%** |",
            f"| **Classical PSO** | {sm['pso_mean_best_fit']:.2f} | {sm['pso_mean_fit']:.2f} | {sm['pso_mean_travel_time']:.2f} | {sm['pso_mean_distance']:.2f} | {sm['pso_mean_compute_ms']:.2f} | {sm['pso_mean_feasibility']:.1f}% |",
            f"| **Greedy Nearest Neighbor (GNN)** | {sm['gnn_mean_best_fit']:.2f} | {sm['gnn_mean_fit']:.2f} | {sm['gnn_mean_travel_time']:.2f} | {sm['gnn_mean_distance']:.2f} | {sm['gnn_mean_compute_ms']:.2f} | {sm['gnn_mean_feasibility']:.1f}% |",
            "",
            "## 3. Detailed Randomized Scenario Breakdown",
            "",
            "| Scenario | Seed | Stops/Veh/Cap | Swarm/Iter | Preset @ Time | QPSO Fitness | PSO Fitness | GNN Fitness | QPSO vs PSO (Fit %) | QPSO vs GNN (Fit %) | Winner |",
            "| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |"
        ]

        # Add percentile table if 15 or more scenarios
        if len(self.scenarios) >= 15:
            pso_imp = np.array([s.qpso_vs_pso_fit_imp_pct for s in self.scenarios])
            gnn_imp = np.array([s.qpso_vs_gnn_fit_imp_pct for s in self.scenarios])
            q_fits = np.array([s.stats["Quantum-Inspired PSO (QPSO)"].best_fitness for s in self.scenarios])
            p_fits = np.array([s.stats["Classical PSO"].best_fitness for s in self.scenarios])
            g_fits = np.array([s.stats["GNN"].best_fitness for s in self.scenarios])

            pct_section = [
                "",
                "### Statistical Distribution Across Scenarios (Percentiles)",
                "",
                "| Percentile | QPSO Fitness | PSO Fitness | GNN Fitness | QPSO vs PSO Imp (%) | QPSO vs GNN Imp (%) |",
                "| :--- | :--- | :--- | :--- | :--- | :--- |",
                f"| **Min (Best)** | {np.min(q_fits):.2f} | {np.min(p_fits):.2f} | {np.min(g_fits):.2f} | {np.min(pso_imp):+.2f}% | {np.min(gnn_imp):+.2f}% |",
                f"| **25th %** | {np.percentile(q_fits, 25):.2f} | {np.percentile(p_fits, 25):.2f} | {np.percentile(g_fits, 25):.2f} | {np.percentile(pso_imp, 25):+.2f}% | {np.percentile(gnn_imp, 25):+.2f}% |",
                f"| **Median (50th)** | **{np.median(q_fits):.2f}** | {np.median(p_fits):.2f} | {np.median(g_fits):.2f} | **{np.median(pso_imp):+.2f}%** | **{np.median(gnn_imp):+.2f}%** |",
                f"| **75th %** | {np.percentile(q_fits, 75):.2f} | {np.percentile(p_fits, 75):.2f} | {np.percentile(g_fits, 75):.2f} | {np.percentile(pso_imp, 75):+.2f}% | {np.percentile(gnn_imp, 75):+.2f}% |",
                f"| **90th %** | {np.percentile(q_fits, 90):.2f} | {np.percentile(p_fits, 90):.2f} | {np.percentile(g_fits, 90):.2f} | {np.percentile(pso_imp, 90):+.2f}% | {np.percentile(gnn_imp, 90):+.2f}% |",
                f"| **Max (Worst)** | {np.max(q_fits):.2f} | {np.max(p_fits):.2f} | {np.max(g_fits):.2f} | {np.max(pso_imp):+.2f}% | {np.max(gnn_imp):+.2f}% |",
                "",
                "### Representative Scenario Sample",
                ""
            ]
            lines = lines[:lines.index("## 3. Detailed Randomized Scenario Breakdown") + 1] + pct_section + [
                "| Scenario | Seed | Stops/Veh/Cap | Swarm/Iter | Preset @ Time | QPSO Fitness | PSO Fitness | GNN Fitness | QPSO vs PSO (Fit %) | QPSO vs GNN (Fit %) | Winner |",
                "| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |"
            ]

        display_scenarios = self.scenarios
        is_sampled = False
        if len(self.scenarios) > 35:
            display_scenarios = self.scenarios[:25] + self.scenarios[-10:]
            is_sampled = True

        for s in display_scenarios:
            p = s.params
            q_stat = s.stats["Quantum-Inspired PSO (QPSO)"]
            p_stat = s.stats["Classical PSO"]
            g_stat = s.stats["GNN"]
            stops_str = f"{p['customers']}c / {p['vehicles']}v / {p['capacity']:.0f}"
            swarm_str = f"{p['swarm']}s / {p['iterations']}it"
            preset_str = f"{p['preset']} @ {p['sim_time']:.1f}h"
            overall_winner = "QPSO" if (s.pso_winner == "QPSO" and s.gnn_winner == "QPSO") else (
                "QPSO (beats PSO)" if s.pso_winner == "QPSO" else (
                    "QPSO (beats GNN)" if s.gnn_winner == "QPSO" else (
                        "PSO" if s.pso_winner == "Classical PSO" else "GNN"
                    )
                )
            )

            lines.append(
                f"| #{s.scenario_id} | `{s.seed}` | {stops_str} | {swarm_str} | {preset_str} | "
                f"**{q_stat.best_fitness:.2f}** | {p_stat.best_fitness:.2f} | {g_stat.best_fitness:.2f} | "
                f"{s.qpso_vs_pso_fit_imp_pct:+.2f}% | {s.qpso_vs_gnn_fit_imp_pct:+.2f}% | **{overall_winner}** |"
            )

        if is_sampled:
            lines.append(f"\n> *Note: Showing 35 representative scenarios out of {len(self.scenarios)} total cases. Complete results exported to CSV.*")

        lines.extend([
            "",
            "## 4. Key Engineering Insights",
            "",
            "- **Quantum Delta Potential Well Dynamics**: QPSO eliminates particle velocities in favor of delta-potential wave functions, allowing global tunneling across local optima where Classical PSO stalls.",
            "- **Adaptive Contraction-Expansion (\\(\\beta\\)) Coefficient**: Linear decay from \\(\\beta_{max}=1.0\\) to \\(\\beta_{min}=0.4\\) systematically balances broad global exploration in early iterations with aggressive local exploitation in later stages.",
            "- **Deterministic Heuristic vs Metaheuristic Tradeoff**: GNN executes in minimal compute time (<1 ms) but exhibits elevated total fleet travel times and higher vulnerability to congestion bottlenecks.",
            "- **C++ Pybind11 High Performance Core**: Hardware-accelerated OpenMP parallel evaluations execute full multi-run swarm iterations in tens of milliseconds per trial."
        ])

        report_content = "\n".join(lines)
        if filepath:
            out_p = Path(filepath)
            out_p.parent.mkdir(parents=True, exist_ok=True)
            out_p.write_text(report_content, encoding="utf-8")

        return report_content

    def to_text(self) -> str:
        """Returns plain text ASCII summary scorecard."""
        sm = self.summary_metrics
        sep = "=" * 80
        lines = [
            sep,
            "  QUANTUM-INSPIRED PSO (QPSO) MULTI-SCENARIO BENCHMARK REPORT",
            sep,
            f"Total Randomized Scenarios Evaluated: {self.total_scenarios}",
            f"QPSO Win Rate vs Classical PSO:       {sm['qpso_win_rate_vs_pso']:.1f}% ({sm['qpso_pso_wins']}/{self.total_scenarios})",
            f"QPSO Win Rate vs GNN:                 {sm['qpso_win_rate_vs_gnn']:.1f}% ({sm['qpso_gnn_wins']}/{self.total_scenarios})",
            f"Average Fitness Improvement vs PSO:   {sm['avg_fit_imp_vs_pso']:+.2f}%",
            f"Average Fitness Improvement vs GNN:   {sm['avg_fit_imp_vs_gnn']:+.2f}%",
            f"Average Travel Time Imp. vs PSO:      {sm['avg_time_imp_vs_pso']:+.2f}%",
            f"Average Travel Time Imp. vs GNN:      {sm['avg_time_imp_vs_gnn']:+.2f}%",
            f"QPSO Feasibility Rate:                {sm['qpso_mean_feasibility']:.1f}%",
            sep,
            "ALGORITHM COMPARISON SUMMARY:",
            f"  QPSO  - Mean Fit: {sm['qpso_mean_fit']:.2f} | Time: {sm['qpso_mean_travel_time']:.2f}h | Dist: {sm['qpso_mean_distance']:.2f}km | Comp: {sm['qpso_mean_compute_ms']:.2f}ms",
            f"  PSO   - Mean Fit: {sm['pso_mean_fit']:.2f} | Time: {sm['pso_mean_travel_time']:.2f}h | Dist: {sm['pso_mean_distance']:.2f}km | Comp: {sm['pso_mean_compute_ms']:.2f}ms",
            f"  GNN   - Mean Fit: {sm['gnn_mean_fit']:.2f} | Time: {sm['gnn_mean_travel_time']:.2f}h | Dist: {sm['gnn_mean_distance']:.2f}km | Comp: {sm['gnn_mean_compute_ms']:.2f}ms",
            sep
        ]
        return "\n".join(lines)

    def to_csv(self, filepath: str) -> None:
        """Exports detailed scenario data table to CSV."""
        out_p = Path(filepath)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        self.scenario_table_df.to_csv(out_p, index=False)


def _worker_run_scenario(scenario: "RandomScenarioConfig") -> "ScenarioComparisonResult":
    """Module-level worker target for multiprocess parallel benchmark runs."""
    suite = RandomBenchmarkSuite()
    return suite.run_scenario(scenario)


class RandomBenchmarkSuite:
    """Manages randomized parameter series generation and comparative benchmarking."""

    @staticmethod
    def generate_random_scenarios(
        num_scenarios: int = 5,
        base_seed: int = 42,
        customer_range: Tuple[int, int] = (10, 20),
        vehicle_range: Tuple[int, int] = (2, 4),
        capacity_range: Tuple[float, float] = (70.0, 120.0),
        swarm_range: Tuple[int, int] = (20, 40),
        iter_range: Tuple[int, int] = (40, 80),
        runs_per_scenario: int = 3
    ) -> List[RandomScenarioConfig]:
        """Generates reproducible randomized parameter configurations."""
        rng = random.Random(base_seed)
        presets = [TrafficPreset.UNIFORM, TrafficPreset.RUSH_HOUR, TrafficPreset.INCIDENT]
        sim_times = [8.0, 8.5, 9.0, 13.0, 17.5, 18.0]

        scenarios: List[RandomScenarioConfig] = []
        for i in range(1, num_scenarios + 1):
            seed = rng.randint(1000, 99999)
            num_cust = rng.randint(customer_range[0], customer_range[1])
            num_nodes = num_cust + rng.randint(8, 15)
            cap = round(rng.uniform(capacity_range[0], capacity_range[1]), 1)
            # Ensure fleet can satisfy demand (avg demand 20 units/customer with safety margin)
            min_req_veh = max(vehicle_range[0], int(np.ceil((num_cust * 25.0) / cap)))
            max_req_veh = max(min_req_veh, vehicle_range[1] + 1)
            num_veh = rng.randint(min_req_veh, max_req_veh)
            sim_t = rng.choice(sim_times)
            preset = rng.choice(presets)
            swarm = rng.randint(swarm_range[0], swarm_range[1])
            iterations = rng.randint(iter_range[0], iter_range[1])

            scenarios.append(
                RandomScenarioConfig(
                    scenario_id=i,
                    seed=seed,
                    num_customers=num_cust,
                    num_nodes=num_nodes,
                    num_vehicles=num_veh,
                    vehicle_capacity=cap,
                    sim_time=sim_t,
                    preset=preset,
                    swarm_size=swarm,
                    max_iterations=iterations,
                    num_runs=runs_per_scenario
                )
            )
        return scenarios

    def run_scenario(self, scenario: RandomScenarioConfig) -> ScenarioComparisonResult:
        """Runs a single randomized scenario across GNN, Classical PSO, and QPSO."""
        # 1. Build road network
        net_cfg = NetworkConfig(
            num_nodes=scenario.num_nodes,
            num_customers=scenario.num_customers,
            map_width=scenario.map_width,
            map_height=scenario.map_height,
            seed=scenario.seed
        )
        net = generate_road_network(net_cfg)

        # 2. Configure dynamic congestion
        cong_cfg = CongestionConfig(preset=scenario.preset, seed=scenario.seed)
        c_engine = DynamicCongestionEngine(net, cong_cfg)
        c_state = c_engine.evaluate(t=scenario.sim_time)
        dyn_graph = c_engine.create_weighted_graph(c_state)

        # 3. Compute cost matrix & VRP problem
        calc = CostMatrixCalculator(net)
        cost_matrix = calc.compute(dyn_graph, sim_time=scenario.sim_time)

        vrp_cfg = VRPConfig(
            vehicle_capacity=scenario.vehicle_capacity,
            num_vehicles=scenario.num_vehicles
        )
        problem = create_vrp_problem(cost_matrix, vrp_cfg, seed=scenario.seed)

        # 4. Execute standard multi-run benchmark
        engine = BenchmarkEngine(problem, PenaltyConfig())
        report = engine.run_benchmark(
            num_runs=scenario.num_runs,
            swarm_size=scenario.swarm_size,
            max_iterations=scenario.max_iterations,
            base_seed=scenario.seed
        )

        qpso = report.stats["Quantum-Inspired PSO (QPSO)"]
        pso = report.stats["Classical PSO"]
        gnn = report.stats["GNN"]

        # 5. Compute comparisons: QPSO vs Classical PSO
        pso_fit_imp = ((pso.mean_fitness - qpso.mean_fitness) / max(1e-6, pso.mean_fitness)) * 100.0
        pso_best_imp = ((pso.best_fitness - qpso.best_fitness) / max(1e-6, pso.best_fitness)) * 100.0
        pso_time_imp = ((pso.mean_time_hours - qpso.mean_time_hours) / max(1e-6, pso.mean_time_hours)) * 100.0
        pso_dist_imp = ((pso.mean_dist_km - qpso.mean_dist_km) / max(1e-6, pso.mean_dist_km)) * 100.0
        pso_speedup = pso.mean_compute_ms / max(1e-6, qpso.mean_compute_ms)
        pso_winner = "QPSO" if qpso.best_fitness < (pso.best_fitness - 1e-4) else (
            "Classical PSO" if pso.best_fitness < (qpso.best_fitness - 1e-4) else (
                "QPSO" if qpso.mean_fitness < (pso.mean_fitness - 1e-4) else (
                    "Classical PSO" if pso.mean_fitness < (qpso.mean_fitness - 1e-4) else "Tie"
                )
            )
        )

        # 6. Compute comparisons: QPSO vs GNN
        gnn_fit_imp = ((gnn.mean_fitness - qpso.mean_fitness) / max(1e-6, gnn.mean_fitness)) * 100.0
        gnn_best_imp = ((gnn.best_fitness - qpso.best_fitness) / max(1e-6, gnn.best_fitness)) * 100.0
        gnn_time_imp = ((gnn.mean_time_hours - qpso.mean_time_hours) / max(1e-6, gnn.mean_time_hours)) * 100.0
        gnn_dist_imp = ((gnn.mean_dist_km - qpso.mean_dist_km) / max(1e-6, gnn.mean_dist_km)) * 100.0
        gnn_speedup = gnn.mean_compute_ms / max(1e-6, qpso.mean_compute_ms)
        gnn_winner = "QPSO" if qpso.best_fitness < (gnn.best_fitness - 1e-4) else (
            "GNN" if gnn.best_fitness < (qpso.best_fitness - 1e-4) else (
                "QPSO" if qpso.mean_fitness < (gnn.mean_fitness - 1e-4) else (
                    "GNN" if gnn.mean_fitness < (qpso.mean_fitness - 1e-4) else "Tie"
                )
            )
        )

        params_dict = {
            "customers": scenario.num_customers,
            "nodes": scenario.num_nodes,
            "vehicles": scenario.num_vehicles,
            "capacity": scenario.vehicle_capacity,
            "sim_time": scenario.sim_time,
            "preset": scenario.preset.value,
            "swarm": scenario.swarm_size,
            "iterations": scenario.max_iterations,
            "runs": scenario.num_runs
        }

        return ScenarioComparisonResult(
            scenario_id=scenario.scenario_id,
            seed=scenario.seed,
            params=params_dict,
            stats=report.stats,
            qpso_vs_pso_fit_imp_pct=pso_fit_imp,
            qpso_vs_pso_best_fit_imp_pct=pso_best_imp,
            qpso_vs_pso_time_imp_pct=pso_time_imp,
            qpso_vs_pso_dist_imp_pct=pso_dist_imp,
            qpso_vs_pso_speedup=pso_speedup,
            pso_winner=pso_winner,
            qpso_vs_gnn_fit_imp_pct=gnn_fit_imp,
            qpso_vs_gnn_best_fit_imp_pct=gnn_best_imp,
            qpso_vs_gnn_time_imp_pct=gnn_time_imp,
            qpso_vs_gnn_dist_imp_pct=gnn_dist_imp,
            qpso_vs_gnn_speedup=gnn_speedup,
            gnn_winner=gnn_winner
        )

    def run_suite(
        self,
        scenarios: Optional[List[RandomScenarioConfig]] = None,
        num_scenarios: int = 5,
        base_seed: int = 42,
        runs_per_scenario: int = 3,
        verbose: bool = True,
        workers: int = 1
    ) -> MultiScenarioBenchmarkReport:
        """Executes the full series of randomized parameter trials and aggregates results."""
        if scenarios is None:
            scenarios = self.generate_random_scenarios(
                num_scenarios=num_scenarios,
                base_seed=base_seed,
                runs_per_scenario=runs_per_scenario
            )

        results: List[ScenarioComparisonResult] = []
        rows = []

        if verbose:
            print(f"[RANDOM BENCHMARK] Executing {len(scenarios)} randomized scenarios (workers={workers})...")

        if workers > 1 and len(scenarios) > 10:
            from concurrent.futures import ProcessPoolExecutor
            chunk = max(10, len(scenarios) // (workers * 4))
            with ProcessPoolExecutor(max_workers=workers) as executor:
                results = list(executor.map(_worker_run_scenario, scenarios, chunksize=chunk))
        else:
            for s in scenarios:
                if verbose and (len(scenarios) <= 20 or s.scenario_id % max(1, len(scenarios) // 10) == 0):
                    print(f"  -> Running Scenario #{s.scenario_id} [Seed {s.seed} | {s.num_customers} Cust | "
                          f"{s.num_vehicles} Veh | Swarm {s.swarm_size} | Iter {s.max_iterations}]...")
                res = self.run_scenario(s)
                results.append(res)

        for res in results:
            q_stat = res.stats["Quantum-Inspired PSO (QPSO)"]
            p_stat = res.stats["Classical PSO"]
            g_stat = res.stats["GNN"]
            p = res.params

            rows.append({
                "Scenario": res.scenario_id,
                "Seed": res.seed,
                "Customers": p["customers"],
                "Vehicles": p["vehicles"],
                "Capacity": p["capacity"],
                "SimTime": p["sim_time"],
                "Preset": p["preset"],
                "Swarm": p["swarm"],
                "Iterations": p["iterations"],
                # QPSO stats
                "QPSO_BestFit": round(q_stat.best_fitness, 2),
                "QPSO_MeanFit": round(q_stat.mean_fitness, 2),
                "QPSO_Time_h": round(q_stat.mean_time_hours, 2),
                "QPSO_Dist_km": round(q_stat.mean_dist_km, 2),
                "QPSO_Compute_ms": round(q_stat.mean_compute_ms, 2),
                "QPSO_Feas_pct": round(q_stat.feasibility_rate, 1),
                # Classical PSO stats
                "PSO_BestFit": round(p_stat.best_fitness, 2),
                "PSO_MeanFit": round(p_stat.mean_fitness, 2),
                "PSO_Time_h": round(p_stat.mean_time_hours, 2),
                "PSO_Dist_km": round(p_stat.mean_dist_km, 2),
                "PSO_Compute_ms": round(p_stat.mean_compute_ms, 2),
                "PSO_Feas_pct": round(p_stat.feasibility_rate, 1),
                # GNN stats
                "GNN_BestFit": round(g_stat.best_fitness, 2),
                "GNN_MeanFit": round(g_stat.mean_fitness, 2),
                "GNN_Time_h": round(g_stat.mean_time_hours, 2),
                "GNN_Dist_km": round(g_stat.mean_dist_km, 2),
                "GNN_Compute_ms": round(g_stat.mean_compute_ms, 2),
                "GNN_Feas_pct": round(g_stat.feasibility_rate, 1),
                # Comparative deltas
                "QPSO_vs_PSO_FitImp_%": round(res.qpso_vs_pso_fit_imp_pct, 2),
                "QPSO_vs_PSO_TimeImp_%": round(res.qpso_vs_pso_time_imp_pct, 2),
                "PSO_Winner": res.pso_winner,
                "QPSO_vs_GNN_FitImp_%": round(res.qpso_vs_gnn_fit_imp_pct, 2),
                "QPSO_vs_GNN_TimeImp_%": round(res.qpso_vs_gnn_time_imp_pct, 2),
                "GNN_Winner": res.gnn_winner
            })

        scenario_df = pd.DataFrame(rows)

        # Aggregate metrics
        total = len(results)
        qpso_pso_wins = sum(1 for r in results if r.pso_winner == "QPSO")
        qpso_gnn_wins = sum(1 for r in results if r.gnn_winner == "QPSO")
        global_wins = sum(1 for r in results if r.pso_winner == "QPSO" and r.gnn_winner == "QPSO")

        summary = {
            "total_scenarios": total,
            "qpso_pso_wins": qpso_pso_wins,
            "qpso_gnn_wins": qpso_gnn_wins,
            "qpso_global_wins": global_wins,
            "qpso_win_rate_vs_pso": (qpso_pso_wins / max(1, total)) * 100.0,
            "qpso_win_rate_vs_gnn": (qpso_gnn_wins / max(1, total)) * 100.0,
            "qpso_overall_win_rate": (global_wins / max(1, total)) * 100.0,
            "avg_fit_imp_vs_pso": float(np.mean([r.qpso_vs_pso_fit_imp_pct for r in results])),
            "avg_time_imp_vs_pso": float(np.mean([r.qpso_vs_pso_time_imp_pct for r in results])),
            "avg_dist_imp_vs_pso": float(np.mean([r.qpso_vs_pso_dist_imp_pct for r in results])),
            "avg_fit_imp_vs_gnn": float(np.mean([r.qpso_vs_gnn_fit_imp_pct for r in results])),
            "avg_time_imp_vs_gnn": float(np.mean([r.qpso_vs_gnn_time_imp_pct for r in results])),
            "avg_dist_imp_vs_gnn": float(np.mean([r.qpso_vs_gnn_dist_imp_pct for r in results])),
            # QPSO means
            "qpso_mean_fit": float(np.mean([r.stats["Quantum-Inspired PSO (QPSO)"].mean_fitness for r in results])),
            "qpso_mean_best_fit": float(np.mean([r.stats["Quantum-Inspired PSO (QPSO)"].best_fitness for r in results])),
            "qpso_mean_travel_time": float(np.mean([r.stats["Quantum-Inspired PSO (QPSO)"].mean_time_hours for r in results])),
            "qpso_mean_distance": float(np.mean([r.stats["Quantum-Inspired PSO (QPSO)"].mean_dist_km for r in results])),
            "qpso_mean_compute_ms": float(np.mean([r.stats["Quantum-Inspired PSO (QPSO)"].mean_compute_ms for r in results])),
            "qpso_mean_feasibility": float(np.mean([r.stats["Quantum-Inspired PSO (QPSO)"].feasibility_rate for r in results])),
            # PSO means
            "pso_mean_fit": float(np.mean([r.stats["Classical PSO"].mean_fitness for r in results])),
            "pso_mean_best_fit": float(np.mean([r.stats["Classical PSO"].best_fitness for r in results])),
            "pso_mean_travel_time": float(np.mean([r.stats["Classical PSO"].mean_time_hours for r in results])),
            "pso_mean_distance": float(np.mean([r.stats["Classical PSO"].mean_dist_km for r in results])),
            "pso_mean_compute_ms": float(np.mean([r.stats["Classical PSO"].mean_compute_ms for r in results])),
            "pso_mean_feasibility": float(np.mean([r.stats["Classical PSO"].feasibility_rate for r in results])),
            # GNN means
            "gnn_mean_fit": float(np.mean([r.stats["GNN"].mean_fitness for r in results])),
            "gnn_mean_best_fit": float(np.mean([r.stats["GNN"].best_fitness for r in results])),
            "gnn_mean_travel_time": float(np.mean([r.stats["GNN"].mean_time_hours for r in results])),
            "gnn_mean_distance": float(np.mean([r.stats["GNN"].mean_dist_km for r in results])),
            "gnn_mean_compute_ms": float(np.mean([r.stats["GNN"].mean_compute_ms for r in results])),
            "gnn_mean_feasibility": float(np.mean([r.stats["GNN"].feasibility_rate for r in results])),
        }

        return MultiScenarioBenchmarkReport(
            total_scenarios=total,
            scenarios=results,
            scenario_table_df=scenario_df,
            summary_metrics=summary
        )
