import React, { useState, useEffect, useMemo, useRef } from 'react'; // Adicionado useRef
import { useCiclos } from '../../hooks/useCiclos';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle2, Target, Clock,
  ArrowRight, ArrowLeft, Layers, Plus, Trash2,
  Grid, Type, Minus, BookOpen,
  // Novos Imports
  Star, HelpCircle
} from 'lucide-react';

// --- DEFINIÇÃO DOS NÍVEIS E PESOS (5 Estrelas) ---
// O peso é inversamente proporcional ao rating (nível de proficiência).
const STAR_RATING_OPTIONS = Array.from({ length: 5 }, (_, i) => {
    const rating = i + 1;
    const peso = 6 - rating;
    let proficiencyLabel;

    if (rating === 1) proficiencyLabel = 'Baixíssima (MÁXIMA PRIORIDADE)';
    else if (rating === 2) proficiencyLabel = 'Baixa (Alta Prioridade)';
    else if (rating === 3) proficiencyLabel = 'Razoável (Prioridade Padrão)';
    else if (rating === 4) proficiencyLabel = 'Boa (Baixa Prioridade)';
    else proficiencyLabel = 'Alta (MÍNIMA PRIORIDADE)';

    return { rating, peso, proficiencyLabel };
});

// --- DADOS PARA O TOOLTIP (INCLUINDO O NÍVEL 0) ---
const getTooltipData = (currentRating) => {
    const data = [
        {
            rating: 0,
            peso: 6, // Maior peso
            proficiencyLabel: 'Não Avaliado/Inicial',
        },
        ...STAR_RATING_OPTIONS
    ];

    return data.map(item => {
        const barWidth = (item.peso / 6) * 100;
        // Cores de Alto Peso (Vermelho) para Baixo Peso (Verde)
        const barColor = item.peso >= 5 ? 'bg-red-600' :
                         item.peso === 4 ? 'bg-amber-500' :
                         item.peso === 3 ? 'bg-yellow-400' :
                         item.peso === 2 ? 'bg-emerald-500' :
                         'bg-green-600';

        let allocationText;
        if (item.peso === 6) allocationText = '**MÁXIMA**';
        else if (item.peso === 5) allocationText = '**MUITO ALTA**';
        else if (item.peso === 4) allocationText = '**ALTA**';
        else if (item.peso === 3) allocationText = '**BALANCEADA**';
        else if (item.peso === 2) allocationText = '**BAIXA**';
        else allocationText = '**MÍNIMA**';

        return {
            ...item,
            barWidth,
            barColor,
            allocationText,
            isActive: currentRating === item.rating
        };
    });
};


// --- UTILITÁRIOS VISUAIS ---
const toRad = (deg) => (deg * Math.PI) / 180;

const createArc = (start, end, r) => {
  if (Math.abs(end - start) >= 360) end = start + 359.99;
  const startRad = toRad(start - 90);
  const endRad = toRad(end - 90);
  const x1 = 50 + r * Math.cos(startRad);
  const y1 = 50 + r * Math.sin(startRad);
  const x2 = 50 + r * Math.cos(endRad);
  const y2 = 50 + r * Math.sin(endRad);
  const largeArcFlag = end - start <= 180 ? 0 : 1;
  return ["M", x1, y1, "A", r, r, 0, largeArcFlag, 1, x2, y2].join(" ");
};

