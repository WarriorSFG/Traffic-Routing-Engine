"""Dynamic Live Re-Routing Loop.
Implements Chapter 12 of Reference.md (Plan Step 4.3).
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple
import numpy as np

from .config import PenaltyConfig, SolverConfig, VRPConfig
from .congestion_engine import DynamicCongestionEngine
from .cost_matrix import CostMatrix, CostMatrixCalculator
from .graph_generator import RoadNetwork
from .solvers import QPSOSolver
from .vrp_model import VRPProblem, create_vrp_problem


@dataclass
class VehicleState:
    """Tracks active simulation status for an individual vehicle."""
    vehicle_id: int
    current_node: int
    completed_stops: List[int] = field(default_factory=list)
    remaining_stops: List[int] = field(default_factory=list)
    current_load: float = 0.0
    accumulated_time: float = 0.0
    accumulated_dist: float = 0.0


@dataclass
class RerouteEvent:
    """Records details when a dynamic re-routing re-optimization is triggered."""
    sim_time: float
    trigger_reason: str
    max_matrix_diff: float
    old_routes: List[List[int]]
    new_routes: List[List[int]]
    old_time: float
    new_time: float
    compute_time_ms: float


class DynamicRerouter:
    """Manages active fleet routing simulation and live re-routing under time-varying traffic."""

    def __init__(
        self,
        network: RoadNetwork,
        congestion_engine: DynamicCongestionEngine,
        initial_problem: VRPProblem,
        penalty_config: PenaltyConfig,
        solver_config: Optional[SolverConfig] = None,
        vrp_config: Optional[VRPConfig] = None,
        refresh_threshold: float = 0.05
    ):
        self.network = network
        self.congestion_engine = congestion_engine
        self.matrix_calculator = CostMatrixCalculator(network)
        self.penalty_config = penalty_config
        self.solver_config = solver_config or SolverConfig()
        self.vrp_config = vrp_config
        self.refresh_threshold = refresh_threshold

        self.current_time = 6.0  # e.g., 6:00 AM start
        self.current_cost_matrix: CostMatrix = initial_problem.cost_matrix
        self.current_problem: VRPProblem = initial_problem

        self.vehicles: List[VehicleState] = [
            VehicleState(vehicle_id=k, current_node=0)
            for k in range(initial_problem.num_vehicles)
        ]
        self.current_routes: List[List[int]] = []
        self.reroute_history: List[RerouteEvent] = []

    def set_initial_routes(self, routes: List[List[int]]) -> None:
        """Initializes vehicle assignments from the initial solver solution."""
        self.current_routes = [list(r) for r in routes]
        for k, route in enumerate(routes):
            if k < len(self.vehicles):
                # Stops excluding the depot at start
                non_depot = [node for node in route if node != 0]
                self.vehicles[k].remaining_stops = non_depot
                self.vehicles[k].current_node = 0

    def step_simulation(self, dt: float, incident_occurred: bool = False) -> Optional[RerouteEvent]:
        """Advances simulation by dt hours, updates traffic, and re-routes if necessary.
        
        Adheres to Equations 12.1 - 12.3 in Reference.md.
        """
        self.current_time += dt

        # 1. Simulate vehicle progress along their planned legs
        for veh in self.vehicles:
            if veh.remaining_stops:
                next_stop = veh.remaining_stops[0]
                leg_time = self.current_cost_matrix.get_time(veh.current_node, next_stop)
                leg_dist = self.current_cost_matrix.get_distance(veh.current_node, next_stop)

                # If vehicle completed the travel leg within this dt
                veh.accumulated_time += dt
                if veh.accumulated_time >= leg_time:
                    # Arrived at next stop
                    veh.completed_stops.append(next_stop)
                    veh.current_node = next_stop
                    veh.accumulated_dist += leg_dist
                    veh.accumulated_time = 0.0
                    veh.remaining_stops.pop(0)
            elif veh.current_node != 0:
                # Finished customer stops, return to depot (stop 0)
                leg_time = self.current_cost_matrix.get_time(veh.current_node, 0)
                leg_dist = self.current_cost_matrix.get_distance(veh.current_node, 0)
                veh.accumulated_time += dt
                if veh.accumulated_time >= leg_time:
                    veh.current_node = 0
                    veh.accumulated_dist += leg_dist
                    veh.accumulated_time = 0.0

        # 2. Evaluate dynamic traffic at new simulation time
        congestion_state = self.congestion_engine.evaluate(self.current_time)
        dynamic_graph = self.congestion_engine.create_weighted_graph(congestion_state)
        new_cost_matrix = self.matrix_calculator.compute(dynamic_graph, sim_time=self.current_time)

        # 3. Check trigger condition (§12.1)
        matrix_diff = float(np.max(np.abs(new_cost_matrix.time_matrix - self.current_cost_matrix.time_matrix)))
        needs_reroute = incident_occurred or (matrix_diff > self.refresh_threshold)

        reroute_event = None
        if needs_reroute:
            reroute_event = self._perform_warm_started_reroute(
                new_cost_matrix,
                matrix_diff,
                trigger_reason="Incident Disruption" if incident_occurred else f"Traffic Matrix Shift ({matrix_diff:.3f}h)"
            )

        self.current_cost_matrix = new_cost_matrix
        return reroute_event

    def _extract_warm_start_keys(self, routes: List[List[int]]) -> List[float]:
        """Extracts continuous [0, 1]^D keys from discrete routes for warm-starting QPSO (§10.2, §12.2)."""
        D = self.current_problem.num_customers
        keys = [0.5] * D
        ordered = [s for r in routes for s in r if s != 0]
        for rank, cust in enumerate(ordered):
            cust_idx = cust - 1
            if 0 <= cust_idx < D:
                keys[cust_idx] = float(rank) / max(1, D)
        return keys

    def _perform_warm_started_reroute(
        self,
        new_cost_matrix: CostMatrix,
        matrix_diff: float,
        trigger_reason: str
    ) -> Optional[RerouteEvent]:
        """Re-optimizes unfinished customer delivery legs using warm-started QPSO (§12.2)."""
        # Collect all remaining unvisited stops across all vehicles
        unvisited_stops: List[int] = []
        for veh in self.vehicles:
            unvisited_stops.extend(veh.remaining_stops)

        if not unvisited_stops:
            return None  # All deliveries already completed

        # Build sub-problem with new cost matrix
        sub_problem = VRPProblem(
            num_customers=self.current_problem.num_customers,
            num_vehicles=self.current_problem.num_vehicles,
            capacity=self.current_problem.capacity,
            stops_info=self.current_problem.stops_info,
            cost_matrix=new_cost_matrix
        )

        # Extract continuous warm-start keys from prior solution (§12.2)
        warm_keys = self._extract_warm_start_keys(self.current_routes)

        # Run warm-started QPSO solver on updated matrix
        solver = QPSOSolver(
            sub_problem,
            self.penalty_config,
            self.solver_config
        )
        res = solver.solve(warm_start=warm_keys)
        self.current_problem = sub_problem

        old_routes = [list(r) for r in self.current_routes]
        new_routes = res.solution.routes

        # Update remaining stops for vehicles that have not yet completed them
        all_completed = {s for v in self.vehicles for s in v.completed_stops}
        for k, route in enumerate(new_routes):
            if k < len(self.vehicles):
                non_depot = [node for node in route if node != 0 and node not in all_completed]
                self.vehicles[k].remaining_stops = non_depot

        event = RerouteEvent(
            sim_time=self.current_time,
            trigger_reason=trigger_reason,
            max_matrix_diff=matrix_diff,
            old_routes=old_routes,
            new_routes=new_routes,
            old_time=float(sum(v.accumulated_time for v in self.vehicles)),
            new_time=res.solution.total_time,
            compute_time_ms=res.compute_time_ms
        )
        self.reroute_history.append(event)
        self.current_routes = new_routes

        return event
