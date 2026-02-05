import React, { useState, useMemo } from 'react';
import {
  Trash2, ChevronDown, CheckCircle2, Clock, Minus, Trophy,
  AlertTriangle, Target, Pencil, ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- HELPERS LOCAIS ---
const formatDuration = (minutes) => {
  if (minutes === null || minutes === undefined) return '-';
  const totalSeconds = Math.round(minutes * 60);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

const getScoreColor = (score, type = 'text') => {
  if (score >= 80) return type === 'bg' ? 'bg-emerald-500' : 'text-emerald-600';
  if (score >= 70) return type === 'bg' ? 'bg-blue-500' : 'text-blue-600';
  if (score >= 50) return type === 'bg' ? 'bg-amber-500' : 'text-amber-600';
  return type === 'bg' ? 'bg-red-500' : 'text-red-600';
};

// --- COMPONENTES AUXILIARES ---

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, item }) => {
  if (!isOpen || !item) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md overflow-hidden"
      >
        <div className="bg-red-50 dark:bg-red-900/10 p-6 flex flex-col items-center border-b border-red-100 dark:border-red-800/30">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-500 ring-8 ring-red-50/50 dark:ring-red-900/10">
            <Trash2 size={40} />
          </div>
          <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-1">Excluir Simulado?</h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center">
            Esta ação é irreversível e removerá todos os dados estatísticos associados.
          </p>
        </div>
        <div className="p-6">
          <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800 mb-6 flex items-center gap-4">
            <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <ClipboardList size={24} className="text-zinc-400" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-zinc-400 uppercase">Simulado Selecionado</p>
              <p className="text-sm font-bold text-zinc-800 dark:text-white truncate">{item.titulo}</p>
              <p className="text-xs text-zinc-500">{formatDate(item.data)} • {item.banca || 'Sem banca'}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 rounded-xl font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-3.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 size={18} /> Confirmar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const SimuladoTableRow = ({ item, onDeleteRequest, onEditRequest, compareMode, isSelected, onToggleSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const points = item.resumo.pontosObtidos || 0;
  const badgeColor = getScoreColor(item.resumo.porcentagem, 'bg');

  const stats = useMemo(() => {
    if (!item.disciplinas?.length) return null;
    const sorted = [...item.disciplinas].sort((a, b) => (b.acertos * b.peso) - (a.acertos * a.peso));
    const totalBrancos = item.disciplinas.reduce((acc, curr) => acc + (curr.branco || 0), 0);
    const totalRespondidas = item.resumo.totalQuestoes - totalBrancos;
    const precisao = totalRespondidas > 0 ? (item.resumo.totalAcertos / totalRespondidas) * 100 : 0;
    return { best: sorted[0], worst: sorted[sorted.length - 1], totalBrancos, precisao };
  }, [item]);

  const onRowClick = () => {
    if (compareMode) onToggleSelect();
    else setExpanded(!expanded);
  };

  return (
    <div className={`group transition-all duration-200 border-b border-zinc-100 dark:border-zinc-800 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : expanded ? 'bg-zinc-50 dark:bg-zinc-900/30' : 'bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'}`}>

      {/* MOBILE - ROW PRINCIPAL */}
      <div className="md:hidden px-4 py-3 cursor-pointer select-none" onClick={onRowClick}>
        <div className="flex items-start gap-3">
          {compareMode && <div className={`mt-1 w-5 h-5 min-w-[20px] rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 dark:border-zinc-600'}`}>{isSelected && <CheckCircle2 size={12} />}</div>}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-3">
               <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1 text-center shrink-0">
                        <span className="block text-xs font-bold text-zinc-600">{item.data.split('-')[2]}</span>
                        <span className="block text-[9px] font-bold text-zinc-400 uppercase">{new Date(item.data).toLocaleString('default', { month: 'short' })}</span>
                    </div>
                    <div className="min-w-0">
                        <span className="block font-black text-sm text-zinc-800 dark:text-zinc-100 truncate">{item.titulo}</span>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold uppercase tracking-wider truncate">
                           <span>{item.banca || 'Sem banca'}</span>
                           <span>•</span>
                           <span className="flex items-center gap-1"><Clock size={10}/> {formatDuration(item.durationMinutes)}</span>
                        </div>
                    </div>
                  </div>
               </div>
               <div className="shrink-0 flex flex-col items-end gap-1">
                    <div className={`px-2.5 py-1 rounded-full text-xs font-black ${badgeColor}`}>{item.resumo.porcentagem.toFixed(0)}%</div>

                    {/* AQUI: NOMES COMPLETOS NO MOBILE */}
                    <div className="flex flex-col items-end text-[9px] font-black leading-tight">
                        <span className="text-emerald-600">Acertos {item.resumo.totalAcertos}</span>
                        <span className={`text-zinc-800 dark:text-zinc-100 ${points < 0 ? 'text-red-500' : ''}`}>Pontos {points.toFixed(1)}</span>
                    </div>

                    <div className="text-zinc-400">{expanded ? <Minus size={18} /> : <ChevronDown size={18} />}</div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP - ROW PRINCIPAL */}
      <div className="hidden md:grid grid-cols-12 gap-4 p-4 items-center cursor-pointer select-none" onClick={onRowClick}>
        <div className="col-span-1 text-center"><div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1"><span className="block text-xs font-bold text-zinc-500">{item.data.split('-')[2]}</span><span className="block text-[9px] font-bold text-zinc-400 uppercase">{new Date(item.data).toLocaleString('default', { month: 'short' })}</span></div></div>

        <div className="col-span-3 flex items-center gap-3 overflow-hidden">
            {compareMode && <div className={`w-5 h-5 min-w-[20px] rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 dark:border-zinc-600'}`}>{isSelected && <CheckCircle2 size={12} />}</div>}
            <div className="truncate"><span className="block font-bold text-sm text-zinc-800 dark:text-zinc-200 truncate">{item.titulo}</span><span className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{item.banca || 'Sem Banca'} {item.resumo.totalQuestoes > 0 && <span className="w-1 h-1 rounded-full bg-zinc-300"></span>} {item.resumo.totalQuestoes} Questões</span></div>
        </div>

        <div className="col-span-1 text-center flex flex-col items-center">
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">{formatDuration(item.durationMinutes)}</span>
            <span className="text-[9px] text-zinc-400 uppercase">Tempo</span>
        </div>

        <div className="col-span-2 text-center flex flex-col items-center"><span className="text-xs font-bold text-emerald-600">{item.resumo.totalAcertos}</span><span className="text-[9px] text-zinc-400 uppercase">Acertos</span></div>
        <div className="col-span-2 text-center flex flex-col items-center"><span className={`text-xs font-bold ${points >= 0 ? 'text-zinc-700 dark:text-zinc-300' : 'text-red-500'}`}>{points.toFixed(1)}</span><span className="text-[9px] text-zinc-400 uppercase">Pontos</span></div>
        <div className="col-span-2 text-center flex justify-center"><div className={`px-3 py-1 rounded-full text-xs font-black ${badgeColor}`}>{item.resumo.porcentagem.toFixed(0)}%</div></div>
        <div className="col-span-1 flex justify-center text-zinc-400">{expanded ? <Minus size={18} /> : <ChevronDown size={18} />}</div>
      </div>

      {/* EXPANDED */}
      <AnimatePresence>
        {expanded && !compareMode && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
            <div className="p-4 md:p-6">
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">
                        <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between"><div className="flex items-center gap-2 mb-2 text-emerald-500"><Trophy size={16} /><span className="text-[10px] font-bold text-zinc-400 uppercase">Destaque</span></div><div><p className="font-bold text-zinc-800 dark:text-white text-xs truncate" title={stats.best.nome}>{stats.best.nome}</p><p className="text-[10px] text-zinc-500">{(stats.best.acertos * stats.best.peso).toFixed(1)} pontos</p></div></div>
                        <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between"><div className="flex items-center gap-2 mb-2 text-red-500"><AlertTriangle size={16} /><span className="text-[10px] font-bold text-zinc-400 uppercase">Atenção</span></div><div><p className="font-bold text-zinc-800 dark:text-white text-xs truncate" title={stats.worst.nome}>{stats.worst.nome}</p><p className="text-[10px] text-zinc-500">{(stats.worst.acertos * stats.worst.peso).toFixed(1)} pontos</p></div></div>
                        <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between"><div className="flex items-center gap-2 mb-2 text-blue-500"><Target size={16} /><span className="text-[10px] font-bold text-zinc-400 uppercase">Precisão</span></div><div><p className="font-bold text-zinc-800 dark:text-white text-xl">{stats.precisao.toFixed(0)}%</p><p className="text-[10px] text-zinc-500">Nas respondidas</p></div></div>

                        <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Ações</div>
                            <div className="flex gap-2">
                                <button onClick={(e)=>{e.stopPropagation(); onEditRequest(item)}} className="flex-1 px-3 py-2 rounded-lg text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center justify-center gap-2"><Pencil size={14}/> Editar</button>
                                <button onClick={(e)=>{e.stopPropagation(); onDeleteRequest(item)}} className="flex-1 px-3 py-2 rounded-lg text-xs font-black bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center justify-center gap-2"><Trash2 size={14}/> Excluir</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                    <div className="hidden md:grid grid-cols-12 p-3 bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-center">
                        <div className="col-span-4 text-left pl-2">Disciplina</div><div className="col-span-1">Total</div><div className="col-span-1 text-emerald-600">Acertos</div><div className="col-span-1 text-red-500">Erros</div><div className="col-span-1 text-zinc-400">Branco</div><div className="col-span-1 text-amber-600">Peso</div><div className="col-span-1">Pts</div><div className="col-span-2">Aproveitamento</div>
                    </div>

                    {/* MOBILE - HEADER DO EXPANDED (NOMES COMPLETOS) */}
                    <div className="md:hidden grid grid-cols-12 gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-950 text-[9px] font-black uppercase tracking-tighter text-zinc-400">
                      <div className="col-span-6">Disciplina</div>
                      <div className="col-span-2 text-center">Acertos</div>
                      <div className="col-span-2 text-center">Pontos</div>
                      <div className="col-span-2 text-right">%</div>
                    </div>

                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {item.disciplinas.map((d, i) => {
                            const perc = d.total > 0 ? (d.acertos / d.total) * 100 : 0;
                            const erros = d.total - d.acertos - (d.branco || 0);
                            const pontos = d.acertos * (d.peso || 1);
                            return (
                                <div key={i} className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">

                                    {/* MOBILE - ROW DO EXPANDED (NOMES COMPLETOS) */}
                                    <div className="md:hidden grid grid-cols-12 gap-2 items-center">
                                        <div className="col-span-6 min-w-0">
                                          <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">{d.nome}</div>
                                          <div className="mt-1 text-[9px] text-zinc-500 flex items-center gap-2 tracking-tight">
                                            <span>Erros <b className="text-red-600">{erros}</b></span>
                                            <span>Branco <b className="text-zinc-700 dark:text-zinc-300">{d.branco||0}</b></span>
                                            <span>Peso <b className="text-amber-600">{d.peso}</b></span>
                                          </div>
                                        </div>
                                        <div className="col-span-2 text-center text-xs font-black text-zinc-700 dark:text-zinc-200">{d.acertos}/{d.total}</div>
                                        <div className="col-span-2 text-center text-xs font-black text-zinc-800 dark:text-zinc-100">{pontos.toFixed(1)}</div>
                                        <div className="col-span-2 text-right text-xs font-black text-zinc-600 dark:text-zinc-300">{Math.round(perc)}%</div>
                                        <div className="col-span-12 mt-2 flex items-center gap-2"><div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${perc >= 80 ? 'bg-emerald-500' : perc >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${perc}%` }} /></div></div>
                                    </div>

                                    {/* DESKTOP - ROW DO EXPANDED */}
                                    <div className="hidden md:grid md:grid-cols-12 md:items-center md:text-center">
                                        <div className="md:col-span-4 md:text-left md:pl-2 font-bold text-zinc-700 dark:text-zinc-300 truncate" title={d.nome}>{d.nome}</div>
                                        <div className="md:col-span-1 text-zinc-500">{d.total}</div><div className="md:col-span-1 font-bold text-emerald-600">{d.acertos}</div><div className="md:col-span-1 font-bold text-red-500">{erros}</div><div className="md:col-span-1 text-zinc-400">{d.branco || 0}</div><div className="md:col-span-1 font-bold text-amber-600">{d.peso}</div><div className="md:col-span-1 font-black text-zinc-800 dark:text-white">{pontos.toFixed(1)}</div>
                                        <div className="md:col-span-2 px-2 flex items-center gap-2"><div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${perc >= 80 ? 'bg-emerald-500' : perc >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${perc}%` }} /></div><span className="text-[10px] text-zinc-400 w-6 text-right">{Math.round(perc)}%</span></div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SimuladosList = ({
  filteredSimulados,
  loading,
  onDeleteRequest,
  onEditRequest,
  compareMode,
  selectedIds,
  toggleSelection,
  onConfirmDelete
}) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const handleDeleteClick = (item) => {
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    onConfirmDelete(itemToDelete);
    setDeleteModalOpen(false);
    setItemToDelete(null);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-b-3xl overflow-hidden shadow-sm">
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        item={itemToDelete}
      />

      {/* Header colunas (desktop apenas) */}
      <div className="hidden md:grid grid-cols-12 gap-4 p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
        <div className="col-span-1 text-center">Data</div>
        <div className="col-span-3">Simulado</div>
        <div className="col-span-1 text-center">Tempo</div>
        <div className="col-span-2 text-center">Acertos</div>
        <div className="col-span-2 text-center">Pontos</div>
        <div className="col-span-2 text-center">Precisão %</div>
        <div className="col-span-1 text-center">Detalhes</div>
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {loading ? (
            <div className="py-16 text-center text-zinc-400 font-medium animate-pulse flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            Carregando histórico...
            </div>
        ) : filteredSimulados.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 text-sm">
            Nenhum simulado encontrado para a busca.
            </div>
        ) : (
            filteredSimulados.map((sim) => (
            <SimuladoTableRow
                key={sim.id}
                item={sim}
                onDeleteRequest={handleDeleteClick}
                onEditRequest={onEditRequest}
                compareMode={compareMode}
                isSelected={selectedIds.includes(sim.id)}
                onToggleSelect={() => toggleSelection(sim.id)}
            />
            ))
        )}
      </div>
    </div>
  );
};

export default SimuladosList;