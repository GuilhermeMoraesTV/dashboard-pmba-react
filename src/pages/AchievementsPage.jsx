import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { motion as Motion } from 'framer-motion';
import { Award, Check, Lock, Search, Sparkles, Trophy, Zap } from 'lucide-react';
import { db } from '../firebaseConfig';
import { ACHIEVEMENTS, getAchievementProgress, getLeague } from '../utils/gamification';

const AchievementsPage = ({ user, levelData }) => {
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState('Todas');
  const [search, setSearch] = useState('');
  const [accessBlocked, setAccessBlocked] = useState(false);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return onSnapshot(collection(db, 'users', user.uid, 'gamification', 'profile', 'achievements'), (snapshot) => {
      setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setAccessBlocked(false);
    }, (error) => {
      if (['permission-denied', 'firestore/permission-denied'].includes(error?.code)) setAccessBlocked(true);
      else console.error('[Conquistas] Erro ao carregar progresso:', error);
    });
  }, [user?.uid]);

  const state = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const progressState = useMemo(() => {
    const profile = levelData?.profile || {};
    const totals = profile.totals || {};
    const league = getLeague(profile.currentLeague || levelData?.leagueId || 'iron');
    return {
      level: Number(levelData?.currentLevel || profile.level || 1),
      minutes: Number(totals.minutes || 0),
      questions: Number(totals.questions || 0),
      studies: Number(totals.studies || 0),
      simulations: Number(totals.simulations || 0),
      reviews: Number(totals.reviews || 0),
      dailyGoals: Number(totals.dailyGoals || 0),
      cycleRounds: Number(totals.cycleRounds || 0),
      schedulesCompleted: Number(totals.schedulesCompleted || 0),
      cyclesCreated: Number(profile.cyclesCreated || 0),
      schedulesCreated: Number(profile.schedulesCreated || 0),
      accuracy85Questions: Number(totals.accuracy || 0) >= 85 ? Number(totals.questions || 0) : 0,
      accuracy90Questions: Number(totals.accuracy || 0) >= 90 ? Number(totals.questions || 0) : 0,
      streak: Number(profile.streak || profile.currentStreak || 0),
      groupsJoined: Array.isArray(profile.groupIds) ? profile.groupIds.length : 0,
      groupsCreated: Number(profile.createdGroupCount || 0),
      groupPodiums: Number(profile.groupPodiums || 0),
      highestLeagueIndex: Number(profile.highestLeagueIndex ?? league.index),
      leaguePodiums: Number(profile.leaguePodiums || 0),
      generalTop10: Number(profile.generalTop10 || 0),
      generalTop3: Number(profile.generalTop3 || 0),
      generalFirst: Number(profile.generalFirst || 0),
    };
  }, [levelData]);
  const catalog = useMemo(() => {
    const unlockedIds = new Set(levelData?.profile?.achievementIds || []);
    return ACHIEVEMENTS.map((achievement) => {
      const saved = state.get(achievement.id) || {};
      const derived = getAchievementProgress(achievement, progressState);
      return {
        ...achievement,
        ...saved,
        progress: Math.max(Number(saved.progress || 0), derived.current),
        progressTarget: Number(saved.progressTarget || achievement.threshold),
        progressPercent: Math.max(Number(saved.progressPercent || 0), derived.percent),
        unlocked: saved.unlocked === true || unlockedIds.has(achievement.id),
      };
    });
  }, [levelData?.profile?.achievementIds, progressState, state]);
  const categories = useMemo(() => ['Todas', ...new Set(ACHIEVEMENTS.map((item) => item.category))], []);
  const filtered = useMemo(() => catalog.filter((item) => {
    const matchesCategory = category === 'Todas' || item.category === category;
    const term = search.trim().toLocaleLowerCase('pt-BR');
    const matchesSearch = !term || `${item.title} ${item.description} ${item.requirement}`.toLocaleLowerCase('pt-BR').includes(term);
    return matchesCategory && matchesSearch;
  }), [catalog, category, search]);
  const unlocked = catalog.filter((item) => item.unlocked).length;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 pb-24 pt-3 sm:px-5 lg:px-7">
      <header className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-card-dark sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl"/>
        <div className="relative grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <div><span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-amber-700 dark:bg-amber-950/25 dark:text-amber-300"><Sparkles size={12}/> Histórico permanente</span><h1 className="mt-3 text-3xl font-black text-zinc-950 dark:text-white">Conquistas</h1><p className="mt-2 max-w-2xl text-xs font-medium leading-relaxed text-zinc-500">Acompanhe requisito, progresso e XP de cada marco. Uma conquista desbloqueada nunca é removida.</p></div>
          <div className="grid grid-cols-2 gap-2"><div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-3 dark:border-zinc-700 dark:bg-zinc-900"><strong className="block text-2xl font-black text-zinc-900 dark:text-white">{unlocked}</strong><span className="text-[8px] font-black uppercase tracking-wider text-zinc-400">Desbloqueadas</span></div><div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-3 dark:border-zinc-700 dark:bg-zinc-900"><strong className="block text-2xl font-black text-red-600">{levelData?.totalXP || 0}</strong><span className="text-[8px] font-black uppercase tracking-wider text-zinc-400">XP total</span></div></div>
        </div>
      </header>

      {accessBlocked && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">O progresso local continua visível, mas o histórico permanente aguarda a publicação das regras de gamificação.</div>}

      <section className="rounded-3xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-card-dark sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar conquista" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-9 pr-3 text-xs font-bold text-zinc-800 outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"/></label>
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`min-w-max rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-wider ${category === item ? 'bg-white text-red-600 shadow-sm dark:bg-zinc-800' : 'text-zinc-400'}`}>{item}</button>)}</div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((item, index) => {
        const isUnlocked = item.unlocked === true;
        const current = Number(item.progress || 0);
        const target = Number(item.progressTarget || item.threshold || 1);
        const percent = isUnlocked ? 100 : Math.max(0, Math.min(100, Number(item.progressPercent ?? (current / target) * 100)));
        return (
          <Motion.article key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 12) * 0.025 }} className={`relative overflow-hidden rounded-3xl border p-4 shadow-sm ${isUnlocked ? 'border-amber-200 bg-gradient-to-br from-amber-50/90 to-white dark:border-amber-900/50 dark:from-amber-950/15 dark:to-card-dark' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-card-dark'}`}>
            <div className="flex items-start gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isUnlocked ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}`}>{isUnlocked ? <Trophy size={20}/> : <Lock size={17}/>}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">{item.category}</p><h2 className="mt-0.5 text-sm font-black text-zinc-900 dark:text-white">{item.title}</h2></div><span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[9px] font-black text-red-600 dark:bg-red-950/25"><Zap size={10}/> {item.xp} XP</span></div><p className="mt-2 text-[10px] font-medium leading-relaxed text-zinc-500">{item.description}</p></div></div>
            <div className="mt-4 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-950/40"><div className="flex items-center justify-between gap-3"><span className="truncate text-[9px] font-black uppercase tracking-wider text-zinc-500">{item.requirement}</span><span className={`flex items-center gap-1 text-[9px] font-black ${isUnlocked ? 'text-emerald-600' : 'text-zinc-400'}`}>{isUnlocked ? <><Check size={11}/> Concluída</> : `${Math.round(percent)}%`}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"><Motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} className={`h-full rounded-full ${isUnlocked ? 'bg-amber-500' : 'bg-red-600'}`}/></div>{!isUnlocked && <div className="mt-1.5 flex justify-between text-[8px] font-bold text-zinc-400"><span>{current.toLocaleString('pt-BR')}</span><span>{target.toLocaleString('pt-BR')}</span></div>}</div>
          </Motion.article>
        );
      })}</div>
      {!filtered.length && <div className="rounded-3xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700"><Award className="mx-auto mb-3 text-zinc-300" size={34}/><p className="text-sm font-black text-zinc-600 dark:text-zinc-300">Nenhuma conquista encontrada</p></div>}
    </div>
  );
};

export default AchievementsPage;
