import React from 'react';

const metricIcons = {
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="2" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  zap: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
};

export default function MetricsBar({ metrics }) {
  if (!metrics) return null;

  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <span className="metric-label">{metricIcons.clock} Total Travel Time</span>
        <span className="metric-value">{metrics.total_time?.toFixed(2)} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>hrs</span></span>
        <span className="metric-footer">Congestion-adjusted time</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">{metricIcons.pin} Total Distance</span>
        <span className="metric-value">{metrics.total_distance?.toFixed(1)} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>km</span></span>
        <span className="metric-footer">Road network traversal</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">{metricIcons.truck} Fleet Vehicles</span>
        <span className="metric-value" style={{ color: 'var(--color-primary)' }}>
          {metrics.vehicles_utilized} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ {metrics.total_vehicles}</span>
        </span>
        <span className="metric-footer">Active delivery routes</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">{metricIcons.zap} Compute Time</span>
        <span className="metric-value" style={{ color: 'var(--color-primary)' }}>
          {metrics.compute_time_ms?.toFixed(2)} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ms</span>
        </span>
        <span className="metric-footer">C++ QPSO kernel</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">{metricIcons.shield} Constraints</span>
        <span className="metric-value" style={{ fontSize: '1.2rem', color: metrics.is_feasible ? 'var(--color-success)' : 'var(--color-warning)' }}>
          {metrics.is_feasible ? 'Feasible' : 'Penalized'}
        </span>
        <span className="metric-footer">Capacity & Time Windows</span>
      </div>
    </div>
  );
}
