import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';

const rootDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-post-composer-'));
const dom = new JSDOM('<!doctype html><div id="app"></div>', { pretendToBeVisual: true, url: 'https://nexus.test' });
for (const name of ['window','document','navigator','HTMLElement','Element','Node','MutationObserver','localStorage','File','FormData','getComputedStyle','requestAnimationFrame','cancelAnimationFrame']) {
  const value = dom.window[name];
  Object.defineProperty(globalThis, name, { configurable: true, value: ['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(name) ? value.bind(dom.window) : value });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Layout is absent in jsdom; selection transactions and React DOM are real.
dom.window.Range.prototype.getClientRects = () => [];
dom.window.Range.prototype.getBoundingClientRect = () => ({ top:0,bottom:0,left:0,right:0,width:0,height:0 });
let root = createRoot(document.querySelector('#app'));
const toasts = [];
const t = zh => zh;
let latest;
try {
  const imageMock = path.join(rootDir, 'next-image.mjs');
  const linkMock = path.join(rootDir, 'next-link.mjs');
  const dynamicMock = path.join(rootDir, 'next-dynamic.mjs');
  fs.writeFileSync(imageMock, "import React from 'react'; export default function Image({unoptimized,fill,priority,...props}) {return React.createElement('img',props)}");
  fs.writeFileSync(linkMock, "import React from 'react'; export default function Link(props) {return React.createElement('a',props)}");
  fs.writeFileSync(dynamicMock, "import React from 'react'; export default function dynamic(load) {const Component=React.lazy(load);return props=>React.createElement(React.Suspense,{fallback:null},React.createElement(Component,props))}");
  await build({ entryPoints:['app/components/ForumView.js'], outfile:path.join(rootDir,'forum.mjs'), bundle:true, platform:'node', format:'esm', jsx:'automatic', loader:{'.js':'jsx','.css':'empty'}, packages:'external', alias:{'@':process.cwd(),'next/image':imageMock,'next/link':linkMock,'next/dynamic':dynamicMock}, logLevel:'silent' });
  const { default: ForumView } = await import(pathToFileURL(path.join(rootDir,'forum.mjs')));
  const categories = ['全部','XAUUSD 策略'];
  function Composer() {
    const [post,setPost] = useState({title:'测试文章',category:'XAUUSD 策略',content:'黄金策略测试',attachments:[]});
    latest = post;
    return React.createElement(ForumView,{forumView:'create',categories,newPost:post,setNewPost:setPost,setForumView:()=>{},submitPost:async()=>false,showToast:message=>toasts.push(message),t,tCat:t});
  }
  await act(async()=>{root.render(React.createElement(Composer));await new Promise(resolve=>setTimeout(resolve,20));});
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});
  const body = document.querySelector('.forum-rich-input');
  assert.ok(body?.isContentEditable || body?.getAttribute('contenteditable')==='true');
  const editor = body.editor;
  const button = name => [...document.querySelectorAll('button')].find(node=>node.textContent===name);
  await act(async()=>{editor.commands.setTextSelection({from:1,to:5});button('加粗').click();});
  assert.equal(body.querySelector('strong')?.textContent,'黄金策略');
  assert.equal(body.textContent,'黄金策略测试');
  assert.equal(button('加粗').getAttribute('aria-pressed'),'true');
  assert.equal(latest.content,'**黄金策略**测试');
  const summary = document.querySelector('.forum-color-details summary');
  const colorButton = name => document.querySelector(`.forum-color-panel button[aria-label="${name}"]`);
  await act(async()=>summary.click());
  await act(async()=>colorButton('红色').click());
  assert.equal(body.querySelector('[data-text-color]')?.style.color,'rgb(220, 38, 38)');
  assert.equal(body.textContent,'黄金策略测试');
  assert.equal(document.querySelector('.forum-color-details').open,false);
  assert.equal(latest.content,'[color=#dc2626]**黄金策略**[/color]测试');
  await act(async()=>document.querySelector('button[aria-label="撤销"]').click());
  assert.equal(body.querySelector('[data-text-color]'),null);
  await act(async()=>document.querySelector('button[aria-label="重做"]').click());
  assert.equal(body.querySelector('[data-text-color]')?.textContent,'黄金策略');
  await act(async()=>button('保存本地草稿').click());
  assert.ok(toasts.at(-1).includes('草稿保存成功'));
  assert.ok(document.querySelector('.forum-draft-feedback[role=status]').textContent.includes('当前浏览器'));
  assert.equal(JSON.parse(localStorage.getItem('nexus_forum_post_draft')).content,latest.content);
  await act(async()=>button('预览').click());
  assert.equal(document.querySelector('.article-body strong')?.textContent,'黄金策略');
  assert.equal(document.querySelector('.article-body [data-text-color]')?.style.color,'rgb(220, 38, 38)');
  assert.equal(document.querySelector('.forum-rich-input').editor,editor,'preview preserves the editor and undo history');
  await act(async()=>button('继续编辑').click());
  await act(async()=>button('清除格式').click());
  assert.equal(body.querySelector('strong'),null);
  assert.equal(body.querySelector('[data-text-color]'),null);
  assert.ok(document.querySelector('.forum-editor-toolbar').closest('.forum-editor-shell'));
  assert.equal(document.querySelector('.forum-editor-shell').classList.contains('overflow-hidden'),false);
  await act(async()=>{editor.commands.setTextSelection({from:1,to:5});button('标题').click();});
  assert.equal(body.querySelector('h2')?.textContent,'黄金策略测试');
  await act(async()=>{button('引用').click();});
  assert.equal(body.querySelector('blockquote')?.textContent,'黄金策略测试');
  assert.equal(body.querySelector('h2'),null);
  // Paste source HTML as literal text, even when text/html is also available.
  await act(async()=>{
    editor.commands.setTextSelection(editor.state.doc.content.size-1);
    const event = new window.Event('paste',{bubbles:true,cancelable:true});
    Object.defineProperty(event,'clipboardData',{value:{items:[],files:[],getData:type=>type==='text/plain'?'<script>evil()</script>':'<img src="https://evil.test/x">'}});
    body.dispatchEvent(event);
  });
  assert.equal(body.querySelector('script,img'),null);
  assert.ok(body.textContent.includes('<script>evil()</script>'));
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url,'/api/post-attachments');
    assert.equal(options.method,'POST');
    return new Response(JSON.stringify({attachment:{id:21,name:'粘贴图片-1.png',kind:'image',url:'/api/post-attachments?id=21',size:100}}),{status:201,headers:{'content-type':'application/json'}});
  };
  await act(async()=>{
    const file = new File(['isolated mock upload'],'image.png',{type:'image/png'});
    const event = new window.Event('paste',{bubbles:true,cancelable:true});
    Object.defineProperty(event,'clipboardData',{value:{items:[{kind:'file',type:'image/png',getAsFile:()=>file}],files:[file],getData:()=>''}});
    body.dispatchEvent(event);
    await new Promise(resolve=>setTimeout(resolve,30));
  });
  globalThis.fetch = previousFetch;
  assert.equal(body.querySelector('img').getAttribute('src'),'/api/post-attachments?id=21');
  assert.equal(body.querySelector('figcaption').textContent,'移除图片');
  assert.equal(latest.attachments.length,1);
  assert.ok(latest.content.includes('![粘贴图片-1.png](/api/post-attachments?id=21)'));
  const original = window.Storage.prototype.setItem;
  window.Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
  await act(async()=>button('保存本地草稿').click());
  assert.ok(toasts.at(-1).includes('草稿保存失败'));
  assert.ok(document.querySelector('.forum-draft-feedback[role=alert]').textContent.includes('复制正文'));
  window.Storage.prototype.setItem = original;
  await act(async()=>button('保存本地草稿').click());
  assert.equal(document.querySelector('.forum-draft-feedback[role=alert]'),null);
  assert.ok(toasts.at(-1).includes('草稿保存成功'));
  await act(async()=>root.unmount());
  root = createRoot(document.querySelector('#app'));
  await act(async()=>{root.render(React.createElement(Composer));});
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});
  assert.ok(document.querySelector('.forum-rich-input blockquote'));
  assert.ok(document.querySelector('.forum-rich-input').textContent.includes('<script>evil()</script>'));
  assert.equal(document.querySelector('.forum-rich-input img').getAttribute('src'),'/api/post-attachments?id=21');
  await act(async()=>{
    const restored=document.querySelector('.forum-rich-input').editor;
    restored.commands.setTextSelection({from:2,to:6});
    colorButton('蓝色').click();
    button('保存本地草稿').click();
  });
  assert.equal(document.querySelector('.forum-rich-input [data-text-color]')?.getAttribute('data-text-color'),'#2563eb');
  assert.ok(JSON.parse(localStorage.getItem('nexus_forum_post_draft')).content.includes('[color=#2563eb]'));
  await act(async()=>root.unmount());
  root=createRoot(document.querySelector('#app'));
  await act(async()=>root.render(React.createElement(Composer)));
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});
  assert.equal(document.querySelector('.forum-rich-input [data-text-color]')?.getAttribute('data-text-color'),'#2563eb');
  console.log('Post composer React DOM passed: actual toolbar clicks, immediate formatting, preview/history, safe paste, save feedback, storage failure and draft restore.');
} finally {
  await act(async()=>root.unmount());
  dom.window.close();
  const absolute = path.resolve(rootDir);
  assert.ok(path.dirname(absolute)===process.cwd() && path.basename(absolute).startsWith('.tmp-post-composer-'));
  fs.rmSync(absolute,{recursive:true,force:true});
}
