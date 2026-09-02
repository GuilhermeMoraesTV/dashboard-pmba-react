/**
 * @fileoverview Contratos de dados e tipos para Documentos do Usuário e Itens Gerados por IA.
 * Na Fase 0/1, suporta exclusivamente upload e processamento de arquivos PDF.
 */

/**
 * Tipos de arquivo suportados para UserDocument nesta versão.
 * @type {readonly ['pdf']}
 */
export const DOCUMENT_FILE_TYPES = Object.freeze(['pdf']);

/**
 * Estados do ciclo de processamento de um documento.
 * @type {readonly ['pending', 'processing', 'processed', 'error']}
 */
export const DOCUMENT_STATUSES = Object.freeze(['pending', 'processing', 'processed', 'error']);

/**
 * Tipos de itens geráveis a partir de documentos.
 * @type {readonly ['flashcard', 'question', 'summary']}
 */
export const GENERATED_ITEM_TYPES = Object.freeze(['flashcard', 'question', 'summary']);

/**
 * Estados de aprovação de itens gerados por IA.
 * @type {readonly ['draft', 'approved', 'rejected']}
 */
export const GENERATED_ITEM_STATUSES = Object.freeze(['draft', 'buffer', 'materialized', 'approved', 'rejected']);
export const GENERATED_ITEM_QUEUE_STATES = Object.freeze(['generating', 'ready', 'served', 'consumed', 'cancelled', 'error']);

/**
 * @typedef {'pdf'} DocumentFileType
 */

/**
 * @typedef {'pending' | 'processing' | 'processed' | 'error'} DocumentStatus
 */

/**
 * @typedef {'flashcard' | 'question' | 'summary'} GeneratedItemType
 */

/**
 * @typedef {'draft' | 'buffer' | 'materialized' | 'approved' | 'rejected'} GeneratedItemStatus
 */

/**
 * Modelo de transporte / UI para Documento enviado pelo Usuário.
 * @typedef {Object} UserDocument
 * @property {string} id Identificador único do documento.
 * @property {string} userId ID do usuário proprietário.
 * @property {string} name Nome original do arquivo PDF.
 * @property {DocumentFileType} fileType Formato do arquivo (restrito a 'pdf').
 * @property {string} storagePath Caminho no Firebase Storage (user_uploads/{userId}/documents/{docId}/{name}).
 * @property {string | null} [downloadUrl] URL assinada ou de download se gerada.
 * @property {number} fileSizeBytes Tamanho do arquivo em bytes.
 * @property {DocumentStatus} status Status do processamento de texto.
 * @property {string | null} [errorMessage] Mensagem de erro caso o processamento falhe.
 * @property {number | null} [pageCount] Quantidade total de páginas detectadas no PDF.
 * @property {string | Date} createdAt Data do envio.
 * @property {string | Date} updatedAt Data da última atualização de status.
 */

/**
 * Modelo de persistência no Firestore para Documento.
 * Caminho: users/{userId}/documents/{docId}
 * @typedef {Object} UserDocumentEntity
 * @property {string} userId ID do usuário.
 * @property {string} name Nome do arquivo.
 * @property {DocumentFileType} fileType Tipo ('pdf').
 * @property {string} storagePath Caminho no Storage.
 * @property {string | null} [downloadUrl] URL de acesso.
 * @property {number} fileSizeBytes Tamanho em bytes.
 * @property {DocumentStatus} status Status de processamento.
 * @property {string | null} [errorMessage] Detalhe de erro.
 * @property {number | null} [pageCount] Número de páginas.
 * @property {any} createdAt Firestore Timestamp.
 * @property {any} updatedAt Firestore Timestamp.
 */

/**
 * Modelo de transporte / UI para Item Gerado por IA a partir de documento.
 * @typedef {Object} GeneratedItem
 * @property {string} id Identificador único do item gerado.
 * @property {string} userId ID do usuário proprietário.
 * @property {string | null} [sourceDocumentId] ID do UserDocument de origem.
 * @property {string} sourceId ID obrigatório da StudySource autoritativa para novas gerações.
 * @property {string} [sessionId] Sessao adaptativa proprietaria do item.
 * @property {string} [folderId] Pasta de Estudos associada.
 * @property {number} [sourceRevision] Revisao imutavel usada na geracao.
 * @property {string} [conceptId] Conceito escolhido pelo Tutor.
 * @property {'easy'|'hard'} [cognitiveDifficulty] Dificuldade do conteudo, distinta do rating.
 * @property {string} [variantKey] Variante conceitual, alterada em reforcos.
 * @property {string} [contentFingerprint] Hash de deduplicacao textual.
 * @property {import('./adaptiveStudy.js').SourceReference[]} [sourceRefs] Proveniencia obrigatoria.
 * @property {'generating'|'ready'|'served'|'consumed'|'cancelled'|'error'} [queueState]
 * @property {GeneratedItemType} type Tipo de item gerado ('flashcard', 'question', 'summary').
 * @property {GeneratedItemStatus} status Lifecycle do buffer; só o backend pode materializar ou aprovar.
 * @property {Record<string, any>} content Conteúdo gerado estruturado conforme o tipo.
 * @property {string[]} tags Tags sugeridas ou atribuídas.
 * @property {string | Date} createdAt Data de geração.
 * @property {string | Date} updatedAt Data da última revisão do item.
 */

/**
 * Modelo de persistência no Firestore para Item Gerado.
 * Caminho: users/{userId}/generated_items/{itemId}
 * @typedef {Object} GeneratedItemEntity
 * @property {string} userId ID do usuário.
 * @property {string | null} [sourceDocumentId] ID do documento.
 * @property {GeneratedItemType} type Tipo gerado.
 * @property {GeneratedItemStatus} status Status de moderação/revisão.
 * @property {Record<string, any>} content Conteúdo.
 * @property {string[]} tags Tags.
 * @property {any} createdAt Firestore Timestamp.
 * @property {any} updatedAt Firestore Timestamp.
 */

/**
 * Validador de DocumentFileType.
 * @param {any} type
 * @returns {type is DocumentFileType}
 */
export function isValidDocumentFileType(type) {
  return typeof type === 'string' && DOCUMENT_FILE_TYPES.includes(type);
}
