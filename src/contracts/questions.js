/**
 * @fileoverview Contratos de dados e tipos para o domínio de Questões e Resoluções.
 * Define interfaces para Questões Globais, Questões Privadas e Tentativas de Resposta.
 */

/**
 * Escopos permitidos para questões.
 * @type {readonly ['global', 'private']}
 */
export const QUESTION_SCOPES = Object.freeze(['global', 'private']);

/**
 * Níveis de dificuldade de questões.
 * @type {readonly ['easy', 'medium', 'hard']}
 */
export const QUESTION_DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);

/**
 * Origens possíveis de criação de uma questão.
 * @type {readonly ['official', 'manual', 'ai', 'imported']}
 */
export const QUESTION_SOURCE_TYPES = Object.freeze(['official', 'manual', 'ai', 'imported']);

/**
 * @typedef {'global' | 'private'} QuestionScope
 */

/**
 * @typedef {'easy' | 'medium' | 'hard'} QuestionDifficulty
 */

/**
 * @typedef {'official' | 'manual' | 'ai' | 'imported'} QuestionSourceType
 */

/**
 * Alternativa de uma questão de múltipla escolha.
 * Não expõe gabarito.
 * @typedef {Object} QuestionOption
 * @property {string} id Identificador da alternativa (ex: 'A', 'B', 'C', 'opt_1').
 * @property {string} text Texto / enunciado da alternativa.
 */

/**
 * Modelo de transporte / UI seguro de Questão entregue ao Client.
 * O gabarito e explicação reveladora NUNCA são expostos antes da submissão.
 * @typedef {Object} Question
 * @property {string} id Identificador único da questão.
 * @property {QuestionScope} questionScope Contexto da questão ('global' do sistema ou 'private' do usuário).
 * @property {string | null} [userId] ID do proprietário quando a questão for privada (`users/{userId}/questions/{id}`).
 * @property {string} statement Enunciado da questão (suporta Markdown).
 * @property {QuestionOption[]} options Lista de alternativas disponíveis.
 * @property {string} disciplineId Identificador da disciplina.
 * @property {string} subject Nome do assunto/tópico.
 * @property {string} [banca] Nome da banca organizadora (ex: 'FCC', 'Cebraspe').
 * @property {number} [year] Ano de aplicação.
 * @property {string} [institution] Órgão / Instituição do concurso.
 * @property {QuestionDifficulty} [difficulty] Dificuldade estimada.
 * @property {QuestionSourceType} sourceType Origem da questão.
 * @property {string | null} [sourceDocumentId] ID do documento de origem se gerada por IA.
 * @property {string | Date} createdAt Data de cadastro.
 * @property {string | Date} updatedAt Data da última atualização.
 */

/**
 * Modelo de persistência no Firestore para o Banco Global de Questões.
 * Caminho: questions/{questionId} (Gerenciado por administradores / backend)
 * @typedef {Object} GlobalQuestionEntity
 * @property {string} statement Enunciado.
 * @property {QuestionOption[]} options Alternativas.
 * @property {string} disciplineId Disciplina.
 * @property {string} subject Assunto.
 * @property {string} [banca] Banca organizadora.
 * @property {number} [year] Ano.
 * @property {string} [institution] Órgão.
 * @property {QuestionDifficulty} [difficulty] Dificuldade.
 * @property {QuestionSourceType} sourceType Tipo de origem.
 * @property {any} createdAt Firestore Timestamp.
 * @property {any} updatedAt Firestore Timestamp.
 */

/**
 * Modelo de persistência no Firestore para Questões Privadas do Usuário.
 * Caminho: users/{userId}/questions/{questionId} (Isolado no diretório do usuário)
 * @typedef {Object} PrivateQuestionEntity
 * @property {string} userId ID do usuário proprietário.
 * @property {string} statement Enunciado.
 * @property {QuestionOption[]} options Alternativas.
 * @property {string} disciplineId Disciplina.
 * @property {string} subject Assunto.
 * @property {QuestionDifficulty} [difficulty] Dificuldade.
 * @property {QuestionSourceType} sourceType Origem da questão ('manual', 'ai', etc.).
 * @property {string | null} [sourceDocumentId] ID do documento de origem.
 * @property {any} createdAt Firestore Timestamp.
 * @property {any} updatedAt Firestore Timestamp.
 */

/**
 * Gabarito persistido em documento protegido e acessível somente pelo backend.
 * Paths:
 * - questions/{questionId}/private/answerKey
 * - users/{userId}/questions/{questionId}/private/answerKey
 * @typedef {Object} QuestionAnswerKeyEntity
 * @property {string} correctOptionId ID da alternativa correta.
 * @property {string} [explanation] Explicação revelada somente após a tentativa.
 * @property {any} createdAt Firestore Timestamp.
 * @property {any} updatedAt Firestore Timestamp.
 */

