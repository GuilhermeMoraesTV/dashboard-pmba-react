import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, History, Clock, Target, ChevronLeft, ChevronRight,
  LayoutList, CornerDownRight, Edit2, Trash2, Calendar as CalendarIcon,
  Filter, Save, ChevronUp, ChevronDown, CheckCircle2,
  PieChart, List, AlertTriangle
} from 'lucide-react';

// --- ESTILOS CSS INJETADOS ---
const globalStyles = `
  .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #e4e4e7; border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d4d4d8; }
  .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; }
  .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }

  /* Remove setas padrão de input number */
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
`;

// --- FUNÇÕES AUXILIARES ---
const dateToYMD_local = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateLocal = (dateString) => {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
};

const formatVisualNumber = (minutes) => {
  if (!minutes || isNaN(minutes)) return '0h';
  let totalMinutes = Math.round(Number(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  else if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const formatTime = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
};

const toDateSafe = (value) => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value.toDate === 'function') {
        const date = value.toDate();
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'string') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value.seconds === 'number') {
        const date = new Date(value.seconds * 1000);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
};

const toDateMillisSafe = (value) => toDateSafe(value)?.getTime() || 0;

const formatTimeOfDay = (dateObj) => {
    const date = toDateSafe(dateObj);
    if(!date) return '--:--';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// --- COMPONENTE DATE PICKER CUSTOMIZADO ---
const CustomDatePicker = ({ value, onChange, name }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(parseDateLocal(value));
    const containerRef = useRef(null);

    const dateObj = parseDateLocal(value);
    const dayDisplay = dateObj.getDate();
    const monthDisplay = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
    const weekDisplay = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const changeMonth = (offset) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
        setViewDate(newDate);
    };

    const handleSelectDay = (day) => {
        const year = viewDate.getFullYear();
        const month = String(viewDate.getMonth() + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        const dateStr = `${year}-${month}-${d}`;
        onChange({ target: { name, value: dateStr } });
        setIsOpen(false);
    };

    const renderCalendarGrid = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const slots = [];

        for (let i = 0; i < firstDay; i++) slots.push(<div key={`empty-${i}`} className="w-8 h-8" />);

        for (let i = 1; i <= daysInMonth; i++) {
            const isSelected = dateObj.getDate() === i && dateObj.getMonth() === month && dateObj.getFullYear() === year;
            const isToday = new Date().getDate() === i && new Date().getMonth() === month && new Date().getFullYear() === year;

            slots.push(
                <button
                    key={i}
                    onClick={(e) => { e.preventDefault(); handleSelectDay(i); }}
                    className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all
                        ${isSelected ? 'bg-red-600 text-white shadow-md' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}
                        ${isToday && !isSelected ? 'text-red-500 border border-red-500' : ''}
                    `}
                >
                    {i}
                </button>
            );
        }
        return slots;
    };

    return (
        <div className="relative" ref={containerRef}>
            <div onClick={() => setIsOpen(!isOpen)} className="relative group cursor-pointer h-[50px]">
                <div className={`flex h-full bg-white dark:bg-zinc-900 border ${isOpen ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-800'} rounded-xl overflow-hidden shadow-sm group-hover:border-red-300 dark:group-hover:border-red-900/50 transition-all`}>
                    <div className="bg-zinc-100 dark:bg-zinc-800 w-14 flex flex-col items-center justify-center border-r border-zinc-200 dark:border-zinc-700">
                        <span className="text-[9px] font-bold uppercase text-red-600">{monthDisplay}</span>
                        <span className="text-xl font-black leading-none text-zinc-800 dark:text-white">{dayDisplay}</span>
                    </div>
                    <div className="flex-1 px-4 flex items-center justify-between">
                        <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 capitalize">{weekDisplay}</span>
                        <CalendarIcon size={18} className="text-zinc-300 group-hover:text-red-500 transition-colors"/>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute right-0 top-full mt-2 z-[60] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-4 w-[280px]"
                    >
                        <div className="flex justify-between items-center mb-3">
                            <button onClick={(e) => {e.preventDefault(); changeMonth(-1)}} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500"><ChevronLeft size={16}/></button>
                            <span className="text-sm font-bold text-zinc-800 dark:text-white capitalize">{viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                            <button onClick={(e) => {e.preventDefault(); changeMonth(1)}} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500"><ChevronRight size={16}/></button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 place-items-center">
                            {['D','S','T','Q','Q','S','S'].map(d => <span key={d} className="text-[10px] font-bold text-zinc-400">{d}</span>)}
                            {renderCalendarGrid()}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- SUB-COMPONENTE: MODAL DE EDIÇÃO RÁPIDA (REDESIGNED & FIXED) ---
const QuickEditRecordModal = ({ record, isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        ...record,
        horas: Math.floor((record?.tempoEstudadoMinutos || 0) / 60),
        minutos: (record?.tempoEstudadoMinutos || 0) % 60
    });
    const [loading, setLoading] = useState(false);
    const [hasError, setHasError] = useState(false);

    // Validação de Acertos
    const hasAcertosError = Number(formData.acertos) > Number(formData.questoesFeitas);

    const percentage = useMemo(() => {
        const q = Number(formData.questoesFeitas) || 0;
        const a = Number(formData.acertos) || 0;
        if (a > q) return 0;
        return q > 0 ? Math.min(Math.round((a / q) * 100), 100) : 0;
    }, [formData.questoesFeitas, formData.acertos]);

    useEffect(() => {
        if (record) {
            setFormData({
                ...record,
                horas: Math.floor((record.tempoEstudadoMinutos || 0) / 60),
                minutos: (record.tempoEstudadoMinutos || 0) % 60
            });
        }
    }, [record]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Não converte type date para number
        let val = e.target.type === 'number' ? Number(value) : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    const adjustValue = (field, amount) => {
        setFormData(prev => {
            let newVal = Number(prev[field]) + amount;
            if (newVal < 0) newVal = 0;
            if (field === 'minutos' && newVal > 59) newVal = 59;
            return { ...prev, [field]: newVal };
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();

        if (hasAcertosError) return;

        setLoading(true);
        const totalMinutes = (Number(formData.horas) * 60) + Number(formData.minutos);
        await onSave(record.id, {
            tempoEstudadoMinutos: totalMinutes,
            questoesFeitas: Number(formData.questoesFeitas),
            acertos: Number(formData.acertos),
            data: formData.data
        });
        setLoading(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                className="modal-zoom modal-zoom--historico-estudo bg-white dark:bg-zinc-950 w-full max-w-md rounded-[32px] shadow-2xl border border-white/20 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Clean */}
                <div className="flex justify-between items-center px-6 py-5 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl">
                            <Edit2 size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">
                                Editar Registro
                            </h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">Atualize os dados</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-zinc-400 hover:text-zinc-800 dark:hover:text-white rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">

                    {/* Data Customizada */}
                    <div className="space-y-1.5 relative z-50">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide ml-1">Data</label>
                        <CustomDatePicker name="data" value={formData.data} onChange={handleChange} />
                    </div>

                    {/* Tempo */}
                    <div className="space-y-2 relative z-0">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><Clock size={14} className="text-amber-500"/> Tempo Total</span>
                        </div>
                        <div className="flex gap-3">
                            {/* Horas */}
                            <div className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 flex flex-col items-center relative group focus-within:border-amber-500">
                                <input
                                    type="number" name="horas" value={formData.horas} onChange={handleChange} min="0"
                                    className="w-full text-center text-3xl font-black bg-transparent outline-none text-zinc-800 dark:text-white z-10"
                                />
                                <span className="text-[9px] font-bold text-zinc-400 uppercase mt-1">Horas</span>
                                <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center px-1 z-20">
                                    <button type="button" onClick={() => adjustValue('horas', 1)} className="p-1 text-zinc-400 hover:text-amber-600 active:scale-90"><ChevronUp size={16}/></button>
                                    <button type="button" onClick={() => adjustValue('horas', -1)} className="p-1 text-zinc-400 hover:text-amber-600 active:scale-90"><ChevronDown size={16}/></button>
                                </div>
                            </div>
                            <div className="flex items-center text-zinc-300 dark:text-zinc-700 text-xl font-black pb-6">:</div>
                            {/* Minutos */}
                            <div className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 flex flex-col items-center relative group focus-within:border-amber-500">
                                <input
                                    type="number" name="minutos" value={formData.minutos} onChange={handleChange} min="0" max="59"
                                    className="w-full text-center text-3xl font-black bg-transparent outline-none text-zinc-800 dark:text-white z-10"
                                />
                                <span className="text-[9px] font-bold text-zinc-400 uppercase mt-1">Minutos</span>
                                <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center px-1 z-20">
                                    <button type="button" onClick={() => adjustValue('minutos', 5)} className="p-1 text-zinc-400 hover:text-amber-600 active:scale-90"><ChevronUp size={16}/></button>
                                    <button type="button" onClick={() => adjustValue('minutos', -5)} className="p-1 text-zinc-400 hover:text-amber-600 active:scale-90"><ChevronDown size={16}/></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Questões */}
                    <div className={`bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border transition-all duration-300 ${hasAcertosError ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/10' : 'border-zinc-200 dark:border-zinc-800'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <span className={`text-xs font-extrabold uppercase tracking-widest flex items-center gap-1.5 ${hasAcertosError ? 'text-rose-600' : 'text-zinc-400'}`}>
                                <Target size={14} className={hasAcertosError ? "text-rose-600" : "text-emerald-500"}/> Questões
                            </span>
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-bold uppercase ${hasAcertosError ? 'bg-rose-100 border-rose-200 text-rose-700' : percentage >= 70 ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-zinc-100 border-zinc-200 text-zinc-500'}`}>
                                {hasAcertosError ? 'Erro' : <><CheckCircle2 size={10} /> {percentage}%</>}
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1 space-y-1">
                                <label className={`text-[9px] font-bold uppercase ml-1 ${hasAcertosError ? 'text-rose-400' : 'text-zinc-400'}`}>Feitas</label>
                                <input
                                    type="number" name="questoesFeitas" value={formData.questoesFeitas} onChange={handleChange} min="0"
                                    className={`w-full border rounded-xl py-2.5 px-3 text-center font-bold text-lg outline-none transition-all ${hasAcertosError ? 'bg-white dark:bg-zinc-900 border-rose-300 text-rose-600' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 focus:border-indigo-500'}`}
                                />
                            </div>
                            <div className="flex-1 space-y-1">
                                <label className={`text-[9px] font-bold uppercase ml-1 ${hasAcertosError ? 'text-rose-600' : 'text-zinc-400'}`}>Acertos</label>
                                <input
                                    type="number" name="acertos" value={formData.acertos} onChange={handleChange} min="0" max={formData.questoesFeitas}
                                    className={`w-full border rounded-xl py-2.5 px-3 text-center font-bold text-lg outline-none transition-all ${hasAcertosError ? 'bg-rose-100 border-rose-500 text-rose-700 ring-2 ring-rose-500/20' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-emerald-600 focus:border-emerald-500'}`}
                                />
                            </div>
                        </div>

                        {hasAcertosError ? (
                            <div className="mt-3 text-[10px] text-rose-600 font-bold text-center animate-pulse flex items-center justify-center gap-1">
                                <AlertTriangle size={12}/> Acertos excede total
                            </div>
                        ) : (
                            <div className="mt-4 h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden relative">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    className={`h-full rounded-full ${percentage >= 80 ? 'bg-emerald-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                />
                            </div>
                        )}
                    </div>

                </form>

                <div className="p-6 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3 relative z-20">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 uppercase tracking-wide transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || hasAcertosError}
                        className={`px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-wide text-white shadow-lg transition-all flex items-center gap-2 ${hasAcertosError ? 'bg-zinc-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-red-600/30 hover:shadow-red-600/40 hover:-translate-y-0.5 active:translate-y-0'}`}
                    >
                        {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <><Save size={16} /> Salvar</>}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// 1. Calendário Sidebar
const SidebarCalendar = ({ records, selectedDate, onSelectDate }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const daysData = useMemo(() => {
        const map = {};
        records.forEach(r => {
            if(r.data) {
                if(!map[r.data]) map[r.data] = { hasData: true, totalMinutes: 0, totalQuestions: 0 };
                map[r.data].totalMinutes += (r.tempoEstudadoMinutos || 0);
                map[r.data].totalQuestions += (r.questoesFeitas || 0);
            }
        });
        return map;
    }, [records]);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();

    const changeMonth = (offset) => {
        setCurrentDate(new Date(year, month + offset, 1));
    };

    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    const todayStr = dateToYMD_local(new Date());

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg text-zinc-500 hover:text-red-600 dark:text-zinc-400 transition-colors">
                    <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-black text-zinc-800 dark:text-white uppercase tracking-wider">
                    {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg text-zinc-500 hover:text-red-600 dark:text-zinc-400 transition-colors">
                    <ChevronRight size={16} />
                </button>
            </div>

            <div className="grid grid-cols-7 mb-2">
                {weekDays.map((day, idx) => (
                    <div key={idx} className="text-[10px] font-bold text-zinc-400 text-center uppercase">{day}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square"></div>
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const dayInfo = daysData[dateStr];
                    const hasData = !!dayInfo;
                    const isSelected = selectedDate === dateStr;
                    const isToday = todayStr === dateStr;

                    let bgClass = "bg-zinc-50 dark:bg-zinc-800/50 text-zinc-300 dark:text-zinc-600";
                    let textClass = "";

                    if (hasData) {
                        const goodProgress = dayInfo.totalMinutes >= 60 || dayInfo.totalQuestions >= 15;
                        const greatProgress = dayInfo.totalMinutes >= 120 || dayInfo.totalQuestions >= 30;

                        if (greatProgress) {
                             bgClass = "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20";
                        } else if (goodProgress) {
                             bgClass = "bg-amber-500 text-white shadow-sm shadow-amber-500/20";
                        } else {
                             bgClass = "bg-red-500 text-white shadow-sm shadow-red-500/20";
                        }
                    }

                    if (isSelected) {
                        bgClass = "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 ring-2 ring-offset-2 ring-zinc-900 dark:ring-white z-10 scale-110 shadow-lg";
                    }

                    return (
                        <button
                            key={i}
                            disabled={!hasData}
                            onClick={() => hasData && onSelectDate(dateStr)}
                            className={`
                                aspect-square rounded-md flex flex-col items-center justify-center relative transition-all duration-200
                                text-[10px] font-bold leading-none
                                ${bgClass} ${textClass}
                                ${hasData && !isSelected ? 'hover:brightness-110 hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'}
                                ${isToday && !isSelected && !hasData ? 'ring-1 ring-red-400 text-red-500' : ''}
                            `}
                        >
                            {dayNum}
                        </button>
                    );
                })}
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-center gap-3 text-[9px] text-zinc-400">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div><span>Estudou</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span>Meta</span></div>
            </div>

            {selectedDate && (
                <motion.button
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    onClick={() => onSelectDate(null)}
                    className="mt-4 w-full py-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wide text-red-600 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-100 dark:border-red-900/30"
                >
                    <X size={12} /> Limpar Filtro
                </motion.button>
            )}
        </div>
    );
};

// 2. Card da Timeline
const TimelineCard = ({ record, onEdit, onDelete }) => {
    return (
        <div className="group relative pl-6">
             <div className="absolute left-[7px] top-7 bottom-[-20px] w-0.5 bg-zinc-100 dark:bg-zinc-800 group-last:bottom-auto group-last:h-full"></div>
             <div className="absolute left-0 top-6 w-4 h-4 rounded-full bg-white dark:bg-zinc-900 border-[3px] border-zinc-200 dark:border-zinc-700 group-hover:border-red-500 dark:group-hover:border-red-500 transition-colors shadow-sm z-10"></div>

            <motion.div
                whileHover={{ x: 4 }}
                className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden"
            >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-extrabold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                {formatTimeOfDay(record.timestamp)}
                            </span>
                            <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">
                                {record.disciplinaNome}
                            </h4>
                        </div>

                        <div className="flex items-start gap-2 mb-3">
                            <CornerDownRight size={14} className="text-zinc-300 mt-0.5 shrink-0" />
                            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                                {record.assunto || record.topicoNome || 'Estudo Geral'}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                             <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 px-2.5 py-1 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                <Clock size={12} className="text-red-500" />
                                <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">{formatTime(record.tempoEstudadoMinutos)}</span>
                             </div>

                             {record.questoesFeitas > 0 && (
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${record.acertos/record.questoesFeitas >= 0.7 ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/20' : 'bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/20'}`}>
                                    <Target size={12} className={record.acertos/record.questoesFeitas >= 0.7 ? 'text-emerald-500' : 'text-amber-500'} />
                                    <span className={`text-[11px] font-bold ${record.acertos/record.questoesFeitas >= 0.7 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                                        {record.acertos}/{record.questoesFeitas} ({Math.round((record.acertos/record.questoesFeitas)*100)}%)
                                    </span>
                                </div>
                             )}
                        </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-1.5 opacity-100 transition-all duration-200 sm:flex-row">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(record); }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-900 hover:text-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                            title="Editar"
                        >
                            <Edit2 size={14} />
                            <span>Editar</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(record); }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-red-700 shadow-sm transition-colors hover:bg-red-600 hover:text-white dark:border-red-900/45 dark:bg-red-950/25 dark:text-red-300"
                            title="Excluir"
                        >
                            <Trash2 size={14} />
                            <span>Excluir</span>
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// 3. Grupo de Dias
const TimelineDayGroup = ({ dateStr, records, onEdit, onDelete }) => {
    const dateObj = parseDateLocal(dateStr);

    const getDayTitle = (d) => {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        const dYMD = dateToYMD_local(d);
        const tYMD = dateToYMD_local(today);
        const yYMD = dateToYMD_local(yesterday);

        if (dYMD === tYMD) return "Hoje";
        if (dYMD === yYMD) return "Ontem";
        return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    };

    const title = getDayTitle(dateObj);
    const dayOfWeek = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
    const totalMin = records.reduce((acc, r) => acc + (r.tempoEstudadoMinutos || 0), 0);
    const totalQuest = records.reduce((acc, r) => acc + (r.questoesFeitas || 0), 0);

    return (
        <div className="relative mb-10 last:mb-0">
             <div className="sticky top-0 z-30 py-3 mb-4 -mx-2 px-2">
                <div className="absolute inset-0 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200/50 dark:border-zinc-800/50 rounded-b-xl"></div>
                <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center w-10 h-10 bg-red-600 rounded-xl text-white shadow-lg shadow-red-600/20">
                            <span className="text-[10px] font-bold uppercase leading-none">{dateObj.getDate()}</span>
                            <span className="text-[8px] opacity-80 uppercase leading-none mt-0.5">{dateObj.toLocaleDateString('pt-BR', {month:'short'}).replace('.','')}</span>
                        </div>
                        <div>
                            <h3 className="text-base font-black text-zinc-800 dark:text-white capitalize leading-none tracking-tight">{title}</h3>
                            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{dayOfWeek}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-500 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        {totalMin > 0 && <span className="flex items-center gap-1.5"><Clock size={12} className="text-red-500"/> {formatTime(totalMin)}</span>}
                        {totalQuest > 0 && (
                            <>
                                <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-700"></div>
                                <span className="flex items-center gap-1.5"><Target size={12} className="text-emerald-500"/> {totalQuest}</span>
                            </>
                        )}
                    </div>
                </div>
             </div>

             <div className="space-y-4 pl-2 md:pl-4">
                {records.map((reg) => (
                    <TimelineCard key={reg.id} record={reg} onEdit={onEdit} onDelete={onDelete} />
                ))}
             </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL MODAL ---
const HistoricoModal = ({ isOpen, onClose, registros, onDeleteRequest, onUpdateRecord, title = "Linha do Tempo", confirmDeleteInModal = false, deleteLoading = false }) => {
    const [selectedDate, setSelectedDate] = useState(null);
    const [recordToEdit, setRecordToEdit] = useState(null);
    const [recordToDelete, setRecordToDelete] = useState(null);
    const [activeMobileTab, setActiveMobileTab] = useState('timeline');

    const { groupedRecords, stats } = useMemo(() => {
        let filtered = [...registros].sort((a,b) => toDateMillisSafe(b.timestamp) - toDateMillisSafe(a.timestamp));

        if (selectedDate) {
            filtered = filtered.filter(r => r.data === selectedDate);
        }

        const groups = {};
        filtered.forEach(reg => {
            if (!groups[reg.data]) groups[reg.data] = [];
            groups[reg.data].push(reg);
        });

        const sortedKeys = Object.keys(groups).sort((a,b) => b.localeCompare(a));
        const finalGroups = sortedKeys.map(date => ({ date, records: groups[date] }));

        const totalH = filtered.reduce((acc, r) => acc + (r.tempoEstudadoMinutos||0), 0);
        const totalQ = filtered.reduce((acc, r) => acc + (r.questoesFeitas||0), 0);

        return { groupedRecords: finalGroups, stats: { totalH, totalQ } };
    }, [registros, selectedDate]);

    const handleDateSelect = (dateStr) => {
        setSelectedDate(prev => prev === dateStr ? null : dateStr);
        if (window.innerWidth < 768) {
            setActiveMobileTab('timeline');
        }
    };

    const handleDeleteClick = (record) => {
        if (confirmDeleteInModal) {
            setRecordToDelete(record);
            return;
        }
        onDeleteRequest?.(record);
    };

    const handleConfirmDelete = async () => {
        if (!recordToDelete || !onDeleteRequest) return;
        const record = recordToDelete;
        setRecordToDelete(null);
        await onDeleteRequest(record);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100070] flex items-center justify-center p-3 sm:p-4 bg-zinc-900/60 backdrop-blur-sm">
            <style>{globalStyles}</style>

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="modal-zoom modal-zoom--historico-estudo bg-zinc-50 dark:bg-zinc-950 rounded-[32px] shadow-2xl w-full max-w-6xl border border-white/20 dark:border-zinc-800 flex flex-col h-[calc(100dvh-1.5rem)] sm:h-[calc(100dvh-2rem)] lg:h-[90dvh] max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-hidden relative"
            >
                {/* Header do Modal */}
                <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center bg-white dark:bg-zinc-900 sticky top-0 z-50 gap-4 md:gap-0">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="w-12 h-12 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-500 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                            <History size={24} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">
                                {title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                                    {registros.length} registros
                                </span>
                                {selectedDate && (
                                    <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                        <Filter size={10} /> Filtro Ativo
                                    </span>
                                )}
                            </div>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 flex md:hidden items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all duration-300">
                            <X size={22} />
                        </button>
                    </div>

                    {/* Toggle Mobile Tabs */}
                    <div className="flex md:hidden w-full bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveMobileTab('timeline')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${activeMobileTab === 'timeline' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400'}`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <List size={14} /> Lista
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveMobileTab('overview')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${activeMobileTab === 'overview' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400'}`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <PieChart size={14} /> Visão Geral
                            </div>
                        </button>
                    </div>

                    <button onClick={onClose} className="hidden md:flex w-10 h-10 items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all duration-300">
                        <X size={22} />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row h-full overflow-hidden">

                    {/* LADO ESQUERDO: Calendário e Resumo (Escondido no Mobile se tab != overview) */}
                    <div className={`${activeMobileTab === 'overview' ? 'flex' : 'hidden'} md:flex w-full md:w-80 lg:w-96 flex-shrink-0 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6 flex-col gap-6 overflow-y-auto custom-scrollbar z-20`}>
                        {/* Cards de Resumo */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-800 dark:to-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                <span className="text-[10px] uppercase font-extrabold text-zinc-400 tracking-wider block mb-1">Total Horas</span>
                                <div className="flex items-end gap-1.5 text-zinc-800 dark:text-white">
                                    <Clock size={20} className="mb-0.5 text-red-500"/>
                                    <span className="text-2xl font-black">{formatVisualNumber(stats.totalH)}</span>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-800 dark:to-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                <span className="text-[10px] uppercase font-extrabold text-zinc-400 tracking-wider block mb-1">Questões</span>
                                <div className="flex items-end gap-1.5 text-zinc-800 dark:text-white">
                                    <Target size={20} className="mb-0.5 text-red-500"/>
                                    <span className="text-2xl font-black">{stats.totalQ}</span>
                                </div>
                            </div>
                        </div>

                        {/* Calendário Widget */}
                        <div className="flex-1 min-h-[340px]">
                            <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest mb-4 ml-1 flex items-center gap-2">
                                <CalendarIcon size={14}/> Navegação
                            </h4>
                            <SidebarCalendar records={registros} selectedDate={selectedDate} onSelectDate={handleDateSelect} />
                        </div>
                    </div>

                    {/* LADO DIREITO: Timeline Vertical (Escondido no Mobile se tab != timeline) */}
                    <div className={`${activeMobileTab === 'timeline' ? 'flex' : 'hidden'} md:flex flex-1 h-full overflow-y-auto custom-scrollbar bg-zinc-50/50 dark:bg-zinc-950 p-4 md:p-8 relative flex-col`}>
                        {groupedRecords.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                                <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                    <LayoutList size={40} className="text-zinc-300 dark:text-zinc-600" />
                                </div>
                                <h4 className="text-xl font-bold text-zinc-800 dark:text-white mb-2">Histórico Vazio</h4>
                                <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
                                    {selectedDate
                                        ? "Nenhum estudo registrado nesta data específica."
                                        : "Seus registros de estudo aparecerão aqui cronologicamente."}
                                </p>
                                {selectedDate && (
                                    <button onClick={() => setSelectedDate(null)} className="mt-6 px-6 py-2 bg-red-600 text-white font-bold text-sm rounded-full shadow-lg shadow-red-600/30 hover:bg-red-700 transition-all">
                                        Limpar Filtro
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="max-w-3xl mx-auto pb-12 w-full">
                                {groupedRecords.map((group) => (
                                    <TimelineDayGroup
                                        key={group.date}
                                        dateStr={group.date}
                                        records={group.records}
                                        onEdit={(r) => setRecordToEdit(r)}
                                        onDelete={handleDeleteClick}
                                    />
                                ))}
                                <div className="text-center pt-8 pb-4">
                                    <span className="text-[10px] font-bold text-zinc-300 dark:text-zinc-700 uppercase tracking-widest">• Fim do Histórico •</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Modal de Edição Interno */}
            <AnimatePresence>
                {recordToDelete && (
                    <div className="fixed inset-0 z-[100130] flex items-center justify-center bg-zinc-950/75 p-4 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.94, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 12 }}
                            className="w-full max-w-sm overflow-hidden rounded-3xl border border-red-200 bg-white shadow-2xl dark:border-red-900/40 dark:bg-zinc-950"
                        >
                            <div className="border-b border-red-100 bg-red-50 p-6 text-center dark:border-red-900/30 dark:bg-red-950/20">
                                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/25">
                                    <Trash2 size={26} />
                                </div>
                                <h3 className="text-base font-black uppercase text-zinc-900 dark:text-white">Excluir registro?</h3>
                                <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-600 dark:text-zinc-400">
                                    Isso remove este estudo do histórico e atualiza o progresso relacionado.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 p-5">
                                <button
                                    type="button"
                                    onClick={() => setRecordToDelete(null)}
                                    disabled={deleteLoading}
                                    className="rounded-2xl bg-zinc-100 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-60 dark:bg-zinc-800 dark:text-zinc-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    disabled={deleteLoading}
                                    className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-600/25 transition-colors hover:bg-red-700 disabled:opacity-60"
                                >
                                    {deleteLoading ? <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Trash2 size={14} />}
                                    Excluir
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {recordToEdit && (
                    <QuickEditRecordModal
                        record={recordToEdit}
                        isOpen={!!recordToEdit}
                        onClose={() => setRecordToEdit(null)}
                        onSave={onUpdateRecord}
                    />
                )}
            </AnimatePresence>
        </div>,
        document.body
    );
};

export default HistoricoModal;
