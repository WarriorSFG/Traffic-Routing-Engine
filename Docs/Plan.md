
### Phase 1: Network & Traffic Generator (Deliverable 1)

*Build the synthetic urban environment and dynamic weight engine.*

* **Step 1.1: Graph Topology Generator**
* Generate a planar or Delaunay triangulation graph using synthetic $(x, y)$ coordinates to avoid overlapping roads.


* Designate node types: Depot (start/end hub), Intersections, and Delivery Demand Points.


* Assign base edge weights: Euclidean distance $d_{ij}$ and base speed limit $v_{ij}$ to establish base free-flow traversal time: $t_{ij}^{\text{base}} = \frac{d_{ij}}{v_{ij}}$.




* **Step 1.2: Dynamic Congestion Engine**
* Implement dynamic travel time scaling: $w_{ij}(t) = t_{ij}^{\text{base}} \times \alpha_{ij}(t)$, where $\alpha_{ij}(t) \ge 1.0$ is the congestion multiplier.


* Provide three traffic test presets:
* **Uniform Flow:** Baseline conditions with random light noise.
* **Rush-Hour Bottleneck:** Clustered congestion radiating outward from high-density intersections.
* **Incident Disruption:** Road closures or severe speed drops simulating accidents or construction.





---

### Phase 2: Problem Formulation & Routing Matrix (Deliverable 2)

*Formulate the optimization constraints and distance/time lookups.*

* **Step 2.1: All-Pairs Shortest Path (APSP) Precomputation**
* Run Dijkstra or Floyd-Warshall over the edge weights $w_{ij}(t)$ to generate an $N \times N$ travel time cost matrix between all customer stops and the depot.
* Recalculate this matrix when dynamic traffic updates occur.


* **Step 2.2: Mathematical Constraint Definitions**
* **Objective Function:** Minimize total vehicle travel time and distance across the entire fleet.


* **Capacity Constraints:** Each vehicle $k$ has maximum capacity $Q$; total parcel demand on route $k$ must satisfy $\sum d_i \le Q$.


* **Route Constraints:** Every delivery stop must be visited exactly once; all vehicles must start and terminate at the central depot.


* **Penalty Function:** Add large penalty weights to the objective score if capacity or route limits are breached.



---

### Phase 3: Baseline Solvers for Benchmarking (Deliverable 5)

*Establish control algorithms to evaluate QPSO improvements.*

* **Step 3.1: Greedy Nearest Neighbor (GNN)**
* Quick heuristic: vehicles iteratively route to the nearest feasible unvisited customer stop until capacity is filled, then return to depot.
* Provides the baseline speed and benchmark quality.


* **Step 3.2: Classical Particle Swarm Optimization (PSO)**
* Standard classical PSO using position vectors $X_i$ and velocity updates $V_i$.


* Demonstrates where classical algorithms suffer from local minima traps and premature convergence.





---

### Phase 4: Quantum-Inspired Optimization Engine (Deliverable 3)

*Implement the core Quantum-Inspired Metaheuristic.*

* **Step 4.1: Particle Representation (Encoding/Decoding)**
* Use continuous **Random Key Encoding**: each particle position is a vector of continuous floats $\in [0, 1]$.
* Sort indices by value to produce a valid discrete customer visitation sequence (avoiding invalid tour permutations).


* Decode permutations into vehicle routes by splitting when capacity $Q$ is reached.


* **Step 4.2: QPSO State Dynamics**
* Replace classical velocity updates with quantum delta-potential well wave functions:



$$\text{mbest} = \frac{1}{M} \sum_{i=1}^{M} P_i$$


$$p_{ij} = \phi \cdot P_{ij} + (1 - \phi) \cdot G_j \quad (\phi \sim U(0, 1))$$


$$X_{ij}^{t+1} = p_{ij} \pm \beta \cdot \vert{} \text{mbest}_j - X_{ij}^t \vert{} \cdot \ln\left(\frac{1}{u}\right) \quad (u \sim U(0, 1))$$


* Adjust contraction-expansion coefficient $\beta$ over iterations to balance global exploration and local convergence.




* **Step 4.3: Dynamic Re-routing Loop**
* Feed dynamic traffic updates into the algorithm at fixed intervals, triggering incremental route updates for unfinished delivery legs.





---

### Phase 5: Visualization & Benchmarking Dashboard (Deliverables 4 & 5)

*Package the system into an executable demonstration.*

* **Step 5.1: Interactive Map UI**
* Build a front-end dashboard (using Streamlit, Dash, or Plotly).


* Graph View: Render road segments color-coded by traffic load (green = free flow, red = heavy congestion) alongside colored vehicle route paths.




* **Step 5.2: Side-by-Side Performance Analytics**
* Generate convergence curves: **Cost vs. Iteration** comparing Classical PSO against QPSO.


* Performance scorecard comparing:
* Total fleet travel time


* Total distance traveled


* Wall-clock computation time


* Constraint violation rate







---

### Suggested Execution Sequence

| Stage | Focus Area | Deliverables Covered |
| --- | --- | --- |
| **Stage 1** | Graph Network + Congestion Simulator | Deliverable 1|
| **Stage 2** | Mathematical VRP Model & Cost Matrices | Deliverable 2|
| **Stage 3** | Baseline Solvers (Greedy + Classical PSO) | Deliverables 3 & 5|
| **Stage 4** | QPSO Engine Implementation | Deliverable 3|
| **Stage 5** | Comparison Dashboard & Visual UI | Deliverables 4 & 5|