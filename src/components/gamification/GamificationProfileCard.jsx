import React from 'react';
import { Award, Clock3, Flame, Lock, Shield, Trophy, Users, Zap } from 'lucide-react';
import { ACHIEVEMENTS } from '../../utils/gamification';
import { LEAGUES_ENABLED } from '../../config/featureFlags';

const iconByType = {
  clock: Clock3,
  flame: Flame,
  group: Users,
  crown: Trophy,
  level: Shield,
};

const GamificationProfileCard = ({ levelData }) => {
  const unlocked = new Set(levelData?.profile?.achievementIds || []);
  const visible = ACHIEVEMENTS.slice(0, 12);
  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid gap-5 bg-gradient-to-br from-zinc-950 via-zinc-900 to-red-950 p-5 text-white sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-red-300"><Zap size={12} fill="currentColor"/> Progressão ModoQAP</span>
          <div className="mt-2 flex flex-wrap items-end gap-3"><strong className="text-4xl font-black leading-none">Nível {levelData?.currentLevel || 1}</strong>{LEAGUES_ENABLED ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-zinc-300">Liga {levelData?.leagueName || 'Ferro'}</span> : null}</div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, levelData?.progressPercent || 0))}%` }}/></div>
          <div className="mt-2 flex justify-between text-[9px] font-bold uppercase tracking-wider text-zinc-400"><span>{levelData?.totalXP || 0} XP total</span><span>{levelData?.xpToNextLevel || 0} para o próximo</span></div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><span className="block text-xl font-black text-white">{levelData?.weeklyCompetitiveXP || 0}</span><span className="text-[8px] font-black uppercase tracking-wider text-zinc-400">XP acadêmico semanal</span></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><span className="block text-xl font-black text-white">{levelData?.achievementsSummary?.unlocked || 0}</span><span className="text-[8px] font-black uppercase tracking-wider text-zinc-400">Conquistas</span></div>
        </div>
      </div>
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-700 dark:text-zinc-200"><Award size={15} className="text-red-600"/> Conquistas</h2><span className="text-[9px] font-bold text-zinc-400">{unlocked.size}/{ACHIEVEMENTS.length} desbloqueadas</span></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((achievement) => {
            const Icon = iconByType[achievement.icon] || Trophy;
            const isUnlocked = unlocked.has(achievement.id);
            return <div key={achievement.id} className={`flex min-w-0 items-center gap-2 rounded-2xl border p-3 ${isUnlocked ? 'border-red-200 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/15' : 'border-zinc-200 bg-zinc-50 opacity-55 dark:border-zinc-800 dark:bg-zinc-950/40'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isUnlocked ? 'bg-red-600 text-white' : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800'}`}>{isUnlocked ? <Icon size={15}/> : <Lock size={13}/>}</span><span className="min-w-0"><strong className="block truncate text-[10px] font-black text-zinc-800 dark:text-zinc-100">{achievement.title}</strong><span className="block truncate text-[8px] font-bold uppercase tracking-wider text-zinc-400">{isUnlocked ? 'Desbloqueada' : 'Em progresso'}</span></span></div>;
          })}
        </div>
      </div>
    </section>
  );
};

export default GamificationProfileCard;
