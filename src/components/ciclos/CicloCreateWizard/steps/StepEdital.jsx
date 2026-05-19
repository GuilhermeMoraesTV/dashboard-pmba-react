import React, { useMemo } from 'react';
import { Step1_Edital as Step1EditalCronograma } from '../../../cronograma/Step1Edital';

export default function StepEdital({
  idModeloSelecionado,
  selecionarManual,
  selecionarModelo,
  modelos,
  carregandoModelos,
  onAbrirSuporte,
}) {
  const editalSelecionado = useMemo(() => {
    if (idModeloSelecionado === 'manual') {
      return { id: 'manual', titulo: 'Manual', disciplinas: [] };
    }

    if (!idModeloSelecionado) return null;

    return modelos.find((m) => m.id === idModeloSelecionado) || null;
  }, [idModeloSelecionado, modelos]);

  const handleSelect = (edital) => {
    if (!edital) return;
    if (edital.id === 'manual') {
      selecionarManual();
      return;
    }
    selecionarModelo(edital);
  };

  return (
    <div className="w-full">
      <Step1EditalCronograma
        editalSelecionado={editalSelecionado}
        modelos={modelos}
        carregando={carregandoModelos}
        onSelect={handleSelect}
        onAbrirSuporte={onAbrirSuporte}
      />
    </div>
  );
}
