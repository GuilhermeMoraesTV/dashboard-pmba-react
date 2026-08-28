const PAGE = { width: 210, height: 297 };
const COLORS = {
  ink: [24, 24, 27],
  muted: [113, 113, 122],
  line: [212, 212, 216],
  soft: [244, 244, 245],
  red: [220, 38, 38],
  redDark: [127, 29, 29],
  redSoft: [254, 242, 242],
  charcoal: [39, 39, 42],
  green: [5, 150, 105],
  white: [255, 255, 255],
};

export const PDF_SCOPE_COMPLETE = 'complete';
export const PDF_SCOPE_PLANNING = 'planning';
export const PDF_FILL_BLANK = 'blank';
export const PDF_FILL_PROGRESS = 'progress';

// Ajustes de fonte da capa: familia, estilo e tamanho em pontos.
export const PDF_COVER_TYPOGRAPHY = Object.freeze({
  headingFont: 'helvetica',
  headingStyle: 'bold',
  headingSize: 19,
  titleFont: 'helvetica',
  titleStyle: 'bold',
  titleSize: 18,
  cargoFont: 'helvetica',
  cargoStyle: 'normal',
  cargoSize: 12,
});

export const PDF_CLASSIC_COVER_DESIGNS = Object.freeze([
  { id: 'orbital', name: 'Orbital' },
  { id: 'diagonal', name: 'Diagonal' },
  { id: 'tactical-grid', name: 'Grade tatica' },
  { id: 'horizon', name: 'Horizonte' },
  { id: 'architectural', name: 'Arquitetural' },
]);

export const PDF_PREMIUM_COVER_DESIGNS = Object.freeze([
  { id: 'command-shield', name: 'Escudo de comando' },
  { id: 'topographic', name: 'Mapa topografico' },
  { id: 'night-ops', name: 'Operacao noturna' },
  { id: 'kinetic-ribbons', name: 'Fitas cineticas' },
  { id: 'precision-radar', name: 'Radar de precisao' },
]);

export const PDF_COVER_DESIGNS = Object.freeze([
  ...PDF_CLASSIC_COVER_DESIGNS,
  ...PDF_PREMIUM_COVER_DESIGNS,
]);

export const PDF_CLOSING_DESIGNS = PDF_CLASSIC_COVER_DESIGNS;
export const PDF_DEFAULT_PAGE_DESIGN = 'tactical-grid';
export const PDF_TACTICAL_WATERMARK_DESIGN = 'tactical-grid-watermark';
export const PDF_PHOTO_CARD_DESIGN = 'photo-card';
export const PDF_FEATURED_COVER_TITLE_SIZE = 29;
export const PDF_DEFAULT_TACTICAL_FONT_DESIGN = 'russo-one';

export const PDF_TACTICAL_FONT_DESIGNS = Object.freeze([
  { id: 'black-ops', name: 'Black Ops One', family: 'BlackOpsOne', coverSize: 29, fileName: 'BlackOpsOne-Regular.ttf', assetUrl: '/fonts/tactical/BlackOpsOne-Regular.ttf' },
  { id: 'saira-stencil', name: 'Saira Stencil One', family: 'SairaStencilOne', coverSize: 30, fileName: 'SairaStencilOne-Regular.ttf', assetUrl: '/fonts/tactical/SairaStencilOne-Regular.ttf' },
  { id: 'chakra-petch', name: 'Chakra Petch', family: 'ChakraPetch', coverSize: 31, fileName: 'ChakraPetch-Bold.ttf', assetUrl: '/fonts/tactical/ChakraPetch-Bold.ttf' },
  { id: 'russo-one', name: 'Russo One', family: 'RussoOne', coverSize: 35, fileName: 'RussoOne-Regular.ttf', assetUrl: '/fonts/tactical/RussoOne-Regular.ttf' },
  { id: 'bebas-neue', name: 'Bebas Neue', family: 'BebasNeue', coverSize: 36, fileName: 'BebasNeue-Regular.ttf', assetUrl: '/fonts/tactical/BebasNeue-Regular.ttf' },
]);

const normalizePageDesign = (design) => (
  PDF_COVER_DESIGNS.some((item) => item.id === design)
    || design === PDF_TACTICAL_WATERMARK_DESIGN
    || design === PDF_PHOTO_CARD_DESIGN
    ? design
    : PDF_DEFAULT_PAGE_DESIGN
);

export const normalizePdfText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase('pt-BR');

const slugify = (value) => normalizePdfText(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 70) || 'edital';

const EDITAL_LOGO_ALIASES = [
  { code: 'cbmba', pattern: /\bcbmba\b|bombeiros? militar(?:es)? da bahia/ },
  { code: 'cbmerj', pattern: /\bcbmerj\b|bombeiros? militar(?:es)? do rio de janeiro/ },
  { code: 'cbmmg', pattern: /\bcbmmg\b|bombeiros? militar(?:es)? de minas gerais/ },
  { code: 'gcmaquiraz', pattern: /\bgcm\s*aquiraz\b|guarda municipal de aquiraz/ },
  { code: 'gcmgoiania', pattern: /\bgcm\s*goiania\b|guarda municipal de goiania/ },
  { code: 'gcmrecife', pattern: /\bgcm\s*recife\b|guarda municipal do recife/ },
  { code: 'gcmsalvador', pattern: /\bgcm\s*salvador\b|guarda municipal de salvador/ },
  { code: 'gcmviana', pattern: /\bgcm\s*viana\b|guarda municipal de viana/ },
  { code: 'pcba', pattern: /\bpc\s*ba\b|\bpcba\b|policia civil da bahia/ },
  { code: 'pcpe', pattern: /\bpc\s*pe\b|\bpcpe\b|policia civil de pernambuco/ },
  { code: 'pcsc', pattern: /\bpc\s*sc\b|\bpcsc\b|policia civil de santa catarina/ },
  { code: 'pmal', pattern: /\bpm\s*al\b|\bpmal\b|policia militar de alagoas/ },
  { code: 'pmba', pattern: /\bpm\s*ba\b|\bpmba\b|policia militar da bahia/ },
  { code: 'pmerj', pattern: /\bpm\s*erj\b|\bpmerj\b|policia militar do estado do rio de janeiro/ },
  { code: 'pmes', pattern: /\bpm\s*es\b|\bpmes\b|policia militar do espirito santo/ },
  { code: 'pmgo', pattern: /\bpm\s*go\b|\bpmgo\b|policia militar de goias/ },
  { code: 'pmmg', pattern: /\bpm\s*mg\b|\bpmmg\b|policia militar de minas gerais/ },
  { code: 'pmpe', pattern: /\bpm\s*pe\b|\bpmpe\b|policia militar de pernambuco/ },
  { code: 'pmpi', pattern: /\bpm\s*pi\b|\bpmpi\b|policia militar do piaui/ },
  { code: 'pmse', pattern: /\bpm\s*se\b|\bpmse\b|policia militar de sergipe/ },
  { code: 'pmsp', pattern: /\bpm\s*sp\b|\bpmsp\b|policia militar de sao paulo/ },
  { code: 'ppmg', pattern: /\bpp\s*mg\b|\bppmg\b|policia penal de minas gerais/ },
  { code: 'prf', pattern: /\bprf\b|policia rodoviaria federal/ },
];

const editalIdentity = (edital = {}) => normalizePdfText([
  edital.id,
  edital.nome,
  edital.titulo,
  edital.editalNome,
  edital.orgao,
  edital.instituicao,
].filter(Boolean).join(' '));

export const buildEditalLogoCandidates = ({ edital = {}, providedLogo = null } = {}) => {
  const candidates = [];
  const add = (value) => {
    (Array.isArray(value) ? value : [value]).forEach((item) => {
      if (typeof item === 'string' && item.trim() && !candidates.includes(item.trim())) candidates.push(item.trim());
    });
  };
  add(providedLogo);
  add(edital.logoUrl);
  add(edital.logoURL);
  add(edital.logo);
  add(edital.editalLogoUrl);
  add(edital.computedLogo);

  const identity = editalIdentity(edital);
  const alias = EDITAL_LOGO_ALIASES.find((item) => item.pattern.test(identity));
  if (alias) add(`/logosEditais/logo-${alias.code}.png`);
  if (edital.id) add(`/logosEditais/logo-${slugify(edital.id)}.png`);
  return candidates;
};

