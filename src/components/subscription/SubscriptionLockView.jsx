import React from 'react';
import { Crown, Sparkles, CheckCircle2, Flame, LogOut, HelpCircle, Shield, ArrowRight } from 'lucide-react';
import { motion as Motion } from 'framer-motion';

/**
 * Tela centralizada de bloqueio e apresentação de planos (Paywall)
 * Renderizada quando o trial expira ou a assinatura não está ativa.
 */
export default function SubscriptionLockView({
  user = null,
  subscription = null,
  monetizationConfig = null,
  onOpenSupport = null,
  onLogout = null,
}) {
  const isFounder = Boolean(subscription?.isFounder);
  const isFounderEligible = Boolean(subscription?.founderEligible);
  const phase = monetizationConfig?.monetizationPhase || 'PRE_FOUNDER';
  const isFounderOpen = phase === 'FOUNDER_OPEN' || Boolean(monetizationConfig?.founderProgram?.isOpen);

  // O card Fundador aparece apenas se o programa estiver aberto OU se o usuário já for um Fundador renovando seu plano
  const showFounderCard = isFounderOpen || isFounder;

  if (subscription?.isPendingInitialization) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="animate-spin h-8 w-8 border-4 border-red-500 border-t-transparent rounded-full" />
        <p className="text-xs text-zinc-400 font-medium">Preparando seu acesso...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6 lg:p-8 select-none">
      <div className="w-full max-w-4xl">

        {/* Cabeçalho Principal do Bloqueio */}
        <div className="text-center mb-8 sm:mb-10">
          <Motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 mb-4 shadow-lg shadow-red-500/10"
          >
            <Flame size={32} />
          </Motion.div>

          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
            {isFounder ? 'Renove seu Acesso ao ModoQAP' : 'Seu Período de Teste Terminou'}
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
            {isFounder
              ? 'Sua assinatura expirou, mas sua identidade de Fundador permanece intacta. Renove para continuar seus estudos.'
              : 'Para continuar acelerando sua aprovação com os Ciclos, Cronogramas, Flashcards e Questões, garanta seu plano.'}
          </p>
        </div>

        {/* Grid de Planos */}
        <div className={`grid grid-cols-1 ${showFounderCard ? 'md:grid-cols-2' : 'max-w-md'} gap-6 max-w-3xl mx-auto`}>

          {/* Card 1: Programa Fundador (Disponível durante FOUNDER_OPEN ou para renovação de Fundador) */}
          {showFounderCard && (
            <div className="relative rounded-2xl border bg-gradient-to-b from-amber-500/10 via-zinc-900 to-zinc-950 border-amber-500/40 p-6 sm:p-7 flex flex-col justify-between shadow-2xl shadow-amber-500/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[10px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full shadow-md flex items-center gap-1.5 whitespace-nowrap">
                <Crown size={12} /> {isFounder ? 'Renovação Fundador' : (isFounderEligible ? 'Pioneiro Elegível' : 'Programa Fundador')}
              </div>

              <div>
                <div className="flex justify-between items-start mb-4 mt-1">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Acesso Vitalício ao Preço</span>
                    <h3 className="text-xl font-black text-white">Plano Fundador</h3>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400">
                    <Crown size={22} />
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-black text-white">R$ 97</span>
                    <span className="text-xs text-zinc-400 font-bold">/ano</span>
                  </div>
                  <p className="text-xs text-amber-400/90 font-medium mt-1">
                    Apenas R$ 8,08 por mês no plano anual
                  </p>
                </div>

                <ul className="space-y-3 text-xs text-zinc-300 mb-8">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 size={15} className="text-amber-400 shrink-0" />
                    <span>Acesso irrestrito a todos os recursos da plataforma</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 size={15} className="text-amber-400 shrink-0" />
                    <span>Tag 🏆 <strong>FUNDADOR</strong> permanente no perfil</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 size={15} className="text-amber-400 shrink-0" />
                    <span>Renovação garantida por R$ 97/ano para sempre</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 size={15} className="text-amber-400 shrink-0" />
                    <span>Prioridade nos novos lançamentos e simulados</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:brightness-110 shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{isFounder ? 'Renovar Plano Fundador' : 'Quero ser Fundador'}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}

          {/* Card 2: Plano Padrão / Lançamento */}
          <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 sm:p-7 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    {!isFounderOpen && !isFounder ? 'Plano Disponível' : 'Futuro Lançamento'}
                  </span>
                  <h3 className="text-xl font-black text-white">Plano Anual Pro</h3>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-800 text-zinc-300">
                  <Sparkles size={22} />
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-black text-white">R$ 149</span>
                  <span className="text-xs text-zinc-400 font-bold">/ano</span>
                </div>
                <p className="text-xs text-zinc-400 font-medium mt-1">
                  {!isFounderOpen && !isFounder ? 'Plano Anual Oficial' : 'Preço padrão de lançamento futuro'}
                </p>
              </div>

              <ul className="space-y-3 text-xs text-zinc-300 mb-8">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={15} className="text-zinc-400 shrink-0" />
                  <span>Acesso completo a Ciclos e Cronogramas</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={15} className="text-zinc-400 shrink-0" />
                  <span>Flashcards e Repetição Espaçada (SRS)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={15} className="text-zinc-400 shrink-0" />
                  <span>Banco de Questões e Caderno de Erros</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={15} className="text-zinc-400 shrink-0" />
                  <span>Simulados com temporizador oficial</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-white transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <span>Ver Detalhes do Plano</span>
            </button>
          </div>

        </div>

        {/* Rodapé de Ações Liberadas (Suporte + Logout) */}
        <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <button
            type="button"
            onClick={onOpenSupport}
            className="flex items-center gap-2 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <HelpCircle size={16} />
            <span>Precisa de ajuda ou dúvidas sobre o plano? Falar com Suporte</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            <span>Sair da conta</span>
          </button>
        </div>

      </div>
    </div>
  );
}
