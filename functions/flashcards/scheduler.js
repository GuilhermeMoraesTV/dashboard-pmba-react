/**
 * @fileoverview Scheduler SM-2 com learning/relearning intradiario (schema v2).
 * Estados v1 continuam legiveis e sao migrados de forma preguicosa no proximo rating.
 */

const QUALITY_RATINGS = new Set(['again', 'hard', 'good', 'easy']);
const MIN_EASE_FACTOR = 1.3;
const INITIAL_EASE_FACTOR = 2.5;
const MINUTE_MS = 60 * 1000;
const DAY_MINUTES = 24 * 60;

const DEFAULT_SCHEDULER_CONFIG = Object.freeze({
  learningStepsMinutes: Object.freeze([1, 10]),
  relearningStepsMinutes: Object.freeze([1, 10]),
  hardMinutes: 6,
  graduatingIntervalDays: 1,
  easyIntervalDays: 3,
});

function positiveMinutes(values, fallback) {
  const normalized = Array.isArray(values)
    ? values.map(Number).filter((value) => Number.isFinite(value) && value > 0).map((value) => Math.round(value))
    : [];
  return normalized.length ? normalized : [...fallback];
}

function resolveConfig(value = {}) {
  return {
    learningStepsMinutes: positiveMinutes(value.learningStepsMinutes, DEFAULT_SCHEDULER_CONFIG.learningStepsMinutes),
    relearningStepsMinutes: positiveMinutes(value.relearningStepsMinutes, DEFAULT_SCHEDULER_CONFIG.relearningStepsMinutes),
    hardMinutes: Math.max(1, Math.round(Number(value.hardMinutes) || DEFAULT_SCHEDULER_CONFIG.hardMinutes)),
    graduatingIntervalDays: Math.max(1, Number(value.graduatingIntervalDays) || DEFAULT_SCHEDULER_CONFIG.graduatingIntervalDays),
    easyIntervalDays: Math.max(1, Number(value.easyIntervalDays) || DEFAULT_SCHEDULER_CONFIG.easyIntervalDays),
  };
}

function createInitialState(options = {}) {
  const config = resolveConfig(options.scheduler || options);
  return {
    algorithm: 'sm2',
    version: 2,
    data: {
      repetition: 0,
      interval: 0,
      easeFactor: INITIAL_EASE_FACTOR,
      phase: 'learning',
      stepIndex: 0,
      ...config,
    },
  };
}

function output({ data, repetition, intervalMinutes, easeFactor, phase, stepIndex, isLapse, status }) {
  const safeMinutes = Math.max(1, Number(intervalMinutes) || 1);
  const intervalDays = safeMinutes / DAY_MINUTES;
  return {
    nextState: {
      algorithm: 'sm2',
      version: 2,
      data: {
        repetition,
        interval: intervalDays,
        easeFactor: Math.max(MIN_EASE_FACTOR, easeFactor),
        phase,
        stepIndex,
        ...resolveConfig(data),
      },
    },
    intervalMinutes: safeMinutes,
    intervalDays,
    isLapse,
    status,
  };
}

function scheduleLearning(data, rating, phase) {
  const config = resolveConfig(data);
  const steps = phase === 'relearning' ? config.relearningStepsMinutes : config.learningStepsMinutes;
  const currentStep = Math.max(0, Math.min(Number(data.stepIndex || 0), steps.length - 1));
  const easeFactor = Number(data.easeFactor ?? INITIAL_EASE_FACTOR);
  const repetition = Number(data.repetition ?? 0);

  if (rating === 'again') {
    return output({ data, repetition: 0, intervalMinutes: steps[0], easeFactor, phase, stepIndex: 0, isLapse: false, status: phase });
  }
  if (rating === 'hard') {
    const minutes = currentStep === 0 ? config.hardMinutes : Math.max(config.hardMinutes, steps[currentStep]);
    return output({ data, repetition, intervalMinutes: minutes, easeFactor: Math.max(MIN_EASE_FACTOR, easeFactor - 0.05), phase, stepIndex: currentStep, isLapse: false, status: phase });
  }
  if (rating === 'easy') {
    return output({ data, repetition: Math.max(2, repetition + 1), intervalMinutes: config.easyIntervalDays * DAY_MINUTES, easeFactor: easeFactor + 0.15, phase: 'review', stepIndex: 0, isLapse: false, status: 'review' });
  }
  const nextStep = currentStep + 1;
  if (nextStep < steps.length) {
    return output({ data, repetition: repetition + 1, intervalMinutes: steps[nextStep], easeFactor, phase, stepIndex: nextStep, isLapse: false, status: phase });
  }
  return output({ data, repetition: Math.max(2, repetition + 1), intervalMinutes: config.graduatingIntervalDays * DAY_MINUTES, easeFactor, phase: 'review', stepIndex: 0, isLapse: false, status: 'review' });
}

function schedule(currentState, rating, options = {}) {
  if (!QUALITY_RATINGS.has(rating)) throw new Error(`Rating invalido fornecido ao scheduler: ${rating}`);
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  if (Number.isNaN(now.getTime())) throw new Error('Parametro "now" invalido no scheduler.');

  const data = currentState?.data || createInitialState().data;
  const repetition = Number(data.repetition ?? 0);
  const intervalDays = Number(data.interval ?? 0);
  const easeFactor = Number(data.easeFactor ?? INITIAL_EASE_FACTOR);
  const inferredPhase = data.phase || (repetition >= 2 || intervalDays > 0 ? 'review' : 'learning');
  let result;

  if (inferredPhase === 'learning' || inferredPhase === 'relearning') {
    result = scheduleLearning(data, rating, inferredPhase);
  } else if (rating === 'again') {
    const config = resolveConfig(data);
    result = output({
      data,
      repetition: 0,
      intervalMinutes: config.relearningStepsMinutes[0],
      easeFactor: Math.max(MIN_EASE_FACTOR, easeFactor - 0.2),
      phase: 'relearning',
      stepIndex: 0,
      isLapse: true,
      status: 'relearning',
    });
  } else {
    let nextRepetition = repetition;
    let nextIntervalDays = Math.max(1, intervalDays || 1);
    let nextEaseFactor = easeFactor;
    if (rating === 'hard') {
      nextIntervalDays = Math.max(1, Math.round(nextIntervalDays * 1.2));
      nextEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.15);
    } else if (rating === 'good') {
      nextRepetition += 1;
      nextIntervalDays = Math.max(1, Math.round(nextIntervalDays * easeFactor));
    } else {
      nextRepetition += 1;
      nextIntervalDays = Math.max(1, Math.round(nextIntervalDays * easeFactor * 1.3));
      nextEaseFactor = easeFactor + 0.15;
    }
    result = output({ data, repetition: nextRepetition, intervalMinutes: nextIntervalDays * DAY_MINUTES, easeFactor: nextEaseFactor, phase: 'review', stepIndex: 0, isLapse: false, status: 'review' });
  }

  return { ...result, dueAt: new Date(now.getTime() + result.intervalMinutes * MINUTE_MS) };
}

module.exports = { DEFAULT_SCHEDULER_CONFIG, createInitialState, resolveConfig, schedule };
