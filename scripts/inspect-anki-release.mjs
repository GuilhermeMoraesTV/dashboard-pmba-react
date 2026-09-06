// Read-only deployment inspection. Never prints credentials or user data.
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const cli = process.env.FIREBASE_CLI_LIB;
if (!cli) throw new Error('FIREBASE_CLI_LIB is required');
const auth = require(path.join(cli, 'auth.js'));
const { requireAuth } = require(path.join(cli, 'requireAuth.js'));
const rules = require(path.join(cli, 'gcp/rules.js'));
const functions = require(path.join(cli, 'gcp/cloudfunctionsv2.js'));
const { Client } = require(path.join(cli, 'apiv2.js'));
const project = 'dashboard-pmba';
const options = { project, nonInteractive: true };
const account = auth.getProjectDefaultAccount(process.cwd());
if (!account) throw new Error('Firebase CLI account missing');
auth.setActiveAccount(options, account);
await requireAuth(options);
const releases = await rules.listAllReleases(project);
const release = releases.find((r) => r.name === `projects/${project}/releases/cloud.firestore`);
if (!release) throw new Error('Default Firestore release missing');
const files = await rules.getRulesetContent(release.rulesetName);
const targets = ['importAnkiPackage', 'createStudyFolder', 'createStudyFolderTree', 'deleteStudyFolder'];
const run = new Client({ urlPrefix: 'https://us-central1-run.googleapis.com', apiVersion: '' });
const deployed = await Promise.all(targets.map(async (name) => {
  const f = await functions.getFunction(project, 'us-central1', name);
  const service = await run.get(`/apis/serving.knative.dev/v1/namespaces/${project}/services/${name.toLowerCase()}`);
  const status = service.body?.status;
  return { name, state: f.state, updateTime: f.updateTime, runtime: f.buildConfig?.runtime,
    revision: f.serviceConfig?.revision, uri: f.serviceConfig?.uri,
    timeout: f.serviceConfig?.timeoutSeconds, memory: f.serviceConfig?.availableMemory,
    maxInstances: f.serviceConfig?.maxInstanceCount, concurrency: f.serviceConfig?.maxInstanceRequestConcurrency,
    latestCreated: status?.latestCreatedRevisionName, latestReady: status?.latestReadyRevisionName,
    traffic: status?.traffic, conditions: status?.conditions };
}));
const firestore = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
let limits;
try {
  const response = await firestore.get(`/projects/${project}/databases/(default)/documents/system_config/product_limits`);
  limits = response.body?.fields?.anki || null;
} catch (error) { if (error.status !== 404) throw error; limits = null; }
console.log(JSON.stringify({ project, release, files, deployed, ankiOverrides: limits }));
