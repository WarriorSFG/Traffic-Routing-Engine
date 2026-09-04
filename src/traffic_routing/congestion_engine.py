"""Dynamic Congestion Engine.
Implements Chapter 3 of Reference.md (Plan Step 1.2).
"""

from dataclasses import dataclass, field
import math
from typing import Dict, List, Optional, Set, Tuple
import networkx as nx
import numpy as np

from .config import CongestionConfig, TrafficPreset
from .graph_generator import RoadNetwork


@dataclass
class CongestionState:
    """Contains calculated congestion multipliers and dynamic edge weights for time t."""
    sim_time: float
    preset: TrafficPreset
    multipliers: Dict[Tuple[int, int], float]       # (u, v) -> alpha_ij(t)
    dynamic_weights: Dict[Tuple[int, int], float]   # (u, v) -> w_ij(t)
    closed_edges: Set[Tuple[int, int]]              # Edges with hard closure (w = inf)
    hotspots: List[int] = field(default_factory=list)


class DynamicCongestionEngine:
    """Computes time-varying edge weights w_ij(t) = t_ij^base * alpha_ij(t)."""

    def __init__(self, road_network: RoadNetwork, config: CongestionConfig):
        self.network = road_network
        self.config = config
        self._rng = np.random.default_rng(config.seed if hasattr(config, "seed") and config.seed is not None else 42)
        self._hotspots: List[int] = self._identify_hotspots(config.rush_hour_hotspot_count)
        self._hotspot_distances: Dict[int, Dict[int, float]] = self._precompute_hotspot_distances()

    def _identify_hotspots(self, count: int) -> List[int]:
        """Identifies top high-degree intersections as rush-hour bottleneck hotspots."""
        # Consider all nodes except depot if possible, or high degree intersections
        degrees = dict(self.network.graph.degree())
        # Sort by degree descending
        sorted_nodes = sorted(degrees.keys(), key=lambda n: degrees[n], reverse=True)
        # Prefer intersections/nodes with highest degree
        hotspots = sorted_nodes[:max(1, count)]
        return hotspots

    def _precompute_hotspot_distances(self) -> Dict[int, Dict[int, float]]:
        """Precomputes base shortest path distances from all nodes to each hotspot."""
        hotspot_dists = {}
        for h in self._hotspots:
            # Distance using Euclidean distance d_ij
            lengths = nx.single_source_dijkstra_path_length(
                self.network.graph, source=h, weight="distance"
            )
            hotspot_dists[h] = lengths
        return hotspot_dists

    def evaluate(self, t: float, preset_override: Optional[TrafficPreset] = None) -> CongestionState:
        """Evaluates traffic congestion across the entire network at simulation time t.
        
        Follows Equations 3.1 - 3.4 in Reference.md.
        """
        preset = preset_override or self.config.preset
        multipliers: Dict[Tuple[int, int], float] = {}
        dynamic_weights: Dict[Tuple[int, int], float] = {}
        closed_edges: Set[Tuple[int, int]] = set()

        # Handle Preset 2 temporal envelope (§3.3)
        rush_sigma = 0.0
        if preset == TrafficPreset.RUSH_HOUR:
            t_start = self.config.rush_hour_t_start
            t_end = self.config.rush_hour_t_end
            if t_start <= t <= t_end:
                # Raised-cosine envelope: 0.5 * [1 - cos(2 * pi * (t - t_start) / (t_end - t_start))]
                rush_sigma = 0.5 * (1.0 - math.cos(2.0 * math.pi * (t - t_start) / (t_end - t_start)))
            else:
                rush_sigma = 0.0

        # Incident active check (§3.4)
        incident_active = (
            preset == TrafficPreset.INCIDENT and
            self.config.incident_t_start <= t <= self.config.incident_t_end
        )
        incident_edge_set = {
            (min(u, v), max(u, v)) for u, v in self.config.incident_edges
        }

        # If incident edges are not specified, select default ones (e.g. connected to depot or first arterial)
        if preset == TrafficPreset.INCIDENT and not incident_edge_set:
            # Pick first arterial or first edge connected to depot
            depot_edges = [
                (min(u, v), max(u, v))
                for u, v in self.network.edges.keys()
                if u == self.network.depot_id or v == self.network.depot_id
            ]
            if depot_edges:
                incident_edge_set.add(depot_edges[0])

        for (u, v), edge in self.network.edges.items():
            base_time = edge.base_time

            # 1. Base multiplier
            if preset == TrafficPreset.UNIFORM:
                # Preset 1: Uniform Flow (§3.2)
                eps = float(self._rng.uniform(0.0, self.config.uniform_eps_max))
                alpha = 1.0 + eps

            elif preset == TrafficPreset.RUSH_HOUR:
                # Preset 2: Rush-Hour Bottleneck (§3.3)
                # Compute delta_ij = min_h (dist_G(i, h) + dist_G(j, h)) / 2
                delta_candidates = []
                for h in self._hotspots:
                    d_i = self._hotspot_distances[h].get(u, 1e6)
                    d_j = self._hotspot_distances[h].get(v, 1e6)
                    delta_candidates.append((d_i + d_j) / 2.0)
                delta_ij = min(delta_candidates) if delta_candidates else 0.0

                alpha = 1.0 + (self.config.rush_hour_alpha_max - 1.0) * math.exp(
                    -delta_ij / self.config.rush_hour_lambda
                ) * rush_sigma

            elif preset == TrafficPreset.INCIDENT:
                # Preset 3: Incident Disruption (§3.4)
                if incident_active and (u, v) in incident_edge_set:
                    if self.config.incident_hard_closure:
                        closed_edges.add((u, v))
                        alpha = 1e9  # Hard closure
                    else:
                        alpha = self.config.incident_alpha
                else:
                    # Light background noise outside incident
                    alpha = 1.0 + float(self._rng.uniform(0.0, self.config.uniform_eps_max))
            else:
                alpha = 1.0

            # Ensure alpha >= 1.0
            alpha = max(1.0, float(alpha))
            multipliers[(u, v)] = alpha
            
            if (u, v) in closed_edges:
                w_ij = float("inf")
            else:
                w_ij = base_time * alpha
            dynamic_weights[(u, v)] = w_ij

        return CongestionState(
            sim_time=t,
            preset=preset,
            multipliers=multipliers,
            dynamic_weights=dynamic_weights,
            closed_edges=closed_edges,
            hotspots=self._hotspots
        )

    def create_weighted_graph(self, state: CongestionState) -> nx.Graph:
        """Returns a NetworkX graph with dynamically updated edge traversal weights."""
        G = self.network.graph.copy()
        for (u, v), w in state.dynamic_weights.items():
            if (u, v) in state.closed_edges or math.isinf(w):
                if G.has_edge(u, v):
                    G.remove_edge(u, v)
            else:
                if G.has_edge(u, v):
                    G[u][v]["weight"] = w
                    G[u][v]["congestion_multiplier"] = state.multipliers.get((u, v), 1.0)
        return G
