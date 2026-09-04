import React, { useState } from 'react';
import NetworkMap from './NetworkMap';
import MetricsBar from './MetricsBar';
import TourSchedule from './TourSchedule';

export default function DispatchStudio({
  simulationData,
  loading,
  error,
  onRunSimulation,
  simClock,
  setSimClock,
  preset,
  setPreset
}) {
  const [selectedVehicle, setSelectedVehicle] = useState('all');
  const [showExplainer, setShowExplainer] = useState(true);
  const [selectedStop, setSelectedStop] = useState(null);

  const routes = simulationData?.routes || [];
  const metrics = simulationData?.metrics;
  const numVehicles = metrics?.total_vehicles || routes.length || 4;

  const filteredRoutes = selectedVehicle === 'all'
    ? routes
    : routes.filter((r) => r.vehicle_id === Number(selectedVehicle));

  return (
    <div className="dispatch-studio" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. What Gets Optimized Explainer Banner (Collapsible) */}
      <div className="metric-card explainer-card">
        <div className="explainer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="explainer-icon">🎯</span>
            <div>
              <h3 style={{ fontSize: '1.05rem', color: '#ffffff', fontWeight: 600 }}>
                Fleet Routing Optimization Principles: What Gets Solved
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 2 }}>
                High-dimensional Capacitated Vehicle Routing Problem with Time Windows (CVRPTW) under time-varying traffic congestion.
              </p>
            </div>
          </div>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
            onClick={() => setShowExplainer(!showExplainer)}
          >
            {showExplainer ? 'Hide Details ▲' : 'Show Details ▼'}
          </button>
        </div>

        {showExplainer && (
          <div className="explainer-pillars">
            <div className="explainer-item">
              <div className="explainer-badge">OBJECTIVE 1</div>
              <strong>Dynamic Travel Time Minimization</strong>
              <p>Minimizes total fleet transit hours across dynamic weights w_ij(t) = t_ij_base &times; &alpha;_ij(t) over morning rush-hour bottlenecks.</p>
            </div>
            <div className="explainer-item">
              <div className="explainer-badge">CONSTRAINT 1</div>
              <strong>Vehicle Fleet Capacity (Q)</strong>
              <p>Guarantees total parcel demand on each vehicle's route never exceeds capacity (&sum; d_i &le; Q).</p>
            </div>
            <div className="explainer-item">
              <div className="explainer-badge">CONSTRAINT 2</div>
              <strong>Customer Delivery Windows</strong>
              <p>Ensures vehicles arrive within client time windows $[e_i, l_i]$, penalizing early wait times and late delivery delays.</p>
            </div>
            <div className="explainer-item">
              <div className="explainer-badge">SOLVER</div>
              <strong>Quantum Attractor Search</strong>
              <p>Particles explore solution space via delta potential wells without velocity clamping, discovering global detour topologies in milliseconds.</p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Top Fleet Summary Metrics */}
      <MetricsBar metrics={metrics} />

      {/* 3. Main Workspace: Interactive Map & Controls */}
      <div className="dispatch-workspace-grid">
        {/* Left Column: Interactive Map */}
        <div className="dispatch-map-wrapper">
          {/* Map Controls Toolbar */}
          <div className="map-toolbar">
            <div className="toolbar-left">
              <span className="toolbar-label">Vehicle Route Isolation:</span>
              <div className="filter-pills">
                <button
                  className={`pill-btn ${selectedVehicle === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedVehicle('all')}
                >
                  All Vehicles ({numVehicles})
                </button>
                {Array.from({ length: numVehicles }, (_, i) => i + 1).map((vId) => (
                  <button
                    key={`disp-v-${vId}`}
                    className={`pill-btn ${selectedVehicle === String(vId) ? 'active' : ''}`}
                    onClick={() => setSelectedVehicle(String(vId))}
                  >
                    Vehicle #{vId}
                  </button>
                ))}
              </div>
            </div>

            <div className="toolbar-right">
              <span className="sim-clock-indicator">
                🕒 Sim Clock: <strong>{simClock.toFixed(1)}:00</strong>
              </span>
            </div>
          </div>

          <NetworkMap
            data={{
              ...simulationData,
              routes: filteredRoutes
            }}
            title="Interactive Urban Road Network & Real-Time Fleet Routes"
            height={520}
          />

          {/* Time of Day Simulation Scrub Bar */}
          <div className="clock-slider-card">
            <div className="clock-slider-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.2rem' }}>☀️</span>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f3f6fb' }}>Time-of-Day Traffic Simulation</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: 8 }}>
                    Morning Rush-Hour: 7:00 AM &ndash; 10:00 AM (Peak at 8:00 AM, &alpha; = 3.5&times;)
                  </span>
                </div>
              </div>
              <span className="clock-badge">
                {simClock.toFixed(1)}:00 hrs
              </span>
            </div>

            <div className="clock-slider-track">
              <input
                type="range"
                className="slider"
                min="6.0"
                max="18.0"
                step="0.5"
                value={simClock}
                onChange={(e) => {
                  setSimClock(parseFloat(e.target.value));
                }}
              />
              <div className="clock-ticks">
                <span>6:00 AM (Depot Opens)</span>
                <span style={{ color: '#ef4444', fontWeight: 600 }}>8:00 AM (Peak Rush Hour)</span>
                <span>12:00 PM (Midday)</span>
                <span>18:00 PM (Depot Closes)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Fleet Tour Schedule & Details */}
        <div className="dispatch-sidebar-col">
          <TourSchedule
            routes={routes}
            customers={simulationData?.customers}
            depot={simulationData?.depot}
          />
        </div>
      </div>
    </div>
  );
}
