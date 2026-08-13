/**
 * src/pages/RevisaoPage.jsx
 * Central de Revisoes: cronograma + ciclos.
 * Redesign visual de pagina inteira, mantendo os contratos de dados existentes.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection, query, where, onSnapshot, doc, updateDoc
} from "firebase/firestore";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  ArrowLeftRight,
  Play,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Zap,
} from "lucide-react";

import { db } from "../firebaseConfig";
import { useCronogramaSystem } from "../hooks/useCronogramaSystem";
import { formatDateKeyLocal } from "../services/scheduling/review.js";
import { useCicloRevisoes } from "../hooks/useCicloRevisoes";
import { buildCompletionRegistro } from "../utils/completionRegistro";
import {
  REGISTRO_PROGRESS_OPTIMISTIC_EVENT,
  applyCronogramaRegistroProgress,
} from "../services/reviewOptimisticUpdates";
import { buildRevisaoCentral, filterRevisaoCentralItems } from "../utils/revisaoCentral";
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
    label: "Próximas",
    eyebrow: "Radar",
    emptyTitle: "Agenda limpa",
    emptyText: "Nada previsto para os proximos dias neste filtro.",
    gradient: "from-sky-500 to-blue-600",
    soft: "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-400/10 dark:text-sky-200 dark:ring-sky-300/20",
  },
  resolvidas: {
    icon: Trophy,
    label: "Dominadas",
    eyebrow: "Retencao",
    emptyTitle: "Nenhuma resolvida ainda",
    emptyText: "As revisoes concluidas e os assuntos dominados aparecem aqui.",
    gradient: "from-amber-500 to-orange-500",
    soft: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-300/20",
  },
};

const ReviewStatCard = ({ icon: Icon, title, value, detail }) => (
  <article className="group relative flex min-h-[108px] flex-col justify-center overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white px-3 py-2.5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-light/40 hover:!border-l-red-500 hover:shadow-[0_0_18px_rgba(239,68,68,0.07)] dark:border-white/10 dark:!border-l-red-500/25 dark:bg-card-dark dark:hover:border-accent-light/20 dark:hover:!border-l-red-500 dark:hover:shadow-[0_0_22px_rgba(239,68,68,0.08)]">
    <div className="relative z-20 flex w-full flex-col gap-0.5">
      <h2 className="w-full truncate text-[10.5px] font-bold uppercase leading-none tracking-wider text-text-secondary dark:text-text-dark-secondary">
        {title}
      </h2>
      <div className="mt-1 flex items-baseline gap-1">
        <p className="text-xl font-extrabold leading-none tracking-tight text-text-primary dark:text-text-dark-primary md:text-2xl">
          {value}
        </p>
        <span className="truncate text-[10px] leading-none opacity-90">
          {detail}
        </span>
      </div>
    </div>
    <div className="pointer-events-none absolute -bottom-4 -right-4 z-10 text-red-500/10 transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] dark:text-red-500/5">
      {React.createElement(Icon, { strokeWidth: 1.5, className: "h-16 w-16 md:h-20 md:w-20" })}
    </div>
  </article>
);

const SourceToggleButton = ({ source, onToggle, cicloLogo, cronogramaLogo }) => {
  const isCiclo = source === "ciclo";
  const destinoLogo = isCiclo ? cronogramaLogo : cicloLogo;
  const destinoLabel = isCiclo ? "Cronograma" : "Ciclo";

  return (
    <Motion.button
      type="button"
      onClick={onToggle}
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.96 }}
      className="group relative inline-flex w-fit max-w-full shrink-0 items-center gap-1.5 self-start rounded-full border border-zinc-200 bg-white/90 py-1 pl-1.5 pr-3 shadow-md backdrop-blur-sm transition-all duration-200 hover:border-red-300 hover:shadow-lg dark:border-zinc-700 dark:bg-zinc-800/90 dark:hover:border-red-600"
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
    </Motion.button>
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
  const isDominado = !!item.dominado;
  const diasAtraso = item.diasAtraso ?? 0;
  const tempo = item.tempoMinutos || item.duracao || 20;
  const somenteLeitura = item.somenteLeitura === true;
  const desmarcarBloqueado = concluido && Boolean(item.bloqueiaDesmarcar || item.bloqueiaDesmarcarConclusao);

  return (
    <Motion.article
      layout
      className={cx(
        "group relative min-h-[92px] overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/10 dark:border-zinc-700/50 dark:bg-zinc-900 dark:hover:border-blue-900/40",
        concluido && "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/10",
        disabled && "pointer-events-none opacity-70"
      )}
    >
      <div className={cx("absolute bottom-0 left-0 top-0 w-1.5", concluido ? "bg-emerald-500/45" : diasAtraso > 0 ? "bg-red-500" : "bg-blue-500")} />
      <div className="flex flex-col gap-2 px-3 py-2.5 pl-4">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className={cx(
              "truncate text-[11px] font-black uppercase leading-tight tracking-wide sm:text-xs",
              concluido ? "text-emerald-700 line-through opacity-75 dark:text-emerald-300" : "text-zinc-900 dark:text-zinc-100"
            )}>
              {item.disciplinaNome || item.disciplina || "Disciplina"}
            </h3>
            <p className={cx("mt-1 line-clamp-2 text-[10px] font-bold leading-snug tracking-tight text-zinc-500 dark:text-zinc-300 sm:text-[11px]", concluido && "line-through decoration-emerald-500/60")}>
              {item.assunto || item.topico || "Tópico"}
            </p>
          </div>
          <span className="inline-flex min-w-[3.75rem] shrink-0 items-center justify-center gap-1 rounded-full border border-zinc-200 bg-white/85 px-2 py-0.5 text-[10px] font-black tabular-nums text-zinc-800 shadow-sm dark:border-white/15 dark:bg-white/15 dark:text-white">
            <Clock size={12} className="text-zinc-600 dark:text-zinc-200" />
            {fmtMin(tempo)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-black uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1"><CalendarDays size={11} />{fmtDate(getReviewDateValue(item))}</span>
          {diasAtraso > 0 && <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-300"><Flame size={11} />{diasAtraso}d de atraso</span>}
          {isDominado && <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300"><Trophy size={11} />Dominado</span>}
          {concluido && <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300"><CheckCircle2 size={11} />Concluída</span>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
            {onIniciar && !concluido && (
              <button
                type="button"
                onClick={() => onIniciar(item)}
                disabled={disabled}
                className="inline-flex h-7 items-center justify-center gap-1 rounded-lg bg-blue-600 px-2.5 text-[9px] font-black uppercase tracking-wider text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50"
              >
                <Play size={11} fill="currentColor" /> Iniciar
              </button>
            )}

            {!somenteLeitura && <button
              type="button"
              onClick={() => {
                if (desmarcarBloqueado) return;
                onConcluir(item);
              }}
              disabled={disabled || desmarcarBloqueado}
              className={cx(
                "inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-[9px] font-black uppercase tracking-wider shadow-sm transition-all disabled:opacity-60",
                desmarcarBloqueado || concluido ? "bg-emerald-500 text-white" : "border border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-white/10 dark:text-emerald-300"
              )}
              title={desmarcarBloqueado ? "Conclusao protegida por registro de revisao" : undefined}
            >
              {isLoading ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} strokeWidth={3} />}
              {desmarcarBloqueado ? "Registrada" : concluido ? "Alterar" : "Concluir"}
            </button>}

            {onDominar && tipo === "cronograma" && !concluido && (
              <button
                type="button"
                onClick={() => onDominar(item)}
                disabled={disabled}
                className={cx(
                  "inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-[9px] font-black uppercase tracking-wider ring-1 transition-all disabled:opacity-50",
                  isDominado
                    ? "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-300/20"
                    : "bg-white text-zinc-600 ring-zinc-200 hover:text-amber-700 dark:bg-white/[0.05] dark:text-zinc-300 dark:ring-white/10"
                )}
              >
                {actionType === "dominar" ? <RefreshCw size={11} className="animate-spin" /> : <Trophy size={11} />}
                Dominado
              </button>
            )}

            {onReagendar && diasAtraso > 0 && !concluido && (
              <button
                type="button"
                onClick={() => onReagendar(item)}
                disabled={disabled}
                className="inline-flex h-7 items-center justify-center gap-1 rounded-lg bg-red-50 px-2.5 text-[9px] font-black uppercase tracking-wider text-red-700 ring-1 ring-red-100 transition-all hover:bg-red-600 hover:text-white disabled:opacity-50 dark:bg-red-400/10 dark:text-red-200 dark:ring-red-300/20"
              >
                {actionType === "reagendar" ? <RefreshCw size={11} className="animate-spin" /> : <CalendarPlus size={11} />}
                Hoje
              </button>
            )}
        </div>
      </div>
    </Motion.article>
  );
};

const RevisaoListaTimeline = ({
  items,
  onConcluir,
  onIniciar,
  onDominar,
  onReagendar,
  actionLoading,
}) => {
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
    <Motion.div
      key="revisao-lista-operacional"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full"
    >
      <div className="space-y-5 pb-6">
        {gruposOrdenados.map((grupo) => {
          const isToday = formatDateKeyLocal(new Date()) === grupo.key;

          return (
            <section key={grupo.key}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <CalendarDays size={12} className={isToday ? "text-blue-600" : "text-zinc-400"} />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  {getReviewDateLabel(grupo.date)}
                </h3>
                {isToday && <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">Hoje</span>}
              </div>
              <div className="space-y-2.5">
                  {grupo.items.map((item) => {
                    const globalIndex = items.indexOf(item);
                    const actionId = getItemActionId(item);
                    return (
                      <ReviewTimelineItem
                        key={item.id || item.idUnique || item.slotId || actionId || globalIndex}
                        item={item}
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
            </section>
          );
        })}
      </div>
    </Motion.div>
  );
};

export function RevisaoPage({
  user,
  onStartStudy,
  addRegistroEstudo,
  deleteCompletionRegistro,
  onChoosePlan,
  registrosEstudo = [],
  disciplinasCiclo = [],
}) {
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
    if (typeof window === "undefined") return undefined;
    const onOptimisticProgress = (event) => {
      const registro = event?.detail || {};
      if (registro?.contextoRegistro !== "cronograma") return;
      setCronograma((prev) => (
        prev?.id === registro.cronogramaId
          ? applyCronogramaRegistroProgress(prev, registro)
          : prev
      ));
    };
    window.addEventListener(REGISTRO_PROGRESS_OPTIMISTIC_EVENT, onOptimisticProgress);
    return () => window.removeEventListener(REGISTRO_PROGRESS_OPTIMISTIC_EVENT, onOptimisticProgress);
  }, []);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const q = query(collection(db, "users", user.uid, "ciclos"), where("ativo", "==", true));
    return onSnapshot(q, (snap) => {
      setCicloAtivo(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
    });
  }, [user?.uid]);

  const revisoesCicloAtivas = useMemo(() => {
    if (!cicloAtivo?.id) return [];
    return todasRevisoesCiclo.filter((r) => r.cicloId === cicloAtivo.id);
  }, [todasRevisoesCiclo, cicloAtivo?.id]);
  const central = useMemo(() => buildRevisaoCentral({
    cronograma,
    ciclo: cicloAtivo ? { ...cicloAtivo, disciplinas: disciplinasCiclo } : null,
    revisoesCiclo: revisoesCicloAtivas,
    registrosEstudo,
    dataReferencia: new Date(),
  }), [cronograma, cicloAtivo, disciplinasCiclo, registrosEstudo, revisoesCicloAtivas]);
  const { hoje, atrasadas, proximas, resolvidas } = central.buckets;
  const listaAtual = useMemo(() => central.buckets[aba] || [], [aba, central.buckets]);
  const slotsExibidos = useMemo(() => filterRevisaoCentralItems(listaAtual, {
    origem: filtroFonte,
  }), [filtroFonte, listaAtual]);
  const totalGeral = central.metricas.total;
  const totalConcluidas = resolvidas.length;
  const resumoRevisoesFeitas = useMemo(() => registrosEstudo.reduce((resumo, registro) => {
    const isRevisao = registro?.isRevisao === true
      || registro?.revisao === true
      || String(registro?.tipoEstudo || "").toLowerCase() === "revisao";
    if (!isRevisao) return resumo;
    return {
      quantidade: resumo.quantidade + 1,
      minutos: resumo.minutos + Math.max(0, Number(registro?.tempoEstudadoMinutos || registro?.duracaoMinutos || 0)),
    };
  }, { quantidade: 0, minutos: 0 }), [registrosEstudo]);
  const progressoGeral = central.metricas.retencao;
  const concluidasHoje = hoje.filter((item) => item.concluido || item.concluida).length;
  const activeTab = TAB_TONES[aba] || TAB_TONES.hoje;
  const ActiveTabIcon = activeTab.icon;
  const handleConcluir = async (item) => {
    const actionId = getItemActionId(item);
    if (actionLoading) return;
    setActionLoading({ id: actionId, type: "concluir" });
    try {
      if (item._fonte === "ciclo") {
        const wasDone = Boolean(item.concluida || item.concluido);
        await concluirRevisaoCiclo(item.id, !wasDone);
        const completionRegistro = buildCompletionRegistro({
          context: "ciclo",
          item,
          ciclo: cicloAtivo,
          isReview: true,
          fallbackMinutes: 20,
        });
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
      { defaultContext: s._fonte === "cronograma" ? "cronograma" : "ciclo", tipoRegistro: "revisao" }
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

  const reagendarItem = async (s, dataDestino = new Date()) => {
    if (s._fonte === "ciclo") {
      await updateDoc(doc(db, "users", user.uid, "revisoesCiclo", s.id), {
        dataAgendada: formatDateKeyLocal(dataDestino)
      });
      return true;
    }
    if (!cronograma?.id) return false;
    return reagendarRevisaoCronograma(cronograma.id, s, dataDestino, cronograma.dataInicio);
  };

  const handleReagendar = async (s) => {
    const actionId = getItemActionId(s);
    if (actionLoading) return;
    setActionLoading({ id: actionId, type: "reagendar" });
    try {
      const ok = await reagendarItem(s, new Date());
      if (!ok) throw new Error("reagendamento-falhou");
      showToast("Reagendado para hoje");
    } catch {
      showToast("Erro ao reagendar");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || loadingRevisoesCiclo) return <div className="min-h-[calc(100vh-120px)]" />;

  const nenhuma = !cronograma && !cicloAtivo && revisoesCicloAtivas.length === 0;

  if (nenhuma) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] w-full items-center justify-center px-4 py-10">
        <Motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="group relative w-full max-w-2xl overflow-hidden rounded-[40px] border border-zinc-200 bg-white p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-card-dark dark:shadow-[0_30px_100px_rgba(0,0,0,0.3)] sm:px-12 sm:pb-9 sm:pt-12"
        >
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
              <img src="/logoModoQAP.png" alt="Logo Modo QAP" className="h-8 w-auto object-contain opacity-90 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
          </div>
        </Motion.div>
      </div>
    );
  }

  const tabs = [
    { id: "hoje", count: hoje.length, ...TAB_TONES.hoje },
    { id: "atrasadas", count: atrasadas.length, ...TAB_TONES.atrasadas },
    { id: "proximas", count: proximas.length, ...TAB_TONES.proximas },
    { id: "resolvidas", count: resolvidas.length, ...TAB_TONES.resolvidas },
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
          <Motion.div
            initial={{ opacity: 0, y: -18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.98 }}
            className="fixed left-1/2 top-24 z-[1000] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-zinc-800/10 bg-zinc-950/95 px-5 py-3 text-center text-xs font-black uppercase tracking-[0.18em] text-white shadow-2xl shadow-zinc-950/30 backdrop-blur-xl dark:border-white/10 dark:bg-white/95 dark:text-zinc-950"
          >
            {toast}
          </Motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 flex min-h-screen w-full flex-1 flex-col gap-5 px-3 pb-6 pt-4 sm:px-5 lg:px-7">
        <section className="shrink-0">
          <div className="relative mb-4 flex flex-row items-center justify-between gap-2 overflow-hidden rounded-2xl border border-zinc-300 bg-zinc-50 px-3 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:px-4 md:gap-6 md:px-6 md:py-4">
            {headerLogo ? (
              <div className="pointer-events-none absolute -bottom-2 right-1 h-20 w-20 rotate-[-10deg] opacity-25 transition-all duration-500 dark:opacity-35 md:-bottom-4 md:-right-4 md:h-44 md:w-44 md:opacity-20">
                <img src={headerLogo} alt="" className="h-full w-full object-contain saturate-150" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              </div>
            ) : (
              <div className="pointer-events-none absolute -bottom-4 -right-4 flex h-32 w-32 rotate-[-10deg] items-center justify-center opacity-10 dark:opacity-20 md:h-44 md:w-44">
                <ShieldCheck size={120} className="text-zinc-400 dark:text-zinc-500" />
              </div>
            )}

            <div className="relative z-10 hidden shrink-0 flex-col items-center gap-1">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-zinc-50 shadow-md dark:border-zinc-800 dark:bg-card-dark sm:h-12 sm:w-12 md:h-24 md:w-24 md:border-4 md:shadow-xl">
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
                    REVISÕES
                  </h1>
                  <span className="hidden items-center gap-1.5 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-500">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    Central ativa
                  </span>
                  <span className="hidden shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-blue-700 ring-1 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-300/20 md:px-2 md:text-[10px] md:tracking-widest">
                    {totalGeral} mapeadas
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

            <div className="z-10 flex w-[104px] shrink-0 items-center justify-between gap-1.5 rounded-xl border border-zinc-200 bg-white/75 p-1.5 shadow-sm dark:border-zinc-800 dark:bg-card-dark sm:w-[132px] md:w-auto md:min-w-[240px] md:gap-3 md:p-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 md:gap-5">
                  <div>
                    <p className="text-[7px] font-black uppercase tracking-wider text-zinc-400 md:text-[8px] md:tracking-widest">Meta</p>
                    <p className="font-mono text-[10px] font-black text-zinc-900 dark:text-white md:text-sm">{totalGeral}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[7px] font-black uppercase tracking-wider text-zinc-400 md:text-[8px] md:tracking-widest">Feito</p>
                    <p className="font-mono text-[10px] font-black text-zinc-900 dark:text-white md:text-sm">{totalConcluidas}</p>
                  </div>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/70 dark:bg-zinc-800 dark:ring-zinc-700/70 md:mt-2 md:h-1.5">
                  <Motion.div
                    initial={false}
                    animate={{ width: `${Math.min(progressoGeral, 100)}%` }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className={progressoGeral >= 100 ? "h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" : "h-full rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400"}
                  />
                </div>
              </div>
              <div className="relative shrink-0">
                <svg className="h-9 w-9 -rotate-90 sm:h-10 sm:w-10 md:h-14 md:w-14" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="6" />
                  <Motion.circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className={progressoGeral >= 100 ? "text-emerald-500" : progressoGeral > 0 ? "text-blue-600 dark:text-blue-500" : "text-zinc-400"} strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 34} initial={{ strokeDashoffset: 2 * Math.PI * 34 }} animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - Math.min(progressoGeral, 100) / 100) }} transition={{ duration: 1.5, ease: "easeOut" }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cx("text-[9px] font-black sm:text-[10px] md:text-sm", progressoGeral >= 100 ? "text-emerald-500" : progressoGeral > 0 ? "text-blue-600 dark:text-blue-500" : "text-zinc-400")}>{progressoGeral}%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <ReviewStatCard
            icon={CheckCircle2}
            title="Revisões feitas"
            value={resumoRevisoesFeitas.quantidade}
            detail="Concluídas"
          />
          <ReviewStatCard
            icon={AlertTriangle}
            title="Revisões críticas"
            value={central.metricas.atrasoCritico}
            detail="7+ dias"
          />
          <ReviewStatCard
            icon={Clock}
            title="Tempo de revisão feito"
            value={fmtMin(resumoRevisoesFeitas.minutos)}
            detail="Registrado"
          />
          <ReviewStatCard
            icon={Brain}
            title="Progresso de retenção"
            value={`${progressoGeral}%`}
            detail="Cobertura atual"
          />
        </section>

        <section className="overflow-x-auto rounded-lg bg-zinc-200/50 p-1 shadow-sm dark:bg-zinc-800">
          <div className="flex min-w-max items-center gap-1 sm:min-w-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = aba === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setAba(tab.id)}
                className={cx(
                  "flex min-w-[118px] flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors sm:min-w-0",
                  selected
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                )}
              >
                <Icon size={12} />
                <span className="truncate">{tab.label}</span>
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
        </section>

        <section className="grid min-h-0 w-full flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-h-[420px]">
            <AnimatePresence mode="wait">
              {slotsExibidos.length === 0 ? (
                <Motion.div
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
                </Motion.div>
              ) : (
                <RevisaoListaTimeline
                  items={slotsExibidos}
                  onConcluir={handleConcluir}
                  onIniciar={onStartStudy ? handleIniciar : null}
                  onDominar={handleDominar}
                  onReagendar={handleReagendar}
                  actionLoading={actionLoading}
                />
              )}
            </AnimatePresence>
          </div>
          <aside className="space-y-4">
            <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-card-dark sm:p-5">
              <div className="mb-4 flex items-center gap-2"><BarChart3 size={17} className="text-violet-600" /><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-600">Diagnóstico</p><h2 className="font-black">Por disciplina</h2></div></div>
              <div className="space-y-3">{central.diagnosticoDisciplinas.slice(0, 6).map((item) => <article key={item.id} className="rounded-2xl bg-zinc-50 p-3 dark:bg-white/[0.04]"><div className="flex items-start justify-between gap-2"><p className="min-w-0 text-sm font-black leading-tight">{item.nome}</p><span className={cx("rounded-md px-2 py-0.5 text-[9px] font-black uppercase", item.risco === "alto" ? "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300" : item.risco === "medio" ? "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300")}>{item.risco}</span></div><div className="mt-2 flex gap-3 text-[10px] font-bold text-zinc-500"><span>{item.atrasadas} atrasadas</span><span>{item.cobertura}% coberto</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"><div className="h-full rounded-full bg-violet-600" style={{ width: `${item.cobertura}%` }} /></div></article>)}</div>
            </section>
            <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-card-dark sm:p-5">
              <div className="flex items-center gap-2"><BookOpen size={17} className="text-blue-600" /><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">Edital + histórico</p><h2 className="font-black">Cobertura real</h2></div></div>
              <p className="mt-3 text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">{central.cobertura.semRevisaoRecente.length} assunto(s) do planejamento estão sem revisão recente. O cálculo usa os registros compartilhados por Histórico e Desempenho.</p>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-blue-50 p-3 dark:bg-blue-400/10"><span className="text-xs font-black text-blue-700 dark:text-blue-300">Retenção atual</span><span className="text-xl font-black text-blue-700 dark:text-blue-300">{progressoGeral}%</span></div>
              {central.cobertura.semRevisaoRecente.slice(0, 3).map((item) => <p key={`${item.disciplinaId}:${item.assunto}`} className="mt-2 line-clamp-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">• {item.disciplinaNome}: {item.assunto}</p>)}
            </section>
          </aside>
        </section>

      </main>
    </div>
  );
}

export default RevisaoPage;
