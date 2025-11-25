import React from 'react';
import { Home, Target, Calendar, LogOut, RefreshCw, Menu, User } from 'lucide-react';

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
    { id: 'home', label: 'Home', icon: <Home size={22} /> },
    { id: 'ciclos', label: 'Meus Ciclos', icon: <RefreshCw size={22} /> },
    { id: 'goals', label: 'Metas', icon: <Target size={22} /> },
    { id: 'calendar', label: 'Calendário', icon: <Calendar size={22} /> },
  ];

  const handleLogoClick = () => {
    setActiveTab('home');
    setMobileOpen(false);
  };

  const isFullyExpanded = isExpanded || isMobileOpen;

  // Botão Flutuante (Mobile)
  const HamburgerButton = () => (
    <button
      className={`
        fixed top-4 left-4 z-[51] flex lg:hidden items-center justify-center w-10 h-10
        bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg
        cursor-pointer transition-all duration-300 ease-in-out hover:scale-105 active:scale-95
        ${isMobileOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}
      `}
      onClick={() => setMobileOpen(true)}
      aria-label="Abrir menu"
    >
      <Menu size={22} className="text-zinc-700 dark:text-zinc-200" />
    </button>
  );

  return (
    <>
      <HamburgerButton />

      {/* Backdrop para Mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <nav
        className={`
          fixed top-0 z-50 h-screen flex flex-col
          bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800
          transition-[width,transform] duration-300 ease-out shadow-xl lg:shadow-none
          ${isMobileOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full lg:translate-x-0'}
          lg:left-0 ${isExpanded ? 'lg:w-[260px]' : 'lg:w-[80px]'}
        `}
        onMouseEnter={() => !isMobileOpen && setExpanded(true)}
        onMouseLeave={() => !isMobileOpen && setExpanded(false)}
      >

        {/* --- LOGO AREA --- */}
        <div
          className="flex items-center justify-center h-[90px] w-full cursor-pointer group"
          onClick={handleLogoClick}
        >
           <div className={`transition-all duration-300 flex items-center justify-center ${isFullyExpanded ? 'scale-100' : 'scale-75'}`}>
             <img
               src="/logo-pmba.png"
               alt="Logo"
               className="h-14 w-auto object-contain drop-shadow-sm group-hover:drop-shadow-md transition-all"
             />
           </div>
        </div>

        {/* --- ITEMS DE NAVEGAÇÃO --- */}
        <div className="flex-grow py-4 px-3 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`} // ADICIONADO: ID para o Tour (ex: nav-item-goals)
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileOpen(false);
                }}
                className={`
                  relative flex items-center w-full p-3 rounded-xl transition-all duration-300 group
                  ${isActive
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                  }
                `}
              >
                {/* Ícone */}
                <span className={`flex-shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </span>

                {/* Texto */}
                <span className={`
                  ml-4 font-medium whitespace-nowrap overflow-hidden transition-all duration-300
                  ${isFullyExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}
                `}>
                  {item.label}
                </span>

                {/* Indicador Ativo */}
                {isActive && !isFullyExpanded && !isMobileOpen && (
                  <div className="absolute right-2 top-2 w-2 h-2 rounded-full bg-white animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* --- RODAPÉ / PERFIL --- */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/50">

          {/* Botão de Perfil */}
          <button
            onClick={() => {
              setActiveTab('profile');
              setMobileOpen(false);
            }}
            className={`
              flex items-center w-full p-2 rounded-xl transition-all duration-200
              ${activeTab === 'profile'
                ? 'bg-zinc-200 dark:bg-zinc-800 ring-1 ring-zinc-300 dark:ring-zinc-700'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }
            `}
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden border border-zinc-300 dark:border-zinc-600">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={20} className="text-zinc-500 dark:text-zinc-400" />
              )}
            </div>

            <div className={`
               ml-3 flex flex-col items-start overflow-hidden transition-all duration-300
               ${isFullyExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}
            `}>
              <span className="text-sm font-bold text-zinc-800 dark:text-white truncate max-w-[140px]">
                {user?.displayName || 'Usuário'}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Ver Perfil</span>
            </div>
          </button>

          {/* Botão Sair */}
          <button
            onClick={handleLogout}
            className={`
              flex items-center w-full p-2 rounded-xl text-zinc-500 dark:text-zinc-400
              hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200
            `}
          >
            <div className="w-10 flex justify-center flex-shrink-0">
               <LogOut size={20} />
            </div>
            <span className={`
              ml-1 font-medium whitespace-nowrap overflow-hidden transition-all duration-300
              ${isFullyExpanded ? 'opacity-100' : 'opacity-0'}
            `}>
              Sair da Conta
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default NavSideBar;