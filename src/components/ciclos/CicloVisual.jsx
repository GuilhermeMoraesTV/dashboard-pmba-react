import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, onSnapshot, orderBy, where, Timestamp } from 'firebase/firestore';

// --- Funções de Data (Helpers) ---
// Pega o início (Segunda) e fim (Domingo) da semana atual
const getWeekRange = () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay(); // 0 (Dom) - 6 (Sáb)

  // Ajusta para a semana começar na Segunda (ISO 8601)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + diffToMonday);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999); // Fim do Domingo

  return {
    start: Timestamp.fromDate(startOfWeek),
    end: Timestamp.fromDate(endOfWeek)
  };
};

// --- Sub-componente "Fatia" do Ciclo (Novo Estilo Progressivo) ---
const CicloSlice = ({
  disciplina,
  goalPercentage,   // % do anel total (ex: 25% do círculo)
  progressPercentage, // % de preenchimento (ex: 50% da *fatia*)
  rotation,         // Rotação da fatia
  color,
  radius,
  strokeWidth,
  isActive,
}) => {
  const circumference = 2 * Math.PI * radius;
  // Comprimento do arco da META
  const goalStrokeDasharray = `${circumference * goalPercentage} ${circumference}`;
  // Comprimento do arco do PROGRESSO (limitado pelo goalPercentage)
  const progressStrokeDasharray = `${circumference * goalPercentage * progressPercentage} ${circumference}`;

  const style = {
    transform: `rotate(${rotation - 90}deg)`,
    transformOrigin: 'center',
    transition: 'all 0.3s ease',
  };

  return (
    <g style={style} className={`ciclo-slice-group ${isActive ? 'active' : ''}`}>
      {/* 1. Anel da META (fundo) */}
      <circle
        className="ciclo-slice-goal"
        cx="100" cy="100"
        r={radius}
        fill="transparent"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={goalStrokeDasharray}
      />
      {/* 2. Anel do PROGRESSO (frente) */}
      <circle
        className="ciclo-slice-progress"
        cx="100" cy="100"
        r={radius}
        fill="transparent"
        stroke={color}
        strokeWidth={strokeWidth + 0.5} // 0.5 a mais para cobrir perfeitamente
        strokeDasharray={progressStrokeDasharray}
        strokeLinecap="round" // Ponta arredondada para o progresso
      />
    </g>
  );
};

