import { getColorByHex, getColorById } from './disciplineColors.js';

/**
 * Retorna todos os IDs descendentes (inclusive o próprio folderId).
 */
export function getDescendantFolderIds(folderId, allFolders) {
  const result = new Set([folderId]);
  let added = true;
  while (added) {
    added = false;
    for (const folder of allFolders) {
      if (!result.has(folder.id) && folder.parentFolderId && result.has(folder.parentFolderId)) {
        result.add(folder.id);
        added = true;
      }
    }
  }
  return Array.from(result);
}

/**
 * Constrói o caminho de navegação (breadcrumbs) do nó raiz até a pasta especificada.
 */
export function getBreadcrumbs(folderId, allFolders) {
  const crumbs = [];
  let current = allFolders.find((f) => f.id === folderId);
  const visited = new Set();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    crumbs.unshift(current);
    if (!current.parentFolderId) break;
    current = allFolders.find((f) => f.id === current.parentFolderId);
  }
  return crumbs;
}

/**
 * Converte chave de cor para código hexadecimal válido.
 */
export function folderColorHex(color) {
  return getColorById(color)?.hex || getColorByHex(color)?.hex || (String(color || '').startsWith('#') ? color : '#dc2626');
}
