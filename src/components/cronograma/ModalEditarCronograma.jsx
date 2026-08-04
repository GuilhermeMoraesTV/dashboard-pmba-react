import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { doc, updateDoc } from 'firebase/firestore';
import {
  BookOpen, CalendarDays, FilePenLine,
  Loader2, Palette, Settings2, X,
} from 'lucide-react';
import { db } from '../../firebaseConfig';
import WizardShell from './WizardShell';

const ModalEditarCronograma = ({
  user,
  cronograma,
  onFechar,
  onCronogramaAtualizado,
  initialMode = 'simple',
}) => {
  const [modoCompleto, setModoCompleto] = useState(() => initialMode === 'recalculate');
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState(() => cronograma?.nome || '');
  const [dataFim, setDataFim] = useState(() => cronograma?.dataFim || cronograma?.dataFechamento || '');
  const [modoExibirAssuntos, setModoExibirAssuntos] = useState(() => cronograma?.modoExibirAssuntos !== false);
  const [coresDisciplinasAtivas, setCoresDisciplinasAtivas] = useState(() => cronograma?.coresDisciplinasAtivas !== false);
  if (!cronograma) return null;

  if (modoCompleto) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-[50vh] animate-fade-in"
      >
        <WizardShell
          user={user}
          mode="edit"
          cronogramaId={cronograma.id}
          initialState={cronograma}
          initialStep={1}
          onClose={onFechar}
          onCronogramaCriado={(cronogramaId) => onCronogramaAtualizado?.(cronogramaId)}
        />
      </motion.div>
    );
  }

  const handleSalvarRapido = async () => {
    if (!user?.uid || !cronograma?.id) return;
    setSalvando(true);
    try {
      const updatePayload = {
        nome: nome.trim() || cronograma.nome || 'Meu cronograma',
        dataFim: dataFim || null,
        modoExibirAssuntos,
        coresDisciplinasAtivas,
      };

      await updateDoc(doc(db, 'users', user.uid, 'cronogramas', cronograma.id), updatePayload);
      onCronogramaAtualizado?.(cronograma.id);
    } finally {
      setSalvando(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-zinc-950/80 px-4 py-3 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        className="relative max-h-[calc(100dvh-24px)] w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="relative overflow-hidden border-b border-red-700 bg-red-600 px-4 py-3 text-white">
          {cronograma.logoUrl && (
            <img
              src={cronograma.logoUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-10 -right-4 h-36 w-36 rotate-[-12deg] object-contain opacity-20 saturate-0"
            />
          )}
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-100">Edicao simples</p>
              <h2 className="mt-0.5 text-lg font-black uppercase tracking-tight">Ajustes rapidos</h2>
              <p className="mt-1 text-xs font-medium text-red-50/90">Atualize nome, inicio e exibicao sem redistribuir os blocos.</p>
            </div>
            <button onClick={onFechar} className="shrink-0 rounded-lg p-2 text-white/80 transition hover:bg-red-700 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-2.5 overflow-y-auto bg-zinc-50/70 p-3 dark:bg-zinc-950">
          <div className="grid gap-2.5 md:grid-cols-2">
            <label className="block rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                <Settings2 size={13} className="text-red-600" />
                Nome do planejamento
              </span>
              <input
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-3 text-sm font-black text-zinc-900 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                placeholder="Ex: Cronograma PMBA"
              />
            </label>

            <label className="block rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                <CalendarDays size={13} className="text-red-600" />
                Data de termino
              </span>
              <input
                type="date"
                value={dataFim}
                onChange={(event) => setDataFim(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-3 text-sm font-black text-zinc-900 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
            </label>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen size={14} className="text-red-600" />
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-900 dark:text-white">Guia por assunto</p>
              </div>
              <p className="mt-1 text-[10px] font-medium text-zinc-500">Mostra o assunto sugerido em cada bloco do cronograma.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={modoExibirAssuntos}
              onClick={() => setModoExibirAssuntos((current) => !current)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${modoExibirAssuntos ? 'bg-red-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${modoExibirAssuntos ? 'right-1' : 'left-1'}`} />
            </button>
          </label>

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div>
              <div className="flex items-center gap-2">
                <Palette size={14} className="text-red-600" />
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-900 dark:text-white">Cores dos blocos</p>
              </div>
              <p className="mt-1 text-[10px] font-medium text-zinc-500">Desligue para mostrar as disciplinas em cinza.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={coresDisciplinasAtivas}
              onClick={() => setCoresDisciplinasAtivas((current) => !current)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${coresDisciplinasAtivas ? 'bg-red-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${coresDisciplinasAtivas ? 'right-1' : 'left-1'}`} />
            </button>
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <button
            onClick={() => setModoCompleto(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2.5 text-[9px] font-black uppercase text-zinc-600 transition hover:bg-white dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Settings2 size={13} />
            Recalcular planejamento
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onFechar} className="rounded-xl border border-zinc-200 px-3 py-2.5 text-[9px] font-black uppercase text-zinc-500 transition hover:bg-white dark:border-zinc-800 dark:hover:bg-zinc-900">
              Agora nao
            </button>
            <button
              onClick={handleSalvarRapido}
              disabled={salvando}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2.5 text-[9px] font-black uppercase text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando ? <Loader2 size={13} className="animate-spin" /> : <FilePenLine size={13} />}
              Salvar ajustes
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default ModalEditarCronograma;
