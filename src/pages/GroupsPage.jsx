import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Briefcase,
  Camera,
  Check,
  Clock3,
  Copy,
  DoorOpen,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  Radio,
  Search,
  Settings,
  Target,
  Trophy,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { db } from '../firebaseConfig';
import { uploadSecureImage, validateImageFile } from '../services/secureImageUpload';
import {
  joinPrivateStudyGroupByCode,
  leaveStudyGroup,
  listStudyGroups,
  removeStudyGroupMember,
  requestPrivateGroupEntry,
  updateStudyGroupMemberRole,
} from '../services/groupMembership';
import { formatStudyMinutes, getMonthId, getWeekId, sortGeneralRankingMembers, sortGroupsRanking } from '../utils/gamification';
import {
  calculateLiveTimerSeconds,
  formatLiveTimer,
  getGroupMemberStudyState,
  GROUP_MEMBER_STUDY_STATES,
  sortGroupMembersByStudyState,
} from '../utils/liveStudyTimer';
import { useEditaisCatalog } from '../hooks/useEditaisCatalog';
import UserProfileModal from '../components/gamification/UserProfileModal';

const makeInviteCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => alphabet[value % alphabet.length]).join('');
};

const isPermissionDenied = (error) => (
  error?.code === 'permission-denied'
  || error?.code === 'firestore/permission-denied'
);

const Avatar = ({ member, size = 'h-10 w-10' }) => (
  <div className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-[10px] font-black text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300`}>
    {member?.photoURL ? <img src={member.photoURL} alt="" className="h-full w-full object-cover"/> : String(member?.displayName || 'E').slice(0, 1).toUpperCase()}
  </div>
);

const Surface = ({ children, className = '' }) => <div className={`rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-card-dark ${className}`}>{children}</div>;

const ModalPortal = ({ children, onClose, className = '' }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[1200] grid min-h-[100dvh] place-items-center overflow-y-auto bg-black/65 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div className={`my-auto w-full ${className}`}>{children}</div>
    </div>,
    document.body,
  );
};

const GroupAvatar = ({ group, className = 'h-12 w-12', iconSize = 22 }) => (
  <div className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-white shadow-lg shadow-red-600/15`}>
    {group?.photoURL
      ? <img src={group.photoURL} alt={`Foto do grupo ${group.name || ''}`} className="h-full w-full object-cover"/>
      : <Users size={iconSize}/>
    }
  </div>
);

const getEditalLabel = (group) => (
  group?.editalName
  || group?.editalNome
  || (typeof group?.edital === 'string' ? group.edital : '')
  || group?.edital?.nome
  || group?.edital?.name
  || (typeof group?.editalVinculado === 'string' ? group.editalVinculado : '')
  || group?.editalVinculado?.nome
  || group?.editalVinculado?.name
  || ''
);

const editalTitle = (edital) => edital?.titulo || edital?.nome || edital?.name || edital?.sigla || 'Edital sem nome';
const editalLogo = (edital) => edital?.logoUrl || edital?.logo || edital?.editalLogoUrl || '';
const editalCargos = (edital) => {
  const source = edital?.cargos || edital?.cargosDisponiveis || edital?.cargos_disponiveis || edital?.cargo || [];
  const values = Array.isArray(source) ? source : [source];
  return [...new Set(values.map((item) => typeof item === 'string' ? item : item?.nome || item?.name || item?.titulo).filter(Boolean))];
};

const DescriptionModal = ({ group, onClose }) => group ? <ModalPortal onClose={onClose} className="max-w-lg"><Surface className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-600">Descrição</p><h2 className="mt-0.5 text-xl font-black text-zinc-950 dark:text-white">{group.name}</h2></div><button onClick={onClose} className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Fechar descrição"><X size={18}/></button></div><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{group.description?.trim() || 'Este grupo ainda não possui descrição.'}</p></Surface></ModalPortal> : null;

const GroupStatCard = ({ icon: Icon, label, value }) => (
  <div className="group relative flex min-h-[86px] flex-col justify-center overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white px-3 py-2.5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-red-500/40 hover:!border-l-red-500 hover:shadow-lg dark:border-white/10 dark:!border-l-red-500/25 dark:bg-card-dark dark:hover:border-red-500/25 dark:hover:!border-l-red-500">
    <div className="relative z-20 flex w-full flex-col gap-0.5">
      <h3 className="truncate text-[10px] font-bold uppercase leading-none tracking-wider text-text-secondary dark:text-text-dark-secondary">{label}</h3>
      <p className="mt-1 text-xl font-extrabold leading-none tracking-tight text-text-primary dark:text-text-dark-primary md:text-2xl">{value}</p>
    </div>
    <div className="pointer-events-none absolute -bottom-4 -right-4 z-10 text-red-500/10 transition-all duration-700 ease-out group-hover:scale-125 group-hover:-rotate-12 dark:text-red-500/5">
      {React.createElement(Icon, { strokeWidth: 1.5, className: 'h-16 w-16 md:h-20 md:w-20' })}
    </div>
  </div>
);

const getGroupMemberCount = (group) => Math.max(0, Number(group?.memberCount || 0));

const MEMBER_STATE_STYLES = {
  [GROUP_MEMBER_STUDY_STATES.STUDYING]: {
    label: 'Estudando',
    activityFallback: 'Sessão de estudo',
    card: 'border-emerald-200 bg-emerald-50/45 dark:border-emerald-900/55 dark:bg-emerald-950/15',
    dot: 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-300',
  },
  [GROUP_MEMBER_STUDY_STATES.PAUSED]: {
    label: 'Pausado',
    activityFallback: 'Cronômetro pausado',
    card: 'border-amber-200 bg-amber-50/45 dark:border-amber-900/55 dark:bg-amber-950/15',
    dot: 'bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.12)]',
    badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-300',
  },
  [GROUP_MEMBER_STUDY_STATES.OFFLINE]: {
    label: 'Offline',
    activityFallback: 'Sem sessão ativa',
    card: 'border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/55',
    dot: 'bg-zinc-400 shadow-[0_0_0_4px_rgba(161,161,170,0.12)]',
    badge: 'border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
  },
};