export const buildEditalLogoFallbackLabel = (edital = {}) => {
  const identity = editalIdentity(edital);
  const alias = EDITAL_LOGO_ALIASES.find((item) => item.pattern.test(identity));
  if (alias) return alias.code.toUpperCase();
  const source = String(edital.nome || edital.titulo || edital.editalNome || 'EDITAL');
  const initials = source
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word && !['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'].includes(word.toUpperCase()))
    .map((word) => word[0])
    .join('')
    .slice(0, 8)
    .toUpperCase();
  return initials || 'EDITAL';
};

const topicName = (topic) => (
  typeof topic === 'string'
    ? topic
    : topic?.nome || topic?.titulo || topic?.label || ''
);

const disciplineName = (discipline) => (
  discipline?.nome || discipline?.disciplinaNome || discipline?.titulo || 'Disciplina'
);

const buildProgressMap = (disciplines = []) => {
  const map = new Map();
  disciplines.forEach((discipline) => {
    const discKey = normalizePdfText(disciplineName(discipline));
    (Array.isArray(discipline?.assuntos) ? discipline.assuntos : []).forEach((topic) => {
      const name = topicName(topic);
      if (!name) return;
      map.set(`${discKey}::${normalizePdfText(name)}`, {
        estudado: Boolean(topic?.estudado),
        qtdVezes: Math.max(0, Number(topic?.qtdVezes || 0)),
        questoes: Math.max(0, Number(topic?.questoes || 0)),
        acertos: Math.max(0, Number(topic?.acertos || 0)),
      });
    });
  });
  return map;
};

export const prepareEditalVerticalizadoDisciplines = ({
  sourceDisciplines = [],
  progressDisciplines = [],
  scope = PDF_SCOPE_PLANNING,
  fillMode = PDF_FILL_BLANK,
} = {}) => {
  const progressMap = buildProgressMap(progressDisciplines);
  const includeProgress = fillMode === PDF_FILL_PROGRESS;

  return (Array.isArray(sourceDisciplines) ? sourceDisciplines : [])
    .filter((discipline) => scope === PDF_SCOPE_COMPLETE || discipline?.inCiclo !== false)
    .map((discipline, disciplineIndex) => {
      const name = disciplineName(discipline).trim();
      const discKey = normalizePdfText(name);
      const topics = (Array.isArray(discipline?.assuntos) ? discipline.assuntos : [])
        .filter((topic) => scope === PDF_SCOPE_COMPLETE || typeof topic !== 'object' || topic?.inCiclo !== false)
        .map((topic, topicIndex) => {
          const name_ = topicName(topic).trim();
          const direct = typeof topic === 'object' && topic ? topic : {};
          const stored = progressMap.get(`${discKey}::${normalizePdfText(name_)}`) || direct;
          return {
            id: direct.id || `${disciplineIndex}-${topicIndex}`,
            nome: name_,
            estudado: includeProgress && Boolean(stored?.estudado),
            qtdVezes: includeProgress ? Math.max(0, Number(stored?.qtdVezes || 0)) : 0,
            questoes: includeProgress ? Math.max(0, Number(stored?.questoes || 0)) : null,
            acertos: includeProgress ? Math.max(0, Number(stored?.acertos || 0)) : null,
          };
        })
        .filter((topic) => topic.nome);

      return {
        id: discipline?.id || `disc-${disciplineIndex}`,
        nome: name,
        peso: Number(discipline?.peso || discipline?.peso_sugerido || 0),
        assuntos: topics,
      };
    })
    .filter((discipline) => discipline.nome && discipline.assuntos.length > 0);
};

export const getReviewBoxState = (reviewCount = 0, fillMode = PDF_FILL_BLANK) => {
  const total = fillMode === PDF_FILL_PROGRESS ? Math.max(0, Number(reviewCount) || 0) : 0;
  return {
    boxes: [0, 1, 2, 3, 4].map((index) => total > index),
    extra: total > 5 ? total - 5 : 0,
    total,
  };
};

export const getReviewCellLayout = (cellWidth, hasExtra = false) => {
  const horizontalPadding = 2;
  const boxGap = 1;
  const extraGap = hasExtra ? 1 : 0;
  const extraWidth = hasExtra ? 7 : 0;
  const usableWidth = Math.max(0, Number(cellWidth || 0) - (horizontalPadding * 2));
  const boxesWidth = Math.max(0, usableWidth - (boxGap * 4) - extraGap - extraWidth);
  const boxSize = Math.min(4.5, boxesWidth / 5);
  const totalWidth = (boxSize * 5) + (boxGap * 4) + extraGap + extraWidth;
  return { horizontalPadding, boxGap, extraGap, extraWidth, boxSize, totalWidth };
};

export const buildEditalVerticalizadoFileName = ({ editalName, scope, fillMode }) => {
  const scopePart = scope === PDF_SCOPE_COMPLETE ? 'completo' : 'planejamento';
  const fillPart = fillMode === PDF_FILL_PROGRESS ? 'progresso-atual' : 'em-branco';
  return `edital-verticalizado-${slugify(editalName)}-${scopePart}-${fillPart}.pdf`;
};

const absoluteAssetUrl = (src) => {
  if (!src) return '';
  if (/^(data:|blob:|https?:)/i.test(src)) return src;
  if (typeof window === 'undefined') return src;
  return new URL(src, window.location.origin).href;
};

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const rasterizePdfImageBlob = async (blob) => {
  if (typeof document === 'undefined') return null;

  let bitmap = null;
  let objectUrl = null;
  try {
    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(blob);
      } catch {
        bitmap = null;
      }
    }
    if (!bitmap) {
      objectUrl = URL.createObjectURL(blob);
      bitmap = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = objectUrl;
      });
    }

    const sourceWidth = bitmap.naturalWidth || bitmap.width || 1;
    const sourceHeight = bitmap.naturalHeight || bitmap.height || 1;
    const maxDimension = 2048;
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL('image/png'), format: 'PNG', width, height };
  } catch {
    return null;
  } finally {
    if (typeof bitmap?.close === 'function') bitmap.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
};

const normalizePdfImageBlob = async (blob) => {
  const type = String(blob?.type || '').toLowerCase();
  if (type === 'image/png' || type === 'image/jpeg' || type === 'image/jpg') return null;
  return rasterizePdfImageBlob(blob);
};

const isNativePdfImageType = (type) => ['image/png', 'image/jpeg', 'image/jpg']
  .includes(String(type || '').toLowerCase());

const fetchPdfImageBlob = async (source) => {
  const assetUrl = absoluteAssetUrl(source);
  try {
    const response = await fetch(assetUrl, { mode: 'cors', cache: 'no-store' });
    if (response.ok) return response.blob();
  } catch {
    // URLs do Firebase Storage podem exigir a sessao autenticada do SDK.
  }

  if (!/^https?:/i.test(assetUrl)
    || !/(?:firebasestorage\.googleapis\.com|[^/]+\.firebasestorage\.app|storage\.googleapis\.com)/i.test(assetUrl)) return null;
  try {
    const [{ storage }, { getBlob, ref }] = await Promise.all([
      import('../firebaseConfig.js'),
      import('firebase/storage'),
    ]);
    return await getBlob(ref(storage, assetUrl));
  } catch {
    return null;
  }
};

const getImageDimensions = (dataUrl) => new Promise((resolve) => {
  if (typeof Image === 'undefined') {
    resolve({ width: 1, height: 1 });
    return;
  }
  const img = new Image();
  img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
  img.onerror = () => resolve({ width: 1, height: 1 });
  img.src = dataUrl;
});

