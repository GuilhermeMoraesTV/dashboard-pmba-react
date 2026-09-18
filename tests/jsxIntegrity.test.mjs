import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const espree = require('espree');
const eslintScope = require('eslint-scope');

function checkFileForUndefinedJsx(filePath) {
  const content = readFileSync(filePath, 'utf8');
  let ast;
  try {
    ast = espree.parse(content, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: { jsx: true },
      loc: true,
      range: true,
    });
  } catch (err) {
    return [{ file: filePath, error: `Parse error: ${err.message}` }];
  }

  const scopeManager = eslintScope.analyze(ast, {
    ecmaVersion: 2022,
    sourceType: 'module',
    jsx: true,
  });

  const issues = [];
  const moduleScope = scopeManager.scopes.find((s) => s.type === 'module') || scopeManager.globalScope;

  function findRootJSXIdentifier(node) {
    if (!node) return null;
    if (node.type === 'JSXIdentifier') {
      if (/^[a-z]/.test(node.name)) return null;
      return node;
    }
    if (node.type === 'JSXMemberExpression') {
      return findRootJSXIdentifier(node.object);
    }
    return null;
  }

  function walk(node, currentScope) {
    let scope = currentScope;
    if (node.type !== 'Program') {
      const acquired = scopeManager.acquire(node);
      if (acquired) scope = acquired;
    }

    if (node.type === 'JSXOpeningElement') {
      const rootId = findRootJSXIdentifier(node.name);
      if (rootId) {
        const name = rootId.name;
        let s = scope;
        let found = false;
        while (s) {
          if (s.set.has(name) || s.variables.some((v) => v.name === name)) {
            found = true;
            break;
          }
          s = s.upper;
        }

        const browserGlobals = new Set(['React', 'document', 'window', 'console', 'Image', 'Audio', 'Blob', 'File']);
        if (!found && !browserGlobals.has(name)) {
          issues.push({
            file: filePath,
            name,
            line: rootId.loc.start.line,
            column: rootId.loc.start.column,
          });
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;
      const val = node[key];
      if (Array.isArray(val)) {
        for (const child of val) {
          if (child && typeof child.type === 'string') walk(child, scope);
        }
      } else if (val && typeof val.type === 'string') {
        walk(val, scope);
      }
    }
  }

  walk(ast, moduleScope);
  return issues;
}

function scanDir(dir, results = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'tmp', 'Backup', 'Backup ModoQAP', '.vite', '.firebase'].includes(entry.name)) {
        scanDir(fullPath, results);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.jsx') || entry.name.endsWith('.js'))) {
      results.push(fullPath);
    }
  }
  return results;
}

test('HomeSessao1 define e importa Maximize2 e X', () => {
  const issues = checkFileForUndefinedJsx('src/pages/HomePage/HomeSessao1.jsx');
  assert.deepEqual(issues, [], `Componentes JSX indefinidos em HomeSessao1.jsx: ${JSON.stringify(issues)}`);
});

test('nenhum componente JSX indefinido existe em src/', () => {
  const allFiles = scanDir('src');
  const allIssues = [];
  for (const file of allFiles) {
    const issues = checkFileForUndefinedJsx(file);
    if (issues.length > 0) {
      allIssues.push(...issues);
    }
  }
  assert.deepEqual(allIssues, [], `Componentes JSX indefinidos encontrados: ${JSON.stringify(allIssues, null, 2)}`);
});
