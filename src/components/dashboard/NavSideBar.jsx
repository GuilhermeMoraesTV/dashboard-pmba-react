import React from 'react';


// Ícones (com adição)
const IconHome = () => <span>🏠</span>;
const IconQuestions = () => <span>❓</span>;
const IconHours = () => <span>⏱️</span>;
const IconGoals = () => <span>🎯</span>;
const IconCalendar = () => <span>📅</span>;
const IconCiclos = () => <span>🔄</span>; // <-- NOVO ÍCONE
const IconLogout = () => <span>🚪</span>;
// --------------------------------------------------------

function NavSideBar({
  activeTab,
  setActiveTab,
  handleLogout,
  isExpanded,
  setExpanded,
  isMobileOpen,
  setMobileOpen
}) {
  const navItems = [
    { id: 'home', label: 'Home', icon: <IconHome /> },
    { id: 'questions', label: 'Questões', icon: <IconQuestions /> },
    { id: 'hours', label: 'Horas', icon: <IconHours /> },
    { id: 'goals', label: 'Metas', icon: <IconGoals /> },
    { id: 'calendar', label: 'Calendário', icon: <IconCalendar /> },
    { id: 'ciclos', label: 'Meus Ciclos', icon: <IconCiclos /> }, // <-- NOVO ITEM DO MENU
  ];

  // --- HAMBURGER BUTTON (sem alteração) ---
  const HamburgerButton = () => (
    <button
      className={`fixed top-4 left-4 z-[51] flex lg:hidden flex-col items-center justify-center
                 w-10 h-10 gap-1 bg-card-background-color dark:bg-dark-card-background-color
                 border border-border-color dark:border-dark-border-color rounded-lg shadow-card-shadow cursor-pointer
                 transition-opacity duration-300 ease-in-out
                 ${isMobileOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`} // Esconde quando aberto

      onClick={() => setMobileOpen(!isMobileOpen)}
      aria-label="Abrir/Fechar menu" // Label atualizado
    >
      {/* Ícone de hambúrguer (sem alteração) */}
      <span className="block w-[22px] h-[2.5px] bg-text-color dark:bg-dark-text-color rounded-full transition-all duration-300 ease-in-out"></span>
      <span className="block w-[22px] h-[2.5px] bg-text-color dark:bg-dark-text-color rounded-full transition-all duration-300 ease-in-out"></span>
      <span className="block w-[22px] h-[2.5px] bg-text-color dark:bg-dark-text-color rounded-full transition-all duration-300 ease-in-out"></span>
    </button>
  );

  // --- LÓGICA DE EXPANSÃO (sem alterações) ---
  const isFullyExpanded = (isExpanded && !isMobileOpen) || isMobileOpen;

  return (
    <>
      <HamburgerButton />
      <nav
        // Z-Index 50 e Lógica de Classes (sem alterações)
        className={`fixed top-0 z-50 h-screen
                    bg-card-background-color dark:bg-dark-card-background-color
                    border-r border-border-color dark:border-dark-border-color
                    transition-[width,left] duration-300 ease-in-out

                    /* Mobile: Escondido por padrão, expande quando aberto */
                    w-[260px] /* Largura total quando visível */
                    ${isMobileOpen ? 'left-0' : '-left-[260px]'} /* Controla a visibilidade */

                    /* Desktop: Sobrescreve mobile. Visível, largura baseada no hover */
                    lg:left-0 /* Sempre visível */
                    ${isExpanded ? 'lg:w-[260px]' : 'lg:w-[70px]'} /* Controla a largura */
                  `}

        // Eventos de hover (sem alteração)
        onMouseEnter={() => !isMobileOpen && setExpanded(true)}
        onMouseLeave={() => !isMobileOpen && setExpanded(false)}
      >
        {/* --- HEADER (sem alterações) --- */}
        <div className="flex items-center justify-center min-h-[50px] overflow-hidden border-b border-border-color dark:border-dark-border-color px-4 pb-4 mb-4 mt-5 lg:mt-0">
          <img
            src="/logo-pmba.png"
            alt="Logo"
            className={`h-auto object-contain transition-all duration-300 ease-in-out ${isFullyExpanded ? 'max-w-[120px] max-h-[55px]' : 'max-w-[55px] max-h-[55px]'}`}
          />
        </div>

        {/* --- LISTA DE NAVEGAÇÃO (agora com 6 itens) --- */}
        <ul className="list-none p-0 m-0">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  className={`flex items-center gap-3 w-[calc(100%-16px)] m-2 py-3 px-4 rounded-lg font-semibold whitespace-nowrap overflow-hidden transition-all duration-200
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
                  <span className="text-xl min-w-[24px] text-center">{item.icon}</span>
                  <span
                    className={`transition-opacity duration-300 ease-in-out ${isFullyExpanded ? 'opacity-100' : 'opacity-0'}`}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* --- BOTÃO DE LOGOUT (sem alterações) --- */}
        <ul className="list-none p-0 m-0 absolute bottom-4 w-full">
          <li>
            <button
              className={`flex items-center gap-3 w-[calc(100%-16px)] m-2 py-3 px-4 rounded-lg font-semibold whitespace-nowrap overflow-hidden transition-all duration-200
                        text-subtle-text-color dark:text-dark-subtle-text-color hover:bg-background-color dark:hover:bg-dark-background-color hover:text-text-color dark:hover:text-dark-text-color
                      `}
              onClick={handleLogout}
            >
              <span className="text-xl min-w-[24px] text-center"><IconLogout /></span>
              <span
                className={`transition-opacity duration-300 ease-in-out ${isFullyExpanded ? 'opacity-100' : 'opacity-0'}`}
              >
                Sair
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

export default NavSideBar;