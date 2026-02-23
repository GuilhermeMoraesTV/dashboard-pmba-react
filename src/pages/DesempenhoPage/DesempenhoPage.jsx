import React, { useMemo, useState, useEffect } from 'react';
import { parseISO, startOfToday, subDays, eachDayOfInterval, format } from 'date-fns';
import { LayoutDashboard, PlusCircle, BarChart3 } from 'lucide-react';

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
const DesempenhoPage = ({ registrosEstudo = [], activeCicloId, disciplinasDoCiclo = [], onCreateCycle }) => {
    useForceUnlock();
  const [timeRange, setTimeRange] = useState('30D');
  const [selectedDiscipline, setSelectedDiscipline] = useState('ALL');
  const [selectedTopic, setSelectedTopic] = useState('ALL');

  // ── DATA ENGINE ──
  const analytics = useMemo(() => {
    if (!activeCicloId) return null;

    const today = startOfToday();
    let startDate;
    let daysInPeriod = 30;

    if (timeRange === '7D')       { startDate = subDays(today, 7);  daysInPeriod = 7;  }
    else if (timeRange === '15D') { startDate = subDays(today, 15); daysInPeriod = 15; }
    else if (timeRange === '30D') { startDate = subDays(today, 30); daysInPeriod = 30; }
    else                          { daysInPeriod = 90; }

    let filteredRecords = registrosEstudo.filter(r => r.cicloId === activeCicloId);

    if (startDate) {
      filteredRecords = filteredRecords.filter(r => r.data && parseISO(r.data) >= startDate);
    }

    // Disciplinas disponíveis
    let disciplinesAvailable = disciplinasDoCiclo?.length
      ? disciplinasDoCiclo.map(d => d.nome).sort()
      : [...new Set(filteredRecords.map(r => r.disciplinaNome).filter(Boolean))].sort();

    if (selectedDiscipline !== 'ALL') {
      filteredRecords = filteredRecords.filter(r => r.disciplinaNome === selectedDiscipline);
    }

    // Assuntos disponíveis
    let topicsAvailable = [];
    if (selectedDiscipline !== 'ALL') {
      const discData = disciplinasDoCiclo.find(d => d.nome === selectedDiscipline);
      if (discData?.assuntos) {
        topicsAvailable = discData.assuntos.map(a => typeof a === 'object' ? (a.nome || a.texto || '') : a).filter(Boolean);
      }
      const recorded = filteredRecords.map(r => r.assunto).filter(Boolean);
      topicsAvailable = [...new Set([...topicsAvailable, ...recorded])].sort();
    } else {
      topicsAvailable = [...new Set(filteredRecords.map(r => r.assunto).filter(Boolean))].sort();
    }

    if (selectedTopic !== 'ALL' && selectedDiscipline !== 'ALL') {
      filteredRecords = filteredRecords.filter(r => r.assunto === selectedTopic);
    }

    // Agregação
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

      const key = `${subj} - ${topic}`;
      if (!topicsMap[key]) topicsMap[key] = { disciplina: subj, assunto: topic, time: 0, q: 0, c: 0 };
      topicsMap[key].time += t;
      topicsMap[key].q += q;
      topicsMap[key].c += c;
    });

    const accuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
    const daysCount = uniqueDays.size;
    const consistency = daysInPeriod > 0 ? (daysCount / daysInPeriod) * 100 : 0;

    // Evolução temporal
    let evolutionData = [];
    if (startDate) {
      evolutionData = eachDayOfInterval({ start: startDate, end: today }).map(day => {
        const dKey = format(day, 'yyyy-MM-dd');
        const dData = datesMap[dKey] || { time: 0, q: 0, c: 0 };
        return {
          date: format(day, 'dd/MM'),
          timeHours: Number((dData.time / 60).toFixed(1)),
          accuracy: dData.q > 0 ? Math.round((dData.c / dData.q) * 100) : 0
        };
      });
    }

    const tableData = Object.values(topicsMap).sort((a, b) => b.time - a.time);

    const weakTopics = tableData
      .filter(t => t.q >= 3)
      .map(t => ({
        name: t.assunto.length > 20 ? t.assunto.substring(0, 20) + '...' : t.assunto,
        fullTopic: t.assunto,
        discipline: t.disciplina,
        accuracy: Math.round((t.c / t.q) * 100),
        volume: t.q
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);

    return {
      kpis: { totalTime, totalQuestions, totalCorrect, accuracy, daysCount, consistency },
      evolutionData,
      weakTopics,
      tableData,
      disciplinesAvailable,
      topicsAvailable
    };
  }, [registrosEstudo, activeCicloId, timeRange, selectedDiscipline, selectedTopic, disciplinasDoCiclo]);

  useEffect(() => {
    setSelectedTopic('ALL');
  }, [selectedDiscipline]);

  // ── EMPTY STATE ──
  if (!activeCicloId) {
    return (
      <div className="p-0 min-h-[50vh] animate-fade-in pb-12">
        {/* Título igual ao CiclosList */}
        <div className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4 md:pb-6">
          <div>
            <div className="flex items-center gap-3 mb-1 md:mb-2">
              <div className="p-2 md:p-2.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-500 rounded-xl">
                <BarChart3 size={24} className="md:w-7 md:h-7" strokeWidth={2} />
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-zinc-800 dark:text-white tracking-tight uppercase">
                Desempenho
              </h1>
            </div>
          </div>
        </div>

        {/* Empty state no padrão CiclosList */}
        <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
          <LayoutDashboard size={40} className="md:w-12 md:h-12 text-zinc-300 mb-4" />
          <h3 className="text-lg md:text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-1">Sem Dados de Desempenho</h3>
          <p className="text-zinc-500 text-sm mb-6">Ative um ciclo e registre ao menos uma sessão de estudo para visualizar suas métricas.</p>
          {onCreateCycle && (
            <button
              onClick={onCreateCycle}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700"
            >
              Ativar Novo Ciclo
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!analytics) return (
    <div
      className="p-10 text-center text-zinc-500"
      style={{ touchAction: 'pan-y', overscrollBehavior: 'auto' }}
    >
      Carregando análise...
    </div>
  );

  return (
    <div
      className="w-full pb-20 space-y-6"
      style={{ touchAction: 'pan-y', overscrollBehavior: 'auto' }}
    >
      {/* Header: título + score ring + KPI pills + filtros */}
      <DesempenhoHeader
        analytics={analytics}
        filters={{ timeRange, setTimeRange, selectedDiscipline, setSelectedDiscipline, selectedTopic, setSelectedTopic }}
        options={{ disciplines: analytics.disciplinesAvailable, topics: analytics.topicsAvailable }}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Distribuição (pizza) + Evolução temporal */}
        <DesempenhoResumo
          registrosEstudo={registrosEstudo}
          activeCicloId={activeCicloId}
          evolutionData={analytics.evolutionData}
          tableData={analytics.tableData}
        />

        {/* Insights + Heatmap + Matriz + Ranking */}
        <DesempenhoDetalhado
          tableData={analytics.tableData}
          evolutionData={analytics.evolutionData}
        />
      </div>
    </div>
  );
};

export default DesempenhoPage;