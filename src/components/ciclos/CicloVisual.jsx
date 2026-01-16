import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Clock, Target } from 'lucide-react';

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
    // Se o arco for zero ou muito pequeno, retorna um ponto que é animável (M x y).
    if (Math.abs(end - start) < 0.001) {
        const startRad = toRad(start - 90);
        const x1 = 50 + r * Math.cos(startRad);
        const y1 = 50 + r * Math.sin(startRad);
        // MoveTo (M) é o ponto de início, que pode ser animado.
        return ["M", x1, y1].join(" ");
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

    return ["M", x1, y1, "A", r, r, 0, largeArcFlag, sweepFlag, x2, y2].join(" ");
  };

  const gap = 3;
  // Se o ângulo for muito pequeno, ele fica com 0, senão ele tem o ângulo menos o gap.
  const visualAngle = angle > gap ? angle - gap : 0;
  const strokeWidth = 14;

  const bgPath = createArc(startAngle, startAngle + visualAngle, radius);

  // O initialPath deve ser sempre o ponto inicial, garantindo uma animação suave
  const initialPath = createArc(startAngle, startAngle, radius);


  return (
    <g
      onMouseEnter={() => onHover(disciplina.id)}
      onMouseLeave={onLeave}
      onClick={() => onClick(disciplina)}
      className="cursor-pointer group"
      style={{ opacity: isActive ? 1 : 0.9, transition: 'opacity 0.3s ease' }}
    >
      <motion.path
        initial={{ d: initialPath }}
        animate={{ d: bgPath }}
        transition={{ duration: 0.8, ease: "circOut" }}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
      />
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
        strokeWidth="2.5"
        className="text-zinc-300 dark:text-zinc-700 opacity-60"
        transform="rotate(-90 50 50)"
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
  registrosEstudo, // LISTA JÁ FILTRADA PELO CicloDetalhePage
  viewMode,
  ciclo,
  isLoading
}) {
  const [hoveredId, setHoveredId] = useState(null);

  const data = useMemo(() => {
    // A única checagem aqui é se as disciplinas foram carregadas.
    if (!disciplinas.length) return [];

    const totalMetaRaw = disciplinas.reduce((acc, d) => acc + Number(d.tempoAlocadoSemanalMinutos || 0), 0);
    const totalMeta = Math.round(totalMetaRaw);

    let currentAngle = 0;

    return disciplinas.map((disciplina) => {
      const metaMinutos = Number(disciplina.tempoAlocadoSemanalMinutos || 0);
      const angle = totalMeta > 0 ? (metaMinutos / totalMeta) * 360 : 0;

      let progressMinutos = 0;

      // Itera sobre a lista de REGISTROS JÁ FILTRADA (registrosEstudo)
      registrosEstudo.forEach(reg => {
        if (reg.disciplinaId === disciplina.id) {
          const minutosReg = Number(reg.tempoEstudadoMinutos || 0);
          // SIMPLESMENTE SOMA. O FILTRO DE DATA ESTÁ NO PAI.
          progressMinutos += minutosReg;
        }
      });

      const percentage = metaMinutos > 0 ? (progressMinutos / metaMinutos) * 100 : 0;

      let color;
      if (percentage === 0) {
        color = '#71717a';
      } else if (percentage >= 100) {
        color = '#10b981';
      } else {
        color = '#eab308';
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
  }, [disciplinas, registrosEstudo, viewMode, ciclo]);

  const activeDisciplina = useMemo(() => {
    const id = hoveredId || selectedDisciplinaId;
    return data.find(d => d.disciplina.id === id);
  }, [hoveredId, selectedDisciplinaId, data]);

  const totalEstudado = data.reduce((acc, d) => acc + d.progressMinutos, 0);
  const totalMeta = data.reduce((acc, d) => acc + d.metaMinutos, 0);
  const progressoGeral = totalMeta > 0 ? (totalEstudado / totalMeta) * 100 : 0;

  if (!disciplinas.length) {
     // A mensagem de "Nenhuma disciplina alocada" deve ser exibida pelo pai.
     return <div className="text-zinc-500 text-center py-10">Nenhuma disciplina alocada neste ciclo.</div>;
  }

  return (
    <div className="w-full">
      <div className="flex flex-col xl:flex-row items-center xl:items-start justify-center gap-6 xl:gap-8 w-full px-4 animate-fade-in">

        {/* --- ÁREA DO GRÁFICO --- */}
        {/* ID ADICIONADO AQUI: ciclo-radar-chart */}
        <div id="ciclo-radar-chart" className="relative flex-shrink-0 group xl:-mt-10">

          <div className="w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] md:w-[420px] md:h-[420px] lg:w-[500px] lg:h-[500px]">
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-lg">
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

              {/* --- INFO CENTRAL (FONTES AUMENTADAS PARA MOBILE) --- */}
              {/* ID ADICIONADO AQUI: ciclo-center-info */}
              <foreignObject id="ciclo-center-info" x="15" y="15" width="70" height="70" className="pointer-events-none">
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
                        {/* AUMENTADO: de text-[2.2px] para text-[3.5px] */}
                        <span className="text-[3.5px] md:text-[2.7px] font-extrabold uppercase tracking-[0.2em] text-zinc-400 mb-1">
                          {viewMode === 'semanal' ? 'SEMANA' : 'TOTAL'}
                        </span>

                        <div className="flex items-baseline justify-center">
                          {/* AUMENTADO: de text-[6.5px] para text-[10px] */}
                          <span className="text-[10px] md:text-[9.5px] font-black text-zinc-800 dark:text-white leading-none tracking-tighter">
                            {formatVisualHours(totalEstudado)}
                          </span>
                        </div>

                        <div className="w-6 h-[0.5px] bg-zinc-300 dark:bg-zinc-700 my-1"></div>

                        <div className="flex flex-col items-center">
                          {/* AUMENTADO: de text-[2.2px] para text-[3.5px] */}
                          <span className="text-[3.5px] md:text-[3.2px] font-bold text-zinc-400 uppercase tracking-wide">
                            Meta: {formatVisualHours(totalMeta)}
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
                        {/* AUMENTADO: de text-[1.8px] para text-[2.8px] */}
                        <span className="text-[2.8px] md:text-[2.5px] font-extrabold uppercase tracking-[0.2em] text-zinc-400 mb-0.5">
                          DISCIPLINA
                        </span>

                        <div className="w-full flex justify-center items-center min-h-[10px] md:min-h-[16px]">
                          {/* AUMENTADO: de text-[3.2px] para text-[4.5px] */}
                          <span
                            className="text-[4.5px] md:text-[4.5px] font-extrabold uppercase leading-tight break-words text-center w-full tracking-widest px-1"
                            style={{ color: activeDisciplina.color }}
                          >
                            {activeDisciplina.disciplina.nome}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-center mt-1">
                          {/* AUMENTADO: de text-[6px] para text-[9px] */}
                          <span className="text-[9px] md:text-[9px] font-black text-zinc-800 dark:text-white leading-none">
                            {formatVisualHours(activeDisciplina.progressMinutos)}
                          </span>
                        </div>

                        {/* AUMENTADO: de text-[2.2px] para text-[3.2px] */}
                        <div className="text-[3.2px] md:text-[3.2px] font-bold text-zinc-400 mt-0.5">
                          / {formatVisualHours(activeDisciplina.metaMinutos)}
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
        {/* ID ADICIONADO AQUI: ciclo-details-panel */}
        <div id="ciclo-details-panel" className="w-full max-w-lg flex flex-col gap-6 justify-center min-h-[280px]">
          <AnimatePresence mode="wait">
            {activeDisciplina ? (
              <motion.div
                key={activeDisciplina.disciplina.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-xl relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: activeDisciplina.color }}></div>

                <div className="relative z-10 pl-2">
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
                    {/* ALTERAÇÃO: bg-zinc-200 para a trilha da barra para contrastar com o fundo cinza */}
                    <div className="w-full h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
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
                    {/* ALTERAÇÃO: Cards internos agora são brancos (bg-white) para destacar sobre o fundo cinza */}
                    <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700/50 shadow-sm">
                      <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-bold uppercase mb-1">
                        <Clock size={12} /> Realizado
                      </div>
                      <p className="text-lg font-black text-zinc-800 dark:text-white">
                        {formatVisualHours(activeDisciplina.progressMinutos)}
                      </p>
                    </div>
                    {/* ALTERAÇÃO: Cards internos agora são brancos (bg-white) */}
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
                      onClick={() => onStartStudy(activeDisciplina.disciplina)}
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
                </div>
              </motion.div>
            ) : (
              // Painel Central Tática (Visível)
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
  );
}

export default CicloVisual;