import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, RefreshCw, Settings2, Layers, Target, Clock, X } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';

import { calcularDistribuicao, gerarOrdemSessoes, useCiclos } from '../../../hooks/useCiclos';
import { db } from '../../../firebaseConfig';
import { CATALOGO_EDITAIS } from '../../../pages/AdminPage/EditaisManager';
import StepEdital from './steps/StepEdital';
import StepDisciplinas from './steps/StepDisciplinas';
import StepHorarios from './steps/StepHorarios';
import StepRevisao from './steps/StepRevisao';
import StepConfig from './steps/StepConfig';
import StepPreview from './steps/StepPreview';
import { normalizeRevisaoModoCiclo, REVISAO_MODO_FLEXIVEL } from '../../../utils/cicloReviewMode';
import { getDisciplineColorForSlot } from '../../../utils/disciplineColors';
import {
  calculatePlanningPriority,
  getKnowledgeLevel,
  getImportanceLevel,
  hasCompletePlanningLevels,
  normalizePlanningLevel,
} from '../../../utils/planningPriority';

const CICLO_DRAFT_KEY = 'planejamento_ciclo_wizard_draft_v1';

const STEPS = [
  { id: 0, label: 'Edital', icon: Target, title: 'Selecao de Edital', sub: 'Escolha sua base' },
  { id: 1, label: 'Materias', icon: Layers, title: 'Disciplinas', sub: 'O que estudar' },
  { id: 2, label: 'Horarios', icon: Clock, title: 'Sua Rotina', sub: 'Quando estudar' },
  { id: 3, label: 'Metodologia', icon: RefreshCw, title: 'Revisao', sub: 'Como revisar' },
  { id: 4, label: 'Ajustes', icon: Settings2, title: 'Preferencias', sub: 'Personalizacao' },
  { id: 5, label: 'Previa', icon: CheckCircle2, title: 'Resultado', sub: 'Seu plano pronto' },
];

const lerCicloDraft = () => {
  try {
    const raw = localStorage.getItem(CICLO_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(CICLO_DRAFT_KEY);
    return null;
  }
};

const limparCicloDraft = () => {
  localStorage.removeItem(CICLO_DRAFT_KEY);
};

const serializarSelecaoDisciplinas = (selecao = {}) =>
  Object.fromEntries(
    Object.entries(selecao).map(([id, valor]) => [
      id,
      {
        ...valor,
        assuntosMarcados: Array.from(valor?.assuntosMarcados || []),
      },
    ])
  );

const desserializarSelecaoDisciplinas = (selecao = {}) =>
  Object.fromEntries(
    Object.entries(selecao || {}).map(([id, valor]) => [
      id,
      {
        ...valor,
        conhecimentoNivel: normalizePlanningLevel(valor?.conhecimentoNivel) || getKnowledgeLevel(valor),
        importanciaNivel: normalizePlanningLevel(valor?.importanciaNivel) || getImportanceLevel(valor),
        assuntosMarcados: new Set(Array.isArray(valor?.assuntosMarcados) ? valor.assuntosMarcados : []),
      },
    ])
  );

const clampStep = (step) => Math.min(Math.max(Number(step) || 1, 1), STEPS.length);
const clampWizardStep = (step, isEditMode = false) => {
  const normalizedStep = clampStep(step);
  return isEditMode ? Math.max(2, normalizedStep) : normalizedStep;
};

const scrollToTopInstant = (element = null) => {
  if (element) element.scrollTop = 0;
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  } catch {
    window.scrollTo(0, 0);
  }
};

const normalizarDisciplinaTodosDiasIds = (valor) => {
  const lista = Array.isArray(valor) ? valor : (valor ? [valor] : []);
  return [...new Set(lista.filter(Boolean).map(String))];
};

const disciplinaEstaTodosDias = (ids, disciplinaId) => (
  normalizarDisciplinaTodosDiasIds(ids).includes(String(disciplinaId))
);

