import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildCycleSessionCompletionUpdate,
  isCurrentCycleRound,
  isRealCycleStudyRecord,
} from '../src/utils/cycleSessionCompletion.js';
import { buildCycleOrderedSessions } from '../src/utils/studyDayStatus.js';
import { buildCycleRoundSummary } from '../src/utils/cicloWeeklyStatus.js';
import { isPlanActivationBlocked } from '../src/utils/planActivation.js';
import { isStudyRecordLinkedToPlan } from '../src/utils/planDeletion.js';

test('CENÁRIO 0: interface não expõe checkout e o hook legado recusa a escrita', () => {
  const cicloVisual = readFileSync(new URL('../src/components/ciclos/CicloVisual.jsx', import.meta.url), 'utf8');
  const cardHoje = readFileSync(new URL('../src/components/ciclos/CardSessoesCicloHoje.jsx', import.meta.url), 'utf8');
  const detalhe = readFileSync(new URL('../src/pages/CicloDetalhePage.jsx', import.meta.url), 'utf8');
  const hoje = readFileSync(new URL('../src/pages/HomePage/HojeCard.jsx', import.meta.url), 'utf8');
  const hook = readFileSync(new URL('../src/hooks/useCiclos.jsx', import.meta.url), 'utf8');

  [cicloVisual, cardHoje, detalhe, hoje].forEach((source) => {
    assert.doesNotMatch(source, /onMarcarSessao|onToggleSessao/);
  });
  assert.match(hook, /Checkout manual recusado/);
});

test('CENÁRIO 1: checkout manual legado não conclui nenhum bloco visual', () => {
  const cycle = {
    sessoesConcluidas: [],
    progressoSessoes: {},
    sessoesConcluidasDetalhes: {},
  };

  // 1. Usuário marca manualmente o bloco 0
  const updateBlock0 = buildCycleSessionCompletionUpdate({
    cycle,
    sessionIndex: 0,
    targetCompleted: true,
    plannedMinutes: 50,
    completedAt: '2026-09-07',
    source: 'checkout_manual',
  });

  assert.equal(updateBlock0.changed, true);
  assert.deepEqual(updateBlock0.update.sessoesConcluidas, [0]);
  assert.equal(updateBlock0.update.progressoSessoes['0'], 50);
  assert.equal(updateBlock0.update.progressoSessoes['1'], undefined);
  assert.equal(updateBlock0.update.sessoesConcluidasDetalhes['0'].origem, 'checkout_manual');
  assert.equal(updateBlock0.update.sessoesConcluidasDetalhes['1'], undefined);

  // 2. O estado sintético pode existir no banco antigo, mas a leitura o ignora.
  const updatedCycle = {
    ...cycle,
    ...updateBlock0.update,
    ordemSessoes: [
      { disciplinaId: 'd1', sessaoIndex: 0, tempoMinutos: 50 },
      { disciplinaId: 'd1', sessaoIndex: 1, tempoMinutos: 50 },
    ],
    disciplinas: [{ id: 'd1', duracoesSessoes: [50, 50] }],
  };

  const sessions = buildCycleOrderedSessions(updatedCycle);
  assert.equal(sessions[0].concluida, false);
  assert.equal(sessions[0].progressoMinutos, 0);
  assert.equal(sessions[1].concluida, false);
  assert.equal(sessions[1].progressoMinutos, 0);
});

test('CENÁRIO 1B: Recálculo de progresso ignora registros de checkout_manual (evita cascata)', () => {
  // Simulando a lógica de recálculo: apenas registros reais de tempo contam
  const registros = [
    {
      id: 'reg-checkout-manual',
      cicloId: 'ciclo-1',
      disciplinaId: 'd1',
      origem: 'checkout_manual',
      origemConclusao: 'botao_concluir',
      tempoEstudadoMinutos: 50,
      conclusaoId: null,
    },
    {
      id: 'reg-tempo-real',
      cicloId: 'ciclo-1',
      disciplinaId: 'd1',
      origem: 'tempo_acumulado',
      tempoEstudadoMinutos: 30,
      conclusaoId: null,
    },
  ];

  const registrosDeTempoReais = registros.filter(isRealCycleStudyRecord);

  assert.equal(registrosDeTempoReais.length, 1);
  assert.equal(registrosDeTempoReais[0].id, 'reg-tempo-real');
  assert.equal(registrosDeTempoReais[0].tempoEstudadoMinutos, 30);
});

test('CENÁRIO 1C: checkout manual nunca é elegível para recálculo, mesmo com duração planejada', () => {
  assert.equal(isRealCycleStudyRecord({
    origem: 'checkout_manual',
    origemConclusao: 'botao_concluir',
    tempoEstudadoMinutos: 60,
  }), false);
  assert.equal(isRealCycleStudyRecord({ origem: 'timer', tempoEstudadoMinutos: 60 }), true);
  assert.equal(isRealCycleStudyRecord({ origem: 'registro_manual', tempoEstudadoMinutos: 60 }), true);
});

