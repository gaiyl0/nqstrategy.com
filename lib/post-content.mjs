// Only the site's validated attachment references become images; arbitrary
// HTML, external URLs and data URLs remain plain text.
export function postContentBlocks(value) {
  const content = String(value || '');
  const blocks = [];
  let cursor = 0;
  for (const match of content.matchAll(/!\[([^\]\r\n]{0,200})\]\(\/api\/post-attachments\?id=([1-9]\d*)\)/g)) {
    const id = Number(match[2]);
    if (!Number.isSafeInteger(id)) continue;
    blocks.push({ kind: 'text', text: content.slice(cursor, match.index), start: cursor, end: match.index });
    blocks.push({ kind: 'image', id, alt: match[1], url: `/api/post-attachments?id=${id}`, start: match.index, end: match.index + match[0].length });
    cursor = match.index + match[0].length;
  }
  blocks.push({ kind: 'text', text: content.slice(cursor), start: cursor, end: content.length });
  return blocks;
}

export function insertPostImage(content, attachment, selection) {
  const start = Math.max(0, Math.min(content.length, selection.start));
  const end = Math.max(start, Math.min(content.length, selection.end));
  const alt = String(attachment.name || 'image').replace(/[\[\]\r\n]/g, '').slice(0, 200);
  const prefix = content.slice(0, start);
  const suffix = content.slice(end);
  const insertion = `${prefix && !prefix.endsWith('\n') ? '\n' : ''}![${alt}](${attachment.url})\n`;
  const next = prefix + insertion + suffix;
  if (next.length > 20_000) throw new Error('POST_CONTENT_TOO_LONG');
  return { content: next, caret: prefix.length + insertion.length };
}

export function clipboardImages(data) {
  const items = Array.from(data?.items || []).filter(item => item.kind === 'file' && item.type?.startsWith('image/'));
  const files = items.map(item => item.getAsFile()).filter(Boolean);
  if (files.length) return files;
  return Array.from(data?.files || []).filter(file => file.type?.startsWith('image/'));
}

export function replacePostText(content, block, text) {
  const next = content.slice(0, block.start) + text + content.slice(block.end);
  return next.length <= 20_000 ? next : null;
}

export function formatPostText(content, selection, kind) {
  if (!['heading', 'bold', 'quote', 'list'].includes(kind)) throw new Error('POST_FORMAT_INVALID');
  const start = Math.max(0, Math.min(content.length, selection.start));
  const end = Math.max(start, Math.min(content.length, selection.end));
  const block = postContentBlocks(content).find(item => item.kind === 'text' && item.start <= start && item.end >= end);
  if (!block) throw new Error('POST_FORMAT_SELECTION_INVALID');
  const finish = (from, to, text, selectionStart, selectionEnd) => {
    const next = content.slice(0, from) + text + content.slice(to);
    if (next.length > 20_000) throw new Error('POST_CONTENT_TOO_LONG');
    return { content: next, selectionStart, selectionEnd };
  };
  if (kind === 'bold') {
    const selected = content.slice(start, end);
    if (!selected.includes('\n') && content.slice(start - 2, start) === '**' && content.slice(end, end + 2) === '**' && start - 2 >= block.start && end + 2 <= block.end) {
      return finish(start - 2, end + 2, selected, start - 2, end - 2);
    }
    const parts = selected.split(/(\r?\n)/);
    const textParts = parts.filter((_, index) => index % 2 === 0 && parts[index].length);
    const remove = textParts.length > 0 && textParts.every(part => part.startsWith('**') && part.endsWith('**') && part.length >= 4);
    const formatted = parts.map((part, index) => index % 2 || (!part && parts.length > 1) ? part : remove ? part.slice(2, -2) : `**${part}**`).join('');
    if (selected.includes('\n')) return finish(start, end, formatted, start, start + formatted.length);
    return finish(start, end, formatted, start + (remove ? 0 : 2), start + formatted.length - (remove ? 0 : 2));
  }
  const lineStart = start === block.start ? block.start : Math.max(block.start, content.lastIndexOf('\n', start - 1) + 1);
  // A selection ending immediately after a newline does not select the next line.
  const last = end > start && content[end - 1] === '\n' ? end - 1 : end;
  const nextNewline = content.indexOf('\n', last);
  const lineEnd = Math.min(block.end, nextNewline === -1 ? content.length : nextNewline);
  const lines = content.slice(lineStart, lineEnd).split('\n');
  const prefixes = { heading: '## ', quote: '> ', list: '- ' };
  const pattern = { heading: /^##[ \t]+/, quote: /^>[ \t]?/, list: /^[-*•][ \t]+/ }[kind];
  const nonempty = lines.filter(line => line.trim());
  const remove = nonempty.length > 0 && nonempty.every(line => pattern.test(line));
  const offsets = [];
  let oldOffset = 0, newOffset = 0;
  const formatted = lines.map(line => {
    const skip = lines.length > 1 && !line.trim();
    const oldPrefix = skip ? '' : line.match(/^(?:#{1,3}[ \t]+|>[ \t]?|[-*•][ \t]+)/)?.[0] || '';
    const prefix = skip || remove ? '' : prefixes[kind];
    const next = skip ? line : prefix + line.slice(oldPrefix.length);
    offsets.push({ oldOffset, newOffset, oldPrefix: oldPrefix.length, prefix: prefix.length, oldLength: line.length, newLength: next.length });
    oldOffset += line.length + 1; newOffset += next.length + 1;
    return next;
  }).join('\n');
  const mapPosition = position => {
    const relative = position - lineStart;
    for (const line of offsets) {
      if (relative <= line.oldOffset + line.oldLength) return lineStart + line.newOffset + line.prefix + Math.max(0, relative - line.oldOffset - line.oldPrefix);
    }
    return lineStart + formatted.length + Math.max(0, position - lineEnd);
  };
  return finish(lineStart, lineEnd, formatted, mapPosition(start), mapPosition(end));
}
