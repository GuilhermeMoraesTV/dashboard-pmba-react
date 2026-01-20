import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom'; // Importante para corrigir a faixa branca
import { auth, db, storage } from '../firebaseConfig.js';
import {
  verifyBeforeUpdateEmail, reauthenticateWithCredential, EmailAuthProvider,
  sendPasswordResetEmail, deleteUser, updateProfile
} from 'firebase/auth';
import {
  collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDocs, writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AnimatePresence, motion } from 'framer-motion';

import {
  User, Save, X, Archive, Loader2, Upload, Trash2,
  Calendar as CalendarIcon, Clock, CheckSquare, Shield, Mail, Key,
  AlertTriangle, ChevronDown, ChevronUp, Camera, Target, Zap,
  ArchiveRestore, Search, LayoutDashboard, ArrowLeft,
  Edit2, AlertOctagon, RotateCw, BookOpen, ChevronLeft, ChevronRight,
  CornerDownRight, Check, Database, History, Calendar
} from 'lucide-react';

// --- UTILITÁRIOS ---

const formatTime = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

const parseDateLocal = (dateString) => {
  if (!dateString) return new Date();
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const dateToYMD = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateDisplay = (dateValue) => {
    if (!dateValue) return 'Data N/A';
    if (dateValue.toDate) return dateValue.toDate().toLocaleDateString('pt-BR');
    return new Date(dateValue).toLocaleDateString('pt-BR');
};

// --- COMPONENTE PORTAL (CORREÇÃO DA FAIXA BRANCA) ---
const Portal = ({ children }) => {
  return createPortal(children, document.body);
};

// --- FUNÇÃO DE LOGO OTIMIZADA ---
const getLogo = (ciclo) => {
  if(!ciclo) return null;
  if(ciclo.logoUrl) return ciclo.logoUrl;

  const searchString = (ciclo.templateOrigem || ciclo.nome || '').toLowerCase();
  const ufs = [
    'ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mt', 'ms', 'mg',
    'pa', 'pb', 'pr', 'pe', 'pi', 'erj', 'rn', 'rs', 'ro', 'rr', 'sc', 'sp', 'se', 'to'
  ];
  const prefixos = ['pm', 'pc', 'cbm', 'bm', 'pp'];
  const especiais = ['gcm', 'aquiraz', 'recife', 'pf', 'prf', 'depen', 'eb', 'fab', 'marinha'];

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
    if(encontrada === 'gcm' || encontrada === 'recife') return '/logosEditais/logo-recife.png';
    return `/logosEditais/logo-${encontrada}.png`;
  }
  return null;
};

