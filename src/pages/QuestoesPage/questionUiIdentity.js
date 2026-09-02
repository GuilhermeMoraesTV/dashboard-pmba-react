export const questionUiKey = (question = {}) => `${question.questionScope || 'global'}:${question.id || ''}`;

export const removeScopedQuestion = (questions = [], target = {}) => (
  questions.filter((question) => questionUiKey(question) !== questionUiKey(target))
);
