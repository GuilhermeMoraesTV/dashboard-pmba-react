/**
 * @fileoverview Assinaturas de integração do serviço de IA e Processamento de Documentos (para implementação pelo Codex).
 * Encapsula chamadas de domínio para geração de flashcards, questões e resumos.
 */

import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db, functions } from '../../firebaseConfig.js';

/**
 * Solicita a geração assíncrona de Flashcards a partir de um documento PDF enviado pelo usuário.
 * @param {import('../../contracts/ai.js').FlashcardGenerationRequest} request
 * @returns {Promise<import('../../contracts/ai.js').AIGenerationJobResponse>}
 */
export async function requestFlashcardGeneration(request) {
  if (!request?.sourceId) {
    throw new Error('sourceId e obrigatorio para geracao de flashcards.');
  }

  try {
    const generateFn = httpsCallable(functions, 'generateFlashcardsFromDoc');
    const result = await generateFn({
      sourceId: request.sourceId,
      deckId: request.deckId || null,
    });
    return /** @type {import('../../contracts/ai.js').AIGenerationJobResponse} */ (result.data);
  } catch (error) {
    console.error('[AIService] Erro ao solicitar geracao de flashcards:', error);
    throw error;
  }
}

/**
 * Solicita a geração de Questões de fixação a partir de um documento PDF.
 * @param {import('../../contracts/ai.js').QuestionGenerationRequest} request
 * @returns {Promise<import('../../contracts/ai.js').AIGenerationJobResponse>}
 */
export async function requestQuestionGeneration(request) {
  if (!request?.sourceId) {
    throw new Error('sourceId e obrigatorio para geracao de questoes.');
  }

  try {
    const generateFn = httpsCallable(functions, 'generateQuestionsFromDoc');
    const result = await generateFn({
      sourceId: request.sourceId,
      targetCount: request.targetCount,
      difficulty: request.difficulty || 'medium',
    });
    return /** @type {import('../../contracts/ai.js').AIGenerationJobResponse} */ (result.data);
  } catch (error) {
    console.error('[AIService] Erro ao solicitar geracao de questoes:', error);
    throw error;
  }
}

/**
 * Solicita a geração de Resumo estruturado de um documento.
 * @param {import('../../contracts/ai.js').SummaryGenerationRequest} request
 * @returns {Promise<import('../../contracts/ai.js').AIGenerationJobResponse>}
 */
export async function requestSummaryGeneration(request) {
  if (!request?.sourceId) {
    throw new Error('sourceId e obrigatorio para geracao de resumo.');
  }

  try {
    const generateFn = httpsCallable(functions, 'generateSummaryFromDoc');
    const result = await generateFn({
      sourceId: request.sourceId,
    });
    return /** @type {import('../../contracts/ai.js').AIGenerationJobResponse} */ (result.data);
  } catch (error) {
    console.error('[AIService] Erro ao solicitar geracao de resumo:', error);
    throw error;
  }
}

/**
 * Consulta itens gerados por IA em rascunho ou aprovados.
 * Caminho Firestore: users/{userId}/generated_items
 * @param {string} userId ID do usuário.
 * @param {{ type?: 'flashcard' | 'question' | 'summary', status?: 'draft' | 'buffer' | 'materialized' | 'approved' | 'rejected' }} [filter]
 * @returns {Promise<import('../../contracts/documents.js').GeneratedItem[]>}
 */
export async function getGeneratedItems(userId, filter = {}) {
  if (!userId) throw new Error('userId e obrigatorio em getGeneratedItems.');
  const snapshot = await getDocs(query(
    collection(db, 'users', userId, 'generated_items'),
    orderBy('createdAt', 'desc'),
  ));
  return snapshot.docs
    .map((item) => {
      const data = item.data() || {};
      return {
        id: item.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || null,
      };
    })
    .filter((item) => (!filter.type || item.type === filter.type) && (!filter.status || item.status === filter.status));
}
