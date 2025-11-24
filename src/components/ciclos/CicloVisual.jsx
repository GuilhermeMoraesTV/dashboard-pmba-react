import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Clock, Target } from 'lucide-react';

// --- Utilitário de Data ---
const getStartOfWeek = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek;
  const start = new Date(now.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
};

const dateToYMD = (date) => {
  return date.toISOString().split('T')[0];
};

// --- COMPONENTE DE SEGMENTO (BLOCO) ---
const CicloSegment = ({
  startAngle,
  angle,
  radius,
  color,
  disciplina,
  progressPercentage,
  isActive,
  onHover,
  onLeave,
  onClick
}) => {
  const toRad = (deg) => (deg * Math.PI) / 180;

  const createArc = (start, end, r) => {
    if (Math.abs(end - start) >= 360) end = start + 359.99;
    const startRad = toRad(start - 90);
    const endRad = toRad(end - 90);
    const x1 = 50 + r * Math.cos(startRad);
    const y1 = 50 + r * Math.sin(startRad);
    const x2 = 50 + r * Math.cos(endRad);
    const y2 = 50 + r * Math.sin(endRad);
    const largeArcFlag = end - start <= 180 ? 0 : 1;
    return ["M", x1, y1, "A", r, r, 0, largeArcFlag, 1, x2, y2].join(" ");
  };

  const gap = 3;
  const visualAngle = angle > gap ? angle - gap : angle;
  const strokeWidth = 14;

  const bgPath = createArc(startAngle, startAngle + visualAngle, radius);

  return (
    <g
      onMouseEnter={() => onHover(disciplina.id)}
      onMouseLeave={onLeave}
      onClick={() => onClick(disciplina)}
      className="cursor-pointer group"
      style={{ opacity: isActive ? 1 : 0.9, transition: 'opacity 0.3s ease' }}
    >
      {/* Bloco completo com cor baseada no progresso */}
      <motion.path
        initial={{ d: createArc(startAngle, startAngle, radius) }}
        animate={{ d: bgPath }}
        transition={{ duration: 0.8, ease: "circOut" }}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
      />

      {/* Overlay de Hover */}
      {isActive && (
        <path
          d={bgPath}
          fill="none"
          stroke="white"
          strokeWidth={strokeWidth}
          strokeOpacity={0.2}
          strokeLinecap="butt"
          className="pointer-events-none"
        />
      )}
    </g>
  );
};

// --- CÍRCULO INTERNO SEMANAL ---
const WeeklyProgressRing = ({ percentage }) => {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  return (
    <g className="pointer-events-none">
      <circle
        cx="50" cy="50" r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-zinc-300 dark:text-zinc-700 opacity-60"
      />
      <motion.circle
        cx="50" cy="50" r={radius}
        fill="none"
        stroke="#10b981"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        transform="rotate(-90 50 50)"
      />
    </g>
  );
};

