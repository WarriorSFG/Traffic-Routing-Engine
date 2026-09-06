# Quantum-Inspired PSO (QPSO) Multi-Scenario Comparative Benchmark Report

> Automated evaluation across randomized problem topologies, fleet constraints, and stochastic seeds.

## 1. Executive Summary & Aggregate Scorecard

| Metric | QPSO vs Classical PSO | QPSO vs GNN | Overall QPSO Performance |
| :--- | :--- | :--- | :--- |
| **Win Rate (% Scenarios Outperformed)** | **100.0%** (3/3 wins) | **100.0%** (3/3 wins) | **100.0%** Global Best |
| **Mean Fitness Improvement (%)** | **+8.23%** | **+45.35%** | Best Fit: **11.68** |
| **Mean Fleet Travel Time Reduction (%)** | **+8.23%** | **+20.94%** | Avg Time: **11.86 hrs** |
| **Mean Fleet Distance Reduction (%)** | **+13.47%** | **+23.76%** | Avg Dist: **400.92 km** |
| **Mean Wall-Clock Compute Time** | QPSO: 3.10 ms | PSO: 3.08 ms | GNN: 0.00 ms |
| **Mean Feasibility Rate** | QPSO: **100.0%** | PSO: **100.0%** | GNN: **66.7%** |

## 2. Statistical Aggregates by Algorithm

| Algorithm | Mean Best Fitness | Mean Total Fitness | Fleet Travel Time (h) | Fleet Distance (km) | Compute Time (ms) | Feasibility Rate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Quantum-Inspired PSO (QPSO)** | **11.68** | **11.86** | **11.86** | **400.92** | 3.10 | **100.0%** |
| **Classical PSO** | 12.84 | 13.02 | 13.02 | 467.62 | 3.08 | 100.0% |
| **Greedy Nearest Neighbor (GNN)** | 2072.08 | 2072.08 | 15.57 | 540.44 | 0.00 | 66.7% |

## 3. Detailed Randomized Scenario Breakdown

| Scenario | Seed | Stops/Veh/Cap | Swarm/Iter | Preset @ Time | QPSO Fitness | PSO Fitness | GNN Fitness | QPSO vs PSO (Fit %) | QPSO vs GNN (Fit %) | Winner |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| #1 | `701` | 8c / 2v / 90 | 20s / 30it | rush_hour @ 8.5h | **13.91** | 14.09 | 6188.46 | +1.24% | +99.78% | **QPSO** |
| #2 | `802` | 10c / 3v / 100 | 20s / 30it | uniform @ 13.0h | **10.36** | 10.47 | 16.93 | -0.21% | +35.71% | **QPSO** |
| #3 | `903` | 12c / 3v / 110 | 25s / 35it | incident @ 18.0h | **10.77** | 13.96 | 10.83 | +23.64% | +0.56% | **QPSO** |

## 4. Key Engineering Insights

- **Quantum Delta Potential Well Dynamics**: QPSO eliminates particle velocities in favor of delta-potential wave functions, allowing global tunneling across local optima where Classical PSO stalls.
- **Adaptive Contraction-Expansion (\(\beta\)) Coefficient**: Linear decay from \(\beta_{max}=1.0\) to \(\beta_{min}=0.4\) systematically balances broad global exploration in early iterations with aggressive local exploitation in later stages.
- **Deterministic Heuristic vs Metaheuristic Tradeoff**: GNN executes in minimal compute time (<1 ms) but exhibits elevated total fleet travel times and higher vulnerability to congestion bottlenecks.
- **C++ Pybind11 High Performance Core**: Hardware-accelerated OpenMP parallel evaluations execute full multi-run swarm iterations in tens of milliseconds per trial.