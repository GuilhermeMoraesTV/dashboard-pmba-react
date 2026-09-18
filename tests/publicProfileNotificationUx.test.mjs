import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const publicProfileSource = readFileSync(new URL('../src/components/gamification/UserProfileModal.jsx', import.meta.url), 'utf8');
const sidebarSource = readFileSync(new URL('../src/components/dashboard/NavSideBar.jsx', import.meta.url), 'utf8');
const registerModalSource = readFileSync(new URL('../src/components/ciclos/RegistroEstudoModal.jsx', import.meta.url), 'utf8');
const timerModalSource = readFileSync(new URL('../src/components/ciclos/TimerFinishModal.jsx', import.meta.url), 'utf8');

test('perfil publico reaproveita a projecao geral para capa, posicao e idade da conta', () => {
  assert.match(publicProfileSource, /setExtraPublicIdentity\(\{/);
  assert.match(publicProfileSource, /coverURL: data\.coverURL/);
  assert.match(publicProfileSource, /platformSinceMillis: data\.platformSinceMillis/);
  assert.match(publicProfileSource, /extraPublicIdentity\?\.coverURL/);
  assert.match(publicProfileSource, /extraPublicIdentity\?\.coverPosition/);
  assert.match(publicProfileSource, /extraPublicIdentity\?\.platformSinceMillis/);
});

test('central de notificacoes preserva o estado do sino entre renders da barra', () => {
  assert.match(sidebarSource, /\{TopBar\(\)\}/);
  assert.doesNotMatch(sidebarSource, /<TopBar\s*\/>/);
});

test('registro manual oferece marcar assunto como concluido tambem em revisoes', () => {
  const manualDecision = registerModalSource.slice(
    registerModalSource.indexOf('REVISÃO E CONCLUSÃO'),
    registerModalSource.indexOf('SEÇÃO: TEMPO + QUESTÕES'),
  );
  assert.match(manualDecision, /setMarkAsFinished/);
  assert.match(manualDecision, /Marcar como concluído/);
  assert.match(manualDecision, /formData\.tipoRegistro === 'revisao'/);
  assert.doesNotMatch(manualDecision, /\{formData\.tipoRegistro !== 'revisao' && \(\s*<div/);
  assert.match(registerModalSource, /assuntoFinalizado: true/);
  assert.match(registerModalSource, /if \(item\.markAsFinished && \(itemContext === 'ciclo' \|\| itemContext === 'cronograma'\)\)/);
});

test('timer oferece marcar assunto como concluido tambem em revisoes', () => {
  assert.match(timerModalSource, /\(selectedContext === 'ciclo' \|\| selectedContext === 'cronograma'\) && topic\.assunto/);
  assert.match(timerModalSource, /tipoRegistro === 'revisao'[\s\S]*Marcar como concluído/);
  assert.match(timerModalSource, /if \(t\.markAsFinished && \(selectedContext === 'ciclo' \|\| selectedContext === 'cronograma'\)\)/);
});

test('timer organiza as duas decisoes do cronograma lado a lado', () => {
  assert.match(timerModalSource, /selectedContext === 'cronograma'[\s\S]*'sm:grid-cols-2'/);
  assert.match(timerModalSource, /className="sm:col-span-2"/);
  assert.match(timerModalSource, /Concluí o assunto/);
  assert.match(timerModalSource, /Continuar na próxima sessão/);
});
