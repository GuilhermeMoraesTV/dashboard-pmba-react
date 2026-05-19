import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit2,
  GripVertical,
  Layers,
  Plus,
  Target,
  Trash2,
  X,
} from 'lucide-react';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, description, confirmLabel = 'Excluir', icon: Icon = Trash2 }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="confirm-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: 16 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="bg-white dark:bg-zinc-950 w-full max-w-xs rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-red-50 dark:bg-red-900/10 px-5 pt-6 pb-5 flex flex-col items-center border-b border-red-100 dark:border-red-900/20">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-500/15 rounded-full flex items-center justify-center mb-3 ring-8 ring-red-50 dark:ring-red-900/10">
              <Icon size={26} className="text-red-600 dark:text-red-400" strokeWidth={2} />
            </div>
            <h3 className="text-base font-black text-zinc-900 dark:text-white text-center leading-tight">{title}</h3>
            {description && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center mt-1.5 leading-relaxed">{description}</p>
            )}
          </div>
          <div className="p-4 flex gap-2.5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Trash2 size={13} /> {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

function NivelSelector({ nivelAtual, onNivelChange, configNivel }) {
  const niveis = Object.values(configNivel || {});

  return (
    <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 w-full" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
          <Target size={12} />
          Nivel de Dominio
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
        {niveis.map((nivel) => {
          const ativo = nivelAtual === nivel.id;
          return (
            <button
              key={nivel.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNivelChange(nivel.id);
              }}
              className={[
                'flex-1 rounded-xl px-3 py-3 text-left transition-all',
                ativo
                  ? `${nivel.button} border border-transparent`
                  : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:border-red-200 dark:hover:border-red-900/40',
              ].join(' ')}
            >
              <span className="block text-[11px] font-black uppercase tracking-wide">{nivel.label}</span>
              <span className={`mt-1 block text-[10px] leading-relaxed ${ativo ? 'text-white/90' : 'text-zinc-400 dark:text-zinc-500'}`}>
                {nivel.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const ItemDisciplina = ({
  disciplina,
  aoAtualizar,
  aoRemover,
  formatarHoras,
  tempoSessaoMinutos = 50,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDraggingOver,
  configNivel,
}) => {
  const [expandido, setExpandido] = useState(false);
  const [inputTopico, setInputTopico] = useState('');
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeTemp, setNomeTemp] = useState(disciplina.nome);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const [confirmarRemocaoDisciplina, setConfirmarRemocaoDisciplina] = useState(false);
  const [topicoParaRemover, setTopicoParaRemover] = useState(null);

  const nivelAtual = disciplina.nivelDominio || 'intermediario';
  const configAtual = configNivel?.[nivelAtual] || configNivel?.intermediario;

  useEffect(() => {
    if (editandoNome && inputRef.current) inputRef.current.focus();
  }, [editandoNome]);

  const atualizarNivel = (novoNivel) => {
    const pesoPorNivel = { iniciante: 5, intermediario: 3, avancado: 1 };
    aoAtualizar(disciplina.id, {
      ...disciplina,
      nivelDominio: novoNivel,
      peso: pesoPorNivel[novoNivel] || 3,
    });
  };

  const salvarNome = () => {
    if (nomeTemp.trim()) aoAtualizar(disciplina.id, { ...disciplina, nome: nomeTemp.trim() });
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

  const confirmarRemocaoTopico = () => {
    if (topicoParaRemover === null) return;
    const novosTopicos = disciplina.assuntos.filter((_, i) => i !== topicoParaRemover);
    aoAtualizar(disciplina.id, { ...disciplina, assuntos: novosTopicos });
    setTopicoParaRemover(null);
  };

  const atualizarTextoTopico = (index, texto) => {
    const novosTopicos = [...disciplina.assuntos];
    novosTopicos[index] = texto;
    aoAtualizar(disciplina.id, { ...disciplina, assuntos: novosTopicos });
  };

  const nomeTopicoParaRemover = topicoParaRemover !== null ? disciplina.assuntos?.[topicoParaRemover] : null;

  const handleDragStart = (e) => {
    setIsDragging(true);
    setExpandido(false);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', disciplina.id);
    onDragStart?.(disciplina.id);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onDragEnd?.();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver?.(disciplina.id);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    onDrop?.(disciplina.id);
  };

  const sessoes = Math.max(1, Math.round((disciplina.horasCalculadas * 60) / tempoSessaoMinutos));

  return (
    <>
      <ConfirmModal
        isOpen={confirmarRemocaoDisciplina}
        onClose={() => setConfirmarRemocaoDisciplina(false)}
        onConfirm={() => aoRemover(disciplina.id)}
        title="Remover disciplina?"
        description={`"${disciplina.nome}" e todos os seus assuntos serao removidos do ciclo.`}
        confirmLabel="Remover"
        icon={Trash2}
      />

      <ConfirmModal
        isOpen={topicoParaRemover !== null}
        onClose={() => setTopicoParaRemover(null)}
        onConfirm={confirmarRemocaoTopico}
        title="Remover assunto?"
        description={nomeTopicoParaRemover ? `"${nomeTopicoParaRemover}" sera removido desta disciplina.` : 'Este assunto sera removido.'}
        confirmLabel="Remover"
        icon={X}
      />

      <motion.div
        layout
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={[
          'relative rounded-3xl border transition-all duration-300 overflow-hidden group bg-white dark:bg-zinc-900',
          isDragging
            ? 'opacity-40 scale-[0.98] shadow-none border-zinc-200 dark:border-zinc-800'
            : isDraggingOver
            ? 'border-red-400 ring-2 ring-red-400/30 shadow-lg shadow-red-500/10 -translate-y-1'
            : expandido
            ? 'border-zinc-200 dark:border-zinc-700 shadow-md'
            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm',
        ].join(' ')}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${configAtual?.button?.includes('red') ? 'bg-red-500' : configAtual?.button?.includes('amber') ? 'bg-amber-500' : 'bg-emerald-500'}`} />

        <div
          className="p-4 sm:p-5 flex flex-col gap-4 cursor-pointer"
          onClick={() => !isDragging && setExpandido((value) => !value)}
        >
          <div className="flex items-start gap-3">
            <div
              draggable={false}
              className="mt-1 text-zinc-300 dark:text-zinc-700 cursor-grab active:cursor-grabbing flex items-center hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors shrink-0"
              title="Arrastar para reordenar"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <GripVertical size={18} />
            </div>

            <div className="w-11 h-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <BookOpen size={18} className="text-zinc-500 dark:text-zinc-300" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {editandoNome ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      ref={inputRef}
                      value={nomeTemp}
                      onChange={(e) => setNomeTemp(e.target.value)}
                      onBlur={salvarNome}
                      onKeyDown={(e) => e.key === 'Enter' && salvarNome()}
                      className="w-full bg-zinc-100 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <button onClick={salvarNome} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded shrink-0">
                      <CheckCircle2 size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <h4 className="text-base font-black text-zinc-900 dark:text-white truncate">{disciplina.nome}</h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditandoNome(true);
                      }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all opacity-0 group-hover:opacity-100 md:opacity-100"
                    >
                      <Edit2 size={14} />
                    </button>
                  </>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${configAtual?.badge}`}>
                  {configAtual?.label}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                  <Layers size={12} />
                  {disciplina.assuntos?.length || 0} assuntos
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <div className="text-right rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 px-3 py-2 min-w-[92px]">
                <span className="block text-sm font-black text-zinc-900 dark:text-white">{formatarHoras(disciplina.horasCalculadas)}</span>
                <span className="block text-[10px] font-semibold text-zinc-400 mt-0.5">
                  {sessoes} sessoes
                </span>
              </div>
              <button
                onClick={() => setConfirmarRemocaoDisciplina(true)}
                className="p-2.5 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                title="Remover disciplina"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={() => setExpandido((value) => !value)}
                className="p-2.5 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              >
                {expandido ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {expandido && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-black/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-5 space-y-5">
                <NivelSelector nivelAtual={nivelAtual} onNivelChange={atualizarNivel} configNivel={configNivel} />

                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-2 block">Assuntos da disciplina</label>
                  <form onSubmit={adicionarTopico} className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={inputTopico}
                      onChange={(e) => setInputTopico(e.target.value)}
                      placeholder="Digite um novo assunto..."
                      className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-3 text-sm font-medium focus:ring-2 focus:ring-red-500 outline-none transition-all placeholder:text-zinc-400"
                    />
                    <button
                      type="submit"
                      disabled={!inputTopico.trim()}
                      className="p-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      <Plus size={16} />
                    </button>
                  </form>

                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1 bg-zinc-100/50 dark:bg-black/20 p-2 rounded-xl border border-zinc-200/50 dark:border-zinc-800">
                    {disciplina.assuntos?.map((assunto, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 group/item bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800"
                      >
                        <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full flex-shrink-0" />
                        <input
                          className="flex-1 bg-transparent border-none text-sm text-zinc-700 dark:text-zinc-300 p-0 focus:ring-0 font-medium"
                          value={assunto}
                          onChange={(e) => atualizarTextoTopico(index, e.target.value)}
                        />
                        <button
                          onClick={() => setTopicoParaRemover(index)}
                          className="text-zinc-300 hover:text-red-500 transition-colors shrink-0"
                          title="Remover assunto"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {(!disciplina.assuntos || disciplina.assuntos.length === 0) && (
                      <div className="text-center py-6 text-xs text-zinc-400 italic">Nenhum assunto cadastrado.</div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};

export default ItemDisciplina;