// --- Componente Principal "Roda" (Novo Estilo) ---
function CicloVisual({ cicloId, user }) {
  const [disciplinas, setDisciplinas] = useState([]);
  const [progressMap, setProgressMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [hoveredDisciplina, setHoveredDisciplina] = useState(null);

  // --- PARÂMETROS DE DESIGN (MAIOR) ---
  const radius = 80; // Raio bem maior
  const strokeWidth = 20; // Traço bem mais grosso
  const gapAngle = 2; // Espaço entre as fatias

  // --- 1. Hook para buscar as METAS (Disciplinas do Ciclo) ---
  useEffect(() => {
    if (!user || !cicloId) return;
    setLoading(true);

    const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
    const q = query(disciplinasRef, orderBy('nome'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setDisciplinas(data);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar disciplinas:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, cicloId]);

  // --- 2. Hook para buscar o PROGRESSO (Registros da Semana) ---
  useEffect(() => {
    if (!user) return;

    // Pega Segunda e Domingo desta semana
    const { start, end } = getWeekRange();

    // ATENÇÃO: 'registrosEstudo' é a sua *nova* coleção unificada.
    // Ela DEVE ser criada pelo seu modal de registro.
    const registrosRef = collection(db, 'users', user.uid, 'registrosEstudo');
    const q = query(
      registrosRef,
      where('data', '>=', start),
      where('data', '<=', end)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newProgressMap = new Map();

      snapshot.forEach(doc => {
        const registro = doc.data();
        const { disciplinaId, duracaoMinutos } = registro;

        if (disciplinaId && duracaoMinutos > 0) {
          const totalAnterior = newProgressMap.get(disciplinaId) || 0;
          newProgressMap.set(disciplinaId, totalAnterior + duracaoMinutos);
        }
      });
      setProgressMap(newProgressMap);

    }, (error) => {
      console.error("Erro ao buscar progresso:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // --- 3. Lógica de Cálculo (Meta vs Progresso) ---
  const totalMetaMinutos = disciplinas.reduce((sum, d) => sum + d.tempoAlocadoSemanalMinutos, 0);
  const totalProgressMinutos = Array.from(progressMap.values()).reduce((sum, m) => sum + m, 0);

  const totalGaps = disciplinas.length;
  const totalGapDegrees = totalGaps * gapAngle;
  const drawableDegrees = 360 - totalGapDegrees;

  let cumulativeRotation = 0;

  const slices = disciplinas.map((disciplina, index) => {
    const metaMinutos = disciplina.tempoAlocadoSemanalMinutos;
    const progressMinutos = progressMap.get(disciplina.id) || 0; // Pega o progresso do Map

    // % da disciplina no tempo total (para o tamanho da fatia)
    const percentageOfTime = totalMetaMinutos > 0 ? metaMinutos / totalMetaMinutos : 0;
    const sliceAngle = percentageOfTime * drawableDegrees;
    const goalPercentage = sliceAngle / 360; // % do arco da meta

    // % de progresso *dentro* da fatia
    const progressPercentage = metaMinutos > 0 ? Math.min(progressMinutos / metaMinutos, 1) : 0; // (Ex: 0.5 = 50%)

    const rotation = cumulativeRotation;

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#EC4899', '#8B5CF6', '#06B6D4'];
    const color = colors[index % colors.length];

    const sliceData = {
      key: disciplina.id,
      goalPercentage,
      progressPercentage,
      rotation,
      color,
      radius,
      strokeWidth,
      disciplina: disciplina,
      progressMinutos: progressMinutos,
      isActive: hoveredDisciplina === disciplina.nome
    };

    cumulativeRotation += sliceAngle + gapAngle;
    return sliceData;
  });

  if (loading) {
    return <div className="text-subtle-text-color dark:text-dark-subtle-text-color h-full flex items-center justify-center" style={{minHeight: '450px'}}>Carregando ciclo...</div>;
  }

  // --- 4. JSX (Novo Layout: Roda + Legenda) ---
  return (
    <div className="h-full">
      {/* Layout Flex (Roda na esquerda, Legenda na direita) */}
      <div className="flex flex-col lg:flex-row items-center lg:items-start" style={{ minHeight: '450px' }}>

        {/* Roda (SVG) - "Bem maior" */}
        <div className="relative w-full max-w-[450px] lg:w-1/2" style={{ height: '450px' }}>
          <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ transform: 'rotate(-90deg)' }}> {/* Gira o SVG todo */}
            {/* Fatias do ciclo (Meta e Progresso) */}
            {slices.map(slice => (
              <CicloSlice
                key={slice.key}
                {...slice}
                rotation={slice.rotation + 90} // Compensa a rotação do SVG
                onHover={() => setHoveredDisciplina(slice.disciplina.nome)}
                onLeave={() => setHoveredDisciplina(null)}
              />
            ))}
          </svg>

          {/* Texto no centro */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none w-2/3">
            {hoveredDisciplina ? (
              <>
                <span className="text-xl font-bold text-heading-color dark:text-dark-heading-color transition-opacity break-words">
                  {hoveredDisciplina}
                </span>
                <span className="block text-2xl font-bold text-primary-color">
                  {(slices.find(s => s.disciplina.nome === hoveredDisciplina).progressMinutos / 60).toFixed(1)}h / {(slices.find(s => s.disciplina.nome === hoveredDisciplina).disciplina.tempoAlocadoSemanalMinutos / 60).toFixed(1)}h
                </span>
              </>
            ) : (
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
            Resumo do Ciclo
          </h3>
          <ul className="space-y-3">
            {slices.map(slice => (
              <li
                key={slice.key}
                onMouseEnter={() => setHoveredDisciplina(slice.disciplina.nome)}
                onMouseLeave={() => setHoveredDisciplina(null)}
                className={`ciclo-legend-item ${slice.isActive ? 'active' : ''}`}
              >
                {/* Cor e Nome */}
                <div className="flex items-center gap-3">
                  <span className="legend-dot" style={{ backgroundColor: slice.color }}></span>
                  <span className="flex-grow text-text-color dark:text-dark-text-color font-medium">
                    {slice.disciplina.nome}
                  </span>
                </div>

                {/* Barra de Progresso Linear */}
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

                {/* Textos (Progresso e Meta) */}
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">
                    Progresso: <span className='text-text-color dark:text-dark-text-color'>{(slice.progressMinutos / 60).toFixed(1)}h</span>
                  </span>
                  <span className="font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">
                    Meta: {(slice.disciplina.tempoAlocadoSemanalMinutos / 60).toFixed(1)}h
                  </span>
                </div>

              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}

export default CicloVisual;