/**
 * @fileoverview Contratos JSDoc para versionamento semanal de cronogramas e histórico de grades.
 *
 * Modelo de versionamento semanal não-destrutivo:
 * - `semanaTemplate`: Grade semanal ativa / vigente (raiz do documento).
 * - `semanaTemplateVigenteDesde`: Primeiro weekOffset (inteiro >= 0) em que a grade atual passou a vigorar.
 * - `historicoSemanasTemplate`: Mapa de versões arquivadas indexadas por intervalo ou chave estável.
 * - Cronogramas legados sem estes campos assumem `semanaTemplateVigenteDesde = 0` e `historicoSemanasTemplate = {}`.
 */

/**
 * @typedef {Object} CronogramaTemplateSlot
 * @property {string} slotId - Identificador único estável do slot.
 * @property {string} [slotIdBase] - Identificador base no template.
 * @property {number} dia - Dia da semana (0 = Domingo ... 6 = Sábado).
 * @property {number} ordem - Ordem de execução do slot no dia.
 * @property {string} disciplinaId - ID da disciplina vinculada.
 * @property {string} disciplinaNome - Nome da disciplina vinculada.
 * @property {string} [disciplina] - Alias de compatibilidade para disciplinaNome.
 * @property {string|null} [assunto] - Assunto específico planejado para o slot.
 * @property {string|null} [cor] - Cor hexadecimal ou classe da disciplina/slot.
 * @property {number} [tempoMinutos] - Minutos de estudo planejados.
 * @property {number} [tempoPlanejadoMinutos] - Minutos planejados de estudo.
 * @property {number} [minutosEstudo] - Minutos de teoria no slot.
 * @property {number} [minutosBrutoDia] - Minutos brutos disponíveis no dia.
 * @property {number} [minutosRevisaoReservados] - Minutos reservados para revisão no dia.
 * @property {boolean} [isRevisao] - Indica se é slot manual de revisão.
 * @property {boolean} [isRevisaoAuto] - Indica se é revisão espaçada automática (1d/7d/30d).
 * @property {boolean} [isConsolidada] - Indica se é bloco consolidado de revisões.
 * @property {number} [slotIndexParaDisc] - Índice ordinal do slot para a disciplina.
 * @property {number} [totalSlotsParaDisc] - Total de slots da disciplina na semana.
 * @property {boolean} [layoutManual] - Indica se o slot foi posicionado manualmente.
 */

/**
 * @typedef {Object} CronogramaStudyProgressMetadata
 * @property {boolean} cronogramaProgressApplied - Minutos aplicados atomicamente ao plano com este marcador.
 * @property {Object<string, number>} cronogramaProgressAllocations - Minutos reais alocados por slot, sem piso planejado.
 *
 * `markAsFinished`/`assuntoFinalizado` encerram conteúdo, não criam tempo.
 * `progresso` guarda conclusão; `progressoMinutos` guarda duração e pode exceder o planejado.
 * O assunto registrado é histórico separado do assunto planejado, que não é reescrito.
 */

/**
 * @typedef {Object} CronogramaTemplateVersion
 * @property {string} [id] - Identificador único da versão arquivada.
 * @property {number} deSemana - Primeiro weekOffset em que a versão esteve ativa (inclusivo).
 * @property {number} ateSemana - Último weekOffset em que a versão esteve ativa (inclusivo).
 * @property {Array<CronogramaTemplateSlot>} semanaTemplate - Grade semanal da versão.
 * @property {Object<number, number>} [horariosDetalhados] - Horas por dia da semana (0 a 6).
 * @property {Array<Object>} [disciplinasSnapshot] - Snapshot das disciplinas da versão.
 * @property {Object} [metodologiasAplicadas] - Metadados de metodologia de estudo e revisão.
 * @property {number} [tempoRevisaoMinutos] - Limite diário de revisão configurado.
 * @property {number} [duracaoMinimaSessaoMinutos] - Duração mínima do bloco.
 * @property {number} [duracaoMaximaSessaoMinutos] - Duração máxima do bloco.
 * @property {boolean} [usarDuracaoUnica] - Se a versão usava duração única de bloco.
 * @property {number|null} [tempoSessaoMinutos] - Tempo da sessão única quando ativa.
 * @property {string} [arquivadoEm] - Timestamp ISO do momento do arquivamento.
 */

/**
 * @typedef {Object<string, CronogramaTemplateVersion>} HistoricoSemanasTemplate
 */

/**
 * @typedef {Object} CronogramaVersioningFields
 * @property {number} [semanaTemplateVigenteDesde] - Primeiro weekOffset da versão atual (default: 0).
 * @property {HistoricoSemanasTemplate} [historicoSemanasTemplate] - Histórico de versões encerradas.
 */

/**
 * Valida se um objeto representa uma versão arquivada válida de grade semanal.
 *
 * @param {any} version
 * @returns {boolean}
 */
export function isValidTemplateVersion(version) {
  if (!version || typeof version !== 'object') return false;
  if (!Number.isInteger(version.deSemana) || version.deSemana < 0) return false;
  if (!Number.isInteger(version.ateSemana) || version.ateSemana < version.deSemana) return false;
  if (!Array.isArray(version.semanaTemplate)) return false;
  return true;
}
