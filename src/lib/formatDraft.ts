/**
 * Converts markdown text into clean text suitable for clipboard pasting.
 * If markdown tables are detected, they are converted to Tab-Separated Values (TSV)
 * which can be directly pasted into Microsoft Excel, Google Sheets, or Apple Numbers.
 */
export function cleanMarkdownForClipboard(markdown: string): string {
  if (!markdown) return '';

  const lines = markdown.split('\n');
  const resultLines: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check if line is a table row (starts and ends with |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Check if it's a separator line like |---|---|---|
      const isSeparator = /^\|(\s*:?-+:?\s*\|)+$/.test(trimmed);
      if (isSeparator) {
        inTable = true;
        continue; // Skip markdown separator row in Excel output
      }

      inTable = true;
      // Extract cells
      const cells = trimmed
        .slice(1, -1) // remove leading and trailing |
        .split('|')
        .map((c) => cleanInlineMarkdown(c.trim()));

      resultLines.push(cells.join('\t'));
    } else {
      inTable = false;
      // Clean regular markdown line
      resultLines.push(cleanRegularMarkdownLine(rawLine));
    }
  }

  return resultLines.join('\n').trim();
}

function cleanInlineMarkdown(str: string): string {
  return str
    .replace(/\*\*(.*?)\*\*/g, '$1') // **bold** -> bold
    .replace(/\*(.*?)\*/g, '$1') // *italic* -> italic
    .replace(/__(.*?)__/g, '$1') // __bold__ -> bold
    .replace(/_(.*?)_/g, '$1') // _italic_ -> italic
    .replace(/`([^`]+)`/g, '$1') // `code` -> code
    .replace(/~~(.*?)~~/g, '$1') // ~~strikethrough~~ -> strikethrough
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // [link](url) -> link
    .trim();
}

function cleanRegularMarkdownLine(line: string): string {
  // Strip headers (# Header -> Header)
  let cleaned = line.replace(/^#{1,6}\s+/, '');

  // Strip blockquote (> quote -> quote)
  cleaned = cleaned.replace(/^>\s+/, '');

  // Strip bullet markers (- item or * item -> • item)
  cleaned = cleaned.replace(/^(\s*)[-*+]\s+/, '$1• ');

  // Clean inline markdown
  cleaned = cleanInlineMarkdown(cleaned);

  return cleaned;
}
