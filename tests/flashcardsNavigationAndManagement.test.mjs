import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import DOMPurifyLib from 'dompurify';

const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = jsdom.window;
globalThis.document = jsdom.window.document;
globalThis.Node = jsdom.window.Node;
globalThis.DOMPurify = DOMPurifyLib(jsdom.window);

import {
  getDescendantFolderIds,
  getBreadcrumbs,
  folderColorHex,
} from '../src/utils/folderHierarchy.js';
import { sanitizeFlashcardHtml } from '../src/utils/sanitizeHtml.js';

test('Hierarchy: getDescendantFolderIds returns all recursive descendant IDs correctly across multiple levels', () => {
  const folders = [
    { id: 'f-root-1', parentFolderId: null, name: 'Direito' },
    { id: 'f-child-1', parentFolderId: 'f-root-1', name: 'Penal' },
    { id: 'f-grandchild-1', parentFolderId: 'f-child-1', name: 'Teoria do Crime' },
    { id: 'f-greatgrandchild-1', parentFolderId: 'f-grandchild-1', name: 'Tipicidade' },
    { id: 'f-child-2', parentFolderId: 'f-root-1', name: 'Processo Penal' },
    { id: 'f-root-2', parentFolderId: null, name: 'Matemática' },
    { id: 'f-child-math', parentFolderId: 'f-root-2', name: 'Raciocínio Lógico' },
  ];

  const rootDescendants = getDescendantFolderIds('f-root-1', folders);
  assert.equal(rootDescendants.length, 5);
  assert.ok(rootDescendants.includes('f-root-1'));
  assert.ok(rootDescendants.includes('f-child-1'));
  assert.ok(rootDescendants.includes('f-grandchild-1'));
  assert.ok(rootDescendants.includes('f-greatgrandchild-1'));
  assert.ok(rootDescendants.includes('f-child-2'));
  assert.ok(!rootDescendants.includes('f-root-2'));
  assert.ok(!rootDescendants.includes('f-child-math'));

  const midDescendants = getDescendantFolderIds('f-child-1', folders);
  assert.equal(midDescendants.length, 3);
  assert.ok(midDescendants.includes('f-child-1'));
  assert.ok(midDescendants.includes('f-grandchild-1'));
  assert.ok(midDescendants.includes('f-greatgrandchild-1'));

  const leafDescendants = getDescendantFolderIds('f-greatgrandchild-1', folders);
  assert.deepEqual(leafDescendants, ['f-greatgrandchild-1']);
});

test('Breadcrumbs: getBreadcrumbs builds chronological path from root to target', () => {
  const folders = [
    { id: 'f-1', parentFolderId: null, name: 'Concurso PMBA' },
    { id: 'f-2', parentFolderId: 'f-1', name: 'Direito Constitucional' },
    { id: 'f-3', parentFolderId: 'f-2', name: 'Artigo 5º' },
    { id: 'f-4', parentFolderId: 'f-3', name: 'Remédios Constitucionais' },
  ];

  const crumbs = getBreadcrumbs('f-4', folders);
  assert.equal(crumbs.length, 4);
  assert.equal(crumbs[0].name, 'Concurso PMBA');
  assert.equal(crumbs[1].name, 'Direito Constitucional');
  assert.equal(crumbs[2].name, 'Artigo 5º');
  assert.equal(crumbs[3].name, 'Remédios Constitucionais');

  const rootCrumb = getBreadcrumbs('f-1', folders);
  assert.equal(rootCrumb.length, 1);
  assert.equal(rootCrumb[0].name, 'Concurso PMBA');
});

test('Folder Colors: folderColorHex correctly resolves palette IDs, hex codes, and defaults', () => {
  assert.equal(folderColorHex('#3b82f6'), '#3b82f6');
  assert.equal(folderColorHex('red'), '#dc2626');
  assert.equal(folderColorHex(null), '#dc2626');
  assert.equal(folderColorHex(undefined), '#dc2626');
});

