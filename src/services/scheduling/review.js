/**
 * src/services/scheduling/review.js
 *
 * Lógica pura de agenda e revisão espaçada.
 * REGRAS ABSOLUTAS:
 *   - Zero imports de React
 *   - Zero acesso ao Firebase
 *   - Todas as funções são puras: mesmo input → mesmo output
 *   - Constantes importadas de './core.js' (não redefinidas aqui)
 *
 * CORREÇÕES APLICADAS:
 *   [FIX-1] _reconstruirHistorico: semanas passadas agora partem de
 *           dataInicioDate + semAnt*7 (não mais âncora no domingo via .getDay()).
 *           Isso evita que revisões sejam geradas para datas anteriores à criação.
 *
 *   [FIX-2] getAgendaSemana: cada slot só é incluído se sua dataSlot >=
 *           dataInicio do cronograma. Retroceder semanas nunca mais exibe
 *           estudos antes da data de criação.
 *           ADICIONALMENTE: semanaAtualInicio é limitado para nunca ser
 *           anterior a dataInicioDate, mesmo quando weekOffset=0 e dataInicio
 *           não é um domingo (ex: quarta-feira).
 *
 *   [FIX-3] O cronograma já cobria todo o edital via topicIdx circular —
 *           a correção do FIX-1 garante que as datas calculadas batem com
 *           as datas reais, fazendo revisões espaçadas aparecerem corretamente
 *           em todas as semanas (e não só na "semana atual").
 *
 *   [FIX-4] getAgendaSemana: semanaOffset negativo é rejeitado imediatamente,
 *           retornando [] para proteger contra navegação para antes do início.
 *           O caller (Step5Preview) já bloqueia o botão ← quando offset=0,
 *           mas esta defesa de profundidade garante que mesmo chamadas diretas
 *           à API não produzam dados inconsistentes.
 *
 *   [FIX-7] getAgendaDia: CORREÇÃO CRÍTICA do orçamento de tempo.
 *           O problema anterior: minutosDisponiveisDia era o tempo BRUTO (100%),
 *           mas os slots de teoria já foram gerados com apenas 75% desse bruto.
 *           Isso fazia a revisão ser calculada sobre o bruto e depois o sistema
 *           recomprimia a teoria — causando slots de teoria menores que o planejado
 *           OU revisão tomando mais de 25% do tempo real disponível.
 *
 *           SOLUÇÃO: getAgendaDia recebe minutosTeoriaOriginal (75% do bruto)
 *           e minutosRevisaoReservados (25% do bruto) separadamente.
 *           A revisão usa APENAS os minutosRevisaoReservados.
 *           A teoria usa APENAS os minutosTeoriaOriginal (sem recompressão).
 *           SOMA = teoria + revisão ≤ bruto SEMPRE.
 */

import {
  INTERVALOS_REVISAO,
  BASE_CAP_REVISAO,
  chaveAssuntoDominado,
  normalizarNivel,
} from './core.js';

export function parseDateOnlyLocal(date) {
  if (!date) return new Date();
  if (date instanceof Date) return new Date(date);
  if (date?.toDate) return date.toDate();
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }
  return new Date(date);
}

