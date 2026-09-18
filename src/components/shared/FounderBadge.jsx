import React from 'react';
import { Crown, Sparkles } from 'lucide-react';

/**
 * Componente oficial de identificação visual de Membro Fundador do ModoQAP.
 *
 * REGRA ESTRITA DE NEGÓCIO:
 * - Se `founder` não for estritamente `true`, o componente retorna `null`.
 *
 * @param {Object} props
 * @param {boolean} [props.founder=false] - Status oficial de Membro Fundador
 * @param {'lg'|'md'|'sm'|'compact'} [props.size='md'] - Variante de tamanho/contexto
 * @param {string} [props.className=''] - Classes adicionais de estilização/posicionamento
 * @param {boolean} [props.showGlow=true] - Habilitar efeito glow/sombra dourada
 * @param {string} [props.tooltipText='Membro Fundador do ModoQAP'] - Texto acessível do tooltip
 */
export default function FounderBadge({
  founder = false,
  size = 'md',
  className = '',
  showGlow = true,
  tooltipText = 'Membro Fundador do ModoQAP',
}) {
  // Regra de ouro: se não for fundador, não renderiza absolutamente nada no DOM
  if (founder !== true) {
    return null;
  }

  // Configurações e estilos conforme a variante de tamanho
  switch (size) {
    case 'lg':
      return (
        <span
          role="status"
          aria-label={tooltipText}
          title={tooltipText}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black tracking-wider uppercase select-none transition-all duration-300 hover:scale-[1.02] border-amber-400/50 bg-gradient-to-r from-amber-500/15 via-amber-400/25 to-yellow-500/15 dark:border-amber-400/60 dark:from-amber-950/70 dark:via-yellow-900/40 dark:to-amber-950/60 backdrop-blur-md ${
            showGlow ? 'shadow-[0_0_16px_rgba(245,158,11,0.28)] dark:shadow-[0_0_20px_rgba(245,158,11,0.38)]' : ''
          } ${className}`}
        >
          <span className="flex items-center gap-0.5 text-amber-500 dark:text-amber-300 shrink-0">
            <Crown size={15} className="fill-amber-400/40 dark:fill-amber-300/40 drop-shadow-xs" />
          </span>
          <span className="bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-700 dark:from-amber-200 dark:via-yellow-100 dark:to-amber-300 bg-clip-text text-transparent drop-shadow-xs">
            Fundador
          </span>
          <Sparkles size={11} className="text-amber-400 dark:text-amber-300 shrink-0 opacity-85" />
        </span>
      );

    case 'sm':
      return (
        <span
          role="status"
          aria-label={tooltipText}
          title={tooltipText}
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] font-black tracking-wide uppercase select-none leading-none border-amber-400/40 bg-amber-500/10 text-amber-800 dark:border-amber-400/50 dark:bg-amber-950/40 dark:text-amber-200 ${
            showGlow ? 'shadow-[0_0_6px_rgba(245,158,11,0.15)] dark:shadow-[0_0_8px_rgba(245,158,11,0.22)]' : ''
          } ${className}`}
        >
          <Crown size={10} className="text-amber-600 dark:text-amber-300 shrink-0 fill-amber-400/30" />
          <span>Fundador</span>
        </span>
      );

    case 'compact':
      return (
        <span
          role="status"
          aria-label={tooltipText}
          title={tooltipText}
          className={`inline-flex items-center justify-center rounded-full border p-1 select-none border-amber-400/45 bg-gradient-to-br from-amber-400/20 to-yellow-500/20 dark:border-amber-400/50 dark:from-amber-950/70 dark:to-yellow-900/50 text-amber-600 dark:text-amber-300 ${
            showGlow ? 'shadow-[0_0_8px_rgba(245,158,11,0.2)] dark:shadow-[0_0_10px_rgba(245,158,11,0.3)]' : ''
          } ${className}`}
        >
          <Crown size={11} className="shrink-0 fill-amber-400/40 dark:fill-amber-300/40" />
        </span>
      );

    case 'md':
    default:
      return (
        <span
          role="status"
          aria-label={tooltipText}
          title={tooltipText}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-black tracking-wider uppercase select-none transition-all duration-200 border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-amber-400/20 to-yellow-500/15 dark:border-amber-400/50 dark:from-amber-950/60 dark:via-yellow-900/35 dark:to-amber-950/50 backdrop-blur-xs ${
            showGlow ? 'shadow-[0_0_10px_rgba(245,158,11,0.22)] dark:shadow-[0_0_14px_rgba(245,158,11,0.28)]' : ''
          } ${className}`}
        >
          <Crown size={12} className="text-amber-500 dark:text-amber-300 shrink-0 fill-amber-400/30" />
          <span className="bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-700 dark:from-amber-200 dark:via-yellow-100 dark:to-amber-300 bg-clip-text text-transparent">
            Fundador
          </span>
        </span>
      );
  }
}
