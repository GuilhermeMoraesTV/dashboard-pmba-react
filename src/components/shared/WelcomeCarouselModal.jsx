import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './WelcomeCarouselModal.css';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  Download,
  FileText,
  Gauge,
  ListChecks,
  Newspaper,
  NotebookPen,
  PlayCircle,
  RotateCcw,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';

const LOGO = '/logoModoQAP.png';

const iconMap = {
  Activity,
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Compass,
  Download,
  FileText,
  Gauge,
  ListChecks,
  Newspaper,
  NotebookPen,
  PlayCircle,
  RotateCcw,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
};

const welcomeSlides = [
  {
    id: 'hello',
    eyebrow: 'Sua preparação começa aqui',
    title: 'Bem-vindo ao MODOQAP',
    text: 'Um espaço feito para transformar seu edital em uma rotina clara, acompanhar sua evolução e manter o foco até a aprovação.',
    icon: 'Sparkles',
    tone: 'red',
    preview: null,
    hero: true,
    details: [],
  },
  {
    id: 'planning',
    eyebrow: 'O ponto de partida',
    title: 'Crie seu planejamento',
    text: 'Escolha entre um cronograma por datas ou um ciclo contínuo por matérias. O sistema organiza o caminho sem engessar sua rotina.',
    icon: 'Compass',
    tone: 'red',
    preview: 'planning',
    stat: '2 modos',
    statLabel: 'cronograma ou ciclo',
    details: ['Cronograma com datas, assuntos e revisões.', 'Ciclo flexível por matérias e prioridades.'],
  },
  {
    id: 'today',
    eyebrow: 'Seu dia, sem confusao',
    title: 'Veja exatamente o que estudar',
    text: 'A tela inicial transforma o planejamento em uma sequência objetiva, com matéria, assunto, tempo previsto e acesso direto ao estudo.',
    icon: 'CalendarClock',
    tone: 'red',
    preview: 'today',
    stat: 'Hoje',
    statLabel: 'sempre em primeiro plano',
    details: ['Blocos do dia aparecem na ordem certa.', 'O timer abre direto no assunto escolhido.'],
  },
  {
    id: 'cronograma-pdf',
    eyebrow: 'Planejamento completo',
    title: 'Seu cronograma também pode virar PDF',
    text: 'Visualize a semana com matérias, assuntos, revisões e tempo previsto. Quando quiser, baixe o cronograma em PDF para consultar ou imprimir.',
    icon: 'Download',
    tone: 'red',
    preview: 'cronograma',
    details: ['A semana fica organizada dia por dia.', 'O cronograma pode ser baixado em PDF.'],
  },
  {
    id: 'records',
    eyebrow: 'Registro rapido',
    title: 'Conte tempo, questoes e acertos',
    text: 'Ao finalizar, registre tempo, questões e acertos. Esses dados alimentam suas metas, seu histórico e a leitura real da evolução.',
    icon: 'NotebookPen',
    tone: 'red',
    preview: 'records',
    stat: 'XP',
    statLabel: 'constancia vira progresso',
    details: ['Tempo líquido alimenta metas e calendário.', 'Questões e acertos mostram sua precisão.'],
  },
  {
    id: 'revision',
    eyebrow: 'Nao deixe conteudo esfriar',
    title: 'Revisoes entram na sua rotina',
    text: 'A central reúne o que precisa ser revisto hoje, o que atrasou e o que vem depois, sempre com a origem e o assunto visíveis.',
    icon: 'BookOpenCheck',
    tone: 'red',
    preview: 'review',
    stat: '24h',
    statLabel: 'controle diario',
    details: ['Hoje, atrasadas e próximas ficam separadas.', 'Cronograma e ciclo aparecem no mesmo lugar.'],
  },
  {
    id: 'edital-verticalizado',
    eyebrow: 'Edital sob controle',
    title: 'Acompanhe o edital verticalizado',
    text: 'Veja disciplinas e assuntos em uma estrutura clara, marque o que já avançou e identifique rapidamente o que ainda precisa estudar.',
    icon: 'FileText',
    tone: 'red',
    preview: 'edital',
    details: ['Progresso por disciplina e assunto.', 'Versão completa disponível para baixar em PDF.'],
  },
  {
    id: 'news',
    eyebrow: 'Radar de concursos',
    title: 'Acompanhe as notícias importantes',
    text: 'Editais, bancas, inscrições e movimentações dos concursos ficam reunidos em uma área própria para você não perder nenhuma atualização.',
    icon: 'Newspaper',
    tone: 'red',
    preview: 'news',
    details: ['Notícias organizadas para leitura rápida.', 'Informações de concursos por região e estado.'],
  },
  {
    id: 'performance',
    eyebrow: 'Evolucao visivel',
    title: 'Acompanhe sua virada',
    text: 'Desempenho, simulados e calendário revelam seu ritmo, sua precisão e os pontos que merecem mais atenção.',
    icon: 'Trophy',
    tone: 'red',
    preview: 'performance',
    stat: '100%',
    statLabel: 'foco na aprovacao',
    details: ['O calendário mostra sua constância diária.', 'Os indicadores revelam matérias fortes e fracas.'],
  },
];

