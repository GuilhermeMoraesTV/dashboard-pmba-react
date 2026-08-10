export const isStudyRecordLinkedToPlan = (record, planId, planType) => {
  const field = planType === 'cronograma' ? 'cronogramaId' : 'cicloId';
  return String(record?.[field] || '') === String(planId || '');
};
