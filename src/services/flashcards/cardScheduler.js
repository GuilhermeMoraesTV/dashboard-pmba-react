/**
 * @fileoverview Abstração e fábrica do CardScheduler para o domínio de Flashcards.
 * Fornece interface padronizada, suporte a múltiplos algoritmos e desacoplamento de estado.
 */

import { QUALITY_RATINGS, isValidQualityRating } from '../../contracts/flashcards.js';

const DAY_MINUTES = 24 * 60;
const DEFAULT_SCHEDULER_CONFIG = Object.freeze({
  learningStepsMinutes: Object.freeze([1, 10]),
  relearningStepsMinutes: Object.freeze([1, 10]),
  hardMinutes: 6,
  graduatingIntervalDays: 1,
  easyIntervalDays: 3,
});

function resolveSchedulerConfig(value = {}) {
  const steps = (candidate, fallback) => {
    const valid = Array.isArray(candidate) ? candidate.map(Number).filter((item) => Number.isFinite(item) && item > 0).map(Math.round) : [];
    return valid.length ? valid : [...fallback];
  };
  return {
    learningStepsMinutes: steps(value.learningStepsMinutes, DEFAULT_SCHEDULER_CONFIG.learningStepsMinutes),
    relearningStepsMinutes: steps(value.relearningStepsMinutes, DEFAULT_SCHEDULER_CONFIG.relearningStepsMinutes),
    hardMinutes: Math.max(1, Math.round(Number(value.hardMinutes) || DEFAULT_SCHEDULER_CONFIG.hardMinutes)),
    graduatingIntervalDays: Math.max(1, Number(value.graduatingIntervalDays) || DEFAULT_SCHEDULER_CONFIG.graduatingIntervalDays),
    easyIntervalDays: Math.max(1, Number(value.easyIntervalDays) || DEFAULT_SCHEDULER_CONFIG.easyIntervalDays),
  };
}

/**
 * Interface / Classe Base Abstrata para schedulers de repetição espaçada.
 * @abstract
 */
export class CardScheduler {
  /**
   * @param {string} algorithm Identificador único do algoritmo (ex: 'sm2', 'fsrs').
   * @param {number} version Versão do algoritmo.
   */
  constructor(algorithm, version = 1) {
    if (this.constructor === CardScheduler) {
      throw new Error('CardScheduler e uma classe abstrata e nao pode ser instanciada diretamente.');
    }
    this.algorithm = algorithm;
    this.version = version;
  }

  /**
   * Cria o estado matemático inicial para um novo card.
   * @param {Record<string, any>} [_options] Parâmetros de customização opcionais.
   * @returns {import('../../contracts/flashcards.js').OpaqueSchedulerState}
   */
  createInitialState(_options = {}) {
    throw new Error('Metodo createInitialState deve ser implementado pela subclasse.');
  }

  /**
   * Processa uma avaliação de qualidade e calcula o próximo agendamento.
   * @param {import('../../contracts/flashcards.js').OpaqueSchedulerState} _currentState Estado opaco atual.
   * @param {import('../../contracts/flashcards.js').QualityRating} _rating Avaliação ('again' | 'hard' | 'good' | 'easy').
   * @param {{ now?: string | Date }} [_options] Parâmetros de contexto temporal.
   * @returns {import('../../contracts/flashcards.js').SchedulerOutput}
   */
  schedule(_currentState, _rating, _options = {}) {
    throw new Error('Metodo schedule deve ser implementado pela subclasse.');
  }

  /**
   * Calcula previamente a projeção de agendamento para as 4 classificações sem efeitos colaterais.
   * @param {import('../../contracts/flashcards.js').OpaqueSchedulerState} currentState Estado opaco atual.
   * @param {{ now?: string | Date }} [options] Parâmetros de contexto temporal.
   * @returns {import('../../contracts/flashcards.js').SchedulerPreview}
   */
  preview(currentState, options = {}) {
    /** @type {Partial<import('../../contracts/flashcards.js').SchedulerPreview>} */
    const previewMap = {};
    for (const rating of QUALITY_RATINGS) {
      previewMap[rating] = this.schedule(currentState, rating, options);
    }
    return /** @type {import('../../contracts/flashcards.js').SchedulerPreview} */ (previewMap);
  }

