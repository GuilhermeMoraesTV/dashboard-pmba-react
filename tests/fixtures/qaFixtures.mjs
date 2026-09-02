/**
 * @fileoverview Fixtures determinísticas e leves para testes de QA e integração.
 * Respeita estritamente os contratos definidos em src/contracts/.
 */

export const FIXTURE_TIMESTAMP = new Date('2026-08-29T10:00:00.000Z');

export const mockGlobalQuestion = Object.freeze({
  id: 'q_global_001',
  questionScope: 'global',
  statement: 'Qual é o princípio fundamental da República Federativa do Brasil previsto no art. 1º da CF/88?',
  options: [
    { id: 'A', text: 'Soberania' },
    { id: 'B', text: 'Monarquia Absoluta' },
    { id: 'C', text: 'Tributação Ilimitada' },
    { id: 'D', text: 'Centralização Monárquica' },
  ],
  disciplineId: 'direito_constitucional',
  subject: 'Princípios Fundamentais',
  banca: 'IBFC',
  year: 2024,
  institution: 'PMBA',
  difficulty: 'easy',
  sourceType: 'official',
  sourceDocumentId: null,
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
});

export const mockGlobalAnswerKey = Object.freeze({
  correctOptionId: 'A',
  explanation: 'O art. 1º, I da CF/88 estabelece a Soberania como fundamento da República Federativa do Brasil.',
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
});

export const mockPrivateQuestion = Object.freeze({
  id: 'q_private_001',
  questionScope: 'private',
  userId: 'user_qa_123',
  statement: 'Qual é o prazo regulamentar para interposição de recurso administrativo na PMBA?',
  options: [
    { id: 'A', text: '5 dias úteis' },
    { id: 'B', text: '10 dias corridos' },
    { id: 'C', text: '15 dias corridos' },
    { id: 'D', text: '30 dias úteis' },
  ],
  disciplineId: 'direito_administrativo',
  subject: 'Estatuto dos Policiais Militares',
  difficulty: 'medium',
  sourceType: 'manual',
  sourceDocumentId: null,
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
});

export const mockPrivateAnswerKey = Object.freeze({
  correctOptionId: 'B',
  explanation: 'Conforme art. XX do Estatuto, o prazo é de 10 dias corridos.',
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
});

export const mockQuestionAttempt = Object.freeze({
  id: 'attempt_001',
  questionId: 'q_global_001',
  questionScope: 'global',
  userId: 'user_qa_123',
  selectedOptionId: 'A',
  correctOptionId: 'A',
  isCorrect: true,
  timeSpentSeconds: 45,
  xpEarned: 10,
  attemptedAt: FIXTURE_TIMESTAMP,
});

export const mockErrorBookEntryQuestion = Object.freeze({
  id: 'question:global:q_global_001',
  userId: 'user_qa_123',
  sourceType: 'question',
  sourceId: 'q_global_001',
  questionScope: 'global',
  deckId: null,
  disciplineId: 'direito_constitucional',
  subject: 'Princípios Fundamentais',
  wrongCount: 2,
  correctCount: 1,
  lastAttemptAt: FIXTURE_TIMESTAMP,
  userNotes: 'Atenção à pegadinha com Soberania vs Autonomia.',
  mastered: false,
  masteredAt: null,
  preview: {
    statement: 'Qual é o princípio fundamental da República Federativa do Brasil previsto no art. 1º da CF/88?',
    options: [
      { id: 'A', text: 'Soberania' },
      { id: 'B', text: 'Monarquia Absoluta' },
    ],
    correctOptionId: 'A',
    userSelectedOptionId: 'B',
  },
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
});

export const mockErrorBookEntryFlashcard = Object.freeze({
  id: 'flashcard:deck_cf88:card_art5',
  userId: 'user_qa_123',
  sourceType: 'flashcard',
  sourceId: 'card_art5',
  questionScope: null,
  deckId: 'deck_cf88',
  disciplineId: 'direito_constitucional',
  subject: 'Direitos Individuais',
  wrongCount: 3,
  correctCount: 2,
  lastAttemptAt: FIXTURE_TIMESTAMP,
  userNotes: 'Revisar incisos XLV e XLVI do art. 5º.',
  mastered: true,
  masteredAt: FIXTURE_TIMESTAMP,
  preview: {
    front: 'O que diz o princípio da intranscendência da pena (art. 5º, XLV)?',
    snippet: 'Nenhuma pena passará da pessoa do condenado...',
  },
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
});

export const mockUserDocument = Object.freeze({
  id: 'doc_pdf_001',
  userId: 'user_qa_123',
  name: 'Direito_Constitucional_PMBA.pdf',
  fileType: 'pdf',
  storagePath: 'user_uploads/user_qa_123/documents/doc_pdf_001/Direito_Constitucional_PMBA.pdf',
  downloadUrl: null,
  fileSizeBytes: 1048576, // 1MB
  status: 'processed',
  errorMessage: null,
  pageCount: 15,
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
});

export const mockGeneratedItemFlashcard = Object.freeze({
  id: 'gen_fc_001',
  userId: 'user_qa_123',
  sourceDocumentId: 'doc_pdf_001',
  type: 'flashcard',
  status: 'draft',
  content: {
    front: 'Qual o quórum para aprovação de Emenda Constitucional?',
    back: '3/5 dos votos dos membros de cada Casa do Congresso Nacional, em dois turnos (art. 60, §2º da CF/88).',
  },
  tags: ['CF88', 'Processo Legislativo', 'Emenda'],
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
});

export const mockGeneratedItemQuestion = Object.freeze({
  id: 'gen_q_001',
  userId: 'user_qa_123',
  sourceDocumentId: 'doc_pdf_001',
  type: 'question',
  status: 'draft',
  content: {
    statement: 'A respeito das funções essenciais à Justiça, assinale a opção correta:',
    options: [
      { id: 'A', text: 'O Ministério Público é instituição permanente...' },
      { id: 'B', text: 'A Defensoria Pública não possui autonomia...' },
    ],
    correctOptionId: 'A',
    explanation: 'Art. 127 da CF/88 define o Ministério Público como instituição permanente.',
    disciplineId: 'direito_constitucional',
    subject: 'Funções Essenciais à Justiça',
    difficulty: 'medium',
  },
  tags: ['CF88', 'MP', 'Defensoria'],
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
});

export const mockDeck = Object.freeze({
  id: 'deck_cf88',
  userId: 'user_qa_123',
  name: 'Direito Constitucional — PMBA',
  description: 'Baralho de fixação dos principais artigos da CF/88',
  cardCount: 25,
  tags: ['Direito', 'Constitucional', 'PMBA'],
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
});

export const mockCard = Object.freeze({
  id: 'card_art5',
  deckId: 'deck_cf88',
  userId: 'user_qa_123',
  front: 'Qual é o prazo máximo de prisão temporária para crimes hediondos?',
  back: '30 dias, prorrogável por igual período em caso de extrema e comprovada necessidade (Lei 7.960/89 c/c Lei 8.072/90).',
  tags: ['Penal', 'Processo Penal', 'Crimes Hediondos'],
  status: 'review',
  dueAt: FIXTURE_TIMESTAMP,
  lapses: 1,
  reps: 4,
  schedulerState: {
    algorithm: 'sm2',
    version: 1,
    data: {
      repetition: 4,
      interval: 12,
      easeFactor: 2.4,
      lastRating: 'good',
    },
  },
  sourceType: 'manual',
  sourceId: null,
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
});

export const minimalPdfBuffer = Buffer.from(
  '%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
  '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
  '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n' +
  '0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
  'trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n186\n%%EOF',
  'binary',
);