const buildDisciplinaSnapshotCompleto = ({
  disciplinas = [],
  extraDisciplinas = [],
  selecaoDisciplinas = {},
  horasTotais = 0,
  duracaoMinimaSessaoMinutos = 60,
  duracaoMaximaSessaoMinutos = 60,
  disciplinaTodosDiasIds = [],
  diasEstudo = {},
}) => {
  const idsTodosDias = normalizarDisciplinaTodosDiasIds(disciplinaTodosDiasIds);
  const todasDisciplinas = [...disciplinas, ...extraDisciplinas];
  const disciplinasSelecionadas = todasDisciplinas
    .map((disciplina) => {
      const selecao = selecaoDisciplinas[disciplina.id] || {};
      const ativa = Boolean(selecao.checked || selecao.parcial);
      if (!ativa) return null;

      const conhecimentoNivel = normalizePlanningLevel(selecao.conhecimentoNivel)
        || getKnowledgeLevel(disciplina);
      const importanciaNivel = normalizePlanningLevel(selecao.importanciaNivel)
        || getImportanceLevel(disciplina);
      const assuntosOriginais = Array.isArray(disciplina.assuntos) ? disciplina.assuntos : [];
      const assuntosMarcados = selecao.checked
        ? assuntosOriginais
        : assuntosOriginais.filter((_, index) => selecao.assuntosMarcados?.has?.(index));

      return {
        ...disciplina,
        conhecimentoNivel,
        importanciaNivel,
        assuntos: assuntosMarcados,
        estudarTodosDias: disciplinaEstaTodosDias(idsTodosDias, disciplina.id),
      };
    })
    .filter(Boolean);

  const distribuicaoAtiva = disciplinasSelecionadas.length > 0
    ? calcularDistribuicao(
        disciplinasSelecionadas.map((disciplina, index) => ({
          ...disciplina,
          id: disciplina.id || `snapshot-${index}`,
        })),
        Math.round(horasTotais * 60),
        duracaoMaximaSessaoMinutos,
        { diasEstudo, duracaoMinimaSessaoMinutos, duracaoMaximaSessaoMinutos }
      )
    : [];
  const mapaDistribuicaoAtiva = new Map(
    distribuicaoAtiva.map((disciplina) => [disciplina.id, disciplina])
  );

  return todasDisciplinas.map((disciplina, index) => {
    const selecao = selecaoDisciplinas[disciplina.id] || {};
    const ativa = Boolean(selecao.checked || selecao.parcial);
    const conhecimentoNivel = normalizePlanningLevel(selecao.conhecimentoNivel)
      || getKnowledgeLevel(disciplina);
    const importanciaNivel = normalizePlanningLevel(selecao.importanciaNivel)
      || getImportanceLevel(disciplina);
    const assuntosOriginais = Array.isArray(disciplina.assuntos) ? disciplina.assuntos : [];
    const assuntosMarcados = selecao.checked
      ? assuntosOriginais
      : assuntosOriginais.filter((_, assuntoIndex) => selecao.assuntosMarcados?.has?.(assuntoIndex));
    const disciplinaAtiva = mapaDistribuicaoAtiva.get(disciplina.id);

    return {
      id: disciplina.id,
      nome: disciplina.nome,
      assuntos: ativa ? assuntosMarcados : assuntosOriginais,
      conhecimentoNivel,
      importanciaNivel,
      peso: calculatePlanningPriority({ ...disciplina, conhecimentoNivel, importanciaNivel }),
      cor: disciplina.cor || null,
      tempoAlocadoSemanalMinutos: ativa ? Number(disciplinaAtiva?.tempoAlocadoMinutos || 0) : 0,
      inCiclo: ativa,
      estudarTodosDias: ativa && disciplinaEstaTodosDias(idsTodosDias, disciplina.id),
      index,
    };
  });
};

