/**
 * @fileoverview Renderizacao limitada de templates Anki sem executar JavaScript.
 */

const sanitizeHtml = require('sanitize-html');

function stripMarkup(value) {
  return sanitizeHtml(String(value || ''), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderCloze(value, ordinal, side) {
  const target = Number(ordinal) + 1;
  return String(value || '').replace(/\{\{c(\d+)::([\s\S]*?)(?:::(.*?))?\}\}/gi, (_match, number, text, hint) => {
    if (Number(number) !== target) return text;
    if (side === 'front') return `[${hint || '...'}]`;
    return `<span class="cloze">${text}</span>`;
  });
}

function applySections(template, fields) {
  let output = String(template || '');
  for (let pass = 0; pass < 8; pass += 1) {
    const previous = output;
    output = output.replace(/\{\{([#^])([^{}]+)\}\}([\s\S]*?)\{\{\/\2\}\}/g, (_match, mode, rawName, body) => {
      const name = rawName.trim().replace(/^[^:]+:/, '');
      const hasValue = Boolean(stripMarkup(fields[name] || ''));
      return mode === '#' ? (hasValue ? body : '') : (hasValue ? '' : body);
    });
    if (output === previous) break;
  }
  return output;
}

function replaceMediaReferences(html, mediaUris) {
  let output = String(html || '');
  output = output.replace(/\[sound:([^\]]+)\]/gi, (_match, rawName) => {
    const name = String(rawName || '').normalize('NFC').trim();
    const uri = mediaUris.get(name);
    return uri ? `<span data-anki-audio="${uri}">Audio: ${name}</span>` : `<span>Audio indisponivel: ${name}</span>`;
  });
  output = output.replace(/(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi, (match, prefix, quote, rawSource) => {
    const source = String(rawSource || '').normalize('NFC').trim();
    const uri = mediaUris.get(source);
    return uri ? `${prefix}${quote}${uri}${quote}` : match;
  });
  return output;
}

function sanitizeRenderedHtml(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: [
      'p', 'div', 'span', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
      'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'code', 'pre', 'img',
    ],
    allowedAttributes: {
      img: ['src', 'alt', 'title', 'width', 'height'],
      span: ['class', 'data-anki-audio'],
      '*': ['class'],
    },
    allowedClasses: { '*': ['cloze'] },
    allowedSchemes: ['anki-media', 'https'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
  }).trim();
}

function renderTemplate(template, fields, options) {
  const side = options.side;
  let output = applySections(template, fields);
  output = output.replace(/\{\{([^{}]+)\}\}/g, (_match, rawToken) => {
    const token = rawToken.trim();
    if (token === 'FrontSide') return options.frontSide || '';
    const pieces = token.split(':');
    const fieldName = pieces.pop().trim();
    const filters = pieces.map((filter) => filter.trim().toLowerCase());
    let value = fields[fieldName] || '';
    if (filters.includes('cloze')) value = renderCloze(value, options.cardOrd, side);
    if (filters.includes('text')) value = stripMarkup(value);
    return value;
  });
  output = replaceMediaReferences(output, options.mediaUris);
  return sanitizeRenderedHtml(output);
}

function renderCard({ template, fieldNames, fieldValues, cardOrd, isCloze, mediaUris }) {
  const fields = {};
  fieldNames.forEach((name, index) => { fields[name] = fieldValues[index] || ''; });
  let questionTemplate = template?.qfmt || '';
  let answerTemplate = template?.afmt || '';
  if (isCloze && !/\{\{cloze:/i.test(questionTemplate)) {
    const clozeField = fieldNames.find((name) => /text|texto/i.test(name)) || fieldNames[0];
    questionTemplate = `{{cloze:${clozeField}}}`;
    answerTemplate = `{{cloze:${clozeField}}}`;
  }
  if (!questionTemplate) questionTemplate = `{{${fieldNames[0] || ''}}}`;
  if (!answerTemplate) answerTemplate = `{{FrontSide}}<hr>{{${fieldNames[1] || fieldNames[0] || ''}}}`;
  const front = renderTemplate(questionTemplate, fields, { side: 'front', cardOrd, mediaUris, frontSide: '' });
  const back = renderTemplate(answerTemplate, fields, { side: 'back', cardOrd, mediaUris, frontSide: front });
  return { front: front || stripMarkup(fieldValues[0]), back: back || stripMarkup(fieldValues[1] || fieldValues[0]) };
}

module.exports = {
  applySections,
  renderCard,
  renderCloze,
  renderTemplate,
  replaceMediaReferences,
  sanitizeRenderedHtml,
  stripMarkup,
};
