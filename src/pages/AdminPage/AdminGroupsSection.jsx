import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { Ban, Eye, EyeOff, Loader2, Search, ShieldCheck, Trash2, UserCog, Users } from 'lucide-react';
import { db } from '../../firebaseConfig';
import { getWeekId, sortCompetitiveMembers } from '../../utils/gamification';
import { adminModerateStudyGroup } from '../../services/adminApi';

const dateValue = (value) => value?.toDate?.() || (value ? new Date(value) : null);
const formatDate = (value) => {
  const date = dateValue(value);
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date) : 'Não informada';
};

const AdminGroupsSection = ({ users = [], onOpenUser, onFeedback }) => {
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState('');
  const [error, setError] = useState('');
  const weekId = getWeekId();

  useEffect(() => onSnapshot(query(collection(db, 'study_groups')), (snapshot) => {
    const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    setGroups(rows.sort((a, b) => (dateValue(b.updatedAt || b.createdAt)?.getTime() || 0) - (dateValue(a.updatedAt || a.createdAt)?.getTime() || 0)));
    setLoading(false);
    setError('');
  }, (snapshotError) => { setError(snapshotError.message); setLoading(false); }), []);

  useEffect(() => {
    if (!selectedGroupId) { setMembers([]); setRequests([]); setRanking([]); return undefined; }
    const stops = [
      onSnapshot(collection(db, 'study_groups', selectedGroupId, 'members'), (snapshot) => setMembers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), (snapshotError) => setError(snapshotError.message)),
      onSnapshot(collection(db, 'study_groups', selectedGroupId, 'join_requests'), (snapshot) => setRequests(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), (snapshotError) => setError(snapshotError.message)),
      onSnapshot(collection(db, 'study_groups', selectedGroupId, 'weekly_rankings', weekId, 'members'), (snapshot) => setRanking(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), (snapshotError) => setError(snapshotError.message)),
    ];
    return () => stops.forEach((stop) => stop());
  }, [selectedGroupId, weekId]);

  const filtered = useMemo(() => groups.filter((group) => {
    const haystack = `${group.name || ''} ${group.description || ''} ${group.ownerId || ''}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search.toLowerCase());
    const matchesStatus = status === 'all' || (status === 'private' ? group.visibility === 'private' : status === 'public' ? group.visibility === 'public' : (group.status || 'active') === status);
    return matchesSearch && matchesStatus;
  }), [groups, search, status]);
  const selected = groups.find((group) => group.id === selectedGroupId) || null;
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const sortedRanking = useMemo(() => sortCompetitiveMembers(ranking), [ranking]);

  const execute = async (action, payload = {}, confirmation) => {
    if (!selected || (confirmation && !window.confirm(confirmation))) return;
    setRunning(action + (payload.memberUid || ''));
    try {
      await adminModerateStudyGroup(selected.id, action, payload);
      onFeedback?.({ type: 'success', message: 'Grupo atualizado no servidor e ação registrada na auditoria.' });
    } catch (operationError) {
      onFeedback?.({ type: 'error', message: operationError.message });
    } finally {
      setRunning('');
    }
  };

  const editIdentity = () => {
    const name = window.prompt('Novo nome do grupo:', selected?.name || '');
    if (!name || name === selected?.name) return;
    execute('update_identity', { name }, 'Confirma a alteração administrativa do nome do grupo?');
  };

  const openMember = (member) => {
    const uid = member.uid || member.id;
    onOpenUser(usersById.get(uid) || { id: uid, ...member, name: member.displayName || member.name || uid });
  };

  return <section className="space-y-5">
    <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-card-dark"><div className="flex items-center gap-2 text-red-600"><Users size={18}/><span className="text-[10px] font-black uppercase tracking-[0.18em]">Administração social</span></div><h2 className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">Grupos de estudo</h2><p className="mt-1 text-sm font-medium text-zinc-500">Visibilidade global de grupos, membros, permissões, pedidos e ranking interno.</p><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_220px]"><label className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, descrição ou dono" className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-sm font-semibold outline-none focus:border-red-400 dark:border-zinc-700 dark:bg-zinc-900"/></label><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-black dark:border-zinc-700 dark:bg-zinc-900"><option value="all">Todos os grupos</option><option value="active">Ativos</option><option value="blocked">Bloqueados</option><option value="public">Públicos</option><option value="private">Privados</option></select></div></div>
    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">Falha ao carregar grupos: {error}</div> : null}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.8fr)]">
      <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-card-dark"><div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800"><div><h3 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">{filtered.length} grupos</h3><p className="text-xs text-zinc-400">Clique para abrir os detalhes operacionais</p></div>{loading ? <Loader2 size={18} className="animate-spin text-red-600"/> : null}</div><div className="divide-y divide-zinc-100 dark:divide-zinc-800">{filtered.map((group) => <button key={group.id} type="button" onClick={() => setSelectedGroupId(group.id)} className={`grid w-full grid-cols-[44px_1fr_auto] items-center gap-3 px-4 py-3 text-left transition ${selectedGroupId === group.id ? 'bg-red-50 dark:bg-red-950/15' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'}`}><span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-900">{group.photoURL ? <img src={group.photoURL} alt="" className="h-full w-full object-cover"/> : <Users size={17}/>}</span><span className="min-w-0"><span className="flex items-center gap-2"><strong className="truncate text-sm text-zinc-900 dark:text-white">{group.name || 'Grupo sem nome'}</strong>{group.visibility === 'private' ? <EyeOff size={12} className="text-zinc-400"/> : <Eye size={12} className="text-emerald-500"/>}</span><span className="mt-1 block truncate text-[10px] font-semibold text-zinc-400">Dono: {usersById.get(group.ownerId)?.name || group.ownerName || group.ownerId || 'não informado'} · {formatDate(group.createdAt)}</span></span><span className="text-right"><strong className="block text-sm font-black text-zinc-800 dark:text-white">{group.memberCount || 0}</strong><span className={`text-[8px] font-black uppercase ${group.status === 'blocked' ? 'text-red-600' : 'text-emerald-600'}`}>{group.status === 'blocked' ? 'bloqueado' : 'ativo'}</span></span></button>)}{!loading && !filtered.length ? <div className="p-10 text-center text-sm font-semibold text-zinc-400">Nenhum grupo corresponde ao filtro.</div> : null}</div></section>
      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-card-dark">{selected ? <><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-wider text-red-600">Detalhe do grupo</p><h3 className="truncate text-xl font-black text-zinc-900 dark:text-white">{selected.name}</h3><p className="mt-1 text-xs text-zinc-400">{selected.id}</p></div><button type="button" onClick={editIdentity} className="rounded-xl border border-zinc-200 p-2.5 text-zinc-500 hover:text-red-600 dark:border-zinc-700" title="Editar nome"><UserCog size={16}/></button></div><div className="mt-4 grid grid-cols-3 gap-2">{[['Membros', members.length], ['Pendentes', requests.filter((item) => item.status === 'pending').length], ['XP semanal', sortedRanking.reduce((sum, item) => sum + Number(item.competitiveXP || item.weeklyXP || 0), 0)]].map(([label, value]) => <div key={label} className="rounded-xl bg-zinc-50 p-3 text-center dark:bg-zinc-900/60"><strong className="block text-lg font-black text-zinc-900 dark:text-white">{value}</strong><span className="text-[8px] font-black uppercase text-zinc-400">{label}</span></div>)}</div><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={Boolean(running)} onClick={() => execute('set_visibility', { visibility: selected.visibility === 'public' ? 'private' : 'public' })} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-[9px] font-black uppercase text-zinc-600 dark:border-zinc-700">{selected.visibility === 'public' ? <EyeOff size={13}/> : <Eye size={13}/>} Tornar {selected.visibility === 'public' ? 'privado' : 'público'}</button>{selected.status === 'blocked' ? <button type="button" disabled={Boolean(running)} onClick={() => execute('unblock')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-[9px] font-black uppercase text-white"><ShieldCheck size={13}/> Desbloquear</button> : <button type="button" disabled={Boolean(running)} onClick={() => execute('block', {}, `Bloquear o grupo ${selected.name}?`)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-[9px] font-black uppercase text-white"><Ban size={13}/> Bloquear</button>}</div><div className="mt-5"><h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Membros e permissões</h4><div className="mt-2 max-h-[420px] space-y-2 overflow-y-auto pr-1">{members.map((member) => { const uid = member.uid || member.id; const isOwner = uid === selected.ownerId || member.role === 'owner'; return <div key={uid} className="flex items-center gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900/60"><button type="button" onClick={() => openMember(member)} className="min-w-0 flex-1 text-left"><p className="truncate text-xs font-black text-zinc-800 dark:text-white">{usersById.get(uid)?.name || member.displayName || member.name || uid}</p><p className="text-[9px] font-bold uppercase text-zinc-400">{isOwner ? 'líder' : member.role === 'vice_leader' ? 'vice-líder' : 'membro'}</p></button>{!isOwner ? <button type="button" disabled={Boolean(running)} onClick={() => execute('remove_member', { memberUid: uid }, `Remover este membro de ${selected.name}?`)} className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600" title="Remover membro">{running === `remove_member${uid}` ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}</button> : <ShieldCheck size={14} className="text-emerald-500"/>}</div>; })}{!members.length ? <p className="py-6 text-center text-xs text-zinc-400">Nenhum membro encontrado.</p> : null}</div></div></> : <div className="flex min-h-[420px] flex-col items-center justify-center text-center"><Users size={32} className="text-zinc-300"/><p className="mt-3 text-sm font-black text-zinc-700 dark:text-zinc-200">Selecione um grupo</p><p className="mt-1 text-xs text-zinc-400">Os membros, pedidos e ações aparecerão aqui.</p></div>}</section>
    </div>
  </section>;
};

export default AdminGroupsSection;