const LiveMemberCard = ({ member, timer, state, onOpen }) => {
  const [seconds, setSeconds] = useState(() => calculateLiveTimerSeconds(timer));
  useEffect(() => {
    const update = () => setSeconds(calculateLiveTimerSeconds(timer));
    update();
    if (state === GROUP_MEMBER_STUDY_STATES.OFFLINE) return undefined;
    const intervalId = window.setInterval(update, 1000);
    return () => window.clearInterval(intervalId);
  }, [state, timer]);
  const styles = MEMBER_STATE_STYLES[state] || MEMBER_STATE_STYLES[GROUP_MEMBER_STUDY_STATES.OFFLINE];
  const activity = timer?.disciplinaNome || timer?.titulo || timer?.atividadeNome || timer?.assunto || styles.activityFallback;

  return (
    <button type="button" onClick={() => onOpen?.(member)} className={`relative flex min-w-0 flex-col items-center rounded-2xl border px-2.5 py-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${styles.card}`}>
      <span className={`absolute right-3 top-3 h-2 w-2 rounded-full ${styles.dot}`}/>
      <Avatar member={member} size="h-12 w-12 sm:h-14 sm:w-14"/>
      <p className="mt-2.5 w-full truncate text-xs font-black text-zinc-900 dark:text-white">{member.displayName || member.name || member.email?.split('@')[0] || 'Membro'}</p>
      <p className="mt-0.5 w-full truncate text-[9px] font-bold uppercase tracking-wide text-zinc-400" title={activity}>{activity}</p>
      <span className={`mt-2 rounded-lg border px-2.5 py-1 text-[10px] font-black tabular-nums ${styles.badge}`}>{state === GROUP_MEMBER_STUDY_STATES.OFFLINE ? styles.label : `${styles.label} · ${formatLiveTimer(seconds)}`}</span>
    </button>
  );
};

