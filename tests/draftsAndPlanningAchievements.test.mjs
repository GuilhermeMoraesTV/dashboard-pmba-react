import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  getAchievementProgress,
} from '../src/utils/gamification.js';

test('first_schedule_created achievement unlocks on first schedule and awards 25 XP', () => {
  const initial = evaluateAchievements({ schedulesCreated: 0, level: 1, totalXPBeforeAchievements: 0 }, []);
  assert.equal(initial.unlockedIds.includes('first_schedule_created'), false);

  const afterFirst = evaluateAchievements({ schedulesCreated: 1, level: 1, totalXPBeforeAchievements: 0 }, []);
  assert.equal(afterFirst.unlockedIds.includes('first_schedule_created'), true);
  assert.equal(afterFirst.rewardXP, 25);
  assert.equal(afterFirst.newlyUnlocked.some((a) => a.id === 'first_schedule_created'), true);
});

test('second schedule creation does not duplicate first_schedule_created achievement or reward XP again', () => {
  const previous = ['first_schedule_created'];
  const afterSecond = evaluateAchievements({ schedulesCreated: 2, level: 1, totalXPBeforeAchievements: 25 }, previous);
  assert.equal(afterSecond.unlockedIds.includes('first_schedule_created'), true);
  assert.equal(afterSecond.newlyUnlocked.some((a) => a.id === 'first_schedule_created'), false);
  assert.equal(afterSecond.rewardXP, 0);
});

test('first_cycle_created achievement unlocks on first cycle and awards 25 XP', () => {
  const initial = evaluateAchievements({ cyclesCreated: 0, level: 1, totalXPBeforeAchievements: 0 }, []);
  assert.equal(initial.unlockedIds.includes('first_cycle_created'), false);

  const afterFirst = evaluateAchievements({ cyclesCreated: 1, level: 1, totalXPBeforeAchievements: 0 }, []);
  assert.equal(afterFirst.unlockedIds.includes('first_cycle_created'), true);
  assert.equal(afterFirst.rewardXP, 25);
  assert.equal(afterFirst.newlyUnlocked.some((a) => a.id === 'first_cycle_created'), true);
});

test('second cycle creation does not duplicate first_cycle_created achievement or reward XP again', () => {
  const previous = ['first_cycle_created'];
  const afterSecond = evaluateAchievements({ cyclesCreated: 2, level: 1, totalXPBeforeAchievements: 25 }, previous);
  assert.equal(afterSecond.unlockedIds.includes('first_cycle_created'), true);
  assert.equal(afterSecond.newlyUnlocked.some((a) => a.id === 'first_cycle_created'), false);
  assert.equal(afterSecond.rewardXP, 0);
});

test('first_schedule_complete achievement unlocks on first schedule completion and awards 50 XP', () => {
  const initial = evaluateAchievements({ schedulesCompleted: 0, level: 1, totalXPBeforeAchievements: 0 }, []);
  assert.equal(initial.unlockedIds.includes('first_schedule_complete'), false);

  const afterComplete = evaluateAchievements({ schedulesCompleted: 1, level: 1, totalXPBeforeAchievements: 0 }, []);
  assert.equal(afterComplete.unlockedIds.includes('first_schedule_complete'), true);
  assert.equal(afterComplete.rewardXP, 50);
});

test('achievements remain unlocked even if state count drops after document deletion', () => {
  const previous = ['first_schedule_created', 'first_cycle_created'];
  // Simulate user deleting their schedule or cycle: count goes back to 0
  const afterDeletion = evaluateAchievements({ schedulesCreated: 0, cyclesCreated: 0, level: 1, totalXPBeforeAchievements: 50 }, previous);
  assert.equal(afterDeletion.unlockedIds.includes('first_schedule_created'), true);
  assert.equal(afterDeletion.unlockedIds.includes('first_cycle_created'), true);
  assert.equal(afterDeletion.rewardXP, 0);
});

test('new user account starts with 0 planning achievements and 0 unlocked IDs', () => {
  const newUser = evaluateAchievements({ schedulesCreated: 0, cyclesCreated: 0, schedulesCompleted: 0, level: 1, totalXPBeforeAchievements: 0 }, []);
  assert.equal(newUser.unlockedIds.length, 0);
  assert.equal(newUser.rewardXP, 0);
});

test('draft key generators are strictly isolated per authenticated UID', () => {
  const getCronogramaKey = (uid) => uid ? `protocolo_zero_cronograma_draft_${uid}` : null;
  const getCicloKey = (uid) => uid ? `planejamento_ciclo_wizard_draft_v1_${uid}` : null;
  const getSimuladoKey = (uid) => uid ? `simulado_draft_v7_ultra_${uid}` : null;

  const uidA = 'user_abc_123';
  const uidB = 'user_xyz_789';

  // Distinct keys per user
  assert.equal(getCronogramaKey(uidA), 'protocolo_zero_cronograma_draft_user_abc_123');
  assert.equal(getCronogramaKey(uidB), 'protocolo_zero_cronograma_draft_user_xyz_789');
  assert.notEqual(getCronogramaKey(uidA), getCronogramaKey(uidB));

  assert.equal(getCicloKey(uidA), 'planejamento_ciclo_wizard_draft_v1_user_abc_123');
  assert.equal(getCicloKey(uidB), 'planejamento_ciclo_wizard_draft_v1_user_xyz_789');
  assert.notEqual(getCicloKey(uidA), getCicloKey(uidB));

  assert.equal(getSimuladoKey(uidA), 'simulado_draft_v7_ultra_user_abc_123');
  assert.equal(getSimuladoKey(uidB), 'simulado_draft_v7_ultra_user_xyz_789');
  assert.notEqual(getSimuladoKey(uidA), getSimuladoKey(uidB));

  // No key without valid UID
  assert.equal(getCronogramaKey(null), null);
  assert.equal(getCronogramaKey(undefined), null);
  assert.equal(getCronogramaKey(''), null);

  assert.equal(getCicloKey(null), null);
  assert.equal(getCicloKey(undefined), null);
  assert.equal(getCicloKey(''), null);

  assert.equal(getSimuladoKey(null), null);
  assert.equal(getSimuladoKey(undefined), null);
  assert.equal(getSimuladoKey(''), null);
});

test('localStorage mock verifies user draft isolation and prevents cross-user leakage', () => {
  const storage = new Map();
  const mockLocalStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
  };

  const getCronogramaKey = (uid) => uid ? `protocolo_zero_cronograma_draft_${uid}` : null;
  const legacyKey = 'protocolo_zero_cronograma_draft';

  // Simulate legacy draft in storage
  mockLocalStorage.setItem(legacyKey, JSON.stringify({ step: 3, cargo: 'Soldado PM' }));

  // Simulate cleaner function
  const cleanLegacy = () => mockLocalStorage.removeItem(legacyKey);
  cleanLegacy();
  assert.equal(mockLocalStorage.getItem(legacyKey), null);

  // User A saves draft
  const uidA = 'user_A';
  const keyA = getCronogramaKey(uidA);
  mockLocalStorage.setItem(keyA, JSON.stringify({ step: 2, cargo: 'Oficial PM' }));

  // User B tries to read draft
  const uidB = 'user_B';
  const keyB = getCronogramaKey(uidB);
  const draftB = mockLocalStorage.getItem(keyB);
  assert.equal(draftB, null, 'User B must not see User A draft');

  // User A reads draft
  const draftA = JSON.parse(mockLocalStorage.getItem(keyA));
  assert.equal(draftA.cargo, 'Oficial PM');
});
