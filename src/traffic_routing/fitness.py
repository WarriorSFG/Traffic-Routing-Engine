"""Fitness Function & Constraint Penalization Evaluator.
Implements Chapter 7 of Reference.md (Plan Step 2.2).
"""

from typing import List
import numpy as np

from .config import PenaltyConfig
from .vrp_model import RouteEvaluation, SolutionEvaluation, VRPProblem


class FitnessEvaluator:
    """Evaluates routes against travel time, distance, capacity, and time windows."""

    def __init__(self, problem: VRPProblem, penalty_config: PenaltyConfig):
        self.problem = problem
        self.penalty_config = penalty_config

        # Set up penalty coefficients (§7.4)
        if penalty_config.auto_scale:
            max_c = float(np.max(problem.cost_matrix.time_matrix))
            scale = 10.0 * max_c * problem.num_stops
            self.lambda_cap = scale * 10.0
            self.lambda_route = scale * 500.0
            self.lambda_tw = scale * 1.0
        else:
            self.lambda_cap = penalty_config.lambda_capacity
            self.lambda_route = penalty_config.lambda_route
            self.lambda_tw = penalty_config.lambda_tw

        self.rho_early = penalty_config.rho_early
        self.rho_late = penalty_config.rho_late

    def evaluate_route(self, route: List[int]) -> RouteEvaluation:
        """Evaluates a single vehicle route starting and ending at depot 0."""
        if not route or len(route) < 2:
            return RouteEvaluation(
                route=route,
                total_time=0.0,
                total_distance=0.0,
                total_load=0.0,
                capacity_violation=0.0,
                arrival_times=[],
                early_wait_times=[],
                late_times=[],
                time_window_penalty=0.0
            )

        total_time = 0.0
        total_dist = 0.0
        total_load = 0.0
        arrival_times: List[float] = []
        early_wait_times: List[float] = []
        late_times: List[float] = []
        tw_penalty = 0.0

        # Depot start time
        depot_open = self.problem.stops_info[0].time_window[0]
        current_time = depot_open
        arrival_times.append(current_time)
        early_wait_times.append(0.0)
        late_times.append(0.0)

        for i in range(len(route) - 1):
            curr_stop = route[i]
            next_stop = route[i + 1]

            # Travel leg
            travel_t = self.problem.cost_matrix.get_time(curr_stop, next_stop)
            travel_d = self.problem.cost_matrix.get_distance(curr_stop, next_stop)
            total_time += travel_t
            total_dist += travel_d

            # Arrival at next stop (§6.2, §6.3)
            arrival_t = current_time + travel_t
            arrival_times.append(arrival_t)

            if next_stop != 0:
                stop_info = self.problem.stops_info[next_stop]
                total_load += stop_info.demand
                e_i, l_i = stop_info.time_window
                s_i = stop_info.service_time

                # Early waiting vs Late arrival (§6.4, §6.5)
                early_w = max(0.0, e_i - arrival_t)
                late_v = max(0.0, arrival_t - l_i)
                early_wait_times.append(early_w)
                late_times.append(late_v)

                tw_penalty += early_w * self.rho_early + late_v * self.rho_late

                # Vehicle effective departure time
                effective_service_start = max(arrival_t, e_i)
                current_time = effective_service_start + s_i
            else:
                # Returned to depot
                depot_close = self.problem.stops_info[0].time_window[1]
                late_depot = max(0.0, arrival_t - depot_close)
                early_wait_times.append(0.0)
                late_times.append(late_depot)
                tw_penalty += late_depot * self.rho_late
                current_time = arrival_t

        cap_viol = max(0.0, total_load - self.problem.capacity)

        return RouteEvaluation(
            route=route,
            total_time=total_time,
            total_distance=total_dist,
            total_load=total_load,
            capacity_violation=cap_viol,
            arrival_times=arrival_times,
            early_wait_times=early_wait_times,
            late_times=late_times,
            time_window_penalty=tw_penalty
        )

    def evaluate_solution(self, routes: List[List[int]]) -> SolutionEvaluation:
        """Evaluates full fleet routing solution against all constraints and objectives."""
        route_evals: List[RouteEvaluation] = []
        total_time = 0.0
        total_dist = 0.0
        total_load = 0.0
        total_cap_viol = 0.0
        total_tw_viol = 0.0

        visited_customers = []
        for r in routes:
            # Skip empty or trivial routes [0, 0]
            non_depot = [node for node in r if node != 0]
            if not non_depot:
                continue
            # Ensure format starts and ends at 0
            formatted_r = [0] + non_depot + [0]
            ev = self.evaluate_route(formatted_r)
            route_evals.append(ev)

            total_time += ev.total_time
            total_dist += ev.total_distance
            total_load += ev.total_load
            total_cap_viol += ev.capacity_violation
            total_tw_viol += ev.time_window_penalty
            visited_customers.extend(non_depot)

        # Route-structure violations: missing or duplicate customers (§7.2)
        expected_customers = set(range(1, self.problem.num_stops))
        actual_customers = set(visited_customers)
        missing = len(expected_customers - actual_customers)
        duplicates = len(visited_customers) - len(actual_customers)
        route_viol = missing + duplicates

        # Check vehicle count constraint
        fleet_viol = max(0, len(route_evals) - self.problem.num_vehicles)

        # Full penalized fitness (§7.4)
        penalized_fitness = (
            total_time
            + self.lambda_cap * total_cap_viol
            + self.lambda_route * (route_viol + fleet_viol)
            + self.lambda_tw * total_tw_viol
        )

        is_feasible = (
            total_cap_viol == 0.0
            and route_viol == 0
            and fleet_viol == 0
            and total_tw_viol == 0.0
        )

        return SolutionEvaluation(
            routes=[ev.route for ev in route_evals],
            route_evaluations=route_evals,
            total_time=total_time,
            total_distance=total_dist,
            total_load=total_load,
            total_capacity_violation=total_cap_viol,
            total_tw_penalty=total_tw_viol,
            route_structure_violations=route_viol + fleet_viol,
            is_feasible=is_feasible,
            unpenalized_cost=total_time,
            penalized_fitness=penalized_fitness
        )
