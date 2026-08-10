import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calculatePlanningPriorityBase,
  getImportanceLevel,
  getKnowledgeLevel,
  hasCompletePlanningLevels,
  isHighRelevance,
} from '../src/utils/planningPriority.js';

describe('planning priority levels', () => {
  it('migra conhecimento legado para a escala de 1 a 5', () => {
    assert.equal(getKnowledgeLevel({ nivelDominio: 'iniciante' }), 1);
    assert.equal(getKnowledgeLevel({ nivelDominio: 'intermediario' }), 3);
    assert.equal(getKnowledgeLevel({ nivelDominio: 'avancado' }), 5);
  });

  it('usa peso legado como importancia apenas em dados existentes', () => {
    assert.equal(getImportanceLevel({ peso: 4 }), 4);
    assert.equal(getImportanceLevel({ importanciaNivel: 0 }, { allowLegacy: false }), 0);
  });

  it('exige os dois niveis definidos de 1 a 5', () => {
    assert.equal(hasCompletePlanningLevels({ conhecimentoNivel: 0, importanciaNivel: 5 }), false);
    assert.equal(hasCompletePlanningLevels({ conhecimentoNivel: 1, importanciaNivel: 5 }), true);
  });

  it('marca alta relevancia somente a partir da importancia 4', () => {
    assert.equal(isHighRelevance({ importanciaNivel: 3 }), false);
    assert.equal(isHighRelevance({ importanciaNivel: 4 }), true);
    assert.equal(isHighRelevance({ importanciaNivel: 5 }), true);
  });

  it('equilibra necessidade de conhecimento e importancia em 50 por cento', () => {
    assert.equal(
      calculatePlanningPriorityBase({ conhecimentoNivel: 1, importanciaNivel: 1 }),
      calculatePlanningPriorityBase({ conhecimentoNivel: 5, importanciaNivel: 5 }),
    );
  });
});
