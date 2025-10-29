import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

const formatDecimalHours = (minutos) => {
    if (!minutos || minutos < 0) return '0h 0m';
    const totalMinutes = Math.round(minutos);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
};

// Hook para buscar Tópicos da Disciplina
const useTopicsDaDisciplina = (user, cicloId, disciplinaId) => {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !cicloId || !disciplinaId) {
      setTopics([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const topicsRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'topicos');
    const q = query(topicsRef, where('disciplinaId', '==', disciplinaId), orderBy('nome'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTopics(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar tópicos:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, cicloId, disciplinaId]);

  return { topics, loadingTopics: loading };
};

function TopicListPanel({ user, cicloId, disciplinaId, registrosEstudo }) {

  // 1. Busca os tópicos da disciplina selecionada
  const { topics, loadingTopics } = useTopicsDaDisciplina(user, cicloId, disciplinaId);

  // 2. Processa os registros de estudo para agregar dados por tópico
  const topicSummary = useMemo(() => {
    if (!topics || topics.length === 0) return new Map();

    const summaryMap = new Map();
    topics.forEach(topic => {
      summaryMap.set(topic.id, {
        ...topic,
        totalMinutes: 0,
        totalQuestions: 0,
        totalCorrect: 0,
      });
    });

    // Filtra registros da disciplina
    const registrosDaDisciplina = registrosEstudo.filter(r => r.disciplinaId === disciplinaId);

    registrosDaDisciplina.forEach(registro => {
      if (registro.topicoId && summaryMap.has(registro.topicoId)) {
        const topicData = summaryMap.get(registro.topicoId);

        // NORMALIZAÇÃO COMPLETA
        const minutos = Number(registro.tempoEstudadoMinutos || 0);
        const questoes = Number(registro.questoesFeitas || 0);
        const acertos = Number(registro.acertos || 0);

        if (minutos > 0) {
          topicData.totalMinutes += minutos;
        }
        if (questoes > 0) {
          topicData.totalQuestions += questoes;
          topicData.totalCorrect += acertos;
        }
      }
    });

    return summaryMap;
  }, [topics, registrosEstudo, disciplinaId]);

  if (loadingTopics) {
    return <p className="text-subtle-text-color dark:text-dark-subtle-text-color p-4">Carregando tópicos...</p>;
  }

  if (topics.length === 0) {
     return (
       <div className="flex flex-col items-center justify-center py-10 text-center">
         <span className="text-4xl mb-3">📚</span>
         <p className="text-subtle-text-color dark:text-dark-subtle-text-color font-semibold">
           Nenhum tópico cadastrado
         </p>
         <p className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color mt-1">
           Adicione tópicos ao editar o ciclo
         </p>
       </div>
     );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4">
        Tópicos da Disciplina
      </h2>
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {Array.from(topicSummary.values()).map(topicData => {
          const performance = topicData.totalQuestions > 0
            ? ((topicData.totalCorrect / topicData.totalQuestions) * 100).toFixed(0) + '%'
            : '-';

          return (
            <div
              key={topicData.id}
              className="bg-background-color dark:bg-dark-background-color p-4 rounded-lg border border-border-color dark:border-dark-border-color"
            >
              <h4 className="font-semibold text-text-color dark:text-dark-text-color mb-2">{topicData.nome}</h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center">
                  <span className="block text-xs text-subtle-text-color dark:text-dark-subtle-text-color">Tempo</span>
                  <span className="font-semibold text-primary-color">{formatDecimalHours(topicData.totalMinutes)}</span>
                </div>
                <div className="text-center">
                   <span className="block text-xs text-subtle-text-color dark:text-dark-subtle-text-color">Questões</span>
                   <span className="font-semibold text-text-color dark:text-dark-text-color">{topicData.totalQuestions}</span>
                </div>
                 <div className="text-center">
                   <span className="block text-xs text-subtle-text-color dark:text-dark-subtle-text-color">Desempenho</span>
                   <span className="font-semibold text-text-color dark:text-dark-text-color">{performance}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TopicListPanel;