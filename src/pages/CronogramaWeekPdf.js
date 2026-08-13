import {
  PDF_COVER_TYPOGRAPHY,
  PDF_DEFAULT_TACTICAL_FONT_DESIGN,
  PDF_TACTICAL_FONT_DESIGNS,
  buildEditalLogoCandidates,
  buildEditalLogoFallbackLabel,
} from './EditalVerticalizadoPdf.js';

const PAGE = { width: 297, height: 210 };
const LAYOUT = {
  marginX: 8,
  contentTop: 45,
  contentBottom: 199,
  columns: 7,
  columnGap: 1.5,
  dayHeaderHeight: 13,
  dayPadding: 1.2,
  taskGap: 0.8,
};

const COLORS = {
  ink: [24, 24, 27],
  charcoal: [39, 39, 42],
  muted: [113, 113, 122],
  line: [212, 212, 216],
  soft: [244, 244, 245],
  paper: [250, 250, 250],
  red: [220, 38, 38],
  redDark: [127, 29, 29],
  redSoft: [254, 242, 242],
  white: [255, 255, 255],
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

const getImageDimensions = (dataUrl) => new Promise((resolve) => {
  if (typeof Image === 'undefined') {
    resolve({ width: 1, height: 1 });
    return;
  }
  const image = new Image();
  image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
  image.onerror = () => resolve({ width: 1, height: 1 });
  image.src = dataUrl;
});

const resolvePdfImage = async (source) => {
  if (!source) return null;
  try {
    const descriptor = typeof source === 'object' ? source : { src: source };
    let dataUrl = descriptor.dataUrl || descriptor.src;
    if (!dataUrl) return null;
    if (!/^data:/i.test(dataUrl)) {
      const response = await fetch(absoluteAssetUrl(dataUrl), { mode: 'cors', cache: 'force-cache' });
      if (!response.ok) return null;
      const blob = await response.blob();
      if (blob.type && !blob.type.startsWith('image/')) return null;
      dataUrl = await blobToDataUrl(blob);
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

const resolveFirstPdfImage = async (sources = []) => {
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

const registerDisplayFont = async (doc, providedSource = null) => {
  const font = PDF_TACTICAL_FONT_DESIGNS.find((item) => item.id === PDF_DEFAULT_TACTICAL_FONT_DESIGN);
  if (!font) return null;
  try {
    let base64 = providedSource?.base64 || providedSource;
    if (!base64) {
      const response = await fetch(absoluteAssetUrl(font.assetUrl), { cache: 'force-cache' });
      if (!response.ok) throw new Error('Fonte indisponivel');
      base64 = arrayBufferToBase64(await response.arrayBuffer());
    }
    doc.addFileToVFS(font.fileName, base64);
    doc.addFont(font.fileName, font.family, 'normal');
    return font.family;
  } catch {
    return null;
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

const getTaskMinutes = (task) => Math.max(0, Number(
  task?.tempoPlanejadoMinutos ?? task?.tempoMinutos ?? task?.minutosEstudo ?? 0
) || 0);

const normalizeText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const isReviewTask = (task, label = '') => Boolean(
  task?.isRevisao
  || task?.isRevisaoAuto
  || task?.isConsolidada
  || /revis/i.test(normalizeText(`${task?.tipo || ''} ${label}`))
);

const sanitizeHex = (value, fallback = '#dc2626') => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : fallback;
};

const hexToRgb = (hex) => {
  const value = sanitizeHex(hex).slice(1);
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
};

const mixWithWhite = (rgb, amount = 0.9) => rgb.map((channel) => Math.round(channel + ((255 - channel) * amount)));

const formatDurationFallback = (minutes) => {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  if (hours && rest) return `${hours}h ${String(rest).padStart(2, '0')}min`;
  if (hours) return `${hours}h`;
  return `${rest}min`;
};

const getColumnWidth = () => (
  (PAGE.width - (LAYOUT.marginX * 2) - (LAYOUT.columnGap * (LAYOUT.columns - 1))) / LAYOUT.columns
);

const ellipsizeLastLine = (line) => {
  const value = String(line || '').trim();
  if (!value) return value;
  return `${value.replace(/[.,;:!?\s]+$/, '')}\u2026`;
};

const splitLimited = (doc, text, width, maxLines) => {
  const lines = doc.splitTextToSize(String(text || ''), width);
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  visible[visible.length - 1] = ellipsizeLastLine(visible[visible.length - 1]);
  return visible;
};

const setDisplayFont = (doc, displayFont, fallbackStyle = 'bold') => {
  doc.setFont(displayFont || PDF_COVER_TYPOGRAPHY.headingFont, displayFont ? 'normal' : fallbackStyle);
};

export const prepareCronogramaWeekPdfModel = ({
  cronograma = {},
  weekDates = [],
  weekOffset = 0,
  tarefasPorDia = {},
  formatarDuracao = formatDurationFallback,
  getDisciplineColorForSlot = () => null,
  getNomeDisc = (task) => task?.disciplinaNome || task?.disciplina || 'Disciplina',
  getTextoAssunto = (task) => task?.assunto || 'Assunto nao informado',
  getLabelTipo = () => '',
  includeSubjects = true,
  meses = [],
  diasLongo = [],
} = {}) => {
  const dates = Array.isArray(weekDates) ? weekDates.filter((date) => date instanceof Date && !Number.isNaN(date.getTime())) : [];
  const days = dates.map((date) => {
    const dayIndex = date.getDay();
    const tasks = (tarefasPorDia?.[dayIndex] || []).map((task, taskIndex) => {
      const rawType = getLabelTipo?.(task) || task?.tipo || '';
      const review = isReviewTask(task, rawType);
      const colorData = getDisciplineColorForSlot?.(task);
      return {
        id: task?.id || task?.slotId || `${dayIndex}-${taskIndex}`,
        discipline: String(getNomeDisc?.(task) || 'Disciplina'),
        subject: includeSubjects
          ? String(getTextoAssunto?.(task, cronograma) || task?.assunto || 'Assunto nao informado')
          : '',
        duration: String(formatarDuracao?.(getTaskMinutes(task)) || formatDurationFallback(getTaskMinutes(task))),
        minutes: getTaskMinutes(task),
        type: review ? 'REVISAO' : 'ESTUDO',
        review,
        color: sanitizeHex(colorData?.hex || task?.cor?.hex || task?.cor || '#dc2626'),
      };
    });
    return {
      dayIndex,
      dayName: String(diasLongo?.[dayIndex] || new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date)),
      dateLabel: `${String(date.getDate()).padStart(2, '0')} ${String(meses?.[date.getMonth()] || new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date)).toUpperCase()}`,
      totalMinutes: tasks.reduce((sum, task) => sum + task.minutes, 0),
      tasks,
    };
  });
  const allTasks = days.flatMap((day) => day.tasks);
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const formatPeriodDate = (date, includeYear = false) => {
    if (!date) return '';
    const month = String(meses?.[date.getMonth()] || new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date)).toUpperCase();
    return `${String(date.getDate()).padStart(2, '0')} ${month}${includeYear ? ` ${date.getFullYear()}` : ''}`;
  };
  const period = firstDate && lastDate
    ? `${formatPeriodDate(firstDate, firstDate.getFullYear() !== lastDate.getFullYear())} - ${formatPeriodDate(lastDate, true)}`
    : 'PERIODO NAO INFORMADO';

  return {
    editalName: String(cronograma.editalNome || cronograma.titulo || cronograma.nome || 'Edital'),
    scheduleName: String(cronograma.nome || 'Cronograma semanal'),
    weekLabel: `SEMANA ${Math.max(0, Number(weekOffset) || 0) + 1}`,
    period,
    totalMinutes: allTasks.reduce((sum, task) => sum + task.minutes, 0),
    totalBlocks: allTasks.length,
    totalReviews: allTasks.filter((task) => task.review).length,
    days,
  };
};

const measureTaskCard = (doc, task, cardWidth, displayFont, heightLimit = Infinity) => {
  const textWidth = cardWidth - 5.2;
  setDisplayFont(doc, displayFont);
  doc.setFontSize(5.5);
  const disciplineLines = splitLimited(doc, task.discipline.toUpperCase(), textWidth, heightLimit < 16 ? 1 : 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.2);
  const maxSubjectLines = !task.subject ? 0 : heightLimit < 15 ? 1 : heightLimit < 19 ? 2 : 3;
  const subjectLines = maxSubjectLines ? splitLimited(doc, task.subject, textWidth, maxSubjectLines) : [];
  const naturalHeight = 9 + (disciplineLines.length * 2.7) + (subjectLines.length * 2.45);
  const height = Math.min(naturalHeight, heightLimit);
  return { height, disciplineLines, subjectLines };
};

export const paginateCronogramaWeekPdf = (doc, model, displayFont = null) => {
  const columnWidth = getColumnWidth();
  const availableTasksHeight = (LAYOUT.contentBottom - LAYOUT.contentTop)
    - LAYOUT.dayHeaderHeight
    - (LAYOUT.dayPadding * 2);
  const days = model.days.slice(0, 7).map((day) => {
    if (day.tasks.length === 0) return { ...day, tasks: [] };
    const heightLimit = (
      availableTasksHeight - (LAYOUT.taskGap * Math.max(0, day.tasks.length - 1))
    ) / day.tasks.length;
    return {
      ...day,
      tasks: day.tasks.map((task) => ({
        ...task,
        measured: measureTaskCard(
          doc,
          task,
          columnWidth - (LAYOUT.dayPadding * 2),
          displayFont,
          heightLimit,
        ),
      })),
    };
  });
  return [days];
};

const drawPanelShadow = (doc, x, y, width, height, radius = 2.5) => {
  doc.setFillColor(228, 228, 231);
  doc.roundedRect(x + 0.7, y + 0.9, width, height, radius, radius, 'F');
};

const drawLogoFallback = (doc, label, x, y, width, height, displayFont) => {
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, width, height, 2, 2, 'S');
  doc.setTextColor(...COLORS.redDark);
  setDisplayFont(doc, displayFont);
  doc.setFontSize(String(label).length <= 5 ? 11 : 8.5);
  doc.text(String(label || 'EDITAL').slice(0, 8).toUpperCase(), x + width / 2, y + height / 2 + 1, { align: 'center' });
};

const drawTacticalBackground = (doc) => {
  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
  doc.setDrawColor(238, 238, 240);
  doc.setLineWidth(0.12);
  for (let x = 8; x < PAGE.width; x += 8) doc.line(x, 0, x, PAGE.height);
  for (let y = 8; y < PAGE.height; y += 8) doc.line(0, y, PAGE.width, y);
  doc.setFillColor(...COLORS.red);
  doc.rect(0, 0, PAGE.width, 2.2, 'F');
  doc.setFillColor(...COLORS.charcoal);
  doc.rect(PAGE.width - 2.2, 0, 2.2, PAGE.height, 'F');
  doc.setFillColor(...COLORS.red);
  doc.rect(PAGE.width - 4.2, 0, 2, PAGE.height, 'F');
};

const drawMetaChip = (doc, { x, y, width, label, value, emphasis = false }) => {
  doc.setFillColor(...(emphasis ? COLORS.redSoft : COLORS.soft));
  doc.setDrawColor(...(emphasis ? [254, 202, 202] : COLORS.line));
  doc.setLineWidth(0.22);
  doc.roundedRect(x, y, width, 8.5, 1.8, 1.8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  doc.setTextColor(...(emphasis ? COLORS.redDark : COLORS.muted));
  doc.text(label.toUpperCase(), x + 2.2, y + 3.2);
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.ink);
  doc.text(String(value), x + 2.2, y + 6.7);
};

const drawPageHeader = (doc, context) => {
  const { model, editalLogo, editalLogoLabel, systemLogo, displayFont } = context;
  const y = 5;
  const height = 33;

  drawPanelShadow(doc, 8, y, 73, height, 3);
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(8, y, 73, height, 3, 3, 'F');
  doc.setFillColor(...COLORS.red);
  doc.roundedRect(8, y, 2.2, height, 1.1, 1.1, 'F');
  if (!drawContainedImage(doc, editalLogo, 13, 9, 24, 24, 'cronograma-edital-logo')) {
    drawLogoFallback(doc, editalLogoLabel, 13, 9, 24, 24, displayFont);
  }
  doc.setDrawColor(...COLORS.line);
  doc.line(40, 9, 40, 33);
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.3);
  doc.text('EDITAL', 44, 13);
  doc.setTextColor(...COLORS.ink);
  setDisplayFont(doc, displayFont);
  doc.setFontSize(9.2);
  const editalLines = splitLimited(doc, model.editalName.toUpperCase(), 32, 3);
  doc.text(editalLines, 44, editalLines.length > 2 ? 18 : 20, { lineHeightFactor: 0.94 });

  drawPanelShadow(doc, 85, y, 155, height, 3);
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(85, y, 155, height, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.4);
  doc.setTextColor(...COLORS.red);
  doc.text('PLANEJAMENTO DE ESTUDOS', 162.5, 10.8, { align: 'center' });
  setDisplayFont(doc, displayFont);
  doc.setFontSize(17.5);
  doc.setTextColor(...COLORS.ink);
  doc.text('CRONOGRAMA', 159.5, 20.3, { align: 'right' });
  doc.setTextColor(...COLORS.red);
  doc.text('SEMANAL', 163, 20.3);
  drawMetaChip(doc, { x: 91, y: 24.5, width: 48, label: model.weekLabel, value: model.period });
  drawMetaChip(doc, { x: 142.5, y: 24.5, width: 41, label: 'Carga horaria', value: context.formatDuration(model.totalMinutes), emphasis: true });
  drawMetaChip(doc, { x: 187, y: 24.5, width: 22, label: 'Blocos', value: model.totalBlocks });
  drawMetaChip(doc, { x: 212.5, y: 24.5, width: 21.5, label: 'Revisoes', value: model.totalReviews });

  drawPanelShadow(doc, 244, y, 43, height, 3);
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(244, y, 43, height, 3, 3, 'F');
  if (!drawContainedImage(doc, systemLogo, 252, 8, 27, 27, 'cronograma-system-logo')) {
    drawLogoFallback(doc, 'MODOQAP', 251, 8, 29, 26, displayFont);
  }
};

const drawTaskCard = (doc, task, x, y, width, displayFont) => {
  const { height, disciplineLines, subjectLines } = task.measured || measureTaskCard(doc, task, width, displayFont);
  const accent = hexToRgb(task.color);
  const background = task.review ? COLORS.redSoft : mixWithWhite(accent, 0.94);
  const compact = height < 16;
  const veryCompact = height < 13;

  doc.setFillColor(228, 228, 231);
  doc.roundedRect(x + 0.35, y + 0.42, width, height, 1.4, 1.4, 'F');
  doc.setFillColor(...background);
  doc.setDrawColor(...(task.review ? [254, 202, 202] : mixWithWhite(accent, 0.7)));
  doc.setLineWidth(0.22);
  doc.roundedRect(x, y, width, height, 1.4, 1.4, 'FD');
  doc.setFillColor(...(task.review ? COLORS.red : accent));
  doc.roundedRect(x, y, 1.35, height, 0.65, 0.65, 'F');

  const checkSize = compact ? 3.3 : 4;
  const toolsY = y + (compact ? 1.4 : 1.8);
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.charcoal);
  doc.setLineWidth(0.32);
  doc.roundedRect(x + 2.4, toolsY, checkSize, checkSize, 0.45, 0.45, 'FD');

  doc.setFont('helvetica', 'bold');
  if (task.review) {
    const badgeWidth = compact ? 12.5 : 14.5;
    doc.setFillColor(...COLORS.red);
    doc.roundedRect(x + 7, toolsY, badgeWidth, checkSize, 0.8, 0.8, 'F');
    doc.setFontSize(compact ? 3.8 : 4.4);
    doc.setTextColor(...COLORS.white);
    doc.text('REVISAO', x + 7 + badgeWidth / 2, toolsY + checkSize * 0.69, { align: 'center' });
  }

  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...(task.review ? COLORS.red : accent));
  const durationWidth = compact ? 10.8 : 12.2;
  doc.roundedRect(x + width - durationWidth - 2, toolsY, durationWidth, checkSize, 0.8, 0.8, 'FD');
  doc.setTextColor(...(task.review ? COLORS.redDark : accent));
  doc.setFontSize(veryCompact ? 4.7 : compact ? 5.4 : 6.2);
  doc.text(task.duration, x + width - 2 - durationWidth / 2, toolsY + checkSize * 0.69, { align: 'center' });

  setDisplayFont(doc, displayFont);
  doc.setFontSize(veryCompact ? 4.2 : compact ? 4.8 : 5.5);
  doc.setTextColor(...(task.review ? COLORS.redDark : COLORS.ink));
  const disciplineY = toolsY + checkSize + (veryCompact ? 1.5 : 2.2);
  doc.text(disciplineLines, x + 2.4, disciplineY, { lineHeightFactor: 0.9 });
  const disciplineStep = veryCompact ? 2.1 : compact ? 2.35 : 2.7;
  const subjectY = disciplineY + (disciplineLines.length * disciplineStep) + (compact ? 0.25 : 0.7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(veryCompact ? 3.7 : compact ? 4.2 : 5.1);
  doc.setTextColor(...COLORS.charcoal);
  if (subjectLines.length) doc.text(subjectLines, x + 2.4, subjectY, { lineHeightFactor: 1.02 });
  return height;
};

const drawEmptyDay = (doc, x, y, width, height, displayFont) => {
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(...COLORS.line);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.roundedRect(x, y, width, Math.min(height, 33), 2, 2, 'FD');
  doc.setLineDashPattern([], 0);
  setDisplayFont(doc, displayFont);
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.muted);
  doc.text('DIA LIVRE', x + width / 2, y + 13, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  doc.text('Sem blocos planejados', x + width / 2, y + 19, { align: 'center' });
};

const drawDayColumn = (doc, chunk, columnIndex, context) => {
  const width = getColumnWidth();
  const x = LAYOUT.marginX + (columnIndex * (width + LAYOUT.columnGap));
  const y = LAYOUT.contentTop;
  const height = LAYOUT.contentBottom - LAYOUT.contentTop;
  drawPanelShadow(doc, x, y, width, height, 2.5);
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(x, y, width, height, 2.5, 2.5, 'F');

  doc.setFillColor(...COLORS.charcoal);
  doc.roundedRect(x, y, width, LAYOUT.dayHeaderHeight, 2.5, 2.5, 'F');
  doc.setFillColor(...COLORS.red);
  doc.rect(x, y + LAYOUT.dayHeaderHeight - 1.1, width, 1.1, 'F');
  context.setDisplayFont();
  doc.setFontSize(6.2);
  doc.setTextColor(...COLORS.white);
  const dayTitle = chunk.dayName.toUpperCase();
  const fittedDayTitle = splitLimited(doc, dayTitle, width - 5, 1);
  doc.text(fittedDayTitle, x + 2.2, y + 5.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.9);
  doc.setTextColor(212, 212, 216);
  doc.text(chunk.dateLabel, x + 2.2, y + 10.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(...COLORS.white);
  doc.text(context.formatDuration(chunk.totalMinutes), x + width - 2.2, y + 9.5, { align: 'right' });

  let taskY = y + LAYOUT.dayHeaderHeight + LAYOUT.dayPadding;
  const taskWidth = width - (LAYOUT.dayPadding * 2);
  if (chunk.tasks.length === 0) {
    drawEmptyDay(doc, x + LAYOUT.dayPadding, taskY, taskWidth, height - LAYOUT.dayHeaderHeight - 4, context.displayFont);
    return;
  }
  chunk.tasks.forEach((task) => {
    const cardHeight = drawTaskCard(doc, task, x + LAYOUT.dayPadding, taskY, taskWidth, context.displayFont);
    taskY += cardHeight + LAYOUT.taskGap;
  });
};

const drawFooter = (doc, { pageNumber, pageCount, model }) => {
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.2);
  doc.line(8, 202, 289, 202);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(...COLORS.ink);
  const left = doc.splitTextToSize(model.scheduleName.toUpperCase(), 80)[0] || 'CRONOGRAMA SEMANAL';
  doc.text(left, 8, 206);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.text('MODOQAP - PLANEJAMENTO SEMANAL', PAGE.width / 2, 206, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.red);
  doc.text(`PAGINA ${String(pageNumber).padStart(2, '0')} / ${String(pageCount).padStart(2, '0')}`, 289, 206, { align: 'right' });
};

export const buildCronogramaWeekPdfFileName = ({ cronograma = {}, weekOffset = 0 } = {}) => {
  const source = normalizeText(cronograma.nome || cronograma.editalNome || 'cronograma')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'cronograma';
  return `${source}-semana-${Math.max(0, Number(weekOffset) || 0) + 1}.pdf`;
};

export const createCronogramaWeekPdf = async ({
  cronograma,
  weekDates,
  weekOffset,
  tarefasPorDia,
  dynamicLogo,
  formatarDuracao = formatDurationFallback,
  getDisciplineColorForSlot,
  getNomeDisc,
  getTextoAssunto,
  getLabelTipo,
  includeSubjects = true,
  meses,
  diasLongo,
  logos = {},
  fontSources = {},
} = {}) => {
  if (!cronograma || !Array.isArray(weekDates) || weekDates.length === 0) {
    throw new Error('Dados da semana indisponiveis para gerar o PDF.');
  }

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  const model = prepareCronogramaWeekPdfModel({
    cronograma,
    weekDates,
    weekOffset,
    tarefasPorDia,
    formatarDuracao,
    getDisciplineColorForSlot,
    getNomeDisc,
    getTextoAssunto,
    getLabelTipo,
    includeSubjects,
    meses,
    diasLongo,
  });
  const edital = { ...cronograma, nome: model.editalName, titulo: model.editalName, editalNome: model.editalName };
  const [editalLogo, systemLogo, displayFont] = await Promise.all([
    resolveFirstPdfImage([
      logos.edital,
      ...buildEditalLogoCandidates({ edital, providedLogo: dynamicLogo }),
    ]),
    resolvePdfImage(logos.system || '/logoModoQAP.png'),
    registerDisplayFont(doc, fontSources[PDF_DEFAULT_TACTICAL_FONT_DESIGN]),
  ]);
  const pages = paginateCronogramaWeekPdf(doc, model, displayFont);
  const context = {
    model,
    editalLogo,
    editalLogoLabel: buildEditalLogoFallbackLabel(edital),
    systemLogo,
    displayFont,
    formatDuration: (minutes) => formatarDuracao?.(minutes) || formatDurationFallback(minutes),
    setDisplayFont: () => setDisplayFont(doc, displayFont),
  };

  doc.setProperties({
    title: `${model.scheduleName} - ${model.weekLabel}`,
    subject: `Cronograma semanal - ${model.period}`,
    author: 'ModoQAP',
    creator: 'ModoQAP',
    keywords: 'cronograma semanal, planejamento, estudos, concurso',
  });

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) doc.addPage('a4', 'landscape');
    drawTacticalBackground(doc);
    drawPageHeader(doc, context);
    page.forEach((chunk, columnIndex) => drawDayColumn(doc, chunk, columnIndex, context));
    drawFooter(doc, { pageNumber: pageIndex + 1, pageCount: pages.length, model });
  });
  doc.setPage(1);
  return doc;
};

