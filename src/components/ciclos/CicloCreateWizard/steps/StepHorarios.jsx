import React from 'react';
import Step3Horarios from '../../../cronograma/Step3Horarios';

export default function StepHorarios({
  horarios,
  setHorarios,
  editalSelecionado,
  duracaoMinimaSessaoMinutos,
  setDuracaoMinimaSessaoMinutos,
  duracaoMaximaSessaoMinutos,
  setDuracaoMaximaSessaoMinutos,
}) {
  const config = {
    mostrarModoMontagem: false,
    duracaoMinimaSessaoMinutos,
    duracaoMaximaSessaoMinutos,
  };

  return (
    <Step3Horarios
      horarios={horarios}
      onHorariosChange={setHorarios}
      editalSelecionado={editalSelecionado}
      config={config}
      onConfigChange={(next) => {
        setDuracaoMinimaSessaoMinutos(next.duracaoMinimaSessaoMinutos);
        setDuracaoMaximaSessaoMinutos(next.duracaoMaximaSessaoMinutos);
      }}
    />
  );
}
