const DEFAULT_FILTERS = {
  windowDays: 30,
  contextType: 'all',
  userProfile: 'all',
  templateId: 'all',
  accuracyBand: 'all',
};

export const PREDEFINED_ADMIN_SEGMENTS = [
  {
    id: 'filtered-base',
    label: 'Base filtrada',
    description: 'Universo atual respeitando os filtros globais da admin.',
    tone: 'zinc',
    metricKey: 'totalUsers',
    source: 'filtered',
  },
  {
    id: 'new-users-7d',
    label: 'Novos 7d',
    description: 'Usuarios que entraram na janela recente dentro do recorte atual.',
    tone: 'emerald',
    metricKey: 'newUsers7d',
    source: 'executive',
  },
  {
    id: 'active-7d',
    label: 'Ativos 7d',
    description: 'Usuarios que estudaram na ultima semana no dataset filtrado.',
    tone: 'amber',
    metricKey: 'wau',
    source: 'executive',
  },
  {
    id: 'activation-24h',
    label: 'Ativados 24h',
    description: 'Quem encontrou valor nas primeiras 24h apos o cadastro.',
    tone: 'red',
    metricKey: 'activation24h',
    source: 'executive',
  },
  {
    id: 'risk-14d',
    label: 'Risco 14d',
    description: 'Usuarios no bucket intermediario de risco operacional.',
    tone: 'amber',
    metricKey: 'risk14d',
    source: 'executive',
  },
  {
    id: 'risk-30d',
    label: 'Risco 30d',
    description: 'Usuarios com maior urgencia de reativacao no recorte atual.',
    tone: 'red',
    metricKey: 'risk30d',
    source: 'executive',
  },
];

const normalizeFilters = (filters = {}) => ({
  ...DEFAULT_FILTERS,
  ...filters,
  windowDays: Number(filters.windowDays || DEFAULT_FILTERS.windowDays),
});

const getUsersByIds = (users, ids = []) => {
  const usersById = new Map((users || []).map((user) => [user.id, user]));
  return ids.map((uid) => usersById.get(uid)).filter(Boolean);
};

export const buildSavedSegments = ({ dashboardData, filters }) => {
  const normalizedFilters = normalizeFilters(filters);
  const enrichedUsers = dashboardData?.enrichedUsers || [];
  const executive = dashboardData?.executive || {};

  return PREDEFINED_ADMIN_SEGMENTS.map((segment) => {
    const metric = executive[segment.metricKey] || null;
    const rows = segment.source === 'filtered'
      ? enrichedUsers
      : getUsersByIds(enrichedUsers, metric?.userIds || []);

    return {
      ...segment,
      rows,
      count: rows.length,
      metric,
      filtersSnapshot: normalizedFilters,
      subtitle: metric?.subtext || `${rows.length} usuarios dentro do recorte atual.`,
    };
  });
};

const escapeCsvValue = (value) => {
  const safe = value == null ? '' : String(value);
  return `"${safe.replace(/"/g, '""')}"`;
};

