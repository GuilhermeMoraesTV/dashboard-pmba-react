import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { doc, collection, query, orderBy, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';

import CicloVisual from '../components/ciclos/CicloVisual';
import RegistroEstudoModal from '../components/ciclos/RegistroEstudoModal';
import DisciplinaDetalheModal from '../components/ciclos/DisciplinaDetalheModal';
import ModalConclusaoCiclo from '../components/ciclos/ModalConclusaoCiclo';
import { useCiclos } from '../hooks/useCiclos';

import {
  ArrowLeft, Plus, Trophy, Target, AlertTriangle, CalendarDays, Flag,
  BookOpen, ChevronRight, Settings, History, Timer, X, Trash2,
  CheckSquare, Sliders, ScrollText, Clock, Edit2, Save, AlertOctagon, Calendar as CalendarIcon,
  ChevronLeft, CornerDownRight, RotateCw, List, Filter
} from 'lucide-react';

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

const getSafeDate = (field) => {
    if (!field) return null;
    if (field.toDate && typeof field.toDate === 'function') return field.toDate();
    if (field instanceof Date) return field;
    if (typeof field === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(field)) {
        return parseDateLocal(field);
    }
    const d = new Date(field);
    return !isNaN(d.getTime()) ? d : null;
};

const formatVisualNumber = (minutes) => {
  if (!minutes || isNaN(minutes)) return '0h';
  let totalMinutes = Math.round(Number(minutes));
  const remainder = totalMinutes % 60;
  if (remainder > 50) totalMinutes = Math.ceil(totalMinutes / 60) * 60;
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

const getLogo = (ciclo) => {
    if(!ciclo) return null;
    if(ciclo.logoUrl) return ciclo.logoUrl;
    const searchString = (ciclo.templateOrigem || ciclo.nome || '').toLowerCase();
    const ufs = ['ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mt', 'ms', 'mg', 'pa', 'pb', 'pr', 'pe', 'pi', 'erj', 'rn', 'rs', 'ro', 'rr', 'sc', 'sp', 'se', 'to'];
    const prefixos = ['pm', 'pc', 'cbm', 'bm', 'pp'];
    const especiais = ['gcm', 'aquiraz', 'pf', 'prf', 'depen', 'eb', 'fab', 'marinha'];
    let todasSiglas = [...especiais];
    prefixos.forEach(prefixo => {
        ufs.forEach(uf => {
            todasSiglas.push(`${prefixo}${uf}`);
        });
    });
    todasSiglas.sort((a, b) => b.length - a.length);
    const encontrada = todasSiglas.find(sigla => searchString.includes(sigla));
    if (encontrada) {
        if(encontrada === 'gcm' || encontrada === 'aquiraz') return '/logosEditais/logo-aquiraz.png';
        return `/logosEditais/logo-${encontrada}.png`;
    }
    return null;
};

// --- COMPONENTES VISUAIS ---
const MiniCalendar = ({ records, selectedDate, onSelectDate }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const daysWithData = useMemo(() => {
        const map = {};
        records.forEach(r => { if(r.data) map[r.data] = true; });
        return map;
    }, [records]);

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const days = [];
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const totalDays = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    for (let i = 0; i < firstDay; i++) { days.push(null); }
    for (let i = 1; i <= totalDays; i++) {
        const d = new Date(year, month, i);
        const y = d.getFullYear();
        const mStr = String(d.getMonth() + 1).padStart(2, '0');
        const dStr = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${mStr}-${dStr}`;
        const dateObj = new Date(year, month, i);
        days.push({ dateObj, dateStr });
    }

    const handlePrevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
    const handleNextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm h-full">
            <div className="flex items-center justify-between mb-4">
                <button onClick={handlePrevMonth} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors"><ChevronLeft size={16} /></button>
                <span className="text-xs font-bold text-zinc-800 dark:text-white uppercase tracking-wider">{currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                <button onClick={handleNextMonth} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors"><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map((day, idx) => (<div key={idx} className="text-[10px] font-bold text-zinc-400 text-center uppercase">{day}</div>))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map((item, idx) => {
                    if (!item) return <div key={idx} className="h-8 md:h-8" />;
                    const { dateStr, dateObj } = item;
                    const isSelected = selectedDate === dateStr;
                    const hasData = daysWithData[dateStr];

                    return (
                        <button key={idx} onClick={() => onSelectDate(dateStr)} className={`h-8 md:h-8 rounded-lg flex flex-col items-center justify-center relative transition-all ${isSelected ? 'bg-red-600 text-white shadow-md shadow-red-500/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                            <span className={`text-xs font-bold leading-none ${!isSelected && hasData ? 'text-zinc-900 dark:text-white' : ''}`}>{dateObj.getDate()}</span>
                            {hasData && (<div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-emerald-500'}`}></div>)}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const HistoryItemAccordion = ({ disciplinaNome, records, onEdit, onDelete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const totalMinutos = records.reduce((acc, r) => acc + (r.tempoEstudadoMinutos || 0), 0);
    const totalQuestoes = records.reduce((acc, r) => acc + (r.questoesFeitas || 0), 0);
    const dateStr = records[0]?.data ? parseDateLocal(records[0].data).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'}) : '';

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all shadow-sm hover:shadow-md mb-2">
            <div onClick={() => setIsOpen(!isOpen)} className="px-3 py-2 flex items-center justify-between cursor-pointer bg-zinc-50/30 dark:bg-zinc-800/10 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-2">
                    <div className="text-[10px] font-bold text-zinc-400 w-10 text-center border-r border-zinc-200 dark:border-zinc-700 pr-2">{dateStr}</div>
                    <div className={`p-1.5 rounded-md ${isOpen ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-500' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}><BookOpen size={14} /></div>
                    <div>
                        <h4 className="font-bold text-xs text-zinc-800 dark:text-white line-clamp-1">{disciplinaNome}</h4>
                        <div className="flex items-center gap-2 text-[9px] font-bold text-zinc-400 uppercase tracking-wide leading-none mt-0.5">
                            <span className="flex items-center gap-0.5"><Clock size={10}/> {formatTime(totalMinutos)}</span>
                            {totalQuestoes > 0 && <span className="flex items-center gap-0.5"><CheckSquare size={10}/> {totalQuestoes}</span>}
                        </div>
                    </div>
                </div>
                <div className="text-zinc-400 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(-90deg)' : 'rotate(0deg)' }}><ChevronLeft size={16} /></div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                        {records.map((reg) => (
                            <div key={reg.id} className="px-3 py-2 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors flex items-center justify-between group">
                                <div className="flex-1 min-w-0 mr-2">
                                    <div className="flex items-center gap-1.5">
                                        <CornerDownRight size={12} className="text-zinc-300 shrink-0" />
                                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{reg.assunto || reg.topicoNome || 'Estudo Geral'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                     <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded flex items-center gap-1"><Clock size={10} className="text-zinc-400"/> {formatTime(reg.tempoEstudadoMinutos)}</span>
                                     {reg.questoesFeitas > 0 && (<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${reg.acertos/reg.questoesFeitas >= 0.7 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20'}`}><Target size={10}/> {reg.acertos}/{reg.questoesFeitas}</span>)}
                                    <div className="flex gap-1 pl-2 border-l border-zinc-100 dark:border-zinc-800">
                                        <button onClick={(e) => { e.stopPropagation(); onEdit(reg); }} className="p-1.5 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors" title="Editar"><Edit2 size={12}/></button>
                                        <button onClick={(e) => { e.stopPropagation(); onDelete(reg); }} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Excluir"><Trash2 size={12}/></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const QuickEditRecordModal = ({ record, isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        ...record,
        horas: Math.floor((record?.tempoEstudadoMinutos || 0) / 60),
        minutos: (record?.tempoEstudadoMinutos || 0) % 60
    });
    const [loading, setLoading] = useState(false);

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
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <div className="relative flex justify-between items-center p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-3 relative z-10"><div className="w-10 h-10 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-xl flex items-center justify-center shadow-sm"><Edit2 size={20} /></div><div><h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Editar Registro</h2></div></div>
                    <button onClick={onClose} className="relative z-10 p-2 text-zinc-400 hover:text-red-500 hover:bg-white dark:hover:bg-zinc-800 rounded-full transition-all"><X size={20} /></button>
                </div>
                <form onSubmit={handleSave} className="p-5 space-y-5 overflow-y-auto custom-scrollbar">
                    <div className="space-y-1"><label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Data</label><div className="relative group"><CalendarIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors"/><input type="date" name="data" value={formData.data} onChange={handleChange} className="w-full p-2.5 pl-10 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-zinc-700 dark:text-white" /></div></div>
                    <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900/30 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><Clock size={12} className="text-amber-500" /> Tempo Estudado</h3>
                        <div className="flex gap-3 items-end"><div className="flex-1"><label className="text-[10px] font-semibold text-zinc-500 mb-1 block">Horas</label><input type="number" name="horas" value={formData.horas} onChange={handleChange} min="0" className="w-full p-2 text-center text-lg font-black border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-amber-500 outline-none" /></div><span className="text-zinc-300 font-bold pb-3">:</span><div className="flex-1"><label className="text-[10px] font-semibold text-zinc-500 mb-1 block">Minutos</label><input type="number" name="minutos" value={formData.minutos} onChange={handleChange} min="0" max="59" className="w-full p-2 text-center text-lg font-black border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-amber-500 outline-none" /></div></div>
                    </div>
                    <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900/30 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><Target size={12} className="text-emerald-500" /> Questões</h3>
                        <div className="flex gap-3"><div className="flex-1"><label className="text-[10px] font-semibold text-zinc-500 mb-1 block">Feitas</label><input type="number" name="questoesFeitas" value={formData.questoesFeitas} onChange={handleChange} min="0" className="w-full p-2 text-center text-lg font-black border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 outline-none" /></div><div className="flex-1"><label className="text-[10px] font-semibold text-zinc-500 mb-1 block">Acertos</label><input type="number" name="acertos" value={formData.acertos} onChange={handleChange} min="0" max={formData.questoesFeitas} className="w-full p-2 text-center text-lg font-black border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 outline-none" /></div></div>
                    </div>
                </form>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors uppercase tracking-wide">Cancelar</button>
                    <button onClick={handleSave} disabled={loading} className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2">{loading ? 'Salvando...' : <><Save size={16} /> Salvar</>}</button>
                </div>
            </motion.div>
        </div>
    );
};

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, loading }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white dark:bg-zinc-950 w-full max-w-xs rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl text-center relative overflow-hidden">
                <div className="flex justify-center mb-3"><div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center shadow-inner"><AlertOctagon size={24} /></div></div>
                <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase mb-1">Excluir Registro?</h3>
                <p className="text-xs text-zinc-500 mb-4 px-2">Essa ação não pode ser desfeita.</p>
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg font-bold text-[10px] uppercase tracking-wide hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
                    <button onClick={onConfirm} disabled={loading} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-wide shadow-md flex items-center justify-center gap-1.5">{loading ? "..." : <><Trash2 size={12} /> Excluir</>}</button>
                </div>
            </motion.div>
        </div>
    );
};

