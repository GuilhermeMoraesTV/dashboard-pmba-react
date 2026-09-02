/**
 * @fileoverview Contratos de dados para serviços de IA orientados a domínio.
 * O cliente consome requisições de domínio; prompts e schemas são gerenciados no servidor.
 */

/**
 * Superfícies permitidas para invocação de IA.
 * @type {readonly ['flashcards', 'questions', 'summary', 'cronograma', 'edital', 'noticias']}
 */
export const AI_SURFACES = Object.freeze([
  'flashcards',
  'questions',
  'summary',
  'cronograma',
  'edital',
  'noticias',
]);

/**
 * @typedef {'flashcards' | 'questions' | 'summary' | 'cronograma' | 'edital' | 'noticias'} AISurface
 */

/**
 * Requisição client-side para geração vinculada a uma StudySource autoritativa.
 * @typedef {Object} FlashcardGenerationRequest
 * @property {string} sourceId ID da StudySource armazenada.
 * @property {string} [deckId] ID do deck de destino (se omitido, salva nos itens gerados em rascunho).
 */

/**
 * Requisição client-side para geração de Questões a partir de documento.
 * @typedef {Object} QuestionGenerationRequest
 * @property {string} sourceId ID da StudySource armazenada.
 * @property {number} [targetCount] Quantidade de questões a gerar.
 * @property {'easy' | 'medium' | 'hard'} [difficulty] Nível de dificuldade pretendido.
 */

/**
 * Requisição client-side para geração de Resumo estruturado.
 * @typedef {Object} SummaryGenerationRequest
 * @property {string} sourceId ID da StudySource armazenada.
 */

/**
 * Resposta de agendamento/execução de tarefa de geração por IA.
 * @typedef {Object} AIGenerationJobResponse
 * @property {string} jobId ID da tarefa de geração.
 * @property {'queued' | 'processing' | 'completed' | 'error'} status Estado da execução.
 * @property {number} [itemCount] Quantidade de itens gerados com sucesso.
 * @property {string} [error] Mensagem de erro caso a geração falhe.
 */

/**
 * Parâmetros internos utilizados pela Cloud Function server-side para chamar o provedor de IA.
 * NUNCA exposto diretamente no cliente.
 * @typedef {Object} ServerAIGenerateOptions
 * @property {string} prompt Prompt montado no backend.
 * @property {string} [systemPrompt] Instruções de sistema.
 * @property {object} [responseSchema] JSON Schema estruturado para retorno estrito.
 * @property {number} [temperature] Temperatura de amostragem.
 * @property {number} [maxOutputTokens] Limite de tokens de saída.
 * @property {AISurface} surface Superfície de negócio demandante.
 */

/**
 * Resultado retornado pelo provedor de IA server-side (Vertex AI / Gemini).
 * @typedef {Object} ServerAIGenerateResult
 * @property {string} provider Identificador do provedor (ex: 'google_vertex').
 * @property {string} model Modelo utilizado (ex: 'gemini-2.5-flash').
 * @property {string} text Texto bruto gerado.
 * @property {any} [parsedJson] JSON extraído e validado pelo schema, se aplicável.
 * @property {{ promptTokens?: number, outputTokens?: number }} [usage] Métricas de consumo.
 */
