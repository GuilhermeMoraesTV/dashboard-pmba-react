/**
 * @fileoverview Migracao estrutural administrativa e paginada de Flashcards legados.
 * Nao e exportada como Callable e nao deve ser executada automaticamente.
 */

async function migrateLegacyFlashcardsPage({ admin, uid, cursor = null, pageSize = 100 }) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(String(uid || ''))) throw new Error('uid invalido.');
  const safePageSize = Math.min(Math.max(Number(pageSize) || 100, 1), 200);
  const db = admin.firestore();
  let query = db.collection('users').doc(uid).collection('decks').orderBy('__name__').limit(safePageSize);
  if (cursor) query = query.startAfter(String(cursor));
  const decks = await query.get();
  let migratedDecks = 0;
  let migratedCards = 0;

  for (const deck of decks.docs) {
    if (deck.data()?.archived === undefined) {
      await deck.ref.update({ archived: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      migratedDecks += 1;
    }
    let cardsQuery = deck.ref.collection('cards').orderBy('__name__').limit(300);
    while (true) {
      const cards = await cardsQuery.get();
      if (cards.empty) break;
      const batch = db.batch();
      let changed = 0;
      cards.docs.forEach((card) => {
        if (card.data()?.reviewVersion === undefined) {
          batch.update(card.ref, { reviewVersion: 0, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          migratedCards += 1;
          changed += 1;
        }
      });
      if (changed) await batch.commit();
      if (cards.size < 300) break;
      cardsQuery = deck.ref.collection('cards').orderBy('__name__').startAfter(cards.docs.at(-1)).limit(300);
    }
  }

  return {
    migratedDecks,
    migratedCards,
    nextCursor: decks.size === safePageSize ? decks.docs.at(-1).id : null,
  };
}

module.exports = { migrateLegacyFlashcardsPage };
