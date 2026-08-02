import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, BookOpen, Play, Clock, Target, Trophy, CheckCircle2, Sparkles, RotateCw } from 'lucide-react';
import { getCycleAssuntoForSession, getCycleSessionRecordedMinutes } from '../../utils/studyDayStatus';
import { getDisciplineColorForSlot } from '../../utils/disciplineColors';

// --- HELPER: Formatador Inteligente de Horas ---
const formatVisualHours = (minutes) => {
  if (!minutes || isNaN(minutes)) return '0h';

  let totalMinutes = Math.round(Number(minutes));

  // Lógica de arredondamento visual (imã)
  const remainder = totalMinutes % 60;
  if (remainder > 50) {
    totalMinutes = Math.ceil(totalMinutes / 60) * 60;
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours === 0) {
      return `${mins}m`;
  } else if (mins === 0) {
      return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
};

const CICLO_CONCLUIDO_COLOR = '#10b981';

// AJUSTES MANUAIS DO MIOLO DO CICLO VISUAL.
// Cada item fica em uma faixa horizontal dentro de um circulo real.
// top move para baixo/cima; x move para direita/esquerda.
const CYCLE_CENTER_MANUAL_LAYOUT = {
  circle: { size: 66, center: 33, radius: 31, safePadding: 2.2 },
  disciplina: { x: 0, top: 10.8, height: 10.2, maxWidth: 49, fontSize: 3.8, lineHeight: 1.12, maxLines: 2, topPadding: 1.2, bottomPadding: 0.4 },
  bloco: { x: 0, top: 20, height: 3.5, maxWidth: 44, fontSize: 2.25 },
  assunto: { x: 0, top: 25.2, height: 9.2, maxWidth: 53, fontSize: 2.7, lineHeight: 1.2, maxLines: 2, topPadding: 0.8, bottomPadding: 0.1 },
  tempo: { x: 0, top: 35.4, height: 7.8, maxWidth: 40, valueFontSize: 5.55, totalFontSize: 2.35 },
  actions: { x: 0, top: 43.4, height: 5.8, maxWidth: 39, gap: 0.75, buttonHeight: 5.15, startWidth: 16.5, endWidth: 17.8, singleWidth: 20.5, fontSize: 2.05, radius: 2.6 },
};

// TAMANHO DO CICLO VISUAL.
// Ajuste aqui o radar padrão e o radar usado no preview do wizard.
// mobileMax/desktopMax controlam o limite absoluto; viewportOffset controla
// quanto da altura da tela fica reservado para textos/botoes ao redor.
const CYCLE_VISUAL_SIZE_PRESETS = {
  default: {
    mobileMax: 430,
    mobileViewportOffset: 255,
    mobileViewportWidth: 88,
    desktopMax: 560,
    desktopViewportOffset: 285,
    desktopViewportWidth: 78,
    parentOffset: 20,
  },
  preview: {
    mobileMax: 540,
    mobileViewportOffset: 160,
    mobileViewportWidth: 96,
    desktopMax: 820,
    desktopViewportOffset: 115,
    desktopViewportWidth: 88,
    parentOffset: 6,
  },
};

const centerClampStyle = ({ maxLines, fontSize, lineHeight, topPadding = 0, bottomPadding = 0 } = {}) => {
  const lineBox = Number(fontSize || 0) * Number(lineHeight || 1);
  const clampHeight = (lineBox * Number(maxLines || 1)) + Number(topPadding || 0) + Number(bottomPadding || 0);

  return {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: maxLines,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    whiteSpace: 'normal',
    paddingTop: `${topPadding}px`,
    paddingBottom: `${bottomPadding}px`,
    boxSizing: 'border-box',
    height: `${clampHeight}px`,
    maxHeight: `${clampHeight}px`,
  };
};

const getCenterChordWidth = (slot) => {
  const { center, radius, safePadding } = CYCLE_CENTER_MANUAL_LAYOUT.circle;
  const slotMiddle = Number(slot.top || 0) + Number(slot.height || 0) / 2;
  const distanceFromCenter = Math.abs(slotMiddle - center);
  const chord = 2 * Math.sqrt(Math.max(0, radius ** 2 - distanceFromCenter ** 2));
  return Math.max(0, chord - safePadding * 2);
};

const centerCircularSlotStyle = (slot) => {
  const safeWidth = getCenterChordWidth(slot);
  const width = Math.min(Number(slot.maxWidth || safeWidth), safeWidth);

  return {
    position: 'absolute',
    top: `${slot.top}px`,
    left: '50%',
    width: `${width}px`,
    height: `${slot.height}px`,
    overflow: 'hidden',
    transform: `translateX(-50%) translateX(${slot.x || 0}px)`,
  };
};

const centerButtonStyle = (width) => ({
  width: `${width}px`,
  height: `${CYCLE_CENTER_MANUAL_LAYOUT.actions.buttonHeight}px`,
  borderRadius: `${CYCLE_CENTER_MANUAL_LAYOUT.actions.radius}px`,
  fontSize: `${CYCLE_CENTER_MANUAL_LAYOUT.actions.fontSize}px`,
});

// --- COMPONENTE DE SEGMENTO (BLOCO) ---
const CicloSegment = ({
  startAngle,
  angle,
  radius,
  color,
  disciplina,
  progressPercentage,
  concluida,
  isActive,
  isRecentlyCompleted,
  onHover,
  onLeave,
  onClick
}) => {
  const toRad = (deg) => (deg * Math.PI) / 180;

  const createArc = (start, end, r) => {
    if (Math.abs(end - start) < 0.001) {
        const startRad = toRad(start - 90);
        const x1 = 50 + r * Math.cos(startRad);
        const y1 = 50 + r * Math.sin(startRad);
        return ['M', x1, y1].join(' ');
    }

    if (Math.abs(end - start) >= 360) end = start + 359.99;

    const startRad = toRad(start - 90);
    const endRad = toRad(end - 90);
    const x1 = 50 + r * Math.cos(startRad);
    const y1 = 50 + r * Math.sin(startRad);
    const x2 = 50 + r * Math.cos(endRad);
    const y2 = 50 + r * Math.sin(endRad);

    const largeArcFlag = end - start <= 180 ? 0 : 1;
    const sweepFlag = 1;

    return ['M', x1, y1, 'A', r, r, 0, largeArcFlag, sweepFlag, x2, y2].join(' ');
  };

  const gap = 3;
  const visualAngle = angle > gap ? angle - gap : 0;
  const strokeWidth = 17;
  const midAngle = startAngle + (visualAngle / 2);
  const midRad = toRad(midAngle - 90);
  const badgeRadius = radius + 1.5;
  const badgeX = 50 + badgeRadius * Math.cos(midRad);
  const badgeY = 50 + badgeRadius * Math.sin(midRad);
  const bgPath = createArc(startAngle, startAngle + visualAngle, radius);
  const initialPath = createArc(startAngle, startAngle, radius);

  return (
    <g
      onMouseEnter={() => onHover(disciplina.id)}
      onMouseLeave={onLeave}
      onClick={() => onClick(disciplina)}
      className="cursor-pointer group"
      style={{ opacity: isActive ? 0.96 : 0.72, transition: 'opacity 0.3s ease' }}
    >
      {concluida && (
        <motion.path
          d={bgPath}
          fill="none"
          stroke={CICLO_CONCLUIDO_COLOR}
          strokeWidth={strokeWidth + 3}
          strokeOpacity={0.18}
          strokeLinecap="butt"
          initial={{ opacity: 0 }}
          animate={isRecentlyCompleted ? { opacity: [0.15, 0.34, 0.18] } : { opacity: 0.18 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      )}
      <motion.path
        initial={{ d: initialPath }}
        animate={{ d: bgPath }}
        transition={{ duration: 0.35, ease: 'circOut' }}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeOpacity={isActive ? 0.58 : 0.36}
        strokeLinecap="butt"
      />
      {concluida && (
        <>
          <motion.circle
            cx={badgeX}
            cy={badgeY}
            r="2.5"
            fill={CICLO_CONCLUIDO_COLOR}
            stroke="white"
            strokeWidth="0.8"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={isRecentlyCompleted ? { scale: [0.8, 1.18, 1], opacity: [0.3, 1, 1] } : { scale: 1, opacity: 1 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          />
          <motion.path
            d={`M ${badgeX - 0.95} ${badgeY + 0.05} L ${badgeX - 0.2} ${badgeY + 0.8} L ${badgeX + 1.25} ${badgeY - 0.95}`}
            fill="none"
            stroke="white"
            strokeWidth="0.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.18, delay: 0.04, ease: 'easeOut' }}
          />
          {isRecentlyCompleted && (
            <motion.circle
              cx={badgeX}
              cy={badgeY}
              r="2.6"
              fill="none"
              stroke={CICLO_CONCLUIDO_COLOR}
              strokeWidth="0.6"
              initial={{ scale: 1, opacity: 0.55 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            />
          )}
        </>
      )}
      {isActive && (
        <path
          d={bgPath}
          fill="none"
          stroke="white"
          strokeWidth={strokeWidth}
          strokeOpacity={0.12}
          strokeLinecap="butt"
          className="pointer-events-none"
        />
      )}
    </g>
  );
};

// --- CÍRCULO INTERNO SEMANAL ---
const WeeklyProgressRing = ({ percentage, isConcluido }) => {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const safePercentage = Math.min(100, Math.max(0, Number(percentage) || 0));
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;
  const progressStroke = isConcluido ? CICLO_CONCLUIDO_COLOR : safePercentage > 0 ? '#f59e0b' : 'transparent';

  return (
    <g className="pointer-events-none">
      <circle
        cx="50" cy="50" r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="text-zinc-300 dark:text-zinc-700 opacity-60"
        transform="rotate(-90 50 50)"
      />
      <motion.circle
        cx="50" cy="50" r={radius}
        fill="none"
        stroke={progressStroke}
        strokeWidth={isConcluido ? '3.5' : '2.5'}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: isConcluido ? 0 : strokeDashoffset }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        transform="rotate(-90 50 50)"
      />
    </g>
  );
};

// --- OVERLAY DE CICLO CONCLUÍDO (centro do SVG via foreignObject) ---
const CicloConcluídoCenter = ({ onConcluir, loading, conclusoes }) => (
  <foreignObject x="15" y="15" width="70" height="70" className="pointer-events-auto">
    <div className="w-full h-full flex flex-col items-center justify-center text-center rounded-full">
      <motion.div
        key="concluido"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.7 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        className="flex flex-col items-center justify-center w-full h-full px-1"
      >
        {/* Ícone de check pulsante */}
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="mb-0.5"
        >
          <CheckCircle2
            className="text-emerald-500 drop-shadow-[0_0_6px_rgba(16,185,129,0.7)]"
            strokeWidth={2.5}
            style={{ width: '10px', height: '10px' }}
          />
        </motion.div>

        <span className="text-[3px] font-black uppercase tracking-[0.15em] text-emerald-500 leading-tight mb-0.5">
          Ciclo
        </span>
        <span className="text-[3px] font-black uppercase tracking-[0.15em] text-emerald-500 leading-tight mb-1">
          Completo!
        </span>

        {/* Botão de concluir compacto */}
        <motion.button
          onClick={onConcluir}
          disabled={loading}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-black uppercase tracking-wide disabled:opacity-60 flex items-center justify-center gap-[1px] shadow-lg shadow-emerald-500/40"
          style={{ fontSize: '2.2px', padding: '1.5px 4px', lineHeight: 1.4 }}
        >
          <Trophy style={{ width: '3px', height: '3px' }} strokeWidth={2.5} />
          Concluir
        </motion.button>
      </motion.div>
    </div>
  </foreignObject>
);

const CycleResetAnimation = ({ conclusoes = 0 }) => (
  <motion.div
    key="cycle-reset-animation"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.25 }}
    className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
  >
    <motion.div
      className="absolute inset-0 rounded-full bg-white/75 backdrop-blur-[2px] dark:bg-zinc-950/70"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.92, 0.86] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    />

    <motion.div
      className="absolute h-[84%] w-[84%] rounded-full border-2 border-emerald-400/50"
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: [0.96, 1.06, 0.94], opacity: [0, 1, 0] }}
      transition={{ duration: 1.45, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute h-[68%] w-[68%] rounded-full border border-amber-300/70"
      initial={{ scale: 1.12, rotate: 0, opacity: 0 }}
      animate={{ scale: [1.12, 0.72, 0.54], rotate: 270, opacity: [0, 1, 0] }}
      transition={{ duration: 1.65, ease: 'circInOut', delay: 0.15 }}
    />
    <motion.div
      className="absolute h-[52%] w-[52%] rounded-full bg-emerald-500/10 blur-xl"
      animate={{ scale: [0.8, 1.15, 0.85], opacity: [0.2, 0.65, 0.2] }}
      transition={{ duration: 1.4, repeat: 1, ease: 'easeInOut' }}
    />

    {Array.from({ length: 12 }, (_, index) => {
      const angle = (index / 12) * Math.PI * 2;
      const x = Math.cos(angle) * 120;
      const y = Math.sin(angle) * 120;
      return (
        <motion.span
          key={index}
          className="absolute h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.8)]"
          initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
          animate={{ x, y, scale: [0.4, 1, 0.2], opacity: [0, 1, 0] }}
          transition={{ duration: 1.15, delay: 0.12 + index * 0.025, ease: 'easeOut' }}
        />
      );
    })}

    <motion.div
      initial={{ scale: 0.78, y: 12, opacity: 0 }}
      animate={{ scale: [0.78, 1.04, 1], y: [12, -4, 0], opacity: 1 }}
      exit={{ scale: 0.92, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 18 }}
      className="relative flex h-36 w-36 flex-col items-center justify-center rounded-full border border-emerald-200 bg-white text-center shadow-2xl shadow-emerald-500/25 dark:border-emerald-900/50 dark:bg-zinc-950"
    >
      <motion.div
        className="absolute inset-2 rounded-full border-4 border-emerald-500"
        animate={{ rotate: [0, 270], scale: [1, 0.86, 0.72], opacity: [1, 0.8, 0] }}
        transition={{ duration: 1.55, ease: 'circInOut', delay: 0.35 }}
      />
      <motion.div
        className="relative mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
        animate={{ rotate: [0, 14, -10, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 1.25, delay: 0.2 }}
      >
        <RotateCw size={24} />
      </motion.div>
      <p className="relative text-[9px] font-black uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">
        Ciclo zerado
      </p>
      <p className="relative mt-1 text-2xl font-black leading-none text-zinc-950 dark:text-white">
        {Number(conclusoes || 0)}x
      </p>
      <p className="relative mt-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
        Nova volta pronta
      </p>
    </motion.div>
  </motion.div>
);

function CicloVisual({
  selectedDisciplinaId,
  onSelectDisciplina,
  onViewDetails,
  onStartStudy,
  disciplinas,
  registrosEstudo,
  viewMode,
  ciclo,
  isLoading,
  canConcludeCiclo,
  onMarcarSessao,
  onConcluirCiclo,
  cicloActionLoading,
  showAssuntos,
  hideActionButtons = false,
  sizePreset = 'default',
  isResetAnimating = false,
}) {
  const [hoveredId, setHoveredId] = useState(null);
  const [viewCiclo, setViewCiclo] = useState('completo');
  const [disciplinaFocada, setDisciplinaFocada] = useState(null);
  const [recentlyCompletedIndex, setRecentlyCompletedIndex] = useState(null);
  const previousConcluidasRef = useRef(ciclo?.sessoesConcluidas || []);
  const previousIsConcluidoRef = useRef(false);

  // Detecta se é ciclo novo (com sessões) ou ciclo legado (por carga horária)
  const isModoCicloSessoes = !!(ciclo?.ordemSessoes?.length);
  const shouldShowAssuntos = typeof showAssuntos === 'boolean'
    ? showAssuntos
    : ciclo?.modoExibirAssuntos !== false;
  const cycleVisualSize = CYCLE_VISUAL_SIZE_PRESETS[sizePreset] || CYCLE_VISUAL_SIZE_PRESETS.default;
  const shouldUseDisciplineColors = ciclo?.coresDisciplinasAtivas !== false;
  const coresDisciplinas = useMemo(() => {
    const mapa = {};
    disciplinas.forEach((d) => {
      if (!shouldUseDisciplineColors) {
        mapa[d.id] = '#71717a';
        return;
      }
      const color = getDisciplineColorForSlot({
        disciplinaId: d.id,
        disciplinaNome: d.nome,
        disciplina: d.nome,
        cor: d.cor,
      });
      mapa[d.id] = color?.hex || '#71717a';
    });
    return mapa;
  }, [disciplinas, shouldUseDisciplineColors]);

  useEffect(() => {
    if (!isModoCicloSessoes) return undefined;

    const atuais = Array.isArray(ciclo?.sessoesConcluidas) ? ciclo.sessoesConcluidas : [];
    const anteriores = Array.isArray(previousConcluidasRef.current) ? previousConcluidasRef.current : [];
    const novaConclusao = atuais.find((index) => !anteriores.includes(index));

    if (typeof novaConclusao === 'number') {
      setRecentlyCompletedIndex(novaConclusao);
      const timeoutId = window.setTimeout(() => {
        setRecentlyCompletedIndex((current) => (current === novaConclusao ? null : current));
      }, 1600);
      previousConcluidasRef.current = atuais;
      return () => window.clearTimeout(timeoutId);
    }

    previousConcluidasRef.current = atuais;
    return undefined;
  }, [ciclo?.sessoesConcluidas, isModoCicloSessoes]);

  useEffect(() => {
    if (!isResetAnimating) return;
    setViewCiclo('completo');
    setDisciplinaFocada(null);
    onSelectDisciplina?.(null);
  }, [isResetAnimating, onSelectDisciplina]);

  const dataLegado = useMemo(() => {
    if (!disciplinas.length) return [];

    const totalMetaRaw = disciplinas.reduce((acc, d) => acc + Number(d.tempoAlocadoSemanalMinutos || 0), 0);
    const totalMetaLocal = Math.round(totalMetaRaw);

    let currentAngle = 0;

    return disciplinas.map((disciplina) => {
      const metaMinutos = Number(disciplina.tempoAlocadoSemanalMinutos || 0);
      const angle = totalMetaLocal > 0 ? (metaMinutos / totalMetaLocal) * 360 : 0;

      let progressMinutos = 0;

      registrosEstudo.forEach(reg => {
        if (reg.disciplinaId === disciplina.id) {
          const minutosReg = Number(reg.tempoEstudadoMinutos || 0);
          progressMinutos += minutosReg;
        }
      });

      const percentage = metaMinutos > 0 ? (progressMinutos / metaMinutos) * 100 : 0;

      let color;
      if (percentage === 0) {
        color = '#71717a';
      } else if (percentage >= 100) {
        color = CICLO_CONCLUIDO_COLOR;
      } else {
        color = '#eab308';
      }

      const segmentData = {
        key: disciplina.id,
        globalIndex: -1,
        disciplina,
        metaMinutos,
        progressMinutos,
        percentage,
        startAngle: currentAngle,
        angle,
        color,
      };

      currentAngle += angle;
      return segmentData;
    });
  }, [disciplinas, registrosEstudo, viewMode, ciclo]);

  const data = useMemo(() => {
    if (!disciplinas.length || !ciclo?.ordemSessoes?.length) return [];

    const ordemSessoes = ciclo.ordemSessoes || [];
    const sessoesConcluidasSet = new Set(ciclo.sessoesConcluidas || []);
    const tempoSessao = ciclo.tempoSessaoMinutos || 50;
    const progressoSessoes = ciclo.progressoSessoes || {};

    const totalSessoesLocal = ordemSessoes.length;
    const anguloPorSessao = totalSessoesLocal > 0 ? 360 / totalSessoesLocal : 0;

    let currentAngle = 0;

    return ordemSessoes.map((sessao, globalIndex) => {
      const disciplina = disciplinas.find(d => d.id === sessao.disciplinaId);
      if (!disciplina) return null;

      const progressoPersistido = Number(progressoSessoes?.[globalIndex] || progressoSessoes?.[String(globalIndex)] || 0);
      const progressoRegistrado = getCycleSessionRecordedMinutes({
        ciclo,
        session: sessao,
        globalIndex,
        registrosEstudo,
        disciplina,
        allowLooseMatch: false,
      });
      const progressoMinutos = Math.max(progressoPersistido, progressoRegistrado);
      const concluida = sessoesConcluidasSet.has(globalIndex) || progressoMinutos >= tempoSessao;
      const corBase = coresDisciplinas[disciplina.id] || '#71717a';
      const percentage = tempoSessao > 0 ? Math.min(100, Math.round((progressoMinutos / tempoSessao) * 100)) : 0;
      const color = concluida ? CICLO_CONCLUIDO_COLOR : progressoMinutos > 0 ? '#f59e0b' : corBase;

      const segmentData = {
        key: `sessao-${globalIndex}`,
        globalIndex,
        disciplina,
        sessaoIndex: sessao.sessaoIndex,
        concluida,
        startAngle: currentAngle,
        angle: anguloPorSessao,
        color,
        corBase,
        metaMinutos: tempoSessao,
        progressMinutos: progressoMinutos,
        percentage,
        ...getCycleAssuntoForSession(ciclo, { ...sessao, globalIndex }, disciplina),
      };

      currentAngle += anguloPorSessao;
      return segmentData;
    }).filter(Boolean);
  }, [disciplinas, ciclo, coresDisciplinas, registrosEstudo]);

  const dataViewAtual = useMemo(() => {
    if (!isModoCicloSessoes) return dataLegado;

    if (viewCiclo === 'completo') return data;

    if (viewCiclo === 'disciplina' && !disciplinaFocada) {
      const totalSessoesLocal = ciclo.totalSessoesCiclo || data.length;
      let currentAngle = 0;
      return disciplinas.map((disc) => {
        const sessoesDisc = data.filter(s => s.disciplina.id === disc.id);
        const concluidasDisc = sessoesDisc.filter(s => s.concluida).length;
        const totalDisc = disc.sessoesPorCiclo || sessoesDisc.length;
        const angulo = totalSessoesLocal > 0 ? (totalDisc / totalSessoesLocal) * 360 : 0;
        const metaMinutos = totalDisc * (ciclo.tempoSessaoMinutos || 50);
        const progressMinutos = sessoesDisc.reduce((acc, sessao) => acc + Math.min(Number(sessao.progressMinutos || 0), Number(sessao.metaMinutos || ciclo.tempoSessaoMinutos || 50)), 0);
        const percentage = metaMinutos > 0 ? (progressMinutos / metaMinutos) * 100 : 0;
        const corBase = coresDisciplinas[disc.id] || '#71717a';
        const seg = {
          key: `disc-${disc.id}`,
          globalIndex: -1,
          disciplina: disc,
          sessaoIndex: -1,
          concluida: percentage === 100,
          startAngle: currentAngle,
          angle: angulo,
          color: corBase,
          corBase,
          metaMinutos,
          progressMinutos,
          percentage,
          isDisciplinaAgregada: true,
          totalSessoesDisciplina: totalDisc,
          concluidasDisciplina: concluidasDisc,
        };
        currentAngle += angulo;
        return seg;
      });
    }

    if (viewCiclo === 'disciplina' && disciplinaFocada) {
      const sessoesDisc = data.filter(s => s.disciplina.id === disciplinaFocada);
      const angulo = sessoesDisc.length > 0 ? 360 / sessoesDisc.length : 0;
      let currentAngle = 0;
      return sessoesDisc.map(s => {
        const seg = { ...s, startAngle: currentAngle, angle: angulo };
        currentAngle += angulo;
        return seg;
      });
    }

    return data;
  }, [data, viewCiclo, disciplinaFocada, disciplinas, ciclo, isModoCicloSessoes, dataLegado, coresDisciplinas]);

  const activeDisciplina = useMemo(() => {
    const id = hoveredId || selectedDisciplinaId;
    if (!id) return null;
    return dataViewAtual.find(d =>
      d.key === id ||
      d.disciplina.id === id ||
      `${d.disciplina.id}-${d.globalIndex}` === id
    );
  }, [hoveredId, selectedDisciplinaId, dataViewAtual]);

  const totalSessoes = isModoCicloSessoes ? data.length : dataLegado.reduce((acc, d) => acc + d.metaMinutos, 0);
  const sessoesConcluidas = isModoCicloSessoes ? data.filter(s => s.concluida).length : dataLegado.reduce((acc, d) => acc + d.progressMinutos, 0);

  const totalEstudado = isModoCicloSessoes
    ? data.reduce((acc, sessao) => acc + Math.min(Number(sessao.progressMinutos || 0), Number(sessao.metaMinutos || ciclo?.tempoSessaoMinutos || 50)), 0)
    : dataLegado.reduce((acc, d) => acc + d.progressMinutos, 0);
  const totalMeta = isModoCicloSessoes
    ? totalSessoes * (ciclo?.tempoSessaoMinutos || 50)
    : dataLegado.reduce((acc, d) => acc + d.metaMinutos, 0);
  const progressoGeral = totalMeta > 0 ? (totalEstudado / totalMeta) * 100 : 0;

  const isConcluido = isModoCicloSessoes
    ? totalMeta > 0 && totalEstudado >= totalMeta
    : !!canConcludeCiclo;

  useEffect(() => {
    const acabouDeConcluir = isConcluido && !previousIsConcluidoRef.current;
    previousIsConcluidoRef.current = isConcluido;
    if (!acabouDeConcluir) return;
    setHoveredId(null);
    setDisciplinaFocada(null);
    onSelectDisciplina?.(null);
  }, [isConcluido, onSelectDisciplina]);

  const handleSegmentClick = (seg) => {
    if (isModoCicloSessoes && viewCiclo === 'disciplina' && !disciplinaFocada) {
      if (seg.isDisciplinaAgregada) {
        onSelectDisciplina(seg.disciplina.id);
      }
      return;
    }

    if (isModoCicloSessoes) {
      if (seg.globalIndex >= 0) {
        const sessionKey = `${seg.disciplina.id}-${seg.globalIndex}`;
        onSelectDisciplina(sessionKey === selectedDisciplinaId ? null : sessionKey);
      }
      return;
    }

    onSelectDisciplina(seg.disciplina.id === selectedDisciplinaId ? null : seg.disciplina.id);
  };

  const getNextPendingSessionForDisciplina = (disciplinaId) => (
    data.find((sessao) => sessao.disciplina.id === disciplinaId && !sessao.concluida) || null
  );

  const handleConcluirDisciplinaAgregada = (disciplinaId) => {
    const sessao = getNextPendingSessionForDisciplina(disciplinaId);
    if (sessao) onMarcarSessao?.(sessao.globalIndex, sessao);
  };

  if (!disciplinas.length) {
     return <div className="text-zinc-500 text-center py-10">Nenhuma disciplina alocada neste ciclo.</div>;
  }

  return (
    <div className="flex h-full w-full">
      <div className="flex h-full w-full animate-fade-in flex-col items-stretch justify-center px-1">

        {/* --- ÁREA DO GRÁFICO --- */}
        <div id="ciclo-radar-chart" className="relative flex h-full min-h-0 w-full flex-1 flex-col items-center overflow-visible group">
          <AnimatePresence>
            {isResetAnimating && <CycleResetAnimation conclusoes={ciclo?.conclusoes || 0} />}
          </AnimatePresence>

          {isModoCicloSessoes && (
            <div className="relative z-20 mb-2 flex flex-col items-center sm:mb-3">
              <div className="flex flex-wrap items-center gap-2 justify-center rounded-full bg-white/55 p-1 shadow-sm ring-1 ring-zinc-200/60 backdrop-blur-md dark:bg-zinc-950/35 dark:ring-zinc-800/60">
                <button
                  onClick={() => { setViewCiclo('completo'); setDisciplinaFocada(null); onSelectDisciplina(null); }}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all sm:px-4 sm:text-xs ${
                    viewCiclo === 'completo'
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
                  }`}
                >
                  Ciclo completo
                </button>
                <button
                  onClick={() => setViewCiclo('disciplina')}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all sm:px-4 sm:text-xs ${
                    viewCiclo === 'disciplina'
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
                  }`}
                >
                  Por disciplina
                </button>
              </div>
              {disciplinaFocada && viewCiclo === 'disciplina' && (
                <button
                  onClick={() => { setDisciplinaFocada(null); onSelectDisciplina(null); }}
                  className="mt-2 flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-zinc-500 shadow-sm ring-1 ring-zinc-200/70 transition-colors hover:text-zinc-800 dark:bg-zinc-950/50 dark:ring-zinc-800/70 dark:hover:text-white"
                >
                  ← Voltar às disciplinas
                </button>
              )}
              {!hideActionButtons && (
                <p className="mt-1 text-center text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 sm:text-[10px]">
                  Clique em uma disciplina ou bloco de estudo para abrir as acoes.
                </p>
              )}
            </div>
          )}

          <div className="flex min-h-0 w-full flex-1 items-center justify-center">
            <div
              className="ciclo-visual-size-box aspect-square max-h-full max-w-full shrink-0"
              style={{
                '--ciclo-visual-size-mobile': `min(calc(100% - ${cycleVisualSize.parentOffset}px), calc(100vh - ${cycleVisualSize.mobileViewportOffset}px), ${cycleVisualSize.mobileViewportWidth}vw, ${cycleVisualSize.mobileMax}px)`,
                '--ciclo-visual-size-desktop': `min(calc(100% - ${cycleVisualSize.parentOffset}px), calc(100vh - ${cycleVisualSize.desktopViewportOffset}px), ${cycleVisualSize.desktopViewportWidth}vw, ${cycleVisualSize.desktopMax}px)`,
              }}
            >
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-lg">
              {dataViewAtual.map((seg) => {
                const { key, ...props } = seg;
                return (
                  <CicloSegment
                    key={key}
                    radius={42.5}
                    {...props}
                    progressPercentage={seg.percentage}
                    concluida={!!seg.concluida}
                    isActive={activeDisciplina?.key === seg.key}
                    isRecentlyCompleted={seg.globalIndex === recentlyCompletedIndex}
                    onHover={() => setHoveredId(seg.key)}
                    onLeave={() => setHoveredId(null)}
                    onClick={() => handleSegmentClick(seg)}
                  />
                );
              })}

              <WeeklyProgressRing percentage={progressoGeral} isConcluido={isConcluido} />

              {/* --- INFO CENTRAL --- */}
              <AnimatePresence mode="wait">
                {isConcluido ? (
                  // OVERLAY DE CICLO CONCLUÍDO — substitui o conteúdo central
                  <motion.g
                    key="concluido-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    {/* Fundo verde translúcido no centro */}
                    <motion.circle
                      cx="50" cy="50" r="29"
                      fill={CICLO_CONCLUIDO_COLOR}
                      initial={{ opacity: 0, r: 0 }}
                      animate={{ opacity: 0.12, r: 29 }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                    {/* Anel pulsante externo */}
                    <motion.circle
                      cx="50" cy="50" r="29"
                      fill="none"
                      stroke={CICLO_CONCLUIDO_COLOR}
                      strokeWidth="0.5"
                      strokeOpacity={0.4}
                      animate={{ r: [29, 31, 29], opacity: [0.4, 0.1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                    />
                    <CicloConcluídoCenter
                      onConcluir={onConcluirCiclo}
                      loading={cicloActionLoading}
                      conclusoes={ciclo?.conclusoes || 0}
                    />
                  </motion.g>
                ) : (
                  <foreignObject key="center-info" id="ciclo-center-info" x="17" y="17" width="66" height="66" className="pointer-events-none">
                    <div
                      className="pointer-events-none w-full h-full flex flex-col items-center justify-center overflow-hidden text-center rounded-full bg-white/88 p-[3px] shadow-[0_14px_45px_rgba(15,23,42,0.14)] ring-[0.6px] ring-zinc-200/80 backdrop-blur-md dark:bg-zinc-950/82 dark:ring-zinc-800/80"
                      style={{ clipPath: 'circle(50% at 50% 50%)' }}
                    >
                      <AnimatePresence mode="wait">
                        {!activeDisciplina ? (
                          <motion.div
                            key="total"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex h-full w-full flex-col items-center justify-center rounded-full border border-zinc-100/80 px-2 dark:border-zinc-800/80"
                          >
                            {isModoCicloSessoes ? (
                              <>
                                <span className="text-[3.6px] md:text-[3.1px] font-extrabold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-300 mb-1">
                                  HORAS
                                </span>
                                <div className="flex items-baseline justify-center gap-[1px]">
                                  <span className="text-[10px] md:text-[9.5px] font-black text-zinc-900 dark:text-white leading-none tracking-tighter">
                                    {formatVisualHours(totalEstudado)}
                                  </span>
                                  <span className="text-[4.4px] text-zinc-500 dark:text-zinc-300 font-black">/ {formatVisualHours(totalMeta)}</span>
                                </div>
                                <div className="w-6 h-[0.5px] bg-zinc-300 dark:bg-zinc-700 my-1"></div>
                                <span className="text-[3.35px] md:text-[3px] font-black text-zinc-500 dark:text-zinc-300 uppercase tracking-wide">
                                  {sessoesConcluidas}/{totalSessoes} blocos
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-[3.5px] md:text-[2.7px] font-extrabold uppercase tracking-[0.2em] text-zinc-400 mb-1">
                                  {viewMode === 'semanal' ? 'SEMANA' : 'TOTAL'}
                                </span>

                                <div className="flex items-baseline justify-center">
                                  <span className="text-[10px] md:text-[9.5px] font-black text-zinc-800 dark:text-white leading-none tracking-tighter">
                                    {formatVisualHours(totalEstudado)}
                                  </span>
                                </div>

                                <div className="w-6 h-[0.5px] bg-zinc-300 dark:bg-zinc-700 my-1"></div>

                                <div className="flex flex-col items-center">
                                  <span className="text-[3.5px] md:text-[3.2px] font-black text-zinc-500 dark:text-zinc-300 uppercase tracking-wide">
                                    Meta: {formatVisualHours(totalMeta)}
                                  </span>
                                </div>
                              </>
                            )}
                          </motion.div>
                        ) : (
                          <motion.div
                            key="disciplina"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative h-full w-full rounded-full"
                          >
                            <span
                              className="text-center font-extrabold normal-case tracking-normal text-zinc-950 dark:text-white"
                              style={{
                                ...centerCircularSlotStyle(CYCLE_CENTER_MANUAL_LAYOUT.disciplina),
                                ...centerClampStyle(CYCLE_CENTER_MANUAL_LAYOUT.disciplina),
                                fontSize: `${CYCLE_CENTER_MANUAL_LAYOUT.disciplina.fontSize}px`,
                                lineHeight: CYCLE_CENTER_MANUAL_LAYOUT.disciplina.lineHeight,
                                ...(shouldUseDisciplineColors ? { color: activeDisciplina.corBase || activeDisciplina.color } : {}),
                              }}
                            >
                              {activeDisciplina.disciplina.nome}
                            </span>

                            {isModoCicloSessoes && !activeDisciplina.isDisciplinaAgregada && (
                              <span
                                className="flex items-center justify-center text-center font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-300"
                                style={{
                                  ...centerCircularSlotStyle(CYCLE_CENTER_MANUAL_LAYOUT.bloco),
                                  fontSize: `${CYCLE_CENTER_MANUAL_LAYOUT.bloco.fontSize}px`,
                                }}
                              >
                                Bloco {(Number(activeDisciplina.sessaoIndex) || 0) + 1}
                              </span>
                            )}

                            {shouldShowAssuntos && !activeDisciplina.isDisciplinaAgregada && activeDisciplina.assuntoSugerido?.nome && (
                              <div
                                className="text-center"
                                style={centerCircularSlotStyle(CYCLE_CENTER_MANUAL_LAYOUT.assunto)}
                                title={activeDisciplina.assuntoSugerido.nome}
                              >
                                <span
                                  className="font-extrabold text-zinc-600 dark:text-zinc-200"
                                  style={{
                                    ...centerClampStyle(CYCLE_CENTER_MANUAL_LAYOUT.assunto),
                                    width: '100%',
                                    fontSize: `${CYCLE_CENTER_MANUAL_LAYOUT.assunto.fontSize}px`,
                                    lineHeight: CYCLE_CENTER_MANUAL_LAYOUT.assunto.lineHeight,
                                  }}
                                >
                                  {activeDisciplina.assuntoSugerido.nome}
                                </span>
                              </div>
                            )}

                            <div
                              className="flex items-baseline justify-center gap-[1px]"
                              style={centerCircularSlotStyle(CYCLE_CENTER_MANUAL_LAYOUT.tempo)}
                            >
                              <span
                                className="font-black leading-none text-zinc-900 dark:text-white"
                                style={{ fontSize: `${CYCLE_CENTER_MANUAL_LAYOUT.tempo.valueFontSize}px` }}
                              >
                                {formatVisualHours(activeDisciplina.progressMinutos)}
                              </span>
                              <span
                                className="font-black text-zinc-500 dark:text-zinc-300"
                                style={{ fontSize: `${CYCLE_CENTER_MANUAL_LAYOUT.tempo.totalFontSize}px` }}
                              >
                                / {formatVisualHours(activeDisciplina.metaMinutos)}
                              </span>
                            </div>

                            {!hideActionButtons && isModoCicloSessoes && activeDisciplina.isDisciplinaAgregada ? (
                              <div
                                className="flex w-full items-center justify-center overflow-visible"
                                style={{
                                  ...centerCircularSlotStyle(CYCLE_CENTER_MANUAL_LAYOUT.actions),
                                  gap: `${CYCLE_CENTER_MANUAL_LAYOUT.actions.gap}px`,
                                }}
                              >
                                <button
                                  onClick={() => onStartStudy(activeDisciplina.disciplina, null, { defaultContext: 'ciclo' })}
                                  className="pointer-events-auto inline-flex items-center justify-center bg-red-600 px-[2px] font-black uppercase leading-none tracking-[0.02em] text-white shadow-[0_1.5px_5px_rgba(220,38,38,0.18)] transition hover:bg-red-700 active:scale-95"
                                  style={centerButtonStyle(CYCLE_CENTER_MANUAL_LAYOUT.actions.startWidth)}
                                >
                                  Iniciar
                                </button>
                                <button
                                  onClick={() => handleConcluirDisciplinaAgregada(activeDisciplina.disciplina.id)}
                                  disabled={cicloActionLoading || !getNextPendingSessionForDisciplina(activeDisciplina.disciplina.id)}
                                  className="pointer-events-auto inline-flex items-center justify-center bg-emerald-600 px-[2px] font-black uppercase leading-none tracking-[0.02em] text-white shadow-[0_1.5px_5px_rgba(5,150,105,0.18)] transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                                  style={centerButtonStyle(CYCLE_CENTER_MANUAL_LAYOUT.actions.endWidth)}
                                >
                                  Concluir
                                </button>
                              </div>
                            ) : !hideActionButtons && activeDisciplina.concluida && isModoCicloSessoes ? (
                              <button
                                onClick={() => onMarcarSessao?.(activeDisciplina.globalIndex, activeDisciplina)}
                                disabled={cicloActionLoading}
                                className="pointer-events-auto inline-flex items-center justify-center border border-emerald-500/40 bg-emerald-500/10 px-[4.4px] font-black uppercase leading-none tracking-[0.03em] text-emerald-600 disabled:opacity-60 dark:text-emerald-300"
                                style={{
                                  ...centerCircularSlotStyle(CYCLE_CENTER_MANUAL_LAYOUT.actions),
                                  ...centerButtonStyle(CYCLE_CENTER_MANUAL_LAYOUT.actions.singleWidth),
                                }}
                              >
                                Concluída
                              </button>
                            ) : !hideActionButtons ? (
                              <div
                                className="flex w-full items-center justify-center overflow-visible"
                                style={{
                                  ...centerCircularSlotStyle(CYCLE_CENTER_MANUAL_LAYOUT.actions),
                                  gap: `${CYCLE_CENTER_MANUAL_LAYOUT.actions.gap}px`,
                                }}
                              >
                                <button
                                  onClick={() => onStartStudy(
                                    activeDisciplina.disciplina,
                                    shouldShowAssuntos ? activeDisciplina.assuntoSugerido?.nome || null : null,
                                    isModoCicloSessoes ? { defaultContext: 'ciclo', sessaoGlobalIndex: activeDisciplina.globalIndex } : { defaultContext: 'ciclo' }
                                  )}
                                  className="pointer-events-auto inline-flex items-center justify-center bg-red-600 px-[2px] font-black uppercase leading-none tracking-[0.03em] text-white shadow-[0_1.5px_5px_rgba(220,38,38,0.22)] transition hover:bg-red-700 active:scale-95"
                                  style={centerButtonStyle(CYCLE_CENTER_MANUAL_LAYOUT.actions.startWidth)}
                                >
                                  Iniciar
                                </button>
                                {isModoCicloSessoes ? (
                                  <button
                                    onClick={() => onMarcarSessao?.(activeDisciplina.globalIndex, activeDisciplina)}
                                    disabled={cicloActionLoading}
                                    className="pointer-events-auto inline-flex items-center justify-center bg-emerald-600 px-[2px] font-black uppercase leading-none tracking-[0.03em] text-white shadow-[0_1.5px_5px_rgba(5,150,105,0.24)] transition hover:bg-emerald-700 active:scale-95 disabled:opacity-60"
                                    style={centerButtonStyle(CYCLE_CENTER_MANUAL_LAYOUT.actions.endWidth)}
                                  >
                                    Concluir
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => onViewDetails(activeDisciplina.disciplina)}
                                    className="pointer-events-auto inline-flex items-center justify-center bg-emerald-600 px-[2px] font-black uppercase leading-none tracking-[0.03em] text-white shadow-[0_1.5px_5px_rgba(5,150,105,0.24)] transition hover:bg-emerald-700 active:scale-95"
                                    style={centerButtonStyle(CYCLE_CENTER_MANUAL_LAYOUT.actions.endWidth)}
                                  >
                                    Detalhes
                                  </button>
                                )}
                              </div>
                            ) : null}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </foreignObject>
                )}
              </AnimatePresence>
            </svg>
          </div>
        </div>

        {/* --- PAINEL LATERAL DE DETALHES (mantido fora da tela neste teste de design central) --- */}
        <div id="ciclo-details-panel" className="hidden">
          <AnimatePresence mode="wait">
            {/* Painel especial quando ciclo está concluído e nenhuma disciplina selecionada */}
            {isConcluido && !activeDisciplina ? (
              <motion.div
                key="concluido-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:from-emerald-900/20 dark:to-emerald-900/5 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-800/40 shadow-xl relative overflow-hidden"
              >
                {/* Fundo decorativo */}
                <div className="absolute -top-6 -right-6 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-emerald-300/10 rounded-full blur-xl pointer-events-none" />

                <div className="relative z-10">
                  {/* Ícone + Título */}
                  <div className="flex items-center gap-3 mb-4">
                    <motion.div
                      animate={{ rotate: [0, -8, 8, -8, 0], scale: [1, 1.1, 1] }}
                      transition={{ delay: 0.3, duration: 0.8 }}
                      className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0"
                    >
                      <Trophy size={28} className="text-white" fill="currentColor" />
                    </motion.div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-0.5">
                        Missão Cumprida
                      </p>
                      <h3 className="text-2xl font-black text-zinc-900 dark:text-white leading-tight">
                        Ciclo Completo!
                      </h3>
                    </div>
                  </div>

                  {/* Subtítulo */}
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-5 leading-relaxed">
                    Você atingiu <span className="font-black text-emerald-600 dark:text-emerald-400">100%</span> em todas as disciplinas. Finalize o ciclo para registrar sua conquista e iniciar uma nova rodada!
                  </p>

                  {/* Lista de matérias concluídas */}
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {disciplinas.map((disc) => (
                      <div
                        key={disc.id}
                        className="flex items-center gap-2 bg-white/70 dark:bg-zinc-800/50 rounded-xl px-3 py-2 border border-emerald-200/60 dark:border-emerald-800/30"
                      >
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
                        <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 truncate">
                          {disc.nome}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Botão principal de concluir */}
                  <motion.button
                    onClick={onConcluirCiclo}
                    disabled={cicloActionLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm uppercase tracking-wide shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {cicloActionLoading ? (
                      <>
                        <RotateCw size={18} className="animate-spin" />
                        Finalizando...
                      </>
                    ) : (
                      <>
                        <Trophy size={18} fill="currentColor" />
                        Concluir Missão ({ciclo?.conclusoes || 0}x)
                      </>
                    )}
                  </motion.button>

                  {/* Hint de que pode clicar nas disciplinas */}
                  <p className="text-center text-[10px] text-zinc-400 mt-3 font-medium">
                    Clique em uma disciplina para ver os detalhes
                  </p>
                </div>
              </motion.div>
            ) : activeDisciplina ? (
              <motion.div
                key={activeDisciplina.key}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-xl relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: activeDisciplina.color }}></div>

                <div className="relative z-10 pl-2">
                  {isModoCicloSessoes && activeDisciplina.isDisciplinaAgregada ? (
                    <>
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xl font-black text-zinc-800 dark:text-white line-clamp-2 leading-tight tracking-wide">
                          {activeDisciplina.disciplina.nome}
                        </h3>
                        <span
                          className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700"
                          style={{ color: activeDisciplina.color }}
                        >
                          {activeDisciplina.percentage.toFixed(0)}%
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700/50 shadow-sm">
                          <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-bold uppercase mb-1">
                            <Target size={12} /> Total blocos
                          </div>
                          <p className="text-lg font-black text-zinc-800 dark:text-white">
                            {activeDisciplina.totalSessoesDisciplina}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700/50 shadow-sm">
                          <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-bold uppercase mb-1">
                            <CheckCircle2 size={12} /> Concluídas
                          </div>
                          <p className="text-lg font-black text-zinc-800 dark:text-white">
                            {activeDisciplina.concluidasDisciplina}
                          </p>
                        </div>
                      </div>

                      <div className="mb-6">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-bold text-zinc-500">Progresso</span>
                          <span className="font-bold text-zinc-800 dark:text-white">
                            {formatVisualHours(activeDisciplina.progressMinutos)} / {formatVisualHours(activeDisciplina.metaMinutos)}
                          </span>
                        </div>
                        <div className="w-full h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: activeDisciplina.color }}
                            initial={false}
                            animate={{ width: `${Math.min(activeDisciplina.percentage, 100)}%` }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                          onClick={() => onStartStudy(activeDisciplina.disciplina, null, { defaultContext: 'ciclo' })}
                          className="w-full py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wide shadow-lg shadow-red-600/20 transition-all hover:-translate-y-0.5 hover:bg-red-700"
                        >
                          Iniciar
                        </button>
                        <button
                          onClick={() => handleConcluirDisciplinaAgregada(activeDisciplina.disciplina.id)}
                          disabled={cicloActionLoading || !getNextPendingSessionForDisciplina(activeDisciplina.disciplina.id)}
                          className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-wide shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:translate-y-0"
                        >
                          Concluir
                        </button>
                      </div>
                    </>
                  ) : isModoCicloSessoes ? (
                    <>
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xl font-black text-zinc-800 dark:text-white line-clamp-2 leading-tight tracking-wide">
                          {activeDisciplina.disciplina.nome}
                        </h3>
                        <span
                          className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700"
                          style={{ color: activeDisciplina.color }}
                        >
                          {activeDisciplina.concluida ? 'Concluída' : 'Pendente'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700/50 shadow-sm">
                          <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-bold uppercase mb-1">
                            <Target size={12} /> Bloco
                          </div>
                          <p className="text-lg font-black text-zinc-800 dark:text-white">
                            {activeDisciplina.sessaoIndex + 1} de {activeDisciplina.disciplina.sessoesPorCiclo || 1}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700/50 shadow-sm">
                          <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-bold uppercase mb-1">
                            <Clock size={12} /> Duração
                          </div>
                          <p className="text-lg font-black text-zinc-800 dark:text-white">
                            {formatVisualHours(ciclo?.tempoSessaoMinutos || 50)}
                          </p>
                        </div>
                      </div>

                      {shouldShowAssuntos && activeDisciplina.assuntoSugerido?.nome && (
                        <div className={`mb-5 rounded-2xl border p-3 ${
                          activeDisciplina.hasPendenciaTeoria
                            ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200'
                            : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                        }`}>
                          <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                            {activeDisciplina.hasPendenciaTeoria ? <AlertTriangle size={13} /> : <BookOpen size={13} />}
                            {activeDisciplina.hasPendenciaTeoria ? 'Retomada pendente' : 'Assunto sugerido'}
                          </div>
                          <p className="text-sm font-black leading-snug">
                            {activeDisciplina.assuntoSugerido.nome}
                          </p>
                          {activeDisciplina.hasPendenciaTeoria && activeDisciplina.retomada?.minutosAcumulados > 0 && (
                            <p className="mt-1 text-[11px] font-bold opacity-80">
                              {formatVisualHours(activeDisciplina.retomada.minutosAcumulados)} ja acumulados
                            </p>
                          )}
                        </div>
                      )}

                      <div className="mb-5">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-bold text-zinc-500">Progresso</span>
                          <span className="font-bold text-zinc-800 dark:text-white">
                            {formatVisualHours(activeDisciplina.progressMinutos)} / {formatVisualHours(activeDisciplina.metaMinutos)}
                          </span>
                        </div>
                        <div className="w-full h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: activeDisciplina.concluida ? CICLO_CONCLUIDO_COLOR : activeDisciplina.progressMinutos > 0 ? '#f59e0b' : activeDisciplina.corBase }}
                            initial={false}
                            animate={{ width: `${Math.min(activeDisciplina.percentage, 100)}%` }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                          />
                        </div>
                      </div>

                      {activeDisciplina.concluida ? (
                        <div className="w-full py-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl font-black text-xs uppercase tracking-wide border border-emerald-500/30 text-center shadow-lg shadow-emerald-500/10">
                          Bloco concluido
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={() => onStartStudy(activeDisciplina.disciplina, shouldShowAssuntos ? activeDisciplina.assuntoSugerido?.nome || null : null, { defaultContext: 'ciclo', sessaoGlobalIndex: activeDisciplina.globalIndex })}
                            className="flex-1 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold text-xs uppercase tracking-wide shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
                          >
                            <Play size={16} fill="currentColor" /> Iniciar estudo
                          </button>
                          <button
                            onClick={() => onMarcarSessao?.(activeDisciplina.globalIndex, activeDisciplina)}
                            disabled={cicloActionLoading}
                            className="px-4 py-3 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            Concluir
                          </button>
                        </div>
                      )}

                      {activeDisciplina.concluida && (
                        <div className="mt-3">
                          <button
                            onClick={() => onMarcarSessao?.(activeDisciplina.globalIndex, activeDisciplina)}
                            disabled={cicloActionLoading}
                            className="w-full px-4 py-3 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            Desmarcar
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xl font-black text-zinc-800 dark:text-white line-clamp-2 leading-tight tracking-wide">
                          {activeDisciplina.disciplina.nome}
                        </h3>
                        <span
                          className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700"
                          style={{ color: activeDisciplina.color }}
                        >
                          {activeDisciplina.percentage.toFixed(0)}%
                        </span>
                      </div>

                      <div className="mb-6">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-bold text-zinc-500">Progresso</span>
                          <span className="font-bold text-zinc-800 dark:text-white">
                            {formatVisualHours(activeDisciplina.progressMinutos)} / {formatVisualHours(activeDisciplina.metaMinutos)}
                          </span>
                        </div>
                        <div className="w-full h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: activeDisciplina.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(activeDisciplina.percentage, 100)}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700/50 shadow-sm">
                          <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-bold uppercase mb-1">
                            <Clock size={12} /> Realizado
                          </div>
                          <p className="text-lg font-black text-zinc-800 dark:text-white">
                            {formatVisualHours(activeDisciplina.progressMinutos)}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700/50 shadow-sm">
                          <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-bold uppercase mb-1">
                            <Target size={12} /> Meta Total
                          </div>
                          <p className="text-lg font-black text-zinc-800 dark:text-white">
                            {formatVisualHours(activeDisciplina.metaMinutos)}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => onStartStudy(activeDisciplina.disciplina, null, { defaultContext: 'ciclo' })}
                          className="flex-1 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold text-xls uppercase tracking-wide shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
                        >
                          <Play size={25} fill="currentColor" /> Iniciar Estudo
                        </button>
                        <button
                          onClick={() => onViewDetails(activeDisciplina.disciplina)}
                          className="px-4 py-3 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700 shadow-sm"
                        >
                          Detalhes
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            ) : (
              // Painel Central Tática (Vazio)
              <div className="flex flex-col items-center justify-center h-full bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-800 text-zinc-400 p-8 text-center">
                <div className="w-12 h-12 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3 text-zinc-400">
                  <Target size={24} />
                </div>
                <p className="font-bold text-zinc-600 dark:text-zinc-300 text-sm">Central de Estudo</p>
                <p className="text-xs mt-1 max-w-[200px]">
                  Clique em um bloco do radar para ver o progresso detalhado, iniciar o cronômetro ou registrar atividades.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
    </div>
  );
}

export default CicloVisual;
