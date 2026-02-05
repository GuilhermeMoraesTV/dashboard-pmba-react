import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useCiclos } from '../../hooks/useCiclos';
import { db } from '../../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle2, Target, Clock,
  ArrowRight, ArrowLeft, Layers, Plus, Trash2,
  Grid, Type, Minus, BookOpen,
  Library, Edit2, ChevronDown, ChevronUp, GripVertical, Search,
  FileText, Star, Shield, Flame, Lock, Siren, BadgeAlert, Briefcase, Globe
} from 'lucide-react';

// ============================================================================
// 1. UTILITÁRIOS E CONSTANTES VISUAIS
// ============================================================================

const PESO_CONFIG = {
    1: { label: 'Mínima', description: 'Apenas Revisão', color: 'text-emerald-500', fill: 'fill-emerald-500', bg: 'bg-emerald-50' },
    2: { label: 'Baixa', description: 'Estudo Leve', color: 'text-green-500', fill: 'fill-green-500', bg: 'bg-green-50' },
    3: { label: 'Média', description: 'Estudo Regular', color: 'text-yellow-500', fill: 'fill-yellow-500', bg: 'bg-yellow-50' },
    4: { label: 'Alta', description: 'Estudo Focado', color: 'text-orange-500', fill: 'fill-orange-500', bg: 'bg-orange-50' },
    5: { label: 'Máxima', description: 'Prioridade Total', color: 'text-red-600', fill: 'fill-red-600', bg: 'bg-red-50' },
};

