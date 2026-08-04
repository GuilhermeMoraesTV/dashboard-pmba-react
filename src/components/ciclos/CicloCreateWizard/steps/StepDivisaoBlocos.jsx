import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, SlidersHorizontal, TimerReset } from 'lucide-react';

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
    className="mb-5 w-full px-2 text-center sm:mb-8 sm:px-4"
  >
    <h2 className="mb-2 text-4xl font-black uppercase leading-[0.95] tracking-tighter text-zinc-900 dark:text-white sm:mb-3 sm:text-4xl">
      Divisao dos <span className="text-red-600">blocos</span>
    </h2>
    <p className="mx-auto max-w-md text-[12px] font-black uppercase leading-relaxed tracking-[0.16em] text-zinc-500 dark:text-zinc-400 sm:text-sm sm:font-semibold sm:normal-case sm:tracking-normal">
      Voce ja disse quanto tempo tem por dia. Agora escolha como esse tempo sera quebrado em sessoes.
    </p>
  </motion.div>
);

export default function StepDivisaoBlocos({
  tempoSessaoMinutos,
  setTempoSessaoMinutos,
  minimumActiveDayMinutes = null,
  exampleDayMinutes = null,
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

  const exemploDiaMinutos = exampleDayMinutes || minimumActiveDayMinutes || 0;
  const sessoesNoExemplo = Math.floor(exemploDiaMinutos / Math.max(1, tempoSessaoMinutos));
  const sobraNoExemplo = Math.max(0, exemploDiaMinutos - (sessoesNoExemplo * tempoSessaoMinutos));
  const totalSessoesNoExemplo = sessoesNoExemplo + (sobraNoExemplo > 0 ? 1 : 0);

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
    <div className="flex min-h-full flex-col items-center px-2 py-2 sm:px-4 sm:py-4">
      <PageHeader />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl"
      >
        <div className="grid grid-cols-2 gap-2 sm:gap-6">
          <button
            type="button"
            onClick={selecionarAutomatico}
            className={`group relative flex min-h-[178px] flex-col overflow-hidden rounded-2xl border-2 p-3 text-left shadow-md transition-all duration-500 hover:-translate-y-1 sm:min-h-[260px] sm:rounded-[2.2rem] sm:p-6 md:p-7 ${
              modo === 'automatico'
                ? 'border-red-500 bg-white shadow-red-500/10 dark:border-red-900/60 dark:bg-zinc-900'
                : 'border-red-100 bg-white hover:border-red-500 hover:shadow-red-500/10 dark:border-red-900/30 dark:bg-zinc-900'
            }`}
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.2rem]">
              <TimerReset size={150} strokeWidth={1.35} className="absolute -bottom-6 -right-6 text-red-600 opacity-[0.05] transition-all duration-700 group-hover:-rotate-12 group-hover:scale-110 dark:opacity-[0.08]" />
            </div>
            <div className="relative z-10 flex h-full flex-col">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all duration-500 group-hover:rotate-6 sm:mb-6 sm:h-12 sm:w-12 sm:rounded-2xl">
                <TimerReset size={18} strokeWidth={2.5} className="sm:h-6 sm:w-6" />
              </div>
              <p className="mb-1 text-[8px] font-black uppercase tracking-[0.14em] text-red-600 dark:text-red-500 sm:text-[9px] sm:tracking-[0.2em]">
                Recomendado
              </p>
              <h3 className="text-[17px] font-black uppercase leading-none tracking-tighter text-zinc-900 dark:text-white min-[390px]:text-[19px] sm:text-2xl">
                Automatico
              </h3>
              <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-zinc-500 dark:text-zinc-400 sm:text-sm">
                {fmtMin(automaticMinutes)} por bloco
              </p>
              <p className="mt-3 line-clamp-4 text-[11px] font-semibold leading-snug text-zinc-500 dark:text-zinc-400 min-[390px]:text-[12px] sm:mt-4 sm:text-sm sm:leading-relaxed">
                O sistema usa blocos equilibrados para manter foco e repeticao sem fragmentar demais o dia.
              </p>
              <div className="mt-auto flex items-center justify-between pt-4">
                <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-400 sm:text-[10px] sm:tracking-[0.16em]">
                  {modo === 'automatico' ? 'Selecionado' : 'Escolher'}
                </span>
                <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${modo === 'automatico' ? 'border-red-600 bg-red-600 text-white' : 'border-zinc-200 text-zinc-300 dark:border-zinc-700'}`}>
                  {modo === 'automatico' && <CheckCircle2 size={15} strokeWidth={3} />}
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={selecionarPersonalizado}
            className={`group relative flex min-h-[178px] flex-col overflow-hidden rounded-2xl border-2 p-3 text-left shadow-md transition-all duration-500 hover:-translate-y-1 sm:min-h-[260px] sm:rounded-[2.2rem] sm:p-6 md:p-7 ${
              modo === 'personalizado'
                ? 'border-red-500 bg-white shadow-red-500/10 dark:border-red-900/60 dark:bg-zinc-900'
                : 'border-zinc-100 bg-white hover:border-zinc-300 hover:shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900'
            }`}
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.2rem]">
              <SlidersHorizontal size={150} strokeWidth={1.35} className="absolute -bottom-6 -right-6 text-zinc-500 opacity-[0.05] transition-all duration-700 group-hover:-rotate-12 group-hover:scale-110 dark:opacity-[0.08]" />
            </div>
            <div className="relative z-10 flex h-full flex-col">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-lg shadow-zinc-900/15 transition-all duration-500 group-hover:rotate-6 dark:bg-white dark:text-zinc-900 sm:mb-6 sm:h-12 sm:w-12 sm:rounded-2xl">
                <SlidersHorizontal size={18} strokeWidth={2.5} className="sm:h-6 sm:w-6" />
              </div>
              <p className="mb-1 text-[8px] font-black uppercase tracking-[0.14em] text-red-600 dark:text-red-500 sm:text-[9px] sm:tracking-[0.2em]">
                Ajustar
              </p>
              <h3 className="text-[17px] font-black uppercase leading-none tracking-tighter text-zinc-900 dark:text-white min-[390px]:text-[19px] sm:text-2xl">
                Personalizado
              </h3>
              <p className="mt-3 line-clamp-4 text-[11px] font-semibold leading-snug text-zinc-500 dark:text-zinc-400 min-[390px]:text-[12px] sm:mt-4 sm:text-sm sm:leading-relaxed">
                Escolha a duracao de cada sessao quando quiser blocos mais curtos ou mais longos.
              </p>
              <div className="mt-auto flex items-center justify-between pt-4">
                <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-400 sm:text-[10px] sm:tracking-[0.16em]">
                  {modo === 'personalizado' ? 'Selecionado' : 'Escolher'}
                </span>
                <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${modo === 'personalizado' ? 'border-red-600 bg-red-600 text-white' : 'border-zinc-200 text-zinc-300 dark:border-zinc-700'}`}>
                  {modo === 'personalizado' && <CheckCircle2 size={15} strokeWidth={3} />}
                </div>
              </div>
            </div>
          </button>
        </div>

        {modo === 'personalizado' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:mt-5"
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

        <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-3 rounded-2xl border border-red-100 bg-red-50/70 p-4 dark:border-red-950/50 dark:bg-red-950/20 sm:mt-5">
          <div className="rounded-2xl bg-red-600 px-4 py-3 text-center text-white">
            <p className="text-xl font-black leading-none">{fmtMin(tempoSessaoMinutos)}</p>
            <p className="mt-1 text-[7px] font-black uppercase tracking-widest text-red-100">1 bloco</p>
          </div>
          <p className="text-[12px] font-medium leading-relaxed text-zinc-700 dark:text-zinc-300">
            Em um dia de <strong>{fmtMin(exemploDiaMinutos)}</strong>, blocos de <strong>{fmtMin(tempoSessaoMinutos)}</strong> geram <strong>{totalSessoesNoExemplo} sessoes</strong>
            {sobraNoExemplo > 0 ? `: ${sessoesNoExemplo} completas e 1 sessao extra de ${fmtMin(sobraNoExemplo)}.` : '.'}
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
      </motion.div>
    </div>
  );
}