const writeLoadingState = (targetWindow) => {
  targetWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Gerando cronograma semanal</title><style>body{margin:0;display:grid;min-height:100vh;place-items:center;background:#fafafa;color:#18181b;font:700 14px Arial,sans-serif}.loader{padding:24px 30px;border:1px solid #e4e4e7;border-top:3px solid #dc2626;border-radius:14px;background:#fff;box-shadow:0 16px 40px rgba(24,24,27,.1)}</style></head><body><div class="loader">Gerando cronograma semanal...</div></body></html>`);
  targetWindow.document.close();
};

export const openCronogramaWeekPdf = async (options = {}) => {
  if (!options.cronograma || !Array.isArray(options.weekDates) || options.weekDates.length === 0) return;
  const targetWindow = window.open('', '_blank');
  if (!targetWindow) {
    options.showToast?.('Nao foi possivel abrir a aba do PDF. Verifique o bloqueio de pop-ups.');
    return;
  }
  writeLoadingState(targetWindow);

  try {
    const doc = await createCronogramaWeekPdf(options);
    const pdfUrl = URL.createObjectURL(doc.output('blob'));
    targetWindow.location.replace(pdfUrl);
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 120000);
  } catch (error) {
    console.error('Erro ao gerar PDF do cronograma:', error);
    options.showToast?.('Nao foi possivel gerar o PDF do cronograma.');
    targetWindow.close();
  }
};
