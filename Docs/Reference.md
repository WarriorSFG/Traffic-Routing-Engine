# Quantum-Inspired Intelligent Traffic Route Optimization
## A Complete Mathematical Reference

**SIH 2026 — Quantum Technology Vertical (Problem Statement 1)**
**Organization:** Egreen Quanta

---

> **How to use this book.** This is a single reference for every equation you will implement, ordered exactly as you will build the system (Phase 1 → Phase 5). Each chapter states the *purpose* of the equation, the *symbols*, the *derivation or justification*, and a short *implementation note*. Where the original plan left a gap against the official problem statement, that gap is called out explicitly and closed with a derivation, so nothing you need at build time is missing.

---

## Table of Contents

1. [Notation & Conventions](#chapter-1-notation--conventions)
2. [Chapter 2 — Graph Topology & Base Travel Time](#chapter-2--graph-topology--base-travel-time)
3. [Chapter 3 — Dynamic Congestion Engine](#chapter-3--dynamic-congestion-engine)
4. [Chapter 4 — All-Pairs Shortest Path & the Cost Matrix](#chapter-4--all-pairs-shortest-path--the-cost-matrix)
5. [Chapter 5 — The Vehicle Routing Problem: Full Mathematical Formulation](#chapter-5--the-vehicle-routing-problem-full-mathematical-formulation)
6. [Chapter 6 — Time-Window Constraints (Gap Closure)](#chapter-6--time-window-constraints-gap-closure)
7. [Chapter 7 — Penalty-Based Fitness Function](#chapter-7--penalty-based-fitness-function)
8. [Chapter 8 — Baseline Solver 1: Greedy Nearest Neighbor](#chapter-8--baseline-solver-1-greedy-nearest-neighbor)
9. [Chapter 9 — Baseline Solver 2: Classical Particle Swarm Optimization](#chapter-9--baseline-solver-2-classical-particle-swarm-optimization)
10. [Chapter 10 — Random-Key Encoding & Decoding](#chapter-10--random-key-encoding--decoding)
11. [Chapter 11 — Quantum-Inspired Particle Swarm Optimization (QPSO)](#chapter-11--quantum-inspired-particle-swarm-optimization-qpso)
12. [Chapter 12 — Dynamic Re-Routing Under Live Traffic](#chapter-12--dynamic-re-routing-under-live-traffic)
13. [Chapter 13 — Convergence, Benchmarking & Scorecard Metrics](#chapter-13--convergence-benchmarking--scorecard-metrics)
14. [Chapter 14 — Complexity Analysis](#chapter-14--complexity-analysis)
15. [Appendix A — Symbol Glossary](#appendix-a--symbol-glossary)
16. [Appendix B — Equation Index by Implementation Module](#appendix-b--equation-index-by-implementation-module)

---

## Chapter 1: Notation & Conventions

Throughout this book:

- Scalars are italic lowercase or uppercase letters ($d$, $Q$, $N$).
- Vectors are bold lowercase ($\mathbf{x}$), matrices bold uppercase ($\mathbf{W}$).
- $G = (V, E)$ denotes the road network graph, with node set $V$ and edge set $E$.
- $t$ (in $\alpha_{ij}(t)$, $w_{ij}(t)$) denotes **simulation time**, not a decision variable — it indexes *when* a query is made against the dynamic graph, not a scheduling variable.
- Subscripts $i, j$ index **nodes** (intersections/customers/depot). Subscript $k$ indexes **vehicles**. Superscript $t$ (on particle states) indexes **iteration number** of the metaheuristic — this is a different "t" from simulation time above; both are kept because both appear in the source plan, and the distinction is flagged wherever ambiguity is possible.
- $|\cdot|$ denotes absolute value (or cardinality, for sets — clear from context).
- $U(0,1)$ denotes a draw from the continuous uniform distribution on $[0,1]$.

---

## Chapter 2 — Graph Topology & Base Travel Time

**Purpose.** Build the static synthetic road network (Plan Step 1.1) on which all routing and congestion logic will run.

### 2.1 Node set and coordinates

Generate $N$ nodes with synthetic planar coordinates:

$$
V = \{v_0, v_1, \dots, v_{N-1}\}, \qquad v_i = (x_i, y_i) \in \mathbb{R}^2
$$

Node $v_0$ is reserved as the **depot**. The remaining nodes are partitioned into intersections $V_{\text{int}}$ and delivery demand points $V_{\text{cust}}$:

$$
V = \{v_0\} \cup V_{\text{int}} \cup V_{\text{cust}}, \qquad V_{\text{int}} \cap V_{\text{cust}} = \emptyset
$$

### 2.2 Edge generation (Delaunay triangulation)

To avoid overlapping/crossing roads (a physically implausible road network), edges are drawn from a **Delaunay triangulation** $\mathcal{D}(V)$ of the point set, or equivalently its planar dual constraint — no two edges of $E$ intersect except at shared endpoints:

$$
E = \{(i,j) : (v_i, v_j) \text{ is an edge of } \mathcal{D}(V)\}
$$

*Why Delaunay specifically*: it maximizes the minimum angle of all triangles in the triangulation, which in practice yields road segments with realistic lengths (no razor-thin slivers) and guarantees planarity — a property a random or complete graph does not have.

### 2.3 Euclidean edge distance

For every edge $(i,j) \in E$:

$$
d_{ij} = \lVert v_i - v_j \rVert_2 = \sqrt{(x_i - x_j)^2 + (y_i - y_j)^2}
$$

### 2.4 Base free-flow travel time

Each edge is assigned a base speed limit $v_{ij}$ (sampled per road class, e.g. arterial vs. residential). The **free-flow travel time** is:

$$
t_{ij}^{\text{base}} = \frac{d_{ij}}{v_{ij}}
$$

**Implementation note.** Store $d_{ij}$, $v_{ij}$, and $t_{ij}^{\text{base}}$ once at graph construction; they never change during a simulation run (only the congestion multiplier $\alpha_{ij}(t)$ in Chapter 3 varies with time). If the graph is undirected, decide up front whether $t_{ij}^{\text{base}} = t_{ji}^{\text{base}}$ (symmetric) — most urban simulations relax this later once lane direction / one-way constraints are added, but symmetric is the correct default for the MVP.

---

## Chapter 3 — Dynamic Congestion Engine

**Purpose.** Turn the static graph into a time-varying one (Plan Step 1.2).

### 3.1 Dynamic edge weight

$$
w_{ij}(t) = t_{ij}^{\text{base}} \times \alpha_{ij}(t), \qquad \alpha_{ij}(t) \ge 1.0
$$

$\alpha_{ij}(t)$ is the **congestion multiplier**: $\alpha_{ij}(t) = 1.0$ means free flow; $\alpha_{ij}(t) = 3.0$ means the edge currently takes 3× as long to traverse.

### 3.2 Preset 1 — Uniform Flow (baseline noise)

$$
\alpha_{ij}(t) = 1 + \epsilon_{ij}(t), \qquad \epsilon_{ij}(t) \sim U(0, \epsilon_{\max}), \quad \epsilon_{\max} \ll 1
$$

A small independent random perturbation per edge per query (e.g. $\epsilon_{\max} = 0.1$), representing everyday micro-variation with no structural congestion.

### 3.3 Preset 2 — Rush-Hour Bottleneck (spatially clustered)

Congestion should radiate outward from a small set of "hot" intersections $H \subset V$ (typically high-degree nodes). Model this as a **distance-decayed multiplier**: for edge $(i,j)$, let

$$
\delta_{ij} = \min_{h \in H} \Big( \text{dist}_G(i, h) + \text{dist}_G(j, h) \Big) \Big/ 2
$$

where $\text{dist}_G(\cdot,\cdot)$ is the (static, base-time) graph shortest-path distance to the nearest hotspot. Then:

$$
\alpha_{ij}(t) = 1 + (\alpha_{\max} - 1) \cdot \exp\!\left(-\frac{\delta_{ij}}{\lambda}\right) \cdot \sigma(t)
$$

- $\alpha_{\max}$: peak congestion multiplier at the hotspot itself ($\delta_{ij}=0$).
- $\lambda$: decay length-scale — controls how far congestion "spreads" from the hotspot.
- $\sigma(t) \in [0,1]$: a temporal envelope (e.g. a raised-cosine or trapezoidal pulse) that ramps congestion up, holds it, then ramps it down, simulating the rise and fall of a rush-hour peak:

$$
\sigma(t) = \frac{1}{2}\left[1 - \cos\!\left(\frac{2\pi (t - t_{\text{start}})}{t_{\text{end}} - t_{\text{start}}}\right)\right], \quad t \in [t_{\text{start}}, t_{\text{end}}]; \qquad \sigma(t) = 0 \text{ otherwise}
$$

*Derivation note*: this raised-cosine envelope is chosen (over a step function) because rush-hour congestion in real traffic data builds and dissipates smoothly rather than switching on/off discontinuously — the smoothness also gives the dynamic-rerouting engine (Chapter 12) a continuous signal to track instead of a discontinuous jump.

### 3.4 Preset 3 — Incident Disruption

A random subset of edges $E_{\text{inc}} \subset E$ is chosen to represent accidents/construction. Two forms are supported:

**Hard closure:**
$$
w_{ij}(t) = \infty \quad \text{(equivalently, remove edge } (i,j) \text{ from the routable graph)}, \quad (i,j) \in E_{\text{inc}}, \ t \in [t_1, t_2]
$$

**Severe slowdown:**
$$
\alpha_{ij}(t) = \alpha_{\text{incident}}, \qquad \alpha_{\text{incident}} \gg \alpha_{\max}^{\text{rush-hour}}, \qquad (i,j) \in E_{\text{inc}}, \ t \in [t_1, t_2]
$$

where $t_1, t_2$ are the incident's start/clear time. This piecewise definition is what feeds the **dynamic re-routing loop** (Chapter 12): whenever $t$ crosses $t_1$ or $t_2$, the affected edges' weights change and downstream routes must be recomputed.

---

## Chapter 4 — All-Pairs Shortest Path & the Cost Matrix

**Purpose.** Convert the road-level graph into a customer-level lookup table the VRP/QPSO layer can use directly (Plan Step 2.1).

### 4.1 Single-pair shortest path (Dijkstra)

For fixed $t$, and a fixed source $s$, Dijkstra's algorithm computes:

$$
\text{dist}(s, j) = \min_{P \in \mathcal{P}(s,j)} \sum_{(i,i') \in P} w_{ii'}(t)
$$

where $\mathcal{P}(s,j)$ is the set of all paths from $s$ to $j$ in $G$. Requires $w_{ij}(t) \ge 0$ for all edges — true here since $\alpha_{ij}(t) \ge 1$.

### 4.2 All-pairs shortest path (APSP)

Let $S = \{v_0\} \cup V_{\text{cust}}$ be the set of "stops" that matter to the routing layer (depot + delivery points; pass-through intersections are abstracted away at this stage). The **cost matrix** is:

$$
\mathbf{C}(t) \in \mathbb{R}^{|S| \times |S|}, \qquad C_{pq}(t) = \text{dist}_{G(t)}(s_p, s_q), \qquad s_p, s_q \in S
$$

Two implementation routes:

$$
\textbf{Option A (Dijkstra} \times |S|\textbf{):} \quad O(|S| \cdot (|E| + |V|\log|V|))
$$

$$
\textbf{Option B (Floyd–Warshall):} \quad O(|V|^3)
$$

Floyd–Warshall's recurrence, for completeness:

$$
C^{(k)}_{pq} = \min\left(C^{(k-1)}_{pq},\ C^{(k-1)}_{pk} + C^{(k-1)}_{kq}\right), \qquad k = 1, \dots, |V|
$$

**Implementation note.** Run $|S|$ independent Dijkstra calls (Option A) unless $|V|$ is small ($\lesssim$ few hundred) — Floyd–Warshall's cubic cost stops scaling quickly, while Dijkstra from each stop is cheap and (importantly) **parallelizable**, and trivially supports recomputing only for stops touched by a traffic update (see 4.3).

### 4.3 Recomputation trigger

Whenever any $\alpha_{ij}(t)$ changes materially (a preset event fires — rush hour envelope crosses a threshold, or an incident starts/clears), recompute:

$$
\mathbf{C}(t_{\text{new}}) \leftarrow \text{APSP}\big(G, \{w_{ij}(t_{\text{new}})\}\big)
$$

For efficiency, restrict recomputation to source nodes within the *affected radius* of the changed edges (i.e., nodes whose shortest path to any stop could plausibly route through $E_{\text{inc}}$ or the rush-hour cluster), rather than recomputing the full $|S|\times|S|$ matrix from scratch every tick.

---

## Chapter 5 — The Vehicle Routing Problem: Full Mathematical Formulation

**Purpose.** Plan Step 2.2 states the objective and constraints in prose. Below is the complete, precise mathematical program — this is the formulation both the baselines (Ch. 8–9) and QPSO (Ch. 11) are, implicitly or explicitly, trying to solve, and it is what the constraint-violation metric in Ch. 13 measures against.

### 5.1 Sets and indices

| Symbol | Meaning |
|---|---|
| $S = \{0, 1, \dots, n\}$ | Stops; $0$ = depot, $1,\dots,n$ = customers |
| $K = \{1, \dots, m\}$ | Vehicle fleet, $\lvert K \rvert = m$ |
| $C_{pq}(t)$ | Travel-time cost matrix entry, from Chapter 4 |

### 5.2 Parameters

| Symbol | Meaning |
|---|---|
| $d_i$ | Parcel demand at customer $i$ ($d_0 = 0$ for the depot) |
| $Q$ | Vehicle capacity (identical fleet assumed unless stated otherwise) |
| $m$ | Number (or max number) of vehicles available |

### 5.3 Decision variables

This is the piece the plan leaves implicit. A capacitated VRP (CVRP) is standard formulated with a **binary arc-selection variable**:

$$
x_{ijk} = \begin{cases} 1 & \text{if vehicle } k \text{ travels directly from stop } i \text{ to stop } j \\ 0 & \text{otherwise} \end{cases}, \qquad i \ne j,\ i,j \in S,\ k \in K
$$

and, to track load and forbid sub-tours, an auxiliary continuous **load variable**:

$$
u_i \ge 0 \quad \text{= cumulative demand delivered on the route up to and including stop } i
$$

(This is the standard Miller–Tucker–Zemlin (MTZ) device — necessary because "each stop visited exactly once + arbitrary $x_{ijk}$" alone permits disconnected sub-tours that never touch the depot.)

### 5.4 Objective function

$$
\min_{\{x_{ijk}\}} \quad Z = \sum_{k \in K} \sum_{i \in S} \sum_{j \in S,\, j \ne i} C_{ij}(t) \cdot x_{ijk}
$$

This minimizes total fleet travel time/distance, exactly as stated in Plan Step 2.2, now written explicitly over the decision variables.

### 5.5 Constraints

**(a) Each customer visited exactly once (by exactly one vehicle):**

$$
\sum_{k \in K} \sum_{i \in S,\, i \ne j} x_{ijk} = 1 \qquad \forall j \in S \setminus \{0\}
$$

**(b) Flow conservation (a vehicle that enters a stop must leave it):**

$$
\sum_{i \in S,\, i \ne j} x_{ijk} = \sum_{i \in S,\, i \ne j} x_{jik} \qquad \forall j \in S,\ \forall k \in K
$$

**(c) Every vehicle starts and ends at the depot:**

$$
\sum_{j \in S \setminus \{0\}} x_{0jk} \le 1, \qquad \sum_{i \in S \setminus \{0\}} x_{i0k} \le 1 \qquad \forall k \in K
$$

(The $\le 1$, not $= 1$, allows a vehicle to be unused in a given solution.)

**(d) Capacity constraint:**

$$
\sum_{i \in S} d_i \sum_{j \in S,\, j \ne i} x_{ijk} \le Q \qquad \forall k \in K
$$

Equivalently, in the plan's shorthand, for the set of customers $R_k$ assigned to vehicle $k$'s route: $\sum_{i \in R_k} d_i \le Q$.

**(e) Sub-tour elimination (MTZ form):**

$$
u_i - u_j + Q \cdot x_{ijk} \le Q - d_j \qquad \forall i \ne j \in S\setminus\{0\},\ \forall k \in K
$$

$$
d_i \le u_i \le Q \qquad \forall i \in S \setminus \{0\}
$$

*Why this is needed*: constraints (a)–(d) alone are satisfied by a solution containing, e.g., one big loop through the depot **plus a disconnected small loop among 3 customers that never touches the depot** — each customer is still visited exactly once and flow is conserved locally. The MTZ inequalities force $u$ to strictly increase along any vehicle's path, which is only possible if that path is a single chain rooted at the depot ($u_0 = 0$ implicitly), eliminating disconnected sub-tours.

**(f) Binary/domain constraints:**

$$
x_{ijk} \in \{0, 1\} \qquad \forall i,j \in S,\ i\ne j,\ \forall k \in K
$$

### 5.6 Relationship to the metaheuristic layer

QPSO/PSO/GNN do **not** manipulate $x_{ijk}$ directly (that is the exact/MILP view). Instead they search over the space of *route permutations*, and Chapter 10 defines the decode step that maps a continuous particle position back into a set of routes — from which $x_{ijk}$ can be *read off* after the fact:

$$
x_{ijk} = 1 \iff \text{vehicle } k\text{'s decoded route visits } j \text{ immediately after } i
$$

This equivalence is what lets you compute the same objective $Z$ and check the same constraints (a)–(f) for a metaheuristic solution as you would for an exact one — necessary for a fair benchmark in Chapter 13.

---

## Chapter 6 — Time-Window Constraints (Gap Closure)

**Why this chapter exists.** The official problem statement's deliverable table explicitly lists **"Capacity, time-window and flow constraints"** as a required key component of Deliverable 2. `Plan.md` only implements capacity and route/flow constraints (Chapter 5, (a)–(e)) — **time windows are absent**. This chapter derives and adds them so the implementation fully satisfies the problem statement.

### 6.1 Parameters

Each customer $i$ is given a delivery time window $[e_i, l_i]$ (earliest, latest permissible arrival), and a fixed service duration $s_i$ (e.g. time to hand off the parcel). The depot has an operating window $[e_0, l_0]$ (e.g. the depot's open hours).

### 6.2 Arrival-time decision variable

Introduce a continuous variable:

$$
\tau_i \ge 0 \quad \text{= the time vehicle } k \text{ arrives at stop } i
$$

### 6.3 Propagation constraint

If vehicle $k$ travels directly from $i$ to $j$ ($x_{ijk}=1$), the arrival time at $j$ must respect travel time, service time, and — critically — **waiting** if the vehicle arrives before the window opens:

$$
\tau_j \ge \big(\tau_i + s_i + C_{ij}(t)\big) \cdot x_{ijk} \qquad \forall i \ne j,\ \forall k
$$

Big-$M$ linearization (needed because this is only active when $x_{ijk}=1$):

$$
\tau_j \ge \tau_i + s_i + C_{ij}(t) - M(1 - x_{ijk}) \qquad M \gg \max_{i,j} C_{ij}(t)
$$

### 6.4 Window feasibility

$$
e_i \le \tau_i \le l_i \qquad \forall i \in S
$$

If a vehicle arrives early ($\tau_i^{\text{raw}} < e_i$), it **waits**: effective arrival is $\max(\tau_i^{\text{raw}}, e_i)$, which is exactly what constraint 6.3 (as a $\ge$ inequality, not equality) already encodes — $\tau_i$ is free to be pushed up to $e_i$ by the solver/decoder without penalty.

### 6.5 Soft time windows (for the metaheuristic layer)

Hard constraints (6.4) are natural for the exact MILP view, but a metaheuristic benefits from a **soft, differentiable-in-spirit penalty** so that near-feasible solutions aren't discarded outright — mirroring exactly how capacity is already handled in Plan Step 2.2's penalty function:

$$
\text{TWPenalty}(i) = \max(0,\ e_i - \tau_i) \cdot \rho_{\text{early}} + \max(0,\ \tau_i - l_i) \cdot \rho_{\text{late}}
$$

$\rho_{\text{early}}, \rho_{\text{late}}$ are penalty weights (typically $\rho_{\text{late}} \gg \rho_{\text{early}}$, since arriving late is usually a harder violation than arriving early and waiting). This plugs directly into the fitness function of Chapter 7.

---

## Chapter 7 — Penalty-Based Fitness Function

**Purpose.** Both PSO and QPSO need a single scalar fitness to minimize; infeasible-but-decodable solutions must be discouraged, not discarded (Plan Step 2.2, "Penalty Function").

### 7.1 Capacity violation

For vehicle $k$'s route $R_k$:

$$
\text{CapViol}(k) = \max\!\left(0,\ \sum_{i \in R_k} d_i - Q\right)
$$

### 7.2 Route-structure violation

Since the decode step (Chapter 10) guarantees each customer appears exactly once and every route starts/ends at the depot by construction, this term is typically $0$ for random-key-encoded solutions — but is kept in the general fitness form for robustness / for comparison against the exact MILP baseline, where it is not automatically zero:

$$
\text{RouteViol} = \left| \left\{ j \in S\setminus\{0\} : \sum_{k}\sum_{i \ne j} x_{ijk} \ne 1 \right\} \right|
$$

### 7.3 Time-window violation

$$
\text{TWViol} = \sum_{i \in S \setminus \{0\}} \text{TWPenalty}(i) \quad \text{(from §6.5)}
$$

### 7.4 Total fitness (objective the swarm actually minimizes)

$$
F(\mathbf{X}) = \underbrace{\sum_{k \in K} \sum_{(i,j) \in R_k} C_{ij}(t)}_{\text{Chapter 5.4 objective } Z} \;+\; \lambda_1 \sum_{k} \text{CapViol}(k) \;+\; \lambda_2 \cdot \text{RouteViol} \;+\; \lambda_3 \cdot \text{TWViol}
$$

$\lambda_1, \lambda_2, \lambda_3 \gg 1$ are large penalty coefficients (Plan's "large penalty weights"), scaled so that **any** constraint violation costs more than the maximum possible improvement in raw travel time — guaranteeing the swarm is always pushed toward feasibility first, optimality second. A practical choice:

$$
\lambda_1 = \lambda_2 = \lambda_3 = 10 \times \max_{i,j \in S} C_{ij}(t) \times |S|
$$

i.e., an order of magnitude larger than the worst-case total tour cost, so one violated unit of capacity/time-window/route-structure is never "worth" trading off against travel time savings.

---

## Chapter 8 — Baseline Solver 1: Greedy Nearest Neighbor

**Purpose.** Fast, weak baseline (Plan Step 3.1).

### 8.1 Construction rule

Starting each vehicle $k$ at the depot ($\text{cur}_k \leftarrow 0$, $\text{load}_k \leftarrow 0$), repeatedly select:

$$
j^\star = \operatorname*{argmin}_{j \in \text{Unvisited},\ d_j \le Q - \text{load}_k} C_{\text{cur}_k,\, j}(t)
$$

Append $j^\star$ to route $R_k$, update $\text{cur}_k \leftarrow j^\star$, $\text{load}_k \leftarrow \text{load}_k + d_{j^\star}$. If no feasible $j^\star$ exists (capacity exhausted, or a time window from Chapter 6 cannot be met by any remaining stop), close the route:

$$
R_k \leftarrow R_k \cup \{0\}, \qquad k \leftarrow k+1
$$

Repeat until $\text{Unvisited} = \emptyset$.

### 8.2 Cost

$$
Z_{\text{GNN}} = \sum_k \sum_{(i,j) \in R_k} C_{ij}(t)
$$

This value is the same $Z$ from §5.4, evaluated on the GNN's route set — directly comparable to QPSO's fitness (minus penalty terms, since GNN is feasible by construction whenever a feasible next stop always exists).

---

## Chapter 9 — Baseline Solver 2: Classical Particle Swarm Optimization

**Purpose.** The second, stronger baseline (Plan Step 3.2) — required so the report can *demonstrate* (not just claim) where classical PSO gets stuck, motivating QPSO.

### 9.1 Particle state

Each particle $i$ maintains a position and velocity vector in the same continuous random-key space as QPSO will use (Chapter 10 defines the encoding shared by both):

$$
X_i = (x_{i1}, \dots, x_{iD}) \in [0,1]^D, \qquad V_i = (v_{i1}, \dots, v_{iD}) \in \mathbb{R}^D
$$

where $D = |S| - 1$ (one continuous key per customer stop).

### 9.2 Personal & global best

$$
P_i = \operatorname*{argmin}_{X \in \{X_i^{(1)}, \dots, X_i^{(t)}\}} F(X) \qquad \text{(personal best position seen by particle } i \text{ so far)}
$$

$$
G = \operatorname*{argmin}_{i} F(P_i) \qquad \text{(global best across the whole swarm)}
$$

### 9.3 Classical velocity update (Kennedy–Eberhart)

$$
V_{ij}^{t+1} = w \cdot V_{ij}^{t} + c_1 r_1 \left(P_{ij} - X_{ij}^{t}\right) + c_2 r_2 \left(G_j - X_{ij}^{t}\right), \qquad r_1, r_2 \sim U(0,1)
$$

$$
X_{ij}^{t+1} = X_{ij}^{t} + V_{ij}^{t+1}
$$

| Symbol | Meaning | Typical value |
|---|---|---|
| $w$ | Inertia weight | $0.4$–$0.9$, often linearly decreased |
| $c_1$ | Cognitive coefficient (pull toward own best) | $\approx 2.0$ |
| $c_2$ | Social coefficient (pull toward swarm best) | $\approx 2.0$ |

### 9.4 Boundary handling

Since positions must stay in $[0,1]^D$ for valid random-key decoding, clamp:

$$
X_{ij}^{t+1} \leftarrow \min\big(1,\ \max(0,\ X_{ij}^{t+1})\big)
$$

### 9.5 Why this traps into local minima (for the report's discussion)

Classical PSO's velocity update is **deterministic given $r_1, r_2$** and always biased toward a linear combination of $P_i$ and $G$; once the whole swarm's $G$ stagnates at a local optimum, every particle's velocity term shrinks toward zero (all three components point at nearly the same place), and there is no mechanism to re-inject exploration — this is exactly the premature-convergence failure mode QPSO's quantum potential-well formulation (Chapter 11) is designed to fix, since QPSO's update has **no velocity term at all** and instead samples from a distribution with unbounded support (§11.4).

---

## Chapter 10 — Random-Key Encoding & Decoding

**Purpose.** The shared representation used by classical PSO (Ch. 9) and QPSO (Ch. 11) to turn continuous particle positions into valid discrete routes (Plan Step 4.1).

### 10.1 Encoding

A particle's position is a vector of continuous random keys, one per customer:

$$
X_i = (x_{i1}, \dots, x_{iD}) \in [0,1]^D, \qquad D = |V_{\text{cust}}|
$$

### 10.2 Decoding step 1 — sequence extraction

Sort customer indices by their key value:

$$
\pi = \operatorname*{argsort}_{j \in \{1,\dots,D\}} (x_{ij})
$$

$\pi$ is now a valid **permutation** of all customers — a full delivery *sequence* with no repeats and no omissions, by construction (sorting always yields a bijection regardless of the (generically distinct) real-valued keys).

### 10.3 Decoding step 2 — route splitting

Walk $\pi$ in order, greedily accumulating stops into the current vehicle's route until capacity would be exceeded, then start a new vehicle:

$$
\text{load} \leftarrow 0,\quad R_1 \leftarrow \{0\}, \quad k \leftarrow 1
$$

For each $j$ in $\pi$ (in order):

$$
\text{if } \text{load} + d_j \le Q: \quad R_k \leftarrow R_k \cup \{j\}, \quad \text{load} \leftarrow \text{load} + d_j
$$
$$
\text{else}: \quad R_k \leftarrow R_k \cup \{0\}, \quad k \leftarrow k+1, \quad R_k \leftarrow \{0, j\}, \quad \text{load} \leftarrow d_j
$$

Finally $R_k \leftarrow R_k \cup \{0\}$ closes the last route.

*Why this always yields a feasible-by-construction tour*: every customer appears in $\pi$ exactly once (bijection from §10.2), the split rule never adds a customer that would push a route over $Q$, and every route explicitly starts/ends with $0$ — so constraints (a), (b), (c), (d) of Chapter 5 are satisfied automatically, and the fitness function (Chapter 7) only needs to actively penalize **time-window** violations, since capacity/route-structure violations cannot occur under this decode rule.

---

## Chapter 11 — Quantum-Inspired Particle Swarm Optimization (QPSO)

**Purpose.** The core algorithmic contribution (Plan Step 4.2), grounded in the delta-potential-well quantum model (Sun, Feng & Xu, 2004).

### 11.1 Physical motivation (brief)

Classical PSO models each particle as a point with defined position *and* velocity (a classical trajectory). QPSO instead models each particle as existing in a **quantum delta-potential well** centered at a local attractor $p_{ij}$: the particle has no defined trajectory, only a probability distribution over position, collapsing to a measured position via a random draw. This removes the velocity vector entirely and replaces convergence-by-momentum with convergence-by-shrinking-probability-cloud.

### 11.2 Mean best position (mbest)

$$
\text{mbest} = \frac{1}{M} \sum_{i=1}^{M} P_i
$$

the centroid of all $M$ particles' personal-best positions — this plays the role classical PSO's single global best $G$ cannot play alone: it gives the swarm a *collective* sense of where the good region of the search space currently is, smoothing out the risk of the swarm collapsing prematurely around one particle's (possibly lucky, possibly noisy) personal best.

### 11.3 Local attractor point

$$
p_{ij} = \phi \cdot P_{ij} + (1-\phi)\cdot G_j, \qquad \phi \sim U(0,1)
$$

Each dimension $j$ of each particle $i$ gets its own random convex combination of that particle's personal best $P_{ij}$ and the swarm's global best $G_j$. This is the center of the delta potential well that particle $i$ occupies along dimension $j$ this iteration.

### 11.4 Position update (quantum sampling)

$$
X_{ij}^{t+1} = p_{ij} \;\pm\; \beta \cdot \left|\text{mbest}_j - X_{ij}^{t}\right| \cdot \ln\!\left(\frac{1}{u}\right), \qquad u \sim U(0,1)
$$

The sign ($+$ or $-$) is chosen with probability $0.5$ each (typically via an independent coin flip per dimension per particle per iteration).

**Derivation of the log term** (for completeness, since the plan states the formula but not where it comes from): solving the 1-D time-independent Schrödinger equation for a particle in a delta potential well centered at $p$ gives a wavefunction $\psi(X) \propto e^{-|X-p|/L}$, whose associated probability density is $|\psi(X)|^2 \propto e^{-2|X-p|/L}$. Sampling from this distribution via inverse-transform sampling on a uniform variate $u \sim U(0,1)$ yields exactly:

$$
|X - p| = \frac{L}{2}\ln\!\left(\frac{1}{u}\right)
$$

Substituting the characteristic length $L = 2\beta\,|\text{mbest}_j - X_{ij}^t|$ (i.e., letting the well's width itself track the swarm's current spread around mbest) recovers the update rule in §11.4 exactly. This is the mathematical justification for why the position update has *no upper bound* on how far a particle can jump — unlike classical PSO's velocity-bounded update — giving QPSO its stronger global-exploration property referenced in the problem statement's objectives.

### 11.5 Contraction–expansion coefficient schedule

$\beta$ controls the trade-off between exploration (large $\beta$, wide wells, more jumping) and exploitation (small $\beta$, narrow wells, fine local search). The standard schedule linearly anneals it over the run:

$$
\beta(t) = \beta_{\max} - (\beta_{\max} - \beta_{\min}) \cdot \frac{t}{T_{\max}}
$$

where $t$ is the current iteration, $T_{\max}$ the total planned iterations, and typical values are $\beta_{\max} = 1.0$, $\beta_{\min} = 0.4$.

### 11.6 QPSO iteration, assembled

For each iteration $t = 1, \dots, T_{\max}$:

1. Evaluate fitness $F(X_i^t)$ for every particle (decode via Chapter 10, score via Chapter 7).
2. Update $P_i$ if $F(X_i^t) < F(P_i)$; update $G$ if any $F(P_i) < F(G)$.
3. Compute $\text{mbest}$ (§11.2).
4. Update $\beta(t)$ (§11.5).
5. For every particle $i$, dimension $j$: draw $\phi, u \sim U(0,1)$, compute $p_{ij}$ (§11.3), update $X_{ij}^{t+1}$ (§11.4).
6. Clamp $X_{ij}^{t+1}$ into $[0,1]$ (same rationale as §9.4).

---

## Chapter 12 — Dynamic Re-Routing Under Live Traffic

**Purpose.** Plan Step 4.3 — closing the loop between Chapter 3's live congestion engine and the optimizer.

### 12.1 Triggering condition

At fixed wall-clock or simulated-time intervals $\Delta t_{\text{refresh}}$, or immediately upon an incident event (Chapter 3.4's $t_1$), check whether the cost matrix has materially changed:

$$
\text{Trigger} = \mathbb{1}\!\left[\ \max_{p,q \in S} \left| C_{pq}(t_{\text{now}}) - C_{pq}(t_{\text{last}}) \right| > \tau_{\text{refresh}}\ \right]
$$

$\tau_{\text{refresh}}$ is a sensitivity threshold (avoids re-optimizing on negligible noise from §3.2).

### 12.2 Warm-started re-optimization

Rather than re-running QPSO from a random population, **warm-start** it: seed the new run's swarm with the previous run's converged population, but freeze the already-completed legs of each vehicle's route (a vehicle already en route to, or having passed, stop $i$ cannot un-visit it):

$$
S_{\text{remaining}}(k) = S \setminus \big(\{\text{stops already served by vehicle } k\} \cup \{0\}\big)
$$

QPSO (Chapter 11) is then re-run with:

- Reduced dimensionality $D' = |S_{\text{remaining}}|$ (only unvisited customers are re-optimized).
- Updated cost matrix $C_{pq}(t_{\text{now}})$ from Chapter 4.
- Vehicle $k$'s current position substituted for the depot as that vehicle's effective route-origin for cost lookups: $C_{0,q}(t_\text{now}) \to C_{\text{cur}_k,\, q}(t_\text{now})$.

### 12.3 Updated fitness under the new matrix

$$
F_{t_{\text{now}}}(\mathbf{X}) = \sum_{k}\sum_{(i,j)\in R_k} C_{ij}(t_{\text{now}}) + \lambda_1 \text{CapViol} + \lambda_2 \text{RouteViol} + \lambda_3 \text{TWViol}\big(t_{\text{now}}\big)
$$

identical in form to Chapter 7's $F$, just re-evaluated against the refreshed cost matrix and the shrunk remaining-stop set — this is what makes the QPSO engine "dynamic" rather than a one-shot planner.

---

## Chapter 13 — Convergence, Benchmarking & Scorecard Metrics

**Purpose.** Plan Step 5.2 — the quantitative comparison QPSO vs. classical PSO vs. GNN.

### 13.1 Convergence curve

For a single run, record the best-so-far fitness at every iteration:

$$
F_{\text{best}}(t) = \min_{\tau \le t} F(G^{(\tau)})
$$

Plotting $F_{\text{best}}(t)$ vs. $t$ for both QPSO and classical PSO on the same axes is the "Cost vs. Iteration" chart the plan calls for. A faster **drop rate** and a lower **final plateau** for QPSO is the expected (and to-be-demonstrated) result.

### 13.2 Solution quality — relative gap

To compare against a baseline $B$ (e.g. GNN, or a small-instance exact solver):

$$
\text{Gap}_{\%} = \frac{F_{\text{best}}^{\text{algo}} - F_{\text{best}}^{\star}}{F_{\text{best}}^{\star}} \times 100\%
$$

where $F^\star_{\text{best}}$ is the best known/optimal cost for that instance (exact solver on small instances, or the best across all algorithms tested on large ones).

### 13.3 Total fleet travel time & distance

Already defined as the raw (unpenalized) components of $Z$ (§5.4):

$$
Z_{\text{time}} = \sum_k \sum_{(i,j) \in R_k} t_{ij}(t), \qquad Z_{\text{dist}} = \sum_k \sum_{(i,j) \in R_k} d_{ij}
$$

(kept as two separate scorecard rows since the problem statement's objectives list both explicitly — Chapter 5's $Z$ uses time; report distance alongside it using the same routes' edge distances $d_{ij}$ from Chapter 2.)

### 13.4 Wall-clock computation time

$$
T_{\text{compute}} = t_{\text{end}}^{\text{wall}} - t_{\text{start}}^{\text{wall}}
$$

measured identically (same hardware, same stopping criterion — either fixed iteration count $T_{\max}$ or a convergence tolerance) across all three algorithms for a fair comparison.

### 13.5 Constraint violation rate

$$
\text{ViolRate} = \frac{\text{CapViol} + \text{RouteViol} + \text{TWViol}}{\text{(number of constraints checked)}}
$$

or, more simply, report as a **feasibility flag** per run plus the raw penalty magnitude $\lambda_1\text{CapViol}+\lambda_2\text{RouteViol}+\lambda_3\text{TWViol}$ from §7.4 — useful because GNN (Chapter 8) is feasible by construction (rate $\equiv 0$) while classical PSO with poorly-tuned $w, c_1, c_2$ can occasionally return infeasible-leaning solutions if boundary clamping (§9.4) interacts badly with the decode step.

### 13.6 Statistical robustness (recommended addition)

Since all three algorithms (except GNN) are stochastic, report mean $\pm$ standard deviation over $R$ independent runs (typical $R = 20$–$30$), not a single run:

$$
\bar{F} = \frac{1}{R}\sum_{r=1}^{R} F_{\text{best}}^{(r)}, \qquad \sigma_F = \sqrt{\frac{1}{R-1}\sum_{r=1}^{R}\left(F_{\text{best}}^{(r)} - \bar{F}\right)^2}
$$

This is not explicitly requested in the plan but is standard practice for any metaheuristic benchmarking claim and strengthens the "systematic performance benchmarking" requirement from the problem statement's Expected Solution.

---

## Chapter 14 — Complexity Analysis

**Purpose.** Supports the problem statement's objective #3 ("reduce computational complexity ... compared with classical algorithms") with concrete, statable complexity, not just empirical wall-clock numbers.

### 14.1 Per-iteration cost of each algorithm

| Algorithm | Per-iteration cost | Notes |
|---|---|---|
| GNN | $O(n^2)$ total (one-shot, not iterative) | $n$ = number of customers; nearest-feasible lookup each step |
| Classical PSO | $O(M \cdot D)$ | $M$ particles, $D$ dimensions; velocity + position update is $O(1)$ per dimension |
| QPSO | $O(M \cdot D)$ | Same order — mbest computation is $O(M \cdot D)$ once per iteration, amortized |

Both PSO and QPSO are the *same asymptotic order per iteration* — QPSO's claimed advantage (per the problem statement) is **not** a lower per-step cost, but **fewer iterations to reach a comparable-or-better solution quality**, i.e. a smaller $T_{\max}$ needed for the same $\text{Gap}_\%$ (§13.2). This distinction matters for how you write up Chapter 13's results: report *both* per-iteration cost (theoretical, Chapter 14) and iterations-to-convergence (empirical, §13.1) so the "faster convergence" claim in the problem statement's Background is substantiated rather than asserted.

### 14.2 Fitness evaluation cost (dominant term in practice)

Each fitness evaluation decodes a full particle (§10.2–10.3: $O(D \log D)$ for the sort) and sums route costs ($O(D)$ lookups into $\mathbf{C}$):

$$
\text{Cost}(F) = O(D \log D)
$$

so total per-iteration wall-clock is really $O(M \cdot D \log D)$ for both PSO and QPSO — this dominates the $O(M\cdot D)$ update-rule cost itself and should be the term profiled first if wall-clock time (§13.4) is higher than expected.

### 14.3 APSP cost (amortized)

From Chapter 4: $O(|S|(|E|+|V|\log|V|))$ per full recomputation, but with the restricted-radius trick (§4.3), the *amortized* per-tick cost during dynamic re-routing (Chapter 12) is far lower in practice — bound it empirically per traffic-preset in the benchmarking chapter rather than claiming a fixed complexity, since it depends on the spatial extent of each triggered update.

---

## Appendix A — Symbol Glossary

| Symbol | First defined | Meaning |
|---|---|---|
| $V, E, G$ | 2.1 | Node set, edge set, road graph |
| $d_{ij}$ | 2.3 | Euclidean distance, edge $(i,j)$ |
| $v_{ij}$ | 2.4 | Base speed limit, edge $(i,j)$ |
| $t_{ij}^{\text{base}}$ | 2.4 | Free-flow travel time, edge $(i,j)$ |
| $\alpha_{ij}(t)$ | 3.1 | Congestion multiplier at time $t$ |
| $w_{ij}(t)$ | 3.1 | Dynamic edge weight at time $t$ |
| $\alpha_{\max}, \lambda, \sigma(t)$ | 3.3 | Rush-hour hotspot params & temporal envelope |
| $E_{\text{inc}}, t_1, t_2$ | 3.4 | Incident edge set & active window |
| $C_{pq}(t)$ | 4.2 | APSP cost matrix entry, stops $p,q$ |
| $S, K$ | 5.1 | Stop set (incl. depot), vehicle set |
| $d_i, Q, m$ | 5.2 | Customer demand, vehicle capacity, fleet size |
| $x_{ijk}$ | 5.3 | Binary arc-selection variable |
| $u_i$ | 5.3 | MTZ cumulative load variable |
| $Z$ | 5.4 | Raw travel-time/distance objective |
| $e_i, l_i, s_i, \tau_i$ | 6.1–6.2 | Time-window bounds, service time, arrival time |
| $\rho_{\text{early}}, \rho_{\text{late}}$ | 6.5 | Soft time-window penalty weights |
| $\lambda_1,\lambda_2,\lambda_3$ | 7.4 | Capacity / route / time-window penalty coefficients |
| $F(\mathbf{X})$ | 7.4 | Total penalized fitness |
| $X_i, V_i$ | 9.1 | PSO particle position, velocity |
| $P_i, G$ | 9.2 | Personal best, global best |
| $w, c_1, c_2$ | 9.3 | Inertia, cognitive, social coefficients |
| $\pi$ | 10.2 | Decoded customer visitation sequence |
| $\text{mbest}$ | 11.2 | Mean of all personal bests |
| $p_{ij}$ | 11.3 | QPSO local attractor point |
| $\beta(t)$ | 11.5 | Contraction–expansion coefficient |
| $\phi, u$ | 11.3–11.4 | QPSO random draws $\sim U(0,1)$ |
| $\Delta t_{\text{refresh}}, \tau_{\text{refresh}}$ | 12.1 | Re-routing check interval & sensitivity threshold |
| $F_{\text{best}}(t)$ | 13.1 | Best-so-far fitness at iteration $t$ |
| $\text{Gap}_\%$ | 13.2 | Relative optimality gap vs. best known |
| $T_{\text{compute}}$ | 13.4 | Wall-clock run time |
| $\bar{F}, \sigma_F$ | 13.6 | Mean / std. dev. of fitness across repeated runs |

---

## Appendix B — Equation Index by Implementation Module

Use this table to jump straight to the equations relevant to whichever module you are coding.

| Module (per Plan.md phase) | Chapters to implement from |
|---|---|
| `graph_generator.py` | Ch. 2 |
| `congestion_engine.py` | Ch. 3 |
| `cost_matrix.py` (APSP) | Ch. 4 |
| `vrp_model.py` (constraints, used by validator + exact-solver comparison) | Ch. 5, Ch. 6 |
| `fitness.py` | Ch. 7 |
| `solver_gnn.py` | Ch. 8 |
| `solver_pso.py` | Ch. 9, Ch. 10 (shared encode/decode) |
| `solver_qpso.py` | Ch. 11, Ch. 10 (shared encode/decode) |
| `rerouting_loop.py` | Ch. 12 |
| `benchmark_dashboard.py` | Ch. 13 |
| Report / write-up — complexity discussion | Ch. 14 |

---

*End of reference. All symbols are cross-consistent across chapters — e.g. $C_{ij}(t)$ from Chapter 4 is the same quantity substituted into the Chapter 5 objective, the Chapter 7 fitness, the Chapter 9/11 particle evaluation, and the Chapter 13 scorecard, with no redefinition anywhere in the document.*