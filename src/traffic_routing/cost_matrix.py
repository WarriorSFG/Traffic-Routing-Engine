"""All-Pairs Shortest Path (APSP) & Routing Cost Matrix Precomputation.
Implements Chapter 4 of Reference.md (Plan Step 2.1).
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import networkx as nx
import numpy as np

from .graph_generator import RoadNetwork


@dataclass
class CostMatrix:
    """Precomputed travel-time and distance lookups between routing stops S = {v_0} U V_cust."""
    stops: List[int]                     # Ordered node IDs: [0, c_1, c_2, ..., c_n]
    time_matrix: np.ndarray             # C(t) shape (|S|, |S|), time in hours
    distance_matrix: np.ndarray         # Shape (|S|, |S|), distance in km
    paths: Dict[Tuple[int, int], List[int]]  # Shortest path node sequences: (p, q) -> [node_ids]
    sim_time: float

    @property
    def num_stops(self) -> int:
        return len(self.stops)

    def get_time(self, p: int, q: int) -> float:
        """p and q are stop indices in 0..|S|-1."""
        return float(self.time_matrix[p, q])

    def get_distance(self, p: int, q: int) -> float:
        return float(self.distance_matrix[p, q])

    def get_path_nodes(self, p: int, q: int) -> List[int]:
        return self.paths.get((p, q), [self.stops[p], self.stops[q]])


class CostMatrixCalculator:
    """Computes and updates the APSP cost matrix across stops S = {v_0} U V_cust."""

    def __init__(self, road_network: RoadNetwork):
        self.network = road_network
        self.stops = self.network.stops
        self._stop_to_idx = {stop: idx for idx, stop in enumerate(self.stops)}

    def compute(self, dynamic_graph: nx.Graph, sim_time: float = 0.0) -> CostMatrix:
        """Runs multi-source Dijkstra for all stops S in O(|S| * (|E| + |V| log |V|)).
        
        Adheres to Equations 4.1 - 4.2 in Reference.md.
        """
        num_stops = len(self.stops)
        time_matrix = np.zeros((num_stops, num_stops), dtype=np.float64)
        dist_matrix = np.zeros((num_stops, num_stops), dtype=np.float64)
        paths: Dict[Tuple[int, int], List[int]] = {}

        for p_idx, src_node in enumerate(self.stops):
            try:
                # Dijkstra computing shortest paths based on dynamic weight (travel time)
                lengths, path_dict = nx.single_source_dijkstra(
                    dynamic_graph, source=src_node, weight="weight"
                )
            except nx.NetworkXNoPath:
                lengths, path_dict = {}, {}

            for q_idx, dst_node in enumerate(self.stops):
                if p_idx == q_idx:
                    time_matrix[p_idx, q_idx] = 0.0
                    dist_matrix[p_idx, q_idx] = 0.0
                    paths[(p_idx, q_idx)] = [src_node]
                    continue

                if dst_node in lengths:
                    t_cost = lengths[dst_node]
                    path_nodes = path_dict[dst_node]
                    # Compute distance along this exact shortest-time path
                    d_cost = 0.0
                    for k in range(len(path_nodes) - 1):
                        u, v = path_nodes[k], path_nodes[k + 1]
                        d_cost += dynamic_graph[u][v].get("distance", 0.0)
                else:
                    # In case of disconnected graph due to road closures
                    t_cost = 1e8
                    d_cost = 1e8
                    path_nodes = [src_node, dst_node]

                time_matrix[p_idx, q_idx] = t_cost
                dist_matrix[p_idx, q_idx] = d_cost
                paths[(p_idx, q_idx)] = path_nodes

        return CostMatrix(
            stops=list(self.stops),
            time_matrix=time_matrix,
            distance_matrix=dist_matrix,
            paths=paths,
            sim_time=sim_time
        )

    def has_material_change(
        self, old_matrix: CostMatrix, new_matrix: CostMatrix, threshold: float = 0.05
    ) -> bool:
        """Evaluates Equation 12.1 trigger condition: max |C_pq(t_now) - C_pq(t_last)| > tau."""
        diff = np.abs(new_matrix.time_matrix - old_matrix.time_matrix)
        max_diff = float(np.max(diff))
        return max_diff > threshold
