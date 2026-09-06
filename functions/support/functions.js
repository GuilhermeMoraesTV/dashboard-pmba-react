const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { createSupportService } = require('./service');

const options = { region: 'us-central1', minInstances: 0, maxInstances: 2, concurrency: 8, timeoutSeconds: 120, memory: '512MiB' };

const getAdminApp = () => {
  if (!admin.apps.length) {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'dashboard-pmba';
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET
      || (projectId.startsWith('demo-') ? `${projectId}.appspot.com` : `${projectId}.firebasestorage.app`);
    admin.initializeApp({ projectId, storageBucket });
  }
  return admin;
};

const service = () => {
  const app = getAdminApp();
  return createSupportService({ db: app.firestore(), bucket: app.storage().bucket() });
};

const callable = (method, extra = {}) => onCall({ ...options, ...extra }, async (request) => {
  try {
    return await service()[method](request.auth, request.data || {});
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.warn(`[Support:${method}]`, error.code || error.message || error);
    throw new HttpsError(
      error.code === 'invalid-argument' ? 'invalid-argument' : 'unavailable',
      error.message || 'Não foi possível concluir a operação de suporte. Tente novamente.'
    );
  }
});

exports.reserveSupportMessage = callable('reserve');
exports.uploadSupportAttachment = callable('upload', { concurrency: 1 });
exports.finalizeSupportMessage = callable('finalize');
exports.manageSupportTicket = callable('manage');
exports.readSupportAttachment = onRequest({ ...options, cors: true }, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.status(405).end(); return; }
  try {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token) { res.status(401).end(); return; }
    const app = getAdminApp();
    const decoded = await app.auth().verifyIdToken(token);
    const bytes = await service().read({ uid: decoded.uid, token: decoded }, req.query);
    res.type('image/webp').send(bytes);
  } catch (error) {
    const code = error.code;
    res.status(code === 'permission-denied' ? 403 : code === 'not-found' || Number(code) === 404 ? 404 : code?.startsWith('auth/') ? 401 : 400).end();
  }
});
