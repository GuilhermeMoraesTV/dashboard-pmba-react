import React, { useState, useMemo } from 'react';

// --- Ícones ---
const IconPlay = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
  </svg>
);
const IconEye = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 10.224 7.29 6.3 12 6.3c4.71 0 8.577 3.924 9.964 5.383.16.192.16.447 0 .639C20.577 13.776 16.71 17.7 12 17.7c-4.71 0-8.577-3.924-9.964-5.383Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);


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
  onClick // [NOVO]
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
      onClick={onClick} // [NOVO]
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
    selectedDisciplinaId, // Continua sendo usado para highlight
    onSelectDisciplina, // [NOVO] Para setar o highlight
    onViewDetails,      // [NOVO] Para abrir o modal de detalhes
    onStartStudy,       // [NOVO] Para iniciar o timer
    disciplinas,
    registrosEstudo,
    viewMode // 'semanal' ou 'total'
}) {

  const [hoveredDisciplinaNome, setHoveredDisciplinaNome] = useState(null);

  const radius = 80;
  const strokeWidth = 20;
  const gapAngle = 2;

  // --- Lógica de Cálculo de Progresso (Semanal vs Total) ---
  const progressMap = useMemo(() => {
    if (!registrosEstudo) return new Map();

    const newProgressMap = new Map();
    const { startStr, endStr } = getWeekRange();

    registrosEstudo.forEach(data => {
        let dateStr = data.data; // O 'data' já vem como string "YYYY-MM-DD"

        // Filtra por data SE o modo for semanal
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


  // Lógica de Cálculo das Fatias
  const { totalMetaMinutos, totalProgressMinutos, slices } = useMemo(() => {
    const safeDisciplinas = Array.isArray(disciplinas) ? disciplinas : [];

    // Meta é sempre semanal, mas progresso pode ser total ou semanal
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

        let progressPercentage;
        if (viewMode === 'semanal') {
            // Progresso em relação à meta semanal
            progressPercentage = metaMinutos > 0 ? Math.min(progressMinutos / metaMinutos, 1) : 0;
        } else {
            // Progresso em relação ao tempo total (ilimitado)
            // Usamos a 'metaMinutos' como uma referência de "100%", mas permitimos estourar
            progressPercentage = metaMinutos > 0 ? progressMinutos / metaMinutos : 0;
            // Para visualização, limitamos a 100% para não sobrepor
            // progressPercentage = Math.min(progressPercentage, 1);
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


  // Encontra a fatia ativa para exibir no centro
  const activeSlice = useMemo(() => {
     return slices.find(s => s.disciplina.id === selectedDisciplinaId || s.disciplina.nome === hoveredDisciplinaNome);
  }, [slices, selectedDisciplinaId, hoveredDisciplinaNome]);

  return (
    // [LAYOUT MODIFICADO] Agora é sempre flex-col
    <div className="h-full flex flex-col">

      {/* Roda (SVG) */}
      <div className="relative w-full max-w-[450px] mx-auto" style={{ height: '450px' }}>
        <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ transform: 'rotate(-90deg)' }}>
          {slices.map(slice => (
            <CicloSlice
              key={slice.key}
              {...slice}
              onHover={() => { setHoveredDisciplinaNome(slice.disciplina.nome); onSelectDisciplina(slice.disciplina.id); }}
              onLeave={() => { setHoveredDisciplinaNome(null); onSelectDisciplina(null); }}
              onClick={() => onViewDetails(slice.disciplina)} // [NOVO]
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
                    {/* Mostra a meta dependendo da view */}
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
              {/* Mostra a meta dependendo da view */}
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

      {/* Legenda Interativa (Layout MODIFICADO) */}
      <div className="w-full mt-8">
        <h3 className="text-lg font-semibold text-heading-color dark:text-dark-heading-color mb-4 px-1">
          Disciplinas do Ciclo
        </h3>
        {/* [NOVO] Carrossel horizontal com scroll customizado */}
        <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-4 -mx-1 px-1">
          {slices.map(slice => (
            <div
              key={slice.key}
              onMouseEnter={() => { setHoveredDisciplinaNome(slice.disciplina.nome); onSelectDisciplina(slice.disciplina.id); }}
              onMouseLeave={() => { setHoveredDisciplinaNome(null); onSelectDisciplina(null); }}
              className={`ciclo-legend-item flex-shrink-0 w-60
                ${slice.isActive ? 'active' : ''}
                ${selectedDisciplinaId === slice.disciplina.id ? 'selected' : ''}
              `}
              style={{
                  '--disciplina-color': slice.color,
                  '--disciplina-color-transparent': hexToRgba(slice.color, 0.3)
              }}
            >
              {/* Corpo principal (Botão de Detalhes) */}
              <button onClick={() => onViewDetails(slice.disciplina)} className="w-full text-left">
                <div className="flex items-center gap-3 w-full mb-2">
                  <span className="legend-dot" style={{ backgroundColor: slice.color }}></span>
                  <span className="flex-grow text-text-color dark:text-dark-text-color font-semibold text-base truncate">
                    {slice.disciplina.nome}
                  </span>
                </div>
                <div className="flex justify-between text-sm w-full mb-2">
                  <span className="font-medium text-subtle-text-color dark:text-dark-subtle-text-color">
                    Prog: <span className='font-bold text-text-color dark:text-dark-text-color'>{(slice.progressMinutos / 60).toFixed(1)}h</span>
                  </span>
                  {viewMode === 'semanal' && (
                    <span className="font-medium text-subtle-text-color dark:text-dark-subtle-text-color">
                      Meta: {(slice.metaMinutos / 60).toFixed(1)}h
                    </span>
                  )}
                </div>
                {/* Barra de Progresso */}
                <div className="w-full bg-background-color dark:bg-dark-background-color rounded-full h-2.5 my-1 border border-border-color dark:border-dark-border-color">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(slice.progressPercentage * 100, 100)}%`, // Limita em 100% visualmente
                      backgroundColor: slice.color,
                      transition: 'width 0.5s ease'
                    }}
                  ></div>
                </div>
              </button>

              {/* [NOVO] Botões de Ação */}
              <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => onViewDetails(slice.disciplina)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color text-subtle-text-color dark:text-dark-subtle-text-color hover:bg-border-color dark:hover:bg-dark-border-color hover:text-text-color dark:hover:text-dark-text-color transition-colors"
                  >
                      <IconEye />
                      Detalhes
                  </button>
                  <button
                    onClick={() => onStartStudy(slice.disciplina)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg text-white"
                    style={{ backgroundColor: slice.color, opacity: 0.9 }}
                    onMouseOver={e => e.currentTarget.style.opacity = '1'}
                    onMouseOut={e => e.currentTarget.style.opacity = '0.9'}
                  >
                      <IconPlay />
                      Iniciar
                  </button>
              </div>

            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default CicloVisual;