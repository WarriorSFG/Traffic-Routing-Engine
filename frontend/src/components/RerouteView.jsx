import React, { useState } from 'react';
import NetworkMap from './NetworkMap';

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
            <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-display)', color: '#ffffff' }}>
              Live Dynamic Re-Routing Under Traffic Incidents
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 4 }}>
              Demonstrates <strong>warm-started real-time path re-optimization</strong>. When an unexpected road disruption occurs mid-transit, completed legs are frozen and the QPSO swarm re-optimizes remaining stops in sub-second time.
            </p>
          </div>

          <button
            className="btn btn-danger"
            onClick={handleTriggerIncident}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" /> Injecting Disruption & Solving...
              </>
            ) : (
              '💥 Simulate Road Disruption & Reroute'
            )}
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', padding: '10px 14px', borderRadius: '6px', color: '#fca5a5', fontSize: '0.85rem' }}>
            ⚠️ {error}
          </div>
        )}

        {rerouteResult && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            padding: '12px 18px',
            borderRadius: '8px',
            color: '#6ee7b7'
          }}>
            <span style={{ fontSize: '1.2rem' }}>⚡</span>
            <div>
              <strong>Dynamic Re-Routing Completed in {rerouteResult.rerouted.compute_time_ms.toFixed(2)} ms!</strong>
              <div style={{ fontSize: '0.8rem', color: '#a7f3d0' }}>
                Disrupted arterial road link ({rerouteResult.disrupted_edge[0]} ⇄ {rerouteResult.disrupted_edge[1]}) successfully bypassed.
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#ff0055', fontWeight: 700 }}>🚫 Prior Routing (Congested / Blocked)</span>
              </div>
              <span className="badge badge-warning">
                Travel Time: {rerouteResult.prior.total_time.toFixed(2)} hrs
              </span>
            </div>

            <NetworkMap
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#00d4ff', fontWeight: 700 }}>🔄 Re-Optimized Routes (Warm-Started QPSO)</span>
              </div>
              <span className="badge badge-success">
                New Time: {rerouteResult.rerouted.total_time.toFixed(2)} hrs (saved {(rerouteResult.prior.total_time - rerouteResult.rerouted.total_time).toFixed(2)}h)
              </span>
            </div>

            <NetworkMap
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
          color: '#64748b'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>💥</div>
          <h4 style={{ color: '#94a3b8', fontSize: '1.05rem', fontWeight: 600 }}>Real-Time Disruption Simulator</h4>
          <p style={{ fontSize: '0.85rem', marginTop: 4, maxWidth: '500px', margin: '6px auto 0' }}>
            Click <strong>"Simulate Road Disruption & Reroute"</strong> to inject a live incident on an active delivery corridor and observe instant sub-second QPSO re-optimization.
          </p>
        </div>
      )}
    </div>
  );
}
