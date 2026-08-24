/**
 * Lightweight, Safe Markdown to HTML Compiler
 * Produces clean semantic HTML for editorial article rendering.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('mailto:')
  ) {
    return escapeHtml(trimmed);
  }
  return '#';
}

export function renderMarkdown(markdown: string): string {
  if (!markdown) return '';

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const htmlOut: string[] = [];

  let inList: 'ul' | 'ol' | null = null;
  let inBlockquote = false;
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  function closeList() {
    if (inList === 'ul') htmlOut.push('</ul>');
    if (inList === 'ol') htmlOut.push('</ol>');
    inList = null;
  }

  function closeBlockquote() {
    if (inBlockquote) {
      htmlOut.push('</blockquote>');
      inBlockquote = false;
    }
  }

  function formatInline(text: string): string {
    let res = escapeHtml(text);

    // Inline code: `code`
    res = res.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Images: ![alt](url)
    res = res.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, src) => {
      return `<img src="${sanitizeUrl(src)}" alt="${escapeHtml(alt)}" loading="lazy" class="article-image" />`;
    });

    // Links: [text](url)
    res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      const safeHref = sanitizeUrl(href);
      const isExternal = safeHref.startsWith('http');
      const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${safeHref}"${target}>${label}</a>`;
    });

    // Bold: **text** or __text__
    res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    res = res.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_
    res = res.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    res = res.replace(/_([^_]+)_/g, '<em>$1</em>');

    return res;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        htmlOut.push(`<pre><code>${codeBuffer.join('\n')}</code></pre>`);
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        closeList();
        closeBlockquote();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(escapeHtml(line));
      continue;
    }

    // Blank line
    if (!trimmed) {
      closeList();
      closeBlockquote();
      continue;
    }

    // Horizontal Rule
    if (/^(?:---|\*\*\*|___)$/.test(trimmed)) {
      closeList();
      closeBlockquote();
      htmlOut.push('<hr />');
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      closeBlockquote();
      const level = headingMatch[1].length;
      const content = formatInline(headingMatch[2]);
      htmlOut.push(`<h${level}>${content}</h${level}>`);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      closeList();
      if (!inBlockquote) {
        htmlOut.push('<blockquote>');
        inBlockquote = true;
      }
      const quoteText = trimmed.replace(/^>\s?/, '');
      htmlOut.push(`<p>${formatInline(quoteText)}</p>`);
      continue;
    } else {
      closeBlockquote();
    }

    // Unordered list
    const ulMatch = line.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      if (inList !== 'ul') {
        closeList();
        htmlOut.push('<ul>');
        inList = 'ul';
      }
      htmlOut.push(`<li>${formatInline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (inList !== 'ol') {
        closeList();
        htmlOut.push('<ol>');
        inList = 'ol';
      }
      htmlOut.push(`<li>${formatInline(olMatch[1])}</li>`);
      continue;
    }

    // If we were in a list and hit normal text
    closeList();

    // Standard paragraph
    htmlOut.push(`<p>${formatInline(trimmed)}</p>`);
  }

  closeList();
  closeBlockquote();
  if (inCodeBlock) {
    htmlOut.push(`<pre><code>${codeBuffer.join('\n')}</code></pre>`);
  }

  return htmlOut.join('\n');
}