function CicloVisual({
  selectedDisciplinaId,
  onSelectDisciplina,
  onViewDetails,
  onStartStudy,
  disciplinas,
  registrosEstudo,
  viewMode
}) {
  const [hoveredId, setHoveredId] = useState(null);

  const data = useMemo(() => {
    if (!disciplinas.length) return [];

    const totalMeta = disciplinas.reduce((acc, d) => acc + (d.tempoAlocadoSemanalMinutos || 0), 0);
    const startOfWeek = getStartOfWeek();
    const startOfWeekStr = dateToYMD(startOfWeek);

    let currentAngle = 0;

    return disciplinas.map((disciplina) => {
      const metaMinutos = disciplina.tempoAlocadoSemanalMinutos || 0;
      const angle = totalMeta > 0 ? (metaMinutos / totalMeta) * 360 : 0;

      let progressMinutos = 0;
      registrosEstudo.forEach(reg => {
        if (reg.disciplinaId === disciplina.id) {
          if (viewMode === 'semanal') {
            if (reg.data >= startOfWeekStr) {
              progressMinutos += reg.tempoEstudadoMinutos;
            }
          } else {
            progressMinutos += reg.tempoEstudadoMinutos;
          }
        }
      });

      const percentage = metaMinutos > 0 ? (progressMinutos / metaMinutos) * 100 : 0;

      // Definir cor baseada no progresso
      let color;
      if (percentage === 0) {
        color = '#71717a'; // Cinza (zinc-500)
      } else if (percentage >= 100) {
        color = '#10b981'; // Verde (emerald-500)
      } else {
        color = '#eab308'; // Amarelo (yellow-500)
      }

      const segmentData = {
        key: disciplina.id,
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
  }, [disciplinas, registrosEstudo, viewMode]);

  const activeDisciplina = useMemo(() => {
    const id = hoveredId || selectedDisciplinaId;
    return data.find(d => d.disciplina.id === id);
  }, [hoveredId, selectedDisciplinaId, data]);

  const totalEstudado = data.reduce((acc, d) => acc + d.progressMinutos, 0);
  const totalMeta = data.reduce((acc, d) => acc + d.metaMinutos, 0);
  const progressoGeral = totalMeta > 0 ? (totalEstudado / totalMeta) * 100 : 0;

  return (
    <div className="w-full">
      {/* --- CONTEÚDO PRINCIPAL --- */}
      <div className="flex flex-col xl:flex-row items-center xl:items-center justify-center gap-8 lg:gap-20 w-full px-4 animate-fade-in">
        {/* --- ÁREA DO GRÁFICO --- */}
        <div className="relative flex-shrink-0 group">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border border-zinc-300 dark:border-zinc-800 rounded-full opacity-40"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[85%] border border-dashed border-zinc-300 dark:border-zinc-700 rounded-full opacity-30 animate-[spin_60s_linear_infinite]"></div>

          <div className="w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] md:w-[420px] md:h-[420px] lg:w-[500px] lg:h-[500px]">
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-lg">
              {!data.length && <circle cx="50" cy="50" r="40" stroke="#e4e4e7" strokeWidth="14" fill="transparent" opacity="0.8" />}

              {data.map((seg) => {
                const { key, ...props } = seg;
                return (
                  <CicloSegment
                    key={key}
                    radius={42}
                    {...props}
                    isActive={activeDisciplina?.disciplina.id === seg.disciplina.id}
                    onHover={setHoveredId}
                    onLeave={() => setHoveredId(null)}
                    onClick={(d) => onSelectDisciplina(d.id === selectedDisciplinaId ? null : d.id)}
                  />
                );
              })}

              <WeeklyProgressRing percentage={progressoGeral} />

              {/* --- INFO CENTRAL --- */}
              <foreignObject x="15" y="15" width="70" height="70" className="pointer-events-none">
                <div className="w-full h-full flex flex-col items-center justify-center text-center rounded-full backdrop-blur-sm">
                  <AnimatePresence mode="wait">
                    {!activeDisciplina ? (
                      <motion.div
                        key="total"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col items-center justify-center w-full px-2"
                      >
                        <span className="text-[2.2px] md:text-[2.7px] font-extrabold uppercase tracking-[0.2em] text-zinc-400 mb-1">
                          {viewMode === 'semanal' ? 'SEMANA' : 'TOTAL'}
                        </span>

                        <div className="flex items-baseline justify-center">
                          <span className="text-[6.5px] md:text-[9.5px] font-black text-zinc-800 dark:text-white leading-none tracking-tighter">
                            {(totalEstudado / 60).toFixed(1)}
                          </span>
                          <span className="text-[2.2px] md:text-[3.2px] font-bold text-zinc-500 ml-0.5">h</span>
                        </div>

                        <div className="w-6 h-[0.5px] bg-zinc-300 dark:bg-zinc-700 my-1"></div>

                        <div className="flex flex-col items-center">
                          <span className="text-[2.2px] md:text-[3.2px] font-bold text-zinc-400 uppercase tracking-wide">
                            Meta: {(totalMeta / 60).toFixed(1)}h
                          </span>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="disciplina"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col items-center justify-center w-full h-full px-1"
                      >
                        <span className="text-[1.8px] md:text-[2.5px] font-extrabold uppercase tracking-[0.2em] text-zinc-400 mb-0.5">
                          DISCIPLINA
                        </span>

                        <div className="w-full flex justify-center items-center min-h-[10px] md:min-h-[16px]">
                          <span
                            className="text-[3.2px] md:text-[4.5px] font-extrabold uppercase leading-tight break-words text-center w-full tracking-widest px-1"
                            style={{ color: activeDisciplina.color }}
                          >
                            {activeDisciplina.disciplina.nome}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-center mt-1">
                          <span className="text-[6px] md:text-[9px] font-black text-zinc-800 dark:text-white leading-none">
                            {(activeDisciplina.progressMinutos / 60).toFixed(1)}
                          </span>
                          <span className="text-[2.2px] md:text-[3.2px] font-bold text-zinc-500 ml-0.5">h</span>
                        </div>

                        <div className="text-[2.2px] md:text-[3.2px] font-bold text-zinc-400 mt-0.5">
                          / {(activeDisciplina.metaMinutos / 60).toFixed(1)}h
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </foreignObject>
            </svg>
          </div>
        </div>

        {/* --- PAINEL LATERAL DE DETALHES --- */}
        <div className="w-full max-w-lg flex flex-col gap-6 justify-center min-h-[280px]">
          <AnimatePresence mode="wait">
            {activeDisciplina ? (
              <motion.div
                key={activeDisciplina.disciplina.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-xl relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: activeDisciplina.color }}></div>

                <div className="relative z-10 pl-2">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-black text-zinc-800 dark:text-white line-clamp-2 leading-tight tracking-wide">
                      {activeDisciplina.disciplina.nome}
                    </h3>
                    <span
                      className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide bg-zinc-100 dark:bg-zinc-800"
                      style={{ color: activeDisciplina.color }}
                    >
                      {activeDisciplina.percentage.toFixed(0)}%
                    </span>
                  </div>

                  {/* BARRA DE PROGRESSO */}
                  <div className="mb-6">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-bold text-zinc-500">Progresso</span>
                      <span className="font-bold text-zinc-800 dark:text-white">
                        {(activeDisciplina.progressMinutos / 60).toFixed(1)}h / {(activeDisciplina.metaMinutos / 60).toFixed(1)}h
                      </span>
                    </div>
                    <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: activeDisciplina.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(activeDisciplina.percentage, 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-100 dark:border-zinc-700/50">
                      <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-bold uppercase mb-1">
                        <Clock size={12} /> Realizado
                      </div>
                      <p className="text-lg font-black text-zinc-800 dark:text-white">
                        {(activeDisciplina.progressMinutos / 60).toFixed(1)}h
                      </p>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-100 dark:border-zinc-700/50">
                      <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-bold uppercase mb-1">
                        <Target size={12} /> Meta
                      </div>
                      <p className="text-lg font-black text-zinc-800 dark:text-white">
                        {(activeDisciplina.metaMinutos / 60).toFixed(1)}h
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => onStartStudy(activeDisciplina.disciplina)}
                      className="flex-1 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold text-xs uppercase tracking-wide shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
                    >
                      <Play size={14} fill="currentColor" /> Iniciar
                    </button>
                    <button
                      onClick={() => onViewDetails(activeDisciplina.disciplina)}
                      className="px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700"
                    >
                      Detalhes
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="hidden xl:flex flex-col items-center justify-center h-full bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-800 text-zinc-400 p-8 text-center">
                <div className="w-12 h-12 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3 text-zinc-400">
                  <Target size={24} />
                </div>
                <p className="font-bold text-zinc-600 dark:text-zinc-300 text-sm">Central Tática</p>
                <p className="text-xs mt-1 max-w-[200px]">
                  Passe o mouse sobre os blocos do radar para ver o progresso detalhado de cada disciplina.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default CicloVisual;