import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseEmulator } from '../../firebaseConfig';
import { deriveUserAccess, LEGACY_ADMIN_UID } from '../../auth/accessControl.js';
import {
  ensureFirebaseEmulators,
  isLocalDevelopment,
  mirrorFirebaseUserToEmulator,
  writePendingEmulatorLogin,
  writeFirebaseModePreference,
} from '../../utils/firebaseEnvironment.js';

export default function EnvironmentBadge() {
  const isEmulator = isFirebaseEmulator;
  const [switchState, setSwitchState] = useState(isEmulator ? 'checking' : 'idle');
  const [message, setMessage] = useState('');
  const isLocal = typeof window !== 'undefined'
    && isLocalDevelopment(import.meta.env, window.location);

  useEffect(() => {
    if (!isLocal || !isEmulator) return undefined;
    let active = true;
    ensureFirebaseEmulators()
      .then(() => { if (active) setSwitchState('idle'); })
      .catch((error) => {
        if (!active) return;
        setMessage(error.message);
        setSwitchState('error');
      });
    return () => { active = false; };
  }, [isEmulator, isLocal]);

  if (!isLocal) return null;

  const switchEnvironment = async () => {
    if (switchState === 'starting') return;
    if (isEmulator) {
      const confirmed = window.confirm('Voltar ao Firebase REAL? Ações poderão alterar dados de produção e gerar custos.');
      if (!confirmed) return;
      writeFirebaseModePreference(window.localStorage, 'real');
      window.location.reload();
      return;
    }
    setMessage('');
    setSwitchState('starting');
    try {
      await ensureFirebaseEmulators();
      const currentUser = auth.currentUser;
      if (currentUser?.uid && currentUser.email) {
        const profileSnapshot = currentUser.uid === LEGACY_ADMIN_UID
          ? null
          : await getDoc(doc(db, 'users', currentUser.uid));
        const profile = profileSnapshot?.exists() ? profileSnapshot.data() : {};
        const access = deriveUserAccess({ authUser: currentUser, userDoc: profile });
        const mirrored = await mirrorFirebaseUserToEmulator({
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName || profile.name || '',
          photoURL: currentUser.photoURL || profile.photoURL || '',
          access: access.accessProfile,
          isAdmin: access.isAdmin,
        });
        writePendingEmulatorLogin(window.sessionStorage, mirrored);
      }
      writeFirebaseModePreference(window.localStorage, 'emulator');
      window.location.reload();
    } catch (error) {
      setMessage(error.message);
      setSwitchState('error');
    }
  };

  const label = switchState === 'starting' || switchState === 'checking'
    ? 'Iniciando EMULATOR...'
    : isEmulator ? 'Firebase EMULATOR' : 'Firebase REAL';

  return (
    <aside
      aria-label='Ambiente Firebase Ativo'
      className='fixed bottom-3 right-3 z-[9999] flex max-w-[min(24rem,calc(100vw-1.5rem))] flex-col items-end gap-1 select-none'
    >
      {message ? (
        <span role='alert' className='rounded-lg bg-red-950/95 px-3 py-2 text-[10px] font-semibold normal-case text-white shadow-lg'>
          {message}
        </span>
      ) : null}
      <button
        type='button'
        onClick={switchEnvironment}
        disabled={switchState === 'starting' || switchState === 'checking'}
        aria-label={`${label}. Clique para alternar o ambiente Firebase.`}
        title={isEmulator ? 'Clique para voltar ao Firebase real' : 'Clique para iniciar e usar os emuladores locais sem custos de produção'}
        className='flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-lg backdrop-blur-md transition-all hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-white disabled:cursor-wait disabled:opacity-80'
        style={{
          backgroundColor: switchState === 'error' ? 'rgba(185, 28, 28, 0.97)'
            : isEmulator ? 'rgba(217, 119, 6, 0.95)' : 'rgba(16, 185, 129, 0.95)',
          boxShadow: isEmulator
            ? '0 4px 14px 0 rgba(217, 119, 6, 0.39)'
            : '0 4px 14px 0 rgba(16, 185, 129, 0.39)',
        }}
      >
        <span className='inline-block h-2 w-2 rounded-full bg-white animate-pulse' />
        <span>{label}</span>
      </button>
    </aside>
  );
}
