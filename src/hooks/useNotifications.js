import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../firebaseConfig';
import {
  collection, query, where, onSnapshot, orderBy, limit,
  doc, getDoc, getDocs, updateDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { CATALOGO_EDITAIS } from '../pages/AdminPage/EditaisManager';
import { normalizeNotification } from '../services/notificationContract';
import { respondToGroupEntryRequest } from '../services/groupMembership';

// =======================================================
// HELPERS E ALGORITMOS DE MATCHING (INTELIGÊNCIA)
// =======================================================
const normStr = (s) =>
  s ? String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() : '';

const toMillisSafe = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const getAuthCreatedAtMillis = (user) => (
  toMillisSafe(user?.metadata?.creationTime) ||
  toMillisSafe(user?.metadata?.createdAt) ||
  null
);

const levenshtein = (a, b) => {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
};

const similarEnough = (a, b) => {
  if (!a || !b) return false;
  const nA = normStr(a);
  const nB = normStr(b);
  if (nA === nB) return true;
  if (nA.includes(nB) || nB.includes(nA)) return true;
  const minLen = Math.min(nA.length, nB.length);
  let common = 0;
  while (common < minLen && nA[common] === nB[common]) common++;
  if (minLen >= 4 && common / minLen >= 0.6) return true;
  return levenshtein(nA, nB) <= Math.floor(Math.max(nA.length, nB.length) * 0.35);
};

const gerarHashConteudo = (disciplinas = [], apenasAtivos = false) =>
  disciplinas
    .filter((d) => !apenasAtivos || d.inCiclo !== false)
    .map((d) => {
      const assuntos = (d.assuntos || [])
        .filter((a) => !apenasAtivos || (typeof a === 'object' ? a.inCiclo !== false : true))
        .map((a) => normStr(typeof a === 'string' ? a : a.nome || ''))
        .filter(Boolean)
        .sort()
        .join('|');
      return `${normStr(d.templateNome || d.nome)}:${assuntos}`;
    })
    .sort()
    .join(';;');

// =======================================================
// ALGORITMO DE RECONCILIAÇÃO (Disciplinas e Assuntos)
// =======================================================
const matchAssuntos = (assuntosCiclo, assuntosTemplate) => {
    const matchedCicloIdxs = new Set();
    const matchedTemplateIdxs = new Set();
    const pairs = [];

    // 1. Exato
    assuntosTemplate.forEach((at, tIdx) => {
        const keyT = normStr(at);
        const cIdx = assuntosCiclo.findIndex((ac, i) => !matchedCicloIdxs.has(i) && normStr(ac) === keyT);
        if (cIdx !== -1) {
            matchedCicloIdxs.add(cIdx);
            matchedTemplateIdxs.add(tIdx);
            pairs.push({ oldName: assuntosCiclo[cIdx], newName: at, oldIdx: cIdx, newIdx: tIdx });
        }
    });

    // 2. Fuzzy
    assuntosTemplate.forEach((at, tIdx) => {
        if (matchedTemplateIdxs.has(tIdx)) return;
        const keyT = normStr(at);
        const cIdx = assuntosCiclo.findIndex((ac, i) => !matchedCicloIdxs.has(i) && similarEnough(keyT, normStr(ac)));
        if (cIdx !== -1) {
            matchedCicloIdxs.add(cIdx);
            matchedTemplateIdxs.add(tIdx);
            pairs.push({ oldName: assuntosCiclo[cIdx], newName: at, oldIdx: cIdx, newIdx: tIdx });
        }
    });

    // 3. Fallback Index (Se sobrou 2 órfãos de cada lado e os tamanhos batem, ele assume q foi um Rename brutal)
    const unmappedTemplateFallback = assuntosTemplate.filter((_, i) => !matchedTemplateIdxs.has(i));
    const unmappedCicloFallback = assuntosCiclo.filter((_, i) => !matchedCicloIdxs.has(i));

    if (unmappedTemplateFallback.length > 0 && unmappedTemplateFallback.length === unmappedCicloFallback.length) {
        unmappedTemplateFallback.forEach((at, iterIdx) => {
            const ac = unmappedCicloFallback[iterIdx];
            const cIdx = assuntosCiclo.indexOf(ac);
            const tIdx = assuntosTemplate.indexOf(at);
            matchedCicloIdxs.add(cIdx);
            matchedTemplateIdxs.add(tIdx);
            pairs.push({ oldName: ac, newName: at, oldIdx: cIdx, newIdx: tIdx });
        });
    }

    const unmappedTemplate = assuntosTemplate.filter((_, i) => !matchedTemplateIdxs.has(i));
    const unmappedCiclo = assuntosCiclo.filter((_, i) => !matchedCicloIdxs.has(i));

    return { pairs, unmappedTemplate, unmappedCiclo };
};

const mapDisciplines = (disciplinasCiclo, disciplinasTemplate) => {
    const matchedCicloIds = new Set();
    const matchedTemplateIdxs = new Set();
    const pairs = [];

    // 1. Exato por templateNome ou nome
    disciplinasTemplate.forEach((dt, tIdx) => {
        const keyT = normStr(dt.nome);
        const match = disciplinasCiclo.find(dc =>
            !matchedCicloIds.has(dc.id) &&
            (normStr(dc.templateNome) === keyT || normStr(dc.nome) === keyT)
        );
        if (match) {
            matchedCicloIds.add(match.id);
            matchedTemplateIdxs.add(tIdx);
            pairs.push({ cicloDisc: match, templateDisc: dt });
        }
    });

    // 2. Fuzzy match
    disciplinasTemplate.forEach((dt, tIdx) => {
        if (matchedTemplateIdxs.has(tIdx)) return;
        const keyT = normStr(dt.nome);
        const match = disciplinasCiclo.find(dc =>
            !matchedCicloIds.has(dc.id) &&
            (similarEnough(keyT, normStr(dc.templateNome)) || similarEnough(keyT, normStr(dc.nome)))
        );
        if (match) {
            matchedCicloIds.add(match.id);
            matchedTemplateIdxs.add(tIdx);
            pairs.push({ cicloDisc: match, templateDisc: dt });
        }
    });

    // 3. Fallback Posicional (Array Length Match)
    const unmappedTemplateFallback = disciplinasTemplate.filter((_, i) => !matchedTemplateIdxs.has(i));
    const unmappedCicloFallback = disciplinasCiclo.filter(dc => !matchedCicloIds.has(dc.id));

    if (unmappedTemplateFallback.length > 0 && unmappedTemplateFallback.length === unmappedCicloFallback.length) {
        unmappedTemplateFallback.forEach((dt, iterIdx) => {
            const dc = unmappedCicloFallback[iterIdx];
            const tIdx = disciplinasTemplate.indexOf(dt);
            matchedCicloIds.add(dc.id);
            matchedTemplateIdxs.add(tIdx);
            pairs.push({ cicloDisc: dc, templateDisc: dt });
        });
    }

    const unmappedTemplate = disciplinasTemplate.filter((_, i) => !matchedTemplateIdxs.has(i));
    const unmappedCiclo = disciplinasCiclo.filter(dc => !matchedCicloIds.has(dc.id));

    return { pairs, unmappedTemplate, unmappedCiclo, matchedCicloIds, matchedTemplateIdxs };
};

const calcularDiff = (disciplinasAtuais = [], disciplinasTemplate = []) => {
  const ativas = disciplinasAtuais.filter((d) => d.inCiclo !== false);
  const { pairs, unmappedTemplate, unmappedCiclo } = mapDisciplines(ativas, disciplinasTemplate);

  const novasDisciplinas = unmappedTemplate.map(dt => ({ nome: dt.nome, totalAssuntos: (dt.assuntos || []).length }));

  const disciplinasRemovidas = unmappedCiclo
      .filter(dc => dc.templateNome) // Ignora extras do aluno
      .map(dc => ({ nome: dc.nome }));

  const disciplinasRenomeadas = [];
  const disciplinasComNovosAssuntos = [];
  const disciplinasComAssuntosRemovidos = [];
  const assuntosRenomeadosGeral = [];

  pairs.forEach(({ cicloDisc, templateDisc }) => {
      if (normStr(cicloDisc.nome) !== normStr(templateDisc.nome)) {
          disciplinasRenomeadas.push({ id: cicloDisc.id, oldName: cicloDisc.nome, newName: templateDisc.nome });
      }

      const assuntosUsuario = (cicloDisc.assuntos || [])
          .filter(a => typeof a === 'object' ? a.inCiclo !== false : true)
          .map(a => typeof a === 'string' ? a : a.nome || '');

      const assuntosTemplate = (templateDisc.assuntos || []).map(a => typeof a === 'string' ? a : a.nome || '');

      const { pairs: topicPairs, unmappedTemplate: unmappedT, unmappedCiclo: unmappedC } = matchAssuntos(assuntosUsuario, assuntosTemplate);

      topicPairs.forEach(tp => {
          if (normStr(tp.oldName) !== normStr(tp.newName)) {
              assuntosRenomeadosGeral.push({ disciplina: templateDisc.nome, oldName: tp.oldName, newName: tp.newName });
          }
      });

      if (unmappedT.length > 0) disciplinasComNovosAssuntos.push({ nome: templateDisc.nome, novosAssuntos: unmappedT });
      if (unmappedC.length > 0) disciplinasComAssuntosRemovidos.push({ nome: cicloDisc.nome, assuntosRemovidos: unmappedC });
  });

  const totalMudancas =
    novasDisciplinas.length +
    disciplinasRemovidas.length +
    disciplinasRenomeadas.length +
    assuntosRenomeadosGeral.length +
    disciplinasComNovosAssuntos.reduce((a, d) => a + d.novosAssuntos.length, 0) +
    disciplinasComAssuntosRemovidos.reduce((a, d) => a + d.assuntosRemovidos.length, 0);

  return {
    novasDisciplinas,
    disciplinasRemovidas,
    disciplinasRenomeadas,
    disciplinasComNovosAssuntos,
    disciplinasComAssuntosRemovidos,
    assuntosRenomeadosGeral,
    totalMudancas,
  };
};

export const getTemplateIdDoCiclo = (cicloData) => {
  for (const id of [cicloData.templateId, cicloData.templateOrigem, cicloData.editalId, cicloData.edital_id, cicloData.editalBaseId]) {
    if (id && id !== 'manual' && id !== '') return id;
  }
  return null;
};

const _templateCache = new Map();

export const buscarDadosTemplateFresh = async (templateId) => {
  let resultado = null;
  try {
    const tSnap = await getDoc(doc(db, 'editais_templates', templateId));
    if (tSnap.exists() && !tSnap.data().deleted) {
      resultado = { ...tSnap.data(), _origem: 'firestore' };
    }
  } catch {}

  if (!resultado) {
    const seed = CATALOGO_EDITAIS.find((e) => e.id === templateId);
    if (seed?.disciplinas?.length) {
      resultado = {
        disciplinas: seed.disciplinas.map((d) => ({
          nome: d.nome || '',
          assuntos: (d.assuntos || []).map((a) => (typeof a === 'string' ? a : a?.nome || '')).filter(Boolean),
          peso: d.peso || 3,
        })),
        titulo: seed.titulo,
        banca: seed.banca || '',
        logoUrl: seed.logoUrl || seed.logo || null,
        _origem: 'seed',
      };
    }
  }
  _templateCache.set(templateId, resultado);
  return resultado;
};

export const invalidarCacheTemplate = (templateId) => _templateCache.delete(templateId);

const derivarVersionKey = (tData) => {
  if (!tData) return '';
  if (tData.lastUpdate?.seconds) return `v_${tData.lastUpdate.seconds}`;
  if (tData.version) return tData.version;
  return `h_${gerarHashConteudo(tData.disciplinas || [], false)}`;
};

const agruparAtualizacoesPorEdital = (updates = []) => {
  const grupos = new Map();

  updates.forEach((item) => {
    const groupKey = `${item.templateId || item.id}_${item.versionKey || 'sem-versao'}`;
    const existente = grupos.get(groupKey);
    if (!existente) {
      grupos.set(groupKey, {
        ...item,
        id: `edital_${item.templateId || item.cicloId}_${item.versionKey || 'sem-versao'}`,
        groupKey,
        isGrouped: true,
        ciclosAfetados: [item],
        ciclosAfetadosCount: 1,
        cicloNomeOriginal: item.cicloNome,
      });
      return;
    }

    existente.ciclosAfetados.push(item);
    existente.ciclosAfetadosCount = existente.ciclosAfetados.length;
    const nomeEdital = item.templateData?.titulo || existente.templateData?.titulo || existente.cicloNomeOriginal || existente.cicloNome;
    existente.cicloNome = `${nomeEdital} (${existente.ciclosAfetadosCount} ciclos)`;
    if ((item.timestamp?.getTime?.() || 0) > (existente.timestamp?.getTime?.() || 0)) {
      existente.timestamp = item.timestamp;
    }
  });

  return Array.from(grupos.values()).map((item) => {
    if (item.ciclosAfetadosCount <= 1) return { ...item, isGrouped: false };
    const nomeEdital = item.templateData?.titulo || item.cicloNomeOriginal || item.cicloNome;
    return {
      ...item,
      cicloNome: `${nomeEdital} (${item.ciclosAfetadosCount} ciclos)`,
    };
  });
};

// =======================================================
// HOOK PRINCIPAL
// =======================================================
export const useNotifications = (user) => {
  const [broadcasts, setBroadcasts] = useState([]);
  const [editalUpdates, setEditalUpdates] = useState([]);
  const [dismissedHistory, setDismissedHistory] = useState([]);
  const [readBroadcasts, setReadBroadcasts] = useState(new Set());
  const [deletedNotifs, setDeletedNotifs] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [operationalNotifications, setOperationalNotifications] = useState([]);
  const [userCreatedAtMillis, setUserCreatedAtMillis] = useState(null);

  const ciclosRef = useRef([]);
  const templateUnsubsRef = useRef({});
  const editalUpdatesRef = useRef({});
  const checkLocksRef = useRef({});
  const pendingCheckRef = useRef({});
  const debounceTimersRef = useRef({});
  const debounceOrigemRef = useRef({});

  useEffect(() => {
    if (!user) {
      setUserCreatedAtMillis(null);
      return;
    }

    const authMillis = getAuthCreatedAtMillis(user);
    if (authMillis) {
      setUserCreatedAtMillis(authMillis);
      return;
    }

    let alive = true;
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        if (!alive) return;
        const data = snap.exists() ? snap.data() : {};
        setUserCreatedAtMillis(
          toMillisSafe(data.createdAt) ||
          toMillisSafe(data.dataCriacao) ||
          toMillisSafe(data.created_at) ||
          null
        );
      })
      .catch(() => {
        if (alive) setUserCreatedAtMillis(null);
      });

    return () => { alive = false; };
  }, [user]);

  // 1. Sync Cross-Tab e Load inicial do LocalStorage
  useEffect(() => {
    if (!user) return;

    const loadLocal = () => {
      try {
        setReadBroadcasts(new Set(JSON.parse(localStorage.getItem(`notif_read_${user.uid}`) || '[]')));
        setDeletedNotifs(new Set(JSON.parse(localStorage.getItem(`notif_deleted_${user.uid}`) || '[]')));
        const hist = JSON.parse(localStorage.getItem(`notif_dismissed_history_${user.uid}`) || '[]');
        setDismissedHistory(hist.map((h) => ({
            ...h,
            _type: h._type || 'edital_update',
            timestamp: h.timestamp ? new Date(h.timestamp) : null,
            dismissedAt: h.dismissedAt ? new Date(h.dismissedAt) : null,
        })));
      } catch (e) {
        console.warn('Erro ao ler notif do localstorage', e);
      }
    };

    loadLocal();

    const handleStorage = (e) => {
        if (e.key === `notif_read_${user.uid}` || e.key === `notif_deleted_${user.uid}` || e.key === `notif_dismissed_history_${user.uid}`) {
            loadLocal();
        }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [user]);

  // 2. Load Broadcasts
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'system_broadcasts'), where('active', '==', true), orderBy('timestamp', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      const createdAtMillis = userCreatedAtMillis || getAuthCreatedAtMillis(user);
      setBroadcasts(
        snap.docs.map((d) => ({
            id: d.id, ...d.data(),
            timestamp: d.data().timestamp?.toDate?.() || new Date(d.data().createdAt || Date.now()),
            _type: 'broadcast',
          })).filter((b) => {
            if (b.targetUid) return b.targetUid === user.uid;
            if (Array.isArray(b.targetUserIds) && b.targetUserIds.length > 0 && !b.targetUserIds.includes(user.uid)) return false;
            const broadcastMillis = toMillisSafe(b.timestamp);
            if (createdAtMillis && broadcastMillis && broadcastMillis < createdAtMillis) return false;
            return true;
          })
      );
    });
    return () => unsub();
  }, [user, userCreatedAtMillis]);

  // 3. Checagem de Editais
  useEffect(() => {
    if (!user) return;
    const publicarUpdates = () => setEditalUpdates(Object.values(editalUpdatesRef.current));

    const executarChecagem = async (ciclo, tData) => {
      if (checkLocksRef.current[ciclo.id]) {
        pendingCheckRef.current[ciclo.id] = { ciclo, tData };
        return;
      }
      checkLocksRef.current[ciclo.id] = true;

      try {
        if (!tData?.disciplinas?.length) {
          if (editalUpdatesRef.current[ciclo.id]) { delete editalUpdatesRef.current[ciclo.id]; publicarUpdates(); }
          return;
        }

        const versionKey = derivarVersionKey(tData);
        if (ciclo.dismissedUpdateVersion === versionKey || ciclo.syncedVersion === versionKey) {
          if (editalUpdatesRef.current[ciclo.id]) { delete editalUpdatesRef.current[ciclo.id]; publicarUpdates(); }
          return;
        }

        const existente = editalUpdatesRef.current[ciclo.id];
        if (existente?.versionKey === versionKey) return;

        const discSnap = await getDocs(collection(db, 'users', user.uid, 'ciclos', ciclo.id, 'disciplinas'));
        const disciplinasAtuais = discSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const templateHash = gerarHashConteudo(tData.disciplinas, false);
        const cicloHash = gerarHashConteudo(disciplinasAtuais, true);

        if (templateHash === cicloHash) {
          if (editalUpdatesRef.current[ciclo.id]) { delete editalUpdatesRef.current[ciclo.id]; publicarUpdates(); }
          if (ciclo.syncedVersion !== versionKey) {
            try { await updateDoc(doc(db, 'users', user.uid, 'ciclos', ciclo.id), { syncedVersion: versionKey }); } catch {}
          }
          return;
        }

        const diff = calcularDiff(disciplinasAtuais, tData.disciplinas);
        if (diff.totalMudancas === 0) {
          if (editalUpdatesRef.current[ciclo.id]) { delete editalUpdatesRef.current[ciclo.id]; publicarUpdates(); }
          if (ciclo.syncedVersion !== versionKey) {
            try { await updateDoc(doc(db, 'users', user.uid, 'ciclos', ciclo.id), { syncedVersion: versionKey }); } catch {}
          }
          return;
        }

        editalUpdatesRef.current[ciclo.id] = {
          id: `edital_${ciclo.id}`, _type: 'edital_update',
          cicloId: ciclo.id, cicloNome: ciclo.nome, cicloLogo: ciclo.logoUrl || null, cicloAtivo: ciclo.ativo === true,
          templateId: getTemplateIdDoCiclo(ciclo), templateData: tData, templateDate: tData.lastUpdate?.toDate?.() || null,
          diff, versionKey, timestamp: tData.lastUpdate?.toDate?.() || new Date(), isDismissed: false,
        };

        publicarUpdates();
      } catch (err) {
        console.error(`[useNotifications] erro "${ciclo.nome}":`, err);
      } finally {
        checkLocksRef.current[ciclo.id] = false;
        const pending = pendingCheckRef.current[ciclo.id];
        if (pending) { delete pendingCheckRef.current[ciclo.id]; executarChecagem(pending.ciclo, pending.tData); }
      }
    };

    const agendarChecagem = (ciclo, tData, origemTemplate = false) => {
      const key = ciclo.id;
      const origemAtual = debounceOrigemRef.current[key];
      if (debounceTimersRef.current[key] && origemAtual === 'template' && !origemTemplate) return;
      if (debounceTimersRef.current[key]) clearTimeout(debounceTimersRef.current[key]);

      debounceOrigemRef.current[key] = origemTemplate ? 'template' : 'ciclo';
      debounceTimersRef.current[key] = setTimeout(() => {
        delete debounceTimersRef.current[key];
        delete debounceOrigemRef.current[key];
        executarChecagem(ciclo, tData);
      }, 500);
    };

    const subscreverTemplate = (templateId) => {
      if (templateUnsubsRef.current[templateId]) return;
      const seed = CATALOGO_EDITAIS.find((e) => e.id === templateId);
      const unsub = onSnapshot(doc(db, 'editais_templates', templateId), (tSnap) => {
        let tData = null;
        if (tSnap.exists() && !tSnap.data().deleted) {
          tData = { ...tSnap.data(), _origem: 'firestore' };
          _templateCache.set(templateId, tData);
        } else if (seed?.disciplinas?.length) {
          tData = {
            disciplinas: seed.disciplinas.map((d) => ({ nome: d.nome || '', assuntos: (d.assuntos || []).map((a) => (typeof a === 'string' ? a : a?.nome || '')).filter(Boolean), peso: d.peso || 3 })),
            titulo: seed.titulo, banca: seed.banca || '', logoUrl: seed.logoUrl || seed.logo || null, _origem: 'seed',
          };
        }
        const ciclosDoTemplate = ciclosRef.current.filter((c) => c.arquivado !== true && getTemplateIdDoCiclo(c) === templateId);
        for (const ciclo of ciclosDoTemplate) { agendarChecagem(ciclo, tData, true); }
      });
      templateUnsubsRef.current[templateId] = unsub;
    };

    const limparTemplatesOrfaos = (idsAtivos) => {
      for (const tid of Object.keys(templateUnsubsRef.current)) {
        if (!idsAtivos.has(tid)) { templateUnsubsRef.current[tid](); delete templateUnsubsRef.current[tid]; }
      }
    };

    const unsubCiclos = onSnapshot(collection(db, 'users', user.uid, 'ciclos'), (snapshot) => {
        const ciclos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        ciclosRef.current = ciclos;

        const elegiveis = ciclos.filter((c) => c.arquivado !== true && !!getTemplateIdDoCiclo(c));
        const templateIdsAtivos = new Set(elegiveis.map(getTemplateIdDoCiclo));

        limparTemplatesOrfaos(templateIdsAtivos);
        for (const templateId of templateIdsAtivos) { subscreverTemplate(templateId); }

        const cicloIdsElegiveis = new Set(elegiveis.map((c) => c.id));
        let removeu = false;
        for (const cid of Object.keys(editalUpdatesRef.current)) {
          if (!cicloIdsElegiveis.has(cid)) { delete editalUpdatesRef.current[cid]; removeu = true; }
        }

        for (const ciclo of elegiveis) {
          const tId = getTemplateIdDoCiclo(ciclo);
          const tData = _templateCache.get(tId);
          if (tData) {
            const versionKey = derivarVersionKey(tData);
            const existente = editalUpdatesRef.current[ciclo.id];
            if (!existente || existente.versionKey !== versionKey) agendarChecagem(ciclo, tData, false);
          }
        }
        if (removeu) publicarUpdates();
      }
    );

    return () => {
      unsubCiclos();
      Object.values(templateUnsubsRef.current).forEach((u) => u());
      templateUnsubsRef.current = {};
      editalUpdatesRef.current = {};
      checkLocksRef.current = {};
      pendingCheckRef.current = {};
      Object.values(debounceTimersRef.current).forEach(clearTimeout);
      debounceTimersRef.current = {};
      debounceOrigemRef.current = {};
    };
  }, [user]);

  useEffect(() => {
    if (!user?.uid) { setOperationalNotifications([]); return undefined; }
    const state = { xp: [], personal: [] };
    const publish = () => setOperationalNotifications([...state.xp, ...state.personal].sort((a, b) => (toMillisSafe(b.timestamp) || 0) - (toMillisSafe(a.timestamp) || 0)));
    const xpQuery = query(collection(db, 'users', user.uid, 'gamification', 'profile', 'xp_events'), orderBy('occurredAt', 'desc'), limit(40));
    const personalQuery = query(collection(db, 'users', user.uid, 'notifications'), orderBy('createdAt', 'desc'), limit(40));
    const stopXP = onSnapshot(xpQuery, (snapshot) => {
      state.xp = snapshot.docs.map((item) => ({ id: item.id, ...item.data(), _type: 'operational', operationalKind: 'xp', sourceCollection: 'xp_events', title: `+${Number(item.data().xpTotal || 0)} XP`, timestamp: item.data().occurredAt?.toDate?.() || new Date(), requiresAction: false })).filter((item) => item.isRead !== true);
      publish();
    }, (error) => console.warn('[Notificações] XP indisponível:', error.code || error));
    const stopPersonal = onSnapshot(personalQuery, (snapshot) => {
      state.personal = snapshot.docs.map((item) => ({ id: item.id, ...item.data(), _type: 'operational', operationalKind: item.data().type || 'system', sourceCollection: 'notifications', timestamp: item.data().createdAt?.toDate?.() || new Date() })).filter((item) => item.isRead !== true);
      publish();
    }, (error) => console.warn('[Notificações] Feed pessoal indisponível:', error.code || error));
    return () => { stopXP(); stopPersonal(); };
  }, [user?.uid]);

  // Exclui os apagados da visão
  const rawActiveEditalUpdates = editalUpdates.filter((u) => !u.isDismissed && !deletedNotifs.has(u.id));
  const activeEditalUpdates = agruparAtualizacoesPorEdital(rawActiveEditalUpdates).map(normalizeNotification);
  const activeBroadcasts = broadcasts
    .filter(b => !deletedNotifs.has(b.id) && !readBroadcasts.has(b.id))
    .map(normalizeNotification);
  const activeHistory = dismissedHistory.filter(h => {
      const hId = h.id || `edital_${h.cicloId}_${h.versionKey}`;
      return !deletedNotifs.has(hId);
  }).map((h) => normalizeNotification({
      ...h,
      id: h.id || `edital_${h.cicloId}_${h.versionKey}`,
  }));

  const notifications = [...operationalNotifications, ...activeBroadcasts, ...activeEditalUpdates].sort(
    (a, b) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0)
  );

  const unreadCount = operationalNotifications.length + activeBroadcasts.filter((b) => !readBroadcasts.has(b.id)).length + activeEditalUpdates.length;

  // AÇÕES
  const addItemsToHistory = useCallback((items = []) => {
    if (!user || items.length === 0) return;
    setDismissedHistory((history) => {
      const incoming = items.map((item) => {
        const type = item._type || (item.cicloId ? 'edital_update' : 'broadcast');
        if (type === 'broadcast') {
          return {
            id: item.id,
            _type: 'broadcast',
            category: item.category || 'comunicado',
            title: item.title || item.titulo || null,
            message: item.message || '',
            imageUrl: item.imageUrl || item.imageUrls?.[0] || null,
            timestamp: item.timestamp instanceof Date ? item.timestamp.toISOString() : item.timestamp || null,
            isDismissed: true,
            dismissedAt: new Date().toISOString(),
          };
        }
        return {
          ...item,
          _type: type,
          isDismissed: true,
          dismissedAt: new Date().toISOString(),
          ...(type === 'edital_update' ? {
            ciclosAfetados: undefined,
            templateData: {
              updateMetadata: item.templateData?.updateMetadata || null,
              banca: item.templateData?.banca || null,
            },
          } : {}),
        };
      });
      const incomingKeys = new Set(incoming.map((item) => `${item._type}:${item.id}:${item.versionKey || ''}`));
      const deduped = history.filter((item) => !incomingKeys.has(`${item._type}:${item.id}:${item.versionKey || ''}`));
      const next = [...incoming, ...deduped].slice(0, 50);
      try {
        localStorage.setItem(`notif_dismissed_history_${user.uid}`, JSON.stringify(next));
      } catch (error) {
        console.warn('Nao foi possivel persistir o historico de notificacoes', error);
      }
      return next;
    });
  }, [user]);

  const markBroadcastRead = useCallback((id) => {
      if (!user) return;
      const broadcast = broadcasts.find((item) => item.id === id);
      if (broadcast) addItemsToHistory([broadcast]);
      setReadBroadcasts((prev) => {
        const next = new Set([...prev, id]);
        try { localStorage.setItem(`notif_read_${user.uid}`, JSON.stringify([...next])); } catch {}
        return next;
      });
  }, [user, broadcasts, addItemsToHistory]);

  const markOperationalRead = useCallback(async (item) => {
    if (!user?.uid || !item?.id) return;
    const target = item.sourceCollection === 'xp_events'
      ? doc(db, 'users', user.uid, 'gamification', 'profile', 'xp_events', item.id)
      : doc(db, 'users', user.uid, 'notifications', item.id);
    await updateDoc(target, { isRead: true, readAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }, [user?.uid]);

  const respondGroupRequest = useCallback(async (item, approve) => {
    if (!item?.groupId || !item?.requestUid) return;
    await respondToGroupEntryRequest({ groupId: item.groupId, requestUid: item.requestUid, approve });
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    addItemsToHistory([...operationalNotifications, ...activeBroadcasts, ...activeEditalUpdates]);
    setReadBroadcasts((prev) => {
      const next = new Set([...prev, ...activeBroadcasts.map((b) => b.id)]);
      try { localStorage.setItem(`notif_read_${user.uid}`, JSON.stringify([...next])); } catch {}
      return next;
    });

    const updatesParaArquivar = [...rawActiveEditalUpdates];
    updatesParaArquivar.forEach((item) => {
      delete editalUpdatesRef.current[item.cicloId];
    });
    setEditalUpdates(Object.values(editalUpdatesRef.current));

    try {
      await Promise.all(updatesParaArquivar.map((item) => (
        updateDoc(doc(db, 'users', user.uid, 'ciclos', item.cicloId), {
          dismissedUpdateVersion: item.versionKey,
        })
      )));
      await Promise.all(operationalNotifications.map(markOperationalRead));
    } catch {}
  }, [user, operationalNotifications, activeBroadcasts, activeEditalUpdates, rawActiveEditalUpdates, addItemsToHistory, markOperationalRead]);

  const deleteBroadcast = useCallback((id) => {
      if (!user) return;
      setDeletedNotifs(prev => {
          const next = new Set([...prev, id]);
          try { localStorage.setItem(`notif_deleted_${user.uid}`, JSON.stringify([...next])); } catch {}
          return next;
      });
  }, [user]);

  const deleteHistoryItem = useCallback((id) => {
      if (!user) return;
      setDeletedNotifs(prev => {
          const next = new Set([...prev, id]);
          try { localStorage.setItem(`notif_deleted_${user.uid}`, JSON.stringify([...next])); } catch {}
          return next;
      });
  }, [user]);

  const dismissEditalUpdate = useCallback(async (cicloId, versionKey) => {
      if (!user || !cicloId) return;

      const item = editalUpdatesRef.current[cicloId];
      const itensParaDispensar = item
        ? Object.values(editalUpdatesRef.current).filter((u) => u.templateId === item.templateId && u.versionKey === versionKey)
        : [];
      if (item) {
          const histItem = {
              ...(itensParaDispensar.length > 1 ? agruparAtualizacoesPorEdital(itensParaDispensar)[0] : item),
              _type: 'edital_update',
              isDismissed: true,
              dismissedAt: new Date().toISOString(),
              templateData: { updateMetadata: item.templateData?.updateMetadata || null, banca: item.templateData?.banca || null }
          };

          setDismissedHistory((h) => {
              const deduped = h.filter((x) => !(
                (x.templateId === item.templateId && x.versionKey === versionKey) ||
                (x.cicloId === cicloId && x.versionKey === versionKey)
              ));
              const next = [histItem, ...deduped].slice(0, 50);
              try { localStorage.setItem(`notif_dismissed_history_${user.uid}`, JSON.stringify(next)); } catch {}
              return next;
          });
      }

      itensParaDispensar.forEach((u) => { delete editalUpdatesRef.current[u.cicloId]; });
      setEditalUpdates(Object.values(editalUpdatesRef.current));

      try {
        await Promise.all(itensParaDispensar.map((u) => (
          updateDoc(doc(db, 'users', user.uid, 'ciclos', u.cicloId), {
            dismissedUpdateVersion: versionKey,
          })
        )));
      } catch (err) {}
    },
    [user]
  );

  // APLICAÇÃO DA ATUALIZAÇÃO DO EDITAL EM LOTE E RETROATIVIDADE DO HISTÓRICO
  const applyEditalUpdate = useCallback(async (updateItem) => {
      if (!user || !updateItem) return false;
      if (updateItem.isGrouped && Array.isArray(updateItem.ciclosAfetados) && updateItem.ciclosAfetados.length > 1) {
        setLoading(true);
        const resultados = [];
        for (const item of updateItem.ciclosAfetados) {
          resultados.push(await applyEditalUpdate({ ...item, isGrouped: false, ciclosAfetados: null }));
        }
        setLoading(false);
        return {
          success: resultados.every((r) => r?.success),
          grouped: true,
          total: resultados.length,
        };
      }
      setLoading(true);

      try {
        const { cicloId, templateId, diff } = updateItem;
        invalidarCacheTemplate(templateId);
        const tData = await buscarDadosTemplateFresh(templateId);

        if (!tData?.disciplinas?.length) { setLoading(false); return false; }

        const discSnap = await getDocs(collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas'));
        const disciplinasAtuais = discSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const { pairs, unmappedTemplate, unmappedCiclo, matchedCicloIds } = mapDisciplines(disciplinasAtuais.filter(d => d.inCiclo !== false), tData.disciplinas);

        const batchArray = [writeBatch(db)];
        let opCount = 0;

        const commitBatch = (ref, data, type = 'update') => {
            if (opCount >= 450) { batchArray.push(writeBatch(db)); opCount = 0; }
            const currentBatch = batchArray[batchArray.length - 1];
            if (type === 'set') currentBatch.set(ref, data);
            else currentBatch.update(ref, data);
            opCount++;
        };

        const discRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');

        const disciplineRenames = [];
        const topicRenames = [];
        const novosDiscIds = new Set();
        const novosAssuntoKeys = new Set();

        // 1. Novas Disciplinas
        unmappedTemplate.forEach((dt, idx) => {
            const newRef = doc(discRef);
            novosDiscIds.add(newRef.id);
            const assuntosTemplateNomes = (dt.assuntos || []).map((a) => (typeof a === 'string' ? a : a?.nome || '')).filter(Boolean);
            commitBatch(newRef, {
                nome: dt.nome,
                templateNome: dt.nome,
                assuntos: assuntosTemplateNomes.map((nome) => ({ nome, relevancia: 1, inCiclo: true })),
                peso: dt.peso || 3, tempoAlocadoSemanalMinutos: 60, inCiclo: true,
                index: disciplinasAtuais.length + idx, criadoEm: serverTimestamp(),
            }, 'set');
        });

        // 2. Disciplinas Removidas (Preservam os IDs)
        unmappedCiclo.forEach((dc) => {
            if (dc.templateNome) { commitBatch(doc(discRef, dc.id), { inCiclo: false }, 'update'); }
        });

        // 3. Disciplinas Atualizadas
        pairs.forEach(({ cicloDisc, templateDisc }) => {
            const isNovaDiff = diff?.novasDisciplinas?.some(n => normStr(n.nome) === normStr(templateDisc.nome));

            if (normStr(cicloDisc.nome) !== normStr(templateDisc.nome)) {
               disciplineRenames.push({ id: cicloDisc.id, oldName: cicloDisc.nome, newName: templateDisc.nome });
            }

            const oldAssuntosCompletos = cicloDisc.assuntos || [];
            const oldAssuntos = oldAssuntosCompletos.filter(a => typeof a === 'object' ? a.inCiclo !== false : true).map(a => typeof a === 'string' ? a : a?.nome || '').filter(Boolean);
            const newAssuntos = (templateDisc.assuntos || []).map(a => typeof a === 'string' ? a : a?.nome || '').filter(Boolean);

            const { pairs: topicPairs, unmappedTemplate: unmappedT, unmappedCiclo: unmappedC } = matchAssuntos(oldAssuntos, newAssuntos);

            const finalAssuntosMap = new Map();

            topicPairs.forEach(({ oldName, newName, oldIdx }) => {
                if (normStr(oldName) !== normStr(newName)) {
                     topicRenames.push({ disciplinaId: cicloDisc.id, oldName: oldName, newName: newName });
                }
                const oldObj = oldAssuntosCompletos[oldIdx];
                if (typeof oldObj === 'object') { finalAssuntosMap.set(newName, { ...oldObj, nome: newName, inCiclo: true }); }
                else { finalAssuntosMap.set(newName, { nome: newName, relevancia: 1, inCiclo: true }); }
            });

            unmappedT.forEach(newItem => {
                finalAssuntosMap.set(newItem, { nome: newItem, relevancia: 1, inCiclo: true });
                novosAssuntoKeys.add(`${cicloDisc.id}-${normStr(newItem)}`);
            });

            const novosAssuntosMerge = newAssuntos.map(nT => finalAssuntosMap.get(nT));

            const removedTopics = unmappedC.map(oldItem => {
                const oldIdx = oldAssuntos.indexOf(oldItem);
                const oldObj = oldAssuntosCompletos[oldIdx];
                if (typeof oldObj === 'object') return { ...oldObj, inCiclo: false };
                return { nome: oldItem, relevancia: 1, inCiclo: false };
            });

            const finalAssuntos = [...novosAssuntosMerge, ...removedTopics];

            commitBatch(doc(discRef, cicloDisc.id), {
                assuntos: finalAssuntos,
                ...(isNovaDiff ? { inCiclo: true } : {}),
                templateNome: templateDisc.nome, nome: templateDisc.nome
            }, 'update');
        });

        const versionKey = derivarVersionKey(tData);
        commitBatch(doc(db, 'users', user.uid, 'ciclos', cicloId), {
          lastEditalUpdate: serverTimestamp(), syncedVersion: versionKey, dismissedUpdateVersion: null,
        }, 'update');

        // === A MÁGICA: ATUALIZAÇÃO DO HISTÓRICO DE ESTUDO ===
        if (disciplineRenames.length > 0 || topicRenames.length > 0) {
            const recordsSnap = await getDocs(query(collection(db, 'users', user.uid, 'registrosEstudo'), where('cicloId', '==', cicloId)));

            recordsSnap.forEach(rDoc => {
                const rData = rDoc.data();
                let updates = {};
                let changed = false;

                const dRename = disciplineRenames.find(dr => dr.id === rData.disciplinaId);
                if (dRename && rData.disciplinaNome !== dRename.newName) {
                    updates.disciplinaNome = dRename.newName;
                    changed = true;
                }

                const currentTopic = rData.assunto || rData.assuntoNome;
                if (currentTopic) {
                    const tRename = topicRenames.find(tr => tr.disciplinaId === rData.disciplinaId && normStr(tr.oldName) === normStr(currentTopic));
                    if (tRename) {
                        updates.assunto = tRename.newName;
                        if (rData.assuntoNome) updates.assuntoNome = tRename.newName;
                        changed = true;
                    }
                }

                if (changed) {
                    commitBatch(rDoc.ref, updates, 'update');
                }
            });
        }

        // Executa todas as atualizações
        for (const b of batchArray) {
            await b.commit();
        }

        setEditalUpdates((prev) => prev.filter((u) => u.cicloId !== cicloId));
        setLoading(false);
        return { success: true, novosDiscIds, novosAssuntoKeys };

      } catch (err) {
        console.error('[applyEditalUpdate] erro:', err);
        setLoading(false);
        return { success: false };
      }
    },
    [user]
  );

  return {
    notifications,
    unreadCount,
    broadcasts: activeBroadcasts,
    editalUpdates: activeEditalUpdates,
    dismissedHistory: activeHistory,
    readBroadcasts,
    markBroadcastRead,
    markOperationalRead,
    respondGroupRequest,
    markAllRead,
    deleteBroadcast,
    deleteHistoryItem,
    dismissEditalUpdate,
    applyEditalUpdate,
    loading,
  };
};
