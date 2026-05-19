import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatDateKeyLocal } from '../services/scheduling/review.js';
import { concluirGrupoCicloRevisao, dedupeCicloRevisoesInMemory, reagendarGrupoCicloRevisao } from '../services/cicloRevisoes';

export const useCicloRevisoes = (user, cicloId) => {
  const [revisoes, setRevisoes] = useState([]);
  const [loading, setLoading] = useState(false);

  // Sem cicloId, carrega a central inteira de revisoes pendentes do ciclo.
  useEffect(() => {
    if (!user) {
      setRevisoes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const revisoesRef = collection(db, 'users', user.uid, 'revisoesCiclo');
    const q = cicloId
      ? query(revisoesRef, where('cicloId', '==', cicloId))
      : query(revisoesRef);

    const unsub = onSnapshot(q, (snap) => {
      const revisoesLidas = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((revisao) => revisao.concluida !== true);
      setRevisoes(dedupeCicloRevisoesInMemory(revisoesLidas));
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return () => unsub();
  }, [user, cicloId]);

  // Revisoes de hoje, incluindo atrasadas.
  const revisoesHoje = useMemo(() => {
    const hoje = formatDateKeyLocal(new Date());
    return revisoes.filter((r) => r.dataAgendada <= hoje);
  }, [revisoes]);

  const totalPendentes = revisoesHoje.length;

  // Conclui a revisao exibida e qualquer duplicata legada da mesma chave funcional.
  const concluirRevisao = useCallback(async (revisaoId) => {
    if (!user || !revisaoId) return;
    const revisao = revisoes.find((item) => item.id === revisaoId);
    if (!revisao) return;
    await concluirGrupoCicloRevisao(db, user.uid, revisao);
  }, [revisoes, user]);

  const reagendarRevisao = useCallback(async (revisaoId, novaData = new Date()) => {
    if (!user || !revisaoId) return;
    const revisao = revisoes.find((item) => item.id === revisaoId);
    if (!revisao) return;
    await reagendarGrupoCicloRevisao(db, user.uid, revisao, formatDateKeyLocal(novaData));
  }, [revisoes, user]);

  return { revisoes, revisoesHoje, totalPendentes, loading, concluirRevisao, reagendarRevisao };
};
