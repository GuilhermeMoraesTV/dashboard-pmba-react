import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Ban,
  BarChart3,
  BookOpen,
  Calendar,
  Filter,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Flame,
  Gamepad2,
  LayoutDashboard,
  LockKeyhole,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Target,
  TrendingUp,
  Trophy,
  Users,
  X,
  Search,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAdminUser360, getMinutes, getQuestions, getCorrect, toDateSafe } from '../../hooks/useAdminUser360';
import {
  adminRecalculateUserStats,
  adminRecomputeUserGamification,
  adminSendUserNotification,
  adminUpdateUserAccess,
  adminUpdateUserStatus,
} from '../../services/adminApi';
import CicloVisual from '../ciclos/CicloVisual';
import CardSessoesCicloHoje from '../ciclos/CardSessoesCicloHoje';
import CalendarTab from '../dashboard/CalendarTab';
import AdminUserActionConfirmModal from './AdminUserActionConfirmModal';

const TAB_ITEMS = [
  { id: 'overview', label: 'Visao Geral', icon: BarChart3 },
  { id: 'performance', label: 'Desempenho', icon: TrendingUp },
  { id: 'schedule', label: 'Cronograma', icon: Calendar },
  { id: 'cycle', label: 'Ciclo', icon: LayoutDashboard },
  { id: 'history', label: 'Historico', icon: Activity },
  { id: 'reviews', label: 'Revisoes', icon: BookOpen },
  { id: 'simulations', label: 'Simulados', icon: ClipboardList },
  { id: 'gamification', label: 'Gamificacao', icon: Gamepad2 },
  { id: 'risk', label: 'Risco', icon: ShieldAlert },
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
];

const formatDuration = (minutes) => {
  const safe = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(safe / 60);
  const remaining = safe % 60;
  if (hours > 0) return `${hours}h ${remaining}m`;
  return `${remaining}m`;
};

const formatDateTime = (value) => {
  const date = toDateSafe(value);
  if (!date) return '-';
  return date.toLocaleString('pt-BR');
};

const formatDateOnly = (value) => {
  const date = toDateSafe(value);
  if (!date) return '-';
  return date.toLocaleDateString('pt-BR');
};

const Avatar = ({ user }) => (
  <div className="w-20 h-20 rounded-3xl flex-shrink-0 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 border-4 border-white dark:border-zinc-800 shadow-xl overflow-hidden flex items-center justify-center ring-1 ring-zinc-200 dark:ring-zinc-700">
    {user?.photoURL ? (
      <img src={user.photoURL} alt={user?.name} className="w-full h-full object-cover" />
    ) : (
      <span className="font-black text-zinc-400 dark:text-zinc-500 text-2xl">
        {user?.name ? user.name.substring(0, 2).toUpperCase() : <Users size={24} />}
      </span>
    )}
  </div>
);

const StatCard = ({ icon: Icon, label, value, subtext, tone = 'zinc' }) => {
  const tones = {
    zinc: 'bg-zinc-50 dark:bg-zinc-800/70 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300',
    red: 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-300',
    blue: 'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/40 text-blue-600 dark:text-blue-300',
    green: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-300',
    amber: 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/40 text-amber-600 dark:text-amber-300',
  };

  return (
    <div className={`rounded-[24px] border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70 mb-1">{label}</p>
          <p className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">{value}</p>
          {subtext ? <p className="text-xs font-semibold opacity-70 mt-1">{subtext}</p> : null}
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/70 p-2.5 dark:border-zinc-700 dark:bg-zinc-800/60">
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
};

const SectionCard = ({ title, subtitle, action, children }) => (
  <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800/70">
    <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-900/70 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">{title}</p>
        {subtitle ? <p className="text-[11px] font-medium text-zinc-400 mt-1">{subtitle}</p> : null}
      </div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="rounded-[28px] border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/20 px-6 py-12 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-600">
      <Icon size={24} />
    </div>
    <p className="text-sm font-black text-zinc-700 dark:text-zinc-200 mt-4">{title}</p>
    <p className="text-xs font-medium text-zinc-500 max-w-sm mx-auto mt-1 leading-relaxed">{description}</p>
  </div>
);

const ProgressRow = ({ item, accent = 'bg-red-500', secondary }) => {
  const progressWidth = item.coverage != null ? item.coverage : Math.min(100, Math.round((item.accuracy || 0)));

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{item.name}</p>
          <p className="text-[11px] font-medium text-zinc-500 mt-1">
            {secondary || `${item.sessions} sessoes • ${formatDuration(item.minutes)} • ${item.questions} questoes`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-black text-zinc-900 dark:text-white">{item.coverage != null ? `${item.coverage}%` : `${item.accuracy}%`}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">{item.coverage != null ? 'cobertura' : 'precisao'}</p>
        </div>
      </div>
      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full ${accent}`} style={{ width: `${progressWidth}%` }} />
      </div>
      {item.totalTopics > 0 ? (
        <p className="text-[11px] font-semibold text-zinc-500 mt-2">
          {item.studiedTopics}/{item.totalTopics} assuntos vistos
        </p>
      ) : null}
    </div>
  );
};

const SmallBadge = ({ children, tone = 'zinc' }) => {
  const tones = {
    zinc: 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800',
    red: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 border-red-100 dark:border-red-900/40',
    amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-300 border-amber-100 dark:border-amber-900/40',
    green: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/40',
    blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-300 border-blue-100 dark:border-blue-900/40',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${tones[tone]}`}>
      {children}
    </span>
  );
};

const MiniMetric = ({ label, value, hint, tone = 'zinc' }) => {
  const tones = {
    zinc: 'bg-zinc-50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800',
    red: 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/40',
    amber: 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40',
    green: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40',
    blue: 'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40',
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{label}</p>
      <p className="text-xl font-black text-zinc-900 dark:text-white mt-2">{value}</p>
      {hint ? <p className="text-[11px] font-semibold text-zinc-500 mt-1">{hint}</p> : null}
    </div>
  );
};

