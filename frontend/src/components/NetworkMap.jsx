import React, { useState, useRef, useMemo, useId } from 'react';

export default function NetworkMap({
  data,
  highlightEdge = null,
  title = "Road Network & Routing Topology",
  height = 580,
  mapId = null
}) {
  const autoId = useId().replace(/[^a-zA-Z0-9_-]/g, '_');
  const uid = mapId || `map-${autoId}`;

  const svgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredElement, setHoveredElement] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);

  const updateHover = (e, type, data) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setHoveredElement({
      type,
      data,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const tooltipPos = useMemo(() => {
    if (!hoveredElement) return { left: 0, top: 0 };
    let left = hoveredElement.x + 16;
    let top = hoveredElement.y + 16;
    if (left > 720) left = Math.max(10, hoveredElement.x - 240);
    if (top > 480) top = Math.max(10, hoveredElement.y - 140);
    return { left, top };
  }, [hoveredElement]);

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

  // Build SVG path data for route, filtering out duplicate consecutive points to prevent zero-length SVG segments
  const getRoutePath = (coords) => {
    if (!coords || coords.length === 0) return '';
    const unique = [];
    for (let i = 0; i < coords.length; i++) {
      const [x, y] = coords[i];
      if (i === 0 || Math.abs(x - coords[i - 1][0]) > 1e-4 || Math.abs(y - coords[i - 1][1]) > 1e-4) {
        unique.push([x, y]);
      }
    }
    return unique.map(([x, y], i) => {
      const pt = project(x, y);
      return `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    }).join(' ');
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

  const getRoadColor = (edge) => {
    if (edge.is_closed) return '#ef4444';
    if (edge.alpha > 3.0) return '#f87171';
    if (edge.alpha > 1.5) return '#fbbf24';
    return '#10b981';
  };

  const isEdgeHighlighted = (edge) => {
    if (!highlightEdge) return false;
    const [u1, v1] = highlightEdge;
    return (edge.u === u1 && edge.v === v1) || (edge.u === v1 && edge.v === u1);
  };

  // Disrupted / blocked edge data for prominent overlay rendered on top of routes
  const highlightedEdgeData = useMemo(() => {
    if (!highlightEdge) return null;
    const [u1, v1] = highlightEdge;
    const found = edges.find(
      (e) => (e.u === u1 && e.v === v1) || (e.u === v1 && e.v === u1)
    );
    if (found) {
      return {
        ...found,
        is_incident: true
      };
    }
    // Fallback: look up node coordinates directly
    const allNodes = {};
    if (depot) allNodes[depot.node_id] = [depot.x, depot.y];
    customers.forEach((c) => { allNodes[c.node_id] = [c.x, c.y]; });
    intersections.forEach((i) => { allNodes[i.node_id] = [i.x, i.y]; });
    if (allNodes[u1] && allNodes[v1]) {
      return {
        u: u1,
        v: v1,
        x0: allNodes[u1][0],
        y0: allNodes[u1][1],
        x1: allNodes[v1][0],
        y1: allNodes[v1][1],
        alpha: 12.0,
        is_closed: true,
        is_incident: true,
        distance_km: 0
      };
    }
    return null;
  }, [highlightEdge, edges, depot, customers, intersections]);

  return (
    <div className="map-container" style={{ minHeight: height }}>
      <div className="map-header">
        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{title}</span>
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
            <filter id={`${uid}-route-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 1. Road Edges with Dual-Layer Hit Targets */}
            {edges.map((edge, idx) => {
              const p0 = project(edge.x0, edge.y0);
              const p1 = project(edge.x1, edge.y1);
              const isHighlight = isEdgeHighlighted(edge);
              const isSelected = selectedEdge && (
                (selectedEdge.u === edge.u && selectedEdge.v === edge.v) ||
                (selectedEdge.u === edge.v && selectedEdge.v === edge.u)
              );
              const color = isHighlight ? '#ef4444' : getRoadColor(edge);
              const strokeWidth = isSelected ? 4.5 : isHighlight ? 4.5 : edge.is_closed ? 3.0 : edge.alpha > 3 ? 2.8 : edge.alpha > 1.5 ? 2.0 : 1.3;
              const opacity = isSelected ? 1 : isHighlight ? 1 : edge.is_closed ? 0.95 : edge.alpha > 1.5 ? 0.85 : 0.5;

              return (
                <g key={`edge-group-${edge.u}-${edge.v}-${idx}`}>
                  {/* Selection / Highlight Halo */}
                  {(isSelected || isHighlight) && (
                    <line
                      x1={p0.x}
                      y1={p0.y}
                      x2={p1.x}
                      y2={p1.y}
                      stroke={isSelected ? '#38bdf8' : '#ef4444'}
                      strokeWidth={10}
                      strokeLinecap="round"
                      opacity={0.45}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                  {/* Visible Road Line */}
                  <line
                    x1={p0.x}
                    y1={p0.y}
                    x2={p1.x}
                    y2={p1.y}
                    stroke={isSelected ? '#38bdf8' : color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={edge.is_closed || isHighlight ? '5,5' : 'none'}
                    strokeOpacity={opacity}
                    className={isHighlight ? 'pulse-edge' : ''}
                    style={{ pointerEvents: 'none', transition: 'stroke 0.2s' }}
                  />
                  {/* Transparent Wide Hit-Stroke (16px) for effortless hover & click selection */}
                  <line
                    x1={p0.x}
                    y1={p0.y}
                    x2={p1.x}
                    y2={p1.y}
                    stroke="transparent"
                    strokeWidth={16}
                    strokeLinecap="round"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => updateHover(e, 'edge', edge)}
                    onMouseMove={(e) => updateHover(e, 'edge', edge)}
                    onMouseLeave={() => setHoveredElement(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEdge(edge);
                    }}
                  />
                </g>
              );
            })}

            {/* 2. Vehicle Tour Route Overlays with Live Animated Vehicles */}
            {routes.map((rt, rIdx) => {
              if (!rt.coordinates || rt.coordinates.length < 2) return null;
              const pathD = getRoutePath(rt.coordinates);
              if (!pathD) return null;
              const routeId = `${uid}-route-path-${rt.vehicle_id}-${rIdx}`;
              const animDur = `${Math.max(6, 10 + ((rIdx * 2.5) % 6))}s`;

              return (
                <g key={`${routeId}-${pathD}`}>
                  {/* Route Glow Underlay */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={rt.color}
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.2}
                    style={{ pointerEvents: 'none' }}
                  />
                  {/* Route Main Path */}
                  <path
                    id={routeId}
                    d={pathD}
                    fill="none"
                    stroke={rt.color}
                    strokeWidth={3.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.9}
                    filter={`url(#${uid}-route-glow)`}
                    style={{ pointerEvents: 'none' }}
                  />

                  {/* Live Animated Vehicle Moving Along Route */}
                  <g style={{ pointerEvents: 'none' }} className="animated-car">
                    <animateMotion
                      dur={animDur}
                      repeatCount="indefinite"
                      rotate="auto"
                    >
                      <mpath href={`#${routeId}`} />
                    </animateMotion>
                    {/* Shadow */}
                    <ellipse cx="0" cy="0" rx="7" ry="4" fill="rgba(0,0,0,0.6)" />
                    {/* Vehicle Chassis */}
                    <rect x="-6.5" y="-3.5" width="13" height="7" rx="2.2" fill="#0b1120" stroke={rt.color} strokeWidth="1.5" />
                    {/* Cabin / Windshield */}
                    <rect x="0" y="-2" width="3.2" height="4" rx="1" fill={rt.color} opacity="0.9" />
                    {/* Front Headlights */}
                    <circle cx="5.5" cy="-2" r="0.9" fill="#fef08a" />
                    <circle cx="5.5" cy="2" r="0.9" fill="#fef08a" />
                    {/* Rear Taillights */}
                    <circle cx="-5.5" cy="-2" r="0.8" fill="#ef4444" />
                    <circle cx="-5.5" cy="2" r="0.8" fill="#ef4444" />
                  </g>
                </g>
              );
            })}

            {/* 2.5 Prominent Disruption / Blocked Link Overlay (Rendered ON TOP of routes so it is never covered) */}
            {highlightedEdgeData && (() => {
              const p0 = project(highlightedEdgeData.x0, highlightedEdgeData.y0);
              const p1 = project(highlightedEdgeData.x1, highlightedEdgeData.y1);
              const midX = (p0.x + p1.x) / 2;
              const midY = (p0.y + p1.y) / 2;

              return (
                <g key="highlighted-disruption-overlay">
                  {/* Outer pulsing danger halo */}
                  <line
                    x1={p0.x}
                    y1={p0.y}
                    x2={p1.x}
                    y2={p1.y}
                    stroke="#ef4444"
                    strokeWidth={14}
                    strokeLinecap="round"
                    opacity={0.35}
                    style={{ pointerEvents: 'none' }}
                  >
                    <animate attributeName="stroke-width" values="10;18;10" dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.2;0.5;0.2" dur="1.8s" repeatCount="indefinite" />
                  </line>

                  {/* Dark contrast backing line */}
                  <line
                    x1={p0.x}
                    y1={p0.y}
                    x2={p1.x}
                    y2={p1.y}
                    stroke="#0b1120"
                    strokeWidth={7}
                    strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                  />

                  {/* Bright red and white high-contrast hazard dashes */}
                  <line
                    x1={p0.x}
                    y1={p0.y}
                    x2={p1.x}
                    y2={p1.y}
                    stroke="#ef4444"
                    strokeWidth={4.5}
                    strokeDasharray="8,6"
                    strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                  />

                  {/* Center Road Closure Barrier / Warning Badge */}
                  <g
                    transform={`translate(${midX}, ${midY})`}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                      const rect = svgRef.current.getBoundingClientRect();
                      setHoveredElement({
                        type: 'edge',
                        data: highlightedEdgeData,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top
                      });
                    }}
                    onMouseLeave={() => setHoveredElement(null)}
                  >
                    {/* Pulsing warning beacon */}
                    <circle cx={0} cy={0} r={16} fill="rgba(239, 68, 68, 0.3)">
                      <animate attributeName="r" values="13;22;13" dur="1.8s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.45;0.1;0.45" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                    {/* Badge circle */}
                    <circle
                      cx={0}
                      cy={0}
                      r={11}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth={2}
                      filter="drop-shadow(0 2px 6px rgba(0,0,0,0.8))"
                    />
                    {/* White Road Blocked / No Entry Bar ⛔ */}
                    <rect x="-6.5" y="-2" width={13} height={4} rx={1.2} fill="#ffffff" />
                  </g>
                </g>
              );
            })()}

            {/* 3. Road Intersections */}
            {intersections.map((intNode) => {
              const pt = project(intNode.x, intNode.y);
              return (
                <circle
                  key={`int-${intNode.node_id}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={2.5}
                  fill="#334155"
                  opacity={0.6}
                />
              );
            })}

            {/* 4. Customer Stops */}
            {customers.map((cust) => {
              const pt = project(cust.x, cust.y);
              const r = customers.length > 70 ? 6.5 : customers.length > 35 ? 7.8 : 9;
              const fSize = customers.length > 70 ? 7.2 : customers.length > 35 ? 8.2 : 9.5;
              const yOffset = customers.length > 70 ? 2.5 : customers.length > 35 ? 3.0 : 3.5;
              return (
                <g
                  key={`cust-${cust.node_id}`}
                  transform={`translate(${pt.x}, ${pt.y})`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => updateHover(e, 'customer', cust)}
                  onMouseMove={(e) => updateHover(e, 'customer', cust)}
                  onMouseLeave={() => setHoveredElement(null)}
                >
                  <circle
                    r={r}
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth={r > 7 ? 1.8 : 1.3}
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
                  />
                  <text
                    x={0}
                    y={yOffset}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize={fSize}
                    fontWeight="700"
                    fontFamily="Inter, -apple-system, sans-serif"
                  >
                    {cust.stop_index}
                  </text>
                </g>
              );
            })}

            {/* 5. Central Hub Depot with Pulsing Beacon */}
            {depot && (() => {
              const pt = project(depot.x, depot.y);
              return (
                <g
                  key="depot-node"
                  transform={`translate(${pt.x}, ${pt.y})`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => updateHover(e, 'depot', depot)}
                  onMouseMove={(e) => updateHover(e, 'depot', depot)}
                  onMouseLeave={() => setHoveredElement(null)}
                >
                  {/* Subtle pulsing ring */}
                  <circle cx={0} cy={0} r={16} fill="var(--color-primary)" opacity={0.25}>
                    <animate attributeName="r" values="12;20;12" dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0.08;0.3" dur="3s" repeatCount="indefinite" />
                  </circle>
                  {/* Star shape for depot hub */}
                  <polygon
                    points="0,-14 4.1,-4.2 14.4,-4.2 6.1,1.9 9.3,11.8 0,5.7 -9.3,11.8 -6.1,1.9 -14.4,-4.2 -4.1,-4.2"
                    fill="var(--color-primary)"
                    stroke="#0b1120"
                    strokeWidth={1.5}
                  />
                  <text
                    x={0}
                    y={22}
                    textAnchor="middle"
                    fill="var(--color-primary)"
                    fontSize={10.5}
                    fontWeight="700"
                    fontFamily="Inter, -apple-system, sans-serif"
                  >
                    Hub Depot
                  </text>
                </g>
              );
            })()}
          </g>
        </svg>

        {/* Map Control Buttons with Clean SVG Icons */}
        <div className="map-controls">
          <button className="map-ctrl-btn" title="Zoom In" onClick={() => setZoom((z) => Math.min(z * 1.25, 5))}>
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button className="map-ctrl-btn" title="Zoom Out" onClick={() => setZoom((z) => Math.max(z * 0.8, 0.5))}>
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button className="map-ctrl-btn" title="Reset View" onClick={handleResetView}>
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><polyline points="3 3 3 8 8 8" />
            </svg>
          </button>
        </div>

        {/* Pinned Road Link Inspector */}
        {selectedEdge && (
          <div className="pinned-edge-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: getRoadColor(selectedEdge) }} />
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                  Selected Road Link ({selectedEdge.u} &harr; {selectedEdge.v})
                </strong>
              </div>
              <button
                className="btn-close-pinned"
                onClick={() => setSelectedEdge(null)}
                title="Close Inspector"
              >
                &times;
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '0.74rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Status:</span> <strong style={{ color: getRoadColor(selectedEdge) }}>{selectedEdge.status || `${selectedEdge.alpha}x`}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Class:</span> <span style={{ color: selectedEdge.is_arterial ? '#38bdf8' : 'var(--text-secondary)' }}>{selectedEdge.is_arterial ? 'Arterial' : 'Residential'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Time:</span> <strong>{selectedEdge.dynamic_time_min ? `${selectedEdge.dynamic_time_min}m` : `${(selectedEdge.base_time_min * selectedEdge.alpha).toFixed(1)}m`}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>(base {selectedEdge.base_time_min?.toFixed(1)}m)</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Speed:</span> <strong>{selectedEdge.current_speed ? `${selectedEdge.current_speed} km/h` : `${(selectedEdge.speed_limit / Math.max(1, selectedEdge.alpha)).toFixed(1)} km/h`}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Distance:</span> <strong>{selectedEdge.distance_km?.toFixed(1)} km</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Congestion:</span> <strong>{selectedEdge.alpha}x</strong></div>
            </div>
          </div>
        )}

        {/* Hover Tooltip with Rich Telemetrics */}
        {hoveredElement && (
          <div
            className="map-tooltip"
            style={{
              left: tooltipPos.left,
              top: tooltipPos.top
            }}
          >
            {hoveredElement.type === 'edge' && (() => {
              const e = hoveredElement.data;
              const dynTime = e.dynamic_time_min ?? (e.base_time_min ? (e.base_time_min * e.alpha).toFixed(1) : null);
              const dynSpeed = e.current_speed ?? (e.speed_limit ? (e.speed_limit / Math.max(1, e.alpha)).toFixed(1) : null);
              return (
                <div style={{ minWidth: 210 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.82rem' }}>
                      Road Link ({e.u} &harr; {e.v})
                    </span>
                    <span className="badge" style={{
                      fontSize: '0.62rem',
                      padding: '1px 6px',
                      background: e.is_closed ? 'rgba(239,68,68,0.2)' : e.alpha > 3 ? 'rgba(248,113,113,0.2)' : e.alpha > 1.5 ? 'rgba(251,191,36,0.2)' : 'rgba(16,185,129,0.2)',
                      color: getRoadColor(e)
                    }}>
                      {e.status || (e.is_closed ? 'Closed' : e.alpha > 3 ? 'Severe' : e.alpha > 1.5 ? 'Moderate' : 'Free Flow')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Congestion:</span>
                    <strong style={{ color: getRoadColor(e) }}>{e.alpha}x</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Travel Time:</span>
                    <span><strong>{dynTime ? `${dynTime}m` : '—'}</strong> <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>(base {e.base_time_min?.toFixed(1) || '—'}m)</span></span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Speed:</span>
                    <span><strong>{dynSpeed ? `${dynSpeed} km/h` : '—'}</strong> <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>(limit {e.speed_limit} km/h)</span></span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Distance:</span>
                    <span><strong>{e.distance_km?.toFixed(1) || '—'} km</strong></span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Class:</span>
                    <span style={{ color: e.is_arterial ? '#38bdf8' : 'var(--text-secondary)' }}>{e.is_arterial ? 'Arterial Highway' : 'Residential Road'}</span>
                  </div>
                  {(e.is_closed || e.is_incident || isEdgeHighlighted(e)) && (
                    <div style={{ color: 'var(--color-danger)', fontWeight: 700, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />
                      ⛔ Road Closed / Disrupted Link
                    </div>
                  )}
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 5, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 3 }}>
                    Click link to pin telemetry
                  </div>
                </div>
              );
            })()}

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
                <div style={{ fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 }}>
                  Central Distribution Depot
                </div>
                <div>Operating Window: [{hoveredElement.data.time_window[0].toFixed(1)}h, {hoveredElement.data.time_window[1].toFixed(1)}h]</div>
                <div>Fleet Starting & Return Hub</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
