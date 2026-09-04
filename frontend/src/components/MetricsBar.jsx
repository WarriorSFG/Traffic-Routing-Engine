import React from 'react';

export default function MetricsBar({ metrics }) {
  if (!metrics) return null;

  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <span className="metric-label">⏱️ Total Travel Time</span>
        <span className="metric-value">{metrics.total_time?.toFixed(2)} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>hrs</span></span>
        <span className="metric-footer">Congestion-adjusted time</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">📍 Total Distance</span>
        <span className="metric-value">{metrics.total_distance?.toFixed(1)} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>km</span></span>
        <span className="metric-footer">Physical road network traversal</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">🚚 Fleet Vehicles</span>
        <span className="metric-value" style={{ color: '#38bdf8' }}>
          {metrics.vehicles_utilized} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>/ {metrics.total_vehicles}</span>
        </span>
        <span className="metric-footer">Active delivery routes</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">⚡ C++ Compute Time</span>
        <span className="metric-value" style={{ color: '#00d4ff' }}>
          {metrics.compute_time_ms?.toFixed(2)} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>ms</span>
        </span>
        <span className="metric-footer">Compiled C++ QPSO kernel</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">🛡️ Constraint Status</span>
        <span className="metric-value" style={{ fontSize: '1.3rem', color: metrics.is_feasible ? '#10b981' : '#f59e0b' }}>
          {metrics.is_feasible ? '✅ Feasible' : '⚠️ Penalized'}
        </span>
        <span className="metric-footer">Capacity & Time Windows</span>
      </div>
    </div>
  );
}
