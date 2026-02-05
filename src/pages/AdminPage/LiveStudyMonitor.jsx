import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, ChevronDown, ChevronUp, Zap, Coffee,
  PauseCircle, BookOpen, Clock, Activity, Target,
  MoreHorizontal, Play, ClipboardList, AlertCircle
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

// --- HOOK DE TIMER UNIFICADO (Estudo + Simulado) ---
const useSyncedSeconds = (session) => {
  const [live, setLive] = useState(0);

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      // Tenta ler snapshot do Estudo OU do Simulado
      const baseSec = Number(session.displaySecondsSnapshot ?? session.secondsSnapshot ?? session.seconds ?? 0);

      if (session.isPaused || session.status === 'paused') {
        setLive(baseSec);
        return;
      }

      let delta = 0;
      if (typeof session._receivedPerf === 'number') {
        delta = Math.floor((performance.now() - session._receivedPerf) / 1000);
      } else if (typeof session._receivedAt === 'number') {
        delta = Math.floor((Date.now() - session._receivedAt) / 1000);
      } else {
        const lastUpdate = toMillisSafe(session.updatedAt) || Date.now();
        delta = Math.floor((Date.now() - lastUpdate) / 1000);
      }

      // Lógica de direção (Contagem regressiva ou progressiva)
      const isPomodoro = (session.timerType === 'pomodoro' || session.mode === 'pomodoro');
      const isCountdown = session.mode === 'countdown'; // Simulado countdown
      const isResting = !!session.isResting;

      let next = baseSec;

      if ((isPomodoro && !isResting) || isCountdown) {
        // Decrescente
        next = Math.max(0, baseSec - delta);
      } else if (isResting) {
        // Descanso decrescente (ou crescente dependendo da config, assumindo decrescente padrao pomodoro)
        next = Math.max(0, baseSec - delta);
      } else {
        // Crescente (Livre)
        next = baseSec + delta;
      }

      setLive(Math.floor(next));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session]);

  return live;
};

// --- COMPONENTES DE UI ---

