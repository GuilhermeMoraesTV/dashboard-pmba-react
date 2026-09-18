import React, { useState } from 'react';
import {
  Wrench, X, Play, RefreshCw, Clock, CheckCircle2,
  XCircle, AlertTriangle, Shield, Crown, Sparkles,
  Flame, HelpCircle, Layers, ChevronRight, Copy
} from 'lucide-react';
import { useUserAccess } from '../../hooks/useUserAccess';
import { useMonetizationConfig } from '../../hooks/useMonetizationConfig';
import { isFirebaseEmulator } from '../../firebaseConfig';
import { MONETIZATION_PHASE, PLAN_TYPES, SUBSCRIPTION_STATUS } from '../../contracts/subscription';

/**
 * Painel de Simulação e Teste Visual da Monetização ModoQAP
 *
 * REGRA ESTRITA DE SEGURANÇA:
 * - Só existe e só é renderizado em ambiente de desenvolvimento (import.meta.env.DEV === true).
 * - Todas as escritas são enviadas ao endpoint local do Vite plugin conectado ao Firestore Emulator (porta 8085).
 * - Recusa qualquer escrita se o Firebase Emulator não estiver conectado.
 */
export default function SubscriptionTestPanel(props) {
  // Proteção absoluta: Nunca renderizar em produção
  if (!import.meta.env.DEV) {
    return null;
  }

  return <SubscriptionTestPanelContent {...props} />;
}

