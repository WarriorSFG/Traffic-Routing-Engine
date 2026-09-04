import React, { useState, useMemo } from 'react';
import NetworkMap from './NetworkMap';

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

  const numVehicles = qpsoMetrics.total_vehicles || (qpsoSol.routes ? qpsoSol.routes.length : 4);

  return (
    <div className="comparison-studio">
      {/* Studio Header */}
      <div className="studio-header-card">
        <div className="studio-header-top">
          <div>
            <div className="studio-tag">
              <span className="studio-tag-dot" /> MULTI-SOLVER COMPARISON STUDIO
            </div>
            <h2 className="studio-title">
              What Gets Optimized: <span className="text-gradient-cyan">Baseline vs. Quantum-Inspired PSO</span>
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
                🌲 Greedy Nearest Neighbor (GNN)
              </button>
              <button
                className={`btn-toggle ${baselineAlgo === 'pso' ? 'active' : ''}`}
                onClick={() => setBaselineAlgo('pso')}
              >
                🪐 Classical PSO (Kennedy-Eberhart)
              </button>
            </div>
          </div>
        </div>

        {/* Quantified Optimization Delta Cards */}
        <div className="delta-cards-grid">
          {/* 1. Fleet Travel Time Saved */}
          <div className="delta-card highlight-cyan">
            <div className="delta-card-header">
              <span className="delta-card-icon">⏱️</span>
              <span className="delta-card-label">Fleet Travel Time</span>
              <span className={`delta-chip ${deltas.timeDiff >= 0 ? 'chip-success' : 'chip-warning'}`}>
                {deltas.timeDiff >= 0 ? `▼ ${deltas.timePct.toFixed(1)}% SAVED` : `▲ +${Math.abs(deltas.timePct).toFixed(1)}%`}
              </span>
            </div>
            <div className="delta-main-stat">
              <span className="delta-value-winner">{deltas.qpsoTime.toFixed(2)}h</span>
              <span className="delta-vs">vs</span>
              <span className="delta-value-loser">{deltas.baseTime.toFixed(2)}h</span>
            </div>
            <div className="delta-subtext">
              {deltas.timeDiff >= 0 ? (
                <>Saved <strong>{deltas.timeDiff.toFixed(2)} hours</strong> across the entire vehicle fleet.</>
              ) : (
                <>Baseline travel time was slightly shorter, but may violate constraints.</>
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
              <span className="delta-card-icon">📏</span>
              <span className="delta-card-label">Physical Road Distance</span>
              <span className={`delta-chip ${deltas.distDiff >= 0 ? 'chip-success' : 'chip-neutral'}`}>
                {deltas.distDiff >= 0 ? `▼ ${deltas.distDiff.toFixed(1)} km` : `▲ +${Math.abs(deltas.distDiff).toFixed(1)} km`}
              </span>
            </div>
            <div className="delta-main-stat">
              <span className="delta-value-winner">{deltas.qpsoDist.toFixed(1)} km</span>
              <span className="delta-vs">vs</span>
              <span className="delta-value-loser">{deltas.baseDist.toFixed(1)} km</span>
            </div>
            <div className="delta-subtext">
              Total physical kilometers driven over planar road corridors.
            </div>
          </div>

          {/* 3. Feasibility & Constraint Safety */}
          <div className="delta-card">
            <div className="delta-card-header">
              <span className="delta-card-icon">🛡️</span>
              <span className="delta-card-label">Feasibility & Constraints</span>
              <span className={`delta-chip ${qpsoMetrics.is_feasible ? 'chip-success' : 'chip-warning'}`}>
                {qpsoMetrics.is_feasible ? '✅ 100% FEASIBLE' : 'PENALIZED'}
              </span>
            </div>
            <div className="delta-main-stat">
              <span className="delta-value-winner">
                {qpsoMetrics.is_feasible ? 'Valid Fleet Plan' : 'Near Feasible'}
              </span>
            </div>
            <div className="delta-subtext">
              Cap Violations: <strong>{qpsoMetrics.total_capacity_violation || 0} kg</strong> &bull; Late Penalties: <strong>{qpsoMetrics.total_tw_penalty || 0}</strong>
            </div>
          </div>

          {/* 4. Algorithmic Compute Latency */}
          <div className="delta-card">
            <div className="delta-card-header">
              <span className="delta-card-icon">⚡</span>
              <span className="delta-card-label">C++ Solver Compute Latency</span>
              <span className="delta-chip chip-cyan">C++20 OpenMP</span>
            </div>
            <div className="delta-main-stat">
              <span className="delta-value-winner">{deltas.qpsoComp.toFixed(2)} ms</span>
              <span className="delta-vs">vs</span>
              <span className="delta-value-loser">{deltas.baseComp.toFixed(2)} ms</span>
            </div>
            <div className="delta-subtext">
              Sub-50ms execution speed suitable for real-time dispatch systems.
            </div>
          </div>
        </div>

        {/* Vehicle Filter Bar */}
        <div className="vehicle-filter-row">
          <span className="filter-label">Filter Vehicle Route:</span>
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
                Vehicle #{vId}
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
              <span className="map-badge qpso-badge">QUANTUM-INSPIRED LEADER</span>
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
            data={{
              ...simulationData,
              routes: qpsoFilteredRoutes
            }}
            title="QPSO Optimized Routes (Quantum Detour Bypass)"
            height={500}
          />
        </div>
      </div>

      {/* Route-by-Route Breakdown Comparison Table */}
      <div className="tour-comparison-card">
        <div className="tour-comparison-header">
          <h3 className="section-title">
            📋 Vehicle Tour Schedule Comparison: Baseline vs. QPSO
          </h3>
          <p className="section-subtitle">
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
                  <div className="vehicle-id-badge" style={{ backgroundColor: qpsoR?.color || '#00d4ff' }}>
                    Vehicle #{k + 1}
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
          <div className="why-icon">💡</div>
          <div>
            <h4 style={{ fontSize: '1.1rem', color: '#f3f6fb', fontWeight: 600 }}>
              The Mathematical Mechanism: Why Quantum-Inspired PSO Bypasses Congestion
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 4 }}>
              As formulated in <strong>Reference.md §11</strong>, traditional routing heuristics suffer from fundamental entrapment modes:
            </p>
          </div>
        </div>

        <div className="why-pillars-grid">
          <div className="why-pillar">
            <div className="pillar-header">
              <span className="pillar-icon">🚫</span>
              <span className="pillar-title">Greedy Heuristics Trap</span>
            </div>
            <p className="pillar-text">
              Greedy Nearest Neighbor (GNN) greedily connects to the closest physical neighbor. During rush-hour peaks (8:00 AM), this sends vehicles straight through congested arterial intersections (&alpha; &gt; 3.0), causing fleet delays.
            </p>
          </div>

          <div className="why-pillar">
            <div className="pillar-header">
              <span className="pillar-icon">⚠️</span>
              <span className="pillar-title">Classical Velocity Bounds</span>
            </div>
            <p className="pillar-text">
              Classical PSO relies on velocity vector clamping v_ij &isin; [-v_max, v_max]. Once trapped in a local basin of attraction around a bottleneck, particles lack kinetic momentum to jump over high penalty ridges.
            </p>
          </div>

          <div className="why-pillar pillar-highlight">
            <div className="pillar-header">
              <span className="pillar-icon">⚛️</span>
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
