import React, { useState, useEffect, useMemo } from 'react';
import { useCiclos } from '../../hooks/useCiclos';
import { db } from '../../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle2, Target, Clock,
  ArrowRight, ArrowLeft, Layers, Plus, Trash2,
  Grid, Type, Minus, BookOpen,
  Star, HelpCircle, FileText, Search, Library, Edit3
} from 'lucide-react';

// --- CONFIGURAÇÕES VISUAIS E UTILITÁRIOS ---

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

const getTooltipData = (currentRating) => {
    const data = [{ rating: 0, peso: 6, proficiencyLabel: 'Não Avaliado/Inicial' }, ...STAR_RATING_OPTIONS];
    return data.map(item => {
        const barWidth = (item.peso / 6) * 100;
        const barColor = item.peso >= 5 ? 'bg-red-600' : item.peso === 4 ? 'bg-amber-500' : item.peso === 3 ? 'bg-yellow-400' : item.peso === 2 ? 'bg-emerald-500' : 'bg-green-600';
        let allocationText;
        if (item.peso === 6) allocationText = '**MÁXIMA**'; else if (item.peso === 5) allocationText = '**MUITO ALTA**'; else if (item.peso === 4) allocationText = '**ALTA**'; else if (item.peso === 3) allocationText = '**BALANCEADA**'; else if (item.peso === 2) allocationText = '**BAIXA**'; else allocationText = '**MÍNIMA**';
        return { ...item, barWidth, barColor, allocationText, isActive: currentRating === item.rating };
    });
};

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

