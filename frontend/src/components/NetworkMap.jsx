import React, { useState, useRef, useMemo } from 'react';

export default function NetworkMap({
  data,
  highlightEdge = null,
  title = "Road Network & Routing Topology",
  height = 580
}) {
  const svgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredElement, setHoveredElement] = useState(null);

  const { edges = [], routes = [], customers = [], intersections = [], depot = null, bounds = null } = data || {};

  // Compute bounding box and aspect-ratio scaling
  const { minX, minY, scaleX, scaleY, pad } = useMemo(() => {
    if (!bounds) {
      return { minX: 0, maxX: 100, minY: 0, maxY: 100, scaleX: 1, scaleY: 1, pad: 40 };
    }
    const bMinX = bounds.min_x ?? 0;
    const bMaxX = bounds.max_x ?? 100;
    const bMinY = bounds.min_y ?? 0;
    const bMaxY = bounds.max_y ?? 100;
    const padding = 45;
    return {
      minX: bMinX,
      maxX: bMaxX,
      minY: bMinY,
      maxY: bMaxY,
      scaleX: (1000 - padding * 2) / (bMaxX - bMinX || 1),
      scaleY: (700 - padding * 2) / (bMaxY - bMinY || 1),
      pad: padding
    };
  }, [bounds]);

  // Project simulation (x, y) coordinates to SVG space
  const project = (x, y) => {
    const px = pad + (x - minX) * scaleX;
    const py = 700 - (pad + (y - minY) * scaleY); // Flip Y so higher coordinates appear upward
    return { x: px, y: py };
  };

  // Mouse pan & zoom handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((prev) => Math.min(Math.max(prev * factor, 0.5), 5));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Tooltip positioning
  const getRoadColor = (edge) => {
    if (edge.is_closed) return '#ff0055';
    if (edge.alpha > 3.0) return '#ef4444';
    if (edge.alpha > 1.5) return '#f59e0b';
    return '#10b981';
  };

  const isEdgeHighlighted = (edge) => {
    if (!highlightEdge) return false;
    const [u1, v1] = highlightEdge;
    return (edge.u === u1 && edge.v === v1) || (edge.u === v1 && edge.v === u1);
  };

  return (
    <div className="map-container" style={{ minHeight: height }}>
      <div className="map-header">
        <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{title}</span>
        <div className="map-legend">
          <div className="legend-item">
            <span className="legend-swatch free" />
            <span>Free Flow (&le;1.5x)</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch moderate" />
            <span>Moderate (1.5–3x)</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch severe" />
            <span>Severe (&gt;3x)</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch closed" />
            <span>Closed / Blocked</span>
          </div>
          <div className="legend-item">
            <span className="legend-marker customer" />
            <span>Customer Stop</span>
          </div>
          <div className="legend-item">
            <span className="legend-marker depot" />
            <span>Hub Depot</span>
          </div>
        </div>
      </div>

      <div
        className="map-viewport"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 1000 700"
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            overflow: 'hidden'
          }}
        >
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="danger-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 1. Road Edges */}
            {edges.map((edge, idx) => {
              const p0 = project(edge.x0, edge.y0);
              const p1 = project(edge.x1, edge.y1);
              const isHighlight = isEdgeHighlighted(edge);
              const color = isHighlight ? '#ff0055' : getRoadColor(edge);
              const strokeWidth = isHighlight ? 6 : edge.is_closed ? 3.5 : edge.alpha > 3 ? 2.8 : edge.alpha > 1.5 ? 2.0 : 1.4;

              return (
                <line
                  key={`edge-${edge.u}-${edge.v}-${idx}`}
                  x1={p0.x}
                  y1={p0.y}
                  x2={p1.x}
                  y2={p1.y}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={edge.is_closed || isHighlight ? '5,5' : 'none'}
                  strokeOpacity={isHighlight ? 1 : 0.85}
                  className={isHighlight ? 'pulse-edge' : ''}
                  style={{ cursor: 'pointer', transition: 'stroke 0.2s' }}
                  onMouseEnter={(e) => {
                    const rect = svgRef.current.getBoundingClientRect();
                    setHoveredElement({
                      type: 'edge',
                      data: edge,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top
                    });
                  }}
                  onMouseLeave={() => setHoveredElement(null)}
                />
              );
            })}

            {/* 2. Vehicle Tour Route Overlays */}
            {routes.map((rt, rIdx) => {
              if (!rt.coordinates || rt.coordinates.length < 2) return null;
              const points = rt.coordinates.map(([x, y]) => {
                const pt = project(x, y);
                return `${pt.x},${pt.y}`;
              }).join(' ');

              return (
                <polyline
                  key={`route-${rt.vehicle_id}-${rIdx}`}
                  points={points}
                  fill="none"
                  stroke={rt.color}
                  strokeWidth={4.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glow)"
                  opacity={0.92}
                  style={{ pointerEvents: 'none' }}
                />
              );
            })}

            {/* 3. Intersections */}
            {intersections.map((intNode) => {
              const pt = project(intNode.x, intNode.y);
              return (
                <circle
                  key={`int-${intNode.node_id}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={3.5}
                  fill="#475569"
                  stroke="#1e293b"
                  strokeWidth={1}
                />
              );
            })}

            {/* 4. Customer Stops */}
            {customers.map((cust) => {
              const pt = project(cust.x, cust.y);
              return (
                <g
                  key={`cust-${cust.node_id}`}
                  transform={`translate(${pt.x}, ${pt.y})`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    const rect = svgRef.current.getBoundingClientRect();
                    setHoveredElement({
                      type: 'customer',
                      data: cust,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top
                    });
                  }}
                  onMouseLeave={() => setHoveredElement(null)}
                >
                  <rect
                    x={-9}
                    y={-9}
                    width={18}
                    height={18}
                    rx={3}
                    fill="#2563eb"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
                  />
                  <text
                    x={0}
                    y={3.5}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={10}
                    fontWeight="700"
                    fontFamily="Inter, sans-serif"
                  >
                    {cust.stop_index}
                  </text>
                </g>
              );
            })}

            {/* 5. Depot Hub */}
            {depot && (() => {
              const pt = project(depot.x, depot.y);
              return (
                <g
                  key="depot-node"
                  transform={`translate(${pt.x}, ${pt.y})`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    const rect = svgRef.current.getBoundingClientRect();
                    setHoveredElement({
                      type: 'depot',
                      data: depot,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top
                    });
                  }}
                  onMouseLeave={() => setHoveredElement(null)}
                >
                  {/* Glowing star */}
                  <polygon
                    points="0,-16 4.7,-4.8 16.5,-4.8 7,2.2 10.6,13.5 0,6.5 -10.6,13.5 -7,2.2 -16.5,-4.8 -4.7,-4.8"
                    fill="#fbbf24"
                    stroke="#000000"
                    strokeWidth={1.5}
                    filter="url(#glow)"
                  />
                  <text
                    x={0}
                    y={22}
                    textAnchor="middle"
                    fill="#fbbf24"
                    fontSize={11}
                    fontWeight="700"
                    fontFamily="Inter, sans-serif"
                  >
                    Depot (Hub 0)
                  </text>
                </g>
              );
            })()}
          </g>
        </svg>

        {/* Map Control Buttons */}
        <div className="map-controls">
          <button className="map-ctrl-btn" title="Zoom In" onClick={() => setZoom((z) => Math.min(z * 1.25, 5))}>
            +
          </button>
          <button className="map-ctrl-btn" title="Zoom Out" onClick={() => setZoom((z) => Math.max(z * 0.8, 0.5))}>
            -
          </button>
          <button className="map-ctrl-btn" title="Reset View" onClick={handleResetView} style={{ fontSize: '0.8rem' }}>
            ⟲
          </button>
        </div>

        {/* Hover Tooltip */}
        {hoveredElement && (
          <div
            className="map-tooltip"
            style={{
              left: Math.min(hoveredElement.x, 800),
              top: Math.min(hoveredElement.y, 500)
            }}
          >
            {hoveredElement.type === 'edge' && (
              <div>
                <div style={{ fontWeight: 700, color: '#00d4ff', marginBottom: 4 }}>
                  Road Link ({hoveredElement.data.u} ⇄ {hoveredElement.data.v})
                </div>
                <div>Congestion: <strong style={{ color: getRoadColor(hoveredElement.data) }}>{hoveredElement.data.alpha}x</strong></div>
                <div>Base Time: {typeof hoveredElement.data.base_time_min === 'number' ? hoveredElement.data.base_time_min.toFixed(1) : '—'} mins</div>
                <div>Distance: {hoveredElement.data.distance_km?.toFixed(1) || '—'} km</div>
                {hoveredElement.data.is_closed && (
                  <div style={{ color: '#ff0055', fontWeight: 700, marginTop: 4 }}>🚫 ROADWAY BLOCKED</div>
                )}
              </div>
            )}

            {hoveredElement.type === 'customer' && (
              <div>
                <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: 4 }}>
                  Customer Stop #{hoveredElement.data.stop_index} (Node {hoveredElement.data.node_id})
                </div>
                <div>Demand: <strong>{hoveredElement.data.demand.toFixed(1)} parcels</strong></div>
                <div>
                  Time Window: [{hoveredElement.data.time_window[0].toFixed(2)}h, {hoveredElement.data.time_window[1].toFixed(2)}h]
                </div>
              </div>
            )}

            {hoveredElement.type === 'depot' && (
              <div>
                <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
                  Central Distribution Depot
                </div>
                <div>Operating Window: [{hoveredElement.data.time_window[0].toFixed(1)}h, {hoveredElement.data.time_window[1].toFixed(1)}h]</div>
                <div>Fleet Starting & Return Point</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
