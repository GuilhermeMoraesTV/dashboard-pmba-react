import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Activity,
  ChevronRight,
  Loader2,
  Radio,
  Server,
  Trophy,
  Users,
} from 'lucide-react';
import { useAdminAnalytics } from '../../hooks/useAdminAnalytics';
import { useForceUnlock } from '../../hooks/useForceUnlock';
import { adminRecalculateUserStats } from '../../services/adminApi';
import AdminAnalyticsSection from './AdminAnalyticsSection';
import AdminGamificationSection from './AdminGamificationSection';
import AdminGroupsSection from './AdminGroupsSection';
import AdminLeaguesSection from './AdminLeaguesSection';
import {
  AdminAuditSection,
  AdminCommunicationsSection,
  AdminMaintenanceSection,
  AdminModerationSection,
} from './AdminOperationsSections';
import AdminUsersSection from './AdminUsersSection';
import EditaisManagerModal from './EditaisManager';
import HeaderAdmin from './HeaderAdmin';
import StudyingNowPanel from './LiveStudyMonitor';
import UserDetailModal from './UserDetailModal';
import { LEAGUES_ENABLED } from '../../config/featureFlags';

const DEFAULT_FILTERS = {
  windowDays: 30,
  contextType: 'all',
  userProfile: 'all',
  templateId: 'all',
  accuracyBand: 'all',
};

const formatDateTime = (value) => {
  if (!value) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value);
};

const formatDuration = (minutes) => {
  const total = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours && rest) return `${hours}h ${rest}min`;
  if (hours) return `${hours}h`;
  return `${rest}min`;
};

const activityLabel = (record) => ({
  estudo: 'Sessão de estudo',
  revisao: 'Revisão',
  questoes: 'Questões',
  simulado: 'Simulado',
}[record.activityType] || 'Atividade acadêmica');

const sourceLabel = (record) => ({
  ciclo: 'Ciclo',
  cronograma: 'Cronograma',
  simulado: 'Simulado',
}[record.sourceType] || 'Registro acadêmico');

const Avatar = ({ user }) => (
  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
    {user?.photoURL
      ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
      : <Users size={15} className="text-zinc-400" />}
  </div>
);

const AdminStatCard = ({ title, value, subtitle, icon: Icon }) => (
  <article className="group relative flex min-h-[138px] flex-col justify-center overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white px-2.5 py-3 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-light/40 hover:!border-l-red-500 hover:shadow-[0_0_18px_rgba(239,68,68,0.07)] dark:border-white/10 dark:!border-l-red-500/25 dark:bg-card-dark dark:hover:border-accent-light/20 dark:hover:!border-l-red-500 dark:hover:shadow-[0_0_22px_rgba(239,68,68,0.08)] sm:min-h-[168px] sm:px-5 sm:py-5">
    <div className="relative z-20 flex w-full flex-col">
      <h3 className="text-[8px] font-bold uppercase leading-tight tracking-[0.08em] text-text-secondary dark:text-text-dark-secondary sm:text-sm sm:tracking-[0.1em]">
        {title}
      </h3>
      <div className="mt-2 flex flex-col gap-1 sm:mt-3 sm:gap-2">
        <p className="text-2xl font-black leading-none tracking-tight text-text-primary dark:text-text-dark-primary sm:text-4xl">
          {value}
        </p>
        <p className="text-[8px] font-semibold leading-tight text-zinc-500 dark:text-zinc-400 sm:max-w-[80%] sm:text-sm sm:leading-snug">{subtitle}</p>
      </div>
    </div>
    <div className="pointer-events-none absolute -bottom-4 -right-4 z-10 text-red-500/10 transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] dark:text-red-500/5">
      {React.createElement(Icon, { strokeWidth: 1.5, className: 'h-16 w-16 md:h-20 md:w-20' })}
    </div>
  </article>
);

const SummaryCard = ({ title, subtitle, icon, accent = 'zinc', onClick, children }) => {
  const accents = {
    zinc: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
    dark: 'bg-white/10 text-red-400 dark:bg-zinc-900/10 dark:text-red-600',
  };
  const Component = onClick ? 'button' : 'article';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`group relative min-h-[138px] overflow-hidden rounded-xl border p-2.5 text-left shadow-sm transition-all sm:min-h-[168px] sm:rounded-[28px] sm:p-5 ${accent === 'dark' ? 'border-zinc-800 bg-zinc-900 text-white hover:-translate-y-0.5 dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-950' : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'} ${onClick ? 'hover:-translate-y-0.5 hover:shadow-lg' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl ${accents[accent]}`}>{React.createElement(icon, { size: 20 })}</div>
        {onClick ? <ChevronRight size={20} className="text-zinc-400 transition-transform group-hover:translate-x-1" /> : null}
      </div>
      <p className={`mt-3 text-[8px] font-black uppercase leading-tight tracking-[0.08em] sm:mt-5 sm:text-sm sm:tracking-[0.12em] ${accent === 'dark' ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-400'}`}>{title}</p>
      {children}
      <p className={`mt-1 text-[8px] font-semibold leading-tight sm:mt-2 sm:text-sm sm:leading-snug ${accent === 'dark' ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'}`}>{subtitle}</p>
    </Component>
  );
};

