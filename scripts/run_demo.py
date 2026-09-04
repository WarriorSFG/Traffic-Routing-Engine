"""End-to-End System Demonstration Runner.
Demonstrates the full pipeline:
1. Graph Topology Generation (Delaunay)
2. Dynamic Traffic Congestion Simulation
3. APSP Cost Matrix Precomputation
4. High-Performance C++ Metaheuristic Solvers (GNN vs Classical PSO vs QPSO)
5. Live Dynamic Incident & Re-Routing
"""

import sys
from pathlib import Path
import time

root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir / "src"))

from traffic_routing.config import CongestionConfig, NetworkConfig, PenaltyConfig, SolverConfig, TrafficPreset, VRPConfig
from traffic_routing.congestion_engine import DynamicCongestionEngine
from traffic_routing.cost_matrix import CostMatrixCalculator
from traffic_routing.graph_generator import generate_road_network
from traffic_routing.rerouting_loop import DynamicRerouter
from traffic_routing.solvers import GNNSolver, PSOSolver, QPSOSolver
from traffic_routing.vrp_model import create_vrp_problem


def run_demo():
    print("\n================================================================================")
    print("      QUANTUM-INSPIRED INTELLIGENT TRAFFIC ROUTING ENGINE (SIH 2026)")
    print("                    END-TO-END DEMONSTRATION RUN")
    print("================================================================================\n")

    # 1. Graph Generation (§2)
    print("[PHASE 1] Generating Planar Road Network with Delaunay Triangulation...")
    net_config = NetworkConfig(num_nodes=30, num_customers=15, map_width=100.0, map_height=100.0, seed=42)
    network = generate_road_network(net_config)
    print(f"  [+] Road Network Generated: {network.num_nodes} Nodes, {network.num_edges} Planar Road Links")
    print(f"  [+] Partition: 1 Depot (Node 0), {len(network.customer_ids)} Customer Stops, {len(network.intersection_ids)} Intersections")

    # 2. Dynamic Congestion (§3)
    print("\n[PHASE 2] Simulating Dynamic Morning Rush-Hour Traffic (8:00 AM)...")
    cong_config = CongestionConfig(preset=TrafficPreset.RUSH_HOUR, rush_hour_alpha_max=3.5)
    cong_engine = DynamicCongestionEngine(network, cong_config)
    state = cong_engine.evaluate(t=8.0)
    avg_mult = sum(state.multipliers.values()) / len(state.multipliers)
    max_mult = max(state.multipliers.values())
    print(f"  [+] Traffic Multipliers Computed: Average Congestion = {avg_mult:.2f}x, Peak Hotspot Congestion = {max_mult:.2f}x")

    # 3. Cost Matrix Precomputation (§4)
    print("\n[PHASE 3] Precomputing All-Pairs Shortest Path (APSP) Matrix via Multi-Source Dijkstra...")
    calc = CostMatrixCalculator(network)
    dyn_graph = cong_engine.create_weighted_graph(state)
    cost_matrix = calc.compute(dyn_graph, sim_time=8.0)
    print(f"  [+] APSP Cost Matrix Computed across {cost_matrix.num_stops} routing hubs ({cost_matrix.num_stops}x{cost_matrix.num_stops})")

    # 4. Problem Formulation (§5 & §6)
    print("\n[PHASE 4] Formulating CVRPTW Model with Demands and Time Windows...")
    vrp_config = VRPConfig(vehicle_capacity=100.0, num_vehicles=4)
    problem = create_vrp_problem(cost_matrix, vrp_config, seed=42)
    penalties = PenaltyConfig()
    print(f"  [+] Problem Instantiated: {problem.num_customers} Deliveries, {problem.num_vehicles} Fleet Vehicles, Capacity = {problem.capacity}")

    # 5. Solving with Baseline Solvers vs QPSO (§8, §9, §11)
    print("\n[PHASE 5] Executing Metaheuristic Solvers (High-Performance C++ Core)...")
    
    # GNN
    gnn = GNNSolver(problem, penalties)
    res_gnn = gnn.solve()
    print(f"  [1] Greedy Nearest Neighbor (GNN):")
    print(f"      Fleet Travel Time: {res_gnn.solution.total_time:.2f}h | Distance: {res_gnn.solution.total_distance:.1f}km | Compute: {res_gnn.compute_time_ms:.2f}ms | Fitness: {res_gnn.best_fitness:.2f}")

    # Classical PSO
    pso = PSOSolver(problem, penalties, SolverConfig(swarm_size=40, max_iterations=120, seed=42))
    res_pso = pso.solve()
    print(f"  [2] Classical PSO (Kennedy-Eberhart):")
    print(f"      Fleet Travel Time: {res_pso.solution.total_time:.2f}h | Distance: {res_pso.solution.total_distance:.1f}km | Compute: {res_pso.compute_time_ms:.2f}ms | Fitness: {res_pso.best_fitness:.2f}")

    # Quantum-Inspired PSO
    qpso = QPSOSolver(problem, penalties, SolverConfig(swarm_size=40, max_iterations=120, seed=42))
    res_qpso = qpso.solve()
    print(f"  [3] Quantum-Inspired PSO (Delta-Potential Well QPSO):")
    print(f"      Fleet Travel Time: {res_qpso.solution.total_time:.2f}h | Distance: {res_qpso.solution.total_distance:.1f}km | Compute: {res_qpso.compute_time_ms:.2f}ms | Fitness: {res_qpso.best_fitness:.2f}")

    time_diff = ((res_gnn.solution.total_time - res_qpso.solution.total_time) / res_gnn.solution.total_time) * 100.0
    print(f"\n  >> QPSO Travel Time Savings vs GNN Baseline: {time_diff:.2f}%")
    print(f"  >> QPSO Decoded Vehicle Tours:")
    for k, r in enumerate(res_qpso.solution.routes):
        print(f"     Vehicle {k+1}: {' -> '.join(str(s) for s in r)}")

    # 6. Live Dynamic Re-Routing (§12)
    print("\n[PHASE 6] Demonstrating Live Dynamic Re-Routing under Road Incident...")
    rerouter = DynamicRerouter(network, cong_engine, problem, penalties)
    rerouter.set_initial_routes(res_qpso.solution.routes)
    
    # Simulate step with incident
    event = rerouter.step_simulation(dt=0.25, incident_occurred=True)
    if event:
        print(f"  [+] Incident Detected at sim time {event.sim_time:.2f}h ({event.trigger_reason})")
        print(f"  [+] Warm-Started QPSO Re-Optimization Completed in {event.compute_time_ms:.2f} ms")
        print(f"  [+] Fleet Re-Routed Successfully!")

    print("\n================================================================================")
    print("                    DEMONSTRATION COMPLETED SUCCESSFULLY")
    print("================================================================================\n")


if __name__ == "__main__":
    run_demo()
