import React, { useMemo, useState, useEffect } from 'react';
import { parseISO, startOfToday, subDays, eachDayOfInterval, format } from 'date-fns';
import { LayoutDashboard, BarChart3 } from 'lucide-react';

import DesempenhoHeader from './DesempenhoHeader';
import DesempenhoResumo from './DesempenhoResumo';
import DesempenhoDetalhado from './DesempenhoDetalhado';
import { useForceUnlock } from '../../hooks/useForceUnlock';

// ============================================================================
// UTILS
// ============================================================================
export const formatTime = (minutes) => {
  if (!minutes || isNaN(minutes)) return '0h 0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
const DesempenhoPage = ({
  registrosEstudo = [],
  activeCicloId,
  activeCronogramaId,
  activeCicloData,
  activeCronogramaData,
  disciplinasDoCiclo = [],
  onCreateCycle,
}) => {
  useForceUnlock();
  const [timeRange, setTimeRange] = useState('30D');
  const [selectedDiscipline, setSelectedDiscipline] = useState('ALL');
  const [selectedTopic, setSelectedTopic] = useState('ALL');
  const [selectedContext, setSelectedContext] = useState(() => {
    try { return localStorage.getItem('homeContextPreferred') || 'cronograma'; } catch { return 'cronograma'; }
  });

  const hasCiclo = !!activeCicloId;
  const hasCronograma = !!activeCronogramaId;
  const effectiveContext = useMemo(() => {
    if (hasCiclo && hasCronograma) return selectedContext === 'ciclo' ? 'ciclo' : 'cronograma';
    if (hasCiclo) return 'ciclo';
    if (hasCronograma) return 'cronograma';
    return 'all';
  }, [hasCiclo, hasCronograma, selectedContext]);

  const disciplinasDoCronograma = useMemo(() => {
    const snapshot = activeCronogramaData?.disciplinasSnapshot;
    if (Array.isArray(snapshot)) return snapshot;
    const rawTemplate = activeCronogramaData?.semanaTemplate;
    const template = Array.isArray(rawTemplate) ? rawTemplate : rawTemplate ? Object.values(rawTemplate) : [];
    const map = new Map();
    template.forEach((slot) => {
      const nome = slot?.disciplinaNome || slot?.disciplina;
      if (!nome) return;
      const id = slot?.disciplinaId || nome;
      if (!map.has(id)) map.set(id, { id, nome, assuntos: [] });
    });
    return Array.from(map.values());
  }, [activeCronogramaData]);

  const disciplinasDoContexto = effectiveContext === 'cronograma' ? disciplinasDoCronograma : disciplinasDoCiclo;

  // ── DATA ENGINE ──────────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    // CORREÇÃO 7: 'ALL_TIME' mostra TODOS os registros, sem filtro de contexto
    // Os outros ranges filtram por contexto ativo (ciclo/cronograma)
    const isAllTime = timeRange === 'ALL_TIME';

    const today = startOfToday();
    let startDate;
    let daysInPeriod = 30;

    if (timeRange === '7D')        { startDate = subDays(today, 7);  daysInPeriod = 7;  }
    else if (timeRange === '15D')  { startDate = subDays(today, 15); daysInPeriod = 15; }
    else if (timeRange === '30D')  { startDate = subDays(today, 30); daysInPeriod = 30; }
    else if (timeRange === 'ALL_TIME') { daysInPeriod = 365; } // sem startDate → sem limite
    else                           { daysInPeriod = 90; } // CYCLE

    // ── 1. Filtro de contexto ──────────────────────────────────────────────
    let baseRecords;

    const contextId = effectiveContext === 'ciclo' ? activeCicloId : activeCronogramaId;
    if (effectiveContext !== 'all' && !contextId) return null;

    baseRecords = effectiveContext === 'all'
      ? [...registrosEstudo]
      : registrosEstudo.filter(r => (
          effectiveContext === 'ciclo'
            ? r.cicloId === contextId && !r.cronogramaId
            : r.cronogramaId === contextId
        ));

    // ── 2. Filtro de período ──────────────────────────────────────────────
    if (startDate) {
      baseRecords = baseRecords.filter(r => r.data && parseISO(r.data) >= startDate);
    }

    // ── 3. Disciplinas disponíveis e filtro de disciplinas excluídas ─────────
    // CORREÇÃO 1: Simulados não aparecem como disciplinas.
    const nonSimuladoRecordsRaw = baseRecords.filter(r => r.tipoEstudo !== 'Simulado');

    // CORREÇÃO 1B: disciplinas ativas do ciclo (exclui as com inCiclo === false).
    const cycleDisciplines = disciplinasDoContexto?.length
      ? disciplinasDoContexto.filter(d => d.inCiclo !== false).map(d => d.nome)
      : [];

    // Conjunto de nomes ativos — se o ciclo tem disciplinas definidas, usamos como
    // lista de referência. No modo ALL_TIME sem ciclo, aceitamos todas.
    const activeDisciplineNames = cycleDisciplines.length > 0 ? new Set(cycleDisciplines) : null;

    // CORREÇÃO 1C: filtrar registros históricos de disciplinas que já foram excluídas.
    // Só aplica quando há um ciclo ativo com disciplinas definidas e não é ALL_TIME.
    const nonSimuladoRecords = (activeDisciplineNames && !isAllTime)
      ? nonSimuladoRecordsRaw.filter(r =>
          !r.disciplinaNome || activeDisciplineNames.has(r.disciplinaNome)
        )
      : nonSimuladoRecordsRaw;

    const recordDisciplines = activeDisciplineNames
      ? [...new Set(nonSimuladoRecords.map(r => r.disciplinaNome).filter(Boolean))]
          .filter(nome => activeDisciplineNames.has(nome))
      : [...new Set(nonSimuladoRecords.map(r => r.disciplinaNome).filter(Boolean))];

    let disciplinesAvailable = [...new Set([...cycleDisciplines, ...recordDisciplines])].sort();

    // ── 4. Assuntos disponíveis ───────────────────────────────────────────
    let topicsAvailable = [];
    if (selectedDiscipline !== 'ALL') {
      const discData = disciplinasDoContexto.find(d => d.nome === selectedDiscipline);
      if (discData?.assuntos) {
        topicsAvailable = discData.assuntos
          .map(a => typeof a === 'object' ? (a.nome || a.texto || '') : a)
          .filter(Boolean);
      }
      const recordedTopics = nonSimuladoRecords
        .filter(r => r.disciplinaNome === selectedDiscipline)
        .map(r => r.assunto)
        .filter(Boolean);
      topicsAvailable = [...new Set([...topicsAvailable, ...recordedTopics])].sort();
    } else {
      topicsAvailable = [...new Set(nonSimuladoRecords.map(r => r.assunto).filter(Boolean))].sort();
    }

    // ── 5. Aplicar filtros de disciplina/assunto ──────────────────────────
    let filteredRecords = baseRecords;

    // CORREÇÃO 1C: excluir registros de disciplinas excluídas do ciclo (não ALL_TIME)
    if (activeDisciplineNames && !isAllTime) {
      filteredRecords = filteredRecords.filter(r =>
        r.tipoEstudo === 'Simulado' || !r.disciplinaNome || activeDisciplineNames.has(r.disciplinaNome)
      );
    }

    if (selectedDiscipline !== 'ALL') {
      filteredRecords = filteredRecords.filter(r =>
        r.tipoEstudo !== 'Simulado' && r.disciplinaNome === selectedDiscipline
      );
    }

    if (selectedTopic !== 'ALL' && selectedDiscipline !== 'ALL') {
      filteredRecords = filteredRecords.filter(r => r.assunto === selectedTopic);
    }

    // ── 6. Registros para os gráficos de distribuição/radar (sem simulados como grupo) ──
    // CORREÇÃO 1: gráficos de disciplina excluem simulados
    const filteredRecordsNoSimulado = selectedDiscipline === 'ALL'
      ? filteredRecords.filter(r => r.tipoEstudo !== 'Simulado')
      : filteredRecords;

    // ── 7. Agregação ──────────────────────────────────────────────────────
    let totalTime = 0, totalQuestions = 0, totalCorrect = 0;
    const datesMap = {};
    const topicsMap = {};
    const uniqueDays = new Set();

    filteredRecords.forEach(r => {
      const t = Number(r.tempoEstudadoMinutos) || 0;
      const q = Number(r.questoesFeitas) || 0;
      const c = Number(r.acertos) || 0;
      const d = r.data;
      const subj = r.disciplinaNome || 'Geral';
      const topic = r.assunto || 'Geral';

      if (t > 0 || q > 0) {
        totalTime += t;
        totalQuestions += q;
        totalCorrect += c;
        if (d) {
          uniqueDays.add(d);
          if (!datesMap[d]) datesMap[d] = { time: 0, q: 0, c: 0 };
          datesMap[d].time += t;
          datesMap[d].q += q;
          datesMap[d].c += c;
        }
      }

      // topicsMap só inclui registros não-simulado para o ranking/matriz
      if (r.tipoEstudo !== 'Simulado') {
        const key = `${subj} - ${topic}`;
        if (!topicsMap[key]) topicsMap[key] = { disciplina: subj, assunto: topic, time: 0, q: 0, c: 0 };
        topicsMap[key].time += t;
        topicsMap[key].q += q;
        topicsMap[key].c += c;
      }
    });

    const accuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
    const daysCount = uniqueDays.size;
    const consistency = daysInPeriod > 0 ? (daysCount / daysInPeriod) * 100 : 0;

    // ── 8. Evolução temporal ──────────────────────────────────────────────
    // CORREÇÃO 4: accuracy = null nos dias/meses sem questões, para a linha não cair
    // a zero (recharts com connectNulls={false} simplesmente não desenha esses pontos).
    // timeHours = null quando zero, para a área não criar "platôs" enganosos.
    let evolutionData = [];
    if (startDate) {
      evolutionData = eachDayOfInterval({ start: startDate, end: today }).map(day => {
        const dKey = format(day, 'yyyy-MM-dd');
        const dData = datesMap[dKey] || { time: 0, q: 0, c: 0 };
        return {
          date: format(day, 'dd/MM'),
          timeHours: dData.time > 0 ? Number((dData.time / 60).toFixed(1)) : null,
          accuracy: dData.q > 0 ? Math.round((dData.c / dData.q) * 100) : null,
        };
      });
    } else {
      // ALL_TIME: agrupa por mês
      const monthMap = {};
      Object.entries(datesMap).forEach(([dateStr, data]) => {
        const month = dateStr.substring(0, 7);
        if (!monthMap[month]) monthMap[month] = { time: 0, q: 0, c: 0 };
        monthMap[month].time += data.time;
        monthMap[month].q += data.q;
        monthMap[month].c += data.c;
      });
      evolutionData = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          date: month.substring(5) + '/' + month.substring(2, 4),
          timeHours: data.time > 0 ? Number((data.time / 60).toFixed(1)) : null,
          accuracy: data.q > 0 ? Math.round((data.c / data.q) * 100) : null,
        }));
    }

    const tableData = Object.values(topicsMap).sort((a, b) => b.time - a.time);

    return {
      kpis: { totalTime, totalQuestions, totalCorrect, accuracy, daysCount, consistency },
      evolutionData,
      tableData,
      disciplinesAvailable,
      topicsAvailable,
      filteredRecords: filteredRecordsNoSimulado, // sem simulados para gráficos de disciplina
      filteredRecordsAll: filteredRecords,         // com simulados para KPIs
    };
  }, [
    registrosEstudo, activeCicloId, activeCronogramaId, effectiveContext,
    timeRange, selectedDiscipline, selectedTopic, disciplinasDoContexto,
  ]);

  useEffect(() => { setSelectedTopic('ALL'); }, [selectedDiscipline]);
  useEffect(() => {
    setSelectedDiscipline('ALL');
    setSelectedTopic('ALL');
  }, [effectiveContext]);

  const handleContextChange = (value) => {
    setSelectedContext(value);
    try {
      localStorage.setItem('homeContextPreferred', value);
      window.dispatchEvent(new CustomEvent('home-context-preferred-change', { detail: value }));
    } catch {}
  };

  // ── EMPTY STATE ──────────────────────────────────────────────────────────
  const hasContext = hasCiclo || hasCronograma;

  // Permite renderizar se for ALL_TIME (mesmo sem contexto ativo)
  if (!hasContext && timeRange !== 'ALL_TIME') {
    return (
      <div className="p-0 min-h-[50vh] animate-fade-in pb-12">
        <div className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4 md:pb-6">
          <div className="flex items-center gap-3 mb-1 md:mb-2">
            <div className="p-2 md:p-2.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-500 rounded-xl">
              <BarChart3 size={24} className="md:w-7 md:h-7" strokeWidth={2} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-zinc-800 dark:text-white tracking-tight uppercase">
              Desempenho
            </h1>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
          <LayoutDashboard size={40} className="md:w-12 md:h-12 text-zinc-300 mb-4" />
          <h3 className="text-lg md:text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-1">Sem Dados de Desempenho</h3>
          <p className="text-zinc-500 text-sm mb-6">
            Ative um ciclo ou cronograma e registre ao menos uma sessão de estudo para visualizar suas métricas.
          </p>
          {onCreateCycle && (
            <button onClick={onCreateCycle} className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700">
              Ativar Novo Ciclo
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!analytics) return (
    <div className="p-10 text-center text-zinc-500" style={{ touchAction: 'pan-y', overscrollBehavior: 'auto' }}>
      Carregando análise...
    </div>
  );

  return (
    <div className="w-full pb-20 space-y-6" style={{ touchAction: 'pan-y', overscrollBehavior: 'auto' }}>
      <DesempenhoHeader
        analytics={analytics}
        filters={{ timeRange, setTimeRange, selectedDiscipline, setSelectedDiscipline, selectedTopic, setSelectedTopic }}
        options={{ disciplines: analytics.disciplinesAvailable, topics: analytics.topicsAvailable }}
        context={{
          selected: effectiveContext,
          setSelected: handleContextChange,
          activeCicloData,
          activeCronogramaData,
          hasCiclo,
          hasCronograma,
        }}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <DesempenhoResumo
          filteredRecords={analytics.filteredRecords}
          evolutionData={analytics.evolutionData}
          tableData={analytics.tableData}
        />
        <DesempenhoDetalhado
          tableData={analytics.tableData}
          evolutionData={analytics.evolutionData}
        />
      </div>
    </div>
  );
};

export default DesempenhoPage;
