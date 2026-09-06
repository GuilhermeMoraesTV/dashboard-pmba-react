import { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, limit, startAfter, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig.js';
import { SUPPORT_LIMITS as L } from '../services/support/supportCore.js';
export function useSupportUser() {
  const [user, setUser] = useState(auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}
export function useSupportTickets(enabled, uid, admin = false) {
  const [state, setState] = useState({ rows: [], more: false, error: '' });
  const cursor = useRef(null), older = useRef([]), generation = useRef(0), loading = useRef(false);
  const filters = useCallback(() => [collection(db, 'system_feedback'), ...(!admin ? [where('uid', '==', uid)] : []), orderBy('timestamp', 'desc')], [uid, admin]);
  useEffect(() => {
    const current = ++generation.current;
    cursor.current = null; older.current = []; setState({ rows: [], more: false, error: '' });
    if (!enabled || !uid) return;
    return onSnapshot(query(...filters(), limit(L.ticketPageSize)), (snap) => {
      if (generation.current !== current) return;
      if (!older.current.length) cursor.current = snap.docs.at(-1);
      const merged = new Map([...older.current, ...snap.docs].map((d) => [d.id, { id: d.id, ...d.data() }]));
      setState((prev) => ({ rows: [...merged.values()].filter((t) => !t.deleted).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)), more: older.current.length ? prev.more : snap.size === L.ticketPageSize, error: '' }));
    }, () => setState({ rows: [], more: false, error: 'Não foi possível carregar os chamados.' }));
  }, [enabled, uid, filters]);
  const loadMore = async () => {
    if (!cursor.current || loading.current) return;
    loading.current = true; const current = generation.current;
    try {
      const snap = await getDocs(query(...filters(), startAfter(cursor.current), limit(L.ticketPageSize)));
      if (current !== generation.current) return;
      cursor.current = snap.docs.at(-1); older.current.push(...snap.docs);
      setState((prev) => ({ ...prev, rows: [...new Map([...prev.rows, ...snap.docs.map((d) => ({ id: d.id, ...d.data() }))].map((d) => [d.id, d])).values()].filter((t) => !t.deleted), more: snap.size === L.ticketPageSize }));
    } catch { if (current === generation.current) setState((prev) => ({ ...prev, error: 'Falha ao carregar chamados anteriores.' })); }
    finally { loading.current = false; }
  };
  return { ...state, loadMore };
}
export function useSupportConversation(ticketId, uid) {
  const [ticket, setTicket] = useState(null), [messages, setMessages] = useState([]), [more, setMore] = useState(false), [error, setError] = useState('');
  const records = useRef(new Map()), cursor = useRef(null), loadedOlder = useRef(false), loading = useRef(false);
  useEffect(() => {
    if (!uid || !ticketId) return;
    let live = true;
    const tRef = doc(db, 'system_feedback', ticketId);
    const ticketUnsub = onSnapshot(tRef, (snap) => setTicket(snap.exists() ? { id: snap.id, ...snap.data() } : { id: ticketId, deleted: true }), () => setError('Chamado indisponível.'));
    const messagesUnsub = onSnapshot(query(collection(tRef, 'messages'), orderBy('timestamp', 'desc'), limit(L.pageSize)), (snap) => {
      if (!live) return;
      snap.docChanges().forEach((change) => {
        // Removed by window rollover stays in the open conversation; real deletions use tombstones.
        if (change.type !== 'removed') records.current.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
      });
      if (!loadedOlder.current) { cursor.current = snap.docs.at(-1); setMore(snap.size === L.pageSize); }
      setMessages([...records.current.values()].sort((a,b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0) || (a.timestamp?.nanoseconds || 0) - (b.timestamp?.nanoseconds || 0)));
    }, () => setError('Não foi possível carregar as mensagens.'));
    return () => { live = false; ticketUnsub(); messagesUnsub(); };
  }, [ticketId, uid]);
  const loadMore = async () => {
    if (!cursor.current || loading.current) return;
    loading.current = true;
    try {
      const snap = await getDocs(query(collection(db, 'system_feedback', ticketId, 'messages'), orderBy('timestamp','desc'), startAfter(cursor.current), limit(L.pageSize)));
      loadedOlder.current = true; cursor.current = snap.docs.at(-1); setMore(snap.size === L.pageSize);
      snap.docs.forEach((d) => records.current.set(d.id, { id: d.id, ...d.data() }));
      setMessages([...records.current.values()].sort((a,b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0) || (a.timestamp?.nanoseconds || 0) - (b.timestamp?.nanoseconds || 0)));
    } catch { setError('Falha ao carregar mensagens anteriores.'); } finally { loading.current = false; }
  };
  const patchMessage = (messageId, patch) => {
    if (records.current.has(messageId)) records.current.set(messageId, { ...records.current.get(messageId), ...patch });
    setMessages((rows) => rows.map((m) => m.id === messageId ? { ...m, ...patch } : m));
  };
  return { ticket, messages, more, error, loadMore, patchMessage };
}