const CicloHistoryModal = ({ isOpen, onClose, registros, onDeleteRequest, onEditRequest }) => {
    const [selectedDate, setSelectedDate] = useState(null);

    const filteredRecords = useMemo(() => {
        if (!selectedDate) {
            return [...registros].sort((a,b) => b.timestamp - a.timestamp);
        }
        return registros.filter(r => r.data === selectedDate).sort((a,b) => b.timestamp - a.timestamp);
    }, [registros, selectedDate]);

    const groupedList = useMemo(() => {
        const grouped = {};
        filteredRecords.forEach(reg => {
            const key = `${reg.data}_${reg.disciplinaNome}`;
            if(!grouped[key]) grouped[key] = { disciplinaNome: reg.disciplinaNome, data: reg.data, records: [] };
            grouped[key].records.push(reg);
        });
        return Object.values(grouped).sort((a,b) => b.data.localeCompare(a.data));
    }, [filteredRecords]);

    const handleDateSelect = (dateStr) => {
        if (selectedDate === dateStr) setSelectedDate(null);
        else setSelectedDate(dateStr);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl w-full max-w-5xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh] overflow-hidden relative">
                <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-md z-10">
                    <h3 className="text-lg font-black text-zinc-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
                        <History size={18} className="text-indigo-500"/> Histórico do Ciclo
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 rounded-full text-zinc-400 transition-colors"><X size={20} /></button>
                </div>

                <div className="p-4 bg-zinc-50/50 dark:bg-black/20 flex flex-col md:flex-row gap-6 h-full overflow-hidden">
                    <div className="md:w-80 flex-shrink-0 h-full">
                        <MiniCalendar records={registros} selectedDate={selectedDate} onSelectDate={handleDateSelect} />
                    </div>

                    <div className="flex-1 h-full flex flex-col min-w-0">
                         <div className="flex items-center justify-between mb-4 px-2">
                              <h4 className="text-sm font-black text-zinc-700 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                  {selectedDate ? (
                                      <>
                                          <CalendarIcon size={16} className="text-red-500"/>
                                          {parseDateLocal(selectedDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                      </>
                                  ) : (
                                      <>
                                          <List size={16} className="text-indigo-500"/> Histórico Completo
                                      </>
                                  )}
                              </h4>
                          </div>

                          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
                              {groupedList.length === 0 ? (
                                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-50 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl h-full"><Clock size={40} className="mb-3 text-zinc-300"/><p className="text-sm font-bold text-zinc-500">Nenhum registro encontrado.</p></div>
                              ) : (
                                  groupedList.map((group) => (
                                      <HistoryItemAccordion
                                          key={`${group.data}-${group.disciplinaNome}`}
                                          disciplinaNome={group.disciplinaNome}
                                          records={group.records}
                                          onEdit={onEditRequest}
                                          onDelete={onDeleteRequest}
                                      />
                                  ))
                              )}
                          </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// --- PÁGINA PRINCIPAL DO CICLO ---
function CicloDetalhePage({ cicloId, onBack, user, addRegistroEstudo, onStartStudy, onGoToEdital }) {
  const [ciclo, setCiclo] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [registroPreenchido, setRegistroPreenchido] = useState(null);
  const [disciplinaEmDetalhe, setDisciplinaEmDetalhe] = useState(null);
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState(null);
  const [showConclusaoModal, setShowConclusaoModal] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [recordToEdit, setRecordToEdit] = useState(null);
  const { concluirCicloSemanal, loading: cicloActionLoading, error: cicloActionError } = useCiclos(user);
  const [cicloLoaded, setCicloLoaded] = useState(false);
  const [disciplinasLoaded, setDisciplinasLoaded] = useState(false);
  const [registrosLoaded, setRegistrosLoaded] = useState(false);

  useEffect(() => {
     if (!user || !cicloId) return;
     const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
     const unsubscribe = onSnapshot(cicloRef, (doc) => {
       if (doc.exists()) {
           const data = doc.data();
           const rawDate = getSafeDate(data.ultimaConclusao) || getSafeDate(data.dataCriacao) || new Date();
           setCiclo({ id: doc.id, ...data, cargaHorariaSemanalTotal: Number(data.cargaHorariaSemanalTotal || 0), conclusoes: Number(data.conclusoes || 0), dataInicioAtual: rawDate });
           setCicloLoaded(true);
       } else { setCiclo(null); setCicloLoaded(true); }
     }, (error) => { console.error(error); setCicloLoaded(true); });
     return () => unsubscribe();
  }, [user, cicloId]);

  useEffect(() => {
    if (!user || !cicloId) return;
    const q = query(collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas'), orderBy('nome'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setDisciplinas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setDisciplinasLoaded(true);
    }, (error) => { console.error(error); setDisciplinasLoaded(true); });
    return () => unsubscribe();
  }, [user, cicloId]);

  useEffect(() => {
     if (!user) return;
     const q = query(collection(db, 'users', user.uid, 'registrosEstudo'), orderBy('timestamp', 'desc'));
     const unsubscribe = onSnapshot(q, (snap) => {
        setAllRegistrosEstudo(snap.docs.map(doc => {
            const data = doc.data();
            let finalDataStr = '';
            if (typeof data.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.data)) {
                finalDataStr = data.data;
            } else {
                const safeDate = getSafeDate(data.data) || new Date();
                finalDataStr = dateToYMD_local(safeDate);
            }
            return {
                id: doc.id, ...data,
                tempoEstudadoMinutos: Number(data.tempoEstudadoMinutos || data.duracaoMinutos || 0),
                questoesFeitas: Number(data.questoesFeitas || 0), acertos: Number(data.acertos || data.questoesAcertadas || 0),
                data: finalDataStr,
                timestamp: getSafeDate(data.timestamp) || new Date(0)
            };
        }));
        setRegistrosLoaded(true);
     }, (error) => { console.error(error); setRegistrosLoaded(true); });
     return () => unsubscribe();
  }, [user]);

  useEffect(() => { if (cicloLoaded && disciplinasLoaded && registrosLoaded) setLoading(false); }, [cicloLoaded, disciplinasLoaded, registrosLoaded]);

  const registrosAtivosDaSemana = useMemo(() =>
    allRegistrosEstudo.filter(reg => reg.cicloId === cicloId && !reg.conclusaoId),
  [allRegistrosEstudo, cicloId]);

  const registrosHistoricoCompleto = useMemo(() =>
    allRegistrosEstudo.filter(reg => reg.cicloId === cicloId),
  [allRegistrosEstudo, cicloId]);

  const { totalEstudado, totalMeta, progressoGeral, registrosPorDisciplina } = useMemo(() => {
    if (!disciplinas.length) return { totalEstudado: 0, totalMeta: 0, progressoGeral: 0, registrosPorDisciplina: {} };
    const totalMetaRaw = disciplinas.reduce((acc, d) => acc + Number(d.tempoAlocadoSemanalMinutos || 0), 0);
    const totalMetaCalc = Math.round(totalMetaRaw);
    const registrosPorDisciplina = {};
    let totalEstudadoCalc = 0;
    registrosAtivosDaSemana.forEach(reg => {
        const minutos = Number(reg.tempoEstudadoMinutos);
        totalEstudadoCalc += minutos;
        const discId = reg.disciplinaId;
        if (discId) {
            registrosPorDisciplina[discId] = (registrosPorDisciplina[discId] || 0) + minutos;
        }
    });
    const prog = totalMetaCalc > 0 ? (totalEstudadoCalc / totalMetaCalc) * 100 : 0;
    return { totalEstudado: Math.round(totalEstudadoCalc), totalMeta: totalMetaCalc, progressoGeral: prog, registrosPorDisciplina };
  }, [disciplinas, registrosAtivosDaSemana]);

  const isAllDisciplinesMet = useMemo(() => {
      if (!ciclo?.ativo || !disciplinas.length || totalMeta === 0) return false;
      return disciplinas.every(d => {
          const meta = Number(d.tempoAlocadoSemanalMinutos || 0);
          const feito = registrosPorDisciplina[d.id] || 0;
          return meta > 0 ? feito >= meta : true;
      });
  }, [disciplinas, registrosPorDisciplina, ciclo?.ativo, totalMeta]);

  const canConcludeCiclo = ciclo?.ativo && progressoGeral >= 100 && isAllDisciplinesMet;
  const showEmptyMessage = !disciplinas.length;

  const handleConcluirCiclo = async () => {
    if (!canConcludeCiclo) {
         alert("Não é possível concluir. As metas individuais de todas as disciplinas não foram atingidas.");
         return;
    }
    if (cicloActionLoading) return;
    setShowConclusaoModal(false);
    const sucesso = await concluirCicloSemanal(cicloId);
    if (sucesso) onBack();
    else if (cicloActionError) alert(`Erro ao concluir: ${cicloActionError}`);
  };

  const handleConfirmDeleteRegistro = async () => {
      if (!recordToDelete) return;
      try {
          await deleteDoc(doc(db, 'users', user.uid, 'registrosEstudo', recordToDelete.id));
          setRecordToDelete(null);
      } catch (e) { console.error("Erro ao excluir", e); alert("Erro ao excluir registro."); }
  };

  const handleUpdateRegistro = async (id, updatedData) => {
      try { await updateDoc(doc(db, 'users', user.uid, 'registrosEstudo', id), updatedData); }
      catch (e) { console.error("Erro ao atualizar", e); alert("Erro ao atualizar registro."); }
  };

  const handleViewDetails = (disciplina) => {
    setDisciplinaEmDetalhe(disciplina);
    setSelectedDisciplinaId(disciplina.id);
  };

  const handleStartStudy = (disciplina) => {
    if (ciclo?.ativo && onStartStudy) {
        onStartStudy(disciplina);
        setDisciplinaEmDetalhe(null);
        setSelectedDisciplinaId(null);
    }
  };

  const openRegistroModalWithTopic = (disciplinaId, topico) => {
    const disciplina = disciplinas.find(d => d.id === disciplinaId);
    if (disciplina) {
        setRegistroPreenchido({ disciplinaId: disciplina.id, topicoId: topico.id });
        setShowRegistroModal(true);
        setDisciplinaEmDetalhe(null);
    }
  };

  if (loading) return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500"></div></div>;
  if (!ciclo) return <div className="p-10 text-center text-zinc-500">Ciclo não encontrado.</div>;

  let formattedStartDate = '...';
  let formattedEndDate = '...';
  if (ciclo.dataInicioAtual) {
      const start = new Date(ciclo.dataInicioAtual);
      formattedStartDate = `${start.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}, ${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
      const end = new Date(start); end.setDate(end.getDate() + 7);
      formattedEndDate = `${end.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}, ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  }
  const logo = getLogo(ciclo);

  // ANIMAÇÃO DOS FABs SEM DELAY
  const fabContainerVariants = {
      rest: { width: 56, transition: { type: "tween", duration: 0.15, ease: "easeOut" } },
      hover: { width: "auto", transition: { type: "tween", duration: 0.15, ease: "easeOut" } }
  };
  const fabTextVariants = {
      rest: { opacity: 0, width: 0, marginLeft: 0, display: "none" },
      hover: { opacity: 1, width: "auto", marginLeft: 8, display: "block" }
  };

  return (
    <div className="relative flex flex-col h-full animate-fade-in" onClick={() => setShowOptions(false)}>
      <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
              <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"><ArrowLeft size={16} /> Voltar</button>
              <div className="flex items-center gap-3">
                  {ciclo.ativo && canConcludeCiclo && (
                      <button onClick={() => setShowConclusaoModal(true)} disabled={cicloActionLoading} className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wide rounded-xl shadow-md hover:bg-emerald-700 transition-colors animate-pulse"><Trophy size={16} /> Concluir Missão ({ciclo.conclusoes}x)</button>
                  )}
                  {ciclo.ativo && progressoGeral >= 100 && !isAllDisciplinesMet && (
                     <div className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-bold uppercase tracking-wide rounded-xl shadow-md border border-red-300 dark:border-red-700"><AlertTriangle size={16} /> Complete todas as matérias!</div>
                  )}
              </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-50 dark:bg-zinc-900 px-6 py-4 rounded-2xl border border-zinc-300 dark:border-zinc-800 shadow-sm relative overflow-hidden">
              {logo && (<div className="absolute -bottom-4 -right-4 w-32 h-32 md:w-44 md:h-44 opacity-20 md:opacity-10 dark:opacity-30 dark:md:opacity-20 pointer-events-none transform rotate-[-10deg] z-0 filter saturate-150 transition-all duration-500"><img src={logo} alt="Logo Edital" className="w-full h-full object-contain" /></div>)}
              <div className="flex-1 z-10">
                  <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                          <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">{ciclo.nome}</h1>
                          {ciclo.ativo ? (<span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>) : (<span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 uppercase">Arquivado</span>)}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-zinc-400"><CalendarDays size={13} /><p className="text-[10px] font-bold uppercase tracking-wide">Início: <span className="text-zinc-600 dark:text-zinc-300">{formattedStartDate}</span></p></div>
                            <div className="flex items-center gap-1.5 text-zinc-400"><Flag size={13} /><p className="text-[10px] font-bold uppercase tracking-wide">Meta: <span className="text-zinc-600 dark:text-zinc-300">{formattedEndDate}</span></p></div>
                        </div>
                        <button onClick={onGoToEdital} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-zinc-200 hover:border-red-200 dark:bg-zinc-800 dark:hover:bg-red-900/10 dark:border-zinc-700 dark:hover:border-red-900/30 text-zinc-600 hover:text-red-700 dark:text-zinc-300 dark:hover:text-red-400 text-[11px] font-bold uppercase tracking-wide transition-all group w-fit shadow-sm z-20">
                            <BookOpen size={14} className="text-red-600 dark:text-red-500 group-hover:scale-110 transition-transform" /><span>Acessar Edital</span><ChevronRight size={12} className="opacity-60 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                  </div>
              </div>
              <div className="flex items-center gap-6 z-10">
                  <div className="text-center hidden sm:block"><p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Meta</p><p className="text-xl font-black text-zinc-800 dark:text-white font-mono">{formatVisualNumber(totalMeta)}</p></div>
                  <div className="w-px h-10 bg-zinc-200 dark:bg-zinc-700 hidden sm:block"></div>
                  <div className="text-center hidden sm:block"><p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Feito</p><p className="text-xl font-black text-zinc-800 dark:text-white font-mono">{formatVisualNumber(totalEstudado)}</p></div>
                  <div className="relative">
                      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="6" />
                          <motion.circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className={progressoGeral >= 100 && isAllDisciplinesMet ? 'text-emerald-500' : progressoGeral > 0 ? 'text-yellow-500' : 'text-zinc-400'} strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 34} initial={{ strokeDashoffset: 2 * Math.PI * 34 }} animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - Math.min(progressoGeral, 100) / 100) }} transition={{ duration: 1.5, ease: "easeOut" }} />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className={`text-xl font-black ${progressoGeral >= 100 && isAllDisciplinesMet ? 'text-emerald-500' : progressoGeral > 0 ? 'text-yellow-500' : 'text-zinc-400'}`}>{progressoGeral.toFixed(0)}%</span></div>
                  </div>
              </div>
          </div>
      </div>

      {!showEmptyMessage && (
          <div className="flex-grow mt-20">
              <CicloVisual
                  selectedDisciplinaId={selectedDisciplinaId}
                  onSelectDisciplina={setSelectedDisciplinaId}
                  onViewDetails={handleViewDetails}
                  onStartStudy={handleStartStudy}
                  disciplinas={disciplinas.map(d => ({ ...d, progressoEstudadoMinutos: registrosPorDisciplina[d.id] || 0 }))}
                  registrosEstudo={registrosAtivosDaSemana}
                  viewMode={'total'}
                  ciclo={ciclo}
              />
          </div>
      )}

      {showEmptyMessage && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 mt-8">
            <Target size={48} className="text-zinc-300 mb-4" />
            <h3 className="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-1">Ciclo Sem Disciplinas</h3>
            <p className="text-zinc-500 text-sm mb-6">Adicione matérias para começar.</p>
        </div>
      )}

      {ciclo.ativo && (
          <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3 pointer-events-none">
                <div className="relative flex items-center justify-end pointer-events-auto">
                    <AnimatePresence>
                        {showOptions && (
                            <motion.div initial={{ opacity: 0, x: 20, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 20, scale: 0.95 }} className="absolute right-16 bottom-0 w-72 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl rounded-2xl overflow-hidden mr-3 z-30 origin-bottom-right" onClick={(e) => e.stopPropagation()}>
                                <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between"><span className="text-xs font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Configurações</span><button onClick={() => setShowOptions(false)} className="text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors"><X size={18} /></button></div>
                                <div className="p-2 space-y-1">
                                    <button onClick={() => { setShowOptions(false); alert("Em breve!"); }} className="flex items-center gap-4 w-full p-4 hover:bg-zinc-50 dark:hover:bg-white/5 rounded-xl text-left group">
                                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all shadow-sm"><Timer size={20}/></div>
                                        <div className="flex flex-col"><span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Cronômetro</span><span className="text-xs text-zinc-400">Personalizar tempo</span></div>
                                    </button>
                                    <button onClick={() => { setShowOptions(false); setShowHistoryModal(true); }} className="flex items-center gap-4 w-full p-4 hover:bg-zinc-50 dark:hover:bg-white/5 rounded-xl text-left group">
                                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-sm"><ScrollText size={20}/></div>
                                        <div className="flex flex-col"><span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Histórico</span><span className="text-xs text-zinc-400">Ver sessões passadas</span></div>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <motion.button layout onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }} className="bg-zinc-900 text-white shadow-xl flex items-center justify-center border border-zinc-800 overflow-hidden relative z-20 h-14 rounded-full" variants={fabContainerVariants} initial="rest" whileHover="hover" whileTap="rest">
                        <div className="flex items-center px-4 min-w-[56px] justify-center">
                            <Settings size={22} className={`shrink-0 ${showOptions ? "animate-spin-slow" : ""}`} />
                            <motion.span className="whitespace-nowrap text-xs font-bold uppercase tracking-wide overflow-hidden ml-2" variants={fabTextVariants}>Configurações</motion.span>
                        </div>
                    </motion.button>
                </div>

                <div className="relative flex items-center justify-end pointer-events-auto">
                    <motion.button layout onClick={() => setShowRegistroModal(true)} className="bg-red-600 hover:bg-red-700 text-white shadow-2xl flex items-center justify-center border-4 border-white dark:border-zinc-950 overflow-hidden h-16 rounded-full" variants={fabContainerVariants} initial="rest" whileHover="hover" whileTap="rest">
                        <div className="flex items-center px-5 min-w-[64px] justify-center">
                            <Plus size={30} strokeWidth={3} className="shrink-0" />
                            <motion.span className="whitespace-nowrap text-sm font-bold uppercase tracking-wide overflow-hidden ml-2" variants={fabTextVariants}>Registrar Estudo</motion.span>
                        </div>
                    </motion.button>
                </div>
          </div>
      )}

      <AnimatePresence>
        {showConclusaoModal && <ModalConclusaoCiclo ciclo={ciclo} onClose={() => setShowConclusaoModal(false)} onConfirm={handleConcluirCiclo} loading={cicloActionLoading} progressoGeral={progressoGeral} />}
        {disciplinaEmDetalhe && (
            <DisciplinaDetalheModal
                disciplina={disciplinaEmDetalhe}
                registrosEstudo={registrosAtivosDaSemana} // CORREÇÃO DO ERRO AQUI
                cicloId={cicloId}
                user={user.uid}
                onClose={() => { setDisciplinaEmDetalhe(null); setSelectedDisciplinaId(null); }}
                onQuickAddTopic={openRegistroModalWithTopic}
            />
        )}
        {showRegistroModal && <RegistroEstudoModal onClose={() => setShowRegistroModal(false)} addRegistroEstudo={addRegistroEstudo} cicloId={cicloId} userId={user.uid} disciplinasDoCiclo={disciplinas} initialData={registroPreenchido} />}
        {showHistoryModal && <CicloHistoryModal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} registros={registrosHistoricoCompleto} onDeleteRequest={(r) => setRecordToDelete(r)} onEditRequest={(r) => setRecordToEdit(r)} />}
        {recordToDelete && <DeleteConfirmationModal isOpen={!!recordToDelete} onClose={() => setRecordToDelete(null)} onConfirm={handleConfirmDeleteRegistro} />}
        {recordToEdit && <QuickEditRecordModal record={recordToEdit} isOpen={!!recordToEdit} onClose={() => setRecordToEdit(null)} onSave={handleUpdateRegistro} />}
      </AnimatePresence>
      <div className="h-12"></div>
    </div>
  );
}

export default CicloDetalhePage;