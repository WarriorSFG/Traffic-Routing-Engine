import React, { useState } from 'react';

const icons = {
  clipboard: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  chevronDown: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  chevronUp: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
};

function formatHour(h) {
  if (h == null || isNaN(h)) return '--';
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  const period = hours >= 12 && hours < 24 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export default function TourSchedule({ routes = [], vehicleCap = 100.0 }) {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedRoutes, setExpandedRoutes] = useState({});

  if (!routes || routes.length === 0) return null;

  const toggleRouteTimetable = (vId) => {
    setExpandedRoutes((prev) => ({
      ...prev,
      [vId]: !prev[vId]
    }));
  };

  return (
    <div className="drawer">
      <div className="drawer-header" onClick={() => setIsOpen(!isOpen)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--color-primary)', display: 'flex' }}>{icons.clipboard}</span>
          <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>Vehicle Tour Schedules & Timetables</span>
          <span className="badge" style={{ fontSize: '0.7rem' }}>{routes.length} Active</span>
        </div>
        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
          {isOpen ? (
            <>Collapse {icons.chevronUp}</>
          ) : (
            <>Expand {icons.chevronDown}</>
          )}
        </span>
      </div>

      {isOpen && (
        <div className="drawer-content">
          {routes.map((rt) => {
            const cap = Number(vehicleCap) > 0 ? Number(vehicleCap) : 100.0;
            const rawPct = Math.round((rt.total_load / cap) * 100);
            const loadPct = Math.min(rawPct, 100);
            const isOverloaded = rt.total_load > cap + 1e-4;
            const hasStopDetails = Array.isArray(rt.stop_details) && rt.stop_details.length > 0;
            const isExpanded = !!expandedRoutes[rt.vehicle_id];

            return (
              <div
                key={`tour-${rt.vehicle_id}`}
                className="vehicle-tour-card"
                style={{ borderLeftColor: rt.color }}
              >
                <div className="tour-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ color: rt.color }}>Vehicle {rt.vehicle_id}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ({Math.max(0, rt.stops.length - 2)} stops)
                    </span>
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: rt.is_feasible ? 'var(--color-success)' : 'var(--color-warning)'
                  }}>
                    {rt.is_feasible ? (
                      <>{icons.check} Feasible</>
                    ) : (
                      <>{icons.alert} Warning</>
                    )}
                  </div>
                </div>

                <div className="tour-path-badge">
                  Path: {rt.stops.map((s, sIdx) => (
                    <span key={`p-${sIdx}`}>
                      {s === 0 ? 'Hub' : `S${s}`}
                      {sIdx < rt.stops.length - 1 && ' \u2192 '}
                    </span>
                  ))}
                </div>

                <div className="tour-stats">
                  <div>
                    <strong>Load:</strong> {rt.total_load.toFixed(1)} / {cap.toFixed(1)} kg ({rawPct}%)
                    <div style={{
                      width: '120px',
                      height: '4px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: '2px',
                      marginTop: '5px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${loadPct}%`,
                        height: '100%',
                        background: isOverloaded ? 'var(--color-danger)' : rt.color,
                        borderRadius: '2px'
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

                {hasStopDetails && (
                  <div style={{ marginTop: 6 }}>
                    <button
                      className="btn-tour-timetable-toggle"
                      onClick={() => toggleRouteTimetable(rt.vehicle_id)}
                    >
                      <span>{isExpanded ? 'Hide Stop Timetable' : `View Stop Timetable (${rt.stop_details.length} points)`}</span>
                      <span style={{ display: 'flex', width: 12, height: 12 }}>
                        {isExpanded ? icons.chevronUp : icons.chevronDown}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="tour-stop-table-wrapper">
                        <table className="tour-stop-table">
                          <thead>
                            <tr>
                              <th>Point</th>
                              <th>Arrival</th>
                              <th>Time Window</th>
                              <th>Demand</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rt.stop_details.map((st, sIdx) => {
                              const isHub = st.stop_index === 0;
                              let statusBadgeClass = 'status-pill-ontime';
                              if (st.is_late) statusBadgeClass = 'status-pill-late';
                              else if (st.is_early) statusBadgeClass = 'status-pill-early';

                              return (
                                <tr key={`st-${rt.vehicle_id}-${sIdx}`}>
                                  <td>
                                    <span className={`point-code ${isHub ? 'point-hub' : 'point-cust'}`}>
                                      {isHub ? 'Depot Hub' : `Stop #${st.stop_index}`}
                                    </span>
                                    {!isHub && (
                                      <span className="point-sub">Node {st.node_id}</span>
                                    )}
                                  </td>
                                  <td>
                                    <span className="time-val-primary">{formatHour(st.arrival_time)}</span>
                                    <span className="time-val-sub">({st.arrival_time.toFixed(2)}h)</span>
                                  </td>
                                  <td>
                                    {isHub ? (
                                      <span className="tw-text">Depot Hours (6:00 - 18:00)</span>
                                    ) : (
                                      <span className="tw-text">
                                        {formatHour(st.time_window[0])} &ndash; {formatHour(st.time_window[1])}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    {st.demand > 0 ? (
                                      <span className="demand-val">{st.demand.toFixed(1)} kg</span>
                                    ) : (
                                      <span style={{ color: 'var(--text-muted)' }}>&mdash;</span>
                                    )}
                                  </td>
                                  <td>
                                    <span className={`status-pill ${statusBadgeClass}`}>
                                      {st.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
