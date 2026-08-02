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
  updateDoc,
  getDoc,
  setDoc,
  deleteField
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

export {
  calcularDistribuicao,
  gerarOrdemSessoes,
  normalizarNivelDominio,
  obterPesoDisciplina,
  PESO_POR_NIVEL,
};

const dateToYMDLocal = (date = new Date()) => {
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
    if (registro.conclusaoId != null || !registro.disciplinaId) return;
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
      const tempoSessaoMinutos = normalizeTempoSessaoMinutos(cicloData.tempoSessaoMinutos, cicloData.diasEstudo);
      const disciplinasComTempo = calcularDistribuicao(
        cicloData.disciplinas,
        cargaHorariaTotalMinutos,
        tempoSessaoMinutos,
        { diasEstudo: cicloData.diasEstudo }
      );
      const disciplinasComEstadoCompleto = Array.isArray(cicloData.disciplinasEstadoCompleto) && cicloData.disciplinasEstadoCompleto.length > 0
        ? cicloData.disciplinasEstadoCompleto
        : disciplinasComTempo;

      const batch = writeBatch(db);

      // 1. Desativa ciclos anteriores
      await desativarCiclosAntigos(batch, user.uid);

      // 2. Cria documento do Ciclo Principal
      const cicloRef = doc(collection(db, 'users', user.uid, 'ciclos'));

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

      batch.set(cicloRef, {
        nome: cicloData.nome,
        cargaHorariaSemanalTotal: cargaHorariaTotal,
        diasEstudo: cicloData.diasEstudo || null,
        tempoSessaoMinutos,
        revisaoModo: normalizeRevisaoModoCiclo(cicloData.revisaoModo),
        modoExibirAssuntos: cicloData.modoExibirAssuntos !== false,
        modoExibirTempo: cicloData.modoExibirTempo || 'detalhado',
        coresDisciplinasAtivas: cicloData.coresDisciplinasAtivas !== false,
        totalSessoesCiclo,
        ordemSessoes: gerarOrdemSessoes(disciplinasAtivas, 0, {
          diasEstudo: cicloData.diasEstudo,
          tempoSessaoMinutos,
        }),
        disciplinaTodosDiasId: disciplinaTodosDiasIds[0] || null,
        disciplinaTodosDiasIds,
        sessoesConcluidas: [],
        progressoSessoes: {},
        embaralharOffset: 0,
        ativo: true,
        dataCriacao: serverTimestamp(),
        arquivado: false,
        conclusoes: 0,
        logoUrl: cicloData.logoUrl || null,
        editalId: cicloData.editalId || cicloData.templateId || null,
        templateOrigem: cicloData.templateId || null,
        tipo: cicloData.tipo || 'padrao',
        versaoCiclo: CICLO_GUIDE_VERSION,
        guiaAtualizadoEm: serverTimestamp()
      });

      // 3. Cria Subcolecao de Disciplinas e salva index para preservar ordem
      disciplinasParaSalvar.forEach((disciplina) => {
        const disciplinaAtiva = disciplina._disciplinaAtiva || disciplina;
        const corDisciplina = disciplina.cor || disciplinaAtiva.cor || null;
        batch.set(disciplina._ref, {
          nome: disciplina.nome,
          peso: obterPesoDisciplina(disciplina),
          nivelDominio: normalizarNivelDominio(disciplina.nivelDominio || disciplina.nivel, disciplina.peso),
          tempoAlocadoSemanalMinutos: disciplina.inCiclo === false ? 0 : Number(disciplinaAtiva.tempoAlocadoMinutos || 0),
          sessoesPorCiclo: disciplina.inCiclo === false ? 0 : (Number(disciplinaAtiva.sessoesPorCiclo) || 1),
          assuntos: Array.isArray(disciplina.assuntos) ? disciplina.assuntos : [],
          index: disciplina._position,
          inCiclo: disciplina.inCiclo !== false,
          estudarTodosDias: disciplina.inCiclo !== false && disciplina.estudarTodosDias === true,
          ...(corDisciplina ? { cor: corDisciplina } : {}),
        });
      });

      await batch.commit();
      setLoading(false);
      return cicloRef.id;

    } catch (err) {
      console.error('Erro ao criar ciclo:', err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  const ativarCiclo = async (cicloId) => {
    if (!user) { setError('Usuario nao autenticado'); return false; }
    setLoading(true); setError(null);
    try {
      const batch = writeBatch(db);
      await desativarCiclosAntigos(batch, user.uid);
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      batch.update(cicloRef, { ativo: true, arquivado: false });
      await batch.commit();
      setLoading(false); return true;
    } catch (err) { console.error('Erro ao ativar ciclo:', err); setError(err.message); setLoading(false); return false; }
  };

  const desativarCiclo = async (cicloId) => {
    if (!user) { setError('Usuario nao autenticado'); return false; }
    setLoading(true); setError(null);
    try {
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      await updateDoc(cicloRef, { ativo: false });
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
      await updateDoc(cicloRef, { arquivado: true, ativo: false });
      setLoading(false); return true;
    } catch (err) { console.error('Erro ao arquivar ciclo:', err); setError(err.message); setLoading(false); return false; }
  };

  const editarCiclo = async (cicloId, cicloData, options = {}) => {
    if (!user) { setError('Usuario nao autenticado'); return false; }
    setLoading(true); setError(null);
    try {
      const cargaHorariaTotal = Number(cicloData.cargaHorariaTotal || 0);
      const cargaHorariaTotalMinutos = cargaHorariaTotal * 60;
      const tempoSessaoMinutos = normalizeTempoSessaoMinutos(cicloData.tempoSessaoMinutos, cicloData.diasEstudo);
      const disciplinasComTempo = calcularDistribuicao(
        cicloData.disciplinas,
        cargaHorariaTotalMinutos,
        tempoSessaoMinutos,
        { diasEstudo: cicloData.diasEstudo }
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
        embaralharOffset: 0,
      };

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
        const corDisciplina = disciplina.cor || disciplinaAtiva?.cor || null;

        if (disciplina.id && !String(disciplina.id).startsWith('temp-') && !String(disciplina.id).startsWith('manual-')) {
          disciplinaRef = doc(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas', disciplina.id);
          const discUpdate = {
            nome: disciplina.nome,
            peso: obterPesoDisciplina(disciplina),
            nivelDominio: normalizarNivelDominio(disciplina.nivelDominio || disciplina.nivel, disciplina.peso),
            tempoAlocadoSemanalMinutos: tempoAlocadoNumerico,
            sessoesPorCiclo,
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
            estudarTodosDias: disciplina.estudarTodosDias === true,
          });
        } else {
          disciplinaRef = doc(collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas'));
          batch.set(disciplinaRef, {
            nome: disciplina.nome,
            peso: obterPesoDisciplina(disciplina),
            nivelDominio: normalizarNivelDominio(disciplina.nivelDominio || disciplina.nivel, disciplina.peso),
            tempoAlocadoSemanalMinutos: tempoAlocadoNumerico,
            sessoesPorCiclo,
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

      const novaOrdemSessoes = gerarOrdemSessoes(disciplinasParaOrdem, 0, {
        diasEstudo: cicloData.diasEstudo,
        tempoSessaoMinutos,
      });
      updateData.totalSessoesCiclo = disciplinasParaOrdem.reduce(
        (acc, d) => acc + (Number(d.sessoesPorCiclo) || 1),
        0
      );
      updateData.ordemSessoes = novaOrdemSessoes;
      updateData.disciplinaTodosDiasIds = disciplinasParaOrdem
        .filter((disciplina) => disciplina.estudarTodosDias)
        .map((disciplina) => disciplina.id);
      updateData.disciplinaTodosDiasId = updateData.disciplinaTodosDiasIds[0] || null;

      if (options.guideUpgrade) {
        updateData.versaoCiclo = CICLO_GUIDE_VERSION;
        updateData.guiaAtualizadoEm = serverTimestamp();

        const cicloAtualSnap = await getDoc(cicloRef);
        const cicloAtualData = cicloAtualSnap.data() || {};
        const hasExistingSessionProgress = Array.isArray(cicloAtualData.sessoesConcluidas)
          || (cicloAtualData.progressoSessoes && Object.keys(cicloAtualData.progressoSessoes).length > 0);

        if (!hasExistingSessionProgress) {
          const registrosSnapshot = await getDocs(query(collection(db, 'users', user.uid, 'registrosEstudo'), where('cicloId', '==', cicloId)));
          const registros = registrosSnapshot.docs.map((registroDoc) => registroDoc.data() || {});
          Object.assign(updateData, buildLegacyProgressFromRecords({
            ordemSessoes: novaOrdemSessoes,
            disciplinas: disciplinasParaOrdem.map((d) => ({ id: d.id })),
            registros,
            tempoSessaoMinutos,
          }));
        }
      } else {
        updateData.sessoesConcluidas = [];
        updateData.progressoSessoes = {};
      }

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
      const batch = writeBatch(db);
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      const cicloDoc = await getDoc(cicloRef);
      const cicloData = cicloDoc.data() || {};
      const conclusoesAtuais = cicloData.conclusoes || 0;
      const proximaConclusaoId = conclusoesAtuais + 1;
      const embaralharOffsetAtual = Number(cicloData.embaralharOffset || 0);
      const tempoSessaoMinutos = normalizeTempoSessaoMinutos(cicloData.tempoSessaoMinutos, cicloData.diasEstudo);

      const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
      const disciplinasSnapshot = await getDocs(disciplinasRef);
      const disciplinas = disciplinasSnapshot.docs.map((discDoc) => {
        const discData = discDoc.data() || {};
        const tempoAlocado = Number(discData.tempoAlocadoSemanalMinutos || 0);
        const sessoesPorCiclo = Number(discData.sessoesPorCiclo) || Math.max(1, Math.round(tempoAlocado / tempoSessaoMinutos));
        return {
          id: discDoc.id,
          sessoesPorCiclo,
          estudarTodosDias: discData.estudarTodosDias === true,
        };
      });

      const totalDisciplinas = disciplinas.length;
      const novoOffset = totalDisciplinas > 0 ? (embaralharOffsetAtual + 1) % totalDisciplinas : 0;
      const novaOrdemSessoes = totalDisciplinas > 0
        ? gerarOrdemSessoes(disciplinas, novoOffset, {
            diasEstudo: cicloData.diasEstudo,
            tempoSessaoMinutos,
          })
        : [];
      const totalSessoesCiclo = disciplinas.reduce((acc, d) => acc + (Number(d.sessoesPorCiclo) || 1), 0);

      batch.update(cicloRef, {
        conclusoes: proximaConclusaoId,
        ultimaConclusao: serverTimestamp(),
        ordemSessoes: novaOrdemSessoes,
        totalSessoesCiclo,
        sessoesConcluidas: [],
        progressoSessoes: {},
        embaralharOffset: novoOffset,
      });

      const registrosRef = collection(db, 'users', user.uid, 'registrosEstudo');
      const q = query(registrosRef, where('cicloId', '==', cicloId));
      const registrosSnapshot = await getDocs(q);
      registrosSnapshot.forEach((document) => {
        const data = document.data();
        if (data.conclusaoId == null) {
          batch.update(document.ref, { conclusaoId: proximaConclusaoId });
        }
      });

      await batch.commit();
      setLoading(false); return true;
    } catch (err) { console.error('Erro ao concluir ciclo:', err); setError(err.message); setLoading(false); return false; }
  };

  // Alias para compatibilidade com codigo antigo
  const concluirCicloSemanal = concluirVoltaCiclo;

  const marcarSessaoConcluida = async (cicloId, sessaoGlobalIndex, options = {}) => {
    if (!user) { setError('Usuario nao autenticado'); return false; }
    setLoading(true); setError(null);
    try {
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      const cicloDoc = await getDoc(cicloRef);
      const data = cicloDoc.data() || {};
      const concluidas = Array.isArray(data.sessoesConcluidas) ? data.sessoesConcluidas.map(Number) : [];
      const sessaoIndex = Number(sessaoGlobalIndex);
      const completionDate = dateToYMDLocal(options.concluidaEm || new Date());
      const tempoSessaoMinutos = Math.max(1, Number(data.tempoSessaoMinutos || 50));
      const progressoSessoes = data.progressoSessoes || {};
      const progressoAtual = Number(progressoSessoes?.[sessaoIndex] || progressoSessoes?.[String(sessaoIndex)] || 0);
      const jaConcluida = concluidas.includes(sessaoIndex) || progressoAtual >= tempoSessaoMinutos;

      if (jaConcluida) {
        await updateDoc(cicloRef, {
          sessoesConcluidas: concluidas.filter(i => i !== sessaoIndex),
          [`sessoesConcluidasDetalhes.${sessaoIndex}`]: deleteField(),
          [`progressoSessoes.${sessaoIndex}`]: 0,
        });
      } else {
        await updateDoc(cicloRef, {
          sessoesConcluidas: [...concluidas, sessaoIndex],
          [`progressoSessoes.${sessaoIndex}`]: tempoSessaoMinutos,
          [`sessoesConcluidasDetalhes.${sessaoIndex}`]: {
            concluidaEm: completionDate,
            atualizadoEm: serverTimestamp(),
          },
        });
      }

      setLoading(false);
      return true;
    } catch (err) {
      console.error('Erro ao marcar sessao concluida:', err);
      setError(err.message);
      setLoading(false);
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
    if (!user) { setError('Usuario nao autenticado'); return false; }
    setLoading(true); setError(null);
    try {
      const batch = writeBatch(db);
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
      const disciplinasSnapshot = await getDocs(disciplinasRef);
      disciplinasSnapshot.docs.forEach(docItem => { batch.delete(docItem.ref); });
      batch.delete(cicloRef);
      await batch.commit();
      setLoading(false); return true;
    } catch (err) { console.error('Erro ao excluir ciclo permanentemente:', err); setError(err.message); setLoading(false); return false; }
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
    salvarPendenciaTeoriaCiclo,
    limparPendenciaTeoriaCiclo,
    agendarRevisaoCiclo,
    excluirCicloPermanente,
    loading,
    error,
  };
};
