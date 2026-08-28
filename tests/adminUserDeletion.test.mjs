import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { assertDestructiveActionConfirmed, membershipKind, pickGroupSuccessor } = require('../functions/admin/service.js').__test;

test('exclusao administrativa exige confirmacao simples sem informar UID', () => {
  assert.equal(assertDestructiveActionConfirmed(true), true);
  assert.throws(() => assertDestructiveActionConfirmed(false), /Confirme a exclusao definitiva/);
  assert.throws(() => assertDestructiveActionConfirmed('user-uid'), /Confirme a exclusao definitiva/);
});

test('exclusao administrativa classifica todos os vinculos competitivos conhecidos', () => {
  assert.equal(membershipKind('study_groups/g1/members/u1'), 'study_group');
  assert.equal(membershipKind('study_groups/g1/weekly_rankings/2026-08-24/members/u1'), 'study_group_ranking');
  assert.equal(membershipKind('weekly_rankings/2026-08-24/cohorts/c1/members/u1'), 'league_cohort');
  assert.equal(membershipKind('weekly_rankings/2026-08-24/members/u1'), 'weekly_ranking');
  assert.equal(membershipKind('general_rankings/all/members/u1'), 'general_ranking');
});

test('vice-lider mais antigo assume grupo quando o lider e excluido', () => {
  const successor = pickGroupSuccessor([
    { uid: 'owner', role: 'owner', joinedAt: new Date('2026-01-01T10:00:00Z') },
    { uid: 'member', role: 'member', joinedAt: new Date('2026-01-02T10:00:00Z') },
    { uid: 'vice-new', role: 'vice_leader', joinedAt: new Date('2026-01-04T10:00:00Z') },
    { uid: 'vice-old', role: 'vice_leader', joinedAt: new Date('2026-01-03T10:00:00Z') },
  ], 'owner');
  assert.equal(successor.uid, 'vice-old');
});

test('membro mais antigo assume quando nao existe vice-lider', () => {
  const successor = pickGroupSuccessor([
    { uid: 'owner', role: 'owner', joinedAt: new Date('2026-01-01T10:00:00Z') },
    { uid: 'member-new', role: 'member', joinedAt: new Date('2026-01-04T10:00:00Z') },
    { uid: 'member-old', role: 'member', joinedAt: new Date('2026-01-02T10:00:00Z') },
  ], 'owner');
  assert.equal(successor.uid, 'member-old');
});
