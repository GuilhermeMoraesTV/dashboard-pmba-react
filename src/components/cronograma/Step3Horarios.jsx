import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Target, Coffee, Zap, AlertCircle, Trash2, Moon, Flame, Check, Wand2, SlidersHorizontal } from 'lucide-react';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const DIAS = [
  { idx: 0, curto: 'Dom', longo: 'Domingo',       weekend: true  },
  { idx: 1, curto: 'Seg', longo: 'Segunda-feira', weekend: false },
  { idx: 2, curto: 'Ter', longo: 'Terça-feira',   weekend: false },
  { idx: 3, curto: 'Qua', longo: 'Quarta-feira',  weekend: false },
  { idx: 4, curto: 'Qui', longo: 'Quinta-feira',  weekend: false },
  { idx: 5, curto: 'Sex', longo: 'Sexta-feira',   weekend: false },
  { idx: 6, curto: 'Sáb', longo: 'Sábado',        weekend: true  },
];

const PRESETS_HORAS = [1, 2, 3, 4, 5, 6, 7];

const formatHorasTexto = (val) => {
  if (!val) return '0h';
  const h = Math.floor(val);
  const m = val % 1 !== 0 ? '30m' : '';
  if (h === 0) return `${m}`;
  return m ? `${h}h ${m}` : `${h}h`;
};

const minutesToHourParts = (minutes) => {
  const rounded = Math.round(Math.max(0, Number(minutes) || 0) / 5) * 5;
  return {
    horas: Math.floor(rounded / 60),
    minutos: rounded % 60,
  };
};

const formatMinutosTexto = (minutes) => {
  const { horas, minutos } = minutesToHourParts(minutes);
  if (horas === 0) return `${minutos}min`;
  return minutos > 0 ? `${horas}h ${minutos}min` : `${horas}h`;
};

