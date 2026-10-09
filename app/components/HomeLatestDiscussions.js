"use client";

import { MessageSquare } from 'lucide-react';
import { Badge, Button, Panel } from './ui/UiKit';

export default function HomeLatestDiscussions({ forumPosts, openPostDetail, setRoute, t }) {
  return <section data-testid="home-latest-discussions">
    <div className="editorial-section-heading"><h2>{t('最新讨论', 'Latest discussions')}</h2><Button variant="ghost" onClick={() => setRoute('forum')}>{t('查看更多论坛', 'More discussions')} →</Button></div>
    <Panel className="reference-latest-discussions">
      {forumPosts.slice(0, 3).map(post => {
        const replies = Math.max(0, Number(post.comment_count) || 0);
        return <button key={post.id} onClick={() => openPostDetail(post)}>
          <MessageSquare size={18} aria-hidden="true" className="shrink-0"/>
          <strong>{post.title}</strong>
          <Badge variant={replies ? 'primary' : 'warning'}>{replies ? t('有回复', 'Has replies') : t('待回复', 'Awaiting replies')}</Badge>
          <span>{post.author}</span><span>{replies} {t('回复', 'replies')}</span>
        </button>;
      })}
      {!forumPosts.length && <p>{t('暂无公开讨论，欢迎进入论坛发布交流。', 'No public discussions yet. Start a conversation in the forum.')}</p>}
    </Panel>
  </section>;
}
