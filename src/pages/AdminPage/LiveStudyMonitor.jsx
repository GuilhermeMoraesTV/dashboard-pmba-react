import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Timer, ChevronDown, ChevronUp, Clock, Zap, HelpCircle, Eye
} from 'lucide-react';

// --- UTILS LOCAIS ---
const formatClock = (totalSeconds) => {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':');
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

// --- COMPONENTE AVATAR SIMPLES ---
const Avatar = ({ user, size = "md" }) => {
    const sizeClasses = { sm: "w-8 h-8 text-[10px]", md: "w-10 h-10 text-xs", lg: "w-16 h-16 text-lg" };
    return (
      <div className={`${sizeClasses[size]} rounded-full flex-shrink-0 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 border-2 border-white dark:border-zinc-700 shadow-sm overflow-hidden flex items-center justify-center relative`}>
        {user?.photoURL ? (
          <img src={user.photoURL} alt={user?.name || 'user'} className="w-full h-full object-cover" />
        ) : (
          <span className="font-black text-zinc-500 dark:text-zinc-400">
            {user?.name ? user.name.substring(0, 2).toUpperCase() : <Users size={14} />}
          </span>
        )}
      </div>
    );
};

// --- HOOK DE SINCRONIZAÇÃO DE TIMER ---
const useSyncedSeconds = (session) => {
  const [live, setLive] = useState(0);

  useEffect(() => {
    if (!session) return;

    const tick = () => {
      // 1. Base: snapshot que o usuário enviou
      const baseSec = Number(session.displaySecondsSnapshot ?? session.seconds ?? 0);

      // 2. Se estiver PAUSADO, confie no snapshot
      if (session.isPaused) {
        setLive(baseSec);
        return;
      }

      // 3. Delta local
      let delta = 0;
      if (typeof session._receivedPerf === 'number') {
        delta = Math.floor((performance.now() - session._receivedPerf) / 1000);
      } else if (typeof session._receivedAt === 'number') {
        delta = Math.floor((Date.now() - session._receivedAt) / 1000);
      } else {
        const lastUpdate = toMillisSafe(session.updatedAt) || Date.now();
        delta = Math.floor((Date.now() - lastUpdate) / 1000);
      }

      // 4. Direção
      const isPomodoro = (session.timerType === 'pomodoro' || session.mode === 'pomodoro');
      const isResting = !!session.isResting;

      let next = baseSec;
      if (isPomodoro && !isResting) {
        next = Math.max(0, baseSec - delta);
      } else if (isResting) {
        next = Math.max(0, baseSec - delta);
      } else {
        next = baseSec + delta;
      }

      setLive(Math.floor(next));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [
    session?.displaySecondsSnapshot,
    session?.updatedAt,
    session?.isPaused,
    session?.timerType,
    session?.mode,
    session?.isResting,
    session?._receivedAt,
    session?._receivedPerf
  ]);

  return live;
};

// --- SUBCOMPONENTE LINHA DE SESSÃO ---
const SessionRow = ({ s, getUser, cicloNameByKey, isExpanded, toggleExpand, onOpenUser }) => {
  const liveSeconds = useSyncedSeconds(s);
  const user = getUser(s.uid);
  const key = `${s.uid}_${s.cicloId || ''}`;
  const cicloNome = s.cicloNome || cicloNameByKey.get(key) || null;

  const phaseLabel = (s.phase === 'rest' || s.isResting) ? 'Descanso' : 'Foco';
  const typeLabel = s?.timerType === 'pomodoro' ? 'Pomodoro' : 'Livre';

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/30 overflow-hidden">
      <button
        onClick={() => toggleExpand(s.uid)}
        className="w-full text-left p-4 flex items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Avatar user={user} size="md" />
          <div className="min-w-0">
            <p className="text-sm font-black text-zinc-900 dark:text-white truncate">
              {user.name || s.userName || 'Usuário'}
            </p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {(s.disciplinaNome || 'Disciplina')}{s.assunto ? ` • ${s.assunto}` : ''}{cicloNome ? ` • ${cicloNome}` : ''}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                {typeLabel}
              </span>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${phaseLabel === 'Descanso'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                }`}>
                {phaseLabel}
              </span>
              {s.isPaused && (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                  Pausado
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-black font-mono text-zinc-900 dark:text-white leading-none">
              {formatClock(liveSeconds)}
            </p>
            <p className="text-[9px] text-zinc-400">
              {s.isPaused ? 'Pausado' : 'Rodando'}
            </p>
          </div>
          <div className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Sessão atual</p>
                  <div className="mt-2">
                    <p className="text-sm font-black text-zinc-900 dark:text-white">
                      {(s.disciplinaNome || 'Disciplina')}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {s.assunto || 'Sem assunto'} {cicloNome ? `• ${cicloNome}` : ''}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <div className="text-[10px] font-black px-2 py-1 rounded-full bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-200 border border-red-100 dark:border-red-900/40 flex items-center gap-2">
                        <Clock size={12} /> <span> {formatClock(liveSeconds)}</span>
                      </div>
                      <div className="text-[10px] font-black px-2 py-1 rounded-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                        <Zap size={12} /> <span>{typeLabel}</span>
                      </div>
                      <div className="text-[10px] font-black px-2 py-1 rounded-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                        <HelpCircle size={12} /> <span>{phaseLabel}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-950 to-zinc-900 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Ações</p>
                  <div className="mt-3 flex flex-col gap-2">
                    <button
                      onClick={() => onOpenUser(user)}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 font-black text-xs shadow-lg shadow-red-900/30 transition-colors"
                    >
                      <Eye size={16} /> Ver perfil + registros
                    </button>
                    <div className="text-[10px] text-white/70">
                      Atualiza em tempo real • inclui pausado/descanso.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL DO PAINEL ---
const StudyingNowPanel = ({ sessions = [], getUser, cicloNameByKey, onOpenUser }) => {
  const [expandedAll, setExpandedAll] = useState(false);
  const [expandedUid, setExpandedUid] = useState(null);

  const counts = useMemo(() => {
    const focus = sessions.filter(s => (s.phase === 'focus' || !s.isResting) && !s.isPaused).length;
    const rest = sessions.filter(s => (s.phase === 'rest' || s.isResting) && !s.isPaused).length;
    const paused = sessions.filter(s => !!s.isPaused).length;
    return { focus, rest, paused, total: sessions.length };
  }, [sessions]);

  const chip = (label, value, cls) => (
    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full border ${cls}`}>
      {label}: {value}
    </span>
  );

  const toggleExpand = (uid) => setExpandedUid(prev => (prev === uid ? null : uid));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm h-full flex flex-col">
      <div className="absolute inset-0 pointer-events-none opacity-30 dark:opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(239,68,68,0.25),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(239,68,68,0.18),transparent_45%),radial-gradient(circle_at_40%_90%,rgba(16,185,129,0.18),transparent_50%)]" />

      <div className="relative p-5 md:p-6 pb-3 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 relative">
            <Timer size={18} strokeWidth={2.5} />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white uppercase tracking-tight">
              Estudando Agora
            </h3>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {counts.total === 0 ? 'Nenhuma sessão ativa agora' : `${counts.total} usuário(s) com timer aberto`}
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              {chip('Foco', counts.focus, 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40')}
              {chip('Descanso', counts.rest, 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40')}
              {chip('Pausado', counts.paused, 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40')}
            </div>
          </div>
        </div>

        <button
          onClick={() => setExpandedAll(v => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors text-xs font-black"
        >
          {expandedAll ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {expandedAll ? 'Recolher' : 'Expandir'}
        </button>
      </div>

      <div className="relative px-5 md:px-6 pb-6 flex-1 overflow-y-auto custom-scrollbar">
        {sessions.length === 0 ? (
          <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500">
            Quando alguém iniciar o timer, aparece aqui automaticamente (em tempo real).
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const isExpanded = expandedAll || expandedUid === s.uid;
              return (
                <SessionRow
                  key={s.id || s.uid}
                  s={s}
                  getUser={getUser}
                  cicloNameByKey={cicloNameByKey}
                  isExpanded={isExpanded}
                  toggleExpand={toggleExpand}
                  onOpenUser={onOpenUser}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyingNowPanel;