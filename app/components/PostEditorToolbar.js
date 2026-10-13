'use client';

import { useEffect, useRef } from 'react';
import { Bold, ChevronDown, Eraser, Eye, Heading2, ImagePlus, List, Palette, Paperclip, PenLine, Quote, Redo2, Undo2 } from 'lucide-react';
import { POST_TEXT_COLORS } from '@/lib/post-inline.mjs';

export default function PostEditorToolbar({ busy, preview, isPublishing, attachmentCount, activeFormats, onFormat, onColor, onAttachment, onPreview, editorRef, t }) {
  const toolbarRef = useRef(null);
  const colorsRef = useRef(null);
  const locked = busy || preview;
  useEffect(() => {
    const toolbar = toolbarRef.current;
    const header = document.querySelector('.reference-site-header');
    const measure = () => {
      toolbar.parentElement.style.setProperty('--forum-header-height', `${header?.getBoundingClientRect().height || 64}px`);
      toolbar.parentElement.style.setProperty('--forum-toolbar-height', `${toolbar.getBoundingClientRect().height || 56}px`);
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(toolbar);
    if (header) observer?.observe(header);
    window.addEventListener('resize', measure);
    const close = event => {
      if (!colorsRef.current?.open) return;
      if (event.type === 'keydown' && event.key === 'Escape') { colorsRef.current.open = false; editorRef.current?.focus(); }
      else if (event.type === 'pointerdown' && !colorsRef.current.contains(event.target)) colorsRef.current.open = false;
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [editorRef]);

  const chooseColor = color => { onColor(color); colorsRef.current.open = false; };
  return <div ref={toolbarRef} className="forum-editor-toolbar" role="toolbar" aria-label={t('文章编辑工具', 'Article editing tools')}>
    <div className="forum-editor-tools">
      {[[Undo2,'撤销','Undo','undo'],[Redo2,'重做','Redo','redo']].map(([Icon,zh,en,kind]) => <button key={kind} type="button" disabled={locked || !activeFormats[kind === 'undo' ? 'canUndo' : 'canRedo']} aria-label={t(zh,en)} title={t(zh,en)} onMouseDown={event=>event.preventDefault()} onClick={()=>onFormat(kind)}><Icon/></button>)}
      <span className="forum-toolbar-divider" aria-hidden="true"/>
      {[[Heading2,'标题','Heading','heading'],[Bold,'加粗','Bold','bold'],[Quote,'引用','Quote','quote'],[List,'列表','List','list']].map(([Icon,zh,en,kind]) => <button key={kind} type="button" disabled={locked} onMouseDown={event=>event.preventDefault()} onClick={()=>onFormat(kind)} aria-pressed={Boolean(activeFormats[kind])} aria-label={t(`设置${zh}格式`,`${en} formatting`)}><Icon/><span>{t(zh,en)}</span></button>)}
      <details ref={colorsRef} className="forum-color-details">
        <summary aria-label={t('文字颜色','Text color')} aria-disabled={locked} onMouseDown={event=>event.preventDefault()} onClick={event=>{if(locked)event.preventDefault();}}><Palette style={activeFormats.color ? {color:activeFormats.color} : undefined}/><span>{t('文字颜色','Text color')}</span><ChevronDown/></summary>
        <div className="forum-color-panel" role="group" aria-label={t('选择文字颜色','Choose text color')}>
          <button type="button" disabled={locked} onMouseDown={event=>event.preventDefault()} onClick={()=>chooseColor(null)}>{t('默认颜色','Default color')}</button>
          <div className="forum-color-swatches">{POST_TEXT_COLORS.map(item=><button key={item.color} type="button" disabled={locked} className="forum-color-swatch" aria-label={t(item.zh,item.en)} aria-pressed={activeFormats.color===item.color} title={t(item.zh,item.en)} style={{backgroundColor:item.color}} onMouseDown={event=>event.preventDefault()} onClick={()=>chooseColor(item.color)}/>)}</div>
          <label className="forum-custom-color">{t('自定义颜色','Custom color')}<input aria-label={t('自定义文字颜色','Custom text color')} type="color" disabled={locked} value={activeFormats.color || '#243448'} onChange={event=>onColor(event.target.value,false)}/></label>
        </div>
      </details>
      <button type="button" className="forum-toolbar-secondary" aria-label={t('清除格式','Clear format')} disabled={locked} onMouseDown={event=>event.preventDefault()} onClick={()=>onFormat('clear')} title={t('清除选中文字的格式','Clear formatting of selected text')}><Eraser/><span>{t('清除格式','Clear format')}</span></button>
      {[[ImagePlus,'插入图片','Insert image','image'],[Paperclip,'添加附件','Add attachment','file']].map(([Icon,zh,en,kind])=><button key={kind} type="button" className="forum-toolbar-secondary" aria-label={t(zh,en)} title={t(zh,en)} disabled={locked || attachmentCount>=10} onMouseDown={event=>event.preventDefault()} onClick={()=>onAttachment(kind)}><Icon/><span>{t(zh,en)}</span></button>)}
      <button type="button" className="forum-toolbar-preview" disabled={isPublishing} aria-pressed={preview} onClick={()=>{colorsRef.current.open=false;onPreview();}}>{preview?<PenLine/>:<Eye/>}{preview?t('继续编辑','Edit'):t('预览','Preview')}</button>
    </div>
  </div>;
}
