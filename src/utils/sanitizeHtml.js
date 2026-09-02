import DOMPurify from 'dompurify';

export const ARTICLE_ALLOWED_TAGS = [
  'p',
  'h3',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

export function sanitizeArticleHtml(html = '') {
  return DOMPurify.sanitize(String(html || ''), {
    ALLOWED_TAGS: ARTICLE_ALLOWED_TAGS,
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false,
  });
}

export const FLASHCARD_ALLOWED_TAGS = [
  'p', 'div', 'span', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'code', 'pre', 'img',
];

export function sanitizeFlashcardHtml(html = '') {
  return DOMPurify.sanitize(String(html || ''), {
    ALLOWED_TAGS: FLASHCARD_ALLOWED_TAGS,
    ALLOWED_ATTR: ['class', 'src', 'alt', 'title', 'width', 'height'],
    ALLOWED_URI_REGEXP: /^https:\/\//i,
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false,
  });
}
