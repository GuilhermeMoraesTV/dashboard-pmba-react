import { getDisciplineColorForSlot, getDisciplineKey } from './disciplineColors.js';

export const groupConsolidatedReviewTopics = (topics = [], colorMap = null) => {
  const groups = new Map();
  topics.forEach((topic) => {
    const name = topic?.disciplinaNome || topic?.disciplina || 'Disciplina';
    const key = getDisciplineKey(topic?.disciplinaId || name);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name,
        color: getDisciplineColorForSlot({
          disciplinaId: topic?.disciplinaId,
          disciplinaNome: name,
          cor: topic?.cor,
        }, colorMap),
        topics: [],
        minutes: 0,
      });
    }
    const group = groups.get(key);
    group.topics.push(topic);
    group.minutes += Math.max(0, Number(topic?.tempoMinutos ?? topic?.tempoPlanejadoMinutos ?? 0) || 0);
  });
  return [...groups.values()];
};

export const expandConsolidatedReviewTopics = (reviewSlots = []) => (
  (Array.isArray(reviewSlots) ? reviewSlots : []).flatMap((slot) => {
    const common = {
      slotId: slot?.slotId,
      slotIdBase: slot?.slotIdBase,
      slotIdNoProgresso: slot?.slotIdNoProgresso,
      dataSlot: slot?.dataSlot,
      weekOffset: slot?.weekOffset,
      concluido: Boolean(slot?.concluido),
      tempoMinutos: slot?.tempoMinutos ?? slot?.minutosEstudo ?? 0,
      tempoPlanejadoMinutos: slot?.tempoPlanejadoMinutos ?? slot?.tempoMinutos ?? slot?.minutosEstudo ?? 0,
      progressoMinutos: slot?.progressoMinutos,
      bloqueiaDesmarcar: Boolean(slot?.bloqueiaDesmarcar),
      intervaloDias: slot?.intervaloDias ?? '?',
      isRevisaoAuto: true,
      reagendadaPorFila: Boolean(slot?.reagendadaPorFila),
      dataOriginalFila: slot?.dataOriginalFila || null,
    };
    const topics = Array.isArray(slot?.topicosRevisao) && slot.topicosRevisao.length
      ? slot.topicosRevisao
      : [{
          disciplinaId: slot?.disciplinaId,
          disciplinaNome: slot?.disciplinaNome || 'Revisão',
          assunto: slot?.assunto || slot?.assuntoOriginal || 'Revisão agendada',
        }];

    return topics.map((topic, index) => {
      const fallbackId = `${slot?.slotId || slot?.slotIdBase || 'review'}-${index}`;
      const topicId = topic?.slotId || topic?.slotIdBase || topic?.slotIdNoProgresso || fallbackId;
      return {
        ...common,
        ...topic,
        slotId: topicId,
        slotIdBase: topic?.slotIdBase || topicId,
        slotIdNoProgresso: topic?.slotIdNoProgresso || topic?.slotIdBase || topicId,
        tempoMinutos: topic?.tempoMinutos ?? topic?.tempoPlanejadoMinutos ?? common.tempoMinutos,
        tempoPlanejadoMinutos: topic?.tempoPlanejadoMinutos ?? topic?.tempoMinutos ?? common.tempoPlanejadoMinutos,
      };
    });
  })
);
