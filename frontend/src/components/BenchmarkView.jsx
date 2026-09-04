import React, { useState } from 'react';

export default function BenchmarkView({ params }) {
  const [numRuns, setNumRuns] = useState(3);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

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

  // SVG Chart projection for Convergence Curves
  const renderConvergenceChart = (convergence) => {
    if (!convergence || convergence.length === 0) return null;

    const iterations = convergence.map((d) => d.Iteration ?? 0);
    const maxIter = Math.max(...iterations, 1);
    const allValues = [];
    convergence.forEach((d) => {
      if (d['GNN'] != null) allValues.push(d['GNN']);
      if (d['Classical PSO'] != null) allValues.push(d['Classical PSO']);
      if (d['Quantum-Inspired PSO (QPSO)'] != null) allValues.push(d['Quantum-Inspired PSO (QPSO)']);
    });

    const minVal = Math.min(...allValues) * 0.95;
    const maxVal = Math.max(...allValues) * 1.05;
    const valRange = maxVal - minVal || 1;

    const w = 800;
    const h = 320;
    const padX = 60;
    const padY = 40;

    const toSvgX = (iter) => padX + (iter / maxIter) * (w - padX * 2);
    const toSvgY = (val) => h - padY - ((val - minVal) / valRange) * (h - padY * 2);

    const getPolylinePoints = (key) => {
      return convergence
        .filter((d) => d[key] != null)
        .map((d) => `${toSvgX(d.Iteration)},${toSvgY(d[key])}`)
        .join(' ');
    };

    // Horizontal gridlines (4 steps)
    const gridTicks = [0, 0.33, 0.66, 1].map((pct) => minVal + pct * valRange);

    return (
      <div className="chart-container">
        <div className="chart-header">
          <span style={{ fontWeight: 600, color: '#f1f5f9' }}>
            📉 Convergence Analysis: Best Objective Value F(X) vs. Iteration
          </span>
          <div className="chart-legend">
            <div className="chart-legend-item">
              <span className="chart-line-indicator" style={{ background: '#94a3b8', borderTop: '1px dashed #94a3b8' }} />
              <span>GNN Baseline</span>
            </div>
            <div className="chart-legend-item">
              <span className="chart-line-indicator" style={{ background: '#f59e0b' }} />
              <span>Classical PSO</span>
            </div>
            <div className="chart-legend-item">
              <span className="chart-line-indicator" style={{ background: '#00d4ff', height: '4px' }} />
              <strong style={{ color: '#00d4ff' }}>Quantum-Inspired PSO (QPSO)</strong>
            </div>
          </div>
        </div>

        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '340px', overflow: 'visible' }}>
          {/* Gridlines */}
          {gridTicks.map((val, i) => {
            const y = toSvgY(val);
            return (
              <g key={`grid-${i}`}>
                <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3,3" />
                <text x={padX - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="JetBrains Mono">
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Iteration X axis labels */}
          <text x={padX} y={h - 10} fill="#64748b" fontSize="10" fontFamily="JetBrains Mono">0</text>
          <text x={w / 2} y={h - 10} textAnchor="middle" fill="#94a3b8" fontSize="11">Iteration Number (t)</text>
          <text x={w - padX} y={h - 10} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="JetBrains Mono">{maxIter}</text>

          {/* Lines */}
          <polyline
            points={getPolylinePoints('GNN')}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray="4,4"
            opacity="0.75"
          />
          <polyline
            points={getPolylinePoints('Classical PSO')}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            opacity="0.9"
          />
          <polyline
            points={getPolylinePoints('Quantum-Inspired PSO (QPSO)')}
            fill="none"
            stroke="#00d4ff"
            strokeWidth="3.5"
            style={{ filter: 'drop-shadow(0 0 6px rgba(0,212,255,0.5))' }}
          />
        </svg>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Benchmark Controls Bar */}
      <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-display)', color: '#ffffff' }}>
              Systematic Performance Benchmarking
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 4 }}>
              Evaluates convergence rate, solution quality, relative gap, and wall-clock execution time across repeated stochastic trials.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label htmlFor="runs-slider" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Stochastic Trials (R):</label>
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
            >
              {loading ? (
                <>
                  <span className="spinner" /> Running Multi-Trial Benchmark...
                </>
              ) : (
                '▶️ Execute Benchmark Comparison'
              )}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', padding: '10px 14px', borderRadius: '6px', color: '#fca5a5', fontSize: '0.85rem' }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Benchmark Results */}
      {report && (
        <>
          {/* Scorecard Table */}
          <div className="table-container">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.95rem' }}>
                🏆 Metaheuristic Performance Scorecard
              </span>
              <span className="badge badge-primary">
                Swarm Size: {params.swarm_size} | Max Iter: {params.max_iter} | R = {numRuns}
              </span>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Algorithm</th>
                  <th>Best Cost (F)</th>
                  <th>Mean Cost</th>
                  <th>Std Dev</th>
                  <th>Travel Time (hrs)</th>
                  <th>Distance (km)</th>
                  <th>Compute Time (ms)</th>
                  <th>Gap to Best (%)</th>
                  <th>Feasibility</th>
                </tr>
              </thead>
              <tbody>
                {report.scorecard.map((row, idx) => {
                  const isQpso = row['Algorithm']?.includes('QPSO') || row['Algorithm']?.includes('Quantum');
                  return (
                    <tr key={`scorecard-${idx}`} className={isQpso ? 'highlight-row' : ''}>
                      <td>
                        <strong>{row['Algorithm']}</strong>
                        {isQpso && <span className="badge badge-primary" style={{ marginLeft: 8, fontSize: '0.65rem' }}>LEADER</span>}
                      </td>
                      <td>
                        {typeof row['Best Cost'] === 'number'
                          ? row['Best Cost'].toFixed(2)
                          : (row['Best Cost'] ?? row['Best Fitness'] ?? '—')}
                      </td>
                      <td>
                        {typeof row['Mean Cost'] === 'number'
                          ? row['Mean Cost'].toFixed(2)
                          : (row['Mean Cost'] ?? row['Mean Fitness'] ?? '—')}
                      </td>
                      <td>
                        {typeof row['Std Dev'] === 'number'
                          ? row['Std Dev'].toFixed(2)
                          : (row['Std Dev'] ?? '—')}
                      </td>
                      <td>
                        {typeof row['Mean Time (hrs)'] === 'number'
                          ? row['Mean Time (hrs)'].toFixed(2)
                          : (row['Mean Time (hrs)'] ?? row['Fleet Travel Time (h)'] ?? '—')}
                      </td>
                      <td>
                        {typeof row['Mean Dist (km)'] === 'number'
                          ? row['Mean Dist (km)'].toFixed(1)
                          : (row['Mean Dist (km)'] ?? row['Fleet Distance (km)'] ?? '—')}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'JetBrains Mono', color: isQpso ? '#00d4ff' : 'inherit' }}>
                          {typeof row['Mean Compute (ms)'] === 'number'
                            ? row['Mean Compute (ms)'].toFixed(2)
                            : (row['Mean Compute (ms)'] ?? row['Wall-Clock Time (ms)'] ?? '—')} ms
                        </span>
                      </td>
                      <td>
                        <span style={{
                          color: (row['Relative Gap (%)'] === 0 || row['Relative Gap (%)'] === '0.00%' || row['Optimality Gap (%)'] === '0.00%') ? '#10b981' : '#f59e0b',
                          fontWeight: 600
                        }}>
                          {typeof row['Relative Gap (%)'] === 'number'
                            ? `${row['Relative Gap (%)'].toFixed(1)}%`
                            : (row['Relative Gap (%)'] ?? row['Optimality Gap (%)'] ?? '—')}
                        </span>
                      </td>
                      <td>
                        {(row['Feasibility Rate'] === '100.0%' || row['Feasibility Rate (%)'] === '100.0%' || row['Feasibility Rate'] === 1.0) ? (
                          <span style={{ color: '#10b981' }}>✅ 100%</span>
                        ) : (
                          <span style={{ color: '#f59e0b' }}>{row['Feasibility Rate'] ?? row['Feasibility Rate (%)'] ?? '—'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
          color: '#64748b'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📊</div>
          <h4 style={{ color: '#94a3b8', fontSize: '1.05rem', fontWeight: 600 }}>Ready for Multi-Trial Benchmarking</h4>
          <p style={{ fontSize: '0.85rem', marginTop: 4, maxWidth: '500px', margin: '6px auto 0' }}>
            Click <strong>"Execute Benchmark Comparison"</strong> above to run GNN, Classical PSO, and compiled C++ QPSO across repeated trials.
          </p>
        </div>
      )}
    </div>
  );
}
