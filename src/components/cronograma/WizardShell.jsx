/**
 * src/components/cronograma/WizardShell.jsx
 *
 * Layout e navegação do wizard de criação de cronograma.
 * Toda a lógica de negócio, Firebase e geração está em useCronogramaWizard.
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ArrowLeft, ArrowRight, Eye, Sparkles, 
  CheckCircle2, Target, CalendarDays, Settings2,
  Clock, Info, Layout, AlertCircle, RefreshCw
} from 'lucide-react';

import Step1_Edital from './Step1Edital';
import StepModoMontagem from './StepModoMontagem';
import Step2_Disciplinas from './Step2Disciplinas';
import Step3_Horarios from './Step3Horarios';
import StepMetodologiaRevisao from './StepMetodologiaRevisao';
import Step4_Config from './Step4Config';
import Step5_Preview from './Step5Preview';

import { defaultHorarios, useCronogramaWizard } from '../../hooks/useCronogramaWizard';

const STEPS_LEGACY = [
  { id: 0, label: 'Edital',      icon: Target,       title: 'Seleção de Edital', sub: 'Escolha sua base' },
  { id: 1, label: 'Matérias',    icon: Layout,       title: 'Disciplinas',      sub: 'O que estudar' },
  { id: 2, label: 'Horários',    icon: Clock,        title: 'Sua Rotina',       sub: 'Quando estudar' },
  { id: 3, label: 'Metodologia', icon: Settings2,    title: 'Revisão',          sub: 'Como revisar' },
  { id: 4, label: 'Ajustes',     icon: Sparkles,     title: 'Preferências',     sub: 'Personalização' },
  { id: 5, label: 'Prévia',      icon: Eye,          title: 'Resultado',        sub: 'Seu plano pronto' },
];

const STEPS = [
  { id: 0, label: 'Edital',      icon: Target,       title: 'Selecao de Edital', sub: 'Escolha sua base' },
  { id: 1, label: 'Montagem',    icon: CalendarDays, title: 'Montagem',         sub: 'Automatica ou manual' },
  { id: 2, label: 'Materias',    icon: Layout,       title: 'Disciplinas',      sub: 'O que estudar' },
  { id: 3, label: 'Horarios',    icon: Clock,        title: 'Sua Rotina',       sub: 'Quando estudar' },
  { id: 4, label: 'Metodologia', icon: Settings2,    title: 'Revisao',          sub: 'Como revisar' },
  { id: 5, label: 'Ajustes',     icon: Sparkles,     title: 'Preferencias',     sub: 'Personalizacao' },
  { id: 6, label: 'Previa',      icon: Eye,          title: 'Resultado',        sub: 'Seu plano pronto' },
];

const scrollToTopInstant = (element = null) => {
  if (element) element.scrollTop = 0;
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  } catch {
    window.scrollTo(0, 0);
  }
};

const WizardShell = ({
  user,
  onClose,
  onCronogramaCriado,
  onOpenFeedback,
  onBackToSelector,
  mode = 'create',
  cronogramaId = null,
  initialState = null,
  initialStep = 0,
}) => {
  const [passo,             setPasso]             = useState(() => mode === 'edit' ? Math.max(1, Number(initialStep) || 1) : Number(initialStep) || 0);
  const [confirmandoSaida,  setConfirmandoSaida]  = useState(false);
  const [confirmandoVoltar, setConfirmandoVoltar] = useState(false);
  const conteudoRef = useRef(null);

  const {
    edital,
    disciplinas,       setDisciplinas,
    extraDisciplinas,  setExtraDisciplinas,
    selecao,           setSelecao,
    horarios,          setHorarios,
    cronConfig,        setCronConfig,
    modelos,           carregandoModelos,
    carregandoEdicaoInicial, isEditMode,
    isLoading,         statusIA,          percentIA,
    resultadoGeracao,
    erroGeracao,       setErroGeracao,
    handleSelectEdital,
    handleGerarPrevia,
    handleSalvar,
    podeAvancar,
    resetResultado,
    restaurarDraft,
    salvarDraftComPasso,
    mostrandoRascunho, setMostrandoRascunho,
    limparDraft,
  } = useCronogramaWizard(user, onClose, onCronogramaCriado, onOpenFeedback, {
    mode,
    cronogramaId,
    initialState,
  });

  const visibleSteps = isEditMode ? STEPS.slice(1) : STEPS;
  const firstVisibleStepId = visibleSteps[0]?.id ?? 0;
  const lastVisibleStepId = visibleSteps[visibleSteps.length - 1]?.id ?? STEPS.length - 1;
  const isUltimoStep  = passo === lastVisibleStepId;
  const isPassoEdital = passo === 0;
  const isPrimeiroStep = passo === firstVisibleStepId;
  const currentTitle  = STEPS[passo];
  const ctaFinalLabel = isEditMode ? 'Salvar Alteracoes' : 'Ativar Cronograma';
  const isMontagemPersonalizada = cronConfig.modoMontagem === 'personalizado';
  const isPassoMontagemPersonalizada = passo === 1 && isMontagemPersonalizada;
  const getNextPasso = (current) => (isMontagemPersonalizada && current === 1 ? 4 : current + 1);
  const getPrevPasso = (current) => (isMontagemPersonalizada && current === 4 ? 1 : current - 1);
  const voltarParaSelecaoInicial = () => {
    setConfirmandoVoltar(false);
    setCronConfig(prev => (
      prev?.modoMontagem === 'personalizado'
        ? { ...prev, modoMontagem: 'inteligente' }
        : prev
    ));
    setPasso(0);
  };

  useEffect(() => {
    scrollToTopInstant(conteudoRef.current);
  }, [passo]);

  useEffect(() => {
    document.body.classList.add('wizard-shell-open');
    return () => {
      document.body.classList.remove('wizard-shell-open');
    };
  }, []);

  useEffect(() => {
    salvarDraftComPasso(passo);
  }, [passo]);

  useEffect(() => {
    if (passo === 6 && !isLoading && !resultadoGeracao && !erroGeracao) {
      handleGerarPrevia();
    }
  }, [passo, isLoading, resultadoGeracao, erroGeracao, handleGerarPrevia]);

  const handleVoltar = () => {
    if (isEditMode && passo === firstVisibleStepId) {
      onClose?.();
      return;
    }
    if (passo === 1 && isMontagemPersonalizada) {
      setConfirmandoVoltar(true);
      return;
    }
    if (passo === 2 && (disciplinas.length > 0 || extraDisciplinas.length > 0)) {
      setConfirmandoVoltar(true);
      return;
    }
    if (passo === 6) resetResultado();
    setPasso(p => getPrevPasso(p));
  };

  const handleAvancar = () => {
    if (!podeAvancar(passo, false)) return;
    const nextPasso = getNextPasso(passo);
    if (nextPasso === 6) {
      resetResultado();
      setErroGeracao(null);
    }
    if (passo === 2 && nextPasso === 3) {
      setHorarios({ ...defaultHorarios });
    }
    setPasso(nextPasso);
  };

  const avancarDepoisDoEdital = () => {
    setPasso(1);
  };

  const handleModoMontagemEscolhido = (modoSelecionado) => {
    if (modoSelecionado === 'inteligente') {
      setPasso(2);
    }
  };

  const onAbrirSuporte = () => onOpenFeedback?.({ initialView: 'new', initialType: 'edital' });

  const renderStep = () => {
    switch (passo) {
      case 0: return (
        <Step1_Edital
          editalSelecionado={edital}
          modelos={modelos}
          carregando={carregandoModelos}
          onSelect={handleSelectEdital}
          onAbrirSuporte={onAbrirSuporte}
          onEscolhaCompleta={avancarDepoisDoEdital}
        />
      );
      case 1: return (
        <StepModoMontagem
          disciplinas={disciplinas}
          extraDisciplinas={extraDisciplinas}
          config={cronConfig}
          onConfigChange={setCronConfig}
          onHorariosChange={setHorarios}
          selecao={selecao}
          onSelecaoChange={setSelecao}
          onModoEscolhido={handleModoMontagemEscolhido}
        />
      );
      case 2: return (
        <Step2_Disciplinas
          disciplinas={disciplinas}
          onDisciplinasChange={setDisciplinas}
          extraDisciplinas={extraDisciplinas}
          onExtraDisciplinasChange={setExtraDisciplinas}
          selecao={selecao}
          onSelecaoChange={setSelecao}
          modoManual={edital?.id === 'manual'}
          editalSelecionado={edital}
          horarios={horarios}
        />
      );
      case 3: return (
        <Step3_Horarios
          horarios={horarios}
          onHorariosChange={setHorarios}
          editalSelecionado={edital}
        />
      );
      case 4: return (
        <StepMetodologiaRevisao
          config={cronConfig}
          onConfigChange={setCronConfig}
        />
      );
      case 5: return (
        <Step4_Config
          config={cronConfig}
          onConfigChange={setCronConfig}
          editalSelecionado={edital}
          horarios={horarios}
        />
      );
      case 6: return (
        <Step5_Preview
          disciplinas={edital?.id === 'manual' ? disciplinas : [...disciplinas, ...extraDisciplinas]}
          selecao={selecao}
          horarios={horarios}
          config={cronConfig}
          edital={edital}
          resultado={resultadoGeracao}
          loadingIA={isLoading}
          statusIA={statusIA}
          percent={percentIA}
          erroGeracao={erroGeracao}
          setErroGeracao={setErroGeracao}
          handleGerarPrevia={handleGerarPrevia}
        />
      );
      default: return null;
    }
  };

  if (carregandoEdicaoInicial) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-2xl border-4 border-red-200 border-t-red-600 animate-spin" />
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-zinc-900 dark:text-white">
              Carregando Edicao
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Montando o cronograma no wizard compartilhado...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cronograma-wizard-shell flex flex-col min-h-screen bg-transparent">
      
      {/* ── Header Sticky ── */}
      <header className="wizard-progress-header sticky top-0 z-[60] shrink-0 px-3 pt-3 md:px-6 md:pt-4">
        <div className="max-w-6xl mx-auto rounded-[28px] border border-zinc-200/80 dark:border-zinc-800 bg-white/88 dark:bg-zinc-900/88 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.05)] px-3 py-3 md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-[1.1rem] bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/20 shrink-0">
                <currentTitle.icon size={20} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h2 className="text-[12px] md:text-[13px] font-black uppercase tracking-[0.14em] text-zinc-900 dark:text-white leading-none truncate">
                  {currentTitle.title}
                </h2>
                <p className="text-[10px] text-zinc-400 font-bold truncate mt-1">
                  {currentTitle.sub}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setConfirmandoSaida(true)}
                className="p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main ref={conteudoRef} className="wizard-main flex-1 overflow-y-auto px-4 py-6 pb-32 md:px-6 md:py-8 md:pb-36 custom-scrollbar">
        <div className={`wizard-step-frame ${isPassoEdital || isUltimoStep || isPassoMontagemPersonalizada ? 'w-full mx-auto' : 'max-w-5xl mx-auto'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={passo}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ── Footer Navigation ── */}
      <div className="wizard-navigation-bar fixed inset-x-2 bottom-2 z-[100050] mx-auto max-w-5xl rounded-2xl border border-zinc-200/80 bg-white/92 p-1.5 shadow-2xl shadow-zinc-950/12 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/94 sm:inset-x-3 sm:bottom-4 sm:p-3">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          
          <div className="flex items-center gap-2">
            {isPassoEdital || (isEditMode && isPrimeiroStep) ? (
              <button
                onClick={() => {
                  salvarDraftComPasso(passo);
                  if (isEditMode) onClose?.();
                  else if (onBackToSelector) onBackToSelector();
                  else onClose();
                }}
                className="flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-3 rounded-2xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-black text-[10px] sm:text-[11px] uppercase tracking-widest transition-all active:scale-95"
              >
                {isEditMode || onBackToSelector ? <ArrowLeft size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                <span className="hidden xs:inline">{onBackToSelector ? 'Métodos' : 'Cancelar'}</span>
              </button>
            ) : (
              <button
                onClick={handleVoltar}
                className="flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-3 rounded-2xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-black text-[10px] sm:text-[11px] uppercase tracking-widest transition-all active:scale-95"
              >
                <ArrowLeft size={16} strokeWidth={3} />
                <span className="hidden xs:inline">Voltar</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isUltimoStep ? (
              <button
                onClick={handleSalvar}
                disabled={isLoading || !resultadoGeracao}
                className="group flex items-center gap-2 px-5 py-2.5 sm:px-10 sm:py-3.5 rounded-2xl bg-red-600 text-white font-black text-[10px] sm:text-[11px] uppercase tracking-widest shadow-xl shadow-red-500/30 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 size={18} strokeWidth={2.5} />
                  {ctaFinalLabel}
              </button>
            ) : (
              <div className="flex flex-col items-end gap-1">
                {isPassoEdital && !podeAvancar(passo, false) && (
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                    Escolha um edital ou confirme o plano manual para continuar.
                  </span>
                )}
                <button
                  onClick={handleAvancar}
                  disabled={!podeAvancar(passo, false)}
                  className="group flex items-center gap-2 px-5 py-2.5 sm:px-10 sm:py-3.5 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black text-[10px] sm:text-[11px] uppercase tracking-widest shadow-xl shadow-zinc-900/20 dark:shadow-white/5 hover:bg-red-600 dark:hover:bg-red-600 dark:hover:text-white transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                >
                  Próximo
                  <ArrowRight size={16} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Modais de Confirmação ── */}
      <AnimatePresence>
        {mostrandoRascunho && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="wizard-confirm-card bg-white dark:bg-zinc-900 p-7 rounded-[32px] border-2 border-zinc-100 dark:border-zinc-800 shadow-2xl max-w-md w-full text-center">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <RefreshCw size={28} className="text-red-600" />
              </div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase mb-2">Recuperar Rascunho?</h3>
              <p className="text-sm text-zinc-500 mb-7">
                Encontramos um planejamento de cronograma salvo. Você pode continuar de onde parou ou começar do zero.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    limparDraft();
                    setMostrandoRascunho(false);
                  }}
                  className="py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all"
                >
                  Comecar do Zero
                </button>
                <button
                  onClick={() => {
                    const passoRestaurado = restaurarDraft();
                    setPasso(passoRestaurado);
                  }}
                  className="py-3 rounded-2xl bg-red-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-all"
                >
                  Recuperar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {confirmandoSaida && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="wizard-confirm-card bg-white dark:bg-zinc-900 p-8 rounded-[32px] border-2 border-zinc-100 dark:border-zinc-800 shadow-2xl max-w-sm w-full text-center">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle size={32} className="text-red-600" /></div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase mb-2">Abandonar Edição?</h3>
              <p className="text-sm text-zinc-500 mb-8">Suas alterações não salvas serão perdidas.</p>
              <div className="grid grid-cols-2 gap-3"><button onClick={() => setConfirmandoSaida(false)} className="py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all">Ficar</button><button onClick={() => { salvarDraftComPasso(passo); onClose(); }} className="py-3 rounded-2xl bg-red-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-all">Sair</button></div>
            </motion.div>
          </div>
        )}

        {confirmandoVoltar && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="wizard-confirm-card bg-white dark:bg-zinc-900 p-8 rounded-[32px] border-2 border-zinc-100 dark:border-zinc-800 shadow-2xl max-w-sm w-full text-center">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle size={32} className="text-red-600" /></div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase mb-2">Voltar para o Edital?</h3>
              <p className="text-sm text-zinc-500 mb-8">Seu progresso continua salvo, mas voce vai retornar para a selecao inicial.</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setConfirmandoVoltar(false)} className="py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all">Continuar Aqui</button>
                <button onClick={voltarParaSelecaoInicial} className="py-3 rounded-2xl bg-red-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-all">Voltar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default WizardShell;
