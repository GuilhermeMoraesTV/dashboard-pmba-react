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
