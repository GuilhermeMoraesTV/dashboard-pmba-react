import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { MONETIZATION_PHASE } from '../contracts/subscription';
import { isUnconfirmedEmptySnapshot } from '../utils/firestoreSnapshotState';

const DEFAULT_MONETIZATION_CONFIG = {
  monetizationPhase: MONETIZATION_PHASE.PRE_FOUNDER,
  founderProgram: {
    isOpen: false,
    priceYearly: 97,
    openedAt: null,
    closedAt: null,
  },
  trialConfig: {
    durationDays: 7,
  },
  isLoading: true,
};

const MONETIZATION_CONFIG_TIMEOUT_MS = 4000;

/**
 * Hook para obter a configuração global e a fase de monetização em tempo real
 */
export function useMonetizationConfig() {
  const [config, setConfig] = useState(DEFAULT_MONETIZATION_CONFIG);

  useEffect(() => {
    const docRef = doc(db, 'system_config', 'monetization');
    let settled = false;
    const settle = (nextConfig) => {
      settled = true;
      window.clearTimeout(timeoutId);
      setConfig(nextConfig);
    };
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      // As Rules ainda operam em PRE_FOUNDER. Se a leitura remota ficar presa
      // em cache vazio, não há motivo para bloquear toda a aplicação.
      settle({ ...DEFAULT_MONETIZATION_CONFIG, isLoading: false });
    }, MONETIZATION_CONFIG_TIMEOUT_MS);

    const unsub = onSnapshot(docRef, (snap) => {
      if (isUnconfirmedEmptySnapshot(snap)) return;
      if (snap.exists()) {
        const data = snap.data() || {};
        settle({
          monetizationPhase: data.monetizationPhase || MONETIZATION_PHASE.PRE_FOUNDER,
          founderProgram: {
            isOpen: Boolean(data.founderProgram?.isOpen),
            priceYearly: Number(data.founderProgram?.priceYearly) || 97,
            openedAt: data.founderProgram?.openedAt || null,
            closedAt: data.founderProgram?.closedAt || null,
          },
          trialConfig: {
            durationDays: Number(data.trialConfig?.durationDays) || 7,
          },
          isLoading: false,
        });
      } else {
        settle({
          ...DEFAULT_MONETIZATION_CONFIG,
          isLoading: false,
        });
      }
    }, () => {
      settle({ ...DEFAULT_MONETIZATION_CONFIG, isLoading: false });
    });

    return () => {
      settled = true;
      window.clearTimeout(timeoutId);
      unsub();
    };
  }, []);

  return config;
}
