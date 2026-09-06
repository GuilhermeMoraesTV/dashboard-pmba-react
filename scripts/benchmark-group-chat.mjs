import fs from 'node:fs/promises';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';

const PROJECT_ID = 'dashboard-pmba';
const CONCURRENCY_LEVELS = String(process.env.GROUP_CHAT_BENCH_LEVELS || '10,25,50')
  .split(',')
  .map(Number)
  .filter((value) => Number.isInteger(value) && value > 0 && value <= 50);
const ROUNDS = Math.max(1, Number(process.env.GROUP_CHAT_BENCH_ROUNDS || 5));
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

function percentile(values, target) {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * target) - 1)];
}

async function seedRound(environment, groupId, userIds) {
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    const batch = writeBatch(database);
    batch.set(doc(database, 'study_groups', groupId), {
      name: `Benchmark ${groupId}`,
      ownerId: userIds[0],
      visibility: 'private',
    });
    batch.set(doc(database, 'study_groups', groupId, 'chat_meta', 'current'), {
      groupId,
      groupName: `Benchmark ${groupId}`,
      memberIds: userIds,
      lastSeq: 0,
      lastMessageId: null,
      lastMessageAt: null,
      lastAuthorId: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    userIds.forEach((uid) => {
      batch.set(doc(database, 'study_groups', groupId, 'members', uid), {
        uid,
        role: uid === userIds[0] ? 'owner' : 'member',
        permissions: { manageGroup: uid === userIds[0], manageMembers: uid === userIds[0] },
      });
      batch.set(doc(database, 'users', uid, 'group_chat_states', groupId), {
        groupId,
        lastReadSeq: 0,
        readAt: Timestamp.now(),
        lastSendAt: null,
        sentCountTotal: 0,
        sentCountAtRead: 0,
        updatedAt: Timestamp.now(),
      });
    });
    await batch.commit();
  });
}

async function sendOne(environment, groupId, uid, messageId) {
  const database = environment.authenticatedContext(uid).firestore();
  const metaRef = doc(database, 'study_groups', groupId, 'chat_meta', 'current');
  const stateRef = doc(database, 'users', uid, 'group_chat_states', groupId);
  const messageRef = doc(database, 'study_groups', groupId, 'messages', messageId);
  let attempts = 0;
  const startedAt = performance.now();
  for (let conflictRetry = 0; conflictRetry <= 30; conflictRetry += 1) {
    let transactionReachedWrites = false;
    try {
      await runTransaction(database, async (transaction) => {
        attempts += 1;
        const [metaSnapshot, stateSnapshot] = await Promise.all([
          transaction.get(metaRef),
          transaction.get(stateRef),
        ]);
        const nextSeq = Number(metaSnapshot.data().lastSeq || 0) + 1;
        transactionReachedWrites = true;
        transaction.set(messageRef, {
          seq: nextSeq,
          authorId: uid,
          authorName: uid,
          authorPhotoURL: null,
          text: `Mensagem ${messageId}`,
          replyToMessageId: null,
          mentionUids: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          editedAt: null,
          deleted: false,
          deletedAt: null,
          deletedBy: null,
          expiresAt: Timestamp.fromMillis(Date.now() + RETENTION_MS),
        });
        transaction.update(metaRef, {
          lastSeq: nextSeq,
          lastMessageId: messageId,
          lastMessageAt: serverTimestamp(),
          lastAuthorId: uid,
          updatedAt: serverTimestamp(),
        });
        transaction.update(stateRef, {
          lastSendAt: serverTimestamp(),
          sentCountTotal: Number(stateSnapshot.data().sentCountTotal || 0) + 1,
          updatedAt: serverTimestamp(),
        });
      }, { maxAttempts: 10 });
      return { ok: true, attempts, latencyMs: Math.round(performance.now() - startedAt) };
    } catch (error) {
      const retryable = transactionReachedWrites
        && ['aborted', 'permission-denied', 'unavailable'].includes(error?.code)
        && conflictRetry < 30;
      if (!retryable) {
        return { ok: false, attempts, latencyMs: Math.round(performance.now() - startedAt), code: error?.code || error?.name || 'unknown' };
      }
      const jitter = Math.floor(Math.random() * 75);
      await new Promise((resolve) => setTimeout(resolve, Math.min(750, 25 * (conflictRetry + 1) + jitter)));
    }
  }
  return { ok: false, attempts, latencyMs: Math.round(performance.now() - startedAt), code: 'retry-exhausted' };
}

