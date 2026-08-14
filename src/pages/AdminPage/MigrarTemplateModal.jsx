import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebaseConfig';
import {
  collection, getDocs, query,
  writeBatch, doc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import {
  ArrowRight, GitMerge, Users, AlertTriangle, CheckCircle2,
  ChevronDown, X, Loader2, RefreshCw, Zap, EyeOff,
} from 'lucide-react';

// ─── Status da migração ───────────────────────────────────────────────────────
const STATUS = {
  IDLE:      'idle',
  SCANNING:  'scanning',
  READY:     'ready',
  MIGRATING: 'migrating',
  DONE:      'done',
  ERROR:     'error',
};

// ─── Select de template ───────────────────────────────────────────────────────
const TemplateSelect = ({ label, value, onChange, templates, placeholder, excludeId }) => {
  const [open, setOpen] = useState(false);
  const selected = templates.find(t => t.id === value);
  const options  = templates.filter(t => t.id !== excludeId);

  return (
    <div className="relative">
      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">{label}</p>
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
          value
            ? 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-white'
            : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-400'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {selected?.logoUrl && (
            <img src={selected.logoUrl} className="w-5 h-5 object-contain flex-shrink-0 opacity-80" alt="" />
          )}
          <span className="text-xs font-bold truncate">
            {selected ? selected.titulo : placeholder}
          </span>
          {selected && !selected.ativo && (
            <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-500 rounded-md uppercase">
              Arquivado
            </span>
          )}
        </span>
        <ChevronDown size={14} className={`text-zinc-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full mt-1 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto"
            style={{ scrollbarWidth: 'thin' }}
          >
            {options.length === 0 ? (
              <p className="text-xs text-zinc-400 p-3 text-center">Nenhum template disponível</p>
            ) : (
              options.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onChange(t.id); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                    value === t.id ? 'bg-red-50 dark:bg-red-900/10' : ''
                  }`}
                >
                  {t.logoUrl && <img src={t.logoUrl} className="w-5 h-5 object-contain flex-shrink-0 opacity-80" alt="" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-zinc-800 dark:text-white truncate">{t.titulo}</p>
                    <p className="text-[9px] text-zinc-400 font-mono">{t.id}</p>
                  </div>
                  {!t.ativo && (
                    <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-500 rounded-md uppercase">
                      Arquivado
                    </span>
                  )}
                  {value === t.id && <CheckCircle2 size={12} className="text-red-500 flex-shrink-0" />}
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Modal principal ──────────────────────────────────────────────────────────
const MigrarTemplateModal = ({ isOpen, onClose }) => {
  const [templates, setTemplates]          = useState([]);
  const [deId, setDeId]                    = useState('');
  const [paraId, setParaId]                = useState('');
  const [status, setStatus]                = useState(STATUS.IDLE);
  const [ciclosAfetados, setCiclosAfetados] = useState([]);
  const [log, setLog]                      = useState([]);
  const [erro, setErro]                    = useState('');
  const [scanProgress, setScanProgress]    = useState({ atual: 0, total: 0 });

  // Carrega templates do Firestore
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(collection(db, 'editais_templates'), (snap) => {
      const lista = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(t => !t.deleted)
        .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
      setTemplates(lista);
    });
    return () => unsub();
  }, [isOpen]);

  const resetar = () => {
    setDeId(''); setParaId('');
    setStatus(STATUS.IDLE);
    setCiclosAfetados([]);
    setLog([]);
    setErro('');
    setScanProgress({ atual: 0, total: 0 });
  };

  // ── FASE 1: Varredura manual — sem depender de índice do Firestore ─────────
  // Estratégia:
  //   1. Busca todos os docs de `users` (só os ids, sem dados pesados)
  //   2. Para cada usuário, busca a subcoleção `ciclos`
  //   3. Filtra localmente quais ciclos têm templateOrigem ou editalId == deId
  // Isso funciona 100% sem precisar criar índice no Firestore Console.
  const escanear = useCallback(async () => {
    if (!deId || !paraId || deId === paraId) return;
    setStatus(STATUS.SCANNING);
    setCiclosAfetados([]);
    setLog([]);
    setErro('');

    // Campos onde o id do template pode estar salvo
    const CAMPOS = ['templateOrigem', 'editalId', 'templateId', 'edital_id', 'editalBaseId'];

    try {
      // 1. Todos os usuários
      const usersSnap = await getDocs(collection(db, 'users'));
      const encontrados = [];
      setScanProgress({ atual: 0, total: usersSnap.size });

      // 2. Para cada usuário, busca ciclos
      for (const [idx, userDoc] of usersSnap.docs.entries()) {
        const uid = userDoc.id;
        setScanProgress({ atual: idx + 1, total: usersSnap.size });
        try {
          const ciclosSnap = await getDocs(collection(db, 'users', uid, 'ciclos'));

          ciclosSnap.docs.forEach(cicloDoc => {
            const data = cicloDoc.data();

            // 3. Verifica em qual campo o id do template antigo está
            for (const campo of CAMPOS) {
              if (data[campo] === deId) {
                encontrados.push({
                  ref: cicloDoc.ref,
                  path: cicloDoc.ref.path,
                  data,
                  campoEncontrado: campo,
                  uid,
                });
                break; // já achou neste ciclo, não precisa checar os outros campos
              }
            }
          });
        } catch (e) {
          // Usuário sem subcoleção ciclos — ignora silenciosamente
          console.warn(`[Migrar] uid ${uid} sem ciclos:`, e.message);
        }
      }

      console.log(`[Migrar] Escaneados ${usersSnap.size} usuários → ${encontrados.length} ciclos afetados`);
      setCiclosAfetados(encontrados);
      setStatus(STATUS.READY);
    } catch (e) {
      setErro(`Erro ao escanear: ${e.message}`);
      setStatus(STATUS.ERROR);
    }
  }, [deId, paraId]);

  // ── FASE 2: Migração SILENCIOSA ────────────────────────────────────────────
  // Para cada ciclo:
  // 1. Atualiza templateOrigem para o novo id
  // 2. Copia as disciplinas do template novo para dentro do ciclo
  // 3. Define dismissedUpdateVersion = versão atual do template novo
  //    → o banner NÃO aparece, o usuário não vê nada, tudo acontece por baixo dos panos
  const migrar = useCallback(async () => {
    if (!ciclosAfetados.length || !paraId) return;
    setStatus(STATUS.MIGRATING);
    setLog([]);

    const templateNovo   = templates.find(t => t.id === paraId);
    const disciplinasNovas = templateNovo?.disciplinas || [];

    // Versão atual do template novo (usada para silenciar o banner)
    // Preferimos lastUpdate em milissegundos; fallback para string do id
    const versaoAtual =
      templateNovo?.lastUpdate?.toMillis?.() ||
      templateNovo?.lastUpdate?.seconds      ||
      templateNovo?.version                  ||
      Date.now();

    const novosLogs = [];
    let ok = 0, erros = 0;

    const BATCH_SIZE = 450;
    const chunks = [];
    for (let i = 0; i < ciclosAfetados.length; i += BATCH_SIZE) {
      chunks.push(ciclosAfetados.slice(i, i + BATCH_SIZE));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);

      for (const ciclo of chunk) {
        try {
          const { ref: cicloRef, data, campoEncontrado } = ciclo;

          const updates = {
            // Aponta para o novo template
            [campoEncontrado]: paraId,
            templateOrigem:    paraId,

            // ─── SILÊNCIO: aplica as disciplinas novas diretamente ───────
            // Assim o ciclo já fica "em dia" com o template novo,
            // e o banner de atualização não tem motivo para aparecer.
            disciplinas: disciplinasNovas,

            // Marca o dismissed com a versão atual do template novo,
            // para que useNotifications entenda que o usuário "já viu"
            // (mesmo sem ter visto nada — é exatamente o que queremos)
            dismissedUpdateVersion: versaoAtual,

            // Logo do template novo, se o ciclo não tiver logo próprio
            ...(templateNovo?.logoUrl && !data.logoUrlCustom
              ? { logoUrl: templateNovo.logoUrl }
              : {}),

            // Auditoria
            _migradoEm:    serverTimestamp(),
            _migradoDe:    deId,
            _migradoPara:  paraId,
            _migracaoTipo: 'silenciosa',
          };

          batch.update(cicloRef, updates);
          novosLogs.push({ path: cicloRef.path, status: 'ok', nome: data.nome || '—' });
          ok++;
        } catch (e) {
          novosLogs.push({ path: ciclo.path, status: 'erro', nome: ciclo.data.nome || '—', erro: e.message });
          erros++;
        }
      }

      await batch.commit();
    }

    // Resumo final
    novosLogs.push({
      path: '__resumo__',
      status: erros > 0 ? 'aviso' : 'ok',
      nome: `✅ ${ok} migrados silenciosamente${erros > 0 ? ` | ⚠️ ${erros} falharam` : ''}`,
    });

    setLog(novosLogs);
    setStatus(STATUS.DONE);
  }, [ciclosAfetados, paraId, deId, templates]);

  if (!isOpen) return null;

  const templateDe   = templates.find(t => t.id === deId);
  const templatePara = templates.find(t => t.id === paraId);
  const podeEscanear = deId && paraId && deId !== paraId;
  const podeMigrar   = status === STATUS.READY && ciclosAfetados.length > 0;

  return (
    // z-[9999] garante que fica acima de TUDO (EditaisManager está em z-[200], CustomEditalModal em z-[250])
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-900/75 p-4 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-lg">
              <GitMerge size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                Migrar Template
              </h3>
              <p className="text-[10px] text-zinc-400 font-medium">
                Migração silenciosa — usuários não percebem nada
              </p>
            </div>
          </div>
          <button
            onClick={() => { resetar(); onClose(); }}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Aviso de modo silencioso */}
          <div className="flex items-start gap-2.5 p-3 bg-violet-50 dark:bg-violet-900/10 rounded-xl border border-violet-200 dark:border-violet-900/30">
            <EyeOff size={13} className="text-violet-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[10px] font-black text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                Modo Silencioso Ativo
              </p>
              <p className="text-[10px] text-violet-700 dark:text-violet-300 leading-relaxed">
                As disciplinas do template novo serão copiadas diretamente para cada ciclo. O banner de atualização <strong>não vai aparecer</strong> para os usuários — a troca acontece totalmente por baixo dos panos.
                Após a migração você pode arquivar ou deletar o edital antigo com segurança.
              </p>
            </div>
          </div>

          {/* Seleção de templates */}
          <div className="grid grid-cols-[1fr,auto,1fr] items-end gap-2">
            <TemplateSelect
              label="De (edital origem)"
              value={deId}
              onChange={setDeId}
              templates={templates}
              placeholder="Edital antigo"
              excludeId={paraId}
            />
            <div className="pb-2.5 flex items-center justify-center">
              <ArrowRight size={16} className="text-zinc-400" />
            </div>
            <TemplateSelect
              label="Para (edital destino)"
              value={paraId}
              onChange={setParaId}
              templates={templates}
              placeholder="Edital novo"
              excludeId={deId}
            />
          </div>

          {/* Prévia das disciplinas do destino */}
          {paraId && templates.find(t => t.id === paraId)?.disciplinas?.length > 0 && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1.5">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                Disciplinas que serão aplicadas ({templates.find(t => t.id === paraId).disciplinas.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {templates.find(t => t.id === paraId).disciplinas.slice(0, 10).map((d, i) => (
                  <span
                    key={i}
                    className="text-[9px] font-bold px-2 py-0.5 bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 rounded-md"
                  >
                    {d.nome || d.disciplina || `Disc. ${i + 1}`}
                  </span>
                ))}
                {templates.find(t => t.id === paraId).disciplinas.length > 10 && (
                  <span className="text-[9px] text-zinc-400 font-bold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-md">
                    +{templates.find(t => t.id === paraId).disciplinas.length - 10} mais
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Botão escanear */}
          {[STATUS.IDLE, STATUS.READY, STATUS.ERROR].includes(status) && (
            <button
              onClick={escanear}
              disabled={!podeEscanear}
              className="w-full py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-wide transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <RefreshCw size={13} />
              {status === STATUS.READY ? 'Re-escanear' : 'Escanear Ciclos Afetados'}
            </button>
          )}

          {/* Escaneando */}
          {status === STATUS.SCANNING && (
            <div className="flex flex-col items-center justify-center gap-2 py-4 text-zinc-400">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs font-bold">
                  {scanProgress.total > 0
                    ? `Verificando usuário ${scanProgress.atual} de ${scanProgress.total}…`
                    : 'Carregando usuários…'}
                </span>
              </div>
              {scanProgress.total > 0 && (
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-200"
                    style={{ width: `${Math.round((scanProgress.atual / scanProgress.total) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Resultado do escaneamento */}
          {status === STATUS.READY && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              {ciclosAfetados.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
                  <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                    Nenhum ciclo encontrado para este template. Pode estar limpo!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-900/30">
                    <Users size={14} className="text-amber-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-black text-amber-800 dark:text-amber-200">
                        {ciclosAfetados.length} ciclo{ciclosAfetados.length !== 1 ? 's' : ''} encontrado{ciclosAfetados.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-[9px] text-amber-600 dark:text-amber-400">
                        <strong>{templateDe?.titulo || deId}</strong> → <strong>{templatePara?.titulo || paraId}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Lista de ciclos */}
                  <div
                    className="max-h-32 overflow-y-auto rounded-xl border border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800"
                    style={{ scrollbarWidth: 'thin' }}
                  >
                    {ciclosAfetados.slice(0, 30).map((c, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate flex-1">
                          {c.path}
                        </span>
                        <span className="text-[9px] text-zinc-400 flex-shrink-0 font-bold">
                          {c.campoEncontrado}
                        </span>
                      </div>
                    ))}
                    {ciclosAfetados.length > 30 && (
                      <div className="px-3 py-1.5 text-[9px] text-zinc-400 text-center">
                        + {ciclosAfetados.length - 30} mais...
                      </div>
                    )}
                  </div>

                  {/* Aviso antes de migrar */}
                  <div className="flex items-start gap-2 p-2.5 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-900/30">
                    <AlertTriangle size={11} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[9px] text-red-600 dark:text-red-400 leading-relaxed">
                      Ação irreversível. As disciplinas do novo template serão escritas diretamente nos ciclos. Os usuários <strong>não serão notificados</strong>.
                    </p>
                  </div>

                  <button
                    onClick={migrar}
                    disabled={!podeMigrar}
                    className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wide transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                  >
                    <Zap size={13} strokeWidth={2.5} />
                    Migrar silenciosamente {ciclosAfetados.length} ciclo{ciclosAfetados.length !== 1 ? 's' : ''}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Migrando */}
          {status === STATUS.MIGRATING && (
            <div className="flex items-center justify-center gap-2 py-6 text-zinc-400">
              <Loader2 size={18} className="animate-spin text-red-500" />
              <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300">
                Migrando ciclos silenciosamente…
              </span>
            </div>
          )}

          {/* Concluído */}
          {status === STATUS.DONE && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
                <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-black text-emerald-800 dark:text-emerald-200">
                    Migração silenciosa concluída!
                  </p>
                  <p className="text-[9px] text-emerald-600 dark:text-emerald-400">
                    Nenhum usuário foi notificado. Você já pode deletar o edital antigo com segurança.
                  </p>
                </div>
              </div>

              {/* Log */}
              <div
                className="max-h-36 overflow-y-auto rounded-xl border border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800"
                style={{ scrollbarWidth: 'thin' }}
              >
                {log.filter(l => l.path !== '__resumo__').slice(0, 50).map((l, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-3 py-1.5 ${l.status === 'erro' ? 'bg-red-50 dark:bg-red-900/5' : ''}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${l.status === 'ok' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate flex-1">
                      {l.nome}
                    </span>
                    {l.erro && <span className="text-[9px] text-red-400 truncate">{l.erro}</span>}
                  </div>
                ))}
                {/* Linha de resumo */}
                {log.find(l => l.path === '__resumo__') && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-900">
                    <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-300">
                      {log.find(l => l.path === '__resumo__').nome}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={resetar}
                  className="flex-1 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  Nova Migração
                </button>
                <button
                  onClick={() => { resetar(); onClose(); }}
                  className="flex-1 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          )}

          {/* Erro */}
          {status === STATUS.ERROR && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/30">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300">{erro}</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default MigrarTemplateModal;
