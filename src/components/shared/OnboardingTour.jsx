import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronRight, CheckCircle2, MapPin, Sparkles } from 'lucide-react';

// --- ROTEIROS DE GUIA ---
const TOURS = {
  main: [
    {
      id: 'intro',
      tab: 'home',
      targetId: 'welcome-area',
      title: 'Bem-vindo ao seu Dashboard',
      content: 'Este é o seu centro de controle. Aqui você organiza sua rotina, define metas claras e acompanha sua evolução rumo à aprovação de forma inteligente.',
      alignment: 'center',
      hasMascot: false
    },
    {
      id: 'home-stats',
      tab: 'home',
      targetId: 'home-stats-grid',
      title: 'Resumo de Desempenho',
      content: 'Acompanhe seus indicadores principais: tempo líquido de estudo, questões resolvidas e sua constância diária (streak).',
      alignment: 'bottom',
      hasMascot: true
    },
    {
      id: 'nav-metas',
      tab: 'goals',
      targetId: 'goals-controls', // ID padrão para PC
      title: 'Configuração de Metas',
      content: 'Defina sua carga horária e meta de questões diárias. O sistema ajustará seu nível de intensidade baseado na sua disponibilidade.',
      fallbackAlignment: 'top-right',
      hasMascot: true,
      mascotSide: 'right',
      mobileTargetId: 'goals-controls-inner',
    },
    // ----------------------------------------------------------------
    // --- PASSO ÚNICO DO HEADER PROGRESS (APÓS DEFINIÇÃO DE METAS) ---
    // ----------------------------------------------------------------
    {
      id: 'header-tour-final',
      tab: 'home', // Volta para a tela Home, onde o Header é mais visível e relevante
      targetId: 'header-progress-bar',
      title: 'Progresso Diário (Monitoramento)',
      content: 'Depois de definir suas metas, utilize esta barra no topo para acompanhar se o objetivo do dia (Tempo e Questões) está sendo cumprido. Depois de iniciar seus estudo poderá também compartilhar seu relatório de progresso diário salvando como PDF.',
      alignment: 'bottom',
      hasMascot: true,
      mascotSide: 'right'
    },
    // ----------------------------------------------------------------
    // --- RETORNO PARA O FLUXO ORIGINAL ---
    // ----------------------------------------------------------------
    {
      id: 'nav-calendar',
      tab: 'calendar',
      targetId: 'calendar-header-only',
      title: 'Histórico e Consistência',
      content: 'Visualize sua jornada mensal. Dias verdes indicam metas cumpridas. O segredo da aprovação está em preencher este calendário.',
      alignment: 'bottom',
      hasMascot: true
    },
    {
      id: 'finish-main',
      tab: 'home',
      targetId: 'active-cycle-card',
      title: 'Primeiros Passos',
      content: 'Para começar a cronometrar, você precisa de um Plano. Clique neste card ou acesse "Meus Ciclos" para criar seu primeiro ciclo de estudos.',
      alignment: 'top',
      hasMascot: true,
      isLast: true
    }
  ],

  cycle_visual: [
    {
      id: 'radar-intro',
      tab: 'ciclos',
      targetId: 'ciclo-radar-chart',
      title: 'Progresso Visual',
      content: 'Este gráfico representa seu ciclo. Cada fatia é uma disciplina e mostra o quanto você já estudou em relação à meta da semana.',
      alignment: 'top-right',
      hasMascot: true
    },
    {
      id: 'radar-center',
      tab: 'ciclos',
      targetId: 'ciclo-center-info',
      title: 'Total da Semana',
      content: 'No centro, você tem o somatório de horas estudadas na semana atual. Utilize para saber se está atingindo a carga horária planejada.',
      alignment: 'top-right',
      hasMascot: true
    },
    {
      id: 'radar-interaction',
      tab: 'ciclos',
      targetId: 'ciclo-details-panel',
      title: 'Painel de Ação',
      content: 'Ao clicar em uma matéria no gráfico, os detalhes aparecem aqui. É neste painel que você inicia o cronômetro ou registra atividades.',
      alignment: 'top-left',
      hasMascot: true,
      isLast: true
    }
  ]
};

// **CORREÇÃO DE ERRO:** Função com verificação de segurança para 'step'.
const getDynamicStepProps = (step, isMobile) => {
    // Lida com o caso em que step é undefined (após o término do tour ou navegação)
    if (!step) {
        return { alignment: 'center', mascotSide: 'right' };
    }

    if (step.id === 'nav-metas') {
        if (isMobile) {
            return {
                alignment: 'top-left',
                mascotSide: 'left',
            };
        } else {
            // PC: Topo direito (canto do Histórico), Mascote à esquerda.
            return {
                alignment: 'top-right',
                mascotSide: 'left',
            };
        }
    }
    // Retorna as props padrão.
    return {
        alignment: step.alignment || step.fallbackAlignment || 'center',
        mascotSide: step.mascotSide || step.fallbackMascotSide,
    };
};


