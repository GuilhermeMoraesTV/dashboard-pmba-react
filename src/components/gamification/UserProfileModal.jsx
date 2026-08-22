import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Crown,
  Diamond,
  Gem,
  ListChecks,
  Medal,
  Shield,
  Target,
  Trophy,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { formatStudyMinutes, getLeague } from '../../utils/gamification';
import { coverPositionToStyle } from '../../utils/profileCover';
import { LEAGUES_ENABLED } from '../../config/featureFlags';

const leagueIcons = {
  shield: Shield,
  medal: Medal,
  crown: Crown,
  gem: Gem,
  diamond: Diamond,
};

const knownEditalLogos = [
  'gcmaquiraz', 'gcmgoiania', 'gcmrecife', 'gcmsalvador', 'gcmviana',
  'cbmerj', 'cbmmg', 'cbmba', 'pmerj', 'pmmg', 'pmgo', 'pmes', 'pmpe',
  'pmpi', 'pmse', 'pmsp', 'pmal', 'pmba', 'pcpe', 'pcsc', 'pcba', 'ppmg', 'prf',
];

const initials = (name = 'E') => String(name)
  .split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase();

const number = (value) => Math.max(0, Number(value) || 0);
const formatNumber = (value) => number(value).toLocaleString('pt-BR');

const timestampMillis = (value) => {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = new Date(value || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatPlatformDays = (value) => {
  const millis = timestampMillis(value);
  if (!millis) return null;
  const days = Math.max(1, Math.ceil((Date.now() - millis) / 86400000));
  return days.toLocaleString('pt-BR');
};

const normalizeSlug = (value = '') => String(value)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '');

const resolveEditalLogo = (edital = {}) => {
  const direct = edital.logoURL || edital.logoUrl || edital.logo || edital.editalLogoUrl;
  if (direct) return direct;
  const identity = [edital.id, edital.editalId, edital.templateId, edital.name, edital.nome]
    .map(normalizeSlug)
    .filter(Boolean);
  const known = knownEditalLogos.find((code) => identity.some((value) => value.includes(code)));
  return known ? `/logosEditais/logo-${known}.png` : null;
};

const isPublicEdital = (edital) => {
  if (!edital || typeof edital !== 'object') return false;
  const id = normalizeSlug(edital.id || edital.editalId || edital.templateId);
  const name = normalizeSlug(edital.name || edital.nome || edital.editalNome);
  return Boolean(name) && id !== 'manual' && name !== 'planejamentoreservado';
};

const PublicAvatar = ({ name, photoURL }) => {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [photoURL]);

  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-zinc-100 text-2xl font-black text-zinc-500 shadow-2xl ring-4 ring-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-900/60 sm:h-32 sm:w-32 lg:h-36 lg:w-36">
      {photoURL && !imageFailed
        ? <img src={photoURL} alt={`Foto de ${name}`} className="h-full w-full object-cover" onError={() => setImageFailed(true)}/>
        : <span aria-hidden="true">{initials(name)}</span>}
    </div>
  );
};

const CompactEdital = ({ edital }) => {
  const logoURL = resolveEditalLogo(edital);
  const [imageFailed, setImageFailed] = useState(false);
  const name = edital.name || edital.nome || edital.editalNome || 'Edital sem nome';

  useEffect(() => setImageFailed(false), [logoURL]);

  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-2.5 text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 sm:max-w-[240px]">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 p-0.5 text-red-600 dark:bg-zinc-100">
        {logoURL && !imageFailed
          ? <img src={logoURL} alt="" className="h-full w-full object-contain" onError={() => setImageFailed(true)}/>
          : <BookOpen size={12}/>}
      </span>
      <strong className="min-w-0 truncate text-[9px] font-black" title={name}>{name}</strong>
    </span>
  );
};

const MetricCard = ({ icon: Icon, label, value, subtext }) => (
  <article className="group relative min-w-0 overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white px-3 py-3 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-red-500/35 hover:!border-l-red-500 hover:shadow-lg dark:border-white/10 dark:!border-l-red-500/25 dark:bg-card-dark dark:hover:border-red-500/25 dark:hover:!border-l-red-500">
    <div className="relative z-20 min-w-0">
      <p className="truncate text-[9px] font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary">{label}</p>
      <strong className="mt-1 block truncate text-xl font-extrabold leading-none tracking-tight text-text-primary dark:text-text-dark-primary sm:text-2xl" title={String(value)}>{value}</strong>
      {subtext && <p className="mt-1.5 truncate text-[8px] font-semibold text-zinc-400">{subtext}</p>}
    </div>
    {React.createElement(Icon, { strokeWidth: 1.5, className: 'pointer-events-none absolute -bottom-4 -right-3 h-16 w-16 text-red-500/10 transition-all duration-700 group-hover:scale-125 group-hover:-rotate-6 dark:text-red-500/[0.07] sm:h-20 sm:w-20' })}
  </article>
);