export const downloadUsersCsv = (rows, fileName = 'admin-segmento.csv') => {
  const header = [
    'Nome',
    'Email',
    'Perfil',
    'Status',
    'Horas',
    'Minutos',
    'Questoes',
    'Precisao',
    'UltimoEstudo',
    'CriadoEm',
  ];

  const body = (rows || []).map((user) => ([
    user.name || 'Sem nome',
    user.email || '',
    user.perfil || user.role || user.userType || user.tipoPerfil || '',
    user.status || '',
    user.totalHours || 0,
    user.totalMinutes || 0,
    user.totalQuestions || 0,
    `${Number(user.accuracy || 0)}%`,
    user.lastStudy ? new Date(user.lastStudy).toISOString() : '',
    user.createdAt ? new Date(user.createdAt).toISOString() : '',
  ].map(escapeCsvValue).join(',')));

  const csv = [header.join(','), ...body].join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const formatFilterValue = (label, value, fallback = 'Todos') => `${label}: ${value || fallback}`;

export const buildBroadcastDraftFromSegment = (segment) => {
  if (!segment) return null;

  return {
    id: segment.id,
    label: segment.label,
    description: segment.description,
    audienceCount: segment.count || 0,
    targetUserIds: (segment.rows || []).map((user) => user.id),
    filtersSnapshot: segment.filtersSnapshot || normalizeFilters(),
    subtitle: segment.subtitle,
  };
};

export const buildExecutivePdfPayload = ({ dashboardData, filters, segment }) => {
  const normalizedFilters = normalizeFilters(filters);
  const executive = dashboardData?.executive || {};
  const users = segment?.rows || dashboardData?.enrichedUsers || [];

  return {
    generatedAt: new Date().toISOString(),
    title: 'Resumo Executivo Admin',
    audience: {
      label: segment?.label || 'Base filtrada',
      count: users.length,
      description: segment?.description || 'Leitura executiva do recorte atual da admin.',
    },
    filters: [
      formatFilterValue('Janela', `${normalizedFilters.windowDays}d`, '30d'),
      formatFilterValue('Contexto', normalizedFilters.contextType === 'all' ? 'Todos' : normalizedFilters.contextType, 'Todos'),
      formatFilterValue('Perfil', normalizedFilters.userProfile === 'all' ? 'Todos' : normalizedFilters.userProfile, 'Todos'),
      formatFilterValue('Template', normalizedFilters.templateId === 'all' ? 'Todos' : normalizedFilters.templateId, 'Todos'),
      formatFilterValue('Precisao', normalizedFilters.accuracyBand === 'all' ? 'Todas' : normalizedFilters.accuracyBand, 'Todas'),
    ],
    kpis: [
      { label: 'Usuarios totais', value: executive.totalUsers?.value || users.length || 0, detail: executive.totalUsers?.subtext || '' },
      { label: 'Novos 7d', value: executive.newUsers7d?.value || 0, detail: executive.newUsers7d?.subtext || '' },
      { label: 'WAU', value: executive.wau?.value || 0, detail: executive.wau?.subtext || '' },
      { label: 'MAU', value: executive.mau?.value || 0, detail: executive.mau?.subtext || '' },
      { label: 'Ativacao 24h', value: `${executive.activation24h?.value || 0}%`, detail: executive.activation24h?.subtext || '' },
      { label: 'Risco 30d', value: executive.risk30d?.value || 0, detail: executive.risk30d?.subtext || '' },
    ],
    topUsers: users.slice(0, 12).map((user) => ({
      name: user.name || 'Sem nome',
      email: user.email || '',
      status: user.status || 'inactive',
      hours: user.totalHours || 0,
      questions: user.totalQuestions || 0,
      accuracy: user.accuracy || 0,
    })),
  };
};

export const openExecutivePdfWindow = (payload) => {
  const reportWindow = window.open('', '_blank', 'width=1180,height=860');
  if (!reportWindow) return false;

  const filtersList = (payload.filters || []).map((item) => `<span class="chip">${item}</span>`).join('');
  const kpiCards = (payload.kpis || []).map((item) => `
    <div class="card">
      <div class="eyebrow">${item.label}</div>
      <div class="value">${item.value}</div>
      <div class="detail">${item.detail || '&nbsp;'}</div>
    </div>
  `).join('');
  const userRows = (payload.topUsers || []).map((user) => `
    <tr>
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${user.status}</td>
      <td>${user.hours}h</td>
      <td>${user.questions}</td>
      <td>${user.accuracy}%</td>
    </tr>
  `).join('');

  reportWindow.document.write(`
    <html lang="pt-BR">
      <head>
        <title>${payload.title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; background: #f4f4f5; color: #18181b; }
          .shell { max-width: 1120px; margin: 0 auto; padding: 32px 24px 48px; }
          .hero { background: linear-gradient(135deg, #ffffff, #fff1f2); border: 1px solid #fecdd3; border-radius: 28px; padding: 28px; margin-bottom: 24px; }
          .label { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #dc2626; margin-bottom: 10px; }
          h1 { margin: 0 0 8px; font-size: 30px; }
          p { margin: 0; line-height: 1.5; }
          .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
          .chip { padding: 8px 12px; border-radius: 999px; background: #ffffff; border: 1px solid #e4e4e7; font-size: 12px; font-weight: 700; color: #52525b; }
          .toolbar { display: flex; justify-content: flex-end; margin-bottom: 18px; }
          .toolbar button { border: 0; border-radius: 14px; background: #18181b; color: #ffffff; padding: 12px 16px; font-weight: 700; cursor: pointer; }
          .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 24px; }
          .card { background: #ffffff; border: 1px solid #e4e4e7; border-radius: 24px; padding: 18px; }
          .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #71717a; margin-bottom: 10px; }
          .value { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
          .detail { color: #71717a; font-size: 13px; }
          .table-wrap { background: #ffffff; border: 1px solid #e4e4e7; border-radius: 24px; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 12px 10px; text-align: left; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
          th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #71717a; }
          @media print {
            body { background: #ffffff; }
            .toolbar { display: none; }
            .shell { padding: 0; }
            .hero, .card, .table-wrap { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="shell">
          <div class="toolbar">
            <button onclick="window.print()">Imprimir / Salvar PDF</button>
          </div>
          <section class="hero">
            <div class="label">Admin executive export</div>
            <h1>${payload.title}</h1>
            <p>${payload.audience.label} • ${payload.audience.count} usuarios</p>
            <p style="margin-top: 6px; color: #52525b;">${payload.audience.description || ''}</p>
            <div class="chips">${filtersList}</div>
          </section>
          <section class="grid">${kpiCards}</section>
          <section class="table-wrap">
            <div class="eyebrow">Top usuarios do segmento</div>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Horas</th>
                  <th>Questoes</th>
                  <th>Precisao</th>
                </tr>
              </thead>
              <tbody>${userRows}</tbody>
            </table>
          </section>
        </div>
      </body>
    </html>
  `);
  reportWindow.document.close();
  return true;
};
