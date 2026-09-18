import { useState } from 'react';
import { db } from '../firebaseConfig';
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDocsFromServer,
  updateDoc,
  getDoc,
  setDoc,
  runTransaction,
  deleteDoc,
} from 'firebase/firestore';
import { upsertCicloRevisao } from '../services/cicloRevisoes';
import { normalizeRevisaoModoCiclo } from '../utils/cicloReviewMode';
import { CICLO_GUIDE_VERSION } from '../utils/cicloLegacyUpgrade';
import {
  calcularDistribuicao,
  gerarOrdemSessoes,
  normalizarNivelDominio,
  obterPesoDisciplina,
  PESO_POR_NIVEL,
} from '../utils/cicloDistribution';
import { getKnowledgeLevel, getImportanceLevel } from '../utils/planningPriority';
import { deletePlanStudyRecords } from '../services/planDeletion';
import { deletePermanentPlanning } from '../services/permanentPlanningDeletion';
import { getCycleStageGoalSnapshot } from '../utils/planningTransformation';
import { buildCycleRoundSummary } from '../utils/cicloWeeklyStatus';
import { requestGamificationRefresh } from '../utils/gamificationRealtime';
import {
  CYCLE_ROUND_IDENTITY_VERSION,
  getStudyBackedCycleCompletionState,
  isRealCycleStudyRecord,
} from '../utils/cycleSessionCompletion';
import {
  CYCLE_PROGRESS_CONTRACT_VERSION,
  getCycleSessionPlannedMinutes,
} from '../utils/cycleProgressPersistence';

export {
  calcularDistribuicao,
  gerarOrdemSessoes,
  normalizarNivelDominio,
  obterPesoDisciplina,
  PESO_POR_NIVEL,
};

const dateToYMDLocal = (date = new Date()) => {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return dateToYMDLocal(new Date());
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMinimumActiveDayMinutes = (diasEstudo) => {
  if (!diasEstudo || typeof diasEstudo !== 'object') return null;

  const activeDayMinutes = Object.values(diasEstudo)
    .map((value) => Math.round((parseFloat(value) || 0) * 60))
    .filter((value) => value > 0);

  return activeDayMinutes.length > 0 ? Math.min(...activeDayMinutes) : null;
};

const normalizeTempoSessaoMinutos = (tempoSessaoMinutos, diasEstudo) => {
  const fallbackTempo = Number(tempoSessaoMinutos) || 50;
  const minimumActiveDayMinutes = getMinimumActiveDayMinutes(diasEstudo);

  if (!minimumActiveDayMinutes) return fallbackTempo;
  return Math.max(10, Math.min(fallbackTempo, minimumActiveDayMinutes));
};

const buildLegacyProgressFromRecords = ({ ordemSessoes, disciplinas, registros, tempoSessaoMinutos }) => {
  const minutosPorDisciplina = new Map();
  registros.forEach((registro) => {
    if (registro.conclusaoId != null || !registro.disciplinaId || !isRealCycleStudyRecord(registro)) return;
    const atual = minutosPorDisciplina.get(registro.disciplinaId) || 0;
    minutosPorDisciplina.set(registro.disciplinaId, atual + Number(registro.tempoEstudadoMinutos || 0));
  });

  const progressoSessoes = {};
  const sessoesConcluidas = [];
  const detalhes = {};
  const remainingByDisciplina = new Map(minutosPorDisciplina);
  const disciplinaIds = new Set(disciplinas.map((disciplina) => disciplina.id));

  ordemSessoes.forEach((sessao, index) => {
    if (!disciplinaIds.has(sessao.disciplinaId)) return;
    const restante = Number(remainingByDisciplina.get(sessao.disciplinaId) || 0);
    if (restante <= 0) return;

    const progresso = Math.min(restante, tempoSessaoMinutos);
    progressoSessoes[index] = progresso;
    remainingByDisciplina.set(sessao.disciplinaId, Math.max(0, restante - progresso));

    if (progresso >= tempoSessaoMinutos) {
      sessoesConcluidas.push(index);
      detalhes[index] = { concluidaEm: dateToYMDLocal(new Date()), origem: 'upgrade_legado' };
    }
  });

  return { progressoSessoes, sessoesConcluidas, sessoesConcluidasDetalhes: detalhes };
};

const sanitizeFirestorePayload = (data) => {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeFirestorePayload(item));
  }
  if (typeof data === 'object' && !(data instanceof Date) && typeof data?.toMillis !== 'function') {
    const clean = {};
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined) {
        clean[key] = sanitizeFirestorePayload(val);
      }
    });
    return clean;
  }
  return data;
};

