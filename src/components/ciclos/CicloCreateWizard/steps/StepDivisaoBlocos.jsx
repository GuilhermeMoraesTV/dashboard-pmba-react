import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, SlidersHorizontal, TimerReset } from 'lucide-react';

const fmtMin = (min) => {
  if (!min || min <= 0) return '0m';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

const PageHeader = () => (
  <motion.div
    initial={{ opacity: 0, y: -12 }}
    animate={{ opacity: 1, y: 0 }}
    className="mx-auto mb-6 max-w-2xl px-4 text-center"
  >
    <h2 className="mb-3 text-4xl font-black uppercase leading-[0.95] tracking-tighter text-zinc-900 dark:text-white">
      Divisao dos<br /><span className="text-red-600">blocos</span>
    </h2>
    <p className="mx-auto max-w-md text-sm font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
      Voce ja disse quanto tempo tem por dia. Agora escolha como esse tempo sera quebrado em sessoes.
    </p>
  </motion.div>
);

export default function StepDivisaoBlocos({
  tempoSessaoMinutos,
  setTempoSessaoMinutos,
  minimumActiveDayMinutes = null,
  sessionAutoAdjustedNotice = null,
  totalSessionSlots = 0,
  minimumRequiredSessions = 0,
  distribuicaoCabeNaRotina = true,
}) {
  const automaticMinutes = Math.min(50, minimumActiveDayMinutes || 50);
  const [modo, setModo] = useState(() => (
    Number(tempoSessaoMinutos) === automaticMinutes ? 'automatico' : 'personalizado'
  ));

  const limiteMaximo = Math.max(10, minimumActiveDayMinutes || 180);
  const presetMinutes = useMemo(
    () => [25, 30, 45, 50, 60, 90].filter((min) => min <= limiteMaximo),
    [limiteMaximo]
  );

  const exemploDiaMinutos = minimumActiveDayMinutes || 0;
  const sessoesNoExemplo = Math.floor(exemploDiaMinutos / Math.max(1, tempoSessaoMinutos));
  const sobraNoExemplo = Math.max(0, exemploDiaMinutos - (sessoesNoExemplo * tempoSessaoMinutos));

  const selecionarAutomatico = () => {
    setModo('automatico');
    setTempoSessaoMinutos(automaticMinutes);
  };

  const selecionarPersonalizado = () => {
    setModo('personalizado');
  };

  const atualizarPersonalizado = (valor) => {
    const minutos = Math.max(10, Math.min(limiteMaximo, Number(valor) || 10));
    setModo('personalizado');
    setTempoSessaoMinutos(minutos);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <PageHeader />

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 overflow-y-auto px-2 pb-10 custom-scrollbar sm:px-4">
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={selecionarAutomatico}
            className={`min-h-[140px] rounded-3xl border-2 p-5 text-left transition-all ${
              modo === 'automatico'
                ? 'border-red-500 bg-red-50 shadow-lg shadow-red-600/10 dark:bg-red-950/20'
                : 'border-zinc-100 bg-white hover:border-red-200 dark:border-zinc-800 dark:bg-zinc-900'
            }`}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/20">
                <TimerReset size={20} />
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${
                modo === 'automatico'
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'
              }`}>
                Recomendado
              </span>
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">
              Automatico recomendado ({fmtMin(automaticMinutes)})
            </h3>
            <p className="mt-2 text-[11px] font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
              O sistema usa blocos equilibrados para manter foco e repeticao sem fragmentar demais o dia.
            </p>
          </button>

          <button
            type="button"
            onClick={selecionarPersonalizado}
            className={`min-h-[140px] rounded-3xl border-2 p-5 text-left transition-all ${
              modo === 'personalizado'
                ? 'border-zinc-900 bg-zinc-50 shadow-lg shadow-zinc-900/10 dark:border-zinc-100 dark:bg-zinc-900'
                : 'border-zinc-100 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900'
            }`}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-lg shadow-zinc-900/15 dark:bg-white dark:text-zinc-900">
                <SlidersHorizontal size={20} />
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${
                modo === 'personalizado'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'
              }`}>
                Ajustar
              </span>
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">
              Personalizado
            </h3>
            <p className="mt-2 text-[11px] font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
              Escolha a duracao de cada sessao quando quiser blocos mais curtos ou mais longos.
            </p>
          </button>
        </div>

        {modo === 'personalizado' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                <Clock size={18} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">Duracao do bloco</h4>
                <p className="mt-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Esse valor quebra o tempo diario em sessoes.</p>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {presetMinutes.map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => atualizarPersonalizado(min)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    tempoSessaoMinutos === min
                      ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                  }`}
                >
                  {fmtMin(min)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min={10}
                max={limiteMaximo}
                value={tempoSessaoMinutos}
                onChange={(e) => atualizarPersonalizado(e.target.value)}
                className="w-24 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center text-sm font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <span className="text-xs font-medium text-zinc-400">min por bloco</span>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-3xl border border-red-100 bg-red-50/70 p-4 dark:border-red-950/50 dark:bg-red-950/20">
          <div className="rounded-2xl bg-red-600 px-4 py-3 text-center text-white">
            <p className="text-xl font-black leading-none">{fmtMin(tempoSessaoMinutos)}</p>
            <p className="mt-1 text-[7px] font-black uppercase tracking-widest text-red-100">1 bloco</p>
          </div>
          <p className="text-[12px] font-medium leading-relaxed text-zinc-700 dark:text-zinc-300">
            Em um dia de <strong>{fmtMin(exemploDiaMinutos)}</strong>, blocos de <strong>{fmtMin(tempoSessaoMinutos)}</strong> geram <strong>{sessoesNoExemplo} sessoes</strong>
            {sobraNoExemplo > 0 ? ` e deixam ${fmtMin(sobraNoExemplo)} livres.` : '.'}
          </p>
        </div>

        {minimumActiveDayMinutes && (
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Menor dia ativo configurado: <span className="font-black text-zinc-800 dark:text-white">{fmtMin(minimumActiveDayMinutes)}</span>. O bloco nao pode passar desse limite.
          </p>
        )}

        {sessionAutoAdjustedNotice && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
            A duracao do bloco foi ajustada automaticamente para {fmtMin(sessionAutoAdjustedNotice.adjustedTo)}, porque existe um dia ativo com apenas {fmtMin(sessionAutoAdjustedNotice.minDayMinutes)} disponiveis.
          </div>
        )}

        {!distribuicaoCabeNaRotina && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            Sua rotina comporta {totalSessionSlots} blocos, mas esta configuracao precisa de pelo menos {minimumRequiredSessions}. Aumente as horas, reduza o tempo do bloco ou remova a preferencia diaria no passo de disciplinas.
          </div>
        )}
      </div>
    </div>
  );
}
