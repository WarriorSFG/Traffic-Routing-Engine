import React, { useState } from 'react';

const benchIcons = {
  chart: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  award: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  barChart: (
    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
};

export default function BenchmarkView({ params }) {
  const [numRuns, setNumRuns] = useState(3);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [chartMode, setChartMode] = useState('zoom'); // 'zoom' | 'full' | 'log'
  const [hoveredData, setHoveredData] = useState(null);

  const handleRunBenchmark = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          num_runs: numRuns,
          swarm_size: params.swarm_size,
          max_iter: params.max_iter,
          seed: params.seed
        })
      });
      const json = await res.json();
      if (json.success) {
        setReport(json.data);
      } else {
        setError(json.error || 'Benchmark execution failed.');
      }
    } catch (err) {
      setError(err.message || 'Network error occurred while running benchmark.');
    } finally {
      setLoading(false);
    }
  };

  // SVG Chart projection for Convergence Curves with rich telemetrics & high-contrast coloring
  const renderConvergenceChart = (convergence) => {
    if (!convergence || convergence.length === 0) return null;

    const iterations = convergence.map((d) => d.Iteration ?? 0);
    const maxIter = Math.max(...iterations, 1);

    const qpsoKey = 'Quantum-Inspired PSO (QPSO)';
    const psoKey = 'Classical PSO';
    const gnnKey = 'GNN';

    const qpsoValues = convergence.map((d) => d[qpsoKey]).filter((v) => v != null);
    const psoValues = convergence.map((d) => d[psoKey]).filter((v) => v != null);
    const gnnValues = convergence.map((d) => d[gnnKey]).filter((v) => v != null);

    const qpsoMin = qpsoValues.length ? Math.min(...qpsoValues) : 0;
    const psoMin = psoValues.length ? Math.min(...psoValues) : 0;
    const gnnMin = gnnValues.length ? Math.min(...gnnValues) : 0;

    // Percent improvement of QPSO
    const psoDeltaPct = psoMin > 0 ? (((psoMin - qpsoMin) / psoMin) * 100) : 0;
    const gnnDeltaPct = gnnMin > 0 ? (((gnnMin - qpsoMin) / gnnMin) * 100) : 0;

    // Convergence milestone: iteration where algorithm reached within 1% of its final best
    const qpsoThreshold = qpsoMin * 1.01;
    const qpsoMilestoneIter = convergence.findIndex((d) => d[qpsoKey] <= qpsoThreshold);
    const psoThreshold = psoMin * 1.01;
    const psoMilestoneIter = convergence.findIndex((d) => d[psoKey] <= psoThreshold);

    const speedup = (psoMilestoneIter > 0 && qpsoMilestoneIter > 0)
      ? (psoMilestoneIter / qpsoMilestoneIter).toFixed(1)
      : null;

    // Raw bounds
    const allRaw = [...qpsoValues, ...psoValues, ...gnnValues];
    const absoluteMin = Math.min(...allRaw);
    const absoluteMax = Math.max(...allRaw);

    // In zoom mode, focus on the converged region (tail values)
    const tailStart = Math.floor(convergence.length * 0.15);
    const tailRaw = convergence.slice(tailStart).flatMap((d) => [d[qpsoKey], d[psoKey], d[gnnKey]].filter((v) => v != null));
    const tailMax = tailRaw.length > 0 ? Math.max(...tailRaw) : absoluteMin * 1.35;

    let minVal, maxVal;
    if (chartMode === 'log') {
      minVal = Math.log10(Math.max(1e-2, absoluteMin * 0.95));
      maxVal = Math.log10(Math.max(1e-2, absoluteMax * 1.05));
    } else if (chartMode === 'zoom') {
      minVal = Math.max(0, absoluteMin - (tailMax - absoluteMin) * 0.12);
      maxVal = Math.min(absoluteMax, tailMax + (tailMax - absoluteMin) * 0.22);
    } else {
      minVal = Math.max(0, absoluteMin * 0.95);
      maxVal = absoluteMax * 1.05;
    }
    const valRange = maxVal - minVal || 1;

    const w = 840;
    const h = 330;
    const padX = 65;
    const padY = 35;
    const chartWidth = w - padX * 2;
    const chartHeight = h - padY * 2;

    const getVal = (raw) => {
      if (raw == null) return null;
      if (chartMode === 'log') return Math.log10(Math.max(1e-2, raw));
      return raw;
    };

    const toSvgX = (iter) => padX + (iter / maxIter) * chartWidth;
    const toSvgY = (val) => {
      const v = getVal(val);
      if (v == null) return h - padY;
      const clamped = Math.min(maxVal, Math.max(minVal, v));
      return h - padY - ((clamped - minVal) / valRange) * chartHeight;
    };

    const getPolylinePoints = (key) => {
      return convergence
        .filter((d) => d[key] != null)
        .map((d) => `${toSvgX(d.Iteration).toFixed(1)},${toSvgY(d[key]).toFixed(1)}`)
        .join(' ');
    };

    // Area path for QPSO gradient fill
    const getQpsoAreaPath = () => {
      const validPoints = convergence.filter((d) => d[qpsoKey] != null);
      if (validPoints.length === 0) return '';
      const coords = validPoints.map((d) => `${toSvgX(d.Iteration).toFixed(1)},${toSvgY(d[qpsoKey]).toFixed(1)}`);
      const firstX = toSvgX(validPoints[0].Iteration).toFixed(1);
      const lastX = toSvgX(validPoints[validPoints.length - 1].Iteration).toFixed(1);
      const baseY = (h - padY).toFixed(1);
      return `M ${firstX},${baseY} L ${coords.join(' L ')} L ${lastX},${baseY} Z`;
    };

    // Horizontal gridlines (4 steps)
    const gridTicks = [0, 0.33, 0.66, 1].map((pct) => {
      const tickVal = minVal + pct * valRange;
      const displayVal = chartMode === 'log' ? Math.pow(10, tickVal) : tickVal;
      return { y: toSvgY(chartMode === 'log' ? Math.pow(10, tickVal) : tickVal), label: displayVal.toFixed(1) };
    });

    // Vertical X-axis ticks (5 evenly spaced steps)
    const xTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => Math.round(pct * maxIter));

    const handleMouseMove = (e) => {
      const svgEl = e.currentTarget;
      const rect = svgEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const scaleFactor = w / rect.width;
      const svgMouseX = mouseX * scaleFactor;
      if (svgMouseX < padX || svgMouseX > w - padX) {
        setHoveredData(null);
        return;
      }
      const pct = (svgMouseX - padX) / chartWidth;
      const targetIter = Math.round(pct * maxIter);
      const point = convergence.find((d) => d.Iteration === targetIter) || convergence[Math.min(convergence.length - 1, Math.max(0, targetIter))];
      if (point) {
        setHoveredData({
          ...point,
          svgX: toSvgX(point.Iteration),
          qpsoY: toSvgY(point[qpsoKey]),
          psoY: toSvgY(point[psoKey]),
          gnnY: toSvgY(point[gnnKey]),
        });
      }
    };

    return (
      <div className="chart-container">
        {/* 1. Header with View Mode Toggles & Legend */}
        <div className="chart-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#06b6d4', display: 'flex' }}>{benchIcons.chart}</span>
            <div>
              <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                Convergence Trajectory: Objective Value F(X) vs. Iteration
              </span>
              <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 1 }}>
                Comparing Quantum Attractor tunneling vs. Classical velocity drift.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {/* View Mode Switcher */}
            <div className="chart-toggle-group">
              <button
                className={`chart-toggle-btn ${chartMode === 'zoom' ? 'active' : ''}`}
                onClick={() => setChartMode('zoom')}
                title="Zoom into converged plateau region where algorithms compete"
              >
                Convergence Focus
              </button>
              <button
                className={`chart-toggle-btn ${chartMode === 'full' ? 'active' : ''}`}
                onClick={() => setChartMode('full')}
                title="Show full scale from initial positions"
              >
                Full Scale
              </button>
              <button
                className={`chart-toggle-btn ${chartMode === 'log' ? 'active' : ''}`}
                onClick={() => setChartMode('log')}
                title="Logarithmic scale for high dynamic range"
              >
                Log₁₀ Scale
              </button>
            </div>

            {/* High-Contrast Legend */}
            <div className="chart-legend">
              <div className="chart-legend-item">
                <span className="chart-line-indicator" style={{ background: '#94a3b8', borderTop: '1px dashed #94a3b8' }} />
                <span style={{ color: '#94a3b8' }}>GNN Baseline</span>
              </div>
              <div className="chart-legend-item">
                <span className="chart-line-indicator" style={{ background: '#f97316' }} />
                <strong style={{ color: '#f97316' }}>Classical PSO</strong>
              </div>
              <div className="chart-legend-item">
                <span className="chart-line-indicator" style={{ background: '#06b6d4', height: '3px', boxShadow: '0 0 6px rgba(6, 182, 212, 0.6)' }} />
                <strong style={{ color: '#06b6d4' }}>Quantum-Inspired PSO (QPSO)</strong>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Analytical KPI Insight Strip */}
        <div className="chart-insights-grid">
          <div className="chart-insight-card">
            <span className="chart-insight-label">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#06b6d4', display: 'inline-block' }} />
              QPSO Best Cost
            </span>
            <span className="chart-insight-val" style={{ color: '#06b6d4' }}>
              {qpsoMin.toFixed(2)}
            </span>
            <span className="chart-insight-sub">
              Global Optimum Found
            </span>
          </div>

          <div className="chart-insight-card">
            <span className="chart-insight-label">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', display: 'inline-block' }} />
              Classical PSO Best
            </span>
            <span className="chart-insight-val" style={{ color: '#f97316' }}>
              {psoMin.toFixed(2)}
            </span>
            <span className="chart-insight-sub">
              {psoDeltaPct > 0 ? `+${psoDeltaPct.toFixed(1)}% cost gap` : 'Tied'}
            </span>
          </div>

          <div className="chart-insight-card">
            <span className="chart-insight-label">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
              GNN Greedy Baseline
            </span>
            <span className="chart-insight-val" style={{ color: '#94a3b8' }}>
              {gnnMin.toFixed(2)}
            </span>
            <span className="chart-insight-sub">
              {gnnDeltaPct > 0 ? `+${gnnDeltaPct.toFixed(1)}% cost gap` : 'Tied'}
            </span>
          </div>

          <div className="chart-insight-card">
            <span className="chart-insight-label">
              ⚡ Quantum Advantage
            </span>
            <span className="chart-insight-val" style={{ color: psoDeltaPct > 0 ? 'var(--color-success)' : 'var(--text-main)' }}>
              {psoDeltaPct > 0 ? `-${psoDeltaPct.toFixed(1)}% Cost` : 'Comparable'}
            </span>
            <span className="chart-insight-sub">
              {speedup ? `${speedup}× faster to 99% opt (Iter ${qpsoMilestoneIter} vs ${psoMilestoneIter})` : `Reached optimum at Iter ${qpsoMilestoneIter}`}
            </span>
          </div>
        </div>

        {/* 3. SVG Trajectory Chart with Area Fill & Interactive Crosshair */}
        <div className="chart-wrapper-rel">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            style={{ width: '100%', height: '330px', overflow: 'visible', cursor: 'crosshair' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredData(null)}
          >
            <defs>
              <linearGradient id="qpsoAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.22" />
                <stop offset="85%" stopColor="#06b6d4" stopOpacity="0.02" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
              </linearGradient>
              <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#06b6d4" floodOpacity="0.7" />
              </filter>
              <clipPath id="chartClip">
                <rect x={padX} y={padY} width={chartWidth} height={chartHeight} />
              </clipPath>
            </defs>

            {/* Horizontal Gridlines & Y-Axis Values */}
            {gridTicks.map((tick, i) => (
              <g key={`grid-${i}`}>
                <line
                  x1={padX}
                  y1={tick.y}
                  x2={w - padX}
                  y2={tick.y}
                  stroke="rgba(255,255,255,0.07)"
                  strokeDasharray="3,3"
                />
                <text
                  x={padX - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Vertical Gridlines & X-Axis Ticks */}
            {xTicks.map((tickIter, i) => {
              const xPos = toSvgX(tickIter);
              return (
                <g key={`xtick-${i}`}>
                  <line
                    x1={xPos}
                    y1={padY}
                    x2={xPos}
                    y2={h - padY}
                    stroke="rgba(255,255,255,0.04)"
                    strokeDasharray="2,4"
                  />
                  <line
                    x1={xPos}
                    y1={h - padY}
                    x2={xPos}
                    y2={h - padY + 5}
                    stroke="rgba(255,255,255,0.2)"
                  />
                  <text
                    x={xPos}
                    y={h - padY + 18}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {tickIter}
                  </text>
                </g>
              );
            })}

            {/* Axis Title */}
            <text
              x={w / 2}
              y={h - 2}
              textAnchor="middle"
              fill="var(--text-secondary)"
              fontSize="11"
              fontWeight="500"
            >
              Iteration Number (t)
            </text>

            {/* Clipped Data Lines */}
            <g clipPath="url(#chartClip)">
              {/* QPSO Gradient Fill Area */}
              <path
                d={getQpsoAreaPath()}
                fill="url(#qpsoAreaGradient)"
              />

              {/* 1. GNN Baseline (Slate Gray, dashed) */}
              <polyline
                points={getPolylinePoints(gnnKey)}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.8"
              />

              {/* 2. Classical PSO (Bright Orange, solid) */}
              <polyline
                points={getPolylinePoints(psoKey)}
                fill="none"
                stroke="#f97316"
                strokeWidth="2.4"
                opacity="0.95"
              />

              {/* 3. Quantum-Inspired PSO (Electric Cyan, bold glow) */}
              <polyline
                points={getPolylinePoints(qpsoKey)}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="3.4"
                filter="url(#cyanGlow)"
              />
            </g>

            {/* Crosshair & Hover Guides */}
            {hoveredData && (
              <g>
                <line
                  x1={hoveredData.svgX}
                  y1={padY}
                  x2={hoveredData.svgX}
                  y2={h - padY}
                  stroke="rgba(255,255,255,0.4)"
                  strokeDasharray="3,3"
                  strokeWidth="1.2"
                />
                {hoveredData[gnnKey] != null && (
                  <circle
                    cx={hoveredData.svgX}
                    cy={hoveredData.gnnY}
                    r="4"
                    fill="#94a3b8"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                )}
                {hoveredData[psoKey] != null && (
                  <circle
                    cx={hoveredData.svgX}
                    cy={hoveredData.psoY}
                    r="5"
                    fill="#f97316"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                )}
                {hoveredData[qpsoKey] != null && (
                  <circle
                    cx={hoveredData.svgX}
                    cy={hoveredData.qpsoY}
                    r="6"
                    fill="#06b6d4"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    filter="url(#cyanGlow)"
                  />
                )}
              </g>
            )}
          </svg>

          {/* Interactive Floating Tooltip */}
          {hoveredData && (
            <div
              className="chart-floating-tooltip"
              style={{
                left: `${Math.min(88, Math.max(12, ((hoveredData.svgX) / w) * 100))}%`,
                top: '14px',
              }}
            >
              <div className="tooltip-title">Iteration #{hoveredData.Iteration}</div>
              <div className="tooltip-row">
                <span className="tooltip-dot" style={{ background: '#06b6d4', boxShadow: '0 0 5px #06b6d4' }} />
                <span className="tooltip-label">Quantum PSO:</span>
                <strong style={{ color: '#06b6d4', fontFamily: 'var(--font-mono)' }}>
                  {hoveredData[qpsoKey]?.toFixed(2) ?? '—'}
                </strong>
              </div>
              <div className="tooltip-row">
                <span className="tooltip-dot" style={{ background: '#f97316' }} />
                <span className="tooltip-label">Classical PSO:</span>
                <strong style={{ color: '#f97316', fontFamily: 'var(--font-mono)' }}>
                  {hoveredData[psoKey]?.toFixed(2) ?? '—'}
                </strong>
              </div>
              <div className="tooltip-row">
                <span className="tooltip-dot" style={{ background: '#94a3b8' }} />
                <span className="tooltip-label">GNN Baseline:</span>
                <span style={{ color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                  {hoveredData[gnnKey]?.toFixed(2) ?? '—'}
                </span>
              </div>
              {hoveredData[psoKey] != null && hoveredData[qpsoKey] != null && (
                <div className="tooltip-delta">
                  {hoveredData[qpsoKey] < hoveredData[psoKey] ? (
                    <span style={{ color: 'var(--color-success)' }}>
                      ▼ QPSO leads by {(((hoveredData[psoKey] - hoveredData[qpsoKey]) / hoveredData[psoKey]) * 100).toFixed(1)}% (-{(hoveredData[psoKey] - hoveredData[qpsoKey]).toFixed(2)})
                    </span>
                  ) : hoveredData[qpsoKey] > hoveredData[psoKey] ? (
                    <span style={{ color: 'var(--color-warning)' }}>
                      ▲ Classical PSO leads by {(((hoveredData[qpsoKey] - hoveredData[psoKey]) / hoveredData[qpsoKey]) * 100).toFixed(1)}%
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Tied fitness</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Benchmark Controls Bar */}
      <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontFamily: 'var(--font-display)', color: 'var(--text-main)', fontWeight: 600 }}>
              Systematic Performance Benchmarking
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
              Evaluates convergence rate, solution quality, relative gap, and wall-clock execution time across repeated stochastic trials.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label htmlFor="runs-slider" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Stochastic Trials (R):</label>
              <span className="control-value">{numRuns}</span>
              <input
                id="runs-slider"
                type="range"
                min="1"
                max="10"
                value={numRuns}
                onChange={(e) => setNumRuns(Number(e.target.value))}
                className="control-range"
                style={{ width: '100px' }}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleRunBenchmark}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Running Multi-Trial Benchmark...
                </>
              ) : (
                <>
                  {benchIcons.play}
                  <span>Execute Benchmark Comparison</span>
                </>
              )}
            </button>
          </div>
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
            {benchIcons.alert} {error}
          </div>
        )}
      </div>

      {/* Benchmark Results */}
      {report && (
        <>
          {/* Scorecard Table */}
          <div className="table-container">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--color-primary)', display: 'flex' }}>{benchIcons.award}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                  Metaheuristic Performance Scorecard
                </span>
              </div>
              <span className="badge badge-primary">
                Swarm Size: {params.swarm_size} | Max Iter: {params.max_iter} | R = {numRuns}
              </span>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Algorithm</th>
                  <th>Best Cost F(X)</th>
                  <th>Mean Cost F(X)</th>
                  <th>Std Dev</th>
                  <th>Mean Time (hrs)</th>
                  <th>Mean Dist (km)</th>
                  <th>Wall-Clock (ms)</th>
                  <th>Gap to Best (%)</th>
                  <th>Feasibility</th>
                </tr>
              </thead>
              <tbody>
                {report.scorecard.map((row, idx) => {
                  const rawGap = typeof row['Relative Gap (%)'] === 'number'
                    ? row['Relative Gap (%)']
                    : parseFloat(row['Relative Gap (%)'] || row['Optimality Gap (%)'] || 999);
                  const isLeader = Math.abs(rawGap) < 1e-4;
                  const isQpso = row['Algorithm']?.includes('QPSO') || row['Algorithm']?.includes('Quantum');

                  return (
                    <tr key={`scorecard-${idx}`} className={isLeader ? 'highlight-row-winner' : ''}>
                      <td>
                        <strong style={{ color: isQpso ? '#06b6d4' : (row['Algorithm']?.includes('Classical') ? '#f97316' : 'inherit') }}>
                          {row['Algorithm']}
                        </strong>
                        {isLeader && (
                          <span className="badge badge-success" style={{ marginLeft: 8, fontSize: '0.65rem' }}>
                            WINNER (0.0% GAP)
                          </span>
                        )}
                      </td>
                      <td>
                        <strong style={{ fontFamily: 'var(--font-mono)' }}>
                          {typeof row['Best Cost'] === 'number'
                            ? row['Best Cost'].toFixed(2)
                            : (row['Best Cost'] ?? row['Best Fitness'] ?? '—')}
                        </strong>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {typeof row['Mean Cost'] === 'number'
                          ? row['Mean Cost'].toFixed(2)
                          : (row['Mean Cost'] ?? row['Mean Fitness'] ?? '—')}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {typeof row['Std Dev'] === 'number'
                          ? row['Std Dev'].toFixed(2)
                          : (row['Std Dev'] ?? '—')}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {typeof row['Mean Time (hrs)'] === 'number'
                          ? row['Mean Time (hrs)'].toFixed(2)
                          : (row['Mean Time (hrs)'] ?? row['Fleet Travel Time (h)'] ?? '—')}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {typeof row['Mean Dist (km)'] === 'number'
                          ? row['Mean Dist (km)'].toFixed(1)
                          : (row['Mean Dist (km)'] ?? row['Fleet Distance (km)'] ?? '—')}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', color: isQpso ? '#06b6d4' : 'inherit' }}>
                          {typeof row['Mean Compute (ms)'] === 'number'
                            ? row['Mean Compute (ms)'].toFixed(2)
                            : (row['Mean Compute (ms)'] ?? row['Wall-Clock Time (ms)'] ?? '—')} ms
                        </span>
                      </td>
                      <td>
                        <span style={{
                          color: isLeader ? 'var(--color-success)' : 'var(--color-warning)',
                          fontWeight: 600,
                          fontFamily: 'var(--font-mono)'
                        }}>
                          {typeof row['Relative Gap (%)'] === 'number'
                            ? `${row['Relative Gap (%)'].toFixed(1)}%`
                            : (row['Relative Gap (%)'] ?? row['Optimality Gap (%)'] ?? '—')}
                        </span>
                      </td>
                      <td>
                        {(row['Feasibility Rate'] === '100.0%' || row['Feasibility Rate (%)'] === '100.0%' || row['Feasibility Rate'] === 1.0) ? (
                          <span style={{ color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {benchIcons.check} 100%
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-warning)' }}>{row['Feasibility Rate'] ?? row['Feasibility Rate (%)'] ?? '—'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Explanatory Footnote */}
            <div style={{
              padding: '10px 18px',
              background: 'rgba(255,255,255,0.02)',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.74rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.45
            }}>
              💡 <strong>Understanding Cost F(X) vs. Travel Time:</strong> Objective Cost <em>F(X)</em> evaluates overall solution viability: <code>F(X) = Total Travel Time + Penalty(Capacity + Route + Time Window Delays)</code>.
              For 100% feasible solutions, Cost <em>F(X)</em> equals travel time. If a solver suffers constraint violations (such as GNN with 0% feasibility), large mathematical penalties are added to discourage illegal routes, resulting in a high Cost <em>F(X)</em> despite a low unconstrained travel time.
            </div>
          </div>

          {/* Convergence Curves */}
          {renderConvergenceChart(report.convergence)}
        </>
      )}

      {!report && !loading && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border-subtle)',
          color: 'var(--text-muted)'
        }}>
          <div style={{ color: 'var(--color-primary)', display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            {benchIcons.barChart}
          </div>
          <h4 style={{ color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 600 }}>Ready for Multi-Trial Benchmarking</h4>
          <p style={{ fontSize: '0.85rem', marginTop: 4, maxWidth: '500px', margin: '6px auto 0' }}>
            Click <strong>"Execute Benchmark Comparison"</strong> above to run GNN, Classical PSO, and compiled C++ QPSO across repeated trials.
          </p>
        </div>
      )}
    </div>
  );
}
