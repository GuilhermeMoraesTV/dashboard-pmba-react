import React, { useMemo } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck2,
  Clock3,
  History,
  Target,
  TrendingUp,
} from 'lucide-react';

import { aggregateCycleRoundStats, dateToLocalKey } from '../../utils/cicloWeeklyStatus';

const formatDate = (value) => {
  const key = dateToLocalKey(value);
  if (!key) return '—';
  const [year, month, day] = key.split('-');
  return `${day}/${month}/${year}`;
};

const formatMinutes = (value) => {
  const minutes = Math.max(0, Math.round(Number(value || 0)));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}min`;
  if (!rest) return `${hours}h`;
  return `${hours}h ${rest}min`;
};

const StatCard = ({ icon, label, value, detail, tone = 'zinc' }) => {
  const toneClasses = {
    red: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
    zinc: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  };

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-card-dark sm:p-5">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClasses[tone] || toneClasses.zinc}`}>
        {React.createElement(icon, { size: 17 })}
      </div>
      <p className="mt-4 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">{value}</p>
      {detail && <p className="mt-1 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">{detail}</p>}
    </div>
  );
};

export default function CicloEstatisticasTab({ rodadas = [], loading = false }) {
  const stats = useMemo(() => aggregateCycleRoundStats(rodadas), [rodadas]);

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-card-dark">
        <div className="flex items-center gap-3 text-sm font-bold text-zinc-500">
          <Clock3 size={18} className="animate-pulse text-red-600" />
          Carregando estatísticas...
        </div>
      </div>
    );
  }

  if (stats.totalRodadas === 0) {
    return (
      <section className="relative flex min-h-[430px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-zinc-200/80 bg-white px-6 text-center shadow-sm dark:border-zinc-800 dark:bg-card-dark">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-red-500/8 to-transparent" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
          <BarChart3 size={28} />
        </div>
        <p className="relative mt-5 text-[10px] font-black uppercase tracking-[0.22em] text-red-600 dark:text-red-400">Estatísticas do ciclo semanal</p>
        <h2 className="relative mt-2 text-xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-2xl">As próximas rodadas aparecerão aqui</h2>
        <p className="relative mt-2 max-w-lg text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
          O histórico começa a ser registrado a partir das próximas rodadas fechadas. Dados antigos não serão reconstruídos de forma imprecisa.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4 pb-8 sm:space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-card-dark sm:p-6">
        <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-red-500/5 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/20">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-600 dark:text-red-400">Desempenho por rodada</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-2xl">Evolução do ciclo semanal</h2>
            <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Prazo orientativo, pendências no vencimento e fechamento real.</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={CalendarCheck2} label="Rodadas fechadas" value={stats.totalRodadas} detail="registradas no histórico" tone="emerald" />
        <StatCard icon={AlertTriangle} label="Rodadas atrasadas" value={stats.rodadasAtrasadas} detail="fechadas após 7 dias" tone="red" />
        <StatCard icon={Clock3} label="Média de atraso" value={`${stats.mediaDiasAtraso}d`} detail="entre rodadas atrasadas" tone="amber" />
        <StatCard icon={Target} label="Maior atraso" value={`${stats.maiorAtraso}d`} detail="maior desvio registrado" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
        <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-card-dark">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
              <AlertTriangle size={17} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-zinc-950 dark:text-white">Matérias mais pendentes</h3>
              <p className="text-[10px] font-semibold text-zinc-400">Situação na data ideal de fechamento</p>
            </div>
          </div>

          {stats.materiasMaisPendentes.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-center text-xs font-semibold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
              Nenhuma matéria ficou pendente no vencimento.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {stats.materiasMaisPendentes.slice(0, 6).map((materia, index) => (
                <div key={materia.disciplinaId || materia.nome} className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[10px] font-black text-zinc-500 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-black uppercase text-zinc-800 dark:text-zinc-200">{materia.nome}</p>
                    <p className="mt-0.5 text-[9px] font-semibold text-zinc-400">{materia.rodadasPendentes} rodada(s) com pendência</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-black text-amber-600 dark:text-amber-400">{formatMinutes(materia.minutosPendentes)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-card-dark">
          <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <History size={17} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-zinc-950 dark:text-white">Últimas rodadas</h3>
              <p className="text-[10px] font-semibold text-zinc-400">Início, meta e fechamento real</p>
            </div>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {stats.historico.slice(0, 8).map((rodada) => (
              <article key={rodada.id || rodada.numeroRodada} className="p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-zinc-900 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white dark:bg-white dark:text-zinc-950">Rodada {rodada.numeroRodada}</span>
                    <span className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase ${rodada.atrasoDias > 0 ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'}`}>
                      {rodada.atrasoDias > 0 ? `${rodada.atrasoDias}d de atraso` : 'No prazo'}
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-zinc-400">{formatMinutes(rodada.cargaCumpridaAteDataIdealMinutos)} / {formatMinutes(rodada.cargaPlanejadaMinutos)}</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-[10px] sm:grid-cols-3">
                  <div className="rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-900"><span className="block font-bold uppercase text-zinc-400">Início</span><strong className="mt-0.5 block text-zinc-700 dark:text-zinc-200">{formatDate(rodada.inicioPlanejado)}</strong></div>
                  <div className="rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-900"><span className="block font-bold uppercase text-zinc-400">Fechamento ideal</span><strong className="mt-0.5 block text-zinc-700 dark:text-zinc-200">{formatDate(rodada.fechamentoIdeal)}</strong></div>
                  <div className="rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-900"><span className="block font-bold uppercase text-zinc-400">Fechamento real</span><strong className="mt-0.5 block text-zinc-700 dark:text-zinc-200">{formatDate(rodada.fechamentoReal || rodada.fechamentoRealData)}</strong></div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
