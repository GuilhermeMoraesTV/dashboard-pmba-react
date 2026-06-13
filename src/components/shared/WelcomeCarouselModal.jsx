import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  Gauge,
  Newspaper,
  NotebookPen,
  PlayCircle,
  RotateCcw,
  Route,
  Sparkles,
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
  Gauge,
  Newspaper,
  NotebookPen,
  PlayCircle,
  RotateCcw,
  Route,
  Sparkles,
  Trophy,
};

const welcomeSlides = [
  {
    id: 'hello',
    eyebrow: 'Seu painel de estudos',
    title: 'Bem-vindo ao MODOQAP',
    text: 'Tudo que importa para sua rotina aparece em uma central limpa: plano ativo, estudo de hoje, progresso, revisoes e simulados.',
    icon: 'Sparkles',
    tone: 'red',
    preview: 'dashboard',
    hero: true,
    stat: '1 painel',
    statLabel: 'para comandar a rotina',
    details: [
      'Plano ativo, estudo de hoje e progresso juntos.',
      'Atalhos para estudar, revisar e registrar.',
      'Metas e sequencia diaria sempre visiveis.',
    ],
  },
  {
    id: 'planning',
    eyebrow: 'O ponto de partida',
    title: 'Crie seu planejamento',
    text: 'Escolha como quer estudar: cronograma para seguir dias e semanas definidos, ou ciclo para rodar materias com ritmo continuo.',
    icon: 'Compass',
    tone: 'red',
    preview: 'planning',
    stat: '2 modos',
    statLabel: 'cronograma ou ciclo',
    details: [
      'Cronograma organiza o edital em datas.',
      'Ciclo distribui materias por prioridade.',
      'Voce pode ajustar o plano conforme sua rotina muda.',
    ],
  },
  {
    id: 'today',
    eyebrow: 'Seu dia, sem confusao',
    title: 'Veja exatamente o que estudar',
    text: 'A tela inicial transforma o planejamento em uma lista simples para hoje, com materia, assunto, tempo previsto e botao para iniciar.',
    icon: 'CalendarClock',
    tone: 'red',
    preview: 'today',
    stat: 'Hoje',
    statLabel: 'sempre em primeiro plano',
    details: [
      'Blocos do dia aparecem em ordem clara.',
      'Revisoes entram junto da rotina normal.',
      'O timer abre direto no assunto escolhido.',
    ],
  },
  {
    id: 'records',
    eyebrow: 'Registro rapido',
    title: 'Conte tempo, questoes e acertos',
    text: 'Ao finalizar, registre o que aconteceu: minutos estudados, questoes, acertos e observacoes. O painel usa isso para mostrar sua evolucao.',
    icon: 'NotebookPen',
    tone: 'red',
    preview: 'records',
    stat: 'XP',
    statLabel: 'constancia vira progresso',
    details: [
      'Tempo liquido alimenta metas e calendario.',
      'Questoes e acertos mostram sua precisao.',
      'Cada registro fortalece o historico da materia.',
    ],
  },
  {
    id: 'revision',
    eyebrow: 'Nao deixe conteudo esfriar',
    title: 'Revisoes entram na sua rotina',
    text: 'A central de revisoes separa o que esta para hoje, o que atrasou e o que vem em seguida, para voce retomar conteudos no momento certo.',
    icon: 'BookOpenCheck',
    tone: 'red',
    preview: 'review',
    stat: '24h',
    statLabel: 'controle diario',
    details: [
      'Hoje, atrasadas e proximas ficam separadas.',
      'Voce conclui ou reagenda sem perder o contexto.',
      'Cronograma e ciclo aparecem no mesmo lugar.',
    ],
  },
  {
    id: 'performance',
    eyebrow: 'Evolucao visivel',
    title: 'Acompanhe sua virada',
    text: 'Calendario, desempenho, simulados e noticias completam o painel para voce enxergar ritmo, precisao, constancia e novidades do concurso.',
    icon: 'Trophy',
    tone: 'red',
    preview: 'performance',
    stat: '100%',
    statLabel: 'foco na aprovacao',
    details: [
      'Calendario mostra consistencia diaria.',
      'Desempenho revela materias fortes e fracas.',
      'Noticias ajudam a acompanhar o edital e o concurso.',
    ],
  },
];

