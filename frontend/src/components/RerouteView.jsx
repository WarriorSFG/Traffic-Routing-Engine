import React, { useState } from 'react';
import NetworkMap from './NetworkMap';

const rerouteIcons = {
  alertCircle: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  zap: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  slash: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
  incident: (
    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
};

export default function RerouteView({ networkData }) {
  const [loading, setLoading] = useState(false);
  const [rerouteResult, setRerouteResult] = useState(null);
  const [error, setError] = useState(null);

  const handleTriggerIncident = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reroute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const json = await res.json();
      if (json.success) {
        setRerouteResult(json.data);
      } else {
        setError(json.error || 'Dynamic reroute failed.');
      }
    } catch (err) {
      setError(err.message || 'Network error occurred during dynamic reroute.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Banner / Scenario Briefing */}
      <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ maxWidth: '750px' }}>
            <h3 style={{ fontSize: '1.15rem', fontFamily: 'var(--font-display)', color: 'var(--text-main)', fontWeight: 600 }}>
              Live Dynamic Re-Routing Under Traffic Incidents
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
              Demonstrates <strong>warm-started real-time path re-optimization</strong>. When an unexpected road disruption occurs mid-transit, completed legs are frozen and the QPSO swarm re-optimizes remaining stops in sub-second time.
            </p>
          </div>

          <button
            className="btn btn-danger"
            onClick={handleTriggerIncident}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {loading ? (
              <>
                <span className="spinner" /> Injecting Disruption & Solving...
              </>
            ) : (
              <>
                {rerouteIcons.alertCircle}
                <span>Simulate Road Disruption & Reroute</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            color: '#fca5a5',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            {rerouteIcons.alertCircle} {error}
          </div>
        )}

        {rerouteResult && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: 'rgba(52, 211, 153, 0.1)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            padding: '12px 18px',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-success)'
          }}>
            <span style={{ display: 'flex' }}>{rerouteIcons.zap}</span>
            <div>
              <strong>Dynamic Re-Routing Completed in {rerouteResult.rerouted.compute_time_ms.toFixed(2)} ms</strong>
              <div style={{ fontSize: '0.8rem', color: '#a7f3d0', marginTop: 2 }}>
                Disrupted arterial road link ({rerouteResult.disrupted_edge[0]} &harr; {rerouteResult.disrupted_edge[1]}) successfully bypassed.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Side-by-Side Comparison */}
      {rerouteResult ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 20 }}>
          {/* Prior Routing Under Disruption */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger)', fontWeight: 600, fontSize: '0.88rem' }}>
                {rerouteIcons.slash}
                <span>Prior Routing (Blocked Link)</span>
              </div>
              <span className="badge badge-warning">
                Travel Time: {rerouteResult.prior.total_time.toFixed(2)} hrs
              </span>
            </div>

            <NetworkMap
              mapId="reroute-prior-disrupted"
              data={{
                ...networkData,
                edges: rerouteResult.incident_edges,
                routes: rerouteResult.prior.routes
              }}
              highlightEdge={rerouteResult.disrupted_edge}
              title="Disrupted Network State"
              height={460}
            />
          </div>

          {/* Re-Optimized Routes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.88rem' }}>
                {rerouteIcons.refresh}
                <span>Re-Optimized Routes (Warm-Started QPSO)</span>
              </div>
              <span className="badge badge-success">
                New Time: {rerouteResult.rerouted.total_time.toFixed(2)} hrs (saved {(rerouteResult.prior.total_time - rerouteResult.rerouted.total_time).toFixed(2)}h)
              </span>
            </div>

            <NetworkMap
              mapId="reroute-reoptimized-qpso"
              data={{
                ...networkData,
                edges: rerouteResult.incident_edges,
                routes: rerouteResult.rerouted.routes
              }}
              highlightEdge={rerouteResult.disrupted_edge}
              title="Warm-Started QPSO Detour Bypass"
              height={460}
            />
          </div>
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border-subtle)',
          color: 'var(--text-muted)'
        }}>
          <div style={{ color: 'var(--color-primary)', display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            {rerouteIcons.incident}
          </div>
          <h4 style={{ color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 600 }}>Real-Time Disruption Simulator</h4>
          <p style={{ fontSize: '0.85rem', marginTop: 4, maxWidth: '500px', margin: '6px auto 0' }}>
            Click <strong>"Simulate Road Disruption & Reroute"</strong> to inject a live incident on an active delivery corridor and observe instant sub-second QPSO re-optimization.
          </p>
        </div>
      )}
    </div>
  );
}
