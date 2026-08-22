import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, BarChart3, Clock3, Crown, ListChecks, Medal, Shield, Sparkles } from 'lucide-react';
import { db } from '../firebaseConfig';
import UserProfileModal from '../components/gamification/UserProfileModal';
import { formatStudyMinutes, getLeague, getWeekId, sortGeneralRankingMembers } from '../utils/gamification';
import { LEAGUES_ENABLED } from '../config/featureFlags';

const initials = (name = 'E') => String(name).split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const Avatar = ({ member, className = 'h-10 w-10' }) => <div className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-xs font-black text-zinc-600 ring-2 ring-white dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-900`}>{member?.photoURL ? <img src={member.photoURL} alt="" className="h-full w-full object-cover"/> : initials(member?.displayName)}</div>;
const metricValue = (member, metric) => metric === 'minutes' ? formatStudyMinutes(member?.minutes || 0) : Number(member?.questions || 0).toLocaleString('pt-BR');

const podiumStyle = {
  1: { badge: 'bg-amber-500', block: 'h-24 bg-gradient-to-b from-amber-300 to-amber-600 text-amber-950 sm:h-28', ring: 'ring-4 ring-amber-300', icon: Crown, glow: 'shadow-[0_0_40px_rgba(245,158,11,.24)]' },
  2: { badge: 'bg-slate-500', block: 'h-16 bg-gradient-to-b from-slate-200 to-slate-500 text-slate-800 sm:h-20', ring: 'ring-4 ring-slate-300', icon: Medal, glow: 'shadow-[0_0_30px_rgba(148,163,184,.18)]' },
  3: { badge: 'bg-orange-600', block: 'h-14 bg-gradient-to-b from-orange-300 to-orange-700 text-orange-950 sm:h-16', ring: 'ring-4 ring-orange-300', icon: Medal, glow: 'shadow-[0_0_30px_rgba(234,88,12,.18)]' },
};

const TopCard = ({ member, position, metric, reduceMotion, onOpen }) => {
  const style = podiumStyle[position];
  const Icon = style.icon;
  return <Motion.button type="button" disabled={!member} onClick={() => member && onOpen(member, position)} initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: reduceMotion ? 0 : position * 0.08, type: 'spring', stiffness: 170, damping: 18 }} whileHover={reduceMotion || !member ? undefined : { y: -4 }} className="flex min-w-0 flex-col items-center justify-end text-left disabled:cursor-default">
    <Motion.span animate={!reduceMotion && member && position === 1 ? { rotate: [-3, 3, -3], y: [0, -2, 0] } : undefined} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}><Icon className={`mb-1 ${position === 1 ? 'text-amber-500' : position === 2 ? 'text-slate-400' : 'text-orange-500'}`} size={position === 1 ? 27 : 20} fill={position === 1 ? 'currentColor' : 'none'}/></Motion.span>
    <div className={`relative rounded-full ${style.ring} ${member ? style.glow : ''}`}><Avatar member={member} className={position === 1 ? 'h-16 w-16 sm:h-20 sm:w-20' : 'h-12 w-12 sm:h-16 sm:w-16'}/><span className={`absolute -bottom-1 left-1/2 flex h-6 min-w-6 -translate-x-1/2 items-center justify-center rounded-full px-1 text-[9px] font-black text-white ${style.badge}`}>{position}º</span></div>
    <p className="mt-3 w-full truncate text-center text-[9px] font-black text-zinc-900 dark:text-white sm:text-xs">{member?.displayName || 'Posição aberta'}</p>
    <p className="mt-0.5 max-w-full truncate text-center text-[8px] font-black text-zinc-600 dark:text-zinc-300 sm:text-[10px]">{member ? metricValue(member, metric) : '—'} {member && metric === 'questions' ? 'questões' : ''}</p>
    <div className={`mt-2 flex w-full flex-col items-center rounded-t-xl pt-2 font-black ${style.block}`}><span className="text-xl">{position}º</span></div>
  </Motion.button>;
};

const Segmented = ({ items, value, onChange }) => <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">{items.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => onChange(id)} className={`flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[8px] font-black uppercase tracking-wide transition sm:px-3 sm:text-[9px] ${value === id ? 'bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'}`}>{Icon && <Icon size={11}/>}<span>{label}</span></button>)}</div>;

const Movement = ({ member, metric }) => {
  const current = Number(member?.positions?.[metric] || 0);
  const previous = Number(member?.previousPositions?.[metric] || 0);
  const delta = Number(member?.positionDeltas?.[metric] ?? (previous && current ? previous - current : 0));
  if (!previous || !current || !delta) return null;
  return delta > 0
    ? <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-emerald-600" title={`Subiu ${delta} posição${delta > 1 ? 'ões' : ''}`}><ArrowUp size={11}/>{delta}</span>
    : <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-red-600" title={`Desceu ${Math.abs(delta)} posição${Math.abs(delta) > 1 ? 'ões' : ''}`}><ArrowDown size={11}/>{Math.abs(delta)}</span>;
};

const topRowTone = {
  0: 'border-amber-300 bg-gradient-to-r from-amber-50 via-white to-white dark:border-amber-800/60 dark:from-amber-950/25 dark:via-zinc-900 dark:to-zinc-900',
  1: 'border-slate-300 bg-gradient-to-r from-slate-100 via-white to-white dark:border-slate-700 dark:from-slate-900 dark:via-zinc-900 dark:to-zinc-900',
  2: 'border-orange-300 bg-gradient-to-r from-orange-50 via-white to-white dark:border-orange-900/60 dark:from-orange-950/20 dark:via-zinc-900 dark:to-zinc-900',
};

const RankingPage = ({ user, levelData }) => {
  const [metric, setMetric] = useState('questions');
  const [scope, setScope] = useState('weekly');
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessBlocked, setAccessBlocked] = useState(false);
  const reduceMotion = useReducedMotion();
  const weekId = getWeekId();

  useEffect(() => {
    if (!user?.uid) return undefined;
    setLoading(true);
    const rankingRef = scope === 'weekly' ? collection(db, 'weekly_rankings', weekId, 'members') : collection(db, 'general_rankings', 'all', 'members');
    return onSnapshot(rankingRef, (snapshot) => {
      setMembers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => item.accountActive !== false));
      setLoading(false);
      setAccessBlocked(false);
    }, (error) => {
      setAccessBlocked(['permission-denied', 'firestore/permission-denied'].includes(error?.code));
      setLoading(false);
    });
  }, [scope, user?.uid, weekId]);

  const sorted = useMemo(() => sortGeneralRankingMembers(members, metric), [members, metric]);
  const periodLabel = scope === 'weekly' ? 'Desempenho da semana atual' : 'Desempenho acumulado';
  const ownIndex = sorted.findIndex((member) => (member.uid || member.id) === user?.uid);
  const own = ownIndex >= 0 ? sorted[ownIndex] : { displayName: user?.displayName || 'Você', level: levelData?.currentLevel || 1, leagueId: levelData?.leagueId || 'iron', minutes: 0, questions: 0, accuracy: 0 };
  const openPublicProfile = (member, position) => setSelectedMember({
    ...member,
    publicRankingPosition: position,
    publicRankingLabel: `${scope === 'weekly' ? 'Semanal' : 'Geral'} por ${metric === 'minutes' ? 'tempo' : 'questões'}`,
  });

  return <div className="mx-auto min-h-full w-full min-w-0 max-w-7xl px-3 pb-28 pt-3 sm:px-5 lg:px-7">
    {accessBlocked && <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">Os agregados deste ranking ainda não estão liberados pelas regras publicadas.</div>}
    <header className="mb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">{periodLabel}</p><h1 className="mt-1 text-3xl font-black uppercase tracking-tight text-zinc-950 dark:text-white sm:text-4xl">Ranking</h1></div>
        <div className="flex flex-wrap items-center justify-end gap-2"><Segmented value={metric} onChange={setMetric} items={[["minutes", "Tempo", Clock3], ["questions", "Questões", ListChecks]]}/><Segmented value={scope} onChange={setScope} items={[["weekly", "Semanal"], ["general", "Geral"]]}/></div>
      </div>
      <p className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{metric === 'minutes' ? 'Ordenado pelo tempo de estudo' : 'Ordenado pelo total de questões'} · todos os usuários com conta ativa</p>
    </header>
    <section className="min-w-0 overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-[1.75rem]">
      <div className="relative bg-gradient-to-b from-zinc-50 to-zinc-100 px-2 pt-4 dark:from-zinc-900 dark:to-zinc-950 sm:px-7 sm:pt-6">
        <Motion.div aria-hidden="true" animate={reduceMotion ? undefined : { opacity: [0.15, 0.35, 0.15], scale: [0.96, 1.04, 0.96] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} className="pointer-events-none absolute left-1/2 top-1/3 h-36 w-2/3 -translate-x-1/2 rounded-full bg-amber-400/20 blur-3xl"/>
        <div className="relative mx-auto grid max-w-3xl grid-cols-3 items-end gap-1.5 sm:gap-4">{[1, 0, 2].map((index) => <TopCard key={index} member={sorted[index]} position={index + 1} metric={metric} reduceMotion={reduceMotion} onOpen={openPublicProfile}/>)}</div>
      </div>
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-4 py-3"><div><h2 className="text-xs font-black uppercase tracking-[0.14em] text-zinc-700 dark:text-zinc-200">Classificação completa</h2><p className="text-[8px] font-bold uppercase tracking-wider text-zinc-400">Clique em um estudante para ver o perfil</p></div><span className="inline-flex items-center gap-1 text-[8px] font-black text-zinc-400"><Sparkles size={11}/>{members.length} ativos</span></div>
        {loading ? <div className="p-10 text-center text-xs font-bold text-zinc-400">Carregando...</div> : !sorted.length ? <div className="p-10 text-center"><BarChart3 className="mx-auto mb-2 text-zinc-300"/><p className="text-xs font-black text-zinc-600 dark:text-zinc-300">Nenhum usuário ativo no ranking</p></div> : <div className="space-y-2 bg-zinc-50/70 p-2 dark:bg-zinc-950/30 sm:p-3">{sorted.map((member, index) => {
          const ownRow = (member.uid || member.id) === user?.uid;
          const league = getLeague(member.leagueId);
          return <button type="button" onClick={() => openPublicProfile(member, index + 1)} key={member.uid || member.id} className={`grid w-full grid-cols-[32px_1fr] items-center gap-2 rounded-xl border px-2.5 py-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[40px_minmax(160px,1fr)_90px_78px_70px] sm:gap-3 sm:px-4 ${index < 3 ? topRowTone[index] : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'} ${ownRow ? 'ring-2 ring-red-500/25' : ''}`}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-black ${index === 0 ? 'bg-amber-500 text-white' : index === 1 ? 'bg-slate-500 text-white' : index === 2 ? 'bg-orange-600 text-white' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}`}>{index + 1}</span>
            <div className="flex min-w-0 items-center gap-2"><Avatar member={member} className="h-10 w-10"/><div className="min-w-0"><div className="flex items-center gap-1.5"><p className="truncate text-[11px] font-black text-zinc-800 dark:text-white sm:text-xs">{member.displayName}{ownRow ? ' · você' : ''}</p><Movement member={member} metric={metric}/></div><div className="mt-0.5 flex flex-wrap items-center gap-1"><span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[7px] font-black uppercase text-zinc-500 dark:bg-zinc-800">Nível {member.level || 1}</span>{LEAGUES_ENABLED ? <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[7px] font-black uppercase text-white" style={{ backgroundColor: league.color }}><Shield size={8}/>{league.name}</span> : null}</div></div></div>
            <div className="col-span-2 grid grid-cols-3 gap-2 border-t border-zinc-200/70 pt-2 dark:border-zinc-700/70 sm:hidden"><span><span className="block text-[7px] font-black uppercase tracking-wider text-zinc-400">Tempo</span><strong className="block text-[10px] font-black text-zinc-800 dark:text-zinc-100">{formatStudyMinutes(member.minutes)}</strong></span><span><span className="block text-[7px] font-black uppercase tracking-wider text-zinc-400">Questões</span><strong className="block text-[10px] font-black text-zinc-800 dark:text-zinc-100">{Number(member.questions || 0).toLocaleString('pt-BR')}</strong></span><span><span className="block text-[7px] font-black uppercase tracking-wider text-zinc-400">Precisão</span><strong className="block text-[10px] font-black text-zinc-800 dark:text-zinc-100">{Number(member.accuracy || 0).toFixed(0)}%</strong></span></div>
            <div className="hidden sm:block"><span className="block text-[7px] font-black uppercase tracking-wider text-zinc-400">Tempo</span><strong className="block text-[11px] font-black text-zinc-800 dark:text-zinc-100">{formatStudyMinutes(member.minutes)}</strong></div>
            <div className="hidden sm:block"><span className="block text-[7px] font-black uppercase tracking-wider text-zinc-400">Questões</span><strong className="block text-[11px] font-black text-zinc-800 dark:text-zinc-100">{Number(member.questions || 0).toLocaleString('pt-BR')}</strong></div>
            <div className="hidden sm:block"><span className="block text-[7px] font-black uppercase tracking-wider text-zinc-400">Precisão</span><strong className="block text-[11px] font-black text-zinc-800 dark:text-zinc-100">{Number(member.accuracy || 0).toFixed(0)}%</strong></div>
          </button>;
        })}</div>}
      </div>
    </section>
    <div className="sticky bottom-3 z-20 mt-3 grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-xl backdrop-blur-xl dark:border-zinc-700 dark:bg-zinc-900/95"><span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-zinc-900 px-2 text-xs font-black text-white dark:bg-white dark:text-zinc-900">{ownIndex >= 0 ? ownIndex + 1 : '—'}</span><div className="min-w-0"><p className="truncate text-[11px] font-black text-zinc-900 dark:text-white">Sua posição · {scope === 'weekly' ? 'Semanal' : 'Geral'}</p><p className="text-[7px] font-bold uppercase text-zinc-400">{metric === 'minutes' ? 'Tempo estudado' : 'Questões feitas'}</p></div><span className="max-w-[100px] truncate text-right text-[10px] font-black text-zinc-800 dark:text-zinc-100 sm:text-xs">{metricValue(own, metric)}{metric === 'questions' ? ' q' : ''}</span></div>
    <UserProfileModal member={selectedMember} onClose={() => setSelectedMember(null)}/>
  </div>;
};

export default RankingPage;
