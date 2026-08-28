/**
 * src/hooks/useCronogramaWizard.js
 *
 * Estado completo e lógica de negócio do wizard de criação de cronograma.
 * Extraído de src/components/cronograma/index.jsx (Fase 4 — MODOQAP).
 *
 * O que este hook faz:
 *   - Mantém todos os dados do wizard (tipo, edital, disciplinas, horários…)
 *   - Persiste e restaura rascunho via localStorage
 *   - Carrega modelos de editais do Firestore
 *   - Gera o cronograma (gerarSchedule + gerarCronogramaIA como otimizador)
 *   - Salva o cronograma final via useCronogramaSystem
 *
 * O que este hook NÃO faz:
 *   - Renderização (zero JSX)
 *   - Navegação entre passos (passo é estado do WizardShell)
 *   - Scroll / foco / animação
 *
 * CORREÇÕES (v3):
 *   [FIX-A] getPrimeiroDiaUtil() agora é extraído como helper _getPrimeiroDiaUtil()
 *           compartilhado por handleGerarPrevia, handleSalvar e defaultConfig(),
 *           garantindo que dataInicio SEMPRE aponte para o primeiro dia com horas > 0
 *           a partir de hoje — nunca para um dia de descanso.
 *
 *   [FIX-B] defaultConfig() passa horarios={} inicialmente; o campo dataInicio é
 *           recalculado em setHorarios() para refletir a configuração real de dias.
 *           Isso garante que ao salvar o rascunho e restaurar, a data ainda seja correta.
 *
 *   [FIX-C] onProgress agora recebe (percent: number, msg: string) diretamente,
 *           sem inferência por msg.includes(). Isso sincroniza com a nova assinatura
 *           de cronogramaIA.js que emite tuplas (percent, msg) em cada etapa real.
 *
 *   [FIX-D] setIsLoading(false) acontece ANTES de setResultadoGeracao(), garantindo
 *           que o AILoadingState seja desmontado corretamente sem piscar o percent=0.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { CATALOGO_EDITAIS } from '../pages/AdminPage/EditaisManager';
import { gerarSchedule } from '../services/scheduling/index.js';
import { gerarCronogramaIA, gerarCronogramaExpressoIA, limparCacheIA } from '../services/cronogramaIA';
import { useCronogramaSystem } from './useCronogramaSystem';
import { buildDisciplineColorMap, getDisciplineColorForSlot, getDisciplineKey, getStoredDisciplineColor } from '../utils/disciplineColors';
import {
  getKnowledgeLevel,
  getImportanceLevel,
  hasCompletePlanningLevels,
  normalizePlanningLevel,
} from '../utils/planningPriority';
import { clampPlanningStartDate, getLocalTodayKey } from '../utils/planningDates';
import confetti from 'canvas-confetti';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const METODOLOGIA_REVISAO = 'revisao_espacada';
const DURACAO_AUTOMATICA_MINUTOS = 40;
const DURACAO_AUTOMATICA_MAXIMA_MINUTOS = 80;

const aplicarDivisaoAutomatica = (config = {}) => ({
  ...config,
  usarDuracaoUnica: false,
  tempoSessaoMinutos: null,
  duracaoMinimaSessaoMinutos: DURACAO_AUTOMATICA_MINUTOS,
  duracaoMaximaSessaoMinutos: DURACAO_AUTOMATICA_MAXIMA_MINUTOS,
});
const DRAFT_KEY           = 'protocolo_zero_cronograma_draft';
const DRAFT_VERSION       = 3;

export const defaultHorarios = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

const normalizarModoExibirTempo = (modo) => (modo === 'oculto' || modo === 'nenhum' ? 'total' : (modo || 'detalhado'));

// ─── [FIX-A] Helper extraído: primeiro dia útil a partir de hoje ──────────────
/**
 * Retorna a data ISO (YYYY-MM-DD) do primeiro dia a partir de hoje
 * que tenha horas configuradas nos horários fornecidos.
 *
 * Se nenhum dia tiver horas > 0 (ainda não configurado), retorna hoje.
 *
 * @param {Object} horarios - { 0: horas, 1: horas, …, 6: horas }
 * @returns {string} data no formato 'YYYY-MM-DD'
 */
export function _getPrimeiroDiaUtil(horarios = {}) {
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const diaSemanaHoje = hoje.getDay(); // 0 = Dom … 6 = Sáb

  for (let offset = 0; offset < 7; offset++) {
    const diaIdx  = (diaSemanaHoje + offset) % 7;
    const horasNoDia = Number(horarios[diaIdx] ?? horarios[String(diaIdx)] ?? 0);
    if (horasNoDia > 0) {
      const d = new Date(hoje);
      d.setDate(d.getDate() + offset);
      return d.toISOString().split('T')[0];
    }
  }

  // Fallback: nenhum dia configurado ainda → usa hoje
  return hoje.toISOString().split('T')[0];
}

export const defaultConfig = () => {
  return {
    nome:                '',
    dataInicio:          getLocalTodayKey(),
    dataInicioManual:    false,
    tempoRevisaoMinutos: 20,
    usarDuracaoUnica: false,
    tempoSessaoMinutos: null,
    duracaoMinimaSessaoMinutos: DURACAO_AUTOMATICA_MINUTOS,
    duracaoMaximaSessaoMinutos: DURACAO_AUTOMATICA_MAXIMA_MINUTOS,
    retaFinal:           false,
    dataProva:           '',
    modoMontagem:        'inteligente',
    gradePersonalizada:  {},
    modoExibirAssuntos:  true,
    modoExibirTempo:     'detalhado',
    coresDisciplinasAtivas: true,
    limitarMaterias:     false,
    limitesPorDia:       {},
    disciplinasTodosDiasIds: [],
  };
};

// ─── DRAFT (localStorage) ─────────────────────────────────────────────────────

const _limparDraft = () => localStorage.removeItem(DRAFT_KEY);

const _salvarDraft = (dados) => {
  try {
    const json = JSON.stringify(
      { version: DRAFT_VERSION, data: dados },
      (key, value) => {
        if (value instanceof Set) return { __type: 'Set', values: [...value] };
        return value;
      }
    );
    localStorage.setItem(DRAFT_KEY, json);
  } catch { /* quota exceeded — ignora silenciosamente */ }
};

const _lerDraft = () => {
  try {
    const json = localStorage.getItem(DRAFT_KEY);
    if (!json) return null;
    const parsed = JSON.parse(json, (key, value) => {
      if (value && value.__type === 'Set') return new Set(value.values);
      return value;
    });
    if (!parsed?.version || parsed.version !== DRAFT_VERSION) {
      _limparDraft();
      return null;
    }
    return parsed.data;
  } catch {
    _limparDraft();
    return null;
  }
};

// ─── UTILITÁRIO: confetti ──────────────────────────────────────────────────────

const _dispararConfetti = (big = false) => {
  try {
    confetti({
      particleCount: big ? 200 : 160,
      spread:        big ? 80  : 70,
      origin:        { y: 0.6 },
      colors: ['#ef4444', '#f97316', '#ffffff', ...(big ? ['#10b981'] : [])],
    });
  } catch {}
};

// ─── UTILITÁRIO: montar dados para salvar ─────────────────────────────────────