const updateSlides = [
  {
    id: 'update-main',
    eyebrow: 'Atualizacao do sistema',
    title: 'Bem-vindo à nova fase do MODOQAP',
    text: 'Preparamos uma experiência mais clara e visual para você planejar, estudar e revisar com menos esforço. Veja o que mudou.',
    icon: 'Sparkles',
    tone: 'red',
    preview: null,
    hero: true,
    details: [],
  },
  {
    id: 'update-cronograma',
    eyebrow: 'Novo cronograma',
    title: 'Cronograma agora vira rotina do dia',
    text: 'O cronograma transforma edital, disponibilidade e data da prova em uma trilha diária com teoria, revisões e tempo previsto.',
    icon: 'CalendarClock',
    tone: 'red',
    preview: 'cronograma',
    stat: 'Dia a dia',
    statLabel: 'com teoria e revisoes',
    details: [
      'Distribui assuntos ao longo das semanas.',
      'Baixe o cronograma completo em PDF.',
    ],
  },
  {
    id: 'update-ciclo',
    eyebrow: 'Novo ciclo',
    title: 'Ciclo agora tem guia por assunto',
    text: 'O ciclo ficou mais visual: matérias, assuntos e progresso aparecem em uma roda que deixa clara a sequência de estudo.',
    icon: 'RotateCcw',
    tone: 'red',
    preview: 'cycle',
    stat: 'Rodadas',
    statLabel: 'com progresso visivel',
    details: [
      'A roda reproduz a ordem real das sessões.',
      'O guia mostra o assunto atual e o próximo.',
    ],
  },
  {
    id: 'update-revisao',
    eyebrow: 'Revisao',
    title: 'Revisoes ganharam uma central propria',
    text: 'As revisões agora ficam em uma central própria: hoje, atrasadas e próximas, com origem e assunto sempre visíveis.',
    icon: 'BookOpenCheck',
    tone: 'red',
    preview: 'review',
    stat: '3 listas',
    statLabel: 'hoje, atrasadas e proximas',
    details: [
      'Cronograma e ciclo aparecem juntos.',
      'Reagendar ficou mais direto.',
    ],
  },
  {
    id: 'update-guides',
    eyebrow: 'Guias de estudo',
    title: 'Guias mostram o caminho na matéria',
    text: 'Os guias transformam matérias extensas em passos menores, mostrando assunto, registro e avanço sem depender da memória.',
    icon: 'Route',
    tone: 'red',
    preview: 'guides',
    stat: 'Passo a passo',
    statLabel: 'por materia e assunto',
    details: [
      'Assuntos aparecem em sequência.',
      'Fica mais fácil retomar de onde parou.',
    ],
  },
  {
    id: 'update-edital-verticalizado',
    eyebrow: 'Edital verticalizado',
    title: 'O edital inteiro em uma visão organizada',
    text: 'Disciplinas, assuntos e progresso ficam estruturados para facilitar sua leitura. Você também pode baixar o edital verticalizado em PDF.',
    icon: 'FileText',
    tone: 'red',
    preview: 'edital',
    details: ['Acompanhe o avanço em cada assunto.', 'Baixe em branco ou com seu progresso atual.'],
  },
  {
    id: 'update-news',
    eyebrow: 'Noticias',
    title: 'Notícias agora fazem parte da preparação',
    text: 'A página de notícias reúne edital, banca e movimentações do concurso em um espaço próprio e fácil de acompanhar.',
    icon: 'Newspaper',
    tone: 'red',
    preview: 'news',
    stat: 'Radar',
    statLabel: 'do concurso',
    details: [
      'Conteúdo separado da rotina de estudo.',
      'Cards visuais para leitura rápida.',
    ],
  },
];

const toneStyles = {
  red: {
    accent: 'bg-red-600',
    text: 'text-red-600',
    soft: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-900/60',
    icon: 'bg-red-600 text-white shadow-red-600/25',
  },
  blue: {
    accent: 'bg-sky-600',
    text: 'text-sky-700 dark:text-sky-300',
    soft: 'bg-sky-50 dark:bg-sky-950/30',
    border: 'border-sky-200 dark:border-sky-900/60',
    icon: 'bg-sky-600 text-white shadow-sky-600/25',
  },
  amber: {
    accent: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    soft: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-900/60',
    icon: 'bg-amber-500 text-white shadow-amber-500/25',
  },
  emerald: {
    accent: 'bg-emerald-600',
    text: 'text-emerald-700 dark:text-emerald-300',
    soft: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-900/60',
    icon: 'bg-emerald-600 text-white shadow-emerald-600/25',
  },
  violet: {
    accent: 'bg-fuchsia-600',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    soft: 'bg-fuchsia-50 dark:bg-fuchsia-950/25',
    border: 'border-fuchsia-200 dark:border-fuchsia-900/50',
    icon: 'bg-fuchsia-600 text-white shadow-fuchsia-600/25',
  },
  rose: {
    accent: 'bg-rose-600',
    text: 'text-rose-700 dark:text-rose-300',
    soft: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-900/60',
    icon: 'bg-rose-600 text-white shadow-rose-600/25',
  },
  zinc: {
    accent: 'bg-zinc-900 dark:bg-white',
    text: 'text-zinc-900 dark:text-white',
    soft: 'bg-zinc-100 dark:bg-zinc-800',
    border: 'border-zinc-200 dark:border-zinc-700',
    icon: 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-zinc-900/20',
  },
};

const MiniLogo = () => (
  <div className="flex items-center gap-2">
    <img src={LOGO} alt="MODOQAP" className="h-6 w-auto object-contain" />
    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">MODOQAP</span>
  </div>
);

