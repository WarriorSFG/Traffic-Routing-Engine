import React, { useState } from 'react';

export default function TourSchedule({ routes = [], vehicleCap = 100.0 }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!routes || routes.length === 0) return null;

  return (
    <div className="drawer">
      <div className="drawer-header" onClick={() => setIsOpen(!isOpen)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.1rem' }}>📋</span>
          <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Detailed Vehicle Tour Schedules</span>
          <span className="badge" style={{ fontSize: '0.72rem' }}>{routes.length} Active Tours</span>
        </div>
        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
          {isOpen ? '▲ Collapse' : '▼ Expand'}
        </span>
      </div>

      {isOpen && (
        <div className="drawer-content">
          {routes.map((rt) => {
            const loadPct = Math.min(Math.round((rt.total_load / (vehicleCap || 1)) * 100), 100);
            return (
              <div
                key={`tour-${rt.vehicle_id}`}
                className="vehicle-tour-card"
                style={{ borderLeftColor: rt.color }}
              >
                <div className="tour-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ color: rt.color }}>Vehicle {rt.vehicle_id}</strong>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      ({rt.stops.length - 2} stops)
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: rt.is_feasible ? '#10b981' : '#f59e0b' }}>
                    {rt.is_feasible ? '✓ Feasible' : '⚠️ Constraint Warning'}
                  </div>
                </div>

                <div className="tour-path-badge">
                  Path: {rt.stops.join(' ➔ ')}
                </div>

                <div className="tour-stats">
                  <div>
                    <strong>Load:</strong> {rt.total_load.toFixed(1)} / {vehicleCap.toFixed(1)} parcels ({loadPct}%)
                    <div style={{
                      width: '120px',
                      height: '5px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '3px',
                      marginTop: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${loadPct}%`,
                        height: '100%',
                        background: loadPct > 100 ? '#ef4444' : rt.color
                      }} />
                    </div>
                  </div>
                  <div>
                    <strong>Travel Time:</strong> {rt.total_time.toFixed(2)} hrs
                  </div>
                  <div>
                    <strong>Distance:</strong> {rt.total_distance.toFixed(1)} km
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
