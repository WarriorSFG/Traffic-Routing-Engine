"""Base solver interface and data structures.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional

from ..config import SolverConfig
from ..vrp_model import SolutionEvaluation, VRPProblem


@dataclass
class ConvergencePoint:
    iteration: int
    best_fitness: float
    current_fitness: float
    elapsed_ms: float


@dataclass
class SolverResult:
    algorithm_name: str
    solution: SolutionEvaluation
    best_fitness: float
    compute_time_ms: float
    history: List[ConvergencePoint] = field(default_factory=list)


class BaseSolver(ABC):
    """Abstract base class for VRP solvers."""

    def __init__(self, problem: VRPProblem, config: SolverConfig):
        self.problem = problem
        self.config = config

    @abstractmethod
    def solve(self, warm_start: Optional[List[float]] = None) -> SolverResult:
        """Runs the optimization algorithm and returns the result."""
        pass
