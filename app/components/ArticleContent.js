import Image from 'next/image';

export default function ArticleContent({ content, imageIds }) {
  return <div className="article-body">{String(content || '').split('\n').map((line, index) => {
    const image = line.match(/^!\[([^\]]{0,200})\]\(\/api\/post-attachments\?id=([1-9]\d*)\)$/);
    if (image) return (!imageIds || imageIds.includes(Number(image[2]))) ? <figure key={index}><Image src={`/api/post-attachments?id=${image[2]}`} alt={image[1]} width={1200} height={800} unoptimized className="article-inline-image"/></figure> : null;
    if (/^#{1,3}\s/.test(line)) return <h2 id={`article-section-${index}`} key={index}>{line.replace(/^#{1,3}\s/, '')}</h2>;
    if (/^>\s?/.test(line)) return <blockquote key={index}>{line.replace(/^>\s?/, '')}</blockquote>;
    if (/^[-*•]\s/.test(line)) return <p className="article-list-item" key={index}>• {line.replace(/^[-*•]\s/, '')}</p>;
    if (!line.trim()) return <div key={index} className="article-line-space"/>;
    return <p key={index}>{line.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) => part.startsWith('**') && part.endsWith('**') ? <strong key={partIndex}>{part.slice(2,-2)}</strong> : part)}</p>;
  })}</div>;
}
