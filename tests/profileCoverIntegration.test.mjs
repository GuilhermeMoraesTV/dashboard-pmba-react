import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profileSource = readFileSync(new URL('../src/pages/ProfilePage.jsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');
const sidebarSource = readFileSync(new URL('../src/components/dashboard/NavSideBar.jsx', import.meta.url), 'utf8');

test('Configuracoes integra capa, avatar sobreposto e controles sem card branco separado', () => {
  const bannerIndex = profileSource.indexOf('data-testid="profile-cover-banner"');
  const avatarIndex = profileSource.indexOf('group/avatar', bannerIndex);
  const statsIndex = profileSource.indexOf('<StatCard', avatarIndex);
  const profileHeader = profileSource.slice(bannerIndex, statsIndex);

  assert.ok(bannerIndex >= 0, 'banner da capa deve existir');
  assert.ok(avatarIndex > bannerIndex, 'avatar deve compor o mesmo cabecalho depois da capa');
  assert.match(profileHeader, /-mt-12[\s\S]*group\/avatar/);
  assert.match(profileHeader, /data-cover-control[\s\S]*<Camera size=\{18\}/);
  assert.match(profileHeader, /md:items-start/);
  assert.match(profileHeader, /md:pt-20[\s\S]*user\.displayName/);
  assert.match(profileHeader, /aria-label="Remover capa"[\s\S]*<Trash2 size=\{18\}/);
  assert.doesNotMatch(profileHeader, />Editar capa</);
  assert.doesNotMatch(profileHeader, />Remover capa</);
  assert.doesNotMatch(profileHeader, /border-zinc-200 bg-white shadow-sm/);
  assert.doesNotMatch(profileHeader, /Ficha do Usuario/);
});

test('capa usa Pointer Events compartilhados por mouse e toque e mantem object-cover', () => {
  assert.match(profileSource, /touch-none select-none/);
  assert.match(profileSource, /onPointerDown=\{handleCoverPointerDown\}/);
  assert.match(profileSource, /onPointerMove=\{handleCoverPointerMove\}/);
  assert.match(profileSource, /onPointerUp=\{stopCoverDrag\}/);
  assert.match(profileSource, /onPointerCancel=\{stopCoverDrag\}/);
  assert.match(profileSource, /h-full w-full object-cover/);
  assert.match(profileSource, /objectPosition: coverPositionToStyle\(coverPositionDraft\)/);
});

test('URL e posicao persistidas retornam ao perfil e a Central do Aluno', () => {
  assert.match(profileSource, /const nextCoverPosition = normalizeCoverPosition\(coverPositionDraft\)/);
  assert.match(profileSource, /coverPosition: nextCoverPosition/);
  assert.match(dashboardSource, /position: normalizeCoverPosition\(profileData\?\.coverPosition\)/);
  assert.match(dashboardSource, /coverPosition=\{profileCover\.position\}/);
  assert.match(sidebarSource, /style=\{\{ objectPosition: coverPositionToStyle\(coverPosition\) \}\}/);

  const coverImageIndex = sidebarSource.indexOf('src={coverURL}');
  const centralAvatarIndex = sidebarSource.indexOf('<ProfileLevelRing', coverImageIndex);
  assert.ok(coverImageIndex >= 0, 'capa deve aparecer na Central do Aluno');
  assert.ok(centralAvatarIndex > coverImageIndex, 'avatar deve ficar acima da capa na Central do Aluno');
});