export function startOfLocalDay(date) {
  const d = parseDateOnlyLocal(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getRecordCreatedDay(record) {
  const raw = record?.criadoEm || record?.dataCriacao || record?.createdAt || record?.criadoEmIso || null;
  if (!raw) return null;
  const parsed = raw?.toDate ? raw.toDate() : raw?.seconds ? new Date(raw.seconds * 1000) : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfLocalDay(parsed);
}

export function formatDateKeyLocal(date) {
  const d = startOfLocalDay(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysLocal(date, days) {
  const d = startOfLocalDay(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getRevisaoOverride(revisoesReagendadas, slotId) {
  if (!revisoesReagendadas || !slotId) return null;
  const override = revisoesReagendadas[slotId];
  if (!override || override.ativo === false) return null;
  if (!override.reagendadoPara) return null;
  return override;
}

function normalizePendingKey(value) {
  return String(value || '').trim();
}

function getPendenciaTeoriaAtiva(cronograma, disciplinaId) {
  const key = normalizePendingKey(disciplinaId);
  if (!key) return null;
  return cronograma?.pendenciasTeoria?.[key] || null;
}

function normalizarTextoAssunto(valor) {
  return String(valor || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\-•–—]\s*/, '')
    .trim();
}

function normalizarAssuntosAgenda(assuntos = []) {
  const vistos = new Set();
  const normalizados = [];

  (Array.isArray(assuntos) ? assuntos : []).forEach((assunto) => {
    const nome = normalizarTextoAssunto(typeof assunto === 'string' ? assunto : assunto?.nome || assunto?.titulo || assunto?.label || '');
    if (!nome) return;
    const chave = nome.toLocaleLowerCase('pt-BR');
    if (vistos.has(chave)) return;
    vistos.add(chave);
    normalizados.push(nome);
  });

  return normalizados;
}

function expandirSlotsTeoriaAteOrcamento(slots, tetoDia) {
  const teto = Math.floor(Math.max(0, Number(tetoDia) || 0) / 5) * 5;
  if (teto <= 0 || !slots?.length) return slots;

  const normalizados = slots.map((slot) => ({
    ...slot,
    tempoMinutos: Number(slot.minutosEstudo || slot.tempoMinutos || 0),
    minutosEstudo: Number(slot.minutosEstudo || slot.tempoMinutos || 0),
  }));

  const somaAtual = normalizados.reduce((acc, slot) => acc + (slot.minutosEstudo || 0), 0);
  if (somaAtual >= teto || somaAtual <= 0) return normalizados;

  const linhas = normalizados.map((slot, index) => {
    const exato = ((slot.minutosEstudo || 0) / somaAtual) * teto;
    const inteiro = Math.max(5, Math.floor(exato / 5) * 5);
    return { index, inteiro, resto: exato % 5 };
  });

  let restante = teto - linhas.reduce((acc, linha) => acc + linha.inteiro, 0);
  linhas
    .slice()
    .sort((a, b) => b.resto - a.resto)
    .forEach((linha) => {
      if (restante < 5) return;
      linha.inteiro += 5;
      restante -= 5;
    });

  if (restante >= 5 && linhas.length > 0) {
    linhas[linhas.length - 1].inteiro += restante;
  }

  const minutosPorIndex = new Map(linhas.map((linha) => [linha.index, linha.inteiro]));
  return normalizados.map((slot, index) => {
    const minutos = minutosPorIndex.get(index) || slot.minutosEstudo || slot.tempoMinutos || 0;
    return {
      ...slot,
      tempoMinutos: minutos,
      minutosEstudo: minutos,
    };
  });
}

function getPendenciaSkipDateKey(pendencia) {
  if (!pendencia?.ultimaMarcacaoEm) return null;
  return formatDateKeyLocal(parseDateOnlyLocal(pendencia.ultimaMarcacaoEm));
}

function criarVerificadorDisponibilidade(semanaTemplate = [], horariosDiarios = null) {
  const diasComEstudoTemplate = new Set(
    (semanaTemplate || [])
      .filter((slot) => Number(slot?.minutosBrutoDia || slot?.minutosEstudo || 0) > 0)
      .map((slot) => Number(slot.dia))
      .filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6)
  );

  return (date) => {
    const diaSemana = startOfLocalDay(date).getDay();

    if (horariosDiarios) {
      const horas = Number(horariosDiarios[diaSemana] ?? horariosDiarios[String(diaSemana)] ?? 0);
      return horas > 0;
    }

    return diasComEstudoTemplate.has(diaSemana);
  };
}

export function calcularDataRevisaoAlocada(dataEstudo, intervaloDias, isDiaDisponivel = null) {
  const dataBase = addDaysLocal(dataEstudo, intervaloDias);

  if (typeof isDiaDisponivel !== 'function') {
    return dataBase;
  }

  const dataAgendada = new Date(dataBase);
  let guard = 0;

  while (!isDiaDisponivel(dataAgendada) && guard < 60) {
    dataAgendada.setDate(dataAgendada.getDate() + 1);
    guard += 1;
  }

  return startOfLocalDay(dataAgendada);
}

export function getWeekOffsetFromDate(dataInicio, dataRef = new Date()) {
  const ini = startOfLocalDay(dataInicio);
  const ref = startOfLocalDay(dataRef);
  return Math.max(0, Math.floor((ref - ini) / (7 * 86400000)));
}

// ─── 1. getRevisoesParaDia ────────────────────────────────────────────────────

/**
 * Retorna as revisões espaçadas devidas em uma data-alvo específica.
 *
 * @param {Date|string} dataAlvo       - Dia-alvo para verificar revisões.
 * @param {Array} historico            - Histórico de sessões de estudo já realizadas.
 * @param {Set<string>} assuntosDominados
 * @returns {Array<Object>} Slots de revisão devidos nesse dia.
 */
export function getRevisoesParaDia(
  dataAlvo,
  historico,
  assuntosDominados = new Set(),
  isDiaDisponivel = null,
  revisoesReagendadas = null
) {
  const alvo = _startOfDay(new Date(dataAlvo));
  const revisoes = [];
  const vistas = new Set(); // dedup: discId + assunto + intervaloDias

  for (const entrada of historico) {
    if (!entrada.assunto || !entrada.dataEstudo) continue;

    const chave = chaveAssuntoDominado(entrada.disciplinaId, entrada.assunto);
    if (assuntosDominados.has(chave)) continue;

    const dataEstudo = _startOfDay(new Date(entrada.dataEstudo));

    for (const dias of INTERVALOS_REVISAO) {
      const dataRevisaoOriginal = addDaysLocal(dataEstudo, dias);
      const dataRevisao = calcularDataRevisaoAlocada(dataEstudo, dias, isDiaDisponivel);
      const slotId = `rev-${entrada.disciplinaId}-${entrada.assunto}-d${dias}`;
      const override = getRevisaoOverride(revisoesReagendadas, slotId);
      const dataRevisaoEfetiva = override ? parseDateOnlyLocal(override.reagendadoPara) : dataRevisao;

      if (_startOfDay(dataRevisaoEfetiva).getTime() !== alvo.getTime()) continue;

      const dedupKey = `${entrada.disciplinaId}::${entrada.assunto}::${dias}`;
      if (vistas.has(dedupKey)) continue;
      vistas.add(dedupKey);

      revisoes.push({
        slotId,
        dia:             alvo.getDay(),
        hora:            entrada.hora ?? 8,
        ordemNoDia:      99,
        disciplinaId:    entrada.disciplinaId,
        disciplinaNome:  entrada.disciplinaNome ?? '',
        assunto:         entrada.assunto,
        assuntoOriginal: entrada.assunto,
        isRevisao:       true,
        isRevisaoAuto:   true,
        intervaloDias:   dias,
        dataOriginalRevisao: formatDateKeyLocal(dataRevisaoOriginal),
        dataAgendadaRevisao: formatDateKeyLocal(dataRevisaoEfetiva),
        reagendada:      Boolean(override),
        tempoMinutos:    0, // calculado pelo chamador via Elastic Cap
        nivel:           entrada.nivel ?? 'intermediario',
        pesoEfetivo:     entrada.pesoEfetivo ?? 1,
        concluido:       false,
      });
    }
  }

  return revisoes;
}

// ─── 2. getAgendaDia ─────────────────────────────────────────────────────────

/**
 * Retorna o array mesclado de slots de estudo + slots de revisão para um dia.
 *
 * [FIX-7] MODELO CORRETO DE ORÇAMENTO:
 *   O dia tem um orçamento bruto = minutosTeoriaDisponivel + minutosRevisaoDisponivel.
 *   - minutosTeoriaDisponivel  = bruto × 75% (já alocado nos slots de teoria pelo gerador)
 *   - minutosRevisaoDisponivel = bruto × 25% (reservado para revisões espaçadas)
 *
 *   A função NÃO redistribui o orçamento entre teoria e revisão.
 *   A função APENAS:
 *     1. Distribui minutosRevisaoDisponivel entre os slots de revisão do dia.
 *     2. Mantém os slots de teoria com seus minutosEstudo originais (sem recompressão).
 *
 *   Resultado: teoria + revisão ≤ bruto SEMPRE, sem compressão indevida.
 *
 * @param {number} dia                       - Índice do dia da semana (0=Dom…6=Sáb).
 * @param {Array}  slotsEstudoDia            - Slots de teoria do dia (gerados pelo template).
 * @param {Array}  revisoesDoDia             - Revisões espaçadas do dia.
 * @param {number} weekOffset                - Semana relativa ao início.
 * @param {number} tempoRevisaoMinutos       - Tempo padrão por slot de revisão (default 20).
 * @param {number} minutosRevisaoDisponivel  - Orçamento de revisão do dia (25% do bruto).
 *                                            Se não fornecido, usa BASE_CAP_REVISAO × soma_teoria.
 * @returns {Array<Object>} Slots do dia mesclados (teoria + revisão).
 */
export function getAgendaDia(
  dia,
  slotsEstudoDia,
  revisoesDoDia,
  weekOffset = 0,
  tempoRevisaoMinutos = 20,
  minutosRevisaoDisponivel = null,
  opcoes = {}
) {
  // minutosRevisaoDisponivel = limite desejado para revisao no dia.
  let minutosTeoriaOriginal = slotsEstudoDia.reduce(
    (acc, s) => acc + (s.minutosEstudo || 50), 0
  );
  const minutosBrutoDia = Number(slotsEstudoDia?.[0]?.minutosBrutoDia || 0) ||
    (minutosTeoriaOriginal > 0
      ? Math.max(minutosTeoriaOriginal, Math.round(minutosTeoriaOriginal / (1 - BASE_CAP_REVISAO)))
      : Math.round((minutosRevisaoDisponivel || 0) / BASE_CAP_REVISAO));

  const ajustarSlotsTeoriaAoOrcamento = (slots, tetoDia) => {
    const teto = Math.max(0, Number(tetoDia) || 0);
    if (teto <= 0) return [];

    const ajustados = slots.map((slot) => ({
      ...slot,
      tempoMinutos: Number(slot.minutosEstudo || slot.tempoMinutos || 0),
      minutosEstudo: Number(slot.minutosEstudo || slot.tempoMinutos || 0),
    }));

    let soma = ajustados.reduce((acc, slot) => acc + (slot.minutosEstudo || 0), 0);
    let guard = 0;

    while (soma > teto && guard < 2000) {
      guard += 1;
      const maior = ajustados
        .filter((slot) => (slot.minutosEstudo || 0) > 5)
        .sort((a, b) => (b.minutosEstudo || 0) - (a.minutosEstudo || 0))[0];
      if (!maior) break;
      maior.minutosEstudo -= 5;
      maior.tempoMinutos = maior.minutosEstudo;
      soma -= 5;
    }

    return ajustados.filter((slot) => (slot.minutosEstudo || 0) > 0);
  };

  const slotsTeoriaAjustados = ajustarSlotsTeoriaAoOrcamento(slotsEstudoDia, minutosBrutoDia);
  const slotsTeoriaBase = opcoes.expandirTeoriaAteBruto && revisoesDoDia.length === 0
    ? expandirSlotsTeoriaAteOrcamento(slotsTeoriaAjustados, minutosBrutoDia)
    : slotsTeoriaAjustados;

  minutosTeoriaOriginal = slotsTeoriaBase.reduce(
    (acc, s) => acc + (s.minutosEstudo || s.tempoMinutos || 0), 0
  );

  let orcamentoRevisao;
  if (minutosRevisaoDisponivel !== null && minutosRevisaoDisponivel > 0) {
    orcamentoRevisao = minutosRevisaoDisponivel;
  } else {
    orcamentoRevisao = Math.round(minutosTeoriaOriginal * (BASE_CAP_REVISAO / (1 - BASE_CAP_REVISAO)));
  }

  const arredondarRevisaoParaBaixo = (minutos) => Math.floor(Math.max(0, minutos) / 5) * 5;

  const tetoLivreNoDia = Math.max(0, minutosBrutoDia - minutosTeoriaOriginal);
  const tetoRevisaoPorTeoria = Math.max(0, minutosTeoriaOriginal);

  // Tempo necessario para revisoes respeitando limite, total do dia e teoria.
  const tempoNecessarioRevisao = revisoesDoDia.length * tempoRevisaoMinutos;
  const tetoRevisaoFinal = revisoesDoDia.length > 0 ? Math.min(
    tempoNecessarioRevisao,
    orcamentoRevisao,
    tetoLivreNoDia,
    tetoRevisaoPorTeoria
  ) : 0;

  const slotsTeoriaImutaveis = slotsTeoriaBase.map((slot) => {
    const minutosOriginais = Number(slot.minutosEstudo || slot.tempoMinutos || 0);
    return {
      ...slot,
      tempoMinutos: minutosOriginais,
      minutosEstudo: minutosOriginais,
    };
  });

  // Monta slots de revisao.
  let slotsRevisao = [];

  if (revisoesDoDia.length > 0 && tetoRevisaoFinal > 0) {
    let minutosRestantes = arredondarRevisaoParaBaixo(tetoRevisaoFinal);

    slotsRevisao = revisoesDoDia.map((r, index) => {
      const itensRestantes = revisoesDoDia.length - index;
      let tempoRev;

      if (index === revisoesDoDia.length - 1) {
        tempoRev = arredondarRevisaoParaBaixo(minutosRestantes);
      } else {
        const quotaBruta = itensRestantes > 0 ? minutosRestantes / itensRestantes : 0;
        tempoRev = arredondarRevisaoParaBaixo(quotaBruta);
      }

      minutosRestantes = Math.max(0, minutosRestantes - tempoRev);
      return { ...r, tempoMinutos: tempoRev };
    });

    if (minutosRestantes > 0 && slotsRevisao.length > 0) {
      const ultimoIndex = slotsRevisao.length - 1;
      slotsRevisao[ultimoIndex] = {
        ...slotsRevisao[ultimoIndex],
        tempoMinutos: (slotsRevisao[ultimoIndex].tempoMinutos || 0) + arredondarRevisaoParaBaixo(minutosRestantes),
      };
    }
    slotsRevisao = slotsRevisao.filter((slot) => (slot.tempoMinutos || 0) > 0);
  }

  return [...slotsTeoriaImutaveis, ...slotsRevisao];
}

// --- 3. getAgendaSemana ───────────────────────────────────────────────────────

/**
 * Gera a agenda completa de uma semana, compatível com a assinatura anterior
 * de useCronogramaSystem.getAgendaSemana().
 *
 * CORREÇÕES:
 *   [FIX-2] Cada slot tem sua dataSlot comparada com o dataInicio real:
 *           slots cujo dataSlot < dataInicio são descartados. Assim,
 *           retroceder semanas nunca exibe estudos antes da criação.
 *
 *   [FIX-2+] semanaAtualInicio é garantido >= dataInicioDate para que
 *            weekOffset=0 com dataInicio numa quarta-feira não volte para
 *            o domingo da mesma semana.
 *
 *   [FIX-4] weekOffset negativo retorna [] imediatamente.
 *
 *   [FIX-7] getAgendaDia agora recebe minutosRevisaoReservados (25% do bruto)
 *           extraído dos metadados do slot — não mais o bruto total.
 *           Isso garante que revisão + teoria ≤ bruto do dia.
 *
 * @param {Object} cronograma            - Objeto persistido no Firestore.
 * @param {number} weekOffset            - Semana relativa ao início do cronograma.
 *                                         0 = semana do dataInicio.
 *                                         Negativo: retorna [] (sem dados).
 * @param {Array}  [historicoOpcional]   - Histórico externo; se omitido, é reconstruído.
 * @param {Set}    [dominadosOpcional]   - Set de chaves de assuntos dominados.
 * @param {Object} [horariosDiarios]     - Horas disponíveis por dia (chave 0-6).
 * @returns {Array<Object>} Array de slots (estudo + revisão) da semana.
 */
export function getAgendaSemana(
  cronograma,
  weekOffset,
  historicoOpcional = null,
  dominadosOpcional = null,
  horariosDiarios = null
) {
  if (!cronograma?.semanaTemplate?.length) return [];

  // [FIX-4] Protege contra weekOffset negativo: nunca há dados antes do início
  if (weekOffset < 0) return [];

  const {
    semanaTemplate,
    disciplinasSnapshot   = [],
    progresso             = {},
    dataInicio,
  } = cronograma;
  const revisoesReagendadas = cronograma?.revisoesReagendadas || {};

  const semKey     = `w${weekOffset}`;
  const progressoW = progresso?.[semKey] || {};
  const progressoMinutosW = cronograma?.progressoMinutos?.[semKey] || {};
  const progressoRevisoesMinutos = cronograma?.progressoRevisoesMinutos || {};
  const revisoesDesmarcadas = cronograma?.revisoesDesmarcadas || {};

  // ── Assuntos dominados ─────────────────────────────────────────────────────
  const dominados = dominadosOpcional instanceof Set
    ? dominadosOpcional
    : new Set(Object.keys(progresso?.dominios || {}));

  // ── Datas de referência ────────────────────────────────────────────────────
  const dataInicioDate = dataInicio ? parseDateOnlyLocal(dataInicio) : new Date();

  // [FIX-2] Data mínima permitida: nenhum slot pode ser exibido antes disso.
  const dataInicioMidnight = _startOfDay(dataInicioDate);

  // [FIX-2+] A semana N começa exatamente dataInicio + N*7 dias.
  const semanaAtualInicio = new Date(dataInicioDate);
  semanaAtualInicio.setDate(semanaAtualInicio.getDate() + weekOffset * 7);

  // Defesa extra: nunca começa antes de dataInicio
  if (_startOfDay(semanaAtualInicio) < dataInicioMidnight) {
    semanaAtualInicio.setTime(dataInicioDate.getTime());
  }

  // ── Helper [FIX-5]: converte dia-da-semana ABSOLUTO (0=Dom…6=Sáb) para a
  // data real dentro da semana que começa em `inicioSemana`.
  const _dataDoSlotNaSemana = (inicioSemana, diaSemanaAbsoluto) => {
    const diaInicio = inicioSemana.getDay();
    let delta = diaSemanaAbsoluto - diaInicio;
    if (delta < 0) delta += 7;
    const d = new Date(inicioSemana);
    d.setDate(d.getDate() + delta);
    return d;
  };

  const pendingReplacementByDisciplina = new Map();

  // ── 1. Montar slots de ESTUDO com assunto e progresso ─────────────────────
  const agendaEstudo = semanaTemplate.map((slot) => {
    const disc     = disciplinasSnapshot.find((d) => d.id === slot.disciplinaId);
    const assuntos = normalizarAssuntosAgenda(disc?.assuntos || []);

    const topicIdx  = weekOffset * (slot.totalSlotsParaDisc || 1) + (slot.slotIndexParaDisc || 0);
    if (topicIdx >= assuntos.length) return null;

    // Suporte ao modoExibirAssuntos: se false (Modo Livre), não exibe o assunto específico
    const modoExibirAssuntos = cronograma.modoExibirAssuntos !== false;

    let assunto;
    if (!modoExibirAssuntos) {
      assunto = 'Estudo de Conteúdo';
    } else {
      assunto = assuntos[topicIdx] ?? `Tópico ${topicIdx + 1}`;
    }

    const progressoDisc = assuntos.length
      ? Math.min(100, Math.round((Math.min(topicIdx, assuntos.length) / assuntos.length) * 100))
      : 100;

    // [FIX-5] slot.dia é absoluto (0=Dom…6=Sáb), não offset. Usar helper.
    const dataSlot = _dataDoSlotNaSemana(semanaAtualInicio, slot.dia);

    const tempoPlanejado = slot.minutosEstudo || 50;
    const slotIdBase = slot.slotId;
    const concluido = progressoW[slotIdBase] === true || progressoW[slot.slotId] === true;
    const progressoMinutos = Number(progressoMinutosW[slotIdBase] || progressoMinutosW[slot.slotId] || 0);
    const disciplinaKey = normalizePendingKey(slot.disciplinaId);
    const pendenciaAtiva = getPendenciaTeoriaAtiva(cronograma, disciplinaKey);
    const assuntoOriginal = assunto;
    let isPendenciaTeoria = false;
    let origemPendencia = pendenciaAtiva?.origemSlotIdBase || null;

    if (
      pendenciaAtiva &&
      !concluido &&
      !pendingReplacementByDisciplina.has(disciplinaKey)
    ) {
      const skipDateKey = getPendenciaSkipDateKey(pendenciaAtiva);
      const isSameMarkedOccurrence =
        origemPendencia &&
        origemPendencia === slotIdBase &&
        skipDateKey &&
        skipDateKey === formatDateKeyLocal(dataSlot);

      if (!isSameMarkedOccurrence) {
        assunto = pendenciaAtiva.assunto || assunto;
        isPendenciaTeoria = true;
        pendingReplacementByDisciplina.set(disciplinaKey, {
          slotIdBase,
          dataSlot: formatDateKeyLocal(dataSlot),
        });
      }
    }

    return {
      ...slot,
      assunto,
      assuntoOriginal,
      isRevisao: false,
      isRevisaoAuto:    false,
      isPendenciaTeoria,
      origemPendenciaTeoriaSlotIdBase: origemPendencia,
      pendenciaTeoriaCriadoEm: pendenciaAtiva?.criadoEm || pendenciaAtiva?.ultimaMarcacaoEm || null,
      topicIdx,
      progressoDisc,
      totalTopicosDisc: assuntos.length,
      concluido,
      slotIdBase,
      tempoMinutos:     tempoPlanejado,
      progressoMinutos: concluido ? Math.max(progressoMinutos, tempoPlanejado) : progressoMinutos,
      dataSlot:         formatDateKeyLocal(dataSlot),
      dominado:         dominados.has(chaveAssuntoDominado(slot.disciplinaId, assunto)),
    };
  }).filter(Boolean);

  // ── 2. Construir histórico para revisão espaçada ───────────────────────────
  const historicoBase = historicoOpcional ?? _reconstruirHistorico(
    semanaTemplate,
    disciplinasSnapshot,
    weekOffset,
    dataInicioDate,
    dominados
  );

  // ── 3. Integrar historicoRevisoes no motor de repetição espaçada ───────────
  const historicoRevisoesMap = cronograma?.historicoRevisoes || {};
  const historico = historicoBase;

  // ── 4. Agrupar slots de estudo por dia ────────────────────────────────────
  const slotsPorDia = {};
  for (const s of agendaEstudo) {
    if (!slotsPorDia[s.dia]) slotsPorDia[s.dia] = [];
    slotsPorDia[s.dia].push(s);
  }
  const templateMetaPorDia = {};
  for (const slot of semanaTemplate) {
    if (!templateMetaPorDia[slot.dia]) {
      templateMetaPorDia[slot.dia] = slot;
    }
  }

  const tempoRevisaoMinutos = cronograma.tempoRevisaoMinutos ?? 20;
  const isDiaDisponivelRevisao = criarVerificadorDisponibilidade(semanaTemplate, horariosDiarios);

  const resultado = [];

  // [FIX-5] Itera pelos 7 dias absolutos da semana (0=Dom…6=Sáb)
  // [FIX-7] Extrai minutosRevisaoReservados do primeiro slot do dia (metadado do template)
  //         ou calcula como 25% do bruto via horariosDiarios.
  for (let diaAbsoluto = 0; diaAbsoluto <= 6; diaAbsoluto++) {
    const slotsEstudoDia = slotsPorDia[diaAbsoluto] || [];

    // [FIX-5] Data real do dia absoluto na semana atual
    const dataAlvoDia = _dataDoSlotNaSemana(semanaAtualInicio, diaAbsoluto);
    dataAlvoDia.setHours(0, 0, 0, 0);

    // [FIX-2] BLOQUEIO: não exibe nenhum slot anterior à data de início.
    if (dataAlvoDia.getTime() < dataInicioMidnight.getTime()) {
      continue;
    }

    // [FIX-7] Calcular minutosRevisaoReservados (25% do bruto do dia).
    // Ordem de prioridade:
    //   1. horariosDiarios explícito (passado pelo Step5Preview com os valores do wizard)
    //   2. metadado do slot (minutosRevisaoReservados salvo pelo gerador)
    //   3. estimativa baseada na soma de teoria dos slots
    let minutosDisponiveisBruto = 0;
    let minutosRevisaoReservados = 0;

    if (horariosDiarios) {
      const horasConf = Number(
        horariosDiarios[diaAbsoluto] ?? horariosDiarios[String(diaAbsoluto)] ?? 0
      );
      minutosDisponiveisBruto  = Math.round(horasConf * 60);
      minutosRevisaoReservados = Math.floor(minutosDisponiveisBruto * 0.25);
    } else if (slotsEstudoDia.length > 0 && slotsEstudoDia[0].minutosRevisaoReservados != null) {
      // Metadado salvo pelo gerador (index.js): cada slot carrega o orçamento de revisão do dia
      minutosRevisaoReservados = slotsEstudoDia[0].minutosRevisaoReservados;
      minutosDisponiveisBruto  = slotsEstudoDia[0].minutosBrutoDia ?? 0;
    } else if (templateMetaPorDia[diaAbsoluto]?.minutosRevisaoReservados != null) {
      minutosRevisaoReservados = templateMetaPorDia[diaAbsoluto].minutosRevisaoReservados;
      minutosDisponiveisBruto  = templateMetaPorDia[diaAbsoluto].minutosBrutoDia ?? 0;
    } else {
      // Fallback: soma de teoria ÷ 75% × 25% = soma × (1/3)
      const somaTeoria = slotsEstudoDia.reduce((acc, s) => acc + (s.minutosEstudo || 50), 0);
      minutosDisponiveisBruto  = Math.round(somaTeoria / 0.75);
      minutosRevisaoReservados = Math.round(minutosDisponiveisBruto * 0.25);
    }

    // BLOQUEIO ABSOLUTO: dia sem tempo disponível não recebe nenhum slot.
    if (minutosDisponiveisBruto <= 0) {
      continue;
    }

    // Filtra entradas da semana atual que ocorreram ANTES desse dia
    const historicoFiltrado = historico.filter((h) => {
      if (!h._semanaAtual) return true;
      const dEstudo = _startOfDay(new Date(h.dataEstudo));
      return dEstudo.getTime() < dataAlvoDia.getTime();
    });

    const dataSlotStr = formatDateKeyLocal(dataAlvoDia);

    const revisoesDoDia = getRevisoesParaDia(
      dataAlvoDia,
      historicoFiltrado,
      dominados,
      isDiaDisponivelRevisao,
      revisoesReagendadas
    ).map((r) => {
      const progressoRevisao = Number(progressoRevisoesMinutos?.[r.slotId] || 0);
      const tempoPlanejado = Number(r.tempoMinutos || r.minutosEstudo || tempoRevisaoMinutos || 0);
      const historicoRevisao = historicoRevisoesMap?.[r.slotId] || null;
      return {
        ...r,
        progressoMinutos: progressoRevisao,
        bloqueiaDesmarcar: historicoRevisao?.origem === 'registro_manual' && tempoPlanejado > 0 && progressoRevisao >= tempoPlanejado,
        concluido: revisoesDesmarcadas?.[r.slotId] === true
          ? false
          : progressoW[r.slotId] === true || Boolean(historicoRevisao?.dataConclusao),
        dataSlot:  dataSlotStr,
        weekOffset,
      };
    });

    if (slotsEstudoDia.length === 0 && revisoesDoDia.length === 0) {
      continue;
    }

    // No primeiro dia do cronograma, não há revisões espaçadas de estudos passados
    const isDiaZero = weekOffset === 0 && dataSlotStr === dataInicio;
    const revisoesEfetivas = isDiaZero ? [] : revisoesDoDia;

    // [FIX-7] Passa minutosRevisaoReservados (não o bruto) para getAgendaDia
    const slotsDia = getAgendaDia(
      diaAbsoluto,
      slotsEstudoDia,
      revisoesEfetivas,
      weekOffset,
      tempoRevisaoMinutos,
      minutosRevisaoReservados,  // ← [FIX-7] orçamento CORRETO de revisão (25% do bruto)
      { expandirTeoriaAteBruto: isDiaZero }
    ).map((s) => {
      const progressoRevisao = s.isRevisaoAuto ? Number(progressoRevisoesMinutos?.[s.slotId] || s.progressoMinutos || 0) : 0;
      const tempoPlanejado = Number(s.tempoMinutos || s.minutosEstudo || 0);
      const revisaoFoiDesmarcada = s.isRevisaoAuto && revisoesDesmarcadas?.[s.slotId] === true;
      const bloqueiaDesmarcar = s.isRevisaoAuto && (
        s.bloqueiaDesmarcar
        || (historicoRevisoesMap?.[s.slotId]?.origem === 'registro_manual' && tempoPlanejado > 0 && progressoRevisao >= tempoPlanejado)
      );
      return {
        ...s,
        ...(s.isRevisaoAuto ? {
          progressoMinutos: revisaoFoiDesmarcada ? progressoRevisao : (s.concluido ? Math.max(progressoRevisao, tempoPlanejado) : progressoRevisao),
          concluido: revisaoFoiDesmarcada ? false : (s.concluido || (tempoPlanejado > 0 && progressoRevisao >= tempoPlanejado)),
          bloqueiaDesmarcar,
        } : {}),
        dataSlot: s.dataSlot || dataSlotStr,
        weekOffset,
      };
    });

    resultado.push(...slotsDia);
  }

  return resultado;
}

export function getCronogramaReviewBuckets(cronograma, dataHoje = new Date(), horariosDiarios = null) {
  const vazio = { hoje: [], atrasadas: [], proximas: [], weekOffsetAtual: 0 };
  if (!cronograma?.semanaTemplate?.length || !cronograma?.dataInicio) return vazio;

  const hoje = startOfLocalDay(dataHoje);
  const em7dias = startOfLocalDay(dataHoje);
  em7dias.setDate(em7dias.getDate() + 7);
  const horariosValidos = horariosDiarios && Object.keys(horariosDiarios).length > 0
    ? horariosDiarios
    : null;

  const weekOffsetAtual = getWeekOffsetFromDate(cronograma.dataInicio, hoje);
  const atrasadas = (getRevisoesAtrasadas(cronograma, hoje) || []).map((slot) => {
    const dataSlot = startOfLocalDay(slot.dataSlot || slot.dataOriginal || hoje);
    return {
      ...slot,
      dataSlot,
      weekOffset: getWeekOffsetFromDate(cronograma.dataInicio, dataSlot),
    };
  });

  const hojeSlots = [];
  const proximas = [];
  const vistos = new Set();

  for (let w = weekOffsetAtual; w <= weekOffsetAtual + 1; w++) {
    const agenda = getAgendaSemana(cronograma, w, null, null, horariosValidos);
    if (!agenda?.length) continue;

    for (const slot of agenda) {
      if (!slot.isRevisaoAuto) continue;

      const dataSlot = startOfLocalDay(slot.data || slot.dataSlot);
      const chave = `${slot.slotId}::${formatDateKeyLocal(dataSlot)}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);

      if (dataSlot.getTime() === hoje.getTime()) {
        hojeSlots.push({ ...slot, dataSlot });
      } else if (dataSlot > hoje && dataSlot <= em7dias) {
        proximas.push({ ...slot, dataSlot });
      }
    }
  }

  proximas.sort((a, b) => a.dataSlot - b.dataSlot);

  return {
    hoje: hojeSlots,
    atrasadas,
    proximas,
    weekOffsetAtual,
  };
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

/** Normaliza uma Date para meia-noite (sem mutação). */
function _startOfDay(date) {
  return startOfLocalDay(date);
}

/**
 * Reconstrói o histórico de sessões de estudo a partir do semanaTemplate,
 * varrendo semanas anteriores E a semana atual (até o dia anterior ao alvo).
 *
 * [FIX-1] CORREÇÃO CRÍTICA: O cálculo do início de cada semana passada agora
 * parte de dataInicioDate + semAnt*7 dias — sem o .getDay() que antes âncora
 * no domingo da semana local, gerando datas incorretas e revisões para datas
 * anteriores à criação do cronograma.
 *
 * [FIX-3] Registra TODAS as sessões do template, mesmo quando topicIdx >=
 * assuntos.length (disciplinas que já ciclam os assuntos via índice circular),
 * para que revisões de sessões "pós-esgotamento" sejam detectadas corretamente.
 */
// [FIX-5] Versão estática do helper (sem closure) para uso em _reconstruirHistorico.
function _dataDoSlotNaSemanaEstatica(inicioSemana, diaSemanaAbsoluto) {
  const diaInicio = inicioSemana.getDay();
  let delta = diaSemanaAbsoluto - diaInicio;
  if (delta < 0) delta += 7;
  const d = new Date(inicioSemana);
  d.setDate(d.getDate() + delta);
  return d;
}

function _reconstruirHistorico(
  semanaTemplate,
  disciplinasSnapshot,
  weekOffsetAtual,
  dataInicioDate,
  dominados,
) {
  const maxIntervalo       = Math.max(...INTERVALOS_REVISAO);
  const semanasNecessarias = Math.ceil(maxIntervalo / 7) + 2;
  const semanasAVerificar  = Math.min(weekOffsetAtual, semanasNecessarias);

  const historico = [];

  // 1) Semanas passadas completas
  for (let i = 1; i <= semanasAVerificar; i++) {
    const semAnt = weekOffsetAtual - i;
    if (semAnt < 0) break;

    // [FIX-1] Início correto: dataInicio + semAnt*7 dias (sem ancorar no domingo)
    const inicioSemAnt = new Date(dataInicioDate);
    inicioSemAnt.setDate(inicioSemAnt.getDate() + semAnt * 7);

    for (const slot of semanaTemplate) {
      const disc      = disciplinasSnapshot.find((d) => d.id === slot.disciplinaId);
      const assuntos  = normalizarAssuntosAgenda(disc?.assuntos || []);
      const topicIdx  = semAnt * (slot.totalSlotsParaDisc || 1) + (slot.slotIndexParaDisc || 0);

      const isPostEsgotamento = topicIdx >= assuntos.length;
      if (isPostEsgotamento) continue;

      const assuntoUsado = assuntos[topicIdx] ?? `Tópico ${topicIdx + 1}`;

      if (!assuntoUsado) continue;

      const chave = chaveAssuntoDominado(slot.disciplinaId, assuntoUsado);
      if (dominados.has(chave)) continue;

      // [FIX-5] slot.dia é absoluto (0=Dom…6=Sáb): usa helper para data correta
      const dataEstudo = _dataDoSlotNaSemanaEstatica(inicioSemAnt, slot.dia);

      historico.push({
        disciplinaId:   slot.disciplinaId,
        disciplinaNome: slot.disciplinaNome,
        assunto:        assuntoUsado,
        dataEstudo,
        hora:           slot.hora,
        nivel:          slot.nivel ?? normalizarNivel(disc?.nivel),
        pesoEfetivo:    slot.pesoEfetivo,
      });
    }
  }

  // 2) Semana atual: inclui dias anteriores ao dia-alvo para revisões +1d
  // [FIX-1] Mesmo ajuste: parte de dataInicioDate + weekOffsetAtual*7
  const inicioSemAtual = new Date(dataInicioDate);
  inicioSemAtual.setDate(inicioSemAtual.getDate() + weekOffsetAtual * 7);

  for (const slot of semanaTemplate) {
    const disc      = disciplinasSnapshot.find((d) => d.id === slot.disciplinaId);
    const assuntos  = normalizarAssuntosAgenda(disc?.assuntos || []);
    const topicIdx  = weekOffsetAtual * (slot.totalSlotsParaDisc || 1) + (slot.slotIndexParaDisc || 0);

    const isPostEsgotamento = topicIdx >= assuntos.length;
    if (isPostEsgotamento) continue;

    const assuntoUsado = assuntos[topicIdx] ?? `Tópico ${topicIdx + 1}`;

    if (!assuntoUsado) continue;

    const chave = chaveAssuntoDominado(slot.disciplinaId, assuntoUsado);
    if (dominados.has(chave)) continue;

    // [FIX-5] slot.dia é absoluto (0=Dom…6=Sáb): usa helper para data correta
    const dataEstudo = _dataDoSlotNaSemanaEstatica(inicioSemAtual, slot.dia);

    historico.push({
      disciplinaId:   slot.disciplinaId,
      disciplinaNome: slot.disciplinaNome,
      assunto:        assuntoUsado,
      dataEstudo,
      hora:           slot.hora,
      nivel:          slot.nivel ?? normalizarNivel(disc?.nivel),
      pesoEfetivo:    slot.pesoEfetivo,
      _semanaAtual:   true,
    });
  }

  return historico;
}

// ─── 4. getRevisoesAtrasadas ───────────────────────────────────────────────────

/**
 * Mapeia e retorna exclusivamente as revisões atrasadas nos últimos 30 dias.
 *
 * [FIX-1] Usa o mesmo _reconstruirHistorico corrigido, portanto as datas
 * dos estudos passados agora batem com as datas reais do cronograma.
 *
 * @param {Object} cronograma - Objeto persistido no Firestore.
 * @param {Date|string} [dataHoje] - Data de referência (default: hoje).
 * @returns {Array<Object>} Slots de revisão atrasados com metadados.
 */
export function getRevisoesAtrasadas(cronograma, dataHoje = null) {
  if (!cronograma?.semanaTemplate?.length || !cronograma?.dataInicio) return [];

  const hoje = _startOfDay(dataHoje ? parseDateOnlyLocal(dataHoje) : new Date());

  const {
    semanaTemplate,
    disciplinasSnapshot = [],
    progresso           = {},
    dataInicio,
  } = cronograma;
  const revisoesReagendadas = cronograma?.revisoesReagendadas || {};
  const historicoRevisoesMap = cronograma?.historicoRevisoes || {};
  const revisoesDesmarcadas = cronograma?.revisoesDesmarcadas || {};

  const dominados = new Set(Object.keys(progresso?.dominios || {}));
  const isDiaDisponivelRevisao = criarVerificadorDisponibilidade(semanaTemplate);

  const dataInicioDate = parseDateOnlyLocal(dataInicio);
  const hojeWeekOffset = _calcWeekOffset(dataInicioDate, hoje);

  const historicoBase = _reconstruirHistorico(
    semanaTemplate,
    disciplinasSnapshot,
    hojeWeekOffset,
    dataInicioDate,
    dominados,
  );

  const historico = historicoBase;

  const concluidosGlobal = new Set();
  for (const semKey of Object.keys(progresso)) {
    if (semKey === 'dominios') continue;
    const semData = progresso[semKey];
    if (typeof semData !== 'object') continue;
    for (const [slotId, done] of Object.entries(semData)) {
      if (done) concluidosGlobal.add(slotId);
    }
  }

  const atrasadasRaw = [];
  const windowDays = 30;

  // [FIX-2] Nao verifica dias antes do dataInicio/criacao real do cronograma.
  const dataInicioMidnight = _startOfDay(dataInicioDate);
  const dataCriacaoMidnight = getRecordCreatedDay(cronograma);
  const dataMinimaRevisao = dataCriacaoMidnight && dataCriacaoMidnight > dataInicioMidnight
    ? dataCriacaoMidnight
    : dataInicioMidnight;

  for (let i = 1; i <= windowDays; i++) {
    const diaAlvo = new Date(hoje);
    diaAlvo.setDate(diaAlvo.getDate() - i);

    if (_startOfDay(diaAlvo).getTime() < dataMinimaRevisao.getTime()) continue;

    const revisoesDoDia = getRevisoesParaDia(
      diaAlvo,
      historico,
      dominados,
      isDiaDisponivelRevisao,
      revisoesReagendadas
    );

    for (const rev of revisoesDoDia) {
      if (rev.isConsolidada) continue;

      const dataEstudoOrig = _estimarDataEstudo(rev, historico, isDiaDisponivelRevisao);
      if (dataEstudoOrig && dataEstudoOrig > diaAlvo) continue;

      const diasAtraso = Math.round((hoje.getTime() - diaAlvo.getTime()) / 86400000);
      const concluido = revisoesDesmarcadas?.[rev.slotId] === true
        ? false
        : concluidosGlobal.has(rev.slotId) || Boolean(historicoRevisoesMap?.[rev.slotId]?.dataConclusao);

      atrasadasRaw.push({
        ...rev,
        dataSlot:     formatDateKeyLocal(diaAlvo),
        dataOriginal: formatDateKeyLocal(diaAlvo),
        diasAtraso,
        concluido,
      });
    }
  }

  const seen = new Map();
  for (const rev of atrasadasRaw) {
    const key = `${rev.disciplinaId}::${rev.assunto}`;
    const atual = seen.get(key);
    if (
      !atual ||
      (atual.concluido && !rev.concluido) ||
      (Boolean(atual.concluido) === Boolean(rev.concluido) && rev.diasAtraso > atual.diasAtraso)
    ) {
      seen.set(key, rev);
    }
  }

  const resultado = Array.from(seen.values());
  resultado.sort((a, b) => b.diasAtraso - a.diasAtraso);

  return resultado;
}

// ─── Helpers privados para getRevisoesAtrasadas ───────────────────────────────

/** Calcula o weekOffset relativo a uma data-alvo. */
function _calcWeekOffset(dataInicio, dataAlvo) {
  const ini  = _startOfDay(dataInicio);
  const alvo = _startOfDay(dataAlvo);
  return Math.max(0, Math.floor((alvo - ini) / (7 * 86400000)));
}

/** Estima a data de estudo original de uma revisão a partir do slotId. */
function _estimarDataEstudo(rev, historico, isDiaDisponivel = null) {
  for (const h of historico) {
    if (!h.assunto || !h.dataEstudo) continue;
    if (h.disciplinaId !== rev.disciplinaId) continue;
    if (h.assunto !== rev.assunto) continue;

    const dataEstudo  = _startOfDay(new Date(h.dataEstudo));
    const dataRevisao = calcularDataRevisaoAlocada(dataEstudo, rev.intervaloDias, isDiaDisponivel);

    if (_startOfDay(dataRevisao).getTime() === _startOfDay(new Date(rev.dataSlot)).getTime()) {
      return dataEstudo;
    }
  }
  return null;
}
