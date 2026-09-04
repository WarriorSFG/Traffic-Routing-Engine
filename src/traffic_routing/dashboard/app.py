"""Interactive Streamlit & Plotly Dashboard for Traffic Routing Engine.
Implements Phase 5 (Deliverables 4 & 5).
"""

import sys
from pathlib import Path
import time

# Ensure src is in python path
root_dir = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(root_dir / "src"))

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from traffic_routing.benchmark import BenchmarkEngine
from traffic_routing.config import (
    CongestionConfig,
    NetworkConfig,
    PenaltyConfig,
    SolverConfig,
    TrafficPreset
)
from traffic_routing.congestion_engine import DynamicCongestionEngine
from traffic_routing.cost_matrix import CostMatrixCalculator
from traffic_routing.graph_generator import NodeType, generate_road_network
from traffic_routing.rerouting_loop import DynamicRerouter
from traffic_routing.solvers import GNNSolver, PSOSolver, QPSOSolver
from traffic_routing.vrp_model import create_vrp_problem


# Page Configuration
st.set_page_config(
    page_title="Traffic Routing Engine — QPSO Optimizer",
    page_icon="🚗",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling (Sleek Dark Theme with Modern Glassmorphism Accents)
st.markdown("""
<style>
    .main { background-color: #0e1117; }
    .stMetric {
        background-color: #1e222d;
        border: 1px solid #2e3646;
        border-radius: 8px;
        padding: 12px;
    }
    .metric-card {
        background: linear-gradient(135deg, #1e2330 0%, #151922 100%);
        border: 1px solid #313b4d;
        border-radius: 10px;
        padding: 16px;
        color: #e0e6ed;
    }
    .header-banner {
        background: linear-gradient(90deg, #102a43 0%, #1c3d5a 50%, #0b3c5d 100%);
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 24px;
        border-left: 6px solid #00d4ff;
    }
</style>
""", unsafe_allow_html=True)


# Top Banner
st.markdown("""
<div class="header-banner">
    <h1 style="color: #ffffff; margin: 0; font-size: 2.2rem;">🚗 Quantum-Inspired Traffic Route Optimization</h1>
    <p style="color: #a0aec0; margin: 6px 0 0 0; font-size: 1.05rem;">
        SIH 2026 Problem Statement 26137 — High-Performance C++ QPSO Engine vs. Classical Metaheuristics & Live Dynamic Re-Routing
    </p>
</div>
""", unsafe_allow_html=True)


# Sidebar Controls
st.sidebar.header("⚙️ Simulation Settings")

preset_choice = st.sidebar.selectbox(
    "Traffic Congestion Preset",
    ["Rush-Hour Bottleneck", "Incident Disruption", "Uniform Flow"],
    index=0
)
preset_map = {
    "Uniform Flow": TrafficPreset.UNIFORM,
    "Rush-Hour Bottleneck": TrafficPreset.RUSH_HOUR,
    "Incident Disruption": TrafficPreset.INCIDENT
}
active_preset = preset_map[preset_choice]

sim_clock = st.sidebar.slider("Simulation Clock Time", min_value=6.0, max_value=12.0, value=8.0, step=0.25, format="%.2f hrs")

st.sidebar.subheader("Network & Fleet")
num_customers = st.sidebar.slider("Customer Stops", min_value=5, max_value=35, value=15, step=1)
num_vehicles = st.sidebar.slider("Fleet Vehicles", min_value=2, max_value=6, value=4, step=1)
vehicle_cap = st.sidebar.number_input("Vehicle Capacity", min_value=50.0, max_value=250.0, value=100.0, step=10.0)

st.sidebar.subheader("Optimization Parameters")
swarm_size = st.sidebar.slider("Swarm Size (M)", min_value=10, max_value=100, value=40, step=10)
max_iter = st.sidebar.slider("Max Iterations", min_value=20, max_value=300, value=120, step=20)
random_seed = st.sidebar.number_input("Random Seed", value=42, step=1)


# Cache Network Generation and APSP Precomputation
@st.cache_resource
def get_cached_network(n_cust, seed):
    n_nodes = n_cust + 15
    config = NetworkConfig(num_nodes=n_nodes, num_customers=n_cust, seed=seed)
    return generate_road_network(config)

network = get_cached_network(num_customers, random_seed)

# Congestion Engine & Dynamic Cost Matrix
congestion_config = CongestionConfig(preset=active_preset)
if active_preset == TrafficPreset.INCIDENT:
    # Set incident active around current clock
    congestion_config.incident_t_start = 7.5
    congestion_config.incident_t_end = 9.5
    congestion_config.incident_alpha = 8.0

congestion_engine = DynamicCongestionEngine(network, congestion_config)
congestion_state = congestion_engine.evaluate(t=sim_clock)
dynamic_graph = congestion_engine.create_weighted_graph(congestion_state)

matrix_calc = CostMatrixCalculator(network)
cost_matrix = matrix_calc.compute(dynamic_graph, sim_time=sim_clock)

# VRP Problem Instance
from traffic_routing.config import VRPConfig
vrp_config = VRPConfig(vehicle_capacity=vehicle_cap, num_vehicles=num_vehicles)
problem = create_vrp_problem(cost_matrix, vrp_config, seed=random_seed)
penalty_config = PenaltyConfig()


# Tabs
tab_map, tab_benchmark, tab_reroute = st.tabs([
    "🗺️ Network & Route Map",
    "📊 Metaheuristic Benchmarking",
    "⚡ Live Dynamic Re-Routing Demo"
])


def build_network_plotly_figure(network, congestion_state, solution=None):
    """Constructs a high-performance Plotly map with colored road congestion and route overlays."""
    fig = go.Figure()
    coords = network.coordinates

    # 1. Plot Road Segments (Color-coded by congestion multiplier alpha_ij)
    # Green = free flow (alpha ~ 1.0), Yellow/Orange = moderate (alpha ~ 2-3), Red = severe (alpha > 4)
    edge_x, edge_y, edge_colors = [], [], []
    
    for (u, v), edge in network.edges.items():
        x0, y0 = coords[u]
        x1, y1 = coords[v]
        alpha = congestion_state.multipliers.get((u, v), 1.0)
        is_closed = (u, v) in congestion_state.closed_edges

        if is_closed:
            color = "#ff0055"
            width = 3.5
            dash = "dot"
        elif alpha > 3.0:
            color = "#ef4444"  # Red
            width = 3.0
            dash = "solid"
        elif alpha > 1.5:
            color = "#f59e0b"  # Amber
            width = 2.2
            dash = "solid"
        else:
            color = "#10b981"  # Green
            width = 1.6
            dash = "solid"

        fig.add_trace(go.Scatter(
            x=[x0, x1, None],
            y=[y0, y1, None],
            mode="lines",
            line=dict(width=width, color=color, dash=dash),
            hoverinfo="text",
            text=f"Road ({u} - {v})<br>Base Time: {edge.base_time*60:.1f}m<br>Congestion: {alpha:.2f}x",
            showlegend=False
        ))

    # 2. Overlay Solution Routes if available
    palette = ["#38bdf8", "#a855f7", "#ec4899", "#f97316", "#eab308", "#06b6d4"]
    if solution and solution.routes:
        for k, route in enumerate(solution.routes):
            color = palette[k % len(palette)]
            route_coords_x = []
            route_coords_y = []
            for i in range(len(route) - 1):
                p, q = route[i], route[i + 1]
                path_nodes = cost_matrix.get_path_nodes(p, q)
                for node in path_nodes:
                    route_coords_x.append(coords[node, 0])
                    route_coords_y.append(coords[node, 1])

            fig.add_trace(go.Scatter(
                x=route_coords_x,
                y=route_coords_y,
                mode="lines",
                line=dict(width=4.5, color=color),
                name=f"Vehicle {k+1} Tour",
                hoverinfo="skip"
            ))

    # 3. Plot Intersections
    int_x = [coords[i, 0] for i in network.intersection_ids]
    int_y = [coords[i, 1] for i in network.intersection_ids]
    fig.add_trace(go.Scatter(
        x=int_x,
        y=int_y,
        mode="markers",
        marker=dict(size=6, color="#64748b", symbol="circle"),
        name="Intersections",
        hoverinfo="text",
        text=[f"Intersection {i}" for i in network.intersection_ids]
    ))

    # 4. Plot Customer Demand Points
    cust_x = [coords[i, 0] for i in network.customer_ids]
    cust_y = [coords[i, 1] for i in network.customer_ids]
    cust_text = []
    for cid in network.customer_ids:
        stop_idx = cost_matrix.stops.index(cid)
        s_info = problem.stops_info[stop_idx]
        cust_text.append(f"Customer Stop {stop_idx} (Node {cid})<br>Demand: {s_info.demand:.1f} parcels<br>Window: [{s_info.time_window[0]:.2f}, {s_info.time_window[1]:.2f}] hrs")

    fig.add_trace(go.Scatter(
        x=cust_x,
        y=cust_y,
        mode="markers+text",
        marker=dict(size=14, color="#3b82f6", symbol="square", line=dict(color="#ffffff", width=1.5)),
        text=[str(cost_matrix.stops.index(cid)) for cid in network.customer_ids],
        textposition="top center",
        textfont=dict(color="#ffffff", size=10),
        name="Customer Stops",
        hoverinfo="text",
        hovertext=cust_text
    ))

    # 5. Plot Depot
    depot_coord = coords[network.depot_id]
    fig.add_trace(go.Scatter(
        x=[depot_coord[0]],
        y=[depot_coord[1]],
        mode="markers+text",
        marker=dict(size=20, color="#fbbf24", symbol="star", line=dict(color="#000000", width=1.5)),
        text=["Depot (Hub 0)"],
        textposition="bottom center",
        textfont=dict(color="#fbbf24", size=12),
        name="Central Depot",
        hoverinfo="text",
        hovertext=[f"Central Distribution Depot<br>Operating Hours: [{problem.stops_info[0].time_window[0]:.1f}, {problem.stops_info[0].time_window[1]:.1f}]"]
    ))

    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor="#0e1117",
        plot_bgcolor="#161b22",
        margin=dict(l=10, r=10, t=30, b=10),
        height=620,
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
    )

    return fig


