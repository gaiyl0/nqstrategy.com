import { postContentBlocks } from './post-content.mjs';
import { postInlineParts, postTextColor } from './post-inline.mjs';

// Parse the site's existing dialect as data. HTML and remote image markup stay text.
function inline(text) {
  return postInlineParts(text).map(part => ({ type:'text', text:part.text,
    marks:[...(part.bold ? [{type:'bold'}] : []), ...(part.color ? [{type:'postColor',attrs:{color:part.color}}] : [])] }));
}

export function parseRichPost(source) {
  const content = [];
  const blocks = postContentBlocks(source);
  for (const [index, block] of blocks.entries()) {
    if (block.kind === 'image') {
      content.push({ type: 'postImage', attrs: { id: block.id, alt: block.alt } });
      continue;
    }
    let text = block.text.replace(/\r\n/g, '\n');
    if (index > 0 && text.startsWith('\n')) text = text.slice(1);
    if (index < blocks.length - 1 && text.endsWith('\n')) text = text.slice(0, -1);
    if (!text && index < blocks.length - 1) continue;
    for (const line of text.split('\n')) {
      const heading = line.match(/^(#{1,3})\s+/);
      const quote = line.match(/^>\s?/);
      const bullet = line.match(/^[-*•]\s+/);
      const paragraph = { type: 'paragraph', content: inline(line.slice((heading || quote || bullet)?.[0].length || 0)) };
      if (heading) content.push({ type: 'heading', attrs: { level: heading[1].length }, content: paragraph.content });
      else if (quote) content.push({ type: 'blockquote', content: [paragraph] });
      else if (bullet) {
        const item = { type: 'listItem', content: [paragraph] };
        if (content.at(-1)?.type === 'bulletList') content.at(-1).content.push(item);
        else content.push({ type: 'bulletList', content: [item] });
      } else content.push(paragraph);
    }
  }
  if (!content.length || content.at(-1).type === 'postImage') content.push({ type: 'paragraph' });
  return { type: 'doc', content };
}

function inlineSource(nodes = []) {
  return nodes.map(node => {
    if (node.type === 'hardBreak') return '\n';
    const text = node.text || '';
    const bold = node.marks?.some(mark => mark.type === 'bold');
    const color = postTextColor(node.marks?.find(mark => mark.type === 'postColor')?.attrs?.color);
    return text.split('\n').map(line => {
      const formatted = bold && line ? `**${line}**` : line;
      return color && formatted ? `[color=${color}]${formatted}[/color]` : formatted;
    }).join('\n');
  }).join('');
}

function prefixLines(text, prefix) {
  return text.split('\n').map(line => /^!\[[^\]\r\n]{0,200}\]\(\/api\/post-attachments\?id=[1-9]\d*\)$/.test(line) ? line : `${prefix}${line}`).join('\n');
}

export function serializeRichPost(value) {
  const json = typeof value.toJSON === 'function' ? value.toJSON() : value;
  const render = node => {
    if (node.type === 'postImage') {
      const id = Number(node.attrs?.id);
      if (!Number.isSafeInteger(id) || id < 1) return '';
      const alt = String(node.attrs.alt || 'image').replace(/[\[\]\r\n]/g, '').slice(0, 200);
      return `![${alt}](/api/post-attachments?id=${id})`;
    }
    if (node.type === 'heading') return `${'#'.repeat(Math.min(3, Math.max(1, node.attrs?.level || 2)))} ${inlineSource(node.content)}`;
    if (node.type === 'paragraph') return inlineSource(node.content);
    if (node.type === 'blockquote') return prefixLines((node.content || []).map(render).join('\n'), '> ');
    if (node.type === 'bulletList') return (node.content || []).map(item => prefixLines((item.content || []).map(render).join('\n'), '- ')).join('\n');
    return (node.content || []).map(render).join('\n');
  };
  return render(json);
}

export function writePostDraft(storage, post, content, now = new Date()) {
  const savedAt = now.toISOString();
  storage.setItem('nexus_forum_post_draft', JSON.stringify({ ...post, content, savedAt }));
  return savedAt;
}
