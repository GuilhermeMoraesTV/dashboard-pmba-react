import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { createPortal } from 'react-dom';

import { db } from '../../firebaseConfig';
import { CATALOGO_EDITAIS } from '../../pages/AdminPage/EditaisManager';
import { normalizeRevisaoModoCiclo } from '../../utils/cicloReviewMode';
import { getKnowledgeLevel, getImportanceLevel } from '../../utils/planningPriority';
import { getCicloRoundStartKey } from '../../utils/cicloWeeklyStatus';
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

const montarInitialState = ({ ciclo, disciplinas, hasCurrentRoundRecords = false }) => {
  const templateId = ciclo?.editalId || ciclo?.templateId || ciclo?.templateOrigem || 'manual';
  const isManual = templateId === 'manual';
  const editalCatalogado = CATALOGO_EDITAIS.find((item) => item.id === templateId) || null;

  const disciplinasWizard = disciplinas.map((disciplina, index) => {
    return {
      id: disciplina.id,
      nome: disciplina.nome || `Disciplina ${index + 1}`,
      peso: Number(disciplina?.peso) || 3,
      conhecimentoNivel: getKnowledgeLevel(disciplina),
      importanciaNivel: getImportanceLevel(disciplina),
      assuntos: normalizarAssuntos(disciplina.assuntos),
      cor: disciplina?.cor || null,
      inCiclo: disciplina?.inCiclo !== false,
      estudarTodosDias: disciplina?.estudarTodosDias === true,
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
        conhecimentoNivel: disciplina.conhecimentoNivel,
        importanciaNivel: disciplina.importanciaNivel,
      },
    ])
  );

  return {
    nomeCiclo: ciclo?.nome || '',
    dataInicioPlanejamento: getCicloRoundStartKey(ciclo),
    dataInicioBloqueada: hasCurrentRoundRecords,
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
    duracaoMinimaSessaoMinutos: Number(ciclo?.duracaoMinimaSessaoMinutos) || Number(ciclo?.tempoSessaoMinutos) || 30,
    duracaoMaximaSessaoMinutos: Number(ciclo?.duracaoMaximaSessaoMinutos) || Number(ciclo?.tempoSessaoMinutos) || 60,
    disciplinaTodosDiasIds: [
      ...new Set([
        ...(Array.isArray(ciclo?.disciplinaTodosDiasIds) ? ciclo.disciplinaTodosDiasIds : []),
        ...(ciclo?.disciplinaTodosDiasId ? [ciclo.disciplinaTodosDiasId] : []),
        ...disciplinasWizard
          .filter((disciplina) => disciplina.estudarTodosDias)
          .map((disciplina) => disciplina.id),
      ].filter(Boolean).map(String)),
    ],
    modoExibirAssuntos: ciclo?.modoExibirAssuntos !== false,
    disciplinas: disciplinasWizard,
    extraDisciplinas: [],
    selecaoDisciplinas,
    revisaoModo: normalizeRevisaoModoCiclo(ciclo?.revisaoModo),
  };
};

function CicloEditModal({ onClose, user, ciclo, onCicloAtivado, upgradeMode = false }) {
  const [loadingData, setLoadingData] = useState(true);
  const [initialState, setInitialState] = useState(null);
  const [confirmandoFechamento, setConfirmandoFechamento] = useState(false);
  const tituloModal = upgradeMode ? 'Recalcular ciclo' : 'Edicao do ciclo';

  const pedirConfirmacaoFechamento = () => setConfirmandoFechamento(true);

  const confirmarFechamento = () => {
    setConfirmandoFechamento(false);
    onClose();
  };

  const renderConfirmacaoFechamento = () => (
    confirmandoFechamento && (
      <div className="fixed inset-0 z-[21000] flex items-center justify-center bg-zinc-900/60 p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="wizard-confirm-card w-full max-w-sm rounded-[32px] border-2 border-zinc-100 bg-white p-7 text-center shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
            <AlertTriangle size={28} className="text-red-600" />
          </div>
          <h3 className="mb-2 text-xl font-black uppercase text-zinc-900 dark:text-white">Descartar alteracoes?</h3>
          <p className="mb-7 text-sm text-zinc-500">
            As alteracoes nao salvas deste ciclo serao perdidas.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setConfirmandoFechamento(false)}
              className="rounded-2xl bg-zinc-100 py-3 text-xs font-bold uppercase tracking-widest text-zinc-900 transition-all hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white"
            >
              Ficar
            </button>
            <button
              type="button"
              onClick={confirmarFechamento}
              className="rounded-2xl bg-red-600 py-3 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-red-700"
            >
              Descartar
            </button>
          </div>
        </motion.div>
      </div>
    )
  );

  useEffect(() => {
    if (!user?.uid || !ciclo?.id) return;

    let ignore = false;

    const carregarDados = async () => {
      setLoadingData(true);

      try {
        const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', ciclo.id, 'disciplinas');
        const [snap, registrosSnap] = await Promise.all([
          getDocs(disciplinasRef),
          getDocs(query(
            collection(db, 'users', user.uid, 'registrosEstudo'),
            where('cicloId', '==', ciclo.id),
          )),
        ]);

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
          const hasCurrentRoundRecords = registrosSnap.docs.some((registroDoc) => registroDoc.data()?.conclusaoId == null);
          setInitialState(montarInitialState({ ciclo, disciplinas, hasCurrentRoundRecords }));
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

  return createPortal(
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-zinc-950/80 px-2 py-2 backdrop-blur-sm sm:px-4 sm:py-4">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="flex h-[calc(100dvh-1rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-zinc-200 bg-zinc-50 shadow-2xl dark:border-zinc-800 dark:bg-card-dark sm:h-[calc(100dvh-2rem)]"
      >
      <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 pr-14 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6 sm:pr-16">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-600">Planejamento</p>
          <h2 className="truncate text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white sm:text-xl">
            {tituloModal}
          </h2>
        </div>
        <button onClick={pedirConfirmacaoFechamento} className="absolute right-3 top-3 shrink-0 rounded-2xl border border-zinc-200 bg-zinc-50 p-2 text-zinc-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-800 dark:bg-card-dark dark:hover:border-red-900/50 dark:hover:bg-red-950/20 sm:right-4">
          <X size={18} />
        </button>
      </div>
      <div className="min-h-0 flex-1">
      {loadingData || !initialState ? (
        <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <Loader2 size={28} className="text-red-600 animate-spin" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase text-zinc-900 dark:text-white">{upgradeMode ? 'Preparando recalculo' : 'Preparando edicao completa'}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              Carregando o assistente completo para redistribuir disciplinas, dias e sessoes com consistencia.
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
          upgradeMode={upgradeMode}
          embedded
        />
      )}
      </div>
      </motion.div>
      {renderConfirmacaoFechamento()}
    </div>,
    document.body
  );
}

export default CicloEditModal;
