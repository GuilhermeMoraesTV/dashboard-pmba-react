import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Home, Target, Calendar, LogOut, RefreshCw, Menu, ShieldAlert,
  LayoutList, BarChart2, ClipboardList, Sun, Moon, User, Radio, X, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

import HeaderProgress from '../dashboard/HeaderProgress';
import ProfileLevelRing from '../gamification/ProfileLevelRing';

// IMPORTAÇÕES DO SISTEMA DE LEVEL COMENTADAS PARA O FUTURO:
// import { getRankTheme } from '../gamification/ProfileLevelRing';
// import { useLevelSystem } from '../../hooks/useLevelSystem';

const ADMIN_UID = 'OLoJi457GQNE2eTSOcz9DAD6ppZ2';

function NavSideBar({
  user,
  activeTab,
  setActiveTab,
  handleLogout,
  isExpanded,
  setExpanded,
  isMobileOpen,
  setMobileOpen,
  isDarkMode,
  toggleTheme,
  registrosEstudo,
  goalsHistory,
  activeCicloId,
  onShareGoal,
  onOpenFeedback
}) {

  // HOOKS GAMIFICAÇÃO COMENTADOS
  // const { levelData } = useLevelSystem(user);

  const [hasUnreadSupport, setHasUnreadSupport] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'system_feedback'), where('uid', '==', user.uid), where('unreadUser', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => setHasUnreadSupport(!snapshot.empty));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      items.push({ id: 'admin', label: 'Admin Zone', icon: <ShieldAlert size={22} />, isAdmin: true });
    }
    return items;
  }, [user]);

  // Scroll para o topo ao clicar na logo
  const handleLogoClick = () => {
    setActiveTab('home');
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isFullyExpanded = isExpanded || isMobileOpen;

  // Render do TopBar
  const TopBar = () => (
    <div
      className={`
        fixed top-0 right-0 h-[70px] z-[60]
        bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800
        flex items-center justify-between px-4 shadow-sm transition-all duration-300
        left-0 lg:left-[80px]
        ${isExpanded ? 'lg:left-[260px]' : 'lg:left-[80px]'}
      `}
    >
      <div className="flex items-center z-20">
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-2 -ml-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
        >
          <Menu size={24} />
        </button>
      </div>

      <div
        onClick={handleLogoClick}
        className="absolute left-1/2 -translate-x-1/2 cursor-pointer z-0 group select-none"
      >
         <h1 className="text-red-600 font-black tracking-[0.2em] uppercase text-base sm:text-xl whitespace-nowrap transition-all duration-300 group-hover:scale-105 group-active:scale-95 drop-shadow-sm">
            MODOQAP
         </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 z-10">
        <div className="relative flex items-center justify-center min-w-[44px] min-h-[44px] pointer-events-auto">
           <div className="scale-[0.75] sm:scale-[0.85] lg:scale-90 origin-right">
              <HeaderProgress
                 registrosEstudo={registrosEstudo}
                 goalsHistory={goalsHistory}
                 activeCicloId={activeCicloId}
                 onShareGoal={onShareGoal}
              />
           </div>
        </div>

        <button
          onClick={toggleTheme}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-red-600 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center transition-all active:scale-90"
        >
          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="outline-none active:scale-95 transition-transform flex items-center justify-center lg:scale-105 relative"
            >
               <ProfileLevelRing userPhotoURL={user?.photoURL} size={50} />
            </button>

            <AnimatePresence>
                {isProfileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 top-full mt-3 w-80 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl z-[100] overflow-hidden ring-1 ring-black/5 dark:ring-white/5"
                    >
                         <div className="relative flex flex-col items-center pt-10 pb-8 px-6 overflow-hidden bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-red-500/5 to-transparent dark:from-red-500/10 pointer-events-none"></div>

                            {/* FOTO DE PERFIL NO MENU (Sem Engrenagem) */}
                            <div className="relative z-10 mb-4 drop-shadow-xl transform hover:scale-105 transition-transform duration-500 cursor-pointer" onClick={() => { setActiveTab('profile'); setIsProfileMenuOpen(false); }}>
                                <ProfileLevelRing
                                    userPhotoURL={user?.photoURL}
                                    size={96}
                                    strokeWidth={4}
                                />
                            </div>

                            <h3 className="relative z-10 font-black text-zinc-900 dark:text-white text-xl text-center leading-tight truncate w-full tracking-tight mb-1">
                                {user?.displayName || 'Guerreiro'}
                            </h3>
                         </div>

                         <div className="p-3 space-y-2 bg-white dark:bg-zinc-950">
                            <button
                                onClick={() => { setActiveTab('profile'); setIsProfileMenuOpen(false); }}
                                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white transition-all group border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 group-hover:text-red-500 group-hover:bg-red-50 dark:group-hover:bg-red-900/20 transition-all">
                                        <User size={18} />
                                    </div>
                                    <span>Meu Perfil</span>
                                </div>
                                <ChevronRight size={16} className="text-zinc-300 group-hover:text-zinc-500 transition-colors"/>
                            </button>

                            <button
                                onClick={() => { onOpenFeedback(); setIsProfileMenuOpen(false); }}
                                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white transition-all group border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 group-hover:text-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-all">
                                        <Radio size={18} className={hasUnreadSupport ? 'animate-pulse' : ''} />
                                        {hasUnreadSupport && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900"></span>}
                                    </div>
                                    <span>Suporte</span>
                                </div>
                                <ChevronRight size={16} className="text-zinc-300 group-hover:text-zinc-500 transition-colors"/>
                            </button>

                            <div className="h-px bg-zinc-100 dark:bg-zinc-900 mx-4"></div>

                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center px-4 py-3.5 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-2 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-500 group-hover:bg-red-100 dark:group-hover:bg-red-900/30 transition-all">
                                        <LogOut size={18} />
                                    </div>
                                    <span>Sair do Sistema</span>
                                </div>
                            </button>
                         </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <TopBar />

      <div
        className={`fixed inset-0 bg-black/60 z-[70] lg:hidden backdrop-blur-sm transition-opacity duration-300 ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileOpen(false)}
      />

      <nav
        className={`
          fixed top-0 z-[80] flex flex-col h-screen bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800
          transition-all duration-300 shadow-2xl lg:shadow-none
          ${isMobileOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full lg:translate-x-0'}
          lg:left-0 ${isExpanded ? 'lg:w-[260px]' : 'lg:w-[80px]'}
        `}
        onMouseEnter={() => !isMobileOpen && setExpanded(true)}
        onMouseLeave={() => !isMobileOpen && setExpanded(false)}
      >
        <div className="flex-shrink-0 flex items-center justify-between lg:justify-center h-[80px] px-6 relative border-b border-zinc-100 dark:border-zinc-800 lg:border-none">
           <div onClick={handleLogoClick} className={`cursor-pointer transition-all duration-500 flex items-center justify-center ${isFullyExpanded ? 'scale-110' : 'scale-100'}`}>
             <img src="/logo-pmba.png" alt="Logo" className="h-14 w-auto object-contain drop-shadow-sm" />
           </div>
           <button onClick={() => setMobileOpen(false)} className="lg:hidden p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
             <X size={20} />
           </button>
        </div>

        <div className="flex-1 py-4 px-3 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                    setActiveTab(item.id);
                    setMobileOpen(false);
                    if (item.id === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`
                  relative flex items-center w-full p-3 rounded-2xl transition-all duration-200 group overflow-hidden whitespace-nowrap
                  ${isActive
                    ? item.isAdmin ? 'bg-zinc-800 text-red-500 shadow-md ring-1 ring-red-900/20' : 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-red-600 dark:hover:text-red-500'
                  }
                `}
              >
                <span className={`flex-shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </span>
                <span className={`ml-4 text-xs font-black uppercase tracking-widest transition-all duration-300 ${isFullyExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 w-0'}`}>
                  {item.label}
                </span>
                {isActive && !isFullyExpanded && !isMobileOpen && (
                  <div className="absolute right-2 top-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export default NavSideBar;