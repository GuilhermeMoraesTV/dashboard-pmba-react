import { motion } from 'framer-motion';

// ─── SKELETON BASE ────────────────────────────────────────────────────────────
export const Skeleton = ({ w = 'w-full', h = 'h-4', rounded = 'rounded-2xl', className = '' }) => (
  <motion.div
    className={`${w} ${h} ${rounded} bg-zinc-200 dark:bg-zinc-800 animate-pulse ${className}`}
  />
);

// ─── COMPOSIÇÃO: CardEdital (Step 1) ──────────────────────────────────────────
export const SkeletonCard = () => (
  <div className="flex flex-col w-[155px] sm:w-[175px] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
    <div className="h-28 bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center">
      <div className="w-12 h-12 rounded-xl bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
    </div>
    <div className="p-3 flex flex-col gap-2">
      <Skeleton h="h-3" w="w-full" />
      <Skeleton h="h-3" w="w-3/4" />
      <Skeleton h="h-2" w="w-1/2" className="mt-1" />
      <Skeleton h="h-2" w="w-2/3" />
      <Skeleton h="h-7" w="w-full" className="mt-1" />
    </div>
  </div>
);

// ─── COMPOSIÇÃO: Slot de Estudo (Step 5) ──────────────────────────────────────
export const SkeletonSlot = () => (
  <div className="h-[60px] rounded-xl bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/50 p-2 flex items-center gap-2">
    <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse shrink-0" />
    <div className="flex flex-col gap-1.5 flex-1">
      <Skeleton h="h-2.5" w="w-2/3" rounded="rounded-lg" />
      <Skeleton h="h-2" w="w-1/2" rounded="rounded-lg" />
    </div>
  </div>
);

// ─── COMPOSIÇÃO: Mini Stat Card ───────────────────────────────────────────────
export const SkeletonStat = () => (
  <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <div className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
      <div className="w-1 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
    </div>
    <Skeleton h="h-2" w="w-1/3" rounded="rounded-lg" />
    <Skeleton h="h-6" w="w-2/3" rounded="rounded-lg" />
    <Skeleton h="h-2" w="w-1/2" rounded="rounded-lg" />
  </div>
);

// ─── VARIANTES DE STAGGER (Ideia 6.1 — entrada um por um) ─────────────────────
export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};
