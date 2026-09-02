import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, BrainCircuit, CheckCircle2, FileText, Layers3, Loader2,
  RefreshCw, Sparkles, Trash2, Upload, XCircle,
} from 'lucide-react';
import {
  deleteUserDocument,
  reprocessUserDocument,
  subscribeUserDocuments,
  uploadPdfDocument,
} from '../../services/documents/documentsService.js';
import { importAnkiPackage } from '../../services/anki/ankiService.js';
import {
  getGeneratedItems,
} from '../../services/ai/aiService.js';
import { ANKI_IMPORT_ENABLED } from '../../config/featureFlags.js';
import { DEFAULT_PRODUCT_LIMITS } from '../../config/productLimits.js';

const STATUS = {
  pending: { label: 'Na fila', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', icon: Loader2 },
  processing: { label: 'Processando', className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300', icon: Loader2 },
  processed: { label: 'Pronto', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
  error: { label: 'Erro', className: 'bg-red-500/10 text-red-700 dark:text-red-300', icon: XCircle },
};

function readableError(error) {
  const message = String(error?.message || 'Não foi possível concluir a operação.');
  return message.replace(/^FirebaseError:\s*/i, '').slice(0, 500);
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function plainText(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function StatusPill({ status }) {
  const config = STATUS[status] || STATUS.pending;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${config.className}`}>
      <Icon size={13} className={status === 'processing' || status === 'pending' ? 'animate-spin' : ''} />
      {config.label}
    </span>
  );
}

function DocumentCard({ document, busyAction, onDelete, onReprocess }) {
  const isBusy = busyAction?.documentId === document.id;
  const processingIsStale = document.status === 'processing'
    && document.processingStartedAt instanceof Date
    && Date.now() - document.processingStartedAt.getTime() >= DEFAULT_PRODUCT_LIMITS.documents.processingLeaseMs;
  const canReprocess = document.status === 'error' || document.status === 'pending' || processingIsStale;
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText size={18} className="shrink-0 text-blue-600 dark:text-blue-400" />
            <h3 className="truncate font-semibold text-slate-900 dark:text-white">{document.name}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {formatBytes(document.fileSizeBytes)}
            {document.pageCount ? ` · ${document.pageCount} páginas` : ''}
            {document.chunkCount ? ` · ${document.chunkCount} chunks` : ''}
          </p>
        </div>
        <StatusPill status={document.status} />
      </div>

      {document.processingWarning ? (
        <p className="mt-3 flex gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {document.processingWarning}
        </p>
      ) : null}
      {document.errorMessage ? (
        <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">{document.errorMessage}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canReprocess ? (
          <button type="button" disabled={isBusy} onClick={() => onReprocess(document.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">
            <RefreshCw size={13} /> Reprocessar
          </button>
        ) : null}
        <button type="button" disabled={isBusy} onClick={() => onDelete(document)} className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400">
          <Trash2 size={13} /> Excluir
        </button>
      </div>
      {isBusy ? <p className="mt-2 text-xs text-slate-500">{busyAction.label}</p> : null}
    </article>
  );
}

function GeneratedItemCard({ item }) {
  const labels = { flashcard: 'Flashcard', question: 'Questão', summary: 'Resumo' };
  const title = item.content?.front || item.content?.statement || item.content?.title || labels[item.type] || 'Item gerado';
  const detail = item.content?.back || item.content?.summary || item.content?.subject || '';
  return (
    <article className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">{labels[item.type] || item.type}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.status}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">{plainText(title)}</p>
      {detail ? <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{plainText(detail)}</p> : null}
    </article>
  );
}

export default function DocumentsPage({ user }) {
  const [documents, setDocuments] = useState([]);
  const [generatedItems, setGeneratedItems] = useState([]);
  const [activeView, setActiveView] = useState('documents');
  const [uploadProgress, setUploadProgress] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [message, setMessage] = useState(null);
  const [ankiResult, setAnkiResult] = useState(null);

  const refreshGeneratedItems = useCallback(async () => {
    if (!user?.uid) return;
    const items = await getGeneratedItems(user.uid);
    setGeneratedItems(items.slice(0, 20));
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const unsubscribe = subscribeUserDocuments(user.uid, setDocuments, (error) => setMessage({ type: 'error', text: readableError(error) }));
    void refreshGeneratedItems().catch((error) => setMessage({ type: 'error', text: readableError(error) }));
    return unsubscribe;
  }, [refreshGeneratedItems, user?.uid]);

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user?.uid) return;
    setMessage(null);
    setUploadProgress(0);
    try {
      await uploadPdfDocument(user.uid, file, { onProgress: setUploadProgress });
      setMessage({ type: 'success', text: 'PDF enviado e processado com segurança.' });
    } catch (error) {
      setMessage({ type: 'error', text: readableError(error) });
    } finally {
      setUploadProgress(null);
    }
  };

  const handleDelete = async (document) => {
    if (!window.confirm(`Excluir o PDF “${document.name}” e seus dados de processamento?`)) return;
    setBusyAction({ documentId: document.id, label: 'Excluindo documento…' });
    try {
      await deleteUserDocument(document.id);
      setMessage({ type: 'success', text: 'Documento excluído.' });
      await refreshGeneratedItems();
    } catch (error) {
      setMessage({ type: 'error', text: readableError(error) });
    } finally {
      setBusyAction(null);
    }
  };

  const handleReprocess = async (documentId) => {
    setBusyAction({ documentId, label: 'Reprocessando PDF…' });
    try {
      await reprocessUserDocument(documentId);
      setMessage({ type: 'success', text: 'PDF reprocessado.' });
    } catch (error) {
      setMessage({ type: 'error', text: readableError(error) });
    } finally {
      setBusyAction(null);
    }
  };

  const handleAnkiImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user?.uid) return;
    setAnkiResult(null);
    setMessage(null);
    setUploadProgress(0);
    try {
      const result = await importAnkiPackage(user.uid, file, { onProgress: setUploadProgress });
      setAnkiResult(result);
      setMessage({ type: 'success', text: 'Pacote Anki importado. A reimportação preserva o progresso existente.' });
    } catch (error) {
      setMessage({ type: 'error', text: readableError(error) });
    } finally {
      setUploadProgress(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 sm:py-6">
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Biblioteca privada</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">Documentos e importação</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">Processe PDFs, gere rascunhos com IA e importe decks do Anki sem expor seus arquivos.</p>
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button type="button" onClick={() => setActiveView('documents')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${activeView === 'documents' ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-300'}`}>PDFs</button>
          {ANKI_IMPORT_ENABLED ? <button type="button" onClick={() => setActiveView('anki')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${activeView === 'anki' ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-300'}`}>Anki</button> : null}
        </div>
      </header>

      {message ? (
        <div role="status" className={`mb-4 rounded-xl px-4 py-3 text-sm ${message.type === 'error' ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>{message.text}</div>
      ) : null}

      {activeView === 'documents' ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
          <section>
            <label className="mb-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/60 p-5 text-center transition hover:border-blue-500 dark:border-blue-800 dark:bg-blue-950/20">
              {uploadProgress !== null ? <Loader2 size={26} className="animate-spin text-blue-600" /> : <Upload size={26} className="text-blue-600 dark:text-blue-400" />}
              <span className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{uploadProgress !== null ? `Enviando ${Math.round(uploadProgress * 100)}%` : 'Selecionar PDF'}</span>
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">Upload direto ao Storage, sem Base64. OCR não é aplicado automaticamente.</span>
              <input className="sr-only" type="file" accept="application/pdf,.pdf" disabled={uploadProgress !== null} onChange={handlePdfUpload} />
            </label>
            <div className="space-y-3">
              {documents.length ? documents.map((document) => (
                <DocumentCard key={document.id} document={document} busyAction={busyAction} onDelete={handleDelete} onReprocess={handleReprocess} />
              )) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">Nenhum PDF enviado.</div>
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-violet-600 dark:text-violet-400" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Rascunhos gerados</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Flashcards e resumos aguardam aprovação. Questões permanecem privadas.</p>
            <div className="mt-4 space-y-2 [content-visibility:auto]">
              {generatedItems.length ? generatedItems.map((item) => <GeneratedItemCard key={item.id} item={item} />) : <p className="py-6 text-center text-xs text-slate-500">Nenhum rascunho gerado.</p>}
            </div>
          </aside>
        </div>
      ) : (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
          <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/60 p-6 text-center transition hover:border-violet-500 dark:border-violet-800 dark:bg-violet-950/20">
            {uploadProgress !== null ? <Loader2 size={30} className="animate-spin text-violet-600" /> : <Layers3 size={30} className="text-violet-600 dark:text-violet-400" />}
            <span className="mt-3 font-semibold text-slate-900 dark:text-white">{uploadProgress !== null ? `Importando ${Math.round(uploadProgress * 100)}%` : 'Selecionar pacote .apkg'}</span>
            <span className="mt-2 max-w-md text-xs text-slate-500 dark:text-slate-400">Compatível com collections Anki legadas e Zstd. Templates são sanitizados e JavaScript nunca é executado.</span>
            <input className="sr-only" type="file" accept=".apkg,application/zip,application/octet-stream" disabled={uploadProgress !== null} onChange={handleAnkiImport} />
          </label>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex items-center gap-2">
              <BrainCircuit size={18} className="text-violet-600 dark:text-violet-400" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Resultado da importação</h2>
            </div>
            {ankiResult ? (
              <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <p><strong>{ankiResult.cardsAdded || 0}</strong> novos · <strong>{ankiResult.cardsUpdated || 0}</strong> atualizados · <strong>{ankiResult.cardsSkipped || 0}</strong> ignorados</p>
                <p>{ankiResult.deckCount || 0} decks · {ankiResult.mediaImported || 0} mídias · {ankiResult.collectionFormat}</p>
                {ankiResult.warnings?.length ? (
                  <div className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                    <p className="mb-2 font-semibold">Avisos</p>
                    <ul className="space-y-1 pl-4">
                      {ankiResult.warnings.map((warning, index) => <li key={`${warning}-${index}`} className="list-disc">{warning}</li>)}
                    </ul>
                  </div>
                ) : <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={16} /> Importação sem avisos.</p>}
              </div>
            ) : <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">O resumo e eventuais avisos aparecerão aqui. Na reimportação, o conteúdo muda sem reiniciar cards estudados.</p>}
          </div>
        </section>
      )}
    </main>
  );
}
