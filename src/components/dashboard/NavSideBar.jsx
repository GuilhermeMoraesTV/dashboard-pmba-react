import React from 'react';
import { Home, Target, Calendar, LogOut, RefreshCw, Menu, User } from 'lucide-react';

const IconUserAvatar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full text-text-subtle dark:text-text-dark-subtle">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
);

function NavSideBar({
  user,
  activeTab,
  setActiveTab,
  handleLogout,
  isExpanded,
  setExpanded,
  isMobileOpen,
  setMobileOpen
}) {
  const navItems = [
    { id: 'home', label: 'Dashboard', icon: <Home size={20} /> },
    { id: 'ciclos', label: 'Meus Ciclos', icon: <RefreshCw size={20} /> },
    { id: 'goals', label: 'Metas', icon: <Target size={20} /> },
    { id: 'calendar', label: 'Calendário', icon: <Calendar size={20} /> },
  ];

  const HamburgerButton = () => (
    <button
      className={`fixed top-4 left-4 z-[51] flex lg:hidden items-center justify-center w-10 h-10 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg shadow-lg cursor-pointer transition-all duration-300 ease-in-out hover:bg-border-light dark:hover:bg-border-dark ${isMobileOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
      onClick={() => setMobileOpen(!isMobileOpen)}
      aria-label="Abrir menu"
    >
      <Menu size={22} className="text-text-DEFAULT dark:text-text-dark-DEFAULT" />
    </button>
  );

  const isFullyExpanded = isExpanded || isMobileOpen;

  return (
    <>
      <HamburgerButton />
      <nav
        className={`fixed top-0 z-50 h-screen flex flex-col bg-card-light dark:bg-card-dark border-r border-border-light dark:border-border-dark transition-[width,left] duration-300 ease-in-out w-[260px] ${isMobileOpen ? 'left-0' : '-left-[260px]'} lg:left-0 ${isExpanded ? 'lg:w-[260px]' : 'lg:w-[70px]'}`}
        onMouseEnter={() => !isMobileOpen && setExpanded(true)}
        onMouseLeave={() => !isMobileOpen && setExpanded(false)}
      >
        <div className="flex items-center justify-center min-h-[50px] overflow-hidden px-4 mb-6 mt-5 lg:mt-4">
          <img
            src="/logo-pmba.png"
            alt="Logo"
            className={`h-auto object-contain transition-all duration-300 ease-in-out ${isFullyExpanded ? 'max-w-[120px] max-h-[55px]' : 'max-w-[55px] max-h-[55px]'}`}
          />
        </div>

        <div className="flex-grow overflow-y-auto overflow-x-hidden custom-scrollbar">
          <ul className="list-none p-0 m-0">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    className={`flex items-center gap-4 w-[calc(100%-16px)] m-2 py-2.5 px-3.5 rounded-lg font-semibold whitespace-nowrap overflow-hidden transition-all duration-200 ${isActive ? 'bg-primary text-white shadow-md' : 'text-text-subtle dark:text-text-dark-subtle hover:bg-background-light dark:hover:bg-background-dark hover:text-text-DEFAULT dark:hover:text-text-dark-DEFAULT'}`}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileOpen(false);
                    }}
                  >
                    <span className="min-w-[24px] text-center">{item.icon}</span>
                    <span className={`transition-opacity duration-300 ease-in-out ${isFullyExpanded ? 'opacity-100' : 'opacity-0'}`}>
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex-shrink-0 border-t border-border-light dark:border-border-dark p-2">
          <button
            className={`flex items-center gap-3 w-full p-2.5 rounded-lg whitespace-nowrap overflow-hidden transition-colors duration-200 text-text-subtle dark:text-text-dark-subtle hover:bg-background-light dark:hover:bg-background-dark hover:text-text-DEFAULT dark:hover:text-text-dark-DEFAULT ${activeTab === 'profile' ? 'bg-background-light dark:bg-background-dark text-text-heading dark:text-text-dark-heading' : ''}`}
            onClick={() => {
              setActiveTab('profile');
              setMobileOpen(false);
            }}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-border-light dark:bg-border-dark">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <IconUserAvatar />
              )}
            </div>
            <div className={`flex flex-col items-start transition-opacity duration-300 ease-in-out ${isFullyExpanded ? 'opacity-100' : 'opacity-0'}`}>
              <span className="text-sm font-semibold text-text-heading dark:text-text-dark-heading leading-tight">
                {user?.displayName || 'Usuário'}
              </span>
              <span className="text-xs text-text-subtle dark:text-text-dark-subtle">
                Ver Perfil
              </span>
            </div>
          </button>

          <button
            className={`flex items-center gap-4 w-full p-2.5 py-2.5 px-3.5 rounded-lg font-semibold whitespace-nowrap overflow-hidden transition-all duration-200 text-text-subtle dark:text-text-dark-subtle hover:bg-background-light dark:hover:bg-background-dark hover:text-text-DEFAULT dark:hover:text-text-dark-DEFAULT`}
            onClick={handleLogout}
          >
            <span className="min-w-[24px] text-center"><LogOut size={20} /></span>
            <span className={`transition-opacity duration-300 ease-in-out ${isFullyExpanded ? 'opacity-100' : 'opacity-0'}`}>
              Sair
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default NavSideBar;