function CicloCreateWizard({
  onClose,
  user,
  onCicloAtivado,
  onBackToSelector,
  onOpenFeedback,
  mode = 'create',
  cicloId = null,
  initialState = null,
  initialStep = 1,
  preselectedEdital = null,
  upgradeMode = false,
  embedded = false,
}) {
  const isEditMode = mode === 'edit';
  const [passo, setPasso] = useState(() => clampWizardStep(initialStep, isEditMode));
  const [nomeCiclo, setNomeCiclo] = useState('');
  const [idModeloSelecionado, setIdModeloSelecionado] = useState(null);
  const [dadosModeloSelecionado, setDadosModeloSelecionado] = useState(null);
  const [gradeDisponibilidade, setGradeDisponibilidade] = useState({});
  const [duracaoMinimaSessaoMinutos, setDuracaoMinimaSessaoMinutos] = useState(60);
  const [duracaoMaximaSessaoMinutos, setDuracaoMaximaSessaoMinutos] = useState(60);
  const [disciplinas, setDisciplinas] = useState([]);
  const [extraDisciplinas, setExtraDisciplinas] = useState([]);
  const [selecaoDisciplinas, setSelecaoDisciplinas] = useState({});
  const [modelos, setModelos] = useState([]);
  const [carregandoModelos, setCarregandoModelos] = useState(false);
  const [mostrarModalModelo, setMostrarModalModelo] = useState(false);
  const [revisaoModo, setRevisaoModo] = useState(REVISAO_MODO_FLEXIVEL);
  const [coresDisciplinasAtivas, setCoresDisciplinasAtivas] = useState(true);
  const [disciplinaTodosDiasIds, setDisciplinaTodosDiasIds] = useState([]);
  const [mostrandoRascunho, setMostrandoRascunho] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const conteudoRef = useRef(null);
  const preselectedEditalAppliedRef = useRef(null);

  const { criarCiclo, editarCiclo, loading } = useCiclos(user);
  const visibleSteps = isEditMode ? STEPS.slice(1) : STEPS;
  const firstVisibleStep = isEditMode ? 2 : 1;
  const lastVisibleStep = isEditMode ? STEPS.length : STEPS.length;
  const visibleStepIndex = isEditMode ? Math.max(0, passo - 2) : Math.max(0, passo - 1);

  const possuiDadosParaRascunho = Boolean(
    idModeloSelecionado ||
    nomeCiclo.trim() ||
    disciplinas.length > 0 ||
    extraDisciplinas.length > 0 ||
    Object.keys(gradeDisponibilidade).length > 0 ||
    passo > 1
  );

  const aplicarEstadoWizard = (state, stepOverride = null) => {
    if (!state) return;

    setPasso(clampWizardStep(stepOverride ?? state.passo ?? (isEditMode ? 2 : 1), isEditMode));
    setNomeCiclo(state.nomeCiclo || '');
    setIdModeloSelecionado(state.idModeloSelecionado || null);
    setDadosModeloSelecionado(state.dadosModeloSelecionado || null);
    setGradeDisponibilidade(state.gradeDisponibilidade || {});
    const singleDuration = Number(
      state.tempoSessaoMinutos
      || state.duracaoMaximaSessaoMinutos
      || state.duracaoMinimaSessaoMinutos
      || 60
    );
    setDuracaoMinimaSessaoMinutos(singleDuration);
    setDuracaoMaximaSessaoMinutos(singleDuration);
    setDisciplinas(Array.isArray(state.disciplinas) ? state.disciplinas : []);
    setExtraDisciplinas(Array.isArray(state.extraDisciplinas) ? state.extraDisciplinas : []);
    setSelecaoDisciplinas(
      state.selecaoDisciplinasSerializada
        ? desserializarSelecaoDisciplinas(state.selecaoDisciplinasSerializada)
        : (state.selecaoDisciplinas || {})
    );
    setRevisaoModo(normalizeRevisaoModoCiclo(state.revisaoModo));
    setCoresDisciplinasAtivas(state.coresDisciplinasAtivas !== false);
    setDisciplinaTodosDiasIds(
      normalizarDisciplinaTodosDiasIds(state.disciplinaTodosDiasIds || state.disciplinaTodosDiasId)
    );
  };

  const salvarRascunhoAtual = () => {
    if (isEditMode) return;
    if (!possuiDadosParaRascunho) return;
    const payload = {
      passo,
      nomeCiclo,
      idModeloSelecionado,
      dadosModeloSelecionado,
      gradeDisponibilidade,
      duracaoMinimaSessaoMinutos,
      duracaoMaximaSessaoMinutos,
      disciplinas,
      extraDisciplinas,
      selecaoDisciplinas: serializarSelecaoDisciplinas(selecaoDisciplinas),
      revisaoModo: normalizeRevisaoModoCiclo(revisaoModo),
      coresDisciplinasAtivas: coresDisciplinasAtivas !== false,
      disciplinaTodosDiasIds,
    };
    try {
      localStorage.setItem(CICLO_DRAFT_KEY, JSON.stringify(payload));
    } catch {}
  };

  const descartarEFechar = () => {
    setConfirmandoSaida(false);
    if (!isEditMode) limparCicloDraft();
    onClose?.();
  };

  useEffect(() => {
    const buscarModelos = async () => {
      setCarregandoModelos(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'editais_templates'));
        const firestoreTemplates = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const firestoreMap = new Map(firestoreTemplates.map((t) => [t.id, t]));

        const localSeedsProcessed = CATALOGO_EDITAIS.filter((seed) => !firestoreMap.get(seed.id)?.deleted).map((seed) => {
          const fromDb = firestoreMap.get(seed.id);
          if (fromDb) {
            firestoreMap.delete(seed.id);
            return {
              ...seed,
              ...fromDb,
              logo: fromDb.logoUrl || fromDb.logo || seed.logo,
              isLocal: true,
              isInstalled: true,
            };
          }
          return { ...seed, isLocal: true, isInstalled: false };
        });

        const customTemplates = Array.from(firestoreMap.values())
          .filter((t) => !t.deleted)
          .map((t) => ({
            ...t,
            logo: t.logoUrl || t.logo,
            type: t.tipo || 'outros',
            isCustom: true,
            isInstalled: true,
            ativo: t.ativo !== undefined ? t.ativo : true,
          }));

        setModelos([...localSeedsProcessed, ...customTemplates]);
      } catch (error) {
        console.error('Erro ao carregar templates:', error);
      } finally {
        setCarregandoModelos(false);
      }
    };

    buscarModelos();
  }, []);

  useEffect(() => {
    document.body.classList.add('wizard-shell-open');
    if (!isEditMode && !preselectedEdital) {
      const draft = lerCicloDraft();
      if (draft) setMostrandoRascunho(true);
    }
    return () => {
      document.body.classList.remove('wizard-shell-open');
    };
  }, [isEditMode, preselectedEdital]);

  useEffect(() => {
    scrollToTopInstant(conteudoRef.current);
  }, [passo]);

  useEffect(() => {
    if (!isEditMode || !initialState) return;
    aplicarEstadoWizard(initialState, initialStep);
    setMostrandoRascunho(false);
  }, [isEditMode, initialState, initialStep]);

  useEffect(() => {
    if (isEditMode) return;
    if (!possuiDadosParaRascunho) return;
    const timer = setTimeout(() => {
      salvarRascunhoAtual();
    }, 400);
    return () => clearTimeout(timer);
  }, [
    possuiDadosParaRascunho,
    passo,
    nomeCiclo,
    idModeloSelecionado,
    dadosModeloSelecionado,
    gradeDisponibilidade,
    duracaoMinimaSessaoMinutos,
    duracaoMaximaSessaoMinutos,
    disciplinas,
    extraDisciplinas,
    selecaoDisciplinas,
    revisaoModo,
    coresDisciplinasAtivas,
    disciplinaTodosDiasIds,
    isEditMode,
  ]);

  useEffect(() => {
    if (!idModeloSelecionado || idModeloSelecionado === 'manual' || modelos.length === 0) return;
    const modeloEncontrado = modelos.find((modelo) => modelo.id === idModeloSelecionado);
    if (!modeloEncontrado) return;

    setDadosModeloSelecionado((current) => {
      if (current?.id === modeloEncontrado.id && current?.titulo) return current;
      return modeloEncontrado;
    });
  }, [idModeloSelecionado, modelos]);

  const horasTotais = useMemo(() => {
    return Object.values(gradeDisponibilidade).reduce((acc, valor) => acc + (parseFloat(valor) || 0), 0);
  }, [gradeDisponibilidade]);

  const disciplinasComCalculo = useMemo(() => {
    const disciplinasAtivas = [...disciplinas, ...extraDisciplinas]
      .map((d) => {
        const selecao = selecaoDisciplinas[d.id] || {};
        const ativo = Boolean(selecao.checked || selecao.parcial);
        if (!ativo) return null;
        const conhecimentoNivel = normalizePlanningLevel(selecao.conhecimentoNivel);
        const importanciaNivel = normalizePlanningLevel(selecao.importanciaNivel);
        const assuntos = Array.isArray(d.assuntos) ? d.assuntos : [];
        const assuntosMarcados = selecao.checked
          ? assuntos
          : assuntos.filter((_, index) => selecao.assuntosMarcados?.has?.(index));
        return {
          ...d,
          conhecimentoNivel,
          importanciaNivel,
          assuntos: assuntos.length > 0 ? assuntosMarcados : assuntos,
          estudarTodosDias: disciplinaEstaTodosDias(disciplinaTodosDiasIds, d.id),
        };
      })
      .filter(Boolean);

    const mediaAssuntos = Math.max(1, disciplinasAtivas.reduce((acc, d) => acc + Math.max(1, d.assuntos?.length || 1), 0) / Math.max(1, disciplinasAtivas.length));
    const pesoTotal = disciplinasAtivas.reduce((acc, d) => acc + calculatePlanningPriority(d, mediaAssuntos, { allowLegacy: false }), 0);
    return disciplinasAtivas.map((d) => {
      const peso = calculatePlanningPriority(d, mediaAssuntos, { allowLegacy: false });
      const razao = pesoTotal > 0 ? peso / pesoTotal : 0;
      const horas = razao * horasTotais;
      return { ...d, peso, horasCalculadas: horas };
    });
  }, [disciplinas, extraDisciplinas, selecaoDisciplinas, horasTotais, disciplinaTodosDiasIds]);

  useEffect(() => {
    if (disciplinaTodosDiasIds.length === 0) return;
    const idsAtivos = new Set(disciplinasComCalculo.map((disciplina) => String(disciplina.id)));
    const idsFiltrados = disciplinaTodosDiasIds.filter((id) => idsAtivos.has(String(id)));
    if (idsFiltrados.length !== disciplinaTodosDiasIds.length) {
      setDisciplinaTodosDiasIds(idsFiltrados);
    }
  }, [disciplinaTodosDiasIds, disciplinasComCalculo]);

  const selecaoValidaDisciplinas = useMemo(
    () =>
      disciplinasComCalculo.length > 0 &&
      disciplinasComCalculo.every(hasCompletePlanningLevels),
    [disciplinasComCalculo]
  );

  const disciplinasPreview = useMemo(() => {
    if (disciplinasComCalculo.length === 0 || horasTotais <= 0) return [];
    const disciplinasComDistribuicao = calcularDistribuicao(
      disciplinasComCalculo.map((disciplina, index) => ({
        ...disciplina,
        id: disciplina.id || `preview-${index}`,
      })),
      Math.round(horasTotais * 60),
      duracaoMaximaSessaoMinutos,
      { diasEstudo: gradeDisponibilidade, duracaoMinimaSessaoMinutos, duracaoMaximaSessaoMinutos }
    );

    return disciplinasComDistribuicao.map((disciplina) => {
      const color = getDisciplineColorForSlot({
        disciplinaId: disciplina.id,
        disciplinaNome: disciplina.nome,
        disciplina: disciplina.nome,
        cor: disciplina.cor,
      });

      return {
        ...disciplina,
        cor: color?.hex || disciplina.cor || null,
      };
    });
  }, [disciplinasComCalculo, horasTotais, duracaoMinimaSessaoMinutos, duracaoMaximaSessaoMinutos, gradeDisponibilidade]);

  const handleDisciplinaColorChange = (disciplinaId, cor) => {
    const updateList = (list) => list.map((disciplina) => (
      disciplina.id === disciplinaId ? { ...disciplina, cor } : disciplina
    ));
    setDisciplinas(updateList);
    setExtraDisciplinas(updateList);
  };

  const cicloPreview = useMemo(() => {
    if (disciplinasPreview.length === 0) return null;
    const ordemSessoes = gerarOrdemSessoes(disciplinasPreview);
    return {
      nome: nomeCiclo || dadosModeloSelecionado?.titulo || 'Preview do Ciclo',
      duracaoMinimaSessaoMinutos,
      duracaoMaximaSessaoMinutos,
      coresDisciplinasAtivas: coresDisciplinasAtivas !== false,
      disciplinasSnapshot: disciplinasPreview.map((disciplina) => ({
        id: disciplina.id,
        nome: disciplina.nome,
        cor: disciplina.cor || null,
      })),
      totalSessoesCiclo: ordemSessoes.length,
      ordemSessoes,
      sessoesConcluidas: [],
    };
  }, [disciplinasPreview, duracaoMinimaSessaoMinutos, duracaoMaximaSessaoMinutos, coresDisciplinasAtivas, nomeCiclo, dadosModeloSelecionado]);

  const modoManualConfirmado = idModeloSelecionado === 'manual';
  const editalCatalogoConfirmado = Boolean(
    idModeloSelecionado &&
    idModeloSelecionado !== 'manual' &&
    dadosModeloSelecionado?.id === idModeloSelecionado
  );
  const editalConfirmado = modoManualConfirmado || editalCatalogoConfirmado;

  const selecionarModelo = (modelo) => {
    setIdModeloSelecionado(modelo.id);
    setDadosModeloSelecionado(modelo);
    setMostrarModalModelo(false);
    setNomeCiclo(modelo.titulo || '');
    const disciplinasFormatadas = (modelo.disciplinas || []).map((d, index) => {
      const assuntosLimpos = (d.assuntos || [])
        .map((item) => (typeof item === 'string' ? item : item?.nome || ''))
        .filter((i) => i !== '');
      return {
        id: `imported-${Date.now()}-${index}`,
        nome: d.nome,
        conhecimentoNivel: getKnowledgeLevel(d),
        importanciaNivel: getImportanceLevel(d),
        assuntos: assuntosLimpos,
        cor: d.cor || d.color || null,
        index,
      };
    });
    setDisciplinas(disciplinasFormatadas);
    setExtraDisciplinas([]);
    setDisciplinaTodosDiasIds([]);
    setSelecaoDisciplinas(
      Object.fromEntries(
        disciplinasFormatadas.map((disc) => [
          disc.id,
          {
            checked: false,
            parcial: false,
            assuntosMarcados: new Set(),
            conhecimentoNivel: 0,
            importanciaNivel: 0,
          },
        ])
      )
    );
  };

  useEffect(() => {
    if (isEditMode || !preselectedEdital?.id) return;
    if (preselectedEditalAppliedRef.current === String(preselectedEdital.id)) return;
    preselectedEditalAppliedRef.current = String(preselectedEdital.id);
    selecionarModelo(preselectedEdital);
    setMostrandoRascunho(false);
  }, [isEditMode, preselectedEdital]);

  const selecionarManual = () => {
    setIdModeloSelecionado('manual');
    setDadosModeloSelecionado(null);
    setNomeCiclo('');
    setDisciplinas([]);
    setExtraDisciplinas([]);
    setSelecaoDisciplinas({});
    setDisciplinaTodosDiasIds([]);
  };

  const salvarWizard = async () => {
    if (horasTotais <= 0) {
      setValidationMessage('Defina uma carga horaria maior que zero antes de finalizar.');
      return;
    }
    if (disciplinasComCalculo.length === 0) {
      setValidationMessage('Selecione pelo menos uma disciplina para montar o ciclo.');
      return;
    }
    if (!selecaoValidaDisciplinas) {
      setValidationMessage('Defina conhecimento e importancia de 1 a 5 em todas as disciplinas selecionadas.');
      return;
    }
    if (!nomeCiclo.trim()) {
      setValidationMessage('Informe o nome do ciclo para salvar o planejamento.');
      return;
    }

    setValidationMessage('');

    const isManual = idModeloSelecionado === 'manual' || !idModeloSelecionado;
    const logoFinal = isManual ? null : dadosModeloSelecionado?.logoUrl || dadosModeloSelecionado?.logo || null;

    const dadosCiclo = {
      nome: nomeCiclo.trim(),
      cargaHorariaTotal: Number(horasTotais),
      diasEstudo: gradeDisponibilidade,
      templateId: isManual ? 'manual' : idModeloSelecionado,
      editalId: isManual ? 'manual' : idModeloSelecionado,
      tipo: isManual ? 'manual' : 'padrao',
      criadoEm: new Date(),
      logoUrl: logoFinal,
      duracaoMinimaSessaoMinutos,
      duracaoMaximaSessaoMinutos,
      tempoSessaoMinutos: duracaoMaximaSessaoMinutos,
      modoExibirAssuntos: false,
      modoExibirTempo: 'total',
      coresDisciplinasAtivas: coresDisciplinasAtivas !== false,
      revisaoModo: normalizeRevisaoModoCiclo(revisaoModo),
      disciplinas: disciplinasComCalculo.map((d, position) => {
        const previewDisciplina = disciplinasPreview.find((item) => item.id === d.id || item.nome === d.nome);
        return {
          id: d.id,
          nome: d.nome,
          assuntos: d.assuntos,
          conhecimentoNivel: d.conhecimentoNivel,
          importanciaNivel: d.importanciaNivel,
          peso: calculatePlanningPriority(d),
          tempoAlocadoSemanalMinutos: Math.round(d.horasCalculadas * 60),
          estudarTodosDias: disciplinaEstaTodosDias(disciplinaTodosDiasIds, d.id),
          index: position,
          ...(previewDisciplina?.cor ? { cor: previewDisciplina.cor } : {}),
        };
      }),
      disciplinasEstadoCompleto: buildDisciplinaSnapshotCompleto({
        disciplinas,
        extraDisciplinas,
        selecaoDisciplinas,
        horasTotais,
        duracaoMinimaSessaoMinutos,
        duracaoMaximaSessaoMinutos,
        disciplinaTodosDiasIds,
        diasEstudo: gradeDisponibilidade,
      }).map((disciplina) => {
        const previewDisciplina = disciplinasPreview.find((item) => item.id === disciplina.id || item.nome === disciplina.nome);
        return previewDisciplina?.cor
          ? { ...disciplina, cor: previewDisciplina.cor }
          : disciplina;
      }),
    };

    if (isEditMode) {
      const editou = await editarCiclo(cicloId, dadosCiclo, { guideUpgrade: upgradeMode, forceRegenerate: true });
      if (editou) {
        onClose?.();
        if (onCicloAtivado) onCicloAtivado(cicloId);
      }
      return;
    }

    const novoId = await criarCiclo(dadosCiclo);
    if (novoId) {
      limparCicloDraft();
      window.dispatchEvent(new CustomEvent('Planning:Created', {
        detail: { type: 'ciclo', name: nomeCiclo.trim() },
      }));
      onClose?.();
      if (onCicloAtivado) onCicloAtivado(novoId);
    }
  };

  const podeAvancar = useMemo(() => {
    if (passo === 1) return editalConfirmado && !mostrarModalModelo;
    if (passo === 2) return selecaoValidaDisciplinas;
    if (passo === 3) return horasTotais > 0
      && duracaoMinimaSessaoMinutos >= 5
      && duracaoMaximaSessaoMinutos >= duracaoMinimaSessaoMinutos;
    if (passo === 4) return Boolean(revisaoModo);
    if (passo === 5) return nomeCiclo.trim().length > 0;
    if (passo === 6) return disciplinasPreview.length > 0 && Boolean(cicloPreview);
    return false;
  }, [passo, editalConfirmado, mostrarModalModelo, selecaoValidaDisciplinas, horasTotais, revisaoModo, nomeCiclo, duracaoMinimaSessaoMinutos, duracaoMaximaSessaoMinutos, disciplinasPreview, cicloPreview]);

  const handleVoltar = () => {
    if (isEditMode) {
      if (passo === firstVisibleStep) {
        onClose?.();
        return;
      }
      setPasso((s) => s - 1);
      return;
    }

    if (passo === 1) {
      if (mostrarModalModelo) {
        setMostrarModalModelo(false);
        return;
      }
      if (idModeloSelecionado) {
        setIdModeloSelecionado(null);
        setDadosModeloSelecionado(null);
        return;
      }
      return;
    }
    setPasso((s) => s - 1);
  };

  const onAbrirSuporte = () => onOpenFeedback?.({ initialView: 'new', initialType: 'edital' });

  const restaurarRascunho = () => {
    const draft = lerCicloDraft();
    if (!draft) {
      setMostrandoRascunho(false);
      return;
    }
    aplicarEstadoWizard(
      {
        ...draft,
        selecaoDisciplinasSerializada: draft.selecaoDisciplinas || {},
      },
      draft.passo
    );
    setMostrandoRascunho(false);
  };

  const renderStep = () => {
    if (passo === 1) {
      return (
        <StepEdital
          idModeloSelecionado={idModeloSelecionado}
          selecionarManual={selecionarManual}
          selecionarModelo={selecionarModelo}
          modelos={modelos}
          carregandoModelos={carregandoModelos}
          onAbrirSuporte={onAbrirSuporte}
        />
      );
    }

    if (passo === 2) {
      return (
        <StepDisciplinas
          disciplinas={disciplinas}
          setDisciplinas={setDisciplinas}
          extraDisciplinas={extraDisciplinas}
          setExtraDisciplinas={setExtraDisciplinas}
          selecaoDisciplinas={selecaoDisciplinas}
          setSelecaoDisciplinas={setSelecaoDisciplinas}
          editalSelecionado={dadosModeloSelecionado}
          modoManual={idModeloSelecionado === 'manual' || !idModeloSelecionado}
        />
      );
    }

    if (passo === 3) {
      return (
        <StepHorarios
          horarios={gradeDisponibilidade}
          setHorarios={setGradeDisponibilidade}
          editalSelecionado={dadosModeloSelecionado}
          duracaoMinimaSessaoMinutos={duracaoMinimaSessaoMinutos}
          setDuracaoMinimaSessaoMinutos={setDuracaoMinimaSessaoMinutos}
          duracaoMaximaSessaoMinutos={duracaoMaximaSessaoMinutos}
          setDuracaoMaximaSessaoMinutos={setDuracaoMaximaSessaoMinutos}
        />
      );
    }

    if (passo === 4) {
      return <StepRevisao revisaoModo={revisaoModo} setRevisaoModo={setRevisaoModo} />;
    }

    if (passo === 5) {
      return (
        <StepConfig
          nomeCiclo={nomeCiclo}
          setNomeCiclo={setNomeCiclo}
          coresDisciplinasAtivas={coresDisciplinasAtivas}
          setCoresDisciplinasAtivas={setCoresDisciplinasAtivas}
          disciplinasPreview={disciplinasPreview}
          onDisciplinaCorChange={handleDisciplinaColorChange}
          editalSelecionado={dadosModeloSelecionado}
        />
      );
    }

    return (
      <StepPreview
        editalSelecionado={dadosModeloSelecionado}
        nomeCiclo={nomeCiclo}
        horasTotais={horasTotais}
        tempoSessaoMinutos={duracaoMaximaSessaoMinutos}
        modoExibirAssuntos={false}
        modoExibirTempo="total"
        coresDisciplinasAtivas={coresDisciplinasAtivas}
        disciplinasPreview={disciplinasPreview}
        cicloPreview={cicloPreview}
      />
    );
  };

  const currentStepZoomKey = {
    1: 'ciclo-edital',
    2: 'ciclo-disciplinas',
    3: 'ciclo-horarios',
    4: 'ciclo-revisao',
    5: 'ciclo-config',
    6: 'ciclo-preview',
  }[passo] || 'ciclo-step';
  const wideStepFrame = passo === 2 || passo === 3;

  return (
    <div className={`flex flex-col ${embedded ? 'relative h-full min-h-0 overflow-hidden pb-0' : 'min-h-screen pb-6'}`}>
      <div ref={conteudoRef} className={`wizard-main flex-1 overflow-y-auto pt-2 md:pt-4 ${embedded ? 'pb-28 md:pb-32' : 'pb-32 md:pb-36'}`}>
        <div
          data-wizard-type="ciclo"
          data-wizard-step={currentStepZoomKey}
          data-wizard-embedded={embedded ? 'true' : undefined}
          className={`wizard-step-frame ${(!isEditMode && passo === firstVisibleStep) || passo === 6 ? 'w-full mx-auto' : wideStepFrame ? 'w-full max-w-7xl mx-auto' : 'max-w-5xl mx-auto'}`}
        >
          <AnimatePresence>
            {validationMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mx-3 mb-3 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 shadow-lg shadow-red-900/5 dark:border-red-900/40 dark:bg-card-dark dark:text-red-300 md:mx-0"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                  <span>{validationMessage}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.div
              key={passo}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className={`wizard-navigation-bar inset-x-2 bottom-2 z-[100050] mx-auto max-w-5xl rounded-2xl border border-zinc-200/80 bg-white/92 shadow-2xl shadow-zinc-950/12 backdrop-blur-xl dark:border-zinc-800 dark:bg-card-dark sm:inset-x-3 sm:bottom-4 ${embedded ? 'absolute' : 'fixed'}`}>
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-zinc-100 dark:bg-zinc-800">
          <motion.div
            className="h-full bg-red-600"
            initial={{ width: '0%' }}
            animate={{ width: `${((visibleStepIndex + 1) / visibleSteps.length) * 100}%` }}
            transition={{ duration: 0.4, ease: 'circOut' }}
          />
        </div>

        <div className="max-w-5xl mx-auto px-2.5 py-1.5 sm:px-8 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            {isEditMode || passo > 1 || (passo === 1 && (idModeloSelecionado || mostrarModalModelo)) ? (
              <button
                onClick={handleVoltar}
                className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
              >
                <ArrowLeft size={14} strokeWidth={3} />
                <span className="hidden xs:inline">Voltar</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  if (onBackToSelector) {
                    onBackToSelector();
                    return;
                  }
                  setConfirmandoSaida(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-zinc-400 hover:text-red-500 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
              >
                {onBackToSelector ? <ArrowLeft size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
                <span className="hidden xs:inline">{onBackToSelector ? 'Metodos' : 'Cancelar'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmandoSaida(true)}
              className="flex items-center gap-2 rounded-2xl border border-zinc-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95 dark:border-zinc-800 dark:hover:border-red-900/60 dark:hover:bg-red-950/20 sm:px-4 sm:py-2.5"
              aria-label="Fechar criação"
            >
              <X size={14} strokeWidth={3} />
              <span className="hidden sm:inline">Fechar</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {passo >= 3 && (
              <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-[9px] font-black uppercase tracking-tighter text-zinc-400 leading-none">Carga total</span>
                <span className="text-[11px] font-bold text-zinc-900 dark:text-white leading-tight">{horasTotais}h</span>
              </div>
            )}

            {passo < lastVisibleStep ? (
              <div className="flex flex-col items-end gap-1">
                {passo === 1 && !podeAvancar && (
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                    Escolha um edital ou confirme o plano manual para continuar.
                  </span>
                )}
                <button
                  onClick={() => setPasso((s) => s + 1)}
                  disabled={!podeAvancar}
                  className="group flex items-center gap-2 px-5 py-2.5 sm:px-8 sm:py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-[11px] text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 shadow-xl shadow-zinc-900/20 dark:shadow-white/5 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none hover:bg-red-600 dark:hover:bg-red-600 dark:hover:text-white"
                >
                  Próximo <ArrowRight size={14} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            ) : (
              <button
                onClick={salvarWizard}
                disabled={disciplinasComCalculo.length === 0 || loading || !podeAvancar}
                className="group flex items-center gap-2 px-5 py-2.5 sm:px-8 sm:py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-[11px] text-white bg-red-600 hover:bg-red-700 shadow-xl shadow-red-500/30 transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
              >
                {loading ? (
                  isEditMode ? 'Salvando...' : 'Criando...'
                ) : (
                  <>
                    <CheckCircle2 size={16} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" /> {upgradeMode ? 'Atualizar Ciclo' : isEditMode ? 'Salvar Alteracoes' : 'Finalizar Ciclo'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {!isEditMode && mostrandoRascunho && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="wizard-confirm-card bg-white dark:bg-zinc-900 p-7 rounded-[32px] border-2 border-zinc-100 dark:border-zinc-800 shadow-2xl max-w-md w-full text-center">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <RefreshCw size={28} className="text-red-600" />
              </div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase mb-2">Recuperar Rascunho?</h3>
              <p className="text-sm text-zinc-500 mb-7">
                Encontramos um ciclo salvo no meio da criacao. Voce pode retomar de onde parou ou iniciar um novo.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    limparCicloDraft();
                    setMostrandoRascunho(false);
                  }}
                  className="py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all"
                >
                  Comecar do Zero
                </button>
                <button
                  onClick={restaurarRascunho}
                  className="py-3 rounded-2xl bg-red-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-all"
                >
                  Recuperar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {confirmandoSaida && (
          <div className="fixed inset-0 z-[230] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="wizard-confirm-card bg-white dark:bg-zinc-900 p-7 rounded-[32px] border-2 border-zinc-100 dark:border-zinc-800 shadow-2xl max-w-sm w-full text-center">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <AlertTriangle size={28} className="text-red-600" />
              </div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase mb-2">{isEditMode ? 'Descartar alteracoes?' : 'Descartar ciclo?'}</h3>
              <p className="text-sm text-zinc-500 mb-7">
                {isEditMode ? 'As alteracoes nao salvas serao perdidas.' : 'O rascunho do planejamento sera apagado e nao podera ser recuperado depois.'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfirmandoSaida(false)}
                  className="py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all"
                >
                  Ficar
                </button>
                <button
                  onClick={descartarEFechar}
                  className="py-3 rounded-2xl bg-red-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-all"
                >
                  Descartar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CicloCreateWizard;