function SubscriptionTestPanelContent({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const userAccess = useUserAccess(user);
  const monetizationConfig = useMonetizationConfig();
  const sub = userAccess?.subscription || {};

  const isEmulator = isFirebaseEmulator;

  const showToast = (type, text) => {
    setStatusMessage({ type, text, timestamp: new Date().toLocaleTimeString() });
    setTimeout(() => {
      setStatusMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const applyScenarioState = async (actionName, payload) => {
    if (!isEmulator) {
      showToast('error', 'Ação bloqueada! O painel DEV exige conexão com o Firebase Emulator (127.0.0.1:8085).');
      return;
    }

    if (!user?.uid) {
      showToast('error', 'Nenhum usuário autenticado para aplicar o cenário.');
      return;
    }

    setLoadingAction(actionName);
    try {
      const response = await fetch('/__modoqap/monetization-dev/apply-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          ...payload,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ready !== true) {
        throw new Error(data.message || 'Falha ao aplicar estado de teste no Emulator.');
      }

      showToast('success', `Cenário "${actionName}" aplicado com sucesso no Emulator!`);
    } catch (err) {
      showToast('error', err.message || 'Erro ao comunicar com o plugin do Emulator.');
    } finally {
      setLoadingAction(null);
    }
  };

  const resetSubscription = async () => {
    if (!isEmulator) {
      showToast('error', 'Ação bloqueada! O painel DEV exige o Firebase Emulator.');
      return;
    }

    if (!user?.uid) {
      showToast('error', 'Nenhum usuário autenticado.');
      return;
    }

    setLoadingAction('reset');
    try {
      const response = await fetch('/__modoqap/monetization-dev/reset-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ready !== true) {
        throw new Error(data.message || 'Falha ao resetar assinatura no Emulator.');
      }

      showToast('success', 'Assinatura resetada! Recarregando fluxo inicial...');
    } catch (err) {
      showToast('error', err.message || 'Erro ao resetar assinatura.');
    } finally {
      setLoadingAction(null);
    }
  };

  // ── 8 CENÁRIOS OFICIAIS ─────────────────────────────────────────────────────
  const scenarios = [
    {
      id: 'pre_founder',
      title: '1. PRE_FOUNDER ativo',
      desc: 'Pré-lançamento sem queimar trial (acesso total liberado).',
      badge: 'PRE_FOUNDER',
      color: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
      action: () => {
        applyScenarioState('PRE_FOUNDER ativo', {
          monetizationPhase: MONETIZATION_PHASE.PRE_FOUNDER,
          founderProgram: { isOpen: false, priceYearly: 97, openedAt: null, closedAt: null },
          subscription: {
            plan: PLAN_TYPES.FREE_TRIAL,
            status: SUBSCRIPTION_STATUS.ACTIVE,
            trialStartedAt: null,
            trialEndsAt: null,
            founder: false,
            founderSince: null,
            founderEligible: false,
            founderEligibleAt: null,
          },
        });
      },
    },
    {
      id: 'founder_open_trial_novo',
      title: '2. FOUNDER_OPEN + Trial Novo (7d)',
      desc: 'Abertura do Programa Fundador com 7 dias de trial ativo.',
      badge: 'Trial · 7 dias',
      color: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
      action: () => {
        const now = new Date();
        const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        applyScenarioState('FOUNDER_OPEN + Trial Novo', {
          monetizationPhase: MONETIZATION_PHASE.FOUNDER_OPEN,
          founderProgram: { isOpen: true, priceYearly: 97, openedAt: now.toISOString(), closedAt: null },
          subscription: {
            plan: PLAN_TYPES.FREE_TRIAL,
            status: SUBSCRIPTION_STATUS.ACTIVE,
            trialStartedAt: now.toISOString(),
            trialEndsAt: endsAt.toISOString(),
            founder: false,
            founderSince: null,
            founderEligible: false, // Conforme instrução: não forçar elegibilidade histórica
            founderEligibleAt: null,
          },
        });
      },
    },
    {
      id: 'trial_3_dias',
      title: '3. Trial com 3 dias restantes',
      desc: 'Trial ativo no 4º dia (3 dias de contagem regressiva).',
      badge: 'Trial · 3 dias',
      color: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
      action: () => {
        const now = new Date();
        const startedAt = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
        const endsAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        applyScenarioState('Trial 3 dias', {
          monetizationPhase: MONETIZATION_PHASE.FOUNDER_OPEN,
          founderProgram: { isOpen: true, priceYearly: 97 },
          subscription: {
            plan: PLAN_TYPES.FREE_TRIAL,
            status: SUBSCRIPTION_STATUS.ACTIVE,
            trialStartedAt: startedAt.toISOString(),
            trialEndsAt: endsAt.toISOString(),
            founder: false,
            founderSince: null,
          },
        });
      },
    },
    {
      id: 'trial_menos_24h',
      title: '4. Trial com menos de 24h',
      desc: 'Últimas 12 horas de teste (Badge "Trial expira hoje").',
      badge: 'Expira hoje',
      color: 'border-red-500/30 bg-red-500/10 text-red-400',
      action: () => {
        const now = new Date();
        const startedAt = new Date(now.getTime() - 6.5 * 24 * 60 * 60 * 1000);
        const endsAt = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12h restantes
        applyScenarioState('Trial < 24h', {
          monetizationPhase: MONETIZATION_PHASE.FOUNDER_OPEN,
          founderProgram: { isOpen: true, priceYearly: 97 },
          subscription: {
            plan: PLAN_TYPES.FREE_TRIAL,
            status: SUBSCRIPTION_STATUS.ACTIVE,
            trialStartedAt: startedAt.toISOString(),
            trialEndsAt: endsAt.toISOString(),
            founder: false,
            founderSince: null,
          },
        });
      },
    },
    {
      id: 'trial_expirado',
      title: '5. Trial expirado',
      desc: 'Prazo esgotado (Acesso retido na SubscriptionLockView).',
      badge: 'Bloqueado',
      color: 'border-red-600/40 bg-red-950/60 text-red-300',
      action: () => {
        const now = new Date();
        const startedAt = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
        const endsAt = new Date(now.getTime() - 60 * 1000); // 1 minuto atrás
        applyScenarioState('Trial expirado', {
          monetizationPhase: MONETIZATION_PHASE.FOUNDER_OPEN,
          founderProgram: { isOpen: true, priceYearly: 97 },
          subscription: {
            plan: PLAN_TYPES.FREE_TRIAL,
            status: SUBSCRIPTION_STATUS.EXPIRED,
            trialStartedAt: startedAt.toISOString(),
            trialEndsAt: endsAt.toISOString(),
            founder: false,
            founderSince: null,
          },
        });
      },
    },
    {
      id: 'founder_ativo',
      title: '6. Founder ativo',
      desc: 'Plano Fundador ativo com FounderBadge e acesso liberado.',
      badge: '👑 Fundador',
      color: 'border-amber-400/40 bg-amber-500/15 text-amber-300',
      action: () => {
        const now = new Date();
        const founderSince = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
        applyScenarioState('Founder ativo', {
          monetizationPhase: MONETIZATION_PHASE.FOUNDER_OPEN,
          founderProgram: { isOpen: true, priceYearly: 97 },
          subscription: {
            plan: PLAN_TYPES.FOUNDER,
            status: SUBSCRIPTION_STATUS.ACTIVE,
            trialStartedAt: null,
            trialEndsAt: null,
            founder: true,
            founderSince: founderSince.toISOString(),
            founderEligible: true,
          },
        });
      },
    },
    {
      id: 'founder_expirado',
      title: '7. Founder expirado',
      desc: 'Mantém FounderBadge no perfil, mas bloqueia acesso no LockView.',
      badge: '👑 Expirado',
      color: 'border-amber-700/40 bg-zinc-900 text-amber-500',
      action: () => {
        const now = new Date();
        const founderSince = new Date(now.getTime() - 370 * 24 * 60 * 60 * 1000);
        applyScenarioState('Founder expirado', {
          monetizationPhase: MONETIZATION_PHASE.FOUNDER_OPEN,
          founderProgram: { isOpen: true, priceYearly: 97 },
          subscription: {
            plan: PLAN_TYPES.FOUNDER,
            status: SUBSCRIPTION_STATUS.EXPIRED,
            trialStartedAt: null,
            trialEndsAt: null,
            founder: true,
            founderSince: founderSince.toISOString(),
            founderEligible: true,
          },
        });
      },
    },
    {
      id: 'premium_ativo',
      title: '8. Premium ativo',
      desc: 'Fase Regular com plano Premium anual ativo.',
      badge: '✨ Premium',
      color: 'border-indigo-500/40 bg-indigo-950/50 text-indigo-300',
      action: () => {
        applyScenarioState('Premium ativo', {
          monetizationPhase: MONETIZATION_PHASE.REGULAR,
          founderProgram: { isOpen: false, priceYearly: 97 },
          subscription: {
            plan: PLAN_TYPES.PREMIUM,
            status: SUBSCRIPTION_STATUS.ACTIVE,
            trialStartedAt: null,
            trialEndsAt: null,
            founder: false,
            founderSince: null,
            founderEligible: false,
          },
        });
      },
    },
  ];

  // ── ATALHOS DE TEMPO ────────────────────────────────────────────────────────
  const applyTimeShortcut = (offsetMs, label) => {
    const now = new Date();
    const endsAt = new Date(now.getTime() + offsetMs);
    applyScenarioState(`Atalho: ${label}`, {
      subscription: {
        plan: PLAN_TYPES.FREE_TRIAL,
        status: offsetMs > 0 ? SUBSCRIPTION_STATUS.ACTIVE : SUBSCRIPTION_STATUS.EXPIRED,
        trialStartedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        trialEndsAt: endsAt.toISOString(),
        founder: false,
      },
    });
  };

  // ── ATALHOS DE FASE GLOBAL ──────────────────────────────────────────────────
  const applyPhaseShortcut = (phase) => {
    applyScenarioState(`Fase ${phase}`, {
      monetizationPhase: phase,
      founderProgram: {
        isOpen: phase === MONETIZATION_PHASE.FOUNDER_OPEN,
        priceYearly: 97,
      },
    });
  };

  const copyUid = () => {
    if (user?.uid) {
      navigator.clipboard?.writeText(user.uid);
      showToast('success', 'UID copiado para a área de transferência!');
    }
  };

  const formatDate = (val) => {
    if (!val) return 'null';
    try {
      const d = val instanceof Date ? val : (typeof val.toDate === 'function' ? val.toDate() : new Date(val));
      return Number.isNaN(d.getTime()) ? 'inválido' : d.toLocaleString('pt-BR');
    } catch {
      return 'erro';
    }
  };

  return (
    <>
      {/* Botão de alternância flutuante no canto inferior esquerdo */}
      <aside
        aria-label="Controle de Simulação DEV"
        className="fixed bottom-3 left-3 z-[9999] select-none"
      >
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-2xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 ${
            isOpen
              ? 'bg-zinc-800 ring-2 ring-amber-400'
              : sub.hasAccess
              ? 'bg-zinc-900/95 border border-zinc-700 hover:border-amber-400/80 shadow-black/40'
              : 'bg-red-900/95 border border-red-500 hover:border-red-400 shadow-red-950/60 animate-bounce'
          }`}
          title="Abrir Painel de Teste da Monetização (ModoQAP DEV)"
        >
          <Wrench size={13} className="text-amber-400 animate-spin-slow" />
          <span>DEV Monetização</span>
          <span
            className={`h-2 w-2 rounded-full ${
              sub.hasAccess ? 'bg-emerald-400' : 'bg-red-500 animate-ping'
            }`}
          />
        </button>
      </aside>

      {/* Modal / Painel Drawer Flutuante */}
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-start p-2 sm:p-6 pointer-events-none select-none">
          <div className="pointer-events-auto flex flex-col w-full max-w-xl max-h-[90vh] overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950/95 text-zinc-100 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 animate-fade-in">
            
            {/* Cabeçalho do Painel */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3 bg-zinc-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <Wrench size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wide text-white">
                    Simulador de Monetização
                  </h2>
                  <p className="text-[10px] text-zinc-400 font-medium">
                    Testes visuais e server-side no Firebase Emulator
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                    isEmulator
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-red-500/20 text-red-300 border border-red-500/40'
                  }`}
                >
                  {isEmulator ? 'Emulator (8085)' : 'Firebase REAL'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Toast / Status Message */}
            {statusMessage && (
              <div
                className={`px-4 py-2 text-xs font-bold flex items-center justify-between transition-all ${
                  statusMessage.type === 'error'
                    ? 'bg-red-950/90 text-red-200 border-b border-red-800'
                    : 'bg-emerald-950/90 text-emerald-200 border-b border-emerald-800'
                }`}
              >
                <span>{statusMessage.text}</span>
                <span className="text-[10px] opacity-70">{statusMessage.timestamp}</span>
              </div>
            )}

            {/* Aviso se não estiver no Emulator */}
            {!isEmulator && (
              <div className="px-4 py-2.5 bg-red-900/30 border-b border-red-800/50 flex items-start gap-2 text-red-300 text-xs">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-red-400" />
                <p>
                  <strong>Atenção:</strong> O app está conectado ao Firebase REAL. As ações de escrita estão travadas por segurança. Mude para o <strong>Emulator</strong> pelo badge no canto inferior direito.
                </p>
              </div>
            )}

            {/* Conteúdo Rolável */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">

              {/* SEÇÃO 1: Telemetria Técnica em Tempo Real */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-zinc-400">
                  <span>Dados Técnicos em DEV (Tempo Real)</span>
                  <button
                    type="button"
                    onClick={copyUid}
                    className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white bg-zinc-800/80 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    title="Copiar UID do usuário atual"
                  >
                    <Copy size={11} />
                    <span className="max-w-[120px] truncate">{user?.uid || 'Sem UID'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/60">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold block">monetizationPhase</span>
                    <span className="font-mono font-bold text-amber-300">
                      {monetizationConfig?.monetizationPhase || 'PRE_FOUNDER'}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/60">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold block">plan</span>
                    <span className="font-mono font-bold text-white">
                      {sub.plan || 'FREE_TRIAL'}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/60">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold block">status</span>
                    <span className={`font-mono font-bold ${sub.status === 'ACTIVE' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {sub.status || 'ACTIVE'}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/60">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold block">hasAccess</span>
                    <span className={`font-mono font-black ${sub.hasAccess ? 'text-emerald-400' : 'text-red-400'}`}>
                      {sub.hasAccess ? 'SIM (true)' : 'NÃO (false)'}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/60">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold block">trialDaysRemaining</span>
                    <span className="font-mono font-bold text-zinc-200">
                      {sub.trialDaysRemaining ?? 'null'}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/60">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold block">trialHoursRemaining</span>
                    <span className="font-mono font-bold text-zinc-200">
                      {sub.trialHoursRemaining ?? 'null'}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/60">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold block">founder</span>
                    <span className={`font-mono font-bold ${sub.isFounder ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {sub.isFounder ? 'true (Fundador)' : 'false'}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/60">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold block">founderEligible</span>
                    <span className={`font-mono font-bold ${sub.founderEligible ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {sub.founderEligible ? 'true' : 'false'}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/60">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold block">isTrialActive</span>
                    <span className={`font-mono font-bold ${sub.isTrialActive ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      {sub.isTrialActive ? 'true' : 'false'}
                    </span>
                  </div>
                </div>

                {/* Datas detalhadas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-zinc-400 pt-1">
                  <div className="truncate">
                    <strong className="text-zinc-500">trialStartedAt:</strong> {formatDate(sub.trialStartedAt || userAccess?.userDoc?.subscription?.trialStartedAt)}
                  </div>
                  <div className="truncate">
                    <strong className="text-zinc-500">trialEndsAt:</strong> {formatDate(sub.trialEndsAt || userAccess?.userDoc?.subscription?.trialEndsAt)}
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: 8 Cenários Oficiais */}
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 block">
                  Cenários de Teste (1 Clique)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {scenarios.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      disabled={!isEmulator || Boolean(loadingAction)}
                      onClick={sc.action}
                      className="group flex flex-col justify-between p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/70 hover:bg-zinc-800/80 hover:border-zinc-700 text-left transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-bold text-white text-xs group-hover:text-amber-300 transition-colors">
                          {sc.title}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${sc.color}`}>
                          {sc.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-tight">
                        {sc.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* SEÇÃO 3: Atalhos Rápidos de Tempo (trialEndsAt) */}
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>Atalhos Rápidos de Tempo (trialEndsAt)</span>
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    disabled={!isEmulator || Boolean(loadingAction)}
                    onClick={() => applyTimeShortcut(7 * 24 * 60 * 60 * 1000, '+7 dias')}
                    className="p-2 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-center font-bold text-xs text-zinc-200 hover:text-white cursor-pointer disabled:opacity-50"
                  >
                    now + 7 dias
                  </button>
                  <button
                    type="button"
                    disabled={!isEmulator || Boolean(loadingAction)}
                    onClick={() => applyTimeShortcut(3 * 24 * 60 * 60 * 1000, '+3 dias')}
                    className="p-2 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-center font-bold text-xs text-zinc-200 hover:text-white cursor-pointer disabled:opacity-50"
                  >
                    now + 3 dias
                  </button>
                  <button
                    type="button"
                    disabled={!isEmulator || Boolean(loadingAction)}
                    onClick={() => applyTimeShortcut(12 * 60 * 60 * 1000, '+12 horas')}
                    className="p-2 rounded-lg border border-red-900/40 bg-red-950/30 hover:bg-red-900/40 text-center font-bold text-xs text-red-300 hover:text-white cursor-pointer disabled:opacity-50"
                  >
                    now + 12 horas
                  </button>
                  <button
                    type="button"
                    disabled={!isEmulator || Boolean(loadingAction)}
                    onClick={() => applyTimeShortcut(-60 * 1000, '-1 minuto')}
                    className="p-2 rounded-lg border border-red-800/60 bg-red-950/60 hover:bg-red-900/60 text-center font-bold text-xs text-red-200 hover:text-white cursor-pointer disabled:opacity-50"
                  >
                    now - 1 minuto
                  </button>
                </div>
              </div>

              {/* SEÇÃO 4: Alternador Rápido de Fase Global */}
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Layers size={12} />
                  <span>Fase Global (system_config/monetization)</span>
                </span>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    disabled={!isEmulator || Boolean(loadingAction)}
                    onClick={() => applyPhaseShortcut(MONETIZATION_PHASE.PRE_FOUNDER)}
                    className={`p-2 rounded-lg border text-center font-black text-[10px] uppercase tracking-wider cursor-pointer disabled:opacity-50 ${
                      monetizationConfig?.monetizationPhase === MONETIZATION_PHASE.PRE_FOUNDER
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    PRE_FOUNDER
                  </button>
                  <button
                    type="button"
                    disabled={!isEmulator || Boolean(loadingAction)}
                    onClick={() => applyPhaseShortcut(MONETIZATION_PHASE.FOUNDER_OPEN)}
                    className={`p-2 rounded-lg border text-center font-black text-[10px] uppercase tracking-wider cursor-pointer disabled:opacity-50 ${
                      monetizationConfig?.monetizationPhase === MONETIZATION_PHASE.FOUNDER_OPEN
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    FOUNDER_OPEN
                  </button>
                  <button
                    type="button"
                    disabled={!isEmulator || Boolean(loadingAction)}
                    onClick={() => applyPhaseShortcut(MONETIZATION_PHASE.REGULAR)}
                    className={`p-2 rounded-lg border text-center font-black text-[10px] uppercase tracking-wider cursor-pointer disabled:opacity-50 ${
                      monetizationConfig?.monetizationPhase === MONETIZATION_PHASE.REGULAR
                        ? 'border-indigo-400 bg-indigo-500/20 text-indigo-300'
                        : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    REGULAR
                  </button>
                </div>
              </div>

              {/* SEÇÃO 5: Reset Total */}
              <div className="pt-2 border-t border-zinc-800 flex justify-between items-center">
                <span className="text-[10px] text-zinc-500">
                  Remove o nó `subscription` para testar fluxo de onboarding
                </span>
                <button
                  type="button"
                  disabled={!isEmulator || Boolean(loadingAction)}
                  onClick={resetSubscription}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={12} className={loadingAction === 'reset' ? 'animate-spin' : ''} />
                  <span>Resetar Assinatura</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
