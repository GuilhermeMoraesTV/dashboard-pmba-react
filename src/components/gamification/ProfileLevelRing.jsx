import React from 'react';
// import { motion } from 'framer-motion';
import { User } from 'lucide-react';

// ============================================================================
// CONFIGURAÇÃO VISUAL DAS DIVISÕES (COMENTADO PARA USO FUTURO)
// ============================================================================
/*
export const getRankTheme = (rankName) => {
  // Lógica das cores e fundos animados
};
*/

const ProfileLevelRing = ({
  userPhotoURL,
  // levelData,
  size = 60,
  strokeWidth = 3.5
}) => {
  // Lógica matemática do círculo comentada
  /*
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
  */

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0 group cursor-pointer"
      style={{ width: size, height: size }}
    >
      {/* 1. O Anel SVG Colorido (Desativado) */}
      {/* <svg className="absolute inset-0 transform -rotate-90 w-full h-full z-20" viewBox={`0 0 ${size} ${size}`}>
          ...
      </svg>
      */}

      {/* 2. Container da Foto (Limpo e direto) */}
      <div
        className="rounded-full overflow-hidden border-[3px] border-white dark:border-zinc-800 shadow-sm relative z-10 flex items-center justify-center bg-zinc-200 dark:bg-zinc-900 transition-transform duration-300 group-hover:scale-105"
        style={{
            width: size - (strokeWidth * 1.5),
            height: size - (strokeWidth * 1.5)
        }}
      >
         {userPhotoURL ? (
            <img
                src={userPhotoURL}
                alt="Perfil"
                className="w-full h-full object-cover"
            />
         ) : (
            <User size={size * 0.5} className="text-zinc-400" />
         )}
      </div>

      {/* 3. Badge de Nível na base da foto (Desativado) */}
      {/* <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 z-30 flex items-center justify-center transition-transform group-hover:-translate-y-1">
        <div className={`...`}>
          {currentLevel}
        </div>
      </div>
      */}

      {/* 4. Tooltip de XP no hover (Desativado) */}
      {/* <div className="absolute top-full right-0 mt-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-y-0 translate-y-[-5px] pointer-events-none z-[100] whitespace-nowrap">
        <div className={`...`}>
            ... XP Tooltip ...
        </div>
      </div>
      */}
    </div>
  );
};

export default ProfileLevelRing;