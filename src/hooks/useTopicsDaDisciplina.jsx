
import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

// Hook para buscar os tópicos de uma disciplina específica dentro de um ciclo
const useTopicsDaDisciplina = (user, cicloId, disciplinaId) => {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false); // Começa como false, ativa só se tiver IDs

  useEffect(() => {
    // Só busca se tivermos todos os IDs necessários
    if (!user || !cicloId || !disciplinaId) {
      setTopics([]); // Limpa os tópicos se a disciplina mudar para 'vazio'
      setLoading(false);
      return;
    }

    setLoading(true);
    setTopics([]);
    const topicsRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'topicos');
    // Query para buscar tópicos ONDE disciplinaId == ID selecionado
    // Ordena por nome (ou por 'ordem' se você adicionar esse campo)
    const q = query(
        topicsRef,
        where('disciplinaId', '==', disciplinaId),
        orderBy('nome') // Ou orderBy('ordem')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTopics(data);
      setLoading(false);
    }, (error) => {
        console.error("Erro ao buscar tópicos:", error);
        setLoading(false);
    });

    // Limpa o listener ao desmontar ou se os IDs mudarem
    return () => unsubscribe();
  }, [user, cicloId, disciplinaId]); // Re-executa se qualquer ID mudar

  return { topics, loadingTopics: loading };
};

export default useTopicsDaDisciplina;