const updateSlides = [
  {
    id: 'update-main',
    eyebrow: 'Atualizacao do sistema',
    title: 'Sua area de estudos mudou de nivel',
    text: 'A atualizacao deixou a rotina mais clara: cronograma diario, novo ciclo por assuntos, revisoes centralizadas, guias de estudo e noticias no mesmo ambiente.',
    icon: 'Sparkles',
    tone: 'red',
    preview: 'dashboard',
    hero: true,
    stat: 'Nova fase',
    statLabel: 'mais orientada e visual',
    details: [
      'Tudo comeca pelo plano ativo.',
      'Menos procura, mais acao.',
    ],
  },
  {
    id: 'update-cronograma',
    eyebrow: 'Novo cronograma',
    title: 'Cronograma agora vira rotina do dia',
    text: 'O cronograma transforma edital, disponibilidade e data da prova em uma trilha diaria com teoria, revisoes e tempo previsto.',
    icon: 'CalendarClock',
    tone: 'red',
    preview: 'cronograma',
    stat: 'Dia a dia',
    statLabel: 'com teoria e revisoes',
    details: [
      'Distribui assuntos ao longo das semanas.',
      'Inclui revisoes no proprio planejamento.',
    ],
  },
  {
    id: 'update-ciclo',
    eyebrow: 'Novo ciclo',
    title: 'Ciclo agora tem guia por assunto',
    text: 'O ciclo ficou mais inteligente para quem prefere rodadas: materias, assuntos e progresso aparecem em uma sequencia clara.',
    icon: 'RotateCcw',
    tone: 'red',
    preview: 'cycle',
    stat: 'Rodadas',
    statLabel: 'com progresso visivel',
    details: [
      'Assuntos ficam dentro do guia de estudo.',
      'A rodada concluida pede finalizacao.',
    ],
  },
  {
    id: 'update-revisao',
    eyebrow: 'Revisao',
    title: 'Revisoes ganharam uma central propria',
    text: 'As revisoes agora ficam em uma central propria: hoje, atrasadas e proximas, com origem e assunto sempre visiveis.',
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
    title: 'Guias mostram o caminho dentro da materia',
    text: 'Os guias transformam materia grande em passos menores, mostrando assunto, registro e avanco sem depender da memoria.',
    icon: 'Route',
    tone: 'red',
    preview: 'guides',
    stat: 'Passo a passo',
    statLabel: 'por materia e assunto',
    details: [
      'Assuntos aparecem em sequencia.',
      'Fica mais facil retomar de onde parou.',
    ],
  },
  {
    id: 'update-news',
    eyebrow: 'Noticias',
    title: 'Noticias agora fazem parte da preparacao',
    text: 'A pagina de noticias aproxima voce das atualizacoes do concurso, com edital, banca e movimentacoes em um espaco proprio.',
    icon: 'Newspaper',
    tone: 'red',
    preview: 'news',
    stat: 'Radar',
    statLabel: 'do concurso',
    details: [
      'Conteudo separado da rotina de estudo.',
      'Cards visuais para leitura rapida.',
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
  <div className={`rounded-xl border-2 border-l-4 border-zinc-200 border-l-red-500 bg-white p-4 shadow-xl shadow-zinc-900/8 dark:border-white/10 dark:border-l-red-500 dark:bg-zinc-950 ${className}`}>
    {children}
  </div>
);

const PreviewHeader = ({ icon: Icon, title, tone }) => (
  <div className="mb-3 flex items-center justify-between">
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Previa</p>
      <p className="mt-1 text-sm font-black text-zinc-900 dark:text-white">{title}</p>
    </div>
    <div className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-lg ${tone.icon}`}>
      <Icon size={20} strokeWidth={2.4} />
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
    <PreviewHeader icon={CalendarClock} title="Semana do cronograma" tone={tone} />
    <div className="mb-3 grid grid-cols-5 gap-1.5">
      {['S', 'T', 'Q', 'Q', 'S'].map((day, itemIndex) => (
        <div key={`${day}-${itemIndex}`} className={`rounded-lg py-2 text-center text-[10px] font-black ${itemIndex === 2 ? 'bg-red-600 text-white' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900'}`}>
          {day}
        </div>
      ))}
    </div>
    <div className="space-y-2">
      {[
        ['Teoria', 'Portugues', '80 min'],
        ['Revisao', 'Direito Penal', '25 min'],
        ['Treino', 'Raciocinio Logico', '30 min'],
      ].map(([type, subject, time], itemIndex) => (
        <motion.div
          key={subject}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: itemIndex * 0.1 }}
          className="flex items-center justify-between rounded-xl bg-white p-2.5 ring-1 ring-zinc-100 dark:bg-zinc-900 dark:ring-zinc-800"
        >
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">{type}</p>
            <p className="text-xs font-black text-zinc-900 dark:text-white">{subject}</p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[10px] font-black ${tone.soft} ${tone.text}`}>{time}</span>
        </motion.div>
      ))}
    </div>
  </PreviewCard>
);

const PreviewCycle = ({ tone }) => (
  <PreviewCard>
    <PreviewHeader icon={RotateCcw} title="Rodada do ciclo" tone={tone} />
    <div className="relative mx-auto mb-3 flex h-32 w-32 items-center justify-center rounded-full border-[12px] border-red-100 dark:border-red-950/70">
      <motion.div
        className="absolute inset-[-12px] rounded-full border-[12px] border-transparent border-t-red-600 border-r-red-600"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
      <div className="text-center">
        <p className="text-2xl font-black text-zinc-950 dark:text-white">64%</p>
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">rodada</p>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      {['Portugues', 'Penal', 'Historia', 'Informatica'].map((item, itemIndex) => (
        <div key={item} className={`rounded-lg px-2 py-1.5 text-[10px] font-black ${itemIndex === 1 ? `${tone.accent} text-white` : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>
          {item}
        </div>
      ))}
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
  if (preview === 'performance') return <PreviewPerformance tone={tone} />;
  return <PreviewDashboard tone={tone} />;
};