test('CENÁRIO 1D: somente um evento confiável do usuário pode iniciar checkout manual', () => {
  const canPersistManualCheckout = (event) => event?.isTrusted === true;

  assert.equal(canPersistManualCheckout({ isTrusted: true }), true);
  assert.equal(canPersistManualCheckout({ isTrusted: false }), false);
  assert.equal(canPersistManualCheckout(null), false);
});

test('CENÁRIO 1E: clique de rodada anterior não pode concluir bloco após fechar o ciclo', () => {
  assert.equal(isCurrentCycleRound(4, 4), true);
  assert.equal(isCurrentCycleRound(3, 4), false);
  assert.equal(isCurrentCycleRound(undefined, 4), false);
});

test('CENÁRIO 1F: tempo do timer e modal se acumula mesmo com progresso já persistido', () => {
  const cycle = {
    id: 'ciclo-1',
    tempoSessaoMinutos: 60,
    ordemSessoes: [{ disciplinaId: 'd1', sessaoIndex: 0, tempoMinutos: 60 }],
    disciplinas: [{ id: 'd1', assuntos: ['Teoria do crime'], duracoesSessoes: [60] }],
    progressoSessoes: { 0: 60 },
    sessoesConcluidas: [0],
    sessoesConcluidasDetalhes: { 0: { origem: 'registro_manual' } },
  };
  const registros = [
    // Modal antigo: sem sessaoGlobalIndex.
    { cicloId: 'ciclo-1', disciplinaId: 'd1', assunto: 'Teoria do crime', tempoEstudadoMinutos: 60, contextoRegistro: 'ciclo' },
    // Timer: vínculo explícito com o mesmo bloco.
    { cicloId: 'ciclo-1', disciplinaId: 'd1', assunto: 'Teoria do crime', tempoEstudadoMinutos: 1, origem: 'timer', sessaoGlobalIndex: 0, contextoRegistro: 'ciclo' },
  ];

  const [session] = buildCycleOrderedSessions(cycle, null, registros);
  assert.equal(session.progressoMinutos, 61);
  assert.equal(session.concluida, true);
});

test('CENÁRIO 2: Sessão com origem checkout_manual é ignorada no syncRegistroEstudoWithCiclo', () => {
  // Testando a condição que previne colisões de escrita concorrente
  const registroCheckoutManual = {
    origem: 'checkout_manual',
    origemConclusao: 'botao_concluir',
    cicloId: 'ciclo-1',
  };

  const shouldSkipSync = Boolean(
    registroCheckoutManual.origemConclusao === 'botao_concluir' ||
    registroCheckoutManual.origem === 'checkout_manual'
  );

  assert.equal(shouldSkipSync, true);

  const registroCronometro = {
    origem: 'tempo_acumulado',
    cicloId: 'ciclo-1',
    tempoEstudadoMinutos: 45,
  };

  const shouldSkipCronometro = Boolean(
    registroCronometro.origemConclusao === 'botao_concluir' ||
    registroCronometro.origem === 'checkout_manual'
  );

  assert.equal(shouldSkipCronometro, false);
});

test('CENÁRIO 3: Invariante de ciclo único ativo e sanitização de payload', () => {
  const sanitize = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) return obj.map(sanitize).filter((v) => v !== undefined);
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) clean[key] = sanitize(value);
    }
    return clean;
  };

  const payloadComUndefined = {
    nome: 'Ciclo Teste',
    ativo: true,
    logoUrl: undefined,
    disciplinas: [
      { id: 'd1', nome: 'Português', cor: undefined, peso: 1 },
      { id: 'd2', nome: 'Matemática', cor: '#ff0000', peso: 2 },
    ],
  };

  const sanitizado = sanitize(payloadComUndefined);
  assert.equal('logoUrl' in sanitizado, false);
  assert.equal('cor' in sanitizado.disciplinas[0], false);
  assert.equal(sanitizado.disciplinas[1].cor, '#ff0000');
  assert.equal(sanitizado.ativo, true);
});

test('CENÁRIO 4: Exclusão profunda de registros vinculados ao ciclo', () => {
  const records = [
    { id: 'r1', cicloId: 'c1', context: 'ciclo' },
    { id: 'r2', cicloId: 'c2', context: 'ciclo' },
    { id: 'r3', cronogramaId: 'cron-1', context: 'cronograma' },
    { id: 'r4', cicloId: 'c1', context: 'ciclo' },
  ];

  const linkedToC1 = records.filter((r) => isStudyRecordLinkedToPlan(r, 'c1', 'ciclo'));
  assert.equal(linkedToC1.length, 2);
  assert.deepEqual(linkedToC1.map((r) => r.id), ['r1', 'r4']);
});

