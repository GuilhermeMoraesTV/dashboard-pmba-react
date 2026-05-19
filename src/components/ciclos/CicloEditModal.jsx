import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';

import { db } from '../../firebaseConfig';
import { CATALOGO_EDITAIS } from '../../pages/AdminPage/EditaisManager';
import { normalizarNivelDominio } from '../../hooks/useCiclos';
import { normalizeRevisaoModoCiclo } from '../../utils/cicloReviewMode';
import CicloCreateWizard from './CicloCreateWizard/CicloCreateWizard';

const normalizarAssuntos = (assuntos = []) =>
  (Array.isArray(assuntos) ? assuntos : [])
    .map((assunto) => (typeof assunto === 'string' ? assunto : assunto?.nome || ''))
    .map((assunto) => assunto.trim())
    .filter(Boolean);

const normalizarDiasEstudo = (ciclo = {}) => {
  if (ciclo?.diasEstudo && typeof ciclo.diasEstudo === 'object') return ciclo.diasEstudo;

  if (ciclo?.gradeHoraria && typeof ciclo.gradeHoraria === 'object') {
    return Object.entries(ciclo.gradeHoraria).reduce((acc, [key, ativo]) => {
      if (!ativo) return acc;
      const [dia] = String(key).split('-');
      acc[dia] = Number(acc[dia] || 0) + 1;
      return acc;
    }, {});
  }

  return {};
};

const montarInitialState = ({ ciclo, disciplinas }) => {
  const templateId = ciclo?.editalId || ciclo?.templateId || ciclo?.templateOrigem || 'manual';
  const isManual = templateId === 'manual';
  const editalCatalogado = CATALOGO_EDITAIS.find((item) => item.id === templateId) || null;

  const disciplinasWizard = disciplinas.map((disciplina, index) => {
    const nivelDominio = normalizarNivelDominio(
      disciplina?.nivelDominio || disciplina?.nivel,
      disciplina?.peso
    );

    return {
      id: disciplina.id,
      nome: disciplina.nome || `Disciplina ${index + 1}`,
      peso: Number(disciplina?.peso) || 3,
      nivelDominio,
      assuntos: normalizarAssuntos(disciplina.assuntos),
      inCiclo: disciplina?.inCiclo !== false,
      index: Number.isFinite(Number(disciplina?.index)) ? Number(disciplina.index) : index,
    };
  });

  const selecaoDisciplinas = Object.fromEntries(
    disciplinasWizard.map((disciplina) => [
      disciplina.id,
      {
        checked: disciplina.inCiclo !== false,
        parcial: false,
        assuntosMarcados: new Set(
          (disciplina.inCiclo !== false ? disciplina.assuntos : []).map((_, assuntoIndex) => assuntoIndex)
        ),
        nivel: disciplina.nivelDominio,
      },
    ])
  );

  return {
    nomeCiclo: ciclo?.nome || '',
    idModeloSelecionado: isManual ? 'manual' : templateId,
    dadosModeloSelecionado: isManual
      ? null
      : {
          id: templateId,
          titulo: editalCatalogado?.titulo || ciclo?.nome || 'Ciclo',
          nome: editalCatalogado?.nome || ciclo?.nome || 'Ciclo',
          cargo: editalCatalogado?.cargo || null,
          logo: editalCatalogado?.logo || ciclo?.logoUrl || null,
          logoUrl: editalCatalogado?.logoUrl || ciclo?.logoUrl || null,
        },
    gradeDisponibilidade: normalizarDiasEstudo(ciclo),
    tempoSessaoMinutos: Number(ciclo?.tempoSessaoMinutos) || 50,
    modoExibirAssuntos: ciclo?.modoExibirAssuntos !== false,
    disciplinas: disciplinasWizard,
    extraDisciplinas: [],
    selecaoDisciplinas,
    revisaoModo: normalizeRevisaoModoCiclo(ciclo?.revisaoModo),
  };
};

function CicloEditModal({ onClose, user, ciclo, onCicloAtivado }) {
  const [loadingData, setLoadingData] = useState(true);
  const [initialState, setInitialState] = useState(null);

  useEffect(() => {
    if (!user?.uid || !ciclo?.id) return;

    let ignore = false;

    const carregarDados = async () => {
      setLoadingData(true);

      try {
        const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', ciclo.id, 'disciplinas');
        const snap = await getDocs(disciplinasRef);

        const disciplinas = snap.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .sort((a, b) => {
            const indexA = Number.isFinite(Number(a?.index)) ? Number(a.index) : Number(a?.orderIndex) || 0;
            const indexB = Number.isFinite(Number(b?.index)) ? Number(b.index) : Number(b?.orderIndex) || 0;
            return indexA - indexB;
          });

        if (!ignore) {
          setInitialState(montarInitialState({ ciclo, disciplinas }));
        }
      } catch (error) {
        console.error('Erro ao carregar ciclo para edicao:', error);
        if (!ignore) setInitialState(null);
      } finally {
        if (!ignore) setLoadingData(false);
      }
    };

    carregarDados();

    return () => {
      ignore = true;
    };
  }, [user, ciclo]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[50vh] animate-fade-in"
    >
      {loadingData || !initialState ? (
        <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <Loader2 size={28} className="text-red-600 animate-spin" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase text-zinc-900 dark:text-white">Preparando edicao</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              Carregando o ciclo completo para abrir no mesmo wizard da criacao.
            </p>
          </div>
        </div>
      ) : (
        <CicloCreateWizard
          mode="edit"
          cicloId={ciclo.id}
          initialState={initialState}
          initialStep={2}
          onClose={onClose}
          onBackToSelector={onClose}
          user={user}
          onCicloAtivado={onCicloAtivado}
        />
      )}
    </motion.div>
  );
}

export default CicloEditModal;
