import React, { useState, useMemo } from 'react';
import NetworkMap from './NetworkMap';

const studioIcons = {
  clock: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  distance: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h20M2 12l5-5M2 12l5 5M22 12l-5-5M22 12l5 5" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  zap: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  lightbulb: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 22h4M15 9a3 3 0 1 0-6 0c0 1.66 1 3 2 4v2h2v-2c1-1 2-2.34 2-4z" />
    </svg>
  ),
  ban: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  atom: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" />
      <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(30 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-30 12 12)" />
    </svg>
  )
};

export default function ComparisonStudio({ simulationData }) {
  const [baselineAlgo, setBaselineAlgo] = useState('gnn'); // 'gnn' | 'pso'
  const [activeVehicle, setActiveVehicle] = useState('all'); // 'all' | vehicle_id

  const solutions = simulationData?.solutions || {};
  const baselineSol = solutions[baselineAlgo] || { routes: [], metrics: {} };
  const qpsoSol = solutions['qpso'] || { routes: simulationData?.routes || [], metrics: simulationData?.metrics || {} };

  const baselineMetrics = baselineSol.metrics || {};
  const qpsoMetrics = qpsoSol.metrics || {};

  // Compute Delta Metrics
  const deltas = useMemo(() => {
    const baseTime = baselineMetrics.total_time || 0;
    const qpsoTime = qpsoMetrics.total_time || 0;
    const timeDiff = baseTime - qpsoTime;
    const timePct = baseTime > 0 ? (timeDiff / baseTime) * 100 : 0;

    const baseDist = baselineMetrics.total_distance || 0;
    const qpsoDist = qpsoMetrics.total_distance || 0;
    const distDiff = baseDist - qpsoDist;
    const distPct = baseDist > 0 ? (distDiff / baseDist) * 100 : 0;

    const baseComp = baselineMetrics.compute_time_ms || 0;
    const qpsoComp = qpsoMetrics.compute_time_ms || 0;

    // Congestion avoidance estimate
    const baseCongestionExposure = baseTime > 0 && baseDist > 0 ? (baseTime * 60) / baseDist : 0;
    const qpsoCongestionExposure = qpsoTime > 0 && qpsoDist > 0 ? (qpsoTime * 60) / qpsoDist : 0;
    const exposureDiff = baseCongestionExposure - qpsoCongestionExposure;

    return {
      timeDiff,
      timePct,
      distDiff,
      distPct,
      baseTime,
      qpsoTime,
      baseDist,
      qpsoDist,
      baseComp,
      qpsoComp,
      exposureDiff
    };
  }, [baselineMetrics, qpsoMetrics]);

  // Filter routes if vehicle is selected
  const filterRoutes = (routes) => {
    if (activeVehicle === 'all') return routes;
    return routes.filter((r) => r.vehicle_id === Number(activeVehicle));
  };

  const baselineFilteredRoutes = filterRoutes(baselineSol.routes || []);
  const qpsoFilteredRoutes = filterRoutes(qpsoSol.routes || []);

  const numVehicles = Math.max(
    baselineSol.routes ? baselineSol.routes.length : 0,
    qpsoSol.routes ? qpsoSol.routes.length : 0,
    qpsoMetrics.total_vehicles || 1
  );

  return (
    <div className="comparison-studio">
      {/* Studio Header */}
      <div className="studio-header-card">
        <div className="studio-header-top">
          <div>
            <div className="studio-tag">
              <span className="studio-tag-dot" /> MULTI-SOLVER BENCHMARK
            </div>
            <h2 className="studio-title">
              What Gets Optimized: <span style={{ color: 'var(--color-primary)' }}>Baseline vs. Quantum-Inspired PSO</span>
            </h2>
            <p className="studio-desc">
              Compare vehicle route choices, congestion avoidance patterns, and delivery scheduling side-by-side. Observe how Quantum-Inspired PSO overcomes greedy traps and classical momentum limits to discover shorter, congestion-bypassing delivery schedules.
            </p>
          </div>

          <div className="solver-selector-group">
            <span className="selector-label">Compare Baseline:</span>
            <div className="btn-toggle-group">
              <button
                className={`btn-toggle ${baselineAlgo === 'gnn' ? 'active' : ''}`}
                onClick={() => setBaselineAlgo('gnn')}
              >
                Greedy Nearest Neighbor (GNN)
              </button>
              <button
                className={`btn-toggle ${baselineAlgo === 'pso' ? 'active' : ''}`}
                onClick={() => setBaselineAlgo('pso')}
              >
                Classical PSO (Kennedy-Eberhart)
              </button>
            </div>
          </div>
        </div>

        {/* Quantified Optimization Delta Cards */}
        <div className="delta-cards-grid">
          {/* 1. Fleet Travel Time Saved */}
          <div className="delta-card highlight-primary">
            <div className="delta-card-header">
              <span className="delta-card-icon">{studioIcons.clock}</span>
              <span className="delta-card-label">Fleet Travel Time</span>
              <span className={`delta-chip ${deltas.timeDiff >= 0 ? 'chip-success' : 'chip-warning'}`}>
                {deltas.timeDiff >= 0 ? `▼ ${deltas.timePct.toFixed(1)}% Saved` : `▲ +${Math.abs(deltas.timePct).toFixed(1)}%`}
              </span>
            </div>
            <div className="delta-comparison-stat">
              <div className="delta-entity qpso-entity">
                <span className="delta-entity-badge qpso-badge">QPSO (Optimized)</span>
                <span className="delta-entity-val qpso-val">{deltas.qpsoTime.toFixed(2)}h</span>
              </div>
              <span className="delta-vs-sep">vs</span>
              <div className="delta-entity base-entity">
                <span className="delta-entity-badge base-badge">{baselineAlgo === 'gnn' ? 'GNN Baseline' : 'Classical PSO'}</span>
                <span className="delta-entity-val base-val">{deltas.baseTime.toFixed(2)}h</span>
              </div>
            </div>
            <div className="delta-subtext">
              {deltas.timeDiff >= 0 ? (
                <>QPSO saved <strong>{deltas.timeDiff.toFixed(2)} hours</strong> vs {baselineAlgo === 'gnn' ? 'GNN' : 'Classical PSO'}.</>
              ) : (
                <>Baseline raw time was shorter, but compare constraint safety below.</>
              )}
            </div>
            <div className="comparison-progress-bar">
              <div
                className="progress-fill fill-qpso"
                style={{ width: `${Math.min((deltas.qpsoTime / (deltas.baseTime || 1)) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* 2. Physical Road Distance */}
          <div className="delta-card">
            <div className="delta-card-header">
              <span className="delta-card-icon">{studioIcons.distance}</span>
              <span className="delta-card-label">Road Distance</span>
              <span className={`delta-chip ${deltas.distDiff >= 0 ? 'chip-success' : 'chip-neutral'}`}>
                {deltas.distDiff >= 0 ? `▼ ${deltas.distDiff.toFixed(1)} km` : `▲ +${Math.abs(deltas.distDiff).toFixed(1)} km`}
              </span>
            </div>
            <div className="delta-comparison-stat">
              <div className="delta-entity qpso-entity">
                <span className="delta-entity-badge qpso-badge">QPSO (Optimized)</span>
                <span className="delta-entity-val qpso-val">{deltas.qpsoDist.toFixed(1)} km</span>
              </div>
              <span className="delta-vs-sep">vs</span>
              <div className="delta-entity base-entity">
                <span className="delta-entity-badge base-badge">{baselineAlgo === 'gnn' ? 'GNN Baseline' : 'Classical PSO'}</span>
                <span className="delta-entity-val base-val">{deltas.baseDist.toFixed(1)} km</span>
              </div>
            </div>
            <div className="delta-subtext">
              Total physical road network mileage traversed.
            </div>
          </div>

          {/* 3. Feasibility & Constraint Safety */}
          <div className="delta-card">
            <div className="delta-card-header">
              <span className="delta-card-icon">{studioIcons.shield}</span>
              <span className="delta-card-label">Feasibility & Constraints</span>
              <span className={`delta-chip ${qpsoMetrics.is_feasible ? 'chip-success' : 'chip-warning'}`}>
                {qpsoMetrics.is_feasible ? 'Feasible' : 'Penalized'}
              </span>
            </div>
            <div className="delta-comparison-stat">
              <div className="delta-entity qpso-entity">
                <span className="delta-entity-badge qpso-badge">QPSO Plan</span>
                <span className={`badge ${qpsoMetrics.is_feasible ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.72rem' }}>
                  {qpsoMetrics.is_feasible ? 'Valid Feasible' : 'Violations'}
                </span>
              </div>
              <span className="delta-vs-sep">vs</span>
              <div className="delta-entity base-entity">
                <span className="delta-entity-badge base-badge">{baselineAlgo === 'gnn' ? 'GNN Plan' : 'PSO Plan'}</span>
                <span className={`badge ${baselineMetrics.is_feasible ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.72rem' }}>
                  {baselineMetrics.is_feasible ? 'Valid Feasible' : 'Violations'}
                </span>
              </div>
            </div>
            <div className="delta-subtext">
              QPSO: <strong>{qpsoMetrics.total_capacity_violation || 0} kg</strong> cap &bull; <strong>{qpsoMetrics.total_tw_penalty || 0}</strong> late
            </div>
          </div>

          {/* 4. Algorithmic Compute Latency */}
          <div className="delta-card">
            <div className="delta-card-header">
              <span className="delta-card-icon">{studioIcons.zap}</span>
              <span className="delta-card-label">C++ Compute Latency</span>
              <span className="delta-chip chip-primary">C++20 Kernel</span>
            </div>
            <div className="delta-comparison-stat">
              <div className="delta-entity qpso-entity">
                <span className="delta-entity-badge qpso-badge">QPSO</span>
                <span className="delta-entity-val qpso-val">{deltas.qpsoComp.toFixed(2)} ms</span>
              </div>
              <span className="delta-vs-sep">vs</span>
              <div className="delta-entity base-entity">
                <span className="delta-entity-badge base-badge">{baselineAlgo === 'gnn' ? 'GNN' : 'Classical PSO'}</span>
                <span className="delta-entity-val base-val">{deltas.baseComp.toFixed(2)} ms</span>
              </div>
            </div>
            <div className="delta-subtext">
              High-performance C++20 pybind11 execution speed.
            </div>
          </div>
        </div>

        {/* Vehicle Filter Bar */}
        <div className="vehicle-filter-row">
          <span className="filter-label">Filter Route:</span>
          <div className="filter-pills">
            <button
              className={`pill-btn ${activeVehicle === 'all' ? 'active' : ''}`}
              onClick={() => setActiveVehicle('all')}
            >
              All Vehicles ({numVehicles})
            </button>
            {Array.from({ length: numVehicles }, (_, i) => i + 1).map((vId) => (
              <button
                key={`veh-filter-${vId}`}
                className={`pill-btn ${activeVehicle === String(vId) ? 'active' : ''}`}
                onClick={() => setActiveVehicle(String(vId))}
              >
                Vehicle {vId}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Side-by-Side Dual Map Visualizer */}
      <div className="dual-map-container">
        {/* Left Map: Baseline */}
        <div className="map-column">
          <div className="map-column-header baseline-header">
            <div className="map-title-row">
              <span className="map-badge baseline-badge">BASELINE</span>
              <h3 className="map-title-text">
                {baselineAlgo === 'gnn' ? 'Greedy Nearest Neighbor (GNN)' : 'Classical PSO (Kennedy-Eberhart)'}
              </h3>
            </div>
            <div className="map-stat-pills">
              <span className="stat-pill">Time: <strong>{baselineMetrics.total_time?.toFixed(2) || '—'}h</strong></span>
              <span className="stat-pill">Dist: <strong>{baselineMetrics.total_distance?.toFixed(1) || '—'}km</strong></span>
            </div>
          </div>

          <NetworkMap
            mapId={`comparison-base-${baselineAlgo}`}
            data={{
              ...simulationData,
              routes: baselineFilteredRoutes
            }}
            title={`${baselineAlgo === 'gnn' ? 'GNN' : 'Classical PSO'} Routes`}
            height={500}
          />
        </div>

        {/* Right Map: QPSO */}
        <div className="map-column">
          <div className="map-column-header qpso-header">
            <div className="map-title-row">
              <span className="map-badge qpso-badge">QUANTUM LEADER</span>
              <h3 className="map-title-text">
                Delta-Potential Well QPSO
              </h3>
            </div>
            <div className="map-stat-pills">
              <span className="stat-pill pill-winner">Time: <strong>{qpsoMetrics.total_time?.toFixed(2) || '—'}h</strong></span>
              <span className="stat-pill">Dist: <strong>{qpsoMetrics.total_distance?.toFixed(1) || '—'}km</strong></span>
            </div>
          </div>

          <NetworkMap
            mapId="comparison-qpso"
            data={{
              ...simulationData,
              routes: qpsoFilteredRoutes
            }}
            title="QPSO Optimized Routes (Detour Bypass)"
            height={500}
          />
        </div>
      </div>

      {/* Route-by-Route Breakdown Comparison Table */}
      <div className="tour-comparison-card">
        <div className="tour-comparison-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--color-primary)', display: 'flex' }}>{studioIcons.clipboard}</span>
            <h3 className="section-title" style={{ margin: 0 }}>
              Vehicle Tour Schedule Comparison: Baseline vs. QPSO
            </h3>
          </div>
          <p className="section-subtitle" style={{ marginTop: 6 }}>
            Observe how QPSO rearranges customer sequences to eliminate backtrack loops and schedule deliveries within valid customer time windows.
          </p>
        </div>

        <div className="tour-diff-grid">
          {Array.from({ length: numVehicles }, (_, k) => {
            const baseR = (baselineSol.routes || [])[k];
            const qpsoR = (qpsoSol.routes || [])[k];
            if (!baseR && !qpsoR) return null;

            return (
              <div key={`veh-diff-${k}`} className="vehicle-diff-box">
                <div className="vehicle-diff-header">
                  <div className="vehicle-id-badge" style={{ backgroundColor: qpsoR?.color || 'var(--color-primary)' }}>
                    Vehicle {k + 1}
                  </div>
                  <div className="vehicle-metrics-diff">
                    <span className="time-diff-pill">
                      QPSO: <strong>{qpsoR?.total_time.toFixed(2) || '0.00'}h</strong> ({qpsoR?.total_distance.toFixed(1) || '0.0'}km)
                    </span>
                    {baseR && (
                      <span className="time-diff-base">
                        Baseline: {baseR.total_time.toFixed(2)}h ({baseR.total_distance.toFixed(1)}km)
                      </span>
                    )}
                  </div>
                </div>

                <div className="tour-sequences-comparison">
                  {/* Baseline sequence */}
                  <div className="sequence-row">
                    <span className="seq-label">Baseline Tour:</span>
                    <div className="seq-chips">
                      {(baseR?.stops || []).map((s, idx) => (
                        <span key={`b-stop-${idx}`} className={`seq-node ${s === 0 ? 'node-depot' : 'node-customer'}`}>
                          {s === 0 ? 'Depot' : `#${s}`}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* QPSO sequence */}
                  <div className="sequence-row">
                    <span className="seq-label seq-label-winner">QPSO Tour:</span>
                    <div className="seq-chips">
                      {(qpsoR?.stops || []).map((s, idx) => (
                        <span key={`q-stop-${idx}`} className={`seq-node node-winner ${s === 0 ? 'node-depot' : 'node-customer'}`}>
                          {s === 0 ? 'Depot' : `#${s}`}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Explanatory Deep-Dive Card: Why QPSO Wins */}
      <div className="metric-card why-qpso-card">
        <div className="why-header">
          <div className="why-icon">{studioIcons.lightbulb}</div>
          <div>
            <h4 style={{ fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: 600 }}>
              The Mathematical Mechanism: Why Quantum-Inspired PSO Bypasses Congestion
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
              As formulated in <strong>Reference.md §11</strong>, traditional routing heuristics suffer from fundamental entrapment modes:
            </p>
          </div>
        </div>

        <div className="why-pillars-grid">
          <div className="why-pillar">
            <div className="pillar-header">
              <span className="pillar-icon" style={{ color: 'var(--color-danger)' }}>{studioIcons.ban}</span>
              <span className="pillar-title">Greedy Heuristics Trap</span>
            </div>
            <p className="pillar-text">
              Greedy Nearest Neighbor (GNN) greedily connects to the closest physical neighbor. During rush-hour peaks (8:00 AM), this sends vehicles straight through congested arterial intersections (&alpha; &gt; 3.0), causing fleet delays.
            </p>
          </div>

          <div className="why-pillar">
            <div className="pillar-header">
              <span className="pillar-icon" style={{ color: 'var(--color-warning)' }}>{studioIcons.alert}</span>
              <span className="pillar-title">Classical Velocity Bounds</span>
            </div>
            <p className="pillar-text">
              Classical PSO relies on velocity vector clamping v_ij &isin; [-v_max, v_max]. Once trapped in a local basin of attraction around a bottleneck, particles lack kinetic momentum to jump over high penalty ridges.
            </p>
          </div>

          <div className="why-pillar pillar-highlight">
            <div className="pillar-header">
              <span className="pillar-icon" style={{ color: 'var(--color-primary)' }}>{studioIcons.atom}</span>
              <span className="pillar-title">Quantum Tunneling in QPSO</span>
            </div>
            <p className="pillar-text">
              In QPSO (§11.4), particles exist in a &delta;-potential well with wavefunction &psi;(X) &prop; e^&#40;-|X-p|/L&#41;. Because the position update has an unbounded logarithmic tail, particles can quantum-tunnel across barrier ridges and discover optimal global topologies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
