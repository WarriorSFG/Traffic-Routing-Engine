import React from 'react';

export default function Navbar({ activePage, setActivePage, isOnline = true }) {
  const navItems = [
    { id: 'dispatch', label: 'Dispatch Studio', icon: '🗺️', badge: null },
    { id: 'compare', label: 'Comparison Studio', icon: '⚖️', badge: 'Compare Solvers' },
    { id: 'reroute', label: 'Incident & Reroute', icon: '🚨', badge: null },
    { id: 'benchmark', label: 'Benchmark Suite', icon: '📊', badge: null },
    { id: 'reference', label: 'The Quantum Handbook', icon: '📖', badge: 'Book' }
  ];

  return (
    <header className="site-header">
      <div className="header-inner">
        {/* Brand & Mission */}
        <div className="header-brand" onClick={() => setActivePage('dispatch')} style={{ cursor: 'pointer' }}>
          <div className="brand-logo-glow">
            <span className="brand-icon">⚛️</span>
          </div>
          <div className="brand-text-container">
            <div className="brand-title">
              QUANTUM ROUTING <span className="brand-badge-sih">SIH 2026</span>
            </div>
            <div className="brand-subtitle">
              Dynamic Urban Traffic Optimization Engine &bull; C++20 QPSO
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
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
                {isActive && <span className="nav-active-pill" />}
              </button>
            );
          })}
        </nav>

        {/* System Health Indicators */}
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
