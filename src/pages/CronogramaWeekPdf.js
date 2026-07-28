const A4 = {
  width: 297,
  height: 210,
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const absoluteAssetUrl = (src) => {
  if (!src) return '';
  if (/^(data:|blob:|https?:)/i.test(src)) return src;
  return new URL(src, window.location.origin).href;
};

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const imageSourceToDataUrl = async (src) => {
  if (!src || /^data:/i.test(src)) return src || '';
  const response = await fetch(absoluteAssetUrl(src), { mode: 'cors', cache: 'force-cache' });
  if (!response.ok) throw new Error(`Imagem nao encontrada: ${src}`);
  return blobToDataUrl(await response.blob());
};

const resolvePdfImageSource = async (src, fallback) => {
  const candidates = [src, fallback].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return await imageSourceToDataUrl(candidate);
    } catch {
      // Tenta o proximo candidato para evitar quebrar a geracao do PDF.
    }
  }
  return candidates.length ? absoluteAssetUrl(candidates[candidates.length - 1]) : '';
};

const getTaskMinutes = (tarefa) => Number(
  tarefa?.tempoPlanejadoMinutos ?? tarefa?.tempoMinutos ?? tarefa?.minutosEstudo ?? 0
);

const sanitizeHex = (value, fallback = '#dc2626') => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  return fallback;
};

const hexToRgb = (hex) => {
  const value = sanitizeHex(hex).slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
};

const rgbaFromHex = (hex, alpha) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const waitForRender = (targetWindow) => new Promise((resolve) => {
  const finish = async () => {
    try {
      await targetWindow.document.fonts?.ready;
    } catch {
      // Font readiness is best-effort in the generated PDF tab.
    }

    const images = Array.from(targetWindow.document.images || []);
    await Promise.all(images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((done) => {
        img.onload = done;
        img.onerror = done;
      });
    }));

    targetWindow.requestAnimationFrame(() => {
      targetWindow.requestAnimationFrame(resolve);
    });
  };

  if (targetWindow.document.readyState === 'complete') {
    finish();
  } else {
    targetWindow.addEventListener('load', finish, { once: true });
  }
});