  /**
   * Verifica se o card está vencido para revisão com base na data alvo.
   * @param {{ dueAt: string | Date } | import('../../contracts/flashcards.js').OpaqueSchedulerState} cardOrState
   * @param {string | Date} [targetDate] Data de corte (padrão: agora).
   * @returns {boolean}
   */
  isDue(cardOrState, targetDate = new Date()) {
    if (!cardOrState) return false;
    const target = targetDate instanceof Date ? targetDate.getTime() : new Date(targetDate).getTime();
    if (Number.isNaN(target)) return false;

    // Se receber o card completo com dueAt
    if ('dueAt' in cardOrState && cardOrState.dueAt) {
      const due = cardOrState.dueAt instanceof Date ? cardOrState.dueAt.getTime() : new Date(cardOrState.dueAt).getTime();
      return !Number.isNaN(due) && due <= target;
    }

    return false;
  }
}

/**
 * Implementação concreta do SM-2 v2 com learning/relearning intradiário.
 *
 * Este algoritmo é uma adaptação determinística do SM-2 de Piotr Wozniak, com ratings
 * semânticos 'again'/'hard'/'good'/'easy' em vez da escala numérica original (0-5).
 *
 * Estados v1 seguem legíveis e são migrados de forma preguiçosa no próximo rating.
 */
export class SM2CardScheduler extends CardScheduler {
  /** @private @type {number} */
  static MIN_EASE_FACTOR = 1.3;

  /** @private @type {number} */
  static INITIAL_EASE_FACTOR = 2.5;

  constructor() {
    super('sm2', 2);
  }

  /**
   * Cria o estado matemático inicial para um novo card.
   * @override
   * @param {Record<string, any>} [_options]
   * @returns {import('../../contracts/flashcards.js').OpaqueSchedulerState}
   */
  createInitialState(options = {}) {
    const config = resolveSchedulerConfig(options.scheduler || options);
    return {
      algorithm: this.algorithm,
      version: 2,
      data: {
        repetition: 0,
        interval: 0,
        easeFactor: SM2CardScheduler.INITIAL_EASE_FACTOR,
        phase: 'learning',
        stepIndex: 0,
        ...config,
      },
    };
  }

