export function forumEnabled(brand) { return !brand?.forumMode || brand.forumMode === 'enabled'; }
export function forumReadable(brand) { return brand?.forumMode !== 'disabled'; }
export function catalogEnabled(brand) { return brand?.catalogEnabled !== false; }
export function tasksEnabled(brand) { return brand?.tasksEnabled !== false; }

export function navigationHref(item) {
  return item.kind === 'route' ? ['forum','market'].includes(item.target)?`/${item.target}`:item.target==='home'?'/':`/?route=${item.target}` : item.kind === 'page' ? `/pages/${item.target}` : item.target;
}