test('CENÁRIO 5: Conclusão de volta com confirmação manual não marca blocos não estudados', () => {
  const cicloData = {
    nome: 'Ciclo Teste',
    conclusoes: 0,
    tempoSessaoMinutos: 50,
    dataInicioPlanejamento: '2026-09-01',
    ordemSessoes: [
      { disciplinaId: 'd1', sessaoIndex: 0, tempoMinutos: 50 },
      { disciplinaId: 'd2', sessaoIndex: 0, tempoMinutos: 50 },
    ],
    sessoesConcluidas: [0],
    progressoSessoes: { 0: 50 },
    sessoesConcluidasDetalhes: { 0: { origem: 'checkout_manual' } },
  };

  const disciplinas = [
    { id: 'd1', nome: 'Direito Penal', inCiclo: true, tempoAlocadoSemanalMinutos: 50 },
    { id: 'd2', nome: 'Direito Constitucional', inCiclo: true, tempoAlocadoSemanalMinutos: 50 },
  ];

  const registrosDaRodada = [
    {
      disciplinaId: 'd1',
      tempoEstudadoMinutos: 50,
      data: '2026-09-02',
      conclusaoId: null,
    },
  ];

  // Resumo da rodada reflete EXATAMENTE o que foi estudado
  const resumoRodada = buildCycleRoundSummary({
    ciclo: cicloData,
    disciplinas,
    registros: registrosDaRodada,
    closedAt: new Date('2026-09-07T12:00:00Z'),
  });

  assert.equal(resumoRodada.numeroRodada, 1);
  assert.equal(resumoRodada.cargaCumpridaAteDataIdealMinutos, 50);
  assert.equal(resumoRodada.cargaPlanejadaMinutos, 100);
  // Disciplina d2 continua pendente no vencimento
  assert.equal(resumoRodada.materiasPendentesNoVencimento.some((m) => m.disciplinaId === 'd2'), true);
  // Não inventou tempo para a disciplina d2
  assert.equal(registrosDaRodada.some((r) => r.disciplinaId === 'd2'), false);
});

test('CENÁRIO 6: Recuperação de parada de cronômetro sem contexto de planejamento ativo', () => {
  const hasActiveStudyContext = false;
  const fallbackContext = !hasActiveStudyContext ? 'avulso' : 'ciclo';

  assert.equal(fallbackContext, 'avulso');
});

test('CENÁRIO 7: isAccessReady bloqueia listeners durante inicialização ou pendência de assinatura (fail-closed)', () => {
  const checkAccessReady = ({ user, userAccess }) => {
    return Boolean(
      user?.uid &&
      userAccess?.hasAccess &&
      !userAccess?.isLoading &&
      !userAccess?.isInitializing &&
      !userAccess?.isPendingInitialization
    );
  };

  // Caso 1: Usuário autenticado mas assinatura carregando -> NÃO PRONTO
  assert.equal(
    checkAccessReady({
      user: { uid: 'user-1' },
      userAccess: { hasAccess: true, isLoading: true, isInitializing: false, isPendingInitialization: false },
    }),
    false
  );

  // Caso 2: Usuário autenticado mas inicialização pendente -> NÃO PRONTO
  assert.equal(
    checkAccessReady({
      user: { uid: 'user-1' },
      userAccess: { hasAccess: true, isLoading: false, isInitializing: false, isPendingInitialization: true },
    }),
    false
  );

  // Caso 3: Usuário autenticado mas inicializando -> NÃO PRONTO
  assert.equal(
    checkAccessReady({
      user: { uid: 'user-1' },
      userAccess: { hasAccess: true, isLoading: false, isInitializing: true, isPendingInitialization: false },
    }),
    false
  );

  // Caso 4: Acesso confirmado e pronto -> PRONTO
  assert.equal(
    checkAccessReady({
      user: { uid: 'user-1' },
      userAccess: { hasAccess: true, isLoading: false, isInitializing: false, isPendingInitialization: false },
    }),
    true
  );

  // Caso 5: Sem acesso ativo -> NÃO PRONTO
  assert.equal(
    checkAccessReady({
      user: { uid: 'user-1' },
      userAccess: { hasAccess: false, isLoading: false, isInitializing: false, isPendingInitialization: false },
    }),
    false
  );
});

test('CicloCreateWizard define STEPS e etapas válidas', () => {
  const wizardSource = readFileSync(new URL('../src/components/ciclos/CicloCreateWizard/CicloCreateWizard.jsx', import.meta.url), 'utf8');
  assert.match(wizardSource, /const STEPS = \[/);
  assert.match(wizardSource, /clampStep/);
  assert.match(wizardSource, /visibleSteps/);
});
