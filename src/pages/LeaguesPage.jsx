import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, Clock3, Crown, Diamond, Gem, Medal, Minus, Shield, Trophy, Zap } from 'lucide-react';
import { db } from '../firebaseConfig';
import UserProfileModal from '../components/gamification/UserProfileModal';
import { getLeague, getNextWeekId, getPromotionRelegationCounts, getRankingZone, getWeekId, LEAGUES, sortCompetitiveMembers } from '../utils/gamification';

const iconByLeague = { shield: Shield, medal: Medal, crown: Crown, gem: Gem, diamond: Diamond };

const useRoundCountdown = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return useMemo(() => {
    const end = new Date(`${getNextWeekId(getWeekId(new Date(now)))}T00:00:00-03:00`).getTime();
    const total = Math.floor(Math.max(0, end - now) / 1000);
    return {
      days: Math.floor(total / 86400),
      hours: Math.floor((total % 86400) / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60,
    };
  }, [now]);
};

const LeagueIcon = ({ league, size = 20 }) => {
  const Icon = iconByLeague[league.icon] || Shield;
  return <Icon size={size} strokeWidth={1.9}/>;
};

const Avatar = ({ member, className = 'h-10 w-10' }) => (
  <div className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-[10px] font-black text-zinc-600 ring-2 ring-white dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-900`}>
    {member?.photoURL ? <img src={member.photoURL} alt="" className="h-full w-full object-cover"/> : String(member?.displayName || 'E').split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
  </div>
);

const Movement = ({ member }) => {
  const current = Number(member.position || member.rank || 0);
  const previous = Number(member.previousPosition || member.previousRank || 0);
  const delta = Number.isFinite(Number(member.positionDelta)) ? Number(member.positionDelta) : previous && current ? previous - current : 0;
  if (delta > 0) return <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-emerald-600" title={`Subiu ${delta} posição${delta > 1 ? 'ões' : ''}`}><ArrowUp size={11}/>{delta}</span>;
  if (delta < 0) return <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-red-600" title={`Desceu ${Math.abs(delta)} posição${Math.abs(delta) > 1 ? 'ões' : ''}`}><ArrowDown size={11}/>{Math.abs(delta)}</span>;
  return <span className="inline-flex text-zinc-300 dark:text-zinc-600" title="Posição mantida"><Minus size={11}/></span>;
};

const LeagueJourney = ({ currentLeague, reduceMotion }) => {
  const countdown = useRoundCountdown();
  const units = [
    ['Dias', countdown.days],
    ['Horas', countdown.hours],
    ['Min', countdown.minutes],
    ['Seg', countdown.seconds],
  ];
  return <section className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-lg shadow-zinc-950/5 dark:border-zinc-800 dark:bg-card-dark sm:p-5 lg:p-7">
    <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: currentLeague.glow }}/>
    <div className="relative mb-5 flex items-start justify-between gap-2 sm:gap-4">
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-red-600 lg:text-[11px]">Jornada competitiva</p>
        <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-3xl lg:text-4xl">Liga {currentLeague.name}</h1>
        <p className="mt-1 hidden text-xs font-semibold text-zinc-500 dark:text-zinc-400 sm:block lg:text-sm">Avance na classificação e alcance a próxima divisão.</p>
      </div>
      <div className="w-[132px] shrink-0 rounded-xl border border-zinc-200 bg-zinc-50/95 p-1.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 sm:w-[158px] sm:p-2">
        <div className="mb-1 flex items-center justify-center gap-1 text-zinc-500 dark:text-zinc-300">
          <Clock3 size={10} className="text-red-600"/>
          <span className="truncate text-[6px] font-black uppercase tracking-[0.12em] sm:text-[7px]">Fim da rodada atual</span>
        </div>
        <div className="grid grid-cols-4 gap-0.5 sm:gap-1">
          {units.map(([label, value]) => <div key={label} className="rounded-md bg-white px-0.5 py-1 text-center shadow-sm dark:bg-zinc-800"><strong className="block font-mono text-[10px] font-black leading-none tabular-nums text-zinc-950 dark:text-white sm:text-xs">{String(value).padStart(2, '0')}</strong><span className="mt-0.5 block text-[5px] font-black uppercase leading-none tracking-tight text-zinc-400 sm:text-[6px]">{label}</span></div>)}
        </div>
      </div>
    </div>
    <div className="relative grid grid-cols-7 gap-1.5 sm:gap-2.5 lg:gap-3">
      {LEAGUES.map((league, index) => {
        const current = league.id === currentLeague.id;
        return <Motion.div key={league.id} initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className={`relative flex min-w-0 flex-col items-center overflow-hidden rounded-2xl border px-1 py-3 transition-all sm:px-2 lg:py-5 ${current ? 'scale-[1.03] border-red-300 bg-red-50 shadow-xl shadow-red-500/10 ring-2 ring-red-500/10 dark:border-red-900/70 dark:bg-red-950/15' : 'border-zinc-200 bg-zinc-50/70 hover:-translate-y-1 hover:bg-white hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-900'}`}>
          <Motion.span animate={current && !reduceMotion ? { y: [0, -3, 0] } : {}} transition={{ duration: 2.4, repeat: Infinity }} className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-md sm:h-11 sm:w-11 lg:h-16 lg:w-16 lg:rounded-2xl" style={{ background: `linear-gradient(145deg, ${league.glow}, ${league.color})`, boxShadow: `0 12px 28px ${league.glow}38` }}><LeagueIcon league={league} size={current ? 25 : 22}/></Motion.span>
          <span className={`mt-2 max-w-full truncate text-[7px] font-black uppercase tracking-wide sm:text-[9px] lg:text-xs ${current ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`}>{league.name}</span>
          {current && <span className="mt-1 hidden rounded-full bg-red-600 px-2 py-0.5 text-[7px] font-black uppercase tracking-wider text-white lg:block">Atual</span>}
          {current && <span className="absolute bottom-0 h-1 w-10 rounded-full bg-red-600"/>}
        </Motion.div>;
      })}
    </div>
  </section>;
};

const podiumTone = {
  1: 'border-amber-300 bg-gradient-to-r from-amber-50 to-white shadow-amber-500/10 dark:border-amber-800/60 dark:from-amber-950/25 dark:to-zinc-900',
  2: 'border-slate-300 bg-gradient-to-r from-slate-100 to-white dark:border-slate-700 dark:from-slate-900 dark:to-zinc-900',
  3: 'border-orange-300 bg-gradient-to-r from-orange-50 to-white dark:border-orange-900/60 dark:from-orange-950/20 dark:to-zinc-900',
};

const LeagueRow = ({ member, position, participantCount, league, cohort, own, onOpen }) => {
  const zone = getRankingZone({ position, participants: participantCount, leagueId: league.id, merged: Boolean(cohort?.merged) });
  const { relegated } = getPromotionRelegationCounts(participantCount, { merged: Boolean(cohort?.merged) });
  const protectedFromRelegation = league.index === 0 && relegated > 0 && position > participantCount - relegated;
  const zoneLabel = zone === 'promotion' ? 'Promoção' : zone === 'relegation' ? 'Rebaixamento' : protectedFromRelegation ? 'Permanência protegida' : 'Permanência';
  const top = position <= 3;
  const MedalIcon = position === 1 ? Crown : Medal;
  return <Motion.button type="button" onClick={() => onOpen({ ...member, publicRankingPosition: position, publicRankingLabel: 'Ranking da liga' })} layout className={`relative grid w-full grid-cols-[30px_auto_1fr_auto] items-center gap-2 overflow-hidden rounded-xl border px-2.5 py-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[38px_auto_1fr_auto] sm:gap-3 sm:px-4 ${top ? podiumTone[position] : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/55'} ${own ? 'ring-2 ring-red-500/35' : ''}`}>
    <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-black ${position === 1 ? 'bg-amber-500 text-white' : position === 2 ? 'bg-slate-500 text-white' : position === 3 ? 'bg-orange-600 text-white' : zone === 'promotion' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : zone === 'relegation' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>{top ? <MedalIcon size={14} fill={position === 1 ? 'currentColor' : 'none'}/> : position}</span>
    <Avatar member={member} className={top ? 'h-11 w-11 sm:h-12 sm:w-12' : 'h-9 w-9'}/>
    <div className="min-w-0"><div className="flex min-w-0 items-center gap-1.5"><p className={`truncate font-black text-zinc-900 dark:text-white ${top ? 'text-xs sm:text-sm' : 'text-[11px]'}`}>{member.displayName || 'Estudante'}{own ? ' · você' : ''}</p><Movement member={member}/></div><p className={`text-[7px] font-bold uppercase tracking-wider ${zone === 'promotion' ? 'text-emerald-600' : zone === 'relegation' ? 'text-red-500' : protectedFromRelegation ? 'text-blue-500' : 'text-zinc-400'}`}>{zoneLabel}</p></div>
    <strong className={`${top ? 'text-xs sm:text-sm' : 'text-[11px]'} whitespace-nowrap font-black text-zinc-800 dark:text-zinc-100`}>{Number(member.competitiveXP || member.weeklyXP || 0).toLocaleString('pt-BR')} XP</strong>
    <span className={`absolute bottom-0 left-0 top-0 w-1 ${zone === 'promotion' ? 'bg-emerald-500' : zone === 'relegation' ? 'bg-red-500' : protectedFromRelegation ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}/>
  </Motion.button>;
};

const LeaguesPage = ({ user, levelData }) => {
  const reduceMotion = useReducedMotion();
  const weekId = getWeekId();
  const league = getLeague(levelData?.leagueId || 'iron');
  const cohortId = levelData?.profile?.competitiveWeekId === weekId ? levelData?.profile?.currentCohortId : null;
  const [cohort, setCohort] = useState(null);
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    if (!cohortId) { setCohort(null); setMembers([]); return undefined; }
    const cohortRef = doc(db, 'weekly_rankings', weekId, 'cohorts', cohortId);
    const stopCohort = onSnapshot(cohortRef, (snapshot) => setCohort(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null));
    const stopMembers = onSnapshot(collection(cohortRef, 'members'), (snapshot) => setMembers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))));
    return () => { stopCohort(); stopMembers(); };
  }, [cohortId, weekId]);

  const sorted = useMemo(() => sortCompetitiveMembers(members), [members]);
  const participantCount = sorted.length || Number(cohort?.participantCount || 0);
  const zoneCounts = getPromotionRelegationCounts(participantCount, { merged: Boolean(cohort?.merged) });
  const relegationLabel = league.index === 0 ? 'protegidos' : 'rebaixamento';

  return <div className="mx-auto w-full max-w-7xl space-y-5 px-3 pb-24 pt-3 sm:px-5 lg:px-7 lg:pt-5">
    <LeagueJourney currentLeague={league} reduceMotion={reduceMotion}/>
    <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50/70 shadow-lg shadow-zinc-950/5 dark:border-zinc-800 dark:bg-card-dark">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-card-dark sm:px-6 lg:px-7 lg:py-5"><div className="min-w-0"><p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-red-600"><Trophy size={13}/> Ranking da liga</p><h2 className="truncate text-xl font-black text-zinc-950 dark:text-white lg:text-2xl">Classificação completa</h2></div><div className="shrink-0 rounded-xl bg-zinc-100 px-3 py-2 text-right dark:bg-zinc-900"><strong className="block text-sm font-black text-zinc-800 dark:text-white lg:text-base">{participantCount}/10</strong><span className="text-[7px] font-black uppercase tracking-wider text-zinc-400">participantes</span></div></div>
      {!cohortId ? <div className="p-10 text-center lg:p-16"><Zap className="mx-auto mb-3 text-red-400" size={38}/><p className="text-sm font-black text-zinc-700 dark:text-zinc-200 lg:text-base">Sua rodada começa no primeiro XP acadêmico</p><p className="mt-1 text-[10px] text-zinc-400 lg:text-xs">Usuários inativos não entram e não são rebaixados.</p></div> : <div className="p-2 sm:p-4 lg:p-5"><div className="mb-3 grid grid-cols-3 gap-2"><span className="rounded-xl bg-emerald-50 px-2 py-2 text-center text-[8px] font-black uppercase text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{zoneCounts.promoted} promoção</span><span className="rounded-xl bg-zinc-100 px-2 py-2 text-center text-[8px] font-black uppercase text-zinc-500 dark:bg-zinc-900">{Math.max(0, participantCount - zoneCounts.promoted - zoneCounts.relegated)} permanência</span><span className={`rounded-xl px-2 py-2 text-center text-[8px] font-black uppercase ${league.index === 0 ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'}`}>{zoneCounts.relegated} {relegationLabel}</span></div><div className="space-y-2">{sorted.slice(0, 10).map((member, index) => <LeagueRow key={member.uid || member.id} member={member} position={index + 1} participantCount={participantCount} league={league} cohort={cohort} own={(member.uid || member.id) === user?.uid} onOpen={setSelectedMember}/>)}</div></div>}
    </section>
    <UserProfileModal member={selectedMember} onClose={() => setSelectedMember(null)}/>
  </div>;
};

export default LeaguesPage;