# -------------------------------------------------------------
# TAB 1: Network & Route Map
# -------------------------------------------------------------
with tab_map:
    col_map_top, col_map_btn = st.columns([4, 1])
    with col_map_top:
        st.markdown(f"**Current State:** {preset_choice} at **{sim_clock:.2f} hrs** | Total Network Links: {network.num_edges} | Active Customers: {problem.num_customers}")
    with col_map_btn:
        solve_action = st.button("🚀 Optimize Routes (QPSO)", type="primary", use_container_width=True)

    # State holding latest solution
    if "current_solution" not in st.session_state or solve_action:
        with st.spinner("Executing high-speed C++ Quantum-Inspired PSO..."):
            qpso_solver = QPSOSolver(problem, penalty_config, SolverConfig(swarm_size=swarm_size, max_iterations=max_iter, seed=random_seed))
            st.session_state["current_solution"] = qpso_solver.solve()

    sol_res = st.session_state["current_solution"]

    # Metrics Bar
    m1, m2, m3, m4, m5 = st.columns(5)
    with m1:
        st.metric("Total Travel Time", f"{sol_res.solution.total_time:.2f} hrs")
    with m2:
        st.metric("Total Distance", f"{sol_res.solution.total_distance:.1f} km")
    with m3:
        st.metric("Vehicles Utilized", f"{len(sol_res.solution.routes)} / {num_vehicles}")
    with m4:
        st.metric("Compute Time (C++)", f"{sol_res.compute_time_ms:.2f} ms")
    with m5:
        feas_label = "✅ Feasible" if sol_res.solution.is_feasible else "⚠️ Penalized"
        st.metric("Status", feas_label)

    # Render Map
    map_fig = build_network_plotly_figure(network, congestion_state, solution=sol_res.solution)
    st.plotly_chart(map_fig, use_container_width=True)

    # Detailed Route Breakdown Drawer
    with st.expander("📋 Detailed Vehicle Tour Schedules", expanded=False):
        for k, r_eval in enumerate(sol_res.solution.route_evaluations):
            st.markdown(f"**Vehicle {k+1}:** Tour Path: `{' → '.join(str(s) for s in r_eval.route)}`")
            st.markdown(f"- **Load:** {r_eval.total_load:.1f} / {vehicle_cap:.1f} parcels | **Travel Time:** {r_eval.total_time:.2f} hrs | **Distance:** {r_eval.total_distance:.1f} km")


