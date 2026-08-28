import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen, CalendarDays, CheckCircle2, Clock3, Flame, ListChecks, Trophy, Users, X,
} from 'lucide-react';
import { formatStudyMinutes } from '../../utils/gamification';
import { coverPositionToStyle } from '../../utils/profileCover';
import ProfileLevelRing from './ProfileLevelRing';

const knownLogos = [
  'gcmaquiraz', 'gcmgoiania', 'gcmrecife', 'gcmsalvador', 'gcmviana',
  'cbmerj', 'cbmmg', 'cbmba', 'pmerj', 'pmmg', 'pmgo', 'pmes', 'pmpe',
  'pmpi', 'pmse', 'pmsp', 'pmal', 'pmba', 'pcpe', 'pcsc', 'pcba', 'ppmg', 'prf',
];

const clean = (value = '') => String(value).toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const number = (value) => Math.max(0, Number(value) || 0);
const formatNumber = (value) => number(value).toLocaleString('pt-BR');
const timestampMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return Number(value.toMillis()) || 0;
  if (typeof value?.toDate === 'function') return value.toDate()?.getTime?.() || 0;
  if (Number.isFinite(Number(value))) return Number(value);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const platformDays = (value) => {
  const createdAt = timestampMillis(value);
  if (!createdAt || createdAt > Date.now()) return null;
  return Math.max(1, Math.floor((Date.now() - createdAt) / 86400000));
};

const editalLogo = (edital = {}) => {
  const direct = edital.logoURL || edital.logoUrl || edital.logo || edital.editalLogoUrl;
  if (direct) return direct;
  const values = [edital.id, edital.editalId, edital.templateId, edital.name, edital.nome].map(clean);
  const known = knownLogos.find((code) => values.some((value) => value.includes(code)));
  return known ? `/logosEditais/logo-${known}.png` : null;
};

const publicEdital = (edital) => {
  if (!edital || typeof edital !== 'object') return false;
  const id = clean(edital.id || edital.editalId || edital.templateId);
  const name = clean(edital.name || edital.nome || edital.editalNome);
  return Boolean(name) && id !== 'manual' && name !== 'planejamentoreservado';
};

const publicStudyGroups = (member = {}) => {
  const source = member.studyGroups || member.groups || member.gruposEstudo || [];
  if (!Array.isArray(source)) return [];
  const unique = new Map();
  source.forEach((group, index) => {
    if (!group || typeof group !== 'object') return;
    const name = String(group.name || group.nome || '').trim();
    const id = String(group.id || group.groupId || `${name}:${index}`);
    if (name && !unique.has(id)) unique.set(id, { ...group, id, name });
  });
  return [...unique.values()];
};

const EditalBadge = ({ edital }) => {
  const logo = editalLogo(edital);
  const name = edital.name || edital.nome || edital.editalNome || 'Edital';
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logo]);
  return (
    <span title={name} className="inline-flex min-w-0 max-w-[230px] items-center gap-2 rounded-full border border-zinc-200 bg-white/85 py-1 pl-1 pr-2.5 text-[10px] font-bold text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-300">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 p-0.5 text-red-600 dark:bg-zinc-700">
        {logo && !failed
          ? <img src={logo} alt="" className="h-full w-full object-contain" onError={() => setFailed(true)}/>
          : <BookOpen size={12}/>}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
};

