"""Automated Benchmarking Engine & Performance Scorecard Generator.
Implements Chapters 13 & 14 of Reference.md (Plan Step 5.2).
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
import numpy as np
import pandas as pd

from .config import PenaltyConfig, SolverConfig
from .solvers import GNNSolver, PSOSolver, QPSOSolver, SolverResult
from .vrp_model import VRPProblem


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
                "Feasibility Rate (%)": f"{feas_rate:.1f}%"
            })

        scorecard_df = pd.DataFrame(rows)

        # 6. Aggregate convergence history from the best run of each algorithm
        conv_data = {"Iteration": list(range(max_iterations + 1))}
        for name, run_list in results.items():
            best_run = min(run_list, key=lambda r: r.best_fitness)
            history_dict = {cp.iteration: cp.best_fitness for cp in best_run.history}
            conv_data[name] = [
                history_dict.get(it, history_dict.get(0, 0.0))
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
