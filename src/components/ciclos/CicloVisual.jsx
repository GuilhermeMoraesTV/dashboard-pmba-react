import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, onSnapshot, orderBy, where, Timestamp } from 'firebase/firestore';

// --- Funções Helper ---
const getWeekRange = () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay(); // 0 (Dom) - 6 (Sáb)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + diffToMonday);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return {
    start: Timestamp.fromDate(startOfWeek),
    end: Timestamp.fromDate(endOfWeek)
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
  onHover, // Adicionado para passar do pai
  onLeave  // Adicionado para passar do pai
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
    // Passa os handlers onHover/onLeave para o grupo
    <g style={style} className={`ciclo-slice-group ${isActive ? 'active' : ''}`} onMouseEnter={onHover} onMouseLeave={onLeave}>
      <circle
        className="ciclo-slice-goal"
        cx="100" cy="100" r={radius} fill="transparent" stroke={color}
        strokeWidth={strokeWidth} strokeDasharray={goalStrokeDasharray}
      />
      <circle
        className="ciclo-slice-progress"
        cx="100" cy="100" r={radius} fill="transparent" stroke={color}
        strokeWidth={isActive ? strokeWidth + 2 : strokeWidth + 0.5} // Efeito visual no anel
        strokeDasharray={progressStrokeDasharray} strokeLinecap="round"
      />
    </g>
  );
};
// --- Fim Sub-componente ---


// --- Componente Principal "Roda" ---
function CicloVisual({ cicloId, user, selectedDisciplinaId, onSelectDisciplina }) {
  const [disciplinas, setDisciplinas] = useState([]);
  const [progressMap, setProgressMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [hoveredDisciplinaNome, setHoveredDisciplinaNome] = useState(null);

  const radius = 80;
  const strokeWidth = 20;
  const gapAngle = 2;

  // Hook Metas
  useEffect(() => {
    if (!user || !cicloId) { setLoading(false); return; }
    setLoading(true);
    const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
    const q = query(disciplinasRef, orderBy('nome'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDisciplinas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => { console.error("Erro disciplinas:", error); setLoading(false); });
    return () => unsubscribe();
  }, [user, cicloId]);

  // Hook Progresso
  useEffect(() => {
    if (!user) return;
    const { start, end } = getWeekRange();
    const registrosRef = collection(db, 'users', user.uid, 'registrosEstudo');
    // Adiciona filtro por cicloId se necessário (depende se registros tem cicloId)
    // const q = query(registrosRef, where('cicloId', '==', cicloId), where('data', '>=', start), where('data', '<=', end));
    const q = query(registrosRef, where('data', '>=', start), where('data', '<=', end)); // Usando sem filtro de ciclo por enquanto
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newProgressMap = new Map();
      snapshot.forEach(doc => {
        const { disciplinaId, duracaoMinutos } = doc.data();
        // Garante que o registro pertence a este ciclo (se disciplinaId for suficiente)
        const pertenceAoCiclo = disciplinas.some(d => d.id === disciplinaId);
        if (pertenceAoCiclo && duracaoMinutos > 0) {
            newProgressMap.set(disciplinaId, (newProgressMap.get(disciplinaId) || 0) + duracaoMinutos);
        }
      });
      setProgressMap(newProgressMap);
    }, (error) => {
      console.error("Erro progresso:", error);
    });
    return () => unsubscribe();
    // Adiciona 'disciplinas' como dependência para refiltrar se as disciplinas do ciclo mudarem
  }, [user, cicloId, disciplinas]);

  // --- Lógica de Cálculo (useMemo Completo) ---
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
            key: disciplina.id, goalPercentage, progressPercentage, rotation, color, radius, strokeWidth,
            disciplina: disciplina, progressMinutos: progressMinutos, isActive: isActive
        };
    });
    return {
        totalMetaMinutos: calculatedTotalMetaMinutos,
        totalProgressMinutos: calculatedTotalProgressMinutos,
        slices: calculatedSlices
    };
  }, [disciplinas, progressMap, hoveredDisciplinaNome, selectedDisciplinaId, radius, strokeWidth, gapAngle]);
  // --- Fim Lógica de Cálculo ---


  if (loading) { return <div className="text-subtle-text-color dark:text-dark-subtle-text-color h-full flex items-center justify-center" style={{minHeight: '450px'}}>Carregando ciclo...</div>; }

  // --- JSX Completo e Verificado ---
  return (
    <div className="h-full">
      <div className="flex flex-col lg:flex-row items-center lg:items-start" style={{ minHeight: '450px' }}>

        {/* Roda (SVG) */}
        <div className="relative w-full max-w-[450px] lg:w-1/2" style={{ height: '450px' }}>
          <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ transform: 'rotate(-90deg)' }}>
            {slices.map(slice => (
              // Passa onHover e onLeave para o componente CicloSlice
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

        {/* Legenda Interativa (Direita) */}
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
                  {/* Div 1: Cor e Nome/Nível */}
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
                  {/* Div 2: Barra de Progresso */}
                  <div className="w-full bg-background-color dark:bg-dark-background-color rounded-full h-2 my-1 border border-border-color dark:border-dark-border-color">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${slice.progressPercentage * 100}%`, backgroundColor: slice.color, transition: 'width 0.5s ease'}}
                    ></div>
                  </div>
                  {/* Div 3: Textos Progresso/Meta */}
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