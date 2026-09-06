import React, { useState } from 'react';
import NetworkMap from './NetworkMap';
import MetricsBar from './MetricsBar';
import TourSchedule from './TourSchedule';

const icons = {
  target: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  chevronDown: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  chevronUp: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
};

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

  const routes = simulationData?.routes || [];
  const metrics = simulationData?.metrics;
  const activeRoutesCount = routes.length;
  const targetVehicles = metrics?.total_vehicles || activeRoutesCount;
  const isFleetExceeded = activeRoutesCount > targetVehicles;
  const totalParcelDemand = Math.round(routes.reduce((sum, r) => sum + (r.total_load || 0), 0));
  const vehicleCap = metrics?.vehicle_capacity || 120.0;
  const totalFleetCap = Math.round(targetVehicles * vehicleCap);

  const filteredRoutes = selectedVehicle === 'all'
    ? routes
    : routes.filter((r) => r.vehicle_id === Number(selectedVehicle));

  return (
    <div className="dispatch-studio" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. What Gets Optimized Explainer Banner (Collapsible) */}
      <div className="metric-card explainer-card">
        <div className="explainer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="explainer-icon">{icons.target}</span>
            <div>
              <h3 style={{ fontSize: '1.02rem', color: 'var(--text-main)', fontWeight: 600 }}>
                Fleet Routing Optimization Principles
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2 }}>
                High-dimensional Capacitated Vehicle Routing Problem with Time Windows (CVRPTW) under time-varying traffic congestion.
              </p>
            </div>
          </div>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.78rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowExplainer(!showExplainer)}
          >
            {showExplainer ? (
              <><span>Hide Details</span> {icons.chevronUp}</>
            ) : (
              <><span>Show Details</span> {icons.chevronDown}</>
            )}
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
              <p>Ensures vehicles arrive within client time windows [e_i, l_i], penalizing early wait times and late delivery delays.</p>
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
          {/* Fleet Shortage Notice if demand exceeds configured vehicles */}
          {isFleetExceeded && (
            <div className="fleet-shortage-alert">
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: 2 }}>
                  Fleet Allocation Exceeded ({activeRoutesCount} active routes vs. {targetVehicles} vehicle target)
                </div>
                <div>
                  Delivering to all <strong>{metrics.num_customers} customer stops</strong> requires <strong>{totalParcelDemand} kg</strong> of capacity.
                  Since each vehicle has a max capacity of <strong>{vehicleCap} kg</strong>, the solver dispatched <strong>{activeRoutesCount} vehicles</strong> to avoid breaking vehicle capacity limits.
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  💡 <strong>To make feasible:</strong> Increase <em>Fleet Vehicles</em> to &ge; {activeRoutesCount} or <em>Vehicle Capacity (Q)</em> to &ge; {Math.ceil(totalParcelDemand / targetVehicles)} kg in the sidebar.
                </div>
              </div>
            </div>
          )}

          {/* Map Controls Toolbar */}
          <div className="map-toolbar">
            <div className="toolbar-left">
              <span className="toolbar-label">Route Isolation:</span>
              <div className="filter-pills">
                <button
                  className={`pill-btn ${selectedVehicle === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedVehicle('all')}
                >
                  All Active ({activeRoutesCount})
                </button>
                {routes.map((rt) => (
                  <button
                    key={`disp-v-${rt.vehicle_id}`}
                    className={`pill-btn ${selectedVehicle === String(rt.vehicle_id) ? 'active' : ''}`}
                    onClick={() => setSelectedVehicle(String(rt.vehicle_id))}
                    style={{ borderColor: selectedVehicle === String(rt.vehicle_id) ? rt.color : undefined }}
                  >
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: rt.color, marginRight: 5 }} />
                    Vehicle {rt.vehicle_id}
                  </button>
                ))}
              </div>
            </div>

            <div className="toolbar-right">
              <span className="sim-clock-indicator" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {icons.clock}
                <span>Clock: <strong>{simClock.toFixed(1)}:00</strong></span>
              </span>
            </div>
          </div>

          <NetworkMap
            mapId="dispatch-main-map"
            data={{
              ...simulationData,
              routes: filteredRoutes
            }}
            title="Urban Road Network & Fleet Routes"
            height={520}
          />

          {/* Time of Day Simulation Scrub Bar */}
          <div className="clock-slider-card">
            <div className="clock-slider-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--color-primary)', display: 'flex' }}>{icons.sun}</span>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>Time-of-Day Traffic Simulation</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                    Morning Rush-Hour: 6:00 AM &ndash; 10:00 AM (Peak at 8:00 AM, &alpha; = 3.8&times;)
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {simClock >= 6.0 && simClock <= 10.0 && (
                  <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                    {simClock === 8.0 ? '🔥 Peak Rush Hour' : '⚠️ Rush-Hour Active'}
                  </span>
                )}
                <span className="clock-badge">
                  {Math.floor(simClock)}:{Math.round((simClock % 1) * 60) === 0 ? '00' : Math.round((simClock % 1) * 60)} {simClock >= 12 ? 'PM' : 'AM'}
                </span>
              </div>
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
                <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>8:00 AM (Peak Rush Hour)</span>
                <span>10:00 AM (Rush Clears)</span>
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
            vehicleCap={metrics?.vehicle_capacity}
          />
        </div>
      </div>
    </div>
  );
}