const UserProfileModal = ({ member, onClose }) => {
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const closeButtonRef = useRef(null);
  const [coverFailed, setCoverFailed] = useState(false);
  const coverURL = member?.coverURL || member?.coverUrl || member?.cover?.url || null;

  useEffect(() => setCoverFailed(false), [coverURL]);

  useEffect(() => {
    if (!member) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousActiveElement = document.activeElement;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    document.body.style.overflow = 'hidden';
    const handleKey = (event) => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
      previousActiveElement?.focus?.();
    };
  }, [member, onClose]);

  if (!member || typeof document === 'undefined') return null;

  const displayName = member.displayName || 'Estudante';
  const questions = number(member.questions);
  const correct = number(member.correct || member.acertos);
  const errors = number(member.errors ?? member.erros ?? (questions - correct));
  const accuracy = Math.min(100, Math.max(0, questions ? (correct / questions) * 100 : number(member.accuracy)));
  const league = getLeague(member.leagueId || member.currentLeague || 'iron');
  const LeagueIcon = leagueIcons[league.icon] || Shield;
  const editais = Array.isArray(member.editais) ? member.editais.filter(isPublicEdital) : [];
  const visibleEditais = editais.slice(0, 2);
  const remainingEditais = Math.max(0, editais.length - visibleEditais.length);
  const coverPosition = member.coverPosition || member.cover?.position || { x: 50, y: 50 };
  const groupName = member.mainGroupName || member.groupName || 'Sem grupo principal';
  const createdAt = member.platformSinceMillis
    || member.createdAtMillis
    || member.platformSince
    || member.accountCreatedAt
    || member.registrationDate
    || member.createdAt;
  const platformDays = formatPlatformDays(createdAt);
  const rankingPosition = Math.max(0, Number(
    member.publicRankingPosition
    || member.positions?.questions
    || member.generalPosition
    || (LEAGUES_ENABLED ? member.leaguePosition : 0)
    || member.position,
  ) || 0);
  const rankingLabel = member.publicRankingLabel
    || (member.positions?.questions ? 'Ranking de questões' : 'Ranking atual');

  return createPortal(
    <div
      className="fixed inset-0 z-[100100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-zinc-950/65 p-2 backdrop-blur-md sm:p-5"
      onClick={(event) => { if (event.target === event.currentTarget) onClose?.(); }}
    >
      <Motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 230, damping: 25 }}
        className="relative my-auto max-h-[96dvh] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-[1.75rem] border border-zinc-200 bg-zinc-50 text-zinc-900 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      >
        <header className="relative h-48 overflow-hidden rounded-t-[1.7rem] bg-gradient-to-br from-zinc-700 via-zinc-800 to-red-950 sm:h-64">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.38),transparent_48%)]"/>
          {coverURL && !coverFailed && (
            <img
              src={coverURL}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: coverPositionToStyle(coverPosition) }}
              onError={() => setCoverFailed(true)}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/40"/>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4 sm:top-4"
            aria-label="Fechar perfil"
          >
            <X size={19}/>
          </button>
        </header>

        <div className="relative z-10 -mt-14 px-4 pb-5 sm:-mt-16 sm:px-6 sm:pb-7 lg:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div className="flex shrink-0 flex-col items-center">
              <PublicAvatar name={displayName} photoURL={member.photoURL || member.photoUrl}/>
              <span className="-mt-1 inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-700 shadow-md dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                Nível {Math.max(1, Math.floor(number(member.level) || 1))}
              </span>
            </div>

            <div className="min-w-0 flex-1 pt-1 text-center sm:pt-16 sm:text-left">
              <h2 id={titleId} className="break-words text-3xl font-black leading-none tracking-tight text-zinc-900 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] dark:text-white sm:text-4xl lg:text-5xl">
                {displayName}
              </h2>
              <div className="mt-3 flex max-w-full flex-wrap items-center justify-center gap-2 sm:justify-start">
                {LEAGUES_ENABLED ? <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em]"
                  style={{ color: league.color, borderColor: `${league.color}66`, backgroundColor: `${league.color}14` }}
                >
                  <LeagueIcon size={13}/> Liga {league.name}
                </span> : null}
                {visibleEditais.map((edital, index) => <CompactEdital key={`${edital.id || edital.name || 'edital'}-${index}`} edital={edital}/>)}
                {remainingEditais > 0 && <span className="text-[8px] font-black uppercase tracking-wider text-zinc-400">+{remainingEditais}</span>}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard icon={Clock3} label="Tempo de estudo" value={formatStudyMinutes(member.minutes || 0)} subtext="Total acumulado"/>
            <MetricCard icon={ListChecks} label="Questões" value={formatNumber(questions)} subtext="Resolvidas"/>
            <MetricCard icon={CheckCircle2} label="Acertos" value={formatNumber(correct)} subtext="Respostas certas"/>
            <MetricCard icon={XCircle} label="Erros" value={formatNumber(errors)} subtext="Respostas erradas"/>
            <MetricCard icon={Target} label="Precisão" value={`${accuracy.toFixed(0)}%`} subtext="Aproveitamento"/>
            <MetricCard icon={CalendarDays} label="Dias na plataforma" value={platformDays || '—'} subtext={platformDays ? 'Desde o cadastro' : 'Não informado'}/>
            <MetricCard icon={Trophy} label="Ranking" value={rankingPosition ? `${rankingPosition}º` : '—'} subtext={rankingPosition ? rankingLabel : 'Sem posição disponível'}/>
          </div>

          <footer className="mt-5 flex flex-col gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300"><Users size={18}/></span>
              <span className="min-w-0"><span className="block text-[8px] font-black uppercase tracking-[0.18em] text-zinc-400">Grupo principal</span><strong className="mt-0.5 block truncate text-xs font-black text-zinc-700 dark:text-zinc-200" title={groupName}>{groupName}</strong></span>
            </div>
            <div className="flex shrink-0 items-center gap-2 self-end opacity-65 sm:self-auto">
              <img src="/logoModoQAP.png" alt="" className="h-7 w-7 rounded-full object-cover"/>
              <strong className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Modo QAP</strong>
            </div>
          </footer>
        </div>
      </Motion.section>
    </div>,
    document.body,
  );
};

export default UserProfileModal;