const _montarDadosParaSalvar = (config, edital, horarios, result, geradoPorIA_) => ({
  nome:                    config.nome || 'Meu Cronograma',
  editalId:                edital?.id  || 'manual',
  editalNome:              edital?.titulo || 'Manual',
  logoUrl:                 edital?.logoUrl || edital?.logo || null,
  totalHorasSemanais:      Object.values(horarios).reduce((a, h) => a + Number(h || 0), 0),
  horariosDetalhados:      { ...defaultHorarios, ...horarios },
  // [FIX-A] dataInicio já vem corrigido (primeiro dia útil), usa config com prioridade
  dataInicio:              config.dataInicio || result.dataInicio,
  dataFim:                 result.dataFim,
  totalSemanasNecessarias: result.totalSemanasNecessarias,
  tipo:                    'personalizado',
  metodologiasAplicadas:   result.metodologiasAplicadas,
  metodologiaRevisao:      METODOLOGIA_REVISAO,
  tempoRevisaoMinutos:     config.tempoRevisaoMinutos || 20,
  usarDuracaoUnica:        config.usarDuracaoUnica !== false,
  tempoSessaoMinutos:      Number(config.tempoSessaoMinutos || config.duracaoMaximaSessaoMinutos) || DURACAO_AUTOMATICA_MAXIMA_MINUTOS,
  duracaoMinimaSessaoMinutos: Number(config.duracaoMinimaSessaoMinutos) || DURACAO_AUTOMATICA_MINUTOS,
  duracaoMaximaSessaoMinutos: Number(config.duracaoMaximaSessaoMinutos) || DURACAO_AUTOMATICA_MAXIMA_MINUTOS,
  retaFinal:               config.retaFinal           || false,
  dataProva:               config.dataProva           || null,
  modoMontagem:            config.modoMontagem        || 'inteligente',
  gradePersonalizada:      config.gradePersonalizada  || {},
  modoExibirAssuntos:      config.modoExibirAssuntos  !== false,
  modoExibirTempo:         normalizarModoExibirTempo(config.modoExibirTempo),
  coresDisciplinasAtivas:  config.coresDisciplinasAtivas !== false,
  limitarMaterias:         config.limitarMaterias     || false,
  limitesPorDia:           config.limitesPorDia       || {},
  disciplinasTodosDiasIds: _normalizarIdsTodosDias(config.disciplinasTodosDiasIds),
  geradoPorIA:             geradoPorIA_,
  resumoGeracao:           result.resumoGeracao || '',
  diasEstudo: Object.entries(horarios)
    .filter(([, h]) => Number(h) > 0)
    .map(([d]) => Number(d)),
});

const _normalizarIdsTodosDias = (ids = []) => (
  [...new Set((Array.isArray(ids) ? ids : (ids ? [ids] : [])).filter(Boolean).map(String))]
);

const _disciplinaEstaTodosDias = (idsTodosDias, disciplinaId) => (
  _normalizarIdsTodosDias(idsTodosDias).includes(String(disciplinaId))
);

const _montarDisciplinasSnapshotCompleto = ({ edital, disciplinas, extraDisciplinas, selecao, disciplinasTodosDiasIds = [] }) => {
  const todasDiscs = edital?.id === 'manual' ? disciplinas : [...disciplinas, ...extraDisciplinas];
  const idsTodosDias = _normalizarIdsTodosDias(disciplinasTodosDiasIds);

  return todasDiscs.map((disciplina, index) => {
    const sel = selecao[disciplina.id] || {};
    const ativa = Boolean(sel.checked || sel.parcial);
    const assuntosOriginais = Array.isArray(disciplina.assuntos) ? disciplina.assuntos : [];
    const assuntosFiltrados = sel?.assuntosMarcados?.size > 0
      ? Array.from(sel.assuntosMarcados).map(i => assuntosOriginais[i]).filter(Boolean)
      : assuntosOriginais;

    return {
      ...disciplina,
      index,
      conhecimentoNivel: normalizePlanningLevel(sel?.conhecimentoNivel) || getKnowledgeLevel(disciplina),
      importanciaNivel: normalizePlanningLevel(sel?.importanciaNivel) || getImportanceLevel(disciplina),
      assuntos: _normalizarAssuntos(ativa ? assuntosFiltrados : assuntosOriginais),
      inCiclo: ativa,
      estudarTodosDias: ativa && _disciplinaEstaTodosDias(idsTodosDias, disciplina.id),
    };
  });
};

const _aplicarCoresUnicasCronograma = (semanaTemplate = [], disciplinas = []) => {
  const disciplinasAtivas = disciplinas.filter((disciplina) => disciplina?.inCiclo !== false);
  const colorMap = buildDisciplineColorMap(disciplinasAtivas, {
    preserveStored: false,
    excludeReviewBlue: true,
  });
  const getCorDisciplina = (disciplina) => (
    colorMap[getDisciplineKey(disciplina?.id)]
    || colorMap[getDisciplineKey(disciplina?.nome)]
    || colorMap[getDisciplineKey(disciplina)]
  );

  return {
    semanaTemplate: (semanaTemplate || []).map((slot) => (
      slot?.isRevisao || slot?.isRevisaoAuto || slot?.isConsolidada
        ? slot
        : { ...slot, cor: getStoredDisciplineColor(slot?.cor) || getDisciplineColorForSlot(slot, colorMap) }
    )),
    disciplinas: (disciplinas || []).map((disciplina) => ({
      ...disciplina,
      cor: disciplina?.inCiclo === false
        ? disciplina?.cor || null
        : getStoredDisciplineColor(disciplina?.cor) || getCorDisciplina(disciplina) || disciplina?.cor || null,
    })),
  };
};

const _temNiveisPlanejamento = (valor = {}) => hasCompletePlanningLevels(valor);

const _normalizarTextoAssunto = (valor) => String(valor || '')
  .replace(/\s+/g, ' ')
  .replace(/^[\-•–—]\s*/, '')
  .trim();

const _normalizarAssuntos = (assuntos = []) => {
  const vistos = new Set();
  const normalizados = [];

  (Array.isArray(assuntos) ? assuntos : []).forEach((assunto) => {
    const nome = _normalizarTextoAssunto(typeof assunto === 'string' ? assunto : assunto?.nome || assunto?.titulo || assunto?.label || '');
    if (!nome) return;
    const chave = nome.toLocaleLowerCase('pt-BR');
    if (vistos.has(chave)) return;
    vistos.add(chave);
    normalizados.push(nome);
  });

  return normalizados;
};

const _normalizarDisciplinasEdital = (editalObj = {}) => (
  (editalObj.disciplinas || []).map((d, idx) => ({
    id:       `d-${idx}`,
    nome:     d.nome || d,
    assuntos: _normalizarAssuntos(d.assuntos),
    peso: Number(d.peso || d.peso_sugerido) || 3,
    conhecimentoNivel: getKnowledgeLevel(d),
    importanciaNivel: getImportanceLevel(d),
  }))
);

const _isEditalConfirmadoValido = (editalObj) => {
  if (!editalObj?.id) return false;
  if (editalObj.id === 'manual') return true;
  return Boolean(editalObj.titulo || editalObj.nome);
};

const _normalizarHorariosEditaveis = (cronograma = {}) => {
  const horarios = { ...defaultHorarios };
  const detalhados = cronograma?.horariosDetalhados;

  if (detalhados && typeof detalhados === 'object' && !Array.isArray(detalhados)) {
    Object.keys(horarios).forEach((dia) => {
      horarios[dia] = Number(detalhados[dia] ?? detalhados[String(dia)] ?? 0) || 0;
    });
    return horarios;
  }

  if (cronograma?.diasEstudo && typeof cronograma.diasEstudo === 'object' && !Array.isArray(cronograma.diasEstudo)) {
    Object.keys(horarios).forEach((dia) => {
      horarios[dia] = Number(cronograma.diasEstudo[dia] ?? cronograma.diasEstudo[String(dia)] ?? 0) || 0;
    });
    return horarios;
  }

  const template = Array.isArray(cronograma?.semanaTemplate) ? cronograma.semanaTemplate : [];
  template.forEach((slot) => {
    const dia = Number(slot?.dia);
    if (!Number.isInteger(dia) || dia < 0 || dia > 6) return;
    const bruto = Number(slot?.minutosBrutoDia ?? 0);
    if (bruto > 0) {
      horarios[dia] = Math.max(horarios[dia], bruto / 60);
    }
  });

  if (Array.isArray(cronograma?.diasEstudo)) {
    cronograma.diasEstudo.forEach((dia) => {
      const diaNum = Number(dia);
      if (Number.isInteger(diaNum) && diaNum >= 0 && diaNum <= 6 && horarios[diaNum] <= 0) {
        horarios[diaNum] = 1;
      }
    });
  }

  return horarios;
};