const formatHoursToTime = (decimalHours) => {
  if (!decimalHours || isNaN(decimalHours)) return '0h';
  const totalMinutes = Math.round(decimalHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
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

// ============================================================================
// 2. MODAL DE SELEÇÃO DE EDITAL (ORDEM ATUALIZADA)
// ============================================================================

const CATEGORIES_CONFIG = {
    pm: { label: 'Polícia Militar', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    pc: { label: 'Polícia Civil', icon: BadgeAlert, color: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' },
    federal: { label: 'Carreiras Federais', icon: Globe, color: 'text-blue-700', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    pp: { label: 'Polícia Penal', icon: Lock, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
    cbm: { label: 'Corpo de Bombeiros', icon: Flame, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
    gcm: { label: 'Guarda Municipal', icon: Siren, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    outros: { label: 'Outros Concursos', icon: Briefcase, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' }
};

const TemplateSection = ({ categoryKey, items, selectedId, onHighlight, onConfirm }) => {
    const config = CATEGORIES_CONFIG[categoryKey];
    const Icon = config.icon;

    const carouselRef = useRef();
    const [width, setWidth] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if(carouselRef.current) {
            setWidth(carouselRef.current.scrollWidth - carouselRef.current.offsetWidth);
        }
    }, [items]);

    return (
        <div className="mb-2 last:mb-0">
            <div className="flex items-center gap-3 mb-1 px-1 sticky left-0">
                <div className={`p-1.5 rounded-lg ${config.bg} ${config.color}`}>
                    <Icon size={18} />
                </div>
                <h4 className="text-lg font-black text-zinc-800 dark:text-white uppercase tracking-tight">
                    {config.label}
                </h4>
                <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                    {items.length}
                </span>
            </div>

            <motion.div
                ref={carouselRef}
                className="cursor-grab active:cursor-grabbing overflow-hidden -mx-4 px-4 py-2"
                whileTap={{ cursor: "grabbing" }}
            >
                <motion.div
                    drag="x"
                    dragConstraints={{ right: 0, left: -width }}
                    dragElastic={0.1}
                    dragMomentum={true}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={() => setTimeout(() => setIsDragging(false), 150)}
                    className="flex gap-4 w-max"
                >
                    {items.map(template => {
                        const isSelected = selectedId === template.id;

                        return (
                            <motion.div
                                key={template.id}
                                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                                onTap={() => !isDragging && onHighlight(template)}
                                className={`
                                    relative flex flex-col rounded-2xl overflow-hidden group text-left transition-all
                                    min-w-[160px] w-[160px] h-[240px]
                                    sm:min-w-[240px] sm:w-[240px] sm:h-[300px]
                                    flex-shrink-0 select-none cursor-pointer
                                    ${isSelected
                                        ? 'bg-red-50/50 dark:bg-red-900/10 border-2 border-red-500 shadow-xl shadow-red-500/10 ring-2 ring-red-500/20'
                                        : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-red-200 dark:hover:border-red-900/30'
                                    }
                                `}
                            >
                                <div className={`
                                    h-28 sm:h-40 flex items-center justify-center p-4 relative overflow-hidden transition-colors
                                    ${isSelected ? 'bg-red-100/50 dark:bg-red-900/20' : 'bg-zinc-50 dark:bg-zinc-800/30 group-hover:bg-red-50 dark:group-hover:bg-red-900/5'}
                                `}>
                                    {template.logoUrl ? (
                                        <img
                                            src={template.logoUrl}
                                            alt={template.instituicao}
                                            draggable="false"
                                            className="h-full w-full object-contain z-10 drop-shadow-md transition-transform duration-500 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white dark:bg-zinc-700 rounded-full flex items-center justify-center shadow-sm z-10">
                                            <Library size={28} className="text-zinc-400 sm:w-8 sm:h-8" />
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 z-20">
                                        <span className="text-[8px] sm:text-[9px] font-black uppercase bg-white/90 dark:bg-black/80 backdrop-blur px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-500">
                                            {template.instituicao || 'Geral'}
                                        </span>
                                    </div>
                                    {isSelected && (
                                        <div className="absolute top-2 left-2 z-20 bg-red-600 text-white p-1 rounded-full shadow-lg animate-fade-in">
                                            <CheckCircle2 size={14} strokeWidth={3} />
                                        </div>
                                    )}
                                </div>

                                <div className="p-3 flex flex-col flex-1 justify-between">
                                    <div>
                                        <h4 className={`font-bold text-xs sm:text-base leading-tight mb-1 line-clamp-2 transition-colors ${isSelected ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white group-hover:text-red-600'}`}>
                                            {template.titulo}
                                        </h4>
                                        <p className="text-[9px] sm:text-[10px] text-zinc-500">
                                            Banca: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{template.banca || 'N/A'}</span>
                                        </p>
                                    </div>

                                    <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase">
                                            <Layers size={10} className="text-red-500 sm:w-3 sm:h-3" />
                                            <span>{template.disciplinas?.length || 0} Matérias</span>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!isDragging) {
                                                    if (isSelected) {
                                                        onConfirm(template);
                                                    } else {
                                                        onHighlight(template);
                                                    }
                                                }
                                            }}
                                            className={`
                                                text-[10px] sm:text-[11px] font-bold px-3 py-2 sm:py-1.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1 w-full sm:w-auto
                                                ${isSelected
                                                    ? 'bg-red-600 text-white hover:bg-red-700 hover:shadow-red-500/30'
                                                    : 'bg-zinc-900 dark:bg-zinc-700 text-white group-hover:bg-red-600'
                                                }
                                            `}
                                        >
                                            {isSelected ? (
                                                <>Confirmar <ArrowRight size={12} /></>
                                            ) : (
                                                'Selecionar'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>
            </motion.div>
        </div>
    );
};

const TemplateSelectionModal = ({ isOpen, onClose, onSelect, templates, loading }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const [localSelectedId, setLocalSelectedId] = useState(null);

    const categorizedTemplates = useMemo(() => {
        const groups = { pm: [], pc: [], federal: [], pp: [], cbm: [], gcm: [], outros: [] };

        if (!templates) return groups;

        templates.forEach(t => {
            const textToCheck = (t.titulo + ' ' + (t.instituicao || '') + ' ' + (t.tipo || '')).toLowerCase();

            if (textToCheck.includes('federal') || textToCheck.includes('prf') || textToCheck.includes('pf') || textToCheck.includes('depen')) groups.federal.push(t);
            else if (textToCheck.includes('pm') || textToCheck.includes('policia militar') || textToCheck.includes('polícia militar')) groups.pm.push(t);
            else if (textToCheck.includes('pc') || textToCheck.includes('policia civil') || textToCheck.includes('polícia civil')) groups.pc.push(t);
            else if (textToCheck.includes('pp') || textToCheck.includes('policia penal') || textToCheck.includes('polícia penal') || textToCheck.includes('penal')) groups.pp.push(t);
            else if (textToCheck.includes('cbm') || textToCheck.includes('bombeiro')) groups.cbm.push(t);
            else if (textToCheck.includes('gcm') || textToCheck.includes('guarda') || textToCheck.includes('cgm')) groups.gcm.push(t);
            else groups.outros.push(t);
        });
        return groups;
    }, [templates]);

    const handleHighlight = (template) => {
        setLocalSelectedId(prev => prev === template.id ? null : template.id);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-zinc-50 dark:bg-zinc-950 w-full max-w-7xl h-[85vh] rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden relative"
            >
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900 z-10 shrink-0">
                    <div>
                        <h3 className="text-lg sm:text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-2 tracking-tight">
                            <Library className="text-red-600 w-5 h-5 sm:w-6 sm:h-6" /> Catálogo
                        </h3>
                        <p className="text-xs text-zinc-500 font-medium">Selecione o concurso para importar.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-red-500">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-8 custom-scrollbar bg-zinc-50/50 dark:bg-black/20">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600"></div>
                            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Carregando catálogo...</span>
                        </div>
                    ) : (
                        <div className="space-y-6 pb-10">
                            {Object.keys(categorizedTemplates).map(key => (
                                categorizedTemplates[key].length > 0 && (
                                    <TemplateSection
                                        key={key}
                                        categoryKey={key}
                                        items={categorizedTemplates[key]}
                                        selectedId={localSelectedId}
                                        onHighlight={handleHighlight}
                                        onConfirm={onSelect}
                                    />
                                )
                            ))}

                            {Object.values(categorizedTemplates).every(arr => arr.length === 0) && (
                                <div className="text-center py-20 text-zinc-400 text-sm">Nenhum edital encontrado.</div>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

// ============================================================================
// 3. GRADE HORÁRIA
// ============================================================================
const ScheduleGrid = ({ availability, setAvailability }) => {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const isTouchInteraction = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null);

  const updateSlot = (dayIndex, hour, forceState = null) => {
    const key = `${dayIndex}-${hour}`;
    setAvailability(prev => {
        const newState = { ...prev };
        const currentState = !!newState[key];
        const nextState = forceState !== null ? forceState : !currentState;

        if (nextState) newState[key] = true;
        else delete newState[key];

        return newState;
    });
  };

  const handleMouseDown = (dayIndex, hour) => {
    if (isTouchInteraction.current) return;
    const key = `${dayIndex}-${hour}`;
    const currentVal = !!availability[key];
    const newMode = !currentVal;
    setDragMode(newMode);
    setIsDragging(true);
    updateSlot(dayIndex, hour, newMode);
  };

  const handleMouseEnter = (dayIndex, hour) => {
    if (isDragging && dragMode !== null) {
        updateSlot(dayIndex, hour, dragMode);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragMode(null);
  };

  const handleTouchStart = (e, dayIndex, hour) => {
    isTouchInteraction.current = true;
    setTimeout(() => isTouchInteraction.current = false, 1000);
    const key = `${dayIndex}-${hour}`;
    const currentVal = !!availability[key];
    const newMode = !currentVal;
    setDragMode(newMode);
    setIsDragging(true);
    updateSlot(dayIndex, hour, newMode);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (target && target.dataset.day && target.dataset.hour) {
        const day = parseInt(target.dataset.day);
        const h = parseInt(target.dataset.hour);
        updateSlot(day, h, dragMode);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setDragMode(null);
  };

  useEffect(() => {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <div className="h-full flex flex-col select-none">
      <div className="grid grid-cols-8 gap-1 pr-2 mb-2 flex-shrink-0 bg-white dark:bg-zinc-950 pt-2 pb-2 sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800">
        <div className="text-[10px] font-black text-zinc-300 uppercase text-center pt-2">H</div>
        {days.map((d, i) => (<div key={i} className="text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase text-center">{d}</div>))}
      </div>

      <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 max-h-[300px]">
        <div className="space-y-1 pb-10">
          {hours.map((h) => (
            <div key={h} className="grid grid-cols-8 gap-1 items-center">
              <div className="text-[10px] sm:text-xs font-bold text-zinc-400 text-center">{h.toString().padStart(2, '0')}:00</div>
              {days.map((d, dayIndex) => {
                const isSelected = availability[`${dayIndex}-${h}`];
                return (
                    <div
                        key={`${dayIndex}-${h}`}
                        data-day={dayIndex}
                        data-hour={h}
                        onMouseDown={() => handleMouseDown(dayIndex, h)}
                        onMouseEnter={() => handleMouseEnter(dayIndex, h)}
                        onTouchStart={(e) => handleTouchStart(e, dayIndex, h)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        className={`h-8 sm:h-9 w-full rounded transition-all duration-100 border flex items-center justify-center cursor-pointer touch-none
                            ${isSelected
                                ? 'bg-emerald-500 border-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            }`}
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

// ============================================================================
// 4. RADAR PREVIEW & EDITOR DE DISCIPLINA
// ============================================================================

const CyclePreview = ({ disciplinas, totalHours }) => {
  const [hoveredId, setHoveredId] = useState(null);

  const data = useMemo(() => {
    if (!disciplinas.length) return [];
    const totalWeight = disciplinas.reduce((acc, d) => acc + (d.peso || 1), 0);
    let currentAngle = 0;
    return disciplinas.map((d, index) => {
      const p = d.peso || 1;
      const angle = totalWeight > 0 ? (p / totalWeight) * 360 : 0;
      const hours = totalWeight > 0 ? (p / totalWeight) * totalHours : 0;
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
             const gap = 2; const visualAngle = seg.angle > gap ? seg.angle - gap : seg.angle;
             const bgPath = createArc(seg.startAngle, seg.startAngle + visualAngle, 42);
             const isHovered = hoveredId === seg.id;
             return (<motion.path key={seg.id} d={bgPath} initial={{ opacity: 0, pathLength: 0 }} animate={{ opacity: 1, pathLength: 1, stroke: isHovered ? '#dc2626' : seg.color, scale: isHovered ? 1.05 : 1 }} transition={{ duration: 0.3 }} fill="none" strokeWidth={isHovered ? 14 : 12} strokeLinecap="butt" onMouseEnter={() => setHoveredId(seg.id)} onMouseLeave={() => setHoveredId(null)} />);
           })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
             <AnimatePresence mode="wait">
                 {activeItem ? (
                    <motion.div key="active" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex flex-col items-center text-center px-2">
                        <span className="text-[10px] font-black text-red-600 uppercase mb-0.5 line-clamp-1 max-w-[90px]">{activeItem.nome}</span>
                        <span className="text-3xl font-black text-zinc-800 dark:text-white leading-none">{formatHoursToTime(activeItem.hours)}</span>
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

const DisciplineEditorItem = ({ disciplina, onUpdate, onRemove }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [topicInput, setTopicInput] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState(disciplina.nome);
    const inputRef = useRef(null);

    const currentWeight = disciplina.peso || 3;
    const configPeso = PESO_CONFIG[currentWeight] || PESO_CONFIG[3];

    useEffect(() => {
        if (isEditingName && inputRef.current) inputRef.current.focus();
    }, [isEditingName]);

    const updateWeight = (newWeight) => onUpdate(disciplina.id, { ...disciplina, peso: newWeight });

    const saveName = () => {
        if (tempName.trim()) onUpdate(disciplina.id, { ...disciplina, nome: tempName });
        else setTempName(disciplina.nome);
        setIsEditingName(false);
    };

    const addTopic = (e) => {
        e.preventDefault();
        if (!topicInput.trim()) return;
        const newTopics = [...(disciplina.assuntos || []), topicInput.trim()];
        onUpdate(disciplina.id, { ...disciplina, assuntos: newTopics });
        setTopicInput('');
    };

    const removeTopic = (index) => {
        const newTopics = disciplina.assuntos.filter((_, i) => i !== index);
        onUpdate(disciplina.id, { ...disciplina, assuntos: newTopics });
    };

    const updateTopicText = (index, text) => {
        const newTopics = [...disciplina.assuntos];
        newTopics[index] = text;
        onUpdate(disciplina.id, { ...disciplina, assuntos: newTopics });
    };

    return (
        <motion.div layout className={`bg-white dark:bg-zinc-900 border transition-all duration-300 rounded-xl overflow-hidden shadow-sm mb-3 ${isExpanded ? 'border-red-500/50 ring-1 ring-red-500/20 shadow-md' : 'border-zinc-200 dark:border-zinc-800 hover:border-red-300'}`}>
            {/* CABEÇALHO */}
            <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:items-center cursor-pointer select-none" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="text-zinc-300 dark:text-zinc-700 cursor-move hidden sm:block"><GripVertical size={16} /></div>

                <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-400"><BookOpen size={16} /></div>
                        {isEditingName ? (
                            <div className="flex-1 flex items-center gap-2">
                                <input ref={inputRef} value={tempName} onChange={(e) => setTempName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === 'Enter' && saveName()} className="w-full bg-zinc-100 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500" />
                                <button onClick={saveName} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"><CheckCircle2 size={16}/></button>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center gap-2 group/edit">
                                <h4 className="text-sm font-bold text-zinc-800 dark:text-white truncate">{disciplina.nome}</h4>
                                <button onClick={(e) => { e.stopPropagation(); setIsEditingName(true); }} className="opacity-0 group-hover/edit:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-opacity"><Edit2 size={12} /></button>
                            </div>
                        )}
                    </div>

                    {/* Visualização Rápida: Estrelas no Cabeçalho */}
                    <div className="flex items-center gap-3 pl-8">
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-zinc-500"><Layers size={10}/> {disciplina.assuntos?.length || 0} Assuntos</span>
                        <span className="w-px h-3 bg-zinc-200 dark:bg-zinc-700"></span>
                        <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                    key={star}
                                    size={12}
                                    className={`${star <= currentWeight ? `${configPeso.fill} ${configPeso.color}` : 'text-zinc-300 dark:text-zinc-700 fill-zinc-200 dark:fill-zinc-800'}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
                    <div className="text-right">
                        <span className="block text-xs font-black text-zinc-800 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                            {formatHoursToTime(disciplina.horasCalculadas)}
                        </span>
                    </div>
                    <div className="flex gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-3 ml-3 sm:ml-0 sm:border-l-0 sm:pl-0">
                        <button onClick={() => onRemove(disciplina.id)} className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
                    </div>
                </div>
            </div>

            {/* CORPO EXPANSÍVEL (EDITOR) */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-black/20" onClick={e => e.stopPropagation()}>
                        <div className="p-4 sm:p-5 space-y-4 sm:space-y-6">

                            {/* --- SELETOR DE ESTRELAS --- */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Prioridade de Estudo</label>
                                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${configPeso.bg} ${configPeso.color}`}>
                                        {configPeso.label} ({currentWeight}/5)
                                    </span>
                                </div>
                                <div className="flex items-center justify-between bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                onClick={() => updateWeight(star)}
                                                className="focus:outline-none transition-transform hover:scale-110 active:scale-95 group"
                                            >
                                                <Star
                                                    size={24}
                                                    className={`transition-colors ${star <= currentWeight ? `${configPeso.fill} ${configPeso.color}` : 'text-zinc-300 dark:text-zinc-600 fill-transparent'}`}
                                                    strokeWidth={star <= currentWeight ? 0 : 2}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                    <span className="text-xs text-zinc-400 font-medium hidden sm:block text-right">
                                        {configPeso.description}
                                    </span>
                                </div>
                            </div>

                            {/* --- LISTA DE ASSUNTOS --- */}
                            <div>
                                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-2 block">Assuntos do Edital</label>
                                <form onSubmit={addTopic} className="flex gap-2 mb-3">
                                    <input type="text" value={topicInput} onChange={(e) => setTopicInput(e.target.value)} placeholder="Digite um novo tópico..." className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-red-500 outline-none transition-all placeholder:text-zinc-400"/>
                                    <button type="submit" disabled={!topicInput.trim()} className="p-2 bg-zinc-900 dark:bg-zinc-700 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"><Plus size={16} /></button>
                                </form>
                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1 bg-zinc-100/50 dark:bg-black/20 p-2 rounded-lg border border-zinc-200/50 dark:border-zinc-800">
                                    {disciplina.assuntos && disciplina.assuntos.map((assunto, index) => (
                                        <div key={index} className="flex items-center gap-2 group/item bg-white dark:bg-zinc-900 p-2 rounded border border-zinc-100 dark:border-zinc-800">
                                            <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full flex-shrink-0"></div>
                                            <input className="flex-1 bg-transparent border-none text-xs text-zinc-700 dark:text-zinc-300 p-0 focus:ring-0 font-medium" value={assunto} onChange={(e) => updateTopicText(index, e.target.value)} />
                                            <button onClick={() => removeTopic(index)} className="text-zinc-300 hover:text-red-500 transition-colors"><X size={14} /></button>
                                        </div>
                                    ))}
                                    {(!disciplina.assuntos || disciplina.assuntos.length === 0) && <div className="text-center py-6 text-xs text-zinc-400 italic">Nenhum tópico cadastrado.</div>}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ============================================================================
// 5. WIZARD PRINCIPAL
// ============================================================================

function CicloCreateWizard({ onClose, user, onCicloAtivado }) {
  const [step, setStep] = useState(1);

  // Estados Globais
  const [nomeCiclo, setNomeCiclo] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [metodoCargaHoraria, setMetodoCargaHoraria] = useState('grade');
  const [cargaHorariaManual, setCargaHorariaManual] = useState(0);
  const [availabilityGrid, setAvailabilityGrid] = useState({});
  const [disciplinas, setDisciplinas] = useState([]);

  // Estado para nova disciplina MANUAL (COM PESO)
  const [nomeNovaDisciplina, setNomeNovaDisciplina] = useState('');
  const [novoPeso, setNovoPeso] = useState(3);

  // Loader Templates
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const { criarCiclo, loading } = useCiclos(user);

  // --- TRAVA DE SCROLL NO WIZARD PRINCIPAL ---
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
        document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
      const fetchTemplates = async () => {
          setLoadingTemplates(true);
          try {
              const querySnapshot = await getDocs(collection(db, "editais_templates"));
              setTemplates(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          } catch (error) { console.error("Erro templates", error); }
          finally { setLoadingTemplates(false); }
      };
      fetchTemplates();
  }, []);

  const horasTotais = useMemo(() => {
      const manual = parseFloat(cargaHorariaManual) || 0;
      const grade = Object.keys(availabilityGrid).length;
      return metodoCargaHoraria === 'manual' ? manual : grade;
  }, [metodoCargaHoraria, cargaHorariaManual, availabilityGrid]);

  const disciplinasComCalculo = useMemo(() => {
      const pesoTotal = disciplinas.reduce((acc, d) => acc + (d.peso || 1), 0);
      return disciplinas.map(d => {
          const ratio = pesoTotal > 0 ? (d.peso || 1) / pesoTotal : 0;
          const hours = ratio * horasTotais;
          return { ...d, horasCalculadas: hours };
      });
  }, [disciplinas, horasTotais]);

  const handleSelectTemplate = (template) => {
      setSelectedTemplateId(template.id);
      setShowTemplateModal(false);
      setNomeCiclo(template.titulo);

      const disciplinasFormatadas = template.disciplinas.map((d, index) => {
          let pesoInicial = 3;
          if (d.peso !== undefined && d.peso !== null) pesoInicial = Number(d.peso);
          else if (d.peso_sugerido !== undefined && d.peso_sugerido !== null) pesoInicial = Number(d.peso_sugerido);

          const assuntosLimpos = (d.assuntos || []).map(item => {
              if (typeof item === 'string') return item;
              if (typeof item === 'object' && item !== null) {
                  return item.nome || item.texto || item.titulo || item.descricao || "";
              }
              return "";
          }).filter(item => item !== "");

          return {
              id: `imported-${Date.now()}-${index}`,
              nome: d.nome,
              peso: Math.max(1, Math.min(5, pesoInicial)),
              assuntos: assuntosLimpos
          };
      });
      setDisciplinas(disciplinasFormatadas);
  };

  const handleSelectManual = () => {
      setSelectedTemplateId('manual');
      setNomeCiclo('');
      setDisciplinas([]);
  };

  const handleAddDisciplina = (e) => {
      e.preventDefault();
      if (!nomeNovaDisciplina.trim()) return;
      setDisciplinas(prev => [
          ...prev,
          { id: `new-${Date.now()}`, nome: nomeNovaDisciplina.trim(), peso: novoPeso, assuntos: [] }
      ]);
      setNomeNovaDisciplina('');
      setNovoPeso(3);
  };

  const handleUpdateDisciplina = (id, newData) => {
      setDisciplinas(prev => prev.map(d => d.id === id ? newData : d));
  };

  const handleRemoveDisciplina = (id) => {
      if (window.confirm("Remover esta disciplina?")) {
          setDisciplinas(prev => prev.filter(d => d.id !== id));
      }
  };

  // 🔥 FUNÇÃO ATUALIZADA COM TIPO E DATA
  const handleFinalSubmit = async () => {
      if (horasTotais <= 0) return alert("Por favor, defina uma carga horária maior que zero.");
      if (disciplinas.length === 0) return alert("Adicione pelo menos uma disciplina ao ciclo.");

      // Determinar se é manual ou padrão
      const isManual = selectedTemplateId === 'manual';

      const cicloData = {
          nome: nomeCiclo,
          cargaHorariaTotal: Number(horasTotais),
          templateId: isManual ? null : selectedTemplateId,
          editalId: isManual ? null : selectedTemplateId, // ✅ ID do Edital para o Modal de Detalhes
          tipo: isManual ? 'manual' : 'padrao',           // ✅ Flag Manual/Padrão
          criadoEm: new Date(),                           // ✅ Data de criação
          disciplinas: disciplinasComCalculo.map(d => ({
              nome: d.nome,
              assuntos: d.assuntos,
              peso: d.peso,
              tempoAlocadoSemanalMinutos: Math.round(d.horasCalculadas * 60)
          }))
      };

      const novoId = await criarCiclo(cicloData);
      if (novoId) {
          onClose();
          if (onCicloAtivado) onCicloAtivado(novoId);
      }
  };

  const isWide = step >= 2;
  const maxWidthClass = isWide ? 'max-w-5xl' : 'max-w-md';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <TemplateSelectionModal isOpen={showTemplateModal} onClose={() => setShowTemplateModal(false)} templates={templates} onSelect={handleSelectTemplate} loading={loadingTemplates} />

      <motion.div
        layout
        className={`bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full ${maxWidthClass} flex flex-col relative transition-all duration-500 max-h-[85vh] m-4 ${step === 3 ? 'h-[80vh]' : 'h-auto'}`}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >

        <div className="absolute right-0 top-0 p-4 opacity-[0.03] dark:opacity-[0.05] pointer-events-none z-0">
            {step === 1 && <FileText size={250} className="text-red-600" />}
            {step === 2 && <Clock size={250} className="text-red-600" />}
            {step === 3 && <Layers size={250} className="text-red-600" />}
        </div>

        {/* HEADER */}
        <div className="flex-shrink-0 flex justify-between items-center p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur rounded-t-3xl z-20">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 text-white rounded-lg flex items-center justify-center shadow-lg shadow-red-600/20">
                    {step === 1 ? <Target size={20}/> : step === 2 ? <Clock size={20}/> : <Layers size={20}/>}
                </div>
                <div>
                    <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase leading-none">Novo Ciclo</h2>
                    <p className="text-[10px] text-zinc-500 font-bold mt-0.5 uppercase tracking-wide">
                      {step === 1 ? '1. Escolha o tipo de Ciclo' : step === 2 ? '2. Carga Horaria' : '3. Estrutura do Edital'}
                    </p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all"><X size={20} /></button>
        </div>

        {/* BODY */}
        <div className={`flex-1 relative z-10 flex flex-col min-h-0 ${step === 3 ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}>
          <AnimatePresence mode="wait">

            {step === 1 && (
              <motion.div key="step1" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 gap-6 min-h-[300px]">
                {!selectedTemplateId ? (
                    <div className="flex flex-col h-full w-full max-w-2xl">
                        <div className="mb-6 text-center">
                            <h3 className="text-xl font-bold text-zinc-800 dark:text-white">Qual é o seu objetivo?</h3>
                            <p className="text-zinc-500 text-sm">Escolha um concurso base ou crie do zero.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button onClick={handleSelectManual} className="flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group h-40 sm:h-48">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Plus size={28} className="text-zinc-500 dark:text-zinc-400 group-hover:text-red-500" />
                                </div>
                                <span className="font-black text-lg text-zinc-700 dark:text-zinc-300 group-hover:text-red-500">Ciclo Manual</span>
                                <span className="text-xs text-zinc-400 mt-1">Começar do zero</span>
                            </button>
                            <button onClick={() => setShowTemplateModal(true)} className="flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 shadow-lg hover:shadow-xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-all group h-40 sm:h-48 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Library size={80}/></div>
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
                                    <Search size={28} className="text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <span className="font-black text-lg text-zinc-800 dark:text-white relative z-10">Selecionar Edital</span>
                                <span className="text-xs text-zinc-500 mt-1 relative z-10">Usar edital pronto</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-md text-center">
                       <h3 className="text-xl font-bold text-zinc-800 dark:text-white mb-2">Nome do Ciclo</h3>
                       <div className="relative group mb-6">
                           <input type="text" value={nomeCiclo} onChange={(e) => setNomeCiclo(e.target.value)} className="w-full p-4 text-xl text-center font-bold border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-zinc-300" placeholder="Ex: CFO PMBA 2025" autoFocus />
                            <Edit2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 opacity-50 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                       </div>
                    </div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="flex-1 flex flex-col p-4 sm:p-6">
                <div className="flex justify-center mb-4 flex-shrink-0">
                    <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <button onClick={() => setMetodoCargaHoraria('grade')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${metodoCargaHoraria === 'grade' ? 'bg-white dark:bg-zinc-800 shadow text-emerald-600 dark:text-white' : 'text-zinc-400'}`}><Grid size={14}/> Interativo</button>
                        <button onClick={() => setMetodoCargaHoraria('manual')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${metodoCargaHoraria === 'manual' ? 'bg-white dark:bg-zinc-800 shadow text-red-600 dark:text-white' : 'text-zinc-400'}`}><Type size={14}/> Manual</button>
                    </div>
                </div>

                {/* SUBTÍTULO DA GRADE HORÁRIA */}
                {metodoCargaHoraria === 'grade' && (
                    <p className="text-xs text-zinc-500 text-center mb-4 px-4 font-medium">
                        Selecione ou arraste os horários livres na semana para calcular asua carga horaria semanal de estudos.
                    </p>
                )}

                <div className="flex-1 flex flex-col">
                    {metodoCargaHoraria === 'manual' ? (
                         <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-[250px]">
                             <div className="flex items-center gap-4 sm:gap-6">
                                <button onClick={() => setCargaHorariaManual(p => Math.max(0, Number(p)-1))} className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 hover:border-red-500 text-zinc-400 hover:text-red-500 transition-all flex items-center justify-center shadow-sm active:scale-95"><Minus size={20}/></button>
                                <div className="w-20 sm:w-32 text-center">
                                    <input type="number" value={cargaHorariaManual} onChange={(e) => setCargaHorariaManual(e.target.value)} className="w-full text-center text-4xl sm:text-5xl font-black bg-transparent border-none focus:ring-0 outline-none text-zinc-800 dark:text-white [&::-webkit-inner-spin-button]:appearance-none" />
                                </div>
                                <button onClick={() => setCargaHorariaManual(p => Number(p)+1)} className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 hover:border-red-500 text-zinc-400 hover:text-red-500 transition-all flex items-center justify-center shadow-sm active:scale-95"><Plus size={20}/></button>
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

            {step === 3 && (
              <motion.div key="step3" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="flex-1 flex flex-col lg:flex-row p-4 gap-6 h-full min-h-0 overflow-hidden">

                  {/* COLUNA ESQUERDA: LISTA E FORMULÁRIO */}
                  <div className="flex-1 flex flex-col gap-4 min-w-0 h-full overflow-hidden">

                      {/* Formulário de Adição */}
                      <form onSubmit={handleAddDisciplina} className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex-shrink-0 flex gap-3 items-center">
                         <div className="flex-1">
                            <div className="relative">
                                <BookOpen size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
                                <input
                                    type="text"
                                    value={nomeNovaDisciplina}
                                    onChange={(e) => setNomeNovaDisciplina(e.target.value)}
                                    placeholder="Nova Disciplina..."
                                    className="w-full pl-14 pr-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-sm font-bold text-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder:text-zinc-400 border border-transparent"
                                    style={{ paddingLeft: '3.5rem' }}
                                />
                            </div>
                            <div className="flex items-center gap-2 mt-2 px-1">
                                <span className="text-[10px] font-bold uppercase text-zinc-400">Prioridade:</span>
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setNovoPeso(star)}
                                            className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                                        >
                                            <Star
                                                size={14}
                                                className={`${star <= novoPeso ? `${PESO_CONFIG[novoPeso].fill} ${PESO_CONFIG[novoPeso].color}` : 'text-zinc-300 dark:text-zinc-700'}`}
                                            />
                                        </button>
                                    ))}
                                </div>
                                <span className={`text-[10px] font-bold uppercase ml-1 ${PESO_CONFIG[novoPeso].color}`}>{PESO_CONFIG[novoPeso].label}</span>
                            </div>
                         </div>
                         <button type="submit" className="h-14 w-14 bg-zinc-900 dark:bg-zinc-700 text-white rounded-xl flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"><Plus size={24}/></button>
                      </form>

                      {/* Container da lista */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 pb-20 min-h-0">
                          {disciplinas.length === 0 && (
                              <div className="flex flex-col items-center justify-center py-20 opacity-50">
                                  <Layers size={64} className="text-zinc-300 mb-4"/>
                                  <p className="text-zinc-500 font-medium">Sua lista está vazia. Adicione disciplinas.</p>
                              </div>
                          )}
                          {disciplinasComCalculo.map(d => (
                              <DisciplineEditorItem
                                  key={d.id}
                                  disciplina={d}
                                  onUpdate={handleUpdateDisciplina}
                                  onRemove={handleRemoveDisciplina}
                              />
                          ))}
                      </div>
                  </div>

                  {/* COLUNA DIREITA: RADAR PREVIEW */}
                  <div className="w-full lg:w-80 flex-shrink-0 hidden lg:flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar">
                      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col items-center sticky top-0">
                         <div className="mb-6 text-center"><span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Raio-X do Ciclo</span></div>
                         <CyclePreview disciplinas={disciplinasComCalculo} totalHours={horasTotais} />
                         <div className="mt-8 text-center w-full">
                             <div className="flex justify-between items-end border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-2">
                                <span className="text-xs font-bold text-zinc-500 uppercase">Disciplinas</span>
                                <span className="text-xl font-black text-zinc-900 dark:text-white">{disciplinas.length}</span>
                             </div>
                             <div className="flex justify-between items-end">
                                <span className="text-xs font-bold text-zinc-500 uppercase">Total Horas</span>
                                <span className="text-xl font-black text-red-600">{horasTotais}h</span>
                             </div>
                         </div>
                      </div>
                  </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* FOOTER REFATORADO PARA MOBILE */}
        <div className="flex-shrink-0 p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-b-3xl z-20">
             <div className="flex justify-between items-center gap-2">

                 {/* BOTÃO VOLTAR / CANCELAR */}
                 {step > 1 || (step === 1 && selectedTemplateId) ? (
                     <button
                        onClick={() => {
                            if (step === 1 && selectedTemplateId) {
                                setSelectedTemplateId(null);
                            } else {
                                setStep(s => s - 1);
                            }
                        }}
                        className="px-3 py-2 sm:px-4 sm:py-3 rounded-xl text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 font-bold text-[10px] sm:text-xs uppercase"
                     >
                        <ArrowLeft size={14} className="sm:w-4 sm:h-4"/> <span className="hidden sm:inline">Voltar</span>
                     </button>
                 ) : (
                     <button onClick={onClose} className="px-3 py-2 sm:px-4 sm:py-3 text-[10px] sm:text-xs font-bold uppercase text-zinc-400 hover:text-zinc-600">Cancelar</button>
                 )}

                 {/* INDICADOR DE TOTAL (Apenas steps > 1) */}
                 {step >= 2 && <div className="flex flex-col items-center"><span className="text-[8px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total</span><span className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-500 leading-none">{horasTotais}h</span></div>}

                 {/* BOTÃO DE AVANÇAR */}
                 {step < 3 ? (
                     <button onClick={() => setStep(s => s + 1)} disabled={step === 1 ? (!selectedTemplateId && !nomeCiclo) : horasTotais <= 0} className="px-4 py-2 sm:px-6 sm:py-3 rounded-xl text-[10px] sm:text-sm font-bold uppercase tracking-wide text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:translate-x-1 transition-all flex items-center gap-2">Próximo <ArrowRight size={14} className="sm:w-4 sm:h-4"/></button>
                 ) : (
                     <button onClick={handleFinalSubmit} disabled={disciplinas.length === 0 || loading} className="px-4 py-2 sm:px-6 sm:py-3 rounded-xl text-[10px] sm:text-sm font-bold uppercase tracking-wide text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2">{loading ? "Criando..." : <><CheckCircle2 size={16} className="sm:w-[18px] sm:h-[18px]"/> Finalizar</>}</button>
                 )}
             </div>
        </div>

      </motion.div>
    </div>
  );
}

export default CicloCreateWizard;