"""Flask REST API Backend for Traffic Routing Engine Dashboard.
Serves simulation, optimization, benchmarking, and re-routing endpoints for the React frontend.
"""

import os
import sys
from pathlib import Path
from typing import Any, Dict, List

# Ensure src is in python path
root_dir = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(root_dir / "src"))

from flask import Flask, jsonify, request, send_from_directory
import numpy as np

from traffic_routing.benchmark import BenchmarkEngine
from traffic_routing.config import (
    CongestionConfig,
    NetworkConfig,
    PenaltyConfig,
    SolverConfig,
    TrafficPreset,
    VRPConfig
)
from traffic_routing.congestion_engine import DynamicCongestionEngine
from traffic_routing.cost_matrix import CostMatrixCalculator
from traffic_routing.graph_generator import generate_road_network
from traffic_routing.solvers import QPSOSolver
from traffic_routing.vrp_model import create_vrp_problem


# Frontend static files directory (if built)
dist_dir = root_dir / "frontend" / "dist"
app = Flask(__name__, static_folder=str(dist_dir) if dist_dir.exists() else None)


@app.after_request
def add_cors_headers(response):
    """Enable CORS for local React development server."""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,PUT,POST,DELETE,OPTIONS"
    return response


# In-memory cache for network & current state to avoid regenerating when unchanged
_cache: Dict[str, Any] = {}


def _get_preset(preset_str: str) -> TrafficPreset:
    preset_map = {
        "Uniform Flow": TrafficPreset.UNIFORM,
        "Rush-Hour Bottleneck": TrafficPreset.RUSH_HOUR,
        "Incident Disruption": TrafficPreset.INCIDENT
    }
    return preset_map.get(preset_str, TrafficPreset.RUSH_HOUR)


