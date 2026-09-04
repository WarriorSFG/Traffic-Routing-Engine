import React, { useState, useEffect, useCallback } from 'react';
import NetworkMap from './components/NetworkMap';
import MetricsBar from './components/MetricsBar';
import TourSchedule from './components/TourSchedule';
import BenchmarkView from './components/BenchmarkView';
import RerouteView from './components/RerouteView';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState('map'); // 'map' | 'benchmark' | 'reroute'

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

  // Execute Simulation API
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

  return (
    <div className="app-container">
      {/* 1. Left Control Panel Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">🚗</div>
          <div>
            <div className="sidebar-brand-title">Traffic Routing</div>
            <div className="sidebar-brand-subtitle">QPSO Optimizer</div>
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={runSimulation}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner" /> Optimizing...
            </>
          ) : (
            '🚀 Optimize Routes (QPSO)'
          )}
        </button>

        {/* Traffic Simulation Settings */}
        <div className="sidebar-section">
          <span className="sidebar-section-title">🚦 Simulation Clock & Traffic</span>

          <div className="control-group">
            <label htmlFor="preset-select" className="control-label">Congestion Preset</label>
            <select
              id="preset-select"
              className="control-select"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
            >
              <option value="Rush-Hour Bottleneck">Rush-Hour Bottleneck</option>
              <option value="Incident Disruption">Incident Disruption</option>
              <option value="Uniform Flow">Uniform Flow</option>
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="sim-clock-slider" className="control-label">
              <span>Simulation Clock</span>
              <span className="control-value">{simClock.toFixed(2)} hrs</span>
            </label>
            <input
              id="sim-clock-slider"
              type="range"
              min="6.0"
              max="12.0"
              step="0.25"
              value={simClock}
              onChange={(e) => setSimClock(parseFloat(e.target.value))}
              className="control-range"
            />
          </div>
        </div>

        {/* Network & Fleet Settings */}
        <div className="sidebar-section">
          <span className="sidebar-section-title">📦 Network & Fleet</span>

          <div className="control-group">
            <label htmlFor="customers-slider" className="control-label">
              <span>Customer Stops</span>
              <span className="control-value">{numCustomers}</span>
            </label>
            <input
              id="customers-slider"
              type="range"
              min="5"
              max="35"
              step="1"
              value={numCustomers}
              onChange={(e) => setNumCustomers(parseInt(e.target.value, 10))}
              className="control-range"
            />
          </div>

          <div className="control-group">
            <label htmlFor="vehicles-slider" className="control-label">
              <span>Fleet Vehicles</span>
              <span className="control-value">{numVehicles}</span>
            </label>
            <input
              id="vehicles-slider"
              type="range"
              min="2"
              max="6"
              step="1"
              value={numVehicles}
              onChange={(e) => setNumVehicles(parseInt(e.target.value, 10))}
              className="control-range"
            />
          </div>

          <div className="control-group">
            <label htmlFor="cap-input" className="control-label">Vehicle Capacity (parcels)</label>
            <input
              id="cap-input"
              type="number"
              min="50"
              max="250"
              step="10"
              value={vehicleCap}
              onChange={(e) => setVehicleCap(parseFloat(e.target.value) || 100)}
              className="control-input"
            />
          </div>
        </div>

        {/* Optimization Hyperparameters */}
        <div className="sidebar-section">
          <span className="sidebar-section-title">⚙️ QPSO Swarm Parameters</span>

          <div className="control-group">
            <label htmlFor="swarm-slider" className="control-label">
              <span>Swarm Size (M)</span>
              <span className="control-value">{swarmSize}</span>
            </label>
            <input
              id="swarm-slider"
              type="range"
              min="10"
              max="100"
              step="10"
              value={swarmSize}
              onChange={(e) => setSwarmSize(parseInt(e.target.value, 10))}
              className="control-range"
            />
          </div>

          <div className="control-group">
            <label htmlFor="max-iter-slider" className="control-label">
              <span>Max Iterations (t_max)</span>
              <span className="control-value">{maxIter}</span>
            </label>
            <input
              id="max-iter-slider"
              type="range"
              min="20"
              max="300"
              step="20"
              value={maxIter}
              onChange={(e) => setMaxIter(parseInt(e.target.value, 10))}
              className="control-range"
            />
          </div>

          <div className="control-group">
            <label htmlFor="seed-input" className="control-label">Random Seed</label>
            <input
              id="seed-input"
              type="number"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value, 10) || 42)}
              className="control-input"
            />
          </div>
        </div>
      </aside>

      {/* 2. Main Content View */}
      <main className="app-main">
        {/* Header Banner */}
        <header className="header-banner">
          <div className="banner-title-row">
            <div>
              <h1 className="banner-title">🚗 Quantum-Inspired Traffic Route Optimization</h1>
              <p className="banner-subtitle">
                SIH 2026 Problem Statement 26137 — High-Performance C++ QPSO Engine vs. Classical Metaheuristics & Live Dynamic Re-Routing
              </p>
            </div>
            <div className="banner-badges">
              <span className="badge badge-primary">{preset}</span>
              <span className="badge badge-success">Clock: {simClock.toFixed(2)}h</span>
              {metrics && (
                <span className="badge">
                  {metrics.num_edges} Links | {metrics.num_customers} Stops
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="tabs-header">
          <button
            className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            🗺️ Network & Route Map
          </button>
          <button
            className={`tab-btn ${activeTab === 'benchmark' ? 'active' : ''}`}
            onClick={() => setActiveTab('benchmark')}
          >
            📊 Metaheuristic Benchmarking
          </button>
          <button
            className={`tab-btn ${activeTab === 'reroute' ? 'active' : ''}`}
            onClick={() => setActiveTab('reroute')}
          >
            ⚡ Live Dynamic Re-Routing Demo
          </button>
        </nav>

        {/* Global Error Banner */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            padding: '12px 18px',
            borderRadius: '8px',
            color: '#fca5a5',
            fontSize: '0.9rem'
          }}>
            ⚠️ Error: {error}
          </div>
        )}

        {/* Tab 1: Network & Route Map */}
        {activeTab === 'map' && simulationData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <MetricsBar metrics={simulationData.metrics} />

            <NetworkMap
              data={simulationData}
              title={`Network Topology & Multi-Vehicle Routes (${preset} at ${simClock.toFixed(2)} hrs)`}
              height={580}
            />

            <TourSchedule
              routes={simulationData.routes}
              vehicleCap={vehicleCap}
            />
          </div>
        )}

        {/* Tab 2: Metaheuristic Benchmarking */}
        {activeTab === 'benchmark' && (
          <BenchmarkView
            params={{
              swarm_size: swarmSize,
              max_iter: maxIter,
              seed
            }}
          />
        )}

        {/* Tab 3: Live Dynamic Re-Routing Demo */}
        {activeTab === 'reroute' && (
          <RerouteView networkData={simulationData} />
        )}
      </main>
    </div>
  );
}
