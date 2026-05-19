import React from 'react';
import Step2Disciplinas from '../../../cronograma/Step2Disciplinas';

export default function StepDisciplinas({
  disciplinas,
  setDisciplinas,
  extraDisciplinas,
  setExtraDisciplinas,
  selecaoDisciplinas,
  setSelecaoDisciplinas,
  editalSelecionado,
  modoManual,
  horarios,
}) {
  return (
    <Step2Disciplinas
      disciplinas={disciplinas}
      onDisciplinasChange={setDisciplinas}
      extraDisciplinas={extraDisciplinas}
      onExtraDisciplinasChange={setExtraDisciplinas}
      selecao={selecaoDisciplinas}
      onSelecaoChange={setSelecaoDisciplinas}
      editalSelecionado={editalSelecionado}
      modoManual={modoManual}
      horarios={horarios}
    />
  );
}
