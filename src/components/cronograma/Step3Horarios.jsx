import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Target, Coffee, Zap, AlertCircle, Trash2, Moon, Flame, Check } from 'lucide-react';

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

const PRESETS_HORAS = [1, 2, 3, 4, 6, 8];

const formatHorasTexto = (val) => {
  if (!val) return '0h';
  const h = Math.floor(val);
  const m = val % 1 !== 0 ? '30m' : '';
  if (h === 0) return `${m}`;
  return m ? `${h}h ${m}` : `${h}h`;
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
      className={`relative rounded-xl md:rounded-2xl border overflow-hidden transition-all duration-300 ${
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
        className="relative z-10 w-full flex items-center justify-between p-2 md:p-3 outline-none group"
      >
        <div className="flex items-center gap-2">
          {/* Ícone menor no mobile */}
          <div className={`w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
            isEstudo
              ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
              : 'bg-white dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-600'
          }`}>
            {isEstudo ? <Check size={13} strokeWidth={3} /> : <Moon size={13} />}
          </div>

          <div className="text-left">
            {/* Nome abreviado no mobile, completo no desktop */}
            <h4 className={`text-[11px] md:text-sm font-black tracking-wide leading-tight ${
              isEstudo ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'
            }`}>
              <span className="md:hidden">{dia.curto}</span>
              <span className="hidden md:inline">{dia.longo}</span>
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
              <span className="text-sm md:text-lg font-black text-red-600 dark:text-red-400 tracking-tighter leading-none">
                {formatHorasTexto(horas)}
              </span>
              <span className="text-[7px] md:text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5 hidden md:block">Estudando</span>
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
            <div className="px-2 md:px-3 pb-2 md:pb-3 pt-0">
              <div className="bg-zinc-50/50 dark:bg-zinc-800/40 rounded-lg md:rounded-xl p-2 md:p-3 border border-zinc-100 dark:border-zinc-700/50">

                {/* Presets — Todos em uma única linha */}
                <div className="flex w-full gap-1 mb-4">
                  {PRESETS_HORAS.map(h => (
                    <button
                      key={h}
                      onClick={() => onHorasChange(dia.idx, h)}
                      className={`flex-1 h-9 md:h-10 rounded-lg text-[11px] md:text-xs font-black transition-all active:scale-95 flex items-center justify-center ${
                        horas === h
                          ? 'bg-red-500 text-white shadow-md shadow-red-500/30 border-transparent'
                          : 'bg-white dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300 hover:bg-red-50 dark:hover:bg-zinc-600 border border-zinc-200 dark:border-zinc-600'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>

                <div className="relative flex items-center w-full h-7 md:h-8">
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

                <div className="flex justify-between mt-1 text-[8px] md:text-[9px] font-black uppercase text-zinc-400">
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
const Step3_Horarios = ({ horarios, onHorariosChange, editalSelecionado }) => {
  const hasEdital = !!editalSelecionado;

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

  return (
    <div className="flex flex-col h-full overflow-hidden w-full">

      {/* ── Título Centralizado ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6 md:mb-8 w-full mx-auto px-4"
      >
        <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none mb-3">
          Seus dias<br />
          <span className="text-red-600">de estudo</span>
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium leading-relaxed max-w-md mx-auto">
          Selecione os dias que você vai estudar e defina as horas disponíveis em cada um.
          Os dias não selecionados são tratados como <strong className="text-zinc-600 dark:text-zinc-400">dias de descanso</strong>.
        </p>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-4 md:gap-6 w-full overflow-y-auto custom-scrollbar pb-10 px-1">

        {/* ── Coluna Esquerda: Configuração em Grade ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 md:gap-4">

          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">
              Configurar Semana
            </span>
            <button
              onClick={limparTudo}
              disabled={totalHoras === 0}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-100 hover:bg-red-50 hover:text-red-600 dark:bg-zinc-800 dark:hover:bg-red-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={12} className="group-hover:scale-110 transition-transform" />
              Zerar
            </button>
          </div>

          {/* SEMPRE 2 colunas no mobile, 2 no desktop também */}
          <div className="grid grid-cols-2 gap-2 md:gap-3 items-start">
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
