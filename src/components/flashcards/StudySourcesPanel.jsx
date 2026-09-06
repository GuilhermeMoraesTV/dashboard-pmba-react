import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BookOpen, CheckCircle2, FileText, Folder, FolderPlus, Loader2, NotebookPen, Plus, RotateCcw, Sparkles, Trash2, Upload, X,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig.js';
import {
  createNoteStudySource,
  createStudyFolder,
  deleteStudySource,
  subscribeStudyFolders,
  subscribeStudySources,
  uploadDocumentStudySource,
} from '../../services/studySources/studySourcesService.js';
import { DEFAULT_PRODUCT_LIMITS } from '../../config/productLimits.js';

const STATUS = {
  processing: { label: 'Processando', classes: 'bg-blue-500/10 text-blue-700 dark:text-blue-300', Icon: Loader2 },
  ready: { label: 'Fonte pronta', classes: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', Icon: CheckCircle2 },
  error: { label: 'Erro', classes: 'bg-red-500/10 text-red-700 dark:text-red-300', Icon: X },
};

function readableError(error) {
  const details = typeof error?.details === 'string' ? error.details : (error?.details?.message || '');
  const message = error?.message || error?.code || 'Não foi possível concluir a operação.';
  const raw = details ? `${message} (${details})` : message;
  return String(raw).replace(/^FirebaseError:\s*/i, '').slice(0, 400);
}

export function SourceStatus({ status }) {
  const current = STATUS[status] || STATUS.processing;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${current.classes}`}>
      <current.Icon size={13} className={status === 'processing' ? 'animate-spin' : ''} /> {current.label}
    </span>
  );
}

export function AddSourceModal({ folder, folderId, userId, sources = [], onClose, onCreated, onStartStudy }) {
  const targetFolderId = folder?.id || folderId;
  const targetFolderName = folder?.name || '';
  const [kind, setKind] = useState(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [createdSourceId, setCreatedSourceId] = useState(null);
  const [canonicalSource, setCanonicalSource] = useState(null);
  const [isStartingStudy, setIsStartingStudy] = useState(false);
  const limits = DEFAULT_PRODUCT_LIMITS.studySources;

  // Sincronização canônica e reativa em tempo real com o Firestore via listener
  useEffect(() => {
    if (!createdSourceId || !userId) {
      setCanonicalSource(null);
      return;
    }
    const match = sources.find((s) => s.id === createdSourceId);
    if (match) setCanonicalSource(match);

    const unsub = onSnapshot(doc(db, 'users', userId, 'study_sources', createdSourceId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() || {};
        setCanonicalSource({ id: snap.id, ...data });
      }
    }, (err) => {
      console.error('Erro ao escutar fonte canônica:', err);
    });
    return () => unsub();
  }, [createdSourceId, userId, sources]);

  const save = async () => {
    if (!title.trim()) { setError('Informe um título para a fonte.'); return; }
    if (kind === 'note' && !note.trim()) { setError('Cole ou escreva a anotação.'); return; }
    if (kind === 'document' && !file) { setError('Selecione um arquivo PDF.'); return; }
    setBusy(true);
    setError(null);
    try {
      if (kind === 'note') {
        const res = await createNoteStudySource({ folderId: targetFolderId, title: title.trim(), content: note.trim() });
        if (res?.sourceId) {
          setCreatedSourceId(res.sourceId);
        }
        onCreated?.();
      } else if (kind === 'document') {
        const res = await uploadDocumentStudySource(userId, {
          folderId: targetFolderId,
          title: title.trim(),
          file,
          onProgress: setProgress,
          onPrepared: (prepared) => {
            if (prepared?.sourceId) {
              setCreatedSourceId(prepared.sourceId);
            }
          },
        });
        if (res?.sourceId) {
          setCreatedSourceId(res.sourceId);
        }
        onCreated?.();
      }
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleStartStudy = () => {
    if (isStartingStudy || !canonicalSource || canonicalSource.status !== 'ready') return;
    setIsStartingStudy(true);
    onStartStudy?.(canonicalSource);
    onClose();
  };

  const handleResetForm = () => {
    setCreatedSourceId(null);
    setCanonicalSource(null);
    setTitle('');
    setNote('');
    setFile(null);
    setProgress(0);
    setError(null);
    setKind(null);
    setBusy(false);
    setIsStartingStudy(false);
    onCreated?.();
  };

  const isReady = canonicalSource?.status === 'ready';
  const isProcessing = createdSourceId && (!canonicalSource || canonicalSource.status === 'processing' || busy);
  const isError = canonicalSource?.status === 'error' || (error && createdSourceId);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Adicionar fonte de estudo">
      <div className="w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-card-dark sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            {targetFolderName ? <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600 dark:text-red-400">{targetFolderName}</p> : null}
            <h3 className="mt-1 text-xl font-black text-zinc-950 dark:text-white">
              {isReady ? 'Fonte adicionada' : isProcessing ? 'Processando fonte' : 'Adicionar fonte'}
            </h3>
          </div>
          <button type="button" onClick={onClose} disabled={isStartingStudy} aria-label="Fechar" className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X size={18} /></button>
        </div>

        {/* Estado 1: Fonte Concluída e Pronta para Estudo */}
        {isReady && canonicalSource ? (
          <div className="mt-5 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                  <CheckCircle2 size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-base font-black text-zinc-950 dark:text-white">
                    {canonicalSource.title}
                  </h4>
                  <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    {canonicalSource.kind === 'document' ? 'Documento PDF' : 'Anotação'} · pronta para estudar
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleStartStudy}
                disabled={isStartingStudy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5 text-sm font-black text-white shadow-md shadow-red-600/20 hover:bg-red-700 transition disabled:opacity-50"
              >
                {isStartingStudy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                Estudar com IA agora
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResetForm}
                  disabled={isStartingStudy}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
                >
                  <Plus size={14} />
                  Adicionar outra fonte
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  disabled={isStartingStudy}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
                >
                  Voltar para pasta
                </button>
              </div>
            </div>
          </div>
        ) : isProcessing ? (
          /* Estado 2: Processamento de PDF ou Anotação em Andamento */
          <div className="mt-5 space-y-5 animate-in fade-in duration-200">
            <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-5 text-center dark:border-blue-900/50 dark:bg-blue-950/20">
              <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
                <Loader2 size={24} className="animate-spin" />
              </div>
              <h4 className="mt-4 text-base font-black text-zinc-950 dark:text-white">
                Preparando sua fonte...
              </h4>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Extraindo e organizando o conteúdo
              </p>
              {title && (
                <p className="mt-2 truncate text-xs font-bold text-blue-700 dark:text-blue-300">
                  {title}
                </p>
              )}

              {progress > 0 && progress < 1 && (
                <div className="mt-4 space-y-1">
                  <div className="h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${Math.max(8, progress * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-400">{Math.round(progress * 100)}% enviado</p>
                </div>
              )}
            </div>

            <p className="text-center text-xs text-zinc-400">
              Você pode fechar esta janela; o processamento continuará e a fonte aparecerá na pasta quando pronta.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-zinc-200 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
            >
              Fechar janela (continuar em segundo plano)
            </button>
          </div>
        ) : isError ? (
          /* Estado 3: Erro no Processamento */
          <div className="mt-5 space-y-4 animate-in fade-in duration-200">
            <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900/50 dark:bg-red-950/20">
              <div className="flex items-start gap-3 text-red-700 dark:text-red-300">
                <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Não foi possível processar a fonte</h4>
                  <p className="mt-1 text-xs">{canonicalSource?.errorMessage || error || 'Ocorreu um erro ao processar o material.'}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={handleResetForm}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white shadow-md shadow-red-600/20 hover:bg-red-700 transition"
              >
                <RotateCcw size={14} />
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-zinc-200 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
              >
                Voltar para pasta
              </button>
            </div>
          </div>
        ) : !kind ? (
          /* Estado 4: Escolha do Tipo de Fonte */
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setKind('note')} className="rounded-2xl border border-zinc-200 p-5 text-left transition hover:border-red-300 hover:bg-red-50/60 dark:border-zinc-700 dark:hover:border-red-800 dark:hover:bg-red-950/20">
              <NotebookPen className="text-red-600" size={24} />
              <span className="mt-3 block font-bold text-zinc-900 dark:text-white">Colar anotação</span>
              <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">O texto original fica privado e o chunking ocorre no backend.</span>
            </button>
            <button type="button" onClick={() => setKind('document')} className="rounded-2xl border border-zinc-200 p-5 text-left transition hover:border-blue-300 hover:bg-blue-50/60 dark:border-zinc-700 dark:hover:border-blue-800 dark:hover:bg-blue-950/20">
              <Upload className="text-blue-600" size={24} />
              <span className="mt-3 block font-bold text-zinc-900 dark:text-white">Enviar PDF</span>
              <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">Reutiliza o pipeline seguro de upload, extração e chunks.</span>
            </button>
          </div>
        ) : (
          /* Estado 5: Formulário de Entrada (Anotação ou PDF) */
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              Título
              <input value={title} maxLength={limits.maxTitleChars} onChange={(event) => setTitle(event.target.value)} disabled={busy} className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/15 dark:border-zinc-700 dark:text-white" placeholder={kind === 'note' ? 'Ex.: Princípios do Direito Administrativo' : 'Ex.: Edital PMBA 2026'} />
            </label>
            {kind === 'note' ? (
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                Anotação
                <textarea value={note} maxLength={limits.maxNoteChars} onChange={(event) => setNote(event.target.value)} disabled={busy} rows={8} className="mt-1.5 w-full resize-y rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/15 dark:border-zinc-700 dark:text-white" placeholder="Cole aqui o conteúdo que será a autoridade factual do estudo…" />
                <span className="mt-1 block text-right text-[11px] font-normal text-zinc-400">{note.length.toLocaleString('pt-BR')} / {limits.maxNoteChars.toLocaleString('pt-BR')}</span>
              </label>
            ) : (
              <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 p-4 text-center dark:border-blue-800 dark:bg-blue-950/20">
                <FileText size={24} className="text-blue-600" />
                <span className="mt-2 text-sm font-bold text-zinc-900 dark:text-white">{file?.name || 'Selecionar PDF'}</span>
                <span className="mt-1 text-xs text-zinc-500">Somente application/pdf dentro do limite configurado.</span>
                <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={busy} onChange={(event) => setFile(event.target.files?.[0] || null)} />
              </label>
            )}
            {error ? <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
            <div className="flex justify-between gap-3 pt-2">
              <button type="button" onClick={() => setKind(null)} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Voltar</button>
              <button type="button" onClick={save} disabled={busy || !title.trim() || (kind === 'note' ? !note.trim() : !file)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50 transition">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Salvar fonte
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudySourcesPanel({ userId }) {
  const [folders, setFolders] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState('PMBA 2026');
  const [addingSource, setAddingSource] = useState(false);
  const [error, setError] = useState(null);
  const [deletingSourceId, setDeletingSourceId] = useState(null);

  useEffect(() => subscribeStudyFolders(userId, setFolders, (err) => setError(readableError(err))), [userId]);
  useEffect(() => subscribeStudySources(userId, setSources, (err) => setError(readableError(err))), [userId]);
  useEffect(() => {
    if (!selectedFolderId && folders[0]?.id) setSelectedFolderId(folders[0].id);
    if (selectedFolderId && !folders.some((folder) => folder.id === selectedFolderId)) setSelectedFolderId(folders[0]?.id || null);
  }, [folders, selectedFolderId]);

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) || null;
  const folderSources = useMemo(() => sources.filter((source) => source.folderId === selectedFolderId), [selectedFolderId, sources]);

  const saveFolder = async () => {
    if (!folderName.trim()) return;
    setCreatingFolder(true);
    setError(null);
    try {
      const folder = await createStudyFolder({ name: folderName.trim(), description: 'Pasta principal de fontes acadêmicas.' });
      setSelectedFolderId(folder.id);
      setFolderName('');
    } catch (err) {
      setError(readableError(err));
    } finally {
      setCreatingFolder(false);
    }
  };

  const removeSource = async (source) => {
    if (!window.confirm(`Excluir a fonte “${source.title}” e seu conteúdo original?`)) return;
    setDeletingSourceId(source.id);
    setError(null);
    try {
      await deleteStudySource(source.id);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setDeletingSourceId(null);
    }
  };

  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-white via-white to-red-50/60 shadow-sm dark:border-zinc-800 dark:from-card-dark dark:via-card-dark dark:to-red-950/20">
      <div className="border-b border-zinc-200/70 p-5 dark:border-zinc-800 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-950 dark:text-white sm:text-3xl">Flashcards</h1>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-red-600 dark:text-red-400">Organização mínima</p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-black text-zinc-950 dark:text-white"><Folder size={22} className="text-red-600" /> Pastas de Estudos</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Escolha uma pasta e adicione a fonte factual que dará origem ao estudo.</p>
          </div>
          <div className="flex gap-2">
            <input value={folderName} onChange={(event) => setFolderName(event.target.value)} maxLength={120} className="min-w-0 rounded-xl border border-zinc-300 bg-white/80 px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-white" placeholder="Nome da pasta" />
            <button type="button" onClick={saveFolder} disabled={creatingFolder || !folderName.trim()} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50 dark:bg-white dark:text-zinc-900"><FolderPlus size={15} /> Criar pasta</button>
          </div>
        </div>
        {error ? <p role="alert" className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
        {folders.length ? (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {folders.map((folder) => <button key={folder.id} type="button" onClick={() => setSelectedFolderId(folder.id)} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition ${folder.id === selectedFolderId ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'}`}>{folder.name}</button>)}
          </div>
        ) : null}
      </div>

      <div className="p-5 sm:p-6">
        {selectedFolder ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h3 className="font-black text-zinc-900 dark:text-white">{selectedFolder.name}</h3><p className="text-xs text-zinc-500">{folderSources.length} {folderSources.length === 1 ? 'fonte' : 'fontes'}</p></div>
              <button type="button" onClick={() => setAddingSource(true)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-red-600/20 hover:bg-red-700"><Plus size={15} /> Adicionar fonte</button>
            </div>
            {folderSources.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {folderSources.map((source) => (
                  <article key={source.id} className={`rounded-2xl border bg-white p-4 dark:bg-card-dark ${source.status === 'ready' ? 'border-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.08)] dark:border-emerald-900' : 'border-zinc-200 dark:border-zinc-800'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">{source.kind === 'note' ? <NotebookPen size={18} className="shrink-0 text-red-600" /> : <FileText size={18} className="shrink-0 text-blue-600" />}<h4 className="truncate font-bold text-zinc-900 dark:text-white">{source.title}</h4></div>
                      <SourceStatus status={source.status} />
                    </div>
                    {source.status === 'ready' ? <p className="mt-3 flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={16} /> Pronto para estudar</p> : null}
                    {source.status === 'ready' && source.processingWarning ? <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> {source.processingWarning}</p> : null}
                    {source.status === 'processing' ? <p className="mt-3 animate-pulse text-xs text-blue-600 dark:text-blue-300">Extraindo, validando e organizando a fonte…</p> : null}
                    {source.status === 'error' ? <p className="mt-3 text-xs text-red-600 dark:text-red-300">{source.errorMessage || 'Não foi possível processar esta fonte.'}</p> : null}
                    <div className="mt-4 flex gap-2">
                      <button type="button" disabled className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-100 px-3 py-2.5 text-xs font-bold text-zinc-500 disabled:cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-400"><BookOpen size={14} /> Tutor adaptativo será ativado na próxima etapa</button>
                      <button type="button" onClick={() => removeSource(source)} disabled={deletingSourceId === source.id} aria-label={`Excluir fonte ${source.title}`} className="rounded-xl border border-zinc-200 px-3 text-zinc-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-red-950/30">{deletingSourceId === source.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800"><NotebookPen size={28} className="mx-auto text-zinc-400" /><p className="mt-2 text-sm font-bold text-zinc-700 dark:text-zinc-200">Esta pasta ainda não tem fontes</p><p className="mt-1 text-xs text-zinc-500">Adicione uma anotação ou um PDF para preparar o estudo.</p></div>}
          </>
        ) : <div className="py-8 text-center"><Folder size={32} className="mx-auto text-zinc-300 dark:text-zinc-600" /><p className="mt-2 font-bold text-zinc-700 dark:text-zinc-200">Crie sua primeira Pasta de Estudos</p><p className="mt-1 text-sm text-zinc-500">O nome “PMBA 2026” já está sugerido acima.</p></div>}
      </div>
      {addingSource && selectedFolder ? <AddSourceModal folder={selectedFolder} userId={userId} onClose={() => setAddingSource(false)} /> : null}
    </section>
  );
}
