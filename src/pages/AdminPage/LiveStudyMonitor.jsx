import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, ChevronDown, ChevronUp, Zap, Coffee,
  PauseCircle, BookOpen, Clock, Activity, Target,
  MoreHorizontal, Play, ClipboardList, AlertCircle,
  Filter, TrendingUp, BarChart3, Eye
} from 'lucide-react';

// --- UTILS ---
const formatClock = (totalSeconds) => {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  return (
    <span className="font-mono font-semibold tracking-wide tabular-nums">
      {[hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':')}
    </span>
  );
};

const toDateSafe = (value) => {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  const n = Number(value);
  if (!Number.isNaN(n) && n > 0) return new Date(n);
  return null;
};

const toMillisSafe = (value) => {
  const d = toDateSafe(value);
  return d ? d.getTime() : null;
};

// --- HOOK DE TIMER SINCRONIZADO ESTÁVEL ---
const useSyncedSeconds = (session) => {
  const [live, setLive] = useState(0);

  // Ref para armazenar dados iniciais da sessão - NUNCA muda durante a vida do componente
  const initialDataRef = useRef(null);

  useEffect(() => {
    if (!session) {
      setLive(0);
      initialDataRef.current = null;
      return;
    }

    // Captura dados APENAS na primeira vez que a sessão é criada
    // UID é a chave - se mudar, é uma nova sessão
    if (!initialDataRef.current || initialDataRef.current.sessionUid !== session.uid) {
      const now = Date.now();
      const perfNow = typeof performance !== 'undefined' ? performance.now() : null;

      initialDataRef.current = {
        sessionUid: session.uid,
        baseSeconds: Number(session.displaySecondsSnapshot ?? session.secondsSnapshot ?? session.seconds ?? 0),
        anchorTime: session._receivedAt || now,
        anchorPerf: session._receivedPerf || perfNow,
        isPomodoro: session.timerType === 'pomodoro' || session.mode === 'pomodoro',
        isCountdown: session.mode === 'countdown',
        isResting: !!session.isResting
      };
    }

    const tick = () => {
      if (!initialDataRef.current) return;

      const isPaused = session.isPaused || session.status === 'paused';

      // Se pausado, mostra o valor atual do Firestore
      if (isPaused) {
        setLive(Number(session.displaySecondsSnapshot ?? session.secondsSnapshot ?? session.seconds ?? 0));
        return;
      }

      // Calcula quanto tempo passou desde o anchor
      let elapsed = 0;
      if (initialDataRef.current.anchorPerf && typeof performance !== 'undefined') {
        elapsed = Math.floor((performance.now() - initialDataRef.current.anchorPerf) / 1000);
      } else {
        elapsed = Math.floor((Date.now() - initialDataRef.current.anchorTime) / 1000);
      }

      // Garante que elapsed é razoável (max 24h)
      elapsed = Math.max(0, Math.min(elapsed, 86400));

      // Calcula segundos atuais baseado na direção
      let currentSeconds;

      if ((initialDataRef.current.isPomodoro && !initialDataRef.current.isResting) || initialDataRef.current.isCountdown) {
        // Regressivo (decrescente)
        currentSeconds = Math.max(0, initialDataRef.current.baseSeconds - elapsed);
      } else {
        // Progressivo (crescente)
        currentSeconds = initialDataRef.current.baseSeconds + elapsed;
      }

      setLive(currentSeconds);
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [session]); // Dependência apenas de session - simples e direto

  return live;
};

// --- COMPONENTES DE UI ---

const PulsingAvatar = ({ user, status }) => {
  const isActive = status === 'focus' || status === 'simulado';

  const gradients = {
    focus: 'from-emerald-400 to-teal-500',
    rest: 'from-blue-400 to-indigo-500',
    paused: 'from-amber-400 to-orange-500',
    simulado: 'from-red-500 to-rose-600'
  };

  const badgeColors = {
    focus: 'bg-emerald-500',
    rest: 'bg-blue-500',
    paused: 'bg-amber-500',
    simulado: 'bg-red-600'
  };

  const currentGradient = gradients[status] || gradients.paused;
  const currentBadgeColor = badgeColors[status] || badgeColors.paused;

  return (
    <div className="relative flex items-center justify-center">
      {isActive && (
        <>
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-20 animate-ping duration-[3s] ${status === 'simulado' ? 'bg-red-500' : 'bg-emerald-400'}`} />
          <span className={`absolute inline-flex h-[110%] w-[110%] rounded-full border opacity-50 ${status === 'simulado' ? 'border-red-500/30' : 'border-emerald-500/30'}`} />
        </>
      )}

      <div className={`relative w-12 h-12 rounded-full p-[2px] bg-gradient-to-br ${currentGradient}`}>
        <div className="w-full h-full rounded-full bg-white dark:bg-zinc-900 overflow-hidden flex items-center justify-center border-2 border-white dark:border-zinc-900">
           {user?.photoURL ? (
             <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
           ) : (
             <span className="font-bold text-zinc-500 text-xs">
               {user?.name?.substring(0,2).toUpperCase() || <Users size={16}/>}
             </span>
           )}
        </div>

        <div className={`absolute -bottom-1 -right-1 p-1 rounded-full text-white shadow-sm border border-white dark:border-zinc-900 ${currentBadgeColor}`}>
          {status === 'focus' && <Zap size={10} fill="currentColor" />}
          {status === 'rest' && <Coffee size={10} />}
          {status === 'paused' && <PauseCircle size={10} />}
          {status === 'simulado' && <ClipboardList size={10} />}
        </div>
      </div>
    </div>
  );
};

// --- CARD DA SESSÃO (VISUALIZAÇÃO EXPANDIDA) ---
const SessionCard = ({ s, getUser, cicloNameByKey, isExpanded, toggleExpand, onOpenUser }) => {
  const liveSeconds = useSyncedSeconds(s);
  const user = getUser(s.uid);

  const isSimulado = s.isSimulado || (!!s.titulo && !s.disciplinaNome);
  const key = `${s.uid}_${s.cicloId || ''}`;
  const cicloNome = s.cicloNome || cicloNameByKey.get(key) || 'Ciclo Avulso';

  const isPaused = s.isPaused || s.status === 'paused';
  const isResting = s.phase === 'rest' || s.isResting;

  let status = 'focus';
  if (isPaused) status = 'paused';
  else if (isSimulado) status = 'simulado';
  else if (isResting) status = 'rest';

  const theme = {
    focus: 'emerald',
    rest: 'blue',
    paused: 'amber',
    simulado: 'red'
  };
  const color = theme[status];

  const titleDisplay = isSimulado ? s.titulo : (s.disciplinaNome || 'Estudo Livre');
  const subTitleDisplay = isSimulado ? 'Simulado em Andamento' : s.assunto;
  const modeDisplay = isSimulado
    ? (s.mode === 'countdown' ? 'Simulado (Tempo Limite)' : 'Simulado (Livre)')
    : (s.timerType === 'pomodoro' ? 'Pomodoro' : 'Cronômetro Livre');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`group relative overflow-hidden rounded-xl transition-all duration-300 border backdrop-blur-sm ${
        isExpanded
          ? `bg-white dark:bg-zinc-800 border-${color}-500/30 shadow-lg shadow-${color}-500/10`
          : 'bg-white/80 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors duration-500 bg-${color}-500`} />

      {status === 'simulado' && (
         <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
      )}

      <div
        onClick={() => toggleExpand(s.uid)}
        className="p-4 pl-5 cursor-pointer flex flex-col md:flex-row items-start md:items-center gap-4 relative"
      >
        <div className="flex items-center gap-4 min-w-[200px]">
          <PulsingAvatar user={user} status={status} />
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 leading-tight">
              {user.name || 'Usuário'}
            </h3>
            <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 text-${color}-600 dark:text-${color}-400 flex items-center gap-1`}>
              {status === 'focus' && 'Focando Agora'}
              {status === 'rest' && 'Descansando'}
              {status === 'paused' && 'Em Pausa'}
              {status === 'simulado' && (
                 <> <AlertCircle size={10} /> Realizando Simulado </>
              )}
            </span>
          </div>
        </div>

        <div className="flex-1 w-full md:w-auto min-w-0 pr-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-start gap-2">
                {isSimulado ? (
                   <ClipboardList size={14} className="mt-0.5 text-red-500 flex-shrink-0" />
                ) : (
                   <BookOpen size={14} className="mt-0.5 text-zinc-400 flex-shrink-0" />
                )}

                <span className={`text-sm font-semibold leading-snug break-words line-clamp-2 ${isSimulado ? 'text-red-700 dark:text-red-300' : 'text-zinc-700 dark:text-zinc-200'}`}>
                  {titleDisplay}
                </span>
              </div>
              {subTitleDisplay && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400 pl-6 break-words line-clamp-1">
                  {subTitleDisplay}
                </span>
              )}
            </div>
        </div>

        <div className="flex items-center justify-between w-full md:w-auto gap-4 md:pl-4 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800 pt-3 md:pt-0">
           <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 border bg-${color}-50 dark:bg-${color}-900/10 border-${color}-100 dark:border-${color}-800/30 text-${color}-700 dark:text-${color}-300`}>
              <Clock size={14} className={(status === 'focus' || status === 'simulado') && !isPaused ? 'animate-pulse' : ''} />
              {formatClock(liveSeconds)}
           </div>

           <div className={`p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-transform duration-300 text-zinc-400 ${isExpanded ? 'rotate-180' : ''}`}>
             <ChevronDown size={18} />
           </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-black/20"
          >
            <div className="p-4 pl-6 grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-2">
                 <h4 className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1">
                   <Activity size={12} /> Detalhes da Sessão
                 </h4>
                 <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800 shadow-sm grid grid-cols-2 gap-2 text-xs">
                    {!isSimulado && (
                        <>
                            <div className="text-zinc-500">Ciclo Atual</div>
                            <div className="font-semibold text-right text-zinc-800 dark:text-zinc-200 truncate">{cicloNome}</div>
                        </>
                    )}

                    <div className="text-zinc-500">Início</div>
                    <div className="font-semibold text-right text-zinc-800 dark:text-zinc-200">
                       {toDateSafe(s.createdAt)?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || '--:--'}
                    </div>

                    <div className="text-zinc-500">Tipo</div>
                    <div className="font-semibold text-right text-zinc-800 dark:text-zinc-200 capitalize">
                       {modeDisplay}
                    </div>
                 </div>
               </div>

               <div className="flex flex-col justify-end space-y-2">
                 <h4 className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1">
                   <Target size={12} /> Ações
                 </h4>
                 <button
                   onClick={(e) => { e.stopPropagation(); onOpenUser(user); }}
                   className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs hover:opacity-90 transition-opacity shadow-md"
                 >
                   Ver Histórico Completo
                 </button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- VISUALIZAÇÃO EM TABELA COMPACTA (Para +5 usuários) ---
const TableRow = ({ s, getUser, cicloNameByKey, onOpenUser }) => {
  const liveSeconds = useSyncedSeconds(s);
  const user = getUser(s.uid);

  const isSimulado = s.isSimulado || (!!s.titulo && !s.disciplinaNome);
  const isPaused = s.isPaused || s.status === 'paused';
  const isResting = s.phase === 'rest' || s.isResting;

  let status = 'focus';
  if (isPaused) status = 'paused';
  else if (isSimulado) status = 'simulado';
  else if (isResting) status = 'rest';

  const theme = {
    focus: 'emerald',
    rest: 'blue',
    paused: 'amber',
    simulado: 'red'
  };
  const color = theme[status];

  const titleDisplay = isSimulado ? s.titulo : (s.disciplinaNome || 'Estudo Livre');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-12 gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900/50 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-all items-center group"
    >
      {/* Avatar + Nome */}
      <div className="col-span-4 flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0">
          <PulsingAvatar user={user} status={status} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">
            {user.name || 'Usuário'}
          </p>
          <p className="text-[10px] text-zinc-500 truncate">{titleDisplay}</p>
        </div>
      </div>

      {/* Status */}
      <div className="col-span-3 flex items-center justify-center">
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-${color}-100 dark:bg-${color}-900/20 text-${color}-700 dark:text-${color}-400 border border-${color}-200 dark:border-${color}-800`}>
          {status === 'focus' && 'Estudando'}
          {status === 'rest' && 'Descansando'}
          {status === 'paused' && 'Pausado'}
          {status === 'simulado' && 'Simulado'}
        </span>
      </div>

      {/* Cronômetro */}
      <div className="col-span-3 flex items-center justify-center">
        <div className={`px-3 py-1.5 rounded-lg border bg-${color}-50 dark:bg-${color}-900/10 border-${color}-100 dark:border-${color}-800/30 text-${color}-700 dark:text-${color}-300`}>
          {formatClock(liveSeconds)}
        </div>
      </div>

      {/* Ações */}
      <div className="col-span-2 flex items-center justify-end">
        <button
          onClick={() => onOpenUser(user)}
          className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Eye size={16} className="text-zinc-600 dark:text-zinc-400" />
        </button>
      </div>
    </motion.div>
  );
};

// --- COMPONENTE PRINCIPAL ---
const StudyingNowPanel = ({ sessions = [], getUser, cicloNameByKey, onOpenUser }) => {
  const [expandedUid, setExpandedUid] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('auto');

  // Contadores
  const counts = useMemo(() => {
    let focus = 0;
    let rest = 0;
    let paused = 0;
    let simulado = 0;

    sessions.forEach(s => {
       const isSim = s.isSimulado || (!!s.titulo && !s.disciplinaNome);
       const isPausedSess = s.isPaused || s.status === 'paused';

       if (isPausedSess) {
         paused++;
       } else if (isSim) {
         simulado++;
       } else if (s.isResting || s.phase === 'rest') {
         rest++;
       } else {
         focus++;
       }
    });

    return { focus, rest, paused, simulado, total: sessions.length };
  }, [sessions]);

  // Filtragem
  const filteredSessions = useMemo(() => {
    if (filterStatus === 'all') return sessions;

    return sessions.filter(s => {
      const isSim = s.isSimulado || (!!s.titulo && !s.disciplinaNome);
      const isPausedSess = s.isPaused || s.status === 'paused';
      const isRestingSess = s.isResting || s.phase === 'rest';

      if (filterStatus === 'simulado') return isSim;
      if (filterStatus === 'paused') return isPausedSess && !isSim;
      if (filterStatus === 'rest') return isRestingSess && !isSim;
      if (filterStatus === 'focus') return !isPausedSess && !isRestingSess && !isSim;

      return true;
    });
  }, [sessions, filterStatus]);

  // Determina modo de visualização
  const shouldUseTable = viewMode === 'table' || (viewMode === 'auto' && filteredSessions.length > 5);

  const toggleExpand = (uid) => setExpandedUid(prev => prev === uid ? null : uid);

  return (
    <>
      {/* Estilos do Scrollbar Customizado */}
      <style dangerouslySetInnerHTML={{__html: `
        .live-monitor-scroll::-webkit-scrollbar {
          width: 8px;
        }

        .live-monitor-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .live-monitor-scroll::-webkit-scrollbar-thumb {
          background: #a1a1aa;
          border-radius: 4px;
          transition: background 0.2s ease;
        }

        .live-monitor-scroll::-webkit-scrollbar-thumb:hover {
          background: #71717a;
        }

        .dark .live-monitor-scroll::-webkit-scrollbar-thumb {
          background: #3f3f46;
        }

        .dark .live-monitor-scroll::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }

        /* Firefox */
        .live-monitor-scroll {
          scrollbar-width: thin;
          scrollbar-color: #a1a1aa transparent;
        }

        .dark .live-monitor-scroll {
          scrollbar-color: #3f3f46 transparent;
        }
      `}} />

      <div className="relative h-full flex flex-col overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shadow-2xl">

      {/* BACKGROUND DECORATIVO */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
      </div>

      {/* HEADER FIXO COM STICKY E Z-INDEX ALTO */}
      <div className="sticky top-0 z-50 flex-shrink-0 px-6 py-5 flex flex-col gap-4 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 backdrop-blur-md shadow-sm">
        {/* Linha 1: Título + Estatísticas */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
               <span className="relative flex h-3 w-3">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
               </span>
               <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Ao Vivo</span>
            </div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Monitoramento</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
               {filteredSessions.length} {filteredSessions.length === 1 ? 'aluno conectado' : 'alunos conectados'}
            </p>
          </div>

          {/* Status Pills */}
          <div className="flex flex-wrap gap-2">
             {counts.simulado > 0 && (
               <div className="px-3 py-1 rounded-full bg-red-100/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                 <ClipboardList size={12} fill="currentColor" /> {counts.simulado}
               </div>
             )}
             <div className="px-3 py-1 rounded-full bg-emerald-100/50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5">
               <Zap size={12} fill="currentColor" /> {counts.focus}
             </div>
             <div className="px-3 py-1 rounded-full bg-blue-100/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-xs font-bold flex items-center gap-1.5">
               <Coffee size={12} /> {counts.rest}
             </div>
             <div className="px-3 py-1 rounded-full bg-amber-100/50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5">
               <PauseCircle size={12} /> {counts.paused}
             </div>
          </div>
        </div>

        {/* Linha 2: Filtros + Controles de Visualização */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Filtros */}
          <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 flex-wrap">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${
                filterStatus === 'all'
                  ? 'bg-white dark:bg-zinc-800 shadow text-zinc-900 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterStatus('focus')}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${
                filterStatus === 'focus'
                  ? 'bg-emerald-500 shadow text-white'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Estudando
            </button>
            {counts.simulado > 0 && (
              <button
                onClick={() => setFilterStatus('simulado')}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${
                  filterStatus === 'simulado'
                    ? 'bg-red-500 shadow text-white'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                Simulados
              </button>
            )}
          </div>

          {/* Controles de Visualização */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-zinc-400 mr-1">Vista:</span>
            <button
              onClick={() => setViewMode('auto')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'auto'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
              title="Auto (Cards até 5, depois Tabela)"
            >
              <TrendingUp size={14} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'cards'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
              title="Cards Expandidos"
            >
              <Activity size={14} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
              title="Tabela Compacta"
            >
              <BarChart3 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO COM SCROLL */}
      <div className="relative z-0 flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 md:px-6 py-4 space-y-3 live-monitor-scroll" style={{ scrollbarGutter: 'stable' }}>
          <AnimatePresence mode='popLayout'>
            {filteredSessions.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full min-h-[300px] text-center"
              >
                 <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                   <Users size={32} className="text-zinc-300 dark:text-zinc-600" />
                 </div>
                 <h3 className="text-lg font-bold text-zinc-700 dark:text-zinc-200">
                   {filterStatus === 'all' ? 'Sala Vazia' : 'Nenhum resultado'}
                 </h3>
                 <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mt-2">
                   {filterStatus === 'all'
                     ? 'Assim que os alunos iniciarem os estudos ou simulados, eles aparecerão aqui.'
                     : 'Não há alunos com este status no momento.'
                   }
                 </p>
              </motion.div>
            ) : shouldUseTable ? (
              // VISUALIZAÇÃO EM TABELA COMPACTA
              <div className="space-y-2 w-full">
                {/* Header da Tabela (sticky dentro do scroll) */}
                <div className="sticky top-0 z-10 grid grid-cols-12 gap-3 px-3 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-[10px] font-black uppercase text-zinc-500 tracking-wider backdrop-blur-sm">
                  <div className="col-span-4">Aluno / Atividade</div>
                  <div className="col-span-3 text-center">Status</div>
                  <div className="col-span-3 text-center">Tempo</div>
                  <div className="col-span-2 text-right">Ações</div>
                </div>

                {/* Linhas da Tabela */}
                {filteredSessions.map((s) => (
                  <TableRow
                    key={`${s.uid}_${s.updatedAt}`}
                    s={s}
                    getUser={getUser}
                    cicloNameByKey={cicloNameByKey}
                    onOpenUser={onOpenUser}
                  />
                ))}
              </div>
            ) : (
              // VISUALIZAÇÃO EM CARDS EXPANDIDOS
              <div className="space-y-3 w-full">
                {filteredSessions.map((s) => (
                  <SessionCard
                    key={`${s.uid}_${s.updatedAt}`}
                    s={s}
                    getUser={getUser}
                    cicloNameByKey={cicloNameByKey}
                    isExpanded={expandedUid === s.uid}
                    toggleExpand={toggleExpand}
                    onOpenUser={onOpenUser}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* FOOTER SOMBRA (Indicador de Scroll) */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-zinc-50 dark:from-zinc-950 to-transparent pointer-events-none z-20" />
      </div>
    </div>
    </>
  );
};

export default StudyingNowPanel;