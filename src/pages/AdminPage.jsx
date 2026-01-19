import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, ChevronDown, UserRound, BookOpen, Layers, Timer, Activity } from 'lucide-react';

const pad2 = (n) => String(n).padStart(2, '0');

const formatHMS = (ms) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
};

const tsToMs = (v) => {
  if (!v) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (v?.toMillis) return v.toMillis();
  if (v?.seconds != null) return (v.seconds * 1000) + Math.floor((v.nanoseconds || 0) / 1e6);
  return null;
};

const computeElapsedMs = (docData, nowMs) => {
  // Suporte a vários formatos (robusto)
  const elapsedMs = tsToMs(docData.elapsedMs);
  if (elapsedMs != null) return elapsedMs;

  const elapsedSeconds = tsToMs(docData.elapsedSeconds);
  if (elapsedSeconds != null) return elapsedSeconds * 1000;

  const startedAtMs = tsToMs(docData.startedAtMs) ?? tsToMs(docData.startedAt) ?? tsToMs(docData.startAt);
  const baseAccum = tsToMs(docData.accumulatedMs) ?? 0;

  if (startedAtMs != null) {
    const isPaused = docData.isPaused === true;
    const pausedAtMs = tsToMs(docData.pausedAtMs) ?? tsToMs(docData.pausedAt);
    if (isPaused && pausedAtMs != null) return baseAccum + (pausedAtMs - startedAtMs);
    return baseAccum + (nowMs - startedAtMs);
  }

  return 0;
};

export default function AdminPage() {
  const [activeTimers, setActiveTimers] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [nowMs, setNowMs] = useState(Date.now());

  // Atualiza o relógio local para animar o timer sem depender de writes no Firestore
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const ref = collection(db, 'active_timers');
    const unsub = onSnapshot(ref, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // só mantém os que realmente parecem "ativos"
      // (se seu StudyTimer já deleta ao finalizar, isso aqui já basta)
      setActiveTimers(arr);
    }, (err) => {
      console.error('Erro ao ouvir active_timers:', err);
    });

    return () => unsub();
  }, []);

  const list = useMemo(() => {
    const mapped = activeTimers.map(t => {
      const elapsed = computeElapsedMs(t, nowMs);
      return {
        ...t,
        elapsedMsComputed: elapsed,
        userName: t.userName || t.displayName || 'Estudante',
        userPhotoURL: t.userPhotoURL || t.photoURL || null,
        disciplinaNome: t.disciplinaNome || t.disciplina || t.disciplinaNomeCorrigido || '—',
        assunto: t.assunto || t.topico || null,
        updatedAtMs: tsToMs(t.updatedAt) ?? tsToMs(t.lastUpdate) ?? null
      };
    });

    // ordena por "mais tempo" ou por updatedAt se existir
    return mapped.sort((a, b) => {
      const ua = a.updatedAtMs ?? 0;
      const ub = b.updatedAtMs ?? 0;
      return ub - ua;
    });
  }, [activeTimers, nowMs]);

  const toggleExpand = (uid) => setExpanded(prev => ({ ...prev, [uid]: !prev[uid] }));

  return (
    <div className="w-full animate-fade-in pb-24">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/25">
                <Activity size={18} />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white uppercase leading-none">
                  Estudando agora
                </h1>
                <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mt-1">
                  {list.length} aluno(s) em sessão ativa
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase">
              <Timer size={14} />
              Sync em tempo real
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {list.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 mx-auto flex items-center justify-center text-zinc-400">
                <Clock size={26} />
              </div>
              <p className="mt-4 font-bold text-zinc-500">Nenhum aluno estudando agora.</p>
              <p className="text-sm text-zinc-400 mt-1">Quando alguém iniciar o StudyTimer, aparece aqui automaticamente.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {list.map((t) => {
                const isOpen = !!expanded[t.id];
                const time = formatHMS(t.elapsedMsComputed);

                return (
                  <div key={t.id} className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950 shadow-sm">
                    <button
                      onClick={() => toggleExpand(t.id)}
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
                    >
                      <div className="w-11 h-11 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden flex items-center justify-center text-zinc-400 flex-shrink-0">
                        {t.userPhotoURL ? (
                          <img src={t.userPhotoURL} alt={t.userName} className="w-full h-full object-cover" />
                        ) : (
                          <UserRound size={18} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-zinc-900 dark:text-white truncate">
                            {t.userName}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                            Ativo
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                          <span className="inline-flex items-center gap-1">
                            <BookOpen size={12} /> {t.disciplinaNome}
                          </span>
                          {t.assunto && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300">
                              <Layers size={12} /> {t.assunto}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <div className="font-mono text-[14px] sm:text-[16px] font-black text-red-600 dark:text-red-500">
                            {time}
                          </div>
                          <div className="text-[9px] font-bold uppercase text-zinc-400">
                            tempo
                          </div>
                        </div>
                        <ChevronDown className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} size={18} />
                      </div>
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/20"
                        >
                          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
                              <p className="text-[10px] font-bold uppercase text-zinc-400">Disciplina</p>
                              <p className="mt-1 font-black text-zinc-900 dark:text-white">{t.disciplinaNome}</p>
                            </div>

                            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
                              <p className="text-[10px] font-bold uppercase text-zinc-400">Assunto</p>
                              <p className="mt-1 font-black text-zinc-900 dark:text-white">{t.assunto || '—'}</p>
                            </div>

                            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
                              <p className="text-[10px] font-bold uppercase text-zinc-400">Timer</p>
                              <p className="mt-1 font-mono text-xl font-black text-red-600 dark:text-red-500">{time}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
