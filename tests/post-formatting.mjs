import assert from 'node:assert/strict';
import { formatPostText, postContentBlocks } from '../lib/post-content.mjs';

let assertions = 0;
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
const apply = (text, kind, start = 0, end = text.length) => formatPostText(text, { start, end }, kind);
const toggle = (result, kind) => apply(result.content, kind, result.selectionStart, result.selectionEnd);

const heading = apply('默认模式什么时候开仓', 'heading');
equal(heading.content, '## 默认模式什么时候开仓', 'the selected title stays intact');
equal(heading.content.slice(heading.selectionStart, heading.selectionEnd), '默认模式什么时候开仓');
equal(toggle(heading, 'heading').content, '默认模式什么时候开仓');
equal(apply('前文\n第二行\n后文', 'heading', 4, 4).content, '前文\n## 第二行\n后文', 'no selection formats the current line');
equal(apply('第一行\n下一行', 'heading', 0, 4).content, '## 第一行\n下一行', 'trailing newline does not format the next line');
equal(apply('\n正文', 'heading', 0, 0).content, '## \n正文', 'a blank first line accepts a new heading');
equal(apply('', 'heading').selectionStart, 3);
equal(apply('### 已有标题', 'heading').content, '## 已有标题', 'changing heading level does not duplicate markers');
equal(apply('甲\n\n乙', 'heading').content, '## 甲\n\n## 乙');
equal(apply('甲\r\n乙', 'heading').content, '## 甲\r\n## 乙');
equal(apply('## 已有标题', 'quote').content, '> 已有标题');
const partial = apply('这一行文字完整保留', 'heading', 3, 5);
equal(partial.content, '## 这一行文字完整保留');
equal(partial.content.slice(partial.selectionStart, partial.selectionEnd), '文字', 'partial selection retains the same original characters');

const bold = apply('前文黄金 EA后文', 'bold', 2, 7);
equal(bold.content, '前文**黄金 EA**后文');
equal(bold.content.slice(bold.selectionStart, bold.selectionEnd), '黄金 EA');
equal(toggle(bold, 'bold').content, '前文黄金 EA后文');
equal(apply('**黄金 EA**', 'bold').content, '黄金 EA');
const emptyBold = apply('前文后文', 'bold', 2, 2);
equal(emptyBold.content, '前文****后文');
equal(emptyBold.selectionStart, emptyBold.selectionEnd);
equal(emptyBold.selectionStart, 4, 'caret is inside the empty bold markers');
equal(toggle(emptyBold, 'bold').content, '前文后文');
const multilineBold = apply('甲\n乙', 'bold');
equal(multilineBold.content, '**甲**\n**乙**');
equal(toggle(multilineBold, 'bold').content, '甲\n乙');
const blankBold = apply('\n甲\r\n', 'bold');
equal(blankBold.content, '\n**甲**\r\n');
equal(toggle(blankBold, 'bold').content, '\n甲\r\n');

for (const [kind, prefix] of [['quote', '> '], ['list', '- ']]) {
  const result = apply('第一条\n第二条', kind);
  equal(result.content, `${prefix}第一条\n${prefix}第二条`);
  equal(toggle(result, kind).content, '第一条\n第二条');
  equal(apply('原文', kind, 1, 1).content, `${prefix}原文`);
}
equal(apply('• 第一条\n* 第二条', 'list').content, '第一条\n第二条');

const image = '![截图](/api/post-attachments?id=17)';
const imageArticle = `图片前文字${image}图片后标题`;
const offset = imageArticle.indexOf('图片后');
const afterImage = apply(imageArticle, 'heading', offset, imageArticle.length);
equal(afterImage.content, `图片前文字${image}## 图片后标题`, 'formatting a text block leaves images and preceding text intact');
equal(postContentBlocks(afterImage.content).filter(block => block.kind === 'image').map(block => block.id), [17]);
assert.throws(() => apply(imageArticle, 'bold'), /SELECTION_INVALID/); assertions++;
assert.throws(() => apply('x'.repeat(20_000), 'heading'), /TOO_LONG/); assertions++;
console.log(`Post formatting tests passed: ${assertions} assertions for selection preservation, heading/bold/quote/list toggles, empty lines, CRLF and images`);
