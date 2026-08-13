/**
 * src/hooks/useCronogramaSystem.js
 *
 * Adaptador React fino — apenas operações Firebase e utilitários de data.
 *
 * INVARIANTE DE TEMPO (garantida por scheduling/index.js + review.js):
 *   Para cada dia d:
 *     minutosEstudo(d)  = horarios[d]*60 × 0.75   (teoria)
 *     minutosRevisao(d) ≤ horarios[d]*60 × 0.25   (revisão 1d/7d/30d)
 *     SOMA              ≤ horarios[d]*60            ✓ NUNCA ultrapassa
 *
 * Exports (máximo 10):
 *   loading, chaveAssuntoDominado,
 *   getWeekStartDate, getCurrentWeekOffset, getWeekDates,
 *   getAgendaSemana (re-export de review.js),
 *   gerarSemanaTemplate (alias de gerarSchedule — compatibilidade),
 *   salvarCronogramaUnificado, toggleSlotConcluido,
 *   toggleAssuntoDominado, excluirCronograma
 */

import { useState } from 'react';
import { db } from '../firebaseConfig';
import {
  collection,
  serverTimestamp,
  writeBatch,
  doc,
  updateDoc,
  getDocs,
  query,
  where,
  getDoc,
  FieldPath,
} from 'firebase/firestore';
import { deletePlanStudyRecords } from '../services/planDeletion';
import {
  buildCronogramaPostponement,
  getCronogramaPostponementRestorePayload,
} from '../utils/cronogramaPostponement';

import {
  getAgendaSemana as _getAgendaSemana,
  getCronogramaReviewBuckets,
  getWeekOffsetFromDate,
  startOfLocalDay,
  formatDateKeyLocal,
  parseDateOnlyLocal,
} from '../services/scheduling/review.js';
export { getAgendaSemana } from '../services/scheduling/review.js';
export { gerarSchedule as gerarSemanaTemplate } from '../services/scheduling/index.js';

// ─── Helper de chave ──────────────────────────────────────────────────────────
export function chaveAssuntoDominado(disciplinaId, assunto) {
  return `${disciplinaId}::${assunto}`;
}

const getPendenciaDisciplinaKey = (disciplinaId) => String(disciplinaId || '').trim();

const updateDocFieldEntries = async (docRef, entries = []) => {
  const args = entries.flatMap(([segments, value]) => [
    new FieldPath(...segments.map((segment) => String(segment))),
    value,
  ]);
  if (!args.length) return;
  await updateDoc(docRef, ...args);
};

// ─── Utilitários de status ────────────────────────────────────────────────────

/**
 * Calcula o status de estudo do dia atual.
 *
 * NOTA: isRevisaoAuto === true → slot de revisão espaçada (1d/7d/30d).
 * Ambos (teoria + revisão) contam para progressoHoje,
 * pois ambos estão dentro do tempo configurado pelo usuário.
 *
 * @param {Object} cronograma
 * @returns {{ temEstudoHoje, progressoHoje, totalSlotsHoje, concluidosHoje }}
 */
export function calcularStatusEstudoHoje(cronograma) {
  const fallback = { temEstudoHoje: false, progressoHoje: 0, totalSlotsHoje: 0, concluidosHoje: 0 };
  if (!cronograma?.semanaTemplate?.length || !cronograma?.dataInicio) return fallback;

  const hoje = startOfLocalDay(new Date());
  const weekOffset = getWeekOffsetFromDate(cronograma.dataInicio, hoje);

  const agenda = _getAgendaSemana(cronograma, weekOffset);
  if (!agenda?.length) return fallback;

  const hojeIdx = hoje.getDay();

  // Todos os slots do dia (teoria + revisão) — ambos contam dentro do tempo configurado
  const slotsHoje = agenda.filter(s => s.dia === hojeIdx);
  if (!slotsHoje.length) return { ...fallback, temEstudoHoje: false };

  // Slots apenas de teoria (para calcular progresso principal)
  const slotsTeoriaHoje = slotsHoje.filter(s => !s.isRevisaoAuto);

  const semKey     = `w${weekOffset}`;
  const progressoW = cronograma.progresso?.[semKey] || {};

  // Concluídos de teoria
  const concluidosTeoria = slotsTeoriaHoje.filter(s => progressoW[s.slotIdBase || s.slotId] === true).length;

  // Concluídos de revisão (via historicoRevisoes)
  const slotsRevisaoHoje  = slotsHoje.filter(s => s.isRevisaoAuto);
  const concluidosRevisao = slotsRevisaoHoje.filter(s => s.concluido === true).length;

  const totalConcluidos = concluidosTeoria + concluidosRevisao;
  const totalSlots      = slotsHoje.length;

  return {
    temEstudoHoje:  slotsTeoriaHoje.length > 0,
    totalSlotsHoje: totalSlots,
    concluidosHoje: totalConcluidos,
    progressoHoje:  totalSlots > 0 ? Math.round((totalConcluidos / totalSlots) * 100) : 0,
  };
}

