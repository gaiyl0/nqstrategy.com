export function slugBase(value) {
  const normalized=String(value||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'');
  return normalized.replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,64)||'strategy';
}

export function productSlug(title,id){
  if(!Number.isInteger(Number(id))||Number(id)<1)throw new Error('PRODUCT_ID_INVALID');
  return `${slugBase(title)}-${Number(id)}`;
}

export function validProductSlug(value){
  return typeof value==='string'&&value.length>=3&&value.length<=96&&/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(value);
}

export function decodeProductSlug(value) {
  if (typeof value !== 'string' || value.length>1152) return null;
  try { const decoded=decodeURIComponent(value); return validProductSlug(decoded) ? decoded : null; }
  catch { return null; }
}
