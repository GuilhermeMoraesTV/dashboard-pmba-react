/**
 * @fileoverview Validacao, extracao e chunking rastreavel de PDFs privados.
 */

class DocumentProcessingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DocumentProcessingError';
    this.code = code;
  }
}

let pdfjsPromise = null;

async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsPromise;
}

function normalizeExtractedText(value = '') {
  return String(value)
    .normalize('NFC')
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function assertPdfBuffer(buffer, metadata, limits) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
    throw new DocumentProcessingError('invalid-pdf', 'O arquivo enviado nao e um PDF valido.');
  }
  if (buffer.length > limits.storage.maxPdfSizeBytes) {
    throw new DocumentProcessingError('file-too-large', 'O PDF excede o limite de tamanho configurado.');
  }
  const contentType = String(metadata?.contentType || '').toLowerCase();
  if (contentType !== 'application/pdf') {
    throw new DocumentProcessingError('invalid-mime', 'O arquivo armazenado nao possui MIME application/pdf.');
  }
  if (!buffer.subarray(0, 8).toString('latin1').startsWith('%PDF-')) {
    throw new DocumentProcessingError('invalid-signature', 'A assinatura binaria do arquivo nao corresponde a PDF.');
  }
}

function splitLongText(text, maxChars) {
  const parts = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    let cut = remaining.lastIndexOf(' ', maxChars);
    if (cut < Math.floor(maxChars * 0.6)) cut = maxChars;
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function buildDocumentChunks(pages, options) {
  const targetChars = Math.max(500, Number(options.chunkTargetChars));
  const overlapChars = Math.max(0, Math.min(Number(options.chunkOverlapChars), Math.floor(targetChars / 4)));
  const maxChunks = Math.max(1, Number(options.maxChunks));
  const chunks = [];
  let current = null;

  const flush = () => {
    if (!current?.content?.trim()) return;
    const content = current.content.trim();
    chunks.push({
      order: chunks.length,
      pageStart: current.pageStart,
      pageEnd: current.pageEnd,
      content,
      charCount: content.length,
    });
    current = null;
  };

  for (const page of pages) {
    const paragraphs = page.text
      .split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ0-9])/u)
      .flatMap((part) => splitLongText(part.trim(), targetChars))
      .filter(Boolean);

    for (const paragraph of paragraphs) {
      if (!current) {
        const overlap = chunks.length && overlapChars
          ? chunks[chunks.length - 1].content.slice(-overlapChars).trim()
          : '';
        current = {
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
          content: overlap ? `${overlap}\n\n${paragraph}` : paragraph,
        };
      } else if (current.content.length + paragraph.length + 2 <= targetChars) {
        current.content += `\n\n${paragraph}`;
        current.pageEnd = page.pageNumber;
      } else {
        flush();
        if (chunks.length >= maxChunks) return { chunks, truncated: true };
        const overlap = overlapChars ? chunks[chunks.length - 1].content.slice(-overlapChars).trim() : '';
        current = {
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
          content: overlap ? `${overlap}\n\n${paragraph}` : paragraph,
        };
      }
    }
  }
  flush();
  return { chunks: chunks.slice(0, maxChunks), truncated: chunks.length > maxChunks };
}

async function extractPdf(buffer, limits, options = {}) {
  assertPdfBuffer(buffer, options.metadata, limits);
  const pdfjs = await loadPdfJs();
  let loadingTask;
  let pdf;
  try {
    loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      disableFontFace: true,
      isEvalSupported: false,
      useSystemFonts: false,
      verbosity: 0,
    });
    pdf = await loadingTask.promise;
  } catch (error) {
    throw new DocumentProcessingError('invalid-pdf', `Nao foi possivel abrir o PDF: ${error?.message || error}`);
  }

  const pageCount = Number(pdf.numPages || 0);
  if (!pageCount) {
    await pdf.destroy().catch(() => {});
    throw new DocumentProcessingError('invalid-pdf', 'O PDF nao contem paginas validas.');
  }

  const pages = [];
  let extractedChars = 0;
  let textTruncated = false;
  let processedPageCount = 0;
  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent({ disableNormalization: false });
      const rawText = textContent.items.map((item) => {
        const suffix = item?.hasEOL ? '\n' : ' ';
        return `${item?.str || ''}${suffix}`;
      }).join('');
      let text = normalizeExtractedText(rawText);
      processedPageCount = pageNumber;
      const remaining = limits.documents.maxExtractedTextChars - extractedChars;
      if (remaining <= 0) {
        textTruncated = true;
        break;
      }
      if (text.length > remaining) {
        text = text.slice(0, remaining).trim();
        textTruncated = true;
      }
      extractedChars += text.length;
      if (text) pages.push({ pageNumber, text });
    }
  } catch (error) {
    if (error instanceof DocumentProcessingError) throw error;
    throw new DocumentProcessingError('pdf-extraction-failed', `Falha ao extrair texto do PDF: ${error?.message || error}`);
  } finally {
    try { await pdf.destroy(); } catch { /* liberacao best-effort */ }
    try { await loadingTask?.destroy?.(); } catch { /* liberacao best-effort */ }
  }

  if (!pages.length || extractedChars < 20) {
    throw new DocumentProcessingError(
      'no-extractable-text',
      'O PDF nao possui texto extraivel. Arquivos compostos apenas por imagens exigem OCR, que nao e aplicado automaticamente.',
    );
  }

  const chunkResult = buildDocumentChunks(pages, limits.documents);
  if (!chunkResult.chunks.length) {
    throw new DocumentProcessingError('no-extractable-text', 'Nao foi possivel formar chunks de texto a partir do PDF.');
  }

  return {
    pageCount,
    processedPageCount,
    textCharCount: extractedChars,
    chunks: chunkResult.chunks,
    warning: textTruncated || chunkResult.truncated
      ? 'PDF processado e pronto. O texto armazenado atingiu o limite seguro de processamento; chamadas de IA usam apenas uma parte do conteudo por vez.'
      : pageCount > Math.max(1, Number(limits.ai.maxDocumentPagesForAI))
        ? `PDF processado e pronto. Cada chamada de IA usa no maximo ${Math.max(1, Number(limits.ai.maxDocumentPagesForAI))} paginas e o limite de contexto configurado.`
        : null,
  };
}

module.exports = {
  DocumentProcessingError,
  assertPdfBuffer,
  buildDocumentChunks,
  extractPdf,
  normalizeExtractedText,
};