const _normalizarInitialStateEdicao = (source = {}, modelos = []) => {
  const cronograma = source?.cronograma && !source?.disciplinas ? source.cronograma : source;
  if (!cronograma || typeof cronograma !== 'object') return null;

  if (source?.disciplinas && source?.horarios && source?.cronConfig) {
    const todasDisciplinas = [...(source.disciplinas || []), ...(source.extraDisciplinas || [])];
    const selecaoNormalizada = Object.fromEntries(
      Object.entries(source.selecao || {}).map(([id, valor]) => {
        const disciplina = todasDisciplinas.find((item) => String(item.id) === String(id)) || valor;
        return [id, {
          ...valor,
          conhecimentoNivel: normalizePlanningLevel(valor?.conhecimentoNivel) || getKnowledgeLevel(disciplina),
          importanciaNivel: normalizePlanningLevel(valor?.importanciaNivel) || getImportanceLevel(disciplina),
        }];
      }),
    );
    return {
      tipo: source.tipo || 'personalizado',
      edital: source.edital || null,
      disciplinas: source.disciplinas || [],
      extraDisciplinas: source.extraDisciplinas || [],
      selecao: selecaoNormalizada,
      horarios: { ...defaultHorarios, ...(source.horarios || {}) },
      cronConfig: { ...defaultConfig(), ...(source.cronConfig || {}), dataInicioManual: true },
    };
  }

  const modelosDisponiveis = Array.isArray(modelos) ? modelos : [];
  const modelo = modelosDisponiveis.find((item) => item?.id === cronograma.editalId) || null;
  const edital = modelo
    ? { ...modelo, titulo: cronograma.editalNome || modelo.titulo || modelo.nome, logoUrl: cronograma.logoUrl || modelo.logoUrl || modelo.logo || null }
    : {
        id: cronograma.editalId || 'manual',
        titulo: cronograma.editalNome || cronograma.nome || 'Manual',
        logoUrl: cronograma.logoUrl || null,
      };

  const snapshot = Array.isArray(cronograma.disciplinasSnapshot) ? cronograma.disciplinasSnapshot : [];
  const baseDisciplinas = edital?.id !== 'manual' && modelo ? _normalizarDisciplinasEdital(modelo) : snapshot.map((disc, idx) => ({
    id: disc?.id || `edit-${idx}`,
    nome: disc?.nome || `Disciplina ${idx + 1}`,
    assuntos: Array.isArray(disc?.assuntos) ? disc.assuntos.filter(Boolean) : [],
    peso: Number(disc?.peso) || 3,
    conhecimentoNivel: getKnowledgeLevel(disc),
    importanciaNivel: getImportanceLevel(disc),
  }));

  const findSnapshotDisc = (disciplina) => snapshot.find((item) => item?.id === disciplina.id)
    || snapshot.find((item) => String(item?.nome || '').trim().toLowerCase() === String(disciplina?.nome || '').trim().toLowerCase());

  const matchedIds = new Set();
  const selecao = {};

  baseDisciplinas.forEach((disciplina) => {
    const snapDisc = findSnapshotDisc(disciplina);
    if (snapDisc?.id) matchedIds.add(snapDisc.id);

    const assuntosOriginais = Array.isArray(disciplina.assuntos) ? disciplina.assuntos : [];
    const assuntosSelecionados = new Set(Array.isArray(snapDisc?.assuntos) ? snapDisc.assuntos : []);
    const assuntosMarcados = new Set();
    assuntosOriginais.forEach((assunto, idx) => {
      if (assuntosSelecionados.has(assunto)) assuntosMarcados.add(idx);
    });

    const ativo = Boolean(snapDisc?.inCiclo);
    const parcial = ativo && assuntosMarcados.size > 0 && assuntosMarcados.size < assuntosOriginais.length;

    selecao[disciplina.id] = {
      checked: ativo && !parcial,
      parcial,
      assuntosMarcados,
      conhecimentoNivel: getKnowledgeLevel(snapDisc || disciplina),
      importanciaNivel: getImportanceLevel(snapDisc || disciplina),
    };
  });

  const extraDisciplinas = snapshot
    .filter((disc) => disc?.id && !matchedIds.has(disc.id))
    .map((disc, idx) => ({
      id: disc.id || `extra-edit-${idx}`,
      nome: disc.nome || `Extra ${idx + 1}`,
      assuntos: Array.isArray(disc.assuntos) ? disc.assuntos.filter(Boolean) : [],
      peso: Number(disc.peso) || 3,
      conhecimentoNivel: getKnowledgeLevel(disc),
      importanciaNivel: getImportanceLevel(disc),
    }));

  extraDisciplinas.forEach((disciplina) => {
    selecao[disciplina.id] = {
      checked: Boolean(snapshot.find((item) => item?.id === disciplina.id)?.inCiclo),
      parcial: false,
      assuntosMarcados: new Set(),
      conhecimentoNivel: disciplina.conhecimentoNivel,
      importanciaNivel: disciplina.importanciaNivel,
    };
  });

  return {
    tipo: 'personalizado',
    edital,
    disciplinas: baseDisciplinas,
    extraDisciplinas,
    selecao,
    horarios: _normalizarHorariosEditaveis(cronograma),
    cronConfig: {
      ...defaultConfig(),
      nome: cronograma.nome || edital?.titulo || 'Meu Cronograma',
      dataInicio: cronograma.dataInicio || defaultConfig().dataInicio,
      dataInicioManual: true,
      tempoRevisaoMinutos: Number(cronograma.tempoRevisaoMinutos ?? 20) || 20,
      usarDuracaoUnica: cronograma.usarDuracaoUnica !== false,
      tempoSessaoMinutos: Number(cronograma.tempoSessaoMinutos || cronograma.duracaoMaximaSessaoMinutos) || DURACAO_AUTOMATICA_MAXIMA_MINUTOS,
      duracaoMinimaSessaoMinutos: Number(cronograma.duracaoMinimaSessaoMinutos) || DURACAO_AUTOMATICA_MINUTOS,
      duracaoMaximaSessaoMinutos: Number(cronograma.duracaoMaximaSessaoMinutos) || DURACAO_AUTOMATICA_MAXIMA_MINUTOS,
      retaFinal: Boolean(cronograma.retaFinal),
      dataProva: cronograma.dataProva || '',
      modoMontagem: cronograma.modoMontagem || 'inteligente',
      modoExibirAssuntos: cronograma.modoExibirAssuntos !== false,
      modoExibirTempo: normalizarModoExibirTempo(cronograma.modoExibirTempo),
      coresDisciplinasAtivas: cronograma.coresDisciplinasAtivas !== false,
      limitarMaterias: Boolean(cronograma.limitarMaterias),
      limitesPorDia: cronograma.limitesPorDia || {},
      disciplinasTodosDiasIds: _normalizarIdsTodosDias(
        cronograma.disciplinasTodosDiasIds
        || snapshot
          .filter((disciplina) => disciplina?.estudarTodosDias === true)
          .map((disciplina) => disciplina.id)
      ),
    },
  };
};

// ─── HOOK PRINCIPAL ───────────────────────────────────────────────────────────

/**
 * @param {Object} user           - Usuário Firebase autenticado.
 * @param {Function} onClose      - Callback para fechar o wizard.
 * @param {Function} onCronogramaCriado - Callback com o ID do cronograma criado.
 * @param {Function} onOpenFeedback    - Callback para abrir o modal de feedback.
 */