const OnboardingTour = ({ tourType = 'main', isActive, onClose, onFinish, activeTab, setActiveTab }) => {
  // 1. HOOKS
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const prevRectRef = useRef(null);

  // NOVO: Estado para armazenar o ID do alvo dinâmico
  const [currentTargetId, setCurrentTargetId] = useState(null);

  const steps = TOURS[tourType] || TOURS.main;
  // A variável 'step' pode ser undefined se o índice for inválido
  const step = steps[currentStepIndex];
  const mascotImage = "/soldado.png";

  // Verifica se é o passo de introdução para renderizar o layout especial
  const isIntroStep = step?.id === 'intro';

  // Define se é mobile usando o breakpoint 'md' (768px)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Propriedades dinâmicas (usa 'step' que pode ser undefined, mas 'getDynamicStepProps' já trata isso)
  const dynamicProps = getDynamicStepProps(step, isMobile);
  const currentAlignment = dynamicProps.alignment;
  let currentMascotSide = dynamicProps.mascotSide; // Pode ser 'left', 'right' ou undefined


  // Usa o target ID dinâmico ou o padrão
  // Usa o optional chaining para acessar 'targetId' com segurança
  const actualTargetId = currentTargetId || step?.targetId;

  // --- LÓGICA DINÂMICA DO MASCOTE (Para os passos normais) ---
  const targetCenterX = targetRect ? targetRect.left + (targetRect.width / 2) : typeof window !== 'undefined' ? window.innerWidth / 2 : 0;

  let isMascotRight;

  if (currentMascotSide) {
      // Se definido em getDynamicStepProps, usa o valor fixo.
      isMascotRight = (currentMascotSide === 'right');
  } else if (step?.mascotSide) {
      // Usa a prop do objeto TOURS
      isMascotRight = (step.mascotSide === 'right');
  } else {
      // Lógica de fallback padrão (baseada na posição do alvo)
      const isTargetLeft = targetCenterX < (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
      if (currentAlignment?.includes('right')) isMascotRight = false;
      else if (currentAlignment?.includes('left')) isMascotRight = true;
      else isMascotRight = isTargetLeft;
  }

  // 2. RESET
  useEffect(() => {
    if (isActive) {
        setCurrentStepIndex(0);
        setTargetRect(null);
    }
  }, [tourType, isActive]);

  // 3. POSICIONAMENTO E LÓGICA DE TARGET CONDICIONAL
  useEffect(() => {
    if (!isActive || !step || isIntroStep) return;

    const calculatePosition = () => {

      // 1. Lógica de determinação do Target ID
      const screenIsMobile = typeof window !== 'undefined' && window.innerWidth < 768;

      let targetToUse = step.targetId;

      if (step.id === 'nav-metas' && screenIsMobile && step.mobileTargetId) {
          targetToUse = step.mobileTargetId;
      }

      // 2. Atualiza o estado do target ID a ser usado
      setCurrentTargetId(targetToUse);

      // 3. Continua com o cálculo da posição usando o ID ajustado
      const element = document.getElementById(targetToUse);

      if (element) {
        const rect = element.getBoundingClientRect();

        // Rolagem suave se o elemento estiver fora da tela
        if (rect.top < 50 || rect.bottom > window.innerHeight - 50) {
             element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        const newRect = {
          top: rect.top - 10,
          left: rect.left - 10,
          width: rect.width + 20,
          height: rect.height + 20,
        };

        const prev = prevRectRef.current;
        if (!prev ||
            Math.abs(prev.top - newRect.top) > 1 ||
            Math.abs(prev.left - newRect.left) > 1 ||
            Math.abs(prev.width - newRect.width) > 1) {

            setTargetRect(newRect);
            prevRectRef.current = newRect;
        }

        setIsNavigating(false);
      } else {
        if (!isNavigating) {
             setTimeout(calculatePosition, 500);
        } else {
            setTargetRect(null);
        }
      }
    };

    if (step.tab && activeTab !== step.tab) {
      if (typeof setActiveTab === 'function') {
        setIsNavigating(true);
        setTargetRect(null);
        prevRectRef.current = null;
        setActiveTab(step.tab);
        setTimeout(calculatePosition, 1000);
      }
    } else {
      setTimeout(calculatePosition, 100);
    }

    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition);

    return () => {
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition);
    };
  }, [currentStepIndex, isActive, step, activeTab, setActiveTab, isIntroStep]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setTargetRect(null);
      prevRectRef.current = null;
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onFinish();
    }
  };

  const getBoxPositionClass = () => {
      if (!targetRect) return 'items-center justify-center';

      // Usa o alinhamento dinâmico
      const alignment = currentAlignment;

      switch (alignment) {
          // Ajustes nos paddings para mobile e desktop
          case 'top-left': return 'items-start justify-start pt-10 pl-4 md:pt-20 md:pl-10';
          case 'top-right': return 'items-start justify-end pt-10 pr-4 md:pt-20 md:pr-10';
          case 'bottom-left': return 'items-end justify-start pb-10 pl-4 md:pb-20 md:pl-10';
          case 'bottom-right': return 'items-end justify-end pb-10 pr-4 md:pb-20 md:pr-10';

          case 'top': return 'items-start justify-center pt-10 md:pt-20';
          case 'bottom': return 'items-end justify-center pb-10 md:pb-20';
          case 'left': return 'items-center justify-start pl-4 md:pl-10';
          case 'right': return 'items-center justify-end pr-4 md:pr-10';
          default: return 'items-center justify-center';
      }
  };

