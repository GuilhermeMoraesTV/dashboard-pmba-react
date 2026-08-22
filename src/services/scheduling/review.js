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
 *           SOLUÇÃO: getAgendaDia recebe o orçamento bruto e a reserva-base de
 *           revisão separadamente. Em dias carregados, a revisão pode crescer
 *           em blocos de 5min até 60min, e a teoria é reajustada dentro do
 *           restante disponível. SOMA = teoria + revisão ≤ bruto SEMPRE.
 */

import {
  INTERVALOS_REVISAO,
  BASE_CAP_REVISAO,
  chaveAssuntoDominado,
  normalizarNivel,
} from './core.js';

const MIN_MINUTOS_REVISAO_AGENDADA = 5;
const MAX_MINUTOS_REVISAO_DIA = 60;

function calcularCapacidadeRevisaoDia({
  quantidadeRevisoes,
  limiteBaseMinutos,
  minutosBrutoDia,
  minutosTeoriaDisponivel = null,
}) {
  const quantidade = Math.max(0, Number(quantidadeRevisoes) || 0);
  if (quantidade === 0) return { tetoMinutos: 0, capacidade: 0 };

  const limiteBase = Math.min(
    MAX_MINUTOS_REVISAO_DIA,
    Math.max(0, Number(limiteBaseMinutos) || 20),
  );
  const necessidade = quantidade * MIN_MINUTOS_REVISAO_AGENDADA;
  const metadeDoDia = Math.floor(Math.max(0, Number(minutosBrutoDia) || 0) / 2);
  const limitePelaTeoria = minutosTeoriaDisponivel == null
    ? metadeDoDia
    : Math.max(0, Number(minutosTeoriaDisponivel) || 0);
  const limiteOperacional = Math.min(
    MAX_MINUTOS_REVISAO_DIA,
    metadeDoDia,
    limitePelaTeoria,
  );
  const tetoMinutos = Math.min(
    Math.max(limiteBase, Math.min(necessidade, MAX_MINUTOS_REVISAO_DIA)),
    limiteOperacional,
  );

  return {
    tetoMinutos,
    capacidade: Math.max(0, Math.floor(tetoMinutos / MIN_MINUTOS_REVISAO_AGENDADA)),
  };
}

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

