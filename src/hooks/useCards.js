/**
 * @fileoverview Hook React para gestao de Cards em um Deck.
 */
import { useState, useEffect, useCallback } from 'react';
import { listCards, createCard, updateCard, deleteCard } from '../services/flashcards/flashcardsService.js';

/**
 * Hook para listar e gerenciar os cards de um deck.
 * @param {string | null} userId
 * @param {string | null} deckId
 */
export function useCards(userId, deckId) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!userId || !deckId) { setCards([]); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await listCards(userId, deckId);
      setCards(data);
    } catch (err) {
      setError(err?.message || 'Erro ao carregar cards.');
    } finally {
      setLoading(false);
    }
  }, [userId, deckId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (cardData) => {
    if (!userId || !deckId) throw new Error('userId e deckId sao obrigatorios.');
    const card = await createCard(userId, deckId, cardData);
    setCards((prev) => [...prev, card]);
    return card;
  }, [userId, deckId]);

  const update = useCallback(async (cardId, updates) => {
    if (!userId || !deckId) throw new Error('userId e deckId sao obrigatorios.');
    await updateCard(userId, deckId, cardId, updates);
    setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, ...updates } : c));
  }, [userId, deckId]);

  const remove = useCallback(async (cardId) => {
    if (!userId || !deckId) throw new Error('userId e deckId sao obrigatorios.');
    await deleteCard(userId, deckId, cardId);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  }, [userId, deckId]);

  return { cards, loading, error, reload: load, create, update, remove };
}
