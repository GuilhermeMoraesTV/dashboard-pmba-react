export const PESO_POR_NIVEL = {
  iniciante: 5,
  intermediario: 3,
  avancado: 1,
};

export const normalizarNivelDominio = (nivel, pesoFallback = 3) => {
  if (nivel === 'iniciante' || nivel === 'intermediario' || nivel === 'avancado') return nivel;
  const peso = Number(pesoFallback) || 3;
  if (peso >= 4) return 'iniciante';
  if (peso <= 1) return 'avancado';
  return 'intermediario';
};

export const obterPesoDisciplina = (disciplina) => {
  const nivelDominio = normalizarNivelDominio(disciplina?.nivelDominio || disciplina?.nivel, disciplina?.peso);
  return Number(disciplina?.peso) || PESO_POR_NIVEL[nivelDominio] || 3;
};

const getActiveDaySessionCapacities = (diasEstudo, tempoSessaoMinutos) => {
  if (!diasEstudo || typeof diasEstudo !== 'object') return [];

  return Object.entries(diasEstudo)
    .map(([dia, horas]) => ({
      dia: Number(dia),
      sessoes: Math.floor(((Number(horas) || 0) * 60) / tempoSessaoMinutos),
    }))
    .filter(({ dia, sessoes }) => Number.isInteger(dia) && dia >= 0 && dia <= 6 && sessoes > 0)
    .sort((a, b) => a.dia - b.dia);
};

export const calcularDistribuicao = (
  disciplinas,
  cargaHorariaTotalMinutos,
  tempoSessaoMinutos = 50,
  options = {}
) => {
  const duracaoSessao = Math.max(1, Number(tempoSessaoMinutos) || 50);
  const totalPesos = disciplinas.reduce((acc, d) => acc + obterPesoDisciplina(d), 0);
  if (totalPesos === 0) {
    return disciplinas.map(d => ({
      ...d,
      tempoAlocadoMinutos: 0,
      sessoesPorCiclo: 1
    }));
  }

  const capacidadesPorDia = getActiveDaySessionCapacities(options.diasEstudo, duracaoSessao);
  const sessoesPelaCarga = capacidadesPorDia.length > 0
    ? capacidadesPorDia.reduce((total, dia) => total + dia.sessoes, 0)
    : Math.floor(Math.max(0, Number(cargaHorariaTotalMinutos) || 0) / duracaoSessao);
  const diasAtivos = capacidadesPorDia.length;
  const minimos = disciplinas.map((disciplina) => (
    disciplina?.estudarTodosDias && diasAtivos > 0 ? diasAtivos : 1
  ));
  const totalMinimo = minimos.reduce((total, valor) => total + valor, 0);
  const totalSessoes = Math.max(totalMinimo, sessoesPelaCarga);
  const rateio = disciplinas.map((disciplina, index) => {
    const peso = obterPesoDisciplina(disciplina);
    return {
      index,
      peso,
      metaPonderada: totalSessoes * (peso / totalPesos),
      sessoes: minimos[index],
    };
  });

  let sobras = Math.max(0, totalSessoes - totalMinimo);
  while (sobras > 0) {
    const proxima = [...rateio].sort((a, b) => {
      const deficitA = a.metaPonderada - a.sessoes;
      const deficitB = b.metaPonderada - b.sessoes;
      return deficitB - deficitA || b.peso - a.peso || a.index - b.index;
    })[0];
    rateio[proxima.index].sessoes += 1;
    sobras -= 1;
  }

  return disciplinas.map((disciplina, index) => {
    const peso = obterPesoDisciplina(disciplina);
    const sessoesPorCiclo = rateio[index].sessoes;
    const tempoAlocadoMinutos = sessoesPorCiclo * duracaoSessao;
    return {
      ...disciplina,
      peso,
      nivelDominio: normalizarNivelDominio(disciplina?.nivelDominio || disciplina?.nivel, disciplina?.peso),
      tempoAlocadoMinutos,
      sessoesPorCiclo,
    };
  });
};

export const gerarOrdemSessoes = (disciplinas, embaralharOffset = 0, options = {}) => {
  if (!Array.isArray(disciplinas) || disciplinas.length === 0) return [];

  const discsOrdenadas = [...disciplinas];

  if (embaralharOffset > 0) {
    const offset = embaralharOffset % discsOrdenadas.length;
    const rotacionadas = [
      ...discsOrdenadas.slice(offset),
      ...discsOrdenadas.slice(0, offset)
    ];
    discsOrdenadas.splice(0, discsOrdenadas.length, ...rotacionadas);
  }

  const restantes = new Map(
    discsOrdenadas.map((disc) => [disc.id, Math.max(0, Number(disc.sessoesPorCiclo) || 0)])
  );
  const indices = new Map(discsOrdenadas.map((disc) => [disc.id, 0]));
  const capacidadesPorDia = getActiveDaySessionCapacities(
    options.diasEstudo,
    Math.max(1, Number(options.tempoSessaoMinutos) || 50)
  );
  const diaria = discsOrdenadas.find((disc) => disc.estudarTodosDias && (restantes.get(disc.id) || 0) > 0);
  const ordem = [];
  let cursor = 0;
  let diasDiariosPendentes = capacidadesPorDia.length;

  const adicionar = (disciplina) => {
    const restante = restantes.get(disciplina.id) || 0;
    if (restante <= 0) return false;
    const sessaoIndex = indices.get(disciplina.id) || 0;
    ordem.push({ disciplinaId: disciplina.id, sessaoIndex });
    restantes.set(disciplina.id, restante - 1);
    indices.set(disciplina.id, sessaoIndex + 1);
    return true;
  };

  const adicionarProxima = (preservarDiaria = false) => {
    for (let tentativa = 0; tentativa < discsOrdenadas.length; tentativa += 1) {
      const index = (cursor + tentativa) % discsOrdenadas.length;
      const candidata = discsOrdenadas[index];
      if ((restantes.get(candidata.id) || 0) <= 0) continue;
      if (
        preservarDiaria &&
        diaria &&
        candidata.id === diaria.id &&
        (restantes.get(candidata.id) || 0) <= diasDiariosPendentes
      ) {
        continue;
      }
      cursor = (index + 1) % discsOrdenadas.length;
      return adicionar(candidata);
    }
    return false;
  };

  capacidadesPorDia.forEach(({ sessoes }) => {
    let usadas = 0;
    if (diaria && adicionar(diaria)) usadas += 1;
    diasDiariosPendentes = Math.max(0, diasDiariosPendentes - 1);
    while (usadas < sessoes && adicionarProxima(true)) usadas += 1;
  });

  while (adicionarProxima()) {
    // Consome sessoes excedentes quando os minimos superam a carga configurada.
  }

  return ordem;
};
