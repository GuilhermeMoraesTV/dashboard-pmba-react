import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

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
  onLeave
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
    <g style={style} className={`ciclo-slice-group ${isActive ? 'active' : ''}`} onMouseEnter={onHover} onMouseLeave={onLeave}>
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
function CicloVisual({ cicloId, user, selectedDisciplinaId, onSelectDisciplina, registrosEstudo }) {
  const [disciplinas, setDisciplinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredDisciplinaNome, setHoveredDisciplinaNome] = useState(null);

  const radius = 80;
  const strokeWidth = 20;
  const gapAngle = 2;

  // Hook para buscar APENAS as disciplinas (metas)
  useEffect(() => {
    if (!user || !cicloId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
    const q = query(disciplinasRef, orderBy('nome'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const disciplinasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("📚 Disciplinas carregadas:", disciplinasData.length);
      setDisciplinas(disciplinasData);
      setLoading(false);
    }, (error) => {
      console.error("❌ Erro ao buscar disciplinas:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, cicloId]);

  // --- Cálculo do Progresso (USANDO registrosEstudo RECEBIDO VIA PROPS) ---
  const progressMap = useMemo(() => {
    if (!registrosEstudo || registrosEstudo.length === 0) {
      console.log("⚠️ Nenhum registro recebido para processar");
      return new Map();
    }

    const { startStr, endStr } = getWeekRange();
    const newProgressMap = new Map();

    console.log("🔄 Processando", registrosEstudo.length, "registros da semana", startStr, "-", endStr);

    registrosEstudo.forEach(registro => {
      const dateStr = registro.data;

      // Verifica se está na semana atual
      if (dateStr >= startStr && dateStr <= endStr) {
        const { disciplinaId } = registro;
        const minutos = Number(registro.tempoEstudadoMinutos || 0);

        if (disciplinaId && minutos > 0) {
          newProgressMap.set(disciplinaId, (newProgressMap.get(disciplinaId) || 0) + minutos);
        }
      }
    });

    console.log("✅ Mapa de progresso calculado:", newProgressMap.size, "disciplinas");
    return newProgressMap;
  }, [registrosEstudo]);

  // --- Lógica de Cálculo dos Slices ---
  const { totalMetaMinutos, totalProgressMinutos, slices } = useMemo(() => {
    const calculatedTotalMetaMinutos = disciplinas.reduce((sum, d) => sum + (d.tempoAlocadoSemanalMinutos || 0), 0);
    const calculatedTotalProgressMinutos = Array.from(progressMap.values()).reduce((sum, m) => sum + m, 0);

    const totalGaps = disciplinas.length;
    const totalGapDegrees = totalGaps * gapAngle;
    const drawableDegrees = 360 - totalGapDegrees;
    let cumulativeRotation = 0;

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#EC4899', '#8B5CF6', '#06B6D4'];

    const calculatedSlices = disciplinas.map((disciplina, index) => {
      const metaMinutos = disciplina.tempoAlocadoSemanalMinutos || 0;
      const progressMinutos = progressMap.get(disciplina.id) || 0;

      const percentageOfTime = calculatedTotalMetaMinutos > 0 ? metaMinutos / calculatedTotalMetaMinutos : 0;
      const sliceAngle = percentageOfTime * drawableDegrees;
      const goalPercentage = sliceAngle / 360;
      const progressPercentage = metaMinutos > 0 ? Math.min(progressMinutos / metaMinutos, 1) : 0;

      const rotation = cumulativeRotation;
      const color = colors[index % colors.length];
      cumulativeRotation += sliceAngle + gapAngle;

      const isActive = hoveredDisciplinaNome === disciplina.nome || selectedDisciplinaId === disciplina.id;

      return {
        key: disciplina.id,
        goalPercentage,
        progressPercentage,
        rotation,
        color,
        radius,
        strokeWidth,
        disciplina: disciplina,
        progressMinutos: progressMinutos,
        isActive: isActive
      };
    });

    console.log("📊 Slices calculados:", calculatedSlices.length, "| Total meta:", calculatedTotalMetaMinutos, "| Total progresso:", calculatedTotalProgressMinutos);

    return {
      totalMetaMinutos: calculatedTotalMetaMinutos,
      totalProgressMinutos: calculatedTotalProgressMinutos,
      slices: calculatedSlices
    };
  }, [disciplinas, progressMap, hoveredDisciplinaNome, selectedDisciplinaId, radius, strokeWidth, gapAngle]);

  if (loading) {
    return (
      <div className="text-subtle-text-color dark:text-dark-subtle-text-color h-full flex items-center justify-center" style={{minHeight: '450px'}}>
        Carregando ciclo...
      </div>
    );
  }

  if (disciplinas.length === 0) {
    return (
      <div className="text-center text-subtle-text-color dark:text-dark-subtle-text-color h-full flex flex-col items-center justify-center" style={{minHeight: '450px'}}>
        <span className="text-4xl mb-4">📚</span>
        <p className="font-semibold">Nenhuma disciplina cadastrada</p>
        <p className="text-sm">Edite o ciclo para adicionar disciplinas</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="flex flex-col lg:flex-row items-center lg:items-start" style={{ minHeight: '450px' }}>

        {/* Roda (SVG) */}
        <div className="relative w-full max-w-[450px] lg:w-1/2" style={{ height: '450px' }}>
          <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ transform: 'rotate(-90deg)' }}>
            {slices.map(slice => (
              <CicloSlice
                key={slice.key}
                {...slice}
                onHover={() => setHoveredDisciplinaNome(slice.disciplina.nome)}
                onLeave={() => setHoveredDisciplinaNome(null)}
              />
            ))}
          </svg>

          {/* Texto no centro */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none w-2/3">
            {(selectedDisciplinaId || hoveredDisciplinaNome) ? (() => {
              const activeSlice = slices.find(s => s.disciplina.id === selectedDisciplinaId || s.disciplina.nome === hoveredDisciplinaNome);
              if (!activeSlice) return null;
              return (
                <>
                  <span className="text-xl font-bold text-heading-color dark:text-dark-heading-color transition-opacity break-words">
                    {activeSlice.disciplina.nome}
                  </span>
                  <span className="block text-2xl font-bold text-primary-color">
                    {(activeSlice.progressMinutos / 60).toFixed(1)}h / {((activeSlice.disciplina.tempoAlocadoSemanalMinutos || 0) / 60).toFixed(1)}h
                  </span>
                </>
              );
            })() : (
              <>
                <span className="text-4xl font-bold text-primary-color">
                  {(totalProgressMinutos / 60).toFixed(1)}h
                </span>
                <span className="block text-lg font-normal text-subtle-text-color dark:text-dark-subtle-text-color -mt-1">
                  de {(totalMetaMinutos / 60).toFixed(1)}h
                </span>
                <span className="block text-sm font-semibold text-heading-color dark:text-dark-heading-color mt-1">
                  Progresso da Semana
                </span>
              </>
            )}
          </div>
        </div>

        {/* Legenda Interativa */}
        <div className="w-full lg:w-1/2 pl-0 lg:pl-12 mt-8 lg:mt-4 pr-4">
          <h3 className="text-lg font-semibold text-heading-color dark:text-dark-heading-color mb-4">
            Disciplinas do Ciclo
          </h3>
          <ul className="space-y-3">
            {slices.map(slice => (
              <li key={slice.key}>
                <button
                  onClick={() => onSelectDisciplina(slice.disciplina.id)}
                  onMouseEnter={() => setHoveredDisciplinaNome(slice.disciplina.nome)}
                  onMouseLeave={() => setHoveredDisciplinaNome(null)}
                  className={`ciclo-legend-item w-full ${slice.isActive ? 'active' : ''} ${selectedDisciplinaId === slice.disciplina.id ? 'selected' : ''}`}
                  style={{
                    '--disciplina-color': slice.color,
                    '--disciplina-color-transparent': hexToRgba(slice.color, 0.3)
                  }}
                >
                  <div className="flex items-center gap-3 w-full">
                    <span className="legend-dot" style={{ backgroundColor: slice.color }}></span>
                    <span className="flex-grow text-text-color dark:text-dark-text-color font-medium text-left">
                      {slice.disciplina.nome}
                      <span className={`text-xs ml-2 py-0.5 px-1.5 rounded-full ${
                        slice.disciplina.nivelProficiencia === 'Iniciante' ? 'bg-red-200 text-red-900' :
                        slice.disciplina.nivelProficiencia === 'Medio' ? 'bg-yellow-200 text-yellow-900' :
                        'bg-green-200 text-green-900'
                      }`}>
                        {slice.disciplina.nivelProficiencia?.substring(0,3)}
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-background-color dark:bg-dark-background-color rounded-full h-2 my-1 border border-border-color dark:border-dark-border-color">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${slice.progressPercentage * 100}%`,
                        backgroundColor: slice.color,
                        transition: 'width 0.5s ease'
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm w-full">
                    <span className="font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">
                      Prog: <span className='text-text-color dark:text-dark-text-color'>{(slice.progressMinutos / 60).toFixed(1)}h</span>
                    </span>
                    <span className="font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">
                      Meta: {((slice.disciplina.tempoAlocadoSemanalMinutos || 0) / 60).toFixed(1)}h
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}

export default CicloVisual;