const GroupsPage = ({ user, gamificationProfile = {}, levelData }) => {
  const editaisMap = useEditaisCatalog();
  const [view, setView] = useState('my');
  const [directoryGroups, setDirectoryGroups] = useState([]);
  const [bootstrapGroups, setBootstrapGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [groupRankingMembers, setGroupRankingMembers] = useState([]);
  const [timers, setTimers] = useState({});
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [descriptionGroup, setDescriptionGroup] = useState(null);
  const [editalPickerOpen, setEditalPickerOpen] = useState(false);
  const [successorUid, setSuccessorUid] = useState('');
  const [settingsName, setSettingsName] = useState('');
  const [form, setForm] = useState({ name: '', description: '', visibility: 'public', editalId: '', cargo: '' });
  const [groupPhoto, setGroupPhoto] = useState(null);
  const [groupPhotoPreview, setGroupPhotoPreview] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [memberActionUid, setMemberActionUid] = useState(null);
  const [message, setMessage] = useState('');
  const [accessBlocked, setAccessBlocked] = useState(false);
  const [groupRankingMetric, setGroupRankingMetric] = useState('minutes');
  const [memberRankingMetric, setMemberRankingMetric] = useState('minutes');
  const [memberRankingPeriod, setMemberRankingPeriod] = useState('weekly');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [presenceNowMs, setPresenceNowMs] = useState(() => Date.now());
  const groupIds = useMemo(() => Array.isArray(gamificationProfile.groupIds) ? gamificationProfile.groupIds : [], [gamificationProfile.groupIds]);
  const mainGroupId = groupIds.includes(gamificationProfile.mainGroupId) ? gamificationProfile.mainGroupId : null;
  const weekId = getWeekId();
  const monthId = getMonthId();
  const editalOptions = useMemo(() => [...editaisMap.values()].filter((item) => item?.deleted !== true && item?.ativo !== false).sort((a, b) => editalTitle(a).localeCompare(editalTitle(b), 'pt-BR')), [editaisMap]);
  const selectedEdital = useMemo(() => form.editalId ? editaisMap.get(String(form.editalId)) || editalOptions.find((item) => String(item.id) === String(form.editalId)) : null, [editalOptions, editaisMap, form.editalId]);
  const editalCargoOptions = useMemo(() => editalOptions.flatMap((edital) => {
    const cargos = editalCargos(edital);
    return (cargos.length ? cargos : ['']).map((cargo) => ({ edital, cargo }));
  }), [editalOptions]);
  const publicGroups = useMemo(() => {
    const merged = new Map();
    const joinedById = new Map(myGroups.map((group) => [group.id, group]));
    bootstrapGroups.forEach((group) => merged.set(group.id || group.groupId, { ...group, id: group.id || group.groupId }));
    directoryGroups.forEach((group) => {
      const id = group.id || group.groupId;
      const authoritative = merged.get(id);
      merged.set(id, {
        ...authoritative,
        ...group,
        id,
        memberCount: authoritative ? getGroupMemberCount(authoritative) : getGroupMemberCount(group),
      });
    });
    joinedById.forEach((group, id) => {
      const publicGroup = merged.get(id);
      if (publicGroup) merged.set(id, { ...publicGroup, memberCount: getGroupMemberCount(group) });
    });
    return [...merged.values()]
      .filter((group) => group.id && group.status !== 'blocked')
      .sort((a, b) => Number(b.createdAtMillis || b.createdAt?.toMillis?.() || 0) - Number(a.createdAtMillis || a.createdAt?.toMillis?.() || 0));
  }, [bootstrapGroups, directoryGroups, myGroups]);

  useEffect(() => () => {
    if (groupPhotoPreview) URL.revokeObjectURL(groupPhotoPreview);
  }, [groupPhotoPreview]);

  useEffect(() => {
    const timer = window.setInterval(() => setPresenceNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    listStudyGroups().then((result) => {
      if (!active) return;
      setBootstrapGroups(Array.isArray(result?.groups) ? result.groups : []);
      setAccessBlocked(false);
    }).catch((error) => {
      if (!active) return;
      if (!isPermissionDenied(error)) console.error('[Grupos] Erro ao carregar diretório inicial:', error);
      setAccessBlocked(true);
    });
    const unsubscribe = onSnapshot(query(collection(db, 'study_group_directory'), orderBy('createdAt', 'desc')), (snapshot) => {
      setDirectoryGroups(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (error) => {
    if (isPermissionDenied(error)) {
      setAccessBlocked(true);
      return;
    }
      console.error('[Grupos] Erro ao acompanhar diretório de grupos:', error);
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!groupIds.length) {
      setMyGroups([]);
      return undefined;
    }
    const state = new Map();
    const memberCounts = new Map();
    const publish = () => setMyGroups([...state.values()].map((group) => ({
      ...group,
      memberCount: memberCounts.get(group.id) ?? getGroupMemberCount(group),
    })));
    const unsubscribers = groupIds.flatMap((groupId) => [
      onSnapshot(doc(db, 'study_groups', groupId), (snapshot) => {
        if (snapshot.exists()) state.set(groupId, { id: snapshot.id, ...snapshot.data() });
        else state.delete(groupId);
        publish();
      }, (error) => {
        if (!isPermissionDenied(error)) console.error('[Grupos] Erro ao carregar grupo:', groupId, error);
      }),
      onSnapshot(collection(db, 'study_groups', groupId, 'members'), (snapshot) => {
        memberCounts.set(groupId, snapshot.size);
        publish();
      }, (error) => {
        if (!isPermissionDenied(error)) console.error('[Grupos] Erro ao contar membros:', groupId, error);
      }),
    ]);
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [groupIds]);

  useEffect(() => {
    if (!selectedGroupId) {
      setSelectedGroup(null);
      setMembers([]);
      setTimers({});
      return undefined;
    }
    const unsubscribeGroup = onSnapshot(doc(db, 'study_groups', selectedGroupId), (snapshot) => {
      if (snapshot.exists()) setSelectedGroup({ id: snapshot.id, ...snapshot.data() });
    });
    const unsubscribeMembers = onSnapshot(collection(db, 'study_groups', selectedGroupId, 'members'), (snapshot) => {
      setMembers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (error) => {
      if (!isPermissionDenied(error)) console.error('[Grupos] Erro ao carregar membros:', error);
    });
    return () => {
      unsubscribeGroup();
      unsubscribeMembers();
    };
  }, [selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId) {
      setGroupRankingMembers([]);
      return undefined;
    }
    setGroupRankingMembers([]);
    if (memberRankingPeriod === 'monthly') return undefined;
    return onSnapshot(collection(db, 'study_groups', selectedGroupId, 'weekly_rankings', weekId, 'members'), (snapshot) => {
      setGroupRankingMembers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (error) => {
      if (!isPermissionDenied(error)) console.error('[Grupos] Erro ao carregar ranking interno:', error);
    });
  }, [memberRankingPeriod, monthId, selectedGroupId, weekId]);

  useEffect(() => {
    setTimers({});
    if (!selectedGroupId || !members.length) return undefined;
    const next = {};
    const unsubscribers = members.map((member) => onSnapshot(doc(db, 'active_timers', member.uid || member.id), (snapshot) => {
      if (snapshot.exists()) next[member.uid || member.id] = snapshot.data();
      else delete next[member.uid || member.id];
      setTimers({ ...next });
    }, () => {}));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [members, selectedGroupId]);

  const notify = (text) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3200);
  };

  const selectGroupPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await validateImageFile(file);
    } catch (validationError) {
      notify(validationError.message);
      event.target.value = '';
      return;
    }
    setGroupPhoto(file);
    setGroupPhotoPreview(URL.createObjectURL(file));
  };

  const clearGroupPhoto = () => {
    setGroupPhoto(null);
    setGroupPhotoPreview('');
  };

  const createGroup = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name || !user?.uid) return;
    setBusy(true);
    const groupRef = doc(collection(db, 'study_groups'));
    const code = makeInviteCode();
    const memberPayload = {
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Estudante',
      photoURL: user.photoURL || null,
      role: 'owner',
      permissions: { manageGroup: true, manageMembers: true },
      level: levelData?.currentLevel || 1,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      const batch = writeBatch(db);
      batch.set(groupRef, {
        name,
        description: form.description.trim(),
        visibility: form.visibility,
        editalId: selectedEdital?.id || null,
        editalName: selectedEdital ? editalTitle(selectedEdital) : '',
        editalLogoURL: selectedEdital ? editalLogo(selectedEdital) : '',
        cargo: form.cargo || '',
        ownerId: user.uid,
        inviteCode: code,
        photoURL: null,
        memberCount: 1,
        weeklyMinutes: 0,
        weeklyQuestions: 0,
        weeklyCorrect: 0,
        weeklyAccuracy: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'study_groups', groupRef.id, 'members', user.uid), memberPayload);
      batch.set(doc(db, 'study_group_invites', code), {
        code,
        groupId: groupRef.id,
        groupName: name,
        ownerId: user.uid,
        active: true,
        visibility: form.visibility,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'users', user.uid, 'gamification', 'profile'), {
        groupIds: arrayUnion(groupRef.id),
        lastJoinedGroupId: groupRef.id,
        mainGroupId: mainGroupId || groupRef.id,
        mainGroupName: mainGroupId ? gamificationProfile.mainGroupName : name,
        createdGroupCount: increment(1),
        socialUpdatedAt: serverTimestamp(),
      }, { merge: true });
      await batch.commit();
      let photoWarning = false;
      if (groupPhoto) {
        try {
          const upload = await uploadSecureImage(groupPhoto, { kind: 'group', groupId: groupRef.id });
          await updateDoc(groupRef, { photoURL: upload.url, updatedAt: serverTimestamp() });
        } catch (uploadError) {
          photoWarning = true;
          console.error('Grupo criado, mas a foto segura falhou:', uploadError);
        }
      }
      setForm({ name: '', description: '', visibility: 'public', editalId: '', cargo: '' });
      setEditalPickerOpen(false);
      clearGroupPhoto();
      setCreateOpen(false);
      setSelectedGroupId(groupRef.id);
      notify(photoWarning
        ? 'Grupo criado com segurança, mas a foto não pôde ser enviada.'
        : 'Grupo criado. Código de convite pronto para compartilhar.');
    } catch (error) {
      if (!isPermissionDenied(error)) console.error(error);
      notify(isPermissionDenied(error)
        ? 'A criação depende da publicação das novas regras de dados.'
        : 'Não foi possível criar o grupo.');
    } finally {
      setBusy(false);
    }
  };

  const joinGroup = async ({ code = '', group = null } = {}) => {
    if (!user?.uid) return;
    setBusy(true);
    try {
      let groupId = group?.id;
      let groupName = group?.name;
      let joinSource = 'public';
      let normalizedCode = '';
      let visibility = group?.visibility || 'public';
      if (!groupId) {
        normalizedCode = code.trim().toUpperCase();
        const invite = await getDoc(doc(db, 'study_group_invites', normalizedCode));
        if (!invite.exists() || invite.data().active !== true) throw new Error('invalid-invite');
        groupId = invite.data().groupId;
        groupName = invite.data().groupName;
        joinSource = 'invite';
        visibility = invite.data().visibility || 'private';
        if (!invite.data().visibility) {
          try {
            const invitedGroup = await getDoc(doc(db, 'study_groups', groupId));
            if (invitedGroup.exists()) visibility = invitedGroup.data().visibility || 'private';
          } catch {
            visibility = 'private';
          }
        }
      }
      if (groupIds.includes(groupId)) {
        setSelectedGroupId(groupId);
        setJoinOpen(false);
        return;
      }
      if (visibility === 'private') {
        if (joinSource === 'invite' && normalizedCode) {
          const joined = await joinPrivateStudyGroupByCode(normalizedCode);
          setInviteCode('');
          setJoinOpen(false);
          setSelectedGroupId(joined.groupId || groupId);
          notify('Código confirmado. Entrada liberada no grupo privado.');
          return;
        }
        await requestPrivateGroupEntry(groupId);
        setInviteCode('');
        setJoinOpen(false);
        notify('Solicitação enviada. Líderes e vice-líderes foram avisados.');
        return;
      }
      const batch = writeBatch(db);
      batch.set(doc(db, 'study_groups', groupId, 'members', user.uid), {
        uid: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || 'Estudante',
        photoURL: user.photoURL || null,
        role: 'member',
        permissions: { manageGroup: false, manageMembers: false },
        joinSource,
        ...(normalizedCode ? { inviteCodeUsed: normalizedCode } : {}),
        level: levelData?.currentLevel || 1,
        joinedAt: serverTimestamp(),
        socialUpdatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'users', user.uid, 'gamification', 'profile'), {
        groupIds: arrayUnion(groupId),
        lastJoinedGroupId: groupId,
        mainGroupId: mainGroupId || groupId,
        mainGroupName: mainGroupId ? gamificationProfile.mainGroupName : groupName,
        socialUpdatedAt: serverTimestamp(),
      }, { merge: true });
      await batch.commit();
      setInviteCode('');
      setJoinOpen(false);
      setSelectedGroupId(groupId);
      notify('Entrada confirmada no grupo.');
    } catch (error) {
      if (!isPermissionDenied(error)) console.error(error);
      notify(error.message === 'invalid-invite'
        ? 'Código inválido ou expirado.'
        : isPermissionDenied(error)
          ? 'A entrada em grupos depende da publicação das novas regras do Firestore.'
          : 'Não foi possível entrar no grupo.');
    } finally {
      setBusy(false);
    }
  };

  const setMainGroup = async () => {
    if (!selectedGroup) return;
    await updateDoc(doc(db, 'users', user.uid, 'gamification', 'profile'), {
      mainGroupId: selectedGroup.id,
      mainGroupName: selectedGroup.name,
      socialUpdatedAt: serverTimestamp(),
    });
    notify('Grupo principal atualizado.');
  };

  const toggleVisibility = async () => {
    const currentMember = members.find((member) => (member.uid || member.id) === user?.uid);
    if (selectedGroup?.ownerId !== user?.uid && currentMember?.permissions?.manageGroup !== true) return;
    try {
      await updateDoc(doc(db, 'study_groups', selectedGroup.id), {
        visibility: selectedGroup.visibility === 'public' ? 'private' : 'public',
        updatedAt: serverTimestamp(),
      });
      notify(selectedGroup.visibility === 'public' ? 'Grupo definido como privado.' : 'Grupo definido como público.');
    } catch (error) {
      if (!isPermissionDenied(error)) console.error(error);
      notify('Não foi possível atualizar a visibilidade.');
    }
  };

  const openSettings = () => {
    setSettingsName(selectedGroup?.name || '');
    clearGroupPhoto();
    setSettingsOpen(true);
  };

  const saveGroupIdentity = async () => {
    if (!selectedGroup || !settingsName.trim()) return;
    setBusy(true);
    try {
      let photoURL = selectedGroup.photoURL || null;
      if (groupPhoto) {
        const upload = await uploadSecureImage(groupPhoto, { kind: 'group', groupId: selectedGroup.id });
        photoURL = upload.url;
      }
      await updateDoc(doc(db, 'study_groups', selectedGroup.id), { name: settingsName.trim(), photoURL, updatedAt: serverTimestamp() });
      setSettingsOpen(false); clearGroupPhoto(); notify('Nome e imagem do grupo atualizados.');
    } catch (error) {
      if (!isPermissionDenied(error)) console.error(error);
      notify('Não foi possível atualizar o grupo.');
    } finally { setBusy(false); }
  };

  const confirmLeaveGroup = async () => {
    if (!selectedGroup) return;
    setBusy(true);
    try {
      await leaveStudyGroup({ groupId: selectedGroup.id, successorUid: successorUid || null });
      setExitOpen(false); setSuccessorUid(''); setSelectedGroupId(null); notify('Você saiu do grupo.');
    } catch (error) {
      notify(error?.message || 'Não foi possível sair do grupo.');
    } finally { setBusy(false); }
  };

  const setViceLeader = async (member, enabled) => {
    if (!selectedGroup || selectedGroup.ownerId !== user?.uid) return;
    const memberId = member.uid || member.id;
    if (!memberId || memberId === selectedGroup.ownerId) return;
    setMemberActionUid(memberId);
    try {
      await updateStudyGroupMemberRole({ groupId: selectedGroup.id, memberUid: memberId, viceLeader: enabled });
      notify(enabled ? `${member.displayName || 'Membro'} agora é vice-líder.` : 'Vice-liderança removida.');
    } catch (error) {
      if (!isPermissionDenied(error)) console.error(error);
      notify('Não foi possível alterar a função deste membro.');
    } finally {
      setMemberActionUid(null);
    }
  };

  const removeMember = async (member) => {
    if (!selectedGroup) return;
    const currentMember = members.find((item) => (item.uid || item.id) === user?.uid);
    const canManageMembers = selectedGroup.ownerId === user?.uid || currentMember?.permissions?.manageMembers === true;
    const memberId = member.uid || member.id;
    const protectedMember = memberId === selectedGroup.ownerId
      || (member.role === 'vice_leader' && selectedGroup.ownerId !== user?.uid);
    if (!canManageMembers || !memberId || protectedMember) return;
    setMemberActionUid(memberId);
    try {
      await removeStudyGroupMember({ groupId: selectedGroup.id, memberUid: memberId });
      notify(`${member.displayName || 'Membro'} foi removido do grupo.`);
    } catch (error) {
      if (!isPermissionDenied(error)) console.error(error);
      notify('Não foi possível remover o membro. Verifique as permissões publicadas.');
    } finally {
      setMemberActionUid(null);
    }
  };

  const copyInvite = async () => {
    await navigator.clipboard?.writeText(selectedGroup?.inviteCode || '');
    notify('Código copiado.');
  };

  const rankedMembers = useMemo(() => {
    const metricsByMemberId = new Map(groupRankingMembers.map((member) => [member.uid || member.id, member]));
    return sortGeneralRankingMembers(members.map((member) => ({
      ...member,
      ...(metricsByMemberId.get(member.uid || member.id) || {}),
      minutes: memberRankingPeriod === 'monthly' && member.monthlyMetricsMonthId === monthId
        ? Number(member.monthlyMinutes || 0)
        : Number(metricsByMemberId.get(member.uid || member.id)?.minutes || 0),
      questions: memberRankingPeriod === 'monthly' && member.monthlyMetricsMonthId === monthId
        ? Number(member.monthlyQuestions || 0)
        : Number(metricsByMemberId.get(member.uid || member.id)?.questions || 0),
      correct: memberRankingPeriod === 'monthly' && member.monthlyMetricsMonthId === monthId
        ? Number(member.monthlyCorrect || 0)
        : Number(metricsByMemberId.get(member.uid || member.id)?.correct || 0),
    })), memberRankingMetric);
  }, [groupRankingMembers, memberRankingMetric, memberRankingPeriod, members, monthId]);
  const groupRankingByMemberId = useMemo(() => new Map(
    rankedMembers.map((member) => [member.uid || member.id, member]),
  ), [rankedMembers]);
  const orderedMembers = useMemo(
    () => sortGroupMembersByStudyState(members, timers, presenceNowMs),
    [members, presenceNowMs, timers],
  );
  const studyingNow = orderedMembers.filter((member) => (
    getGroupMemberStudyState(timers[member.uid || member.id], presenceNowMs) === GROUP_MEMBER_STUDY_STATES.STUDYING
  ));
  const rankedGroups = useMemo(() => sortGroupsRanking(publicGroups.map((group) => (
    group.weeklyMetricsWeekId === weekId
      ? group
      : { ...group, weeklyXP: 0, weeklyMinutes: 0, weeklyQuestions: 0 }
  )), groupRankingMetric), [groupRankingMetric, publicGroups, weekId]);
  const openGroupProfile = (member, explicitPosition = 0) => {
    const rankingIndex = rankedMembers.findIndex((item) => (item.uid || item.id) === (member.uid || member.id));
    const publicRankingPosition = explicitPosition || (rankingIndex >= 0 ? rankingIndex + 1 : 0);
    setSelectedProfile({
      ...member,
      ...(publicRankingPosition ? {
        publicRankingPosition,
        publicRankingLabel: `Ranking de ${memberRankingMetric === 'minutes' ? 'tempo' : 'questões'} ${memberRankingPeriod === 'monthly' ? 'mensal' : 'semanal'}`,
      } : {}),
    });
  };

  if (selectedGroupId && selectedGroup) {
    const isMember = groupIds.includes(selectedGroupId);
    const isOwner = selectedGroup.ownerId === user?.uid;
    const currentMember = members.find((member) => (member.uid || member.id) === user?.uid);
    const canManageGroup = isOwner || currentMember?.permissions?.manageGroup === true;
    const canManageMembers = isOwner || currentMember?.permissions?.manageMembers === true;
    const successorCandidates = members.filter((item) => (item.uid || item.id) !== user?.uid);
    const needsSuccessor = (isOwner || currentMember?.role === 'vice_leader') && successorCandidates.length > 0;
    const editalLabel = getEditalLabel(selectedGroup);
    const groupTotals = rankedMembers.reduce((sum, member) => ({
      minutes: sum.minutes + Number(member.minutes || 0),
      questions: sum.questions + Number(member.questions || 0),
      correct: sum.correct + Number(member.correct || 0),
    }), { minutes: 0, questions: 0, correct: 0 });
    const groupAccuracy = groupTotals.questions ? (groupTotals.correct / groupTotals.questions) * 100 : 0;
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-3 pb-24 pt-3 sm:px-5 lg:px-7">
        {message && <div className="fixed right-4 top-16 z-[100] rounded-xl bg-zinc-950 px-4 py-3 text-xs font-bold text-white shadow-2xl">{message}</div>}
        <button onClick={() => setSelectedGroupId(null)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowLeft size={16}/> Voltar aos grupos</button>
        <header className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-card-dark sm:p-6">
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-red-600/10 blur-3xl"/>
          <div className="relative flex items-start gap-4">
            <GroupAvatar group={selectedGroup} className="h-16 w-16 sm:h-20 sm:w-20" iconSize={30}/>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 truncate text-2xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-3xl">{selectedGroup.name}</h1>
                {selectedGroup.visibility === 'private' ? <Lock size={14} className="shrink-0 text-zinc-400"/> : <Eye size={14} className="shrink-0 text-emerald-500"/>}
              </div>
              {editalLabel && <p className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate text-[10px] font-black uppercase tracking-wider text-red-600"><BookOpen size={12}/>{editalLabel}</p>}
              <button onClick={() => setDescriptionGroup(selectedGroup)} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500 transition hover:border-red-300 hover:text-red-600 dark:border-zinc-700"><BookOpen size={11}/> Descrição</button>
              {isMember && <div className="mt-2"><p className="mb-1 text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">Código de convite</p><button onClick={copyInvite} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1.5 font-mono text-[9px] font-black tracking-[0.14em] text-zinc-600 transition hover:bg-red-50 hover:text-red-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-red-950/30" title="Copiar código de convite"><KeyRound size={11}/>{selectedGroup.inviteCode}<Copy size={10}/></button></div>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isMember && mainGroupId !== selectedGroup.id && <button onClick={setMainGroup} className="hidden rounded-xl border border-zinc-200 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:text-zinc-300 sm:inline-flex"><Check size={13} className="mr-1"/> Principal</button>}
              {(canManageGroup || canManageMembers) && <button onClick={openSettings} aria-label="Configurações do grupo" title="Configurações do grupo" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:hover:bg-red-950/30"><Settings size={17}/></button>}
              {isMember && <button onClick={() => setExitOpen(true)} aria-label="Sair do grupo" title="Sair do grupo" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:hover:bg-red-950/30"><LogOut size={17}/></button>}
            </div>
          </div>
          {isMember && mainGroupId !== selectedGroup.id && <button onClick={setMainGroup} className="relative mt-4 inline-flex items-center rounded-xl border border-zinc-200 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:text-zinc-300 sm:hidden"><Check size={13} className="mr-1"/> Tornar principal</button>}
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[[Users, 'Membros', members.length], [Clock3, memberRankingPeriod === 'monthly' ? 'Tempo mensal' : 'Tempo semanal', formatStudyMinutes(groupTotals.minutes)], [BarChart3, 'Questões', Math.round(groupTotals.questions)], [Target, 'Precisão', `${groupAccuracy.toFixed(0)}%`]].map(([Icon, label, value]) => <GroupStatCard key={label} icon={Icon} label={label} value={value}/>)}
        </div>

        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.65fr)_minmax(250px,.75fr)]">
          <Surface className="relative min-h-[320px] overflow-hidden p-4 sm:p-5">
            <div className="relative mb-4 flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-600">Presença do grupo</p><h2 className="text-base font-black text-zinc-900 dark:text-white">Estudando agora</h2></div><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[9px] font-black uppercase text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"><Radio size={11} className={studyingNow.length ? 'animate-pulse' : ''}/>{studyingNow.length} estudando</span></div>
            {orderedMembers.length ? <div className="relative max-h-[390px] overflow-y-auto pr-1"><div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">{orderedMembers.map((member) => { const memberId = member.uid || member.id; const timer = timers[memberId]; return <LiveMemberCard key={memberId} member={{ ...member, ...(groupRankingByMemberId.get(memberId) || {}) }} timer={timer} state={getGroupMemberStudyState(timer, presenceNowMs)} onOpen={openGroupProfile}/>; })}</div></div> : <div className="relative flex min-h-[225px] items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/30"><div><Users className="mx-auto mb-2 text-zinc-300 dark:text-zinc-700" size={27}/><p className="text-xs font-black text-zinc-600 dark:text-zinc-300">Nenhum membro encontrado</p></div></div>}
          </Surface>
          <Surface className="sticky top-20 overflow-hidden shadow-none">
            <div className="border-b border-zinc-100 p-4 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="text-xs font-black uppercase tracking-[0.16em] text-zinc-700 dark:text-zinc-200">Ranking interno</h2><p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-zinc-400">Somente membros · horas e questões</p></div>
                <Trophy size={16} className="shrink-0 text-red-600"/>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
                  {[['minutes', Clock3, 'Tempo'], ['questions', BarChart3, 'Questões']].map(([id, Icon, label]) => <button type="button" key={id} onClick={() => setMemberRankingMetric(id)} className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[8px] font-black uppercase tracking-wider transition ${memberRankingMetric === id ? 'bg-white text-red-600 shadow-sm dark:bg-card-dark' : 'text-zinc-400'}`}>{React.createElement(Icon, { size: 11 })}{label}</button>)}
                </div>
                <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
                  {[['weekly', 'Semanal'], ['monthly', 'Mensal']].map(([id, label]) => <button type="button" key={id} onClick={() => setMemberRankingPeriod(id)} className={`flex-1 rounded-lg px-2 py-1.5 text-[8px] font-black uppercase tracking-wider transition ${memberRankingPeriod === id ? 'bg-white text-red-600 shadow-sm dark:bg-card-dark' : 'text-zinc-400'}`}>{label}</button>)}
                </div>
              </div>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">{rankedMembers.slice(0, 5).map((member, index) => <button type="button" onClick={() => openGroupProfile(member, index + 1)} key={member.uid || member.id} className="grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 px-4 py-2.5 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900"><span className="text-center text-[10px] font-black text-zinc-400">{index + 1}</span><div className="flex min-w-0 items-center gap-2.5"><Avatar member={member} size="h-8 w-8"/><div className="min-w-0"><p className="truncate text-[11px] font-black text-zinc-700 dark:text-zinc-200">{member.displayName}</p><p className="text-[8px] font-bold uppercase text-zinc-400">{formatStudyMinutes(member.minutes)} · {Math.round(member.questions || 0)} q</p></div></div><strong className="text-[11px] font-black text-red-600">{memberRankingMetric === 'minutes' ? formatStudyMinutes(member.minutes) : `${Number(member.questions || 0).toLocaleString('pt-BR')} q`}</strong></button>)}{!rankedMembers.length && <div className="p-8 text-center text-xs text-zinc-400">Nenhum membro no grupo.</div>}</div>
          </Surface>
        </div>
        {settingsOpen && (
          <ModalPortal onClose={() => setSettingsOpen(false)} className="max-w-2xl">
            <Surface className="modal-zoom group-settings-modal flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:px-5">
                <div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-600">Administração</p><h2 className="text-xl font-black text-zinc-950 dark:text-white">Configurações do grupo</h2><p className="mt-0.5 text-[10px] text-zinc-400">Líder e vice-líder gerenciam membros. Apenas o líder altera funções.</p></div>
                <button onClick={() => setSettingsOpen(false)} className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X size={18}/></button>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                {canManageGroup && <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700"><h3 className="text-xs font-black text-zinc-800 dark:text-white">Identidade do grupo</h3><p className="mt-0.5 text-[9px] text-zinc-400">Líder e vice-líder podem alterar nome e imagem.</p><div className="mt-3 flex items-center gap-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-red-600 text-white">{groupPhotoPreview ? <img src={groupPhotoPreview} alt="Prévia" className="h-full w-full object-cover"/> : <GroupAvatar group={selectedGroup} className="h-14 w-14"/>}</div><div className="min-w-0 flex-1"><input value={settingsName} onChange={(event) => setSettingsName(event.target.value)} maxLength={60} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs font-bold text-zinc-900 outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"/><label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[8px] font-black uppercase text-red-600 dark:border-zinc-700"><Camera size={12}/> Trocar imagem<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectGroupPhoto} className="sr-only"/></label></div></div><button onClick={saveGroupIdentity} disabled={busy || !settingsName.trim()} className="mt-3 w-full rounded-xl bg-red-600 py-2.5 text-[9px] font-black uppercase tracking-wider text-white disabled:opacity-50">Salvar alterações</button></section>}
                {canManageGroup && (
                  <button onClick={toggleVisibility} className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 text-left transition hover:border-red-300 hover:bg-red-50/60 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:bg-red-950/15">
                    <span><strong className="block text-xs font-black text-zinc-800 dark:text-white">Visibilidade do grupo</strong><span className="mt-0.5 block text-[10px] text-zinc-400">{selectedGroup.visibility === 'public' ? 'Público: qualquer estudante pode encontrar e participar.' : 'Privado: aparece para todos, mas exige código ou aprovação da liderança.'}</span></span>
                    {selectedGroup.visibility === 'public' ? <Eye size={18} className="ml-3 shrink-0 text-emerald-500"/> : <EyeOff size={18} className="ml-3 shrink-0 text-zinc-400"/>}
                  </button>
                )}

                <section className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60"><div><h3 className="flex items-center gap-2 text-xs font-black text-zinc-800 dark:text-white"><UserCog size={15} className="text-red-600"/> Membros e funções</h3><p className="mt-0.5 text-[9px] text-zinc-400">{members.length} participantes no grupo</p></div><ShieldCheck size={18} className="text-zinc-300"/></div>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {members.map((member) => {
                      const memberId = member.uid || member.id;
                      const ownerMember = memberId === selectedGroup.ownerId || member.role === 'owner';
                      const viceLeader = member.role === 'vice_leader';
                      const canRemoveThisMember = canManageMembers && !ownerMember && (!viceLeader || isOwner);
                      return (
                        <div key={memberId} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-3 sm:px-4">
                          <Avatar member={member} size="h-10 w-10"/>
                          <div className="min-w-0"><p className="truncate text-xs font-black text-zinc-800 dark:text-white">{member.displayName || 'Membro'}</p><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${ownerMember ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' : viceLeader ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>{ownerMember ? 'Líder' : viceLeader ? 'Vice-líder' : 'Membro'}</span></div>
                          <div className="flex items-center gap-1.5">
                            {isOwner && !ownerMember && <button disabled={memberActionUid === memberId} onClick={() => setViceLeader(member, !viceLeader)} className="rounded-lg border border-zinc-200 px-2.5 py-2 text-[8px] font-black uppercase tracking-wider text-zinc-500 transition hover:border-red-300 hover:text-red-600 disabled:opacity-40 dark:border-zinc-700">{viceLeader ? 'Remover vice' : 'Tornar vice'}</button>}
                            {canRemoveThisMember && <button disabled={memberActionUid === memberId} onClick={() => removeMember(member)} aria-label={`Remover ${member.displayName || 'membro'}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/25"><Trash2 size={14}/></button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </Surface>
          </ModalPortal>
        )}
        {exitOpen && <ModalPortal onClose={() => setExitOpen(false)} className="max-w-md"><Surface className="modal-zoom w-full p-5"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-wider text-red-600">Sair do grupo</p><h2 className="text-xl font-black text-zinc-950 dark:text-white">Confirmar saída</h2></div><button onClick={() => setExitOpen(false)} className="p-2 text-zinc-400"><X size={18}/></button></div><p className="mt-3 text-xs leading-relaxed text-zinc-500">Você deixará de aparecer entre os membros de <strong>{selectedGroup.name}</strong>.</p>{needsSuccessor && <label className="mt-4 block text-[9px] font-black uppercase tracking-wider text-zinc-500">Quem assume seu cargo?<select value={successorUid} onChange={(event) => setSuccessorUid(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs font-bold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"><option value="">Selecione um membro</option>{successorCandidates.map((item) => <option key={item.uid || item.id} value={item.uid || item.id}>{item.displayName || 'Membro'}</option>)}</select></label>}{isOwner && !successorCandidates.length && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/25 dark:text-amber-200">Como não há outros membros, o grupo será encerrado ao confirmar.</p>}<div className="mt-5 grid grid-cols-2 gap-2"><button onClick={() => setExitOpen(false)} className="rounded-xl border border-zinc-200 py-2.5 text-[9px] font-black uppercase text-zinc-500 dark:border-zinc-700">Cancelar</button><button onClick={confirmLeaveGroup} disabled={busy || (needsSuccessor && !successorUid)} className="rounded-xl bg-red-600 py-2.5 text-[9px] font-black uppercase text-white disabled:opacity-40">Confirmar saída</button></div></Surface></ModalPortal>}
        <DescriptionModal group={descriptionGroup} onClose={() => setDescriptionGroup(null)}/>
        <UserProfileModal member={selectedProfile} onClose={() => setSelectedProfile(null)}/>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-3 pb-24 pt-3 sm:px-5 lg:px-7">
      {message && <div className="fixed right-4 top-16 z-[100] rounded-xl bg-zinc-950 px-4 py-3 text-xs font-bold text-white shadow-2xl">{message}</div>}
      {accessBlocked && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
          A área social está pronta no app local, mas a base remota ainda não aceitou as novas regras de grupos.
        </div>
      )}
      <header className="group relative overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white p-4 shadow-soft transition-all duration-300 hover:border-red-500/40 hover:!border-l-red-500 dark:border-white/10 dark:!border-l-red-500/25 dark:bg-card-dark dark:hover:border-red-500/25">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-500/5 blur-[80px] transition group-hover:bg-red-500/10"/>
        <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 items-start gap-3"><div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-xl shadow-red-500/20"><Users size={22}/></div><div className="min-w-0"><h1 className="text-2xl font-black uppercase leading-none tracking-tight text-zinc-900 dark:text-white sm:text-3xl">Grupos <span className="bg-gradient-to-r from-red-600 to-rose-700 bg-clip-text text-transparent">de estudo</span></h1><p className="mt-2 max-w-2xl text-xs font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400 sm:text-sm">Estude em equipe, acompanhe a atividade e compartilhe objetivos.</p></div></div>
          <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto"><button onClick={() => setJoinOpen(true)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"><KeyRound size={15}/> Inserir código</button><button onClick={() => setCreateOpen(true)} className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-red-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700"><Plus size={15}/> Criar grupo</button></div>
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-900">
        {[['my', Users, 'Meus grupos'], ['discover', Search, 'Descobrir'], ['ranking', Trophy, 'Ranking de grupos']].map(([id, Icon, label]) => <button key={id} onClick={() => setView(id)} className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-wider ${view === id ? 'bg-white text-red-600 shadow-sm dark:bg-card-dark' : 'text-zinc-400'}`}>{React.createElement(Icon, { size: 14 })}{label}</button>)}
      </div>

      {view === 'ranking' ? (
        <Surface className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 p-4 dark:border-zinc-800">
            <div><h2 className="text-xs font-black uppercase tracking-[0.16em] text-zinc-700 dark:text-zinc-200">Ranking de grupos</h2><p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-zinc-400">Desempenho acadêmico semanal consolidado</p></div>
            <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
              {[['minutes', Clock3, 'Tempo'], ['questions', BarChart3, 'Questões']].map(([id, Icon, label]) => <button type="button" key={id} onClick={() => setGroupRankingMetric(id)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[8px] font-black uppercase tracking-wider transition ${groupRankingMetric === id ? 'bg-white text-red-600 shadow-sm dark:bg-card-dark' : 'text-zinc-400'}`}>{React.createElement(Icon, { size: 12 })}{label}</button>)}
            </div>
          </div>
          <div className="space-y-2 bg-zinc-50/60 p-2 dark:bg-zinc-950/20 sm:p-3">{rankedGroups.map((group, index) => <button key={group.id} onClick={() => groupIds.includes(group.id) ? setSelectedGroupId(group.id) : null} className={`grid w-full grid-cols-[32px_auto_1fr_auto] items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${index === 0 ? 'border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/20' : index === 1 ? 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60' : index === 2 ? 'border-orange-300 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-950/20' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-card-dark'}`}><span className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black ${index === 0 ? 'bg-amber-500 text-white' : index === 1 ? 'bg-slate-500 text-white' : index === 2 ? 'bg-orange-600 text-white' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>{index + 1}</span><GroupAvatar group={group} className="h-9 w-9" iconSize={16}/><div className="min-w-0"><p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-black text-zinc-800 dark:text-white"><span className="truncate">{group.name}</span>{group.visibility === 'private' ? <Lock size={11} className="shrink-0 text-zinc-400"/> : null}</p><p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{getGroupMemberCount(group)} membros · {groupRankingMetric === 'minutes' ? `${Math.round(group.weeklyQuestions || 0)} questões` : formatStudyMinutes(group.weeklyMinutes || 0)}</p></div><span className="text-right"><span className="block text-[7px] font-black uppercase tracking-wider text-zinc-400">{groupRankingMetric === 'minutes' ? 'Tempo' : 'Questões'}</span><strong className="text-xs font-black text-red-600">{groupRankingMetric === 'minutes' ? formatStudyMinutes(group.weeklyMinutes || 0) : Number(group.weeklyQuestions || 0).toLocaleString('pt-BR')}</strong></span></button>)}{!rankedGroups.length && <div className="p-10 text-center text-xs text-zinc-400">Nenhum grupo disponível.</div>}</div>
        </Surface>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(view === 'my' ? myGroups : publicGroups).map((group) => {
            const joined = groupIds.includes(group.id);
            return (
              <Surface key={group.id} className="group p-3 transition duration-200 hover:-translate-y-0.5 hover:border-red-200 hover:shadow-lg dark:hover:border-red-900/50">
                <div className="flex min-w-0 items-center gap-3">
                  <GroupAvatar group={group} className="h-14 w-14 rounded-xl" iconSize={20}/>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <h2 className="min-w-0 flex-1 truncate text-sm font-black text-zinc-900 dark:text-white">{group.name}</h2>
                      {group.visibility === 'private' ? <Lock size={12} className="shrink-0 text-zinc-400"/> : <Eye size={12} className="shrink-0 text-emerald-500"/>}
                      {!joined && <button onClick={() => joinGroup({ group })} disabled={busy} className="ml-1 inline-flex h-7 shrink-0 items-center justify-center rounded-lg bg-red-600 px-2.5 text-[8px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-50">{group.visibility === 'private' ? 'Solicitar' : 'Entrar'}</button>}
                    </div>
                    {getEditalLabel(group) && <p className="mt-0.5 truncate text-[9px] font-bold text-red-600">{getEditalLabel(group)}</p>}
                    <p className="mt-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-zinc-400"><Users size={11}/>{getGroupMemberCount(group)} membros</p>
                  </div>
                </div>
                <div className={`mt-3 grid gap-2 ${joined ? 'grid-cols-[auto_1fr]' : 'grid-cols-[auto]'}`}><button onClick={() => setDescriptionGroup(group)} className="inline-flex items-center justify-center gap-1 rounded-xl border border-zinc-200 px-2.5 py-2 text-[8px] font-black uppercase tracking-wider text-zinc-500 transition hover:border-red-300 hover:text-red-600 dark:border-zinc-700"><BookOpen size={12}/> Descrição</button>{joined && <button onClick={() => setSelectedGroupId(group.id)} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2 text-[9px] font-black uppercase tracking-wider text-white transition hover:bg-red-600 dark:bg-white dark:text-zinc-900 dark:hover:text-white"><DoorOpen size={13}/> Abrir grupo</button>}</div>
              </Surface>
            );
          })}
          {((view === 'my' ? myGroups : publicGroups).length === 0) && <Surface className="col-span-full p-10 text-center"><Users className="mx-auto mb-3 text-zinc-300" size={36}/><p className="text-sm font-black text-zinc-700 dark:text-zinc-200">{view === 'my' ? 'Você ainda não participa de grupos' : 'Nenhum grupo disponível'}</p><p className="mt-1 text-xs text-zinc-400">Crie um grupo, use um código ou solicite entrada em um grupo privado.</p></Surface>}
        </div>
      )}

      {(createOpen || joinOpen) && (
        <ModalPortal onClose={() => { setCreateOpen(false); setJoinOpen(false); setEditalPickerOpen(false); }} className="max-w-md">
          <Surface className="modal-zoom max-h-[92vh] w-full max-w-md overflow-y-auto p-5">
            <div className="mb-5 flex items-center justify-between">
              <div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-600">{createOpen ? 'Novo grupo' : 'Convite'}</p><h2 className="text-xl font-black text-zinc-950 dark:text-white">{createOpen ? 'Criar grupo de estudo' : 'Entrar por código'}</h2></div>
              <button onClick={() => { setCreateOpen(false); setJoinOpen(false); }} className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X size={18}/></button>
            </div>
            {createOpen ? (
              <form onSubmit={createGroup} className="space-y-4">
                <div className="flex items-center gap-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-white shadow-lg shadow-red-600/15">
                    {groupPhotoPreview ? <img src={groupPhotoPreview} alt="Prévia da foto do grupo" className="h-full w-full object-cover"/> : <Users size={25}/>} 
                  </div>
                  <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-300">Foto do grupo</p><p className="mt-0.5 text-[9px] text-zinc-400">JPG, PNG ou WebP · até 5 MB</p><div className="mt-2 flex gap-2"><label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[9px] font-black uppercase text-red-600 shadow-sm dark:bg-zinc-800"><Camera size={12}/>{groupPhoto ? 'Trocar' : 'Carregar'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectGroupPhoto} className="sr-only"/></label>{groupPhoto && <button type="button" onClick={clearGroupPhoto} className="rounded-lg px-2 py-1 text-[9px] font-black uppercase text-zinc-400">Remover</button>}</div></div>
                </div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500">Nome<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={60} required className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm font-bold text-zinc-900 outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"/></label>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500">Descrição<textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={180} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-900 outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"/></label>
                <div className="relative min-w-0">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-zinc-500">Edital e cargo</span>
                  <button type="button" onClick={() => setEditalPickerOpen((open) => !open)} className="mt-1.5 flex w-full min-w-0 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left outline-none transition hover:border-red-400 dark:border-zinc-700 dark:bg-zinc-900">
                    {selectedEdital ? <>{editalLogo(selectedEdital) ? <img src={editalLogo(selectedEdital)} alt="" className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain"/> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950/30"><BookOpen size={15}/></span>}<span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-zinc-800 dark:text-white">{editalTitle(selectedEdital)}</span>{form.cargo && <span className="mt-0.5 block truncate text-[9px] font-bold text-red-600"><Briefcase size={9} className="mr-1 inline"/>{form.cargo}</span>}</span></> : <><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-500 dark:bg-zinc-800"><BookOpen size={15}/></span><span className="text-xs font-bold text-zinc-500">Selecionar edital/cargo</span></>}
                  </button>
                  {editalPickerOpen && <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
                    <button type="button" onClick={() => { setForm((current) => ({ ...current, editalId: '', cargo: '' })); setEditalPickerOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[10px] font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800"><X size={12}/></span>Sem edital específico</button>
                    {editalCargoOptions.map(({ edital, cargo }) => <button type="button" key={`${edital.id}::${cargo || 'sem-cargo'}`} onClick={() => { setForm((current) => ({ ...current, editalId: String(edital.id), cargo })); setEditalPickerOpen(false); }} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-red-50 dark:hover:bg-red-950/20 ${String(form.editalId) === String(edital.id) && form.cargo === cargo ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>{editalLogo(edital) ? <img src={editalLogo(edital)} alt="" className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain"/> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400 dark:bg-zinc-800"><BookOpen size={12}/></span>}<span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-black text-zinc-700 dark:text-zinc-200">{editalTitle(edital)}</span>{cargo && <span className="mt-0.5 block truncate text-[8px] font-bold uppercase tracking-wide text-red-600">{cargo}</span>}</span></button>)}
                  </div>}
                </div>
                <div className="grid grid-cols-2 gap-2">{[['public', Eye, 'Público'], ['private', Lock, 'Privado']].map(([id, Icon, label]) => <button type="button" key={id} onClick={() => setForm((current) => ({ ...current, visibility: id }))} className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-black ${form.visibility === id ? 'border-red-500 bg-red-50 text-red-600 dark:bg-red-950/20' : 'border-zinc-200 text-zinc-400 dark:border-zinc-700'}`}>{React.createElement(Icon, { size: 15 })}{label}</button>)}</div>
                <button disabled={busy} className="w-full rounded-xl bg-red-600 py-3 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50">{busy ? (groupPhoto ? 'Enviando foto...' : 'Criando...') : 'Criar grupo'}</button>
              </form>
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); joinGroup({ code: inviteCode }); }} className="space-y-4"><div className="rounded-2xl bg-zinc-50 p-4 text-center dark:bg-zinc-900"><KeyRound className="mx-auto mb-2 text-red-600" size={24}/><p className="text-xs text-zinc-500">O código libera a entrada imediata, inclusive em grupos privados.</p></div><input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} maxLength={7} placeholder="XXXXXXX" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-4 text-center font-mono text-xl font-black uppercase tracking-[0.28em] text-zinc-900 outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"/><button disabled={busy || inviteCode.length < 6} className="w-full rounded-xl bg-red-600 py-3 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50">{busy ? 'Validando...' : 'Entrar no grupo'}</button></form>
            )}
          </Surface>
        </ModalPortal>
      )}
      <DescriptionModal group={descriptionGroup} onClose={() => setDescriptionGroup(null)}/>
      <UserProfileModal member={selectedProfile} onClose={() => setSelectedProfile(null)}/>
    </div>
  );
};

export default GroupsPage;
