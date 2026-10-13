export const POST_TEXT_COLORS = [
  { color:'#dc2626', zh:'红色', en:'Red' },
  { color:'#ea580c', zh:'橙色', en:'Orange' },
  { color:'#ca8a04', zh:'金色', en:'Gold' },
  { color:'#16a34a', zh:'绿色', en:'Green' },
  { color:'#0d9488', zh:'青色', en:'Teal' },
  { color:'#2563eb', zh:'蓝色', en:'Blue' },
  { color:'#7c3aed', zh:'紫色', en:'Purple' },
  { color:'#475569', zh:'灰色', en:'Gray' },
];

export function postTextColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

// Formatting is structured text, not arbitrary HTML or CSS. The same parser
// serves the editor, public article and previews so colors survive storage.
export function postInlineParts(value) {
  const text = String(value || '');
  const result = [];
  const add = (chunk, color = null) => {
    for (const part of chunk.split(/(\*\*.+?\*\*)/g).filter(Boolean)) {
      const bold = part.startsWith('**') && part.endsWith('**');
      result.push({ text: bold ? part.slice(2, -2) : part, bold, color });
    }
  };
  let cursor = 0;
  for (const match of text.matchAll(/\[color=(#[0-9a-f]{6})\]([^\r\n]*?)\[\/color\]/gi)) {
    add(text.slice(cursor, match.index));
    add(match[2], postTextColor(match[1]));
    cursor = match.index + match[0].length;
  }
  add(text.slice(cursor));
  return result;
}

export function plainPostInline(value) {
  return String(value || '').split('\n').map(line => postInlineParts(line).map(part => part.text).join('')).join('\n')
    .replace(/\[color=#[0-9a-f]{6}\]|\[\/color\]/gi, '');
}