export const buildCronogramaWeekPdfHtml = ({
  cronograma,
  weekDates,
  weekOffset,
  tarefasPorDia,
  dynamicLogo,
  editalLogoSrc,
  systemLogoSrc,
  formatarDuracao,
  getDisciplineColorForSlot,
  getNomeDisc,
  getTextoAssunto,
  getLabelTipo,
  meses,
  diasLongo,
}) => {
  const systemLogo = systemLogoSrc || absoluteAssetUrl('/logoModoQAP.png');
  const editalLogo = editalLogoSrc || absoluteAssetUrl(dynamicLogo);
  const weekLabel = `Semana ${weekOffset + 1}`;
  const periodo = `${weekDates[0].getDate()} ${meses[weekDates[0].getMonth()]} - ${weekDates[6].getDate()} ${meses[weekDates[6].getMonth()]} ${weekDates[6].getFullYear()}`;
  const editalNome = cronograma.editalNome || cronograma.nome || 'Edital';
  const allTasks = Object.values(tarefasPorDia).flat();
  const totalBlocos = allTasks.length;
  const totalConcluidos = allTasks.filter((tarefa) => tarefa.concluido).length;
  const totalMinutos = allTasks.reduce((acc, tarefa) => acc + getTaskMinutes(tarefa), 0);
  const totalRevisoes = allTasks.filter((tarefa) => (
    tarefa.isRevisao || tarefa.isRevisaoAuto || tarefa.isConsolidada
  )).length;
  const maxTasksByDay = Math.max(...weekDates.map((date) => (tarefasPorDia[date.getDay()] || []).length), 0);
  const densityClass = maxTasksByDay > 7 ? 'density-ultra' : maxTasksByDay > 5 ? 'density-tight' : 'density-normal';

  const statHtml = [
    ['Blocos', totalBlocos],
    ['Carga', formatarDuracao(totalMinutos)],
    ['Revisoes', totalRevisoes],
    ['Concluidos', `${totalConcluidos}/${totalBlocos}`],
  ].map(([label, value]) => `
    <div class="stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join('');

  const daysHtml = weekDates.map((date) => {
    const dia = date.getDay();
    const tarefas = tarefasPorDia[dia] || [];
    const minutosDia = tarefas.reduce((acc, tarefa) => acc + getTaskMinutes(tarefa), 0);
    const concluidosDia = tarefas.filter((tarefa) => tarefa.concluido).length;
    const dayDone = tarefas.length > 0 && concluidosDia === tarefas.length;
    const taskHtml = tarefas.length > 0
      ? tarefas.map((tarefa) => {
          const colorData = getDisciplineColorForSlot(tarefa);
          const color = sanitizeHex(colorData?.hex || tarefa.cor?.hex || tarefa.cor || '#dc2626');
          const colorSoft = rgbaFromHex(color, 0.13);
          const colorSofter = rgbaFromHex(color, 0.055);
          const titulo = getNomeDisc(tarefa);
          const assunto = getTextoAssunto?.(tarefa, cronograma) || tarefa.assunto || 'Sessao de estudo';
          const tipo = getLabelTipo?.(tarefa) || (tarefa.isRevisao || tarefa.isRevisaoAuto ? 'Revisao' : 'Teoria');
          const tempo = formatarDuracao(getTaskMinutes(tarefa));
          const concluido = Boolean(tarefa.concluido);

          return `
            <article class="task ${concluido ? 'done' : ''}" style="--accent:${escapeHtml(color)};--accent-soft:${escapeHtml(colorSoft)};--accent-softer:${escapeHtml(colorSofter)}">
              <div class="task-tools">
                <span class="task-check">${concluido ? '&#10003;' : ''}</span>
                <span class="task-status">${concluido ? 'Concluido' : 'Pendente'}</span>
                <span class="task-time">${escapeHtml(tempo)}</span>
              </div>
              <strong class="task-title">${escapeHtml(titulo)}</strong>
              <span class="task-type">${escapeHtml(tipo)}</span>
              <p>${escapeHtml(assunto)}</p>
            </article>
          `;
        }).join('')
      : '<div class="empty"><b>Dia livre</b><span>Sem blocos planejados</span></div>';

    return `
      <section class="day ${dayDone ? 'day-done' : ''}">
        <header class="day-header">
          <div>
            <strong>${escapeHtml(diasLongo[dia])}</strong>
            <span>${date.getDate()} ${escapeHtml(meses[date.getMonth()])}</span>
          </div>
          <div class="day-total">
            <b>${escapeHtml(formatarDuracao(minutosDia))}</b>
            <em>${escapeHtml(`${concluidosDia}/${tarefas.length}`)}</em>
          </div>
        </header>
        <div class="tasks">${taskHtml}</div>
      </section>
    `;
  }).join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <base href="${escapeHtml(window.location.origin)}/">
        <title>${escapeHtml(cronograma.nome || 'Cronograma')} - ${escapeHtml(weekLabel)}</title>
        <style>
          @page { size: A4 landscape; margin: 0; }
          * { box-sizing: border-box; }
          html,
          body {
            width: ${A4.width}mm;
            height: ${A4.height}mm;
            margin: 0;
            overflow: hidden;
            background: #f3f5f8;
            color: #18181b;
            font-family: Inter, Arial, sans-serif;
          }
          .sheet {
            width: ${A4.width}mm;
            height: ${A4.height}mm;
            overflow: hidden;
            background: #f6f8fb;
            border: 1.8mm solid #ffffff;
          }
          .accent-strip {
            height: 1.6mm;
            background: linear-gradient(90deg, #f59e0b 0%, #10b981 44%, #06b6d4 72%, #ef4444 100%);
          }
          .topbar {
            display: grid;
            grid-template-columns: 47mm 1fr 30mm;
            gap: 2mm;
            height: 35mm;
            padding: 2.2mm 2.2mm 1.7mm;
          }
          .brand-card,
          .system-card,
          .title-area {
            min-width: 0;
            overflow: hidden;
            border-radius: 2mm;
            border: 1px solid #e3e7ef;
            background: #ffffff;
            box-shadow: 0 8px 22px rgba(15, 23, 42, .07);
          }
          .brand-card {
            display: grid;
            grid-template-rows: 22mm 7mm;
            border-top: 1.15mm solid #10b981;
          }
          .edital-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.4mm 3mm .8mm;
          }
          .edital-logo img {
            max-width: 38mm;
            max-height: 19.3mm;
            object-fit: contain;
          }
          .logo-fallback {
            display: flex;
            height: 16mm;
            width: 33mm;
            align-items: center;
            justify-content: center;
            border: 1px dashed #cbd5e1;
            color: #64748b;
            font-size: 6px;
            font-weight: 950;
            letter-spacing: .14em;
            text-transform: uppercase;
          }
          .edital-name {
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 0;
            border-top: 1px solid #e4e7ec;
            color: #111827;
            padding: .7mm 2mm .8mm;
            font-size: 6.8px;
            font-weight: 950;
            line-height: 1.05;
            text-align: center;
            text-transform: uppercase;
            overflow-wrap: anywhere;
          }
          .title-area {
            display: grid;
            grid-template-rows: 6.5mm 10mm 5mm 8mm;
            padding: 2mm 4mm;
            border-top: 1.15mm solid #ef4444;
            background: linear-gradient(180deg, #ffffff, #fbfcfe);
          }
          .kicker {
            display: flex;
            align-items: center;
            justify-content: center;
            color: #047857;
            font-size: 6px;
            font-weight: 950;
            letter-spacing: .24em;
            line-height: 1;
            text-transform: uppercase;
          }
          .title-area h1 {
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 0;
            margin: 0;
            color: #111827;
            font-size: 23px;
            font-weight: 950;
            line-height: 1;
            letter-spacing: 0;
            text-align: center;
            text-transform: uppercase;
            white-space: nowrap;
          }
          .title-area h1 span {
            margin-left: 2.2mm;
            color: #dc2626;
          }
          .period {
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 0;
            border-top: 1px solid #e4e7ec;
            color: #64748b;
            font-size: 6.5px;
            font-weight: 950;
            letter-spacing: .16em;
            line-height: 1;
            text-align: center;
            text-transform: uppercase;
            white-space: nowrap;
          }
          .stats {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 1.4mm;
          }
          .stat {
            display: flex;
            min-width: 0;
            flex-direction: column;
            justify-content: center;
            border: 1px solid #e5e7eb;
            border-left: 1mm solid #10b981;
            background: #f8fafc;
            padding: 1mm 1.45mm;
          }
          .stat span {
            color: #047857;
            font-size: 5.35px;
            font-weight: 950;
            letter-spacing: .12em;
            line-height: 1;
            text-transform: uppercase;
            white-space: nowrap;
          }
          .stat strong {
            margin-top: .8mm;
            color: #111827;
            font-size: 10px;
            font-weight: 950;
            line-height: 1;
            white-space: nowrap;
          }
          .system-card {
            display: flex;
            align-items: center;
            justify-content: center;
            border-top: 1.15mm solid #ef4444;
            padding: 2mm;
          }
          .system-card img {
            width: 23.5mm;
            height: 23.5mm;
            object-fit: contain;
          }
          .week {
            display: grid;
            grid-template-columns: repeat(7, minmax(0, 1fr));
            gap: 1.35mm;
            height: 169mm;
            padding: .5mm 2.2mm 2.2mm;
          }
          .day {
            min-width: 0;
            overflow: hidden;
            border-radius: 2mm;
            border: 1px solid #d8dde6;
            background: #ffffff;
            box-shadow: 0 8px 16px rgba(15, 23, 42, .045);
          }
          .day-done { border-color: #93e3b3; }
          .day-header {
            display: flex;
            height: 13mm;
            align-items: center;
            justify-content: space-between;
            gap: 1.4mm;
            border-bottom: 1px solid #e5e7eb;
            background: linear-gradient(90deg, #ffffff 0%, #f8fafc 74%, #eef2f7 100%);
            color: #111827;
            padding: 1.8mm 1.9mm 1.6mm;
          }
          .day-done .day-header {
            background: linear-gradient(90deg, #ecfdf5 0%, #ffffff 72%);
          }
          .day-header strong {
            display: block;
            max-width: 23mm;
            overflow: hidden;
            color: #111827;
            font-size: 7.8px;
            font-weight: 950;
            line-height: 1;
            text-overflow: ellipsis;
            text-transform: uppercase;
            white-space: nowrap;
          }
          .day-header span {
            display: block;
            margin-top: 1.2mm;
            color: #64748b;
            font-size: 5.8px;
            font-weight: 900;
            line-height: 1;
            text-transform: uppercase;
            white-space: nowrap;
          }
          .day-total {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: .8mm;
          }
          .day-total b {
            color: #111827;
            font-size: 7.2px;
            font-weight: 950;
            line-height: 1;
            white-space: nowrap;
          }
          .day-total em {
            border: 1px solid #dbe2eb;
            background: #f8fafc;
            color: #334155;
            padding: .65mm 1.2mm;
            font-size: 5.6px;
            font-style: normal;
            font-weight: 950;
            line-height: 1;
            white-space: nowrap;
          }
          .tasks {
            display: flex;
            flex-direction: column;
            gap: 1.25mm;
            padding: 1.5mm;
          }
          .task {
            position: relative;
            min-height: 22mm;
            overflow: hidden;
            border: 1px solid rgba(15,23,42,.12);
            border-left: 1.25mm solid var(--accent, #dc2626);
            border-radius: 1.8mm;
            background:
              linear-gradient(90deg, var(--accent-softer), #ffffff 34%),
              #fff;
            padding: 1.55mm 1.45mm 1.4mm;
          }
          .task.done {
            border-color: #9ce7b8;
            border-left-color: #16a34a;
            background: linear-gradient(90deg, rgba(22,163,74,.10), #ffffff 38%);
          }
          .task-tools {
            display: grid;
            grid-template-columns: 6.6mm minmax(0, 1fr) 12mm;
            gap: 1.2mm;
            align-items: center;
          }
          .task-check {
            display: inline-flex;
            width: 6.2mm;
            height: 6.2mm;
            align-items: center;
            justify-content: center;
            border: 1.25px solid #111827;
            background: #fff;
            color: #16a34a;
            font-size: 12px;
            font-weight: 950;
            line-height: 1;
          }
          .task-status {
            display: inline-flex;
            min-width: 0;
            width: fit-content;
            max-width: 100%;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(15,23,42,.08);
            background: var(--accent-soft);
            color: #18181b;
            padding: .68mm 1.1mm;
            font-size: 5.05px;
            font-weight: 950;
            letter-spacing: .08em;
            line-height: 1;
            text-transform: uppercase;
            white-space: nowrap;
          }
          .task.done .task-status {
            background: #dcfce7;
            color: #047857;
          }
          .task-time {
            display: inline-flex;
            min-width: 11mm;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--accent, #dc2626);
            background: #ffffff;
            color: var(--accent, #dc2626);
            padding: .82mm 1mm;
            font-size: 6px;
            font-weight: 950;
            line-height: 1;
            text-transform: uppercase;
            white-space: nowrap;
          }
          .task-title {
            display: block;
            margin-top: 1.35mm;
            min-width: 0;
            color: var(--accent, #18181b);
            font-size: 7.05px;
            font-weight: 950;
            line-height: 1.08;
            text-transform: uppercase;
            overflow-wrap: normal;
            word-break: normal;
            hyphens: none;
          }
          .task-type {
            display: block;
            margin-top: .8mm;
            overflow: hidden;
            color: #71717a;
            font-size: 5.3px;
            font-weight: 950;
            letter-spacing: .1em;
            line-height: 1;
            text-overflow: ellipsis;
            text-transform: uppercase;
            white-space: nowrap;
          }
          .task p {
            display: -webkit-box;
            margin: 1.2mm 0 0;
            overflow: hidden;
            color: #3f3f46;
            font-size: 6px;
            font-weight: 700;
            line-height: 1.18;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
          }
          .empty {
            display: flex;
            min-height: 28mm;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 1mm;
            border-radius: 1.8mm;
            border: 1px dashed #cbd5e1;
            background: #f8fafc;
            text-align: center;
            text-transform: uppercase;
          }
          .empty b {
            color: #64748b;
            font-size: 7px;
            font-weight: 950;
            letter-spacing: .12em;
            line-height: 1;
          }
          .empty span {
            color: #94a3b8;
            font-size: 5.4px;
            font-weight: 900;
            letter-spacing: .08em;
            line-height: 1;
          }
          .density-tight .task {
            min-height: 18mm;
            padding: 1.15mm 1.25mm 1.05mm;
          }
          .density-tight .task-title { font-size: 6.2px; margin-top: .9mm; }
          .density-tight .task-type { margin-top: .55mm; font-size: 4.9px; }
          .density-tight .task p {
            margin-top: .85mm;
            font-size: 5.35px;
            -webkit-line-clamp: 1;
          }
          .density-ultra .tasks { gap: .75mm; padding: 1mm; }
          .density-ultra .task {
            min-height: 14mm;
            padding: .85mm .9mm .8mm;
          }
          .density-ultra .task-tools { grid-template-columns: 5.4mm minmax(0, 1fr) 9.5mm; gap: .8mm; }
          .density-ultra .task-check {
            width: 5.1mm;
            height: 5.1mm;
            font-size: 10px;
          }
          .density-ultra .task-status { font-size: 4.3px; padding: .5mm .7mm; }
          .density-ultra .task-time { font-size: 4.8px; min-width: 9mm; }
          .density-ultra .task-title { font-size: 5.55px; margin-top: .6mm; }
          .density-ultra .task-type { display: none; }
          .density-ultra .task p {
            margin-top: .55mm;
            font-size: 4.9px;
            -webkit-line-clamp: 1;
          }
        </style>
      </head>
      <body>
        <div class="sheet ${escapeHtml(densityClass)}">
          <div class="accent-strip"></div>
          <header class="topbar">
            <div class="brand-card">
              <div class="edital-logo">
                ${editalLogo
                  ? `<img src="${escapeHtml(editalLogo)}" alt="Logo do edital">`
                  : '<div class="logo-fallback">Edital</div>'}
              </div>
              <div class="edital-name">${escapeHtml(editalNome)}</div>
            </div>
            <div class="title-area">
              <div class="kicker">Folha semanal de execucao</div>
              <h1>Cronograma <span>Semanal</span></h1>
              <div class="period">${escapeHtml(weekLabel)} - ${escapeHtml(periodo)}</div>
              <div class="stats">${statHtml}</div>
            </div>
            <div class="system-card">
              <img src="${escapeHtml(systemLogo)}" alt="ModoQAP">
            </div>
          </header>
          <main class="week">${daysHtml}</main>
        </div>
      </body>
    </html>
  `;
};

export const openCronogramaWeekPdf = async ({
  cronograma,
  weekDates,
  weekOffset,
  tarefasPorDia,
  dynamicLogo,
  showToast,
  formatarDuracao,
  getDisciplineColorForSlot,
  getNomeDisc,
  getTextoAssunto,
  getLabelTipo,
  meses,
  diasLongo,
}) => {
  if (!cronograma || weekDates.length === 0) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast?.('Nao foi possivel abrir a aba do PDF.');
    return;
  }

  const weekLabel = `Semana ${weekOffset + 1}`;
  const [editalLogoSrc, systemLogoSrc] = await Promise.all([
    resolvePdfImageSource(dynamicLogo, null),
    resolvePdfImageSource('/logoModoQAP.png', '/logoModoQAP.png'),
  ]);
  const html = buildCronogramaWeekPdfHtml({
    cronograma,
    weekDates,
    weekOffset,
    tarefasPorDia,
    dynamicLogo,
    editalLogoSrc,
    systemLogoSrc,
    formatarDuracao,
    getDisciplineColorForSlot,
    getNomeDisc,
    getTextoAssunto,
    getLabelTipo,
    meses,
    diasLongo,
  });

  printWindow.document.write(html);
  printWindow.document.close();

  try {
    await waitForRender(printWindow);
    const sheet = printWindow.document.querySelector('.sheet');
    if (!sheet) throw new Error('Folha do cronograma nao encontrada.');

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const canvas = await html2canvas(sheet, {
      scale: 2.8,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#f3f5f8',
      logging: false,
      width: sheet.scrollWidth,
      height: sheet.scrollHeight,
      windowWidth: sheet.scrollWidth,
      windowHeight: sheet.scrollHeight,
    });

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    pdf.setProperties({
      title: `${cronograma.nome || 'Cronograma'} - ${weekLabel}`,
      subject: 'Cronograma semanal',
      creator: 'ModoQAP',
    });

    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.98),
      'JPEG',
      0,
      0,
      A4.width,
      A4.height,
    );

    const pdfUrl = URL.createObjectURL(pdf.output('blob'));
    printWindow.location.href = pdfUrl;
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 120000);
  } catch (error) {
    console.error('Erro ao gerar PDF do cronograma:', error);
    showToast?.('Nao foi possivel gerar o PDF direto. A pre-visualizacao foi aberta para impressao.');
    printWindow.focus();
    printWindow.print();
  }
};
