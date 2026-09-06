import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const source = await readFile(new URL('../src/components/shared/TabErrorBoundary.jsx', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'jsx', format: 'esm' });
const resolved = code.replace(/from "(react|lucide-react)"/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
const { default: TabErrorBoundary } = await import(`data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`);

test('retry de import rejeitado recarrega o documento em vez de reutilizar o lazy rejeitado', () => {
  const previousWindow = globalThis.window;
  let reloads = 0;
  globalThis.window = { location: { reload: () => { reloads += 1; } } };
  try {
    for (const message of [
      'Failed to fetch dynamically imported module: http://localhost:5173/src/components/groups/GroupChatPanel.jsx',
      'Importing a module script failed.',
      'error loading dynamically imported module',
      'Loading chunk 42 failed.',
      'Loading CSS chunk 42 failed.',
      'Outdated Optimize Dep',
    ]) {
      const boundary = new TabErrorBoundary({});
      boundary.state = TabErrorBoundary.getDerivedStateFromError(new TypeError(message));
      boundary.setState = () => assert.fail('O import rejeitado não pode ser recuperado apenas resetando o boundary');
      boundary.handleRetry();
    }
    assert.equal(reloads, 6);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('erro comum de renderização mantém recuperação local sem recarregar a página', () => {
  const boundary = new TabErrorBoundary({});
  boundary.state = TabErrorBoundary.getDerivedStateFromError(new TypeError("Cannot read properties of null (reading 'name')"));
  boundary.setState = (state) => { boundary.state = state; };
  boundary.handleRetry();
  assert.deepEqual(boundary.state, { hasError: false, error: null });
});
