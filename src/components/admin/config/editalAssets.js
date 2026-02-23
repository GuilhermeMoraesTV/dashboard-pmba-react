// src/utils/editalAssets.js

// Função para limpar strings e deixar pronta para URL (ex: "GCM Viana - ES" -> "gcmviana")
export const normalizeSlug = (value = "") => {
  return value
    .toString()
    .toLowerCase()
    .normalize("NFD")                 // Separa acentos
    .replace(/[\u0300-\u036f]/g, "")  // Remove acentos
    .replace(/[^a-z0-9]/g, "");       // Remove tudo que NÃO for letra ou número (espaços, traços, etc)
};

// Cria um Mapa (Dicionário) dos editais instalados para busca rápida
export const buildEditaisMap = (catalogo = []) => {
  const map = new Map();
  if (Array.isArray(catalogo)) {
    for (const e of catalogo) {
      if (!e?.id) continue;
      map.set(e.id, e);
    }
  }
  return map;
};

/**
 * 🚀 RESOLVER LOGO UNIVERSAL
 * Essa função tenta de tudo para achar a imagem.
 */
export const resolveLogoUrl = ({ ciclo, editaisMap }) => {
  if (!ciclo) return null;

  // 1. PRIORIDADE MÁXIMA: O que está salvo no banco do usuário (Ciclos Novos vêm do Wizard com isso)
  if (ciclo.logoUrl) return ciclo.logoUrl;

  // 2. BUSCA NO CATÁLOGO (Se tiver templateId e passarmos o mapa)
  // Isso resolve se você instalou o edital no Admin, mas o ciclo é antigo
  if (ciclo.templateId && editaisMap?.has(ciclo.templateId)) {
    const tpl = editaisMap.get(ciclo.templateId);
    if (tpl.logoUrl || tpl.logo) return tpl.logoUrl || tpl.logo;
  }

  // 3. TENTATIVA DINÂMICA PELO ID (Fallback Padrão)
  // Ex: ID "gcm_viana" -> vira "logo-gcmviana.png"
  if (ciclo.templateId && ciclo.templateId !== 'manual') {
    const slugId = normalizeSlug(ciclo.templateId);
    return `/logosEditais/logo-${slugId}.png`;
  }

  // 4. DETETIVE POR NOME (Para ciclos manuais ou muito antigos sem ID)
  const nomeLower = (ciclo.nome || "").toLowerCase();

  // 4.1 Fallbacks Hardcoded (Histórico)
  if (nomeLower.includes("pmba")) return "/logosEditais/logo-pmba.png";
  if (nomeLower.includes("pmal")) return "/logosEditais/logo-pmal.png";

  // 4.2 Limpeza Inteligente para "Qualquer Concurso"
  // Remove lixo comum para tentar acertar o nome do arquivo
  let nomeLimpo = nomeLower
    .replace("pré-edital", "")
    .replace("pre-edital", "")
    .replace("edital", "")
    .replace("concurso", "")
    .replace(" 2024", "")
    .replace(" 2025", "")
    .replace(" 2026", "")
    .trim();

  // Tenta remover siglas de estado no final se estiver separado por traço (ex: " - ES")
  // Isso ajuda "GCM Viana - ES" virar "logo-gcmviana.png" em vez de "logo-gcmvianaes.png"
  if (nomeLimpo.includes(" - ")) {
      nomeLimpo = nomeLimpo.split(" - ")[0];
  }

  const slugNome = normalizeSlug(nomeLimpo);

  if (slugNome.length > 2) {
    return `/logosEditais/logo-${slugNome}.png`;
  }

  // Se falhar tudo, retorna null (o componente vai renderizar o ícone padrão)
  return null;
};