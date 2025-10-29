import React, { useState, useMemo } from 'react';

// --- Ícones ---
const IconPlay = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
  </svg>
);
// Nota: O IconEye foi removido pois o clique principal agora é para detalhes

// --- Funções Helper ---
const getWeekRange = () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return {
    startStr: `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`,
    endStr: `${endOfWeek.getFullYear()}-${String(endOfWeek.getMonth() + 1).padStart(2, '0')}-${String(endOfWeek.getDate()).padStart(2, '0')}`
  };
};

const hexToRgba = (hex, alpha = 0.3) => {
    if (!hex || hex.length < 4) return `rgba(0,0,0,${alpha})`;
    const hexValue = hex.startsWith('#') ? hex.slice(1) : hex;
    const fullHex = hexValue.length === 3 ? hexValue.split('').map(char => char + char).join('') : hexValue;
    if (fullHex.length !== 6) return `rgba(0,0,0,${alpha})`;
    const bigint = parseInt(fullHex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// --- Sub-componente "Fatia" do Ciclo ---
const CicloSlice = ({
  disciplina,
  goalPercentage,
  progressPercentage,
  rotation,
  color,
  radius,
  strokeWidth,
  isActive,
  onHover,
  onLeave,
  onClick // Ação de clique para abrir detalhes
}) => {
  const circumference = 2 * Math.PI * radius;
  const goalStrokeDasharray = `${circumference * goalPercentage} ${circumference}`;
  const progressStrokeDasharray = `${circumference * goalPercentage * progressPercentage} ${circumference}`;
  const style = {
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center',
    transition: 'all 0.3s ease',
  };

  return (
    <g
      style={style}
      className={`ciclo-slice-group ${isActive ? 'active' : ''} cursor-pointer`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      <circle
        className="ciclo-slice-goal"
        cx="100" cy="100" r={radius} fill="transparent" stroke={color}
        strokeWidth={strokeWidth} strokeDasharray={goalStrokeDasharray}
      />
      <circle
        className="ciclo-slice-progress"
        cx="100" cy="100" r={radius} fill="transparent" stroke={color}
        strokeWidth={isActive ? strokeWidth + 2 : strokeWidth + 0.5}
        strokeDasharray={progressStrokeDasharray} strokeLinecap="round"
      />
    </g>
  );
};

// --- Componente Principal "Roda" ---
function CicloVisual({
    selectedDisciplinaId,
    onSelectDisciplina, // Para setar o highlight
    onViewDetails,      // Para abrir o modal de detalhes
    onStartStudy,       // Para iniciar o timer
    disciplinas,
    registrosEstudo,
    viewMode // 'semanal' ou 'total'
}) {

  const [hoveredDisciplinaNome, setHoveredDisciplinaNome] = useState(null);

  const radius = 80;
  const strokeWidth = 20;
  const gapAngle = 2;

  const progressMap = useMemo(() => {
    if (!registrosEstudo) return new Map();

    const newProgressMap = new Map();
    const { startStr, endStr } = getWeekRange();

    registrosEstudo.forEach(data => {
        let dateStr = data.data;

        if (viewMode === 'total' || (dateStr >= startStr && dateStr <= endStr)) {
          const { disciplinaId } = data;
          const minutos = Number(data.tempoEstudadoMinutos || 0);

          if (disciplinaId && minutos > 0) {
            newProgressMap.set(disciplinaId, (newProgressMap.get(disciplinaId) || 0) + minutos);
          }
        }
      });

    return newProgressMap;
  }, [registrosEstudo, viewMode]);


  const { totalMetaMinutos, totalProgressMinutos, slices } = useMemo(() => {
    const safeDisciplinas = Array.isArray(disciplinas) ? disciplinas : [];

    const calculatedTotalMetaMinutos = safeDisciplinas.reduce((sum, d) => sum + (d.tempoAlocadoSemanalMinutos || 0), 0);
    const calculatedTotalProgressMinutos = Array.from(progressMap.values()).reduce((sum, m) => sum + m, 0);

    const totalGaps = safeDisciplinas.length;
    const totalGapDegrees = totalGaps * gapAngle;
    const drawableDegrees = 360 - totalGapDegrees;
    let cumulativeRotation = 0;
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#EC4899', '#8B5CF6', '#06B6D4'];

    const calculatedSlices = safeDisciplinas.map((disciplina, index) => {
        const metaMinutos = disciplina.tempoAlocadoSemanalMinutos || 0;
        const progressMinutos = progressMap.get(disciplina.id) || 0;

        const percentageOfTime = calculatedTotalMetaMinutos > 0 ? metaMinutos / calculatedTotalMetaMinutos : 0;
        const sliceAngle = percentageOfTime * drawableDegrees;
        const goalPercentage = sliceAngle / 360;

        let progressPercentage = 0;
        if (viewMode === 'semanal') {
            progressPercentage = metaMinutos > 0 ? Math.min(progressMinutos / metaMinutos, 1) : 0;
        } else {
            progressPercentage = metaMinutos > 0 ? progressMinutos / metaMinutos : 0;
        }

        const rotation = cumulativeRotation;
        const color = colors[index % colors.length];
        cumulativeRotation += sliceAngle + gapAngle;
        const isActive = hoveredDisciplinaNome === disciplina.nome || selectedDisciplinaId === disciplina.id;

        return {
            key: disciplina.id, goalPercentage, progressPercentage, rotation, color, radius, strokeWidth,
            disciplina: disciplina,
            progressMinutos: progressMinutos,
            metaMinutos: metaMinutos,
            isActive: isActive
        };
    });
    return {
        totalMetaMinutos: calculatedTotalMetaMinutos,
        totalProgressMinutos: calculatedTotalProgressMinutos,
        slices: calculatedSlices
    };
  }, [disciplinas, progressMap, hoveredDisciplinaNome, selectedDisciplinaId, radius, strokeWidth, gapAngle, viewMode]);


  const activeSlice = useMemo(() => {
     return slices.find(s => s.disciplina.id === selectedDisciplinaId || s.disciplina.nome === hoveredDisciplinaNome);
  }, [slices, selectedDisciplinaId, hoveredDisciplinaNome]);

  return (
    // [CORREÇÃO 4] Layout revertido para Roda | Legenda
    <div className="flex flex-col lg:flex-row items-center lg:items-start" style={{ minHeight: '450px' }}>

      {/* Roda (SVG) */}
      <div className="relative w-full max-w-[450px] lg:w-1/2" style={{ height: '450px' }}>
        <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ transform: 'rotate(-90deg)' }}>
          {slices.map(slice => (
            <CicloSlice
              key={slice.key}
              {...slice}
              onHover={() => { setHoveredDisciplinaNome(slice.disciplina.nome); onSelectDisciplina(slice.disciplina.id); }}
              onLeave={() => { setHoveredDisciplinaNome(null); onSelectDisciplina(null); }}
              onClick={() => onViewDetails(slice.disciplina)}
            />
          ))}
        </svg>

        {/* Texto no centro */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none w-2/3">
           {activeSlice ? (
              <>
                  <span className="text-xl font-bold text-heading-color dark:text-dark-heading-color transition-opacity break-words">
                    {activeSlice.disciplina.nome}
                  </span>
                  <span className="block text-2xl font-bold text-primary-color">
                    {(activeSlice.progressMinutos / 60).toFixed(1)}h
                    {viewMode === 'semanal' && (
                       <span className="text-lg font-normal text-subtle-text-color dark:text-dark-subtle-text-color">
                         {' '}/ {(activeSlice.metaMinutos / 60).toFixed(1)}h
                       </span>
                    )}
                  </span>
              </>
          ) : (
            <>
              <span className="text-4xl font-bold text-primary-color">
                {(totalProgressMinutos / 60).toFixed(1)}h
              </span>
              {viewMode === 'semanal' && (
                <span className="block text-lg font-normal text-subtle-text-color dark:text-dark-subtle-text-color -mt-1">
                  de {(totalMetaMinutos / 60).toFixed(1)}h
                </span>
              )}
              <span className="block text-sm font-semibold text-heading-color dark:text-dark-heading-color mt-1">
                {viewMode === 'semanal' ? 'Progresso da Semana' : 'Progresso Total'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* [CORREÇÃO 3 & 4] Legenda Interativa (Vertical, Compacta) */}
      <div className="w-full lg:w-1/2 pl-0 lg:pl-12 mt-8 lg:mt-4 pr-4">
        <h3 className="text-lg font-semibold text-heading-color dark:text-dark-heading-color mb-4">
          Disciplinas do Ciclo
        </h3>
        {/* Lista vertical com scroll */}
        <ul className="space-y-2 overflow-y-auto custom-scrollbar" style={{ maxHeight: '400px' }}>
          {slices.map(slice => (
            <li key={slice.key}>
              {/* Item da legenda (muito menor) */}
              <div
                onMouseEnter={() => { setHoveredDisciplinaNome(slice.disciplina.nome); onSelectDisciplina(slice.disciplina.id); }}
                onMouseLeave={() => { setHoveredDisciplinaNome(null); onSelectDisciplina(null); }}
                className={`
                  flex items-center justify-between p-3 rounded-lg border-2 transition-all
                  ${slice.isActive ? 'bg-background-color dark:bg-dark-background-color' : 'bg-card-background-color dark:bg-dark-card-background-color'}
                  ${selectedDisciplinaId === slice.disciplina.id ? 'border-primary-color' : 'border-border-color dark:border-dark-border-color'}
                `}
                style={{ '--disciplina-color': slice.color }}
              >
                {/* Informações (clica para detalhes) */}
                <button
                  onClick={() => onViewDetails(slice.disciplina)}
                  className="flex-1 flex items-center gap-2 min-w-0 text-left"
                  title="Ver detalhes"
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: slice.color }}></span>
                  <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-heading-color dark:text-dark-heading-color truncate">
                        {slice.disciplina.nome}
                      </p>
                      <p className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color">
                        Prog: {(slice.progressMinutos / 60).toFixed(1)}h
                        {viewMode === 'semanal' && ` / Meta: ${(slice.metaMinutos / 60).toFixed(1)}h`}
                      </p>
                  </div>
                </button>

                {/* Botão Iniciar */}
                <button
                  onClick={() => onStartStudy(slice.disciplina)}
                  className="ml-2 p-2 rounded-full text-white transition-transform hover:scale-110"
                  style={{ backgroundColor: slice.color, opacity: 0.9 }}
                  onMouseOver={e => e.currentTarget.style.opacity = '1'}
                  onMouseOut={e => e.currentTarget.style.opacity = '0.9'}
                  title="Iniciar Estudo"
                >
                    <IconPlay />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}

export default CicloVisual;