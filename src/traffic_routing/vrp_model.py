"""VRP Model & Constraint Definitions (CVRPTW).
Implements Chapters 5 & 6 of Reference.md (Plan Step 2.2).
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
import numpy as np

from .config import VRPConfig
from .cost_matrix import CostMatrix


@dataclass
class StopInfo:
    """Metadata for a routing stop (depot or customer)."""
    stop_idx: int                 # 0 for depot, 1..n for customers
    node_id: int                  # Graph node ID
    demand: float                 # Parcel demand d_i (d_0 = 0)
    time_window: Tuple[float, float]  # [e_i, l_i] in hours
    service_time: float           # s_i in hours


@dataclass
class VRPProblem:
    """Complete problem instance specification."""
    num_customers: int
    num_vehicles: int
    capacity: float
    stops_info: List[StopInfo]
    cost_matrix: CostMatrix

    @property
    def num_stops(self) -> int:
        return len(self.stops_info)

    @property
    def demands(self) -> np.ndarray:
        return np.array([s.demand for s in self.stops_info], dtype=np.float64)

    @property
    def time_windows(self) -> np.ndarray:
        return np.array([s.time_window for s in self.stops_info], dtype=np.float64)

    @property
    def service_times(self) -> np.ndarray:
        return np.array([s.service_time for s in self.stops_info], dtype=np.float64)


@dataclass
class RouteEvaluation:
    """Detailed validation metrics for a single vehicle route."""
    route: List[int]                # Sequence of stop indices: [0, c_1, c_2, ..., 0]
    total_time: float               # Sum of travel times between stops
    total_distance: float           # Sum of physical road distances
    total_load: float               # Sum of parcel demands
    capacity_violation: float       # max(0, total_load - Q)
    arrival_times: List[float]      # tau_i arrival time at each stop in the route
    early_wait_times: List[float]   # max(0, e_i - tau_i)
    late_times: List[float]         # max(0, tau_i - l_i)
    time_window_penalty: float      # Weighted sum of early/late penalties


@dataclass
class SolutionEvaluation:
    """Validation and objective metrics for a full fleet routing solution."""
    routes: List[List[int]]
    route_evaluations: List[RouteEvaluation]
    total_time: float               # Raw objective Z_time (§5.4, §13.3)
    total_distance: float           # Raw objective Z_dist (§13.3)
    total_load: float
    total_capacity_violation: float # sum(CapViol(k))
    total_tw_penalty: float         # sum(TWPenalty(i))
    route_structure_violations: int # Count of duplicate or missed customers
    is_feasible: bool
    unpenalized_cost: float         # Z_time
    penalized_fitness: float        # Total penalized fitness F


def create_vrp_problem(
    cost_matrix: CostMatrix,
    config: VRPConfig,
    seed: Optional[int] = 42
) -> VRPProblem:
    """Instantiates a VRPProblem with demand and time-window distributions."""
    if seed is not None:
        np.random.seed(seed)

    num_stops = cost_matrix.num_stops
    num_cust = num_stops - 1
    stops_info: List[StopInfo] = []

    # Depot: index 0
    stops_info.append(
        StopInfo(
            stop_idx=0,
            node_id=cost_matrix.stops[0],
            demand=0.0,
            time_window=config.depot_window,
            service_time=0.0
        )
    )

    depot_start, depot_end = config.depot_window
    window_length = config.time_window_length

    for idx in range(1, num_stops):
        demand = float(np.random.uniform(config.min_demand, config.max_demand))
        # Estimate approximate travel time from depot to give realistic feasible windows
        approx_travel = cost_matrix.get_time(0, idx)
        earliest_possible = depot_start + approx_travel
        
        # Stagger delivery time windows across operating hours
        max_start = max(earliest_possible, depot_end - window_length - config.default_service_time)
        e_i = float(np.random.uniform(earliest_possible, max_start))
        l_i = min(depot_end, e_i + window_length)

        stops_info.append(
            StopInfo(
                stop_idx=idx,
                node_id=cost_matrix.stops[idx],
                demand=demand,
                time_window=(e_i, l_i),
                service_time=config.default_service_time
            )
        )

    return VRPProblem(
        num_customers=num_cust,
        num_vehicles=config.num_vehicles,
        capacity=config.vehicle_capacity,
        stops_info=stops_info,
        cost_matrix=cost_matrix
    )