const PulsingAvatar = ({ user, status }) => {
  // Simulado é sempre ativo visualmente se não estiver pausado
  const isActive = status === 'focus' || status === 'simulado';

  // Cores do anel/fundo baseadas no status
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
      {/* Ondas pulsantes */}
      {isActive && (
        <>
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-20 animate-ping duration-[3s] ${status === 'simulado' ? 'bg-red-500' : 'bg-emerald-400'}`} />
          <span className={`absolute inline-flex h-[110%] w-[110%] rounded-full border opacity-50 ${status === 'simulado' ? 'border-red-500/30' : 'border-emerald-500/30'}`} />
        </>
      )}

      <div className={`relative z-10 w-12 h-12 rounded-full p-[2px] bg-gradient-to-br ${currentGradient}`}>
        <div className="w-full h-full rounded-full bg-white dark:bg-zinc-900 overflow-hidden flex items-center justify-center border-2 border-white dark:border-zinc-900">
           {user?.photoURL ? (
             <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
           ) : (
             <span className="font-bold text-zinc-500 text-xs">
               {user?.name?.substring(0,2).toUpperCase() || <Users size={16}/>}
             </span>
           )}
        </div>

        {/* Badge de Ícone */}
        <div className={`absolute -bottom-1 -right-1 z-20 p-1 rounded-full text-white shadow-sm border border-white dark:border-zinc-900 ${currentBadgeColor}`}>
          {status === 'focus' && <Zap size={10} fill="currentColor" />}
          {status === 'rest' && <Coffee size={10} />}
          {status === 'paused' && <PauseCircle size={10} />}
          {status === 'simulado' && <ClipboardList size={10} />}
        </div>
      </div>
    </div>
  );
};

// --- CARD DA SESSÃO ---
const SessionCard = ({ s, getUser, cicloNameByKey, isExpanded, toggleExpand, onOpenUser }) => {
  const liveSeconds = useSyncedSeconds(s);
  const user = getUser(s.uid);

  // Determinar se é Simulado ou Estudo Normal
  // O SimuladoTimer salva "titulo" e "mode", mas não "disciplinaNome" geralmente.
  // Vamos assumir que se tem 'titulo' e não tem 'disciplinaNome' (ou tem flag isSimulado), é simulado.
  const isSimulado = s.isSimulado || (!!s.titulo && !s.disciplinaNome);

  const key = `${s.uid}_${s.cicloId || ''}`;
  const cicloNome = s.cicloNome || cicloNameByKey.get(key) || 'Ciclo Avulso';

  // Lógica de Status
  const isPaused = s.isPaused || s.status === 'paused';
  const isResting = s.phase === 'rest' || s.isResting;

  let status = 'focus';
  if (isPaused) status = 'paused';
  else if (isSimulado) status = 'simulado';
  else if (isResting) status = 'rest';

  // Cores Temáticas
  const theme = {
    focus: 'emerald',
    rest: 'blue',
    paused: 'amber',
    simulado: 'red'
  };
  const color = theme[status];

  // Dados de Exibição
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
      {/* Barra lateral colorida animada */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors duration-500 bg-${color}-500`} />

      {/* Background sutil de urgência para simulado */}
      {status === 'simulado' && (
         <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
      )}

      {/* Conteúdo Principal */}
      <div
        onClick={() => toggleExpand(s.uid)}
        className="p-4 pl-5 cursor-pointer flex flex-col md:flex-row items-start md:items-center gap-4 relative z-10"
      >
        {/* 1. Avatar & Nome */}
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

        {/* 2. Conteúdo Central (Disciplina ou Simulado) */}
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

        {/* 3. Timer & Toggle (Direita) */}
        <div className="flex items-center justify-between w-full md:w-auto gap-4 md:pl-4 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800 pt-3 md:pt-0">
           {/* Pílula do Timer */}
           <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 border bg-${color}-50 dark:bg-${color}-900/10 border-${color}-100 dark:border-${color}-800/30 text-${color}-700 dark:text-${color}-300`}>
              <Clock size={14} className={(status === 'focus' || status === 'simulado') && !isPaused ? 'animate-pulse' : ''} />
              {formatClock(liveSeconds)}
           </div>

           <div className={`p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-transform duration-300 text-zinc-400 ${isExpanded ? 'rotate-180' : ''}`}>
             <ChevronDown size={18} />
           </div>
        </div>
      </div>

      {/* Área Expandida */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-black/20"
          >
            <div className="p-4 pl-6 grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Info */}
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

               {/* Ações */}
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

// --- COMPONENTE PRINCIPAL ---
const StudyingNowPanel = ({ sessions = [], getUser, cicloNameByKey, onOpenUser }) => {
  const [expandedUid, setExpandedUid] = useState(null);

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

  const toggleExpand = (uid) => setExpandedUid(prev => prev === uid ? null : uid);

  return (
    <div className="relative h-full flex flex-col overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shadow-2xl">

      {/* BACKGROUND DECORATIVO */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
      </div>

      {/* HEADER */}
      <div className="relative z-10 px-6 py-5 flex flex-col md:flex-row items-start md:items-end justify-between gap-4 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md">
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
             {sessions.length} {sessions.length === 1 ? 'aluno conectado' : 'alunos conectados'}
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap gap-2">
           {counts.simulado > 0 && (
             <div className="px-3 py-1 rounded-full bg-red-100/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-bold flex items-center gap-1.5 animate-pulse">
               <ClipboardList size={12} fill="currentColor" /> {counts.simulado} Simulados
             </div>
           )}
           <div className="px-3 py-1 rounded-full bg-emerald-100/50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5">
             <Zap size={12} fill="currentColor" /> {counts.focus} Estudando
           </div>
           <div className="px-3 py-1 rounded-full bg-blue-100/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-xs font-bold flex items-center gap-1.5">
             <Coffee size={12} /> {counts.rest} Descansando
           </div>
           <div className="px-3 py-1 rounded-full bg-amber-100/50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5">
             <PauseCircle size={12} /> {counts.paused} Pausados
           </div>
        </div>
      </div>

      {/* LISTA DE SESSÕES */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4 md:p-6 space-y-3 custom-scrollbar">
        <AnimatePresence mode='popLayout'>
          {sessions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full min-h-[300px] text-center"
            >
               <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                 <Users size={32} className="text-zinc-300 dark:text-zinc-600" />
               </div>
               <h3 className="text-lg font-bold text-zinc-700 dark:text-zinc-200">Sala Vazia</h3>
               <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mt-2">
                 Assim que os alunos iniciarem os estudos ou simulados, eles aparecerão aqui.
               </p>
            </motion.div>
          ) : (
            sessions.map((s) => (
              <SessionCard
                key={`${s.uid}_${s.status}`} // Chave composta para forçar re-render se status mudar drasticamente
                s={s}
                getUser={getUser}
                cicloNameByKey={cicloNameByKey}
                isExpanded={expandedUid === s.uid}
                toggleExpand={toggleExpand}
                onOpenUser={onOpenUser}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* FOOTER SOMBRA */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-zinc-950 to-transparent pointer-events-none z-20" />
    </div>
  );
};

export default StudyingNowPanel;