import { useState } from 'react';
import { db } from '../firebaseConfig';
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  query,
  where,
  getDocs,
  deleteDoc,
  updateDoc,
  getDoc,
  collectionGroup
} from 'firebase/firestore';

// Lógica de cálculo (sem alteração)
// Esta função já é robusta e aceita 'nivel' ou 'nivelProficiencia'
const calcularDistribuicao = (disciplinas, cargaHorariaTotalMinutos) => {
  const pesos = { 'Iniciante': 3, 'Medio': 2, 'Avançado': 1 };
  let totalPesos = 0;
  disciplinas.forEach(disciplina => { totalPesos += pesos[disciplina.nivel || disciplina.nivelProficiencia] || 1; });
  if (totalPesos === 0) return disciplinas;
  const tempoPorPonto = cargaHorariaTotalMinutos / totalPesos;
  return disciplinas.map(disciplina => ({
    ...disciplina,
    tempoAlocadoMinutos: Math.round(pesos[disciplina.nivel || disciplina.nivelProficiencia] * tempoPorPonto),
  }));
};

export const useCiclos = (user) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const desativarCiclosAntigos = async (batch, userId) => {
    // ... (código sem alteração)
    const ciclosRef = collection(db, 'users', userId, 'ciclos');
    const q = query(ciclosRef, where('ativo', '==', true));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((document) => {
      batch.update(document.ref, { ativo: false });
    });
  };

  // --- FUNÇÃO criarCiclo (Sem alteração) ---
  // Esta função está correta, pois o CicloCreateWizard envia 'disciplina.nivel'
  const criarCiclo = async (cicloData) => {
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
        arquivado: false
      });

      for (const disciplina of disciplinasComTempo) {
        const disciplinaRef = doc(collection(db, 'users', user.uid, 'ciclos', cicloRef.id, 'disciplinas'));
        batch.set(disciplinaRef, {
          nome: disciplina.nome,
          nivelProficiencia: disciplina.nivel, // <-- Correto para CRIAR
          tempoAlocadoSemanalMinutos: disciplina.tempoAlocadoMinutos,
        });
        if (disciplina.topicos && disciplina.topicos.length > 0) {
          for (const topico of disciplina.topicos) {
            const topicoRef = doc(collection(db, 'users', user.uid, 'ciclos', cicloRef.id, 'topicos'));
            batch.set(topicoRef, {
              disciplinaId: disciplinaRef.id,
              nome: topico.nome,
              estudado: false,
              ultimoDesempenho: 0,
            });
          }
        }
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

  // --- FUNÇÃO ativarCiclo (Sem alteração) ---
  const ativarCiclo = async (cicloId) => {
    // ... (código sem alteração)
     if (!user) {
      setError("Usuário não autenticado");
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      await desativarCiclosAntigos(batch, user.uid);
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      batch.update(cicloRef, {
        ativo: true,
        arquivado: false
      });
      await batch.commit();
      setLoading(false);
      return true;
    } catch (err) {
      console.error("Erro ao ativar ciclo:", err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  // --- FUNÇÃO arquivarCiclo (Sem alteração) ---
  const arquivarCiclo = async (cicloId) => {
    // ... (código sem alteração)
     if (!user) {
      setError("Usuário não autenticado");
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      await updateDoc(cicloRef, {
        arquivado: true,
        ativo: false
      });
      setLoading(false);
      return true;
    } catch (err) {
      console.error("Erro ao arquivar ciclo:", err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  // --- FUNÇÃO excluirCicloPermanente (Sem alteração) ---
  const excluirCicloPermanente = async (cicloId) => {
    // ... (código sem alteração)
  };


  // --- FUNÇÃO editarCiclo (CORRIGIDA) ---
  const editarCiclo = async (cicloId, cicloData) => {
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

      // 1. Atualiza o ciclo (sem alteração)
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      batch.update(cicloRef, {
        nome: cicloData.nome,
        cargaHorariaSemanalTotal: cicloData.cargaHorariaTotal,
      });

      // 2. Busca IDs (sem alteração)
      const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
      const topicosRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'topicos');
      const [disciplinasSnapshot, topicosSnapshot] = await Promise.all([
        getDocs(disciplinasRef),
        getDocs(topicosRef)
      ]);
      const disciplinasExistentes = disciplinasSnapshot.docs.map(d => d.id);
      const topicosExistentes = topicosSnapshot.docs.map(t => t.id);
      const disciplinasEditadasIds = new Set();
      const topicosEditadosIds = new Set();

      // 3. Loop de Disciplinas (sem alteração na lógica de update)
      for (const disciplina of disciplinasComTempo) {
        let disciplinaRef;

        if (disciplina.id) {
          // Disciplina existente: ATUALIZAR
          disciplinaRef = doc(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas', disciplina.id);
          batch.update(disciplinaRef, {
            nome: disciplina.nome,
            nivelProficiencia: disciplina.nivel || disciplina.nivelProficiencia,
            tempoAlocadoSemanalMinutos: disciplina.tempoAlocadoMinutos,
          });
          disciplinasEditadasIds.add(disciplina.id);
        } else {
          // Disciplina nova: ADICIONAR
          disciplinaRef = doc(collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas'));

          // --- A CORREÇÃO ESTÁ AQUI ---
          // O objeto 'disciplina' do EditModal tem 'nivelProficiencia'
          batch.set(disciplinaRef, {
            nome: disciplina.nome,
            nivelProficiencia: disciplina.nivelProficiencia, // <-- CORRIGIDO (antes era disciplina.nivel)
            tempoAlocadoSemanalMinutos: disciplina.tempoAlocadoMinutos,
          });
          // --- FIM DA CORREÇÃO ---

          disciplina.id = disciplinaRef.id;
        }

        // Loop de Tópicos (sem alteração)
        if (disciplina.topicos && disciplina.topicos.length > 0) {
          for (const topico of disciplina.topicos) {
            let topicoRef;
            if (topico.id) {
              topicoRef = doc(db, 'users', user.uid, 'ciclos', cicloId, 'topicos', topico.id);
              batch.update(topicoRef, {
                nome: topico.nome,
                disciplinaId: disciplina.id
              });
              topicosEditadosIds.add(topico.id);
            } else {
              topicoRef = doc(collection(db, 'users', user.uid, 'ciclos', cicloId, 'topicos'));
              batch.set(topicoRef, {
                disciplinaId: disciplina.id,
                nome: topico.nome,
                estudado: false,
                ultimoDesempenho: 0,
              });
            }
          }
        }
      }

      // 4. Loop para EXCLUIR Disciplinas (sem alteração)
      for (const id of disciplinasExistentes) {
        if (!disciplinasEditadasIds.has(id)) {
          const disciplinaRef = doc(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas', id);
          batch.delete(disciplinaRef);
        }
      }

      // 5. Loop para EXCLUIR Tópicos (sem alteração)
      for (const id of topicosExistentes) {
        if (!topicosEditadosIds.has(id)) {
          const topicoRef = doc(db, 'users', user.uid, 'ciclos', cicloId, 'topicos', id);
          batch.delete(topicoRef);
        }
      }

      // 6. Commita (sem alteração)
      await batch.commit();
      setLoading(false);
      return true;

    } catch (err) {
      console.error("Erro ao editar ciclo:", err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  };
  // --- FIM DA FUNÇÃO editarCiclo ---


  return {
    criarCiclo,
    ativarCiclo,
    arquivarCiclo,
    excluirCicloPermanente,
    editarCiclo,
    loading,
    error
  };
};