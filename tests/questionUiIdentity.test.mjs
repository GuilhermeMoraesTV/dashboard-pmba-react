import test from 'node:test';
import assert from 'node:assert/strict';
import { questionUiKey, removeScopedQuestion } from '../src/pages/QuestoesPage/questionUiIdentity.js';

test('same question ID in global and private scopes never collides in UI identity', () => {
  const globalQuestion = { id: 'same-id', questionScope: 'global' };
  const privateQuestion = { id: 'same-id', questionScope: 'private' };
  assert.notEqual(questionUiKey(globalQuestion), questionUiKey(privateQuestion));
  assert.deepEqual(removeScopedQuestion([globalQuestion, privateQuestion], privateQuestion), [globalQuestion]);
});