export function useCronogramaWizard(user, onClose, onCronogramaCriado, onOpenFeedback, options = {}) {
  const {
    mode = 'create',
    cronogramaId = null,
    initialState = null,
    preselectedEdital = null,
  } = options;
  const isEditMode = mode === 'edit';
  const hidratacaoEdicaoRef = useRef(false);
  // ── Dados de negócio ───────────────────────────────────────────────────────
  const [tipo,             setTipo]             = useState(null);
  const [edital,           setEdital]           = useState(null);
  const [disciplinas,      setDisciplinas]      = useState([]);
  const [extraDisciplinas, setExtraDisciplinas] = useState([]);
  const [selecao,          setSelecao]          = useState({});
  const [horarios,         setHorariosState]    = useState(defaultHorarios);
  const [cronConfig,       setCronConfigState]  = useState(defaultConfig());
  const [horasExpresso,    setHorasExpresso]    = useState(2);

  // ── Modelos do Firebase ────────────────────────────────────────────────────
  const [modelos,           setModelos]           = useState([]);
  const [carregandoModelos, setCarregandoModelos] = useState(false);

  // ── Estado de geração ──────────────────────────────────────────────────────
  const [isLoading,        setIsLoading]        = useState(false);
  const [statusIA,         setStatusIA]         = useState(null);
  const [percentIA,        setPercentIA]        = useState(0);
  const [erroGeracao,      setErroGeracao]      = useState(null);

  /**
   * Resultado unificado da geração.
   * Substitui os 6 useState separados (semanaTemplateIA, distribuicaoTempoIA…).
   * @type {null | ScheduleResult}
   */
  const [resultadoGeracao, setResultadoGeracao] = useState(null);

  // ── Modal de rascunho ──────────────────────────────────────────────────────
  const [mostrandoRascunho, setMostrandoRascunho] = useState(false);
  const [carregandoEdicaoInicial, setCarregandoEdicaoInicial] = useState(isEditMode);

  // ── Serviços Firebase ──────────────────────────────────────────────────────
  const { salvarCronogramaUnificado, atualizarCronogramaUnificado } = useCronogramaSystem(user);

  const setCronConfig = useCallback((value) => {
    setCronConfigState((prev) => {
      const rawNext = typeof value === 'function' ? value(prev) : value;
      if (!rawNext) return rawNext;
      const dataInicioMudou = rawNext.dataInicio != null && rawNext.dataInicio !== prev.dataInicio;
      const next = aplicarDivisaoAutomatica({
        ...rawNext,
        ...(dataInicioMudou ? { dataInicio: clampPlanningStartDate(rawNext.dataInicio) } : {}),
      });

      if (typeof next.dataInicioManual === 'boolean') {
        return next;
      }

      return {
        ...next,
        dataInicioManual: dataInicioMudou ? true : Boolean(prev.dataInicioManual),
      };
    });
  }, []);

  // ─── [FIX-A] Wrapper de setHorarios que também atualiza dataInicio ─────────
  /**
   * Sempre que o usuário muda os horários, recalcula dataInicio para o
   * primeiro dia útil a partir de hoje, evitando que o cronograma comece
   * num dia de descanso.
   */
  const setHorarios = useCallback((novosHorarios) => {
    setHorariosState(novosHorarios);
    setCronConfigState(prev => {
      if (prev.dataInicioManual) {
        return prev;
      }
      const primeiroDiaUtil = _getPrimeiroDiaUtil(novosHorarios);
      return { ...prev, dataInicio: primeiroDiaUtil, dataInicioManual: false };
    });
  }, []);

  // ─── EFEITO: carregamento de modelos + verificação de draft (mount) ────────
  useEffect(() => {
    const carregarModelos = async () => {
      setCarregandoModelos(true);
      try {
        const snap   = await getDocs(collection(db, 'editais_templates'));
        const fromDb = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const dbMap  = new Map(fromDb.map(t => [t.id, t]));

        const local = CATALOGO_EDITAIS
          .filter(s => !dbMap.get(s.id)?.deleted)
          .map(s => {
            const dbEntry = dbMap.get(s.id);
            if (dbEntry) {
              dbMap.delete(s.id);
              return { ...s, ...dbEntry, logo: dbEntry.logoUrl || dbEntry.logo || s.logo, isInstalled: true };
            }
            return { ...s, isInstalled: false };
          });

        const custom = Array.from(dbMap.values())
          .filter(t => !t.deleted)
          .map(t => ({ ...t, logo: t.logoUrl || t.logo, isCustom: true, isInstalled: true, ativo: t.ativo !== false }));

        setModelos([...local, ...custom]);
      } catch {
        setModelos(CATALOGO_EDITAIS);
      } finally {
        setCarregandoModelos(false);
      }
    };

    carregarModelos();

    if (!isEditMode && !preselectedEdital && _lerDraft()) setMostrandoRascunho(true);
  }, [isEditMode, preselectedEdital]);

  // ─── EFEITO: auto-save do draft sempre que dados de negócio mudarem ────────
  // Debounce de 500ms: só persiste quando o usuário para de interagir,
  // evitando dezenas de gravações seguidas (ex: digitação no campo nome).
  useEffect(() => {
    if (isEditMode) return undefined;
    if (!tipo && !edital && disciplinas.length === 0) return;
    const timeout = setTimeout(() => {
      _salvarDraft({ tipo, edital, disciplinas, extraDisciplinas, selecao, horarios, cronConfig, horasExpresso });
    }, 500);
    return () => clearTimeout(timeout);
  }, [isEditMode, tipo, edital, disciplinas, extraDisciplinas, selecao, horarios, cronConfig, horasExpresso]);

  useEffect(() => {
    if (!isEditMode || hidratacaoEdicaoRef.current || carregandoModelos) return;

    const aplicarEstado = (estado) => {
      if (!estado) {
        setCarregandoEdicaoInicial(false);
        return;
      }

      setTipo(estado.tipo || 'personalizado');
      setEdital(estado.edital || null);
      setDisciplinas(estado.disciplinas || []);
      setExtraDisciplinas(estado.extraDisciplinas || []);
      setSelecao(estado.selecao || {});
      setHorariosState({ ...defaultHorarios, ...(estado.horarios || {}) });
      setCronConfigState(aplicarDivisaoAutomatica({ ...defaultConfig(), ...(estado.cronConfig || {}), dataInicioManual: true }));
      setResultadoGeracao(null);
      setErroGeracao(null);
      setMostrandoRascunho(false);
      hidratacaoEdicaoRef.current = true;
      setCarregandoEdicaoInicial(false);
    };

    const carregarCronograma = async () => {
      try {
        let estadoNormalizado = _normalizarInitialStateEdicao(initialState, modelos);

        if (!estadoNormalizado && cronogramaId && user?.uid) {
          const snap = await getDoc(doc(db, 'users', user.uid, 'cronogramas', cronogramaId));
          if (snap.exists()) {
            estadoNormalizado = _normalizarInitialStateEdicao({ id: snap.id, ...snap.data() }, modelos);
          }
        }

        aplicarEstado(estadoNormalizado);
      } catch (error) {
        console.error('[useCronogramaWizard] Falha ao hidratar edicao:', error);
        setCarregandoEdicaoInicial(false);
      }
    };

    carregarCronograma();
  }, [isEditMode, carregandoModelos, initialState, modelos, cronogramaId, user]);

  // ─── EFEITO: dispara geração automática ao entrar no passo 6 ──────────────
  // O passo é recebido como parâmetro externo via triggerGeracaoPasso6.
  // WizardShell chama handleGerarPrevia() diretamente pelo useEffect de passo.
  // (Ver nota no retorno do hook.)

  // ─── RESTAURAR DRAFT ──────────────────────────────────────────────────────

  const restaurarDraft = () => {
    if (isEditMode) return 1;
    const draft = _lerDraft();
    if (draft) {
      if (draft.tipo)              setTipo(draft.tipo);
      if (draft.edital)            setEdital(draft.edital);
      if (draft.disciplinas)       setDisciplinas(draft.disciplinas);
      if (draft.extraDisciplinas)  setExtraDisciplinas(draft.extraDisciplinas);
      if (draft.selecao)           setSelecao(draft.selecao);
      const cronConfigDraft = draft.cronConfig
        ? aplicarDivisaoAutomatica({
            ...defaultConfig(),
            ...draft.cronConfig,
            dataInicio: clampPlanningStartDate(draft.cronConfig.dataInicio),
            dataInicioManual: Boolean(draft.cronConfig.dataInicioManual),
          })
        : null;

      if (draft.horarios) {
        setHorariosState(draft.horarios);
        if (cronConfigDraft) {
          if (cronConfigDraft.dataInicioManual) {
            setCronConfigState(cronConfigDraft);
          } else {
            const primeiroDiaUtil = _getPrimeiroDiaUtil(draft.horarios);
            setCronConfigState({ ...cronConfigDraft, dataInicio: primeiroDiaUtil, dataInicioManual: false });
          }
        }
      } else if (cronConfigDraft) {
        setCronConfigState(cronConfigDraft);
      }
      if (draft.horasExpresso != null) setHorasExpresso(draft.horasExpresso);
      setMostrandoRascunho(false);
      // Retorna o passo salvo para que o WizardShell restaure a navegação.
      // Limita a 4 (nunca restaura direto no passo 5 de Prévia — forçar regerar).
      return typeof draft.passo === 'number' ? Math.min(draft.passo, 4) : 0;
    }
    setMostrandoRascunho(false);
    return 0;
  };

  // ─── SELECIONAR EDITAL ────────────────────────────────────────────────────

  /**
   * Popula edital, disciplinas e seleção a partir do objeto de edital escolhido.
   * Se fluxo expresso, dispara handleSalvarExpresso imediatamente.
   * @param {Object} editalObj
   */
  const handleSelectEdital = (editalObj) => {
    if (editalObj.id === 'manual') {
      setEdital({ id: 'manual', titulo: 'Manual' });
      setDisciplinas([]);
      setExtraDisciplinas([]);
      setSelecao({});
      setCronConfigState(prev => ({ ...prev, nome: 'Meu Cronograma', disciplinasTodosDiasIds: [] }));
      return; // WizardShell avança o passo
    }

    setEdital(editalObj);

    const discs = _normalizarDisciplinasEdital(editalObj);

    setDisciplinas(discs);
    setExtraDisciplinas([]);

    const novaSelecao = {};
    discs.forEach(d => {
      novaSelecao[d.id] = { checked: false, parcial: false, assuntosMarcados: new Set(), conhecimentoNivel: 0, importanciaNivel: 0 };
    });
    setSelecao(novaSelecao);
    setCronConfigState(prev => ({ ...prev, nome: editalObj.titulo || 'Meu Cronograma', disciplinasTodosDiasIds: [] }));

    if (tipo === 'expresso') {
      handleSalvarExpresso(editalObj, discs);
    }
    // Para fluxo personalizado, WizardShell avança para passo 2
  };

  // ─── GERAR PRÉVIA (passo 6 — fluxo personalizado) ─────────────────────────

  /**
   * Chama gerarCronogramaIA (com fallback local via gerarSchedule).
   * Atualiza resultadoGeracao com o resultado completo — um único setState.
   *
   * [FIX-A] dataInicio já está corrigido em cronConfig (via setHorarios).
   * [FIX-C] o callback onProgress recebe (percent, msg) diretamente.
   */
  const handleGerarPrevia = useCallback(async () => {
    const animationStartedAt = Date.now();
    const todasDiscs  = edital?.id === 'manual' ? disciplinas : [...disciplinas, ...extraDisciplinas];
    const modoPersonalizado = cronConfig.modoMontagem === 'personalizado';
    const gradeManualAtiva = modoPersonalizado && _temGradePersonalizada(cronConfig.gradePersonalizada);
    const idsGradeManual = new Set(_normalizarGradePersonalizada(cronConfig.gradePersonalizada).map((slot) => String(slot.disciplinaId)));
    const discsFinais = gradeManualAtiva
      ? todasDiscs.filter((disciplina) => idsGradeManual.has(String(disciplina.id)))
      : _filtrarDisciplinasSelecionadas(todasDiscs, selecao);

    if (!discsFinais.length) return;
    if (!gradeManualAtiva && !_selecionadasTemNivelValido(discsFinais, selecao)) return;

    // Guard: não regenera se já está carregando
    if (isLoading) return;

    setIsLoading(true);
    setPercentIA(5);
    setStatusIA(modoPersonalizado ? 'Montando grade personalizada...' : 'Calculando cotas e esqueleto...');
    setResultadoGeracao(null);
    setErroGeracao(null);

    const horariosNumerados = {};
    Object.entries(horarios).forEach(([dia, horas]) => {
      if (Number(horas) > 0) horariosNumerados[dia] = Number(horas);
    });

    const discsParaIA = _normalizarDiscsParaGeracao(
      discsFinais,
      selecao,
      cronConfig.disciplinasTodosDiasIds
    );
    const possuiPreferenciaDiaria = _normalizarIdsTodosDias(cronConfig.disciplinasTodosDiasIds).length > 0;

    let result = null;

    // [FIX-A] Usa o cronConfig.dataInicio que já foi corrigido pelo setHorarios().
    // Como fallback de segurança, recalcula direto caso o state ainda não tenha propagado.
    const dataInicioPadrao = cronConfig.dataInicio || _getPrimeiroDiaUtil(horarios);

    if (gradeManualAtiva) {
      setPercentIA(80);
      result = _gerarCronogramaDeGradePersonalizada(cronConfig.gradePersonalizada, discsFinais, { ...cronConfig, dataInicio: dataInicioPadrao });
    } else if (modoPersonalizado) {
      setPercentIA(55);
      result = _gerarFallbackLocal(discsParaIA, horariosNumerados, { ...cronConfig, dataInicio: dataInicioPadrao });
      if (result) {
        result = {
          ...result,
          geradoPorIA: false,
          modoMontagem: 'personalizado',
          resumoGeracao: result.resumoGeracao || 'Grade personalizada gerada a partir das disciplinas e horarios escolhidos.',
        };
      }
    } else if (possuiPreferenciaDiaria) {
      setPercentIA(55);
      result = _gerarFallbackLocal(discsParaIA, horariosNumerados, { ...cronConfig, dataInicio: dataInicioPadrao });
    } else {
    try {
      result = await gerarCronogramaIA(
        discsParaIA,
        horariosNumerados,
        {
          dataInicio:          dataInicioPadrao,
          dataProva:           cronConfig.dataProva           || null,
          retaFinal:           cronConfig.retaFinal           || false,
          tempoRevisaoMinutos: cronConfig.tempoRevisaoMinutos || 20,
          usarDuracaoUnica: cronConfig.usarDuracaoUnica !== false,
          tempoSessaoMinutos: cronConfig.tempoSessaoMinutos || cronConfig.duracaoMaximaSessaoMinutos || DURACAO_AUTOMATICA_MAXIMA_MINUTOS,
          duracaoMinimaSessaoMinutos: cronConfig.duracaoMinimaSessaoMinutos || DURACAO_AUTOMATICA_MINUTOS,
          duracaoMaximaSessaoMinutos: cronConfig.duracaoMaximaSessaoMinutos || DURACAO_AUTOMATICA_MAXIMA_MINUTOS,
          limitarMaterias:     cronConfig.limitarMaterias     || false,
          limitesPorDia:       cronConfig.limitesPorDia       || {},
        },
        {},
        // [FIX-C] recebe (percent, msg) diretamente — sem inferência por string
        (percent, msg) => {
          if (msg)     setStatusIA(msg);
          if (percent) setPercentIA(prev => Math.max(prev, percent));
        }
      );
    } catch (err) {
      result = null;
      if (import.meta.env.DEV) console.warn('[handleGerarPrevia] IA falhou:', err);
    }
    }

    setPercentIA(100);
    setStatusIA('Tudo pronto! Preparando prévia...');

    // Delay para o usuário ver o 100%
    await new Promise(r => setTimeout(r, Math.max(0, 3000 - (Date.now() - animationStartedAt))));

    // Fallback local se IA falhar
    if (!result?.semanaTemplate?.length) {
      result = _gerarFallbackLocal(discsParaIA, horariosNumerados, { ...cronConfig, dataInicio: dataInicioPadrao });
    }

    // Se fallback também falhar, expor erro ao usuário
    if (!result?.semanaTemplate?.length) {
      setErroGeracao('Não foi possível gerar o cronograma. Verifique as configurações e tente novamente.');
      setIsLoading(false);
      setStatusIA(null);
      setPercentIA(0);
      return;
    }

    // [FIX-D] isLoading=false ANTES de setar o resultado,
    // para que o AILoadingState seja desmontado antes do cronograma aparecer.
    setIsLoading(false);
    setStatusIA(null);
    setPercentIA(0);
    setResultadoGeracao({ ...result });
  }, [edital, disciplinas, extraDisciplinas, selecao, horarios, cronConfig, isLoading]);

  // ─── SALVAR EXPRESSO ──────────────────────────────────────────────────────

  /**
   * Gera e salva o cronograma no fluxo expresso (sem prévia).
   * @param {Object} editalObj
   * @param {Array}  discs
   */
  const handleSalvarExpresso = async (editalObj, discs) => {
    const animationStartedAt = Date.now();
    setIsLoading(true);
    setPercentIA(10);
    setStatusIA('Analisando disciplinas...');

    const discsNorm = discs.map(d => ({ ...d, diasFixados: [] }));

    let template = null;
    try {
      setPercentIA(30);
      template = await gerarCronogramaExpressoIA(
        discsNorm,
        horasExpresso,
        // [FIX-C] recebe (percent, msg) diretamente
        (percent, msg) => {
          if (msg)     setStatusIA(msg);
          if (percent) setPercentIA(prev => Math.max(prev, percent));
        }
      );
    } catch {
      template = null;
    }

    setPercentIA(90);

    // [FIX-A] Para o fluxo expresso, considera Seg-Sex como dias padrão
    const horariosExpressoPadrao = { 1: horasExpresso, 2: horasExpresso, 3: horasExpresso, 4: horasExpresso, 5: horasExpresso };

    // Fallback algorítmico
    if (!template?.semanaTemplate?.length) {
      template = _gerarFallbackLocal(discsNorm, horariosExpressoPadrao, {});
      if (!template) {
        await new Promise(r => setTimeout(r, Math.max(0, 3000 - (Date.now() - animationStartedAt))));
        setIsLoading(false);
        setStatusIA(null);
        setPercentIA(0);
        return;
      }
    }

    // [FIX-A] Usa helper para garantir que o início não caia num dia de descanso
    const dataInicioPadrao = _getPrimeiroDiaUtil(horariosExpressoPadrao);

    const dados = {
      nome:                    editalObj.titulo || 'Cronograma Expresso',
      editalId:                editalObj.id     || 'manual',
      editalNome:              editalObj.titulo  || 'Manual',
      logoUrl:                 editalObj.logoUrl || editalObj.logo || null,
      totalHorasSemanais:      horasExpresso * 5,
      horariosDetalhados:      { 0: 0, 1: horasExpresso, 2: horasExpresso, 3: horasExpresso, 4: horasExpresso, 5: horasExpresso, 6: 0 },
      horasPorDia:             horasExpresso,
      materiasPorDiaPreferido: 3,
      dataInicio:              template.dataInicio || dataInicioPadrao,
      dataFim:                 template.dataFim,
      totalSemanasNecessarias: template.totalSemanasNecessarias,
      tipo:                    'expresso',
      metodologiasAplicadas:   template.metodologiasAplicadas,
      modoExibirAssuntos:      true,
      geradoPorIA:             !!template.geradoPorIA,
      resumoGeracao:           template.resumoGeracao || '',
    };

    const disciplinasSnapshotCompleto = discs.map((disciplina, index) => ({
      ...disciplina,
      index,
      conhecimentoNivel: getKnowledgeLevel(disciplina) || 3,
      importanciaNivel: getImportanceLevel(disciplina) || 3,
      inCiclo: true,
    }));

    const cronogramaComCores = _aplicarCoresUnicasCronograma(template.semanaTemplate, disciplinasSnapshotCompleto);
    const novoId = await salvarCronogramaUnificado(dados, cronogramaComCores.semanaTemplate, cronogramaComCores.disciplinas);

    setPercentIA(100);
    setStatusIA('Cronograma criado com sucesso!');
    await new Promise(r => setTimeout(r, Math.max(0, 3000 - (Date.now() - animationStartedAt))));

    if (novoId) {
      _limparDraft();
      _dispararConfetti();
      window.dispatchEvent(new CustomEvent('Planning:Created', {
        detail: { type: 'cronograma', name: editalObj?.titulo || '' },
      }));
      if (onCronogramaCriado) onCronogramaCriado(novoId);
      onClose();
    }
    setIsLoading(false);
    setStatusIA(null);
    setPercentIA(0);
  };

  // ─── SALVAR CRONOGRAMA PERSONALIZADO ─────────────────────────────────────

  /**
   * Salva o cronograma personalizado.
   * Reutiliza resultadoGeracao se disponível; caso contrário, regenera.
   */
  const handleSalvar = async () => {
    const animationStartedAt = Date.now();
    const todasDiscs  = edital?.id === 'manual' ? disciplinas : [...disciplinas, ...extraDisciplinas];
    const modoPersonalizadoSalvar = cronConfig.modoMontagem === 'personalizado';
    const gradeManualAtiva = modoPersonalizadoSalvar && _temGradePersonalizada(cronConfig.gradePersonalizada);
    const idsGradeManual = new Set(_normalizarGradePersonalizada(cronConfig.gradePersonalizada).map((slot) => String(slot.disciplinaId)));
    const discsFinais = gradeManualAtiva
      ? todasDiscs.filter((disciplina) => idsGradeManual.has(String(disciplina.id)))
      : _filtrarDisciplinasSelecionadas(todasDiscs, selecao);

    if (!discsFinais.length) {
      setErroGeracao('Selecione ao menos uma disciplina para salvar o cronograma.');
      return;
    }
    if (!gradeManualAtiva && !_selecionadasTemNivelValido(discsFinais, selecao)) {
      setErroGeracao('Defina conhecimento e importancia de 1 a 5 em todas as disciplinas selecionadas.');
      return;
    }

    setIsLoading(true);
    setPercentIA(10);
    setStatusIA('Finalizando e salvando cronograma...');
    setErroGeracao(null);

    const horariosNumerados = {};
    Object.entries(horarios).forEach(([dia, horas]) => {
      if (Number(horas) > 0) horariosNumerados[dia] = Number(horas);
    });

    const discsParaIA = _normalizarDiscsParaGeracao(
      discsFinais,
      selecao,
      cronConfig.disciplinasTodosDiasIds
    );
    const possuiPreferenciaDiaria = _normalizarIdsTodosDias(cronConfig.disciplinasTodosDiasIds).length > 0;

    let result = null;

    // [FIX-A] dataInicio já corrigido em cronConfig; fallback seguro via helper
    const dataInicioPadrao = cronConfig.dataInicio || _getPrimeiroDiaUtil(horarios);

    // Reutiliza prévia se disponível
    if (resultadoGeracao?.semanaTemplate?.length) {
      setPercentIA(40);
      const totalSemanas = resultadoGeracao.totalSemanasNecessarias ?? 12;
      const dtInicio     = dataInicioPadrao;
      const dtFimObj     = new Date(`${dtInicio}T12:00:00`);
      dtFimObj.setDate(dtFimObj.getDate() + totalSemanas * 7);

      result = {
        ...resultadoGeracao,
        dataInicio:              dtInicio,
        dataFim:                 dtFimObj.toISOString().split('T')[0],
        totalSemanasNecessarias: totalSemanas,
        metodologiasAplicadas: {
          cronograma:          'ciclo_intercalado',
          revisao:             METODOLOGIA_REVISAO,
          estudo:              [],
          tempoRevisaoMinutos: cronConfig.tempoRevisaoMinutos || 20,
        },
      };
      setPercentIA(70);
    } else if (gradeManualAtiva) {
      setPercentIA(55);
      result = _gerarCronogramaDeGradePersonalizada(cronConfig.gradePersonalizada, discsFinais, { ...cronConfig, dataInicio: dataInicioPadrao });
    } else if (modoPersonalizadoSalvar) {
      setPercentIA(55);
      result = _gerarFallbackLocal(discsParaIA, horariosNumerados, { ...cronConfig, dataInicio: dataInicioPadrao });
      if (result) {
        result = {
          ...result,
          geradoPorIA: false,
          modoMontagem: 'personalizado',
          resumoGeracao: result.resumoGeracao || 'Grade personalizada gerada a partir das disciplinas e horarios escolhidos.',
        };
      }
    } else if (possuiPreferenciaDiaria) {
      setPercentIA(55);
      result = _gerarFallbackLocal(discsParaIA, horariosNumerados, { ...cronConfig, dataInicio: dataInicioPadrao });
    } else {
      // Regenera se não há prévia
      try {
        result = await gerarCronogramaIA(
          discsParaIA,
          horariosNumerados,
          {
            dataInicio:          dataInicioPadrao,
            dataProva:           cronConfig.dataProva           || null,
            retaFinal:           cronConfig.retaFinal           || false,
            tempoRevisaoMinutos: cronConfig.tempoRevisaoMinutos || 20,
            usarDuracaoUnica: cronConfig.usarDuracaoUnica !== false,
            tempoSessaoMinutos: cronConfig.tempoSessaoMinutos || cronConfig.duracaoMaximaSessaoMinutos || DURACAO_AUTOMATICA_MAXIMA_MINUTOS,
            duracaoMinimaSessaoMinutos: cronConfig.duracaoMinimaSessaoMinutos || DURACAO_AUTOMATICA_MINUTOS,
            duracaoMaximaSessaoMinutos: cronConfig.duracaoMaximaSessaoMinutos || DURACAO_AUTOMATICA_MAXIMA_MINUTOS,
            limitarMaterias:     cronConfig.limitarMaterias     || false,
            limitesPorDia:       cronConfig.limitesPorDia       || {},
          },
          {},
          // [FIX-C] recebe (percent, msg) diretamente
          (percent, msg) => {
            if (msg)     setStatusIA(msg);
            if (percent) setPercentIA(prev => Math.max(prev, percent));
          }
        );
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[handleSalvar] IA falhou:', err);
        result = null;
      }

      if (!result?.semanaTemplate?.length) {
        result = _gerarFallbackLocal(discsParaIA, horariosNumerados, { ...cronConfig, dataInicio: dataInicioPadrao });
      }
    }

    setPercentIA(90);

    if (!result?.semanaTemplate?.length) {
      await new Promise(r => setTimeout(r, Math.max(0, 3000 - (Date.now() - animationStartedAt))));
      setIsLoading(false);
      setStatusIA(null);
      setErroGeracao('Erro ao gerar cronograma. Verifique as configurações e tente novamente.');
      setPercentIA(0);
      return;
    }

    const geradoPorIA_ = result.geradoPorIA ?? false;

    // [FIX-A] Garante que os dados salvos usam a dataInicio correta
    const configCorrigida = { ...cronConfig, dataInicio: dataInicioPadrao };
    const dados = _montarDadosParaSalvar(configCorrigida, edital, horarios, result, geradoPorIA_);
    const disciplinasSnapshotCompleto = _montarDisciplinasSnapshotCompleto({
      edital,
      disciplinas,
      extraDisciplinas,
      selecao,
      disciplinasTodosDiasIds: cronConfig.disciplinasTodosDiasIds,
    });
    const cronogramaComCores = _aplicarCoresUnicasCronograma(result.semanaTemplate, disciplinasSnapshotCompleto);

    setPercentIA(98);
    const novoId = isEditMode
      ? await atualizarCronogramaUnificado(cronogramaId, dados, cronogramaComCores.semanaTemplate, cronogramaComCores.disciplinas)
      : await salvarCronogramaUnificado(dados, cronogramaComCores.semanaTemplate, cronogramaComCores.disciplinas);

    setPercentIA(100);
    setStatusIA(isEditMode ? 'Cronograma atualizado com sucesso!' : 'Cronograma criado com sucesso!');
    await new Promise(r => setTimeout(r, Math.max(0, 3000 - (Date.now() - animationStartedAt))));

    if (novoId) {
      if (!isEditMode) _limparDraft();
      _dispararConfetti(true);
      if (!isEditMode) {
        window.dispatchEvent(new CustomEvent('Planning:Created', {
          detail: { type: 'cronograma', name: cronConfig.nome || edital?.titulo || '' },
        }));
      }
      if (onCronogramaCriado) onCronogramaCriado(novoId);
      onClose();
    }
    setIsLoading(false);
    setStatusIA(null);
    setPercentIA(0);
  };

  // ─── PODE AVANÇAR ─────────────────────────────────────────────────────────

  /**
   * Valida se o passo atual permite avançar.
   * @param {number} passo
   * @param {boolean} isExpresso
   * @returns {boolean}
   */
  const podeAvancar = (passo, isExpresso) => {
    if (passo === 0) return _isEditalConfirmadoValido(edital);

    // Passo 1: Disciplinas e Nível
    if (passo === 1) {
      if (cronConfig.modoMontagem === 'personalizado') return _temGradePersonalizada(cronConfig.gradePersonalizada);
      return true;
    }

    if (passo === 2) {
      if (isExpresso) return horasExpresso >= 0.5;

      const selecionadas = Object.entries(selecao).filter(([, s]) => s.checked || s.parcial);
      if (selecionadas.length === 0) return false;

      // Se for manual, as disciplinas precisam existir no array
      if (edital?.id === 'manual' && disciplinas.length === 0) return false;

      return selecionadas.every(([, s]) => _temNiveisPlanejamento(s));
    }

    // Passo 2: Horários
    if (passo === 3) return Object.values(horarios).some(h => h > 0)
      && Number(cronConfig.duracaoMinimaSessaoMinutos) >= 5
      && Number(cronConfig.duracaoMaximaSessaoMinutos) >= Number(cronConfig.duracaoMinimaSessaoMinutos);

    // Passo 3: Revisão (Informativo)
    if (passo === 4) return true;

    // Passo 4: Configurações
    if (passo === 5) return !!cronConfig.nome?.trim();

    return true;
  };

  // ─── RESET DO RESULTADO (chamado pelo WizardShell ao navegar) ─────────────

  /**
   * Limpa o resultado da prévia e o cache da IA.
   * Deve ser chamado pelo WizardShell ao sair do passo 6 ou ao avançar para ele.
   */
  const resetResultado = () => {
    setResultadoGeracao(null);
    limparCacheIA();
  };

  // ─── SALVAR DRAFT COM PASSO (chamado pelo WizardShell ao mudar de passo) ──
  /**
   * Persiste o draft incluindo o número do passo atual.
   * @param {number} passo
   */
  const salvarDraftComPasso = useCallback((passo) => {
    if (isEditMode) return;
    if (tipo || edital || disciplinas.length > 0) {
      _salvarDraft({ tipo, edital, disciplinas, extraDisciplinas, selecao, horarios, cronConfig, horasExpresso, passo });
    }
  }, [isEditMode, tipo, edital, disciplinas, extraDisciplinas, selecao, horarios, cronConfig, horasExpresso]);

  // ─── EXPOR limparDraft publicamente ───────────────────────────────────────
  const limparDraft = _limparDraft;

  // ─── RETORNO DO HOOK ──────────────────────────────────────────────────────
  return {
    // ── Estados de dados ──
    tipo,               setTipo,
    edital,
    disciplinas,        setDisciplinas,
    extraDisciplinas,   setExtraDisciplinas,
    selecao,            setSelecao,
    horarios,           setHorarios,     // [FIX-A] wrapper que atualiza dataInicio
    cronConfig,         setCronConfig,
    horasExpresso,      setHorasExpresso,

    // ── Modelos ──
    modelos,
    carregandoModelos,
    carregandoEdicaoInicial,
    isEditMode,

    // ── Estado da geração ──
    isLoading,
    statusIA,
    percentIA,
    resultadoGeracao,
    erroGeracao,
    setErroGeracao,

    // ── Handlers ──
    handleSelectEdital,
    handleGerarPrevia,
    handleSalvar,
    handleSalvarExpresso,
    podeAvancar,
    resetResultado,

    // ── Draft ──
    restaurarDraft,
    salvarDraftComPasso,
    mostrandoRascunho,
    setMostrandoRascunho,
    limparDraft,
  };
}

