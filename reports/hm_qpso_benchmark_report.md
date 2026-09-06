# Quantum-Inspired PSO (QPSO) Multi-Scenario Comparative Benchmark Report

> Automated evaluation across randomized problem topologies, fleet constraints, and stochastic seeds.

## 1. Executive Summary & Aggregate Scorecard

| Metric | QPSO vs Classical PSO | QPSO vs GNN | Overall QPSO Performance |
| :--- | :--- | :--- | :--- |
| **Win Rate (% Scenarios Outperformed)** | **89.2%** (892/1000 wins) | **99.9%** (999/1000 wins) | **89.1%** Global Best |
| **Mean Fitness Improvement (%)** | **+10.97%** | **+19.77%** | Best Fit: **14.32** |
| **Mean Fleet Travel Time Reduction (%)** | **+10.97%** | **+19.59%** | Avg Time: **14.32 hrs** |
| **Mean Fleet Distance Reduction (%)** | **+11.56%** | **+20.33%** | Avg Dist: **536.37 km** |
| **Mean Wall-Clock Compute Time** | QPSO: 34.98 ms | PSO: 29.89 ms | GNN: 0.01 ms |
| **Mean Feasibility Rate** | QPSO: **100.0%** | PSO: **100.0%** | GNN: **99.8%** |

## 2. Statistical Aggregates by Algorithm

| Algorithm | Mean Best Fitness | Mean Total Fitness | Fleet Travel Time (h) | Fleet Distance (km) | Compute Time (ms) | Feasibility Rate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Quantum-Inspired PSO (QPSO)** | **14.32** | **14.32** | **14.32** | **536.37** | 34.98 | **100.0%** |
| **Classical PSO** | 16.31 | 16.31 | 16.31 | 615.56 | 29.89 | 100.0% |
| **Greedy Nearest Neighbor (GNN)** | 148.88 | 148.88 | 17.82 | 677.24 | 0.01 | 99.8% |

## 3. Detailed Randomized Scenario Breakdown

### Statistical Distribution Across Scenarios (Percentiles)

| Percentile | QPSO Fitness | PSO Fitness | GNN Fitness | QPSO vs PSO Imp (%) | QPSO vs GNN Imp (%) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Min (Best)** | 6.32 | 7.00 | 7.46 | -22.40% | +0.00% |
| **25th %** | 11.31 | 12.39 | 14.31 | +4.25% | +13.85% |
| **Median (50th)** | **13.82** | 15.53 | 17.32 | **+10.31%** | **+19.58%** |
| **75th %** | 16.39 | 19.11 | 20.36 | +17.12% | +25.07% |
| **90th %** | 19.38 | 22.84 | 24.05 | +23.72% | +30.17% |
| **Max (Worst)** | 32.09 | 36.73 | 93667.29 | +36.92% | +99.97% |

### Representative Scenario Sample

