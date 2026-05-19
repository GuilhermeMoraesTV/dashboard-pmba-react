import React from 'react';
import Step3Horarios from '../../../cronograma/Step3Horarios';

export default function StepHorarios({ horarios, setHorarios, editalSelecionado }) {
  return (
    <Step3Horarios
      horarios={horarios}
      onHorariosChange={setHorarios}
      editalSelecionado={editalSelecionado}
    />
  );
}
