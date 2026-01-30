import React, { useMemo } from 'react';
import {
  Home,
  Target,
  Calendar,
  LogOut,
  RefreshCw,
  Menu,
  User,
  ShieldAlert,
  LayoutList,
  BarChart2,
  ClipboardList
} from 'lucide-react';

// UID do Administrador
const ADMIN_UID = 'OLoJi457GQNE2eTSOcz9DAD6ppZ2';

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

  // Construção dinâmica do menu
  const navItems = useMemo(() => {
    const items = [
      { id: 'home', label: 'Home', icon: <Home size={22} /> },
      { id: 'ciclos', label: 'Meus Ciclos', icon: <RefreshCw size={22} /> },
      { id: 'edital', label: 'Edital', icon: <LayoutList size={22} /> },
      { id: 'stats', label: 'Desempenho', icon: <BarChart2 size={22} /> },
      { id: 'simulados', label: 'Simulados', icon: <ClipboardList size={22} /> },
      { id: 'goals', label: 'Metas', icon: <Target size={22} /> },
      { id: 'calendar', label: 'Calendário', icon: <Calendar size={22} /> },
    ];

    if (user && user.uid === ADMIN_UID) {
      items.push({
        id: 'admin',
        label: 'Admin Zone',
        icon: <ShieldAlert size={22} />,
        isAdmin: true
      });
    }

    return items;
  }, [user]);

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

      {/* Backdrop para Mobile com Fade In/Out */}
      <div
        className={`
          fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-500 ease-in-out
          ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={() => setMobileOpen(false)}
      />

      <nav
        className={`
          fixed top-0 z-50 flex flex-col
          h-screen supports-[height:100dvh]:h-[100dvh]
          bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800
          /* --- AQUI ESTÁ A MÁGICA DA ANIMAÇÃO --- */
          /* Usamos cubic-bezier para um movimento mais orgânico e duração de 500ms */
          transition-[width,transform] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
          shadow-2xl lg:shadow-none
          ${isMobileOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full lg:translate-x-0'}
          lg:left-0 ${isExpanded ? 'lg:w-[260px]' : 'lg:w-[80px]'}
          overflow-hidden
        `}
        onMouseEnter={() => !isMobileOpen && setExpanded(true)}
        onMouseLeave={() => !isMobileOpen && setExpanded(false)}
      >

        {/* --- LOGO AREA (Fixo no topo) --- */}
        <div
          className="flex-shrink-0 flex items-center justify-center h-[90px] w-full cursor-pointer group relative overflow-hidden"
          onClick={handleLogoClick}
        >
           <div className={`transition-transform duration-500 ease-out flex items-center justify-center ${isFullyExpanded ? 'scale-100' : 'scale-90'}`}>
             <img
               src="/logo-pmba.png"
               alt="Logo"
               className="h-14 w-auto object-contain drop-shadow-sm group-hover:drop-shadow-md transition-all"
             />
           </div>
        </div>

        {/* --- ITEMS DE NAVEGAÇÃO (Scrollável) --- */}
        <div className="flex-1 py-4 px-3 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileOpen(false);
                }}
                className={`
                  relative flex items-center w-full p-3 rounded-xl transition-all duration-300 group overflow-hidden whitespace-nowrap
                  ${isActive
                    ? item.isAdmin
                        ? 'bg-zinc-800 text-red-500 shadow-md shadow-black/20 ring-1 ring-red-900/50'
                        : 'bg-red-600 text-white shadow-md shadow-red-600/30'
                    : item.isAdmin
                        ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10'
                        : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                  }
                `}
              >
                {/* Ícone - Mantém a posição mas anima suavemente a escala */}
                <span className={`flex-shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </span>

                {/* Texto com Animação Melhorada */}
                <span className={`
                  ml-4 font-medium transition-all duration-500 ease-in-out
                  ${isFullyExpanded
                    ? 'opacity-100 translate-x-0 w-auto delay-100' // Delay para o texto aparecer só depois que a barra começar a abrir
                    : 'opacity-0 -translate-x-4 w-0 pointer-events-none'
                  }
                `}>
                  {item.label}
                </span>

                {/* Indicador Ativo (Bolinha) - Só aparece recolhido */}
                {isActive && !isFullyExpanded && !isMobileOpen && (
                  <div className={`absolute right-3 top-3 w-2 h-2 rounded-full animate-pulse ${item.isAdmin ? 'bg-red-500' : 'bg-white'}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* --- RODAPÉ / PERFIL (Fixo na base) --- */}
        <div className="flex-shrink-0 p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm">

          {/* Botão de Perfil (ALTERADO: Removido o quadrado cinza e a borda quando ativo) */}
          <button
            onClick={() => {
              setActiveTab('profile');
              setMobileOpen(false);
            }}
            className={`
              flex items-center w-full p-2 rounded-xl transition-all duration-200 group overflow-hidden whitespace-nowrap
              hover:bg-zinc-100 dark:hover:bg-zinc-800
              ${activeTab === 'profile' ? 'bg-transparent' : ''}
            `}
          >
            {/* Avatar Container */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden border border-zinc-300 dark:border-zinc-600 transition-transform group-hover:scale-105">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={20} className="text-zinc-500 dark:text-zinc-400" />
              )}
            </div>

            {/* Texto do Perfil */}
            <div className={`
               ml-3 flex flex-col items-start transition-all duration-500 ease-in-out
               ${isFullyExpanded ? 'opacity-100 translate-x-0 w-auto delay-75' : 'opacity-0 -translate-x-2 w-0 pointer-events-none'}
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
              flex items-center w-full p-2.5 rounded-xl text-zinc-500 dark:text-zinc-400
              hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 group overflow-hidden whitespace-nowrap
            `}
          >
            <div className="w-10 flex justify-center flex-shrink-0 group-hover:-translate-x-1 transition-transform">
               <LogOut size={20} />
            </div>
            <span className={`
              ml-1 font-medium transition-all duration-500 ease-in-out
              ${isFullyExpanded ? 'opacity-100 translate-x-0 delay-75' : 'opacity-0 -translate-x-2 w-0'}
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