import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { allocateScheduleStudyRecord, buildScheduleRecordedProgress, getScheduleSlotKey, isScheduleProgressOnlyUpdate }
  from '../functions/gamification/scheduleStudyProgress.mjs';
import { calculatePlanStudyStreak, STUDY_STREAK_DAY_STATES } from '../functions/gamification/domain.mjs';
import { getAgendaSemana } from '../src/services/scheduling/review.js';
import { applyCronogramaRegistroProgress } from '../src/services/reviewOptimisticUpdates.js';
import { getCronogramaSlotRecordedMinutes } from '../src/utils/studyDayStatus.js';
import { getRecordedStudyMinutes } from '../src/utils/studyRecords.js';
import * as reviewRules from '../src/services/reviewProgressRules.js';
import * as queueRules from '../src/utils/cronogramaTheoryQueue.js';

const date = '2026-09-15';
const slots = [90, 150, 60, 60].map((planned, index) => ({
  slotId: `slot-${index}`, slotIdBase: `slot-${index}`, disciplinaId: `disc-${index}`,
  disciplinaNome: `Disciplina ${index}`, assunto: `Planejado ${index}`, dia: 2, ordemNoDia: index,
  dataSlot: date, minutosEstudo: planned, tempoMinutos: planned,
  minutosBrutoDia: planned, minutosRevisaoReservados: 0,
}));
const records = [72, 70, 60, 61].map((minutes, index) => ({
  id: `record-${index}`, cronogramaId: 'schedule', contextoRegistro: 'cronograma',
  disciplinaId: `disc-${index}`, disciplinaNome: `Disciplina ${index}`, assunto: `Estudado ${index}`,
  data: date, tempoEstudadoMinutos: minutes, origemConclusao: 'timer', markAsFinished: true,
  assuntoFinalizado: true,
}));
const plan = {
  id: 'schedule', ativo: true, dataInicio: date, horariosDetalhados: { 2: 6 },
  semanaTemplate: slots, progresso: { w0: Object.fromEntries(slots.map((s) => [s.slotId, true])) },
  progressoMinutos: { w0: Object.fromEntries(slots.map((s) => [s.slotId, s.minutosEstudo])) },
};
const streak = (studyRecords = records, schedule = plan, now = date) => calculatePlanStudyStreak({
  records: studyRecords, plan: schedule, planType: 'cronograma', now: new Date(`${now}T12:00:00-03:00`),
});

test('regressão 15/09: quatro conteúdos concluídos conservam 263m reais, não 360m planejados', () => {
  const result = buildScheduleRecordedProgress({ slots, records });
  assert.deepEqual(Object.values(result.minutes), [72, 70, 60, 61]);
  assert.equal(Object.values(result.minutes).reduce((a, b) => a + b, 0), 263);
  assert.ok(Object.values(result.completed).every(Boolean));
  slots.forEach((slot, index) => {
    assert.deepEqual(result.subjects[slot.slotId], [`Estudado ${index}`]);
    assert.equal(getCronogramaSlotRecordedMinutes({ cronograma: plan, slot, slotsDia: slots,
      registrosEstudo: records }), records[index].tempoEstudadoMinutos);
    assert.equal(slot.assunto, `Planejado ${index}`);
  });
  const day = streak().days[date];
  assert.equal(day.qualifiedMinutes, 263);
  assert.equal(day.plannedMinutes, 360);
  assert.equal(day.completedByBlocks, true);
  assert.equal(day.state, STUDY_STREAK_DAY_STATES.STUDIED);
  assert.equal(streak().currentStreak, 1);
});