const PreviewCard = ({ children, className = '' }) => (
  <div className={`welcome-carousel-preview overflow-hidden rounded-[1.1rem] border border-zinc-200 bg-zinc-100 shadow-2xl shadow-zinc-900/15 dark:border-white/10 dark:bg-zinc-900 ${className}`}>
    <div className="flex h-7 items-center justify-between border-b border-zinc-200 bg-white px-2.5 dark:border-white/10 dark:bg-zinc-950">
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </div>
      <img src={LOGO} alt="" className="h-4 w-auto object-contain" />
      <div className="h-4 w-4 rounded-full bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700" />
    </div>
    <div className="flex min-h-[206px] bg-zinc-50 dark:bg-zinc-950">
      <aside className="flex w-8 shrink-0 flex-col items-center gap-2.5 bg-zinc-950 py-3 dark:bg-black">
        <span className="h-4 w-4 rounded-md bg-red-600" />
        {[0, 1, 2, 3].map((item) => <span key={item} className={`h-2.5 w-2.5 rounded-sm ${item === 1 ? 'bg-red-500' : 'bg-white/25'}`} />)}
      </aside>
      <div className="min-w-0 flex-1 p-3">{children}</div>
    </div>
  </div>
);

const PreviewHeader = ({ icon: Icon, title, tone }) => (
  <div className="mb-2.5 flex items-center justify-between">
    <div>
      <p className={`text-[7px] font-black uppercase tracking-[0.2em] ${tone.text}`}>MODOQAP</p>
      <p className="mt-0.5 text-xs font-black uppercase tracking-tight text-zinc-900 dark:text-white">{title}</p>
    </div>
    <div className={`flex h-7 w-7 items-center justify-center rounded-lg shadow-lg ${tone.icon}`}>
      <Icon size={15} strokeWidth={2.4} />
    </div>
  </div>
);

const PreviewDashboard = ({ tone }) => (
  <PreviewCard>
    <PreviewHeader icon={Gauge} title="Painel inicial" tone={tone} />
    <div className="grid grid-cols-3 gap-2">
      {[
        ['Hoje', '3 blocos'],
        ['Tempo', '72%'],
        ['Streak', '8 dias'],
      ].map(([label, value], itemIndex) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: itemIndex * 0.08 }}
          className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-900"
        >
          <p className="text-[9px] font-black uppercase tracking-wide text-zinc-400">{label}</p>
          <p className="mt-1 text-sm font-black text-zinc-900 dark:text-white">{value}</p>
        </motion.div>
      ))}
    </div>
    <div className="mt-3 rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-black text-zinc-700 dark:text-zinc-200">Direito Constitucional</span>
        <PlayCircle size={16} className={tone.text} />
      </div>
      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
        <motion.div className={`h-full rounded-full ${tone.accent}`} initial={{ width: 0 }} animate={{ width: '68%' }} transition={{ duration: 0.7 }} />
      </div>
    </div>
  </PreviewCard>
);

const PreviewPlanning = ({ tone }) => (
  <PreviewCard>
    <PreviewHeader icon={Compass} title="Escolha do plano" tone={tone} />
    <div className="grid gap-3">
      {[
        ['Cronograma', CalendarClock, 'Datas, semanas e revisoes'],
        ['Ciclo', RotateCcw, 'Rodadas por materia'],
      ].map(([label, Icon, text], itemIndex) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, x: itemIndex ? 18 : -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: itemIndex * 0.12 }}
          className={`flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 ${itemIndex === 0 ? 'border-l-4 border-l-red-500' : ''}`}
        >
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${itemIndex === 0 ? tone.icon : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>
            <Icon size={18} />
          </div>
          <div>
            <p className="text-sm font-black text-zinc-900 dark:text-white">{label}</p>
            <p className="text-[10px] font-bold text-zinc-500">{text}</p>
          </div>
        </motion.div>
      ))}
    </div>
  </PreviewCard>
);

const PreviewCronograma = ({ tone }) => (
  <PreviewCard>
    <PreviewHeader icon={CalendarClock} title="Cronograma · Semana 03" tone={tone} />
    <div className="grid grid-cols-5 gap-1.5">
      {[
        ['SEG', '12', 'Português', 'Teoria'],
        ['TER', '13', 'Revisões', '2 tópicos'],
        ['QUA', '14', 'Direito Penal', 'Teoria'],
        ['QUI', '15', 'Raciocínio', 'Questões'],
        ['SEX', '16', 'Informática', 'Teoria'],
      ].map(([day, date, subject, type], itemIndex) => (
        <motion.div key={day} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: itemIndex * 0.05 }}>
          <div className={`mb-1 rounded-md py-1 text-center ${itemIndex === 2 ? 'bg-red-600 text-white' : 'bg-white text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800'}`}>
            <p className="text-[6px] font-black tracking-wider">{day}</p>
            <p className="text-[10px] font-black">{date}</p>
          </div>
          <div className={`min-h-[78px] rounded-lg border-l-[3px] bg-white p-1.5 shadow-sm dark:bg-zinc-900 ${itemIndex === 1 ? 'border-l-blue-500' : 'border-l-red-500'}`}>
            {itemIndex === 1 && <span className="rounded bg-blue-600 px-1 py-0.5 text-[5px] font-black uppercase text-white">Revisão</span>}
            <p className="mt-1 line-clamp-2 text-[7px] font-black leading-tight text-zinc-800 dark:text-zinc-100">{subject}</p>
            <p className="mt-1 text-[6px] font-bold text-zinc-400">{type}</p>
            <p className="mt-2 text-[6px] font-black text-zinc-600 dark:text-zinc-300">40 min</p>
          </div>
        </motion.div>
      ))}
    </div>
    <div className="mt-2 flex items-center justify-between rounded-lg border border-red-100 bg-white px-2.5 py-1.5 dark:border-red-950/60 dark:bg-zinc-900">
      <span className="text-[7px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-300">Semana pronta para consultar</span>
      <span className="flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[7px] font-black uppercase text-white"><Download size={9} /> Baixar PDF</span>
    </div>
  </PreviewCard>
);