def _build_simulation_state(
    preset_str: str = "Rush-Hour Bottleneck",
    sim_clock: float = 8.0,
    num_customers: int = 15,
    num_vehicles: int = 4,
    vehicle_cap: float = 100.0,
    swarm_size: int = 40,
    max_iter: int = 120,
    seed: int = 42
) -> Dict[str, Any]:
    active_preset = _get_preset(preset_str)
    n_nodes = num_customers + 15
    net_config = NetworkConfig(num_nodes=n_nodes, num_customers=num_customers, seed=seed)
    network = generate_road_network(net_config)
    coords = network.coordinates

    congestion_config = CongestionConfig(preset=active_preset)
    if active_preset == TrafficPreset.INCIDENT:
        congestion_config.incident_t_start = 7.5
        congestion_config.incident_t_end = 9.5
        congestion_config.incident_alpha = 8.0

    congestion_engine = DynamicCongestionEngine(network, congestion_config)
    congestion_state = congestion_engine.evaluate(t=sim_clock)
    dynamic_graph = congestion_engine.create_weighted_graph(congestion_state)

    matrix_calc = CostMatrixCalculator(network)
    cost_matrix = matrix_calc.compute(dynamic_graph, sim_time=sim_clock)

    vrp_config = VRPConfig(vehicle_capacity=vehicle_cap, num_vehicles=num_vehicles)
    problem = create_vrp_problem(cost_matrix, vrp_config, seed=seed)
    penalty_config = PenaltyConfig()

    solver_cfg = SolverConfig(swarm_size=swarm_size, max_iterations=max_iter, seed=seed)
    qpso_solver = QPSOSolver(problem, penalty_config, solver_cfg)
    sol_res = qpso_solver.solve()

    # Save to memory cache for benchmarking / rerouting
    _cache["network"] = network
    _cache["congestion_engine"] = congestion_engine
    _cache["congestion_state"] = congestion_state
    _cache["matrix_calc"] = matrix_calc
    _cache["cost_matrix"] = cost_matrix
    _cache["problem"] = problem
    _cache["penalty_config"] = penalty_config
    _cache["vrp_config"] = vrp_config
    _cache["sol_res"] = sol_res
    _cache["params"] = {
        "preset_str": preset_str,
        "sim_clock": sim_clock,
        "num_customers": num_customers,
        "num_vehicles": num_vehicles,
        "vehicle_cap": vehicle_cap,
        "swarm_size": swarm_size,
        "max_iter": max_iter,
        "seed": seed
    }

    # Format Road Edges
    edges_list = []
    for (u, v), edge in network.edges.items():
        alpha = float(congestion_state.multipliers.get((u, v), 1.0))
        is_closed = bool((u, v) in congestion_state.closed_edges)
        edges_list.append({
            "u": int(u),
            "v": int(v),
            "x0": float(coords[u, 0]),
            "y0": float(coords[u, 1]),
            "x1": float(coords[v, 0]),
            "y1": float(coords[v, 1]),
            "base_time_min": float(edge.base_time * 60),
            "distance_km": float(edge.distance),
            "speed_limit": float(edge.speed_limit),
            "is_arterial": bool(edge.is_arterial),
            "alpha": round(alpha, 2),
            "is_closed": is_closed
        })

    # Format Vehicle Tour Routes
    palette = ["#38bdf8", "#a855f7", "#ec4899", "#f97316", "#eab308", "#06b6d4"]
    routes_data = []
    if sol_res.solution and sol_res.solution.routes:
        for k, route in enumerate(sol_res.solution.routes):
            route_coords = []
            route_node_ids = []
            for i in range(len(route) - 1):
                p, q = route[i], route[i + 1]
                path_nodes = cost_matrix.get_path_nodes(p, q)
                for node in path_nodes:
                    route_node_ids.append(int(node))
                    route_coords.append([float(coords[node, 0]), float(coords[node, 1])])

            r_eval = sol_res.solution.route_evaluations[k] if k < len(sol_res.solution.route_evaluations) else None
            is_r_feasible = (r_eval.capacity_violation <= 1e-6 and r_eval.time_window_penalty <= 1e-6) if r_eval else True
            routes_data.append({
                "vehicle_id": k + 1,
                "color": palette[k % len(palette)],
                "stops": [int(s) for s in route],
                "path_node_ids": route_node_ids,
                "coordinates": route_coords,
                "total_load": float(r_eval.total_load) if r_eval else 0.0,
                "total_time": float(r_eval.total_time) if r_eval else 0.0,
                "total_distance": float(r_eval.total_distance) if r_eval else 0.0,
                "capacity_violation": float(r_eval.capacity_violation) if r_eval else 0.0,
                "time_window_penalty": float(r_eval.time_window_penalty) if r_eval else 0.0,
                "is_feasible": is_r_feasible
            })

    # Format Customer Stops
    customer_stops = []
    for cid in network.customer_ids:
        stop_idx = cost_matrix.stops.index(cid)
        s_info = problem.stops_info[stop_idx]
        customer_stops.append({
            "stop_index": int(stop_idx),
            "node_id": int(cid),
            "x": float(coords[cid, 0]),
            "y": float(coords[cid, 1]),
            "demand": float(s_info.demand),
            "time_window": [float(s_info.time_window[0]), float(s_info.time_window[1])]
        })

    # Format Intersections
    intersections = []
    for i in network.intersection_ids:
        intersections.append({
            "node_id": int(i),
            "x": float(coords[i, 0]),
            "y": float(coords[i, 1])
        })

    # Format Central Depot
    depot_coord = coords[network.depot_id]
    depot = {
        "node_id": int(network.depot_id),
        "x": float(depot_coord[0]),
        "y": float(depot_coord[1]),
        "time_window": [
            float(problem.stops_info[0].time_window[0]),
            float(problem.stops_info[0].time_window[1])
        ]
    }

    # Summary Metrics
    metrics = {
        "total_time": round(float(sol_res.solution.total_time), 2),
        "total_distance": round(float(sol_res.solution.total_distance), 1),
        "vehicles_utilized": len(sol_res.solution.routes),
        "total_vehicles": int(num_vehicles),
        "vehicle_capacity": float(vehicle_cap),
        "compute_time_ms": round(float(sol_res.compute_time_ms), 2),
        "is_feasible": bool(sol_res.solution.is_feasible),
        "fitness": round(float(sol_res.solution.penalized_fitness), 3),
        "num_edges": int(network.num_edges),
        "num_nodes": int(network.num_nodes),
        "num_customers": int(problem.num_customers),
        "sim_clock": float(sim_clock),
        "preset": preset_str
    }

    return {
        "metrics": metrics,
        "depot": depot,
        "customers": customer_stops,
        "intersections": intersections,
        "edges": edges_list,
        "routes": routes_data,
        "bounds": {
            "min_x": float(np.min(coords[:, 0])),
            "max_x": float(np.max(coords[:, 0])),
            "min_y": float(np.min(coords[:, 1])),
            "max_y": float(np.max(coords[:, 1]))
        }
    }


