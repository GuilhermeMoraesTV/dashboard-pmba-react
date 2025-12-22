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
  deleteDoc,
  getDoc
} from 'firebase/firestore';

const RATING_PESO_MAP = {
  0: 6,
  1: 5,
  2: 4,
  3: 3,
  4: 2,
  5: 1,
};

const calcularDistribuicao = (disciplinas, cargaHorariaTotalMinutos) => {
  let totalPesos = 0;

  disciplinas.forEach(disciplina => {
    const nivelNumerico = Number(disciplina.nivel || disciplina.nivelProficiencia || 0);
    const peso = RATING_PESO_MAP[nivelNumerico] || RATING_PESO_MAP[0];
    totalPesos += peso;
  });

  if (totalPesos === 0) return disciplinas.map(d => ({ ...d, tempoAlocadoMinutos: 0 }));

  const tempoPorPonto = cargaHorariaTotalMinutos / totalPesos;

  return disciplinas.map(disciplina => {
    const nivelNumerico = Number(disciplina.nivel || disciplina.nivelProficiencia || 0);
    const peso = RATING_PESO_MAP[nivelNumerico] || RATING_PESO_MAP[0];

    return {
      ...disciplina,
      tempoAlocadoMinutos: Math.round(peso * tempoPorPonto),
    };
  });
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

      const disciplinasComTempo = calcularDistribuicao(cicloData.disciplinas, cargaHorariaTotalMinutos);
      const batch = writeBatch(db);
      await desativarCiclosAntigos(batch, user.uid);
      const cicloRef = doc(collection(db, 'users', user.uid, 'ciclos'));

      batch.set(cicloRef, {
        nome: cicloData.nome,
        cargaHorariaSemanalTotal: cargaHorariaTotal,
        ativo: true,
        dataCriacao: serverTimestamp(),
        arquivado: false,
        conclusoes: 0,
      });

      for (const disciplina of disciplinasComTempo) {
        const disciplinaRef = doc(collection(db, 'users', user.uid, 'ciclos', cicloRef.id, 'disciplinas'));

        const tempoAlocadoNumerico = Number(disciplina.tempoAlocadoMinutos || 0);

        batch.set(disciplinaRef, {
          nome: disciplina.nome,
          nivelProficiencia: disciplina.nivel || disciplina.nivelProficiencia || 0,
          tempoAlocadoSemanalMinutos: tempoAlocadoNumerico,
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
      return cicloRef.id;
    } catch (err) {
      console.error("Erro ao criar ciclo:", err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  const ativarCiclo = async (cicloId) => {
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

  const arquivarCiclo = async (cicloId) => {
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

  const editarCiclo = async (cicloId, cicloData) => {
    if (!user) {
      setError("Usuário não autenticado");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const cargaHorariaTotal = Number(cicloData.cargaHorariaTotal || 0);
      const cargaHorariaTotalMinutos = cargaHorariaTotal * 60;

      const disciplinasComTempo = calcularDistribuicao(cicloData.disciplinas, cargaHorariaTotalMinutos);
      const batch = writeBatch(db);

      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
      batch.update(cicloRef, {
        nome: cicloData.nome,
        cargaHorariaSemanalTotal: cargaHorariaTotal,
      });

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

      for (const disciplina of disciplinasComTempo) {
        let disciplinaRef;
        const tempoAlocadoNumerico = Number(disciplina.tempoAlocadoMinutos || 0);

        // CORREÇÃO 2: Verificamos se o ID é uma string temporária (criada no front)
        // Se for temp, tratamos como criação nova.
        if (disciplina.id && !String(disciplina.id).startsWith('temp-')) {
          disciplinaRef = doc(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas', disciplina.id);
          batch.update(disciplinaRef, {
            nome: disciplina.nome,
            nivelProficiencia: disciplina.nivel || disciplina.nivelProficiencia || 0,
            tempoAlocadoSemanalMinutos: tempoAlocadoNumerico,
          });
          disciplinasEditadasIds.add(disciplina.id);
        } else {
          // Cria nova disciplina se não tiver ID ou for temp
          disciplinaRef = doc(collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas'));
          batch.set(disciplinaRef, {
            nome: disciplina.nome,
            nivelProficiencia: disciplina.nivel || disciplina.nivelProficiencia || 0,
            tempoAlocadoSemanalMinutos: tempoAlocadoNumerico,
          });
          // Atualiza o ID local para usar nas dependencias (topicos)
          disciplina.id = disciplinaRef.id;
        }

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

      for (const id of disciplinasExistentes) {
        if (!disciplinasEditadasIds.has(id)) {
          const disciplinaRef = doc(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas', id);
          batch.delete(disciplinaRef);
        }
      }

      for (const id of topicosExistentes) {
        if (!topicosEditadosIds.has(id)) {
          const topicoRef = doc(db, 'users', user.uid, 'ciclos', cicloId, 'topicos', id);
          batch.delete(topicoRef);
        }
      }

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

  const concluirCicloSemanal = async (cicloId) => {
      if (!user) {
          setError("Usuário não autenticado");
          return false;
      }
      setLoading(true);
      setError(null);

      try {
          const batch = writeBatch(db);
          const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);

          const cicloDoc = await getDoc(cicloRef);
          const conclusoesAtuais = cicloDoc.data()?.conclusoes || 0;
          const proximaConclusaoId = conclusoesAtuais + 1;

          batch.update(cicloRef, {
              conclusoes: proximaConclusaoId,
              ultimaConclusao: serverTimestamp()
          });

          const registrosRef = collection(db, 'users', user.uid, 'registrosEstudo');
          const q = query(registrosRef, where('cicloId', '==', cicloId));
          const registrosSnapshot = await getDocs(q);

          registrosSnapshot.forEach((document) => {
              const data = document.data();

              if (data.conclusaoId == null) {
                  batch.update(document.ref, {
                      conclusaoId: proximaConclusaoId
                  });
              }
          });

          await batch.commit();
          setLoading(false);
          return true;

      } catch (err) {
          console.error("Erro ao concluir ciclo:", err);
          setError(err.message);
          setLoading(false);
          return false;
      }
    };

  const excluirCicloPermanente = async (cicloId) => {
    if (!user) {
      setError("Usuário não autenticado");
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);

      const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
      const disciplinasSnapshot = await getDocs(disciplinasRef);
      disciplinasSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      const topicosRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'topicos');
      const topicosSnapshot = await getDocs(topicosRef);
      topicosSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      batch.delete(cicloRef);

      await batch.commit();
      setLoading(false);
      return true;
    } catch (err) {
      console.error("Erro ao excluir ciclo permanentemente:", err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  };


  return {
    criarCiclo,
    ativarCiclo,
    arquivarCiclo,
    editarCiclo,
    concluirCicloSemanal,
    excluirCicloPermanente,
    loading,
    error
  };
};