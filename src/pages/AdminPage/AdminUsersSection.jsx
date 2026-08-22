import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  Ban,
  Download,
  Gamepad2,
  Loader2,
  LockKeyhole,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import {
  adminRecalculateUserStats,
  adminRecomputeUserGamification,
  adminSendUserNotification,
  adminUpdateUserStatus,
} from '../../services/adminApi';
import { downloadUsersCsv } from './adminOperations';

const FILTERS = [
  ['all', 'Todos'],
  ['active24h', 'Ativos 24h'],
  ['active7d', 'Ativos 7d'],
  ['inactive14d', 'Inativos 14d'],
  ['inactive30d', 'Inativos 30d'],
  ['blocked', 'Bloqueados'],
  ['noSchedule', 'Sem cronograma'],
  ['noCycle', 'Sem ciclo'],
  ['noGamification', 'Sem gamificacao'],
];

const dateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value, withTime = false) => {
  const date = dateValue(value);
  if (!date) return 'Nao informado';
  return new Intl.DateTimeFormat('pt-BR', withTime
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { dateStyle: 'short' }).format(date);
};

const formatDuration = (minutes) => {
  const safe = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
};

const normalized = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const filterAdminUsers = (users, { search = '', activity = 'all', status = 'all', group = 'all' } = {}, now = new Date()) => {
  const query = normalized(search);
  const nowMillis = now.getTime();
  return (users || []).filter((user) => {
    const lastStudy = dateValue(user.lastStudy);
    const inactiveDays = lastStudy ? Math.floor((nowMillis - lastStudy.getTime()) / 86400000) : Number.POSITIVE_INFINITY;
    const userStatus = user.status || 'active';
    const matchesSearch = !query || [user.name, user.email, user.id, user.uid].some((value) => normalized(value).includes(query));
    const matchesStatus = status === 'all' || userStatus === status;
    const matchesGroup = group === 'all' || String(user.mainGroupId || '') === group;
    const matchesActivity = activity === 'all'
      || (activity === 'active24h' && inactiveDays < 1)
      || (activity === 'active7d' && inactiveDays < 7)
      || (activity === 'inactive14d' && inactiveDays >= 14)
      || (activity === 'inactive30d' && inactiveDays >= 30)
      || (activity === 'blocked' && ['blocked', 'disabled'].includes(userStatus))
      || (activity === 'noSchedule' && !user.hasActiveSchedule)
      || (activity === 'noCycle' && !user.hasActiveCycle)
      || (activity === 'noGamification' && !user.hasGamification);
    return matchesSearch && matchesStatus && matchesGroup && matchesActivity;
  });
};

const RiskBadge = ({ risk }) => {
  const tone = risk === 'Saudavel'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
    : risk === 'Risco 14d'
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
      : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300';
  return <span className={`inline-flex rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-wider ${tone}`}>{risk || 'Sem leitura'}</span>;
};

const StatusBadge = ({ status }) => {
  const labels = { active: 'Ativo', blocked: 'Bloqueado', disabled: 'Desativado' };
  const tone = status === 'active'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
    : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300';
  return <span className={`inline-flex rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-wider ${tone}`}>{labels[status] || status || 'Ativo'}</span>;
};