// --- COMPONENTE: MODAL DE SELEÇÃO DE EDITAL ---
const TemplateSelectionModal = ({ isOpen, onClose, onSelect, templates, loading }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-zinc-50 dark:bg-zinc-900 w-full max-w-5xl max-h-[85vh] rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden"
            >
                {/* Header do Modal */}
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900 z-10">
                    <div>
                        <h3 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                            <Library className="text-indigo-600" /> Catálogo de Editais
                        </h3>
                        <p className="text-sm text-zinc-500">Selecione um concurso base para iniciar sua missão.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X size={20} className="text-zinc-500" />
                    </button>
                </div>

                {/* Grid de Templates */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-zinc-100 dark:bg-black/20">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                            <span className="text-zinc-500 text-sm font-bold">Carregando editais...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {templates.map(template => (
                                <motion.button
                                    key={template.id}
                                    whileHover={{ scale: 1.02, y: -4 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => onSelect(template)}
                                    className="relative flex flex-col bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-all overflow-hidden group text-left h-full"
                                >
                                    {/* Área da Logo / Capa */}
                                    <div className="h-40 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-center p-6 border-b border-zinc-100 dark:border-zinc-700 relative overflow-hidden">
                                        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:16px_16px]"></div>

                                        {template.logoUrl ? (
                                            <img
                                                src={template.logoUrl}
                                                alt={template.instituicao}
                                                className="h-full w-full object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-500 z-10"
                                            />
                                        ) : (
                                            <FileText size={64} className="text-zinc-300 group-hover:text-indigo-200 transition-colors" />
                                        )}

                                        <div className="absolute top-3 right-3 bg-white/90 dark:bg-black/80 backdrop-blur text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-1 rounded-md uppercase border border-indigo-100 dark:border-indigo-900/50 shadow-sm z-20">
                                            {template.instituicao}
                                        </div>
                                    </div>

                                    {/* Conteúdo do Card */}
                                    <div className="p-5 flex flex-col flex-1">
                                        <h4 className="font-bold text-zinc-900 dark:text-white text-lg leading-tight mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                            {template.titulo}
                                        </h4>
                                        <p className="text-xs text-zinc-500 mb-4 line-clamp-2">{template.banca}</p>

                                        <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-700/50 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                                <Layers size={14} className="text-indigo-500" />
                                                <span>{template.disciplinas?.length || 0} Matérias</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">
                                                SELECIONAR
                                            </span>
                                        </div>
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

// --- COMPONENTE: GRADE HORÁRIA ---
const ScheduleGrid = ({ availability, setAvailability }) => {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const [isDragging, setIsDragging] = useState(false);
  const [dragAction, setDragAction] = useState(null);

  const toggleSlot = (dayIndex, hour, action = null) => {
    const key = `${dayIndex}-${hour}`;
    setAvailability(prev => {
        const newAvailability = { ...prev };
        const currentAction = action !== null ? action : !newAvailability[key];
        if (currentAction) newAvailability[key] = true; else delete newAvailability[key];
        return newAvailability;
    });
    return action !== null ? action : !availability[key];
  };
  const handleDragStart = (e, dayIndex, hour) => { e.preventDefault(); const initialAction = !availability[`${dayIndex}-${hour}`]; setDragAction(initialAction); setIsDragging(true); toggleSlot(dayIndex, hour, initialAction); };
  const handleDragEnter = (dayIndex, hour) => { if (isDragging && dragAction !== null) { toggleSlot(dayIndex, hour, dragAction); } };
  const handleDragEnd = () => { setIsDragging(false); setDragAction(null); };
  useEffect(() => { window.addEventListener('mouseup', handleDragEnd); window.addEventListener('touchend', handleDragEnd); return () => { window.removeEventListener('mouseup', handleDragEnd); window.removeEventListener('touchend', handleDragEnd); }; }, []);

  return (
    <div className="h-full flex flex-col" onMouseLeave={handleDragEnd}>
      <div className="grid grid-cols-8 gap-1 pr-2 mb-2 flex-shrink-0 bg-zinc-50 dark:bg-zinc-900/50 pt-2 pb-1 sticky top-0 z-10">
        <div className="text-[10px] font-black text-zinc-300 uppercase text-center pt-2">H</div>
        {days.map((d, i) => (<div key={i} className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase text-center">{d}</div>))}
      </div>
      <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 h-[300px]">
        <div className="space-y-1">
          {hours.map((h) => (
            <div key={h} className="grid grid-cols-8 gap-1 items-center">
              <div className="text-xs sm:text-sm font-bold text-zinc-400 text-center">{h.toString().padStart(2, '0')}h</div>
              {days.map((d, dayIndex) => {
                const isSelected = availability[`${dayIndex}-${h}`];
                return (<div key={`${dayIndex}-${h}`} onMouseDown={(e) => handleDragStart(e, dayIndex, h)} onMouseEnter={() => handleDragEnter(dayIndex, h)} onTouchStart={(e) => handleDragStart(e, dayIndex, h)} onTouchMove={(e) => { if (!isDragging) return; const touch = e.touches[0]; const element = document.elementFromPoint(touch.clientX, touch.clientY); if (element && element.dataset.slot) { const [dIndex, hVal] = element.dataset.slot.split('-').map(Number); handleDragEnter(dIndex, hVal); } }} onMouseUp={handleDragEnd} data-slot={`${dayIndex}-${h}`} className={`h-10 w-full rounded-md transition-all duration-100 border relative flex items-center justify-center group cursor-pointer ${isSelected ? 'bg-emerald-500 border-emerald-600 shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`} />);
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE: PRÉ-VISUALIZAÇÃO (RADAR) ---
const CyclePreview = ({ disciplinas, totalHours }) => {
  const [hoveredId, setHoveredId] = useState(null);
  const data = useMemo(() => {
    if (!disciplinas.length) return [];
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
           {data.length === 0 && (<circle cx="50" cy="50" r="42" stroke="#e4e4e7" strokeWidth="12" fill="none" className="dark:stroke-zinc-800" opacity="0.3" />)}
           {data.map((seg) => {
             const gap = 2; const visualAngle = seg.angle > gap ? seg.angle - gap : seg.angle; const bgPath = createArc(seg.startAngle, seg.startAngle + visualAngle, 42); const isHovered = hoveredId === seg.id;
             return (<motion.path key={seg.id} d={bgPath} initial={{ opacity: 0, pathLength: 0 }} animate={{ opacity: 1, pathLength: 1, stroke: isHovered ? '#dc2626' : seg.color, scale: isHovered ? 1.05 : 1 }} transition={{ duration: 0.3 }} fill="none" strokeWidth={isHovered ? 14 : 12} strokeLinecap="butt" onMouseEnter={() => setHoveredId(seg.id)} onMouseLeave={() => setHoveredId(null)} />);
           })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
             <AnimatePresence mode="wait">
                 {activeItem ? (<motion.div key="active" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex flex-col items-center text-center px-2"><span className="text-[10px] font-black text-red-600 uppercase mb-0.5 line-clamp-1 max-w-[90px]">{activeItem.nome}</span><span className="text-3xl font-black text-zinc-800 dark:text-white leading-none">{activeItem.hours.toFixed(1)}h</span></motion.div>) : (<motion.div key="default" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex flex-col items-center"><span className="text-4xl font-black text-zinc-300 dark:text-zinc-700 tracking-tighter leading-none">{disciplinas.length}</span><span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide">Disciplinas</span></motion.div>)}
             </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL DO WIZARD ---
function CicloCreateWizard({ onClose, user, onCicloAtivado }) {
  const [step, setStep] = useState(1);

  // STEP 1: IDENTIFICAÇÃO (Nome e Template)
  const [nomeCiclo, setNomeCiclo] = useState('');
  const [templates, setTemplates] = useState([]);

  // selectedTemplateId: 'manual' | templateId | null (para controle de fluxo)
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null); // Objeto completo

  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // STEP 2: CARGA HORÁRIA
  const [metodoCargaHoraria, setMetodoCargaHoraria] = useState('grade');
  const [cargaHorariaManual, setCargaHorariaManual] = useState(0);
  const [availabilityGrid, setAvailabilityGrid] = useState({});

  // STEP 3: DISCIPLINAS
  const [disciplinas, setDisciplinas] = useState([]);
  const [nomeNovaDisciplina, setNomeNovaDisciplina] = useState('');
  const [ratingNovaDisciplina, setRatingNovaDisciplina] = useState(1);

  const { criarCiclo, loading } = useCiclos(user);

  // Busca templates do Firestore ao iniciar
  useEffect(() => {
      const fetchTemplates = async () => {
          setLoadingTemplates(true);
          try {
              const querySnapshot = await getDocs(collection(db, "editais_templates"));
              const temps = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              setTemplates(temps);
          } catch (error) {
              console.error("Erro ao buscar editais", error);
          } finally {
              setLoadingTemplates(false);
          }
      };
      fetchTemplates();
  }, []);

  // Handler ao selecionar no Modal
  const handleSelectTemplate = (template) => {
      setSelectedTemplateId(template.id);
      setSelectedTemplate(template);
      setShowTemplateModal(false);

      if (template) {
          setNomeCiclo(template.titulo);
          const disciplinasFormatadas = template.disciplinas.map((d, index) => {
              const nivel = d.peso_sugerido || 1;
              return {
                  id: Date.now() + index,
                  nome: d.nome,
                  nivel: nivel,
                  peso: 6 - nivel,
                  assuntos: d.assuntos || [],
                  topicos: []
              };
          });
          setDisciplinas(disciplinasFormatadas);
      }
  };

  const handleSelectManual = () => {
      setSelectedTemplateId('manual');
      setSelectedTemplate(null);
      setNomeCiclo('');
      setDisciplinas([]);
  };

  const handleClearTemplate = () => {
      setSelectedTemplateId(null);
      setSelectedTemplate(null);
      setNomeCiclo('');
      setDisciplinas([]);
  };

  // Lógica Horas
  const horasTotais = useMemo(() => {
    const manualHours = parseFloat(cargaHorariaManual) || 0;
    if (metodoCargaHoraria === 'manual') return manualHours;
    return Object.keys(availabilityGrid).length;
  }, [metodoCargaHoraria, cargaHorariaManual, availabilityGrid]);

  // Lógica Disciplinas com Cálculo
  const disciplinasComHoras = useMemo(() => {
      const disciplinasComPeso = disciplinas.map(d => {
        const rating = d.nivel || d.rating || 0;
        const peso = 6 - rating;
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

    const nivelNumerico = ratingNovaDisciplina;
    const peso = 6 - nivelNumerico;

    setDisciplinas([
      ...disciplinas,
      {
        id: Date.now(),
        nome: nomeNovaDisciplina.trim(),
        peso: peso,
        nivel: nivelNumerico,
        assuntos: []
      },
    ]);
    setNomeNovaDisciplina('');
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
      cargaHorariaTotal: Number(horasTotais),
      templateId: selectedTemplateId === 'manual' ? null : selectedTemplateId,
      disciplinas: disciplinasComHoras.map(d => ({
          nome: d.nome,
          nivel: d.nivel,
          assuntos: d.assuntos,
          tempoAlocadoSemanalMinutos: Math.round(Number(d.horasCalculadas || 0) * 60)
      })),
    };

    const novoCicloId = await criarCiclo(cicloData);

    if (novoCicloId) {
        onClose();
        if (onCicloAtivado) {
             onCicloAtivado(novoCicloId);
        }
    }
  };

  const isWide = step === 2 || step === 3;
  const maxWidthClass = isWide ? 'max-w-5xl' : 'max-w-md';
  const tooltipData = useMemo(() => getTooltipData(ratingNovaDisciplina), [ratingNovaDisciplina]);

  // Seletor de Estrelas Interno
  const StarRatingSelector = () => (
    <div className="flex bg-zinc-50 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 space-x-0.5">
        {STAR_RATING_OPTIONS.map(item => (
            <button
                key={item.rating}
                type="button"
                onClick={() => {
                    if (ratingNovaDisciplina === 1 && item.rating === 1) {
                        setRatingNovaDisciplina(0);
                    } else {
                        setRatingNovaDisciplina(item.rating);
                    }
                }}
                className={`p-1.5 transition-colors duration-200 rounded-lg
                    ${ratingNovaDisciplina === item.rating
                        ? 'bg-red-600/10 dark:bg-red-700/20'
                        : 'hover:bg-zinc-200 dark:hover:bg-zinc-700'}`
                }
            >
                <Star size={16} fill="currentColor" strokeWidth={0} className={`${ratingNovaDisciplina >= item.rating ? 'text-yellow-500' : 'text-zinc-300 dark:text-zinc-600'}`} />
            </button>
        ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">

      {/* MODAL DE SELEÇÃO DE TEMPLATE */}
      <TemplateSelectionModal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          templates={templates}
          onSelect={handleSelectTemplate}
          loading={loadingTemplates}
      />

      <motion.div
        layout
        className={`bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full ${maxWidthClass} flex flex-col relative transition-all duration-500 max-h-[95vh]`}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        {/* --- ÍCONE GRANDE (WATERMARK) --- */}
        <div className="absolute right-0 top-0 p-4 opacity-[0.03] dark:opacity-[0.05] pointer-events-none z-0">
            {step === 1 && <FileText size={250} className="text-red-600" />}
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
                      {step === 1 ? '1. Escolha a Missão' : step === 2 ? '2. Carga Horaria' : '3. Disciplinas'}
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

            {/* STEP 1: SELEÇÃO DE MISSÃO (LÓGICA HÍBRIDA) */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                className="flex-1 flex flex-col items-center justify-center p-8 gap-6 min-h-[350px]"
              >

                {/* --- ESTADO A: ESCOLHA INICIAL (DOIS BOTÕES) --- */}
                {!selectedTemplateId ? (
                    <div className="flex flex-col h-full w-full max-w-2xl">
                        <div className="mb-6 text-center">
                            <h3 className="text-xl font-bold text-zinc-800 dark:text-white">Qual é o seu objetivo?</h3>
                            <p className="text-zinc-500 text-sm">Escolha um concurso base ou crie do zero.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Card Manual */}
                            <button
                                onClick={handleSelectManual}
                                className="flex flex-col items-center justify-center p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group h-48"
                            >
                                <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Plus size={32} className="text-zinc-500 dark:text-zinc-400 group-hover:text-red-500" />
                                </div>
                                <span className="font-black text-lg text-zinc-700 dark:text-zinc-300 group-hover:text-red-500">Ciclo Manual</span>
                                <span className="text-xs text-zinc-400 mt-1">Começar do zero</span>
                            </button>

                            {/* Card Edital */}
                            <button
                                onClick={() => setShowTemplateModal(true)}
                                className="flex flex-col items-center justify-center p-8 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 shadow-lg hover:shadow-xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-all group h-48 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Library size={100}/></div>

                                <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
                                    <Search size={32} className="text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <span className="font-black text-lg text-zinc-800 dark:text-white relative z-10">Selecionar Edital</span>
                                <span className="text-xs text-zinc-500 mt-1 relative z-10">Usar template pronto</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    // --- ESTADO B: CONFIRMAÇÃO DO NOME ---
                    <div className="w-full max-w-md text-center">
                       <button onClick={handleClearTemplate} className="mb-6 text-xs font-bold text-zinc-400 hover:text-zinc-600 flex items-center justify-center gap-1 mx-auto hover:underline"><ArrowLeft size={12}/> Trocar Seleção</button>

                       <h3 className="text-xl font-bold text-zinc-800 dark:text-white mb-2">Nome da Missão</h3>

                       {/* Se for Template, mostra um Badge */}
                       {selectedTemplateId !== 'manual' && selectedTemplate && (
                           <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                               <CheckCircle2 size={12} />
                               Baseado em: {selectedTemplate.titulo}
                           </div>
                       )}

                       <div className="relative group">
                           <input
                                type="text"
                                value={nomeCiclo}
                                onChange={(e) => setNomeCiclo(e.target.value)}
                                className="w-full p-4 text-xl text-center font-bold border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-zinc-300"
                                placeholder="Ex: CFO PMBA 2025"
                                autoFocus
                            />
                            <Edit3 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 opacity-50 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                       </div>

                       {selectedTemplateId !== 'manual' && (
                            <p className="mt-4 text-xs text-zinc-500">
                                O ciclo já virá preenchido com as <strong>{disciplinas.length} disciplinas</strong> do edital.
                            </p>
                       )}
                    </div>
                )}

              </motion.div>
            )}

            {/* STEP 2: HORAS (Igual) */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}}
                className="flex-1 flex flex-col p-4 sm:p-6"
              >
                <div className="flex justify-center mb-4 flex-shrink-0">
                    <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <button onClick={() => setMetodoCargaHoraria('grade')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${metodoCargaHoraria === 'grade' ? 'bg-white dark:bg-zinc-800 shadow text-emerald-600 dark:text-white' : 'text-zinc-400'}`}><Grid size={14}/> Interativo</button>
                        <button onClick={() => setMetodoCargaHoraria('manual')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${metodoCargaHoraria === 'manual' ? 'bg-white dark:bg-zinc-800 shadow text-red-600 dark:text-white' : 'text-zinc-400'}`}><Type size={14}/> Manual</button>
                    </div>
                </div>
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
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                        Nível de Proficiência
                                        {/* Tooltip */}
                                        <span className="group relative cursor-pointer text-zinc-400 hover:text-red-500">
                                            <HelpCircle size={14} />
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 p-3 bg-zinc-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                                                <p className="font-bold mb-1">Impacto na Alocação de Tempo:</p>
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
                                                                    {item.allocationText.replace(/\*\*/g, '')}
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
                                              <div className="flex items-center gap-2 mt-1">
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

                                                  {/* Indicador de Assuntos */}
                                                  {d.assuntos && d.assuntos.length > 0 && (
                                                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                          <Layers size={10} /> {d.assuntos.length} Tópicos
                                                      </span>
                                                  )}
                                              </div>
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
                        // Desabilita se não tiver selecionado (Manual ou Edital) e dado um nome
                        disabled={step === 1 ? (!selectedTemplateId || !nomeCiclo.trim()) : horasTotais <= 0}
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