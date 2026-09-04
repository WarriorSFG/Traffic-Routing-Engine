"""Random-Key Continuous Encoding & Route Splitting Decoder.
Implements Chapter 10 of Reference.md (Plan Step 4.1).
"""

from typing import List
import numpy as np

from .vrp_model import VRPProblem


class RandomKeyDecoder:
    """Decodes continuous particle position X in [0, 1]^D into valid VRP routes."""

    def __init__(self, problem: VRPProblem):
        self.problem = problem
        self.dim = problem.num_customers

    def decode_sequence(self, keys: np.ndarray) -> List[int]:
        """Extracts customer visitation permutation via argsort (§10.2).
        
        Indices map to customer stop indices (1..n).
        """
        keys_arr = np.asarray(keys, dtype=np.float64)
        if len(keys_arr) != self.dim:
            raise ValueError(f"Expected key vector of dimension {self.dim}, got {len(keys_arr)}")
        # argsort gives 0-indexed ranks; add 1 to map to customer stop indices (1..n)
        perm = (np.argsort(keys_arr) + 1).tolist()
        return perm

    def split_into_routes(self, sequence: List[int]) -> List[List[int]]:
        """Greedy capacity-based route splitting algorithm (§10.3).
        
        Splits customer permutation into vehicle tours starting and ending at depot 0.
        """
        routes: List[List[int]] = []
        current_route: List[int] = [0]
        current_load = 0.0
        capacity = self.problem.capacity

        for cust_idx in sequence:
            demand = self.problem.stops_info[cust_idx].demand
            if current_load + demand <= capacity:
                current_route.append(cust_idx)
                current_load += demand
            else:
                # Close current route
                current_route.append(0)
                routes.append(current_route)
                # Open new vehicle route
                current_route = [0, cust_idx]
                current_load = demand

        # Close final route
        if len(current_route) > 1:
            current_route.append(0)
            routes.append(current_route)

        return routes

    def decode(self, keys: np.ndarray) -> List[List[int]]:
        """Full decode: Continuous position -> Permutation -> Decoded vehicle routes."""
        seq = self.decode_sequence(keys)
        return self.split_into_routes(seq)