test('Tree Metrics Aggregation: calculates cumulative totals and preserves zero counts', () => {
  const folders = [
    { id: 'f-root', parentFolderId: null, name: 'Root' },
    { id: 'f-sub1', parentFolderId: 'f-root', name: 'Sub 1' },
    { id: 'f-sub2', parentFolderId: 'f-root', name: 'Sub 2' },
    { id: 'f-deep', parentFolderId: 'f-sub1', name: 'Deep Sub' },
  ];

  const directCardsMap = {
    'f-root': 10,
    'f-sub1': 5,
    'f-sub2': 0,
    'f-deep': 20,
  };
  const directDueMap = {
    'f-root': 2,
    'f-sub1': 1,
    'f-sub2': 0,
    'f-deep': 7,
  };
  const directStudiedMap = {
    'f-root': 8,
    'f-sub1': 4,
    'f-sub2': 0,
    'f-deep': 13,
  };

  const folderMap = new Map();
  for (const folder of folders) {
    folderMap.set(folder.id, { folder, children: [] });
  }

  const rootNodes = [];
  for (const folder of folders) {
    const node = folderMap.get(folder.id);
    if (folder.parentFolderId && folderMap.has(folder.parentFolderId)) {
      folderMap.get(folder.parentFolderId).children.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  const totalAccum = {};
  const dueAccum = {};
  const studiedAccum = {};
  const calcTotals = (node) => {
    let sum = directCardsMap[node.folder.id] || 0;
    let due = directDueMap[node.folder.id] || 0;
    let studied = directStudiedMap[node.folder.id] || 0;
    for (const child of node.children) {
      const childTotals = calcTotals(child);
      sum += childTotals.total;
      due += childTotals.due;
      studied += childTotals.studied;
    }
    totalAccum[node.folder.id] = sum;
    dueAccum[node.folder.id] = due;
    studiedAccum[node.folder.id] = studied;
    return { total: sum, due, studied };
  };
  rootNodes.forEach(calcTotals);

  // 'f-deep' has direct 20, due 7, studied 13
  assert.equal(totalAccum['f-deep'], 20);
  assert.equal(dueAccum['f-deep'], 7);
  assert.equal(studiedAccum['f-deep'], 13);

  // 'f-sub1' has 5 + 20 = 25 total, 1 + 7 = 8 due, 4 + 13 = 17 studied
  assert.equal(totalAccum['f-sub1'], 25);
  assert.equal(dueAccum['f-sub1'], 8);
  assert.equal(studiedAccum['f-sub1'], 17);

  // 'f-sub2' has 0 total, 0 due, 0 studied
  assert.equal(totalAccum['f-sub2'], 0);
  assert.equal(dueAccum['f-sub2'], 0);
  assert.equal(studiedAccum['f-sub2'], 0);

  // 'f-root' has 10 + 25 + 0 = 35 total, 2 + 8 + 0 = 10 due, 8 + 17 + 0 = 25 studied
  assert.equal(totalAccum['f-root'], 35);
  assert.equal(dueAccum['f-root'], 10);
  assert.equal(studiedAccum['f-root'], 25);
});

test('No-Op Edit Check: Identifies identical content without mutating schedule', () => {
  const initialData = {
    front: '<p>Pergunta</p>',
    back: '<p>Resposta</p>',
    tags: ['direito', 'penal'],
  };

  const isNoOp = (candidate, current) => {
    const cleanCandidateFront = String(candidate.front || '').trim();
    const cleanCurrentFront = String(current.front || '').trim();
    const cleanCandidateBack = String(candidate.back || '').trim();
    const cleanCurrentBack = String(current.back || '').trim();
    const candidateTags = [...(candidate.tags || [])].sort().join(',');
    const currentTags = [...(current.tags || [])].sort().join(',');

    return (
      cleanCandidateFront === cleanCurrentFront &&
      cleanCandidateBack === cleanCurrentBack &&
      candidateTags === currentTags
    );
  };

  assert.equal(isNoOp({ front: '  <p>Pergunta</p> ', back: '<p>Resposta</p>', tags: ['penal', 'direito'] }, initialData), true);
  assert.equal(isNoOp({ front: '<p>Pergunta Modificada</p>', back: '<p>Resposta</p>', tags: ['direito', 'penal'] }, initialData), false);
  assert.equal(isNoOp({ front: '<p>Pergunta</p>', back: '<p>Resposta Modificada</p>', tags: ['direito', 'penal'] }, initialData), false);
  assert.equal(isNoOp({ front: '<p>Pergunta</p>', back: '<p>Resposta</p>', tags: ['direito'] }, initialData), false);
});

test('Flashcard HTML Sanitization: Cleans unsafe script tags while preserving formatting', () => {
  const dirty = '<p>Pergunta importante</p><script>alert("hack")</script><img src="x" onerror="alert(1)">';
  const clean = sanitizeFlashcardHtml(dirty);

  assert.ok(!clean.includes('<script'));
  assert.ok(!clean.includes('onerror'));
  assert.ok(clean.includes('Pergunta importante'));
});
