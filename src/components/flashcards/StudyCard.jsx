import React, { useEffect, useMemo, useState } from 'react';
import { Eye, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { resolveAnkiMediaHtml } from '../../services/anki/ankiMedia.js';
import { sanitizeFlashcardHtml } from '../../utils/sanitizeHtml.js';

function stripInternalRefTokens(text) {
  return String(text || '')
    .replace(/\[\s*REF\s+[^\]]+\]/gi, '')
    .replace(/\bREF\s+[A-Za-z0-9_:-]+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function processCloze(text, reveal) {
  if (!text || !text.includes('{{c')) return text;
  return text.replace(/\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g, (_match, _num, answer, hint) => {
    if (reveal) return `<strong class="text-red-600 dark:text-red-400 font-black underline decoration-2">${answer}</strong>`;
    if (hint) return `<span class="rounded-md bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-zinc-600 dark:text-zinc-300 font-semibold italic">[${hint}]</span>`;
    return '<span class="rounded-md bg-zinc-200 dark:bg-zinc-700 px-2.5 py-0.5 text-zinc-500 dark:text-zinc-400 font-bold">[ ... ]</span>';
  });
}

function cleanAnswerHtml(backHtml) {
  let cleaned = String(backHtml || '').trim();
  if (cleaned.includes('<hr') || cleaned.includes('<HR')) {
    const parts = cleaned.split(/<hr\b[^>]*>/i);
    if (parts.length > 1) {
      cleaned = parts.slice(1).join('<hr>').trim();
    }
  }
  return cleaned || backHtml;
}

export default function StudyCard({ card, revealed, onReveal, onToggleReveal }) {
  const isCloze = Boolean(card?.front && /\{\{c\d+::/i.test(card.front));
  const rawFront = useMemo(() => stripInternalRefTokens(processCloze(card?.front || '', false)), [card?.front]);
  const rawFrontRevealed = useMemo(() => stripInternalRefTokens(processCloze(card?.front || '', true)), [card?.front]);
  const rawBack = useMemo(() => stripInternalRefTokens(card?.back || ''), [card?.back]);

  const [frontHtml, setFrontHtml] = useState(() => sanitizeFlashcardHtml(rawFront));
  const [frontRevealedHtml, setFrontRevealedHtml] = useState(() => sanitizeFlashcardHtml(rawFrontRevealed));
  const [backHtml, setBackHtml] = useState(() => sanitizeFlashcardHtml(rawBack));

  useEffect(() => {
    let active = true;
    setFrontHtml(sanitizeFlashcardHtml(rawFront));
    setFrontRevealedHtml(sanitizeFlashcardHtml(rawFrontRevealed));
    setBackHtml(sanitizeFlashcardHtml(rawBack));
    Promise.all([
      resolveAnkiMediaHtml(rawFront),
      resolveAnkiMediaHtml(rawFrontRevealed),
      resolveAnkiMediaHtml(rawBack),
    ]).then(([nextFront, nextFrontRevealed, nextBack]) => {
      if (!active) return;
      setFrontHtml(nextFront);
      setFrontRevealedHtml(nextFrontRevealed);
      setBackHtml(nextBack);
    });
    return () => { active = false; };
  }, [rawBack, rawFront, rawFrontRevealed]);

  const displayBackHtml = useMemo(() => {
    if (isCloze) return frontRevealedHtml || frontHtml;
    return cleanAnswerHtml(backHtml);
  }, [isCloze, frontRevealedHtml, frontHtml, backHtml]);

  const handleCardClick = (e) => {
    // Não acionar flip se clicou em um botão interno ou link
    if (e.target.closest('button, a, input, textarea')) return;
    if (onToggleReveal) {
      onToggleReveal();
    } else if (onReveal) {
      onReveal(!revealed);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="relative w-full cursor-pointer select-none [perspective:1200px]"
      style={{ minHeight: '340px' }}
      title={revealed ? 'Clique para virar para a frente' : 'Clique para mostrar a resposta'}
    >
      <motion.div
        className="relative min-h-[340px] w-full rounded-3xl"
        initial={false}
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Frente do Card */}
        <div
          className="absolute inset-0 flex flex-col justify-between overflow-y-auto rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>Frente</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
              {isCloze ? 'Omissão de Palavras' : 'Conceito / Pergunta'}
            </span>
          </div>

          <div className="my-auto flex items-center justify-center py-6 text-center">
            <div
              className="prose max-w-none text-lg font-bold leading-relaxed text-slate-900 dark:prose-invert dark:text-slate-100 sm:text-xl [&_img]:mx-auto [&_img]:my-3 [&_img]:max-h-[45vh] [&_img]:max-w-full [&_img]:rounded-xl [&_img]:object-contain"
              dangerouslySetInnerHTML={{ __html: frontHtml }}
            />
          </div>

          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleReveal) onToggleReveal();
                else if (onReveal) onReveal(true);
              }}
              className="group inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg transition-all hover:bg-red-600 active:scale-95 dark:bg-white dark:text-slate-950 dark:hover:bg-red-600 dark:hover:text-white"
            >
              <Eye size={17} strokeWidth={2.5} className="transition group-hover:scale-110" />
              Mostrar Resposta (Espaço)
            </button>
          </div>
        </div>

        {/* Verso do Card */}
        <div
          className="absolute inset-0 flex flex-col justify-between overflow-y-auto rounded-3xl border border-red-500/20 bg-slate-50/95 p-6 shadow-xl backdrop-blur dark:border-red-500/30 dark:bg-slate-900/95 sm:p-8"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
            <span className="flex items-center gap-1.5">
              <span>Verso</span>
              <span className="text-[10px] opacity-70">(clique para desvirar)</span>
            </span>
            <span className="rounded-full bg-red-500/10 px-2.5 py-1 font-black">
              Resposta
            </span>
          </div>

          <div className="my-auto flex items-center justify-center py-6 text-center">
            <div
              className="prose max-w-none text-base font-medium leading-relaxed text-slate-800 dark:prose-invert dark:text-slate-200 sm:text-lg [&_img]:mx-auto [&_img]:my-3 [&_img]:max-h-[45vh] [&_img]:max-w-full [&_img]:rounded-xl [&_img]:object-contain"
              dangerouslySetInnerHTML={{ __html: displayBackHtml }}
            />
          </div>

          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Classifique seu domínio abaixo</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleReveal) onToggleReveal();
                else if (onReveal) onReveal(false);
              }}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <RotateCcw size={13} />
              <span>Ver pergunta</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
