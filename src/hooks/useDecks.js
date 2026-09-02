/**
 * @fileoverview Hook React para gestao de Decks do usuario com sincronizacao em tempo real.
 */
import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig.js';
import { listDecks, createDeck, updateDeck, archiveDeck, getDeckStats } from '../services/flashcards/flashcardsService.js';

function toDate(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function normalizeDeck(snap) {
  const data = snap.data() || {};
  return {
    id: snap.id,
    userId: data.userId || '',
    name: data.name || '',
    description: data.description || '',
    cardCount: Number(data.cardCount || 0),
    folderId: data.folderId || null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    archived: Boolean(data.archived),
    createdAt: toDate(data.createdAt) || new Date(),
    updatedAt: toDate(data.updatedAt) || new Date(),
  };
}

/**
 * Hook para listar e gerenciar os decks do usuario em tempo real.
 * @param {string | null} userId
 * @returns {{ decks: import('../contracts/flashcards.js').Deck[], loading: boolean, error: string | null, reload: () => void, create: Function, update: Function, archive: Function }}
 */
export function useDecks(userId) {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setDecks([]);
      return () => {};
    }
    setLoading(true);
    const decksRef = collection(db, 'users', userId, 'decks');
    const q = query(decksRef, where('archived', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(normalizeDeck).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setDecks(items);
      setLoading(false);
    }, (err) => {
      setError(err?.message || 'Erro ao sincronizar decks.');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await listDecks(userId);
      setDecks(data);
    } catch (err) {
      setError(err?.message || 'Erro ao carregar decks.');
    }
  }, [userId]);

  const create = useCallback(async (deckData) => {
    if (!userId) throw new Error('Usuario nao autenticado.');
    const deck = await createDeck(userId, deckData);
    setDecks((prev) => [deck, ...prev]);
    return deck;
  }, [userId]);

  const update = useCallback(async (deckId, updates) => {
    if (!userId) throw new Error('Usuario nao autenticado.');
    await updateDeck(userId, deckId, updates);
    setDecks((prev) => prev.map((d) => d.id === deckId ? { ...d, ...updates } : d));
  }, [userId]);

  const archive = useCallback(async (deckId) => {
    if (!userId) throw new Error('Usuario nao autenticado.');
    await archiveDeck(userId, deckId);
    setDecks((prev) => prev.filter((d) => d.id !== deckId));
  }, [userId]);

  return { decks, loading, error, reload: load, create, update, archive };
}
