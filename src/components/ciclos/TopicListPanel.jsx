import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

// Função helper (copie se necessário)
const formatDecimalHours = (d) => {
    if (!d || d < 0) return '0h 0m'; // Formato mais curto
    const totalMinutes = Math.round(d); // Já recebe minutos
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
};

// Hook para buscar Tópicos da Disciplina (Reutilizado)
const useTopicsDaDisciplina = (user, cicloId, disciplinaId) => {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!user || !cicloId || !disciplinaId) { setTopics([]); setLoading(false); return; }
    setLoading(true);
    const topicsRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'topicos');
    const q = query(topicsRef, where('disciplinaId', '==', disciplinaId), orderBy('nome'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTopics(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => { console.error("Erro ao buscar tópicos:", error); setLoading(false); });
    return () => unsubscribe();
  }, [user, cicloId, disciplinaId]);
  return { topics, loadingTopics: loading };
};


// --- COMPONENTE PRINCIPAL DO PAINEL DE TÓPICOS ---
function TopicListPanel({ user, cicloId, disciplinaId, registrosEstudo }) {

  // 1. Busca os tópicos da disciplina selecionada
  const { topics, loadingTopics } = useTopicsDaDisciplina(user, cicloId, disciplinaId);

  // 2. Processa os registros de estudo para agregar dados por tópico
  const topicSummary = useMemo(() => {
    if (!topics || topics.length === 0) return new Map();

    const summaryMap = new Map();
    // Inicializa o mapa com todos os tópicos
    topics.forEach(topic => {
      summaryMap.set(topic.id, {
        ...topic, // Inclui nome, etc.
        totalMinutes: 0,
        totalQuestions: 0,
        totalCorrect: 0,
      });
    });

    // Filtra registros SÓ da disciplina selecionada (otimização)
    const registrosDaDisciplina = registrosEstudo.filter(r => r.disciplinaId === disciplinaId);

    // Agrega os dados dos registros
    registrosDaDisciplina.forEach(registro => {
      if (registro.topicId && summaryMap.has(registro.topicId)) {
        const topicData = summaryMap.get(registro.topicId);
        if (registro.duracaoMinutos > 0) {
          topicData.totalMinutes += registro.duracaoMinutos;
        }
        if (registro.questoesFeitas > 0) {
          topicData.totalQuestions += registro.questoesFeitas;
          topicData.totalCorrect += registro.questoesAcertadas;
        }
      }
      // Opcional: Contar registros sem tópico associado?
    });

    return summaryMap;

  }, [topics, registrosEstudo, disciplinaId]);

  if (loadingTopics) {
    return <p className="text-subtle-text-color dark:text-dark-subtle-text-color p-4">Carregando tópicos...</p>;
  }

  if (topics.length === 0) {
     return <p className="text-subtle-text-color dark:text-dark-subtle-text-color p-4">Nenhum tópico cadastrado para esta disciplina.</p>;
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4">
        Tópicos da Disciplina
      </h2>
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2"> {/* Limita altura e adiciona scroll */}
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