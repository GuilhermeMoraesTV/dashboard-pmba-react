import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCronogramaPostponement,
  getCronogramaPostponementRestorePayload,
} from '../src/utils/cronogramaPostponement.js';

test('adia inicio, fim e fechamento em sete dias', () => {
  const result = buildCronogramaPostponement({
    dataInicio: '2026-08-13',
    dataFim: '2026-10-01',
    dataFechamento: '2026-10-08',
  });

  assert.deepEqual(result.nextDates, {
    dataInicio: '2026-08-20',
    dataFim: '2026-10-08',
    dataFechamento: '2026-10-15',
  });
});

test('desfazer restaura todas as datas que foram alteradas', () => {
  const result = buildCronogramaPostponement({
    dataInicio: '2026-12-28',
    dataFim: '2027-01-31',
  });

  assert.deepEqual(getCronogramaPostponementRestorePayload(result), {
    dataInicio: '2026-12-28',
    dataFim: '2027-01-31',
  });
});

test('aceita uma quantidade personalizada de dias', () => {
  const result = buildCronogramaPostponement({
    dataInicio: '2026-08-13',
    dataFim: '2026-10-01',
  }, 15);

  assert.equal(result.days, 15);
  assert.deepEqual(result.nextDates, {
    dataInicio: '2026-08-28',
    dataFim: '2026-10-16',
  });
});

test('falha sem uma data de inicio valida', () => {
  assert.throws(() => buildCronogramaPostponement({ dataInicio: 'invalida' }), /Data de inicio invalida/);
  assert.throws(() => buildCronogramaPostponement({}), /sem data de inicio/);
});

test('recusa quantidade de dias fora do intervalo permitido', () => {
  const cronograma = { dataInicio: '2026-08-13' };
  assert.throws(() => buildCronogramaPostponement(cronograma, 0), /Quantidade de dias invalida/);
  assert.throws(() => buildCronogramaPostponement(cronograma, 366), /Quantidade de dias invalida/);
});
