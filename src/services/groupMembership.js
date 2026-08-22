import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebaseConfig';

const functions = getFunctions(app, 'us-central1');
const call = (name, payload) => httpsCallable(functions, name)(payload).then((result) => result.data);

export const requestPrivateGroupEntry = (groupId) => call('solicitarEntradaGrupo', { groupId });
export const respondToGroupEntryRequest = ({ groupId, requestUid, approve }) => call('responderSolicitacaoGrupo', { groupId, requestUid, approve });
export const leaveStudyGroup = ({ groupId, successorUid = null }) => call('sairGrupoEstudo', { groupId, successorUid });