// ----------------------------------------------------------------------
// 4. VERIFICAÇÃO DE RENDERIZAÇÃO
// ----------------------------------------------------------------------

  if (!isActive || !step) return null;

  // Impede que o tour comece na aba errada
  if (step.tab && activeTab !== step.tab && !isIntroStep) {
      return null;
  }

  // VERIFICAÇÃO CRUCIAL PARA CICLOS:
  // Se o tour atual for 'cycle_visual' e o targetRect ainda não foi calculado (ou seja, o elemento não está no DOM),
  // e não estamos navegando (após o setActiveTab), o componente deve ser suprimido.
  const isCycleVisualButTargetMissing = (tourType === 'cycle_visual' && !targetRect && !isNavigating);

  if (isCycleVisualButTargetMissing) {
      // Se estivermos na página 'ciclos', mas o alvo interno não está renderizado (lista de ciclos), suprime o tour.
      // O 'targetRect' só será definido quando o elemento for encontrado na tela interna.
      return null;
  }


  // --- RENDERIZAÇÃO ESPECIAL: INTRODUÇÃO (HERO MODAL) ---
  if (isIntroStep) {
    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4 font-sans">
          {/* Backdrop com Blur forte */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />

          {/* Hero Card: Ajustando a largura máxima para mobile (max-w-sm) */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-xs sm:max-w-sm md:max-w-lg w-full overflow-hidden border border-white/20 flex flex-col"
          >
            {/* Header Decorativo */}
            <div className="h-24 bg-gradient-to-r from-red-600 to-orange-500 relative overflow-hidden">
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
               <div className="absolute -bottom-10 -right-10 text-white/10">
                  <Sparkles size={120} />
               </div>
            </div>

            {/* Conteúdo Central */}
            <div className="px-6 pb-6 pt-0 flex flex-col items-center text-center -mt-12 relative z-10 md:px-8 md:pb-8"> {/* Padding reduzido */}
               {/* Mascote no Círculo */}
               <div className="w-28 h-28 md:w-32 md:h-32 bg-white dark:bg-zinc-800 rounded-full p-1 shadow-xl mb-6 flex items-center justify-center border-4 border-white dark:border-zinc-700"> {/* Mascote menor em mobile */}
                  <img
                    src={mascotImage}
                    alt="Mascote"
                    className="w-20 h-auto md:w-24 drop-shadow-md"
                  />
               </div>

               <h2 className="text-xl md:text-3xl font-black text-zinc-800 dark:text-white mb-2 leading-tight"> {/* Tamanho do texto ajustado */}
                 {step.title}
               </h2>

               <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed mb-6 md:mb-8"> {/* Tamanho do texto ajustado */}
                 {step.content}
               </p>

               <button
                 onClick={handleNext}
                 className="w-full py-3 md:py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-base md:text-lg shadow-lg shadow-red-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 group"
               >
                 Iniciar o Guia
                 <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
               </button>

               <button
                 onClick={onClose}
                 className="mt-3 text-xs md:text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-medium transition-colors"
               >
                 Pular apresentação
               </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  // --- RENDERIZAÇÃO PADRÃO (PASSOS COM DESTAQUE) ---
  return (
    <div className="fixed inset-0 z-[99999] overflow-hidden font-sans pointer-events-auto">

        {/* BACKDROP */}
        <div
          className="absolute inset-0 bg-black/50 transition-colors duration-500 ease-in-out"
          style={targetRect ? {
            clipPath: `polygon(
              0% 0%, 0% 100%,
              ${targetRect.left}px 100%,
              ${targetRect.left}px ${targetRect.top}px,
              ${targetRect.left + targetRect.width}px ${targetRect.top}px,
              ${targetRect.left + targetRect.width}px ${targetRect.top + targetRect.height}px,
              ${targetRect.left}px ${targetRect.top + targetRect.height}px,
              ${targetRect.left}px 100%,
              100% 100%, 100% 0%
            )`
          } : {}}
        />

        {/* BORDA DE DESTAQUE */}
        {targetRect && (
          <div
            className="absolute border-2 border-dashed border-yellow-400 rounded-xl shadow-[0_0_30px_rgba(250,204,21,0.5)] pointer-events-none transition-all duration-300 ease-out"
            style={{
              top: targetRect.top,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
            }}
          >
             <div className="absolute -top-2 -left-2 w-4 h-4 border-t-4 border-l-4 border-yellow-400" />
             <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-4 border-r-4 border-yellow-400" />
          </div>
        )}

        {/* MASCOTE DINÂMICO */}
        <AnimatePresence mode="wait">
            {step?.hasMascot && !isIntroStep && (
                <motion.div
                    key="mascot"
                    initial={{ x: isMascotRight ? 100 : -100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: isMascotRight ? 100 : -100, opacity: 0 }}
                    // Restaurando o mascote para um tamanho decente, pois a caixa de diálogo será menor
                    className={`absolute bottom-0 z-[100000] pointer-events-none w-32 md:w-64 ${isMascotRight ? 'right-0 md:right-10' : 'left-0 md:left-10'}`}
                >
                    <img
                        src={mascotImage}
                        alt="Instrutor"
                        className={`w-full h-auto drop-shadow-2xl filter brightness-110 ${isMascotRight ? 'scale-x-[-1]' : ''}`}
                    />
                </motion.div>
            )}
        </AnimatePresence>

        {/* CAIXA DE TEXTO FLUTUANTE */}
        <div className={`absolute inset-0 pointer-events-none flex p-2 md:p-8 z-[100000] ${getBoxPositionClass()}`}>
            <motion.div
                key={actualTargetId} // Usa o ID ajustado como chave para resetar a animação quando o target muda
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                // NOVO TAMANHO: max-w-[180px] para mobile e max-w-sm para desktop
                className="bg-zinc-900 text-white p-0 rounded-2xl shadow-2xl max-w-[180px] sm:max-w-sm md:max-w-md w-full pointer-events-auto relative border border-zinc-700 overflow-hidden flex flex-col mb-20 md:mb-0" // mb-20 mantém espaço para o mascote
            >
                <div className="bg-gradient-to-r from-red-700 to-red-600 p-1.5 px-3 flex justify-between items-center md:p-3 md:px-5"> {/* Padding muito pequeno */}
                    <span className="font-black uppercase tracking-widest text-[0.6rem] md:text-xs flex items-center gap-1">
                        <MapPin size={10} className="md:w-auto" /> Guia {currentStepIndex + 1}/{steps.length}
                    </span>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        <X size={14} className="md:w-auto" />
                    </button>
                </div>

                <div className="p-3 md:p-6"> {/* Padding pequeno em mobile */}
                    <h2 className="text-xs md:text-xl font-black text-white mb-1 uppercase leading-tight"> {/* Título muito menor em mobile */}
                        {step.title}
                    </h2>
                    <p className="text-[0.65rem] md:text-sm text-zinc-300 mb-3 md:mb-6 leading-normal border-l-2 border-red-600 pl-2 bg-white/5 py-0.5 rounded-r-lg"> {/* Conteúdo muito menor em mobile */}
                        {step.content}
                    </p>
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={onClose}
                            className="px-2 py-0.5 text-[0.6rem] md:text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase"
                        >
                            Pular
                        </button>
                        <button
                            onClick={handleNext}
                            className="flex items-center gap-1 bg-white text-red-700 hover:bg-zinc-200 px-2 py-0.5 rounded-lg font-black uppercase tracking-tight shadow-lg transition-all transform hover:scale-105 active:scale-95 text-[0.65rem] md:text-xs"
                        >
                            {step.isLast ? 'Concluir' : 'Próximo'}
                            {step.isLast ? <CheckCircle2 size={12} /> : <ChevronRight size={12} />}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    </div>
  );
};

export default OnboardingTour;