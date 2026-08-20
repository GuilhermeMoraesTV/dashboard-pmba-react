import React, { useEffect, useMemo } from 'react';
import Step3Horarios from '../../../cronograma/Step3Horarios';

export default function StepHorarios({
  horarios,
  setHorarios,
  editalSelecionado,
  usarDuracaoUnica = true,
  ocultarConfiguracaoDuracao = false,
  duracaoMinimaSessaoMinutos,
  setDuracaoMinimaSessaoMinutos,
  duracaoMaximaSessaoMinutos,
  setDuracaoMaximaSessaoMinutos,
}) {
  const tempoBlocoMinutos = Math.max(
    5,
    Number(duracaoMaximaSessaoMinutos || duracaoMinimaSessaoMinutos) || 60,
  );
  const limiteDiarioMinutos = useMemo(() => {
    const diasAtivos = Object.values(horarios || {})
      .map((horas) => Math.round((Number(horas) || 0) * 60))
      .filter((minutos) => minutos > 0);
    return diasAtivos.length > 0 ? Math.min(...diasAtivos) : 240;
  }, [horarios]);

  useEffect(() => {
    if (!usarDuracaoUnica) return;
    const proximoTempo = Math.max(5, Math.min(tempoBlocoMinutos, limiteDiarioMinutos));
    if (
      Number(duracaoMinimaSessaoMinutos) === proximoTempo
      && Number(duracaoMaximaSessaoMinutos) === proximoTempo
    ) return;
    setDuracaoMinimaSessaoMinutos(proximoTempo);
    setDuracaoMaximaSessaoMinutos(proximoTempo);
  }, [
    duracaoMaximaSessaoMinutos,
    duracaoMinimaSessaoMinutos,
    limiteDiarioMinutos,
    setDuracaoMaximaSessaoMinutos,
    setDuracaoMinimaSessaoMinutos,
    tempoBlocoMinutos,
    usarDuracaoUnica,
  ]);

  const config = {
    mostrarModoMontagem: false,
    ocultarConfiguracaoDuracao,
    usarDuracaoUnica,
    tempoSessaoMinutos: Math.min(tempoBlocoMinutos, limiteDiarioMinutos),
    duracaoMinimaSessaoMinutos,
    duracaoMaximaSessaoMinutos,
    maxDuracaoSessaoMinutos: limiteDiarioMinutos,
  };

  return (
    <Step3Horarios
      horarios={horarios}
      onHorariosChange={setHorarios}
      editalSelecionado={editalSelecionado}
      config={config}
      onConfigChange={(next) => {
        if (next.usarDuracaoUnica !== true) {
          setDuracaoMinimaSessaoMinutos(Math.max(5, Number(next.duracaoMinimaSessaoMinutos) || 30));
          setDuracaoMaximaSessaoMinutos(Math.max(5, Number(next.duracaoMaximaSessaoMinutos) || 60));
          return;
        }

        const proximoTempo = Math.max(
          5,
          Math.min(Number(next.tempoSessaoMinutos) || 5, limiteDiarioMinutos),
        );
        setDuracaoMinimaSessaoMinutos(proximoTempo);
        setDuracaoMaximaSessaoMinutos(proximoTempo);
      }}
    />
  );
}
