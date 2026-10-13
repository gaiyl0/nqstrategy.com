'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function PostBodyImage({ url, alt, t = (zh) => zh }) {
  const [failed, setFailed] = useState(false);
  return failed ? <div className="post-image-error" role="status">
    <strong>{t('图片暂时无法加载', 'Image could not be loaded')}</strong>
    <span>{t('草稿图片可能已过期，请删除后重新上传。', 'A draft image may have expired. Remove it and upload it again.')}</span>
    <button type="button" onClick={() => setFailed(false)}>{t('重试加载', 'Retry')}</button>
  </div> : <Image src={url} alt={alt || ''} width={1200} height={800} unoptimized className="article-inline-image" onError={() => setFailed(true)} />;
}
