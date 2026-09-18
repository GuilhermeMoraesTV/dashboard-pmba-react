/**
 * @fileoverview Contratos de identidade de rodada e persistência de progresso dos ciclos.
 */

/**
 * @typedef {Object} CycleRoundIdentity
 * @property {number} conclusoes Número monotônico da rodada atual; começa em zero.
 * @property {number} roundIdentityVersion Versão do contrato de segregação das rodadas.
 * @property {number} cycleProgressContractVersion Versão do contrato atômico/idempotente de progresso.
 * @property {Object<string, {roundVersion: number}>} cycleProgressOperations Operações aplicadas na rodada atual.
 * @property {Object<string, number>} cycleRoundMinutesByDisciplineUntilIdeal Resumo incremental usado no fechamento.
 * @property {string} lastCycleProgressOperationId Última mutação protegida, validada pelas Rules.
 */

/**
 * @typedef {Object} CycleStudyRecordIdentity
 * @property {string} cicloId Identificador do ciclo.
 * @property {number} cicloRoundVersion Cópia de `ciclo.conclusoes` capturada ao iniciar ou registrar o estudo.
 * @property {number} cycleProgressContractVersion Versão do contrato de gravação.
 * @property {string} cycleProgressOperationId Identidade estável e idempotente da submissão.
 * @property {Object<string, {minutes: number, plannedMinutes: number}>} cycleProgressAllocations Deltas exatos aplicados por bloco.
 * @property {number|null|undefined} [conclusaoId] Rodada histórica arquivada; não define a rodada ativa.
 */

export {};
