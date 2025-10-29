import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { doc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import CicloVisual from '../components/ciclos/CicloVisual';
import RegistroEstudoModal from '../components/ciclos/RegistroEstudoModal';
import TopicListPanel from '../components/ciclos/TopicListPanel';

// Ícones
const IconArrowLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
  </svg>
);

const IconPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const IconInfo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
  </svg>
);

const IconFire = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
  </svg>
);

const IconClock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const IconTarget = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
  </svg>
);

const IconChart = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
);

const IconCalendar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
  </svg>
);

const IconTrophy = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
  </svg>
);

// Helper para normalizar data
const dateToYMD_local = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDecimalHours = (minutos) => {
  if (!minutos || minutos < 0) return '0h 0m';
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return `${h}h ${m}m`;
};

// Componente de Streak dos últimos 7 dias
function MiniStreak({ registrosEstudo }) {
  const last7Days = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = dateToYMD_local(date);

      const hasStudy = registrosEstudo.some(r => r.data === dateStr);

      days.push({
        date: dateStr,
        day: date.getDate(),
        hasStudy,
        isToday: i === 0
      });
    }
    return days;
  }, [registrosEstudo]);

  const currentStreak = useMemo(() => {
    let streak = 0;
    for (let i = last7Days.length - 1; i >= 0; i--) {
      if (last7Days[i].hasStudy) {
        streak++;
      } else if (i < last7Days.length - 1) {
        break;
      }
    }
    return streak;
  }, [last7Days]);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <IconFire />
        <div>
          <div className="text-2xl font-bold text-heading-color dark:text-dark-heading-color">
            {currentStreak}
          </div>
          <div className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color -mt-1">
            dias
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        {last7Days.map((day, idx) => (
          <div
            key={idx}
            className={`
              w-8 h-8 rounded-md flex items-center justify-center text-xs font-semibold transition-all
              ${day.hasStudy
                ? 'bg-success-color text-white'
                : 'bg-border-color dark:bg-dark-border-color text-subtle-text-color dark:text-dark-subtle-text-color'
              }
              ${day.isToday ? 'ring-2 ring-primary-color ring-offset-2 dark:ring-offset-dark-card-background-color' : ''}
            `}
          >
            {day.day}
          </div>
        ))}
      </div>
    </div>
  );
}