// ─── HELPERS PRIVADOS ─────────────────────────────────────────────────────────

/**
 * Normaliza as disciplinas finais para envio à IA ou gerador local,
 * filtrando assuntos marcados e aplicando nível da seleção.
 */
function _normalizarDiscsParaGeracao(discsFinais, selecao, disciplinasTodosDiasIds = []) {
  const idsTodosDias = _normalizarIdsTodosDias(disciplinasTodosDiasIds);
  return discsFinais.map(d => {
    const sel = selecao[d.id];
    const assuntosFiltrados = sel?.assuntosMarcados?.size > 0
      ? Array.from(sel.assuntosMarcados).map(i => d.assuntos[i]).filter(Boolean)
      : d.assuntos;
    return {
      ...d,
      assuntos:    _normalizarAssuntos(assuntosFiltrados),
      diasFixados: [],
      conhecimentoNivel: normalizePlanningLevel(sel?.conhecimentoNivel) || getKnowledgeLevel(d),
      importanciaNivel: normalizePlanningLevel(sel?.importanciaNivel) || getImportanceLevel(d),
      estudarTodosDias: _disciplinaEstaTodosDias(idsTodosDias, d.id),
    };
  });
}

function _selecionadasTemNivelValido(discsFinais, selecao) {
  return discsFinais.every((disciplina) => _temNiveisPlanejamento(selecao[disciplina.id]));
}