const TimelineEntryCard = ({ entry }) => (
  <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800/70">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <SmallBadge tone={entry.type === 'simulado' ? 'blue' : entry.contexto === 'Cronograma' ? 'amber' : entry.contexto === 'Ciclo' ? 'red' : 'zinc'}>
            {entry.type === 'simulado' ? 'Simulado' : entry.contexto}
          </SmallBadge>
          {entry.type === 'study' && entry.disciplinaNome ? <SmallBadge tone="zinc">{entry.disciplinaNome}</SmallBadge> : null}
          <span className="text-[11px] font-semibold text-zinc-400">{formatDateTime(entry.date)}</span>
        </div>
        <p className="text-sm font-bold text-zinc-900 dark:text-white mt-3">{entry.title}</p>
        <p className="text-xs font-medium text-zinc-500 mt-1">{entry.subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        {entry.type === 'simulado' ? (
          <>
            <p className="text-sm font-black text-zinc-900 dark:text-white">{entry.score || 0} pts</p>
            <p className="text-[11px] font-semibold text-zinc-500">{entry.accuracy || 0}%</p>
          </>
        ) : (
          <>
            <p className="text-sm font-black text-zinc-900 dark:text-white">{formatDuration(entry.minutes || 0)}</p>
            <p className="text-[11px] font-semibold text-zinc-500">{entry.questions || 0}q • {entry.accuracy || 0}%</p>
          </>
        )}
      </div>
    </div>
  </div>
);

const OverviewTab = ({ data }) => {
  const { analytics, activeCycle, activeCronograma } = data;
  const allTime = analytics.allTime;
  const risk = analytics.risk;
  const latest = analytics.timeline[0];

  return (
    <div className="space-y-5 pb-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Horas Totais" value={`${allTime.hours}h`} subtext={`${allTime.minutes} min registrados`} />
        <StatCard icon={Zap} label="Questoes" value={allTime.questions} subtext={`${allTime.correct} corretas`} tone="blue" />
        <StatCard icon={Target} label="Precisao Global" value={`${allTime.accuracy}%`} subtext="Taxa de acerto consolidada" tone={allTime.accuracy >= 70 ? 'green' : 'red'} />
        <StatCard icon={ShieldAlert} label="Status de Risco" value={risk.status} subtext={risk.daysInactive != null ? `${risk.daysInactive} dias desde o ultimo estudo` : 'Sem historico ainda'} tone={risk.severity >= 8 ? 'red' : risk.severity >= 5 ? 'amber' : 'green'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <SectionCard title="Leitura Executiva" subtitle="Contexto ativo, revisoes e tracao recente">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-[24px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <SmallBadge tone="red">Ciclo ativo</SmallBadge>
                  {activeCycle ? <ChevronRight size={16} className="text-zinc-300" /> : null}
                </div>
                {activeCycle ? (
                  <>
                    <p className="text-lg font-black text-zinc-900 dark:text-white">{activeCycle.nome || 'Ciclo'}</p>
                    <p className="text-xs font-medium text-zinc-500 mt-1">
                      {data.analytics.cycleSummary?.sessoesConcluidas || 0}/{data.analytics.cycleSummary?.totalSessoes || 0} sessoes concluidas
                    </p>
                    <div className="flex gap-2 flex-wrap mt-3">
                      <SmallBadge tone="zinc">{formatDuration(data.analytics.cycleSummary?.tempoSessaoMinutos || 0)} por sessao</SmallBadge>
                      <SmallBadge tone="amber">{data.analytics.pendingCycleReviews.length} revisoes pendentes</SmallBadge>
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-medium text-zinc-500">Nenhum ciclo ativo encontrado.</p>
                )}
              </div>

              <div className="rounded-[24px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <SmallBadge tone="blue">Cronograma ativo</SmallBadge>
                  {activeCronograma ? <ChevronRight size={16} className="text-zinc-300" /> : null}
                </div>
                {activeCronograma ? (
                  <>
                    <p className="text-lg font-black text-zinc-900 dark:text-white">{activeCronograma.nome || 'Cronograma'}</p>
                    <p className="text-xs font-medium text-zinc-500 mt-1">
                      Inicio {formatDateOnly(data.analytics.cronogramaSummary?.dataInicio)} • fim {formatDateOnly(data.analytics.cronogramaSummary?.dataFim)}
                    </p>
                    <div className="flex gap-2 flex-wrap mt-3">
                      <SmallBadge tone="zinc">{data.analytics.cronogramaSummary?.totalHorasSemanais || 0}h/sem</SmallBadge>
                      <SmallBadge tone="amber">{data.analytics.cronogramaBuckets.hoje.length + data.analytics.cronogramaBuckets.atrasadas.length} revisoes abertas</SmallBadge>
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-medium text-zinc-500">Nenhum cronograma ativo encontrado.</p>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Ultimo Movimento" subtitle="Leitura rapida do evento mais recente">
          {latest ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <SmallBadge tone={latest.type === 'simulado' ? 'blue' : 'red'}>
                  {latest.type === 'simulado' ? 'Simulado' : latest.contexto}
                </SmallBadge>
                <span className="text-[11px] font-semibold text-zinc-400">{formatDateTime(latest.date)}</span>
              </div>
              <div>
                <p className="text-lg font-black text-zinc-900 dark:text-white">{latest.title}</p>
                <p className="text-xs font-medium text-zinc-500 mt-1">{latest.subtitle}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Tempo</p>
                  <p className="text-sm font-bold text-zinc-900 dark:text-white">{latest.minutes != null ? formatDuration(latest.minutes) : `${latest.score || 0} pts`}</p>
                </div>
                <div className="rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Resultado</p>
                  <p className="text-sm font-bold text-zinc-900 dark:text-white">
                    {latest.questions != null ? `${latest.questions}q` : `${latest.accuracy || 0}%`}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon={Activity} title="Sem historico ainda" description="Assim que o aluno registrar estudos ou simulados, a leitura executiva aparece aqui." />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <SectionCard title="Horas, Questoes e Precisao por Periodo" subtitle="Agregado recente para leitura de intensidade">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {analytics.periodStats.map((period) => (
              <div key={period.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{period.label}</p>
                <p className="text-lg font-black text-zinc-900 dark:text-white mt-2">{period.hours}h</p>
                <p className="text-xs font-medium text-zinc-500 mt-1">{period.questions} questoes • {period.accuracy}%</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Sinais de Risco" subtitle="Monitoramento de churn e queda de tracao">
          {risk.signals.length ? (
            <div className="space-y-3">
              {risk.signals.slice(0, 4).map((signal) => (
                <div key={signal.title} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{signal.title}</p>
                    <SmallBadge tone={signal.level === 'critico' ? 'red' : signal.level === 'alto' ? 'amber' : 'zinc'}>
                      {signal.level}
                    </SmallBadge>
                  </div>
                  <p className="text-xs font-medium text-zinc-500 mt-2">{signal.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="Sem alertas relevantes" description="A leitura atual do aluno esta saudavel nas principais dimensoes acompanhadas." />
          )}
        </SectionCard>
      </div>
    </div>
  );
};

const PerformanceTab = ({ data }) => {
  const trendData = data.analytics.trendData;
  const disciplineData = data.analytics.overallDisciplineProgress.slice(0, 8);

  return (
    <div className="space-y-5 pb-10">
      <SectionCard title="Evolucao Recente" subtitle="Horas, questoes e precisao nos ultimos 14 dias">
        {trendData.some((item) => item.minutes > 0 || item.questions > 0) ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 12, right: 10, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="admin-user-hours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="hours" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} width={32} />
                <YAxis yAxisId="accuracy" orientation="right" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  contentStyle={{ borderRadius: 16, borderColor: '#e4e4e7', background: '#fff' }}
                  formatter={(value, name) => {
                    if (name === 'hours') return [`${value}h`, 'Horas'];
                    if (name === 'accuracy') return [`${value}%`, 'Precisao'];
                    return [value, name];
                  }}
                />
                <Area yAxisId="hours" type="monotone" dataKey="hours" stroke="#ef4444" fill="url(#admin-user-hours)" strokeWidth={2.5} />
                <Area yAxisId="accuracy" type="monotone" dataKey="accuracy" stroke="#2563eb" fillOpacity={0} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState icon={TrendingUp} title="Sem movimento recente" description="Nao ha estudo suficiente na janela recente para montar a curva de desempenho." />
        )}
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <SectionCard title="Progresso por Disciplina" subtitle="Leitura agregada do historico do aluno">
          {disciplineData.length ? (
            <div className="space-y-3">
              {disciplineData.map((item) => (
                <ProgressRow key={item.id} item={item} secondary={`${formatDuration(item.minutes)} • ${item.questions} questoes • ${item.accuracy}%`} />
              ))}
            </div>
          ) : (
            <EmptyState icon={BookOpen} title="Sem disciplinas mapeadas" description="Os registros de estudo ainda nao sao suficientes para montar a distribuicao por disciplina." />
          )}
        </SectionCard>

        <SectionCard title="Comparativo de Janela" subtitle="Carga, questoes e precisao por periodo">
          <div className="grid grid-cols-1 gap-3">
            {data.analytics.periodStats.map((period) => (
              <div key={period.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-zinc-900 dark:text-white">{period.label}</p>
                  <SmallBadge tone={period.accuracy >= 70 ? 'green' : period.accuracy >= 50 ? 'amber' : 'red'}>
                    {period.accuracy}%
                  </SmallBadge>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Horas</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">{period.hours}h</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Questoes</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">{period.questions}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Sessoes</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">{period.sessions}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

const ScheduleTab = ({ data }) => {
  const cronograma = data.activeCronograma;
  const cronogramaSummary = data.analytics.cronogramaSummary;
  const progress = data.analytics.cronogramaProgress.slice(0, 8);
  const reviewBuckets = data.analytics.cronogramaBuckets;
  const plan = data.analytics.cronogramaPlan;
  const disciplineInsights = data.analytics.cronogramaDisciplineInsights.slice(0, 10);
  const todayKey = new Date().toISOString().slice(0, 10);

  if (!cronograma) {
    return <EmptyState icon={Calendar} title="Sem cronograma ativo" description="Quando o aluno tiver um cronograma ativo, este painel mostra progresso, revisoes e datas reais do plano." />;
  }

  return (
    <div className="space-y-5 pb-10">
      <SectionCard title="Cronograma Ativo" subtitle="Leitura do plano atual do aluno">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon={Calendar} label="Cronograma" value={cronograma.nome || 'Cronograma'} subtext={`Semana ${data.analytics.weekOffsetAtual + 1}`} tone="blue" />
          <StatCard icon={FileText} label="Edital" value={cronogramaSummary?.edital || 'Nao informado'} subtext={cronogramaSummary?.banca || 'Sem banca'} />
          <StatCard icon={CheckCircle2} label="Progresso" value={`${plan?.progress || 0}%`} subtext={`${plan?.completedSlots || 0}/${plan?.totalSlots || 0} slots`} tone="green" />
          <StatCard icon={Clock} label="Periodo" value={formatDateOnly(cronogramaSummary?.dataFim)} subtext={`Inicio ${formatDateOnly(cronogramaSummary?.dataInicio)}`} tone="red" />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <SectionCard title="Panorama Operacional" subtitle="Carga, janela e situacao real do plano">
          <div className="space-y-4">
            <div className="rounded-[24px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-black text-zinc-900 dark:text-white">Execucao consolidada do cronograma</p>
                  <p className="text-xs font-medium text-zinc-500 mt-1">
                    {formatDuration(plan?.completedMinutes || 0)} executados de {formatDuration(plan?.totalMinutes || 0)} planejados
                  </p>
                </div>
                <SmallBadge tone={(plan?.progress || 0) >= 70 ? 'green' : (plan?.progress || 0) >= 40 ? 'amber' : 'red'}>
                  {plan?.progress || 0}% concluido
                </SmallBadge>
              </div>
              <div className="h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${plan?.progress || 0}%` }} />
              </div>
              <div className="flex gap-2 flex-wrap mt-3">
                <SmallBadge tone="blue">{cronogramaSummary?.totalHorasSemanais || 0}h/sem</SmallBadge>
                <SmallBadge tone="zinc">{cronogramaSummary?.disciplinas || 0} disciplinas</SmallBadge>
                <SmallBadge tone="amber">{cronogramaSummary?.totalSemanas || 0} semanas</SmallBadge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MiniMetric label="Slots pendentes" value={plan?.pendingSlots || 0} hint={`${plan?.futureSlots || 0} futuros`} tone="amber" />
              <MiniMetric label="Slots atrasados" value={plan?.overdueSlots || 0} hint={`${plan?.todaySlots || 0} para hoje`} tone={(plan?.overdueSlots || 0) > 0 ? 'red' : 'green'} />
              <MiniMetric label="Revisoes abertas" value={reviewBuckets.hoje.length + reviewBuckets.atrasadas.length} hint={`${reviewBuckets.proximas.length} proximas`} tone="blue" />
              <MiniMetric label="Periodo real" value={cronogramaSummary?.totalSemanas || 0} hint="Semanas previstas" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Progresso por Disciplina" subtitle="Leitura do historico dentro do cronograma ativo">
          {progress.length ? (
            <div className="space-y-3">
              {progress.map((item) => (
                <ProgressRow key={item.id} item={item} accent="bg-blue-500" />
              ))}
            </div>
          ) : (
            <EmptyState icon={BookOpen} title="Sem progresso ainda" description="O cronograma esta ativo, mas ainda nao ha registros suficientes vinculados a ele." />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <SectionCard title="Slots do Plano" subtitle="Concluidos, pendentes e proximos blocos">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <MiniMetric label="Concluidos" value={plan?.completedSlots || 0} tone="green" />
            <MiniMetric label="Pendentes" value={plan?.pendingSlots || 0} tone="amber" />
            <MiniMetric label="Hoje" value={plan?.todaySlots || 0} tone="blue" />
            <MiniMetric label="Atrasados" value={plan?.overdueSlots || 0} tone={(plan?.overdueSlots || 0) > 0 ? 'red' : 'zinc'} />
          </div>

          {plan?.upcomingSlots?.length ? (
            <div className="space-y-3">
              {plan.upcomingSlots.map((slot) => (
                <div key={`${slot.slotId}_${slot.dataSlot}`} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{slot.disciplinaNome || 'Disciplina'}</p>
                      <p className="text-xs font-medium text-zinc-500 mt-1">{slot.assunto || 'Assunto nao informado'}</p>
                    </div>
                    <SmallBadge tone={slot.dataSlot < todayKey ? 'red' : slot.dataSlot === todayKey ? 'blue' : 'zinc'}>
                      {formatDateOnly(slot.dataSlot)}
                    </SmallBadge>
                  </div>
                  <div className="flex gap-2 flex-wrap mt-3">
                    <SmallBadge tone="zinc">{formatDuration(slot.tempoMinutos || slot.minutosEstudo || 0)}</SmallBadge>
                    <SmallBadge tone="amber">Semana {(Number(slot.weekOffset || 0) + 1)}</SmallBadge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="Plano em dia" description="Nao ha slots pendentes suficientes para montar uma fila operacional neste momento." />
          )}
        </SectionCard>

        <SectionCard title="Revisoes do Cronograma" subtitle="Separacao clara entre hoje, atrasadas e proximas">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Hoje</p>
              <p className="text-2xl font-black text-zinc-900 dark:text-white mt-2">{reviewBuckets.hoje.length}</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Atrasadas</p>
              <p className="text-2xl font-black text-zinc-900 dark:text-white mt-2">{reviewBuckets.atrasadas.length}</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Proximas</p>
              <p className="text-2xl font-black text-zinc-900 dark:text-white mt-2">{reviewBuckets.proximas.length}</p>
            </div>
          </div>

          {reviewBuckets.hoje.length || reviewBuckets.atrasadas.length || reviewBuckets.proximas.length ? (
            <div className="space-y-3">
              {[...reviewBuckets.hoje.slice(0, 2), ...reviewBuckets.atrasadas.slice(0, 2), ...reviewBuckets.proximas.slice(0, 2)].map((review) => (
                <div key={`${review.slotId}_${review.dataSlot}`} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{review.disciplinaNome || 'Revisao'}</p>
                    <SmallBadge tone={review.concluido ? 'green' : 'amber'}>
                      {review.concluido ? 'concluida' : 'pendente'}
                    </SmallBadge>
                  </div>
                  <p className="text-xs font-medium text-zinc-500 mt-1">{review.assunto || 'Assunto nao informado'}</p>
                  <p className="text-[11px] font-semibold text-zinc-400 mt-2">
                    {formatDateOnly(review.dataSlot)} • {formatDuration(review.tempoMinutos || 0)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="Sem revisoes abertas" description="O cronograma ativo nao possui revisoes pendentes na leitura atual." />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Tempo e Frequencia por Disciplina" subtitle="Carga, constancia e ultimo estudo dentro do cronograma">
        {disciplineInsights.length ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {disciplineInsights.map((item) => (
              <div key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800/70">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-xs font-medium text-zinc-500 mt-1">
                      Ultimo estudo {formatDateOnly(item.lastStudyDate)}{item.lastSubject ? ` • ${item.lastSubject}` : ''}
                    </p>
                  </div>
                  <SmallBadge tone={item.accuracy >= 70 ? 'green' : item.accuracy >= 50 ? 'amber' : 'red'}>
                    {item.accuracy}% precisao
                  </SmallBadge>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Tempo</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">{formatDuration(item.minutes)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Frequencia</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">{item.activeDays} dias</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Sessoes</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">{item.sessions}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={BookOpen} title="Sem historico suficiente" description="Assim que o aluno acumular registros no cronograma ativo, esta grade mostra tempo, frequencia e ultimo estudo por disciplina." />
        )}
      </SectionCard>
    </div>
  );
};

const CycleTab = ({ data }) => {
  const cycle = data.activeCycle;
  const cycleSummary = data.analytics.cycleSummary;
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState(null);
  const disciplinasComProgresso = data.cycleDisciplines.map((disciplina) => ({
    ...disciplina,
    progressoEstudadoMinutos: data.analytics.cycleRecords
      .filter((record) => record.disciplinaId === disciplina.id)
      .reduce((acc, record) => acc + getMinutes(record), 0),
  }));
  const canConcludeCiclo = (data.analytics.cycleSummary?.totalSessoes || 0) > 0
    && (data.analytics.cycleSummary?.sessoesConcluidas || 0) >= (data.analytics.cycleSummary?.totalSessoes || 0);

  if (!cycle) {
    return <EmptyState icon={LayoutDashboard} title="Sem ciclo ativo" description="Quando houver um ciclo ativo, este painel mostra progresso real por disciplina e pendencias de revisao do ciclo." />;
  }

  return (
    <div className="space-y-5 pb-10">
      <SectionCard title="Ciclo Ativo" subtitle="Visao operacional do ciclo atual">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon={LayoutDashboard} label="Nome" value={cycle.nome || 'Ciclo'} subtext={cycle.tipo || 'Ciclo padrao'} tone="red" />
          <StatCard icon={Clock} label="Sessao Padrao" value={formatDuration(cycleSummary?.tempoSessaoMinutos || 0)} subtext="Duracao definida no ciclo" />
          <StatCard icon={CheckCircle2} label="Sessoes Concluidas" value={cycleSummary?.sessoesConcluidas || 0} subtext={`${cycleSummary?.totalSessoes || 0} sessoes no total`} tone="green" />
          <StatCard icon={BookOpen} label="Revisoes Pendentes" value={data.analytics.pendingCycleReviews.length} subtext="Fila do ciclo ativo" tone="amber" />
        </div>
      </SectionCard>

      <SectionCard title="Ciclo Visual em Tempo Real" subtitle="Espelho do mesmo radar que o aluno enxerga">
        {disciplinasComProgresso.length ? (
          <div className="space-y-6">
            <CicloVisual
              selectedDisciplinaId={selectedDisciplinaId}
              onSelectDisciplina={setSelectedDisciplinaId}
              onViewDetails={() => {}}
              onStartStudy={() => {}}
              disciplinas={disciplinasComProgresso}
              registrosEstudo={data.analytics.cycleRecords}
              viewMode="total"
              ciclo={cycle}
              canConcludeCiclo={canConcludeCiclo}
              onMarcarSessao={() => {}}
              onConcluirCiclo={() => {}}
              cicloActionLoading={false}
            />

            <div className="relative overflow-hidden rounded-[32px] border border-zinc-200 bg-zinc-50/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50 md:p-5">
              <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-red-500/8 blur-3xl dark:bg-red-500/10" />
              <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Guia do ciclo</p>
                <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white mt-1">
                  Fila do dia do usuario
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  A mesma recomendacao diaria do ciclo sendo acompanhada em tempo real no admin.
                </p>
              </div>

              <div className="relative z-10 mt-4">
                <CardSessoesCicloHoje
                  ciclo={cycle}
                  disciplinas={data.cycleDisciplines}
                  onIniciarSessao={() => {}}
                  onToggleSessao={() => {}}
                  loadingSessionId={null}
                  variant="cycle"
                />
              </div>
            </div>
          </div>
        ) : (
          <EmptyState icon={LayoutDashboard} title="Ciclo sem disciplinas" description="O ciclo ativo existe, mas ainda nao trouxe disciplinas suficientes para espelhar o radar visual." />
        )}
      </SectionCard>

      <SectionCard title="Calendario Real do Usuario" subtitle="Mesmo calendario do aluno com contexto de ciclo e cronograma">
        <div className="-m-2 md:-m-3">
          <CalendarTab
            registrosEstudo={data.records}
            goalsHistory={data.goalsHistory}
            onDeleteRegistro={() => {}}
            activeCicloData={cycle}
            activeCronogramaData={data.activeCronograma}
          />
        </div>
      </SectionCard>
    </div>
  );
};

const HistoryTabLegacy = ({ data }) => (
  <div className="space-y-5 pb-10">
    <SectionCard title="Timeline de Estudos" subtitle="Historico bruto separado da leitura agregada">
      {data.analytics.timeline.length ? (
        <div className="space-y-3">
          {data.analytics.timeline.slice(0, 80).map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800/70">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SmallBadge tone={entry.type === 'simulado' ? 'blue' : entry.contexto === 'Cronograma' ? 'amber' : 'red'}>
                      {entry.type === 'simulado' ? 'Simulado' : entry.contexto}
                    </SmallBadge>
                    <span className="text-[11px] font-semibold text-zinc-400">{formatDateTime(entry.date)}</span>
                  </div>
                  <p className="text-sm font-bold text-zinc-900 dark:text-white mt-3">{entry.title}</p>
                  <p className="text-xs font-medium text-zinc-500 mt-1">{entry.subtitle}</p>
                </div>
                <div className="shrink-0 text-right">
                  {entry.type === 'simulado' ? (
                    <>
                      <p className="text-sm font-black text-zinc-900 dark:text-white">{entry.score || 0} pts</p>
                      <p className="text-[11px] font-semibold text-zinc-500">{entry.accuracy || 0}%</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-black text-zinc-900 dark:text-white">{formatDuration(entry.minutes || 0)}</p>
                      <p className="text-[11px] font-semibold text-zinc-500">{entry.questions || 0}q • {entry.questions ? Math.round((entry.correct / entry.questions) * 100) : 0}%</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Activity} title="Sem timeline ainda" description="Quando o aluno registrar estudos ou simulados, a trilha cronologica aparecera aqui." />
      )}
    </SectionCard>
  </div>
);

const HistoryTab = ({ data }) => {
  const [search, setSearch] = useState('');
  const [selectedContext, setSelectedContext] = useState('Todos');
  const [selectedType, setSelectedType] = useState('Todos');
  const [selectedDiscipline, setSelectedDiscipline] = useState('Todas');

  const filteredTimeline = useMemo(() => {
    const query = search.trim().toLowerCase();

    return data.analytics.timeline.filter((entry) => {
      const contextValue = entry.type === 'simulado' ? 'Simulado' : entry.contexto;
      const typeValue = entry.type === 'simulado' ? 'Simulado' : 'Estudo';
      const disciplineValue = entry.type === 'study' ? entry.disciplinaNome : 'Todas';
      const matchesContext = selectedContext === 'Todos' || contextValue === selectedContext;
      const matchesType = selectedType === 'Todos' || typeValue === selectedType;
      const matchesDiscipline = selectedDiscipline === 'Todas' || disciplineValue === selectedDiscipline;
      const haystack = [entry.title, entry.subtitle, entry.disciplinaNome, entry.contexto].join(' ').toLowerCase();
      const matchesQuery = !query || haystack.includes(query);

      return matchesContext && matchesType && matchesDiscipline && matchesQuery;
    });
  }, [data.analytics.timeline, search, selectedContext, selectedType, selectedDiscipline]);

  const groupedTimeline = useMemo(() => {
    const grouped = filteredTimeline.reduce((acc, entry) => {
      const key = entry.dateKey || formatDateOnly(entry.date);
      if (!acc[key]) acc[key] = [];
      acc[key].push(entry);
      return acc;
    }, {});

    return Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a))
      .map((dateKey) => ({ dateKey, entries: grouped[dateKey] }));
  }, [filteredTimeline]);

  const filteredMinutes = filteredTimeline
    .filter((entry) => entry.type === 'study')
    .reduce((acc, entry) => acc + Number(entry.minutes || 0), 0);

  return (
    <div className="space-y-5 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Activity} label="Registros" value={filteredTimeline.length} subtext={`${data.analytics.timeline.length} no total`} />
        <StatCard icon={Clock} label="Tempo Filtrado" value={formatDuration(filteredMinutes)} subtext="Apenas estudos" tone="blue" />
        <StatCard icon={BookOpen} label="Disciplinas" value={data.analytics.overallDisciplineInsights.length} subtext="Com historico registrado" />
        <StatCard icon={Calendar} label="Ultima Atividade" value={formatDateOnly(filteredTimeline[0]?.date)} subtext={filteredTimeline[0]?.title || 'Sem atividade'} tone="red" />
      </div>

      <SectionCard title="Filtros da Timeline" subtitle="Refine a leitura cronologica sem perder hierarquia">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
          <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/70 xl:col-span-2">
            <Search size={16} className="text-zinc-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por disciplina, assunto ou contexto"
              className="w-full bg-transparent text-sm font-medium text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400"
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/70">
            <Filter size={16} className="text-zinc-400" />
            <select value={selectedContext} onChange={(event) => setSelectedContext(event.target.value)} className="w-full bg-transparent text-sm font-medium text-zinc-900 dark:text-white outline-none">
              {data.analytics.historyFilters.contexts.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/70">
            <FileText size={16} className="text-zinc-400" />
            <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)} className="w-full bg-transparent text-sm font-medium text-zinc-900 dark:text-white outline-none">
              {data.analytics.historyFilters.types.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/70">
            <BookOpen size={16} className="text-zinc-400" />
            <select value={selectedDiscipline} onChange={(event) => setSelectedDiscipline(event.target.value)} className="w-full bg-transparent text-sm font-medium text-zinc-900 dark:text-white outline-none">
              {data.analytics.historyFilters.disciplines.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <SectionCard title="Visao por Disciplina" subtitle="Tempo, frequencia e ultimo estudo consolidado">
          {data.analytics.overallDisciplineInsights.length ? (
            <div className="space-y-3">
              {data.analytics.overallDisciplineInsights.slice(0, 12).map((item) => (
                <div key={item.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-xs font-medium text-zinc-500 mt-1">
                        Ultimo estudo {formatDateOnly(item.lastStudyDate)}{item.lastSubject ? ` • ${item.lastSubject}` : ''}
                      </p>
                    </div>
                    <SmallBadge tone={item.accuracy >= 70 ? 'green' : item.accuracy >= 50 ? 'amber' : 'red'}>
                      {item.accuracy}% precisao
                    </SmallBadge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Tempo</p>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">{formatDuration(item.minutes)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Frequencia</p>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">{item.activeDays} dias</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Sessoes</p>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">{item.sessions}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={BookOpen} title="Sem historico por disciplina" description="O aluno ainda nao registrou estudos suficientes para consolidar comportamento por disciplina." />
          )}
        </SectionCard>

        <SectionCard title="Timeline Completa" subtitle="Todos os registros filtrados em ordem cronologica">
          {groupedTimeline.length ? (
            <div className="space-y-5">
              {groupedTimeline.map((group) => (
                <div key={group.dateKey} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-zinc-900 dark:text-white">{formatDateOnly(group.dateKey)}</p>
                      <p className="text-[11px] font-medium text-zinc-400">{group.entries.length} registro(s)</p>
                    </div>
                    <SmallBadge tone="zinc">
                      {formatDuration(group.entries.filter((entry) => entry.type === 'study').reduce((acc, entry) => acc + Number(entry.minutes || 0), 0))}
                    </SmallBadge>
                  </div>
                  <div className="space-y-3">
                    {group.entries.map((entry) => <TimelineEntryCard key={entry.id} entry={entry} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Activity} title="Nenhum registro encontrado" description="Ajuste os filtros ou aguarde mais historico do aluno para popular a timeline." />
          )}
        </SectionCard>
      </div>
    </div>
  );
};

const ReviewsTab = ({ data }) => {
  const cycleReviews = data.analytics.pendingCycleReviews;
  const cronogramaReviews = data.analytics.cronogramaBuckets;

  return (
    <div className="space-y-5 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Ciclo Pendentes" value={cycleReviews.length} subtext="Fila do ciclo ativo" tone="amber" />
        <StatCard icon={Calendar} label="Hoje" value={cronogramaReviews.hoje.length} subtext="Cronograma ativo" tone="blue" />
        <StatCard icon={AlertTriangle} label="Atrasadas" value={cronogramaReviews.atrasadas.length} subtext="Precisam de recuperacao" tone="red" />
        <StatCard icon={ChevronRight} label="Proximas" value={cronogramaReviews.proximas.length} subtext="Ate 7 dias" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <SectionCard title="Revisoes do Ciclo" subtitle="Pendencias por data agendada">
          {cycleReviews.length ? (
            <div className="space-y-3">
              {cycleReviews.slice(0, 12).map((review) => (
                <div key={review.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{review.disciplinaNome || 'Revisao'}</p>
                    <SmallBadge tone={String(review.dataAgendada || '') <= new Date().toISOString().slice(0, 10) ? 'amber' : 'zinc'}>
                      {review.dataAgendada || 'sem data'}
                    </SmallBadge>
                  </div>
                  <p className="text-xs font-medium text-zinc-500 mt-1">{review.assunto || 'Sem assunto definido'}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="Sem fila de ciclo" description="Nao ha revisoes pendentes abertas para o ciclo ativo." />
          )}
        </SectionCard>

        <SectionCard title="Revisoes do Cronograma" subtitle="Buckets compartilhados do sistema real">
          {[...cronogramaReviews.hoje, ...cronogramaReviews.atrasadas, ...cronogramaReviews.proximas].length ? (
            <div className="space-y-3">
              {[...cronogramaReviews.hoje.slice(0, 4), ...cronogramaReviews.atrasadas.slice(0, 4), ...cronogramaReviews.proximas.slice(0, 4)].map((review) => (
                <div key={`${review.slotId}_${review.dataSlot}`} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{review.disciplinaNome || 'Revisao'}</p>
                    <SmallBadge tone={cronogramaReviews.atrasadas.some((item) => item.slotId === review.slotId) ? 'red' : cronogramaReviews.hoje.some((item) => item.slotId === review.slotId) ? 'amber' : 'zinc'}>
                      {formatDateOnly(review.dataSlot)}
                    </SmallBadge>
                  </div>
                  <p className="text-xs font-medium text-zinc-500 mt-1">{review.assunto || 'Sem assunto definido'}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="Sem revisoes abertas" description="O cronograma ativo nao apresenta revisoes abertas na leitura atual." />
          )}
        </SectionCard>
      </div>
    </div>
  );
};

const SimulationsTab = ({ data }) => {
  const chartData = data.analytics.simuladoTrend;
  const summary = data.analytics.simuladoSummary;

  return (
    <div className="space-y-5 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={ClipboardList} label="Total" value={summary.total} subtext="Simulados registrados" tone="blue" />
        <StatCard icon={BarChart3} label="Media" value={summary.averageScore} subtext="Pontos liquidos" tone="red" />
        <StatCard icon={Trophy} label="Melhor Nota" value={summary.bestScore} subtext="Maior pontuacao" tone="green" />
        <StatCard icon={TrendingUp} label="Tendencia" value={summary.trend >= 0 ? `+${summary.trend}` : summary.trend} subtext="Ultimo x penultimo" tone={summary.trend >= 0 ? 'green' : 'amber'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <SectionCard title="Curva de Simulados" subtitle="Desempenho ao longo do historico">
          {chartData.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip
                    contentStyle={{ borderRadius: 16, borderColor: '#e4e4e7', background: '#fff' }}
                    formatter={(value, name) => name === 'score' ? [`${value} pts`, 'Pontuacao'] : [`${value}%`, 'Precisao']}
                  />
                  <Bar dataKey="score" radius={[8, 8, 0, 0]} fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={ClipboardList} title="Sem simulados ainda" description="Quando o aluno registrar simulados, este painel exibe curva, ranking e ultimo desempenho." />
          )}
        </SectionCard>

        <SectionCard title="Ultimos Simulados" subtitle="Lista resumida com pontos e precisao">
          {data.simulados.length ? (
            <div className="space-y-3">
              {data.simulados.slice(0, 10).map((simulado) => (
                <div key={simulado.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{simulado.titulo || 'Simulado'}</p>
                      <p className="text-xs font-medium text-zinc-500 mt-1">{simulado.banca || 'Sem banca'} • {formatDateOnly(simulado.data || simulado.timestamp)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-zinc-900 dark:text-white">{Number(simulado?.resumo?.pontosObtidos || 0)} pts</p>
                      <p className="text-[11px] font-semibold text-zinc-500">{Number(simulado?.resumo?.porcentagem || 0)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={ClipboardList} title="Sem historico de simulados" description="Ainda nao ha simulados suficientes para leitura de desempenho." />
          )}
        </SectionCard>
      </div>
    </div>
  );
};

const RiskTab = ({ data }) => {
  const risk = data.analytics.risk;
  const period30 = data.analytics.periodStats.find((item) => item.id === '30d');

  return (
    <div className="space-y-5 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={ShieldAlert} label="Status" value={risk.status} subtext="Leitura consolidada" tone={risk.severity >= 8 ? 'red' : risk.severity >= 5 ? 'amber' : 'green'} />
        <StatCard icon={Flame} label="Dias sem estudo" value={risk.daysInactive ?? '-'} subtext="Baseado no ultimo registro" tone={risk.daysInactive >= 7 ? 'red' : 'zinc'} />
        <StatCard icon={BookOpen} label="Revisoes Abertas" value={data.analytics.pendingCycleReviews.length + data.analytics.cronogramaBuckets.hoje.length + data.analytics.cronogramaBuckets.atrasadas.length} subtext="Ciclo + cronograma" tone="amber" />
        <StatCard icon={Clock} label="Carga 30d" value={`${period30?.hours || 0}h`} subtext={`${period30?.questions || 0} questoes`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <SectionCard title="Sinais Prioritarios" subtitle="Alertas de churn, queda de tracao e desalinhamento">
          {risk.signals.length ? (
            <div className="space-y-3">
              {risk.signals.map((signal) => (
                <div key={signal.title} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{signal.title}</p>
                    <SmallBadge tone={signal.level === 'critico' ? 'red' : signal.level === 'alto' ? 'amber' : signal.level === 'medio' ? 'blue' : 'zinc'}>
                      {signal.level}
                    </SmallBadge>
                  </div>
                  <p className="text-xs font-medium text-zinc-500 mt-2">{signal.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="Painel saudavel" description="Nenhum sinal relevante de risco ou churn foi identificado na leitura atual." />
          )}
        </SectionCard>

        <SectionCard title="Resumo de Contexto" subtitle="O que mais pesa no risco atual">
          <div className="space-y-3">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Plano ativo</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-white mt-2">
                {data.activeCycle || data.activeCronograma ? 'Aluno com contexto ativo' : 'Aluno sem ciclo e sem cronograma'}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Ultimo estudo</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-white mt-2">{formatDateTime(risk.lastStudyDate)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Simulados recentes</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-white mt-2">{data.analytics.simuladoSummary.total} no historico</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

const GamificationTab = ({ data }) => {
  const profile = data.gamificationProfile || {};
  const unlockedAchievements = data.achievements.filter((item) => item.unlocked !== false);
  return (
    <div className="space-y-5 pb-10">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <StatCard icon={Zap} label="XP total" value={Number(profile.totalXP || 0).toLocaleString('pt-BR')} subtext={`XP base ${Number(profile.baseXP || 0).toLocaleString('pt-BR')}`} tone="red" />
        <StatCard icon={TrendingUp} label="XP semanal" value={Number(profile.weeklyCompetitiveXP || profile.weeklyXP || 0).toLocaleString('pt-BR')} subtext={profile.competitiveWeekId || 'Semana nao iniciada'} tone="blue" />
        <StatCard icon={Gamepad2} label="Nivel" value={profile.level || '-'} subtext={profile.ruleVersion ? `Regra ${profile.ruleVersion}` : 'Sem perfil calculado'} tone="green" />
      </div>

      {!data.gamificationProfile ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">Este usuario ainda nao possui <code>gamification/profile</code>. Use a aba Admin para reprocessar a gamificacao.</div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard title="Conquistas" subtitle={`${unlockedAchievements.length} desbloqueadas`}>
          {unlockedAchievements.length ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {unlockedAchievements.slice(0, 20).map((item) => (
                <div key={item.id} className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
                  <p className="text-sm font-black text-zinc-900 dark:text-white">{item.title || item.name || item.id}</p>
                  <p className="mt-1 text-[11px] font-semibold text-zinc-500">{Number(item.xp || item.rewardXP || 0)} XP · {formatDateOnly(item.unlockedAt)}</p>
                </div>
              ))}
            </div>
          ) : <EmptyState icon={Trophy} title="Sem conquistas" description="Nenhuma conquista desbloqueada foi encontrada." />}
        </SectionCard>

        <SectionCard title="Eventos de XP recentes" subtitle="Ultimos 100 eventos carregados">
          {data.xpEvents.length ? (
            <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
              {data.xpEvents.slice(0, 30).map((event) => (
                <div key={event.id} className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
                  <div className="min-w-0"><p className="truncate text-xs font-black text-zinc-900 dark:text-white">{event.message || event.sourceType || event.id}</p><p className="mt-1 text-[10px] font-semibold text-zinc-500">{formatDateTime(event.createdAt)} · {event.isRead ? 'lido' : 'nao lido'}</p></div>
                  <SmallBadge tone={Number(event.xpTotal || event.xp || 0) >= 0 ? 'green' : 'red'}>{Number(event.xpTotal || event.xp || 0)} XP</SmallBadge>
                </div>
              ))}
            </div>
          ) : <EmptyState icon={Zap} title="Sem eventos de XP" description="O historico de pontuacao ainda esta vazio." />}
        </SectionCard>
      </div>
    </div>
  );
};

const AdminActionButton = ({ icon: Icon, children, onClick, disabled, danger = false }) => (
  <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-wider transition disabled:cursor-wait disabled:opacity-50 ${danger ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30' : 'border-zinc-200 text-zinc-600 hover:border-red-200 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-200'}`}>
    {disabled ? <RefreshCw size={15} className="animate-spin" /> : React.createElement(Icon, { size: 15 })} {children}
  </button>
);

const AdminTab = ({ data }) => {
  const user = data.user || {};
  const [running, setRunning] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [sensitiveAction, setSensitiveAction] = useState(null);
  const [access, setAccess] = useState(() => ({
    role: user.access?.role || user.role || 'student',
    adminRole: user.access?.adminRole || '',
    permissions: {
      adminPanel: user.access?.permissions?.adminPanel === true,
      manageBroadcasts: user.access?.permissions?.manageBroadcasts === true,
      manageTemplates: user.access?.permissions?.manageTemplates === true,
      viewAdminAnalytics: user.access?.permissions?.viewAdminAnalytics === true,
    },
  }));

  useEffect(() => {
    setAccess({
      role: user.access?.role || user.role || 'student',
      adminRole: user.access?.adminRole || '',
      permissions: {
        adminPanel: user.access?.permissions?.adminPanel === true,
        manageBroadcasts: user.access?.permissions?.manageBroadcasts === true,
        manageTemplates: user.access?.permissions?.manageTemplates === true,
        viewAdminAnalytics: user.access?.permissions?.viewAdminAnalytics === true,
      },
    });
  }, [user.access, user.role, user.id, user.uid]);

  const run = async (key, operation, success) => {
    setRunning(key);
    setFeedback(null);
    try {
      await operation();
      setFeedback({ type: 'success', message: success });
      return true;
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
      return false;
    } finally {
      setRunning('');
    }
  };

  const changeStatus = (status) => {
    if (status === 'disabled') {
      setSensitiveAction('deactivate');
      return;
    }
    if (!window.confirm(`Confirma alterar o status da conta para ${status}? A acao sera auditada.`)) return;
    run('status', () => adminUpdateUserStatus(data.uid, status), 'Status da conta atualizado no servidor.');
  };

  const confirmSensitiveAction = async () => {
    setSensitiveAction(null);
    await run('status', () => adminUpdateUserStatus(data.uid, 'disabled'), 'Conta desativada no servidor.');
  };

  const sendNotification = () => {
    const title = window.prompt('Titulo da notificacao:', 'Mensagem da administracao');
    if (!title) return;
    const message = window.prompt('Mensagem para o usuario:');
    if (!message) return;
    run('notification', () => adminSendUserNotification(data.uid, { title, message }), 'Notificacao enviada e auditada.');
  };

  const permissions = [
    ['adminPanel', 'Acesso ao painel admin'],
    ['viewAdminAnalytics', 'Visualizar analytics'],
    ['manageBroadcasts', 'Gerenciar comunicacoes'],
    ['manageTemplates', 'Gerenciar editais'],
  ];

  return (
    <div className="space-y-5 pb-10">
      {feedback ? <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'}`}>{feedback.message}</div> : null}

      <SectionCard title="Conta e operacoes sensiveis" subtitle="Executadas por Cloud Function e registradas em auditoria">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AdminActionButton icon={RefreshCw} disabled={Boolean(running)} onClick={() => run('stats', () => adminRecalculateUserStats(data.uid), 'Estatisticas recalculadas.')}>Recalcular stats</AdminActionButton>
          <AdminActionButton icon={Gamepad2} disabled={Boolean(running)} onClick={() => run('gamification', () => adminRecomputeUserGamification(data.uid), 'Gamificacao reprocessada.')}>Recalcular gamificacao</AdminActionButton>
          <AdminActionButton icon={MessageSquare} disabled={Boolean(running)} onClick={sendNotification}>Enviar notificacao</AdminActionButton>
          {(user.status || 'active') === 'active' ? <AdminActionButton icon={Ban} disabled={Boolean(running)} danger onClick={() => changeStatus('blocked')}>Bloquear conta</AdminActionButton> : <AdminActionButton icon={ShieldCheck} disabled={Boolean(running)} onClick={() => changeStatus('active')}>Reativar conta</AdminActionButton>}
          {(user.status || 'active') !== 'disabled' ? <AdminActionButton icon={LockKeyhole} disabled={Boolean(running)} danger onClick={() => changeStatus('disabled')}>Desativar conta</AdminActionButton> : null}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard title="Permissoes" subtitle="Alteracoes de acesso sao validadas no servidor">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Perfil<select value={access.role} onChange={(event) => setAccess((current) => ({ ...current, role: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm normal-case tracking-normal dark:border-zinc-700 dark:bg-zinc-900"><option value="student">Aluno</option><option value="admin">Administrador</option></select></label>
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Papel admin<select value={access.adminRole} onChange={(event) => setAccess((current) => ({ ...current, adminRole: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm normal-case tracking-normal dark:border-zinc-700 dark:bg-zinc-900"><option value="">Nenhum</option><option value="admin">Admin</option><option value="super_admin">Super admin</option></select></label>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{permissions.map(([key, label]) => <label key={key} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs font-bold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200"><input type="checkbox" checked={access.permissions[key]} onChange={(event) => setAccess((current) => ({ ...current, permissions: { ...current.permissions, [key]: event.target.checked } }))} className="h-4 w-4 accent-red-600" />{label}</label>)}</div>
            <AdminActionButton icon={ShieldCheck} disabled={Boolean(running)} onClick={() => run('access', () => adminUpdateUserAccess(data.uid, access), 'Permissoes atualizadas e auditadas.')}>Salvar permissoes</AdminActionButton>
          </div>
        </SectionCard>

        <SectionCard title="Intervencoes recentes" subtitle="Historico administrativo deste usuario">
          {data.auditLogs.length ? <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">{data.auditLogs.slice(0, 30).map((log) => <div key={log.id} className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/30"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black text-zinc-900 dark:text-white">{log.action}</p><SmallBadge tone={log.status === 'success' ? 'green' : 'red'}>{log.status || 'success'}</SmallBadge></div><p className="mt-1 text-[10px] font-semibold text-zinc-500">{log.actorEmail || log.actorUid || 'Admin'} · {formatDateTime(log.createdAt)}</p>{log.error ? <p className="mt-2 text-[11px] font-semibold text-red-600">{log.error}</p> : null}</div>)}</div> : <EmptyState icon={ShieldCheck} title="Sem intervencoes" description="As proximas acoes administrativas aparecerao aqui." />}
        </SectionCard>
      </div>
      <AdminUserActionConfirmModal
        open={sensitiveAction === 'deactivate'}
        action="deactivate"
        user={{ ...user, id: data.uid, uid: data.uid }}
        loading={running === 'status'}
        onClose={() => { if (!running) setSensitiveAction(null); }}
        onConfirm={confirmSensitiveAction}
      />
    </div>
  );
};

const LoadingState = () => (
  <div className="space-y-5 pb-10 animate-pulse">
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((key) => <div key={key} className="h-[104px] rounded-[24px] bg-zinc-100 dark:bg-zinc-900" />)}
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <div className="h-72 rounded-[28px] bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-72 rounded-[28px] bg-zinc-100 dark:bg-zinc-900" />
    </div>
  </div>
);

const AdminUserProfileModal = ({ isOpen, onClose, user }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const data = useAdminUser360({ isOpen, user });

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setActiveTab('overview');
  }, [isOpen, user?.id, user?.uid]);

  const renderTab = useMemo(() => {
    if (data.loading) return <LoadingState />;
    if (activeTab === 'overview') return <OverviewTab data={data} />;
    if (activeTab === 'performance') return <PerformanceTab data={data} />;
    if (activeTab === 'schedule') return <ScheduleTab data={data} />;
    if (activeTab === 'cycle') return <CycleTab data={data} />;
    if (activeTab === 'history') return <HistoryTab data={data} />;
    if (activeTab === 'reviews') return <ReviewsTab data={data} />;
    if (activeTab === 'simulations') return <SimulationsTab data={data} />;
    if (activeTab === 'gamification') return <GamificationTab data={data} />;
    if (activeTab === 'admin') return <AdminTab data={data} />;
    return <RiskTab data={data} />;
  }, [activeTab, data]);

  if (!isOpen || !user || typeof document === 'undefined') return null;

  const totalMinutes = data.records.reduce((acc, record) => acc + getMinutes(record), 0);
  const totalQuestions = data.records.reduce((acc, record) => acc + getQuestions(record), 0);
  const totalCorrect = data.records.reduce((acc, record) => acc + getCorrect(record), 0);
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  return createPortal(
    <div className="fixed inset-0 z-[10030] flex items-center justify-center p-3 sm:p-5">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-7xl flex-col overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-h-[calc(100dvh-40px)]"
      >
        <div className="relative z-10 flex flex-col justify-between gap-6 bg-gradient-to-b from-zinc-50/90 to-white/0 p-6 pb-0 dark:from-zinc-800/80 dark:to-zinc-900/0 xl:flex-row xl:items-end">
          <div className="flex items-center gap-5 min-w-0">
            <Avatar user={user} />
            <div className="min-w-0">
              <h2 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white tracking-tight truncate">
                {user.name} <span className="text-red-600">.</span>
              </h2>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
              <div className="flex gap-2 flex-wrap mt-3">
                <SmallBadge tone="zinc">{formatDuration(totalMinutes)}</SmallBadge>
                <SmallBadge tone="blue">{totalQuestions} questoes</SmallBadge>
                <SmallBadge tone={accuracy >= 70 ? 'green' : 'amber'}>{accuracy}% precisao</SmallBadge>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar perfil 360"
            className="absolute top-4 right-4 p-2 bg-zinc-100 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 mt-6 mb-2">
          <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl overflow-x-auto">
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === tab.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              >
                {activeTab === tab.id ? <motion.div layoutId="admin-user-360-tab" className="absolute inset-0 bg-red-600 rounded-xl -z-10" /> : null}
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative flex-1 overflow-y-auto bg-zinc-50/50 p-6 custom-scrollbar dark:bg-zinc-800/45">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              {renderTab}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="absolute bottom-6 right-6 pointer-events-none z-50">
          <h1 className="text-red-600 font-black tracking-widest uppercase text-xs opacity-80">MODOQAP 360</h1>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};

export default AdminUserProfileModal;
