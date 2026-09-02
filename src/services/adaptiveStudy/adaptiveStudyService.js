/** @fileoverview Cliente fino do Tutor Adaptativo; decisoes permanecem no backend. */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig.js';

export async function startAdaptiveFlashcardSession({ folderId, sourceId }) {
  if (!folderId || !sourceId) throw new Error('folderId e sourceId sao obrigatorios.');
  const callable = httpsCallable(functions, 'startAdaptiveFlashcardSession', { timeout: 540000 });
  return (await callable({ folderId, sourceId })).data;
}

export async function rateAdaptiveFlashcard({ sessionId, itemId, rating, reviewRequestId, elapsedTimeMs }) {
  const callable = httpsCallable(functions, 'rateAdaptiveFlashcard', { timeout: 540000 });
  return (await callable({ sessionId, itemId, rating, reviewRequestId, elapsedTimeMs })).data;
}

export async function refillAdaptiveFlashcardSession(sessionId) {
  const callable = httpsCallable(functions, 'refillAdaptiveFlashcardSession', { timeout: 540000 });
  return (await callable({ sessionId })).data;
}

export async function endAdaptiveFlashcardSession(sessionId) {
  const callable = httpsCallable(functions, 'endAdaptiveFlashcardSession');
  return (await callable({ sessionId })).data;
}

export function createReviewRequestId() {
  return globalThis.crypto?.randomUUID?.() || `rating_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