export const resolvePdfImage = async (src) => {
  if (!src) return null;
  try {
    const descriptor = typeof src === 'object' ? src : { src };
    let dataUrl = descriptor.dataUrl || descriptor.src;
    if (!dataUrl) return null;
    if (!/^data:/i.test(dataUrl)) {
      const blob = await fetchPdfImageBlob(dataUrl);
      if (!blob) return null;
      const rasterized = await normalizePdfImageBlob(blob);
      if (rasterized) return rasterized;
      if (!isNativePdfImageType(blob.type)) return null;
      dataUrl = await blobToDataUrl(blob);
    } else if (!/^data:image\/(?:png|jpe?g);/i.test(dataUrl)) {
      const response = await fetch(dataUrl);
      const rasterized = await rasterizePdfImageBlob(await response.blob());
      if (rasterized) return rasterized;
      return null;
    }
    const dimensions = Number(descriptor.width) > 0 && Number(descriptor.height) > 0
      ? { width: Number(descriptor.width), height: Number(descriptor.height) }
      : await getImageDimensions(dataUrl);
    const format = descriptor.format
      || (/image\/jpe?g/i.test(dataUrl) ? 'JPEG' : /image\/webp/i.test(dataUrl) ? 'WEBP' : 'PNG');
    return { dataUrl, format, ...dimensions };
  } catch {
    return null;
  }
};

export const resolveFirstPdfImage = async (sources = []) => {
  for (const source of sources) {
    const image = await resolvePdfImage(source);
    if (image) return image;
  }
  return null;
};