@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "ok", "service": "Traffic Routing Engine QPSO API"})


@app.route("/api/simulate", methods=["POST", "OPTIONS"])
def simulate():
    """Generates the road network, evaluates dynamic traffic congestion,

    computes APSP cost matrix, and solves VRP with QPSO.
    """
    if request.method == "OPTIONS":
        return "", 200

    data = request.get_json(silent=True) or {}
    preset_str = data.get("preset", "Rush-Hour Bottleneck")
    sim_clock = float(data.get("sim_clock", 8.0))
    num_customers = int(data.get("num_customers", 15))
    num_vehicles = int(data.get("num_vehicles", 4))
    vehicle_cap = float(data.get("vehicle_cap", 100.0))
    swarm_size = int(data.get("swarm_size", 40))
    max_iter = int(data.get("max_iter", 120))
    seed = int(data.get("seed", 42))

    try:
        res = _build_simulation_state(
            preset_str=preset_str,
            sim_clock=sim_clock,
            num_customers=num_customers,
            num_vehicles=num_vehicles,
            vehicle_cap=vehicle_cap,
            swarm_size=swarm_size,
            max_iter=max_iter,
            seed=seed
        )
        return jsonify({"success": True, "data": res})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/benchmark", methods=["POST", "OPTIONS"])