const GroupBadge = ({ group }) => {
  const name = group.name || group.nome || 'Grupo de estudo';
  return (
    <span title={name} className="inline-flex min-w-0 max-w-[230px] items-center gap-2 rounded-full border border-zinc-200 bg-white/85 py-1 pl-1 pr-2.5 text-[10px] font-bold text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-300">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
        {group.photoURL ? <img src={group.photoURL} alt="" className="h-full w-full object-cover"/> : <Users size={12}/>}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
};

const ProfileTag = ({ icon: Icon, label, value, tone = 'orange', title = '' }) => (
  <span title={title || `${label}: ${value}`} className="inline-flex min-w-0 max-w-[230px] items-center gap-2 rounded-full border border-zinc-200 bg-white/85 py-1 pl-1 pr-2.5 text-[10px] font-bold text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-300">
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tone === 'amber' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400'}`}>
      {React.createElement(Icon, { size: 12, strokeWidth: 2 })}
    </span>
    <span className="truncate">{label} <strong className="font-black text-zinc-900 dark:text-white">{value}</strong></span>
  </span>
);

const SectionTitle = ({ children }) => (
  <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
    {children}
  </h3>
);

const EmptyAssociations = ({ children }) => (
  <p className="text-[10px] font-semibold text-zinc-400">
    {children}
  </p>
);

const MetricCard = ({ icon: Icon, label, value }) => (
  <article className="min-w-0 rounded-2xl border border-zinc-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.025)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-4">
    <div className="flex items-center justify-between gap-3">
      <p className="text-[10px] font-bold leading-tight text-zinc-500 dark:text-zinc-400">{label}</p>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        {React.createElement(Icon, { size: 15, strokeWidth: 1.9 })}
      </span>
    </div>
    <strong className="mt-3 block truncate text-xl font-black leading-none tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-2xl" title={String(value)}>{value}</strong>
  </article>
);

const UserProfileModal = ({ member, onClose }) => {
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const closeRef = useRef(null);
  const [coverFailed, setCoverFailed] = useState(false);
  const coverURL = member?.coverURL || member?.coverUrl || member?.cover?.url || null;

  useEffect(() => setCoverFailed(false), [coverURL]);
  useEffect(() => {
    if (!member) return undefined;
    const overflow = document.body.style.overflow;
    const active = document.activeElement;
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    document.body.style.overflow = 'hidden';
    const keydown = (event) => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', keydown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', keydown);
      active?.focus?.();
    };
  }, [member, onClose]);

  if (!member || typeof document === 'undefined') return null;

  const name = member.displayName || 'Estudante';
  const editais = Array.isArray(member.editais) ? member.editais.filter(publicEdital).slice(0, 2) : [];
  const studyGroups = publicStudyGroups(member);
  const questions = number(member.questions);
  const correct = number(member.correct || member.acertos);
  const streak = number(member.streak || member.currentStreak || member.studyStreak);
  const level = Math.max(1, Math.floor(number(member.level) || 1));
  const daysOnPlatform = platformDays(
    member.platformSinceMillis
    || member.createdAtMillis
    || member.platformSince
    || member.accountCreatedAt
    || member.registrationDate
    || member.createdAt,
  );
  const rankingPosition = Math.max(0, Number(member.publicRankingPosition || member.positions?.questions || member.generalPosition || member.position) || 0);
  const rankingLabel = member.publicRankingLabel || (member.positions?.questions ? 'Ranking de questões' : 'Ranking atual');
  const bio = String(member.bio || member.biografia || member.about || '').trim();
  const coverPosition = member.coverPosition || member.cover?.position || { x: 50, y: 50 };
  const avatarLevelData = {
    currentLevel: level,
    progressPercent: number(member.levelProgress ?? member.progressPercent),
    levelRing: member.levelRing || '#dc2626',
  };

  return createPortal(
    <div className="user-profile-modal-portal fixed inset-0 z-[100100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-zinc-950/70 p-2 backdrop-blur-md sm:p-5" onClick={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <Motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 230, damping: 25 }}
        className="relative my-auto max-h-[96dvh] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-[1.75rem] border border-zinc-200 bg-zinc-50 text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
      >
        <header className="relative h-36 overflow-hidden rounded-t-[1.7rem] bg-gradient-to-br from-zinc-700 via-zinc-800 to-red-950 sm:h-48">
          <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.22),transparent_48%)]"/>
          {coverURL && !coverFailed ? <img src={coverURL} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: coverPositionToStyle(coverPosition) }} onError={() => setCoverFailed(true)}/> : null}
          <span className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/5 to-black/45"/>
          <button ref={closeRef} type="button" onClick={onClose} className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-zinc-950/55 text-white backdrop-blur-md transition hover:bg-zinc-950/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4 sm:top-4" aria-label="Fechar perfil"><X size={17}/></button>
        </header>

        <div className="relative z-10 -mt-12 px-4 pb-5 sm:-mt-14 sm:px-6 sm:pb-7 lg:px-8">
          <section className="flex flex-col items-center sm:flex-row sm:items-start sm:gap-5">
            <div className="shrink-0 rounded-full bg-white p-1 shadow-lg ring-1 ring-zinc-200 [&_span.absolute]:min-w-7 [&_span.absolute]:px-1.5 [&_span.absolute]:text-[11px] [&_span.absolute]:leading-5 dark:bg-zinc-900 dark:ring-zinc-700">
              <ProfileLevelRing userPhotoURL={member.photoURL || member.photoUrl} levelData={avatarLevelData} size={104} strokeWidth={4}/>
            </div>
            <div className="mt-3 min-w-0 flex-1 text-center sm:mt-0 sm:pt-16 sm:text-left">
              <h2 id={titleId} className="break-words text-2xl font-black leading-tight tracking-tight text-zinc-950 dark:text-white sm:text-3xl lg:text-4xl">{name}</h2>
              {bio ? <p className="mx-auto mt-2 max-w-2xl text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 sm:mx-0 sm:text-sm">{bio}</p> : null}
            </div>
          </section>

          <section className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start" aria-label="Destaques do perfil">
            <ProfileTag icon={Flame} label="Sequência de estudo" value={streak ? `${streak}d` : '—'}/>
            <ProfileTag icon={Trophy} label="Ranking" value={rankingPosition ? `${rankingPosition}º` : '—'} tone="amber" title={rankingLabel}/>
          </section>

          <section className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3" aria-label="Estatísticas principais">
            <MetricCard icon={Clock3} label="Tempo estudado" value={formatStudyMinutes(member.minutes || 0)}/>
            <MetricCard icon={ListChecks} label="Questões realizadas" value={formatNumber(questions)}/>
            <MetricCard icon={CheckCircle2} label="Acertos" value={formatNumber(correct)}/>
            <MetricCard icon={CalendarDays} label="Dias na plataforma" value={daysOnPlatform ? formatNumber(daysOnPlatform) : '—'}/>
          </section>

          <section className="mt-5">
            <SectionTitle>Editais em estudo</SectionTitle>
            {editais.length ? <div className="mt-2 flex flex-wrap gap-2">{editais.map((edital, index) => <EditalBadge key={`${edital.id || edital.name || 'edital'}-${index}`} edital={edital}/>)}</div> : <div className="mt-2"><EmptyAssociations>Nenhum edital público informado.</EmptyAssociations></div>}
          </section>

          <section className="mt-4">
            <SectionTitle>Grupos de Estudo</SectionTitle>
            {studyGroups.length ? <div className="mt-2 flex flex-wrap gap-2">{studyGroups.map((group) => <GroupBadge key={group.id} group={group}/>)}</div> : <div className="mt-2"><EmptyAssociations>Nenhum grupo público informado.</EmptyAssociations></div>}
          </section>
        </div>
      </Motion.section>
    </div>,
    document.body,
  );
};

export default UserProfileModal;