const arrayBufferToBase64 = (buffer) => {
  if (typeof globalThis.Buffer !== 'undefined') return globalThis.Buffer.from(buffer).toString('base64');
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const resolvePdfFontBase64 = async (font, providedSource = null) => {
  if (providedSource?.base64) return providedSource.base64;
  if (typeof providedSource === 'string' && providedSource.trim()) return providedSource.trim();
  const response = await fetch(absoluteAssetUrl(font.assetUrl), { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Nao foi possivel carregar a fonte ${font.name}.`);
  return arrayBufferToBase64(await response.arrayBuffer());
};

const registerPdfFont = async (doc, font, providedSource = null) => {
  try {
    const base64 = await resolvePdfFontBase64(font, providedSource);
    doc.addFileToVFS(font.fileName, base64);
    doc.addFont(font.fileName, font.family, 'normal');
    return true;
  } catch {
    return false;
  }
};

const drawContainedImage = (doc, image, x, y, width, height, alias) => {
  if (!image) return false;
  try {
    const ratio = Math.min(width / image.width, height / image.height);
    const drawWidth = image.width * ratio;
    const drawHeight = image.height * ratio;
    doc.addImage(
      image.dataUrl,
      image.format,
      x + (width - drawWidth) / 2,
      y + (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
      alias,
      'FAST',
    );
    return true;
  } catch {
    return false;
  }
};

const drawCoverImage = (doc, image, alias) => {
  if (!image) return false;
  try {
    const ratio = Math.max(PAGE.width / image.width, PAGE.height / image.height);
    const drawWidth = image.width * ratio;
    const drawHeight = image.height * ratio;
    doc.addImage(
      image.dataUrl,
      image.format,
      (PAGE.width - drawWidth) / 2,
      (PAGE.height - drawHeight) / 2,
      drawWidth,
      drawHeight,
      alias,
      'FAST',
    );
    return true;
  } catch {
    return false;
  }
};

const getFittedFontSize = (doc, text, maxWidth, preferredSize, minimumSize = 17) => {
  let size = preferredSize;
  doc.setFontSize(size);
  while (size > minimumSize && doc.getTextWidth(String(text)) > maxWidth) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  return size;
};

const setOpacity = (doc, opacity) => {
  if (!doc.GState || typeof doc.setGState !== 'function') return false;
  doc.setGState(new doc.GState({ opacity }));
  return true;
};

const drawWatermark = (doc, systemLogo, dark = false) => {
  if (!systemLogo) return;
  const changed = setOpacity(doc, dark ? 0.09 : 0.035);
  drawContainedImage(doc, systemLogo, 48, 82, 114, 114, 'modo-qap-watermark');
  if (changed) setOpacity(doc, 1);
};

const drawLogoFallback = (doc, label, x, y, width, height, dark = false) => {
  doc.setDrawColor(...(dark ? COLORS.white : COLORS.line));
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, width, height, 2, 2, 'S');
  doc.setTextColor(...(dark ? COLORS.white : COLORS.muted));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const lines = doc.splitTextToSize(label || 'EDITAL', width - 4).slice(0, 2);
  doc.text(lines, x + width / 2, y + height / 2 - ((lines.length - 1) * 2), { align: 'center' });
};

const drawCoverLogoFallback = (doc, label) => {
  const value = String(label || 'EDITAL').slice(0, 8).toUpperCase();
  doc.setTextColor(...COLORS.redDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(value.length <= 5 ? 30 : 23);
  doc.text(value, PAGE.width / 2, 132, { align: 'center' });
};

const drawHeader = (doc, { editalName, editalLogo, systemLogo }) => {
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, PAGE.width, 35, 'F');
  doc.setFillColor(...COLORS.red);
  doc.rect(0, 0, PAGE.width, 2.4, 'F');

  if (!drawContainedImage(doc, editalLogo, 12, 6, 31, 20, 'edital-logo')) {
    drawLogoFallback(doc, editalName, 12, 6, 31, 20);
  }
  drawContainedImage(doc, systemLogo, 167, 6, 31, 20, 'system-logo');

  doc.setTextColor(...COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const title = doc.splitTextToSize(String(editalName || 'Edital Verticalizado').toUpperCase(), 105).slice(0, 2);
  doc.text(title, PAGE.width / 2, title.length > 1 ? 13 : 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  doc.text('EDITAL VERTICALIZADO', PAGE.width / 2, title.length > 1 ? 24 : 22, { align: 'center' });
  doc.setDrawColor(...COLORS.line);
  doc.line(12, 31, 198, 31);
};

const drawFooter = (doc, { editalName, pageNumber }) => {
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 280, PAGE.width, 17, 'F');
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.18);
  doc.line(14, 282, 196, 282);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...COLORS.ink);
  const left = doc.splitTextToSize(String(editalName || 'Edital').toUpperCase(), 57)[0] || 'EDITAL';
  doc.text(left, 14, 289);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(...COLORS.muted);
  doc.text('MODOQAP - Plataforma de Organizacao de Estudos', PAGE.width / 2, 289, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.red);
  doc.text(`Pagina ${String(pageNumber).padStart(2, '0')}`, 196, 289, { align: 'right' });
};

const drawOrbitalDecorations = (doc, mirrored = false) => {
  doc.setFillColor(...COLORS.redSoft);
  doc.circle(mirrored ? 17 : 193, 18, 42, 'F');
  doc.setDrawColor(254, 202, 202);
  doc.setLineWidth(0.45);
  doc.circle(mirrored ? 17 : 193, 18, 31, 'S');
  doc.setFillColor(...COLORS.red);
  doc.rect(mirrored ? 0 : 204, 0, 6, PAGE.height, 'F');
  doc.setFillColor(...COLORS.ink);
  doc.rect(mirrored ? 6 : 202, 0, 2, PAGE.height, 'F');
};

const drawDiagonalDecorations = (doc, mirrored = false) => {
  const edge = mirrored ? 0 : PAGE.width;
  doc.setFillColor(250, 250, 250);
  doc.triangle(edge, 0, mirrored ? 78 : 132, 0, edge, 116, 'F');
  doc.setFillColor(...COLORS.redSoft);
  doc.triangle(edge, 0, mirrored ? 38 : 172, 0, edge, 70, 'F');
  doc.setFillColor(...COLORS.red);
  doc.triangle(edge, mirrored ? 232 : 0, edge, mirrored ? PAGE.height : 65, mirrored ? 0 : PAGE.width, mirrored ? 270 : 34, 'F');
  doc.setFillColor(...COLORS.ink);
  doc.triangle(edge, mirrored ? 246 : 0, edge, mirrored ? 257 : 11, mirrored ? 0 : PAGE.width, mirrored ? 277 : 41, 'F');
  doc.setDrawColor(254, 202, 202);
  doc.setLineWidth(0.45);
  doc.line(mirrored ? 0 : 137, mirrored ? 94 : 0, mirrored ? 73 : PAGE.width, mirrored ? 0 : 108);
};

const drawTacticalGridDecorations = (doc, mirrored = false) => {
  doc.setDrawColor(241, 241, 242);
  doc.setLineWidth(0.18);
  for (let x = 18; x < PAGE.width; x += 16) doc.line(x, 0, x, PAGE.height);
  for (let y = 13; y < PAGE.height; y += 16) doc.line(0, y, PAGE.width, y);

  const left = mirrored ? 176 : 12;
  const right = mirrored ? 198 : 34;
  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(0.8);
  doc.line(left, 13, right, 13);
  doc.line(mirrored ? 198 : 12, 13, mirrored ? 198 : 12, 35);
  doc.line(left, 284, right, 284);
  doc.line(mirrored ? 198 : 12, 262, mirrored ? 198 : 12, 284);
  doc.setFillColor(...COLORS.ink);
  doc.rect(mirrored ? 205 : 0, 0, 5, PAGE.height, 'F');
  doc.setFillColor(...COLORS.red);
  doc.rect(mirrored ? 202.5 : 5, 0, 2.5, PAGE.height, 'F');
};

const drawSoftPanelShadow = (doc, x, y, width, height, radius = 5, dark = false) => {
  const layers = [
    { offset: 4.2, opacity: dark ? 0.18 : 0.035 },
    { offset: 2.7, opacity: dark ? 0.2 : 0.045 },
    { offset: 1.4, opacity: dark ? 0.22 : 0.06 },
  ];
  layers.forEach(({ offset, opacity }) => {
    const changed = setOpacity(doc, opacity);
    doc.setFillColor(...(dark ? [0, 0, 0] : [39, 39, 42]));
    doc.roundedRect(x + offset, y + offset, width, height, radius, radius, 'F');
    if (changed) setOpacity(doc, 1);
  });
};

const drawPremiumLogoStage = (doc, dark = false) => {
  drawSoftPanelShadow(doc, 55, 92, 100, 99, 8, dark);
  doc.setFillColor(...(dark ? [250, 250, 250] : COLORS.white));
  doc.roundedRect(55, 92, 100, 99, 8, 8, 'F');
  doc.setDrawColor(...(dark ? [254, 202, 202] : [228, 228, 231]));
  doc.setLineWidth(0.35);
  doc.roundedRect(58, 95, 94, 93, 6, 6, 'S');
};

const drawCommandShieldDecorations = (doc) => {
  doc.setFillColor(248, 248, 249);
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
  doc.setDrawColor(232, 232, 235);
  doc.setLineWidth(0.18);
  for (let x = 18; x < 205; x += 14) {
    for (let y = 14; y < 292; y += 14) doc.circle(x, y, 0.38, 'F');
  }

  const changed = setOpacity(doc, 0.08);
  doc.setFillColor(...COLORS.red);
  doc.triangle(132, 0, PAGE.width, 0, PAGE.width, 86, 'F');
  doc.triangle(0, 225, 0, PAGE.height, 88, PAGE.height, 'F');
  if (changed) setOpacity(doc, 1);

  drawSoftPanelShadow(doc, 39, 86, 132, 112, 12);
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(39, 86, 132, 112, 12, 12, 'F');
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.4);
  doc.roundedRect(43, 90, 124, 104, 9, 9, 'S');
  doc.setFillColor(...COLORS.ink);
  doc.triangle(39, 86, 62, 86, 39, 109, 'F');
  doc.triangle(171, 175, 171, 198, 148, 198, 'F');
  doc.setFillColor(...COLORS.red);
  doc.triangle(42, 90, 56, 90, 42, 104, 'F');
  doc.triangle(168, 180, 168, 194, 154, 194, 'F');
  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, 5, PAGE.height, 'F');
  doc.setFillColor(...COLORS.red);
  doc.rect(5, 0, 3, PAGE.height, 'F');
  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(1.1);
  doc.line(19, 18, 51, 18);
  doc.line(159, 279, 191, 279);
};

const drawTopographicDecorations = (doc) => {
  doc.setFillColor(252, 251, 249);
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
  const changed = setOpacity(doc, 0.62);
  doc.setDrawColor(214, 211, 209);
  doc.setLineWidth(0.38);
  [24, 34, 45, 57, 70, 84].forEach((radius, index) => {
    doc.ellipse(186, 244, radius, radius * (0.72 + index * 0.025), 'S');
  });
  [18, 27, 38, 50].forEach((radius, index) => {
    doc.ellipse(14, 45, radius, radius * (0.8 + index * 0.04), 'S');
  });
  if (changed) setOpacity(doc, 1);
  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(0.75);
  doc.ellipse(186, 244, 45, 35, 'S');
  doc.ellipse(14, 45, 27, 23, 'S');
  doc.setFillColor(...COLORS.redSoft);
  doc.triangle(0, 164, 0, 297, 62, 297, 'F');
  doc.setFillColor(...COLORS.ink);
  doc.rect(11, 0, 1.6, PAGE.height, 'F');
  doc.setFillColor(...COLORS.red);
  doc.rect(13.5, 0, 3.2, PAGE.height, 'F');
  drawSoftPanelShadow(doc, 48, 89, 118, 106, 54);
  doc.setFillColor(...COLORS.white);
  doc.circle(PAGE.width / 2, 142, 55, 'F');
  doc.setDrawColor(231, 229, 228);
  doc.setLineWidth(0.45);
  doc.circle(PAGE.width / 2, 142, 51, 'S');
};

const drawNightOpsDecorations = (doc) => {
  doc.setFillColor(22, 22, 25);
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
  doc.setDrawColor(52, 52, 57);
  doc.setLineWidth(0.22);
  for (let x = 11; x < PAGE.width; x += 14) doc.line(x, 0, x, PAGE.height);
  for (let y = 10; y < PAGE.height; y += 14) doc.line(0, y, PAGE.width, y);

  let changed = setOpacity(doc, 0.22);
  doc.setFillColor(...COLORS.red);
  doc.triangle(88, 0, PAGE.width, 0, PAGE.width, 121, 'F');
  doc.triangle(0, 199, 0, PAGE.height, 137, PAGE.height, 'F');
  if (changed) setOpacity(doc, 1);
  changed = setOpacity(doc, 0.12);
  doc.setFillColor(255, 255, 255);
  doc.circle(187, 244, 72, 'F');
  if (changed) setOpacity(doc, 1);

  doc.setFillColor(...COLORS.red);
  doc.rect(0, 0, 5, PAGE.height, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(5, 0, 1.2, PAGE.height, 'F');
  doc.setDrawColor(239, 68, 68);
  doc.setLineWidth(0.8);
  doc.line(16, 20, 49, 20);
  doc.line(161, 277, 194, 277);
};

const drawKineticRibbonsDecorations = (doc) => {
  doc.setFillColor(250, 250, 250);
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
  const shadow = setOpacity(doc, 0.08);
  doc.setFillColor(...COLORS.ink);
  doc.triangle(138, 3, 210, 3, 210, 118, 'F');
  doc.triangle(0, 190, 0, 294, 79, 294, 'F');
  if (shadow) setOpacity(doc, 1);
  doc.setFillColor(...COLORS.redSoft);
  doc.triangle(126, 0, 210, 0, 210, 103, 'F');
  doc.triangle(0, 207, 0, 297, 69, 297, 'F');
  doc.setFillColor(...COLORS.red);
  doc.triangle(169, 0, 210, 0, 210, 54, 'F');
  doc.triangle(0, 252, 0, 297, 37, 297, 'F');
  doc.setFillColor(...COLORS.ink);
  doc.triangle(190, 0, 210, 0, 210, 27, 'F');
  doc.triangle(0, 278, 0, 297, 17, 297, 'F');
  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(0.6);
  doc.line(0, 78, 72, 0);
  doc.line(138, 297, 210, 219);
  drawSoftPanelShadow(doc, 48, 88, 114, 108, 7);
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(48, 88, 114, 108, 7, 7, 'F');
  doc.setDrawColor(228, 228, 231);
  doc.setLineWidth(0.35);
  doc.roundedRect(52, 92, 106, 100, 5, 5, 'S');
};

const drawPrecisionRadarDecorations = (doc) => {
  doc.setFillColor(247, 248, 250);
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
  doc.setDrawColor(226, 228, 232);
  doc.setLineWidth(0.24);
  for (let x = 14; x < PAGE.width; x += 18) doc.line(x, 0, x, PAGE.height);
  for (let y = 13; y < PAGE.height; y += 18) doc.line(0, y, PAGE.width, y);

  const centerX = 181;
  const centerY = 239;
  doc.setDrawColor(203, 207, 213);
  doc.setLineWidth(0.45);
  [24, 39, 55, 72].forEach((radius) => doc.circle(centerX, centerY, radius, 'S'));
  doc.line(centerX - 86, centerY, PAGE.width, centerY);
  doc.line(centerX, centerY - 86, centerX, PAGE.height);
  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(1.05);
  doc.circle(centerX, centerY, 39, 'S');
  doc.line(centerX - 10, centerY, centerX + 10, centerY);
  doc.line(centerX, centerY - 10, centerX, centerY + 10);
  doc.setFillColor(...COLORS.red);
  doc.circle(centerX, centerY, 2.2, 'F');
  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, 5, PAGE.height, 'F');
  doc.setFillColor(...COLORS.red);
  doc.rect(5, 0, 3, PAGE.height, 'F');
  drawSoftPanelShadow(doc, 50, 89, 110, 106, 55);
  doc.setFillColor(...COLORS.white);
  doc.circle(PAGE.width / 2, 142, 53, 'F');
  doc.setDrawColor(220, 222, 226);
  doc.setLineWidth(0.4);
  doc.circle(PAGE.width / 2, 142, 49, 'S');
  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(0.8);
  doc.line(17, 18, 45, 18);
  doc.line(17, 18, 17, 46);
};

const drawHorizonDecorations = (doc, mirrored = false) => {
  const centerX = mirrored ? 20 : 190;
  const centerY = mirrored ? 248 : 49;
  doc.setFillColor(250, 250, 250);
  doc.circle(centerX, centerY, 74, 'F');
  doc.setDrawColor(228, 228, 231);
  doc.setLineWidth(0.4);
  [35, 48, 61].forEach((radius) => doc.circle(centerX, centerY, radius, 'S'));
  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(1.15);
  doc.line(0, mirrored ? 287 : 10, PAGE.width, mirrored ? 287 : 10);
  doc.setDrawColor(...COLORS.ink);
  doc.setLineWidth(0.35);
  doc.line(0, mirrored ? 284 : 13, PAGE.width, mirrored ? 284 : 13);
  doc.setFillColor(...COLORS.redSoft);
  doc.rect(mirrored ? 0 : 194, mirrored ? 0 : 13, 16, mirrored ? 284 : 284, 'F');
};

const drawArchitecturalDecorations = (doc, mirrored = false) => {
  doc.setFillColor(250, 250, 250);
  doc.rect(8, 8, 194, 281, 'F');
  doc.setFillColor(...COLORS.white);
  doc.rect(12, 12, 186, 273, 'F');
  doc.setDrawColor(228, 228, 231);
  doc.setLineWidth(0.35);
  doc.rect(16, 16, 178, 265, 'S');
  doc.setFillColor(...COLORS.redSoft);
  doc.triangle(mirrored ? 0 : 144, mirrored ? 218 : 0, mirrored ? 0 : PAGE.width, mirrored ? PAGE.height : 0, mirrored ? 0 : PAGE.width, mirrored ? 151 : 66, 'F');
  doc.setFillColor(...COLORS.red);
  doc.rect(mirrored ? 8 : 198, 8, 4, 281, 'F');
  doc.setFillColor(...COLORS.ink);
  doc.rect(mirrored ? 12 : 194, 8, 1.5, 281, 'F');
  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(0.8);
  doc.line(mirrored ? 18 : 164, mirrored ? 269 : 28, mirrored ? 46 : 192, mirrored ? 269 : 28);
};

const drawPageDecorations = (doc, design = PDF_DEFAULT_PAGE_DESIGN, mirrored = false) => {
  switch (normalizePageDesign(design)) {
    case 'diagonal':
      drawDiagonalDecorations(doc, mirrored);
      break;
    case 'tactical-grid':
    case PDF_TACTICAL_WATERMARK_DESIGN:
      drawTacticalGridDecorations(doc, mirrored);
      break;
    case 'horizon':
      drawHorizonDecorations(doc, mirrored);
      break;
    case 'architectural':
      drawArchitecturalDecorations(doc, mirrored);
      break;
    case 'command-shield':
      drawCommandShieldDecorations(doc);
      break;
    case 'topographic':
      drawTopographicDecorations(doc);
      break;
    case 'night-ops':
      drawNightOpsDecorations(doc);
      break;
    case 'kinetic-ribbons':
      drawKineticRibbonsDecorations(doc);
      break;
    case 'precision-radar':
      drawPrecisionRadarDecorations(doc);
      break;
    default:
      drawOrbitalDecorations(doc, mirrored);
  }
};

const drawPhotoCardCover = (doc, {
  editalName,
  editalCargo,
  editalLogo,
  editalLogoLabel,
  systemLogo,
  coverBackground,
}) => {
  doc.setFillColor(10, 10, 12);
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
  drawCoverImage(doc, coverBackground, 'edital-cover-photo-background');

  const shadeChanged = setOpacity(doc, 0.16);
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, PAGE.width, 28, 'F');
  doc.rect(0, 276, PAGE.width, 21, 'F');
  if (shadeChanged) setOpacity(doc, 1);

  drawSoftPanelShadow(doc, 85, 9, 40, 40, 20, true);
  doc.setFillColor(...COLORS.white);
  doc.circle(PAGE.width / 2, 29, 20, 'F');
  if (!drawContainedImage(doc, systemLogo, 87, 11, 36, 36, 'system-logo-photo-card')) {
    drawLogoFallback(doc, 'MODOQAP', 91, 16, 28, 26);
  }

  drawSoftPanelShadow(doc, 34, 55, 142, 35, 7, true);
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(34, 55, 142, 35, 7, 7, 'F');
  doc.setFillColor(...COLORS.red);
  doc.roundedRect(87, 84, 36, 1.7, 0.85, 0.85, 'F');
  doc.setFont(PDF_COVER_TYPOGRAPHY.headingFont, PDF_COVER_TYPOGRAPHY.headingStyle);
  doc.setFontSize(21.5);
  doc.setTextColor(...COLORS.ink);
  doc.text('EDITAL', PAGE.width / 2, 68, { align: 'center' });
  doc.text('VERTICALIZADO', PAGE.width / 2, 79, { align: 'center' });

  drawSoftPanelShadow(doc, 55, 98, 100, 98, 8, true);
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(55, 98, 100, 98, 8, 8, 'F');
  doc.setDrawColor(228, 228, 231);
  doc.setLineWidth(0.35);
  doc.roundedRect(59, 102, 92, 90, 6, 6, 'S');

  if (!drawContainedImage(doc, editalLogo, 64, 105, 82, 82, 'edital-logo-photo-card')) {
    drawLogoFallback(doc, editalLogoLabel, 64, 105, 82, 82);
  }

  drawSoftPanelShadow(doc, 30, 204, 150, 52, 7, true);
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(30, 204, 150, 52, 7, 7, 'F');
  doc.setFillColor(...COLORS.red);
  doc.roundedRect(84, 210, 42, 1.5, 0.75, 0.75, 'F');
  doc.setFont(PDF_COVER_TYPOGRAPHY.titleFont, PDF_COVER_TYPOGRAPHY.titleStyle);
  doc.setFontSize(PDF_FEATURED_COVER_TITLE_SIZE);
  doc.setTextColor(...COLORS.ink);
  const title = doc.splitTextToSize(String(editalName || 'Edital').toUpperCase(), 136).slice(0, 2);
  const titleY = title.length > 1 ? 218 : 226;
  doc.text(title, PAGE.width / 2, titleY, { align: 'center', lineHeightFactor: 0.92 });

  if (editalCargo) {
    doc.setFont(PDF_COVER_TYPOGRAPHY.cargoFont, PDF_COVER_TYPOGRAPHY.cargoStyle);
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.redDark);
    const cargoLines = doc.splitTextToSize(String(editalCargo), 124).slice(0, 2);
    const cargoY = titleY + (title.length - 1) * 9 + 12;
    doc.text(cargoLines, PAGE.width / 2, cargoY, { align: 'center', lineHeightFactor: 1.15 });
  }
};

const drawCover = (doc, context, design = PDF_DEFAULT_PAGE_DESIGN, typography = {}) => {
  const { editalName, editalCargo, editalLogo, editalLogoLabel, systemLogo } = context;
  const resolvedDesign = normalizePageDesign(design);
  if (resolvedDesign === PDF_PHOTO_CARD_DESIGN) {
    drawPhotoCardCover(doc, context);
    return;
  }
  const isTactical = resolvedDesign === 'tactical-grid' || resolvedDesign === PDF_TACTICAL_WATERMARK_DESIGN;
  const isPremium = PDF_PREMIUM_COVER_DESIGNS.some((item) => item.id === resolvedDesign);
  const usesSplitLayout = isTactical || isPremium;
  const darkCover = resolvedDesign === 'night-ops';
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
  drawPageDecorations(doc, resolvedDesign);

  if (resolvedDesign === PDF_TACTICAL_WATERMARK_DESIGN && systemLogo) {
    const changed = setOpacity(doc, 0.055);
    drawContainedImage(doc, systemLogo, 82, 136, 128, 148, 'system-logo-cover-watermark');
    if (changed) setOpacity(doc, 1);
  }

  if (isPremium) {
    drawPremiumLogoStage(doc, darkCover);
    const shadowChanged = setOpacity(doc, darkCover ? 0.25 : 0.08);
    doc.setFillColor(...(darkCover ? [0, 0, 0] : COLORS.ink));
    doc.circle(PAGE.width / 2 + 1.8, 32.5, 18.4, 'F');
    if (shadowChanged) setOpacity(doc, 1);
    doc.setFillColor(...COLORS.white);
    doc.circle(PAGE.width / 2, 31.5, 18, 'F');
  }

  if (!drawContainedImage(doc, systemLogo, 74, 15, 62, 34, `system-logo-cover-${resolvedDesign}`)) {
    drawLogoFallback(doc, 'MODOQAP', 82, 18, 46, 25);
  }
  const displayFont = typography.fontFamily || PDF_COVER_TYPOGRAPHY.headingFont;
  const displayStyle = typography.fontFamily ? 'normal' : PDF_COVER_TYPOGRAPHY.headingStyle;
  const displayPreferredSize = typography.fontSize || PDF_FEATURED_COVER_TITLE_SIZE;
  doc.setTextColor(...(darkCover ? COLORS.white : COLORS.ink));
  doc.setFont(displayFont, displayStyle);
  doc.setFontSize(usesSplitLayout ? displayPreferredSize : PDF_COVER_TYPOGRAPHY.headingSize);
  if (usesSplitLayout) {
    const headingSize = Math.min(
      getFittedFontSize(doc, 'EDITAL', 180, displayPreferredSize),
      getFittedFontSize(doc, 'VERTICALIZADO', 180, displayPreferredSize),
    );
    doc.setFontSize(headingSize);
    doc.text('EDITAL', PAGE.width / 2, 65, { align: 'center' });
    doc.text('VERTICALIZADO', PAGE.width / 2, 77, { align: 'center' });
  } else {
    doc.text('EDITAL VERTICALIZADO', PAGE.width / 2, 65, { align: 'center' });
  }
  doc.setFillColor(...COLORS.red);
  doc.roundedRect(88, usesSplitLayout ? 84 : 72, 34, 1.8, 0.9, 0.9, 'F');

  const editalLogoY = usesSplitLayout ? 96 : 81;
  if (!drawContainedImage(doc, editalLogo, 60, editalLogoY, 90, 90, `edital-logo-cover-${resolvedDesign}`)) {
    drawCoverLogoFallback(doc, editalLogoLabel);
  }

  doc.setFont(typography.fontFamily || PDF_COVER_TYPOGRAPHY.titleFont, typography.fontFamily ? 'normal' : PDF_COVER_TYPOGRAPHY.titleStyle);
  const preferredTitleSize = usesSplitLayout ? displayPreferredSize : PDF_COVER_TYPOGRAPHY.titleSize;
  doc.setFontSize(preferredTitleSize);
  doc.setTextColor(...(darkCover ? COLORS.white : COLORS.ink));
  const title = doc.splitTextToSize(String(editalName || 'Edital').toUpperCase(), usesSplitLayout ? 180 : 164).slice(0, usesSplitLayout ? 2 : 3);
  if (usesSplitLayout && title.length === 1) {
    doc.setFontSize(getFittedFontSize(doc, title[0], 180, preferredTitleSize));
  }
  const titleY = usesSplitLayout
    ? (title.length > 1 ? 204 : 211)
    : 197 - Math.max(0, title.length - 1) * 4.5;
  doc.text(title, PAGE.width / 2, titleY, { align: 'center', lineHeightFactor: usesSplitLayout ? 0.96 : 1.12 });
  if (editalCargo) {
    doc.setFont(PDF_COVER_TYPOGRAPHY.cargoFont, PDF_COVER_TYPOGRAPHY.cargoStyle);
    doc.setFontSize(PDF_COVER_TYPOGRAPHY.cargoSize);
    doc.setTextColor(...(darkCover ? [254, 202, 202] : COLORS.redDark));
    const cargoLines = doc.splitTextToSize(String(editalCargo), 145).slice(0, 2);
    const cargoY = usesSplitLayout ? titleY + (title.length - 1) * 10 + 15 : titleY + title.length * 7.6 + 7;
    doc.text(cargoLines, PAGE.width / 2, cargoY, { align: 'center' });
  }

  if (!usesSplitLayout) {
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.25);
    doc.line(38, 246, 172, 246);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(...COLORS.muted);
    doc.text('Organizacao, constancia e controle ate a aprovacao.', PAGE.width / 2, 255, { align: 'center' });
  }
};

const drawClosingPage = (doc, { systemLogo }, design = PDF_DEFAULT_PAGE_DESIGN) => {
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
  drawPageDecorations(doc, design, true);
  doc.setFillColor(250, 250, 250);
  doc.circle(PAGE.width / 2, PAGE.height / 2 - 4, 66, 'F');
  doc.setDrawColor(228, 228, 231);
  doc.setLineWidth(0.45);
  doc.circle(PAGE.width / 2, PAGE.height / 2 - 4, 58, 'S');
  if (!drawContainedImage(doc, systemLogo, 42, 91, 126, 108, 'system-logo-closing')) {
    drawLogoFallback(doc, 'MODOQAP', 55, 108, 100, 72);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  doc.text('MODOQAP', PAGE.width / 2, 221, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text('Plataforma de Organizacao de Estudos', PAGE.width / 2, 229, { align: 'center' });
};

const drawSummaryPageBase = (doc, context, summaryPage, totalSummaryPages) => {
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
  drawWatermark(doc, context.systemLogo);
  drawHeader(doc, context);
  doc.setTextColor(...COLORS.red);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('SUMARIO', 16, 49);
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(`PARTE ${summaryPage} DE ${totalSummaryPages}`, 16, 57);
};

const drawSummaryEntries = (doc, entries, startY = 69) => {
  entries.forEach((entry, index) => {
    const y = startY + index * 8.7;
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(14, y - 5.4, 182, 7.6, 1.2, 1.2, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.4);
    doc.setTextColor(...COLORS.ink);
    doc.text(String(entry.name).toUpperCase().slice(0, 80), 18, y);
    doc.setDrawColor(228, 228, 231);
    doc.setLineDashPattern([0.8, 1.1], 0);
    doc.line(18, y + 1.5, 184, y + 1.5);
    doc.setLineDashPattern([], 0);
    doc.setTextColor(...COLORS.red);
    doc.text(String(entry.page), 191, y, { align: 'right' });
  });
};

const drawTheoryCell = (doc, cell, checked) => {
  const size = 5.8;
  const x = cell.x + (cell.width - size) / 2;
  const y = cell.y + (cell.height - size) / 2;
  doc.setLineWidth(0.45);
  doc.setDrawColor(...(checked ? COLORS.green : COLORS.red));
  doc.setFillColor(...(checked ? COLORS.green : COLORS.white));
  doc.roundedRect(x, y, size, size, 1.1, 1.1, checked ? 'FD' : 'S');
  if (checked) {
    doc.setDrawColor(...COLORS.white);
    doc.setLineWidth(0.65);
    doc.line(x + 1.25, y + 3.1, x + 2.45, y + 4.25);
    doc.line(x + 2.45, y + 4.25, x + 4.75, y + 1.55);
  }
};

const drawReviewCell = (doc, cell, count, fillMode) => {
  const state = getReviewBoxState(count, fillMode);
  const layout = getReviewCellLayout(cell.width, state.extra > 0);
  const size = layout.boxSize;
  const gap = layout.boxGap;
  let x = cell.x + (cell.width - layout.totalWidth) / 2;
  const y = cell.y + (cell.height - size) / 2;
  state.boxes.forEach((filled) => {
    doc.setLineWidth(0.35);
    doc.setDrawColor(...(filled ? COLORS.green : COLORS.red));
    doc.setFillColor(...(filled ? COLORS.green : COLORS.white));
    doc.roundedRect(x, y, size, size, 0.9, 0.9, filled ? 'FD' : 'S');
    if (filled) {
      doc.setDrawColor(...COLORS.white);
      doc.setLineWidth(0.5);
      doc.line(x + 0.9, y + 2.35, x + 1.75, y + 3.15);
      doc.line(x + 1.75, y + 3.15, x + 3.45, y + 1.15);
    }
    x += size + gap;
  });
  if (state.extra) {
    x += layout.extraGap;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLORS.green);
    doc.text(`+${state.extra}`, x + (layout.extraWidth / 2), y + 3.25, { align: 'center' });
  }
};

const drawDisciplineTable = ({ doc, autoTable, discipline, context, fillMode, startY = 40 }) => {
  autoTable(doc, {
    startY,
    margin: { top: 40, right: 12, bottom: 22, left: 12 },
    theme: 'grid',
    showHead: 'everyPage',
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
    tableLineColor: COLORS.line,
    tableLineWidth: 0.18,
    head: [
      [{ content: String(discipline.nome).toUpperCase(), colSpan: 5, styles: { halign: 'left', fillColor: COLORS.ink, textColor: COLORS.white, fontSize: 10.5, cellPadding: 4.2 } }],
      [
        { content: 'ASSUNTO', styles: { halign: 'left' } },
        { content: 'TEORIA', styles: { halign: 'center' } },
        { content: 'REVISOES', styles: { halign: 'center' } },
        { content: 'QUESTOES', styles: { halign: 'center', fontSize: 6.8, cellPadding: 1 } },
        { content: 'ACERTOS', styles: { halign: 'center', fontSize: 6.8, cellPadding: 1 } },
      ],
    ],
    body: discipline.assuntos.map((topic, index) => [
      { content: `${index + 1}. ${topic.nome}`, trackerType: 'topic' },
      { content: '', trackerType: 'theory', checked: topic.estudado },
      { content: '', trackerType: 'review', reviewCount: topic.qtdVezes },
      { content: topic.questoes == null ? '' : String(topic.questoes), trackerType: 'questions' },
      { content: topic.acertos == null ? '' : String(topic.acertos), trackerType: 'correct' },
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      textColor: COLORS.ink,
      lineColor: COLORS.line,
      lineWidth: 0.18,
      cellPadding: 3.2,
      valign: 'middle',
      overflow: 'linebreak',
      minCellHeight: 12,
    },
    headStyles: {
      fillColor: COLORS.red,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 8,
      lineColor: COLORS.white,
      lineWidth: 0.18,
      cellPadding: 2,
    },
    alternateRowStyles: { fillColor: COLORS.soft },
    columnStyles: {
      0: { cellWidth: 102, halign: 'left' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 36, halign: 'center' },
      3: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
    },
    willDrawPage: () => {
      const pageNumber = doc.getNumberOfPages();
      if (!context.contentPages.has(pageNumber)) {
        doc.setFillColor(...COLORS.white);
        doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
        drawWatermark(doc, context.systemLogo);
        drawHeader(doc, context);
        context.contentPages.add(pageNumber);
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body') return;
      const raw = data.cell.raw || {};
      if (raw.trackerType === 'theory') drawTheoryCell(doc, data.cell, Boolean(raw.checked));
      if (raw.trackerType === 'review') drawReviewCell(doc, data.cell, raw.reviewCount, fillMode);
    },
  });
  return doc.lastAutoTable?.finalY || startY;
};

export const createEditalVerticalizadoPdf = async ({
  edital = {},
  disciplinas = [],
  scope = PDF_SCOPE_PLANNING,
  fillMode = PDF_FILL_BLANK,
  logos = {},
  coverDesign = PDF_DEFAULT_PAGE_DESIGN,
  closingDesign = coverDesign,
  coverBackground = null,
  coverFontDesign = null,
  fontSources = {},
} = {}) => {
  if (!Array.isArray(disciplinas) || disciplinas.length === 0) {
    throw new Error('Nenhuma disciplina com assuntos disponiveis para gerar o PDF.');
  }

  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableModule.default || autoTableModule.autoTable;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  const editalName = edital.nome || edital.titulo || edital.editalNome || 'Edital';
  const editalCargo = edital.cargo || edital.cargoNome || edital.funcao || edital.posto || '';
  const scopeLabel = scope === PDF_SCOPE_COMPLETE ? 'Edital completo' : 'Disciplinas do planejamento';
  const fillLabel = fillMode === PDF_FILL_PROGRESS ? 'Progresso atual' : 'Em branco';
  const modeLabel = `${scopeLabel} - ${fillLabel}`;
  const [editalLogo, systemLogo, resolvedCoverBackground] = await Promise.all([
    resolveFirstPdfImage(buildEditalLogoCandidates({ edital, providedLogo: logos.edital })),
    resolvePdfImage(logos.system || '/logoModoQAP.png'),
    resolvePdfImage(coverBackground || logos.coverBackground || edital.coverBackground),
  ]);
  const context = {
    editalName,
    editalCargo,
    editalLogo,
    editalLogoLabel: buildEditalLogoFallbackLabel(edital),
    systemLogo,
    coverBackground: resolvedCoverBackground,
    contentPages: new Set(),
  };

  doc.setProperties({
    title: `${editalName} - Edital Verticalizado`,
    subject: modeLabel,
    author: 'ModoQAP',
    creator: 'ModoQAP',
    keywords: 'edital verticalizado, concurso, planejamento, estudos',
  });

  const selectedFont = PDF_TACTICAL_FONT_DESIGNS.find((font) => font.id === (coverFontDesign || PDF_DEFAULT_TACTICAL_FONT_DESIGN));
  const fontReady = selectedFont ? await registerPdfFont(doc, selectedFont, fontSources[selectedFont.id]) : false;
  drawCover(doc, context, coverDesign, fontReady ? { fontFamily: selectedFont.family, fontSize: selectedFont.coverSize } : {});

  const entriesPerSummaryPage = 22;
  const summaryPageCount = Math.max(1, Math.ceil(disciplinas.length / entriesPerSummaryPage));
  const summaryPages = [];
  for (let index = 0; index < summaryPageCount; index += 1) {
    doc.addPage();
    summaryPages.push(doc.getNumberOfPages());
    drawSummaryPageBase(doc, context, index + 1, summaryPageCount);
  }

  const summaryEntries = [];
  doc.addPage();
  let nextTableY = 40;
  disciplinas.forEach((discipline, index) => {
    if (index > 0 && nextTableY > 246) {
      doc.addPage();
      nextTableY = 40;
    }
    const startPage = doc.getNumberOfPages();
    summaryEntries.push({ name: discipline.nome, page: startPage });
    const finalY = drawDisciplineTable({ doc, autoTable, discipline, context, fillMode, startY: nextTableY });
    nextTableY = finalY + 6;
  });

  summaryPages.forEach((pageNumber, index) => {
    doc.setPage(pageNumber);
    const slice = summaryEntries.slice(index * entriesPerSummaryPage, (index + 1) * entriesPerSummaryPage);
    drawSummaryEntries(doc, slice);
  });

  doc.addPage();
  const closingPage = doc.getNumberOfPages();
  drawClosingPage(doc, context, closingDesign);

  for (let pageNumber = 2; pageNumber < closingPage; pageNumber += 1) {
    doc.setPage(pageNumber);
    drawFooter(doc, { editalName, pageNumber });
  }
  doc.setPage(1);

  return doc;
};

export const createEditalVerticalizadoDesignShowcasePdf = async ({ edital = {}, logos = {} } = {}) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  const editalName = edital.nome || edital.titulo || edital.editalNome || 'Edital';
  const [editalLogo, systemLogo] = await Promise.all([
    resolveFirstPdfImage(buildEditalLogoCandidates({ edital, providedLogo: logos.edital })),
    resolvePdfImage(logos.system || '/logoModoQAP.png'),
  ]);
  const context = {
    editalName,
    editalCargo: edital.cargo || edital.cargoNome || edital.funcao || edital.posto || '',
    editalLogo,
    editalLogoLabel: buildEditalLogoFallbackLabel(edital),
    systemLogo,
  };

  doc.setProperties({
    title: `${editalName} - Estudos de capa e encerramento`,
    subject: 'Dez capas e cinco paginas de encerramento',
    author: 'ModoQAP',
    creator: 'ModoQAP',
  });

  PDF_COVER_DESIGNS.forEach((design, index) => {
    if (index > 0) doc.addPage();
    drawCover(doc, context, design.id);
  });
  PDF_CLOSING_DESIGNS.forEach((design) => {
    doc.addPage();
    drawClosingPage(doc, context, design.id);
  });
  doc.setPage(1);
  return doc;
};

export const createTacticalCoverOptionsPdf = async ({ edital = {}, logos = {} } = {}) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  const [editalLogo, systemLogo] = await Promise.all([
    resolveFirstPdfImage(buildEditalLogoCandidates({ edital, providedLogo: logos.edital })),
    resolvePdfImage(logos.system || '/logoModoQAP.png'),
  ]);
  const context = {
    editalName: edital.nome || edital.titulo || edital.editalNome || 'Edital',
    editalCargo: edital.cargo || edital.cargoNome || edital.funcao || edital.posto || '',
    editalLogo,
    editalLogoLabel: buildEditalLogoFallbackLabel(edital),
    systemLogo,
  };

  doc.setProperties({
    title: `${context.editalName} - Opcoes de capa Grade Tatica`,
    subject: 'Capa limpa e capa com marca-dagua ModoQAP',
    author: 'ModoQAP',
    creator: 'ModoQAP',
  });
  drawCover(doc, context, 'tactical-grid');
  doc.addPage();
  drawCover(doc, context, PDF_TACTICAL_WATERMARK_DESIGN);
  doc.setPage(1);
  return doc;
};

export const createPremiumCoverShowcasePdf = async ({ edital = {}, logos = {} } = {}) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  const [editalLogo, systemLogo] = await Promise.all([
    resolveFirstPdfImage(buildEditalLogoCandidates({ edital, providedLogo: logos.edital })),
    resolvePdfImage(logos.system || '/logoModoQAP.png'),
  ]);
  const context = {
    editalName: edital.nome || edital.titulo || edital.editalNome || 'Edital',
    editalCargo: edital.cargo || edital.cargoNome || edital.funcao || edital.posto || '',
    editalLogo,
    editalLogoLabel: buildEditalLogoFallbackLabel(edital),
    systemLogo,
  };

  doc.setProperties({
    title: `${context.editalName} - Cinco novas capas premium`,
    subject: 'Escudo, topografia, operacao noturna, fitas e radar',
    author: 'ModoQAP',
    creator: 'ModoQAP',
  });
  PDF_PREMIUM_COVER_DESIGNS.forEach((design, index) => {
    if (index > 0) doc.addPage();
    drawCover(doc, context, design.id);
  });
  doc.setPage(1);
  return doc;
};

export const createPhotoBackgroundCoverPdf = async ({
  edital = {},
  logos = {},
  coverBackground = null,
} = {}) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  const [editalLogo, systemLogo, resolvedCoverBackground] = await Promise.all([
    resolveFirstPdfImage(buildEditalLogoCandidates({ edital, providedLogo: logos.edital })),
    resolvePdfImage(logos.system || '/logoModoQAP.png'),
    resolvePdfImage(coverBackground || logos.coverBackground || edital.coverBackground),
  ]);
  const context = {
    editalName: edital.nome || edital.titulo || edital.editalNome || 'Edital',
    editalCargo: edital.cargo || edital.cargoNome || edital.funcao || edital.posto || '',
    editalLogo,
    editalLogoLabel: buildEditalLogoFallbackLabel(edital),
    systemLogo,
    coverBackground: resolvedCoverBackground,
  };
  doc.setProperties({
    title: `${context.editalName} - Capa fotografica`,
    subject: 'Capa com foto de fundo e conteudo em card branco',
    author: 'ModoQAP',
    creator: 'ModoQAP',
  });
  drawCover(doc, context, PDF_PHOTO_CARD_DESIGN);
  return doc;
};

export const createTacticalFontShowcasePdf = async ({
  edital = {},
  logos = {},
  fontSources = {},
} = {}) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  const [editalLogo, systemLogo] = await Promise.all([
    resolveFirstPdfImage(buildEditalLogoCandidates({ edital, providedLogo: logos.edital })),
    resolvePdfImage(logos.system || '/logoModoQAP.png'),
  ]);
  const context = {
    editalName: edital.nome || edital.titulo || edital.editalNome || 'Edital',
    editalCargo: edital.cargo || edital.cargoNome || edital.funcao || edital.posto || '',
    editalLogo,
    editalLogoLabel: buildEditalLogoFallbackLabel(edital),
    systemLogo,
  };
  doc.setProperties({
    title: `${context.editalName} - Cinco fontes taticas`,
    subject: 'Black Ops One, Saira Stencil One, Chakra Petch, Russo One e Bebas Neue',
    author: 'ModoQAP',
    creator: 'ModoQAP',
  });

  for (let index = 0; index < PDF_TACTICAL_FONT_DESIGNS.length; index += 1) {
    const font = PDF_TACTICAL_FONT_DESIGNS[index];
    if (index > 0) doc.addPage();
    const fontReady = await registerPdfFont(doc, font, fontSources[font.id]);
    drawCover(doc, context, 'tactical-grid', fontReady ? { fontFamily: font.family, fontSize: font.coverSize } : {});
  }
  doc.setPage(1);
  return doc;
};

export const downloadEditalVerticalizadoPdf = async (options = {}) => {
  const doc = await createEditalVerticalizadoPdf(options);
  const editalName = options?.edital?.nome || options?.edital?.titulo || options?.edital?.editalNome || 'edital';
  const fileName = buildEditalVerticalizadoFileName({
    editalName,
    scope: options.scope,
    fillMode: options.fillMode,
  });
  doc.save(fileName);
  return fileName;
};
