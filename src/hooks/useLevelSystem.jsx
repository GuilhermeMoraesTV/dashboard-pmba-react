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