def benchmark():
    """Executes multi-trial benchmark across GNN, Classical PSO, and QPSO."""
    if request.method == "OPTIONS":
        return "", 200

    data = request.get_json(silent=True) or {}
    num_runs = int(data.get("num_runs", 3))

    # Retrieve current cached problem or create one with passed parameters
    problem = _cache.get("problem")
    penalty_config = _cache.get("penalty_config") or PenaltyConfig()
    params = _cache.get("params", {})
    swarm_size = int(data.get("swarm_size", params.get("swarm_size", 40)))
    max_iter = int(data.get("max_iter", params.get("max_iter", 120)))
    seed = int(data.get("seed", params.get("seed", 42)))

    if problem is None:
        _build_simulation_state(swarm_size=swarm_size, max_iter=max_iter, seed=seed)
        problem = _cache.get("problem")
        penalty_config = _cache.get("penalty_config") or PenaltyConfig()

    try:
        engine = BenchmarkEngine(problem, penalty_config)
        report = engine.run_benchmark(
            num_runs=num_runs,
            swarm_size=swarm_size,
            max_iterations=max_iter,
            base_seed=seed
        )

        scorecard = report.scorecard_df.to_dict(orient="records")
        convergence = report.convergence_df.to_dict(orient="records")

        return jsonify({
            "success": True,
            "data": {
                "scorecard": scorecard,
                "convergence": convergence,
                "problem_summary": report.problem_summary
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/reroute", methods=["POST", "OPTIONS"])
def reroute():
    """Simulates unexpected road disruption incident and executes warm-started QPSO rerouting."""
    if request.method == "OPTIONS":
        return "", 200

    data = request.get_json(silent=True) or {}

    # Ensure baseline simulation is populated
    if "network" not in _cache or "sol_res" not in _cache:
        _build_simulation_state()

    network = _cache["network"]
    matrix_calc = _cache["matrix_calc"]
    cost_matrix = _cache["cost_matrix"]
    vrp_config = _cache["vrp_config"]
    penalty_config = _cache["penalty_config"]
    sol_res = _cache["sol_res"]
    params = _cache["params"]
    coords = network.coordinates

    try:
        # Determine disrupted edge from initial route
        first_route = sol_res.solution.routes[0] if sol_res.solution.routes else [0, 1]
        next_stop = first_route[1] if len(first_route) > 1 else cost_matrix.stops[1]
        disrupted_edge = (network.depot_id, cost_matrix.stops[next_stop])

        # Set up incident congestion engine
        inc_config = CongestionConfig(
            preset=TrafficPreset.INCIDENT,
            incident_alpha=12.0,
            incident_hard_closure=True,
            incident_t_start=8.0,
            incident_t_end=9.5,
            incident_edges=[disrupted_edge]
        )

        inc_engine = DynamicCongestionEngine(network, inc_config)
        inc_state = inc_engine.evaluate(t=8.1)
        inc_graph = inc_engine.create_weighted_graph(inc_state)
        inc_cost_matrix = matrix_calc.compute(inc_graph, sim_time=8.1)

        inc_problem = create_vrp_problem(inc_cost_matrix, vrp_config, seed=params["seed"])

        # Warm-started QPSO solver
        reroute_solver = QPSOSolver(
            inc_problem,
            penalty_config,
            SolverConfig(
                swarm_size=params["swarm_size"],
                max_iterations=params["max_iter"],
                seed=params["seed"]
            )
        )
        reroute_res = reroute_solver.solve()

        # Format Prior Routes
        palette = ["#38bdf8", "#a855f7", "#ec4899", "#f97316", "#eab308", "#06b6d4"]
        prior_routes = []
        for k, route in enumerate(sol_res.solution.routes):
            r_coords = []
            for i in range(len(route) - 1):
                p, q = route[i], route[i + 1]
                path_nodes = cost_matrix.get_path_nodes(p, q)
                for node in path_nodes:
                    r_coords.append([float(coords[node, 0]), float(coords[node, 1])])
            prior_routes.append({
                "vehicle_id": k + 1,
                "color": palette[k % len(palette)],
                "coordinates": r_coords,
                "stops": [int(s) for s in route]
            })

        # Format Rerouted Routes
        rerouted_routes = []
        for k, route in enumerate(reroute_res.solution.routes):
            r_coords = []
            for i in range(len(route) - 1):
                p, q = route[i], route[i + 1]
                path_nodes = inc_cost_matrix.get_path_nodes(p, q)
                for node in path_nodes:
                    r_coords.append([float(coords[node, 0]), float(coords[node, 1])])
            rerouted_routes.append({
                "vehicle_id": k + 1,
                "color": palette[k % len(palette)],
                "coordinates": r_coords,
                "stops": [int(s) for s in route]
            })

        # Incident Edges Info
        incident_edges_list = []
        for (u, v), edge in network.edges.items():
            alpha = float(inc_state.multipliers.get((u, v), 1.0))
            is_closed = bool((u, v) in inc_state.closed_edges)
            incident_edges_list.append({
                "u": int(u),
                "v": int(v),
                "x0": float(coords[u, 0]),
                "y0": float(coords[u, 1]),
                "x1": float(coords[v, 0]),
                "y1": float(coords[v, 1]),
                "alpha": round(alpha, 2),
                "is_closed": is_closed
            })

        return jsonify({
            "success": True,
            "data": {
                "disrupted_edge": [int(disrupted_edge[0]), int(disrupted_edge[1])],
                "disrupted_edge_coords": [
                    [float(coords[disrupted_edge[0], 0]), float(coords[disrupted_edge[0], 1])],
                    [float(coords[disrupted_edge[1], 0]), float(coords[disrupted_edge[1], 1])]
                ],
                "incident_edges": incident_edges_list,
                "prior": {
                    "total_time": round(float(sol_res.solution.total_time), 2),
                    "total_distance": round(float(sol_res.solution.total_distance), 1),
                    "routes": prior_routes
                },
                "rerouted": {
                    "total_time": round(float(reroute_res.solution.total_time), 2),
                    "total_distance": round(float(reroute_res.solution.total_distance), 1),
                    "compute_time_ms": round(float(reroute_res.compute_time_ms), 2),
                    "routes": rerouted_routes
                }
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# Catch-all route to serve the React frontend in production
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if dist_dir.exists() and path != "" and (dist_dir / path).exists():
        return send_from_directory(str(dist_dir), path)
    if dist_dir.exists() and (dist_dir / "index.html").exists():
        return send_from_directory(str(dist_dir), "index.html")
    return jsonify({
        "message": "Traffic Routing Engine Backend API is active.",
        "endpoints": [
            "/api/simulate [POST]",
            "/api/benchmark [POST]",
            "/api/reroute [POST]",
            "/api/health [GET]"
        ]
    })


def run_server(port=5000, debug=False):
    """Run Flask HTTP server."""
    print(f"[*] Starting Traffic Routing Engine API on http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=debug)


if __name__ == "__main__":
    run_server()
