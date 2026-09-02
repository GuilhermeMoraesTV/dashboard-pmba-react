import React from 'react';
import { isFirebaseEmulator } from '../../firebaseConfig';

export default function EnvironmentBadge() {
  if (!import.meta.env.DEV) return null;
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return null;
  }

  const isEmulator = isFirebaseEmulator;

  return (
    <aside
      aria-label='Ambiente Firebase Ativo'
      className='fixed bottom-3 right-3 z-[9999] pointer-events-none select-none flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider shadow-lg backdrop-blur-md transition-all'
      style={{
        backgroundColor: isEmulator ? 'rgba(217, 119, 6, 0.95)' : 'rgba(16, 185, 129, 0.95)',
        color: '#ffffff',
        boxShadow: isEmulator
          ? '0 4px 14px 0 rgba(217, 119, 6, 0.39)'
          : '0 4px 14px 0 rgba(16, 185, 129, 0.39)',
      }}
    >
      <span className='inline-block h-2 w-2 rounded-full bg-white animate-pulse' />
      <span>{isEmulator ? 'Firebase EMULATOR' : 'Firebase REAL'}</span>
    </aside>
  );
}
