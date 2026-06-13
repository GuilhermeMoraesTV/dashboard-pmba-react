import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, BookOpen } from 'lucide-react';

export default function GlobalStudyRegisterFab({
  onClick,
  disabled = false,
  disabledMessage = 'Ative um ciclo ou cronograma para registrar estudo',
  hidden = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const [showDisabledHint, setShowDisabledHint] = useState(false);
  const hideHintTimerRef = useRef(null);
  const expanded = !disabled && canHover && isExpanded;
  const clearHintTimer = () => {
    if (hideHintTimerRef.current) {
      clearTimeout(hideHintTimerRef.current);
      hideHintTimerRef.current = null;
    }
  };

  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)');
    const syncHover = () => {
      setCanHover(media.matches);
      if (!media.matches) setIsExpanded(false);
    };
    syncHover();
    media.addEventListener?.('change', syncHover);
    return () => {
      clearHintTimer();
      media.removeEventListener?.('change', syncHover);
    };
  }, []);

  if (hidden) return null;

  const fabContent = (
    <div className="global-study-register-fab fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-4 z-[100060] pointer-events-none sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:right-6">
      <motion.button
        type="button"
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
          setIsExpanded(false);
        }}
        aria-disabled={disabled}
        aria-label={disabled ? disabledMessage : 'Registrar estudo'}
        title={disabled ? disabledMessage : 'Registrar estudo'}
        initial={false}
        animate={{ width: expanded ? 224 : canHover ? 64 : 54 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.6 }}
        whileHover={disabled ? {} : { scale: 1.02 }}
        whileTap={disabled ? {} : { scale: 0.96 }}
        onMouseEnter={() => {
          if (disabled) setShowDisabledHint(true);
          else setIsExpanded(true);
        }}
        onMouseLeave={() => {
          setIsExpanded(false);
          setShowDisabledHint(false);
        }}
        onFocus={() => {
          if (disabled) setShowDisabledHint(true);
          else setIsExpanded(true);
        }}
        onBlur={() => {
          setIsExpanded(false);
          setShowDisabledHint(false);
        }}
        onTouchStart={() => {
          if (!disabled) return;
          setShowDisabledHint(true);
          clearHintTimer();
          hideHintTimerRef.current = setTimeout(() => {
            setShowDisabledHint(false);
            hideHintTimerRef.current = null;
          }, 2200);
        }}
        className={`group pointer-events-auto relative h-[54px] sm:h-[64px] rounded-full shadow-xl transition-all duration-200 overflow-hidden
          ${disabled
            ? 'bg-zinc-400 text-zinc-100 cursor-not-allowed'
            : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-red-600/35'
          }`}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div
          className={`relative flex items-center h-full transition-all duration-200 ${
            expanded ? 'justify-start px-3.5 gap-2.5' : 'justify-center px-0 gap-0'
          }`}
        >
          <div
            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 transition-colors
              ${disabled ? 'bg-zinc-500/50 text-zinc-200' : 'bg-black/10 text-white'}
            `}
          >
            <Plus size={18} strokeWidth={3.25} />
          </div>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="flex items-center gap-1.5 min-w-0"
              >
                <BookOpen size={14} className="text-white/90 shrink-0" />
                <span className="text-[11px] font-black uppercase tracking-wide whitespace-nowrap">
                  Registrar estudo
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.button>

      <AnimatePresence>
        {disabled && showDisabledHint && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute bottom-[80px] right-0 max-w-[260px] rounded-xl bg-zinc-900 text-white text-[11px] font-bold leading-tight px-3 py-2 shadow-2xl border border-zinc-700/70"
          >
            {disabledMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (typeof document === 'undefined') return fabContent;

  return createPortal(fabContent, document.body);
}