function _filtrarDisciplinasSelecionadas(disciplinas, selecao) {
  return disciplinas.filter((disciplina) => {
    const sel = selecao[disciplina.id] || {};
    return Boolean(sel.checked || sel.parcial);
  });
}

function _normalizarGradePersonalizada(grade = {}) {
  return Object.entries(grade || {}).flatMap(([dia, slots]) => (
    Array.isArray(slots)
      ? slots
        .filter((slot) => slot?.disciplinaId && Number(slot?.minutos) > 0)
        .map((slot, ordem) => ({ ...slot, dia: Number(dia), ordem }))
      : []
  ));
}

function _temGradePersonalizada(grade = {}) {
  return _normalizarGradePersonalizada(grade).length > 0;
}

function _gerarCronogramaDeGradePersonalizada(grade, disciplinas = [], config = {}) {
  const slotsGrade = _normalizarGradePersonalizada(grade);
  if (!slotsGrade.length) return null;

  const disciplinasPorId = new Map((disciplinas || []).map((disciplina) => [String(disciplina.id), disciplina]));
  const contagemPorDisciplina = {};
  slotsGrade.forEach((slot) => {
    const key = String(slot.disciplinaId);
    contagemPorDisciplina[key] = (contagemPorDisciplina[key] || 0) + 1;
  });
  const indicePorDisciplina = {};

  const semanaTemplate = slotsGrade.map((slot, index) => {
    const disciplina = disciplinasPorId.get(String(slot.disciplinaId)) || {};
    const key = String(slot.disciplinaId);
    const slotIndexParaDisc = indicePorDisciplina[key] || 0;
    indicePorDisciplina[key] = slotIndexParaDisc + 1;
    const minutos = Number(slot.minutos || slot.tempoMinutos || 60);

    return {
      slotId: slot.id || `custom-${slot.dia}-${index}`,
      slotIdBase: slot.id || `custom-${slot.dia}-${index}`,
      dia: Number(slot.dia),
      ordem: Number(slot.ordem ?? index),
      disciplinaId: slot.disciplinaId,
      disciplinaNome: slot.disciplinaNome || disciplina.nome || 'Disciplina',
      disciplina: slot.disciplinaNome || disciplina.nome || 'Disciplina',
      assunto: slot.assunto || null,
      cor: slot.cor || disciplina.cor || null,
      tempoMinutos: minutos,
      tempoPlanejadoMinutos: minutos,
      minutosEstudo: minutos,
      isRevisao: false,
      isRevisaoAuto: false,
      isConsolidada: false,
      totalSlotsParaDisc: contagemPorDisciplina[key] || 1,
      slotIndexParaDisc,
    };
  }).sort((a, b) => (a.dia - b.dia) || (a.ordem - b.ordem));

  const dataInicio = config.dataInicio || _getPrimeiroDiaUtil(
    semanaTemplate.reduce((acc, slot) => {
      acc[slot.dia] = (acc[slot.dia] || 0) + Number(slot.tempoMinutos || 0) / 60;
      return acc;
    }, {})
  );
  const totalSemanas = 12;
  const dtFimObj = new Date(`${dataInicio}T12:00:00`);
  dtFimObj.setDate(dtFimObj.getDate() + totalSemanas * 7);

  return {
    semanaTemplate,
    dataInicio,
    dataFim: dtFimObj.toISOString().split('T')[0],
    totalSemanasNecessarias: totalSemanas,
    metodologiasAplicadas: {
      cronograma: 'grade_personalizada',
      revisao: METODOLOGIA_REVISAO,
      estudo: ['grade_manual'],
      tempoRevisaoMinutos: config.tempoRevisaoMinutos || 20,
      duracaoMinimaSessaoMinutos: config.duracaoMinimaSessaoMinutos || DURACAO_AUTOMATICA_MINUTOS,
      duracaoMaximaSessaoMinutos: config.duracaoMaximaSessaoMinutos || DURACAO_AUTOMATICA_MAXIMA_MINUTOS,
    },
    geradoPorIA: false,
    modoMontagem: 'personalizado',
    resumoGeracao: 'Grade personalizada montada manualmente pelo aluno.',
  };
}

