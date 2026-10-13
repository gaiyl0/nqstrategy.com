import { Extension, Mark, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ListItem } from '@tiptap/extension-list-item';
import { Plugin } from '@tiptap/pm/state';
import { serializeRichPost } from './post-rich-content.mjs';
import { postTextColor } from './post-inline.mjs';

export const PostColor = Mark.create({
  name: 'postColor',
  addAttributes() { return { color:{default:null} }; },
  parseHTML() { return []; },
  renderHTML({ mark }) {
    const color = postTextColor(mark.attrs.color);
    return ['span', color ? { style:`color:${color}`, 'data-text-color':color } : {}, 0];
  },
});

export const PostImage = Node.create({
  name: 'postImage', group: 'block', atom: true, draggable: false,
  addAttributes() { return { id: { default: null }, alt: { default: 'image' } }; },
  parseHTML() { return []; },
  renderHTML({ node }) { return ['div', { 'data-post-image': node.attrs.id }, node.attrs.alt]; },
});

export function postEditorExtensions(image = PostImage, onLimit = () => {}) {
  return [StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    code: false, codeBlock: false, italic: false, strike: false,
    underline: false, link: false, horizontalRule: false, orderedList: false,
    listItem: false, trailingNode: false,
  }), ListItem.extend({
    addKeyboardShortcuts() {
      return { ...this.parent?.(), Tab: () => false, 'Shift-Tab': () => false };
    },
  }), image, PostColor,
  Extension.create({
    name: 'postSourceLimit',
    addProseMirrorPlugins() {
      return [new Plugin({ filterTransaction(transaction) {
        if (!transaction.docChanged || serializeRichPost(transaction.doc).length <= 20_000) return true;
        queueMicrotask(onLimit);
        return false;
      } })];
    },
  })];
}

export function formatRichPost(editor, kind) {
  const chain = editor.chain().focus(undefined, {scrollIntoView:false});
  if (kind === 'bold') return chain.toggleBold().run();
  if (kind === 'heading') return (editor.isActive('heading') ? chain : chain.clearNodes()).toggleHeading({ level: 2 }).run();
  if (kind === 'quote') return (editor.isActive('blockquote') ? chain : chain.clearNodes()).toggleBlockquote().run();
  if (kind === 'list') return (editor.isActive('bulletList') ? chain : chain.clearNodes()).toggleBulletList().run();
  if (kind === 'clear') return chain.unsetAllMarks().clearNodes().run();
  if (kind === 'undo') return chain.undo().run();
  if (kind === 'redo') return chain.redo().run();
  return false;
}

export function colorRichPost(editor, value, focus = true) {
  const color = postTextColor(value);
  if (value !== null && !color) return false;
  const chain = editor.chain();
  if (focus) chain.focus(undefined, {scrollIntoView:false});
  return color ? chain.setMark('postColor', {color}).run() : chain.unsetMark('postColor').run();
}

export function insertRichPostImage(editor, attachment, range) {
  const selection = range || editor.state.selection;
  editor.chain().setTextSelection({ from: selection.start ?? selection.from, to: selection.end ?? selection.to })
    .insertContent([{ type: 'postImage', attrs: { id: attachment.id, alt: attachment.name } }, { type: 'paragraph' }])
    .command(({ tr }) => {
      if (serializeRichPost(tr.doc).length > 20_000) throw new Error('POST_CONTENT_TOO_LONG');
      return true;
    }).run();
  return { content: serializeRichPost(editor.state.doc), caret: editor.state.selection.to };
}
