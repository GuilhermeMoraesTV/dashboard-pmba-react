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

const getStatValueSize = (value) => {
  const length = String(value ?? '').length;
  if (length <= 4) return 'text-2xl sm:text-3xl';
  if (length <= 9) return 'text-xl sm:text-2xl';
  if (length <= 14) return 'text-lg sm:text-xl';
  return 'text-base sm:text-lg';
};

const STATIC_MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap']);
const staticProps = (props) => Object.fromEntries(Object.entries(props).filter(([key]) => !STATIC_MOTION_PROPS.has(key)));
const STATIC_ELEMENTS = {
  div: (props) => <div {...staticProps(props)} />,
  img: (props) => <img {...staticProps(props)} />,
  span: (props) => <span {...staticProps(props)} />,
  h2: (props) => <h2 {...staticProps(props)} />,
  p: (props) => <p {...staticProps(props)} />,
};

export default function DailyGoalCompletedModal({
  open,
  onClose,
  contextLabel = 'Meta do dia',
  planName = 'Plano de estudos',
  editalName = 'Edital ativo',
  editalLogo = null,
  largeEditalLogo = false,
  systemLogo = '/logoModoQAP.png',
  achievementLabel = 'ESTUDO DO DIA CONCLUIDO',
  title = 'ESTUDO DO DIA CONCLUIDO',
  ariaLabel = 'ESTUDO DO DIA CONCLUIDO',
  heroIcon: HeroIcon = Trophy,
  minutes = 0,
  plannedMinutes = 0,
  questions = 0,
  correct = 0,
  stats: customStats = null,
  progressLabel = '100%',
  footer = null,
  notice = null,
  instant = true,
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
  const displayMinutes = Math.max(0, Number(minutes || 0));
  const defaultStats = [
    { label: 'Tempo estudado', value: fmtMin(displayMinutes), description: plannedMinutes > 0 ? `Planejado: ${fmtMin(plannedMinutes)}` : null, icon: Clock3, tone: 'emerald' },
    { label: 'Questões', value: totalQuestions > 0 ? totalQuestions : '-', icon: Target, tone: 'red' },
    { label: 'Questões certas', value: totalQuestions > 0 ? totalCorrect : '-', icon: CheckCircle2, tone: 'emerald' },
    { label: 'Precisão', value: totalQuestions > 0 ? `${accuracy}%` : '-', icon: Trophy, tone: 'zinc' },
  ];
  const stats = Array.isArray(customStats) && customStats.length ? customStats : defaultStats;
  const compactStatsLayout = Array.isArray(customStats) && customStats.length <= 2;

  const Animated = instant ? STATIC_ELEMENTS : motion;
  const statDelay = instant ? 0 : 0.58;
  const modalTransition = (transition) => instant ? { duration: 0 } : transition;

  return createPortal(
    <AnimatePresence initial={!instant}>
      {open && (
        <Animated.div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-zinc-950/25 p-2 backdrop-blur-[3px] sm:p-6"
          initial={instant ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={modalTransition({ duration: 0.2 })}
          onClick={onClose}
        >
          <Animated.div
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            className={`relative flex flex-col max-h-[min(calc(100dvh-1rem),680px)] w-full max-w-[min(calc(100vw-1rem),390px)] overflow-hidden rounded-[24px] border border-emerald-200/90 bg-white/95 shadow-2xl shadow-emerald-950/25 backdrop-blur-sm dark:border-emerald-900/40 dark:bg-card-dark/95 sm:max-h-[min(calc(100dvh-2rem),740px)] sm:rounded-[30px] ${compactStatsLayout ? 'sm:max-w-[480px]' : 'sm:aspect-square sm:max-w-[520px]'}`}
            initial={instant ? false : { opacity: 0, y: 34, scale: 0.9, rotateX: 10 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={modalTransition({ type: 'spring', stiffness: 330, damping: 28 })}
            style={{ transformPerspective: 1200 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="h-1.5 shrink-0 bg-gradient-to-r from-amber-400 via-emerald-500 to-cyan-400" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-50 via-white/80 to-transparent dark:from-emerald-950/30 dark:via-zinc-950/80" />
            <div className="pointer-events-none absolute left-8 right-8 top-[110px] h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent dark:via-emerald-800 sm:top-[132px]" />
            {!instant && (<Animated.div
              className="pointer-events-none absolute -inset-y-20 -left-40 z-10 w-28 rotate-12 bg-gradient-to-r from-transparent via-white/75 to-transparent dark:via-white/25"
              initial={{ x: '-40%' }}
              animate={{ x: ['-40%', '720%'] }}
              transition={modalTransition({ duration: 1.25, delay: 0.35, ease: 'easeOut', repeat: Infinity, repeatDelay: 5.4 })}
            />)}
            <Animated.div
              className="pointer-events-none absolute inset-3 rounded-[26px] border border-amber-200/55 dark:border-amber-500/15"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: [0, 1, 0.72], scale: 1 }}
              transition={modalTransition({ duration: 0.9, delay: 0.18, ease: 'easeOut' })}
            />
            <Animated.img
              src={systemLogo}
              alt="ModoQAP"
              className="absolute left-3 top-3 z-20 h-7 w-7 object-contain drop-shadow-xl sm:left-5 sm:top-5 sm:h-14 sm:w-14"
              initial={{ opacity: 0, y: -8, scale: 0.9 }}
              animate={{ opacity: 1, y: [0, -4, 0], scale: 1 }}
              transition={modalTransition({
                opacity: { duration: 0.35, delay: 0.22 },
                scale: { duration: 0.35, delay: 0.22 },
                y: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' },
              })}
            />

            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-30 inline-flex h-7 w-7 items-center justify-center rounded-xl border border-zinc-200 bg-white/90 text-zinc-500 shadow-sm transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-white sm:right-4 sm:top-4 sm:h-8 sm:w-8 sm:rounded-2xl"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>

            <div className={`relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain custom-scrollbar px-3 pb-3 pt-3 sm:px-6 sm:pb-6 sm:pt-5 ${compactStatsLayout ? '' : 'sm:h-full'}`}>
              <Animated.div
                className="mx-auto mb-1 flex max-w-[290px] items-center justify-center gap-2 bg-transparent text-center sm:mb-2 sm:max-w-[360px]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={modalTransition({ duration: 0.35, delay: 0.18, ease: 'easeOut' })}
              >
                <div className="min-w-0 leading-none">
                  <p className="truncate text-[9px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400 sm:text-[15px]">
                    {weekdayLabel}
                  </p>
                  <p className="mt-0.5 truncate text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400 sm:text-[13px]">
                    {dateLabel}
                  </p>
                </div>
              </Animated.div>
              <header className={`mx-auto flex min-h-0 shrink-0 flex-col items-center justify-center px-4 text-center sm:px-10 ${compactStatsLayout ? 'sm:min-h-[140px]' : 'sm:min-h-[160px]'}`}>
                <Animated.span
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-200 bg-white/90 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.16em] text-emerald-700 shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900/80 dark:text-emerald-300 sm:gap-2 sm:px-3 sm:py-1 sm:text-[8px] sm:tracking-[0.24em]"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={modalTransition({ duration: 0.35, delay: 0.24, ease: 'easeOut' })}
                >
                  <CheckCircle2 size={13} className="shrink-0 sm:h-[15px] sm:w-[15px]" />
                  <span className="truncate">{achievementLabel}</span>
                </Animated.span>
                <Animated.div
                  className="relative mt-1.5 flex h-10 w-10 items-center justify-center rounded-full border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-emerald-50 shadow-lg shadow-emerald-900/10 dark:border-amber-500/20 dark:from-amber-500/10 dark:via-zinc-900 dark:to-emerald-500/10 sm:mt-3 sm:h-16 sm:w-16"
                  initial={{ opacity: 0, scale: 0.55, rotate: -14 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={modalTransition({ type: 'spring', stiffness: 420, damping: 20, delay: 0.32 })}
                >
                  <Animated.div
                    className="absolute inset-0 rounded-full border border-amber-300/55"
                    animate={{ scale: [1, 1.18, 1], opacity: [0.65, 0, 0.65] }}
                    transition={modalTransition({ duration: 2.4, repeat: Infinity, ease: 'easeInOut' })}
                  />
                  <Animated.div
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30 sm:h-11 sm:w-11"
                    animate={{ y: [0, -3, 0], boxShadow: ['0 18px 30px rgba(16,185,129,0.25)', '0 22px 42px rgba(16,185,129,0.36)', '0 18px 30px rgba(16,185,129,0.25)'] }}
                    transition={modalTransition({ duration: 2.8, repeat: Infinity, ease: 'easeInOut' })}
                  >
                    <Animated.div
                      animate={{ rotate: [0, -7, 7, -3, 0], scale: [1, 1.08, 1] }}
                      transition={modalTransition({ duration: 2.6, repeat: Infinity, repeatDelay: 0.45, ease: 'easeInOut' })}
                    >
                      <HeroIcon className="h-4 w-4 sm:h-6 sm:w-6" strokeWidth={2.5} />
                    </Animated.div>
                  </Animated.div>
                </Animated.div>
                <Animated.h2
                  className="mt-1.5 inline-flex max-w-full flex-wrap items-center justify-center gap-1.5 text-center text-[0.85rem] font-black uppercase leading-tight tracking-normal text-zinc-950 dark:text-white sm:mt-2.5 sm:gap-2 sm:text-[1.35rem]"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={modalTransition({ duration: 0.35, delay: 0.46, ease: 'easeOut' })}
                >
                  <span>{title}</span>
                </Animated.h2>
                <Animated.p
                  className="mt-0.5 max-w-full truncate text-[7.5px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400 sm:mt-1 sm:text-[9px] sm:tracking-[0.22em]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={modalTransition({ duration: 0.35, delay: 0.58 })}
                >
                  {contextLabel}
                </Animated.p>
              </header>

              <section className={`mt-2 grid min-h-0 flex-1 grid-cols-1 gap-2 sm:gap-3 ${compactStatsLayout ? 'sm:grid-cols-[1.3fr_0.7fr] sm:items-stretch' : 'sm:grid-cols-[1.08fr_0.92fr]'}`}>
                <Animated.div
                  className={`relative flex min-h-0 flex-col rounded-[16px] border border-zinc-200 bg-white/80 p-2.5 shadow-sm dark:border-white/10 dark:bg-zinc-900/80 sm:rounded-[22px] ${compactStatsLayout ? 'sm:p-3.5' : 'sm:p-3'}`}
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={modalTransition({ duration: 0.42, delay: statDelay, ease: 'easeOut' })}
                >
                  <div className="absolute inset-x-3 top-0 h-1 rounded-b-full bg-gradient-to-r from-amber-400 via-emerald-500 to-cyan-400" />
                  <p className="mt-1 text-[7px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 sm:mt-1.5 sm:text-[8px] sm:tracking-[0.24em]">Edital</p>
                  <div className={`flex min-h-0 flex-1 gap-2 sm:gap-3 ${largeEditalLogo ? 'flex-col items-center justify-center text-center' : 'items-center text-left'}`}>
                    <div className={`flex shrink-0 items-center justify-center rounded-[14px] border border-zinc-100 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-card-dark sm:rounded-[18px] sm:p-2 ${largeEditalLogo ? 'h-12 w-full max-w-[140px] sm:h-20 sm:max-w-[180px]' : compactStatsLayout ? 'h-10 w-10 sm:h-12 sm:w-12' : 'h-12 w-12 sm:h-14 sm:w-14'}`}>
                      {editalLogo ? (
                        <img src={editalLogo} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <Target size={28} className="text-emerald-600 dark:text-emerald-400 sm:h-8 sm:w-8" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className={`break-words text-[10px] font-black uppercase leading-snug text-zinc-950 dark:text-white sm:text-[12px] ${compactStatsLayout ? '' : 'line-clamp-3'}`}>
                        {displayEditalName}
                      </h3>
                    </div>
                  </div>
                </Animated.div>

                <div className={`grid min-h-0 grid-cols-2 gap-1.5 sm:gap-2 ${compactStatsLayout ? 'sm:grid-cols-1 sm:grid-rows-2' : ''}`}>
                  {stats.map(({ label, value, description, icon: Icon, tone }, index) => (
                    <Animated.div
                      key={label}
                      className={`relative min-h-[52px] overflow-hidden rounded-[14px] border px-2 py-1.5 shadow-sm sm:min-h-[64px] sm:rounded-[18px] sm:px-3 sm:py-2 ${
                        tone === 'emerald'
                          ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/45 dark:bg-emerald-950/15'
                          : tone === 'red'
                          ? 'border-red-200 bg-red-50/50 dark:border-red-900/45 dark:bg-red-950/10'
                          : 'border-zinc-200 bg-white/80 dark:border-white/10 dark:bg-zinc-900/80'
                      }`}
                      initial={{ opacity: 0, y: 14, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={modalTransition({ duration: 0.34, delay: statDelay + 0.08 + index * 0.06, ease: 'easeOut' })}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <p className="min-w-0 pr-1 text-[6px] font-black uppercase leading-tight tracking-[0.08em] text-zinc-500 dark:text-zinc-400 sm:text-[7.5px] sm:tracking-widest">{label}</p>
                        <div
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md sm:h-6 sm:w-6 sm:rounded-lg ${
                            tone === 'emerald'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                              : tone === 'red'
                              ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300'
                              : 'bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-300'
                          }`}
                        >
                          <Icon className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                        </div>
                      </div>
                      <p className={`mt-0.5 min-w-0 break-words font-black leading-none tabular-nums text-zinc-950 dark:text-white ${compactStatsLayout ? `sm:mt-1 ${getStatValueSize(value)}` : `sm:mt-1.5 ${getStatValueSize(value)}`}`}>{value}</p>
                      {description && (
                        <p className="mt-0.5 text-[6.5px] font-bold uppercase leading-tight tracking-wide text-zinc-500 dark:text-zinc-400 sm:text-[7.5px]">
                          {description}
                        </p>
                      )}
                    </Animated.div>
                  ))}
                </div>
              </section>

              <Animated.div
                className="mt-2 flex shrink-0 items-center gap-2 sm:mt-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={modalTransition({ duration: 0.32, delay: statDelay + 0.34, ease: 'easeOut' })}
              >
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
                  <Animated.div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-500 to-cyan-400"
                    initial={{ width: instant ? '100%' : '0%' }}
                    style={instant ? { width: '100%' } : undefined}
                    animate={{ width: '100%' }}
                    transition={modalTransition({ duration: 0.8, delay: statDelay + 0.42, ease: 'easeOut' })}
                  />
                </div>
                <span className="text-[7.5px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 sm:text-[8px]">{progressLabel}</span>
              </Animated.div>

              {notice && (
                <Animated.div
                  className="mt-1.5 shrink-0 sm:mt-2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={modalTransition({ duration: 0.32, delay: statDelay + 0.4, ease: 'easeOut' })}
                >
                  {notice}
                </Animated.div>
              )}

              {footer && (
                <Animated.div
                  className="mt-2 shrink-0 sm:mt-3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={modalTransition({ duration: 0.32, delay: statDelay + 0.46, ease: 'easeOut' })}
                >
                  {footer}
                </Animated.div>
              )}
            </div>
          </Animated.div>
        </Animated.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
