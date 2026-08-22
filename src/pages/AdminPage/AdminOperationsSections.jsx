import React, { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { AlertTriangle, Ban, BellRing, CheckCircle2, Download, FileText, Filter, Loader2, Megaphone, RefreshCw, Search, Shield, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import { db } from '../../firebaseConfig';
import { adminModerateStudyGroup, adminRecalculateUserStats, adminUpdateUserStatus } from '../../services/adminApi';
import { buildBroadcastDraftFromSegment, buildExecutivePdfPayload, downloadUsersCsv, openExecutivePdfWindow } from './adminOperations';

const toDate = (value) => value?.toDate?.() || (value ? new Date(value) : null);
const formatDate = (value) => {
  const date = toDate(value);
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date) : 'Não informado';
};

const buildSegments = (users) => {
  const now = Date.now();
  const inactive = (days) => users.filter((user) => !user.lastStudy || now - (toDate(user.lastStudy)?.getTime() || 0) >= days * 86400000);
  return [
    { id: 'all', label: 'Toda a base', description: 'Todos os usuários do recorte administrativo.', rows: users },
    { id: 'new-7d', label: 'Novos 7 dias', description: 'Cadastros realizados nos últimos sete dias.', rows: users.filter((user) => now - (toDate(user.createdAt)?.getTime() || 0) < 7 * 86400000) },
    { id: 'active-7d', label: 'Ativos 7 dias', description: 'Estudaram nos últimos sete dias.', rows: users.filter((user) => user.lastStudy && now - toDate(user.lastStudy).getTime() < 7 * 86400000) },
    { id: 'risk-14d', label: 'Risco 14 dias', description: 'Sem atividade acadêmica há pelo menos 14 dias.', rows: inactive(14) },
    { id: 'risk-30d', label: 'Inativos 30 dias', description: 'Sem atividade acadêmica há pelo menos 30 dias.', rows: inactive(30) },
    { id: 'no-schedule', label: 'Sem cronograma', description: 'Não possuem cronograma ativo.', rows: users.filter((user) => !user.hasActiveSchedule) },
    { id: 'no-cycle', label: 'Sem ciclo', description: 'Não possuem ciclo ativo.', rows: users.filter((user) => !user.hasActiveCycle) },
    { id: 'no-gamification', label: 'Sem gamificação', description: 'Não possuem perfil derivado de gamificação.', rows: users.filter((user) => !user.hasGamification) },
    { id: 'low-accuracy', label: 'Baixa precisão', description: 'Precisão abaixo de 50%, com questões realizadas.', rows: users.filter((user) => user.totalQuestions > 0 && user.accuracy < 50) },
    { id: 'high-performance', label: 'Alta performance', description: 'Precisão acima de 80% e pelo menos 100 questões.', rows: users.filter((user) => user.totalQuestions >= 100 && user.accuracy >= 80) },
  ].map((segment) => ({ ...segment, count: segment.rows.length, filtersSnapshot: {} }));
};

export const AdminModerationSection = ({ users = [], onOpenUser, onFeedback, onNavigate }) => {
  const [groups, setGroups] = useState([]);
  const [running, setRunning] = useState('');
  const [error, setError] = useState('');
  useEffect(() => onSnapshot(collection(db, 'study_groups'), (snapshot) => {
    setGroups(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    setError('');
  }, (snapshotError) => setError(snapshotError.message)), []);
  const blockedUsers = users.filter((user) => ['blocked', 'disabled'].includes(user.status));
  const flaggedGroups = groups.filter((group) => ['blocked', 'under_review', 'review'].includes(group.status));
  const inactiveGroups = groups.filter((group) => {
    const updated = toDate(group.updatedAt || group.createdAt);
    return updated && Date.now() - updated.getTime() >= 30 * 86400000;
  });

  const unblockUser = async (user) => {
    if (!window.confirm(`Reativar ${user.name || user.email}?`)) return;
    setRunning(user.id);
    try { await adminUpdateUserStatus(user.id, 'active'); onFeedback?.({ type: 'success', message: 'Usuário reativado e ação auditada.' }); }
    catch (operationError) { onFeedback?.({ type: 'error', message: operationError.message }); }
    finally { setRunning(''); }
  };
  const unblockGroup = async (group) => {
    setRunning(group.id);
    try { await adminModerateStudyGroup(group.id, 'unblock'); onFeedback?.({ type: 'success', message: 'Grupo desbloqueado e ação auditada.' }); }
    catch (operationError) { onFeedback?.({ type: 'error', message: operationError.message }); }
    finally { setRunning(''); }
  };

  return <section className="space-y-5"><div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-card-dark"><div className="flex items-center gap-2 text-red-600"><Shield size={18}/><span className="text-[10px] font-black uppercase tracking-[0.18em]">Central de moderação</span></div><h2 className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">Contas, grupos e fila operacional</h2><p className="mt-1 text-sm font-medium text-zinc-500">Reúna itens restritos e situações que exigem revisão humana.</p></div>{error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}<div className="grid grid-cols-3 gap-3">{[['Contas restritas', blockedUsers.length, Ban], ['Grupos sinalizados', flaggedGroups.length, AlertTriangle], ['Grupos inativos 30d', inactiveGroups.length, Users]].map(([label, value, Icon]) => <article key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-card-dark">{React.createElement(Icon, { size: 17, className: 'text-red-600' })}<p className="mt-3 text-2xl font-black text-zinc-900 dark:text-white">{value}</p><p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">{label}</p></article>)}</div><div className="grid gap-5 lg:grid-cols-2"><section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-card-dark"><div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800"><h3 className="text-sm font-black text-zinc-900 dark:text-white">Usuários bloqueados ou desativados</h3></div><div className="divide-y divide-zinc-100 dark:divide-zinc-800">{blockedUsers.slice(0, 100).map((user) => <div key={user.id} className="flex items-center gap-3 px-4 py-3"><button type="button" onClick={() => onOpenUser(user)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-black text-zinc-800 dark:text-white">{user.name}</p><p className="truncate text-[10px] text-zinc-400">{user.email} · {user.status}</p></button><button type="button" disabled={running === user.id} onClick={() => unblockUser(user)} className="rounded-xl border border-emerald-200 p-2.5 text-emerald-600 disabled:opacity-50" title="Reativar">{running === user.id ? <Loader2 size={14} className="animate-spin"/> : <ShieldCheck size={14}/>}</button></div>)}{!blockedUsers.length ? <p className="p-8 text-center text-sm font-semibold text-zinc-400">Nenhuma conta restrita.</p> : null}</div></section><section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-card-dark"><div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800"><h3 className="text-sm font-black text-zinc-900 dark:text-white">Grupos sob revisão</h3><button type="button" onClick={() => onNavigate?.('groups')} className="text-[9px] font-black uppercase text-red-600">Ver todos</button></div><div className="divide-y divide-zinc-100 dark:divide-zinc-800">{flaggedGroups.map((group) => <div key={group.id} className="flex items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-zinc-800 dark:text-white">{group.name}</p><p className="text-[10px] text-zinc-400">{group.status} · {group.memberCount || 0} membros</p></div><button type="button" disabled={running === group.id} onClick={() => unblockGroup(group)} className="rounded-xl border border-emerald-200 p-2.5 text-emerald-600"><ShieldCheck size={14}/></button></div>)}{!flaggedGroups.length ? <p className="p-8 text-center text-sm font-semibold text-zinc-400">Nenhum grupo sinalizado.</p> : null}</div></section></div><div className="rounded-2xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500 dark:border-zinc-700"><strong className="text-zinc-800 dark:text-zinc-200">Denúncias:</strong> a área está preparada, mas a base atual ainda não possui uma coleção de denúncias sociais. Nenhum dado fictício é exibido.</div></section>;
};

export const AdminCommunicationsSection = ({ users = [], dashboardData, filters, onBroadcast }) => {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const segments = useMemo(() => buildSegments(users), [users]);
  useEffect(() => onSnapshot(query(collection(db, 'system_broadcasts'), orderBy('timestamp', 'desc'), limit(100)), (snapshot) => {
    setHistory(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    setError('');
  }, (snapshotError) => {
    // Documentos novos usam createdAt; coleções antigas podem usar timestamp.
    setError(snapshotError.message);
  }), []);
  return <section className="space-y-5"><div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-card-dark"><div className="flex items-center gap-2 text-red-600"><Megaphone size={18}/><span className="text-[10px] font-black uppercase tracking-[0.18em]">Comunicações</span></div><h2 className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">Segmentos e campanhas</h2><p className="mt-1 text-sm font-medium text-zinc-500">Abra o público, exporte a base ou prepare um broadcast com audiência explícita.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{segments.map((segment) => <article key={segment.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-card-dark"><Filter size={15} className="text-red-600"/><p className="mt-3 text-xl font-black text-zinc-900 dark:text-white">{segment.count}</p><h3 className="text-xs font-black text-zinc-700 dark:text-zinc-200">{segment.label}</h3><p className="mt-1 min-h-10 text-[10px] leading-relaxed text-zinc-400">{segment.description}</p><div className="mt-3 flex gap-1.5"><button type="button" onClick={() => onBroadcast?.(buildBroadcastDraftFromSegment(segment))} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-600 px-2 py-2 text-[8px] font-black uppercase text-white"><BellRing size={11}/> Enviar</button><button type="button" onClick={() => downloadUsersCsv(segment.rows, `segmento-${segment.id}.csv`)} className="rounded-lg border border-zinc-200 p-2 text-zinc-500 dark:border-zinc-700" title="Exportar CSV"><Download size={12}/></button><button type="button" onClick={() => openExecutivePdfWindow(buildExecutivePdfPayload({ dashboardData, filters, segment }))} className="rounded-lg border border-zinc-200 p-2 text-zinc-500 dark:border-zinc-700" title="Relatório executivo"><FileText size={12}/></button></div></article>)}</div><section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-card-dark"><div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800"><h3 className="text-sm font-black text-zinc-900 dark:text-white">Histórico de broadcasts</h3><p className="text-xs text-zinc-400">Últimas 100 comunicações globais</p></div>{error ? <p className="m-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700">O histórico ainda depende das regras/índices publicados: {error}</p> : null}<div className="divide-y divide-zinc-100 dark:divide-zinc-800">{history.map((item) => <div key={item.id} className="grid gap-2 px-5 py-3 sm:grid-cols-[1fr_auto]"><div><p className="text-sm font-black text-zinc-800 dark:text-white">{item.title || item.message || 'Comunicado'}</p><p className="mt-1 line-clamp-2 text-xs text-zinc-400">{item.message}</p></div><div className="text-left text-[9px] font-bold text-zinc-400 sm:text-right"><p>{formatDate(item.timestamp || item.createdAt)}</p><p>{item.audienceCount ?? item.targetUserIds?.length ?? 'Todos'} destinatários</p></div></div>)}{!history.length && !error ? <p className="p-8 text-center text-sm font-semibold text-zinc-400">Nenhum broadcast registrado.</p> : null}</div></section></section>;
};

export const AdminMaintenanceSection = ({ users = [], onFeedback, onNavigate }) => {
  const [running, setRunning] = useState(false);
  const staleTimers = users.filter((user) => user.activeTimer && Date.now() - (toDate(user.activeTimer.updatedAt)?.getTime() || 0) > 2 * 60 * 60 * 1000);
  const checks = [
    { label: 'Usuários sem gamificação', count: users.filter((user) => !user.hasGamification).length, tab: 'gamification' },
    { label: 'Usuários sem cronograma', count: users.filter((user) => !user.hasActiveSchedule).length, tab: 'users' },
    { label: 'Usuários sem ciclo', count: users.filter((user) => !user.hasActiveCycle).length, tab: 'users' },
    { label: 'XP inválido', count: users.filter((user) => user.hasGamification && Number(user.gamification?.totalXP || 0) < 0).length, tab: 'gamification' },
    { label: 'Timers antigos', count: staleTimers.length, tab: 'overview' },
  ];
  const recalculate = async () => {
    if (!window.confirm('Recalcular as estatísticas de toda a base? A operação pode levar alguns minutos e será auditada.')) return;
    setRunning(true);
    try { const result = await adminRecalculateUserStats(); onFeedback?.({ type: 'success', message: `${result.processedCount} usuários recalculados.` }); }
    catch (error) { onFeedback?.({ type: 'error', message: error.message }); }
    finally { setRunning(false); }
  };
  return <section className="space-y-5"><div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-card-dark"><div className="flex items-center gap-2 text-red-600"><Stethoscope size={18}/><span className="text-[10px] font-black uppercase tracking-[0.18em]">Saúde da base</span></div><h2 className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">Diagnóstico e manutenção</h2><p className="mt-1 text-sm font-medium text-zinc-500">Verificações objetivas e operações seguras de recomputação.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{checks.map((check) => <button type="button" key={check.label} onClick={() => onNavigate?.(check.tab)} className="rounded-2xl border border-zinc-200 bg-white p-4 text-left dark:border-zinc-800 dark:bg-card-dark"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${check.count ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30'}`}>{check.count ? <AlertTriangle size={16}/> : <CheckCircle2 size={16}/>}</span><p className="mt-3 text-2xl font-black text-zinc-900 dark:text-white">{check.count}</p><p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">{check.label}</p></button>)}</div><div className="grid gap-4 lg:grid-cols-2"><article className="rounded-[28px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-card-dark"><RefreshCw size={19} className="text-red-600"/><h3 className="mt-4 text-lg font-black text-zinc-900 dark:text-white">Recalcular estatísticas</h3><p className="mt-1 text-sm text-zinc-500">Recria os agregados acadêmicos de todos os usuários a partir dos registros existentes.</p><button type="button" disabled={running} onClick={recalculate} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">{running ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>} Executar com auditoria</button></article><article className="rounded-[28px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-card-dark"><Download size={19} className="text-red-600"/><h3 className="mt-4 text-lg font-black text-zinc-900 dark:text-white">Exportar diagnóstico</h3><p className="mt-1 text-sm text-zinc-500">Baixa a base enriquecida para análise externa sem alterar nenhum dado.</p><button type="button" onClick={() => downloadUsersCsv(users, 'diagnostico-admin.csv')} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:border-zinc-700"><Download size={14}/> Exportar CSV</button></article></div><div className="rounded-2xl border border-dashed border-zinc-300 p-5 text-xs leading-relaxed text-zinc-500 dark:border-zinc-700"><strong className="text-zinc-800 dark:text-zinc-200">Cobertura atual:</strong> perfis de gamificação, cronogramas, ciclos, XP e timers. Diagnósticos de coortes e grupos ficam nas respectivas páginas, onde há contexto para agir com segurança.</div></section>;
};

export const AdminAuditSection = ({ users = [] }) => {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => onSnapshot(query(collection(db, 'admin_audit_logs'), orderBy('createdAt', 'desc'), limit(300)), (snapshot) => {
    setLogs(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    setLoading(false);
    setError('');
  }, (snapshotError) => { setError(snapshotError.message); setLoading(false); }), []);
  const actions = useMemo(() => [...new Set(logs.map((item) => item.action).filter(Boolean))].sort(), [logs]);
  const filtered = useMemo(() => logs.filter((item) => {
    const haystack = `${item.action || ''} ${item.actorEmail || ''} ${item.actorUid || ''} ${item.targetUid || ''} ${item.targetPath || ''}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase())) && (action === 'all' || item.action === action);
  }), [action, logs, search]);
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  return <section className="space-y-5"><div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-card-dark"><div className="flex items-center gap-2 text-red-600"><ShieldCheck size={18}/><span className="text-[10px] font-black uppercase tracking-[0.18em]">Rastreabilidade</span></div><h2 className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">Auditoria administrativa</h2><p className="mt-1 text-sm font-medium text-zinc-500">Quem fez, quando, qual alvo foi afetado e o resultado da operação.</p><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_280px]"><label className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ação, admin, UID ou caminho" className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-sm font-semibold outline-none focus:border-red-400 dark:border-zinc-700 dark:bg-zinc-900"/></label><select value={action} onChange={(event) => setAction(event.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-black dark:border-zinc-700 dark:bg-zinc-900"><option value="all">Todas as ações</option>{actions.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div>{error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">A coleção de auditoria está protegida pelas regras locais e ficará disponível após a publicação autorizada dessas regras: {error}</div> : null}<section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-card-dark"><div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-left"><thead className="bg-zinc-50 text-[9px] font-black uppercase tracking-wider text-zinc-400 dark:bg-zinc-900/60"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Administrador</th><th className="px-4 py-3">Alvo</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Resumo</th></tr></thead><tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">{filtered.map((item) => <tr key={item.id}><td className="whitespace-nowrap px-4 py-3 text-[10px] font-semibold text-zinc-500">{formatDate(item.createdAt)}</td><td className="px-4 py-3 text-xs font-black text-zinc-800 dark:text-white">{item.action}</td><td className="px-4 py-3"><p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">{item.actorEmail || item.actorUid}</p><p className="font-mono text-[8px] text-zinc-400">{item.actorUid}</p></td><td className="px-4 py-3"><p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">{usersById.get(item.targetUid)?.name || item.targetUid || item.targetType || 'Sistema'}</p><p className="max-w-[260px] truncate font-mono text-[8px] text-zinc-400">{item.targetPath}</p></td><td className="px-4 py-3"><span className={`rounded-lg px-2 py-1 text-[8px] font-black uppercase ${item.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{item.status || 'registrado'}</span></td><td className="max-w-[300px] px-4 py-3 text-[10px] text-zinc-500"><span className="line-clamp-2">{item.error || JSON.stringify(item.payloadSummary || {})}</span></td></tr>)}</tbody></table></div>{loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm font-bold text-zinc-400"><Loader2 size={16} className="animate-spin"/> Carregando auditoria...</div> : null}{!loading && !filtered.length && !error ? <p className="p-10 text-center text-sm font-semibold text-zinc-400">Nenhum evento de auditoria no recorte.</p> : null}</section></section>;
};
