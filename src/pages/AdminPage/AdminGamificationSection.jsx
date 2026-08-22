import React, { useMemo, useState } from 'react';
import { AlertTriangle, Gamepad2, Layers3, RefreshCw, ShieldCheck, Trophy, Users } from 'lucide-react';
import { LEAGUES } from '../../utils/gamification';
import { adminRecomputeUserGamification } from '../../services/adminApi';

const metric = (title, value, subtitle, Icon, tone = 'text-red-600') => (
  <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-card-dark">
    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-900 ${tone}`}><Icon size={18} /></div>
    <p className="mt-4 text-2xl font-black text-zinc-900 dark:text-white">{value}</p>
    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">{title}</p>
    <p className="mt-1 text-xs text-zinc-400">{subtitle}</p>
  </article>
);

const profileXp = (user) => Number(user.gamification?.totalXP ?? user.gamification?.xp ?? 0);

const AdminGamificationSection = ({ users = [], loading, onOpenUser, onFeedback }) => {
  const [runningUid, setRunningUid] = useState('');
  const diagnostics = useMemo(() => {
    const withoutProfile = users.filter((user) => !user.hasGamification);
    const invalidXp = users.filter((user) => user.hasGamification && (!Number.isFinite(profileXp(user)) || profileXp(user) < 0));
    const withoutLeague = users.filter((user) => user.hasGamification && (!user.gamification?.currentLeague && !user.gamification?.leagueId && !user.gamification?.leagueName));
    const staleCohort = users.filter((user) => user.cohortId && user.gamification?.competitiveWeekId && user.gamification.competitiveWeekId !== user.gamification.currentWeekId);
    return { withoutProfile, invalidXp, withoutLeague, staleCohort };
  }, [users]);

  const leagueCounts = useMemo(() => LEAGUES.map((league) => ({
    ...league,
    count: users.filter((user) => [league.id, league.name].includes(user.gamification?.leagueId || user.gamification?.currentLeague || user.league)).length,
  })), [users]);

  const topXp = useMemo(() => [...users].filter((user) => user.hasGamification).sort((a, b) => profileXp(b) - profileXp(a)).slice(0, 12), [users]);

  const recompute = async (user) => {
    setRunningUid(user.id);
    try {
      await adminRecomputeUserGamification(user.id);
      onFeedback?.({ type: 'success', message: `Gamificação de ${user.name || user.email} recalculada.` });
    } catch (error) {
      onFeedback?.({ type: 'error', message: error.message });
    } finally {
      setRunningUid('');
    }
  };

  return (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-zinc-200 bg-gradient-to-br from-white to-red-50 p-5 shadow-sm dark:border-zinc-800 dark:from-card-dark dark:to-red-950/10">
        <div className="flex items-center gap-2 text-red-600"><Gamepad2 size={18} /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Gamificação administrativa</span></div>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Integridade de XP, níveis e ligas</h2>
        <p className="mt-1 text-sm font-medium text-zinc-500">Diagnóstico dos perfis derivados e acesso rápido às correções executadas no servidor.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metric('Perfis ativos', loading ? '—' : users.length - diagnostics.withoutProfile.length, 'Usuários com perfil de gamificação', ShieldCheck, 'text-emerald-600')}
        {metric('Sem perfil', loading ? '—' : diagnostics.withoutProfile.length, 'Precisam de recomputação', AlertTriangle, diagnostics.withoutProfile.length ? 'text-amber-600' : 'text-emerald-600')}
        {metric('XP inválido', loading ? '—' : diagnostics.invalidXp.length, 'Valores negativos ou não numéricos', Trophy, diagnostics.invalidXp.length ? 'text-red-600' : 'text-emerald-600')}
        {metric('Sem liga', loading ? '—' : diagnostics.withoutLeague.length, 'Perfil existe, mas sem divisão', Layers3, diagnostics.withoutLeague.length ? 'text-amber-600' : 'text-emerald-600')}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1.4fr]">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-card-dark">
          <div className="flex items-center justify-between"><div><h3 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">Distribuição por liga</h3><p className="text-xs text-zinc-400">Perfis atualmente associados</p></div><Layers3 size={19} className="text-red-600" /></div>
          <div className="mt-5 space-y-3">
            {leagueCounts.map((league) => {
              const percentage = users.length ? Math.round((league.count / users.length) * 100) : 0;
              return <div key={league.id}><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-black text-zinc-700 dark:text-zinc-200">{league.name}</span><span className="font-bold text-zinc-400">{league.count} · {percentage}%</span></div><div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900"><div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: league.color }} /></div></div>;
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-card-dark">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800"><div><h3 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">Ranking de XP total</h3><p className="text-xs text-zinc-400">Top 12 da base consolidada</p></div><Trophy size={19} className="text-amber-500" /></div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {topXp.map((user, index) => <div key={user.id} className="flex items-center gap-3 px-4 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-xs font-black text-zinc-500 dark:bg-zinc-900">{index + 1}</span><button type="button" onClick={() => onOpenUser(user)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-black text-zinc-900 dark:text-white">{user.name}</span><span className="text-[10px] font-semibold text-zinc-400">Nível {user.level || 1} · {user.league}</span></button><strong className="text-sm font-black text-red-600">{profileXp(user).toLocaleString('pt-BR')} XP</strong></div>)}
            {!topXp.length ? <div className="p-8 text-center text-sm font-semibold text-zinc-400">Nenhum perfil de gamificação carregado.</div> : null}
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-card-dark">
        <div className="flex items-center gap-3"><AlertTriangle size={19} className="text-amber-500" /><div><h3 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">Fila de inconsistências</h3><p className="text-xs text-zinc-400">A recomputação usa os registros acadêmicos como fonte de verdade.</p></div></div>
        <div className="mt-4 grid gap-2">
          {[...diagnostics.withoutProfile, ...diagnostics.invalidXp, ...diagnostics.withoutLeague].filter((user, index, rows) => rows.findIndex((item) => item.id === user.id) === index).slice(0, 50).map((user) => <div key={user.id} className="flex flex-col gap-3 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900/60 sm:flex-row sm:items-center"><button type="button" onClick={() => onOpenUser(user)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-black text-zinc-800 dark:text-white">{user.name}</p><p className="truncate text-[10px] font-semibold text-zinc-400">{user.email || user.id}</p></button><button type="button" disabled={runningUid === user.id} onClick={() => recompute(user)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"><RefreshCw size={13} className={runningUid === user.id ? 'animate-spin' : ''} /> Recalcular</button></div>)}
          {!diagnostics.withoutProfile.length && !diagnostics.invalidXp.length && !diagnostics.withoutLeague.length ? <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 p-6 text-sm font-bold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"><Users size={17} /> Nenhuma inconsistência primária encontrada.</div> : null}
        </div>
      </section>
    </section>
  );
};

export default AdminGamificationSection;
