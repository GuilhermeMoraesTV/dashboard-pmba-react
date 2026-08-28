export const ACADEMIC_XP_PREVIEW_CONFIG = Object.freeze({
  registration: 5,
  minutesBlock: 10,
  xpPerMinutesBlock: 10,
  questionsBlock: 5,
  xpPerQuestionsBlock: 5,
  correctBlock: 5,
  xpPerCorrectBlock: 5,
  accuracyMinimumQuestions: 5,
  accuracyThreshold: 0.85,
  accuracyBonus: 15,
  review: 20,
  dailyMinutes: 720,
  dailyQuestions: 500,
  dailyCorrect: 500,
  dailyRegistrations: 10,
  dailyAccuracyBonuses: 3,
  dailyReviews: 5,
});

const positiveInteger = (value) => Math.max(0, Math.floor(Number(value) || 0));
const isReview = (record = {}) => Boolean(
  record.isRevisao
  || record.revisao
  || String(record.tipoEstudo || '').toLowerCase() === 'revisao'
  || String(record.tipoRegistro || '').toLowerCase() === 'revisao'
);

const blockDelta = (before, after, block, xpPerBlock) => (
  Math.max(0, Math.floor(after / block) - Math.floor(before / block)) * xpPerBlock
);

export const estimateAcademicXPForRecord = ({ existingRecords = [], existingSimulations = [], record = {}, excludeId = null } = {}) => {
  const config = ACADEMIC_XP_PREVIEW_CONFIG;
  const dateKey = String(record.data || '');
  const sameDay = (Array.isArray(existingRecords) ? existingRecords : []).filter((item) => (
    String(item?.data || '') === dateKey
    && (!excludeId || String(item?.id || '') !== String(excludeId))
  ));
  const totals = sameDay.reduce((acc, item) => {
    const questions = positiveInteger(item.questoesFeitas);
    const correct = Math.min(questions, positiveInteger(item.acertos ?? item.questoesAcertadas));
    acc.minutes += positiveInteger(item.tempoEstudadoMinutos ?? item.duracaoMinutos);
    acc.questions += questions;
    acc.correct += correct;
    acc.registrations += 1;
    if (questions >= config.accuracyMinimumQuestions && correct / questions >= config.accuracyThreshold) acc.accuracyBonuses += 1;
    if (isReview(item)) acc.reviews += 1;
    return acc;
  }, { minutes: 0, questions: 0, correct: 0, registrations: 0, accuracyBonuses: 0, reviews: 0 });
  (Array.isArray(existingSimulations) ? existingSimulations : [])
    .filter((item) => String(item?.data || '') === dateKey)
    .forEach((item) => {
      const questions = positiveInteger(item?.resumo?.totalQuestoes ?? item?.questoesFeitas);
      const correct = Math.min(questions, positiveInteger(item?.resumo?.totalAcertos ?? item?.acertos));
      totals.minutes += positiveInteger(item.durationMinutes ?? item.duracaoMinutos ?? item.tempoEstudadoMinutos);
      totals.questions += questions;
      totals.correct += correct;
      if (questions >= config.accuracyMinimumQuestions && correct / questions >= config.accuracyThreshold) totals.accuracyBonuses += 1;
    });

  const minutes = positiveInteger(record.tempoEstudadoMinutos ?? record.duracaoMinutos);
  const questions = positiveInteger(record.questoesFeitas);
  const correct = Math.min(questions, positiveInteger(record.acertos ?? record.questoesAcertadas));
  const beforeMinutes = Math.min(totals.minutes, config.dailyMinutes);
  const afterMinutes = Math.min(totals.minutes + minutes, config.dailyMinutes);
  const beforeQuestions = Math.min(totals.questions, config.dailyQuestions);
  const afterQuestions = Math.min(totals.questions + questions, config.dailyQuestions);
  const beforeCorrect = Math.min(totals.correct, config.dailyCorrect);
  const afterCorrect = Math.min(totals.correct + correct, config.dailyCorrect);
  const qualifiesAccuracy = questions >= config.accuracyMinimumQuestions && correct / questions >= config.accuracyThreshold;

  return (
    (totals.registrations < config.dailyRegistrations ? config.registration : 0)
    + blockDelta(beforeMinutes, afterMinutes, config.minutesBlock, config.xpPerMinutesBlock)
    + blockDelta(beforeQuestions, afterQuestions, config.questionsBlock, config.xpPerQuestionsBlock)
    + blockDelta(beforeCorrect, afterCorrect, config.correctBlock, config.xpPerCorrectBlock)
    + (qualifiesAccuracy && totals.accuracyBonuses < config.dailyAccuracyBonuses ? config.accuracyBonus : 0)
    + (isReview(record) && totals.reviews < config.dailyReviews ? config.review : 0)
  );
};
