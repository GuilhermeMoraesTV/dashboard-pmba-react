/*import React from 'react';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';

// ============================================================================
// CONFIGURAÇÃO VISUAL DAS DIVISÕES (ESTILO DUOLINGO LEAGUES)
// ============================================================================
export const getRankTheme = (rankName) => {
  switch (rankName) {
    case 'Lenda':
      return {
        from: '#ef4444', to: '#facc15',
        badge: 'bg-gradient-to-r from-red-600 to-yellow-500 text-white border-yellow-400/50',
        glow: 'drop-shadow-[0_0_15px_rgba(239,68,68,1)]',
        bar: 'bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400',
        coverClass: 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-500 via-red-600 to-red-900 animate-pulse-slow', // Aura lendária
      };
    case 'Grão-Mestre':
      return {
        from: '#f43f5e', to: '#881337',
        badge: 'bg-gradient-to-r from-rose-500 to-rose-800 text-white border-rose-400/50',
        glow: 'drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]',
        bar: 'bg-gradient-to-r from-rose-400 to-rose-600',
        coverClass: 'bg-[repeating-linear-gradient(45deg,#be123c,#be123c_15px,#9f1239_15px,#9f1239_30px)] animate-stripe-slide', // Listras Carmesim
      };
    case 'Mestre':
      return {
        from: '#d946ef', to: '#6b21a8',
        badge: 'bg-gradient-to-r from-fuchsia-500 to-purple-800 text-white border-fuchsia-400/50',
        glow: 'drop-shadow-[0_0_12px_rgba(217,70,239,0.8)]',
        bar: 'bg-gradient-to-r from-fuchsia-400 to-purple-600',
        coverClass: 'bg-[repeating-linear-gradient(45deg,#a21caf,#a21caf_15px,#86198f_15px,#86198f_30px)] animate-stripe-slide', // Listras Roxas
      };
    case 'Diamante Negro':
      return {
        from: '#3f3f46', to: '#000000',
        badge: 'bg-gradient-to-r from-zinc-700 to-black text-zinc-100 border border-zinc-500/50',
        glow: 'drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]',
        bar: 'bg-gradient-to-r from-zinc-400 to-zinc-800',
        coverClass: 'bg-[repeating-linear-gradient(45deg,#27272a,#27272a_15px,#18181b_15px,#18181b_30px)] animate-stripe-slide', // Listras Negras
      };
    case 'Diamante':
      return {
        from: '#38bdf8', to: '#0369a1',
        badge: 'bg-gradient-to-r from-sky-400 to-sky-700 text-white border-sky-300/50',
        glow: 'drop-shadow-[0_0_10px_rgba(56,189,248,0.7)]',
        bar: 'bg-gradient-to-r from-sky-300 to-sky-600',
        coverClass: 'bg-[repeating-linear-gradient(45deg,#0284c7,#0284c7_15px,#0369a1_15px,#0369a1_30px)] animate-stripe-slide', // Listras Azuis Cristal
      };
    case 'Esmeralda':
      return {
        from: '#34d399', to: '#064e3b',
        badge: 'bg-gradient-to-r from-emerald-400 to-emerald-800 text-white border-emerald-300/50',
        glow: 'drop-shadow-[0_0_10px_rgba(52,211,153,0.7)]',
        bar: 'bg-gradient-to-r from-emerald-400 to-emerald-600',
        coverClass: 'bg-[repeating-linear-gradient(45deg,#059669,#059669_15px,#047857_15px,#047857_30px)] animate-stripe-slide', // Listras Verdes (Estilo Liga Esmeralda)
      };
    case 'Platina':
      return {
        from: '#2dd4bf', to: '#0f766e',
        badge: 'bg-gradient-to-r from-teal-400 to-teal-700 text-white border-teal-300/50',
        glow: 'drop-shadow-[0_0_8px_rgba(45,212,191,0.6)]',
        bar: 'bg-gradient-to-r from-teal-300 to-teal-600',
        coverClass: 'bg-[repeating-linear-gradient(45deg,#0d9488,#0d9488_15px,#0f766e_15px,#0f766e_30px)] animate-stripe-slide', // Listras Ciano Escuro
      };
    case 'Ouro':
      return {
        from: '#facc15', to: '#a16207',
        badge: 'bg-gradient-to-r from-yellow-400 to-yellow-700 text-white border-yellow-300/50',
        glow: 'drop-shadow-[0_0_8px_rgba(250,204,21,0.7)]',
        bar: 'bg-gradient-to-r from-yellow-300 to-yellow-600',
        coverClass: 'bg-[repeating-linear-gradient(45deg,#ca8a04,#ca8a04_15px,#a16207_15px,#a16207_30px)] animate-stripe-slide', // Listras Douradas
      };
    case 'Prata':
      return {
        from: '#f4f4f5', to: '#71717a',
        badge: 'bg-gradient-to-r from-zinc-300 to-zinc-500 text-zinc-900 border-zinc-200/50',
        glow: 'drop-shadow-[0_0_6px_rgba(228,228,231,0.6)]',
        bar: 'bg-gradient-to-r from-zinc-300 to-zinc-500',
        coverClass: 'bg-[repeating-linear-gradient(45deg,#a1a1aa,#a1a1aa_15px,#71717a_15px,#71717a_30px)] animate-stripe-slide', // Listras Prateadas
      };
    case 'Bronze':
      return {
        from: '#d97706', to: '#78350f',
        badge: 'bg-gradient-to-r from-amber-500 to-amber-800 text-white border-amber-400/50',
        glow: 'drop-shadow-[0_0_6px_rgba(217,119,6,0.5)]',
        bar: 'bg-gradient-to-r from-amber-400 to-amber-700',
        coverClass: 'bg-[repeating-linear-gradient(45deg,#b45309,#b45309_15px,#92400e_15px,#92400e_30px)] animate-stripe-slide', // Listras Bronze
      };
    case 'Ferro':
    default:
      return {
        from: '#78716c', to: '#44403c',
        badge: 'bg-gradient-to-r from-stone-500 to-stone-800 text-white border-stone-400/30',
        glow: 'drop-shadow-[0_0_4px_rgba(120,113,108,0.4)]',
        bar: 'bg-gradient-to-r from-stone-400 to-stone-600',
        coverClass: 'bg-[repeating-linear-gradient(45deg,#57534e,#57534e_15px,#44403c_15px,#44403c_30px)] animate-stripe-slide', // Listras Pedra
      };
  }
};

const ProfileLevelRing = ({
  userPhotoURL,
  levelData,
  size = 60,
  strokeWidth = 3.5
}) => {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = levelData?.progressPercent || 0;
  const currentLevel = levelData?.currentLevel || 1;
  const currentXP = levelData?.currentXP || 0;
  const xpNeeded = levelData?.xpToNextLevel || 0;
  const rankName = levelData?.rankName || 'Ferro';

  const totalForLevel = currentXP + xpNeeded;
  const offset = circumference - (progress / 100) * circumference;

  const theme = getRankTheme(rankName);
  const gradientId = `levelGradient-${rankName.replace(/\s+/g, '')}`;

  return (
    <>
      <div
        className="relative flex items-center justify-center flex-shrink-0 group cursor-pointer"
        style={{ width: size, height: size }}
      >
        {/* 1. O Anel SVG */}
        <svg
          className="absolute inset-0 transform -rotate-90 w-full h-full z-20"
          viewBox={`0 0 ${size} ${size}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={theme.from} />
              <stop offset="100%" stopColor={theme.to} />
            </linearGradient>
          </defs>

          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-zinc-300 dark:text-zinc-800 transition-colors duration-300"
          />

          <motion.circle
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeLinecap="round"
            style={{ filter: theme.glow }}
          />
        </svg>

        {/* 2. Container da Foto */}
        <div
          className="rounded-full overflow-hidden border-[3px] border-white dark:border-zinc-950 shadow-sm relative z-10 flex items-center justify-center bg-zinc-200 dark:bg-zinc-800"
          style={{
              width: size - (strokeWidth * 2.5),
              height: size - (strokeWidth * 2.5)
          }}
        >
           {userPhotoURL ? (
              <img
                  src={userPhotoURL}
                  alt="Perfil"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
           ) : (
              <User size={size * 0.4} className="text-zinc-400" />
           )}
        </div>

        {/* 3. Badge de Nível */}
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 z-30 flex items-center justify-center transition-transform group-hover:-translate-y-1">
          <div className={`
            ${theme.badge}
            text-[10px] font-black
            px-2 py-0.5
            rounded-full
            shadow-lg
            border-[2px] border-white dark:border-zinc-900
            min-w-[24px] text-center leading-none
          `}>
            {currentLevel}
          </div>
        </div>

        {/* 4. Tooltip de XP */}
        <div className="
          absolute top-full right-0 mt-2
          opacity-0 group-hover:opacity-100
          transition-all duration-300 transform
          group-hover:translate-y-0 translate-y-[-5px]
          pointer-events-none z-[100] whitespace-nowrap
        ">
          <div className={`bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-bold py-1 px-2.5 rounded-lg shadow-2xl border border-zinc-700 dark:border-zinc-300 relative`}>
              <div className="absolute -top-1 right-4 w-2 h-2 bg-zinc-900 dark:bg-zinc-100 rotate-45 border-l border-t border-zinc-700 dark:border-zinc-300"></div>
              <div className="flex items-center gap-2 relative z-10">
                  <span className="opacity-70 uppercase tracking-tighter">XP:</span>
                  <span className="font-black">
                      {currentXP.toLocaleString()} / {totalForLevel.toLocaleString()}
                  </span>
              </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileLevelRing;

import { useState, useEffect } from 'react';
import { doc, updateDoc, increment, onSnapshot, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ============================================================================
// SISTEMA DE ELOS / PATENTES
// ============================================================================
export const getUserRank = (level) => {
  if (level >= 100) return { name: "Lenda", color: "text-red-500", bg: "bg-red-500" };
  if (level >= 90) return { name: "Grão-Mestre", color: "text-rose-500", bg: "bg-rose-500" };
  if (level >= 80) return { name: "Mestre", color: "text-purple-500", bg: "bg-purple-500" };
  if (level >= 70) return { name: "Diamante Negro", color: "text-zinc-800 dark:text-zinc-300", bg: "bg-zinc-800 dark:bg-zinc-300" };
  if (level >= 60) return { name: "Diamante", color: "text-cyan-400", bg: "bg-cyan-400" };
  if (level >= 50) return { name: "Esmeralda", color: "text-emerald-500", bg: "bg-emerald-500" };
  if (level >= 40) return { name: "Platina", color: "text-teal-400", bg: "bg-teal-400" };
  if (level >= 30) return { name: "Ouro", color: "text-yellow-400", bg: "bg-yellow-400" };
  if (level >= 20) return { name: "Prata", color: "text-zinc-400", bg: "bg-zinc-400" };
  if (level >= 10) return { name: "Bronze", color: "text-amber-600", bg: "bg-amber-600" };

  return { name: "Ferro", color: "text-zinc-500", bg: "bg-zinc-500" }; // Nível 1 ao 9
};

// Função auxiliar interna para disparar o evento visual
const triggerXPNotification = (amount, message, type = 'normal') => {
  const event = new CustomEvent('xp-gained', {
    detail: { amount, message, type }
  });
  window.dispatchEvent(event);
};

export const useLevelSystem = (user) => {
  const [levelData, setLevelData] = useState({
    currentLevel: 1,
    currentXP: 0,
    xpToNextLevel: 10,
    progressPercent: 0,
    totalXP: 0,
    rankName: "Ferro",
    rankColor: "text-zinc-500"
  });

  // Fator 10: O usuário chegará ao nível 50 em aprox. 2 meses estudando 3h/dia
  const DIFFICULTY_FACTOR = 10;

  const MILESTONES_XP = {
    FIRST_CYCLE: 150,
    FIRST_STUDY: 50,
    FIRST_GOAL: 50,
    FIRST_SIMULADO: 100,
  };

  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);

    const unsub = onSnapshot(userRef, (docSnap) => {
      const data = docSnap.data();
      const totalXP = data?.stats?.totalXP || 0;

      // Cálculo Quadrático do Nível
      let calculatedLevel = Math.floor(Math.sqrt(totalXP / DIFFICULTY_FACTOR)) + 1;
      if (calculatedLevel < 1) calculatedLevel = 1;

      const xpForCurrentLevel = DIFFICULTY_FACTOR * Math.pow(calculatedLevel - 1, 2);
      const xpForNextLevel = DIFFICULTY_FACTOR * Math.pow(calculatedLevel, 2);
      const levelRange = xpForNextLevel - xpForCurrentLevel;
      const xpIntoLevel = totalXP - xpForCurrentLevel;
      const progress = levelRange === 0 ? 100 : Math.min(100, Math.max(0, (xpIntoLevel / levelRange) * 100));

      // Pega as informações de Rank/Elo com base no nível atual
      const rankInfo = getUserRank(calculatedLevel);

      setLevelData({
        currentLevel: calculatedLevel,
        currentXP: Math.floor(xpIntoLevel),
        xpToNextLevel: Math.floor(levelRange - xpIntoLevel),
        progressPercent: progress,
        totalXP: totalXP,
        rankName: rankInfo.name,     // Ex: "Esmeralda"
        rankColor: rankInfo.color    // Ex: "text-emerald-500"
      });
    });

    return () => unsub();
  }, [user]);

  // --- FUNÇÃO PRINCIPAL QUE CENTRALIZA TUDO ---
  const addXP = async (amount, message = null) => {
    if (!user || amount <= 0) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'stats.totalXP': increment(amount),
        'stats.lastActivity': serverTimestamp()
      });

      // DISPARA A NOTIFICAÇÃO VISUAL AQUI
      triggerXPNotification(amount, message);

    } catch (error) {
      console.error("Erro ao adicionar XP:", error);
    }
  };

  const checkAndAwardMilestone = async (milestoneKey) => {
    if (!user || !MILESTONES_XP[milestoneKey]) return false;
    const milestoneRef = doc(db, 'users', user.uid, 'gamification', 'milestones');

    try {
      const docSnap = await getDoc(milestoneRef);
      const milestonesData = docSnap.exists() ? docSnap.data() : {};

      if (milestonesData[milestoneKey]) return false;

      await setDoc(milestoneRef, {
        [milestoneKey]: true,
        lastUpdated: new Date()
      }, { merge: true });

      const xpAmount = MILESTONES_XP[milestoneKey];

      // Salva no banco (mas não dispara o notify normal para não duplicar, faremos um especial)
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { 'stats.totalXP': increment(xpAmount) });

      // Dispara notificação especial de Milestone
      triggerXPNotification(xpAmount, getMilestoneName(milestoneKey), 'milestone');

      return true;
    } catch (error) {
      console.error("Erro milestone:", error);
      return false;
    }
  };

  const getMilestoneName = (key) => {
      const names = {
          FIRST_CYCLE: "Primeiro Ciclo Criado",
          FIRST_STUDY: "Primeiro Estudo",
          FIRST_GOAL: "Primeira Meta Definida",
          FIRST_SIMULADO: "Primeiro Simulado"
      };
      return names[key] || "Conquista Desbloqueada";
  }

  const processSimuladoResult = async (percentageCorrect) => {
      let totalEarned = 50;

      // Chamamos addXP uma vez com o total
      if (percentageCorrect >= 85) {
          totalEarned += 100;
          await addXP(totalEarned, "Simulado (Elite)");
          return { bonusAwarded: true, xp: totalEarned };
      } else {
          await addXP(totalEarned, "Simulado Concluído");
          return { bonusAwarded: false, xp: totalEarned };
      }
  };

  return { levelData, addXP, checkAndAwardMilestone, processSimuladoResult };
};