export const useCiclos = (user) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const desativarCiclosAntigos = async (batch, userId) => {
    const ciclosRef = collection(db, 'users', userId, 'ciclos');
    const q = query(ciclosRef, where('ativo', '==', true));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((document) => {
      batch.update(document.ref, { ativo: false });
    });
  };

  const criarCiclo = async (cicloData) => {
    if (!user) {
      setError('Usuario nao autenticado');
      return false;
    }
    setLoading(true);
    setError(null);

    try {
      const cargaHorariaTotal = Number(cicloData.cargaHorariaTotal || 0);
      const cargaHorariaTotalMinutos = cargaHorariaTotal * 60;
      const duracaoMinimaSessaoMinutos = Math.max(5, Number(cicloData.duracaoMinimaSessaoMinutos) || 30);
      const duracaoMaximaSessaoMinutos = Math.max(duracaoMinimaSessaoMinutos, Number(cicloData.duracaoMaximaSessaoMinutos) || Number(cicloData.tempoSessaoMinutos) || 60);
      const tempoSessaoMinutos = duracaoMaximaSessaoMinutos;
      const disciplinasComTempo = calcularDistribuicao(
        cicloData.disciplinas,
        cargaHorariaTotalMinutos,
        tempoSessaoMinutos,
        { diasEstudo: cicloData.diasEstudo, duracaoMinimaSessaoMinutos, duracaoMaximaSessaoMinutos }
      );
      const disciplinasComEstadoCompleto = Array.isArray(cicloData.disciplinasEstadoCompleto) && cicloData.disciplinasEstadoCompleto.length > 0
        ? cicloData.disciplinasEstadoCompleto
        : disciplinasComTempo;

      const batch = writeBatch(db);

      // 1. Desativa ciclos anteriores atomicamente no mesmo batch (garante 1 único ativo)
      await desativarCiclosAntigos(batch, user.uid);

      // 2. Cria documento do Ciclo Principal
      const cicloRef = doc(collection(db, 'users', user.uid, 'ciclos'));
      const planejamentoRef = doc(db, 'users', user.uid, 'planejamentos', cicloRef.id);

      const disciplinasParaSalvar = disciplinasComEstadoCompleto.map((disciplina, position) => {
        const disciplinaRef = doc(collection(db, 'users', user.uid, 'ciclos', cicloRef.id, 'disciplinas'));
        const disciplinaAtiva = disciplinasComTempo.find((item) => item.id === disciplina.id || item.nome === disciplina.nome);
        return {
          ...disciplina,
          id: disciplinaRef.id,
          _ref: disciplinaRef,
          _position: position,
          _disciplinaAtiva: disciplinaAtiva || null,
        };
      });

      const disciplinasAtivas = disciplinasParaSalvar
        .filter((disciplina) => disciplina.inCiclo !== false)
        .map((disciplina) => ({
          ...disciplina,
          ...(disciplina._disciplinaAtiva || {}),
          id: disciplina.id,
        }));

      const totalSessoesCiclo = disciplinasAtivas.reduce(
        (acc, d) => acc + (Number(d.sessoesPorCiclo) || 1),
        0
      );
      const disciplinaTodosDiasIds = disciplinasAtivas
        .filter((disciplina) => disciplina.estudarTodosDias)
        .map((disciplina) => disciplina.id);

      batch.set(cicloRef, sanitizeFirestorePayload({
        nome: String(cicloData.nome || '').trim() || 'Ciclo de Estudos',
        dataInicioPlanejamento: dateToYMDLocal(cicloData.dataInicioPlanejamento || new Date()),
        cargaHorariaSemanalTotal: cargaHorariaTotal,
        diasEstudo: cicloData.diasEstudo || null,
        tempoSessaoMinutos,
        duracaoMinimaSessaoMinutos,
        duracaoMaximaSessaoMinutos,
        revisaoModo: normalizeRevisaoModoCiclo(cicloData.revisaoModo),
        modoExibirAssuntos: cicloData.modoExibirAssuntos !== false,
        modoExibirTempo: cicloData.modoExibirTempo || 'detalhado',
        coresDisciplinasAtivas: cicloData.coresDisciplinasAtivas !== false,
        totalSessoesCiclo,
        ordemSessoes: gerarOrdemSessoes(disciplinasAtivas),
        disciplinaTodosDiasId: disciplinaTodosDiasIds[0] || null,
        disciplinaTodosDiasIds,
        sessoesConcluidas: [],
        progressoSessoes: {},
        sessoesConcluidasDetalhes: {},
        embaralharOffset: 0,
        ativo: true,
        planejamentoId: cicloRef.id,
        dataCriacao: serverTimestamp(),
        arquivado: false,
        conclusoes: 0,
        roundIdentityVersion: CYCLE_ROUND_IDENTITY_VERSION,
        cycleProgressContractVersion: CYCLE_PROGRESS_CONTRACT_VERSION,
        cycleProgressOperations: {},
        cycleRoundMinutesByDisciplineUntilIdeal: {},
        lastCycleProgressOperationId: 'create:initial-cycle',
        logoUrl: cicloData.logoUrl || null,
        editalId: cicloData.editalId || cicloData.templateId || null,
        templateOrigem: cicloData.templateId || null,
        tipo: cicloData.tipo || 'padrao',
        versaoCiclo: CICLO_GUIDE_VERSION,
        guiaAtualizadoEm: serverTimestamp()
      }));

      batch.set(planejamentoRef, {
        nome: String(cicloData.nome || '').trim() || 'Ciclo de Estudos',
        editalId: cicloData.editalId || cicloData.templateId || null,
        metodoVigente: 'ciclo',
        etapaVigenteId: cicloRef.id,
        etapas: [{
          metodo: 'ciclo', id: cicloRef.id, inicioEm: new Date().toISOString(),
          metas: getCycleStageGoalSnapshot({
            dataInicioPlanejamento: cicloData.dataInicioPlanejamento,
            diasEstudo: cicloData.diasEstudo,
            tempoSessaoMinutos,
          }),
        }],
        arquivado: false,
        criadoEm: serverTimestamp(),
      });

      // 3. Cria Subcolecao de Disciplinas e salva index para preservar ordem
      disciplinasParaSalvar.forEach((disciplina) => {
        const disciplinaAtiva = disciplina._disciplinaAtiva || disciplina;
        const corDisciplina = disciplina.cor || disciplinaAtiva.cor || null;
        batch.set(disciplina._ref, sanitizeFirestorePayload({
          nome: String(disciplina.nome || 'Disciplina').trim(),
          peso: obterPesoDisciplina(disciplina),
          conhecimentoNivel: getKnowledgeLevel(disciplina),
          importanciaNivel: getImportanceLevel(disciplina),
          tempoAlocadoSemanalMinutos: disciplina.inCiclo === false ? 0 : Number(disciplinaAtiva.tempoAlocadoMinutos || 0),
          sessoesPorCiclo: disciplina.inCiclo === false ? 0 : (Number(disciplinaAtiva.sessoesPorCiclo) || 1),
          duracoesSessoes: disciplina.inCiclo === false ? [] : (disciplinaAtiva.duracoesSessoes || []),
          assuntos: Array.isArray(disciplina.assuntos) ? disciplina.assuntos : [],
          index: disciplina._position,
          inCiclo: disciplina.inCiclo !== false,
          estudarTodosDias: disciplina.inCiclo !== false && disciplina.estudarTodosDias === true,
          ...(corDisciplina ? { cor: corDisciplina } : {}),
        }));
      });

      await batch.commit();
      requestGamificationRefresh({
        uid: user.uid,
        sourceType: 'cycle_create',
        sourceId: cicloRef.id,
      });
      setLoading(false);
      return cicloRef.id;

    } catch (err) {
      console.error('Erro ao criar ciclo:', err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  const ativarCiclo = async (cicloId, activeCicloIds = null) => {
    if (!user) { setError('Usuario nao autenticado'); return false; }
    setLoading(true); setError(null);
    try {
      const batch = writeBatch(db);
      if (Array.isArray(activeCicloIds)) {
        activeCicloIds
          .filter((id) => id && id !== cicloId)
          .forEach((id) => batch.update(doc(db, 'users', user.uid, 'ciclos', id), { ativo: false }));
      } else {
        await desativarCiclosAntigos(batch, user.uid);
      }
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      batch.update(cicloRef, { ativo: true, arquivado: false });
      await batch.commit();
      requestGamificationRefresh({
        uid: user.uid,
        sourceType: 'cycle_activation',
        sourceId: cicloId,
      });
      setLoading(false); return true;
    } catch (err) { console.error('Erro ao ativar ciclo:', err); setError(err.message); setLoading(false); return false; }
  };

  const desativarCiclo = async (cicloId) => {
    if (!user) { setError('Usuario nao autenticado'); return false; }
    setLoading(true); setError(null);
    try {
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      await updateDoc(cicloRef, { ativo: false });
      requestGamificationRefresh({
        uid: user.uid,
        sourceType: 'cycle_deactivation',
        sourceId: cicloId,
      });
      setLoading(false); return true;
    } catch (err) {
      console.error('Erro ao desativar ciclo:', err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  const arquivarCiclo = async (cicloId) => {
    if (!user) { setError('Usuario nao autenticado'); return false; }
    setLoading(true); setError(null);
    try {
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      const cycleSnap = await getDoc(cicloRef);
      if (cycleSnap.data()?.planejamentoId) {
        const batch = writeBatch(db);
        batch.update(cicloRef, { arquivado: true, ativo: false });
        batch.update(doc(db, 'users', user.uid, 'planejamentos', cycleSnap.data().planejamentoId), { arquivado: true });
        await batch.commit();
      } else await updateDoc(cicloRef, { arquivado: true, ativo: false });
      setLoading(false); return true;
    } catch (err) { console.error('Erro ao arquivar ciclo:', err); setError(err.message); setLoading(false); return false; }
  };

  const editarCiclo = async (cicloId, cicloData, options = {}) => {
    if (!user) { setError('Usuario nao autenticado'); return false; }
    setLoading(true); setError(null);
    try {
      const cargaHorariaTotal = Number(cicloData.cargaHorariaTotal || 0);
      const cargaHorariaTotalMinutos = cargaHorariaTotal * 60;
      const duracaoMinimaSessaoMinutos = Math.max(5, Number(cicloData.duracaoMinimaSessaoMinutos) || 30);
      const duracaoMaximaSessaoMinutos = Math.max(duracaoMinimaSessaoMinutos, Number(cicloData.duracaoMaximaSessaoMinutos) || Number(cicloData.tempoSessaoMinutos) || 60);
      const tempoSessaoMinutos = duracaoMaximaSessaoMinutos;
      const disciplinasComTempo = calcularDistribuicao(
        cicloData.disciplinas,
        cargaHorariaTotalMinutos,
        tempoSessaoMinutos,
        { diasEstudo: cicloData.diasEstudo, duracaoMinimaSessaoMinutos, duracaoMaximaSessaoMinutos }
      );
      const disciplinasComEstadoCompleto = Array.isArray(cicloData.disciplinasEstadoCompleto) && cicloData.disciplinasEstadoCompleto.length > 0
        ? cicloData.disciplinasEstadoCompleto
        : disciplinasComTempo;
      const mapaDisciplinasAtivas = new Map(
        disciplinasComTempo.map((disciplina) => [disciplina.id || disciplina.nome, disciplina])
      );

      const batch = writeBatch(db);
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);

      const updateData = {
        nome: cicloData.nome,
        cargaHorariaTotal: cargaHorariaTotal,
        cargaHorariaSemanalTotal: cargaHorariaTotal,
        diasEstudo: cicloData.diasEstudo || null,
        tempoSessaoMinutos,
        duracaoMinimaSessaoMinutos,
        duracaoMaximaSessaoMinutos,
        embaralharOffset: 0,
      };

      if (cicloData.dataInicioPlanejamento) {
        const cicloAtualSnap = await getDoc(cicloRef);
        const cicloAtualData = cicloAtualSnap.data() || {};
        const hasProgress = (Array.isArray(cicloAtualData.sessoesConcluidas) && cicloAtualData.sessoesConcluidas.length > 0)
          || Object.values(cicloAtualData.progressoSessoes || {}).some((value) => Number(value || 0) > 0);
        let hasCurrentRoundRecords = hasProgress;

        if (!hasCurrentRoundRecords) {
          const registrosAtuaisSnap = await getDocs(query(
            collection(db, 'users', user.uid, 'registrosEstudo'),
            where('cicloId', '==', cicloId),
          ));
          hasCurrentRoundRecords = registrosAtuaisSnap.docs.some((registroDoc) => registroDoc.data()?.conclusaoId == null);
        }

        if (!hasCurrentRoundRecords) {
          updateData.dataInicioPlanejamento = dateToYMDLocal(cicloData.dataInicioPlanejamento);
        }
      }

      if (cicloData.logoUrl !== undefined) updateData.logoUrl = cicloData.logoUrl;
      if (cicloData.tipo !== undefined) updateData.tipo = cicloData.tipo;
      if (cicloData.revisaoModo !== undefined) updateData.revisaoModo = normalizeRevisaoModoCiclo(cicloData.revisaoModo);
      if (cicloData.modoExibirAssuntos !== undefined) updateData.modoExibirAssuntos = cicloData.modoExibirAssuntos !== false;
      if (cicloData.coresDisciplinasAtivas !== undefined) updateData.coresDisciplinasAtivas = cicloData.coresDisciplinasAtivas !== false;
      if (cicloData.templateId !== undefined) updateData.templateOrigem = cicloData.templateId || null;
      if (cicloData.editalId !== undefined || cicloData.templateId !== undefined) {
        updateData.editalId = cicloData.editalId || cicloData.templateId || null;
      }

      const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
      const disciplinasSnapshot = await getDocs(disciplinasRef);
      const disciplinasExistentes = disciplinasSnapshot.docs.map(d => d.id);
      const disciplinasEditadasIds = new Set();
      const disciplinasParaOrdem = [];

      disciplinasComEstadoCompleto.forEach((disciplina, position) => {
        let disciplinaRef;
        const disciplinaAtiva = mapaDisciplinasAtivas.get(disciplina.id || disciplina.nome) || null;
        const disciplinaEstaAtiva = disciplina.inCiclo !== false;
        const tempoAlocadoNumerico = disciplinaEstaAtiva ? Number(disciplinaAtiva?.tempoAlocadoMinutos || 0) : 0;
        const sessoesPorCiclo = disciplinaEstaAtiva ? (Number(disciplinaAtiva?.sessoesPorCiclo) || 1) : 0;
        const duracoesSessoes = disciplinaEstaAtiva ? (disciplinaAtiva?.duracoesSessoes || []) : [];
        const corDisciplina = disciplina.cor || disciplinaAtiva?.cor || null;

        if (disciplina.id && !String(disciplina.id).startsWith('temp-') && !String(disciplina.id).startsWith('manual-')) {
          disciplinaRef = doc(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas', disciplina.id);
          const discUpdate = {
            nome: disciplina.nome,
            peso: obterPesoDisciplina(disciplina),
            conhecimentoNivel: getKnowledgeLevel(disciplina),
            importanciaNivel: getImportanceLevel(disciplina),
            tempoAlocadoSemanalMinutos: tempoAlocadoNumerico,
            sessoesPorCiclo,
            duracoesSessoes,
            index: position,
            inCiclo: disciplinaEstaAtiva,
            estudarTodosDias: disciplinaEstaAtiva && disciplina.estudarTodosDias === true,
            ...(corDisciplina ? { cor: corDisciplina } : {}),
          };
          if (disciplina.assuntos) discUpdate.assuntos = disciplina.assuntos;
          batch.update(disciplinaRef, discUpdate);
          disciplinasEditadasIds.add(disciplina.id);
          if (disciplinaEstaAtiva) disciplinasParaOrdem.push({
            id: disciplina.id,
            sessoesPorCiclo,
            duracoesSessoes,
            estudarTodosDias: disciplina.estudarTodosDias === true,
          });
        } else {
          disciplinaRef = doc(collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas'));
          batch.set(disciplinaRef, {
            nome: disciplina.nome,
            peso: obterPesoDisciplina(disciplina),
            conhecimentoNivel: getKnowledgeLevel(disciplina),
            importanciaNivel: getImportanceLevel(disciplina),
            tempoAlocadoSemanalMinutos: tempoAlocadoNumerico,
            sessoesPorCiclo,
            duracoesSessoes,
            assuntos: disciplina.assuntos || [],
            index: position,
            inCiclo: disciplinaEstaAtiva,
            estudarTodosDias: disciplinaEstaAtiva && disciplina.estudarTodosDias === true,
            ...(corDisciplina ? { cor: corDisciplina } : {}),
          });
          disciplina.id = disciplinaRef.id;
          if (disciplinaEstaAtiva) disciplinasParaOrdem.push({
            id: disciplina.id,
            sessoesPorCiclo,
            duracoesSessoes,
            estudarTodosDias: disciplina.estudarTodosDias === true,
          });
        }
      });

      for (const id of disciplinasExistentes) {
        if (!disciplinasEditadasIds.has(id)) {
          const disciplinaRef = doc(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas', id);
          batch.update(disciplinaRef, {
            inCiclo: false,
            tempoAlocadoSemanalMinutos: 0,
            sessoesPorCiclo: 0,
            estudarTodosDias: false,
          });
        }
      }

      const novaOrdemSessoes = gerarOrdemSessoes(disciplinasParaOrdem);
      updateData.totalSessoesCiclo = disciplinasParaOrdem.reduce(
        (acc, d) => acc + (Number(d.sessoesPorCiclo) || 1),
        0
      );
      updateData.ordemSessoes = novaOrdemSessoes;
      updateData.disciplinaTodosDiasIds = disciplinasParaOrdem
        .filter((disciplina) => disciplina.estudarTodosDias)
        .map((disciplina) => disciplina.id);
      updateData.disciplinaTodosDiasId = updateData.disciplinaTodosDiasIds[0] || null;

      updateData.versaoCiclo = CICLO_GUIDE_VERSION;
      updateData.guiaAtualizadoEm = serverTimestamp();

      const registrosSnapshot = await getDocs(query(collection(db, 'users', user.uid, 'registrosEstudo'), where('cicloId', '==', cicloId)));
      const registros = registrosSnapshot.docs.map((registroDoc) => registroDoc.data() || {});
      Object.assign(updateData, buildLegacyProgressFromRecords({
        ordemSessoes: novaOrdemSessoes,
        disciplinas: disciplinasParaOrdem.map((d) => ({ id: d.id })),
        registros,
        tempoSessaoMinutos,
      }));

      updateData.cycleProgressContractVersion = CYCLE_PROGRESS_CONTRACT_VERSION;
      updateData.roundIdentityVersion = CYCLE_ROUND_IDENTITY_VERSION;
      updateData.lastCycleProgressOperationId = `configure:${cicloId}:${Date.now()}`;

      batch.update(cicloRef, updateData);

      await batch.commit();
      setLoading(false); return true;
    } catch (err) { console.error('Erro ao editar ciclo:', err); setError(err.message); setLoading(false); return false; }
  };

  const atualizarCicloLegadoParaGuia = async (cicloId, config = {}) => {
    if (!user) { setError('Usuario nao autenticado'); return false; }
    if (!cicloId) return false;
    setLoading(true); setError(null);

    try {
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      const cicloDoc = await getDoc(cicloRef);
      if (!cicloDoc.exists()) throw new Error('Ciclo nao encontrado');

      const cicloData = cicloDoc.data() || {};
      const tempoSessaoMinutos = normalizeTempoSessaoMinutos(
        config.tempoSessaoMinutos ?? cicloData.tempoSessaoMinutos ?? 50,
        config.diasEstudo ?? cicloData.diasEstudo
      );
      const diasEstudo = config.diasEstudo || cicloData.diasEstudo || null;

      const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
      const disciplinasSnapshot = await getDocs(disciplinasRef);
      const disciplinas = disciplinasSnapshot.docs
        .map((discDoc) => {
          const discData = discDoc.data() || {};
          const tempoAlocado = Number(discData.tempoAlocadoSemanalMinutos || 0);
          const rawSessoesPorCiclo = Number(discData.sessoesPorCiclo || 0);
          const sessoesPorCiclo = rawSessoesPorCiclo || Math.max(1, Math.round(tempoAlocado / tempoSessaoMinutos));
          return {
            id: discDoc.id,
            ref: discDoc.ref,
            ...discData,
            tempoAlocadoSemanalMinutos: tempoAlocado,
            rawSessoesPorCiclo,
            sessoesPorCiclo: discData.inCiclo === false ? 0 : sessoesPorCiclo,
            inCiclo: discData.inCiclo !== false,
          };
        })
        .filter((disciplina) => disciplina.inCiclo);

      const shouldRegenerateOrder = config.forceRegenerate === true;
      const ordemExistente = Array.isArray(cicloData.ordemSessoes) ? cicloData.ordemSessoes : [];
      const ordemSessoes = ordemExistente.length > 0 && !shouldRegenerateOrder
        ? ordemExistente
        : gerarOrdemSessoes(
            disciplinas.map((d) => ({
              id: d.id,
              sessoesPorCiclo: d.sessoesPorCiclo,
              duracoesSessoes: Array.isArray(d.duracoesSessoes) ? d.duracoesSessoes : [],
              estudarTodosDias: d.estudarTodosDias === true,
            })),
            Number(cicloData.embaralharOffset || 0),
            { diasEstudo, tempoSessaoMinutos }
          );

      const hasExistingSessionProgress = Array.isArray(cicloData.sessoesConcluidas)
        || (cicloData.progressoSessoes && Object.keys(cicloData.progressoSessoes).length > 0);

      let progressUpdate = {};
      if (!hasExistingSessionProgress) {
        const registrosSnapshot = await getDocs(query(collection(db, 'users', user.uid, 'registrosEstudo'), where('cicloId', '==', cicloId)));
        const registros = registrosSnapshot.docs.map((registroDoc) => registroDoc.data() || {});
        progressUpdate = buildLegacyProgressFromRecords({
          ordemSessoes,
          disciplinas,
          registros,
          tempoSessaoMinutos,
        });
      }

      const batch = writeBatch(db);
      disciplinas.forEach((disciplina) => {
        if (Number(disciplina.rawSessoesPorCiclo || 0) > 0) return;
        const sessoesPorCiclo = Math.max(1, Math.round(Number(disciplina.tempoAlocadoSemanalMinutos || 0) / tempoSessaoMinutos));
        batch.update(disciplina.ref, { sessoesPorCiclo });
      });

      batch.update(cicloRef, {
        ...(config.nome ? { nome: String(config.nome).trim() } : {}),
        diasEstudo,
        tempoSessaoMinutos,
        modoExibirAssuntos: config.modoExibirAssuntos !== false,
        modoExibirTempo: config.modoExibirTempo || 'detalhado',
        coresDisciplinasAtivas: config.coresDisciplinasAtivas !== false,
        revisaoModo: normalizeRevisaoModoCiclo(config.revisaoModo),
        versaoCiclo: CICLO_GUIDE_VERSION,
        guiaAtualizadoEm: serverTimestamp(),
        ordemSessoes,
        totalSessoesCiclo: ordemSessoes.length,
        ...(hasExistingSessionProgress ? {} : progressUpdate),
        cycleProgressContractVersion: CYCLE_PROGRESS_CONTRACT_VERSION,
        roundIdentityVersion: CYCLE_ROUND_IDENTITY_VERSION,
        lastCycleProgressOperationId: `guide-upgrade:${cicloId}:${Date.now()}`,
      });

      await batch.commit();
      setLoading(false);
      return true;
    } catch (err) {
      console.error('Erro ao atualizar ciclo legado para guia:', err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  const concluirVoltaCiclo = async (cicloId, options = {}) => {
    if (!user) { setError('Usuario nao autenticado'); return false; }
    setLoading(true); setError(null);
    try {
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
      const expectedConclusoes = Number.isFinite(Number(options.expectedConclusoes))
        ? Number(options.expectedConclusoes)
        : 0;
      const disciplinasSnapshot = await getDocsFromServer(disciplinasRef);
      const disciplinas = disciplinasSnapshot.docs.map((discDoc) => {
        const discData = discDoc.data() || {};
        const tempoAlocado = Number(discData.tempoAlocadoSemanalMinutos || 0);
        const sessoesPorCiclo = Number(discData.sessoesPorCiclo) || Math.max(1, Math.round(tempoAlocado / 50));
        return {
          id: discDoc.id,
          nome: discData.nome || 'Materia sem nome',
          inCiclo: discData.inCiclo !== false,
          tempoAlocadoSemanalMinutos: tempoAlocado,
          sessoesPorCiclo,
          duracoesSessoes: Array.isArray(discData.duracoesSessoes) ? discData.duracoesSessoes : [],
          estudarTodosDias: discData.estudarTodosDias === true,
        };
      });
      const closedAt = new Date();
      let rodadaId = null;
      let didCloseRound = false;

      await runTransaction(db, async (transaction) => {
        const cicloDoc = await transaction.get(cicloRef);
        if (!cicloDoc.exists()) throw new Error('ciclo-nao-encontrado');
        const cicloData = cicloDoc.data() || {};
        const conclusoesAtuais = Number(cicloData.conclusoes || 0);

        // Uma repetição da mesma intenção deve apenas confirmar o fechamento já salvo.
        if (conclusoesAtuais > expectedConclusoes) {
          rodadaId = `rodada-${String(conclusoesAtuais).padStart(6, '0')}`;
          return;
        }
        if (conclusoesAtuais < expectedConclusoes) {
          throw new Error('ciclo-versao-desatualizada');
        }

        const ordemAtual = Array.isArray(cicloData.ordemSessoes) ? cicloData.ordemSessoes : [];
        const completionState = getStudyBackedCycleCompletionState(cicloData);
        const concluidas = new Set(completionState.sessoesConcluidas);
        const progresso = completionState.progressoSessoes;
        const todasConcluidas = ordemAtual.length > 0 && ordemAtual.every((sessao, index) => {
          const planejado = getCycleSessionPlannedMinutes(cicloData, disciplinas, sessao);
          return concluidas.has(index) || Number(progresso[index] ?? progresso[String(index)] ?? 0) >= planejado;
        });
        if (!todasConcluidas) throw new Error('ciclo-ainda-possui-blocos-pendentes');

        const proximaConclusaoId = conclusoesAtuais + 1;
        rodadaId = `rodada-${String(proximaConclusaoId).padStart(6, '0')}`;
        const rodadaRef = doc(collection(db, 'users', user.uid, 'ciclos', cicloId, 'rodadas'), rodadaId);
        const embaralharOffsetAtual = Number(cicloData.embaralharOffset || 0);
        const tempoSessaoMinutos = normalizeTempoSessaoMinutos(cicloData.tempoSessaoMinutos, cicloData.diasEstudo);
        const disciplinasAtivas = disciplinas.filter((disciplina) => disciplina.inCiclo !== false);
        const totalDisciplinas = disciplinasAtivas.length;
        const novoOffset = totalDisciplinas > 0 ? (embaralharOffsetAtual + 1) % totalDisciplinas : 0;
        const novaOrdemSessoes = totalDisciplinas > 0
          ? gerarOrdemSessoes(disciplinasAtivas, novoOffset, {
              diasEstudo: cicloData.diasEstudo,
              tempoSessaoMinutos,
            })
          : [];
        const totalSessoesCiclo = disciplinasAtivas.reduce((acc, d) => acc + (Number(d.sessoesPorCiclo) || 1), 0);
        const resumoRodada = buildCycleRoundSummary({
          ciclo: cicloData,
          disciplinas: disciplinasAtivas,
          minutesByDisciplineUntilIdeal: cicloData.cycleRoundMinutesByDisciplineUntilIdeal || {},
          closedAt,
        });

        transaction.update(cicloRef, {
          conclusoes: proximaConclusaoId,
          ultimaConclusao: serverTimestamp(),
          ordemSessoes: novaOrdemSessoes,
          totalSessoesCiclo,
          sessoesConcluidas: [],
          progressoSessoes: {},
          sessoesConcluidasDetalhes: {},
          cycleProgressOperations: {},
          cycleRoundMinutesByDisciplineUntilIdeal: {},
          lastCycleProgressOperationId: `close:${rodadaId}`,
          cycleProgressContractVersion: CYCLE_PROGRESS_CONTRACT_VERSION,
          embaralharOffset: novoOffset,
          roundIdentityVersion: CYCLE_ROUND_IDENTITY_VERSION,
        });
        transaction.set(rodadaRef, {
          ...resumoRodada,
          fechamentoReal: serverTimestamp(),
          criadoEm: serverTimestamp(),
        });
        didCloseRound = true;
      });

      if (didCloseRound && rodadaId) {
        requestGamificationRefresh({
          uid: user.uid,
          sourceType: 'cycle_round',
          sourceId: `${cicloId}:${rodadaId}`,
          message: 'Rodada do ciclo concluída.',
          xpTotal: 100,
        });
      }
      setLoading(false); return true;
    } catch (err) { console.error('Erro ao concluir ciclo:', err); setError(err.message); setLoading(false); return false; }
  };

  // Alias para compatibilidade com codigo antigo
  const concluirCicloSemanal = concluirVoltaCiclo;

  const marcarSessaoConcluida = async (cicloId, sessaoGlobalIndex) => {
    setError('A conclusão direta de blocos foi desativada. Use o cronômetro ou registre o estudo manualmente.');
    console.warn('[Ciclo] Checkout manual recusado.', { cicloId, sessaoGlobalIndex });
    return false;
  };

  const limparCheckoutsManuaisLegados = async (cicloId) => {
    if (!user || !cicloId) return false;
    try {
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      let cleaned = false;
      await runTransaction(db, async (transaction) => {
        const cicloDoc = await transaction.get(cicloRef);
        if (!cicloDoc.exists()) return;
        const cicloData = cicloDoc.data() || {};
        const completionState = getStudyBackedCycleCompletionState(cicloData);
        const needsRoundIdentityMigration = Number(cicloData.roundIdentityVersion || 0) < CYCLE_ROUND_IDENTITY_VERSION;
        if (completionState.removedManualCheckoutCount <= 0 && !needsRoundIdentityMigration) return;
        transaction.update(cicloRef, {
          sessoesConcluidas: completionState.sessoesConcluidas,
          progressoSessoes: completionState.progressoSessoes,
          sessoesConcluidasDetalhes: completionState.sessoesConcluidasDetalhes,
          roundIdentityVersion: CYCLE_ROUND_IDENTITY_VERSION,
          cycleProgressContractVersion: CYCLE_PROGRESS_CONTRACT_VERSION,
          lastCycleProgressOperationId: `cleanup:${cicloId}:${Date.now()}`,
        });
        cleaned = true;
      });
      return cleaned;
    } catch (err) {
      console.error('Erro ao limpar checkouts manuais legados do ciclo:', err);
      return false;
    }
  };

  const salvarPendenciaTeoriaCiclo = async ({
    cicloId,
    disciplinaId,
    assuntoAtual,
    minutosAcumulados = 0,
  }) => {
    if (!user) { setError('Usuario nao autenticado'); return false; }
    if (!cicloId || !disciplinaId || !assuntoAtual) return false;
    setLoading(true); setError(null);
    try {
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      await setDoc(cicloRef, {
        pendenciasTeoria: {
          [disciplinaId]: {
            assuntoAtual,
            minutosAcumulados: Number(minutosAcumulados || 0),
            status: 'pendente',
            atualizadoEm: serverTimestamp(),
          },
        },
      }, { merge: true });

      setLoading(false);
      return true;
    } catch (err) {
      console.error('Erro ao salvar pendencia de teoria do ciclo:', err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  const limparPendenciaTeoriaCiclo = async (cicloId, disciplinaId) => {
    if (!user) { setError('Usuario nao autenticado'); return false; }
    if (!cicloId || !disciplinaId) return false;
    setLoading(true); setError(null);
    try {
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      await setDoc(cicloRef, {
        pendenciasTeoria: {
          [disciplinaId]: {
            assuntoAtual: '',
            minutosAcumulados: 0,
            status: 'finalizado',
            atualizadoEm: serverTimestamp(),
          },
        },
      }, { merge: true });

      setLoading(false);
      return true;
    } catch (err) {
      console.error('Erro ao limpar pendencia de teoria do ciclo:', err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  const agendarRevisaoCiclo = async ({ cicloId, disciplinaId, disciplinaNome, assunto, intervaloDias, sessaoGlobalIndex }) => {
    if (!user) { setError('Usuario nao autenticado'); return false; }
    setLoading(true); setError(null);
    try {
      const dataAgendada = new Date();
      dataAgendada.setDate(dataAgendada.getDate() + Number(intervaloDias || 0));
      const dataStr = dataAgendada.toISOString().split('T')[0];

      const revisaoId = await upsertCicloRevisao(db, user.uid, {
        cicloId,
        disciplinaId,
        disciplinaNome,
        assunto,
        dataAgendada: dataStr,
        intervaloDias,
        sessaoOrigem: sessaoGlobalIndex,
        origem: 'use_ciclos',
      });

      setLoading(false);
      return revisaoId;
    } catch (err) {
      console.error('Erro ao agendar revisao do ciclo:', err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  const excluirCicloPermanente = async (cicloId) => {
    if (!user?.uid) { setError('Usuario nao autenticado'); return false; }
    if (!cicloId) return false;
    setLoading(true); setError(null);
    try {
      const cycleSnap = await getDoc(doc(db, 'users', user.uid, 'ciclos', cicloId));
      const planningId = cycleSnap.data()?.planejamentoId || cicloId;
      const planningRef = doc(db, 'users', user.uid, 'planejamentos', planningId);
      const planningSnap = await getDoc(planningRef);
      if ((planningSnap.data()?.etapas || []).length > 1) {
        await deletePermanentPlanning(user.uid, planningId);
        setLoading(false);
        return true;
      }
      await deletePlanStudyRecords({
        userId: user.uid,
        planId: cicloId,
        planType: 'ciclo',
      });

      const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
      const disciplinasSnapshot = await getDocs(disciplinasRef);
      const disciplinaRefs = disciplinasSnapshot.docs.map((d) => d.ref);
      for (let i = 0; i < disciplinaRefs.length; i += 400) {
        const batch = writeBatch(db);
        disciplinaRefs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
        await batch.commit();
      }

      const rodadasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'rodadas');
      const rodadasSnapshot = await getDocs(rodadasRef);
      const rodadaRefs = rodadasSnapshot.docs.map((r) => r.ref);
      for (let i = 0; i < rodadaRefs.length; i += 400) {
        const batch = writeBatch(db);
        rodadaRefs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
        await batch.commit();
      }

      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      await deleteDoc(cicloRef);
      if (planningSnap.exists()) await deleteDoc(planningRef);

      try {
        if (typeof window !== 'undefined') {
          ['active_timer_session', 'study_timer_state', 'active_simulado_session'].forEach((k) => {
            try {
              const raw = localStorage.getItem(k);
              if (raw && raw.includes(cicloId)) {
                localStorage.removeItem(k);
              }
            } catch (_) {}
          });
          window.dispatchEvent(new CustomEvent('Planning:Deleted', {
            detail: { planId: cicloId, planType: 'ciclo' },
          }));
          window.dispatchEvent(new CustomEvent('Ciclo:Deleted', {
            detail: { cicloId },
          }));
        }
      } catch (_) {}

      setLoading(false);
      return true;
    } catch (err) {
      console.error('Erro ao excluir ciclo permanentemente:', err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  return {
    criarCiclo,
    ativarCiclo,
    desativarCiclo,
    arquivarCiclo,
    editarCiclo,
    atualizarCicloLegadoParaGuia,
    concluirVoltaCiclo,
    concluirCicloSemanal,
    marcarSessaoConcluida,
    limparCheckoutsManuaisLegados,
    salvarPendenciaTeoriaCiclo,
    limparPendenciaTeoriaCiclo,
    agendarRevisaoCiclo,
    excluirCicloPermanente,
    loading,
    error,
  };
};
