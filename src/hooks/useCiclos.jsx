import { useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, doc, writeBatch, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

// Lógica de cálculo (sem alteração)
const calcularDistribuicao = (disciplinas, cargaHorariaTotalMinutos) => {
  const pesos = { 'Iniciante': 3, 'Medio': 2, 'Avançado': 1 };
  let totalPesos = 0;
  disciplinas.forEach(disciplina => { totalPesos += pesos[disciplina.nivel] || 1; });
  if (totalPesos === 0) return disciplinas;
  const tempoPorPonto = cargaHorariaTotalMinutos / totalPesos;
  return disciplinas.map(disciplina => ({
    ...disciplina,
    tempoAlocadoMinutos: Math.round(pesos[disciplina.nivel] * tempoPorPonto),
  }));
};

export const useCiclos = (user) => {
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

  // --- FUNÇÃO criarCiclo MODIFICADA PARA SALVAR TÓPICOS ---
  const criarCiclo = async (cicloData) => {
    if (!user) {
      setError("Usuário não autenticado");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const cargaHorariaTotalMinutos = cicloData.cargaHorariaTotal * 60;
      // As 'disciplinas' agora contêm o array 'topicos' vindo do Wizard
      const disciplinasComTempo = calcularDistribuicao(cicloData.disciplinas, cargaHorariaTotalMinutos);

      const batch = writeBatch(db);
      await desativarCiclosAntigos(batch, user.uid);

      // Cria o documento principal do Ciclo (sem alteração)
      const cicloRef = doc(collection(db, 'users', user.uid, 'ciclos'));
      batch.set(cicloRef, {
        nome: cicloData.nome,
        cargaHorariaSemanalTotal: cicloData.cargaHorariaTotal,
        ativo: true,
        dataCriacao: serverTimestamp(),
      });

      // Loop para salvar Disciplinas (sem alteração no set)
      for (const disciplina of disciplinasComTempo) {
        // Cria ref para a disciplina na subcoleção /ciclos/{id}/disciplinas
        const disciplinaRef = doc(collection(db, 'users', user.uid, 'ciclos', cicloRef.id, 'disciplinas'));

        // Salva os dados da disciplina
        batch.set(disciplinaRef, {
          nome: disciplina.nome,
          nivelProficiencia: disciplina.nivel,
          tempoAlocadoSemanalMinutos: disciplina.tempoAlocadoMinutos,
        });

        // --- NOVO LOOP PARA SALVAR TÓPICOS ---
        // Itera sobre o array 'topicos' dentro do objeto 'disciplina'
        if (disciplina.topicos && disciplina.topicos.length > 0) {
          for (const topico of disciplina.topicos) {
            // Cria ref para o tópico na subcoleção /ciclos/{id}/topicos
            const topicoRef = doc(collection(db, 'users', user.uid, 'ciclos', cicloRef.id, 'topicos'));

            // Salva os dados do tópico, incluindo o ID da disciplina pai
            batch.set(topicoRef, {
              disciplinaId: disciplinaRef.id, // <-- LINK IMPORTANTE
              nome: topico.nome,
              // Adicione outros campos se necessário (ex: ordem, estudado, etc.)
              // ordem: topico.ordem || 0,
              estudado: false,
              ultimoDesempenho: 0,
            });
          }
        }
        // --- FIM DO LOOP DE TÓPICOS ---
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
  // --- FIM DA FUNÇÃO MODIFICADA ---

  return { criarCiclo, loading, error };
};