const PreviewCycle = ({ tone }) => (
  <PreviewCard>
    <PreviewHeader icon={RotateCcw} title="Mapa visual do ciclo" tone={tone} />
    <div className="grid grid-cols-[1.15fr_.85fr] items-center gap-3">
      <div className="relative mx-auto h-[154px] w-[154px]">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 overflow-visible drop-shadow-md">
          <circle cx="50" cy="50" r="37" fill="none" stroke="currentColor" strokeWidth="15" className="text-zinc-200 dark:text-zinc-800" />
          {[
            ['#dc2626', 0, 22],
            ['#2563eb', 25, 19],
            ['#f59e0b', 47, 15],
            ['#10b981', 65, 13],
            ['#8b5cf6', 81, 11],
          ].map(([color, offset, length], itemIndex) => (
            <motion.circle
              key={color}
              cx="50"
              cy="50"
              r="37"
              fill="none"
              stroke={color}
              strokeWidth={itemIndex === 1 ? 17 : 14}
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-offset}
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{ opacity: 1, pathLength: 1 }}
              transition={{ delay: itemIndex * 0.07, duration: 0.5 }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-black text-zinc-950 dark:text-white">64%</span>
          <span className="text-[6px] font-black uppercase tracking-[0.18em] text-zinc-400">rodada atual</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {[
          ['Português', 'bg-red-600'],
          ['Direito Penal', 'bg-blue-600'],
          ['História', 'bg-amber-500'],
          ['Informática', 'bg-emerald-500'],
        ].map(([item, color], itemIndex) => (
          <div key={item} className={`rounded-lg border p-1.5 ${itemIndex === 1 ? 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'}`}>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${color}`} />
              <p className="truncate text-[7px] font-black text-zinc-800 dark:text-zinc-100">{item}</p>
            </div>
            <p className="mt-1 pl-3.5 text-[6px] font-bold text-zinc-400">{itemIndex === 1 ? 'Sessão atual' : `${20 + itemIndex * 10} min`}</p>
          </div>
        ))}
      </div>
    </div>
  </PreviewCard>
);

const PreviewToday = ({ tone }) => (
  <PreviewCard>
    <PreviewHeader icon={Clock3} title="Estudo de hoje" tone={tone} />
    <div className="space-y-2">
      {[
        ['08:00', 'Legislacao PMBA', 'Estudar artigo 42'],
        ['10:00', 'Portugues', 'Reforcar sintaxe'],
        ['20:00', 'Revisao', 'Constitucional'],
      ].map(([time, title, desc], itemIndex) => (
        <motion.div
          key={title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: itemIndex * 0.1 }}
          className="flex gap-3 rounded-xl border border-zinc-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <span className={`h-fit rounded-lg px-2 py-1 text-[10px] font-black ${itemIndex === 0 ? `${tone.accent} text-white` : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>{time}</span>
          <div>
            <p className="text-xs font-black text-zinc-900 dark:text-white">{title}</p>
            <p className="text-[10px] font-bold text-zinc-500">{desc}</p>
          </div>
        </motion.div>
      ))}
    </div>
  </PreviewCard>
);

const PreviewRecords = ({ tone }) => (
  <PreviewCard>
    <PreviewHeader icon={NotebookPen} title="Registro do estudo" tone={tone} />
    <div className="grid grid-cols-3 gap-2">
      {[
        ['Tempo', '1h20'],
        ['Treino', '42'],
        ['Acertos', '34'],
      ].map(([label, value], itemIndex) => (
        <div key={label} className="rounded-xl bg-zinc-100 p-2 dark:bg-zinc-800">
          <p className="text-[9px] font-black uppercase tracking-wide text-zinc-400">{label}</p>
          <p className={`mt-1 text-lg font-black ${itemIndex === 2 ? tone.text : 'text-zinc-900 dark:text-white'}`}>{value}</p>
        </div>
      ))}
    </div>
    <div className="mt-4 rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
      <div className="mb-2 flex items-center justify-between text-xs font-black text-zinc-700 dark:text-zinc-200">
        <span>Precisao</span>
        <span className={tone.text}>81%</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
        <motion.div className={`h-full rounded-full ${tone.accent}`} initial={{ width: 0 }} animate={{ width: '81%' }} transition={{ duration: 0.65 }} />
      </div>
    </div>
  </PreviewCard>
);

const PreviewReview = ({ tone }) => (
  <PreviewCard>
    <PreviewHeader icon={BookOpenCheck} title="Central de revisoes" tone={tone} />
    <div className="grid grid-cols-3 gap-1.5">
      {[
        ['Hoje', '4'],
        ['Atrasadas', '2'],
        ['Proximas', '7'],
      ].map(([label, value], itemIndex) => (
        <div key={label} className={`rounded-xl p-2 text-center ${itemIndex === 0 ? `${tone.accent} text-white` : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>
          <p className="text-base font-black">{value}</p>
          <p className="text-[8px] font-black uppercase tracking-wide opacity-75">{label}</p>
        </div>
      ))}
    </div>
    <div className="mt-4 space-y-2">
      {['Direito Administrativo', 'Portugues', 'Historia da Bahia'].map((item, itemIndex) => (
        <div key={item} className="flex items-center justify-between rounded-xl bg-white p-2.5 ring-1 ring-zinc-100 dark:bg-zinc-900 dark:ring-zinc-800">
          <span className="text-xs font-black text-zinc-800 dark:text-zinc-100">{item}</span>
          {itemIndex === 0 ? <CheckCircle2 size={16} className={tone.text} /> : <Clock3 size={15} className="text-zinc-400" />}
        </div>
      ))}
    </div>
  </PreviewCard>
);

const PreviewGuides = ({ tone }) => (
  <PreviewCard>
    <PreviewHeader icon={Route} title="Guia por assunto" tone={tone} />
    <div className="space-y-3">
      {[
        ['1', 'Teoria base', true],
        ['2', 'Questoes comentadas', true],
        ['3', 'Revisao marcada', false],
      ].map(([step, label, done], itemIndex) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: itemIndex * 0.1 }}
          className="flex items-center gap-3"
        >
          <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-black ${done ? `${tone.accent} text-white` : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>
            {done ? <Check size={15} /> : step}
          </div>
          <div className="flex-1 rounded-xl bg-white p-2.5 ring-1 ring-zinc-100 dark:bg-zinc-900 dark:ring-zinc-800">
            <p className="text-xs font-black text-zinc-900 dark:text-white">{label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  </PreviewCard>
);

const PreviewNews = ({ tone }) => (
  <PreviewCard>
    <PreviewHeader icon={Newspaper} title="Noticias do concurso" tone={tone} />
    <div className="space-y-3">
      {[
        ['Edital', 'Novo movimento da banca'],
        ['PMBA', 'Resumo da semana'],
        ['Dicas', 'Como usar a reta final'],
      ].map(([tag, title], itemIndex) => (
        <motion.div
          key={title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: itemIndex * 0.1 }}
          className="overflow-hidden rounded-xl border border-zinc-100 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className={`h-1.5 ${itemIndex === 0 ? tone.accent : 'bg-zinc-200 dark:bg-zinc-700'}`} />
          <div className="p-3">
            <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${tone.soft} ${tone.text}`}>{tag}</span>
            <p className="mt-2 text-xs font-black text-zinc-900 dark:text-white">{title}</p>
          </div>
        </motion.div>
      ))}
    </div>
  </PreviewCard>
);

const PreviewEdital = ({ tone }) => (
  <PreviewCard>
    <PreviewHeader icon={FileText} title="Edital verticalizado" tone={tone} />
    <div className="grid grid-cols-3 gap-1.5">
      {[
        ['Disciplinas', '12'],
        ['Assuntos', '148'],
        ['Progresso', '42%'],
      ].map(([label, value], itemIndex) => (
        <div key={label} className={`rounded-lg p-2 ${itemIndex === 2 ? 'bg-red-600 text-white' : 'bg-white text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800'}`}>
          <p className="text-[6px] font-black uppercase tracking-wider opacity-60">{label}</p>
          <p className="mt-0.5 text-sm font-black">{value}</p>
        </div>
      ))}
    </div>
    <div className="mt-2 space-y-1.5">
      {[
        ['Língua Portuguesa', 72],
        ['Direito Constitucional', 48],
        ['Legislação PMBA', 31],
      ].map(([subject, progress], itemIndex) => (
        <motion.div key={subject} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: itemIndex * 0.08 }} className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5"><ListChecks size={10} className={tone.text} /><span className="truncate text-[7px] font-black text-zinc-800 dark:text-zinc-100">{subject}</span></div>
            <span className="text-[7px] font-black text-zinc-400">{progress}%</span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-zinc-100 dark:bg-zinc-800"><div className={`h-full rounded-full ${tone.accent}`} style={{ width: `${progress}%` }} /></div>
        </motion.div>
      ))}
    </div>
    <div className="mt-2 flex items-center justify-between rounded-lg bg-zinc-950 px-2.5 py-1.5 text-white dark:bg-white dark:text-zinc-950">
      <span className="text-[7px] font-black uppercase tracking-wider">Completo ou planejamento</span>
      <span className="flex items-center gap-1 text-[7px] font-black uppercase"><Download size={9} /> Baixar PDF</span>
    </div>
  </PreviewCard>
);

const PreviewPerformance = ({ tone }) => (
  <PreviewCard>
    <PreviewHeader icon={Activity} title="Evolucao" tone={tone} />
    <div className="flex items-end gap-2">
      {[42, 56, 38, 78, 64, 88, 72].map((height, itemIndex) => (
        <div key={itemIndex} className="flex flex-1 items-end rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800" style={{ height: 96 }}>
          <motion.div
            className={`w-full rounded-md ${itemIndex >= 4 ? tone.accent : 'bg-zinc-300 dark:bg-zinc-600'}`}
            initial={{ height: 0 }}
            animate={{ height: `${height}%` }}
            transition={{ delay: itemIndex * 0.05, duration: 0.45 }}
          />
        </div>
      ))}
    </div>
    <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
      <span className="text-xs font-black text-zinc-700 dark:text-zinc-200">Precisao geral</span>
      <span className={`text-lg font-black ${tone.text}`}>84%</span>
    </div>
  </PreviewCard>
);

const PreviewContent = ({ slide, tone }) => {
  const preview = slide.preview || 'dashboard';
  if (preview === 'planning') return <PreviewPlanning tone={tone} />;
  if (preview === 'cronograma') return <PreviewCronograma tone={tone} />;
  if (preview === 'cycle') return <PreviewCycle tone={tone} />;
  if (preview === 'today') return <PreviewToday tone={tone} />;
  if (preview === 'records') return <PreviewRecords tone={tone} />;
  if (preview === 'review') return <PreviewReview tone={tone} />;
  if (preview === 'guides') return <PreviewGuides tone={tone} />;
  if (preview === 'news') return <PreviewNews tone={tone} />;
  if (preview === 'edital') return <PreviewEdital tone={tone} />;
  if (preview === 'performance') return <PreviewPerformance tone={tone} />;
  return <PreviewDashboard tone={tone} />;
};

const desktopContent = {
  welcome: {
    label: 'O que você encontra no sistema',
    items: [
      ['Target', 'Direção', 'Um caminho claro desde o primeiro acesso.'],
      ['ShieldCheck', 'Organização', 'Planejamento, estudo e revisão conectados.'],
      ['Activity', 'Evolução', 'Indicadores alimentados pela sua rotina real.'],
    ],
    note: 'Você começa com uma visão simples e ganha profundidade conforme registra seus estudos.',
  },
  update: {
    label: 'Uma atualização pensada para a rotina',
    items: [
      ['Sparkles', 'Mais visual', 'Telas claras e informações bem distribuídas.'],
      ['Route', 'Mais guiada', 'Próximos passos sempre fáceis de encontrar.'],
      ['Download', 'Mais completa', 'Novos materiais também disponíveis em PDF.'],
    ],
    note: 'As melhorias mantêm seus dados e deixam o uso diário mais direto.',
  },
  planning: {
    label: 'Escolha o formato que combina com você',
    items: [
      ['CalendarClock', 'Cronograma', 'Datas, semanas, assuntos e revisões.'],
      ['RotateCcw', 'Ciclo', 'Rodadas flexíveis por matéria e prioridade.'],
      ['ShieldCheck', 'Ajustável', 'O plano acompanha mudanças na sua rotina.'],
    ],
    note: 'Você pode visualizar seus planejamentos e manter mais de uma estratégia organizada.',
  },
  cronograma: {
    label: 'Do planejamento para onde você quiser',
    items: [
      ['CalendarClock', 'Visão semanal', 'Cada dia mostra assuntos e tempo previsto.'],
      ['BookOpenCheck', 'Revisões', 'As revisões já entram na programação.'],
      ['Download', 'Baixar em PDF', 'Leve o cronograma para consultar ou imprimir.'],
    ],
    note: 'O PDF mantém a organização visual da semana e diferencia teoria e revisão.',
  },
  today: {
    label: 'Tudo preparado antes de começar',
    items: [
      ['Clock3', 'Tempo previsto', 'Saiba quanto dedicar a cada bloco.'],
      ['BookOpenCheck', 'Assunto definido', 'Comece sem perder tempo procurando conteúdo.'],
      ['PlayCircle', 'Acesso direto', 'Abra o timer na atividade selecionada.'],
    ],
    note: 'A sequência diária reúne cronograma, ciclo e revisões em uma leitura rápida.',
  },
  records: {
    label: 'Cada estudo melhora seus indicadores',
    items: [
      ['Clock3', 'Tempo líquido', 'Registre o tempo realmente estudado.'],
      ['ListChecks', 'Questões', 'Acompanhe volume e taxa de acertos.'],
      ['Trophy', 'Constância', 'Metas e histórico evoluem a cada registro.'],
    ],
    note: 'Os registros alimentam calendário, desempenho e progresso das matérias.',
  },
  review: {
    label: 'Uma central para não perder o timing',
    items: [
      ['BookOpenCheck', 'Hoje', 'Veja o que precisa ser retomado agora.'],
      ['Clock3', 'Atrasadas', 'Recupere pendências com contexto.'],
      ['CalendarClock', 'Próximas', 'Antecipe o que já está programado.'],
    ],
    note: 'Revisões do cronograma e do ciclo aparecem juntas e podem ser reagendadas.',
  },
  guides: {
    label: 'Avance sem perder o ponto de retomada',
    items: [
      ['Route', 'Sequência', 'Assuntos organizados na ordem de estudo.'],
      ['CheckCircle2', 'Progresso', 'Identifique etapas concluídas e pendentes.'],
      ['NotebookPen', 'Registro', 'Retome exatamente de onde parou.'],
    ],
    note: 'O guia transforma matérias extensas em passos menores e mais objetivos.',
  },
  cycle: {
    label: 'A roda mostra o ciclo como ele realmente acontece',
    items: [
      ['RotateCcw', 'Ordem visual', 'Sessões aparecem na sequência da rodada.'],
      ['Clock3', 'Duração real', 'Cada bloco mantém o tempo configurado.'],
      ['Target', 'Sessão atual', 'O próximo estudo fica sempre destacado.'],
    ],
    note: 'Ao concluir uma rodada, o sistema preserva seu histórico e prepara a próxima.',
  },
  edital: {
    label: 'Seu edital transformado em acompanhamento',
    items: [
      ['FileText', 'Estrutura completa', 'Disciplinas e assuntos em uma única visão.'],
      ['ListChecks', 'Progresso', 'Acompanhe teoria, revisões e questões.'],
      ['Download', 'Baixar em PDF', 'Escolha versão em branco ou com progresso.'],
    ],
    note: 'O PDF pode incluir o edital completo ou somente os assuntos do seu planejamento.',
  },
  news: {
    label: 'Informação útil sem sair da preparação',
    items: [
      ['Newspaper', 'Atualizações', 'Acompanhe novidades dos concursos.'],
      ['FileText', 'Editais e bancas', 'Veja movimentações e dados importantes.'],
      ['Target', 'Por localidade', 'Consulte concursos por região e estado.'],
    ],
    note: 'Os cards priorizam leitura rápida e dão acesso ao conteúdo completo.',
  },
  performance: {
    label: 'Decisões melhores com dados reais',
    items: [
      ['Activity', 'Ritmo', 'Compare sua evolução ao longo do tempo.'],
      ['BarChart3', 'Precisão', 'Descubra matérias fortes e pontos de atenção.'],
      ['Trophy', 'Constância', 'Visualize metas, calendário e sequência.'],
    ],
    note: 'O desempenho usa seus registros para mostrar onde manter ou ajustar o foco.',
  },
};

const DesktopSlideDetails = ({ slide, mode, tone }) => {
  const content = desktopContent[slide.hero ? mode : slide.preview];
  if (!content) return null;

  return (
    <div className="welcome-carousel-desktop-details hidden md:block">
      <div className="mb-2.5 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${tone.accent}`} />
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{content.label}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {content.items.map(([iconName, title, text]) => {
          const DetailIcon = iconMap[iconName] || CheckCircle2;
          return (
            <div key={title} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${tone.soft} ${tone.text}`}><DetailIcon size={14} strokeWidth={2.4} /></div>
              <p className="text-[11px] font-black text-zinc-900 dark:text-white">{title}</p>
              <p className="mt-1 text-[10px] font-semibold leading-snug text-zinc-500 dark:text-zinc-400">{text}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center gap-2.5 rounded-xl bg-zinc-950 px-3.5 py-2.5 text-white dark:bg-white dark:text-zinc-950">
        <Sparkles size={14} className="shrink-0 text-red-400" />
        <p className="text-[10px] font-bold leading-snug">{content.note}</p>
      </div>
    </div>
  );
};

const WelcomeVisual = ({ mode, firstName }) => (
  <motion.div
    key={mode}
    initial={{ opacity: 0, scale: 0.94, y: 16 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ duration: 0.35 }}
    className="relative flex w-full max-w-md flex-col items-center text-center"
  >
    <div className="absolute inset-x-12 top-2 h-24 rounded-full bg-red-600/20 blur-3xl" />
    <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-white/70 bg-white shadow-2xl shadow-red-900/15 dark:border-white/10 dark:bg-zinc-950 sm:h-24 sm:w-24">
      <img src={LOGO} alt="MODOQAP" className="h-12 w-auto object-contain sm:h-14" />
    </div>
    <p className="relative mt-5 text-[10px] font-black uppercase tracking-[0.32em] text-red-600 dark:text-red-400">
      {mode === 'update' ? 'Uma nova experiência' : `Olá, ${firstName}`}
    </p>
    <p className="relative mt-2 max-w-sm text-2xl font-black leading-none tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
      {mode === 'update' ? 'Seu estudo evoluiu.' : 'Seu plano. Seu ritmo. Sua aprovação.'}
    </p>
    <p className="relative mt-3 max-w-xs text-xs font-semibold leading-relaxed text-zinc-600 dark:text-zinc-300 sm:text-sm">
      {mode === 'update' ? 'Conheça as novidades preparadas para deixar sua rotina mais simples.' : 'Vamos transformar intenção em constância, um estudo de cada vez.'}
    </p>
  </motion.div>
);

const VisualPanel = ({ slide, totalSlides, index, firstName }) => {
  const tone = toneStyles[slide.tone] || toneStyles.red;

  return (
    <div className={`welcome-carousel-visual relative flex min-h-0 flex-col justify-between overflow-hidden border-b bg-red-50 ${tone.border} p-3.5 sm:p-5 md:w-[48%] md:border-b-0 md:border-r dark:bg-red-950/20`}>
      <div className="absolute inset-0 opacity-[0.06]">
        <div className="grid h-full grid-cols-6">
          {Array.from({ length: 24 }).map((_, itemIndex) => (
            <div key={itemIndex} className="border-b border-r border-zinc-950 dark:border-white" />
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute -left-20 bottom-10 h-44 w-44 rounded-full bg-white/45 blur-3xl dark:bg-white/10" />
      <div className="pointer-events-none absolute -right-24 top-16 h-52 w-52 rounded-full bg-zinc-900/10 blur-3xl dark:bg-white/10" />

      <div className="relative z-10 flex items-center justify-between">
        <MiniLogo />
        <div className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-950/70 dark:text-zinc-300 dark:ring-white/10">
          {String(index + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
        </div>
      </div>

      <div className="relative z-10 mt-2 flex min-h-0 flex-1 items-center justify-center md:mt-4">
        <AnimatePresence initial={false}>
          {slide.hero ? (
            <WelcomeVisual mode={slide.id.startsWith('update') ? 'update' : 'welcome'} firstName={firstName} />
          ) : (
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.28 }}
              className="welcome-carousel-preview-scale w-full max-w-[25rem]"
            >
              <PreviewContent slide={slide} tone={tone} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

function WelcomeCarouselModal({ mode = 'welcome', userName = '', isOpen, onComplete, onCreatePlanning }) {
  const [index, setIndex] = useState(0);
  const slides = mode === 'update' ? updateSlides : welcomeSlides;
  const slide = slides[index];
  const isLast = index === slides.length - 1;
  const firstName = useMemo(() => String(userName || '').trim().split(/\s+/)[0] || 'Aluno', [userName]);
  const tone = toneStyles[slide?.tone] || toneStyles.red;
  const Icon = iconMap[slide?.icon] || Sparkles;

  useEffect(() => {
    if (isOpen) setIndex(0);
  }, [isOpen, mode]);

  if (!isOpen || !slide) return null;

  const goNext = () => setIndex((current) => Math.min(current + 1, slides.length - 1));
  const goPrev = () => setIndex((current) => Math.max(current - 1, 0));

  const finish = (action) => {
    if (action === 'planning') onCreatePlanning?.();
    onComplete?.({ action });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100000] flex items-center justify-center p-2 font-sans sm:p-5">
        <motion.div
          className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        <motion.section
          role="dialog"
          aria-modal="true"
          aria-label={mode === 'update' ? 'Novidades do MODOQAP' : 'Boas-vindas ao MODOQAP'}
          className="welcome-carousel-shell relative flex w-full max-w-5xl flex-col overflow-hidden rounded-[1.25rem] border border-white/15 bg-white shadow-2xl dark:bg-zinc-950 md:flex-row"
          initial={{ opacity: 0, scale: 0.94, y: 26 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: 'spring', duration: 0.55, bounce: 0.22 }}
        >
          <VisualPanel slide={slide} totalSlides={slides.length} index={index} firstName={firstName} />

          <div className="welcome-carousel-info flex min-h-0 flex-1 flex-col bg-white dark:bg-zinc-950">
            <div className="welcome-carousel-info-header flex items-center justify-between border-b border-zinc-100 px-4 py-2.5 dark:border-white/10 sm:px-6 sm:py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg ${tone.icon}`}>
                  <Icon size={21} strokeWidth={2.4} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{slide.eyebrow}</p>
                  <p className="truncate text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    {mode === 'update' ? 'Novidades para sua rotina' : `Comece bem, ${firstName}`}
                  </p>
                </div>
              </div>
              {!slide.hero && <MiniLogo />}
            </div>

            <div className="welcome-carousel-copy min-h-0 flex-1 overflow-hidden px-4 py-3 sm:px-6 sm:py-5">
              <AnimatePresence initial={false}>
                <motion.div
                  key={slide.id}
                  className="welcome-carousel-slide-copy"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={{ duration: 0.24 }}
                >
                  <h2 className="welcome-carousel-title max-w-xl text-[1.35rem] font-black leading-[1.04] tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
                    {slide.title}
                  </h2>
                  <p className="welcome-carousel-description mt-2.5 max-w-2xl text-[0.8rem] font-semibold leading-relaxed text-zinc-600 dark:text-zinc-300 sm:mt-3 sm:text-base">
                    {slide.text}
                  </p>

                  {slide.hero ? (
                    <div className="welcome-carousel-welcome-note mt-4 rounded-2xl border border-red-100 bg-red-50/70 p-4 dark:border-red-950/60 dark:bg-red-950/20 sm:mt-6 sm:p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600 dark:text-red-400">
                        {mode === 'update' ? `Novidades em ${slides.length - 1} passos` : 'Tudo pronto para começar'}
                      </p>
                      <p className="mt-2 text-sm font-bold leading-relaxed text-zinc-700 dark:text-zinc-200">
                        {mode === 'update' ? 'Avance para conhecer cada melhoria aplicada à sua rotina.' : 'Nos próximos passos, você verá como o MODOQAP organiza sua preparação.'}
                      </p>
                    </div>
                  ) : (
                    <div className="welcome-carousel-details mt-3.5 rounded-xl border border-red-100 bg-red-50/60 p-3 dark:border-red-950/60 dark:bg-red-950/20 sm:mt-5">
                      <div className="mb-2.5 flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${tone.accent}`} />
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Na prática</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(slide.details || []).slice(0, 2).map((detail, detailIndex) => (
                          <motion.div key={detail} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: detailIndex * 0.06 }} className="flex items-start gap-2 rounded-lg bg-white p-2.5 text-[0.7rem] font-bold leading-snug text-zinc-700 ring-1 ring-red-100 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-red-950/60 sm:text-xs">
                            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${tone.accent} text-white`}><Check size={12} strokeWidth={3} /></span>
                            {detail}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                  <DesktopSlideDetails slide={slide} mode={mode} tone={tone} />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="welcome-carousel-footer border-t border-zinc-100 bg-zinc-50 px-4 py-2.5 dark:border-white/10 dark:bg-zinc-900/70 sm:px-6 sm:py-3">
              <div className="mb-2.5 flex items-center gap-1.5 sm:mb-4">
                {slides.map((item, itemIndex) => (
                  <div
                    key={item.id}
                    className={`h-1.5 rounded-full transition-all ${itemIndex <= index ? tone.accent : 'bg-zinc-200 dark:bg-zinc-700'} ${itemIndex === index ? 'w-9' : 'w-3'}`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={index === 0}
                  aria-label="Voltar ao slide anterior"
                  className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-600 transition-all hover:border-zinc-300 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 sm:h-11 sm:px-4 sm:text-xs"
                >
                  <ChevronLeft size={16} /> <span className="hidden min-[390px]:inline">Voltar</span>
                </button>

                {isLast ? (
                  <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => finish('skip')}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-2.5 text-[9px] font-black uppercase tracking-[0.08em] text-zinc-600 transition-all hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 sm:h-11 sm:px-4 sm:text-xs sm:tracking-[0.12em]"
                    >
                      {mode === 'update' ? 'Continuar' : 'Agora não'}
                    </button>
                    <button
                      type="button"
                      onClick={() => finish('planning')}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-2.5 text-[9px] font-black uppercase tracking-[0.08em] text-white shadow-lg shadow-red-600/25 transition-all hover:-translate-y-0.5 hover:bg-red-700 active:translate-y-0 sm:h-11 sm:px-5 sm:text-xs sm:tracking-[0.12em]"
                    >
                      {mode === 'update' ? 'Planejamento' : 'Criar plano'} <ArrowRight size={15} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-zinc-950 px-4 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-zinc-950/20 transition-all hover:-translate-y-0.5 active:translate-y-0 dark:bg-white dark:text-zinc-950 sm:h-11 sm:px-5 sm:text-xs sm:tracking-[0.12em]"
                  >
                    Próximo <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </AnimatePresence>
  );
}

export default WelcomeCarouselModal;
