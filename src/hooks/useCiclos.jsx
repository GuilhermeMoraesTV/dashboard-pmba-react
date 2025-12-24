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
  updateDoc,
  getDoc
} from 'firebase/firestore';

/**
 * CALCULA A DISTRIBUIÇÃO DE TEMPO BASEADO NO PESO (PRIORIDADE)
 * Lógica: Proporção direta.
 * Peso maior = Mais tempo de estudo.
 */
const calcularDistribuicao = (disciplinas, cargaHorariaTotalMinutos) => {
  // 1. Soma total dos pesos
  const totalPesos = disciplinas.reduce((acc, d) => acc + (Number(d.peso) || 1), 0);

  // Se não houver peso (evitar divisão por zero), zera o tempo
  if (totalPesos === 0) return disciplinas.map(d => ({ ...d, tempoAlocadoMinutos: 0 }));

  // 2. Valor em minutos de "1 ponto" de peso
  const tempoPorPonto = cargaHorariaTotalMinutos / totalPesos;

  // 3. Distribui
  return disciplinas.map(disciplina => {
    const peso = Number(disciplina.peso) || 1;
    return {
      ...disciplina,
      tempoAlocadoMinutos: Math.round(peso * tempoPorPonto),
    };
  });
};

export const useCiclos = (user) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Desativa ciclos anteriores para manter apenas um ativo (regra de negócio opcional, mas recomendada)
  const desativarCiclosAntigos = async (batch, userId) => {
    const ciclosRef = collection(db, 'users', userId, 'ciclos');
    const q = query(ciclosRef, where('ativo', '==', true));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((document) => {
      batch.update(document.ref, { ativo: false });
    });
  };

  const criarCiclo = async (cicloData) => {
    if (!user) {
      setError("Usuário não autenticado");
      return false;
    }
    setLoading(true);
    setError(null);

    try {
      const cargaHorariaTotal = Number(cicloData.cargaHorariaTotal || 0);
      const cargaHorariaTotalMinutos = cargaHorariaTotal * 60;

      // Calcula tempos antes de salvar
      const disciplinasComTempo = calcularDistribuicao(cicloData.disciplinas, cargaHorariaTotalMinutos);

      const batch = writeBatch(db);

      // 1. Desativa ciclos anteriores
      await desativarCiclosAntigos(batch, user.uid);

      // 2. Cria documento do Ciclo Principal
      const cicloRef = doc(collection(db, 'users', user.uid, 'ciclos'));

      batch.set(cicloRef, {
        nome: cicloData.nome,
        cargaHorariaSemanalTotal: cargaHorariaTotal,
        ativo: true,
        dataCriacao: serverTimestamp(),
        arquivado: false,
        conclusoes: 0,
        templateOrigem: cicloData.templateId || null
      });

      // 3. Cria Subcoleção de Disciplinas
      for (const disciplina of disciplinasComTempo) {
        const disciplinaRef = doc(collection(db, 'users', user.uid, 'ciclos', cicloRef.id, 'disciplinas'));

        batch.set(disciplinaRef, {
          nome: disciplina.nome,
          // Agora usamos 'peso' explicitamente, sem inversão de valores
          peso: Number(disciplina.peso) || 1,
          tempoAlocadoSemanalMinutos: Number(disciplina.tempoAlocadoMinutos || 0),
          // Garante que assuntos seja um array
          assuntos: Array.isArray(disciplina.assuntos) ? disciplina.assuntos : []
        });
      }

      await batch.commit();
      setLoading(false);
      return cicloRef.id;

    } catch (err) {
      console.error("Erro ao criar ciclo:", err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  const ativarCiclo = async (cicloId) => {
    if (!user) { setError("Usuário não autenticado"); return false; }
    setLoading(true); setError(null);
    try {
      const batch = writeBatch(db);
      await desativarCiclosAntigos(batch, user.uid);
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      batch.update(cicloRef, { ativo: true, arquivado: false });
      await batch.commit();
      setLoading(false); return true;
    } catch (err) { console.error("Erro ao ativar ciclo:", err); setError(err.message); setLoading(false); return false; }
  };

  const arquivarCiclo = async (cicloId) => {
    if (!user) { setError("Usuário não autenticado"); return false; }
    setLoading(true); setError(null);
    try {
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      await updateDoc(cicloRef, { arquivado: true, ativo: false });
      setLoading(false); return true;
    } catch (err) { console.error("Erro ao arquivar ciclo:", err); setError(err.message); setLoading(false); return false; }
  };

  // Função de Edição também atualizada para usar PESO
  const editarCiclo = async (cicloId, cicloData) => {
    if (!user) { setError("Usuário não autenticado"); return false; }
    setLoading(true); setError(null);
    try {
      const cargaHorariaTotal = Number(cicloData.cargaHorariaTotal || 0);
      const cargaHorariaTotalMinutos = cargaHorariaTotal * 60;

      const disciplinasComTempo = calcularDistribuicao(cicloData.disciplinas, cargaHorariaTotalMinutos);

      const batch = writeBatch(db);

      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      batch.update(cicloRef, { nome: cicloData.nome, cargaHorariaSemanalTotal: cargaHorariaTotal });

      const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
      const disciplinasSnapshot = await getDocs(disciplinasRef);
      const disciplinasExistentes = disciplinasSnapshot.docs.map(d => d.id);
      const disciplinasEditadasIds = new Set();

      for (const disciplina of disciplinasComTempo) {
        let disciplinaRef;
        const tempoAlocadoNumerico = Number(disciplina.tempoAlocadoMinutos || 0);

        if (disciplina.id && !String(disciplina.id).startsWith('temp-') && !String(disciplina.id).startsWith('manual-')) {
          disciplinaRef = doc(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas', disciplina.id);

          const updateData = {
            nome: disciplina.nome,
            peso: Number(disciplina.peso) || 1, // Atualizado para peso
            tempoAlocadoSemanalMinutos: tempoAlocadoNumerico,
          };
          if (disciplina.assuntos) updateData.assuntos = disciplina.assuntos;

          batch.update(disciplinaRef, updateData);
          disciplinasEditadasIds.add(disciplina.id);
        } else {
          disciplinaRef = doc(collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas'));
          batch.set(disciplinaRef, {
            nome: disciplina.nome,
            peso: Number(disciplina.peso) || 1, // Atualizado para peso
            tempoAlocadoSemanalMinutos: tempoAlocadoNumerico,
            assuntos: disciplina.assuntos || []
          });
          disciplina.id = disciplinaRef.id;
        }
      }

      // Deleta disciplinas que foram removidas da lista
      for (const id of disciplinasExistentes) {
        if (!disciplinasEditadasIds.has(id)) {
          const disciplinaRef = doc(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas', id);
          batch.delete(disciplinaRef);
        }
      }

      await batch.commit();
      setLoading(false); return true;
    } catch (err) { console.error("Erro ao editar ciclo:", err); setError(err.message); setLoading(false); return false; }
  };

  const concluirCicloSemanal = async (cicloId) => {
      if (!user) { setError("Usuário não autenticado"); return false; }
      setLoading(true); setError(null);
      try {
          const batch = writeBatch(db);
          const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
          const cicloDoc = await getDoc(cicloRef);
          const conclusoesAtuais = cicloDoc.data()?.conclusoes || 0;
          const proximaConclusaoId = conclusoesAtuais + 1;
          batch.update(cicloRef, { conclusoes: proximaConclusaoId, ultimaConclusao: serverTimestamp() });

          // Atualiza registros pendentes
          const registrosRef = collection(db, 'users', user.uid, 'registrosEstudo');
          const q = query(registrosRef, where('cicloId', '==', cicloId));
          const registrosSnapshot = await getDocs(q);
          registrosSnapshot.forEach((document) => {
              const data = document.data();
              if (data.conclusaoId == null) {
                  batch.update(document.ref, { conclusaoId: proximaConclusaoId });
              }
          });
          await batch.commit();
          setLoading(false); return true;
      } catch (err) { console.error("Erro ao concluir ciclo:", err); setError(err.message); setLoading(false); return false; }
    };

  const excluirCicloPermanente = async (cicloId) => {
    if (!user) { setError("Usuário não autenticado"); return false; }
    setLoading(true); setError(null);
    try {
      const batch = writeBatch(db);
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
      const disciplinasSnapshot = await getDocs(disciplinasRef);
      disciplinasSnapshot.docs.forEach(doc => { batch.delete(doc.ref); });
      batch.delete(cicloRef);
      await batch.commit();
      setLoading(false); return true;
    } catch (err) { console.error("Erro ao excluir ciclo permanentemente:", err); setError(err.message); setLoading(false); return false; }
  };

  return { criarCiclo, ativarCiclo, arquivarCiclo, editarCiclo, concluirCicloSemanal, excluirCicloPermanente, loading, error };
};