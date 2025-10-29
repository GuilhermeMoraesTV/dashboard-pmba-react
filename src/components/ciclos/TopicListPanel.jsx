import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
// [CORREÇÃO 2] Importando o hook externo padronizado
import useTopicsDaDisciplina from '../../hooks/useTopicsDaDisciplina';

// Ícones
const IconBook = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
  </svg>
);
const IconClock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);
const IconQuestions = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
  </svg>
);
const IconTrophy = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
  </svg>
);
const IconPlusCircle = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);

const formatDecimalHours = (minutos) => {
    if (!minutos || minutos < 0) return '0h 0m';
    const totalMinutes = Math.round(minutos);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
};

// [CORREÇÃO 2] Hook inline removido.

function TopicListPanel({ user, cicloId, disciplinaId, registrosEstudo, disciplinaNome, onQuickAddTopic }) {

  console.log("📊 TopicListPanel renderizado:", {
    disciplinaId,
    totalRegistros: registrosEstudo?.length || 0
  });

  // 1. Busca os tópicos da disciplina selecionada usando o hook externo
  const { topics, loadingTopics } = useTopicsDaDisciplina(user, cicloId, disciplinaId);

  // 2. Processa os registros de estudo para agregar dados por tópico
  const topicSummary = useMemo(() => {
    if (!topics || topics.length === 0) {
      console.log("⚠️ Nenhum tópico disponível para processar");
      return new Map();
    }

    const summaryMap = new Map();

    topics.forEach(topic => {
      summaryMap.set(topic.id, {
        ...topic,
        totalMinutes: 0,
        totalQuestions: 0,
        totalCorrect: 0,
        registrosCount: 0
      });
    });

    // [CORREÇÃO 2] Otimização: A prop 'registrosEstudo' já vem filtrada do modal.
    // Não é necessário filtrar novamente por 'disciplinaId'.
    console.log("📝 Processando registros da disciplina:", registrosEstudo.length);

    registrosEstudo.forEach(registro => {
      console.log("🔍 Registro:", {
        topicoId: registro.topicoId,
        minutos: registro.tempoEstudadoMinutos,
        questoes: registro.questoesFeitas
      });

      if (registro.topicoId && summaryMap.has(registro.topicoId)) {
        const topicData = summaryMap.get(registro.topicoId);

        const minutos = Number(registro.tempoEstudadoMinutos || 0);
        const questoes = Number(registro.questoesFeitas || 0);
        const acertos = Number(registro.acertos || 0);

        if (minutos > 0) {
          topicData.totalMinutes += minutos;
          topicData.registrosCount++;
        }

        if (questoes > 0) {
          topicData.totalQuestions += questoes;
          topicData.totalCorrect += acertos;
          if (minutos === 0) topicData.registrosCount++;
        }
      }
    });

    console.log("📊 Resumo final dos tópicos:", Array.from(summaryMap.values()));
    return summaryMap;
  // [CORREÇÃO 2] A dependência 'disciplinaId' é removida do useMemo,
  // pois a prop 'registrosEstudo' já depende dela no componente pai.
  }, [topics, registrosEstudo]);

  if (loadingTopics) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-color mx-auto mb-4"></div>
          <p className="text-subtle-text-color dark:text-dark-subtle-text-color">Carregando tópicos...</p>
        </div>
      </div>
    );
  }

  if (topics.length === 0) {
     return (
       <div className="flex flex-col items-center justify-center py-12 text-center">
         <div className="w-20 h-20 rounded-full bg-primary-color/10 flex items-center justify-center mb-4">
           <IconBook />
         </div>
         <h3 className="text-lg font-semibold text-heading-color dark:text-dark-heading-color mb-2">
           Nenhum tópico cadastrado
         </h3>
         <p className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color max-w-xs">
           Adicione tópicos a esta disciplina editando o ciclo para acompanhar seu progresso detalhado.
         </p>
       </div>
     );
  }

  const topicArray = Array.from(topicSummary.values());
  const totalTopics = topicArray.length;
  const studiedTopics = topicArray.filter(t => t.registrosCount > 0).length;
  const completionPercentage = totalTopics > 0 ? (studiedTopics / totalTopics * 100).toFixed(0) : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header com estatísticas */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-2">
          {disciplinaNome || 'Tópicos da Disciplina'}
        </h2>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <IconBook />
            <span className="text-subtle-text-color dark:text-dark-subtle-text-color">
              {studiedTopics}/{totalTopics} estudados
            </span>
          </div>
          <div className="flex-1 bg-border-color dark:bg-dark-border-color rounded-full h-2">
            <div
              className="bg-primary-color h-full rounded-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
          <span className="font-semibold text-primary-color">
            {completionPercentage}%
          </span>
        </div>
      </div>

      {/* Lista de Tópicos */}
      <div className="flex-1 space-y-3 overflow-y-auto pr-2 pb-2" style={{ maxHeight: 'calc(100vh - 400px)' }}>
        {topicArray.map(topicData => {
          const performance = topicData.totalQuestions > 0
            ? ((topicData.totalCorrect / topicData.totalQuestions) * 100).toFixed(0)
            : null;

          const hasData = topicData.totalMinutes > 0 || topicData.totalQuestions > 0;

          return (
            <div
              key={topicData.id}
              className={`
                relative overflow-hidden rounded-lg border-2 transition-all duration-200
                ${hasData
                  ? 'bg-card-background-color dark:bg-dark-card-background-color border-primary-color/20 hover:border-primary-color/50 hover:shadow-lg'
                  : 'bg-background-color dark:bg-dark-background-color border-border-color dark:border-dark-border-color opacity-60'
                }
              `}
            >
              {hasData && (
                <div
                  className="absolute inset-0 bg-primary-color/5 transition-all duration-500"
                  style={{
                    width: performance ? `${performance}%` : '100%',
                    opacity: 0.3
                  }}
                ></div>
              )}

              <div className="relative p-4">
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-semibold text-text-color dark:text-dark-text-color flex items-center gap-2 flex-1 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${hasData ? 'bg-primary-color' : 'bg-border-color dark:bg-dark-border-color'}`}></span>
                    <span className="truncate">{topicData.nome}</span>
                  </h4>
                  {hasData && (
                    <span className="text-xs font-bold bg-primary-color/20 text-primary-color px-2 py-1 rounded-full ml-2 flex-shrink-0">
                      {topicData.registrosCount} {topicData.registrosCount === 1 ? 'registro' : 'registros'}
                    </span>
                  )}
                </div>

                {hasData ? (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-background-color dark:bg-dark-background-color rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <IconClock />
                      </div>
                      <div className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color mb-1">
                        Tempo
                      </div>
                      <div className="font-bold text-sm text-primary-color">
                        {formatDecimalHours(topicData.totalMinutes)}
                      </div>
                    </div>

                    <div className="text-center p-2 bg-background-color dark:bg-dark-background-color rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <IconQuestions />
                      </div>
                      <div className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color mb-1">
                        Questões
                      </div>
                      <div className="font-bold text-sm text-text-color dark:text-dark-text-color">
                        {topicData.totalQuestions}
                      </div>
                    </div>

                    <div className="text-center p-2 bg-background-color dark:bg-dark-background-color rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <IconTrophy />
                      </div>
                      <div className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color mb-1">
                        Acertos
                      </div>
                      <div className={`font-bold text-sm ${
                        performance >= 70 ? 'text-success-color' :
                        performance >= 50 ? 'text-warning-color' :
                        'text-danger-color'
                      }`}>
                        {performance ? `${performance}%` : '--'}
                      </div>
                    </div>
                  </div>
                ) : (
                  !onQuickAddTopic && (
                    <div className="text-center py-3">
                      <p className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color">
                        Nenhum registro ainda
                      </p>
                    </div>
                  )
                )}

                {onQuickAddTopic && (
                    <button
                      onClick={() => onQuickAddTopic(disciplinaId, topicData)}
                      className={`flex items-center justify-center gap-2 text-sm font-semibold transition-colors w-full mt-4 p-2 rounded-lg
                        ${hasData
                          ? 'text-primary-color hover:text-primary-hover bg-primary-color/10 hover:bg-primary-color/20'
                          : 'text-subtle-text-color dark:text-dark-subtle-text-color hover:text-primary-color bg-background-color dark:bg-dark-background-color hover:bg-primary-color/10 border border-dashed border-border-color dark:border-dark-border-color'
                        }
                      `}
                    >
                      <IconPlusCircle />
                      {hasData ? 'Registrar mais' : 'Registrar primeiro estudo'}
                    </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TopicListPanel;