import sanitize from 'sanitize-html';

/** Rich-text fields from the CMS editor are sanitised before they are stored. */
export const cleanHtml = (html = '') =>
  sanitize(String(html), {
    allowedTags: [
      'h2', 'h3', 'h4', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote',
      'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'code', 'pre', 'span',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: attribs.target === '_blank' ? { ...attribs, rel: 'noopener' } : attribs,
      }),
      img: (tagName, attribs) => ({ tagName, attribs: { loading: 'lazy', ...attribs } }),
    },
  });

export const stripHtml = (html = '') => sanitize(String(html), { allowedTags: [], allowedAttributes: {} });