function expandirSlotsTeoriaAteOrcamento(slots, tetoDia, duracaoMaximaBlocoMinutos = null, preservarDuracaoUnica = false) {
  const teto = Math.floor(Math.max(0, Number(tetoDia) || 0));
  if (teto <= 0 || !slots?.length) return slots;

  const normalizados = slots.map((slot) => ({
    ...slot,
    tempoMinutos: Number(slot.minutosEstudo || slot.tempoMinutos || 0),
    minutosEstudo: Number(slot.minutosEstudo || slot.tempoMinutos || 0),
  }));

  const somaAtual = normalizados.reduce((acc, slot) => acc + (slot.minutosEstudo || 0), 0);
  if (somaAtual >= teto || somaAtual <= 0) return normalizados;

  const duracaoMaxima = Math.max(5, Math.floor((Number(duracaoMaximaBlocoMinutos) || teto) / 5) * 5);
  if (preservarDuracaoUnica) {
    let restante = teto;
    return normalizados
      .map((slot) => {
        const minutos = Math.min(duracaoMaxima, restante);
        restante = Math.max(0, restante - minutos);
        return { ...slot, tempoMinutos: minutos, minutosEstudo: minutos };
      })
      .filter((slot) => slot.minutosEstudo > 0);
  }

  const linhas = normalizados.map((slot, index) => ({
    index,
    peso: Math.max(1, Number(slot.pesoEfetivo) || 1),
    minutos: Math.min(duracaoMaxima, Math.max(5, Math.floor((slot.minutosEstudo || 0) / 5) * 5)),
    acrescimos: 0,
  }));
  const tetoDistribuivel = Math.min(teto, linhas.length * duracaoMaxima);
  let restante = tetoDistribuivel - linhas.reduce((acc, linha) => acc + linha.minutos, 0);

  // Usa os pesos de conhecimento/importância para ocupar o tempo livre sem
  // transformar todos os blocos no mesmo teto. Cada passo de 5 minutos vai
  // para a maior necessidade relativa que ainda tenha espaço.
  let guard = 0;
  while (restante >= 5 && guard < 2000) {
    guard += 1;
    const receptor = linhas
      .filter((linha) => linha.minutos + 5 <= duracaoMaxima)
      .sort((a, b) => (
        (b.peso / (b.acrescimos + 1)) - (a.peso / (a.acrescimos + 1))
        || a.minutos - b.minutos
        || a.index - b.index
      ))[0];
    if (!receptor) break;
    receptor.minutos += 5;
    receptor.acrescimos += 1;
    restante -= 5;
  }

  // Conserva tambem saldos que nao sejam multiplos de cinco. Isso evita que
  // uma disponibilidade fracionada perca de 1 a 4 minutos no preview.
  if (restante > 0) {
    const receptorResidual = linhas
      .filter((linha) => linha.minutos < duracaoMaxima)
      .sort((a, b) => b.peso - a.peso || a.minutos - b.minutos || a.index - b.index)[0];
    if (receptorResidual) {
      const acrescimo = Math.min(restante, duracaoMaxima - receptorResidual.minutos);
      receptorResidual.minutos += acrescimo;
      restante -= acrescimo;
    }
  }

  const minutosPorIndex = new Map(linhas.map((linha) => [linha.index, linha.minutos]));
  const resultado = normalizados.map((slot, index) => {
    const minutos = minutosPorIndex.get(index) || slot.minutosEstudo || slot.tempoMinutos || 0;
    return {
      ...slot,
      tempoMinutos: minutos,
      minutosEstudo: minutos,
    };
  });

  // Cronogramas antigos podem ter sido salvos com poucos slots para comportar
  // o total diario. Cria blocos residuais deterministas em vez de deixar o dia
  // incompleto ou ultrapassar o teto de uma sessao.
  let saldoSemCapacidade = teto - resultado.reduce((acc, slot) => acc + slot.minutosEstudo, 0);
  let extraIndex = 0;
  while (!preservarDuracaoUnica && saldoSemCapacidade > 0 && resultado.length > 0 && extraIndex < 100) {
    const origem = resultado
      .slice()
      .sort((a, b) => (Number(b.pesoEfetivo) || 1) - (Number(a.pesoEfetivo) || 1))[extraIndex % resultado.length];
    const minutos = Math.min(duracaoMaxima, saldoSemCapacidade);
    const sufixo = `-residual-${extraIndex + 1}`;
    resultado.push({
      ...origem,
      slotId: `${origem.slotId || origem.slotIdBase || 'slot'}${sufixo}`,
      slotIdBase: `${origem.slotIdBase || origem.slotId || 'slot'}${sufixo}`,
      ordemNoDia: Number(origem.ordemNoDia || 0) + extraIndex + 1,
      tempoMinutos: minutos,
      minutosEstudo: minutos,
      isBlocoResidual: true,
    });
    saldoSemCapacidade -= minutos;
    extraIndex += 1;
  }

  return resultado;
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
 *   A função distribui o orçamento entre teoria e revisão de forma adaptativa:
 *     1. Cada tópico de revisão recebe 5 minutos úteis.
 *     2. A revisão cresce até 60 minutos quando a fila exigir.
 *     3. A teoria ocupa o restante sem ultrapassar o orçamento bruto do dia.
 *
 *   Resultado: teoria + revisão ≤ bruto SEMPRE, sem compressão indevida.
 *
 * @param {number} dia                       - Índice do dia da semana (0=Dom…6=Sáb).
 * @param {Array}  slotsEstudoDia            - Slots de teoria do dia (gerados pelo template).
 * @param {Array}  revisoesDoDia             - Revisões espaçadas do dia.
 * @param {number} weekOffset                - Semana relativa ao início.
 * @param {number} tempoRevisaoMinutos       - Limite total de revisão no dia (default 20).
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
  const slotsTeoriaBase = slotsTeoriaAjustados;

  minutosTeoriaOriginal = slotsTeoriaBase.reduce(
    (acc, s) => acc + (s.minutosEstudo || s.tempoMinutos || 0), 0
  );

  // O valor escolhido representa um limite-base diario. Quando a fila cresce,
  // a revisao aumenta em blocos reais de 5min, ate 60min, sem ocupar mais da
  // metade do tempo disponivel no dia.
  const { capacidade: capacidadeRevisoesDia } = calcularCapacidadeRevisaoDia({
    quantidadeRevisoes: revisoesDoDia.length,
    limiteBaseMinutos: tempoRevisaoMinutos,
    minutosBrutoDia,
  });

  // Monta slots de revisao.
  let slotsRevisao = [];

  if (revisoesDoDia.length > 0 && capacidadeRevisoesDia > 0) {
    slotsRevisao = revisoesDoDia
      .slice(0, capacidadeRevisoesDia)
      .map((r) => ({ ...r, tempoMinutos: MIN_MINUTOS_REVISAO_AGENDADA }));
  }

  const minutosRevisaoReal = slotsRevisao.reduce(
    (acc, slot) => acc + Number(slot.tempoMinutos || slot.minutosEstudo || 0),
    0
  );
  const tetoTeoriaFinal = Math.max(0, minutosBrutoDia - minutosRevisaoReal);
  const slotsTeoriaDentroDoTeto = ajustarSlotsTeoriaAoOrcamento(slotsTeoriaBase, tetoTeoriaFinal);
  const slotsTeoriaFinais = opcoes.expandirTeoriaAteBruto
    ? expandirSlotsTeoriaAteOrcamento(
      slotsTeoriaDentroDoTeto,
      tetoTeoriaFinal,
      opcoes.duracaoUnicaMinutos,
      opcoes.usarDuracaoUnica === true,
    )
    : slotsTeoriaDentroDoTeto;

  const slotsTeoriaNormalizados = slotsTeoriaFinais.map((slot) => {
    const minutosOriginais = Number(slot.minutosEstudo || slot.tempoMinutos || 0);
    return {
      ...slot,
      tempoMinutos: minutosOriginais,
      minutosEstudo: minutosOriginais,
    };
  });

  return [...slotsTeoriaNormalizados, ...slotsRevisao];
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
    const cicloConteudo = assuntos.length > 0 ? Math.floor(topicIdx / assuntos.length) : 0;

    // Um slot representa carga horaria da disciplina e nao pode desaparecer
    // apenas porque a primeira passagem pelos topicos terminou. Nas passagens
    // seguintes, o assunto volta como reforco/questoes e o orcamento diario e
    // preservado integralmente.
    let assunto = assuntos.length > 0
      ? assuntos[topicIdx % assuntos.length]
      : slot.assunto || 'Conteudo Base';

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
      isReforcoConteudo: cicloConteudo > 0,
      cicloConteudo,
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
  const filaRevisoesPendentes = [];

  const resultado = [];

  // A fila precisa sobreviver a viradas de semana. Comeca no primeiro periodo
  // coberto pelo historico reconstruido e simula os dias cronologicamente ate
  // a semana solicitada. Assim, um excedente de sabado reaparece no proximo dia
  // disponivel, mesmo quando esse dia pertence a outra semana do preview.
  const offsetsHistorico = historico
    .map((entrada) => Math.floor((_startOfDay(new Date(entrada.dataEstudo)) - dataInicioMidnight) / (7 * 86400000)))
    .filter((offset) => Number.isInteger(offset) && offset >= 0 && offset <= weekOffset);
  const primeiroOffsetProcessamento = offsetsHistorico.length > 0
    ? Math.min(...offsetsHistorico)
    : weekOffset;

  // [FIX-5] Itera os dias em ordem cronologica. O template guarda o dia
  // absoluto (0=Dom…6=Sab), mas a semana pode comecar em qualquer dia.
  // [FIX-7] Extrai minutosRevisaoReservados do primeiro slot do dia (metadado do template)
  //         ou calcula como 25% do bruto via horariosDiarios.
  for (let periodoOffset = primeiroOffsetProcessamento; periodoOffset <= weekOffset; periodoOffset++) {
    const inicioPeriodo = new Date(dataInicioDate);
    inicioPeriodo.setDate(inicioPeriodo.getDate() + periodoOffset * 7);
    const isSemanaAlvo = periodoOffset === weekOffset;
    const diasPeriodo = Array.from({ length: 7 }, (_, diaAbsoluto) => ({
      diaAbsoluto,
      dataAlvoDia: _startOfDay(_dataDoSlotNaSemana(inicioPeriodo, diaAbsoluto)),
    })).sort((a, b) => a.dataAlvoDia - b.dataAlvoDia);

    for (const { diaAbsoluto, dataAlvoDia } of diasPeriodo) {
      const slotsEstudoDia = isSemanaAlvo ? (slotsPorDia[diaAbsoluto] || []) : [];

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

    // Uma revisao so pode nascer depois do respectivo estudo. A verificacao
    // vale para qualquer periodo simulado, inclusive nas viradas de semana.
    const historicoFiltrado = historico.filter((h) => {
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

    if (slotsEstudoDia.length === 0 && revisoesDoDia.length === 0 && filaRevisoesPendentes.length === 0) {
      continue;
    }

    // No primeiro dia do cronograma, não há revisões espaçadas de estudos passados
    const isDiaZero = periodoOffset === 0 && dataSlotStr === dataInicio;
    const revisoesCandidatas = isDiaZero ? [] : [
      ...filaRevisoesPendentes.splice(0),
      ...revisoesDoDia,
    ];
    const { capacidade: capacidadeRevisoesDia } = calcularCapacidadeRevisaoDia({
      quantidadeRevisoes: revisoesCandidatas.length,
      limiteBaseMinutos: tempoRevisaoMinutos,
      minutosBrutoDia: minutosDisponiveisBruto,
    });
    const revisoesEfetivas = revisoesCandidatas
      .slice(0, capacidadeRevisoesDia)
      .map((revisao) => ({
        ...revisao,
        dataSlot: dataSlotStr,
        dataOriginalFila: revisao.dataOriginalFila || revisao.dataSlot || revisao.dataAgendadaRevisao || dataSlotStr,
        reagendadaPorFila: Boolean((revisao.dataSlot || revisao.dataAgendadaRevisao) && (revisao.dataSlot || revisao.dataAgendadaRevisao) !== dataSlotStr),
      }));
    filaRevisoesPendentes.push(...revisoesCandidatas.slice(capacidadeRevisoesDia));

    // Semanas anteriores sao processadas apenas para manter a fila integra.
    // Somente a semana solicitada deve compor o retorno publico da funcao.
    if (!isSemanaAlvo) {
      continue;
    }

    // [FIX-7] Passa minutosRevisaoReservados (não o bruto) para getAgendaDia
    const duracaoMinimaConfigurada = Number(cronograma.duracaoMinimaSessaoMinutos || 0);
    const duracaoMaximaConfigurada = Number(cronograma.duracaoMaximaSessaoMinutos || 0);
    const duracaoUnicaMinutos = cronograma.usarDuracaoUnica === true
      || (duracaoMinimaConfigurada > 0 && duracaoMinimaConfigurada === duracaoMaximaConfigurada)
      ? Number(cronograma.tempoSessaoMinutos || duracaoMaximaConfigurada || 0)
      : null;
    const duracaoMaximaBlocoMinutos = duracaoUnicaMinutos || duracaoMaximaConfigurada || null;

    const slotsDia = getAgendaDia(
      diaAbsoluto,
      slotsEstudoDia,
      revisoesEfetivas,
      weekOffset,
      tempoRevisaoMinutos,
      minutosRevisaoReservados,  // ← [FIX-7] orçamento CORRETO de revisão (25% do bruto)
      {
        // Dias reorganizados manualmente preservam exatamente os blocos
        // movidos. O preenchimento automático criaria clones residuais e
        // faria um único drop parecer uma duplicação do mesmo bloco.
        expandirTeoriaAteBruto: slotsEstudoDia.length > 0
          && !slotsEstudoDia.some((slot) => slot?.layoutManual === true),
        duracaoUnicaMinutos: duracaoMaximaBlocoMinutos,
        usarDuracaoUnica: Boolean(duracaoUnicaMinutos),
      }
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

      const assuntoUsado = assuntos.length > 0
        ? assuntos[topicIdx % assuntos.length]
        : slot.assunto || `Tópico ${topicIdx + 1}`;

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

    const assuntoUsado = assuntos.length > 0
      ? assuntos[topicIdx % assuntos.length]
      : slot.assunto || `Tópico ${topicIdx + 1}`;

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