// --- SUB-COMPONENTE: SELETOR DE DISPONIBILIDADE (GRADE) ---
const ScheduleGrid = ({ availability, setAvailability }) => {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // ESTADOS PARA O DRAG-SELECTION
  const [isDragging, setIsDragging] = useState(false);
  // O estado inicial da célula (selecionar ou deselecionar)
  const [dragAction, setDragAction] = useState(null);

  // Função centralizada para adicionar ou remover um slot
  const toggleSlot = (dayIndex, hour, action = null) => {
    const key = `${dayIndex}-${hour}`;
    setAvailability(prev => {
        const newAvailability = { ...prev };

        // Define a ação se não foi fornecida (primeiro clique)
        const currentAction = action !== null ? action : !newAvailability[key];

        if (currentAction) {
            newAvailability[key] = true;
        } else {
            delete newAvailability[key];
        }
        return newAvailability;
    });
    return action !== null ? action : !availability[key]; // Retorna a ação executada
  };

  // 1. Início do Arrastamento (Mouse Down)
  const handleDragStart = (e, dayIndex, hour) => {
    // Evita que o drag do navegador inicie
    e.preventDefault();

    // Determina a ação inicial (selecionar ou deselecionar)
    const initialAction = !availability[`${dayIndex}-${hour}`];
    setDragAction(initialAction);
    setIsDragging(true);

    // Executa a ação no slot clicado
    toggleSlot(dayIndex, hour, initialAction);
  };

  // 2. Durante o Arrastamento (Mouse Enter)
  const handleDragEnter = (dayIndex, hour) => {
    if (isDragging && dragAction !== null) {
        // Aplica a mesma ação (selecionar/deselecionar) a todos os slots que o mouse entra
        toggleSlot(dayIndex, hour, dragAction);
    }
  };

  // 3. Fim do Arrastamento (Mouse Up)
  const handleDragEnd = () => {
    setIsDragging(false);
    setDragAction(null);
  };

  // Adiciona listeners globais para garantir que o drag pare mesmo se o mouse sair da grade
  useEffect(() => {
    window.addEventListener('mouseup', handleDragEnd);
    // Adicionado o touch up para suporte mobile/tablet
    window.addEventListener('touchend', handleDragEnd);
    return () => {
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, []);


  return (
    <div className="h-full flex flex-col" onMouseLeave={handleDragEnd}> {/* Garante que pare se sair da área */}
      {/* Header dos Dias */}
      <div className="grid grid-cols-8 gap-1 pr-2 mb-2 flex-shrink-0 bg-zinc-50 dark:bg-zinc-900/50 pt-2 pb-1 sticky top-0 z-10">
        <div className="text-[10px] font-black text-zinc-300 uppercase text-center pt-2">H</div>
        {days.map((d, i) => (
          <div key={i} className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase text-center">{d}</div>
        ))}
      </div>

      {/* Corpo da Grade (Scrollável) */}
      <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 h-[300px]">
        <div className="space-y-1">
          {hours.map((h) => (
            <div key={h} className="grid grid-cols-8 gap-1 items-center">
              {/* Coluna Hora */}
              <div className="text-xs sm:text-sm font-bold text-zinc-400 text-center">
                {h.toString().padStart(2, '0')}h
              </div>

              {/* Células */}
              {days.map((d, dayIndex) => {
                const isSelected = availability[`${dayIndex}-${h}`];
                return (
                  <div // Mudado para div para suportar eventos de mouse/touch drag
                    key={`${dayIndex}-${h}`}
                    // Mouse/Touch events para drag-selection
                    onMouseDown={(e) => handleDragStart(e, dayIndex, h)}
                    onMouseEnter={() => handleDragEnter(dayIndex, h)}
                    onTouchStart={(e) => handleDragStart(e, dayIndex, h)}
                    onTouchMove={(e) => {
                        // Lógica de touch move para simular mouseEnter
                        if (!isDragging) return;
                        const touch = e.touches[0];
                        const element = document.elementFromPoint(touch.clientX, touch.clientY);

                        // Verifica se o elemento é uma célula de slot
                        if (element && element.dataset.slot) {
                            const [dIndex, hVal] = element.dataset.slot.split('-').map(Number);
                            handleDragEnter(dIndex, hVal);
                        }
                    }}
                    onMouseUp={handleDragEnd}
                    data-slot={`${dayIndex}-${h}`} // Data attribute para identificação no touchMove
                    className={`
                      h-10 w-full rounded-md transition-all duration-100 border relative flex items-center justify-center group cursor-pointer
                      ${isSelected
                        ? 'bg-emerald-500 border-emerald-600 shadow-sm'
                        : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                      }
                    `}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENTE: PREVIEW TÁTICO ---
const CyclePreview = ({ disciplinas, totalHours }) => {
  const [hoveredId, setHoveredId] = useState(null);

  const data = useMemo(() => {
    if (!disciplinas.length) return [];
    // Disciplinas agora vêm com o campo `peso` (calculado a partir do rating)
    const totalWeight = disciplinas.reduce((acc, d) => acc + d.peso, 0);
    let currentAngle = 0;
    return disciplinas.map((d, index) => {
      const angle = totalWeight > 0 ? (d.peso / totalWeight) * 360 : 0;
      const hours = totalWeight > 0 ? (d.peso / totalWeight) * totalHours : 0;
      const baseColor = index % 2 === 0 ? '#52525b' : '#71717a';
      const item = { ...d, hours, startAngle: currentAngle, angle, color: baseColor };
      currentAngle += angle;
      return item;
    });
  }, [disciplinas, totalHours]);

  const activeItem = useMemo(() => hoveredId ? data.find(d => d.id === hoveredId) : null, [hoveredId, data]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[250px]">
      <div className="w-56 h-56 relative group cursor-crosshair">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl overflow-visible">
           {data.length === 0 && (
             <circle cx="50" cy="50" r="42" stroke="#e4e4e7" strokeWidth="12" fill="none" className="dark:stroke-zinc-800" opacity="0.3" />
           )}
           {data.map((seg) => {
             const gap = 2;
             const visualAngle = seg.angle > gap ? seg.angle - gap : seg.angle;
             const bgPath = createArc(seg.startAngle, seg.startAngle + visualAngle, 42);
             const isHovered = hoveredId === seg.id;
             return (
               <motion.path
                 key={seg.id}
                 d={bgPath}
                 initial={{ opacity: 0, pathLength: 0 }}
                 animate={{ opacity: 1, pathLength: 1, stroke: isHovered ? '#dc2626' : seg.color, scale: isHovered ? 1.05 : 1 }}
                 transition={{ duration: 0.3 }}
                 fill="none"
                 strokeWidth={isHovered ? 14 : 12}
                 strokeLinecap="butt"
                 onMouseEnter={() => setHoveredId(seg.id)}
                 onMouseLeave={() => setHoveredId(null)}
               />
             );
           })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
             <AnimatePresence mode="wait">
                 {activeItem ? (
                     <motion.div key="active" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex flex-col items-center text-center px-2">
                        <span className="text-[10px] font-black text-red-600 uppercase mb-0.5 line-clamp-1 max-w-[90px]">{activeItem.nome}</span>
                        <span className="text-3xl font-black text-zinc-800 dark:text-white leading-none">{activeItem.hours.toFixed(1)}h</span>
                     </motion.div>
                 ) : (
                     <motion.div key="default" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex flex-col items-center">
                        <span className="text-4xl font-black text-zinc-300 dark:text-zinc-700 tracking-tighter leading-none">{disciplinas.length}</span>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide">Disciplinas</span>
                     </motion.div>
                 )}
             </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
function CicloCreateWizard({ onClose, user, onCicloAtivado }) {
  const [step, setStep] = useState(1);

  // STEP 1
  const [nomeCiclo, setNomeCiclo] = useState('');

  // STEP 2
  const [metodoCargaHoraria, setMetodoCargaHoraria] = useState('manual');
  const [cargaHorariaManual, setCargaHorariaManual] = useState(24);
  const [availabilityGrid, setAvailabilityGrid] = useState({});

  // STEP 3
  const [disciplinas, setDisciplinas] = useState([]);
  const [nomeNovaDisciplina, setNomeNovaDisciplina] = useState('');
  // Nível de Proficiência agora é um rating de 0 a 5 (numérico)
  const [ratingNovaDisciplina, setRatingNovaDisciplina] = useState(1);

  // Alterada para usar a função que retorna o ID do ciclo criado
  const { criarCiclo, loading } = useCiclos(user);

  // Lógica Horas
  const horasTotais = useMemo(() => {
    if (metodoCargaHoraria === 'manual') return parseFloat(cargaHorariaManual) || 0;
    return Object.keys(availabilityGrid).length;
  }, [metodoCargaHoraria, cargaHorariaManual, availabilityGrid]);

  // Lógica Disciplinas
  const disciplinasComHoras = useMemo(() => {
      // Re-calcula o peso a partir do rating para o Preview, garantindo que o peso esteja sempre atualizado
      const disciplinasComPeso = disciplinas.map(d => {
        // O rating (d.nivel) pode ser 0. Se for 0, o peso deve ser 6.
        const rating = d.nivel || d.rating || 0;
        const peso = 6 - rating;

        // Garante que o nível salvo é o rating numérico
        return { ...d, nivel: rating, peso: peso };
      });

      const totalWeight = disciplinasComPeso.reduce((acc, d) => acc + d.peso, 0);
      return disciplinasComPeso.map(d => ({
          ...d,
          horasCalculadas: totalWeight > 0 ? (d.peso / totalWeight) * horasTotais : 0
      }));
  }, [disciplinas, horasTotais]);

  const handleAddDisciplina = (e) => {
    e.preventDefault();
    if (!nomeNovaDisciplina.trim()) return;

    // Calcula o peso. Se nivelNumerico=0, peso=6 (prioridade máxima)
    const nivelNumerico = ratingNovaDisciplina;
    const peso = 6 - nivelNumerico;

    setDisciplinas([
      ...disciplinas,
      // Passa o nível (o rating numérico) e o peso calculado.
      {
        id: Date.now(),
        nome: nomeNovaDisciplina.trim(),
        peso: peso,
        nivel: nivelNumerico, // O campo 'nivel' agora armazena o rating numérico (0 a 5)
        topicos: []
      },
    ]);
    setNomeNovaDisciplina('');
    // Reseta o rating para o padrão (1 estrela) após adicionar
    setRatingNovaDisciplina(1);
  };

  const handleRemoveDisciplina = (id) => setDisciplinas(disciplinas.filter(d => d.id !== id));

  const handleFinalSubmit = async () => {
    if (horasTotais <= 0 || disciplinas.length === 0) {
        alert("Verifique a carga horária e se adicionou disciplinas.");
        return;
    }
    const cicloData = {
      nome: nomeCiclo,
      cargaHorariaTotal: horasTotais,
      // A lista de disciplinasComHoras já tem o campo `nivel` preenchido com o rating numérico
      disciplinas: disciplinasComHoras.map(d => ({ ...d, tempoAlocadoSemanalMinutos: d.horasCalculadas * 60 })),
    };

    const novoCicloId = await criarCiclo(cicloData);

    if (novoCicloId) {
        // 1. Fechar o modal
        onClose();

        // 2. Notificar o Dashboard para navegar para a visualização do ciclo
        if (onCicloAtivado) {
             onCicloAtivado(novoCicloId);
        }
    }
  };

  const isWide = step === 2 || step === 3;
  const maxWidthClass = isWide ? 'max-w-5xl' : 'max-w-md';

  // Componente de Estrelas Reativo (usado dentro do formulário)
  const StarRatingSelector = () => (
    // Ajuste de layout: Removido espaçamento desnecessário e flex-1 dos botões
    <div className="flex bg-zinc-50 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 space-x-0.5">
        {STAR_RATING_OPTIONS.map(item => (
            <button
                key={item.rating}
                type="button"
                onClick={() => {
                    // LÓGICA DE DESSELEÇÃO: Se o rating atual for 1 E o usuário clicar na estrela 1, o rating zera (nível 0).
                    if (ratingNovaDisciplina === 1 && item.rating === 1) {
                        setRatingNovaDisciplina(0);
                    } else {
                        // Senão, define o rating normalmente.
                        setRatingNovaDisciplina(item.rating);
                    }
                }}
                // Botão compacto, sem flex-1
                className={`p-1.5 transition-colors duration-200 rounded-lg
                    ${ratingNovaDisciplina === item.rating
                        ? 'bg-red-600/10 dark:bg-red-700/20'
                        : 'hover:bg-zinc-200 dark:hover:bg-zinc-700'}`
                }
            >
                <Star
                    // Tamanho reduzido para 16px
                    size={16}
                    fill="currentColor"
                    strokeWidth={0}
                    className={`
                      ${ratingNovaDisciplina >= item.rating
                          ? 'text-yellow-500' // Estrela preenchida (amarela)
                          : 'text-zinc-300 dark:text-zinc-600' // Estrela vazia
                      }
                    `}
                />
            </button>
        ))}
    </div>
  );

  // GERAÇÃO DOS DADOS DO TOOLTIP
  const tooltipData = useMemo(() => getTooltipData(ratingNovaDisciplina), [ratingNovaDisciplina]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">

      <motion.div
        layout
        className={`bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full ${maxWidthClass} flex flex-col relative transition-all duration-500 max-h-[95vh]`}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        {/* --- ÍCONE GRANDE (WATERMARK) --- */}
        <div className="absolute right-0 top-0 p-4 opacity-[0.03] dark:opacity-[0.05] pointer-events-none z-0">
            {step === 1 && <Target size={250} className="text-red-600" />}
            {step === 2 && <Clock size={250} className="text-red-600" />}
            {step === 3 && <Layers size={250} className="text-red-600" />}
        </div>

        {/* --- HEADER --- */}
        <div className="flex-shrink-0 flex justify-between items-center p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur rounded-t-3xl z-20">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 text-white rounded-lg flex items-center justify-center shadow-lg shadow-red-600/20">
                    {step === 1 ? <Target size={20}/> : step === 2 ? <Clock size={20}/> : <Layers size={20}/>}
                </div>
                <div>
                    <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase leading-none">
                      Novo Ciclo
                    </h2>
                    <p className="text-[10px] text-zinc-500 font-bold mt-0.5 uppercase tracking-wide">
                      {step === 1 ? '1. Identificação' : step === 2 ? '2. Carga Horaria' : '3. Disciplinas'}
                    </p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all">
              <X size={20} />
            </button>
        </div>

        {/* --- BODY --- */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 flex flex-col">
          <AnimatePresence mode="wait">

            {/* STEP 1: NOME */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                className="flex-1 flex flex-col items-center justify-center p-8 gap-6 min-h-[300px]"
              >
                <div className="w-full text-center">
                   <h3 className="text-xl font-bold text-zinc-800 dark:text-white mb-2">Nome do Ciclo</h3>
                   <input
                        type="text"
                        value={nomeCiclo}
                        onChange={(e) => setNomeCiclo(e.target.value)}
                        className="w-full p-4 text-xl text-center font-bold border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-zinc-300"
                        placeholder="Ex: CFO PMBA 2025"
                        autoFocus
                    />
                </div>
              </motion.div>
            )}

            {/* STEP 2: HORAS */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}}
                className="flex-1 flex flex-col p-4 sm:p-6"
              >
                {/* Tabs */}
                <div className="flex justify-center mb-4 flex-shrink-0">
                    <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <button onClick={() => setMetodoCargaHoraria('manual')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${metodoCargaHoraria === 'manual' ? 'bg-white dark:bg-zinc-800 shadow text-red-600 dark:text-white' : 'text-zinc-400'}`}><Type size={14}/> Manual</button>
                        <button onClick={() => setMetodoCargaHoraria('grade')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${metodoCargaHoraria === 'grade' ? 'bg-white dark:bg-zinc-800 shadow text-emerald-600 dark:text-white' : 'text-zinc-400'}`}><Grid size={14}/> Interativo</button>
                    </div>
                </div>

                {/* Conteúdo */}
                <div className="flex-1 flex flex-col">
                    {metodoCargaHoraria === 'manual' ? (
                         <div className="flex-1 flex flex-col items-center justify-center gap-8 min-h-[300px]">
                             <div className="flex items-center gap-4 sm:gap-6">
                                <button onClick={() => setCargaHorariaManual(p => Math.max(0, Number(p)-1))} className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 hover:border-red-500 text-zinc-400 hover:text-red-500 transition-all flex items-center justify-center shadow-sm active:scale-95"><Minus size={24}/></button>
                                <div className="w-24 sm:w-40 text-center">
                                    <input type="number" value={cargaHorariaManual} onChange={(e) => setCargaHorariaManual(e.target.value)} className="w-full text-center text-5xl sm:text-6xl font-black bg-transparent border-none focus:ring-0 outline-none text-zinc-800 dark:text-white [&::-webkit-inner-spin-button]:appearance-none" />
                                </div>
                                <button onClick={() => setCargaHorariaManual(p => Number(p)+1)} className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 hover:border-red-500 text-zinc-400 hover:text-red-500 transition-all flex items-center justify-center shadow-sm active:scale-95"><Plus size={24}/></button>
                            </div>
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Horas Semanais</span>
                         </div>
                    ) : (
                         <div className="flex-1 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 bg-zinc-50 dark:bg-zinc-900/30">
                             <ScheduleGrid availability={availabilityGrid} setAvailability={setAvailabilityGrid} />
                         </div>
                    )}
                </div>
              </motion.div>
            )}

            {/* STEP 3: DISCIPLINAS */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}}
                className="flex-1 flex flex-col lg:flex-row p-4 gap-6"
              >
                  {/* Esquerda: Form + Lista */}
                  <div className="flex-1 flex flex-col gap-4">
                      {/* Form */}
                      <div className="bg-white dark:bg-zinc-900 p-3 sm:p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex-shrink-0">
                          <form onSubmit={handleAddDisciplina} className="flex flex-col gap-3">
                             <input
                                type="text"
                                value={nomeNovaDisciplina}
                                onChange={(e) => setNomeNovaDisciplina(e.target.value)}
                                placeholder="Nome da Disciplina..."
                                className="w-full p-3 font-bold rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                             />
                             {/* SELETOR DE RATING E BOTÃO DE ADICIONAR */}
                             <div className="flex items-center gap-3">
                                <div className="flex flex-col gap-1"> {/* CORREÇÃO: Removeu 'flex-1' para fixar o espaçamento */}
                                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                        Nível de Proficiência (Estrelas)
                                        {/* Tooltip */}
                                        <span className="group relative cursor-pointer text-zinc-400 hover:text-red-500">
                                            <HelpCircle size={14} />
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 p-3 bg-zinc-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                                                <p className="font-bold mb-1">Impacto na Alocação de Tempo (Baseado no Peso):</p>
                                                {/* Tooltip com Visualização da Alocação */}
                                                <ul className="list-none space-y-2 p-1">
                                                    {tooltipData.map(item => (
                                                        <li key={item.rating} className={`p-1 rounded transition-colors ${item.isActive ? 'bg-zinc-700 text-yellow-300' : ''}`}>
                                                            <div className="flex justify-between items-center mb-1">
                                                                <div className="font-bold flex items-center gap-1">
                                                                    {item.rating} Estrela{item.rating !== 1 && 's'}
                                                                    <span className="text-[10px] font-normal text-zinc-400"> (Peso {item.peso})</span>
                                                                </div>
                                                                <div className={`text-xs font-semibold ${item.peso >= 5 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                                    Alocação: {item.allocationText.replace(/\*\*/g, '')}
                                                                </div>
                                                            </div>
                                                            {/* Visual Bar Indicator */}
                                                            <div className="w-full h-2 rounded-full bg-zinc-600 overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${item.barWidth}%` }}
                                                                    transition={{ duration: 0.5 }}
                                                                    className={`h-full ${item.barColor}`}
                                                                />
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                                <div className="absolute top-[-5px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-b-8 border-b-zinc-800"></div>
                                            </div>
                                        </span>
                                    </label>
                                    <StarRatingSelector />
                                </div>
                                <button
                                    type="submit"
                                    className="w-12 h-12 mt-auto bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 flex items-center justify-center shrink-0"
                                >
                                    <Plus size={20}/>
                                </button>
                            </div>
                          </form>
                      </div>

                      {/* Lista */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-2 max-h-[50vh] lg:max-h-full">
                          {disciplinas.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center opacity-40 text-zinc-500">
                                  <BookOpen size={32} className="mb-2"/>
                                  <span className="text-xs font-bold uppercase">Lista Vazia</span>
                              </div>
                          ) : (
                              <div className="space-y-2 pb-2">
                                  {disciplinasComHoras.map(d => (
                                      <motion.div layout key={d.id} initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-center shadow-sm">
                                          <div>
                                              <div className="font-bold text-sm text-zinc-800 dark:text-white line-clamp-1">{d.nome}</div>
                                              <span className="text-[10px] font-bold text-zinc-400 uppercase bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                {/* Exibe as estrelas do rating */}
                                                {(d.nivel > 0) ?
                                                    Array.from({ length: d.nivel }).map((_, i) => (
                                                        <Star key={i} size={10} fill="#facc15" strokeWidth={0} />
                                                    ))
                                                    : <span className='text-zinc-500 dark:text-zinc-400'>Não Avaliado</span>
                                                }
                                                <span className='ml-1 text-zinc-500 dark:text-zinc-400'>| Peso {d.peso}</span>
                                              </span>
                                          </div>
                                          <div className="flex items-center gap-3">
                                              <span className="font-black text-zinc-800 dark:text-white">{d.horasCalculadas.toFixed(1)}h</span>
                                              <button onClick={() => handleRemoveDisciplina(d.id)} className="text-zinc-300 hover:text-red-500"><Trash2 size={16}/></button>
                                          </div>
                                      </motion.div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Direita: Radar */}
                  <div className="w-full lg:w-1/3 flex flex-col justify-start">
                      <div className="bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800">
                         <CyclePreview disciplinas={disciplinas} totalHours={horasTotais} />
                      </div>
                  </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* --- FOOTER: NAVEGAÇÃO + INFO TOTAL --- */}
        <div className="flex-shrink-0 p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-b-3xl z-20">
             <div className="flex justify-between items-center">
                 {/* Botão Voltar */}
                 {step > 1 ? (
                     <button onClick={() => setStep(s => s - 1)} className="px-4 py-3 rounded-xl text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                         <ArrowLeft size={20}/>
                     </button>
                 ) : (
                     <button onClick={onClose} className="px-4 py-3 text-sm font-bold text-zinc-400">Cancelar</button>
                 )}

                 {/* Display Central de Horas (Visível no Passo 2 e 3) */}
                 {step >= 2 && (
                     <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total</span>
                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-500 leading-none">
                            {horasTotais}h
                        </span>
                     </div>
                 )}

                 {/* Botão Próximo/Finalizar */}
                 {step < 3 ? (
                     <button
                        onClick={() => setStep(s => s + 1)}
                        disabled={step === 1 ? !nomeCiclo.trim() : horasTotais <= 0}
                        className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:translate-x-1 transition-all flex items-center gap-2"
                     >
                        Próximo <ArrowRight size={16}/>
                     </button>
                 ) : (
                     <button
                        onClick={handleFinalSubmit}
                        disabled={disciplinas.length === 0 || loading}
                        className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                     >
                        {loading ? "Criando..." : <><CheckCircle2 size={18}/> Finalizar</>}
                     </button>
                 )}
             </div>
        </div>

      </motion.div>
    </div>
  );
}

export default CicloCreateWizard;