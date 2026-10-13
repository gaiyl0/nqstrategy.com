import { postContentBlocks } from '@/lib/post-content.mjs';
import PostBodyImage from './PostBodyImage';

export default function ArticleContent({ content, imageIds, t }) {
  return <div className="article-body">{postContentBlocks(content).map((block, blockIndex) => {
    if (block.kind === 'image') return (!imageIds || imageIds.includes(block.id)) ? <figure key={`image-${blockIndex}`}><PostBodyImage key={block.url} url={block.url} alt={block.alt} t={t}/></figure> : null;
    const lineOffset = String(content || '').slice(0, block.start).split('\n').length - 1;
    return <div key={`text-${blockIndex}`}>{block.text.split('\n').map((line, localIndex) => {
    const index = lineOffset + localIndex;
    if (/^#{1,3}\s/.test(line)) return <h2 id={`article-section-${index}`} key={index}>{line.replace(/^#{1,3}\s/, '')}</h2>;
    if (/^>\s?/.test(line)) return <blockquote key={index}>{line.replace(/^>\s?/, '')}</blockquote>;
    if (/^[-*•]\s/.test(line)) return <p className="article-list-item" key={index}>• {line.replace(/^[-*•]\s/, '')}</p>;
    if (!line.trim()) return <div key={index} className="article-line-space"/>;
    return <p key={index}>{line.split(/(\*\*.+?\*\*)/g).map((part, partIndex) => part.startsWith('**') && part.endsWith('**') ? <strong key={partIndex}>{part.slice(2,-2)}</strong> : part)}</p>;
    })}</div>;
  })}</div>;
}
