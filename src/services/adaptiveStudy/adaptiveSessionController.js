/** Local Tutor outbox. No listeners, timers or additional backend endpoints. */
const TRANSIENT_CODES = new Set(['unavailable', 'deadline-exceeded', 'aborted']);

function message(error) {
  return String(error?.message || 'Não foi possível sincronizar o estudo.').replace(/^FirebaseError:\s*/i, '').slice(0, 400);
}

async function withTransientRetry(operation) {
  try {
    return await operation();
  } catch (error) {
    if (!TRANSIENT_CODES.has(String(error?.code || '').replace(/^functions\//, ''))) throw error;
    return operation(); // Same payload/request ID; at most one retry.
  }
}

export function createAdaptiveSessionController({ api, folderId, sourceId, storage, storageKey }) {
  let saved = null;
  try { saved = JSON.parse(storage?.getItem(storageKey) || 'null'); } catch { /* Invalid cache is not a session. */ }
  let queue = saved?.session?.id && Array.isArray(saved.queue) ? saved.queue : [];
  const accepted = new Set(saved?.accepted || []);
  let state = {
    session: saved?.session || null, item: saved?.item || null,
    prefetchedItems: saved?.prefetchedItems || [], answered: saved?.answered || 0,
    pendingSyncCount: queue.length, refilling: false, ending: false, ended: false,
    closingRequested: Boolean(saved?.closingRequested),
    fatalError: null, syncError: null, bufferError: null,
  };
  const listeners = new Set();
  let startPromise;
  let drainPromise;
  let refillPromise;
  let endPromise;
  let shownAt = Date.now();

  const publish = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const persist = () => storage?.setItem(storageKey, JSON.stringify({
    session: state.session, item: state.item, prefetchedItems: state.prefetchedItems,
    answered: state.answered, queue, accepted: [...accepted], closingRequested: state.closingRequested,
  }));
  const usable = (item) => item?.id && !accepted.has(item.id)
    && (!item.sessionId || item.sessionId === state.session?.id)
    && !['consumed', 'cancelled', 'error'].includes(item.queueState);
  const reconcile = (result) => {
    if (state.closingRequested || state.ended) return;
    const items = new Map();
    for (const item of [state.item, ...state.prefetchedItems, result.item, result.nextItem, ...(result.prefetchedItems || [])]) {
      if (usable(item)) items.set(item.id, item);
    }
    const list = [...items.values()];
    const item = list.shift() || null;
    if (item?.id !== state.item?.id) shownAt = Date.now();
    publish({ item, prefetchedItems: list.slice(0, 4), bufferError: item ? null : state.bufferError });
    persist();
  };

  const refill = () => {
    if (refillPromise) return refillPromise;
    if (!state.session?.id || state.closingRequested || state.ended || queue.length) return Promise.resolve();
    publish({ refilling: true, bufferError: null });
    // A generation request is never retried automatically: its server may still be running.
    refillPromise = Promise.resolve().then(() => api.refill(state.session.id)).then((result) => {
      reconcile(result);
      if (!state.item && !state.ending && !state.ended) {
        publish({ bufferError: result.refill?.busy
          ? 'A geração ainda está em andamento. Tente continuar em instantes.'
          : 'Nenhum flashcard ficou pronto. Tente continuar ou encerre o estudo.' });
      }
    }).catch((error) => publish({ bufferError: message(error) })).finally(() => {
      refillPromise = null;
      publish({ refilling: false });
    });
    return refillPromise;
  };

  const drain = () => {
    if (drainPromise) return drainPromise;
    drainPromise = Promise.resolve().then(async () => {
      let shouldRefill = false;
      while (queue.length) {
        const task = queue[0];
        try {
          const result = await withTransientRetry(() => api.rate(task));
          queue.shift();
          // Persist the acknowledgement before allowing another action or reconciliation.
          persist();
          publish({ pendingSyncCount: queue.length, syncError: null });
          reconcile(result);
          shouldRefill = Boolean(result.shouldRefill);
        } catch (error) {
          publish({ syncError: message(error) });
          return false;
        }
      }
      if (!state.closingRequested && !state.ended && (shouldRefill || !state.item || state.prefetchedItems.length < 4)) void refill();
      return true;
    }).finally(() => { drainPromise = null; });
    return drainPromise;
  };

  const start = () => {
    if (startPromise) return startPromise;
    startPromise = Promise.resolve().then(async () => {
      try {
        if (!state.session) {
          const result = await api.start({ folderId, sourceId });
          publish({ session: result.session });
          reconcile(result);
          persist();
        } else {
          reconcile({});
          if (queue.length) void drain();
          else if (!state.item || state.prefetchedItems.length < 4) void refill();
        }
      } catch (error) {
        publish({ fatalError: message(error) });
      }
    });
    return startPromise;
  };

  const rate = (rating, expectedItemId) => {
    const item = state.item;
    if (state.closingRequested || state.ended || (queue.length && state.syncError)
      || !item || item.id !== expectedItemId || accepted.has(item.id)) return false;
    const task = { sessionId: state.session.id, itemId: item.id, rating,
      reviewRequestId: api.createRequestId(), elapsedTimeMs: Math.max(0, Date.now() - shownAt) };
    accepted.add(item.id);
    queue.push(task);
    // Do not accept a rating that cannot survive a page reload.
    try { persist(); } catch (error) {
      queue.pop();
      accepted.delete(item.id);
      publish({ syncError: `Não foi possível guardar a resposta neste navegador. ${message(error)}` });
      return false;
    }
    publish({ answered: state.answered + 1, pendingSyncCount: queue.length, syncError: null });
    reconcile({});
    void drain();
    return true;
  };

  const end = () => {
    if (endPromise) return endPromise;
    if (state.ended) return Promise.resolve(true);
    publish({ ending: true, closingRequested: true, syncError: null });
    endPromise = Promise.resolve().then(async () => {
      persist();
      await start(); // Handles exit while initial generation is still in flight.
      if (!(await drain()) || queue.length) return false;
      if (state.session?.id) await withTransientRetry(() => api.end(state.session.id));
      storage?.removeItem(storageKey);
      publish({ ended: true, item: null, prefetchedItems: [] });
      return true;
    }).catch((error) => {
      publish({ syncError: message(error) });
      return false;
    }).finally(() => {
      endPromise = null;
      publish({ ending: false });
    });
    return endPromise;
  };

  return {
    getSnapshot: () => state,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    start, rate, refill, drain, end,
  };
}