/**
 * Contrato preparado para criação/edição segura de questão privada via backend.
 * O backend separa `question` e `answerKey` nos respectivos documentos.
 * @typedef {Object} UpsertPrivateQuestionRequest
 * @property {Omit<PrivateQuestionEntity, 'userId' | 'createdAt' | 'updatedAt'>} question Conteúdo client-safe.
 * @property {Pick<QuestionAnswerKeyEntity, 'correctOptionId' | 'explanation'>} [answerKey] Gabarito obrigatório na criação. Na edição, sua ausência preserva o gabarito protegido existente; se as alternativas ficarem incompatíveis, um novo gabarito é exigido.
 * @property {string} [questionId] ID existente em caso de edição.
 */

/**
 * Requisição de submissão de resposta enviada pelo Client para validação server-side.
 * @typedef {Object} SubmitQuestionAnswerRequest
 * @property {string} questionId ID da questão respondida.
 * @property {QuestionScope} questionScope Escopo da questão ('global' ou 'private').
 * @property {string} selectedOptionId ID da alternativa escolhida pelo usuário.
 * @property {number} [timeSpentSeconds] Tempo gasto na resolução em segundos.
 */

/**
 * Resposta oficial retornada pela Cloud Function após validação do gabarito.
 * @typedef {Object} SubmitQuestionAnswerResponse
 * @property {string} questionId ID da questão.
 * @property {QuestionScope} questionScope Escopo da questão.
 * @property {string} selectedOptionId Alternativa assinalada pelo usuário.
 * @property {string} correctOptionId Alternativa correta revelada pelo servidor.
 * @property {boolean} isCorrect Indica se o usuário acertou.
 * @property {string} [explanation] Comentário explicativo revelado.
 * @property {number} [xpEarned] Pontuação de experiência concedida pela resolução.
 * @property {string} attemptId ID do registro de tentativa persistido com segurança.
 */

/**
 * Modelo de transporte / UI para tentativa de questão respondida.
 * @typedef {Object} QuestionAttempt
 * @property {string} id Identificador único da tentativa.
 * @property {string} questionId ID da questão referenciada.
 * @property {QuestionScope} questionScope Escopo da questão ('global' ou 'private').
 * @property {string} userId ID do usuário que respondeu.
 * @property {string} selectedOptionId Alternativa marcada.
 * @property {string} correctOptionId Alternativa correta confirmada pelo backend.
 * @property {boolean} isCorrect Resultado validado server-side.
 * @property {number} [timeSpentSeconds] Duração da tentativa em segundos.
 * @property {number} [xpEarned] XP ganho na resolução.
 * @property {string | Date} attemptedAt Data/hora da tentativa.
 */

/**
 * Modelo de persistência no Firestore para Tentativa de Resolução.
 * Caminho: users/{userId}/question_attempts/{attemptId} (Persistido pela Cloud Function)
 * @typedef {Object} QuestionAttemptEntity
 * @property {string} questionId ID da questão.
 * @property {QuestionScope} questionScope 'global' ou 'private'.
 * @property {string} userId ID do usuário.
 * @property {string} selectedOptionId Alternativa escolhida.
 * @property {string} correctOptionId Alternativa correta validada.
 * @property {boolean} isCorrect Acerto / Erro validado.
 * @property {number} [timeSpentSeconds] Duração.
 * @property {number} [xpEarned] XP.
 * @property {any} attemptedAt Firestore Timestamp.
 */

/**
 * Estatísticas derivadas e atualizadas exclusivamente pelo backend.
 * Caminho: users/{userId}/question_stats/summary
 * @typedef {Object} QuestionStatsEntity
 * @property {number} questionsResolved Total de questões únicas cuja primeira resolução foi registrada.
 * @property {number} correctResolved Total de questões únicas acertadas na primeira resolução.
 * @property {number} incorrectResolved Total de questões únicas erradas na primeira resolução.
 * @property {number} [accuracy] Taxa percentual de acerto baseada na primeira resolução única da questão.
 * @property {number} totalAttemptEvents Total de tentativas auditáveis distintas registradas (considerando a deduplicação da mesma alternativa).
 * @property {number} totalAttempts Alias de compatibilidade para totalAttemptEvents.
 * @property {number} correctAttempts Total de tentativas corretas no histórico geral.
 * @property {number} wrongAttempts Total de tentativas incorretas no histórico geral.
 * @property {number} totalXpEarned Espelho derivado da soma dos eventos oficiais de XP originados em questões; não é uma fonte de gamificação independente.
 * @property {any} createdAt Firestore Timestamp.
 * @property {any} updatedAt Firestore Timestamp.
 */

/**
 * Validador de QuestionScope.
 * @param {any} scope
 * @returns {scope is QuestionScope}
 */
export function isValidQuestionScope(scope) {
  return typeof scope === 'string' && QUESTION_SCOPES.includes(scope);
}
