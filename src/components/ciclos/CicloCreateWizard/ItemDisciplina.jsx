import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, CheckCircle2, Edit2, Layers, Star, Trash2, ChevronUp, ChevronDown, Plus, X, GripVertical } from 'lucide-react';

const ItemDisciplina = ({ disciplina, aoAtualizar, aoRemover, configPeso, formatarHoras }) => {
    const [expandido, setExpandido] = useState(false);
    const [inputTopico, setInputTopico] = useState('');
    const [editandoNome, setEditandoNome] = useState(false);
    const [nomeTemp, setNomeTemp] = useState(disciplina.nome);
    const inputRef = useRef(null);

    const pesoAtual = disciplina.peso || 3;
    const configAtual = configPeso[pesoAtual] || configPeso[3];

    useEffect(() => {
        if (editandoNome && inputRef.current) inputRef.current.focus();
    }, [editandoNome]);

    const atualizarPeso = (novoPeso) => aoAtualizar(disciplina.id, { ...disciplina, peso: novoPeso });

    const salvarNome = () => {
        if (nomeTemp.trim()) aoAtualizar(disciplina.id, { ...disciplina, nome: nomeTemp });
        else setNomeTemp(disciplina.nome);
        setEditandoNome(false);
    };

    const adicionarTopico = (e) => {
        e.preventDefault();
        if (!inputTopico.trim()) return;
        const novosTopicos = [...(disciplina.assuntos || []), inputTopico.trim()];
        aoAtualizar(disciplina.id, { ...disciplina, assuntos: novosTopicos });
        setInputTopico('');
    };

    const removerTopico = (index) => {
        const novosTopicos = disciplina.assuntos.filter((_, i) => i !== index);
        aoAtualizar(disciplina.id, { ...disciplina, assuntos: novosTopicos });
    };

    const atualizarTextoTopico = (index, texto) => {
        const novosTopicos = [...disciplina.assuntos];
        novosTopicos[index] = texto;
        aoAtualizar(disciplina.id, { ...disciplina, assuntos: novosTopicos });
    };

    return (
        <motion.div layout className={`bg-white dark:bg-zinc-900 border transition-all duration-300 rounded-xl overflow-hidden shadow-sm mb-3 ${expandido ? 'border-red-500/50 ring-1 ring-red-500/20 shadow-md' : 'border-zinc-200 dark:border-zinc-800 hover:border-red-300'}`}>
            {/* CABEÇALHO */}
            <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:items-center cursor-pointer select-none" onClick={() => setExpandido(!expandido)}>
                <div className="text-zinc-300 dark:text-zinc-700 cursor-move hidden sm:block"><GripVertical size={16} /></div>

                <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-400"><BookOpen size={16} /></div>
                        {editandoNome ? (
                            <div className="flex-1 flex items-center gap-2">
                                <input ref={inputRef} value={nomeTemp} onChange={(e) => setNomeTemp(e.target.value)} onBlur={salvarNome} onKeyDown={(e) => e.key === 'Enter' && salvarNome()} className="w-full bg-zinc-100 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500" />
                                <button onClick={salvarNome} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"><CheckCircle2 size={16}/></button>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center gap-2 group/edit">
                                <h4 className="text-sm font-bold text-zinc-800 dark:text-white truncate">{disciplina.nome}</h4>
                                <button onClick={(e) => { e.stopPropagation(); setEditandoNome(true); }} className="opacity-0 group-hover/edit:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-opacity"><Edit2 size={12} /></button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 pl-8">
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-zinc-500"><Layers size={10}/> {disciplina.assuntos?.length || 0} Assuntos</span>
                        <span className="w-px h-3 bg-zinc-200 dark:bg-zinc-700"></span>
                        <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                    key={star}
                                    size={12}
                                    className={`${star <= pesoAtual ? `${configAtual.fill} ${configAtual.color}` : 'text-zinc-300 dark:text-zinc-700 fill-zinc-200 dark:fill-zinc-800'}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
                    <div className="text-right">
                        <span className="block text-xs font-black text-zinc-800 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                            {formatarHoras(disciplina.horasCalculadas)}
                        </span>
                    </div>
                    <div className="flex gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-3 ml-3 sm:ml-0 sm:border-l-0 sm:pl-0">
                        <button onClick={() => aoRemover(disciplina.id)} className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        <button onClick={() => setExpandido(!expandido)} className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">{expandido ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {expandido && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-black/20" onClick={e => e.stopPropagation()}>
                        <div className="p-4 sm:p-5 space-y-4 sm:space-y-6">

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Prioridade de Estudo</label>
                                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${configAtual.bg} ${configAtual.color}`}>
                                        {configAtual.label} ({pesoAtual}/5)
                                    </span>
                                </div>
                                <div className="flex items-center justify-between bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                onClick={() => atualizarPeso(star)}
                                                className="focus:outline-none transition-transform hover:scale-110 active:scale-95 group"
                                            >
                                                <Star
                                                    size={24}
                                                    className={`transition-colors ${star <= pesoAtual ? `${configAtual.fill} ${configAtual.color}` : 'text-zinc-300 dark:text-zinc-600 fill-transparent'}`}
                                                    strokeWidth={star <= pesoAtual ? 0 : 2}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                    <span className="text-xs text-zinc-400 font-medium hidden sm:block text-right">
                                        {configAtual.description}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-2 block">Assuntos do Edital</label>
                                <form onSubmit={adicionarTopico} className="flex gap-2 mb-3">
                                    <input type="text" value={inputTopico} onChange={(e) => setInputTopico(e.target.value)} placeholder="Digite um novo tópico..." className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-red-500 outline-none transition-all placeholder:text-zinc-400"/>
                                    <button type="submit" disabled={!inputTopico.trim()} className="p-2 bg-zinc-900 dark:bg-zinc-700 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"><Plus size={16} /></button>
                                </form>
                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1 bg-zinc-100/50 dark:bg-black/20 p-2 rounded-lg border border-zinc-200/50 dark:border-zinc-800">
                                    {disciplina.assuntos && disciplina.assuntos.map((assunto, index) => (
                                        <div key={index} className="flex items-center gap-2 group/item bg-white dark:bg-zinc-900 p-2 rounded border border-zinc-100 dark:border-zinc-800">
                                            <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full flex-shrink-0"></div>
                                            <input className="flex-1 bg-transparent border-none text-xs text-zinc-700 dark:text-zinc-300 p-0 focus:ring-0 font-medium" value={assunto} onChange={(e) => atualizarTextoTopico(index, e.target.value)} />
                                            <button onClick={() => removerTopico(index)} className="text-zinc-300 hover:text-red-500 transition-colors"><X size={14} /></button>
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

export default ItemDisciplina;