// ─── CARTÃO DE DIA (COMPACTO) ─────────────────────────────────────────────────
const DiaCard = ({ dia, horas, onToggle, onHorasChange }) => {
  const isEstudo = horas > 0;
  const percent  = Math.min(100, (horas / 12) * 100);

  const sliderStyle = `
    .slider-compact-${dia.idx}::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 16px; height: 16px; border-radius: 50%;
      background: white; border: 2px solid #ef4444;
      box-shadow: 0 2px 5px rgba(239,68,68,0.3); cursor: pointer; transition: transform 0.1s ease;
      margin-top: -4px;
    }
    .slider-compact-${dia.idx}::-webkit-slider-thumb:active { transform: scale(1.15); }
    .slider-compact-${dia.idx}::-webkit-slider-runnable-track {
      width: 100%; height: 8px; border-radius: 999px; background: transparent;
    }
    .slider-compact-${dia.idx} { -webkit-appearance: none; width: 100%; height: 8px; background: transparent; outline: none; }
  `;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      className={`relative overflow-hidden rounded-xl border transition-all duration-300 ${
        isEstudo
          ? 'border-red-400/50 bg-white dark:bg-zinc-900 shadow-md shadow-red-500/5'
          : 'border-zinc-200 dark:border-zinc-800/60 bg-zinc-50/80 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800'
      }`}
    >
      <style>{sliderStyle}</style>

      {isEstudo && (
        <div className="absolute inset-0 bg-gradient-to-br from-red-50/40 to-transparent dark:from-red-950/10 dark:to-transparent pointer-events-none" />
      )}

      {/* Cabeçalho do Card */}
      <button
        onClick={() => onToggle(dia.idx)}
        className="group relative z-10 flex w-full items-center justify-between p-2 outline-none"
      >
        <div className="flex items-center gap-2">
          {/* Ícone menor no mobile */}
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-300 ${
            isEstudo
              ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
              : 'bg-white dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-600'
          }`}>
            {isEstudo ? <Check size={13} strokeWidth={3} /> : <Moon size={13} />}
          </div>

          <div className="text-left">
            {/* Nome abreviado no mobile, completo no desktop */}
            <h4 className={`text-[11px] font-black leading-tight tracking-wide ${
              isEstudo ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'
            }`}>
              <span className="xl:hidden">{dia.curto}</span>
              <span className="hidden xl:inline">{dia.longo}</span>
            </h4>
            <span className={`text-[8px] md:text-[9px] font-bold uppercase tracking-widest ${
              dia.weekend ? 'text-red-500/80' : 'text-zinc-400'
            }`}>
              {dia.weekend ? 'Fim de sem.' : 'Dia útil'}
            </span>
          </div>
        </div>

        <div className="text-right">
          {isEstudo ? (
            <div className="flex flex-col items-end">
              <span className="text-sm font-black leading-none tracking-tighter text-red-600 dark:text-red-400">
                {formatHorasTexto(horas)}
              </span>
            </div>
          ) : (
            <span className="px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-full bg-zinc-200/60 dark:bg-zinc-700/50 text-[8px] md:text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Desc.
            </span>
          )}
        </div>
      </button>

      {/* Área de Edição (Compacta) */}
      <AnimatePresence>
        {isEstudo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="overflow-hidden relative z-10"
          >
            <div className="px-2 pb-2 pt-0">
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 px-2 py-1.5 dark:border-zinc-700/50 dark:bg-zinc-800/40">
                <div className="mb-1.5 flex w-full gap-0.5">
                  {PRESETS_HORAS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onHorasChange(dia.idx, preset)}
                      className={`flex h-7 min-w-0 flex-1 items-center justify-center rounded-md text-[9px] font-black transition-colors ${
                        horas === preset
                          ? 'bg-red-500 text-white shadow-sm'
                          : 'border border-zinc-200 bg-white text-zinc-500 hover:border-red-300 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                      }`}
                    >
                      {preset}h
                    </button>
                  ))}
                </div>
                <div className="relative flex h-6 w-full items-center">
                  <div className="absolute inset-x-0 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="absolute left-0 h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full"
                      style={{ width: `${percent}%`, transition: 'width 0.1s ease-out' }}
                    />
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="12"
                    step="0.5"
                    value={horas}
                    onChange={e => onHorasChange(dia.idx, parseFloat(e.target.value))}
                    className={`absolute inset-x-0 m-0 w-full z-10 slider-compact-${dia.idx}`}
                  />
                </div>

                <div className="mt-0.5 flex justify-between text-[8px] font-black uppercase text-zinc-400">
                  <span>30min</span>
                  <span>12h</span>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── CARD SIDEBAR EDITAL (PADRÃO STEP 2) ──────────────────────────────────────
