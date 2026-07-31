import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

function normalizarTextoChave(valor) {
  return String(valor || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function serializarParteChave(valor) {
  return encodeURIComponent(String(valor ?? ''));
}

function normalizarDisciplinaChave(valor) {
  const disciplinaId = String(valor || '').trim();
  return disciplinaId || '__sem_disciplina__';
}

export function buildCicloRevisaoKey(revisao = {}) {
  const cicloId = String(revisao?.cicloId || '').trim();
  const disciplinaId = normalizarDisciplinaChave(revisao?.disciplinaId);
  const assunto = normalizarTextoChave(revisao?.assunto);
  const dataAgendada = String(revisao?.dataAgendada || '').trim();
  const intervaloDias = Number(revisao?.intervaloDias ?? 0);

  if (!cicloId || !assunto || !dataAgendada || !Number.isFinite(intervaloDias)) {
    return null;
  }

  return [
    cicloId,
    disciplinaId,
    assunto,
    intervaloDias,
    dataAgendada,
  ].map(serializarParteChave).join('__');
}

function normalizarPayloadRevisao(revisao = {}) {
  return {
    ...revisao,
    cicloId: revisao?.cicloId || null,
    disciplinaId: revisao?.disciplinaId || null,
    disciplinaNome: revisao?.disciplinaNome || 'Disciplina',
    assunto: typeof revisao?.assunto === 'string' ? revisao.assunto.trim() : '',
    dataAgendada: revisao?.dataAgendada || null,
    intervaloDias: Number(revisao?.intervaloDias ?? 0),
  };
}

function escolherRepresentanteGrupo(atual, candidato) {
  const atualCanonico = atual?.id && atual.id === atual.revisaoKey;
  const candidatoCanonico = candidato?.id && candidato.id === candidato.revisaoKey;
  if (candidatoCanonico && !atualCanonico) return candidato;
  if (atualCanonico && !candidatoCanonico) return atual;

  const atualCriadaEm = atual?.criadaEm?.seconds || 0;
  const candidatoCriadaEm = candidato?.criadaEm?.seconds || 0;
  if (candidatoCriadaEm && (!atualCriadaEm || candidatoCriadaEm < atualCriadaEm)) {
    return candidato;
  }

  return atual;
}

export function dedupeCicloRevisoesInMemory(revisoes = []) {
  const grupos = new Map();

  for (const revisaoBruta of revisoes) {
    const revisaoKey = buildCicloRevisaoKey(revisaoBruta) || revisaoBruta?.revisaoKey || `legacy:${revisaoBruta?.id || 'sem-id'}`;
    const revisao = {
      ...revisaoBruta,
      revisaoKey,
      _duplicateIds: Array.from(new Set([revisaoBruta?.id].filter(Boolean))),
    };

    const existente = grupos.get(revisaoKey);
    if (!existente) {
      grupos.set(revisaoKey, revisao);
      continue;
    }

    const representante = escolherRepresentanteGrupo(existente, revisao);
    const duplicateIds = Array.from(new Set([
      ...(existente._duplicateIds || []),
      ...(revisao._duplicateIds || []),
    ]));

    grupos.set(revisaoKey, {
      ...(representante === revisao ? existente : revisao),
      ...representante,
      revisaoKey,
      _duplicateIds: duplicateIds,
      _duplicateCount: duplicateIds.length,
    });
  }

  return Array.from(grupos.values())
    .map((revisao) => ({
      ...revisao,
      _duplicateIds: Array.from(new Set(revisao._duplicateIds || [revisao.id].filter(Boolean))),
      _duplicateCount: Array.from(new Set(revisao._duplicateIds || [revisao.id].filter(Boolean))).length,
    }))
    .sort((a, b) => {
      const dataA = String(a?.dataAgendada || '');
      const dataB = String(b?.dataAgendada || '');
      if (dataA !== dataB) return dataA.localeCompare(dataB);
      return String(a?.assunto || '').localeCompare(String(b?.assunto || ''));
    });
}

export async function upsertCicloRevisao(db, userId, revisao = {}) {
  if (!db || !userId) return null;

  const payload = normalizarPayloadRevisao(revisao);
  const revisaoKey = buildCicloRevisaoKey(payload);
  if (!revisaoKey) return null;

  const revisaoRef = doc(collection(db, 'users', userId, 'revisoesCiclo'), revisaoKey);
  const existente = await getDoc(revisaoRef);

  const basePayload = {
    ...payload,
    revisaoKey,
    atualizadaEm: serverTimestamp(),
  };

  if (existente.exists()) {
    await setDoc(revisaoRef, basePayload, { merge: true });
    return revisaoRef.id;
  }

  await setDoc(revisaoRef, {
    ...basePayload,
    concluida: false,
    criadaEm: serverTimestamp(),
  }, { merge: true });

  return revisaoRef.id;
}

export async function concluirGrupoCicloRevisao(db, userId, revisao = {}, concluida = true) {
  if (!db || !userId) return;

  const duplicateIds = Array.from(new Set([
    revisao?.id,
    ...(Array.isArray(revisao?._duplicateIds) ? revisao._duplicateIds : []),
  ].filter(Boolean)));

  if (!duplicateIds.length) return;

  const batch = writeBatch(db);
  for (const revisaoId of duplicateIds) {
    const revisaoRef = doc(collection(db, 'users', userId, 'revisoesCiclo'), revisaoId);
    batch.set(revisaoRef, {
      concluida,
      concluidaEm: concluida ? serverTimestamp() : null,
    }, { merge: true });
  }
  await batch.commit();
}

export async function reagendarGrupoCicloRevisao(db, userId, revisao = {}, dataAgendada) {
  if (!db || !userId || !dataAgendada) return;

  const duplicateIds = Array.from(new Set([
    revisao?.id,
    ...(Array.isArray(revisao?._duplicateIds) ? revisao._duplicateIds : []),
  ].filter(Boolean)));

  if (!duplicateIds.length) return;

  const batch = writeBatch(db);
  for (const revisaoId of duplicateIds) {
    const revisaoRef = doc(collection(db, 'users', userId, 'revisoesCiclo'), revisaoId);
    batch.set(revisaoRef, {
      dataAgendada,
      atualizadaEm: serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}