// --- COMPONENTE MINI CALENDÁRIO ---
const MiniCalendar = ({ records, selectedDate, onSelectDate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const daysWithData = useMemo(() => {
    const map = {};
    records.forEach(r => { map[r.data] = true; });
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
  for (let i = 1; i <= totalDays; i++) { days.push(new Date(year, month, i)); }

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
        {days.map((date, idx) => {
          if (!date) return <div key={idx} className="h-8 md:h-8" />;
          const dateStr = dateToYMD(date);
          const isSelected = selectedDate === dateStr;
          const hasData = daysWithData[dateStr];
          const isToday = dateToYMD(new Date()) === dateStr;
          return (
            <button key={idx} onClick={() => onSelectDate(dateStr)} className={`h-8 md:h-8 rounded-lg flex flex-col items-center justify-center relative transition-all ${isSelected ? 'bg-red-600 text-white shadow-md shadow-red-500/30' : isToday ? 'bg-zinc-100 dark:bg-zinc-800 text-red-600 font-black border border-red-200 dark:border-red-900/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
              <span className="text-xs font-bold leading-none">{date.getDate()}</span>
              {hasData && (<div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-emerald-500'}`}></div>)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// --- COMPONENTE DE ITEM EXPANSÍVEL DO HISTÓRICO ---
const HistoryItemAccordion = ({ disciplinaNome, records, onEdit, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const totalMinutos = records.reduce((acc, r) => acc + (r.tempoEstudadoMinutos || 0), 0);
  const totalQuestoes = records.reduce((acc, r) => acc + (r.questoesFeitas || 0), 0);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all shadow-sm hover:shadow-md mb-2">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 flex items-center justify-between cursor-pointer bg-zinc-50/30 dark:bg-zinc-800/10 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${isOpen ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-500' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
            <BookOpen size={14} />
          </div>
          <div>
            <h4 className="font-bold text-xs text-zinc-800 dark:text-white line-clamp-1">{disciplinaNome}</h4>
            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wide leading-none mt-0.5">
              <span className="flex items-center gap-0.5"><Clock size={10}/> {formatTime(totalMinutos)}</span>
              {totalQuestoes > 0 && <span className="flex items-center gap-0.5"><CheckSquare size={10}/> {totalQuestoes}</span>}
            </div>
          </div>
        </div>
        <div className="text-zinc-400">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900"
          >
            {records.map((reg, idx) => (
              <div key={reg.id || idx} className="px-3 py-2 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors flex items-center justify-between group">
                <div className="flex-1 min-w-0 mr-2">
                  <div className="flex items-center gap-1.5">
                    <CornerDownRight size={12} className="text-zinc-300 shrink-0" />
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                      {reg.assunto || reg.topicoNome || 'Estudo Geral'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                   <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Clock size={10} className="text-zinc-400"/> {formatTime(reg.tempoEstudadoMinutos)}
                   </span>
                   {reg.questoesFeitas > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${reg.acertos/reg.questoesFeitas >= 0.7 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20'}`}>
                         <Target size={10}/> {reg.acertos}/{reg.questoesFeitas}
                      </span>
                   )}
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

// --- MODAL DE EDIÇÃO RÁPIDA ---
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
    <Portal>
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="relative flex justify-between items-center p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-xl flex items-center justify-center shadow-sm"><Edit2 size={20} /></div>
                <div><h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Editar Registro</h2></div>
            </div>
            <button onClick={onClose} className="relative z-10 p-2 text-zinc-400 hover:text-red-500 hover:bg-white dark:hover:bg-zinc-800 rounded-full transition-all"><X size={20} /></button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-5 overflow-y-auto custom-scrollbar">
            <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Data</label>
                <div className="relative group">
                <CalendarIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors"/>
                <input
                    type="date"
                    name="data"
                    value={formData.data}
                    onChange={handleChange}
                    className="w-full p-2.5 pl-10 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-zinc-700 dark:text-white"
                />
                </div>
            </div>
            <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900/30 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><Clock size={12} className="text-amber-500" /> Tempo Estudado</h3>
                <div className="flex gap-3 items-end">
                <div className="flex-1"><label className="text-[10px] font-semibold text-zinc-500 mb-1 block">Horas</label><input type="number" name="horas" value={formData.horas} onChange={handleChange} min="0" className="w-full p-2 text-center text-lg font-black border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-amber-500 outline-none" /></div>
                <span className="text-zinc-300 font-bold pb-3">:</span>
                <div className="flex-1"><label className="text-[10px] font-semibold text-zinc-500 mb-1 block">Minutos</label><input type="number" name="minutos" value={formData.minutos} onChange={handleChange} min="0" max="59" className="w-full p-2 text-center text-lg font-black border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-amber-500 outline-none" /></div>
                </div>
            </div>
            <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900/30 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><Target size={12} className="text-emerald-500" /> Questões</h3>
                <div className="flex gap-3">
                <div className="flex-1"><label className="text-[10px] font-semibold text-zinc-500 mb-1 block">Feitas</label><input type="number" name="questoesFeitas" value={formData.questoesFeitas} onChange={handleChange} min="0" className="w-full p-2 text-center text-lg font-black border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                <div className="flex-1"><label className="text-[10px] font-semibold text-zinc-500 mb-1 block">Acertos</label><input type="number" name="acertos" value={formData.acertos} onChange={handleChange} min="0" max={formData.questoesFeitas} className="w-full p-2 text-center text-lg font-black border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                </div>
            </div>
            </form>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors uppercase tracking-wide">Cancelar</button>
            <button onClick={handleSave} disabled={loading} className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2">{loading ? 'Salvando...' : <><Save size={16} /> Salvar</>}</button>
            </div>
        </motion.div>
        </div>
    </Portal>
  );
};

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, loading }) => {
  if (!isOpen) return null;
  return (
    <Portal>
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white dark:bg-zinc-950 w-full max-w-xs rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl text-center relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-3"><div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center shadow-inner"><AlertOctagon size={24} /></div></div>
            <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase mb-1">Excluir Registro?</h3>
            <p className="text-xs text-zinc-500 mb-4 px-2">Essa ação não pode ser desfeita.</p>
            <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg font-bold text-[10px] uppercase tracking-wide hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
            <button onClick={onConfirm} disabled={loading} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-wide shadow-md flex items-center justify-center gap-1.5">{loading ? "..." : <><Trash2 size={12} /> Excluir</>}</button>
            </div>
        </motion.div>
        </div>
    </Portal>
  );
};

const MiniCicloCard = ({ ciclo, onClick, registros }) => {
  const logo = getLogo(ciclo);
  const concluidos = ciclo.conclusoes || 0;
  const { totalHoras } = useMemo(() => {
    if (!registros) return { totalHoras: 0, progressoPercent: 0 };
    const minutosTotais = registros.reduce((acc, r) => acc + (r.tempoEstudadoMinutos || 0), 0);
    const horasTotais = Math.round(minutosTotais / 60 * 10) / 10;
    return { totalHoras: horasTotais };
  }, [registros]);

  return (
    <motion.div layout onClick={() => onClick(ciclo.id)} className="group relative bg-white dark:bg-zinc-900/50 rounded-2xl p-4 cursor-pointer border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all hover:border-red-300 dark:hover:border-red-900 hover:shadow-xl flex flex-col justify-between h-full min-h-[140px]">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-red-500 transition-colors duration-300 z-20"></div>
      {logo ? (<div className="absolute -bottom-2 -right-2 w-20 h-20 opacity-20 group-hover:opacity-40 transition-all duration-500 filter saturate-0 group-hover:saturate-100 transform rotate-[-10deg]"><img src={logo} alt="Logo" className="w-full h-full object-contain" /></div>) : (<div className="absolute -bottom-4 -right-4 text-red-500/10 dark:text-red-500/5 transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] z-0 pointer-events-none">{ciclo.ativo ? <Target strokeWidth={1.5} size={80} /> : <BookOpen strokeWidth={1.5} size={80} />}</div>)}
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex justify-between items-start mb-2">
          <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 ${ciclo.ativo ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'}`}>{ciclo.ativo ? 'Ativo' : 'Arquivado'}</div>
          {concluidos > 0 && (<div className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-50 text-amber-600 border border-amber-200 flex items-center gap-1"><RotateCw size={10} /> {concluidos}x</div>)}
        </div>
        <h4 className="font-black text-zinc-900 dark:text-white text-base leading-tight mb-auto line-clamp-2 group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors">{ciclo.nome}</h4>
        <div className="mt-4 pt-2 border-t border-zinc-100 dark:border-zinc-800"><div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"><Clock size={14} className="text-red-500/70" /><span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 text-sm">{totalHoras}h</span><span className="text-[10px] uppercase font-bold opacity-70">Estudadas</span></div></div>
      </div>
    </motion.div>
  );
};

// --- COMPONENTE MODAL ATUALIZADO (COM PORTAL) ---
const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-2xl", headerContent }) => {
  if (!isOpen) return null;

  return (
    <Portal>
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl w-full ${maxWidth} border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden relative`}
            onClick={(e) => e.stopPropagation()}
        >
            {headerContent ? (
            <div className="relative z-10 border-b border-zinc-100 dark:border-zinc-800">
                {headerContent}
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 hover:text-white rounded-full text-white/70 transition-colors"><X size={20} /></button>
            </div>
            ) : (
            <>
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none"><Target size={200} /></div>
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-md z-10">
                    <h3 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 rounded-full text-zinc-400 transition-colors"><X size={24} /></button>
                </div>
            </>
            )}
            <div className="p-0 overflow-y-auto custom-scrollbar flex-1 z-10 bg-zinc-50/30 dark:bg-zinc-900/30">{children}</div>
        </motion.div>
        </div>
    </Portal>
  );
};

const ModalConfirmacaoExclusaoCiclo = ({ ciclo, onClose, onConfirm, loading }) => {
  if (!ciclo) return null;
  return (
    <Portal>
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000] flex justify-center items-center p-4 animate-fade-in" onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white dark:bg-zinc-950 p-0 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-red-500/10 p-6 flex flex-col items-center border-b border-red-500/20"><div className="w-16 h-16 bg-red-500/20 text-red-600 dark:text-red-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(239,68,68,0.4)]"><Trash2 size={32} /></div><h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Excluir Tudo?</h2></div>
            <div className="p-6 text-center">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                    O ciclo <strong className="text-red-600 dark:text-red-400 font-bold">"{ciclo.nome}"</strong> e <strong className="text-red-600">todos os seus registros de estudo</strong> serão apagados permanentemente do sistema.
                    <br/><br/>
                    <span className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 px-2 py-1 rounded border border-red-200 dark:border-red-900">Isso reduzirá seu tempo total acumulado.</span>
                </p>
                <div className="flex gap-3">
                    <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
                    <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2">{loading ? "Apagando..." : "Confirmar Exclusão"}</button>
                </div>
            </div>
        </motion.div>
        </div>
    </Portal>
  );
};

const StatCard = ({ icon: Icon, label, value, subtext, colorClass, delay }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="relative overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
    <div className={`absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity ${colorClass} rotate-12`}><Icon size={100} /></div>
    <div className="relative z-10"><div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colorClass.replace('text-', 'bg-').replace('600', '100').replace('500', '100')} dark:bg-opacity-10`}><Icon size={24} className={colorClass} /></div><h4 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">{value}</h4><p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mt-1">{label}</p>{subtext && <p className="text-[10px] text-zinc-400 mt-2 font-medium">{subtext}</p>}</div>
  </motion.div>
);

// --- NOVO CARD DE CICLO ARQUIVADO (LAYOUT ESTILO MINI CICLO CARD) ---
const ArchivedCycleCard = ({ ciclo, hours, onRestore, onDelete, loading }) => {
    const logo = getLogo(ciclo);
    const dataReferencia = ciclo.dataArquivamento || ciclo.dataCriacao || new Date();

    return (
        <div className="group relative bg-white dark:bg-zinc-900/50 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col justify-between h-full min-h-[160px] hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg transition-all">
            {/* Logo de fundo (Igual MiniCicloCard) */}
            {logo ? (
                <div className="absolute -bottom-2 -right-2 w-20 h-20 opacity-20 group-hover:opacity-40 transition-all duration-500 filter saturate-0 group-hover:saturate-100 transform rotate-[-10deg]">
                    <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                </div>
            ) : (
                <div className="absolute -bottom-4 -right-4 text-red-500/10 dark:text-red-500/5 transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] z-0 pointer-events-none">
                    <Archive strokeWidth={1.5} size={80} />
                </div>
            )}

            <div className="relative z-10 flex flex-col h-full">
                {/* Header Badge */}
                <div className="flex justify-between items-start mb-2">
                     <div className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                        Arquivado
                     </div>
                </div>

                {/* Title */}
                <h4 className="font-black text-zinc-900 dark:text-white text-base leading-tight mb-auto line-clamp-2 group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors">
                    {ciclo.nome}
                </h4>

                {/* Stats */}
                <div className="mt-4 pt-2 border-t border-zinc-100 dark:border-zinc-800 mb-3">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                            <Clock size={14} className="text-red-500/70" />
                            <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 text-sm">{hours}h</span>
                            <span className="text-[10px] uppercase font-bold opacity-70">Registradas</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 text-[10px] font-medium uppercase tracking-wide">
                            <Calendar size={10} /> {formatDateDisplay(dataReferencia)}
                        </div>
                    </div>
                </div>

                {/* Actions (Buttons) */}
                <div className="flex gap-2 mt-auto">
                    <button
                        onClick={() => onRestore(ciclo.id)}
                        className="flex-1 py-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center gap-1"
                    >
                        <ArchiveRestore size={14}/> Restaurar
                    </button>
                    <button
                        onClick={() => onDelete(ciclo)}
                        disabled={loading}
                        className="px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all shadow-sm flex items-center justify-center"
                        title="Excluir Definitivamente"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

function ProfilePage({ user, allRegistrosEstudo = [], onDeleteRegistro }) {
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email || '');

  // --- ESTADOS PARA EDIÇÃO DE NOME ---
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || '');
  const [nameLoading, setNameLoading] = useState(false);

  const [senhaLoading, setSenhaLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(user?.photoURL);
  const [photoLoading, setPhotoLoading] = useState(false);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showArchivesModal, setShowArchivesModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const [recordToDelete, setRecordToDelete] = useState(null);
  const [recordToEdit, setRecordToEdit] = useState(null);

  const [todosCiclos, setTodosCiclos] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState(null);
  const [historySearch, setHistorySearch] = useState('');

  const [selectedDate, setSelectedDate] = useState(dateToYMD(new Date()));

  const [cicloParaExcluir, setCicloParaExcluir] = useState(null);
  const [showDeleteCycleConfirm, setShowDeleteCycleConfirm] = useState(false);
  const [cicloActionLoading, setCicloActionLoading] = useState(false);

  useEffect(() => { if (message.text) { const timer = setTimeout(() => { setMessage({ type: '', text: '' }); }, 5000); return () => clearTimeout(timer); } }, [message]);

  const stats = useMemo(() => {
    const totalRegistros = allRegistrosEstudo.length;
    const totalMinutos = allRegistrosEstudo.reduce((acc, curr) => acc + (curr.tempoEstudadoMinutos || 0), 0);
    const horasTotais = Math.floor(totalMinutos / 60);
    const minutosRestantes = totalMinutos % 60;
    const diasAtivos = Math.floor((Date.now() - new Date(user?.metadata.creationTime).getTime()) / (1000 * 60 * 60 * 24));
    return { totalRegistros, horasTotais, minutosRestantes, diasAtivos };
  }, [allRegistrosEstudo, user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'ciclos'), orderBy('dataCriacao', 'desc'));
    onSnapshot(q, (snap) => setTodosCiclos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, [user]);

  const ciclosArquivados = useMemo(() => todosCiclos.filter(c => c.arquivado === true), [todosCiclos]);

  const groupedHistory = useMemo(() => {
      const groups = {};
      const ciclosMap = new Map(todosCiclos.map(c => [c.id, c]));
      allRegistrosEstudo.forEach(reg => {
          if (reg.cicloId && !ciclosMap.has(reg.cicloId)) return;
          const cid = reg.cicloId || 'sem-ciclo';
          if (!groups[cid]) groups[cid] = { id: cid, cicloInfo: ciclosMap.get(cid), registros: [] };
          groups[cid].registros.push(reg);
      });
      todosCiclos.forEach(c => {
          if (!groups[c.id]) groups[c.id] = { id: c.id, cicloInfo: c, registros: [] };
      });
      return Object.values(groups).filter(g => g.cicloInfo).sort((a, b) => {
          if (a.cicloInfo.ativo && !b.cicloInfo.ativo) return -1;
          if (!a.cicloInfo.ativo && b.cicloInfo.ativo) return 1;
          return 0;
      });
  }, [allRegistrosEstudo, todosCiclos]);

  const activeCycleData = useMemo(() => groupedHistory.find(g => g.id === selectedCycleId), [groupedHistory, selectedCycleId]);

  const filteredRecordsByDiscipline = useMemo(() => {
      if (!selectedCycleId) return {};
      const group = groupedHistory.find(g => g.id === selectedCycleId);
      if (!group) return {};
      const recordsOfDay = group.registros.filter(r => r.data === selectedDate);
      const grouped = {};
      recordsOfDay.forEach(reg => {
          if(!grouped[reg.disciplinaNome]) grouped[reg.disciplinaNome] = [];
          grouped[reg.disciplinaNome].push(reg);
      });
      return grouped;
  }, [groupedHistory, selectedCycleId, selectedDate]);

  const handleConfirmDeleteRegistro = async () => {
      if (!recordToDelete) return;
      try { await deleteDoc(doc(db, 'users', user.uid, 'registrosEstudo', recordToDelete.id)); setRecordToDelete(null); }
      catch (e) { console.error(e); }
  };
  const handleUpdateRegistro = async (id, data) => {
      try { await updateDoc(doc(db, 'users', user.uid, 'registrosEstudo', id), data); }
      catch (e) { console.error(e); }
  };

    const handleUpdateName = async () => {
        if (!newName.trim()) {
            setIsEditingName(false);
            return;
        }
        setNameLoading(true);
        try {
            await updateProfile(auth.currentUser, { displayName: newName });
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                displayName: newName,
                name: newName,
                email: user.email,
                photoURL: user.photoURL || null,
                createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date(),
                updatedAt: new Date()
            }, { merge: true });

            await auth.currentUser.reload();
            setMessage({ type: 'success', text: 'Perfil sincronizado com sucesso!' });
            setIsEditingName(false);
        } catch (error) {
            console.error("Erro ao sincronizar perfil:", error);
            setMessage({ type: 'error', text: 'Erro ao salvar dados.' });
        } finally {
            setNameLoading(false);
        }
    };

    const handleUpdatePhoto = async () => {
        if (!photo) return;
        setPhotoLoading(true);
        try {
          const storageRef = ref(storage, `profile_images/${user.uid}/${photo.name}`);
          const snapshot = await uploadBytes(storageRef, photo);
          const photoURL = await getDownloadURL(snapshot.ref);

          await updateProfile(auth.currentUser, { photoURL });
          await setDoc(doc(db, 'users', user.uid), { photoURL }, { merge: true });

          await auth.currentUser.reload();
          setMessage({ type: 'success', text: 'Foto de perfil atualizada.' });
          setPhoto(null);
        } catch (error) {
            console.error("Erro:", error);
            setMessage({ type: 'error', text: 'Falha ao atualizar foto.' });
        } finally {
            setPhotoLoading(false);
        }
      };

    const handleUpdateEmail = async () => {
      if (!newEmail || newEmail === user.email) return;
      try {
          await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
          setMessage({ type: 'success', text: `Link enviado para ${newEmail}.` });
          setIsEditingEmail(false);
      }
      catch (error) { setMessage({ type: 'error', text: 'Erro ao atualizar e-mail.' }); }
    };

    const handleSendPasswordReset = async () => {
      setSenhaLoading(true);
      try {
          await sendPasswordResetEmail(auth, user.email);
          setMessage({ type: 'success', text: `Link enviado para ${user.email}.` });
      }
      catch (error) { setMessage({ type: 'error', text: 'Erro ao enviar email.' }); } finally { setSenhaLoading(false); }
    };

    const handleDeleteAccount = async () => {
        if(!deletePassword) return;
        try {
            const credential = EmailAuthProvider.credential(user.email, deletePassword);
            await reauthenticateWithCredential(auth.currentUser, credential);
            await deleteUser(auth.currentUser);
        } catch (e) { setMessage({type: 'error', text: 'Senha incorreta.'}); }
    };

    const handleUnarchive = async (id) => { await updateDoc(doc(db, 'users', user.uid, 'ciclos', id), { arquivado: false }); };
    const handleDeletePermanent = (ciclo) => { setCicloParaExcluir(ciclo); setShowDeleteCycleConfirm(true); };

    // --- NOVA LÓGICA DE EXCLUSÃO PROFUNDA ---
    const handleConfirmPermanentDelete = async () => {
        if (!cicloParaExcluir || cicloActionLoading) return;
        const { id, nome } = cicloParaExcluir;
        setCicloActionLoading(true);

        try {
            // 1. Buscar todos os registros vinculados a este ciclo
            const registrosQuery = query(
                collection(db, 'users', user.uid, 'registrosEstudo'),
                where('cicloId', '==', id)
            );
            const snapshot = await getDocs(registrosQuery);

            const batch = writeBatch(db);

            // 2. Adicionar cada registro para deleção no batch
            snapshot.docs.forEach((docRef) => {
                batch.delete(docRef.ref);
            });

            // 3. Deletar o documento do ciclo
            const cicloRef = doc(db, 'users', user.uid, 'ciclos', id);
            batch.delete(cicloRef);

            // 4. Executar o batch
            await batch.commit();

            setMessage({ type: 'success', text: `Ciclo "${nome}" e registros excluídos.` });
        } catch (error) {
            console.error("Erro ao excluir ciclo completo:", error);
            setMessage({ type: 'error', text: `Falha ao excluir ciclo.` });
        } finally {
            setCicloActionLoading(false);
            setShowDeleteCycleConfirm(false);
            setCicloParaExcluir(null);
        }
    };

  if (!user) return <div>Carregando...</div>;

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-20 pt-10 px-4">
      {/* HEADER PERFIL - RESTAURADO (Original) */}
      <div className="flex flex-col md:flex-row items-center md:items-center gap-8 mb-12">
          <div className="relative group/avatar flex-shrink-0">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 shadow-2xl overflow-hidden relative ring-4 ring-zinc-100 dark:ring-zinc-900/50">
                  {photoPreview ? (<img src={photoPreview} alt="User" className="w-full h-full object-cover transition-transform duration-500 group-hover/avatar:scale-110" />) : (<div className="w-full h-full flex items-center justify-center text-zinc-400 bg-zinc-200 dark:bg-zinc-800"><User size={48}/></div>)}
                  <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white opacity-0 group-hover/avatar:opacity-100 transition-all cursor-pointer backdrop-blur-sm">
                      <Camera size={24} className="mb-1" /><span className="text-[9px] font-bold uppercase tracking-widest">Editar</span><input type="file" accept="image/*" onChange={(e) => { if(e.target.files?.[0]) { setPhoto(e.target.files[0]); setPhotoPreview(URL.createObjectURL(e.target.files[0])); } }} className="hidden" />
                  </label>
              </div>
              <div className="absolute bottom-2 right-2 w-6 h-6 bg-emerald-500 border-4 border-white dark:border-zinc-950 rounded-full shadow-sm z-10"></div>
          </div>
          <div className="flex-1 text-center md:text-left space-y-2">
              <div className="inline-block px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Ficha do Usuario</div>

              {/* --- EDIÇÃO DE NOME --- */}
              {!isEditingName ? (
                  <div className="flex items-center justify-center md:justify-start gap-3 group">
                      <h1 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">
                          {user.displayName || 'Usuário'}
                      </h1>
                      <button
                          onClick={() => setIsEditingName(true)}
                          className="p-2 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all bg-zinc-100 dark:bg-zinc-800 rounded-lg"
                          title="Editar Nome"
                      >
                          <Edit2 size={18} />
                      </button>
                  </div>
              ) : (
                  <div className="flex items-center justify-center md:justify-start gap-2 animate-fade-in">
                      <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="text-3xl md:text-4xl font-black bg-transparent border-b-2 border-indigo-500 text-zinc-900 dark:text-white outline-none w-full max-w-sm"
                          autoFocus
                      />
                      <button onClick={handleUpdateName} disabled={nameLoading} className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md transition-colors">
                          {nameLoading ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                      </button>
                      <button onClick={() => { setIsEditingName(false); setNewName(user.displayName); }} className="p-2.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-zinc-300 transition-colors">
                          <X size={20} />
                      </button>
                  </div>
              )}

              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 flex items-center justify-center md:justify-start gap-2"><Mail size={14} className="text-red-600" /> {user.email}</p>
              <AnimatePresence>{photo && (<motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:10}} className="pt-2"><button onClick={handleUpdatePhoto} disabled={photoLoading} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow-lg shadow-red-900/20 flex items-center gap-2 transition-all mx-auto md:mx-0">{photoLoading ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Confirmar Foto</button></motion.div>)}</AnimatePresence>
          </div>
      </div>

      <AnimatePresence>{message.text && (<motion.div initial={{opacity: 0, y: -20}} animate={{opacity: 1, y: 0}} exit={{opacity: 0}} className="fixed top-6 right-6 z-[100]"><div className={`px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 backdrop-blur-md ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'}`}>{message.type === 'success' ? <CheckSquare size={18}/> : <AlertTriangle size={18}/>}<span className="font-bold text-sm">{message.text}</span><button onClick={() => setMessage({type:'', text:''})} className="ml-2 hover:opacity-50"><X size={14}/></button></div></motion.div>)}</AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Clock} label="Tempo Total" value={`${stats.horasTotais}h ${stats.minutosRestantes}m`} subtext="Acumulado" colorClass="text-emerald-600" delay={0.1} />
          <StatCard icon={CheckSquare} label="Registros" value={stats.totalRegistros} subtext="Estudos" colorClass="text-indigo-600" delay={0.2} />
          <StatCard icon={CalendarIcon} label="Dias Ativo" value={stats.diasAtivos} subtext="Desde cadastro" colorClass="text-amber-600" delay={0.3} />
           <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} onClick={() => { setShowHistoryModal(true); setSelectedCycleId(null); setSelectedDate(dateToYMD(new Date())); }} className="relative overflow-hidden bg-zinc-900 dark:bg-white border border-zinc-900 dark:border-white p-6 rounded-2xl shadow-sm group hover:shadow-xl transition-all text-left flex flex-col justify-between min-h-[140px]">
                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><LayoutDashboard size={80} className="text-white dark:text-zinc-900" /></div>
                <div className="relative z-10">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-white/20 dark:bg-zinc-900/10"><LayoutDashboard size={24} className="text-white dark:text-zinc-900" /></div>
                    <h4 className="text-lg font-black text-white dark:text-zinc-900 uppercase leading-none">Histórico de Estudos</h4>
                    <p className="text-[10px] font-bold text-white/60 dark:text-zinc-500 uppercase tracking-wide mt-1 group-hover:translate-x-1 transition-transform">Ver Registros →</p>
                </div>
           </motion.button>
      </div>

      {/* Configurações e Arquivos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
          <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.02] pointer-events-none"><Shield size={300}/></div>
                  <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-8 flex items-center gap-2 relative z-10"><Shield size={16} className="text-red-600"/> Credenciais</h3>
                  <div className="space-y-8 relative z-10">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-8 border-b border-zinc-100 dark:border-zinc-800">
                          <div><h4 className="text-base font-bold text-zinc-800 dark:text-white flex items-center gap-2"><Mail size={16} className="text-zinc-400"/> E-mail</h4><p className="text-xs text-zinc-500 mt-1 max-w-xs">Acesso e comunicações.</p></div>
                          {!isEditingEmail ? (
                              <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-1.5 pl-4 rounded-xl border border-zinc-200 dark:border-zinc-800"><span className="text-sm font-bold text-zinc-600 dark:text-zinc-300">{user.email}</span><button onClick={() => setIsEditingEmail(true)} className="p-2 bg-white dark:bg-zinc-700 hover:text-indigo-500 rounded-lg shadow-sm transition-colors"><div className="sr-only">Editar</div><Upload size={14} className="rotate-90"/></button></div>
                          ) : (
                              <div className="flex gap-2 w-full sm:w-auto animate-fade-in"><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm w-full outline-none focus:ring-2 focus:ring-indigo-500" /><button onClick={handleUpdateEmail} className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"><CheckSquare size={18}/></button><button onClick={() => setIsEditingEmail(false)} className="p-2.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl"><X size={18}/></button></div>
                          )}
                      </div>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div><h4 className="text-base font-bold text-zinc-800 dark:text-white flex items-center gap-2"><Key size={16} className="text-zinc-400"/> Senha</h4><p className="text-xs text-zinc-500 mt-1 max-w-xs">Alteração periódica.</p></div>
                          <button onClick={handleSendPasswordReset} disabled={senhaLoading} className="px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-bold text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-red-500 transition-all flex items-center gap-2 shadow-sm">{senhaLoading ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16} />} Redefinir</button>
                      </div>
                  </div>
              </div>
          </div>

          <div className="space-y-6">
                <div className="bg-zinc-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500"><Archive size={120}/></div>
                    <div className="relative z-10"><h4 className="text-2xl font-black mb-1">{ciclosArquivados.length}</h4><p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">Ciclos Arquivados</p><button onClick={() => setShowArchivesModal(true)} className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 backdrop-blur-sm transition-colors"><Archive size={14}/> Acessar Arquivo</button></div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/5 border border-red-100 dark:border-red-900/20 rounded-3xl overflow-hidden transition-all duration-300">
                    <button onClick={() => setShowDangerZone(!showDangerZone)} className="w-full flex items-center justify-between p-6 text-left group">
                        <div className="flex items-center gap-3"><div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg"><AlertTriangle size={20}/></div><div><h4 className="text-sm font-bold text-red-900 dark:text-red-400 uppercase tracking-wide">Ações Críticas</h4><p className="text-[10px] text-red-700/60 dark:text-red-400/60">Excluir conta</p></div></div>{showDangerZone ? <ChevronUp size={18} className="text-red-400"/> : <ChevronDown size={18} className="text-red-400"/>}
                    </button>
                    <AnimatePresence>{showDangerZone && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-6 pb-6"><div className="p-4 bg-white dark:bg-black/20 rounded-xl border border-red-100 dark:border-red-900/30"><p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed">Esta ação é <strong className="text-red-600">irreversível</strong>.</p>{!showDeleteConfirm ? (<button onClick={() => setShowDeleteConfirm(true)} className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors">Solicitar Exclusão</button>) : (<div className="space-y-3 animate-fade-in"><input type="password" placeholder="Senha atual" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} className="w-full px-3 py-2 text-sm border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 rounded-lg outline-none focus:border-red-500" /><div className="flex gap-2"><button onClick={handleDeleteAccount} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-xs font-bold uppercase">Confirmar</button><button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg text-xs font-bold uppercase">Cancelar</button></div></div>)}</div></motion.div>)}</AnimatePresence>
                </div>
          </div>
      </div>

      {/* --- MODAL HISTÓRICO AVANÇADO --- */}
      <Modal isOpen={showHistoryModal} onClose={() => { setShowHistoryModal(false); setSelectedCycleId(null); }} title={selectedCycleId ? `Histórico: ${activeCycleData?.cicloInfo?.nome}` : "Selecione o Ciclo"} maxWidth="max-w-5xl">
          <div className="p-4 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20 flex items-center gap-3">
              {selectedCycleId && <button onClick={() => { setSelectedCycleId(null); setHistorySearch(''); }} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"><ArrowLeft size={20} className="text-zinc-500"/></button>}
              <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
                  <input type="text" placeholder={selectedCycleId ? "Filtrar por disciplina..." : "Buscar ciclo..."} value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              </div>
          </div>

          <div className="p-4 space-y-3 min-h-[450px] bg-zinc-50/50 dark:bg-black/20">
              {!selectedCycleId ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {groupedHistory.filter(g => g.cicloInfo && g.cicloInfo.nome.toLowerCase().includes(historySearch.toLowerCase())).map((group) => (
                          <MiniCicloCard
                              key={group.id || Math.random()}
                              ciclo={group.cicloInfo}
                              registros={group.registros}
                              onClick={(id) => { setSelectedCycleId(id); setSelectedDate(dateToYMD(new Date())); }}
                          />
                      ))}
                  </div>
              ) : (
                  <div className="flex flex-col md:flex-row gap-6 h-full">
                      <div className="md:w-80 flex-shrink-0">
                          <MiniCalendar
                              records={activeCycleData?.registros || []}
                              selectedDate={selectedDate}
                              onSelectDate={setSelectedDate}
                          />
                      </div>
                      <div className="flex-1 overflow-hidden">
                          <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-black text-zinc-700 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                  <CalendarIcon size={16} className="text-red-500"/>
                                  {parseDateLocal(selectedDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                              </h4>
                          </div>
                          <div className="space-y-3 overflow-y-auto max-h-[400px] custom-scrollbar pr-2">
                              {Object.keys(filteredRecordsByDiscipline).length === 0 && (
                                  <div className="flex flex-col items-center justify-center py-10 text-center opacity-50 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                                      <Clock size={32} className="mb-2 text-zinc-300"/>
                                      <p className="text-sm font-bold text-zinc-500">Sem atividades neste dia.</p>
                                  </div>
                              )}
                              {Object.entries(filteredRecordsByDiscipline).map(([disciplinaNome, records], idx) => (
                                  <HistoryItemAccordion
                                      key={disciplinaNome || idx}
                                      disciplinaNome={disciplinaNome}
                                      records={records}
                                      onEdit={setRecordToEdit}
                                      onDelete={setRecordToDelete}
                                  />
                              ))}
                          </div>
                      </div>
                  </div>
              )}
          </div>
      </Modal>

      {/* MODAIS AUXILIARES */}
      <AnimatePresence>
          {showDeleteCycleConfirm && <ModalConfirmacaoExclusaoCiclo ciclo={cicloParaExcluir} onClose={() => {setShowDeleteCycleConfirm(false); setCicloParaExcluir(null);}} onConfirm={handleConfirmPermanentDelete} loading={cicloActionLoading} />}

          {/* NOVO MODAL DE ARQUIVOS COM HEADER VISUAL */}
          {showArchivesModal && (
            <Modal
                isOpen={showArchivesModal}
                onClose={() => setShowArchivesModal(false)}
                title="Arquivo Morto"
                maxWidth="max-w-5xl"
                headerContent={
                    <div className="p-8 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-4 opacity-10"><Archive size={140}/></div>
                        <div className="relative z-10 flex items-center gap-5">
                            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 backdrop-blur-sm shadow-xl">
                                <Archive size={32} className="text-zinc-200"/>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black uppercase tracking-tight">Arquivo Morto</h2>
                                <p className="text-zinc-400 text-sm mt-1 font-medium">Ciclos finalizados ou descontinuados.</p>
                            </div>
                        </div>
                    </div>
                }
            >
              <div className="p-6 bg-zinc-50 dark:bg-zinc-950/50 min-h-[400px]">
                {ciclosArquivados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl m-4">
                        <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-full mb-4">
                            <History size={32} className="opacity-50"/>
                        </div>
                        <p className="text-sm font-bold uppercase tracking-wide">Nenhum ciclo arquivado</p>
                        <p className="text-xs mt-1 opacity-60">Seus ciclos antigos aparecerão aqui.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ciclosArquivados.map((ciclo, idx) => {
                            // Calcula as horas deste ciclo específico
                            const registrosDoCiclo = allRegistrosEstudo.filter(r => r.cicloId === ciclo.id);
                            const min = registrosDoCiclo.reduce((acc, r) => acc + (r.tempoEstudadoMinutos || 0), 0);
                            const horas = Math.round(min / 60 * 10) / 10;

                            return (
                                <ArchivedCycleCard
                                    key={ciclo.id || idx}
                                    ciclo={ciclo}
                                    hours={horas}
                                    onRestore={handleUnarchive}
                                    onDelete={handleDeletePermanent}
                                    loading={cicloActionLoading}
                                />
                            );
                        })}
                    </div>
                )}
              </div>
            </Modal>
          )}

          {recordToDelete && <DeleteConfirmationModal isOpen={!!recordToDelete} onClose={() => setRecordToDelete(null)} onConfirm={handleConfirmDeleteRegistro} />}
          {recordToEdit && <QuickEditRecordModal record={recordToEdit} isOpen={!!recordToEdit} onClose={() => setRecordToEdit(null)} onSave={handleUpdateRegistro} />}
      </AnimatePresence>
    </div>
  );
}

export default ProfilePage;