const SectionCard = ({ title, subtitle, icon, action, children }) => (
  <section className="overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white shadow-soft dark:border-white/10 dark:!border-l-red-500/25 dark:bg-card-dark">
    <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">{React.createElement(icon, { size: 18 })}</div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">{title}</h2>
          <p className="text-[11px] font-medium text-zinc-400">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
    {children}
  </section>
);

const RankingCard = ({ title, subtitle, users, metric, loading, onOpenUser, action }) => (
  <SectionCard title={title} subtitle={subtitle} icon={Trophy} action={action}>
    {loading ? (
      <div className="flex h-48 items-center justify-center gap-3 text-sm font-bold text-zinc-500"><Loader2 size={20} className="animate-spin text-red-600" /> Calculando ranking...</div>
    ) : !users.length ? (
      <div className="flex h-48 items-center justify-center px-6 text-center text-sm font-semibold text-zinc-500">Nenhuma atividade válida para compor este ranking no recorte selecionado.</div>
    ) : (
      <ol className="space-y-2 p-3 sm:p-4">
        {users.map((user, index) => (
          <li key={user.id}>
            <button type="button" onClick={() => onOpenUser(user)} className="flex w-full items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3 text-left transition-colors hover:border-red-200 hover:bg-white dark:border-zinc-900 dark:bg-zinc-900/40 dark:hover:border-red-900/40 dark:hover:bg-zinc-900">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${index < 3 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300'}`}>{index + 1}</span>
              <Avatar user={user} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-zinc-900 dark:text-white">{user.name}</span>
                <span className="mt-0.5 block text-[10px] font-bold text-zinc-400">{user.recordsCount} registros válidos</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-black text-red-600 dark:text-red-400">{metric === 'hours' ? formatDuration(user.totalMinutes) : user.totalQuestions.toLocaleString('pt-BR')}</span>
                <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">{metric === 'hours' ? 'estudadas' : 'questões'}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    )}
  </SectionCard>
);

function AdminPage() {
  useForceUnlock();

  const [activeTab, setActiveTab] = useState('overview');
  const [showEditaisModal, setShowEditaisModal] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [feedLimit, setFeedLimit] = useState(30);
  const [broadcastDraft, setBroadcastDraft] = useState(null);
  const [adminFeedback, setAdminFeedback] = useState(null);
  const [globalFilters, setGlobalFilters] = useState(DEFAULT_FILTERS);
  const [mobileRankingMetric, setMobileRankingMetric] = useState('hours');

  const analyticsFilters = useMemo(() => ({
    recordFrom: new Date(Date.now() - (globalFilters.windowDays * 24 * 60 * 60 * 1000)),
    windowDays: globalFilters.windowDays,
    contextType: globalFilters.contextType,
    userProfile: globalFilters.userProfile,
    templateId: globalFilters.templateId,
    accuracyBand: globalFilters.accuracyBand,
  }), [globalFilters]);

  const {
    loading,
    error,
    users,
    studyRecords,
    cicloNameByKey,
    getUser,
    dashboardData,
    rankings,
    feedList,
    studyingNowSessions,
    filterOptions,
    analytics,
  } = useAdminAnalytics({
    filters: analyticsFilters,
    rankingLimit: 10,
  });

  const hoursRanking = rankings.hours.filter((user) => user.totalMinutes > 0).slice(0, 10);
  const questionsRanking = rankings.questions.filter((user) => user.totalQuestions > 0).slice(0, 10);

  const updateGlobalFilter = (key, value) => {
    setGlobalFilters((current) => ({ ...current, [key]: value }));
    setFeedLimit(30);
  };

  const handleRecalculateAllUsersStats = async () => {
    if (!window.confirm('Recalcular as estatisticas de toda a base no servidor? A operacao sera auditada.')) return;
    try {
      const result = await adminRecalculateUserStats();
      setAdminFeedback({ type: 'success', message: `${result.processedCount} usuários recalibrados no servidor.` });
    } catch (recalculationError) {
      console.error('Erro no recálculo administrativo:', recalculationError);
      setAdminFeedback({ type: 'error', message: 'Não foi possível recalcular as estatísticas.' });
    }
  };

  return (
    <>
      <AnimatePresence>
        {showEditaisModal ? <EditaisManagerModal isOpen onClose={() => setShowEditaisModal(false)} /> : null}
      </AnimatePresence>
      <UserDetailModal isOpen={Boolean(detailUser)} onClose={() => setDetailUser(null)} user={detailUser} records={studyRecords} />

      {adminFeedback ? (
        <div className={`fixed left-1/2 top-5 z-[320] -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-xl ${adminFeedback.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {adminFeedback.message}
          <button type="button" onClick={() => setAdminFeedback(null)} className="ml-3 opacity-80 hover:opacity-100">×</button>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-[1600px] animate-slide-up space-y-6 px-4 pb-20 pt-6 sm:px-6">
        <HeaderAdmin
          onRecalculateStats={handleRecalculateAllUsersStats}
          broadcastDraft={broadcastDraft}
          filters={globalFilters}
          filterOptions={filterOptions}
          onFilterChange={updateGlobalFilter}
          onResetFilters={() => { setGlobalFilters(DEFAULT_FILTERS); setFeedLimit(30); }}
        />

        <nav aria-label="Seções do painel administrativo" className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {[
            { id: 'overview', label: 'Visão geral' },
            { id: 'analytics', label: 'Analytics' },
            { id: 'users', label: 'Usuários' },
            { id: 'gamification', label: 'Gamificação' },
            ...(LEAGUES_ENABLED ? [{ id: 'leagues', label: 'Ligas' }] : []),
            { id: 'groups', label: 'Grupos' },
            { id: 'moderation', label: 'Moderação' },
            { id: 'communications', label: 'Comunicações' },
            { id: 'maintenance', label: 'Manutenção' },
            { id: 'audit', label: 'Auditoria' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] transition-all sm:px-5 sm:text-xs ${activeTab === tab.id ? 'bg-white text-red-600 shadow-sm dark:bg-zinc-800 dark:text-red-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {error ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
            Parte dos dados administrativos não pôde ser carregada: {error}
          </div>
        ) : null}

        {activeTab === 'analytics' ? (
          <AdminAnalyticsSection datasets={analytics.datasets} loading={loading} error={error} />
        ) : activeTab === 'users' ? (
          <AdminUsersSection users={users} loading={loading} onOpenUser={setDetailUser} onFeedback={setAdminFeedback} />
        ) : activeTab === 'gamification' ? (
          <AdminGamificationSection users={users} loading={loading} onOpenUser={setDetailUser} onFeedback={setAdminFeedback} />
        ) : activeTab === 'leagues' && LEAGUES_ENABLED ? (
          <AdminLeaguesSection users={users} onOpenUser={setDetailUser} onFeedback={setAdminFeedback} />
        ) : activeTab === 'groups' ? (
          <AdminGroupsSection users={users} onOpenUser={setDetailUser} onFeedback={setAdminFeedback} />
        ) : activeTab === 'moderation' ? (
          <AdminModerationSection users={users} onOpenUser={setDetailUser} onFeedback={setAdminFeedback} onNavigate={setActiveTab} />
        ) : activeTab === 'communications' ? (
          <AdminCommunicationsSection
            users={users}
            dashboardData={dashboardData}
            filters={globalFilters}
            onBroadcast={(segment) => setBroadcastDraft({ key: Date.now(), segment })}
          />
        ) : activeTab === 'maintenance' ? (
          <AdminMaintenanceSection users={users} onFeedback={setAdminFeedback} onNavigate={setActiveTab} />
        ) : activeTab === 'audit' ? (
          <AdminAuditSection users={users} />
        ) : (
          <div key="overview" className="space-y-6">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <AdminStatCard title="Usuários registrados" value={loading ? '—' : dashboardData.totalUsers} subtitle="Total da base cadastrada" icon={Users} />
              <AdminStatCard title="Ativos no último dia" value={loading ? '—' : dashboardData.active24h} subtitle="Com atividade acadêmica real nas últimas 24h" icon={Radio} />
              <SummaryCard title="Gerenciar editais" subtitle="Templates, seeds e operação administrativa" icon={Server} accent="dark" onClick={() => setShowEditaisModal(true)}>
                <p className="mt-1 text-sm font-black leading-tight tracking-tight sm:text-2xl">Abrir gerenciador</p>
              </SummaryCard>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            <div className="h-[760px] min-w-0">
              <StudyingNowPanel sessions={studyingNowSessions} getUser={getUser} cicloNameByKey={cicloNameByKey} onOpenUser={setDetailUser} />
            </div>

            <SectionCard title="Registros em tempo real" subtitle="Atividades acadêmicas reais de todos os usuários" icon={Activity}>
              {loading ? (
                <div className="flex h-56 items-center justify-center gap-3 text-sm font-bold text-zinc-500"><Loader2 size={20} className="animate-spin text-red-600" /> Carregando registros...</div>
              ) : !feedList.length ? (
                <div className="flex h-56 items-center justify-center px-6 text-center text-sm font-semibold text-zinc-500">Nenhuma atividade encontrada para o período e os filtros selecionados.</div>
              ) : (
                <div className="h-[680px] overflow-y-auto p-3 sm:p-4">
                  <div className="space-y-2">
                    {feedList.slice(0, feedLimit).map((record) => {
                      const user = getUser(record.uid);
                      return (
                        <button key={record.path || `${record.uid}-${record.id}`} type="button" onClick={() => setDetailUser(user)} className="w-full rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3 text-left transition-colors hover:border-red-200 hover:bg-white dark:border-zinc-900 dark:bg-zinc-900/40 dark:hover:border-red-900/40 dark:hover:bg-zinc-900 sm:p-4">
                          <div className="flex items-start gap-3">
                            <Avatar user={user} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-zinc-900 dark:text-white">{user.name}</p>
                                  <p className="text-[11px] font-bold text-red-600 dark:text-red-400">{activityLabel(record)} · {sourceLabel(record)}</p>
                                </div>
                                <time className="shrink-0 text-[10px] font-bold text-zinc-400">{formatDateTime(record.timestamp)}</time>
                              </div>
                              <p className="mt-2 truncate text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                                {record.disciplinaNome || 'Sem disciplina'}{record.assunto ? ` · ${record.assunto}` : ''}{record.sourceName ? ` · ${record.sourceName}` : ''}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black">
                                {record.tempoEstudadoMinutos > 0 ? <span className="rounded-lg bg-zinc-200/70 px-2 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{formatDuration(record.tempoEstudadoMinutos)}</span> : null}
                                {record.questoesFeitas > 0 ? <span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">{record.questoesFeitas} questões</span> : null}
                                {record.questoesFeitas > 0 ? <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{record.acertos} acertos</span> : null}
                                {record.questoesFeitas > 0 ? <span className="rounded-lg bg-red-50 px-2 py-1 text-red-700 dark:bg-red-950/30 dark:text-red-300">{record.erros} erros</span> : null}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {feedLimit < feedList.length ? (
                    <button type="button" onClick={() => setFeedLimit((current) => current + 30)} className="mt-4 w-full rounded-xl border border-zinc-200 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-500 hover:border-red-200 hover:text-red-600 dark:border-zinc-800">Carregar mais</button>
                  ) : null}
                </div>
              )}
            </SectionCard>

            </div>

            <div className="md:hidden">
              <RankingCard
                title="Ranking geral"
                subtitle={mobileRankingMetric === 'hours' ? 'Top 10 por tempo estudado' : 'Top 10 por questões realizadas'}
                users={mobileRankingMetric === 'hours' ? hoursRanking : questionsRanking}
                metric={mobileRankingMetric}
                loading={loading}
                onOpenUser={setDetailUser}
                action={(
                  <div className="flex w-full rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900" role="tablist" aria-label="Métrica do ranking">
                    {[
                      ['hours', 'Tempo'],
                      ['questions', 'Questões'],
                    ].map(([metric, label]) => (
                      <button
                        key={metric}
                        type="button"
                        role="tab"
                        aria-selected={mobileRankingMetric === metric}
                        onClick={() => setMobileRankingMetric(metric)}
                        className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] transition-colors ${mobileRankingMetric === metric ? 'bg-white text-red-600 shadow-sm dark:bg-zinc-800 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            <div className="hidden grid-cols-2 items-start gap-6 md:grid">
              <RankingCard title="Ranking por horas" subtitle="Top 10 por tempo efetivamente estudado" users={hoursRanking} metric="hours" loading={loading} onOpenUser={setDetailUser} />
              <RankingCard title="Ranking por questões" subtitle="Top 10 por questões efetivamente realizadas" users={questionsRanking} metric="questions" loading={loading} onOpenUser={setDetailUser} />
            </div>

          </div>
        )}
      </div>
    </>
  );
}

export default AdminPage;