test('estado real dos cards do cronograma exibe 70m/150m, concluído e com assunto alternativo', async () => {
  const source = await readFile(new URL('../src/pages/CronogramaPage.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('const buildCronogramaTaskState =');
  const end = source.indexOf('const isWeekPanIgnoredTarget', start);
  const context = vm.createContext({ buildScheduleRecordedProgress, getScheduleSlotKey, getRecordedStudyMinutes,
    getCronogramaSlotRecordedMinutes, getRegistroDateKey: (record) => record.data,
    getCompletionKey: (slot) => slot.slotId,
  });
  vm.runInContext(`${source.slice(start, end)}\n globalThis.buildTask = buildCronogramaTaskState;`, context);
  const task = context.buildTask({ cronograma: plan, slot: slots[1], slotsDia: slots, registrosEstudo: records });
  assert.equal(task.progressoMinutos, 70);
  assert.equal(task.tempoPlanejadoMinutos, 150);
  assert.equal(task.concluido, true);
  assert.deepEqual([...task.assuntosEstudados], ['Estudado 1']);
});

test('sem conclusão de conteúdo, estudo parcial permanece amarelo; check de zero não cria sequência', () => {
  const uncompleted = { ...plan, progresso: {}, progressoMinutos: {} };
  const partial = records.map((record) => ({ ...record, markAsFinished: false, assuntoFinalizado: false }));
  assert.equal(streak(partial, uncompleted).currentStreak, 0);
  assert.equal(streak(partial, uncompleted).days[date].completedByBlocks, false);
  const checks = records.map((record) => ({ ...record, tempoEstudadoMinutos: 0, tipoEstudo: 'check_manual' }));
  assert.equal(streak(checks).currentStreak, 0);
  assert.deepEqual(buildScheduleRecordedProgress({ slots, records: checks }).minutes, {});
});

test('finalização não vaza para outro dia ou planejamento e exclusão reabre somente o bloco sem registro', () => {
  assert.equal(streak([], plan).currentStreak, 0);
  assert.equal(streak(records.map((r) => ({ ...r, cronogramaId: 'other' }))).currentStreak, 0);
  assert.equal(streak(records, plan, '2026-09-22').days['2026-09-22'].completedByBlocks, false);
  const state = buildScheduleRecordedProgress({ slots, records: records.slice(1) });
  assert.equal(state.completed['slot-0'], undefined);
  assert.equal(state.completed['slot-1'], true);
  assert.equal(streak(records.slice(1)).currentStreak, 0);
});

test('180m em assunto alternativo de um bloco de 60m preservam todo o excedente e o planejamento', () => {
  const slot = { ...slots[0], minutosEstudo: 60, tempoMinutos: 60, assunto: 'Crase' };
  const record = { ...records[0], assunto: 'Pontuação', tempoEstudadoMinutos: 180 };
  const state = buildScheduleRecordedProgress({ slots: [slot], records: [record, record] });
  assert.equal(state.minutes[slot.slotId], 180);
  assert.deepEqual(state.subjects[slot.slotId], ['Pontuação']);
  assert.equal(slot.assunto, 'Crase');
  const optimistic = applyCronogramaRegistroProgress({ ...plan, semanaTemplate: [slot], progresso: {}, progressoMinutos: {} }, record);
  assert.equal(optimistic.progressoMinutos.w0[slot.slotId], 180);
});

test('vários blocos da mesma disciplina não duplicam minutos e respeitam origem explícita', () => {
  const same = [0, 1].map((index) => ({ ...slots[0], slotId: `s${index}`, slotIdBase: `s${index}`,
    assunto: `A${index}`, minutosEstudo: 60, tempoMinutos: 60, ordemNoDia: index }));
  const record = { ...records[0], markAsFinished: false, assuntoFinalizado: false, tempoEstudadoMinutos: 180 };
  assert.deepEqual(allocateScheduleStudyRecord({ slots: same, record }).minutes, { s0: 60, s1: 120 });
  assert.deepEqual(allocateScheduleStudyRecord({ slots: same, record: { ...record, cronogramaSlotIdBase: 's1' } }).minutes, { s1: 180 });
  const finished = { ...record, tempoEstudadoMinutos: 20, markAsFinished: true };
  const state = buildScheduleRecordedProgress({ slots: same, records: [{ ...finished, id: 'first' }, { ...finished, id: 'second' }] });
  assert.deepEqual(state.minutes, { s0: 20, s1: 20 });
  assert.deepEqual(state.completed, { s0: true, s1: true });
  const allocated = { ...record, cronogramaProgressApplied: true, cronogramaProgressAllocations: { s1: 180 } };
  assert.deepEqual(buildScheduleRecordedProgress({ slots: same, records: [allocated] }).minutes, { s1: 180 });
  assert.deepEqual(buildScheduleRecordedProgress({ slots: same, records: [{ ...allocated, tempoEstudadoMinutos: 120 }] }).minutes,
    { s0: 60, s1: 60 }, 'edição de duração invalida alocação antiga');
});

test('conclusão por conteúdo não ignora o tempo reservado para revisões nem muda a regra de ciclos', () => {
  const reserved = { ...plan, horariosDetalhados: { 2: 6.25 } };
  assert.equal(streak(records, reserved).currentStreak, 0);
  const withReview = [...records, { ...records[0], id: 'review', isRevisao: true,
    tipoEstudo: 'revisao', tempoEstudadoMinutos: 15 }];
  assert.equal(streak(withReview, reserved).currentStreak, 1);
  const cycle = calculatePlanStudyStreak({ records: [{ data: date, cicloId: 'cycle', contextoRegistro: 'ciclo',
    tempoEstudadoMinutos: 20, markAsFinished: true }], planType: 'ciclo',
    plan: { id: 'cycle', ativo: true, dataInicioPlanejamento: date, diasEstudo: { 2: 1 } },
    now: new Date(`${date}T12:00:00-03:00`) });
  assert.equal(cycle.currentStreak, 0);
});

test('metadados de sincronização não disparam reprocessamento; edição real continua processável', () => {
  const record = records[0];
  const marked = { ...record, cronogramaProgressApplied: true, cronogramaProgressAllocations: { 'slot-0': 72 } };
  assert.equal(isScheduleProgressOnlyUpdate(record, marked), true);
  assert.equal(isScheduleProgressOnlyUpdate(record, { ...marked, tempoEstudadoMinutos: 90 }), false);
});

test('transação executa o código real de sync uma vez, inclusive duas solicitações concorrentes', async () => {
  const source = await readFile(new URL('../src/services/cronogramaProgressSync.js', import.meta.url), 'utf8');
  const record = { ...records[1] };
  const schedule = { ...plan, progresso: {}, progressoMinutos: {} };
  const documents = new Map([['record', record], ['schedule', schedule]]);
  let writes = 0;
  let queue = Promise.resolve();
  const context = vm.createContext({ ...reviewRules, ...queueRules, getAgendaSemana,
    allocateScheduleStudyRecord, getScheduleSlotKey: (slot) => slot.slotIdBase || slot.slotId,
    doc: () => 'schedule', runTransaction: (_db, callback) => {
      const pending = queue.then(() => callback({
        get: async (ref) => ({ id: ref, exists: () => documents.has(ref), data: () => documents.get(ref) }),
        update: (ref, updates) => {
          writes += 1;
          const data = documents.get(ref);
          for (const [path, value] of Object.entries(updates)) {
            const keys = path.split('.');
            let target = data;
            keys.slice(0, -1).forEach((key) => { target[key] ||= {}; target = target[key]; });
            target[keys.at(-1)] = value;
          }
        },
      }));
      queue = pending.catch(() => {});
      return pending;
    },
  });
  vm.runInContext(source.replace(/import\s[\s\S]*?;\r?\n/g, '').replaceAll('export ', ''), context);
  const options = { db: {}, userUid: 'test-user', cronogramaId: 'schedule', registro: record, registroRef: 'record' };
  const results = await Promise.all([context.syncRegistroEstudoWithCronograma(options), context.syncRegistroEstudoWithCronograma(options)]);
  assert.equal(schedule.progressoMinutos.w0['slot-1'], 70);
  assert.equal(schedule.progresso.w0['slot-1'], true);
  assert.equal(record.cronogramaProgressApplied, true);
  assert.equal(writes, 2);
  assert.equal(results.filter((result) => result.duplicate).length, 1);
  await context.syncRegistroEstudoWithCronograma(options);
  assert.equal(writes, 2, 'retry não gera escrita cosmética nem duplica minutos');
});
