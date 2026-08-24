/**
 * Reading Time Calculator
 * Calculates estimated reading time based on standard 200 words per minute.
 */

export function calculateReadingTime(content: string): string {
  if (!content) return '1 min read';
  
  // Strip Markdown syntax and extra spaces
  const plainText = content
    .replace(/[#*`_~\[\]()<>!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = plainText.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));

  return `${minutes} min read`;
}
