// Decorative category covers never represent a strategy's verified performance.
export function editorialArticleCover(post) {
  const title = String(post.title || '');
  const category = String(post.category || '');
  if (/ONNX|神经网络|深度学习|neural/i.test(title)) return 'ai';
  if (/MQL|代码|开发|code/i.test(title)) return 'code';
  if (/AI|人工智能|深度学习/i.test(`${title} ${category}`)) return 'trading';
  if (/XAUUSD|黄金|gold/i.test(`${title} ${category}`)) return 'gold';
  if (/MQL|代码|开发|code/i.test(`${title} ${category}`)) return 'code';
  return 'trading';
}
