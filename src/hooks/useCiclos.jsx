import { useState } from 'react';
import { db } from '../firebaseConfig'; // 'auth' não é mais necessário aqui
// 'useAuthState' foi REMOVIDO
import { collection, doc, writeBatch, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

// Lógica de cálculo (sem alteração)
const calcularDistribuicao = (disciplinas, cargaHorariaTotalMinutos) => {
  const pesos = { 'Iniciante': 3, 'Medio': 2, 'Avançado': 1 };

  let totalPesos = 0;
  disciplinas.forEach(disciplina => {
    totalPesos += pesos[disciplina.nivel] || 1;
  });

  if (totalPesos === 0) return disciplinas;

  const tempoPorPonto = cargaHorariaTotalMinutos / totalPesos;

  return disciplinas.map(disciplina => ({
    ...disciplina,
    tempoAlocadoMinutos: Math.round(pesos[disciplina.nivel] * tempoPorPonto),
  }));
};

// O hook agora 'recebe' o usuário
export const useCiclos = (user) => {
  // 'user' vem do argumento
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const desativarCiclosAntigos = async (batch, userId) => {
    const ciclosRef = collection(db, 'users', userId, 'ciclos');
    const q = query(ciclosRef, where('ativo', '==', true));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((document) => {
      batch.update(document.ref, { ativo: false });
    });
  };

  const criarCiclo = async (cicloData) => {
    // O 'user' já está disponível no escopo do hook
    if (!user) {
      setError("Usuário não autenticado");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const cargaHorariaTotalMinutos = cicloData.cargaHorariaTotal * 60;
      const disciplinasComTempo = calcularDistribuicao(cicloData.disciplinas, cargaHorariaTotalMinutos);

      const batch = writeBatch(db);

      await desativarCiclosAntigos(batch, user.uid);

      const cicloRef = doc(collection(db, 'users', user.uid, 'ciclos'));
      batch.set(cicloRef, {
        nome: cicloData.nome,
        cargaHorariaSemanalTotal: cicloData.cargaHorariaTotal,
        ativo: true,
        dataCriacao: serverTimestamp(),
      });

      for (const disciplina of disciplinasComTempo) {
        const disciplinaRef = doc(collection(db, 'users', user.uid, 'ciclos', cicloRef.id, 'disciplinas'));

        batch.set(disciplinaRef, {
          nome: disciplina.nome,
          nivelProficiencia: disciplina.nivel,
          tempoAlocadoSemanalMinutos: disciplina.tempoAlocadoMinutos,
        });
      }

      await batch.commit();
      setLoading(false);
      return true;

    } catch (err) {
      console.error("Erro ao criar ciclo:", err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  return { criarCiclo, loading, error };
};