# -------------------------------------------------------------
# TAB 2: Metaheuristic Benchmarking
# -------------------------------------------------------------
with tab_benchmark:
    st.subheader("Systematic Performance Benchmarking: QPSO vs. Classical PSO vs. GNN")
    st.markdown("Evaluates convergence rate, solution quality, relative gap, and wall-clock execution time.")

    col_b1, col_b2 = st.columns([1, 1])
    with col_b1:
        bench_runs = st.slider("Number of Stochastic Trials (R)", min_value=1, max_value=10, value=3, step=1)
    with col_b2:
        run_bench_btn = st.button("▶️ Execute Benchmark Comparison", type="secondary")

    if "bench_report" not in st.session_state or run_bench_btn:
        with st.spinner("Running C++ multi-trial benchmark across all metaheuristics..."):
            engine = BenchmarkEngine(problem, penalty_config)
            report = engine.run_benchmark(
                num_runs=bench_runs,
                swarm_size=swarm_size,
                max_iterations=max_iter,
                base_seed=random_seed
            )
            st.session_state["bench_report"] = report

    report = st.session_state["bench_report"]

    # Display Scorecard Table (§13.1 - §13.6)
    st.markdown("### 🏆 Performance Scorecard")
    st.dataframe(report.scorecard_df, use_container_width=True)

    # Convergence Curves (Cost vs. Iteration)
    st.markdown("### 📉 Convergence Analysis: Cost vs. Iteration")
    conv_fig = go.Figure()
    conv_df = report.convergence_df

    conv_fig.add_trace(go.Scatter(
        x=conv_df["Iteration"],
        y=conv_df["GNN"],
        mode="lines",
        line=dict(color="#94a3b8", width=2, dash="dash"),
        name="Greedy Nearest Neighbor (GNN)"
    ))
    conv_fig.add_trace(go.Scatter(
        x=conv_df["Iteration"],
        y=conv_df["Classical PSO"],
        mode="lines",
        line=dict(color="#f59e0b", width=2.5),
        name="Classical PSO"
    ))
    conv_fig.add_trace(go.Scatter(
        x=conv_df["Iteration"],
        y=conv_df["Quantum-Inspired PSO (QPSO)"],
        mode="lines",
        line=dict(color="#00d4ff", width=3.5),
        name="Quantum-Inspired PSO (QPSO)"
    ))

    conv_fig.update_layout(
        template="plotly_dark",
        paper_bgcolor="#0e1117",
        plot_bgcolor="#161b22",
        xaxis_title="Iteration Number (t)",
        yaxis_title="Best Fitness F(X)",
        height=450,
        margin=dict(l=20, r=20, t=30, b=20),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
    )
    st.plotly_chart(conv_fig, use_container_width=True)