/**
 * Gera cronograma local usando gerarSchedule() como fallback quando a IA falha.
 * @returns {ScheduleResult | null}
 */
function _gerarFallbackLocal(discs, horariosNumerados, config) {
  try {
    return gerarSchedule(discs, horariosNumerados, {
      dataInicio:          config.dataInicio          || undefined,
      dataProva:           config.dataProva           || undefined,
      retaFinal:           config.retaFinal           || false,
      tempoRevisaoMinutos: config.tempoRevisaoMinutos || 20,
      usarDuracaoUnica: config.usarDuracaoUnica === true,
      tempoSessaoMinutos: config.tempoSessaoMinutos || config.duracaoMaximaSessaoMinutos || DURACAO_AUTOMATICA_MAXIMA_MINUTOS,
      duracaoMinimaSessaoMinutos: config.duracaoMinimaSessaoMinutos || DURACAO_AUTOMATICA_MINUTOS,
      duracaoMaximaSessaoMinutos: config.duracaoMaximaSessaoMinutos || DURACAO_AUTOMATICA_MAXIMA_MINUTOS,
      limitarMaterias:     config.limitarMaterias     || false,
      limitesPorDia:       config.limitesPorDia       || {},
    });
  } catch (e) {
    console.error('[useCronogramaWizard] Fallback local falhou:', e);
    return null;
  }
}