| Scenario | Seed | Stops/Veh/Cap | Swarm/Iter | Preset @ Time | QPSO Fitness | PSO Fitness | GNN Fitness | QPSO vs PSO (Fit %) | QPSO vs GNN (Fit %) | Winner |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| #1 | `84810` | 11c / 3v / 107 | 28s / 74it | uniform @ 8.5h | **9.54** | 9.99 | 13.16 | +4.51% | +27.52% | **QPSO** |
| #2 | `12395` | 19c / 7v / 72 | 41s / 78it | uniform @ 8.5h | **16.41** | 18.55 | 19.88 | +11.54% | +17.49% | **QPSO** |
| #3 | `4478` | 18c / 5v / 106 | 43s / 57it | rush_hour @ 8.5h | **25.72** | 26.47 | 26.30 | +2.81% | +2.18% | **QPSO** |
| #4 | `1851` | 12c / 4v / 87 | 28s / 45it | rush_hour @ 8.5h | **17.30** | 19.65 | 20.00 | +11.99% | +13.49% | **QPSO** |
| #5 | `50797` | 11c / 5v / 112 | 39s / 74it | uniform @ 9.0h | **7.64** | 8.93 | 11.40 | +14.46% | +32.99% | **QPSO** |
| #6 | `17361` | 16c / 5v / 98 | 27s / 42it | uniform @ 17.5h | **14.95** | 17.23 | 18.27 | +13.25% | +18.19% | **QPSO** |
| #7 | `87673` | 13c / 3v / 119 | 33s / 69it | rush_hour @ 8.0h | **14.03** | 15.62 | 14.25 | +10.17% | +1.51% | **QPSO** |
| #8 | `84320` | 15c / 5v / 88 | 45s / 44it | rush_hour @ 18.0h | **13.54** | 14.86 | 15.63 | +8.92% | +13.42% | **QPSO** |
| #9 | `80840` | 20c / 6v / 97 | 37s / 57it | rush_hour @ 8.5h | **26.11** | 33.24 | 30.89 | +21.44% | +15.48% | **QPSO** |
| #10 | `84886` | 18c / 5v / 104 | 35s / 65it | uniform @ 8.5h | **13.37** | 18.14 | 17.21 | +26.28% | +22.32% | **QPSO** |
| #11 | `36093` | 11c / 5v / 116 | 31s / 71it | rush_hour @ 18.0h | **10.19** | 12.67 | 15.42 | +19.57% | +33.90% | **QPSO** |
| #12 | `52856` | 20c / 7v / 77 | 42s / 74it | incident @ 8.5h | **20.59** | 21.78 | 23.96 | +5.47% | +14.06% | **QPSO** |
| #13 | `35438` | 19c / 5v / 115 | 29s / 72it | uniform @ 9.0h | **15.09** | 20.83 | 19.92 | +27.54% | +24.25% | **QPSO** |
| #14 | `65686` | 11c / 3v / 113 | 38s / 78it | uniform @ 18.0h | **11.43** | 12.89 | 14.43 | +11.35% | +20.76% | **QPSO** |
| #15 | `9326` | 16c / 5v / 100 | 42s / 40it | rush_hour @ 17.5h | **12.24** | 14.75 | 16.63 | +17.04% | +26.42% | **QPSO** |
| #16 | `90166` | 11c / 4v / 108 | 38s / 50it | rush_hour @ 8.0h | **13.99** | 16.07 | 16.69 | +12.98% | +16.21% | **QPSO** |
| #17 | `60470` | 10c / 3v / 119 | 45s / 59it | uniform @ 17.5h | **7.58** | 7.70 | 11.95 | +1.59% | +36.62% | **QPSO** |
| #18 | `84748` | 18c / 6v / 78 | 25s / 78it | incident @ 17.5h | **17.22** | 19.74 | 22.93 | +12.75% | +24.89% | **QPSO** |
| #19 | `43487` | 17c / 6v / 76 | 26s / 55it | uniform @ 9.0h | **15.18** | 17.76 | 18.44 | +14.50% | +17.68% | **QPSO** |
| #20 | `75364` | 11c / 3v / 107 | 29s / 70it | uniform @ 17.5h | **9.72** | 9.91 | 13.38 | +1.83% | +27.31% | **QPSO** |
| #21 | `73063` | 12c / 5v / 96 | 31s / 59it | incident @ 8.5h | **9.58** | 9.80 | 14.18 | +2.18% | +32.42% | **QPSO** |
| #22 | `53296` | 20c / 6v / 92 | 32s / 44it | uniform @ 8.0h | **16.00** | 22.76 | 17.46 | +29.71% | +8.36% | **QPSO** |
| #23 | `45313` | 10c / 3v / 99 | 45s / 43it | incident @ 8.0h | **8.76** | 10.72 | 11.56 | +18.29% | +24.22% | **QPSO** |
| #24 | `31007` | 11c / 3v / 113 | 33s / 71it | uniform @ 17.5h | **7.04** | 8.00 | 9.06 | +12.04% | +22.35% | **QPSO** |
| #25 | `29080` | 18c / 5v / 106 | 38s / 52it | rush_hour @ 8.5h | **23.84** | 28.99 | 25.85 | +17.78% | +7.76% | **QPSO** |
| #991 | `21214` | 14c / 4v / 104 | 30s / 41it | rush_hour @ 17.5h | **15.34** | 16.23 | 18.69 | +5.48% | +17.93% | **QPSO** |
| #992 | `94493` | 10c / 4v / 90 | 35s / 56it | rush_hour @ 8.5h | **16.85** | 18.23 | 19.36 | +7.54% | +12.97% | **QPSO** |
| #993 | `50219` | 11c / 4v / 80 | 41s / 64it | incident @ 13.0h | **9.76** | 9.74 | 10.77 | -0.17% | +9.35% | **QPSO (beats GNN)** |
| #994 | `16083` | 14c / 5v / 86 | 25s / 66it | rush_hour @ 8.0h | **22.36** | 26.03 | 22.94 | +14.08% | +2.50% | **QPSO** |
| #995 | `84039` | 13c / 4v / 84 | 45s / 48it | incident @ 8.5h | **15.39** | 15.19 | 17.46 | -1.27% | +11.90% | **QPSO (beats GNN)** |
| #996 | `40926` | 19c / 6v / 92 | 42s / 50it | rush_hour @ 8.5h | **26.43** | 27.98 | 28.44 | +5.54% | +7.08% | **QPSO** |
| #997 | `33133` | 18c / 5v / 118 | 39s / 79it | uniform @ 8.0h | **13.11** | 16.98 | 16.21 | +22.76% | +19.11% | **QPSO** |
| #998 | `38912` | 20c / 8v / 70 | 33s / 64it | incident @ 9.0h | **20.22** | 23.43 | 23.97 | +13.69% | +15.66% | **QPSO** |
| #999 | `47061` | 20c / 6v / 99 | 42s / 76it | uniform @ 8.0h | **16.55** | 18.83 | 21.46 | +12.10% | +22.86% | **QPSO** |
| #1000 | `10166` | 14c / 4v / 90 | 42s / 57it | incident @ 8.5h | **11.95** | 13.56 | 14.85 | +11.93% | +19.55% | **QPSO** |

> *Note: Showing 35 representative scenarios out of 1000 total cases. Complete results exported to CSV.*

## 4. Key Engineering Insights

- **Quantum Delta Potential Well Dynamics**: QPSO eliminates particle velocities in favor of delta-potential wave functions, allowing global tunneling across local optima where Classical PSO stalls.
- **Adaptive Contraction-Expansion (\(\beta\)) Coefficient**: Linear decay from \(\beta_{max}=1.0\) to \(\beta_{min}=0.4\) systematically balances broad global exploration in early iterations with aggressive local exploitation in later stages.
- **Deterministic Heuristic vs Metaheuristic Tradeoff**: GNN executes in minimal compute time (<1 ms) but exhibits elevated total fleet travel times and higher vulnerability to congestion bottlenecks.
- **C++ Pybind11 High Performance Core**: Hardware-accelerated OpenMP parallel evaluations execute full multi-run swarm iterations in tens of milliseconds per trial.