# -------------------------------------------------------------
# TAB 3: Live Dynamic Re-Routing Demo
# -------------------------------------------------------------
with tab_reroute:
    st.subheader("Live Dynamic Re-Routing Under Traffic Incidents")
    st.markdown("""
    Demonstrates **warm-started real-time path re-optimization** (Chapter 12).
    When an unexpected road disruption occurs, completed delivery legs are frozen, and the swarm re-optimizes remaining customer stops in sub-second time.
    """)

    col_r1, col_r2 = st.columns([2, 1])
    with col_r1:
        st.markdown("**Scenario:** Vehicles are en route at **8:00 AM**. An unexpected accident blocks a key arterial road.")
    with col_r2:
        trigger_incident_btn = st.button("💥 Simulate Road Disruption & Reroute", type="primary")

    if trigger_incident_btn:
        with st.spinner("Injecting disruption and executing warm-started QPSO re-routing..."):
            # Set up incident congestion engine
            inc_config = CongestionConfig(
                preset=TrafficPreset.INCIDENT,
                incident_alpha=12.0,
                incident_hard_closure=True,
                incident_t_start=8.0,
                incident_t_end=9.5
            )
            # Pick an edge used in the initial route
            first_route = sol_res.solution.routes[0] if sol_res.solution.routes else [0, 1]
            disrupted_edge = (network.depot_id, cost_matrix.stops[first_route[1]])
            inc_config.incident_edges = [disrupted_edge]

            inc_engine = DynamicCongestionEngine(network, inc_config)
            inc_state = inc_engine.evaluate(t=8.1)
            inc_graph = inc_engine.create_weighted_graph(inc_state)
            inc_cost_matrix = matrix_calc.compute(inc_graph, sim_time=8.1)

            inc_problem = create_vrp_problem(inc_cost_matrix, vrp_config, seed=random_seed)

            # Warm-started QPSO solver
            reroute_solver = QPSOSolver(inc_problem, penalty_config, SolverConfig(swarm_size=swarm_size, max_iterations=max_iter, seed=random_seed))
            reroute_res = reroute_solver.solve()

            st.success(f"✅ Dynamic Re-Routing Completed in {reroute_res.compute_time_ms:.2f} ms!")

            c_bef, c_aft = st.columns(2)
            with c_bef:
                st.markdown("#### 🚫 Prior Routing (Congested/Blocked)")
                st.markdown(f"- Travel Time: **{sol_res.solution.total_time:.2f} hrs**")
                fig_bef = build_network_plotly_figure(network, inc_state, solution=sol_res.solution)
                st.plotly_chart(fig_bef, use_container_width=True)

            with c_aft:
                st.markdown("#### 🔄 Re-Optimized Routes (Bypassing Disruption)")
                st.markdown(f"- New Travel Time: **{reroute_res.solution.total_time:.2f} hrs**")
                fig_aft = build_network_plotly_figure(network, inc_state, solution=reroute_res.solution)
                st.plotly_chart(fig_aft, use_container_width=True)
