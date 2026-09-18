import React from 'react';
import { Clock, Sparkles, Code } from 'lucide-react';
import FounderBadge from '../shared/FounderBadge';

/**
 * Componente unificado de status de assinatura / trial no Header e perfil.
 * 
 * Regras visuais:
 * - PRE_FOUNDER: Não exibe badge para usuário comum em produção; em DEV exibe 'PRE_FOUNDER'.
 * - FREE_TRIAL ativo (> 24h): 'Trial · X dias restantes' (ou 1 dia restante).
 * - FREE_TRIAL ativo (<= 24h): 'Trial expira hoje' (com destaque de urgência).
 * - FREE_TRIAL expirado: null (pois o usuário visualiza a SubscriptionLockView).
 * - Founder ativo / expirado: Renderiza o FounderBadge oficial (honra permanente).
 * - Premium ativo: Renderiza badge 'Premium'.
 * 
 * @param {Object} props
 * @param {import('../../contracts/subscription').UserEntitlements|null} props.subscription
 * @param {Object|null} [props.monetizationConfig]
 * @param {'lg'|'md'|'sm'|'compact'} [props.size='sm']
 * @param {string} [props.className='']
 * @param {Function|null} [props.onClick=null]
 */
export default function TrialStatusBadge({
  subscription = null,
  monetizationConfig = null,
  size = 'sm',
  className = '',
  onClick = null,
}) {
  if (!subscription) return null;

  // 1. Membro Fundador (Ativo ou Expirado - Identidade permanente)
  if (subscription.isFounder) {
    return (
      <FounderBadge
        founder={true}
        size={size}
        className={className}
      />
    );
  }

  // 2. Assinatura Premium Ativa
  if (subscription.plan === 'PREMIUM' && subscription.hasAccess) {
    const isSmall = size === 'sm' || size === 'compact';
    return (
      <span
        role="status"
        aria-label="Assinatura Premium Ativa"
        title="Plano Premium Ativo"
        onClick={onClick}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-black uppercase tracking-wider select-none transition-all border-indigo-500/30 bg-gradient-to-r from-indigo-500/15 via-purple-500/20 to-indigo-500/15 text-indigo-700 dark:border-indigo-400/40 dark:from-indigo-950/60 dark:via-purple-900/35 dark:to-indigo-950/50 dark:text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.18)] ${
          isSmall ? 'text-[8px] sm:text-[9px] px-1.5 py-0.5' : 'text-[10px] sm:text-xs px-2.5 py-1'
        } ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''} ${className}`}
      >
        <Sparkles size={isSmall ? 10 : 12} className="text-indigo-500 dark:text-indigo-300 shrink-0" />
        <span>Premium</span>
      </span>
    );
  }

  const phase = monetizationConfig?.monetizationPhase || 'PRE_FOUNDER';
  const isPreFounder = phase === 'PRE_FOUNDER' || (subscription.isTrialActive && subscription.trialDaysRemaining === null);

  // 3. Fase PRE_FOUNDER
  if (isPreFounder) {
    // Em DEV, exibe tag de conferência técnica; em PROD, não exibe nada para usuário comum
    if (import.meta.env.DEV) {
      const isSmall = size === 'sm' || size === 'compact';
      return (
        <span
          role="status"
          aria-label="Ambiente de Pré-Lançamento (DEV)"
          title="Fase PRE_FOUNDER (Visível apenas em DEV)"
          onClick={onClick}
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-black uppercase tracking-wider select-none border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-400 ${
            isSmall ? 'text-[8px] leading-tight' : 'text-[9px]'
          } ${onClick ? 'cursor-pointer' : ''} ${className}`}
        >
          <Code size={isSmall ? 9 : 11} className="text-zinc-500 dark:text-zinc-400 shrink-0" />
          <span>PRE_FOUNDER</span>
        </span>
      );
    }
    return null;
  }

  // 4. Trial Ativo
  if (subscription.isTrialActive && subscription.trialDaysRemaining !== null) {
    const days = subscription.trialDaysRemaining;
    const hours = subscription.trialHoursRemaining ?? (days * 24);
    const isExpiringToday = hours <= 24 || days === 0;
    const isSmall = size === 'sm' || size === 'compact';

    if (isExpiringToday) {
      return (
        <div
          role="status"
          aria-label="Período de teste expira hoje"
          title="Seu período de teste encerra hoje"
          onClick={onClick}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-black uppercase tracking-wider select-none transition-colors border-red-500/40 bg-red-500/15 text-red-600 dark:border-red-500/50 dark:bg-red-950/50 dark:text-red-400 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.2)] ${
            isSmall ? 'text-[8px] sm:text-[9px]' : 'text-[10px]'
          } ${onClick ? 'cursor-pointer hover:border-red-500' : ''} ${className}`}
        >
          <Clock size={isSmall ? 10 : 12} className="shrink-0 text-red-600 dark:text-red-400" />
          <span>Trial expira hoje</span>
        </div>
      );
    }

    const label = `Trial · ${days} ${days === 1 ? 'dia restante' : 'dias restantes'}`;
    const isUrgent = days <= 2;

    return (
      <div
        role="status"
        aria-label={label}
        title={label}
        onClick={onClick}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-black uppercase tracking-wider select-none transition-colors ${
          isUrgent
            ? 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-300'
            : 'border-zinc-200 bg-zinc-100/90 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300'
        } ${isSmall ? 'text-[8px] sm:text-[9px]' : 'text-[10px]'} ${
          onClick ? 'cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600' : ''
        } ${className}`}
      >
        <Clock size={isSmall ? 10 : 12} className={`shrink-0 ${isUrgent ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-400'}`} />
        <span>{label}</span>
      </div>
    );
  }

  // 5. Trial Expirado ou sem acesso ativo: não polui o header pois o usuário estará na SubscriptionLockView
  return null;
}
