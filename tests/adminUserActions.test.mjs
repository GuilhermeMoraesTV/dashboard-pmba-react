import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPermanentUserDeletionPayload } from '../src/utils/adminUserActions.js';

test('exclusao envia confirmacao invisivel compativel com Functions antiga e nova', () => {
  assert.deepEqual(buildPermanentUserDeletionPayload('user-123'), {
    targetUid: 'user-123',
    confirmed: true,
    confirmation: 'user-123',
  });
});
