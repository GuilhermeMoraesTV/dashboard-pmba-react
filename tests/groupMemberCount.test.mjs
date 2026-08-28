import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const groups = require('../functions/groups/service.js');

test('sincroniza a contagem real no grupo e no diretorio publico', { concurrency: false }, async () => {
  const groupWrites = [];
  const directoryWrites = [];
  const groupRef = {
    get: async () => ({
      exists: true,
      data: () => ({ name: 'Grupo divergente', visibility: 'public', memberCount: 3 }),
    }),
    collection: (name) => {
      assert.equal(name, 'members');
      return { get: async () => ({ size: 1 }) };
    },
    set: async (data, options) => groupWrites.push({ data, options }),
  };
  const fakeFirestore = {
    collection: (name) => ({
      doc: (id) => {
        assert.equal(id, 'group-count-qa');
        if (name === 'study_groups') return groupRef;
        assert.equal(name, 'study_group_directory');
        return { set: async (data, options) => directoryWrites.push({ data, options }) };
      },
    }),
  };

  const result = await groups.__test.syncGroupMemberCountWithDb({
    groupId: 'group-count-qa',
    firestore: fakeFirestore,
    getTimestamp: () => 'server-timestamp',
  });
  assert.deepEqual(result, { groupId: 'group-count-qa', memberCount: 1 });
  assert.equal(groupWrites.length, 1);
  assert.equal(groupWrites[0].data.memberCount, 1);
  assert.equal(directoryWrites.length, 1);
  assert.equal(directoryWrites[0].data.memberCount, 1);
});
