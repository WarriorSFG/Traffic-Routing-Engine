import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import DispatchStudio from './components/DispatchStudio';
import ComparisonStudio from './components/ComparisonStudio';
import RerouteView from './components/RerouteView';
import BenchmarkView from './components/BenchmarkView';
import ReferenceBookView from './components/ReferenceBookView';

export default function App() {
  // Page Navigation: 'dispatch' | 'compare' | 'reroute' | 'benchmark' | 'reference'
  const [activePage, setActivePage] = useState('dispatch');

  // Sidebar Controls State
  const [preset, setPreset] = useState('Rush-Hour Bottleneck');
  const [simClock, setSimClock] = useState(8.0);
  const [numCustomers, setNumCustomers] = useState(15);
  const [numVehicles, setNumVehicles] = useState(4);
  const [vehicleCap, setVehicleCap] = useState(100.0);
  const [swarmSize, setSwarmSize] = useState(40);
  const [maxIter, setMaxIter] = useState(120);
  const [seed, setSeed] = useState(42);

  // Simulation Data State
  const [simulationData, setSimulationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Execute Simulation API (solves GNN, PSO, and QPSO together in C++)
  const runSimulation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preset,
          sim_clock: simClock,
          num_customers: numCustomers,
          num_vehicles: numVehicles,
          vehicle_cap: vehicleCap,
          swarm_size: swarmSize,
          max_iter: maxIter,
          seed
        })
      });
      const json = await res.json();
      if (json.success) {
        setSimulationData(json.data);
      } else {
        setError(json.error || 'Simulation failed to compute.');
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to simulation backend.');
    } finally {
      setLoading(false);
    }
  }, [preset, simClock, numCustomers, numVehicles, vehicleCap, swarmSize, maxIter, seed]);

  // Initial solve on page load
  useEffect(() => {
    runSimulation();
  }, [runSimulation]);

  const metrics = simulationData?.metrics;
  const isBookPage = activePage === 'reference';

  return (
    <div className="website-root">
      {/* 1. Global Navigation Bar */}
      <Navbar
        activePage={activePage}
        setActivePage={setActivePage}
        isOnline={!error}
      />

      {/* 2. Main Body Layout */}
      <div className={`app-container ${isBookPage ? 'fullwidth-layout' : ''}`}>
        {/* Left Sidebar (Only visible on simulation / workbench pages) */}
        {!isBookPage && (
          <aside className={`app-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
            <div className="sidebar-collapse-toggle">
              <button
                className="btn-sidebar-toggle"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title={sidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
              >
                {sidebarOpen ? '◀ Controls' : '▶'}
              </button>
            </div>

            {sidebarOpen && (
              <>
                <div className="sidebar-header-box">
                  <div className="sidebar-section-title">⚙️ PARAMETER WORKBENCH</div>
                  <p className="sidebar-section-sub">
                    Tune graph topology, vehicle capacity, and quantum hyperparameters.
                  </p>
                </div>

                <button
                  className="btn btn-primary btn-reoptimize"
                  onClick={runSimulation}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner" /> Optimizing All Solvers...
                    </>
                  ) : (
                    '🚀 Re-Optimize Fleet (All Solvers)'
                  )}
                </button>

                {/* Traffic Simulation Settings */}
                <div className="sidebar-section">
                  <span className="sidebar-section-title">🚦 Simulation & Traffic</span>

                  <div className="control-group">
                    <label htmlFor="preset-select" className="control-label">Congestion Preset</label>
                    <select
                      id="preset-select"
                      className="control-select"
                      value={preset}
                      onChange={(e) => setPreset(e.target.value)}
                    >
                      <option value="Rush-Hour Bottleneck">Rush-Hour Bottleneck (Clustered)</option>
                      <option value="Incident Disruption">Incident Disruption (Roadblock)</option>
                      <option value="Uniform Flow">Uniform Flow (Baseline Noise)</option>
                    </select>
                  </div>

                  <div className="control-group">
                    <div className="control-label-row">
                      <label htmlFor="clock-slider" className="control-label">Simulation Clock</label>
                      <span className="control-value">{simClock.toFixed(1)}:00 hrs</span>
                    </div>
                    <input
                      id="clock-slider"
                      type="range"
                      className="slider"
                      min="6.0"
                      max="18.0"
                      step="0.5"
                      value={simClock}
                      onChange={(e) => setSimClock(parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                {/* VRP Fleet Settings */}
                <div className="sidebar-section">
                  <span className="sidebar-section-title">📦 Fleet & Demands</span>

                  <div className="control-group">
                    <div className="control-label-row">
                      <label htmlFor="cust-slider" className="control-label">Customer Stops</label>
                      <span className="control-value">{numCustomers}</span>
                    </div>
                    <input
                      id="cust-slider"
                      type="range"
                      className="slider"
                      min="5"
                      max="40"
                      step="1"
                      value={numCustomers}
                      onChange={(e) => setNumCustomers(parseInt(e.target.value, 10))}
                    />
                  </div>

                  <div className="control-group">
                    <div className="control-label-row">
                      <label htmlFor="veh-slider" className="control-label">Fleet Vehicles</label>
                      <span className="control-value">{numVehicles}</span>
                    </div>
                    <input
                      id="veh-slider"
                      type="range"
                      className="slider"
                      min="1"
                      max="8"
                      step="1"
                      value={numVehicles}
                      onChange={(e) => setNumVehicles(parseInt(e.target.value, 10))}
                    />
                  </div>

                  <div className="control-group">
                    <div className="control-label-row">
                      <label htmlFor="cap-slider" className="control-label">Vehicle Capacity (Q)</label>
                      <span className="control-value">{vehicleCap} kg</span>
                    </div>
                    <input
                      id="cap-slider"
                      type="range"
                      className="slider"
                      min="50.0"
                      max="300.0"
                      step="10.0"
                      value={vehicleCap}
                      onChange={(e) => setVehicleCap(parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                {/* Metaheuristic Hyperparameters */}
                <div className="sidebar-section">
                  <span className="sidebar-section-title">⚛️ QPSO Hyperparameters</span>

                  <div className="control-group">
                    <div className="control-label-row">
                      <label htmlFor="swarm-slider" className="control-label">Swarm Size (M)</label>
                      <span className="control-value">{swarmSize}</span>
                    </div>
                    <input
                      id="swarm-slider"
                      type="range"
                      className="slider"
                      min="10"
                      max="100"
                      step="5"
                      value={swarmSize}
                      onChange={(e) => setSwarmSize(parseInt(e.target.value, 10))}
                    />
                  </div>

                  <div className="control-group">
                    <div className="control-label-row">
                      <label htmlFor="iter-slider" className="control-label">Max Iterations (T)</label>
                      <span className="control-value">{maxIter}</span>
                    </div>
                    <input
                      id="iter-slider"
                      type="range"
                      className="slider"
                      min="20"
                      max="300"
                      step="10"
                      value={maxIter}
                      onChange={(e) => setMaxIter(parseInt(e.target.value, 10))}
                    />
                  </div>

                  <div className="control-group">
                    <div className="control-label-row">
                      <label htmlFor="seed-slider" className="control-label">RNG Seed</label>
                      <span className="control-value">{seed}</span>
                    </div>
                    <input
                      id="seed-slider"
                      type="range"
                      className="slider"
                      min="1"
                      max="100"
                      step="1"
                      value={seed}
                      onChange={(e) => setSeed(parseInt(e.target.value, 10))}
                    />
                  </div>
                </div>
              </>
            )}
          </aside>
        )}

        {/* 3. Main Workspace Area */}
        <main className="app-main">
          {/* Global Error Banner */}
          {error && (
            <div className="error-banner">
              ⚠️ Connection or Solver Error: {error}
            </div>
          )}

          {/* Page 1: Dispatch Studio */}
          {activePage === 'dispatch' && (
            <DispatchStudio
              simulationData={simulationData}
              loading={loading}
              error={error}
              onRunSimulation={runSimulation}
              simClock={simClock}
              setSimClock={setSimClock}
              preset={preset}
              setPreset={setPreset}
            />
          )}

          {/* Page 2: Comparison Studio */}
          {activePage === 'compare' && (
            <ComparisonStudio
              simulationData={simulationData}
              onRunSim={runSimulation}
              loading={loading}
            />
          )}

          {/* Page 3: Incident & Live Reroute */}
          {activePage === 'reroute' && (
            <RerouteView networkData={simulationData} />
          )}

          {/* Page 4: Benchmark Suite */}
          {activePage === 'benchmark' && (
            <BenchmarkView
              params={{
                swarm_size: swarmSize,
                max_iter: maxIter,
                seed
              }}
            />
          )}

          {/* Page 5: The Quantum Routing Handbook */}
          {activePage === 'reference' && (
            <ReferenceBookView />
          )}
        </main>
      </div>
    </div>
  );
}