const EditalSidebarCard = ({ editalSelecionado }) => (
  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden shadow-[0_8px_30px_rgba(239,68,68,0.15)] dark:shadow-[0_8px_30px_rgba(239,68,68,0.08)]">
    <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-red-50 dark:from-red-900/10 to-transparent pointer-events-none" />
    <span className="relative z-10 inline-block px-2.5 py-1 mb-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[9px] font-black uppercase tracking-widest rounded-lg">
      Edital Alvo
    </span>
    <div className="relative z-10 w-28 h-28 shrink-0 rounded-2xl bg-white dark:bg-zinc-800 border-2 border-red-100 dark:border-red-900/30 flex items-center justify-center p-2 mb-4 shadow-lg shadow-red-500/20">
      {editalSelecionado.logo || editalSelecionado.logoUrl ? (
        <img src={editalSelecionado.logo || editalSelecionado.logoUrl} alt="Logo Edital" className="w-full h-full object-contain" />
      ) : <Target size={36} className="text-red-500" />}
    </div>
    <div className="relative z-10 w-full">
      <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase leading-tight line-clamp-2">
        {editalSelecionado.titulo || editalSelecionado.nome}
      </h3>
      {editalSelecionado.cargo && (
        <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-1.5 line-clamp-1">
          {editalSelecionado.cargo}
        </p>
      )}
    </div>
  </div>
);

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
const Step3_Horarios = ({ horarios, onHorariosChange, editalSelecionado, config = null, onConfigChange = null }) => {
  const hasEdital = !!editalSelecionado;
  const modoMontagem = config?.modoMontagem || 'inteligente';
  const podeEscolherModo = typeof onConfigChange === 'function' && config?.mostrarModoMontagem !== false;
  const duracaoMinima = Math.max(5, Number(config?.duracaoMinimaSessaoMinutos) || 30);
  const duracaoMaxima = Math.max(duracaoMinima, Number(config?.duracaoMaximaSessaoMinutos) || 60);
  const usarDuracaoUnica = config?.usarDuracaoUnica === true;
  const duracaoUnica = Math.max(5, Number(config?.tempoSessaoMinutos) || duracaoMaxima);
  const maxDuracaoUnica = Math.max(5, Number(config?.maxDuracaoSessaoMinutos) || 240);
  const duracaoUnicaLimitada = Math.min(duracaoUnica, maxDuracaoUnica);
  const duracaoAutomaticaMaxima = Math.max(5, Math.min(60, maxDuracaoUnica));
  const duracaoAutomaticaMinima = Math.min(30, duracaoAutomaticaMaxima);
  const duracaoUnicaPartes = minutesToHourParts(duracaoUnicaLimitada);
  const [duracaoUnicaDraft, setDuracaoUnicaDraft] = useState(() => ({
    horas: String(duracaoUnicaPartes.horas),
    minutos: String(duracaoUnicaPartes.minutos),
  }));

  useEffect(() => {
    setDuracaoUnicaDraft({
      horas: String(duracaoUnicaPartes.horas),
      minutos: String(duracaoUnicaPartes.minutos),
    });
  }, [duracaoUnicaPartes.horas, duracaoUnicaPartes.minutos]);

  const totalHoras = useMemo(
    () => Object.values(horarios).reduce((a, h) => a + (parseFloat(h) || 0), 0),
    [horarios]
  );

  const maxHorasDia = Math.max(...Object.values(horarios), 1);

  const handleToggle = (diaIdx) => {
    const atual = horarios[diaIdx] || 0;
    onHorariosChange({ ...horarios, [diaIdx]: atual > 0 ? 0 : 1 });
  };

  const handleHorasChange = (diaIdx, val) => {
    if (val <= 0) onHorariosChange({ ...horarios, [diaIdx]: 0 });
    else onHorariosChange({ ...horarios, [diaIdx]: val });
  };

  const limparTudo = () => {
    const novo = {};
    DIAS.forEach(d => { novo[d.idx] = 0; });
    onHorariosChange(novo);
  };

  const handleModoMontagem = (modo) => {
    if (!podeEscolherModo) return;
    onConfigChange({ ...(config || {}), modoMontagem: modo });
  };

  const handleDuracaoChange = (field, rawValue) => {
    if (typeof onConfigChange !== 'function') return;
    const value = Math.max(5, Math.min(240, Math.round(Number(rawValue) || 0)));
    const next = { ...(config || {}), [field]: value };
    if (field === 'duracaoMinimaSessaoMinutos' && value > duracaoMaxima) {
      next.duracaoMaximaSessaoMinutos = value;
    }
    if (field === 'duracaoMaximaSessaoMinutos' && value < duracaoMinima) {
      next.duracaoMinimaSessaoMinutos = value;
    }
    onConfigChange(next);
  };

  const handleDuracaoPartChange = (field, part, rawValue) => {
    const current = field === 'duracaoMinimaSessaoMinutos' ? duracaoMinima : duracaoMaxima;
    const parts = minutesToHourParts(current);
    const numeric = Math.max(0, Math.round(Number(rawValue) || 0));
    const nextParts = {
      ...parts,
      [part]: part === 'horas' ? Math.min(4, numeric) : Math.min(50, Math.floor(numeric / 10) * 10),
    };
    handleDuracaoChange(field, (nextParts.horas * 60) + nextParts.minutos);
  };

  const handleDuracaoUnicaChange = (rawValue) => {
    if (typeof onConfigChange !== 'function') return;
    const value = Math.max(5, Math.min(maxDuracaoUnica, Math.round(Number(rawValue) || 0)));
    onConfigChange({ ...(config || {}), tempoSessaoMinutos: value });
  };

  const handleDuracaoUnicaDraftChange = (part, rawValue) => {
    if (!/^\d*$/.test(rawValue)) return;
    setDuracaoUnicaDraft((current) => ({ ...current, [part]: rawValue }));
  };

  const commitDuracaoUnicaDraft = () => {
    const horas = Math.max(0, Math.round(Number(duracaoUnicaDraft.horas) || 0));
    const minutos = Math.max(0, Math.min(59, Math.round(Number(duracaoUnicaDraft.minutos) || 0)));
    const total = Math.max(5, Math.min(maxDuracaoUnica, (horas * 60) + minutos));
    const normalized = minutesToHourParts(total);
    setDuracaoUnicaDraft({ horas: String(normalized.horas), minutos: String(normalized.minutos) });
    handleDuracaoUnicaChange(total);
  };

  const handleModoDuracao = (modo) => {
    if (typeof onConfigChange !== 'function') return;
    const personalizado = modo === 'personalizado';
    const next = {
      ...(config || {}),
      usarDuracaoUnica: personalizado,
    };

    if (!personalizado && duracaoMinima === duracaoMaxima) {
      next.duracaoMinimaSessaoMinutos = duracaoAutomaticaMinima;
      next.duracaoMaximaSessaoMinutos = duracaoAutomaticaMaxima;
    }

    onConfigChange(next);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden w-full">

      {/* ── Título Centralizado ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6 md:mb-8 w-full mx-auto px-4"
      >
        <h2 className="text-4xl sm:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-[0.95] mb-3">
          Seus dias<br />
          <span className="text-red-600">de estudo</span>
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-base sm:text-sm font-semibold leading-relaxed max-w-md mx-auto">
          Selecione os dias que você vai estudar e defina as horas disponíveis em cada um.
          Os dias não selecionados são tratados como <strong className="text-zinc-600 dark:text-zinc-400">dias de descanso</strong>.
        </p>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-4 md:gap-6 w-full overflow-y-auto custom-scrollbar pb-10 px-1">

        {/* ── Coluna Esquerda: Configuração em Grade ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 md:gap-4">

          {podeEscolherModo && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Montagem do cronograma
                  </p>
                  <p className="mt-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                    Escolha aqui se quer que o sistema distribua ou se prefere montar de forma personalizada.
                  </p>
                </div>
                <span className="hidden rounded-full bg-red-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-red-600 dark:bg-red-950/30 dark:text-red-300 sm:inline-flex">
                  Opção principal
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  { id: 'inteligente', label: 'Inteligente', desc: 'Distribuição automática equilibrada.', icon: Wand2 },
                  { id: 'personalizado', label: 'Personalizado', desc: 'Você ajusta a montagem do plano.', icon: SlidersHorizontal },
                ].map((opcao) => {
                  const active = modoMontagem === opcao.id;
                  const Icon = opcao.icon;
                  return (
                    <button
                      key={opcao.id}
                      type="button"
                      onClick={() => handleModoMontagem(opcao.id)}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all ${
                        active
                          ? 'border-red-300 bg-red-50/70 text-red-700 shadow-sm dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-card-dark dark:text-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        active ? 'bg-red-600 text-white' : 'bg-white text-zinc-400 dark:bg-zinc-900'
                      }`}>
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-black uppercase tracking-widest">
                          {opcao.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] font-semibold opacity-75">
                          {opcao.desc}
                        </span>
                      </span>
                      {active && <Check size={16} className="ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!config?.ocultarConfiguracaoDuracao && (<>
          {config?.mostrarModoDuracao && (
            <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="px-1 pb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                Como definir a duração dos blocos?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: 'automatico',
                    label: 'Automático',
                    desc: `O sistema ajusta cada bloco entre ${duracaoAutomaticaMinima} e ${duracaoAutomaticaMaxima} min.`,
                    icon: Wand2,
                  },
                  {
                    id: 'personalizado',
                    label: 'Definido por mim',
                    desc: 'Você escolhe o tempo máximo de cada bloco.',
                    icon: SlidersHorizontal,
                  },
                ].map((opcao) => {
                  const active = opcao.id === (usarDuracaoUnica ? 'personalizado' : 'automatico');
                  const Icon = opcao.icon;
                  return (
                    <button
                      key={opcao.id}
                      type="button"
                      onClick={() => handleModoDuracao(opcao.id)}
                      className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2.5 text-left transition-all sm:px-3 ${
                        active
                          ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-300'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-card-dark dark:text-zinc-300'
                      }`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-red-600 text-white' : 'bg-white text-zinc-400 dark:bg-zinc-900'}`}>
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-black uppercase tracking-wide sm:text-xs">{opcao.label}</span>
                        <span className="mt-0.5 block text-[9px] font-semibold leading-snug opacity-75 sm:text-[10px]">{opcao.desc}</span>
                      </span>
                      {active && <Check size={15} className="ml-auto hidden shrink-0 sm:block" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {usarDuracaoUnica ? (
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-red-100 bg-gradient-to-br from-white via-white to-red-50/70 p-3 shadow-sm shadow-red-950/5 dark:border-red-950/50 dark:from-zinc-900 dark:via-zinc-900 dark:to-red-950/20 sm:p-4">
              <div aria-hidden="true" className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-red-500/10 blur-2xl" />
              <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-md shadow-red-600/20">
                    <Clock size={17} strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black leading-snug text-zinc-900 dark:text-white sm:text-sm">
                      Quanto tempo você gostaria de estudar por bloco?
                    </p>
                    <p className="mt-0.5 text-[9px] font-bold text-zinc-500 dark:text-zinc-400 sm:text-[10px]">
                      Máximo de {formatMinutosTexto(maxDuracaoUnica)} conforme sua carga diária.
                    </p>
                  </div>
                </div>
                <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:w-[190px]">
                  <label className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 shadow-sm transition-colors focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-500/10 dark:border-zinc-700 dark:bg-card-dark">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-zinc-400">Horas</span>
                    <span className="flex items-baseline gap-1">
                      <input
                        id="cycle-block-duration"
                        type="number"
                        min="0"
                        max={Math.floor(maxDuracaoUnica / 60)}
                        step="1"
                        value={duracaoUnicaDraft.horas}
                        onChange={(event) => handleDuracaoUnicaDraftChange('horas', event.target.value)}
                        onBlur={commitDuracaoUnicaDraft}
                        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
                        aria-label="Tempo de estudo por bloco em horas"
                        className="duration-number-input w-full min-w-0 bg-transparent text-center text-lg font-black tabular-nums text-zinc-900 outline-none dark:text-white"
                      />
                      <span className="text-[10px] font-black text-zinc-400">h</span>
                    </span>
                  </label>
                  <label className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 shadow-sm transition-colors focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-500/10 dark:border-zinc-700 dark:bg-card-dark">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-zinc-400">Minutos</span>
                    <span className="flex items-baseline gap-1">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        step="5"
                        value={duracaoUnicaDraft.minutos}
                        onChange={(event) => handleDuracaoUnicaDraftChange('minutos', event.target.value)}
                        onBlur={commitDuracaoUnicaDraft}
                        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
                        aria-label="Tempo de estudo por bloco em minutos"
                        className="duration-number-input w-full min-w-0 bg-transparent text-center text-lg font-black tabular-nums text-zinc-900 outline-none dark:text-white"
                      />
                      <span className="text-[10px] font-black text-zinc-400">min</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          ) : (
          <div>
            <div className="mb-2">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Duração dos blocos de estudo</p>
              <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-zinc-600 dark:text-zinc-300">A duração mínima e a máxima formam a faixa obrigatória de cada bloco. Nenhuma sessão será menor que o mínimo nem maior que o máximo.</p>
            </div>
            <div className="grid w-full max-w-2xl grid-cols-2 gap-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              {[
                { field: 'duracaoMinimaSessaoMinutos', label: 'Mínima', value: duracaoMinima },
                { field: 'duracaoMaximaSessaoMinutos', label: 'Máxima', value: duracaoMaxima },
              ].map((item) => {
                const parts = minutesToHourParts(item.value);
                return (
                  <div key={item.field} className="flex min-w-0 flex-col gap-1.5 rounded-lg bg-zinc-50 px-1.5 py-2 dark:bg-card-dark sm:px-2.5">
                    <span className="text-center text-[9px] font-black uppercase tracking-wide text-zinc-500 dark:text-zinc-400 sm:text-[10px]">Duração {item.label.toLowerCase()}</span>
                    <div className="grid min-w-0 grid-cols-2 gap-1 sm:gap-1.5">
                      <label className="flex min-w-0 items-center gap-0.5 rounded-md border border-zinc-200 bg-white px-1 py-1 dark:border-zinc-800 dark:bg-zinc-900 sm:px-2">
                        <input
                          type="number"
                          min="0"
                          max="4"
                          step="1"
                          value={parts.horas}
                          onChange={(event) => handleDuracaoPartChange(item.field, 'horas', event.target.value)}
                          aria-label={`${item.label} em horas`}
                          className="duration-number-input w-full min-w-0 bg-transparent text-center text-base font-black tabular-nums text-zinc-900 outline-none dark:text-white"
                        />
                        <span className="text-[9px] font-black uppercase text-zinc-400">h</span>
                      </label>
                      <label className="flex min-w-0 items-center gap-0.5 rounded-md border border-zinc-200 bg-white px-1 py-1 dark:border-zinc-800 dark:bg-zinc-900 sm:px-2">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          step="10"
                          value={parts.minutos}
                          onChange={(event) => handleDuracaoPartChange(item.field, 'minutos', event.target.value)}
                          aria-label={`${item.label} em minutos`}
                          className="duration-number-input w-full min-w-0 bg-transparent text-center text-base font-black tabular-nums text-zinc-900 outline-none dark:text-white"
                        />
                        <span className="text-[9px] font-black uppercase text-zinc-400">min</span>
                      </label>
                    </div>
                  </div>
                );
              })}
              <p className="col-span-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-2 text-[10px] font-bold leading-relaxed text-emerald-800 dark:border-emerald-900/45 dark:bg-emerald-950/20 dark:text-emerald-300 sm:text-[11px]">
                O sistema distribui os blocos dentro dessa faixa e prioriza tempos redondos de 10 minutos, como 40min, 50min, 1h ou 1h30.
              </p>
            </div>
          </div>
          )}
          </>)}

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Dias e carga de estudo da semana</p>
              <p className="mt-0.5 text-[11px] font-semibold leading-snug text-zinc-500 dark:text-zinc-400">Ative os dias em que pretende estudar e informe o tempo disponível.</p>
            </div>
            <button
              onClick={limparTudo}
              disabled={totalHoras === 0}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-100 hover:bg-red-50 hover:text-red-600 dark:bg-zinc-800 dark:hover:bg-red-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={12} className="group-hover:scale-110 transition-transform" />
              Zerar
            </button>
          </div>

          <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-3">
            {DIAS.map((dia) => (
              <DiaCard
                key={dia.idx}
                dia={dia}
                horas={horarios[dia.idx] || 0}
                onToggle={handleToggle}
                onHorasChange={handleHorasChange}
              />
            ))}
          </div>

        </div>

        {/* ── Coluna Direita: Dashboard Sidebar ── */}
        <div className="lg:w-[300px] shrink-0">
          <div className="sticky top-6 flex flex-col gap-4 md:gap-5">

            {hasEdital && (
              <div className="hidden lg:block">
                <EditalSidebarCard editalSelecionado={editalSelecionado} />
              </div>
            )}

            {/* Dashboard: Resumo Semanal — mais compacto no mobile */}
            <div className="bg-zinc-900 rounded-2xl md:rounded-3xl p-3 md:p-6 shadow-xl relative overflow-hidden text-white">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/30 rounded-full blur-[40px] pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2 md:mb-5 opacity-80">
                  <Flame size={14} className="text-red-400" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                    Carga Semanal
                  </p>
                </div>

                {/* Número de horas + gráfico lado a lado no mobile */}
                <div className="flex items-center gap-3 md:block">

                  <motion.div
                    key={totalHoras}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-baseline shrink-0"
                  >
                    <span className="text-3xl md:text-5xl font-black tracking-tighter leading-none">
                      {Math.floor(totalHoras)}
                    </span>
                    <span className="text-lg md:text-xl font-bold text-zinc-400 mx-1">h</span>
                    {totalHoras % 1 !== 0 && (
                      <>
                        <span className="text-2xl md:text-3xl font-black tracking-tighter leading-none ml-1">30</span>
                        <span className="text-base md:text-lg font-bold text-zinc-400 mx-1">m</span>
                      </>
                    )}
                  </motion.div>

                  {/* Gráfico de Barras — menor no mobile */}
                  <div className="flex-1 md:mt-4 md:mb-3">
                    <div className="flex items-end justify-between h-8 md:h-16 gap-1 mb-1 md:mb-2.5">
                      {DIAS.map(dia => {
                        const h = horarios[dia.idx] || 0;
                        const heightPercent = h > 0 ? Math.max(15, (h / maxHorasDia) * 100) : 0;
                        const isEstudo = h > 0;

                        return (
                          <div key={dia.idx} className="w-full flex flex-col items-center gap-1 md:gap-2 group">
                            <div className="w-full bg-zinc-800 rounded-full h-full flex items-end overflow-hidden relative">
                              {isEstudo && (
                                <motion.div
                                  initial={{ height: 0 }}
                                  animate={{ height: `${heightPercent}%` }}
                                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                  className="w-full bg-gradient-to-t from-red-600 to-red-400 rounded-full relative"
                                >
                                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-zinc-900 text-[9px] font-black px-1 py-0.5 rounded shadow-lg pointer-events-none">
                                    {h}h
                                  </div>
                                </motion.div>
                              )}
                            </div>

                            <div className={`text-[8px] md:text-[10px] w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-md font-black uppercase transition-all ${
                              isEstudo
                                ? 'bg-red-500 text-white shadow-sm shadow-red-500/40'
                                : 'text-zinc-500 dark:text-zinc-600'
                            }`}>
                              {dia.curto.slice(0, 1)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                <div className="pt-2 md:pt-4 border-t border-zinc-800/50 flex items-center justify-between mt-1 md:mt-0">
                  <div>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Ritmo Mensal</p>
                    <p className="text-sm font-black text-white">~{Math.round(totalHoras * 4.3)} horas</p>
                  </div>
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                    <Zap size={13} className="text-yellow-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Aviso quando sem horário */}
            <AnimatePresence>
              {totalHoras === 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-3 md:p-4"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={15} className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-black text-amber-800 dark:text-amber-500 uppercase tracking-widest mb-0.5">Ação Necessária</p>
                      <p className="text-[11px] text-amber-700/90 dark:text-amber-400/80 font-medium leading-relaxed">
                        Selecione pelo menos um dia na semana para continuar.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Step3_Horarios;
