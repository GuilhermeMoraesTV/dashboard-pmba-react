import React from 'react';
import { BarChart3, BookOpen, CheckCircle2, Clock3, Target, XCircle } from 'lucide-react';

const formatHoursMinutes = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
};

const metricItems = (totals) => [
  { label: 'Horas', value: formatHoursMinutes(totals.minutes), icon: Clock3, tone: 'text-red-500' },
  { label: 'Questoes', value: totals.questions, icon: Target, tone: 'text-indigo-500' },
  { label: 'Acertos', value: totals.correct, icon: CheckCircle2, tone: 'text-emerald-500' },
  { label: 'Erros', value: totals.wrong, icon: XCircle, tone: 'text-rose-500' },
  { label: 'Precisao', value: `${totals.accuracy}%`, icon: BarChart3, tone: 'text-amber-500' },
];

const getAccuracyTone = (item) => {
  if (item.questions === 0) return 'text-zinc-400';
  if (item.accuracy >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (item.accuracy >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-zinc-600 dark:text-zinc-300';
};

const DesempenhoDisciplinaCard = ({ items = [], totals = { minutes: 0, questions: 0, correct: 0, wrong: 0, accuracy: 0 } }) => (
  <div className="group relative flex flex-col overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-light/50 hover:!border-l-red-500 hover:shadow-glow dark:border-white/10 dark:!border-l-red-500/25 dark:bg-zinc-950 dark:hover:border-accent-light/30 dark:hover:!border-l-red-500">
    <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-500/5 blur-[80px] opacity-70 transition-all duration-700 group-hover:opacity-100" />
    <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 blur-[80px] opacity-60 transition-all duration-700" />

    <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
          <BookOpen size={19} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">Desempenho por Disciplinas</p>
          <h3 className="truncate text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">Resumo detalhado</h3>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:w-[430px]">
        {metricItems(totals).map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="min-w-0 rounded-lg border border-zinc-100 bg-zinc-50/60 px-2 py-1.5 dark:border-white/5 dark:bg-white/5">
            <p className="flex items-center gap-1 text-[7px] font-black uppercase tracking-wider text-zinc-400">
              <Icon size={10} className={tone} />
              {label}
            </p>
            <p className="mt-0.5 truncate text-xs font-black tabular-nums text-zinc-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>
    </div>

    <div className="relative z-10 mt-4 min-h-0">
      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-100 dark:border-white/5">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[minmax(180px,1fr)_70px_72px_62px_56px_72px] gap-2 border-b border-zinc-100 bg-zinc-50/80 px-3 py-2 text-[8px] font-black uppercase tracking-widest text-zinc-400 dark:border-white/5 dark:bg-white/5 md:grid-cols-[minmax(260px,1fr)_82px_76px_68px_62px_82px] md:gap-3">
              <span>Disciplina</span>
              <span className="text-right">Horas</span>
              <span className="text-right">Questoes</span>
              <span className="text-right">Acertos</span>
              <span className="text-right">Erros</span>
              <span className="text-right">Precisao</span>
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-zinc-100 pr-1 dark:divide-white/5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-200 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700">
              {items.map((item) => (
                <div key={item.key} className="group/discipline-row grid cursor-default grid-cols-[minmax(180px,1fr)_70px_72px_62px_56px_72px] items-center gap-2 px-3 py-2.5 transition-all hover:bg-red-50/70 active:bg-red-50 dark:hover:bg-red-500/10 dark:active:bg-red-500/15 md:grid-cols-[minmax(260px,1fr)_82px_76px_68px_62px_82px] md:gap-3 md:py-3">
                  <div className="min-w-0">
                    <p className="min-w-0 truncate text-[11px] font-bold normal-case leading-tight text-zinc-900 transition-colors group-hover/discipline-row:text-red-600 dark:text-white dark:group-hover/discipline-row:text-red-400 md:text-xs" title={item.name}>
                      {item.name}
                    </p>
                  </div>
                  <p className="text-right text-xs font-black tabular-nums text-zinc-900 dark:text-white">{formatHoursMinutes(item.minutes)}</p>
                  <p className="text-right text-xs font-black tabular-nums text-zinc-900 dark:text-white">{item.questions}</p>
                  <p className="text-right text-xs font-black tabular-nums text-emerald-600 dark:text-emerald-400">{item.correct}</p>
                  <p className="text-right text-xs font-black tabular-nums text-rose-600 dark:text-rose-400">{item.wrong}</p>
                  <p className={`text-right text-xs font-black tabular-nums ${getAccuracyTone(item)}`}>{item.questions > 0 ? `${item.accuracy}%` : '-'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/70 text-center dark:border-white/10 dark:bg-white/5">
          <BookOpen size={28} className="text-zinc-300 dark:text-zinc-600" />
          <p className="mt-3 text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Sem disciplinas mapeadas</p>
          <p className="mt-1 max-w-sm text-xs font-medium text-zinc-400 dark:text-zinc-500">Quando houver disciplinas no planejamento ou registros de estudo, a lista aparece aqui.</p>
        </div>
      )}
    </div>
  </div>
);

export default DesempenhoDisciplinaCard;
