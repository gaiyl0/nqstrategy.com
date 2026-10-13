'use client';

import { useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import { postContentBlocks, replacePostText } from '@/lib/post-content.mjs';
import PostBodyImage from './PostBodyImage';

export default function PostBodyEditor({ content, onChange, editorRef, disabled, onPaste, onRemoveImage, placeholder, t }) {
  const blocks = useMemo(() => postContentBlocks(content), [content]);
  const fields = useRef(new Map());
  const selection = useRef({ start: content.length, end: content.length });
  const hasImages = blocks.some(block => block.kind === 'image');

  const remember = (field, block) => {
    selection.current = { start: block.start + field.selectionStart, end: block.start + field.selectionEnd };
  };
  useImperativeHandle(editorRef, () => ({
    get selectionStart() { return selection.current.start; },
    get selectionEnd() { return selection.current.end; },
    focus() { fields.current.get(blocks.findIndex(block => block.kind === 'text' && block.start <= selection.current.start && block.end >= selection.current.start))?.focus(); },
    setSelectionRange(start, end) {
      selection.current = { start, end };
      const index = blocks.findIndex(block => block.kind === 'text' && block.start <= start && block.end >= start);
      const field = fields.current.get(index);
      if (field) { field.focus(); field.setSelectionRange(start - blocks[index].start, Math.min(end, blocks[index].end) - blocks[index].start); }
    },
  }), [blocks]);

  useLayoutEffect(() => {
    for (const field of fields.current.values()) {
      field.style.height = 'auto';
      field.style.height = `${Math.max(hasImages ? 72 : 420, field.scrollHeight)}px`;
    }
  }, [content, hasImages]);

  return <div className="forum-body-editor" aria-label={t('正文编辑区', 'Article body editor')}>
    {blocks.map((block, index) => block.kind === 'image' ? <figure key={`image-${index}-${block.id}`} className="forum-editor-inline-media">
      <PostBodyImage url={block.url} alt={block.alt} t={t} />
      <figcaption><span>{block.alt || t('正文图片', 'Body image')}</span><button type="button" disabled={disabled} onClick={() => onRemoveImage(block.id)}>{t('移除图片', 'Remove image')}</button></figcaption>
    </figure> : <textarea key={`text-${index}`} ref={field => { if (field) fields.current.set(index, field); else fields.current.delete(index); }}
      aria-label={index === 0 ? t('正文内容', 'Article body') : t(`图片后的正文 ${index}`, `Text after image ${index}`)}
      disabled={disabled} rows={hasImages ? 2 : 18} value={block.text}
      maxLength={20_000 - content.length + block.text.length} placeholder={hasImages ? t('继续输入正文…', 'Continue writing…') : placeholder}
      onSelect={event => remember(event.currentTarget, block)} onFocus={event => remember(event.currentTarget, block)}
      onPaste={event => { remember(event.currentTarget, block); onPaste(event); }}
      onChange={event => {
        remember(event.currentTarget, block);
        const next = replacePostText(content, block, event.target.value);
        if (next !== null) onChange(next);
      }} />)}
  </div>;
}
