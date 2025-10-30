import React from 'react';
// 1. Importar ícones do Lucide
import {
  Home,
  Target,
  Calendar,
  User,
  LogOut,
  RefreshCw, // Para Ciclos
  ScrollText, // Para Histórico
  ChevronLeft,
  ChevronRight,
  Menu
} from 'lucide-react';

// 2. Importar Link (se você usar para o Perfil)
import { Link } from 'react-router-dom';

// 3. Ícone de Avatar Padrão (placeholder)
const IconUserAvatar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full text-gray-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
);


function NavSideBar({
  user, // 4. Receber o objeto user completo
  activeTab,
  setActiveTab,
  handleLogout,
  isExpanded,
  setExpanded,
  isMobileOpen,
  setMobileOpen
}) {
  const navItems = [
    { id: 'home', label: 'Home', icon: <Home size={20} /> },
    { id: 'ciclos', label: 'Meus Ciclos', icon: <RefreshCw size={20} /> },
    { id: 'goals', label: 'Metas', icon: <Target size={20} /> },
    { id: 'calendar', label: 'Calendário', icon: <Calendar size={20} /> },
    { id: 'historico', label: 'Histórico', icon: <ScrollText size={20} /> }, // 5. Novo item "Histórico"
    { id: 'profile', label: 'Perfil', icon: <User size={20} /> },
  ];

  const HamburgerButton = () => (
    <button
      className={`fixed top-4 left-4 z-[51] flex lg:hidden items-center justify-center
                 w-10 h-10 bg-card-background-color dark:bg-dark-card-background-color
                 border border-border-color dark:border-dark-border-color rounded-lg shadow-card-shadow cursor-pointer
                 transition-opacity duration-300 ease-in-out
                 ${isMobileOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
      onClick={() => setMobileOpen(!isMobileOpen)}
      aria-label="Abrir menu"
    >
      <Menu size={22} className="text-text-color dark:text-dark-text-color" />
    </button>
  );

  // 6. Lógica de expansão atualizada
  const isFullyExpanded = isExpanded || isMobileOpen;

  return (
    <>
      <HamburgerButton />
      <nav
        className={`fixed top-0 z-50 h-screen flex flex-col
                    bg-card-background-color dark:bg-dark-card-background-color
                    border-r border-border-color dark:border-dark-border-color
                    transition-[width,left] duration-300 ease-in-out
                    w-[260px]
                    ${isMobileOpen ? 'left-0' : '-left-[260px]'}
                    lg:left-0
                    ${isExpanded ? 'lg:w-[260px]' : 'lg:w-[70px]'}
                  `}
        onMouseEnter={() => !isMobileOpen && setExpanded(true)}
        onMouseLeave={() => !isMobileOpen && setExpanded(false)}
      >
        {/* Header com Logo */}
        <div className="flex items-center justify-center min-h-[50px] overflow-hidden border-b border-border-color dark:border-dark-border-color px-4 pb-4 mb-4 mt-5 lg:mt-0">
          <img
            src="/logo-pmba.png"
            alt="Logo"
            className={`h-auto object-contain transition-all duration-300 ease-in-out ${
              isFullyExpanded ? 'max-w-[120px] max-h-[55px]' : 'max-w-[55px] max-h-[55px]'
            }`}
          />
        </div>

        {/* 7. Flex-grow para empurrar o perfil/logout para baixo */}
        <div className="flex-grow overflow-y-auto overflow-x-hidden">
          {/* Lista de navegação */}
          <ul className="list-none p-0 m-0">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    className={`flex items-center gap-4 w-[calc(100%-16px)] m-2 py-3 px-4 rounded-lg font-semibold whitespace-nowrap overflow-hidden transition-all duration-200
                      ${isActive
                        ? 'bg-primary-color text-white'
                        : 'text-subtle-text-color dark:text-dark-subtle-text-color hover:bg-background-color dark:hover:bg-dark-background-color hover:text-text-color dark:hover:text-dark-text-color'
                      }
                    `}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileOpen(false);
                    }}
                  >
                    <span className="min-w-[24px] text-center">{item.icon}</span>
                    <span
                      className={`transition-opacity duration-300 ease-in-out ${
                        isFullyExpanded ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 8. Nova Seção de Perfil e Logout */}
        <div className="flex-shrink-0 border-t border-border-color dark:border-dark-border-color p-2">
           {/* Botão de Perfil do Usuário */}
          <button
            className={`flex items-center gap-3 w-full p-3 rounded-lg whitespace-nowrap overflow-hidden transition-colors duration-200
                      text-subtle-text-color dark:text-dark-subtle-text-color hover:bg-background-color dark:hover:bg-dark-background-color hover:text-text-color dark:hover:text-dark-text-color
                      ${activeTab === 'profile' ? 'bg-background-color dark:bg-dark-background-color text-white' : ''}
                    `}
             onClick={() => {
               setActiveTab('profile');
               setMobileOpen(false);
             }}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gray-800">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <IconUserAvatar />
              )}
            </div>
            <div className={`flex flex-col items-start transition-opacity duration-300 ease-in-out ${isFullyExpanded ? 'opacity-100' : 'opacity-0'}`}>
              <span className="text-sm font-semibold text-text-color dark:text-dark-text-color leading-tight">
                {user?.displayName || 'Usuário'}
              </span>
              <span className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color">
                Ver Perfil
              </span>
            </div>
          </button>

          {/* Botão Logout */}
          <button
            className={`flex items-center gap-4 w-full p-3 py-3 px-4 rounded-lg font-semibold whitespace-nowrap overflow-hidden transition-all duration-200
                      text-subtle-text-color dark:text-dark-subtle-text-color hover:bg-background-color dark:hover:bg-dark-background-color hover:text-text-color dark:hover:text-dark-text-color
                    `}
            onClick={handleLogout}
          >
            <span className="min-w-[24px] text-center"><LogOut size={20} /></span>
            <span
              className={`transition-opacity duration-300 ease-in-out ${
                isFullyExpanded ? 'opacity-100' : 'opacity-0'
              }`}
            >
              Sair
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default NavSideBar;