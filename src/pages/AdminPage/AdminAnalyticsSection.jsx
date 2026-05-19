import React from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, CartesianGrid, XAxis, YAxis, Tooltip,
  BarChart, Bar,
} from 'recharts';
import { Activity, BarChart3, Flame, Grid3X3, Layers3, Percent, Users } from 'lucide-react';

const Surface = ({ title, subtitle, icon: Icon, children, action }) => (
  <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-sm overflow-hidden">
    <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-900/60 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 flex items-center justify-center">
          <Icon size={18} />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">{title}</h3>
          <p className="text-[10px] font-medium text-zinc-400">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur px-3 py-2 shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-4 text-xs">
            <span className="font-semibold text-zinc-500">{item.name}</span>
            <span className="font-black text-zinc-900 dark:text-white">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const DailyTrendChart = ({ data }) => (
  <Surface title="Linha Diaria" subtitle="Usuarios, horas e questoes por dia" icon={Activity}>
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="adminUsersFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="activeUsers" name="Usuarios" stroke="#ef4444" fill="url(#adminUsersFill)" strokeWidth={2.2} />
          <Line type="monotone" dataKey="studyHours" name="Horas" stroke="#18181b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="questions" name="Questoes" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  </Surface>
);

const ActivationFunnel = ({ data }) => (
  <Surface title="Funil de Ativacao" subtitle="Queda entre cadastro, ativacao e uso" icon={Flame}>
    <div className="space-y-4">
      {data.map((step, index) => (
        <div key={step.stage} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-zinc-900 dark:text-white">{step.stage}</p>
              <p className="text-[10px] font-semibold text-zinc-400">{step.value} usuarios</p>
            </div>
            <span className="text-xs font-black text-red-600">{step.rate}%</span>
          </div>
          <div className="h-3 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
            <div
              className={`h-full rounded-full ${index === 0 ? 'bg-zinc-400' : index === data.length - 1 ? 'bg-red-500' : 'bg-red-400/80'}`}
              style={{ width: `${Math.max(step.rate, 6)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  </Surface>
);

const RetentionCohort = ({ data }) => {
  const columns = ['w0', 'w1', 'w2', 'w4'];

  const getTone = (value) => {
    if (value >= 75) return 'bg-red-500 text-white';
    if (value >= 50) return 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300';
    if (value >= 25) return 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';
    return 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400';
  };

  return (
    <Surface title="Cohort de Retencao" subtitle="Retorno semanal por semana de entrada" icon={Users}>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="grid grid-cols-[120px_repeat(4,minmax(70px,1fr))] gap-2 mb-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Cohort</div>
            {columns.map((column) => <div key={column} className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 text-center">{column.toUpperCase()}</div>)}
          </div>
          <div className="space-y-2">
            {data.map((row) => (
              <div key={row.cohort} className="grid grid-cols-[120px_repeat(4,minmax(70px,1fr))] gap-2 items-center">
                <div>
                  <p className="text-xs font-black text-zinc-900 dark:text-white">{row.cohort}</p>
                  <p className="text-[10px] font-semibold text-zinc-400">{row.cohortSize} usuarios</p>
                </div>
                {columns.map((column) => (
                  <div key={column} className={`h-12 rounded-2xl flex items-center justify-center text-xs font-black ${getTone(row[column])}`}>
                    {row[column]}%
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Surface>
  );
};

const ActivityHeatmap = ({ data }) => {
  const dayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
  const hourLabels = [0, 6, 12, 18, 23];

  const getCellClass = (intensity) => {
    if (intensity >= 75) return 'bg-red-500';
    if (intensity >= 50) return 'bg-red-300';
    if (intensity >= 25) return 'bg-amber-200';
    if (intensity > 0) return 'bg-zinc-300 dark:bg-zinc-700';
    return 'bg-zinc-100 dark:bg-zinc-900';
  };

  return (
    <Surface title="Heatmap de Atividade" subtitle="Frequencia por dia da semana e hora" icon={Grid3X3}>
      <div className="space-y-3 overflow-x-auto">
        <div className="grid grid-cols-[40px_repeat(24,minmax(12px,1fr))] gap-1 min-w-[620px]">
          <div />
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="text-[9px] font-black text-zinc-300 text-center">{hourLabels.includes(hour) ? hour : ''}</div>
          ))}
          {dayLabels.map((dayLabel, dayIndex) => (
            <React.Fragment key={dayLabel}>
              <div className="text-[10px] font-black text-zinc-400 flex items-center">{dayLabel}</div>
              {data.filter((cell) => cell.dayIndex === dayIndex).map((cell) => (
                <div
                  key={`${dayLabel}-${cell.hour}`}
                  title={`${cell.label}: ${cell.value} registros`}
                  className={`h-5 rounded-md ${getCellClass(cell.intensity)}`}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </Surface>
  );
};

const DisciplineDistribution = ({ data, onSelect }) => (
  <Surface title="Distribuicao por Disciplina" subtitle="Top disciplinas por horas estudadas" icon={Layers3}>
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
          <YAxis dataKey="disciplina" type="category" width={96} tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="hours" name="Horas" fill="#ef4444" radius={[0, 10, 10, 0]} onClick={(entry) => onSelect?.(entry?.activePayload?.[0]?.payload || entry?.payload || null)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </Surface>
);

const AccuracyDistribution = ({ data, onSelect }) => (
  <Surface title="Distribuicao de Precisao" subtitle="Faixas de acerto nos registros com questoes" icon={Percent}>
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" name="Registros" fill="#18181b" radius={[10, 10, 0, 0]} onClick={(entry) => onSelect?.(entry?.activePayload?.[0]?.payload || entry?.payload || null)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </Surface>
);

export default function AdminAnalyticsSection({ datasets, onDisciplineSelect, onAccuracySelect }) {
  const dailySeries = (datasets?.daily30d || []).map((item) => ({
    ...item,
    studyHours: Number((item.studyMinutes / 60).toFixed(1)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">Visao Gerencial</h2>
          <p className="text-xs font-medium text-zinc-400">Leitura rapida de crescimento, ativacao, retencao e qualidade.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DailyTrendChart data={dailySeries} />
        </div>
        <ActivationFunnel data={datasets?.activationFunnel || []} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RetentionCohort data={datasets?.retentionCohort || []} />
        <ActivityHeatmap data={datasets?.activityHeatmap || []} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DisciplineDistribution data={datasets?.disciplineDistribution || []} onSelect={onDisciplineSelect} />
        <AccuracyDistribution data={datasets?.accuracyDistribution || []} onSelect={onAccuracySelect} />
      </div>
    </div>
  );
}
