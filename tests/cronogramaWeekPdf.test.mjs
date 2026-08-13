import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCronogramaWeekPdfFileName,
  paginateCronogramaWeekPdf,
  prepareCronogramaWeekPdfModel,
} from '../src/pages/CronogramaWeekPdf.js';

const dates = Array.from({ length: 7 }, (_, index) => new Date(2026, 7, 10 + index, 12));
const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const weekdays = ['Domingo', 'Segunda-feira', 'Terca-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sabado'];

const buildModel = (tasks) => prepareCronogramaWeekPdfModel({
  cronograma: { nome: 'Plano PMBA', editalNome: 'Policia Militar da Bahia' },
  weekDates: dates,
  weekOffset: 2,
  tarefasPorDia: { 1: tasks },
  formatarDuracao: (minutes) => `${minutes} min`,
  getDisciplineColorForSlot: () => ({ hex: '#2563eb' }),
  getNomeDisc: (task) => task.disciplina,
  getTextoAssunto: (task) => task.assunto,
  getLabelTipo: (task) => task.label,
  meses: months,
  diasLongo: weekdays,
});

test('normaliza o PDF como planejamento e ignora qualquer estado de conclusao', () => {
  const model = buildModel([
    {
      id: 'task-1',
      disciplina: 'Direito Constitucional',
      assunto: 'Direitos e garantias fundamentais',
      tempoPlanejadoMinutos: 60,
      concluido: true,
      progresso: 100,
      progressoMinutos: 60,
    },
  ]);

  assert.equal(model.weekLabel, 'SEMANA 3');
  assert.equal(model.period, '10 AGO - 16 AGO 2026');
  assert.equal(model.totalMinutes, 60);
  assert.equal(model.totalBlocks, 1);
  assert.deepEqual(model.days[0].tasks[0], {
    id: 'task-1',
    discipline: 'Direito Constitucional',
    subject: 'Direitos e garantias fundamentais',
    duration: '60 min',
    minutes: 60,
    type: 'ESTUDO',
    review: false,
    color: '#2563eb',
  });
});

test('identifica revisoes por flag ou rotulo e preserva disciplina, assunto e duracao', () => {
  const model = buildModel([
    {
      id: 'review-1',
      disciplina: 'Lingua Portuguesa',
      assunto: 'Concordancia verbal',
      tempoMinutos: 30,
      isRevisaoAuto: true,
    },
    {
      id: 'review-2',
      disciplina: 'Matematica',
      assunto: 'Porcentagem',
      minutosEstudo: 25,
      tipo: 'Teoria',
      label: 'Revisao programada',
    },
  ]);

  assert.equal(model.totalReviews, 2);
  assert.deepEqual(
    model.days[0].tasks.map(({ discipline, subject, duration, type }) => ({ discipline, subject, duration, type })),
    [
      { discipline: 'Lingua Portuguesa', subject: 'Concordancia verbal', duration: '30 min', type: 'REVISAO' },
      { discipline: 'Matematica', subject: 'Porcentagem', duration: '25 min', type: 'REVISAO' },
    ],
  );
});

test('gera nome de arquivo estavel para a semana exportada', () => {
  assert.equal(
    buildCronogramaWeekPdfFileName({ cronograma: { nome: 'Cronograma PMBA - Soldado' }, weekOffset: 1 }),
    'cronograma-pmba-soldado-semana-2.pdf',
  );
});

test('opcao sem assunto remove somente o texto do assunto', () => {
  const model = prepareCronogramaWeekPdfModel({
    cronograma: { nome: 'Plano PMBA' },
    weekDates: dates,
    tarefasPorDia: {
      1: [{ disciplina: 'Direito Penal', assunto: 'Teoria do crime', tempoMinutos: 50 }],
    },
    includeSubjects: false,
    getNomeDisc: (task) => task.disciplina,
    getTextoAssunto: (task) => task.assunto,
    meses: months,
    diasLongo: weekdays,
  });

  assert.equal(model.days[0].tasks[0].discipline, 'Direito Penal');
  assert.equal(model.days[0].tasks[0].subject, '');
  assert.equal(model.days[0].tasks[0].minutes, 50);
});

test('mantem os sete dias em uma unica pagina mesmo em semana densa', async () => {
  const { jsPDF } = await import('jspdf');
  const denseTasks = Array.from({ length: 12 }, (_, index) => ({
    id: `dense-${index}`,
    disciplina: `Disciplina ${index + 1}`,
    assunto: 'Assunto extenso para validar a compactacao automatica do card',
    tempoMinutos: 45,
  }));
  const model = buildModel(denseTasks);
  const pages = paginateCronogramaWeekPdf(
    new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }),
    model,
  );

  assert.equal(pages.length, 1);
  assert.equal(pages[0].length, 7);
  assert.equal(pages[0][0].tasks.length, 12);
});
