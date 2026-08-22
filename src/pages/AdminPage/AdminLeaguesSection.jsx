import React, { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, query } from 'firebase/firestore';
import { AlertTriangle, Download, Loader2, Play, RefreshCw, Shield, Trophy, Users } from 'lucide-react';
import { db } from '../../firebaseConfig';
import { getLeague, getPromotionRelegationCounts, getRankingZone, getWeekId, LEAGUES, sortCompetitiveMembers } from '../../utils/gamification';
import { adminRecomputeLeagueWeek, adminSimulateLeagueClosure } from '../../services/adminApi';

const exportRanking = (weekId, cohorts) => {
  const rows = [['Semana', 'Liga', 'Coorte', 'Posicao', 'UID', 'Nome', 'XP', 'Zona']];
  cohorts.forEach((cohort) => {
    const sorted = sortCompetitiveMembers(cohort.members || []);
    sorted.forEach((member, index) => rows.push([
      weekId,
      cohort.leagueId || 'iron',
      cohort.id,
      index + 1,
      member.uid || member.id,
      member.displayName || member.name || '',
      member.competitiveXP ?? member.weeklyXP ?? 0,
      getRankingZone({ position: index + 1, participants: sorted.length, leagueId: cohort.leagueId || 'iron', merged: Boolean(cohort.merged) }),
    ]));
  });
  const content = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ligas-${weekId}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const AdminLeaguesSection = ({ users = [], onOpenUser, onFeedback }) => {
  const [weeks, setWeeks] = useState([]);
  const [weekId, setWeekId] = useState(getWeekId());
  const [cohorts, setCohorts] = useState([]);
  const [selectedCohortId, setSelectedCohortId] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState('');
  const [simulation, setSimulation] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => onSnapshot(query(collection(db, 'weekly_rankings'), limit(26)), (snapshot) => {
    const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => b.id.localeCompare(a.id));
    setWeeks(rows);
    if (rows.length && !rows.some((row) => row.id === weekId)) setWeekId(rows[0].id);
  }, (error) => setLoadError(error.message)), [weekId]);

  useEffect(() => {
    setLoading(true);
    setSimulation(null);
    const memberStops = new Map();
    const stop = onSnapshot(collection(db, 'weekly_rankings', weekId, 'cohorts'), (snapshot) => {
      const cohortRows = snapshot.docs.map((item) => ({ id: item.id, ...item.data(), members: [] }));
      const currentIds = new Set(cohortRows.map((item) => item.id));
      memberStops.forEach((unsubscribe, id) => { if (!currentIds.has(id)) { unsubscribe(); memberStops.delete(id); } });
      setCohorts((current) => cohortRows.map((row) => ({ ...row, members: current.find((item) => item.id === row.id)?.members || [] })));
      cohortRows.forEach((cohort) => {
        if (memberStops.has(cohort.id)) return;
        const unsubscribe = onSnapshot(collection(db, 'weekly_rankings', weekId, 'cohorts', cohort.id, 'members'), (membersSnapshot) => {
          const members = membersSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
          setCohorts((current) => current.map((item) => item.id === cohort.id ? { ...item, members } : item));
        }, (error) => setLoadError(error.message));
        memberStops.set(cohort.id, unsubscribe);
      });
      setLoading(false);
      setLoadError('');
    }, (error) => { setLoadError(error.message); setLoading(false); });
    return () => { stop(); memberStops.forEach((unsubscribe) => unsubscribe()); };
  }, [weekId]);

  const totals = useMemo(() => cohorts.reduce((result, cohort) => {
    const count = cohort.members?.length || Number(cohort.participantCount || 0);
    const zones = getPromotionRelegationCounts(count, { merged: Boolean(cohort.merged) });
    return {
      participants: result.participants + count,
      promotions: result.promotions + zones.promoted,
      relegations: result.relegations + (getLeague(cohort.leagueId).index > 0 ? zones.relegated : 0),
      protected: result.protected + (getLeague(cohort.leagueId).index === 0 ? zones.relegated : 0),
      xp: result.xp + (cohort.members || []).reduce((sum, member) => sum + Number(member.competitiveXP || member.weeklyXP || 0), 0),
    };
  }, { participants: 0, promotions: 0, relegations: 0, protected: 0, xp: 0 }), [cohorts]);
  const selectedCohort = cohorts.find((item) => item.id === selectedCohortId) || null;
  const inconsistencies = cohorts.filter((cohort) => (cohort.members?.length || Number(cohort.participantCount || 0)) > 10 || (cohort.members?.length || 0) === 0);

  const execute = async (type) => {
    if (type === 'reprocess' && !window.confirm(`Reprocessar e fechar a semana ${weekId}? Esta ação altera dados derivados e será auditada.`)) return;
    setRunning(type);
    try {
      const result = type === 'simulate' ? await adminSimulateLeagueClosure(weekId) : await adminRecomputeLeagueWeek(weekId);
      if (type === 'simulate') setSimulation(result);
      onFeedback?.({ type: 'success', message: type === 'simulate' ? 'Simulação concluída sem alterar a classificação.' : 'Semana reprocessada no servidor.' });
    } catch (error) {
      onFeedback?.({ type: 'error', message: error.message });
    } finally {
      setRunning('');
    }
  };

  const openMember = (member) => onOpenUser(users.find((user) => user.id === (member.uid || member.id)) || { id: member.uid || member.id, ...member, name: member.displayName || member.name });

  return <section className="space-y-5">
    <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-card-dark">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex items-center gap-2 text-red-600"><Trophy size={18}/><span className="text-[10px] font-black uppercase tracking-[0.18em]">Campeonato completo</span></div><h2 className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">Ligas e coortes semanais</h2><p className="mt-1 text-sm font-medium text-zinc-500">Visualize todas as divisões, simule o fechamento e investigue cada coorte.</p></div><div className="flex flex-wrap gap-2"><select value={weekId} onChange={(event) => setWeekId(event.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-black dark:border-zinc-700 dark:bg-zinc-900"><option value={getWeekId()}>Semana atual · {getWeekId()}</option>{weeks.filter((week) => week.id !== getWeekId()).map((week) => <option key={week.id} value={week.id}>{week.id} · {week.status || 'registrada'}</option>)}</select><button type="button" onClick={() => execute('simulate')} disabled={Boolean(running)} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 text-[10px] font-black uppercase tracking-wider text-zinc-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700"><Play size={14}/> Simular</button><button type="button" onClick={() => execute('reprocess')} disabled={Boolean(running)} className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">{running === 'reprocess' ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>} Reprocessar</button><button type="button" onClick={() => exportRanking(weekId, cohorts)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-200 px-4 text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:border-zinc-700"><Download size={14}/> CSV</button></div></div>
    </div>
    {loadError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">Não foi possível carregar as ligas: {loadError}</div> : null}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{[['Coortes', cohorts.length, Shield], ['Participantes', totals.participants, Users], ['Promoções', totals.promotions, Trophy], ['Rebaixamentos', totals.relegations, AlertTriangle], ['Protegidos', totals.protected, Shield], ['XP semanal', totals.xp.toLocaleString('pt-BR'), Trophy]].map(([label, value, Icon]) => <article key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-card-dark">{React.createElement(Icon, { size: 16, className: 'text-red-600' })}<p className="mt-3 text-xl font-black text-zinc-900 dark:text-white">{loading ? '—' : value}</p><p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">{label}</p></article>)}</div>
    {simulation ? <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300">Simulação: {simulation.cohortCount ?? simulation.cohorts?.length ?? 0} coortes e {simulation.participantCount ?? 0} participantes. Nenhuma posição foi gravada.</div> : null}
    {inconsistencies.length ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300"><AlertTriangle size={16} className="mr-2 inline"/>{inconsistencies.length} coorte(s) vazias ou acima do limite esperado.</div> : null}
    <div className="overflow-x-auto pb-2"><div className="flex min-w-max gap-4">{LEAGUES.map((league) => { const leagueCohorts = cohorts.filter((cohort) => getLeague(cohort.leagueId).id === league.id); return <section key={league.id} className="w-[310px] shrink-0 rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-card-dark"><div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800"><div><p className="text-sm font-black text-zinc-900 dark:text-white">Liga {league.name}</p><p className="text-[10px] font-semibold text-zinc-400">{leagueCohorts.length} coortes</p></div><span className="h-4 w-4 rounded-full" style={{ backgroundColor: league.color }}/></div><div className="mt-3 space-y-2">{leagueCohorts.map((cohort) => { const count = cohort.members?.length || Number(cohort.participantCount || 0); return <button type="button" key={cohort.id} onClick={() => setSelectedCohortId(cohort.id)} className={`w-full rounded-2xl border p-3 text-left transition ${selectedCohortId === cohort.id ? 'border-red-400 bg-red-50 dark:bg-red-950/20' : 'border-zinc-200 bg-zinc-50 hover:border-red-200 dark:border-zinc-800 dark:bg-zinc-900/50'}`}><div className="flex items-center justify-between"><span className="max-w-[190px] truncate text-xs font-black text-zinc-800 dark:text-white">{cohort.name || cohort.id}</span><span className="text-[10px] font-black text-zinc-400">{count}/10</span></div><p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400">{cohort.status || 'aberta'} · {cohort.merged ? 'mesclada' : 'regular'}</p></button>; })}{!leagueCohorts.length ? <p className="py-6 text-center text-xs font-semibold text-zinc-400">Sem coortes nesta semana.</p> : null}</div></section>; })}</div></div>
    {selectedCohort ? <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-card-dark"><div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800"><h3 className="text-sm font-black text-zinc-900 dark:text-white">Membros · {selectedCohort.name || selectedCohort.id}</h3><p className="text-xs text-zinc-400">Clique no participante para abrir o perfil 360.</p></div><div className="divide-y divide-zinc-100 dark:divide-zinc-800">{sortCompetitiveMembers(selectedCohort.members || []).map((member, index, members) => { const zone = getRankingZone({ position: index + 1, participants: members.length, leagueId: selectedCohort.leagueId, merged: Boolean(selectedCohort.merged) }); return <button type="button" key={member.uid || member.id} onClick={() => openMember(member)} className="grid w-full grid-cols-[40px_1fr_auto_auto] items-center gap-3 px-5 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/50"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-xs font-black dark:bg-zinc-900">{index + 1}</span><span className="min-w-0"><span className="block truncate text-sm font-black text-zinc-800 dark:text-white">{member.displayName || member.name || member.uid}</span><span className="block truncate text-[10px] text-zinc-400">{member.uid || member.id}</span></span><span className={`rounded-lg px-2 py-1 text-[8px] font-black uppercase ${zone === 'promotion' ? 'bg-emerald-50 text-emerald-700' : zone === 'relegation' ? 'bg-red-50 text-red-700' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900'}`}>{zone === 'promotion' ? 'promoção' : zone === 'relegation' ? 'rebaixamento' : 'permanência'}</span><strong className="text-sm font-black text-red-600">{Number(member.competitiveXP || member.weeklyXP || 0).toLocaleString('pt-BR')} XP</strong></button>; })}</div></section> : null}
  </section>;
};

export default AdminLeaguesSection;
