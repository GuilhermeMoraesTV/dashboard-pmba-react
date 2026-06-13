/**
 * src/pages/RevisaoPage.jsx
 * Central de Revisoes: cronograma + ciclos.
 * Redesign visual de pagina inteira, mantendo os contratos de dados existentes.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection, query, where, onSnapshot, doc, updateDoc
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  ArrowLeftRight,
  Layers,
  ListChecks,
  Play,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Zap,
} from "lucide-react";

import { db } from "../firebaseConfig";
import { useCronogramaSystem } from "../hooks/useCronogramaSystem";
import { formatDateKeyLocal, getCronogramaReviewBuckets } from "../services/scheduling/review.js";
import { useCicloRevisoes } from "../hooks/useCicloRevisoes";
import { buildCompletionRegistro } from "../utils/completionRegistro";
const cx = (...classes) => classes.filter(Boolean).join(" ");

const getContextLogo = (item) => {
  if (!item) return null;
  if (item.logoUrl) return item.logoUrl;
  if (item.editalLogoUrl) return item.editalLogoUrl;

  const templateId = item?.templateId || item?.editalId || item?.templateOrigemId || null;
  if (templateId && templateId !== "manual") {
    if (String(templateId).toLowerCase().includes("pmba")) return "/logosEditais/logoModoQAP.png";
    return `/logosEditais/${String(templateId).replace(/^edital_/, "logo-")}.png`;
  }

  const nome = (item.nome || "").toLowerCase();
  if (nome.includes("pmba")) return "/logosEditais/logoModoQAP.png";
  return null;
};

const getContextName = (item, fallback) => item?.nome || item?.editalNome || item?.titulo || fallback;

const toMidnight = (date) => {
  if (!date) return new Date();
  if (date?.toDate) return date.toDate();
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const dt = new Date(date);
  dt.setHours(0, 0, 0, 0);
  return dt;
};

const diffDias = (a, b) => Math.round((toMidnight(a).getTime() - toMidnight(b).getTime()) / 86400000);

const fmtMin = (min) => {
  if (!min || min <= 0) return "0m";
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h${min % 60 > 0 ? String(min % 60).padStart(2, "0") : ""}`;
};

const fmtDate = (d) => toMidnight(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const getItemActionId = (item) => item?.id || item?.slotId || item?.idUnique || item?.slotIdBase;

const TAB_TONES = {
  hoje: {
    icon: CheckCircle2,
    label: "Hoje",
    eyebrow: "Fila principal",
    emptyTitle: "Tudo em dia",
    emptyText: "Nenhuma revisao para hoje neste filtro.",
    gradient: "from-emerald-500 to-teal-500",
    soft: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-300/20",
  },
  atrasadas: {
    icon: Flame,
    label: "Atrasadas",
    eyebrow: "Recuperacao",
    emptyTitle: "Sem atrasos",
    emptyText: "Nenhuma revisao atrasada neste filtro.",
    gradient: "from-red-600 to-rose-600",
    soft: "bg-red-50 text-red-700 ring-red-100 dark:bg-red-400/10 dark:text-red-200 dark:ring-red-300/20",
  },
  proximas: {
    icon: CalendarDays,
    label: "Proximas",
    eyebrow: "Radar",
    emptyTitle: "Agenda limpa",
    emptyText: "Nada previsto para os proximos dias neste filtro.",
    gradient: "from-sky-500 to-blue-600",
    soft: "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-400/10 dark:text-sky-200 dark:ring-sky-300/20",
  },
};

export function contarRevisoesPendentes(cronograma) {
  if (!cronograma) return 0;
  let count = 0;
  try {
    const buckets = getCronogramaReviewBuckets(cronograma, new Date());
    count += buckets.atrasadas.filter((slot) => !slot.concluido).length;
    count += buckets.hoje.filter((slot) => !slot.concluido).length;
  } catch (e) {
    console.warn("[contarRevisoesPendentes] Erro:", e);
  }
  return count;
}

const SourceBadge = ({ tipo }) => {
  const isCiclo = tipo === "ciclo";
  const Icon = isCiclo ? Layers : CalendarDays;
  return (
    <span className={cx(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ring-1",
      isCiclo
        ? "bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-400/10 dark:text-violet-200 dark:ring-violet-300/20"
        : "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-200 dark:ring-blue-300/20"
    )}>
      <Icon size={11} />
      {isCiclo ? "Ciclo" : "Cronograma"}
    </span>
  );
};

const MiniBadge = ({ children, tone = "zinc", icon: Icon }) => {
  const styles = {
    red: "bg-red-50 text-red-700 ring-red-100 dark:bg-red-400/10 dark:text-red-200 dark:ring-red-300/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-300/20",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-300/20",
    sky: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-200 dark:ring-blue-300/20",
    zinc: "bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-white/[0.07] dark:text-zinc-300 dark:ring-white/10",
  };

  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] ring-1", styles[tone])}>
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
};

const ContextButton = ({ active, icon: Icon, label, name, logo, onClick, color = "red" }) => {
  const activeClass = color === "violet"
    ? "border-violet-400 bg-violet-600 text-white shadow-violet-950/20"
    : "border-red-500 bg-red-600 text-white shadow-red-950/20";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-2.5 text-left shadow-sm transition-all active:scale-[0.98]",
        active
          ? `${activeClass} shadow-xl`
          : "border-zinc-200 bg-white/[0.85] text-zinc-700 hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200 dark:hover:border-red-400/30 dark:hover:bg-red-400/10"
      )}
    >
      <span className={cx(
        "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl ring-1",
        active ? "bg-white/[0.18] ring-white/25" : "bg-zinc-100 ring-zinc-200 dark:bg-white/[0.06] dark:ring-white/10"
      )}>
        {logo ? <img src={logo} alt="" className="h-full w-full object-contain p-1" /> : <Icon size={18} />}
      </span>
      <span className="min-w-0">
        <span className={cx("block text-[10px] font-black uppercase tracking-[0.18em]", active ? "text-white/70" : "text-zinc-400")}>
          {label}
        </span>
        <span className="block max-w-[210px] truncate text-sm font-black leading-tight">{name}</span>
      </span>
    </button>
  );
};

const SourceToggleButton = ({ source, onToggle, cicloLogo, cronogramaLogo }) => {
  const isCiclo = source === "ciclo";
  const destinoLogo = isCiclo ? cronogramaLogo : cicloLogo;
  const destinoLabel = isCiclo ? "Cronograma" : "Ciclo";

  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.96 }}
      className="group relative flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/90 py-1 pl-1.5 pr-3 shadow-md backdrop-blur-sm transition-all duration-200 hover:border-red-300 hover:shadow-lg dark:border-zinc-700 dark:bg-zinc-800/90 dark:hover:border-red-600"
      title={`Ver revisoes do ${destinoLabel}`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700">
        {destinoLogo
          ? <img src={destinoLogo} alt="" className="h-4 w-4 object-contain" />
          : (isCiclo ? <CalendarDays size={10} className="text-zinc-400" /> : <BookOpen size={10} className="text-zinc-400" />)}
      </span>
      <ArrowLeftRight size={9} className="shrink-0 text-zinc-400 transition-colors group-hover:text-red-500" />
      <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-zinc-500 transition-colors group-hover:text-red-600 dark:group-hover:text-red-400">
        Ver {destinoLabel}
      </span>
    </motion.button>
  );
};

const getReviewDateValue = (item) => item?.dataSlot || item?.dataAgendada || item?.data || new Date();

const getReviewDateKey = (item) => formatDateKeyLocal(toMidnight(getReviewDateValue(item)));

const getReviewDateLabel = (date) => toMidnight(date).toLocaleDateString("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});

const ReviewTimelineItem = ({
  item,
  index,
  active,
  onConcluir,
  onIniciar,
  onDominar,
  onReagendar,
  isLoading = false,
  actionType = null,
  disabled = false,
}) => {
  const concluido = !!item.concluido || !!item.concluida;
  const tipo = item._fonte || "cronograma";
  const isCiclo = tipo === "ciclo";
  const isDominado = !!item.dominado;
  const diasAtraso = item.diasAtraso ?? 0;
  const tempo = item.tempoMinutos || item.duracao || 20;

  return (
    <div className="group flex items-start gap-3 sm:gap-6">
      <div className="relative mt-2 flex shrink-0 items-center justify-center">
        {concluido ? (
          <div className="z-10 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/35 ring-4 ring-white dark:ring-zinc-950 sm:h-10 sm:w-10">
            <Check size={15} strokeWidth={4} />
          </div>
        ) : active ? (
          <div className={cx(
            "relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-white dark:ring-zinc-950 sm:h-10 sm:w-10",
            isCiclo ? "bg-violet-600 shadow-violet-600/25" : "bg-blue-600 shadow-blue-600/25"
          )}>
            <span className={cx("absolute inset-0 animate-ping rounded-full opacity-30", isCiclo ? "bg-violet-500" : "bg-blue-500")} />
            <Play size={14} fill="currentColor" />
          </div>
        ) : (
          <div className="z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-zinc-200 bg-zinc-100 text-zinc-400 ring-4 ring-white dark:border-zinc-700 dark:bg-zinc-800 dark:ring-zinc-950 sm:h-10 sm:w-10">
            <span className="text-[10px] font-black sm:text-xs">{index + 1}</span>
          </div>
        )}
      </div>

      <motion.article
        layout
        whileHover={disabled ? undefined : { x: 4 }}
        className={cx(
          "flex-1 overflow-hidden rounded-2xl border bg-white/85 shadow-sm transition-all dark:bg-zinc-950/45 sm:rounded-3xl",
          active && !concluido
              ? isCiclo
                ? "border-violet-300 shadow-2xl shadow-violet-500/10 dark:border-violet-400/30"
              : "border-blue-300 shadow-2xl shadow-blue-500/10 dark:border-blue-400/30"
            : concluido
              ? "border-emerald-200 bg-emerald-50/80 shadow-emerald-500/10 dark:border-emerald-900/40 dark:bg-emerald-950/15"
              : "border-zinc-200/80 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/[0.04] dark:border-white/10 dark:hover:border-blue-300/20",
          disabled && "pointer-events-none opacity-70"
        )}
      >
        <div className={cx("h-1 bg-gradient-to-r", concluido ? "from-emerald-500 to-teal-500" : isCiclo ? "from-violet-500 to-fuchsia-600" : "from-blue-600 to-sky-500")} />
        <div className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <SourceBadge tipo={tipo} />
                {active && !concluido && <MiniBadge tone={isCiclo ? "zinc" : "sky"} icon={Zap}>Agora</MiniBadge>}
                {diasAtraso > 0 && <MiniBadge tone="red" icon={Flame}>{diasAtraso}d atraso</MiniBadge>}
                {isDominado && <MiniBadge tone="amber" icon={Trophy}>Dominado</MiniBadge>}
                {concluido && <MiniBadge tone="emerald" icon={CheckCircle2}>Concluida</MiniBadge>}
              </div>

              <h3 className="truncate text-base font-black uppercase tracking-tight text-zinc-950 dark:text-white sm:text-lg">
                {item.disciplinaNome || item.disciplina || "Disciplina"}
              </h3>
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 p-2.5 text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
                <BookOpen size={15} className={cx("mt-0.5 shrink-0", isCiclo ? "text-violet-500" : "text-blue-500")} />
                <p className="line-clamp-2 text-xs font-bold leading-relaxed sm:text-sm">
                  {item.assunto || item.topico || "Topico"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-zinc-100 px-3 text-xs font-black text-zinc-600 ring-1 ring-zinc-200 dark:bg-white/[0.07] dark:text-zinc-300 dark:ring-white/10">
                <Clock size={13} />
                {fmtMin(tempo)}
              </span>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-zinc-100 px-3 text-xs font-black text-zinc-600 ring-1 ring-zinc-200 dark:bg-white/[0.07] dark:text-zinc-300 dark:ring-white/10">
                <CalendarDays size={13} />
                {fmtDate(getReviewDateValue(item))}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onIniciar && !concluido && (
              <button
                type="button"
                onClick={() => onIniciar(item)}
                disabled={disabled}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-zinc-950 px-3 text-[9px] font-black uppercase tracking-wider text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-blue-100"
              >
                <Play size={13} fill="currentColor" /> Iniciar
              </button>
            )}

            <button
              type="button"
              onClick={() => onConcluir(item)}
              disabled={disabled}
              className={cx(
                "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-[9px] font-black uppercase tracking-wider text-white shadow-sm transition-all disabled:opacity-60",
                concluido ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {isLoading ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />}
              {concluido ? "Alterar" : "Concluir"}
            </button>

            {onDominar && tipo === "cronograma" && !concluido && (
              <button
                type="button"
                onClick={() => onDominar(item)}
                disabled={disabled}
                className={cx(
                  "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-[9px] font-black uppercase tracking-wider ring-1 transition-all disabled:opacity-50",
                  isDominado
                    ? "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-300/20"
                    : "bg-white text-zinc-600 ring-zinc-200 hover:text-amber-700 dark:bg-white/[0.05] dark:text-zinc-300 dark:ring-white/10"
                )}
              >
                {actionType === "dominar" ? <RefreshCw size={13} className="animate-spin" /> : <Trophy size={13} />}
                Dominar
              </button>
            )}

            {onReagendar && diasAtraso > 0 && !concluido && (
              <button
                type="button"
                onClick={() => onReagendar(item)}
                disabled={disabled}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-red-50 px-3 text-[9px] font-black uppercase tracking-wider text-red-700 ring-1 ring-red-100 transition-all hover:bg-red-600 hover:text-white disabled:opacity-50 dark:bg-red-400/10 dark:text-red-200 dark:ring-red-300/20"
              >
                {actionType === "reagendar" ? <RefreshCw size={13} className="animate-spin" /> : <CalendarPlus size={13} />}
                Hoje
              </button>
            )}
          </div>
        </div>
      </motion.article>
    </div>
  );
};

const RevisaoListaTimeline = ({
  items,
  activeTab,
  onConcluir,
  onIniciar,
  onDominar,
  onReagendar,
  actionLoading,
}) => {
  const total = items.length;
  const concluidas = items.filter((item) => item.concluido || item.concluida).length;
  const totalMinutos = items.reduce((acc, item) => acc + Number(item.tempoMinutos || item.duracao || 20), 0);
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;
  const activeIndex = items.findIndex((item) => !(item.concluido || item.concluida) && !item.dominado);
  const grupos = items.reduce((acc, item) => {
    const key = getReviewDateKey(item);
    if (!acc[key]) {
      const date = toMidnight(getReviewDateValue(item));
      acc[key] = { key, date, items: [] };
    }
    acc[key].items.push(item);
    return acc;
  }, {});

  const gruposOrdenados = Object.values(grupos).sort((a, b) => a.date - b.date);

  return (
    <motion.div
      key="revisao-lista-operacional"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mx-auto w-full max-w-4xl px-1 sm:px-4"
    >
      <div className="relative mb-5 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/70 p-4 shadow-[0_18px_55px_rgba(37,99,235,0.18)] backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/40 dark:shadow-[0_22px_65px_rgba(59,130,246,0.24)] sm:mb-8 sm:rounded-[32px] sm:p-6">
        <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-blue-500/10 blur-[50px] sm:h-32 sm:w-32 sm:blur-[60px]" />
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg sm:h-14 sm:w-14 sm:rounded-2xl", activeTab.gradient)}>
              <ListChecks size={22} className="sm:h-7 sm:w-7" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300 sm:text-[10px] sm:tracking-[0.3em]">Lista operacional</p>
              <h3 className="truncate text-lg font-black uppercase leading-none tracking-tight text-zinc-950 dark:text-white sm:text-2xl">Fila de revisoes</h3>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="flex items-center justify-end gap-1.5">
              <Clock size={14} className="text-blue-500 sm:h-4 sm:w-4" />
              <span className="text-sm font-black tabular-nums text-zinc-900 dark:text-white sm:text-xl">{fmtMin(totalMinutos)}</span>
            </div>
            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400 sm:text-[10px]">{concluidas}/{total} feitas</p>
          </div>
        </div>

        <div className="relative z-10 mt-4 sm:mt-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 sm:text-[10px]">Progresso da lista</span>
            <span className="text-sm font-black text-blue-600 dark:text-blue-300">{progresso}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full border border-zinc-200/50 bg-zinc-100 p-0.5 dark:border-zinc-700/50 dark:bg-zinc-800 sm:h-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progresso, 100)}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.32)]"
            />
          </div>
        </div>
      </div>

      <div className="space-y-5 pb-6 sm:space-y-6 sm:pb-8">
        {gruposOrdenados.map((grupo) => {
          const feitas = grupo.items.filter((item) => item.concluido || item.concluida).length;
          const isToday = formatDateKeyLocal(new Date()) === grupo.key;
          const diaCompleto = grupo.items.length > 0 && feitas === grupo.items.length;

          return (
            <section
              key={grupo.key}
              className={cx(
                "overflow-hidden rounded-3xl border shadow-sm",
                diaCompleto
                  ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10"
                  : isToday
                  ? "border-blue-200 bg-white shadow-blue-500/10 dark:border-blue-900/45 dark:bg-zinc-950/45"
                  : "border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-zinc-950/35"
              )}
            >
              <div className={cx(
                "flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5",
                diaCompleto
                  ? "border-emerald-100 bg-emerald-50/70 dark:border-emerald-900/30 dark:bg-emerald-950/10"
                  : isToday
                  ? "border-blue-100 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-950/10"
                  : "border-zinc-100 bg-zinc-50/80 dark:border-white/10 dark:bg-white/[0.04]"
              )}>
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cx(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg",
                    diaCompleto ? "bg-emerald-600 shadow-emerald-600/20" : isToday ? "bg-blue-600 shadow-blue-600/20" : "bg-zinc-900 shadow-zinc-900/10 dark:bg-zinc-800"
                  )}>
                    {diaCompleto ? <Trophy size={19} /> : isToday ? <Flame size={19} /> : <CalendarDays size={19} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-black uppercase tracking-tight text-zinc-950 dark:text-white sm:text-lg">
                        {getReviewDateLabel(grupo.date)}
                      </h3>
                      {isToday && <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">Hoje</span>}
                    </div>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                      {grupo.items.length} revisao{grupo.items.length === 1 ? "" : "es"} na fila
                    </p>
                  </div>
                </div>

                <span className={cx(
                  "inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white",
                  diaCompleto ? "bg-emerald-600" : "bg-zinc-950 dark:bg-white dark:text-zinc-950"
                )}>
                  {feitas}/{grupo.items.length}
                </span>
              </div>

              <div className="relative px-3 py-4 sm:px-5">
                <div className="absolute bottom-4 left-[31px] top-4 w-0.5 bg-zinc-200 dark:bg-zinc-800 sm:left-[47px]" />
                <div className="relative z-10 space-y-3 sm:space-y-4">
                  {grupo.items.map((item) => {
                    const globalIndex = items.indexOf(item);
                    const actionId = getItemActionId(item);
                    return (
                      <ReviewTimelineItem
                        key={item.id || item.idUnique || item.slotId || actionId || globalIndex}
                        item={item}
                        index={globalIndex}
                        active={globalIndex === activeIndex}
                        onConcluir={onConcluir}
                        onIniciar={onIniciar}
                        onDominar={onDominar}
                        onReagendar={onReagendar}
                        isLoading={actionLoading?.id === actionId && actionLoading?.type === "concluir"}
                        actionType={actionLoading?.id === actionId ? actionLoading.type : null}
                        disabled={!!actionLoading}
                      />
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </motion.div>
  );
};

export function RevisaoPage({ user, onStartStudy, addRegistroEstudo, deleteCompletionRegistro, onChoosePlan }) {
  const [aba, setAba] = useState("hoje");
  const [filtroFonte, setFiltroFonte] = useState("todas");
  const [cronograma, setCronograma] = useState(null);
  const [cicloAtivo, setCicloAtivo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const {
    concluirRevisaoCronograma,
    toggleAssuntoDominado,
    reagendarRevisaoCronograma,
  } = useCronogramaSystem(user);

  const {
    revisoes: todasRevisoesCiclo,
    loading: loadingRevisoesCiclo,
    concluirRevisao: concluirRevisaoCiclo,
  } = useCicloRevisoes(user, null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const q = query(collection(db, "users", user.uid, "cronogramas"), where("ativo", "==", true));
    return onSnapshot(q, (snap) => {
      setCronograma(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
      setLoading(false);
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const q = query(collection(db, "users", user.uid, "ciclos"), where("ativo", "==", true));
    return onSnapshot(q, (snap) => {
      setCicloAtivo(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
    });
  }, [user?.uid]);

  const { hojeC: revisoesHojeCron, atrasadasC, proximasC } = useMemo(() => {
    const res = { hojeC: [], atrasadasC: [], proximasC: [] };
    if (!cronograma) return res;
    const buckets = getCronogramaReviewBuckets(cronograma, new Date());
    res.hojeC = buckets.hoje.map((s) => ({ ...s, _fonte: "cronograma" }));
    res.atrasadasC = buckets.atrasadas.map((s) => ({ ...s, _fonte: "cronograma" }));
    res.proximasC = buckets.proximas.map((s) => ({ ...s, _fonte: "cronograma" }));
    return res;
  }, [cronograma]);

  const hoje = useMemo(() => [
    ...revisoesHojeCron,
    ...todasRevisoesCiclo
      .filter((r) => {
        const hojeKey = formatDateKeyLocal(new Date());
        return String(r.dataAgendada || "") === hojeKey;
      })
      .map((r) => ({ ...r, _fonte: "ciclo" }))
  ], [revisoesHojeCron, todasRevisoesCiclo]);

  const atrasadas = useMemo(() => [
    ...atrasadasC,
    ...todasRevisoesCiclo
      .filter((r) => {
        const hojeKey = formatDateKeyLocal(new Date());
        return r.dataAgendada < hojeKey;
      })
      .map((r) => ({ ...r, _fonte: "ciclo", diasAtraso: diffDias(new Date(), toMidnight(r.dataAgendada)) }))
  ], [atrasadasC, todasRevisoesCiclo]);

  const proximas = useMemo(() => [
    ...proximasC,
    ...todasRevisoesCiclo
      .filter((r) => {
        const agora = toMidnight(new Date());
        const dt = toMidnight(r.dataAgendada);
        return dt > agora;
      })
      .map((r) => ({ ...r, _fonte: "ciclo", dataSlot: toMidnight(r.dataAgendada) }))
      .sort((a, b) => a.dataSlot - b.dataSlot)
  ], [proximasC, todasRevisoesCiclo]);

  const listaAtual = useMemo(() => ({ hoje, atrasadas, proximas })[aba] || [], [aba, hoje, atrasadas, proximas]);

  const slotsExibidos = useMemo(() => {
    let lista = listaAtual;
    if (filtroFonte !== "todas") lista = lista.filter((s) => s._fonte === filtroFonte);
    return lista;
  }, [listaAtual, filtroFonte]);

  const concluidasHoje = useMemo(() => hoje.filter((s) => s.concluido || s.concluida).length, [hoje]);
  const totalGeral = hoje.length + atrasadas.length + proximas.length;
  const totalConcluidas = useMemo(
    () => [...hoje, ...atrasadas, ...proximas].filter((s) => s.concluido || s.concluida).length,
    [hoje, atrasadas, proximas]
  );
  const progressoGeral = totalGeral > 0 ? Math.round((totalConcluidas / totalGeral) * 100) : 0;
  const activeTab = TAB_TONES[aba] || TAB_TONES.hoje;
  const ActiveTabIcon = activeTab.icon;
  const handleConcluir = async (item) => {
    const actionId = getItemActionId(item);
    if (actionLoading) return;
    setActionLoading({ id: actionId, type: "concluir" });
    try {
      if (item._fonte === "ciclo") {
        await concluirRevisaoCiclo(item.id);
        const completionRegistro = buildCompletionRegistro({
          context: "ciclo",
          item,
          ciclo: cicloAtivo,
          isReview: true,
          fallbackMinutes: 20,
        });
        const wasDone = Boolean(item.concluida || item.concluido);
        if (!wasDone && addRegistroEstudo) {
          await addRegistroEstudo(completionRegistro);
        } else if (wasDone && deleteCompletionRegistro) {
          await deleteCompletionRegistro(completionRegistro);
        }
        showToast(wasDone ? "Revisao marcada como pendente" : "Revisao de ciclo concluida");
      } else {
        if (!cronograma?.id) return;
        if (await concluirRevisaoCronograma(cronograma.id, item, cronograma.dataInicio)) {
          const completionRegistro = buildCompletionRegistro({
            context: "cronograma",
            item,
            cronograma,
            isReview: true,
            fallbackMinutes: 20,
          });
          const wasDone = Boolean(item.concluido || item.concluida);
          if (!wasDone && addRegistroEstudo) {
            await addRegistroEstudo(completionRegistro);
          } else if (wasDone && deleteCompletionRegistro) {
            await deleteCompletionRegistro(completionRegistro);
          }
          showToast(wasDone ? "Revisao marcada como pendente" : "Revisao concluida");
        } else {
          showToast("Erro ao atualizar status");
        }
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleIniciar = (s) =>
    onStartStudy?.(
      { id: s.disciplinaId, nome: s.disciplinaNome || s.disciplina },
      s.assunto || s.topico || null,
      { defaultContext: s._fonte === "cronograma" ? "cronograma" : "ciclo" }
    );

  const handleDominar = async (s) => {
    if (s._fonte === "ciclo") return;
    const actionId = getItemActionId(s);
    if (actionLoading) return;
    setActionLoading({ id: actionId, type: "dominar" });
    try {
      if (await toggleAssuntoDominado(cronograma.id, s.disciplinaId, s.assunto, !!s.dominado)) {
        showToast("Dominio atualizado");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleReagendar = async (s) => {
    const actionId = getItemActionId(s);
    if (actionLoading) return;
    setActionLoading({ id: actionId, type: "reagendar" });
    if (s._fonte === "ciclo") {
      try {
        await updateDoc(doc(db, "users", user.uid, "revisoesCiclo", s.id), {
          dataAgendada: formatDateKeyLocal(new Date())
        });
        showToast("Revisao de ciclo reagendada para hoje");
      } catch {
        showToast("Erro ao reagendar");
      } finally {
        setActionLoading(null);
      }
    } else {
      if (!cronograma?.id) {
        setActionLoading(null);
        return;
      }
      try {
        const ok = await reagendarRevisaoCronograma(cronograma.id, s, new Date(), cronograma.dataInicio);
        if (!ok) throw new Error("reagendamento-falhou");
        showToast("Reagendado para hoje");
      } catch {
        showToast("Erro ao reagendar");
      } finally {
        setActionLoading(null);
      }
    }
  };

  if (loading || loadingRevisoesCiclo) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-transparent">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <RefreshCw className="animate-spin text-red-600 dark:text-red-300" size={22} />
          <span className="text-xs font-black uppercase tracking-[0.22em] text-zinc-600 dark:text-zinc-200">Carregando revisoes</span>
        </div>
      </div>
    );
  }

  const nenhuma = !cronograma && !cicloAtivo && todasRevisoesCiclo.length === 0;

  if (nenhuma) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] w-full items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="group relative w-full max-w-2xl overflow-hidden rounded-[40px] border border-zinc-200 bg-white p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-zinc-950 dark:shadow-[0_30px_100px_rgba(0,0,0,0.3)] sm:px-12 sm:pb-9 sm:pt-12"
        >
          {/* Decorative background elements */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/5 blur-[80px] transition-all duration-700 group-hover:bg-blue-500/10" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-red-500/5 blur-[80px] transition-all duration-700 group-hover:bg-red-500/10" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20 opacity-40 duration-[3s]" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-[32px] bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-2xl shadow-blue-500/30 sm:h-28 sm:w-28">
                <BookOpen size={48} strokeWidth={1.5} />
              </div>
              <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-xl dark:bg-zinc-900 dark:text-blue-400">
                <Zap size={20} fill="currentColor" />
              </div>
            </div>

            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-blue-600 dark:text-blue-400">
              Central de Revisão
            </p>
            
            <h2 className="mt-4 text-3xl font-black uppercase tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Nenhum planejamento <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">ativo</span>
            </h2>
            
            <p className="mt-6 max-w-md text-base font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
              Sua central de revisões está aguardando um plano ativo. Ative um cronograma ou ciclo de estudos para começar a dominar o conteúdo.
            </p>

            <div className="mt-10 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={onChoosePlan}
                className="group/btn relative flex h-14 items-center gap-3 overflow-hidden rounded-2xl bg-zinc-950 px-8 text-xs font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all hover:scale-105 hover:bg-blue-600 active:scale-95 dark:bg-white dark:text-zinc-950 dark:hover:bg-blue-500 dark:hover:text-white"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Ir para Planejamento <ArrowLeftRight size={16} />
                </span>
              </button>
              <img
                src="/logoModoQAP.png"
                alt="Logo Modo QAP"
                className="h-8 w-auto object-contain opacity-90 transition-opacity duration-300 group-hover:opacity-100"
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const tabs = [
    { id: "hoje", count: hoje.length, ...TAB_TONES.hoje },
    { id: "atrasadas", count: atrasadas.length, ...TAB_TONES.atrasadas },
    { id: "proximas", count: proximas.length, ...TAB_TONES.proximas },
  ];
  const sourceAtual = filtroFonte === "ciclo"
    ? "ciclo"
    : filtroFonte === "cronograma"
      ? "cronograma"
      : cronograma
        ? "cronograma"
        : "ciclo";
  const contextoHeader = sourceAtual === "ciclo" ? cicloAtivo : cronograma;
  const headerLogo = getContextLogo(contextoHeader) || getContextLogo(cronograma) || getContextLogo(cicloAtivo);
  const cicloLogo = getContextLogo(cicloAtivo);
  const cronogramaLogo = getContextLogo(cronograma);
  const showSourceToggle = Boolean(cronograma && cicloAtivo);

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-transparent text-zinc-950 dark:text-white">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.98 }}
            className="fixed left-1/2 top-24 z-[1000] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-zinc-800/10 bg-zinc-950/95 px-5 py-3 text-center text-xs font-black uppercase tracking-[0.18em] text-white shadow-2xl shadow-zinc-950/30 backdrop-blur-xl dark:border-white/10 dark:bg-white/95 dark:text-zinc-950"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 flex min-h-screen w-full flex-1 flex-col gap-5 px-3 pb-6 pt-4 sm:px-5 lg:px-7">
        <section className="shrink-0">
          <div className="relative mb-4 flex flex-row items-center justify-between gap-2 overflow-hidden rounded-2xl border border-zinc-300 bg-zinc-50 px-3 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:px-4 md:gap-6 md:px-6 md:py-4">
            {headerLogo ? (
              <div className="pointer-events-none absolute -bottom-3 right-20 h-16 w-16 rotate-[-10deg] opacity-10 transition-all duration-500 dark:opacity-20 md:-bottom-4 md:-right-4 md:h-44 md:w-44 md:opacity-10">
                <img src={headerLogo} alt="" className="h-full w-full object-contain saturate-150" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              </div>
            ) : (
              <div className="pointer-events-none absolute -bottom-4 -right-4 flex h-32 w-32 rotate-[-10deg] items-center justify-center opacity-5 dark:opacity-10 md:h-44 md:w-44">
                <ShieldCheck size={120} className="text-zinc-400 dark:text-zinc-500" />
              </div>
            )}

            <div className="relative z-10 flex shrink-0 flex-col items-center gap-1">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-zinc-50 shadow-md dark:border-zinc-800 dark:bg-zinc-950 sm:h-12 sm:w-12 md:h-24 md:w-24 md:border-4 md:shadow-xl">
                {headerLogo
                  ? <img src={headerLogo} alt="Logo do concurso" className="h-7 w-7 object-contain sm:h-8 sm:w-8 md:h-16 md:w-16" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  : <ShieldCheck size={22} className="text-zinc-300 dark:text-zinc-600 md:h-9 md:w-9" />}
                <span className="absolute -bottom-1.5 rounded-full border border-white bg-emerald-500 px-1 py-0.5 text-[6px] font-bold uppercase tracking-wider text-white shadow-md dark:border-zinc-900 md:-bottom-2 md:border-2 md:px-2 md:text-[9px] md:tracking-widest">
                  Ativo
                </span>
              </div>
              {showSourceToggle && (
                <SourceToggleButton
                  source={sourceAtual}
                  onToggle={() => setFiltroFonte(sourceAtual === "ciclo" ? "cronograma" : "ciclo")}
                  cicloLogo={cicloLogo}
                  cronogramaLogo={cronogramaLogo}
                />
              )}
            </div>

            <div className="z-10 min-w-0 flex-1">
              <div className="flex flex-col gap-3">
                <div className="flex min-w-0 items-center gap-1.5 md:flex-wrap md:gap-3">
                  <h1 className="truncate text-sm font-black uppercase leading-none tracking-tight text-zinc-900 dark:text-white sm:text-lg md:text-3xl">
                    Revisoes
                  </h1>
                  <span className="hidden items-center gap-1.5 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-500 sm:flex">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    Central ativa
                  </span>
                  <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-blue-700 ring-1 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-300/20 md:px-2 md:text-[10px] md:tracking-widest">
                    {totalGeral} mapeadas
                  </span>
                </div>

                <div className="mt-1 hidden flex-col gap-3 sm:flex-row sm:items-center sm:gap-6 md:flex">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <CheckCircle2 size={13} />
                      <p className="text-[10px] font-bold uppercase tracking-wide">
                        Hoje: <span className="text-zinc-600 dark:text-zinc-300">{concluidasHoje}/{hoje.length}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Flame size={13} />
                      <p className="text-[10px] font-bold uppercase tracking-wide">
                        Atrasadas: <span className="text-zinc-600 dark:text-zinc-300">{atrasadas.length}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <CalendarDays size={13} />
                      <p className="text-[10px] font-bold uppercase tracking-wide">
                        Proximas: <span className="text-zinc-600 dark:text-zinc-300">{proximas.length}</span>
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="z-10 flex shrink-0 items-center gap-2 md:gap-6">
              <div className="hidden text-center sm:block">
                <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Concluidas</p>
                <p className="text-2xl font-black text-zinc-900 dark:text-white">
                  {totalConcluidas}<span className="text-sm font-bold text-zinc-400">/{totalGeral}</span>
                </p>
              </div>
              <div className="hidden h-12 w-px bg-zinc-200 dark:bg-zinc-800 sm:block" />
              <div className="relative">
                <svg className="h-10 w-10 -rotate-90 sm:h-12 sm:w-12 md:h-20 md:w-20" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="6" />
                  <motion.circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="currentColor"
                    className={progressoGeral >= 100 ? "text-emerald-500" : progressoGeral > 0 ? "text-blue-600 dark:text-blue-500" : "text-zinc-300 dark:text-zinc-700"}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 34}
                    initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - Math.min(progressoGeral, 100) / 100) }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cx("text-[10px] font-black sm:text-xs md:text-lg", progressoGeral >= 100 ? "text-emerald-500" : progressoGeral > 0 ? "text-blue-600 dark:text-blue-500" : "text-zinc-400")}>
                    {progressoGeral}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col items-start justify-between gap-4 px-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zinc-400">
              <ListChecks size={16} /> Revisoes
            </h3>

            <div className="hidden items-center gap-1 rounded-lg bg-zinc-200/50 p-1 shadow-sm dark:bg-zinc-800 sm:flex">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const selected = aba === tab.id;
                return (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => setAba(tab.id)}
                    className={cx(
                      "flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors",
                      selected
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                        : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                    )}
                  >
                    <Icon size={12} />
                    {tab.label}
                    <span className={cx(
                      "rounded px-1.5 py-0.5 text-[9px] tabular-nums",
                      selected ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" : "bg-white/70 text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400"
                    )}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </section>

        <section className="flex items-center gap-1 rounded-lg bg-zinc-200/50 p-1 shadow-sm dark:bg-zinc-800 sm:hidden">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = aba === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setAba(tab.id)}
                className={cx(
                  "flex-1 flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors",
                  selected
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                )}
              >
                <Icon size={12} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </section>

        <section className="min-h-0 w-full flex-1">
          <div className="min-h-[420px]">
            <AnimatePresence mode="wait">
              {slotsExibidos.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300/80 bg-white/60 px-6 py-16 text-center dark:border-white/10 dark:bg-white/[0.035]"
                >
                  <div className={cx("mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-xl", activeTab.gradient)}>
                    <ActiveTabIcon size={30} />
                  </div>
                  <p className="text-base font-black text-zinc-950 dark:text-white">{activeTab.emptyTitle}</p>
                  <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">{activeTab.emptyText}</p>
                </motion.div>
              ) : (
                <RevisaoListaTimeline
                  items={slotsExibidos}
                  activeTab={activeTab}
                  onConcluir={handleConcluir}
                  onIniciar={onStartStudy ? handleIniciar : null}
                  onDominar={handleDominar}
                  onReagendar={handleReagendar}
                  actionLoading={actionLoading}
                />
              )}
            </AnimatePresence>
          </div>
        </section>

      </main>
    </div>
  );
}

export default RevisaoPage;
