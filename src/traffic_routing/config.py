"""Configuration dataclasses and default parameters for Traffic Routing Engine.
Follows specifications from ProblemStatement.md, Plan.md, and Reference.md.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Tuple


class TrafficPreset(str, Enum):
    UNIFORM = "uniform"
    RUSH_HOUR = "rush_hour"
    INCIDENT = "incident"


@dataclass
class NetworkConfig:
    """Road network topology configuration (Chapter 2)."""
    num_nodes: int = 35
    num_customers: int = 15
    map_width: float = 100.0   # km or spatial coordinate units
    map_height: float = 100.0
    seed: Optional[int] = 42
    arterial_speed: float = 60.0    # km/h
    residential_speed: float = 30.0  # km/h
    arterial_ratio: float = 0.3      # Fraction of edges classified as arterial


@dataclass
class CongestionConfig:
    """Dynamic congestion engine configuration (Chapter 3)."""
    preset: TrafficPreset = TrafficPreset.UNIFORM
    seed: Optional[int] = 42
    # Preset 1: Uniform flow
    uniform_eps_max: float = 0.1
    # Preset 2: Rush-Hour Bottleneck
    rush_hour_alpha_max: float = 3.5
    rush_hour_lambda: float = 15.0       # Spatial decay length-scale
    rush_hour_t_start: float = 7.0       # e.g., 7:00 AM
    rush_hour_t_end: float = 10.0        # e.g., 10:00 AM
    rush_hour_hotspot_count: int = 3
    # Preset 3: Incident Disruption
    incident_alpha: float = 10.0         # Severe slowdown multiplier
    incident_hard_closure: bool = False  # If True, edge weight = infinity
    incident_edges: List[Tuple[int, int]] = field(default_factory=list)
    incident_t_start: float = 8.0
    incident_t_end: float = 9.5


@dataclass
class VRPConfig:
    """Vehicle Routing Problem parameters (Chapters 5 & 6)."""
    vehicle_capacity: float = 100.0
    num_vehicles: int = 4
    min_demand: float = 10.0
    max_demand: float = 30.0
    default_service_time: float = 0.15  # Hours (~9 mins per delivery)
    depot_window: Tuple[float, float] = (6.0, 18.0)  # Operating hours (6:00 to 18:00)
    time_window_length: float = 2.5     # Hours per delivery window


@dataclass
class PenaltyConfig:
    """Penalty coefficients for fitness evaluation (Chapter 7)."""
    lambda_capacity: float = 1000.0
    lambda_route: float = 1000.0
    lambda_tw: float = 500.0
    rho_early: float = 10.0
    rho_late: float = 50.0   # Late arrival is penalized heavier than waiting early
    auto_scale: bool = True   # Automatically scale lambdas to 10 * max(C) * |S|


@dataclass
class SolverConfig:
    """Metaheuristic solver hyperparameters (Chapters 8, 9, 11)."""
    swarm_size: int = 40
    max_iterations: int = 150
    # Classical PSO parameters (Chapter 9)
    pso_w: float = 0.7298
    pso_c1: float = 1.49618
    pso_c2: float = 1.49618
    # QPSO parameters (Chapter 11)
    qpso_beta_max: float = 1.0
    qpso_beta_min: float = 0.4
    seed: Optional[int] = 42
    use_cpp_backend: bool = True
