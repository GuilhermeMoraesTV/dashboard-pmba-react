import React, { useState } from 'react';

const NavSidebar = ({ activeTab, setActiveTab }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const menuItems = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'questions', icon: '📊', label: 'Questões' },
    { id: 'hours', icon: '⏰', label: 'Horas' },
    { id: 'goals', icon: '🎯', label: 'Metas' },
    { id: 'goals-history', icon: '🗓️', label: 'Calendário' }
  ];

  return (
    <>
      <button className="hamburger-btn" onClick={() => setIsMobileOpen(!isMobileOpen)}>
        <span></span>
        <span></span>
        <span></span>
      </button>

      <nav
        className={`nav-sidebar ${isExpanded ? 'expanded' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        <div className="sidebar-header">
          <img src="/logo-pmba.png" alt="Logo" className="sidebar-logo" />
        </div>
        <ul>
          {menuItems.map(item => (
            <li key={item.id}>
              <button
                className={activeTab === item.id ? 'active' : ''}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileOpen(false);
                }}
              >
                <span className="menu-icon">{item.icon}</span>
                <span className="menu-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {isMobileOpen && <div className="sidebar-overlay" onClick={() => setIsMobileOpen(false)}></div>}
    </>
  );
};

export default NavSidebar;