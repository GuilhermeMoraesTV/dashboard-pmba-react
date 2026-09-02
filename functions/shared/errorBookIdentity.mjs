/**
 * Gera a identidade determinística e sem colisões de uma entrada do Caderno de Erros.
 * Este módulo é compartilhado pelo client e pelas Cloud Functions.
 *
 * @param {{
 *   sourceType: 'question' | 'flashcard',
 *   sourceId: string,
 *   questionScope?: 'global' | 'private' | null,
 *   deckId?: string | null,
 * }} source
 * @returns {string}
 */
export function buildErrorBookEntryId({ sourceType, sourceId, questionScope = null, deckId = null }) {
  const normalizedSourceId = String(sourceId || '').trim();
  if (!normalizedSourceId) throw new Error('sourceId e obrigatorio para gerar a identidade do Caderno de Erros.');

  if (sourceType === 'question') {
    if (!['global', 'private'].includes(questionScope)) {
      throw new Error('questionScope global ou private e obrigatorio para entradas de questao.');
    }
    return `question:${questionScope}:${normalizedSourceId}`;
  }

  if (sourceType === 'flashcard') {
    const normalizedDeckId = String(deckId || '').trim();
    if (!normalizedDeckId) throw new Error('deckId e obrigatorio para entradas de flashcard.');
    if (normalizedDeckId.includes(':') || normalizedSourceId.includes(':')) {
      throw new Error('deckId e sourceId de flashcard nao podem conter o delimitador ":".');
    }
    return `flashcard:${normalizedDeckId}:${normalizedSourceId}`;
  }

  throw new Error(`sourceType invalido para o Caderno de Erros: ${sourceType}`);
}