const VisualPanel = ({ slide, totalSlides, index }) => {
  const tone = toneStyles[slide.tone] || toneStyles.red;

  return (
    <div className={`relative flex min-h-[230px] flex-col justify-between overflow-hidden border-b bg-red-50 ${tone.border} p-4 sm:min-h-[320px] md:w-[43%] md:border-b-0 md:border-r md:p-5 dark:bg-red-950/20`}>
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
        {slide.hero ? (
          <div>
            <img src={LOGO} alt="MODOQAP" className="h-12 w-auto object-contain drop-shadow-sm sm:h-14 md:h-16" />
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">area de estudos</p>
          </div>
        ) : (
          <MiniLogo />
        )}
        <div className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-950/70 dark:text-zinc-300 dark:ring-white/10">
          {String(index + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
        </div>
      </div>

      <div className="relative z-10 mt-6 flex flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.28 }}
            className="relative w-full max-w-[21rem] pb-7"
          >
            <PreviewContent slide={slide} tone={tone} />
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="absolute bottom-0 left-5 right-5 rounded-xl border border-white/80 bg-white px-4 py-2.5 shadow-xl shadow-zinc-900/10 dark:border-white/10 dark:bg-zinc-900"
          >
            <p className={`text-2xl font-black leading-none ${tone.text}`}>{slide.stat}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{slide.statLabel}</p>
          </motion.div>
          </motion.div>
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
      <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 font-sans sm:p-5">
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
          className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.25rem] border border-white/15 bg-white shadow-2xl dark:bg-zinc-950 md:flex-row"
          initial={{ opacity: 0, scale: 0.94, y: 26 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: 'spring', duration: 0.55, bounce: 0.22 }}
        >
          <VisualPanel slide={slide} totalSlides={slides.length} index={index} />

          <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-white/10 sm:px-6">
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

            <div className="min-h-0 flex-1 overflow-hidden px-5 py-4 sm:px-6 sm:py-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={slide.id}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={{ duration: 0.24 }}
                >
                  <h2 className="max-w-xl text-2xl font-black leading-[1.04] tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
                    {slide.title}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-zinc-600 dark:text-zinc-300 sm:text-base">
                    {slide.text}
                  </p>

                  <div className="mt-4 rounded-xl border border-red-100 bg-red-50/60 p-3 dark:border-red-950/60 dark:bg-red-950/20">
                    <div className="mb-3 flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${tone.accent}`} />
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                        Como funciona na pratica
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(slide.details || []).slice(0, 2).map((detail, detailIndex) => (
                        <motion.div
                          key={detail}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: detailIndex * 0.06 }}
                          className="flex items-start gap-2 rounded-lg bg-white p-2.5 text-xs font-bold leading-snug text-zinc-700 ring-1 ring-red-100 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-red-950/60"
                        >
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${tone.accent} text-white`}>
                            <Check size={12} strokeWidth={3} />
                          </span>
                          {detail}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {slides.map((item, itemIndex) => {
                      const itemTone = toneStyles[item.tone] || toneStyles.red;
                      const ItemIcon = iconMap[item.icon] || Sparkles;
                      const active = itemIndex === index;
                      const seen = itemIndex < index;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => itemIndex <= index && setIndex(itemIndex)}
                          disabled={itemIndex > index}
                          className={`group flex min-h-[58px] flex-col justify-between rounded-lg border p-2 text-left transition-all ${
                            active
                              ? `${itemTone.border} ${itemTone.soft} shadow-sm`
                              : seen
                                ? 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900'
                                : 'border-zinc-100 bg-zinc-50 opacity-60 dark:border-zinc-900 dark:bg-zinc-900/40'
                          }`}
                          title={item.title}
                        >
                          <div className="flex items-center justify-between">
                            <ItemIcon size={15} className={active ? itemTone.text : 'text-zinc-400'} />
                            {seen && <Check size={14} className="text-emerald-500" />}
                          </div>
                          <span className="line-clamp-2 text-[9px] font-black uppercase leading-tight tracking-[0.06em] text-zinc-600 dark:text-zinc-300">
                            {item.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-3 dark:border-white/10 dark:bg-zinc-900/70 sm:px-6">
              <div className="mb-4 flex items-center gap-1.5">
                {slides.map((item, itemIndex) => (
                  <div
                    key={item.id}
                    className={`h-1.5 rounded-full transition-all ${itemIndex <= index ? tone.accent : 'bg-zinc-200 dark:bg-zinc-700'} ${itemIndex === index ? 'w-9' : 'w-3'}`}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={index === 0}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-zinc-600 transition-all hover:border-zinc-300 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                >
                  <ChevronLeft size={16} /> Voltar
                </button>

                {isLast ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => finish('skip')}
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-zinc-600 transition-all hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                    >
                      {mode === 'update' ? 'Continuar' : 'Pular agora'}
                    </button>
                    <button
                      type="button"
                      onClick={() => finish('planning')}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-xs font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-red-600/25 transition-all hover:-translate-y-0.5 hover:bg-red-700 active:translate-y-0"
                    >
                      {mode === 'update' ? 'Ver planejamento' : 'Criar planejamento'} <ArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 text-xs font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-zinc-950/20 transition-all hover:-translate-y-0.5 active:translate-y-0 dark:bg-white dark:text-zinc-950"
                  >
                    Proximo <ChevronRight size={16} />
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
