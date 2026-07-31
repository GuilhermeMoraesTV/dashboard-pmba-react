import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, Clock3, Target, Trophy, X } from 'lucide-react';

const fmtMin = (min) => {
  const total = Math.max(0, Math.round(Number(min) || 0));
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

export default function DailyGoalCompletedModal({
  open,
  onClose,
  contextLabel = 'Meta do dia',
  planName = 'Plano de estudos',
  editalName = 'Edital ativo',
  editalLogo = null,
  systemLogo = '/logoModoQAP.png',
  achievementLabel = 'Conquista desbloqueada',
  title = 'Meta do dia batida',
  ariaLabel = 'Meta do dia batida',
  heroIcon: HeroIcon = Trophy,
  minutes = 0,
  plannedMinutes = 0,
  questions = 0,
  correct = 0,
  stats: customStats = null,
  progressLabel = '100%',
  footer = null,
  notice = null,
}) {
  if (typeof document === 'undefined') return null;

  const displayEditalName = editalName || planName || 'Edital ativo';
  const today = new Date();
  const weekdayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(today);
  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(today);
  const totalQuestions = Number(questions || 0);
  const totalCorrect = Number(correct || 0);
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const displayMinutes = Math.max(Number(minutes || 0), Number(plannedMinutes || 0));
  const defaultStats = [
    { label: 'Tempo', value: fmtMin(displayMinutes), icon: Clock3, tone: 'emerald' },
    { label: 'Questões', value: totalQuestions > 0 ? totalQuestions : '-', icon: Target, tone: 'red' },
    { label: 'Questões certas', value: totalQuestions > 0 ? totalCorrect : '-', icon: CheckCircle2, tone: 'emerald' },
    { label: 'Precisão', value: totalQuestions > 0 ? `${accuracy}%` : '-', icon: Trophy, tone: 'zinc' },
  ];
  const stats = Array.isArray(customStats) && customStats.length ? customStats : defaultStats;

  const statDelay = 0.58;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-zinc-950/25 p-2 backdrop-blur-[3px] sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            className="relative max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[352px] overflow-hidden rounded-[22px] border border-emerald-200/90 bg-white/95 shadow-2xl shadow-emerald-950/25 backdrop-blur-sm dark:border-emerald-900/40 dark:bg-zinc-950/95 sm:aspect-square sm:max-h-none sm:w-full sm:max-w-[520px] sm:rounded-[30px]"
            initial={{ opacity: 0, y: 34, scale: 0.9, rotateX: 10 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 330, damping: 28 }}
            style={{ transformPerspective: 1200 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="h-1.5 bg-gradient-to-r from-amber-400 via-emerald-500 to-cyan-400" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-50 via-white/80 to-transparent dark:from-emerald-950/30 dark:via-zinc-950/80" />
            <div className="pointer-events-none absolute left-8 right-8 top-[110px] h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent dark:via-emerald-800 sm:top-[132px]" />
            <motion.div
              className="pointer-events-none absolute -inset-y-20 -left-40 z-10 w-28 rotate-12 bg-gradient-to-r from-transparent via-white/75 to-transparent dark:via-white/25"
              initial={{ x: '-40%' }}
              animate={{ x: ['-40%', '720%'] }}
              transition={{ duration: 1.25, delay: 0.35, ease: 'easeOut', repeat: Infinity, repeatDelay: 5.4 }}
            />
            <motion.div
              className="pointer-events-none absolute inset-3 rounded-[26px] border border-amber-200/55 dark:border-amber-500/15"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: [0, 1, 0.72], scale: 1 }}
              transition={{ duration: 0.9, delay: 0.18, ease: 'easeOut' }}
            />
            <motion.img
              src={systemLogo}
              alt="ModoQAP"
              className="absolute left-3 top-3 z-20 h-9 w-9 object-contain drop-shadow-xl sm:left-6 sm:top-6 sm:h-[86px] sm:w-[86px]"
              initial={{ opacity: 0, y: -8, scale: 0.9 }}
              animate={{ opacity: 1, y: [0, -4, 0], scale: 1 }}
              transition={{
                opacity: { duration: 0.35, delay: 0.22 },
                scale: { duration: 0.35, delay: 0.22 },
                y: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' },
              }}
            />

            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-30 inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-white sm:right-4 sm:top-4 sm:h-9 sm:w-9"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>

            <div className="relative flex max-h-[calc(100dvh-1rem)] flex-col px-3 pb-3 pt-3 sm:h-full sm:max-h-none sm:px-7 sm:pb-7 sm:pt-7">
              <motion.div
                className="mx-auto mb-1.5 flex max-w-[290px] items-center justify-center gap-2 bg-transparent text-center sm:mb-2 sm:max-w-[360px]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.18, ease: 'easeOut' }}
              >

                <div className="min-w-0 leading-none">
                  <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400 sm:text-[18px]">
                    {weekdayLabel}
                  </p>
                  <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400 sm:text-[14px]">
                    {dateLabel}
                  </p>
                </div>
              </motion.div>
              <header className="mx-auto flex min-h-[100px] max-w-[290px] shrink-0 flex-col items-center justify-center px-8 text-center sm:min-h-[188px] sm:max-w-[380px] sm:px-16">
                <motion.span
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-200 bg-white/90 px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.18em] text-emerald-700 shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900/80 dark:text-emerald-300 sm:gap-2 sm:px-3 sm:text-[8px] sm:tracking-[0.26em]"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.24, ease: 'easeOut' }}
                >
                  <CheckCircle2 size={15} />
                  {achievementLabel}
                </motion.span>
                <motion.div
                  className="relative mt-2 flex h-12 w-12 items-center justify-center rounded-full border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-emerald-50 shadow-xl shadow-emerald-900/10 dark:border-amber-500/20 dark:from-amber-500/10 dark:via-zinc-900 dark:to-emerald-500/10 sm:mt-5 sm:h-20 sm:w-20"
                  initial={{ opacity: 0, scale: 0.55, rotate: -14 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 20, delay: 0.32 }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-full border border-amber-300/55"
                    animate={{ scale: [1, 1.18, 1], opacity: [0.65, 0, 0.65] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.div
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 sm:h-14 sm:w-14"
                    animate={{ y: [0, -3, 0], boxShadow: ['0 18px 30px rgba(16,185,129,0.25)', '0 22px 42px rgba(16,185,129,0.36)', '0 18px 30px rgba(16,185,129,0.25)'] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <motion.div
                      animate={{ rotate: [0, -7, 7, -3, 0], scale: [1, 1.08, 1] }}
                      transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 0.45, ease: 'easeInOut' }}
                    >
                      <HeroIcon className="h-5 w-5 sm:h-[30px] sm:w-[30px]" strokeWidth={2.5} />
                    </motion.div>
                  </motion.div>
                </motion.div>
                <motion.h2
                  className="mt-2 inline-flex max-w-full flex-wrap items-center justify-center gap-1.5 text-center text-[0.92rem] font-black uppercase leading-tight tracking-normal text-zinc-950 dark:text-white sm:mt-4 sm:gap-2.5 sm:text-[1.55rem]"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.46, ease: 'easeOut' }}
                >
                  <span>{title}</span>

                </motion.h2>
                <motion.p
                  className="mt-1.5 max-w-full truncate text-[8px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400 sm:mt-2 sm:text-[9px] sm:tracking-[0.22em]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.58 }}
                >
                  {contextLabel}
                </motion.p>
              </header>

              <section className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1.08fr_0.92fr] sm:gap-3">
                <motion.div
                  className="relative flex min-h-[100px] flex-col rounded-[18px] border border-zinc-200 bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-zinc-900/80 sm:min-h-0 sm:rounded-[24px] sm:p-3.5"
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.42, delay: statDelay, ease: 'easeOut' }}
                >
                  <div className="absolute inset-x-3 top-0 h-1 rounded-b-full bg-gradient-to-r from-amber-400 via-emerald-500 to-cyan-400" />
                  <p className="mt-1.5 text-[7px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 sm:mt-2 sm:text-[8px] sm:tracking-[0.24em]">Edital</p>
                  <div className="flex min-h-0 flex-1 items-center gap-3 text-left">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] border border-zinc-100 bg-white p-1.5 shadow-sm dark:border-white/10 dark:bg-zinc-950 sm:h-16 sm:w-16 sm:rounded-[18px] sm:p-2">
                      {editalLogo ? (
                        <img src={editalLogo} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <Target size={32} className="text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-4 break-words text-[11px] font-black uppercase leading-snug text-zinc-950 dark:text-white sm:text-[12px]">
                        {displayEditalName}
                      </h3>
                    </div>
                  </div>
                </motion.div>

                <div className="grid min-h-0 grid-cols-2 gap-1.5 sm:gap-2">
                  {stats.map(({ label, value, description, icon: Icon, tone }, index) => (
                    <motion.div
                      key={label}
                      className={`relative overflow-hidden rounded-[15px] border px-1.5 py-1.5 shadow-sm sm:rounded-[20px] sm:px-3 sm:py-3 ${
                        tone === 'emerald'
                          ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/45 dark:bg-emerald-950/15'
                          : tone === 'red'
                          ? 'border-red-200 bg-red-50/50 dark:border-red-900/45 dark:bg-red-950/10'
                          : 'border-zinc-200 bg-white/80 dark:border-white/10 dark:bg-zinc-900/80'
                      }`}
                      initial={{ opacity: 0, y: 14, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.34, delay: statDelay + 0.08 + index * 0.06, ease: 'easeOut' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[6.5px] font-black uppercase leading-tight tracking-[0.12em] text-zinc-500 dark:text-zinc-400 sm:text-[8px] sm:tracking-widest">{label}</p>
                          <p className="mt-1 break-words text-sm font-black leading-tight text-zinc-950 dark:text-white sm:mt-2 sm:text-lg">{value}</p>
                          {description && (
                            <p className="mt-1 text-[7px] font-bold uppercase leading-tight tracking-wide text-zinc-500 dark:text-zinc-400 sm:text-[8px]">
                              {description}
                            </p>
                          )}
                        </div>
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg sm:h-7 sm:w-7 sm:rounded-xl ${
                            tone === 'emerald'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                              : tone === 'red'
                              ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300'
                              : 'bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-300'
                          }`}
                        >
                          <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>

              <motion.div
                className="mt-2 flex shrink-0 items-center gap-2 sm:mt-4"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: statDelay + 0.34, ease: 'easeOut' }}
              >
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-500 to-cyan-400"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 0.8, delay: statDelay + 0.42, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">{progressLabel}</span>
              </motion.div>

              {notice && (
                <motion.div
                  className="mt-1.5 shrink-0 sm:mt-2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, delay: statDelay + 0.4, ease: 'easeOut' }}
                >
                  {notice}
                </motion.div>
              )}

              {footer && (
                <motion.div
                  className="mt-2 shrink-0 sm:mt-3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, delay: statDelay + 0.46, ease: 'easeOut' }}
                >
                  {footer}
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
