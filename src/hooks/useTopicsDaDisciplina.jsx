import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

// Hook para buscar os tópicos de uma disciplina específica dentro de um ciclo
// [CORREÇÃO 1 e 2] Padronizado para receber userId (string)
const useTopicsDaDisciplina = (userId, cicloId, disciplinaId) => {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false); // Começa como false, ativa só se tiver IDs

  useEffect(() => {
    // Só busca se tivermos todos os IDs necessários (strings)
    if (!userId || !cicloId || !disciplinaId) {
      setTopics([]); // Limpa os tópicos se a disciplina mudar para 'vazio'
      setLoading(false);
      return;
    }

    //console.log(`Buscando tópicos: userId=${userId}, cicloId=${cicloId}, disciplinaId=${disciplinaId}`); // Log para depuração

    setLoading(true);
    setTopics([]); // Limpa antes de buscar

    try {
        // [CORREÇÃO 1 e 2] Caminho da coleção usa userId (string)
        const topicsRef = collection(db, 'users', userId, 'ciclos', cicloId, 'topicos');

        const q = query(
            topicsRef,
            where('disciplinaId', '==', disciplinaId),
            orderBy('nome') // Ou orderBy('ordem')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        //console.log("Tópicos encontrados:", data); // Log para depuração
        setTopics(data);
        setLoading(false);
        }, (error) => {
            console.error("Erro no listener de tópicos:", error);
            setLoading(false);
        });

        // Limpa o listener ao desmontar ou se os IDs mudarem
        return () => unsubscribe();

    } catch (error) {
        // Captura erros na criação da query/coleção (ex: userId inválido)
        console.error("Erro ao configurar busca de tópicos:", error);
        setLoading(false);
        setTopics([]); // Garante que a lista fique vazia em caso de erro
    }

  // [CORREÇÃO 1 e 2] Re-executa se qualquer ID string mudar
  }, [userId, cicloId, disciplinaId]);

  return { topics, loadingTopics: loading };
};

export default useTopicsDaDisciplina;