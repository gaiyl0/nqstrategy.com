'use client';

import { createContext, useContext, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import { clipboardImages } from '@/lib/post-content.mjs';
import { parseRichPost, serializeRichPost } from '@/lib/post-rich-content.mjs';
import { colorRichPost, formatRichPost, insertRichPostImage, PostImage, postEditorExtensions } from '@/lib/post-editor-extensions.mjs';
import PostBodyImage from './PostBodyImage';

const ImageActions = createContext(null);

function InlineImage({ node }) {
  const { t, onRemoveImage, disabled } = useContext(ImageActions);
  return <NodeViewWrapper as="figure" className="forum-editor-inline-media" contentEditable={false}>
    <PostBodyImage url={`/api/post-attachments?id=${node.attrs.id}`} alt={node.attrs.alt} t={t} />
    <figcaption><button type="button" disabled={disabled} onClick={() => onRemoveImage(node.attrs.id)}>{t('移除图片', 'Remove image')}</button></figcaption>
  </NodeViewWrapper>;
}

export default function PostBodyEditor({ content, onChange, editorRef, disabled, onPaste, onRemoveImage, onFormats, onLimit, placeholder, t }) {
  const emitted = useRef(null);
  const extensions = useMemo(() => postEditorExtensions(PostImage.extend({
    addNodeView() { return ReactNodeViewRenderer(InlineImage); },
  }), onLimit), [onLimit]);
  const editor = useEditor({
    extensions, content: parseRichPost(content), immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: 'forum-rich-input', role: 'textbox', 'aria-multiline': 'true', 'aria-label': t('正文内容', 'Article body'), 'data-placeholder': placeholder },
      handlePaste(_view, event) {
        if (clipboardImages(event.clipboardData).length) { onPaste(event); return true; }
        // Plain text paste avoids importing HTML or bypassing image validation.
        event.preventDefault();
        const text = event.clipboardData?.getData('text/plain') || '';
        if (text) editor.commands.insertContent(text.split(/\r?\n/).map(line => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })));
        return true;
      },
      handleDrop() { return true; },
      handleScrollToSelection(view) {
        if (!view.dom.getClientRects().length) return false;
        const toolbar = view.dom.closest('.forum-editor-shell')?.querySelector('.forum-editor-toolbar');
        const header = document.querySelector('.reference-site-header');
        const top = Math.max(header?.getBoundingClientRect().bottom || 0, toolbar?.getBoundingClientRect().bottom || 0) + 12;
        const bottom = window.innerHeight - (window.innerWidth < 768 ? 150 : 24);
        const caret = view.coordsAtPos(view.state.selection.head);
        if (caret.top < top) window.scrollBy(0, caret.top - top);
        else if (caret.bottom > bottom) window.scrollBy(0, caret.bottom - bottom);
        return true;
      },
    },
    onUpdate({ editor: current }) {
      emitted.current = serializeRichPost(current.state.doc);
      onChange(emitted.current);
    },
    onTransaction({ editor: current }) {
      const color = current.getAttributes('postColor').color;
      onFormats?.({ heading: current.isActive('heading'), bold: current.isActive('bold'), quote: current.isActive('blockquote'), list: current.isActive('bulletList'), color:color && current.isActive('postColor',{color}) ? color : null, canUndo:current.can().undo(), canRedo:current.can().redo() });
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.isEditable === Boolean(disabled)) editor.setEditable(!disabled, false);
    editor.view.dom.setAttribute('aria-disabled', String(Boolean(disabled)));
  }, [editor, disabled]);
  useEffect(() => {
    if (!editor || content === emitted.current) return;
    let cancelled = false;
    // React node views flush their initial render. Restore outside the React
    // effect lifecycle so draft images can mount without nested flushSync.
    queueMicrotask(() => {
      if (cancelled || editor.isDestroyed || content === emitted.current) return;
      editor.chain().setContent(parseRichPost(content), { emitUpdate: false })
        .command(({ tr }) => { tr.setMeta('addToHistory', false); return true; }).run();
      const canonical = serializeRichPost(editor.state.doc);
      emitted.current = canonical;
      if (canonical !== content) onChange(canonical);
    });
    return () => { cancelled = true; };
  }, [editor, content, onChange]);

  useImperativeHandle(editorRef, () => ({
    get selectionStart() { return editor?.state.selection.from ?? 0; },
    get selectionEnd() { return editor?.state.selection.to ?? 0; },
    getContent() { return editor ? serializeRichPost(editor.state.doc) : content; },
    format(kind) { if (editor && !disabled) return formatRichPost(editor, kind); },
    setColor(color, focus) { if (editor && !disabled) return colorRichPost(editor, color, focus); },
    insertImage(attachment, range) { return insertRichPostImage(editor, attachment, range); },
    focus() { editor?.commands.focus(undefined, {scrollIntoView:false}); },
    setSelectionRange(start, end) { editor?.chain().setTextSelection({ from: start, to: end }).focus().run(); },
  }));

  return <ImageActions.Provider value={{ t, onRemoveImage, disabled }}><div className="forum-body-editor" aria-label={t('正文编辑区', 'Article body editor')}><EditorContent editor={editor} /></div></ImageActions.Provider>;
}