/**
 * Conta revisões espaçadas pendentes para hoje (incluindo atrasadas).
 *
 * @param {Object} cronograma
 * @returns {{ total: number, atrasadas: number }}
 */
export function contarRevisoesPendentesHoje(cronograma) {
  if (!cronograma?.semanaTemplate?.length || !cronograma?.dataInicio) {
    return { total: 0, atrasadas: 0 };
  }

  const buckets = getCronogramaReviewBuckets(cronograma, new Date());
  return {
    total: buckets.hoje.filter((slot) => !slot.concluido).length + buckets.atrasadas.filter((slot) => !slot.concluido).length,
    atrasadas: buckets.atrasadas.filter((slot) => !slot.concluido).length,
  };
}

// ─── Hook principal ───────────────────────────────────────────────────────────
export const useCronogramaSystem = (user) => {
  const [loading, setLoading] = useState(false);

  const resolveWeekOffsetForSlot = (slot, explicitWeekOffset = null, dataInicioCronograma = null) => {
    if (Number.isFinite(Number(explicitWeekOffset))) return Number(explicitWeekOffset);
    if (Number.isFinite(Number(slot?.weekOffset))) return Number(slot.weekOffset);
    if (!dataInicioCronograma) return null;
    return getWeekOffsetFromDate(
      dataInicioCronograma,
      slot?.dataSlot || slot?.dataOriginal || slot?.dataOriginalRevisao || new Date()
    );
  };

  // ── Utilitários de data ───────────────────────────────────────────────────

  // [FIX-5] getWeekStartDate: retorna dataInicio + weekOffset*7 dias,
  // SEM ancorar no domingo da semana. O cronograma começa no dia exato
  // do dataInicio (ex: Segunda), não no domingo anterior.
  const getWeekStartDate = (dataRef, weekOffset = 0) => {
    const d = startOfLocalDay(dataRef);
    // Aplica apenas o offset de semanas — sem subtrair d.getDay()
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  };

  // [FIX-5] getCurrentWeekOffset: calcula quantas semanas completas de 7 dias
  // se passaram desde dataInicio (sem ancorar no domingo).
  const getCurrentWeekOffset = (dataInicio) => {
    return getWeekOffsetFromDate(dataInicio, new Date());
  };

  // [FIX-5] getWeekDates: gera 7 datas consecutivas a partir de dataInicio + weekOffset*7.
  // NÃO âncora no domingo — a "semana" começa no dia configurado pelo usuário.
  const getWeekDates = (dataInicio, weekOffset) => {
    const start = getWeekStartDate(parseDateOnlyLocal(dataInicio), weekOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  // ── Operações Firebase ────────────────────────────────────────────────────

  /**
   * Alterna o estado concluído de um slot.
   *
   * Para slots de teoria: grava em progresso.w{n}.{slotId}
   * Para revisões automáticas (isRevisaoAuto): grava em historicoRevisoes.{slotId}
   *   → review.js usa historicoRevisoes para saber quais revisões foram concluídas.
   *
   * @param {string} cronogramaId
   * @param {Object} slot - Objeto completo do slot/tarefa (vem de getAgendaSemana).
   * @param {number} weekOffset
   * @returns {Promise<boolean>}
   */
  const toggleSlotConcluido = async (cronogramaId, slot, weekOffset) => {
    try {
      const docRef    = doc(db, 'users', user.uid, 'cronogramas', cronogramaId);
      const novoEstado = !slot.concluido;
      const resolvedWeekOffset = resolveWeekOffsetForSlot(slot, weekOffset, slot?.dataInicioCronograma || slot?.cronogramaDataInicio || null);
      if (!Number.isFinite(Number(resolvedWeekOffset))) {
        throw new Error('week-offset-indisponivel');
      }
      const semKey = `w${resolvedWeekOffset}`;

      // Revisões automáticas: usa slotId diretamente (não tem slotIdBase no progresso semanal)
      if (slot.isRevisaoAuto) {
        const dataFormatada = slot.dataSlot || formatDateKeyLocal(new Date());
        const fieldEntries = [];
        const minutosRevisao = Number(slot.tempoMinutos ?? slot.tempoPlanejadoMinutos ?? slot.minutosEstudo ?? 15) || 15;
        const progressoAtualRevisao = Math.max(0, Number(slot.progressoMinutos || 0));
        const progressoAoMarcar = Math.max(progressoAtualRevisao, minutosRevisao);

        if (!novoEstado && slot.bloqueiaDesmarcar) {
          return false;
        }

        if (novoEstado) {
          // Marca como concluída → salva no historicoRevisoes
          fieldEntries.push([['historicoRevisoes', slot.slotId], {
            disciplinaId:  slot.disciplinaId,
            disciplinaNome: slot.disciplinaNome || slot.disciplina || null,
            assunto:       slot.assunto,
            dataConclusao: dataFormatada,
            intervaloDias: slot.intervaloDias ?? 0,
            tempoMinutos: minutosRevisao,
            weekOffset: resolvedWeekOffset,
          }]);
          fieldEntries.push([['revisoesReagendadas', slot.slotId], null]);
          fieldEntries.push([['revisoesDesmarcadas', slot.slotId], null]);
          fieldEntries.push([['progressoRevisoesMinutos', slot.slotId], progressoAoMarcar]);
        } else {
          // Desmarca → remove do historicoRevisoes
          fieldEntries.push([['historicoRevisoes', slot.slotId], null]);
          fieldEntries.push([['revisoesDesmarcadas', slot.slotId], true]);
        }

        fieldEntries.push([['progresso', semKey, slot.slotId], novoEstado ? true : null]);

        await updateDocFieldEntries(docRef, fieldEntries);
        return true;
      }

      // Slots de teoria: usa slotIdBase (que é o slotId do template, sem prefixo de semana)
      const slotIdNoProgresso = slot.slotIdBase || slot.slotId;
      const minutosPlanejados = Number(slot.tempoMinutos ?? slot.minutosEstudo ?? 0);
      const fieldEntries = [
        [['progresso', semKey, slotIdNoProgresso], novoEstado],
      ];
      if (slot.slotId && slot.slotId !== slotIdNoProgresso) {
        fieldEntries.push([['progresso', semKey, slot.slotId], novoEstado]);
      }
      if (minutosPlanejados > 0) {
        const progressoAtual = Number(slot.progressoMinutos || 0);
        const proximoProgresso = novoEstado
          ? Math.max(progressoAtual, minutosPlanejados)
          : 0;
        fieldEntries.push([['progressoMinutos', semKey, slotIdNoProgresso], proximoProgresso]);
        if (slot.slotId && slot.slotId !== slotIdNoProgresso) {
          fieldEntries.push([['progressoMinutos', semKey, slot.slotId], proximoProgresso]);
        }
      }
      if (novoEstado && slot.isPendenciaTeoria) {
        const disciplinaKey = getPendenciaDisciplinaKey(slot.disciplinaId);
        if (disciplinaKey) {
          fieldEntries.push([['pendenciasTeoria', disciplinaKey], null]);
        }
      }
      await updateDocFieldEntries(docRef, fieldEntries);
      return true;

    } catch (e) {
      console.error('Erro ao alternar slot:', e);
      return false;
    }
  };

  const concluirRevisaoCronograma = async (cronogramaId, slot, dataInicioCronograma) => {
    if (!cronogramaId || !slot) return false;
    return toggleSlotConcluido(
      cronogramaId,
      {
        ...slot,
        concluido: Boolean(slot.concluido),
        dataInicioCronograma,
      },
      null
    );
  };

  const marcarTeoriaAindaNaoConcluida = async (cronogramaId, slot, weekOffset) => {
    if (!cronogramaId || !slot || slot.isRevisaoAuto || slot.isRevisao || !slot.disciplinaId) {
      return false;
    }

    try {
      const docRef = doc(db, 'users', user.uid, 'cronogramas', cronogramaId);
      const resolvedWeekOffset = resolveWeekOffsetForSlot(
        slot,
        weekOffset,
        slot?.dataInicioCronograma || slot?.cronogramaDataInicio || null
      );
      if (!Number.isFinite(Number(resolvedWeekOffset))) {
        throw new Error('week-offset-indisponivel');
      }

      const semKey = `w${resolvedWeekOffset}`;
      const slotIdNoProgresso = slot.slotIdBase || slot.slotId;
      const disciplinaKey = getPendenciaDisciplinaKey(slot.disciplinaId);
      if (!disciplinaKey || !slotIdNoProgresso) {
        throw new Error('pendencia-dados-invalidos');
      }

      const assuntoPendencia = slot.assunto || slot.assuntoOriginal || slot.disciplinaNome || slot.disciplina || 'Disciplina';
      const nowIso = new Date().toISOString();
      const pendenciaPayload = {
        assunto: assuntoPendencia,
        origemSlotIdBase: slotIdNoProgresso,
        criadoEm: slot?.pendenciaTeoriaCriadoEm || nowIso,
        ultimaMarcacaoEm: nowIso,
      };

      const fieldEntries = [
        [['progresso', semKey, slotIdNoProgresso], false],
        [['progressoMinutos', semKey, slotIdNoProgresso], 0],
        [['pendenciasTeoria', disciplinaKey], pendenciaPayload],
      ];

      if (slot.slotId && slot.slotId !== slotIdNoProgresso) {
        fieldEntries.push([['progresso', semKey, slot.slotId], false]);
        fieldEntries.push([['progressoMinutos', semKey, slot.slotId], 0]);
      }

      await updateDocFieldEntries(docRef, fieldEntries);
      return true;
    } catch (e) {
      console.error('Erro ao marcar teoria ainda nao concluida:', e);
      return false;
    }
  };

  const reagendarRevisao = async (cronogramaId, slot, dataDestino = new Date()) => {
    if (!cronogramaId || !slot?.slotId) return false;
    try {
      await updateDocFieldEntries(doc(db, 'users', user.uid, 'cronogramas', cronogramaId), [
        [['revisoesReagendadas', slot.slotId], {
          reagendadoPara: formatDateKeyLocal(dataDestino),
          dataOriginal: slot.dataAgendadaRevisao || slot.dataSlot || slot.dataOriginal || slot.dataOriginalRevisao || null,
          disciplinaId: slot.disciplinaId ?? null,
          assunto: slot.assunto || slot.assuntoOriginal || null,
          intervaloDias: slot.intervaloDias ?? 0,
          weekOffset: Number.isFinite(Number(slot.weekOffset)) ? Number(slot.weekOffset) : null,
          reagendadoEm: serverTimestamp(),
        }],
      ]);
      return true;
    } catch (e) {
      console.error('Erro ao reagendar revisão:', e);
      return false;
    }
  };

  const reagendarRevisaoCronograma = async (cronogramaId, slot, dataDestino = new Date(), dataInicioCronograma = null) => {
    if (!cronogramaId || !slot?.slotId) return false;
    return reagendarRevisao(
      cronogramaId,
      {
        ...slot,
        weekOffset: resolveWeekOffsetForSlot(slot, slot?.weekOffset, dataInicioCronograma),
      },
      dataDestino
    );
  };

  /**
   * Alterna o estado "dominado" de um assunto.
   */
  const toggleAssuntoDominado = async (cronogramaId, disciplinaId, assunto, estadoAtual) => {
    try {
      const chave = chaveAssuntoDominado(disciplinaId, assunto);
      await updateDoc(doc(db, 'users', user.uid, 'cronogramas', cronogramaId), {
        [`progresso.dominios.${chave}`]: !estadoAtual,
      });
      return !estadoAtual;
    } catch (e) {
      console.error('Erro ao marcar assunto como dominado:', e);
      return null;
    }
  };

  /**
   * Ativa um cronograma e desativa os demais ativos do usuário.
   */
  const ativarCronograma = async (cronogramaId) => {
    if (!cronogramaId) return false;
    if (!user?.uid) return false;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const cronogramaRef = doc(db, 'users', user.uid, 'cronogramas', cronogramaId);
      const ativosSnap = await getDocs(
        query(collection(db, 'users', user.uid, 'cronogramas'), where('ativo', '==', true))
      );
      ativosSnap.docs.forEach((d) => {
        if (d.id !== cronogramaId) batch.update(d.ref, { ativo: false });
      });
      batch.update(cronogramaRef, {
        ativo: true,
        revisoesReagendadas: {},
      });

      await batch.commit();
      return true;
    } catch (e) {
      console.error('Erro ao ativar cronograma:', e);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Desativa um cronograma sem excluir/arquivar.
   */
  const desativarCronograma = async (cronogramaId) => {
    if (!cronogramaId) return false;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'cronogramas', cronogramaId), { ativo: false });
      return true;
    } catch (e) {
      console.error('Erro ao desativar cronograma:', e);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Adia o início do cronograma em 1 semana.
   */
  const adiarCronograma = async (cronogramaId, cronogramaAtual, days = 7) => {
    if (!cronogramaId || !cronogramaAtual?.dataInicio) return false;
    setLoading(true);
    try {
      const postponement = buildCronogramaPostponement(cronogramaAtual, days);
      await updateDoc(
        doc(db, 'users', user.uid, 'cronogramas', cronogramaId),
        postponement.nextDates
      );
      return { cronogramaId, ...postponement };
    } catch (e) {
      console.error('Erro ao adiar cronograma:', e);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Restaura todas as datas modificadas pelo ultimo adiamento.
   */
  const desfazerAdiamentoCronograma = async (postponement) => {
    if (!postponement?.cronogramaId) return false;
    setLoading(true);
    try {
      const restorePayload = getCronogramaPostponementRestorePayload(postponement);
      await updateDoc(
        doc(db, 'users', user.uid, 'cronogramas', postponement.cronogramaId),
        restorePayload
      );
      return true;
    } catch (e) {
      console.error('Erro ao desfazer adiamento do cronograma:', e);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Desativa todos os cronogramas ativos e salva o novo como ativo.
   *
   * Nota: semanaTemplate contém apenas slots de TEORIA (75% do tempo).
   * As revisões (25%) são calculadas dinamicamente por getAgendaSemana.
   */
  const salvarCronogramaUnificado = async (dadosGerais, semanaTemplate, disciplinas) => {
    setLoading(true);
    try {
      const batch = writeBatch(db);

      const cronosAtivosSnap = await getDocs(
        query(collection(db, 'users', user.uid, 'cronogramas'), where('ativo', '==', true))
      );
      cronosAtivosSnap.docs.forEach((d) => batch.update(d.ref, { ativo: false }));

      const cRef = doc(collection(db, 'users', user.uid, 'cronogramas'));
      batch.set(cRef, {
        ...dadosGerais,
        ativo:               true,
        criadoEm:            serverTimestamp(),
        semanaTemplate,
        disciplinasSnapshot: disciplinas,
        progresso:           {},
        progressoMinutos:    {},
        pendenciasTeoria:    {},
        historicoRevisoes:   {},  // ← inicializa historicoRevisoes vazio
      });

      await batch.commit();
      return cRef.id;
    } catch (e) {
      console.error('Erro ao salvar cronograma:', e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const atualizarCronogramaUnificado = async (cronogramaId, dadosGerais, semanaTemplate, disciplinas) => {
    if (!cronogramaId) return null;
    setLoading(true);
    try {
      const docRef = doc(db, 'users', user.uid, 'cronogramas', cronogramaId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        console.error('[atualizarCronogramaUnificado] Cronograma nao encontrado.');
        return null;
      }

      await updateDoc(docRef, {
        ...dadosGerais,
        semanaTemplate,
        disciplinasSnapshot: disciplinas,
        editadoEm: serverTimestamp(),
      });

      return cronogramaId;
    } catch (e) {
      console.error('[atualizarCronogramaUnificado] Erro:', e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Edita cronograma preservando progresso e historicoRevisoes.
   */
  const editarCronograma = async (cronogramaId, novosDados, novaTemplate = null, disciplinas = []) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'users', user.uid, 'cronogramas', cronogramaId);
      const snap   = await getDoc(docRef);
      if (!snap.exists()) {
        console.error('[editarCronograma] Cronograma não encontrado.');
        return false;
      }

      const existing  = snap.data();
      const progresso = existing.progresso || {};

      let concluidosCount = 0;
      Object.values(progresso).forEach(sem => {
        concluidosCount += Object.values(sem).filter(Boolean).length;
      });

      const updates = {
        nome:               novosDados.nome,
        totalHorasSemanais: novosDados.totalHorasSemanais,
        diasEstudo:         novosDados.diasEstudo,
        editadoEm:          serverTimestamp(),
      };

      if (novaTemplate) {
        updates.semanaTemplate = novaTemplate;
        const totalSemanas = existing.totalSemanasNecessarias || 12;
        const dtInicio     = existing.dataInicio;
        if (dtInicio) {
          const dtFimObj = new Date(`${dtInicio}T12:00:00`);
          dtFimObj.setDate(dtFimObj.getDate() + totalSemanas * 7);
          updates.dataFim = dtFimObj.toISOString().split('T')[0];
        }
      }

      await updateDoc(docRef, updates);

      if (import.meta.env.DEV) {
        console.log(
          `[editarCronograma] "${novosDados.nome}" editado. ` +
          `${concluidosCount} slots concluídos preservados.` +
          (novaTemplate ? ` Template regenerado (${novaTemplate.length} slots).` : '')
        );
      }

      return true;
    } catch (e) {
      console.error('[editarCronograma] Erro:', e);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Exclui cronograma e, opcionalmente, arquiva o ciclo vinculado.
   */
  const excluirCronograma = async (cronogramaId, cicloVinculadoId) => {
    setLoading(true);
    try {
      await deletePlanStudyRecords({
        userId: user.uid,
        planId: cronogramaId,
        planType: 'cronograma',
      });
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', user.uid, 'cronogramas', cronogramaId));
      if (cicloVinculadoId) {
        batch.update(doc(db, 'users', user.uid, 'ciclos', cicloVinculadoId), {
          arquivado: true,
          ativo:     false,
        });
      }
      await batch.commit();
      return true;
    } catch (e) {
      console.error('Erro ao excluir cronograma:', e);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    chaveAssuntoDominado,
    getWeekStartDate,
    getCurrentWeekOffset,
    getWeekDates,
    ativarCronograma,
    desativarCronograma,
    adiarCronograma,
    desfazerAdiamentoCronograma,
    salvarCronogramaUnificado,
    atualizarCronogramaUnificado,
    editarCronograma,
    toggleSlotConcluido,
    marcarTeoriaAindaNaoConcluida,
    concluirRevisaoCronograma,
    reagendarRevisao,
    reagendarRevisaoCronograma,
    toggleAssuntoDominado,
    excluirCronograma,
  };
};

export function contarRevisoesPendentes(cronograma) {
  if (!cronograma) return 0;
  try {
    const buckets = getCronogramaReviewBuckets(cronograma, new Date());
    return buckets.hoje.filter((slot) => !slot.concluido).length
      + buckets.atrasadas.filter((slot) => !slot.concluido).length;
  } catch (e) {
    console.warn("[contarRevisoesPendentes] Erro:", e);
    return 0;
  }
}
