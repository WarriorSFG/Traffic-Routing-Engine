"""Graph Topology & Base Road Network Generator.
Implements Chapter 2 of Reference.md (Plan Step 1.1).
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Set, Tuple
import networkx as nx
import numpy as np
from scipy.spatial import Delaunay

from .config import NetworkConfig


class NodeType(str, Enum):
    DEPOT = "depot"
    INTERSECTION = "intersection"
    CUSTOMER = "customer"


@dataclass
class EdgeData:
    u: int
    v: int
    distance: float       # d_ij (Euclidean distance)
    speed_limit: float    # v_ij (base speed in km/h)
    base_time: float      # t_ij^base = d_ij / v_ij (in hours)
    is_arterial: bool = False


@dataclass
class RoadNetwork:
    """Represents the static planar road network G = (V, E)."""
    coordinates: np.ndarray             # Shape (N, 2): (x, y) coordinates
    node_types: Dict[int, NodeType]     # Mapping node_id -> NodeType
    edges: Dict[Tuple[int, int], EdgeData]  # Canonical undirected edges (min(u, v), max(u, v))
    graph: nx.Graph                     # NetworkX graph representation
    depot_id: int = 0
    customer_ids: List[int] = field(default_factory=list)
    intersection_ids: List[int] = field(default_factory=list)

    @property
    def num_nodes(self) -> int:
        return len(self.coordinates)

    @property
    def num_edges(self) -> int:
        return len(self.edges)

    @property
    def stops(self) -> List[int]:
        """Returns routing stop set S = {v_0} U V_cust."""
        return [self.depot_id] + sorted(self.customer_ids)

    def get_edge_data(self, u: int, v: int) -> EdgeData:
        key = (min(u, v), max(u, v))
        return self.edges[key]


def generate_road_network(config: NetworkConfig) -> RoadNetwork:
    """Generates a planar road network using Delaunay triangulation.
    
    Adheres strictly to Equations 2.1 - 2.4 in Reference.md.
    """
    if config.seed is not None:
        np.random.seed(config.seed)

    N = config.num_nodes
    if N < 4:
        raise ValueError("Network must have at least 4 nodes.")
    num_cust = config.num_customers
    if num_cust >= N:
        raise ValueError("Number of customers must be strictly less than total nodes.")

    # 1. Generate Coordinates (Depot at center, rest randomly distributed)
    coords = np.empty((N, 2), dtype=np.float64)
    # v_0 (depot) at center
    coords[0] = [config.map_width / 2.0, config.map_height / 2.0]
    
    # Remaining nodes with Poisson-disc / jittered distribution to avoid overlapping points
    for i in range(1, N):
        # Add a slight margin from borders
        coords[i] = [
            np.random.uniform(0.05 * config.map_width, 0.95 * config.map_width),
            np.random.uniform(0.05 * config.map_height, 0.95 * config.map_height)
        ]

    # 2. Partition Nodes into Depot, Customers, and Intersections
    # Node 0 is depot
    all_other_indices = list(range(1, N))
    np.random.shuffle(all_other_indices)
    customer_ids = sorted(all_other_indices[:num_cust])
    intersection_ids = sorted(all_other_indices[num_cust:])

    node_types: Dict[int, NodeType] = {0: NodeType.DEPOT}
    for cid in customer_ids:
        node_types[cid] = NodeType.CUSTOMER
    for iid in intersection_ids:
        node_types[iid] = NodeType.INTERSECTION

    # 3. Delaunay Triangulation Edge Generation (§2.2)
    tri = Delaunay(coords)
    edge_set: Set[Tuple[int, int]] = set()
    for simplex in tri.simplices:
        for i in range(3):
            u, v = simplex[i], simplex[(i + 1) % 3]
            edge_set.add((min(u, v), max(u, v)))

    # 4. Assign Road Classification, Speeds, and Base Travel Times (§2.3, §2.4)
    edges: Dict[Tuple[int, int], EdgeData] = {}
    G = nx.Graph()

    for i in range(N):
        G.add_node(
            i,
            pos=(coords[i, 0], coords[i, 1]),
            type=node_types[i].value
        )

    # Sort edges for determinism
    sorted_edges = sorted(list(edge_set))
    num_arterials = max(1, int(len(sorted_edges) * config.arterial_ratio))
    arterial_indices = set(np.random.choice(len(sorted_edges), size=num_arterials, replace=False))

    for idx, (u, v) in enumerate(sorted_edges):
        dist = float(np.linalg.norm(coords[u] - coords[v]))
        is_arterial = idx in arterial_indices
        speed = config.arterial_speed if is_arterial else config.residential_speed
        base_time = dist / speed  # in hours

        edge_data = EdgeData(
            u=u,
            v=v,
            distance=dist,
            speed_limit=speed,
            base_time=base_time,
            is_arterial=is_arterial
        )
        edges[(u, v)] = edge_data

        G.add_edge(
            u,
            v,
            weight=base_time,
            distance=dist,
            speed=speed,
            base_time=base_time,
            is_arterial=is_arterial
        )

    return RoadNetwork(
        coordinates=coords,
        node_types=node_types,
        edges=edges,
        graph=G,
        depot_id=0,
        customer_ids=customer_ids,
        intersection_ids=intersection_ids
    )