  /**
   * Processa uma avaliação e calcula o próximo agendamento SM-2.
   *
   * Cards em learning/relearning usam minutos configuráveis; cards consolidados
   * continuam no cálculo diário do SM-2.
   *
   * @override
   * @param {import('../../contracts/flashcards.js').OpaqueSchedulerState} currentState
   * @param {import('../../contracts/flashcards.js').QualityRating} rating
   * @param {{ now?: string | Date }} [options]
   * @returns {import('../../contracts/flashcards.js').SchedulerOutput}
   */
  schedule(currentState, rating, options = {}) {
    if (!isValidQualityRating(rating)) {
      throw new Error(`Rating invalido fornecido ao scheduler: ${rating}`);
    }

    const now = options.now
      ? (options.now instanceof Date ? options.now : new Date(options.now))
      : new Date();

    if (Number.isNaN(now.getTime())) {
      throw new Error('Parametro "now" invalido no scheduler: data nao pode ser parseada.');
    }

    const data = currentState?.data || this.createInitialState().data;
    const config = resolveSchedulerConfig(data);
    const repetition = Number(data.repetition ?? 0);
    const intervalDays = Number(data.interval ?? 0);
    const easeFactor = Number(data.easeFactor ?? SM2CardScheduler.INITIAL_EASE_FACTOR);
    const phase = data.phase || (repetition >= 2 || intervalDays > 0 ? 'review' : 'learning');
    const makeResult = ({ nextRepetition, minutes, nextEaseFactor, nextPhase, stepIndex = 0, isLapse = false, status = nextPhase }) => {
      const intervalMinutes = Math.max(1, Number(minutes) || 1);
      return {
        nextState: {
          algorithm: this.algorithm,
          version: 2,
          data: {
            repetition: nextRepetition,
            interval: intervalMinutes / DAY_MINUTES,
            easeFactor: Math.max(SM2CardScheduler.MIN_EASE_FACTOR, nextEaseFactor),
            phase: nextPhase,
            stepIndex,
            ...config,
          },
        },
        intervalMinutes,
        intervalDays: intervalMinutes / DAY_MINUTES,
        dueAt: new Date(now.getTime() + intervalMinutes * 60 * 1000),
        isLapse,
        status,
      };
    };

    if (phase === 'learning' || phase === 'relearning') {
      const steps = phase === 'relearning' ? config.relearningStepsMinutes : config.learningStepsMinutes;
      const currentStep = Math.max(0, Math.min(Number(data.stepIndex || 0), steps.length - 1));
      if (rating === 'again') return makeResult({ nextRepetition: 0, minutes: steps[0], nextEaseFactor: easeFactor, nextPhase: phase, stepIndex: 0 });
      if (rating === 'hard') return makeResult({ nextRepetition: repetition, minutes: currentStep === 0 ? config.hardMinutes : Math.max(config.hardMinutes, steps[currentStep]), nextEaseFactor: easeFactor - 0.05, nextPhase: phase, stepIndex: currentStep });
      if (rating === 'easy') return makeResult({ nextRepetition: Math.max(2, repetition + 1), minutes: config.easyIntervalDays * DAY_MINUTES, nextEaseFactor: easeFactor + 0.15, nextPhase: 'review', status: 'review' });
      const nextStep = currentStep + 1;
      if (nextStep < steps.length) return makeResult({ nextRepetition: repetition + 1, minutes: steps[nextStep], nextEaseFactor: easeFactor, nextPhase: phase, stepIndex: nextStep });
      return makeResult({ nextRepetition: Math.max(2, repetition + 1), minutes: config.graduatingIntervalDays * DAY_MINUTES, nextEaseFactor: easeFactor, nextPhase: 'review', status: 'review' });
    }

    if (rating === 'again') {
      return makeResult({ nextRepetition: 0, minutes: config.relearningStepsMinutes[0], nextEaseFactor: easeFactor - 0.2, nextPhase: 'relearning', isLapse: true, status: 'relearning' });
    }
    if (rating === 'hard') return makeResult({ nextRepetition: repetition, minutes: Math.max(1, Math.round(Math.max(1, intervalDays) * 1.2)) * DAY_MINUTES, nextEaseFactor: easeFactor - 0.15, nextPhase: 'review', status: 'review' });
    if (rating === 'good') return makeResult({ nextRepetition: repetition + 1, minutes: Math.max(1, Math.round(Math.max(1, intervalDays) * easeFactor)) * DAY_MINUTES, nextEaseFactor: easeFactor, nextPhase: 'review', status: 'review' });
    return makeResult({ nextRepetition: repetition + 1, minutes: Math.max(1, Math.round(Math.max(1, intervalDays) * easeFactor * 1.3)) * DAY_MINUTES, nextEaseFactor: easeFactor + 0.15, nextPhase: 'review', status: 'review' });
  }
}

/**
 * Registro de schedulers disponíveis.
 * @type {Map<string, () => CardScheduler>}
 */
const schedulerRegistry = new Map([
  ['sm2', () => new SM2CardScheduler()],
]);

/**
 * Registra um novo algoritmo de scheduler na fábrica.
 * Permite extensibilidade futura (ex: FSRS).
 * @param {string} algorithm Nome identificador do algoritmo.
 * @param {() => CardScheduler} factory Função que instancia o scheduler.
 */
export function registerCardScheduler(algorithm, factory) {
  if (!algorithm || typeof factory !== 'function') {
    throw new Error('Parametros invalidos para registerCardScheduler.');
  }
  schedulerRegistry.set(algorithm.toLowerCase(), factory);
}

/**
 * Fábrica para obter uma instância do CardScheduler.
 * @param {string} [algorithm='sm2'] Algoritmo desejado.
 * @returns {CardScheduler}
 */
export function getCardScheduler(algorithm = 'sm2') {
  const normalized = String(algorithm || 'sm2').toLowerCase();
  const factory = schedulerRegistry.get(normalized);
  if (!factory) {
    throw new Error(`Algoritmo de CardScheduler nao suportado: ${algorithm}. Registrados: ${Array.from(schedulerRegistry.keys()).join(', ')}`);
  }
  return factory();
}
