import React from 'react';
import { User } from 'lucide-react';

const ProfileLevelRing = ({ userPhotoURL, levelData, size = 60, strokeWidth = 3.5 }) => {
  const progress = Math.max(0, Math.min(100, Number(levelData?.progressPercent || 0)));
  const level = Math.max(1, Number(levelData?.currentLevel || 1));
  const ringColor = levelData?.levelRing || '#dc2626';
  return (
    <div
      className="group relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      title={`Nível ${level} · ${levelData?.xpToNextLevel || 0} XP para o próximo`}
    >
      <div
        className="absolute inset-0 rounded-full shadow-sm"
        style={{ background: `conic-gradient(${ringColor} ${progress * 3.6}deg, rgba(113,113,122,.22) 0deg)` }}
      />
      <div className="absolute rounded-full bg-white dark:bg-zinc-900" style={{ inset: strokeWidth }} />
      <div
        className="relative z-10 flex items-center justify-center overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        style={{ width: size - strokeWidth * 3, height: size - strokeWidth * 3 }}
      >
        {userPhotoURL
          ? <img src={userPhotoURL} alt="Perfil" className="h-full w-full object-cover"/>
          : <User size={size * 0.42} className="text-zinc-400"/>}
      </div>
      <span className="absolute -bottom-1 z-20 min-w-5 rounded-full border-2 border-white bg-red-600 px-1 text-center text-[8px] font-black leading-4 text-white shadow-md dark:border-zinc-900">
        {level}
      </span>
    </div>
  );
};

export default ProfileLevelRing;
