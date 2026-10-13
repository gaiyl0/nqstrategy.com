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
