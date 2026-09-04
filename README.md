# Quantum-Inspired Intelligent Traffic Route Optimization (QPSO)

[![Python 3.13](https://img.shields.io/badge/python-3.13-blue.svg)](https://www.python.org/)
[![React 19](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![C++20](https://img.shields.io/badge/C%2B%2B-20-green.svg)](https://en.wikipedia.org/wiki/C%2B%2B20)
[![OpenMP](https://img.shields.io/badge/OpenMP-Multi--Core-orange.svg)](https://www.openmp.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An industrial-grade, high-performance metaheuristic optimization framework for dynamic urban vehicle routing and traffic congestion mitigation, designed for **SIH 2026 Problem Statement 26137**.

The platform couples a **high-speed C++20 core solver** accelerated by **OpenMP multi-threading** and exposed via **pybind11** with a synthetic planar road network generator, time-varying dynamic congestion simulation, and an interactive **React.js & Python REST** visualization dashboard.

---

## Architecture Overview

```
Traffic-Routing-Engine/
├── src/
│   ├── cpp/                          # High-Performance C++ Core Solvers
│   │   ├── include/
│   │   │   ├── types.hpp             # ProblemData, Solution, and Convergence structs
│   │   │   ├── encoding.hpp          # Random-key continuous permutation decoder (Ch. 10)
│   │   │   ├── fitness.hpp           # Multi-term penalized fitness evaluator (Ch. 7)
│   │   │   ├── gnn_solver.hpp        # Greedy Nearest Neighbor heuristic (Ch. 8)
│   │   │   ├── pso_solver.hpp        # Classical PSO with OpenMP parallelism (Ch. 9)
│   │   │   └── qpso_solver.hpp       # Delta-potential well Quantum PSO (Ch. 11)
│   │   └── src/
│   │       ├── bindings.cpp          # Pybind11 Python C-extension definitions
│   │       └── main.cpp              # Standalone native C++ CLI (traffic_solver.exe)
│   │
│   └── traffic_routing/              # Python Orchestration & REST API
│       ├── config.py                 # Dataclasses & hyperparameter presets
│       ├── graph_generator.py        # Delaunay triangulation planar topology (Ch. 2)
│       ├── congestion_engine.py      # Dynamic traffic engine & spatio-temporal decay (Ch. 3)
│       ├── cost_matrix.py            # Multi-source Dijkstra APSP matrix (Ch. 4)
│       ├── vrp_model.py              # CVRPTW formulation & constraints (Ch. 5 & 6)
│       ├── fitness.py                # Python mirrored fitness evaluator (Ch. 7)
│       ├── encoding.py               # Python random-key decoder (Ch. 10)
│       ├── rerouting_loop.py         # Live dynamic incident re-routing loop (Ch. 12)
│       ├── benchmark.py              # Statistical comparative benchmark engine (Ch. 13 & 14)
│       ├── solvers/                  # Unified solver bridge & C++ pybind11 integration
│       └── dashboard/
│           └── server.py             # Flask REST API & static web host
├── frontend/                         # Modern React.js Dashboard (Vite + Pure Vanilla CSS)
│   ├── src/
│   │   ├── components/               # NetworkMap, MetricsBar, TourSchedule, BenchmarkView, RerouteView
│   │   ├── App.jsx                   # Master dashboard layout & reactive state
│   │   └── index.css                 # Dark glassmorphism design system & styles
│   ├── package.json
│   └── vite.config.js
├── tests/                            # Comprehensive Pytest test suite (19 unit/integration tests)
├── scripts/
│   ├── build_cpp.py                  # Automated C++ compiler & Pybind11 builder
│   ├── run_web.py                    # Web dashboard launcher
│   ├── run_benchmark.py              # Command-line benchmarking script
│   └── run_demo.py                   # End-to-end demonstration runner
├── traffic_solver.exe                # Native compiled C++ standalone binary
├── requirements.txt                  # Python dependencies
└── README.md
```

---

## Core Algorithms & Mathematical Foundations

### 1. Planar Delaunay Road Topology (Chapter 2)
- Synthetic nodes $V = \{v_0\} \cup V_{\text{int}} \cup V_{\text{cust}}$ in $\mathbb{R}^2$ with central depot $v_0$.
- Road segments generated via **Delaunay triangulation** $\mathcal{D}(V)$ ensuring planar, non-intersecting road segments.
- Base traversal time:
  $$t_{ij}^{\text{base}} = \frac{d_{ij}}{v_{ij}}$$

### 2. Dynamic Congestion Engine (Chapter 3)
Dynamic edge travel time: $w_{ij}(t) = t_{ij}^{\text{base}} \times \alpha_{ij}(t)$, $\alpha_{ij}(t) \ge 1.0$.
- **Preset 1 (Uniform Flow):** $\alpha_{ij}(t) = 1 + \epsilon_{ij}(t), \quad \epsilon \sim U(0, \epsilon_{\max})$.
- **Preset 2 (Rush-Hour Bottleneck):**
  $$\alpha_{ij}(t) = 1 + (\alpha_{\max} - 1) \cdot \exp\left(-\frac{\delta_{ij}}{\lambda}\right) \cdot \sigma(t)$$
  with raised-cosine temporal pulse envelope $\sigma(t) = \frac{1}{2}\left[1 - \cos\left(\frac{2\pi (t - t_{\text{start}})}{t_{\text{end}} - t_{\text{start}}}\right)\right]$.
- **Preset 3 (Incident Disruption):** Active interval $[t_1, t_2]$ with road closure $w_{ij} = \infty$ or severe incident slowdown $\alpha_{\text{incident}}$.

### 3. All-Pairs Shortest Path Matrix (Chapter 4)
Multi-source Dijkstra computes $|S| \times |S|$ travel-time lookup matrix $\mathbf{C}(t)$ for routing stops $S = \{v_0\} \cup V_{\text{cust}}$.

### 4. Continuous Random-Key Permutation & Capacitated Tour Splitting (Chapter 10)
- Particle position $X \in [0, 1]^D$, where $D = |V_{\text{cust}}|$.
- Permutation sequence: $\pi = \operatorname{argsort}(X)$.
- Split into vehicle routes $R_k = [0, c_1, c_2, \dots, 0]$ strictly obeying vehicle capacity $Q$.

### 5. Multi-Term Penalized Fitness Function (Chapters 5, 6, 7)
$$F(\mathbf{X}) = Z + \lambda_1 \sum_{k} \text{CapViol}(k) + \lambda_2 \cdot \text{RouteViol} + \lambda_3 \cdot \text{TWViol}$$
- $\text{CapViol}(k) = \max\left(0, \sum_{i \in R_k} d_i - Q\right)$.
- $\text{TWViol} = \sum_{i \in S \setminus \{0\}} \left[\max(0, e_i - \tau_i)\cdot \rho_{\text{early}} + \max(0, \tau_i - l_i) \cdot \rho_{\text{late}}\right]$.

### 6. Quantum-Inspired Particle Swarm Optimization (QPSO) (Chapter 11)
Grounded in delta-potential well wave mechanics:
- **Mean Best Position:**
  $$\text{mbest} = \frac{1}{M} \sum_{i=1}^M P_i$$
- **Local Attractor:**
  $$p_{ij} = \phi \cdot P_{ij} + (1 - \phi) \cdot G_j, \quad \phi \sim U(0, 1)$$
- **Quantum Sampling Position Update:**
  $$X_{ij}^{t+1} = p_{ij} \pm \beta \cdot |\text{mbest}_j - X_{ij}^t| \cdot \ln\left(\frac{1}{u}\right), \quad u \sim U(0, 1)$$
- **Annealed Contraction-Expansion Schedule:**
  $$\beta(t) = \beta_{\max} - (\beta_{\max} - \beta_{\min}) \cdot \frac{t}{T_{\max}}$$

---

## Quick Start

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ (for frontend development)
- G++ (with C++20 and OpenMP support, e.g. MSYS2 UCRT64 on Windows)

### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 3. Build C++ Core Solvers
```bash
python scripts/build_cpp.py
```
This builds:
- `traffic_solver.exe`: Standalone high-speed native C++ CLI executable.
- `qpso_engine.pyd`: Pybind11 C++ extension statically linked for zero runtime friction.

### 4. Run Pytest Suite
```bash
python -m pytest -v tests/
```
All 19 unit and integration tests will execute and pass in ~1.2s.

---

## Running the Applications

### 1. Interactive Web Dashboard (React.js + Python API)

#### Option A: Single Command (Production Mode)
```bash
python scripts/run_web.py --port 5000
```
Open **[http://127.0.0.1:5000](http://127.0.0.1:5000)** in your browser. The Python server directly serves both the REST API and the built React frontend.

#### Option B: Hot-Reloading Development Mode
1. Start the API backend:
   ```bash
   python scripts/run_web.py --port 5000
   ```
2. In a second terminal, launch Vite dev server:
   ```bash
   cd frontend
   npm run dev
   ```
   Open **[http://localhost:5173](http://localhost:5173)** in your browser.

**Dashboard Features:**
- **Interactive Road Network Map:** Vector SVG graph with zoom, pan, hover tooltips, and real-time congestion heat styling (Green: free flow, Amber: moderate, Red: severe, Dashed Pink: closed/blocked).
- **Vehicle Tour Overlays:** Glowing multi-vehicle tour traces with stop sequence indices.
- **KPI Metrics Bar:** Real-time metrics for Total Travel Time, Total Distance, Fleet Utilization, C++ Compute Time (ms), and Feasibility.
- **Detailed Vehicle Tour Schedules:** Expandable vehicle schedules with load capacity progress bars and delivery timings.
- **Systematic Benchmarking:** Multi-trial stochastic comparison comparing QPSO vs Classical PSO vs GNN with a comparative Scorecard table and interactive SVG Convergence Curves.
- **Live Dynamic Re-Routing Demo:** Simulates sudden road disruptions mid-transit with side-by-side comparison of prior blocked route vs warm-started QPSO detour bypass in sub-second compute time.

### 2. End-to-End CLI Demonstration
```bash
python scripts/run_demo.py
```

### 3. Systematic Multi-Run Benchmark
```bash
python scripts/run_benchmark.py --customers 15 --vehicles 4 --capacity 100 --swarm 40 --iterations 150 --runs 5
```

### 4. Standalone Native C++ CLI
```bash
.\traffic_solver.exe
```
Runs the pure C++ multi-threaded engine across hardware threads in under 40 milliseconds.