const UserAvatar = ({ user }) => (
  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
    {user.photoURL ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" /> : <UserRound size={17} className="text-zinc-400" />}
  </div>
);

const ActionButton = ({ icon: Icon, label, onClick, disabled, danger = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition disabled:cursor-wait disabled:opacity-50 ${danger ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30' : 'border-zinc-200 text-zinc-500 hover:border-red-200 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-300'}`}
  >
    {disabled ? <Loader2 size={15} className="animate-spin" /> : React.createElement(Icon, { size: 15 })}
  </button>
);

const AdminUsersSection = ({ users = [], loading, onOpenUser, onFeedback }) => {
  const [filters, setFilters] = useState({ search: '', activity: 'all', status: 'all', group: 'all' });
  const [visibleCount, setVisibleCount] = useState(50);
  const [runningKey, setRunningKey] = useState('');
  const [draggingTable, setDraggingTable] = useState(false);
  const tableScrollRef = useRef(null);
  const dragStateRef = useRef({ pointerId: null, startX: 0, startScrollLeft: 0 });

  const groups = useMemo(() => [...new Map(users.filter((user) => user.mainGroupId).map((user) => [user.mainGroupId, user.mainGroupName || user.mainGroupId])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [users]);
  const filteredUsers = useMemo(() => filterAdminUsers(users, filters), [filters, users]);
  const visibleUsers = filteredUsers.slice(0, visibleCount);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setVisibleCount(50);
  };

  const run = async (key, operation, successMessage) => {
    setRunningKey(key);
    try {
      await operation();
      onFeedback?.({ type: 'success', message: successMessage });
    } catch (error) {
      onFeedback?.({ type: 'error', message: error.message });
    } finally {
      setRunningKey('');
    }
  };

  const handleStatus = (user, status) => {
    const label = status === 'active' ? 'reativar' : status === 'blocked' ? 'bloquear' : 'desativar';
    if (!window.confirm(`Confirma ${label} ${user.name || user.email}? A acao sera auditada.`)) return;
    run(`${user.id}:status`, () => adminUpdateUserStatus(user.id, status), `Conta de ${user.name || user.email} atualizada.`);
  };

  const handleNotification = (user) => {
    const title = window.prompt('Titulo da notificacao:', 'Mensagem da administracao');
    if (!title) return;
    const message = window.prompt('Mensagem para o usuario:');
    if (!message) return;
    run(`${user.id}:notification`, () => adminSendUserNotification(user.id, { title, message }), `Notificacao enviada para ${user.name || user.email}.`);
  };

  const renderActions = (user) => {
    const busy = runningKey.startsWith(`${user.id}:`);
    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        <ActionButton icon={UserRound} label="Abrir perfil 360" onClick={() => onOpenUser(user)} disabled={false} />
        <ActionButton icon={RefreshCw} label="Recalcular estatisticas" onClick={() => run(`${user.id}:stats`, () => adminRecalculateUserStats(user.id), `Estatisticas de ${user.name || user.email} recalculadas.`)} disabled={busy} />
        <ActionButton icon={Gamepad2} label="Recalcular gamificacao" onClick={() => run(`${user.id}:gamification`, () => adminRecomputeUserGamification(user.id), `Gamificacao de ${user.name || user.email} recalculada.`)} disabled={busy} />
        <ActionButton icon={MessageSquare} label="Enviar notificacao" onClick={() => handleNotification(user)} disabled={busy} />
        {user.status === 'active'
          ? <ActionButton icon={Ban} label="Bloquear usuario" onClick={() => handleStatus(user, 'blocked')} disabled={busy} danger />
          : <ActionButton icon={ShieldCheck} label="Reativar usuario" onClick={() => handleStatus(user, 'active')} disabled={busy} />}
        {user.status !== 'disabled' ? <ActionButton icon={LockKeyhole} label="Desativar conta" onClick={() => handleStatus(user, 'disabled')} disabled={busy} danger /> : null}
      </div>
    );
  };

  const startTableDrag = (event) => {
    if (event.button !== 0 || event.target.closest('button, a, input, select, textarea, [role="button"]')) return;
    const container = tableScrollRef.current;
    if (!container || container.scrollWidth <= container.clientWidth) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
    };
    container.setPointerCapture?.(event.pointerId);
    setDraggingTable(true);
  };

  const moveTableDrag = (event) => {
    const container = tableScrollRef.current;
    if (!draggingTable || !container || dragStateRef.current.pointerId !== event.pointerId) return;
    container.scrollLeft = dragStateRef.current.startScrollLeft - (event.clientX - dragStateRef.current.startX);
  };

  const finishTableDrag = (event) => {
    const container = tableScrollRef.current;
    if (dragStateRef.current.pointerId !== event.pointerId) return;
    container?.releasePointerCapture?.(event.pointerId);
    dragStateRef.current.pointerId = null;
    setDraggingTable(false);
  };

  return (
    <section className="space-y-4">
      <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-card-dark sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400"><Users size={18} /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Central de usuarios</span></div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-zinc-900 dark:text-white">{filteredUsers.length} usuarios no recorte</h2>
            <p className="mt-1 text-sm font-medium text-zinc-500">Busca, diagnostico e acoes sensiveis executadas no servidor com auditoria.</p>
          </div>
          <button type="button" onClick={() => downloadUsersCsv(filteredUsers, 'usuarios-admin.csv')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-red-600 dark:bg-white dark:text-zinc-900">
            <Download size={15} /> Exportar CSV
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1.4fr)_repeat(3,minmax(150px,0.7fr))]">
          <label className="relative">
            <span className="sr-only">Buscar usuario</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Nome, email ou UID" className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-sm font-semibold outline-none focus:border-red-400 dark:border-zinc-700 dark:bg-zinc-900" />
          </label>
          <select value={filters.activity} onChange={(event) => updateFilter('activity', event.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold dark:border-zinc-700 dark:bg-zinc-900">{FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold dark:border-zinc-700 dark:bg-zinc-900"><option value="all">Todos os status</option><option value="active">Ativos</option><option value="blocked">Bloqueados</option><option value="disabled">Desativados</option></select>
          <select value={filters.group} onChange={(event) => updateFilter('group', event.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold dark:border-zinc-700 dark:bg-zinc-900"><option value="all">Todos os grupos</option>{groups.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center gap-3 rounded-[28px] border border-zinc-200 bg-white text-sm font-bold text-zinc-500 dark:border-zinc-800 dark:bg-card-dark"><Loader2 size={20} className="animate-spin text-red-600" /> Carregando usuarios...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-[28px] border border-zinc-200 bg-white px-6 text-center dark:border-zinc-800 dark:bg-card-dark"><Activity size={28} className="text-zinc-300" /><p className="mt-3 text-sm font-black text-zinc-700 dark:text-zinc-200">Nenhum usuario encontrado</p><p className="mt-1 text-xs text-zinc-500">Ajuste a busca ou os filtros do recorte.</p></div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-card-dark lg:block">
            <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-2 text-[10px] font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
              Arraste a tabela para os lados ou use a barra horizontal para ver todas as colunas e ações.
            </div>
            <div
              ref={tableScrollRef}
              onPointerDown={startTableDrag}
              onPointerMove={moveTableDrag}
              onPointerUp={finishTableDrag}
              onPointerCancel={finishTableDrag}
              className={`overflow-x-auto overscroll-x-contain ${draggingTable ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
              style={{ scrollbarGutter: 'stable' }}
            >
              <table className="w-full min-w-[1420px] border-collapse text-left">
                <thead className="bg-zinc-50 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:bg-zinc-900/60">
                  <tr><th className="px-4 py-3">Usuario</th><th className="px-3 py-3">Status / perfil</th><th className="px-3 py-3">Criado / ultimo estudo</th><th className="px-3 py-3">Desempenho</th><th className="px-3 py-3">Gamificacao</th><th className="px-3 py-3">Grupo</th><th className="px-3 py-3">Risco</th><th className="sticky right-0 z-20 min-w-[260px] bg-zinc-50 px-4 py-3 text-right shadow-[-12px_0_18px_-18px_rgba(0,0,0,0.55)] dark:bg-zinc-900">Acoes</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {visibleUsers.map((user) => (
                    <tr key={user.id} className="group align-middle hover:bg-zinc-50/70 dark:hover:bg-zinc-900/30">
                      <td className="px-4 py-3"><button type="button" onClick={() => onOpenUser(user)} className="flex items-center gap-3 text-left"><UserAvatar user={user} /><span className="min-w-0"><span className="block max-w-[220px] truncate text-sm font-black text-zinc-900 dark:text-white">{user.name}</span><span className="block max-w-[220px] truncate text-[11px] font-semibold text-zinc-500">{user.email || 'Sem email'}</span><span className="block max-w-[220px] truncate font-mono text-[9px] text-zinc-400">{user.id}</span></span></button></td>
                      <td className="px-3 py-3"><StatusBadge status={user.status} /><p className="mt-1 text-[10px] font-bold text-zinc-500">{user.perfil || user.access?.role || user.role || 'Nao informado'}</p></td>
                      <td className="px-3 py-3 text-[10px] font-semibold text-zinc-500"><p>{formatDate(user.createdAt)}</p><p className="mt-1">{formatDate(user.lastStudy, true)}</p></td>
                      <td className="px-3 py-3"><p className="text-xs font-black text-zinc-800 dark:text-zinc-100">{formatDuration(user.totalMinutes)}</p><p className="mt-1 text-[10px] font-semibold text-zinc-500">{user.totalQuestions}q · {user.accuracy}%</p></td>
                      <td className="px-3 py-3"><p className="text-xs font-black text-zinc-800 dark:text-zinc-100">Nivel {user.level || '-'}</p><p className="mt-1 text-[10px] font-semibold text-zinc-500">{Number(user.gamification?.totalXP || 0).toLocaleString('pt-BR')} XP</p></td>
                      <td className="px-3 py-3"><p className="max-w-[160px] truncate text-xs font-bold text-zinc-700 dark:text-zinc-200">{user.mainGroupName}</p><p className="mt-1 text-[9px] text-zinc-400">{user.mainGroupId || 'Sem grupo principal'}</p></td>
                      <td className="px-3 py-3"><RiskBadge risk={user.risk} /></td>
                      <td className="sticky right-0 z-10 min-w-[260px] bg-white px-4 py-3 shadow-[-12px_0_18px_-18px_rgba(0,0,0,0.55)] group-hover:bg-zinc-50 dark:bg-card-dark dark:group-hover:bg-zinc-900">{renderActions(user)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {visibleUsers.map((user) => (
              <article key={user.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-card-dark">
                <div className="flex items-start gap-3"><UserAvatar user={user} /><button type="button" onClick={() => onOpenUser(user)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-black text-zinc-900 dark:text-white">{user.name}</p><p className="truncate text-[11px] font-semibold text-zinc-500">{user.email}</p><p className="mt-1 truncate font-mono text-[9px] text-zinc-400">{user.id}</p></button><StatusBadge status={user.status} /></div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900/60"><p className="font-black uppercase tracking-wider text-zinc-400">Desempenho</p><p className="mt-1 font-bold text-zinc-800 dark:text-zinc-100">{formatDuration(user.totalMinutes)} · {user.totalQuestions}q · {user.accuracy}%</p></div><div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900/60"><p className="font-black uppercase tracking-wider text-zinc-400">Gamificacao</p><p className="mt-1 font-bold text-zinc-800 dark:text-zinc-100">Nivel {user.level || '-'} · {Number(user.gamification?.totalXP || 0).toLocaleString('pt-BR')} XP</p></div></div>
                <div className="mt-3 flex items-center justify-between gap-3"><RiskBadge risk={user.risk} />{renderActions(user)}</div>
              </article>
            ))}
          </div>

          {visibleCount < filteredUsers.length ? <button type="button" onClick={() => setVisibleCount((current) => current + 50)} className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-500 hover:border-red-200 hover:text-red-600 dark:border-zinc-800 dark:bg-card-dark">Carregar mais {Math.min(50, filteredUsers.length - visibleCount)}</button> : null}
        </>
      )}
    </section>
  );
};

export default AdminUsersSection;
