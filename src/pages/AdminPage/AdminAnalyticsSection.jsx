import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, BarChart3, Clock3, Loader2, ScatterChart as ScatterIcon } from 'lucide-react';

const Surface = ({ title, subtitle, icon, children }) => (
  <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
    <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-4 dark:border-zinc-900/70 sm:px-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        {React.createElement(icon, { size: 18 })}
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">{title}</h3>
        <p className="text-[11px] font-medium text-zinc-400">{subtitle}</p>
      </div>
    </div>
    <div className="p-3 sm:p-5">{children}</div>
  </section>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const resolvedLabel = label || payload[0]?.payload?.day || payload[0]?.payload?.context;
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{resolvedLabel}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={`${item.dataKey}-${item.name}`} className="flex items-center justify-between gap-5 text-xs">
            <span className="font-semibold text-zinc-500">{item.name}</span>
            <span className="font-black text-zinc-900 dark:text-white">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const EmptyChart = () => (
  <div className="flex h-[270px] items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 px-6 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
    <p className="max-w-sm text-sm font-semibold text-zinc-500 dark:text-zinc-400">Nenhuma atividade real foi encontrada para os filtros selecionados.</p>
  </div>
);

const hasActivity = (daily) => daily.some((item) => item.activeUsers || item.studyMinutes || item.questions);

export default function AdminAnalyticsSection({ datasets, loading = false, error = null }) {
  const daily = datasets?.daily || [];
  const contextDistribution = datasets?.contextDistribution || [];
  const timeVsQuestions = datasets?.timeVsQuestions || [];
  const hasData = hasActivity(daily);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-[28px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-3 text-sm font-bold text-zinc-500"><Loader2 className="animate-spin text-red-600" size={20} /> Carregando analytics...</div>
      </div>
    );
  }

  if (error && !hasData) {
    return (
      <div role="alert" className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
        Não foi possível carregar os indicadores. {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">Analytics</h2>
        <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">Indicadores acadêmicos consolidados com a mesma regra usada no ranking.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Surface title="Linha diária" subtitle="Usuários ativos por dia (usuários)" icon={Activity}>
          {!hasData ? <EmptyChart /> : (
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminActiveUsersFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis dataKey="label" minTickGap={24} tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="activeUsers" name="Usuários ativos" stroke="#ef4444" fill="url(#adminActiveUsersFill)" strokeWidth={2.4} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Surface>

        <Surface title="Evolução acadêmica" subtitle="Horas estudadas (h) e questões realizadas (questões)" icon={Clock3}>
          {!hasData ? <EmptyChart /> : (
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily} margin={{ top: 10, right: 2, left: 2, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis dataKey="label" minTickGap={24} tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="hours" tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} width={34} />
                  <YAxis yAxisId="questions" orientation="right" allowDecimals={false} tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} width={34} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Line yAxisId="hours" type="monotone" dataKey="studyHours" name="Horas" stroke="#ef4444" strokeWidth={2.3} dot={false} />
                  <Line yAxisId="questions" type="monotone" dataKey="questions" name="Questões" stroke="#f59e0b" strokeWidth={2.3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Surface>

        <Surface title="Atividades por origem" subtitle="Registros válidos por ciclo, cronograma e simulado (registros)" icon={BarChart3}>
          {!hasData ? <EmptyChart /> : (
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={contextDistribution} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis dataKey="context" tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="records" name="Registros" fill="#ef4444" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Surface>

        <Surface title="Tempo x questões" subtitle="Relação diária entre horas (h) e questões (questões)" icon={ScatterIcon}>
          {!timeVsQuestions.length ? <EmptyChart /> : (
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis type="number" dataKey="hours" name="Horas" unit="h" tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} />
                  <YAxis type="number" dataKey="questions" name="Questões" unit="q" allowDecimals={false} tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter name="Dias" data={timeVsQuestions} fill="#ef4444" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}
