import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { formatRichPost, insertRichPostImage, postEditorExtensions } from '../lib/post-editor-extensions.mjs';
import { parseRichPost, serializeRichPost, writePostDraft } from '../lib/post-rich-content.mjs';

const dom = new JSDOM('<!doctype html><div id="editor"></div>', { pretendToBeVisual: true, url: 'https://nexus.test' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: typeof dom.window[name] === 'function' && ['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(name) ? dom.window[name].bind(dom.window) : dom.window[name] });
}
let limit = 0;
const editor = new Editor({ element: document.querySelector('#editor'), extensions: postEditorExtensions(undefined, () => limit++), content: parseRichPost('黄金策略测试') });
const source = () => serializeRichPost(editor.state.doc);
const reset = text => {
  editor.chain().setContent(parseRichPost(text)).command(({ tr }) => { tr.setMeta('addToHistory', false); return true; }).run();
  editor.view.dispatch(closeHistory(editor.state.tr));
};
editor.commands.setTextSelection({ from: 1, to: 5 });
formatRichPost(editor, 'bold');
assert.equal(editor.view.dom.querySelector('strong').textContent, '黄金策略');
assert.equal(editor.view.dom.textContent, '黄金策略测试');
assert.equal(source(), '**黄金策略**测试');
formatRichPost(editor, 'bold');
assert.equal(editor.view.dom.querySelector('strong'), null);
assert.equal(source(), '黄金策略测试');
formatRichPost(editor, 'heading');
assert.equal(editor.view.dom.querySelector('h2').textContent, '黄金策略测试');
assert.equal(source(), '## 黄金策略测试');
formatRichPost(editor, 'heading');
assert.equal(editor.view.dom.querySelector('h2'), null);
formatRichPost(editor, 'quote');
assert.equal(editor.view.dom.querySelector('blockquote').textContent, '黄金策略测试');
formatRichPost(editor, 'quote');
assert.equal(editor.view.dom.querySelector('blockquote'), null);
reset('第一行\n第二行');
editor.commands.selectAll();
formatRichPost(editor, 'list');
assert.equal(editor.view.dom.querySelectorAll('ul>li').length, 2);
assert.equal(source(), '- 第一行\n- 第二行');
formatRichPost(editor, 'list');
assert.equal(source(), '第一行\n第二行');
reset('原文');
editor.commands.setTextSelection(3);
formatRichPost(editor, 'bold');
editor.view.dispatch(editor.state.tr.insertText('新字'));
assert.equal(editor.view.dom.querySelector('strong').textContent, '新字');
editor.commands.undo();
assert.equal(source(), '原文');
editor.commands.redo();
assert.equal(source(), '原文**新字**');

const old = '## **研究**\n正文 **2*3**\n\n> 引用\n- 一\n- **二**\n![截图](/api/post-attachments?id=9)\n后文';
reset(old);
assert.equal(source(), old);
assert.equal(editor.view.dom.querySelector('h2 strong').textContent, '研究');
assert.equal(editor.view.dom.querySelector('[data-post-image]').getAttribute('data-post-image'), '9');
assert.equal(editor.view.dom.textContent.includes('![截图]'), false);
reset('<script>alert(1)</script>\n![外图](https://evil.test/image.png)');
assert.equal(editor.view.dom.querySelector('script, img'), null);
assert.equal(source(), '<script>alert(1)</script>\n![外图](https://evil.test/image.png)');
reset('前 **加粗字** 后');
editor.commands.setTextSelection({ from: 4, to: 5 });
const image = insertRichPostImage(editor, { id: 12, name: '图片.png' });
assert.equal(editor.view.dom.querySelector('[data-post-image]').getAttribute('data-post-image'), '12');
assert.ok(image.content.includes('![图片.png](/api/post-attachments?id=12)'));
assert.ok(image.content.includes('前') && image.content.includes('后'));
assert.equal(image.content.includes('**加粗字**'), false);
editor.commands.insertContent({ type: 'text', text: '图后输入' });
assert.ok(source().includes('图后输入'));
reset('a'.repeat(20_000));
editor.commands.setTextSelection(20_001);
editor.commands.insertContent({ type: 'text', text: 'b' });
assert.equal(source().length, 20_000);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(limit, 1);
assert.throws(() => insertRichPostImage(editor, { id: 13, name: 'overflow.png' }), /POST_CONTENT_TOO_LONG/);
assert.equal(source().length, 20_000);

reset(old);
const post = { title: '草稿标题', content: '旧缓存', category: 'XAUUSD 策略', attachments: [{ id: 9, kind: 'image' }] };
const savedAt = writePostDraft(window.localStorage, post, source(), new Date('2026-10-13T10:00:00Z'));
const draft = JSON.parse(window.localStorage.getItem('nexus_forum_post_draft'));
assert.equal(draft.content, old);
assert.equal(draft.savedAt, savedAt);
assert.deepEqual(draft.attachments, post.attachments);
assert.throws(() => writePostDraft({ setItem() { throw new Error('QuotaExceededError'); } }, post, source()), /QuotaExceededError/);
for (const text of ['普通正文', '- 列表正文']) {
  reset(text);
  const event = new window.KeyboardEvent('keydown', { key:'Tab', code:'Tab', bubbles:true, cancelable:true });
  editor.view.dom.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false, 'Tab must allow moving focus out of the editor');
}
for (const type of ['blockquote','bulletList']) {
  const parts = [{type:'paragraph',content:[{type:'text',text:'前文'}]},{type:'postImage',attrs:{id:25,alt:'插图'}},{type:'paragraph',content:[{type:'text',text:'后文'}]}];
  const document = {type:'doc',content:[{type,content:type==='bulletList'?[{type:'listItem',content:parts}]:parts}]};
  const markdown = serializeRichPost(document);
  assert.ok(markdown.includes('\n![插图](/api/post-attachments?id=25)\n'));
  assert.equal(serializeRichPost(parseRichPost(markdown)), markdown, 'images in quote/list keep standalone references when restored');
}
editor.destroy();
dom.window.close();
console.log('Rich editor DOM and draft regressions passed (41 assertions).');
