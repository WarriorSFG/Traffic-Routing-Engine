import React from 'react';

// Clean SVG icons for navigation
const icons = {
  dispatch: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  ),
  compare: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  reroute: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  benchmark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  reference: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  ),
  brand: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
};

export default function Navbar({ activePage, setActivePage, isOnline = true }) {
  const navItems = [
    { id: 'dispatch', label: 'Dispatch Studio', icon: icons.dispatch, badge: null },
    { id: 'compare', label: 'Comparison', icon: icons.compare, badge: 'Compare' },
    { id: 'reroute', label: 'Incident & Reroute', icon: icons.reroute, badge: null },
    { id: 'benchmark', label: 'Benchmark', icon: icons.benchmark, badge: null },
    { id: 'reference', label: 'Handbook', icon: icons.reference, badge: 'Book' }
  ];

  return (
    <header className="site-header">
      <div className="header-inner">
        {/* Brand */}
        <div className="header-brand" onClick={() => setActivePage('dispatch')} style={{ cursor: 'pointer' }}>
          <div className="brand-logo-glow">
            {icons.brand}
          </div>
          <div className="brand-text-container">
            <div className="brand-title">
              QUANTUM ROUTING <span className="brand-badge-sih">SIH 2026</span>
            </div>
            <div className="brand-subtitle">
              Dynamic Traffic Optimization Engine
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="header-nav">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setActivePage(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.badge && (
                  <span className={`nav-badge ${item.id === 'compare' ? 'nav-badge-compare' : 'nav-badge-book'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Status */}
        <div className="header-status-area">
          <div className="status-pill">
            <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
            <span className="status-text">{isOnline ? 'API Connected' : 'Connecting...'}</span>
          </div>
          <div className="status-pill solver-pill">
            <span className="solver-tag">C++20 QPSO Core</span>
          </div>
        </div>
      </div>
    </header>
  );
}