// Componente de Atividade Recente
function RecentActivity({ registrosEstudo }) {
  const recentRegistros = useMemo(() => {
    return [...registrosEstudo]
      .sort((a, b) => {
        const dateA = new Date(a.data);
        const dateB = new Date(b.data);
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [registrosEstudo]);

  return (
    <div className="space-y-2">
      {recentRegistros.length === 0 ? (
        <p className="text-center text-subtle-text-color dark:text-dark-subtle-text-color py-4 text-sm">
          Nenhuma atividade recente
        </p>
      ) : (
        recentRegistros.map((registro) => {
          const date = new Date(registro.data);
          const isToday = dateToYMD_local(new Date()) === registro.data;

          return (
            <div
              key={registro.id}
              className="flex items-center gap-3 p-3 bg-background-color dark:bg-dark-background-color rounded-lg border border-border-color dark:border-dark-border-color hover:border-primary-color dark:hover:border-primary-color transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${
                registro.tipoEstudo === 'Teoria' ? 'bg-blue-500' :
                registro.tipoEstudo === 'Questões' ? 'bg-green-500' :
                'bg-yellow-500'
              }`}>
                {registro.tipoEstudo === 'Teoria' ? '📖' :
                 registro.tipoEstudo === 'Questões' ? '✓' : '🔄'}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-text-color dark:text-dark-text-color truncate">
                  {registro.disciplinaNome}
                </p>
                <p className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color">
                  {registro.tipoEstudo} • {isToday ? 'Hoje' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </p>
              </div>

              <div className="text-right">
                {registro.tempoEstudadoMinutos > 0 && (
                  <p className="text-xs font-semibold text-primary-color">
                    {formatDecimalHours(registro.tempoEstudadoMinutos)}
                  </p>
                )}
                {registro.questoesFeitas > 0 && (
                  <p className="text-xs font-semibold text-success-color">
                    {registro.acertos}/{registro.questoesFeitas}
                  </p>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function CicloDetalhePage({ cicloId, onBack, user, addRegistroEstudo }) {
  const [ciclo, setCiclo] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [loadingCiclo, setLoadingCiclo] = useState(true);
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState(null);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);
  const [loadingRegistros, setLoadingRegistros] = useState(true);
  const [loadingDisciplinas, setLoadingDisciplinas] = useState(true);
  const [activeView, setActiveView] = useState('roda');

  useEffect(() => {
    if (!user || !cicloId) return;
    setLoadingCiclo(true);
    const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
    const unsubscribe = onSnapshot(cicloRef, (doc) => {
      if (doc.exists()) {
        setCiclo({ id: doc.id, ...doc.data() });
      } else {
        setCiclo(null);
      }
      setLoadingCiclo(false);
    }, (error) => {
      console.error("Erro ao buscar ciclo:", error);
      setLoadingCiclo(false);
    });
    return () => unsubscribe();
  }, [user, cicloId]);

  useEffect(() => {
    if (!user || !cicloId) return;
    setLoadingDisciplinas(true);
    const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
    const q = query(disciplinasRef, orderBy('nome'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const disciplinasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDisciplinas(disciplinasData);
      setLoadingDisciplinas(false);
    }, (error) => {
      console.error("Erro ao buscar disciplinas:", error);
      setLoadingDisciplinas(false);
    });
    return () => unsubscribe();
  }, [user, cicloId]);

  useEffect(() => {
    if (!user) return;
    setLoadingRegistros(true);
    const q = query(
      collection(db, 'users', user.uid, 'registrosEstudo'),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const todosRegistros = snapshot.docs.map(doc => {
        const data = doc.data();
        let dataStr = data.data;
        if (data.data && typeof data.data.toDate === 'function') {
          dataStr = dateToYMD_local(data.data.toDate());
        } else if (!dataStr || typeof dataStr !== 'string') {
          dataStr = dateToYMD_local(new Date());
        }
        return {
          id: doc.id,
          ...data,
          tempoEstudadoMinutos: Number(data.tempoEstudadoMinutos || 0),
          questoesFeitas: Number(data.questoesFeitas || 0),
          acertos: Number(data.acertos || 0),
          data: dataStr,
        };
      });
      setAllRegistrosEstudo(todosRegistros);
      setLoadingRegistros(false);
    }, (error) => {
      console.error("❌ Erro ao buscar registros:", error);
      setLoadingRegistros(false);
    });
    return () => unsubscribe();
  }, [user]);

  const registrosDoCiclo = useMemo(() => {
    if (loadingRegistros || !cicloId) return [];
    return allRegistrosEstudo.filter(reg => reg.cicloId === cicloId);
  }, [allRegistrosEstudo, cicloId, loadingRegistros]);

  const stats = useMemo(() => {
    const totalMinutos = registrosDoCiclo.reduce((sum, r) => sum + r.tempoEstudadoMinutos, 0);
    const totalQuestoes = registrosDoCiclo.reduce((sum, r) => sum + r.questoesFeitas, 0);
    const totalAcertos = registrosDoCiclo.reduce((sum, r) => sum + r.acertos, 0);
    const performance = totalQuestoes > 0 ? (totalAcertos / totalQuestoes * 100).toFixed(0) : 0;
    const diasUnicos = new Set(registrosDoCiclo.map(r => r.data)).size;
    return {
      totalHoras: totalMinutos / 60,
      totalQuestoes,
      performance,
      diasEstudados: diasUnicos,
      totalRegistros: registrosDoCiclo.length
    };
  }, [registrosDoCiclo]);

  const handleSelectDisciplina = (disciplinaId) => {
    setSelectedDisciplinaId(prevId => (prevId === disciplinaId ? null : disciplinaId));
  };

  if (loadingCiclo || loadingRegistros || loadingDisciplinas) {
    return (
      <div className="flex justify-center items-center p-6 min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-color mx-auto mb-4"></div>
          <p className="text-text-color dark:text-dark-text-color font-semibold">Carregando ciclo...</p>
        </div>
      </div>
    );
  }

  if (!ciclo) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold text-heading-color dark:text-dark-heading-color mb-2">
            Ciclo não encontrado
          </h2>
          <p className="text-subtle-text-color dark:text-dark-subtle-text-color mb-6">
            Este ciclo pode ter sido arquivado ou excluído.
          </p>
          <button onClick={onBack} className="px-5 py-2 bg-primary-color text-white rounded-lg font-semibold hover:brightness-110 transition-all">
            Voltar para Meus Ciclos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-0 space-y-6">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-color to-blue-600 dark:from-primary-color dark:to-blue-800 rounded-2xl shadow-xl p-6">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        <div className="relative z-10">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-4 font-semibold transition-colors"
          >
            <IconArrowLeft /> Voltar para Meus Ciclos
          </button>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl lg:text-4xl font-bold text-white">
                  {ciclo.nome}
                </h1>
                {ciclo.ativo && (
                  <span className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-sm font-bold rounded-full">
                    ATIVO
                  </span>
                )}
              </div>
              <p className="text-white/80 flex items-center gap-2">
                <IconTarget />
                Meta Semanal: {ciclo.cargaHorariaSemanalTotal}h
              </p>
            </div>

            <button
              onClick={() => setShowRegistroModal(true)}
              disabled={!ciclo.ativo}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-primary-color rounded-lg font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <IconPlus />
              Registrar Estudo
            </button>
          </div>
        </div>
      </div>

      {!ciclo.ativo && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-xl p-4 flex items-start gap-3">
          <IconInfo />
          <div className="flex-1">
            <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-1">
              Este ciclo não está ativo
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Você não pode registrar novos estudos em um ciclo inativo. Para registrar, ative este ciclo na página "Meus Ciclos".
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <IconClock />
            <span className="text-sm font-medium">Tempo Total</span>
          </div>
          <p className="text-3xl font-bold">{formatDecimalHours(stats.totalHoras * 60)}</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <IconChart />
            <span className="text-sm font-medium">Questões</span>
          </div>
          <p className="text-3xl font-bold">{stats.totalQuestoes}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <IconTrophy />
            <span className="text-sm font-medium">Desempenho</span>
          </div>
          <p className="text-3xl font-bold">{stats.performance}%</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <IconCalendar />
            <span className="text-sm font-medium">Dias Estudados</span>
          </div>
          <p className="text-3xl font-bold">{stats.diasEstudados}</p>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex bg-card-background-color dark:bg-dark-card-background-color rounded-lg p-1 shadow-md border border-border-color dark:border-dark-border-color">
          <button
            onClick={() => setActiveView('roda')}
            className={`px-6 py-2 rounded-md font-semibold transition-all ${
              activeView === 'roda'
                ? 'bg-primary-color text-white shadow-md'
                : 'text-subtle-text-color dark:text-dark-subtle-text-color hover:text-text-color dark:hover:text-dark-text-color'
            }`}
          >
            Visão Geral
          </button>
          <button
            onClick={() => setActiveView('stats')}
            className={`px-6 py-2 rounded-md font-semibold transition-all ${
              activeView === 'stats'
                ? 'bg-primary-color text-white shadow-md'
                : 'text-subtle-text-color dark:text-dark-subtle-text-color hover:text-text-color dark:hover:text-dark-text-color'
            }`}
          >
            Estatísticas
          </button>
        </div>
      </div>

      {activeView === 'roda' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color">
            <CicloVisual
              cicloId={cicloId}
              user={user}
              selectedDisciplinaId={selectedDisciplinaId}
              onSelectDisciplina={handleSelectDisciplina}
              registrosEstudo={registrosDoCiclo}
            />
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color min-h-[400px]">
              {selectedDisciplinaId && ciclo.ativo ? (
                <TopicListPanel
                  user={user}
                  cicloId={cicloId}
                  disciplinaId={selectedDisciplinaId}
                  registrosEstudo={registrosDoCiclo}
                  disciplinaNome={disciplinas.find(d => d.id === selectedDisciplinaId)?.nome}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-10">
                  <div className="w-20 h-20 rounded-full bg-primary-color/10 flex items-center justify-center mb-4">
                    <span className="text-4xl">📚</span>
                  </div>
                  <p className="font-semibold text-heading-color dark:text-dark-heading-color mb-2">
                    {!ciclo.ativo ? "Ciclo Inativo" : "Selecione uma disciplina"}
                  </p>
                  <p className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color">
                    {!ciclo.ativo
                      ? "O desempenho não é exibido para ciclos inativos."
                      : "Clique em uma disciplina na legenda ao lado para ver seus tópicos e progresso detalhado."
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color">
            <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4 flex items-center gap-2">
              <IconFire />
              Constância de Estudos
            </h2>
            <MiniStreak registrosEstudo={registrosDoCiclo} />

            <div className="mt-6 pt-6 border-t border-border-color dark:border-dark-border-color">
              <h3 className="text-lg font-semibold text-heading-color dark:text-dark-heading-color mb-3">
                Estatísticas Gerais
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-subtle-text-color dark:text-dark-subtle-text-color">
                    Total de Registros
                  </span>
                  <span className="text-xl font-bold text-text-color dark:text-dark-text-color">
                    {stats.totalRegistros}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-subtle-text-color dark:text-dark-subtle-text-color">
                    Disciplinas no Ciclo
                  </span>
                  <span className="text-xl font-bold text-text-color dark:text-dark-text-color">
                    {disciplinas.length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-subtle-text-color dark:text-dark-subtle-text-color">
                    Dias Estudados
                  </span>
                  <span className="text-xl font-bold text-text-color dark:text-dark-text-color">
                    {stats.diasEstudados}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-subtle-text-color dark:text-dark-subtle-text-color">
                    Tempo Total
                  </span>
                  <span className="text-xl font-bold text-primary-color">
                    {formatDecimalHours(stats.totalHoras * 60)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border-color dark:border-dark-border-color">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-heading-color dark:text-dark-heading-color">
                  Desempenho em Questões
                </h3>
                <span className="text-2xl font-bold text-primary-color">
                  {stats.performance}%
                </span>
              </div>

              {stats.totalQuestoes > 0 ? (
                <div className="space-y-3">
                  <div className="w-full bg-border-color dark:bg-dark-border-color rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                      style={{ width: `${stats.performance}%` }}
                    ></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color mb-1">
                        Acertos
                      </p>
                      <p className="text-xl font-bold text-success-color">
                        {registrosDoCiclo.reduce((sum, r) => sum + r.acertos, 0)}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <p className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color mb-1">
                        Erros
                      </p>
                      <p className="text-xl font-bold text-danger-color">
                        {stats.totalQuestoes - registrosDoCiclo.reduce((sum, r) => sum + r.acertos, 0)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-subtle-text-color dark:text-dark-subtle-text-color py-4 text-sm">
                  Nenhuma questão registrada ainda
                </p>
              )}
            </div>
          </div>

          <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color">
            <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4">
              Atividade Recente
            </h2>
            <RecentActivity registrosEstudo={registrosDoCiclo} />
          </div>
        </div>
      )}

      {showRegistroModal && (
        <RegistroEstudoModal
          onClose={() => setShowRegistroModal(false)}
          addRegistroEstudo={addRegistroEstudo}
          cicloId={cicloId}
          userId={user.uid}
          disciplinasDoCiclo={disciplinas}
        />
      )}
    </div>
  );
}

export default CicloDetalhePage;