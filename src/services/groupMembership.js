import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebaseConfig';

const functions = getFunctions(app, 'us-central1');
const call = (name, payload) => httpsCallable(functions, name)(payload).then((result) => result.data);

export const requestPrivateGroupEntry = (groupId) => call('solicitarEntradaGrupo', { groupId });
export const listStudyGroups = () => call('listarGruposEstudo', {});
export const joinPrivateStudyGroupByCode = (inviteCode) => call('entrarGrupoPrivadoComCodigo', { inviteCode });
export const respondToGroupEntryRequest = ({ groupId, requestUid, approve }) => call('responderSolicitacaoGrupo', { groupId, requestUid, approve });
export const leaveStudyGroup = ({ groupId, successorUid = null }) => call('sairGrupoEstudo', { groupId, successorUid });
export const updateStudyGroupMemberRole = ({ groupId, memberUid, viceLeader }) => call('atualizarPapelMembroGrupo', { groupId, memberUid, viceLeader });
export const removeStudyGroupMember = ({ groupId, memberUid }) => call('removerMembroGrupo', { groupId, memberUid });
