import React, { useState, useEffect } from 'react';

const NavSidebar = ({ activeTab, setActiveTab }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Fechar menu ao clicar fora (mobile)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && !e.target.closest('.nav-sidebar') && !e.target.closest('.hamburger-btn')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <>
      <button className="hamburger-btn" onClick={() => setIsOpen(!isOpen)}>
        <span></span>
        <span></span>
        <span></span>
      </button>

      <nav className={`nav-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>Acompanhamento PMBA</h3>
        </div>
        <ul>
          <li>
            <button
              className={activeTab === 'home' ? 'active' : ''}
              onClick={() => { setActiveTab('home'); setIsOpen(false); }}
            >
              🏠 Home
            </button>
          </li>
          <li>
            <button
              className={activeTab === 'questions' ? 'active' : ''}
              onClick={() => { setActiveTab('questions'); setIsOpen(false); }}
            >
              📊 Questões
            </button>
          </li>
          <li>
            <button
              className={activeTab === 'hours' ? 'active' : ''}
              onClick={() => { setActiveTab('hours'); setIsOpen(false); }}
            >
              ⏰ Horas
            </button>
          </li>
          <li>
            <button
              className={activeTab === 'goals' ? 'active' : ''}
              onClick={() => { setActiveTab('goals'); setIsOpen(false); }}
            >
              🎯 Metas
            </button>
          </li>
          <li>
            <button
              className={activeTab === 'goals-history' ? 'active' : ''}
              onClick={() => { setActiveTab('goals-history'); setIsOpen(false); }}
            >
              🗓️ Calendário
            </button>
          </li>
        </ul>
      </nav>
      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)}></div>}
    </>
  );
};

export default NavSidebar;