import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { doc, updateDoc } from 'firebase/firestore';
import {
  AlertCircle,
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
  const [modoCompletoTipo, setModoCompletoTipo] = useState(() => (
    initialMode === 'recalculate' ? 'recalculate' : 'edit'
  ));
  const [salvando, setSalvando] = useState(false);
  const [confirmandoFechamento, setConfirmandoFechamento] = useState(false);
  const [nome, setNome] = useState(() => cronograma?.nome || '');
  const [dataFim, setDataFim] = useState(() => cronograma?.dataFim || cronograma?.dataFechamento || '');
  const [modoExibirAssuntos, setModoExibirAssuntos] = useState(() => cronograma?.modoExibirAssuntos !== false);
  const [coresDisciplinasAtivas, setCoresDisciplinasAtivas] = useState(() => cronograma?.coresDisciplinasAtivas !== false);
  if (!cronograma) return null;

  const pedirConfirmacaoFechamento = () => setConfirmandoFechamento(true);

  const confirmarFechamento = () => {
    setConfirmandoFechamento(false);
    onFechar?.();
  };

  const renderConfirmacaoFechamento = () => (
    confirmandoFechamento && (
      <div className="fixed inset-0 z-[21000] flex items-center justify-center bg-zinc-900/60 p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="wizard-confirm-card w-full max-w-sm rounded-[32px] border-2 border-zinc-100 bg-white p-8 text-center shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
            <AlertCircle size={32} className="text-red-600" />
          </div>
          <h3 className="mb-2 text-xl font-black uppercase text-zinc-900 dark:text-white">Descartar alteracoes?</h3>
          <p className="mb-8 text-sm text-zinc-500">
            As alteracoes nao salvas deste cronograma serao perdidas.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setConfirmandoFechamento(false)}
              className="rounded-2xl bg-zinc-100 py-3 text-xs font-bold uppercase tracking-widest text-zinc-900 transition-all hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white"
            >
              Ficar
            </button>
            <button
              type="button"
              onClick={confirmarFechamento}
              className="rounded-2xl bg-red-600 py-3 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-red-700"
            >
              Descartar
            </button>
          </div>
        </motion.div>
      </div>
    )
  );

  if (modoCompleto) {
    const tituloModoCompleto = modoCompletoTipo === 'recalculate'
      ? 'Recalcular cronograma'
      : 'Edicao do cronograma';

    return createPortal(
      <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-zinc-950/80 px-2 py-2 backdrop-blur-sm sm:px-4 sm:py-4">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="flex h-[calc(100dvh-1rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-zinc-200 bg-zinc-50 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:h-[calc(100dvh-2rem)]"
        >
          <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 pr-14 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6 sm:pr-16">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-600">Planejamento</p>
              <h2 className="truncate text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white sm:text-xl">
                {tituloModoCompleto}
              </h2>
            </div>
            <button onClick={pedirConfirmacaoFechamento} className="absolute right-3 top-3 shrink-0 rounded-2xl border border-zinc-200 bg-zinc-50 p-2 text-zinc-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-red-900/50 dark:hover:bg-red-950/20 sm:right-4">
              <X size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <WizardShell
              user={user}
              mode="edit"
              cronogramaId={cronograma.id}
              initialState={cronograma}
              initialStep={2}
              embedded
              onClose={onFechar}
              onCronogramaCriado={(cronogramaId) => onCronogramaAtualizado?.(cronogramaId)}
            />
          </div>
        </motion.div>
        {renderConfirmacaoFechamento()}
      </div>,
      document.body
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
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-zinc-950/70 px-3 py-3 backdrop-blur-sm sm:px-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        className="modal-zoom modal-zoom--cronograma-ajustes relative flex max-h-[calc(100dvh-24px)] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-zinc-200 bg-zinc-50 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="relative overflow-hidden border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6">
          {cronograma.logoUrl && (
            <img
              src={cronograma.logoUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-12 -right-5 h-40 w-40 rotate-[-12deg] object-contain opacity-[0.06] saturate-0 dark:opacity-[0.08]"
            />
          )}
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/20">
                <Settings2 size={21} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-600">Edicao do cronograma</p>
                <h2 className="mt-0.5 text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Ajustes rapidos</h2>
                <p className="mt-1 max-w-xl text-xs font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">Atualize os detalhes visuais do cronograma sem redistribuir blocos, dias ou disciplinas.</p>
              </div>
            </div>
            <button onClick={pedirConfirmacaoFechamento} className="shrink-0 rounded-2xl border border-zinc-200 bg-zinc-50 p-2 text-zinc-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-red-900/50 dark:hover:bg-red-950/20">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 dark:bg-zinc-950 sm:p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="group block rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm transition-all focus-within:border-red-200 focus-within:ring-4 focus-within:ring-red-500/5 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="flex items-center gap-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-50 text-red-600 dark:bg-zinc-800"><FilePenLine size={15} /></span>
                Nome do planejamento
              </span>
              <input
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                className="mt-3 h-11 w-full rounded-2xl border-2 border-zinc-200 bg-zinc-50 px-4 text-sm font-black text-zinc-900 outline-none transition-all focus:border-red-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                placeholder="Ex: Cronograma PMBA"
              />
            </label>

            <label className="group block rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm transition-all focus-within:border-red-200 focus-within:ring-4 focus-within:ring-red-500/5 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="flex items-center gap-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-50 text-red-600 dark:bg-zinc-800"><CalendarDays size={15} /></span>
                Data de termino
              </span>
              <input
                type="date"
                value={dataFim}
                onChange={(event) => setDataFim(event.target.value)}
                className="mt-3 h-11 w-full rounded-2xl border-2 border-zinc-200 bg-zinc-50 px-4 text-sm font-black text-zinc-900 outline-none transition-all focus:border-red-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
            </label>
          </div>

          <label className={`flex items-center justify-between gap-4 rounded-3xl border bg-white p-4 shadow-sm transition-all dark:bg-zinc-900 ${modoExibirAssuntos ? 'border-red-200 ring-4 ring-red-500/5 dark:border-red-900/50' : 'border-zinc-100 dark:border-zinc-800'}`}>
            <div>
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${modoExibirAssuntos ? 'bg-red-600 text-white' : 'bg-zinc-50 text-zinc-400 dark:bg-zinc-800'}`}><BookOpen size={15} /></span>
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-900 dark:text-white">Guia por assunto</p>
              </div>
              <p className="mt-2 text-[11px] font-semibold leading-relaxed text-zinc-500">Mostra o assunto sugerido em cada bloco do cronograma.</p>
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

          <label className={`flex items-center justify-between gap-4 rounded-3xl border bg-white p-4 shadow-sm transition-all dark:bg-zinc-900 ${coresDisciplinasAtivas ? 'border-red-200 ring-4 ring-red-500/5 dark:border-red-900/50' : 'border-zinc-100 dark:border-zinc-800'}`}>
            <div>
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${coresDisciplinasAtivas ? 'bg-red-600 text-white' : 'bg-zinc-50 text-zinc-400 dark:bg-zinc-800'}`}><Palette size={15} /></span>
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-900 dark:text-white">Cores dos blocos</p>
              </div>
              <p className="mt-2 text-[11px] font-semibold leading-relaxed text-zinc-500">Desligue para mostrar as disciplinas em cinza.</p>
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

        <div className="flex flex-col gap-2 border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <button
            onClick={() => {
              setModoCompletoTipo('recalculate');
              setModoCompleto(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2.5 text-[9px] font-black uppercase text-zinc-600 transition hover:bg-white dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Settings2 size={13} />
            Recalcular planejamento
          </button>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
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
      {renderConfirmacaoFechamento()}
    </div>,
    document.body
  );
};

export default ModalEditarCronograma;