async function verifyRound(environment, groupId, expectedSuccesses) {
  let verification;
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    const [messagesSnapshot, metaSnapshot] = await Promise.all([
      getDocs(collection(database, 'study_groups', groupId, 'messages')),
      runTransaction(database, (transaction) => transaction.get(doc(database, 'study_groups', groupId, 'chat_meta', 'current'))),
    ]);
    const sequences = messagesSnapshot.docs.map((item) => Number(item.data().seq)).sort((a, b) => a - b);
    const contiguous = sequences.every((seq, index) => seq === index + 1);
    const unique = new Set(sequences).size === sequences.length;
    const lastSeq = Number(metaSnapshot.data().lastSeq || 0);
    verification = {
      messages: messagesSnapshot.size,
      lastSeq,
      contiguous,
      unique,
      consistent: messagesSnapshot.size === expectedSuccesses && lastSeq === expectedSuccesses && contiguous && unique,
    };
  });
  return verification;
}

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Execute pelo script npm run benchmark:group-chat.');
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  const environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port: Number(port),
      rules: await fs.readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
  const report = [];
  try {
    await environment.clearFirestore();
    for (const concurrency of CONCURRENCY_LEVELS) {
      for (let round = 1; round <= ROUNDS; round += 1) {
        const groupId = `chat-bench-${concurrency}-${round}`;
        const userIds = Array.from({ length: concurrency }, (_, index) => `bench-${concurrency}-${round}-${index}`);
        await seedRound(environment, groupId, userIds);
        const results = await Promise.all(userIds.map((uid, index) => sendOne(environment, groupId, uid, `m-${index}`)));
        const successes = results.filter((item) => item.ok);
        const failures = results.filter((item) => !item.ok);
        const verification = await verifyRound(environment, groupId, successes.length);
        const attemptCounts = results.map((item) => item.attempts);
        const latencies = results.map((item) => item.latencyMs);
        const roundResult = {
          concurrency,
          round,
          successful: successes.length,
          permanentFailures: failures.length,
          failureCodes: failures.map((item) => item.code),
          totalAttempts: attemptCounts.reduce((total, value) => total + value, 0),
          retries: attemptCounts.reduce((total, value) => total + Math.max(0, value - 1), 0),
          attemptsAverage: Number((attemptCounts.reduce((total, value) => total + value, 0) / results.length).toFixed(2)),
          maxAttempts: Math.max(...attemptCounts),
          p95Attempts: percentile(attemptCounts, 0.95),
          p95LatencyMs: percentile(latencies, 0.95),
          maxLatencyMs: Math.max(...latencies),
          verification,
          attemptCounts,
          latencies,
        };
        report.push(roundResult);
        process.stdout.write(`${JSON.stringify({ ...roundResult, attemptCounts: undefined, latencies: undefined })}\n`);
      }
    }
  } finally {
    await environment.cleanup();
  }
  const inconsistent = report.filter((item) => !item.verification.consistent);
  const underTwentyFiveFailures = report.filter((item) => item.concurrency <= 25 && item.permanentFailures > 0);
  const summary = {
    rounds: report.length,
    inconsistentRounds: inconsistent.length,
    permanentFailuresUpTo25: underTwentyFiveFailures.length,
    results: CONCURRENCY_LEVELS.map((concurrency) => {
      const items = report.filter((item) => item.concurrency === concurrency);
      const attemptCounts = items.flatMap((item) => item.attemptCounts);
      const latencies = items.flatMap((item) => item.latencies);
      return {
        concurrency,
        permanentFailures: items.reduce((total, item) => total + item.permanentFailures, 0),
        retries: attemptCounts.reduce((total, value) => total + Math.max(0, value - 1), 0),
        attemptsAverage: Number((attemptCounts.reduce((total, value) => total + value, 0) / attemptCounts.length).toFixed(2)),
        maxAttempts: Math.max(...attemptCounts),
        p95Attempts: percentile(attemptCounts, 0.95),
        p95LatencyMs: percentile(latencies, 0.95),
        maxLatencyMs: Math.max(...items.map((item) => item.maxLatencyMs)),
      };
    }),
  };
  process.stdout.write(`SUMMARY ${JSON.stringify(summary)}\n`);
  if (inconsistent.length || underTwentyFiveFailures.length) process.exitCode = 1;
}

await main();
