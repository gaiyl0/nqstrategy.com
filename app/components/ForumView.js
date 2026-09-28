import Image from 'next/image';
import { ArrowLeft, Clock, Eye, Hash, MessageSquare, Trash2, User as UserIcon } from 'lucide-react';
import { FadeInView } from './HomeView';

export default function ForumView({ categories, setActiveCategory, setForumView, fetchForumPosts, forumSort, activeCategory, forumView, tCat, user, setAuthModal, setNewPost, newPost, dynamicCats, setForumSort, forumPosts, products, openPostDetail, getUserTitle, handlePinPost, handleDeletePost, handleReport, selectedPost, setRoute, comments, handlePinComment, handleDeleteComment, commentInput, setCommentInput, isCommenting, submitComment, submitPost, t }) {
  return (
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-100px)] flex gap-8 animate-in fade-in duration-300">
  <div className="w-64 shrink-0 hidden md:flex flex-col gap-2 border-r border-zinc-800/80 pr-6">
    <div className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 pl-3">{t('版块导航', 'Categories')}</div>
    {categories.map(cat => (
      <button key={cat} onClick={() => { setActiveCategory(cat); setForumView('list'); fetchForumPosts(cat,forumSort); }} className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${activeCategory === cat && forumView === 'list' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300'}`}>
        <Hash className={`w-4 h-4 ${activeCategory === cat && forumView === 'list' ? 'text-cyan-400' : 'text-zinc-600'}`} /> {tCat(cat)}
      </button>
    ))}
    <div className="mt-auto">
      <button onClick={() => { if (!user) return setAuthModal('login'); setForumView('create'); setNewPost({...newPost, category: dynamicCats[0] || '全部'}) }} className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold shadow-[0_0_20px_rgba(8,145,178,0.3)] transition-all">+ {t('发起新讨论', 'New Topic')}</button>
    </div>
  </div>

  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-20">
    {forumView === 'list' && (
      <div className="space-y-4">
        <div className="mb-6"><div className="flex flex-wrap justify-between items-center gap-3"><h2 className="text-2xl font-bold text-white flex items-center gap-2">{tCat(activeCategory)}</h2><div className="flex gap-2">{[['latest',t('最新','Latest')],['hot',t('热门','Hot')],['discussed',t('讨论最多','Most discussed')]].map(([value,label])=><button key={value} onClick={()=>{setForumSort(value);fetchForumPosts(activeCategory,value);}} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${forumSort===value?'border-cyan-500/40 bg-cyan-500/10 text-cyan-300':'border-zinc-800 text-zinc-500'}`}>{label}</button>)}</div></div>{forumSort==='hot'&&<p className="mt-2 text-right text-[10px] text-zinc-600">{t('热度按去重浏览、有效评论、置顶权重和发布时间衰减计算。','Hot score uses deduplicated views, visible comments, pin weight, and time decay.')}</p>}</div>
        {forumPosts.map(post => (
          <div key={post.id} onClick={() => openPostDetail(post)} className={`relative border p-6 rounded-3xl transition-all cursor-pointer group shadow-lg ${post.is_pinned ? 'bg-cyan-900/10 border-cyan-500/30' : 'bg-zinc-900/40 border-zinc-800 hover:border-cyan-500/30'}`}>
            {user?.role === 'admin' && (
              <div className="absolute top-6 right-6 flex items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => handlePinPost(post.id, !post.is_pinned, e)} className="p-2 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white rounded-lg transition-colors text-xs font-bold">{post.is_pinned ? t('取消置顶', 'Unpin') : t('📌 置顶', '📌 Pin')}</button>
                <button onClick={(e) => handleDeletePost(post.id, e)} className="p-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            )}
            <div className="flex gap-2 mb-3 items-center">
              {post.is_pinned && <span className="px-2.5 py-1 rounded-md text-[10px] font-black border border-cyan-500/50 bg-cyan-500 text-zinc-950">{t('📌 置顶', '📌 Pinned')}</span>}
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold border border-zinc-700 bg-zinc-800 text-zinc-300">{tCat(post.category)}</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors pr-32">{post.title}</h3>
            <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed mb-5 pr-32">{post.content}</p>
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">{post.avatar_url ? <Image src={post.avatar_url} width={16} height={16} alt={`${post.author} avatar`} className="w-4 h-4 rounded-full object-cover border border-zinc-700" /> : <UserIcon className="w-3.5 h-3.5" />} {post.author}</span>
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date(post.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-4"><span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> {post.comment_count || 0}</span><span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {post.views}</span></div>
            </div>
          </div>
        ))}
      </div>
    )}
    {forumView === 'detail' && selectedPost && (
      <div className="animate-in fade-in slide-in-from-right-4">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setForumView('list')} className="text-sm font-bold text-zinc-500 hover:text-white flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> {t('返回列表', 'Back to List')}</button>
          {user?.role === 'admin' && (
            <div className="flex gap-2">
              <button onClick={(e) => handlePinPost(selectedPost.id, !selectedPost.is_pinned, e)} className="text-sm font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 rounded-lg">{selectedPost.is_pinned ? t('取消置顶', 'Unpin') : t('📌 强制置顶', '📌 Force Pin')}</button>
              <button onClick={(e) => handleDeletePost(selectedPost.id, e)} className="text-sm font-bold text-red-400 hover:text-red-300 flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /> {t('彻底删帖', 'Delete Post')}</button>
            </div>
          )}
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 mb-6 shadow-xl">
          <div className="flex gap-2 mb-4 items-center">
            {selectedPost.is_pinned && <span className="px-2.5 py-1 rounded text-[10px] font-black bg-cyan-500 text-zinc-950">{t('📌 置顶', '📌 Pinned')}</span>}
            <span className="px-2.5 py-1 rounded text-xs font-bold border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">{tCat(selectedPost.category)}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-6 leading-snug">{selectedPost.title}</h1>
          <div className="flex items-center gap-4 pb-6 border-b border-zinc-800 mb-6">
            <div className="w-12 h-12 shrink-0 rounded-full bg-zinc-800 flex items-center justify-center text-xl font-black text-cyan-400 overflow-hidden border border-zinc-700 shadow-inner">
              {selectedPost.avatar_url ? <Image src={selectedPost.avatar_url} width={48} height={48} alt={`${selectedPost.author} avatar`} className="w-full h-full object-cover" /> : selectedPost.author.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-white text-base flex items-center flex-wrap gap-2">
                {selectedPost.author} 
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">OP</span>
                {(() => {
                  const opPCount = forumPosts.filter(p => p.author === selectedPost.author).length;
                  const opECount = products.filter(p => p.author === selectedPost.author).length;
                  const opRole = selectedPost.author_role || 'user'; 
                  const opBadge = getUserTitle(opPCount, opECount, opRole);
                  return <span className={`px-1.5 py-0.5 rounded text-[10px] border ${opBadge.color}`}>{opBadge.title}</span>;
                })()}
              </div>
              <div className="text-xs text-zinc-500 mt-1">{new Date(selectedPost.created_at).toLocaleString()} · {selectedPost.views} Views</div>
            </div>
          </div>
          <div className="prose prose-invert max-w-none text-zinc-300 leading-loose whitespace-pre-wrap text-sm md:text-base">{selectedPost.content}</div>
          {user && user.id !== selectedPost.author_user_id && <button onClick={()=>handleReport('post',selectedPost.id)} className="mt-6 text-xs font-bold text-amber-400 hover:text-amber-300">⚑ {t('举报此帖','Report post')}</button>}
        </div>
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 shadow-xl">
          <h3 className="font-bold text-white mb-8 flex items-center gap-2 text-lg"><MessageSquare className="w-5 h-5 text-cyan-400" /> {t('参与讨论', 'Discussions')} ({comments.length})</h3>
          <div className="space-y-6 mb-10">
            {comments.length === 0 ? <div className="text-zinc-500 text-sm text-center py-8 border border-dashed border-zinc-800 rounded-2xl">{t('暂无回复，抢个沙发吧！', 'No replies yet, be the first!')}</div> : 
              comments.map(c => {
                const cPCount = forumPosts.filter(p => p.author === c.author).length;
                const cECount = products.filter(p => p.author === c.author).length;
                const cRole = c.author_role || 'user'; 
                const cBadge = getUserTitle(cPCount, cECount, cRole);
                
                return (
                <div key={c.id} className={`flex gap-4 pb-6 border-b border-zinc-800/50 last:border-0 last:pb-0 relative group ${c.is_pinned ? 'bg-cyan-900/10 p-4 rounded-xl border border-cyan-500/20' : ''}`}>
                  <div className="w-10 h-10 shrink-0 rounded-full bg-zinc-800 flex items-center justify-center text-cyan-400 font-bold text-sm shadow-inner overflow-hidden border border-zinc-700">
                    {c.avatar_url ? <Image src={c.avatar_url} width={40} height={40} alt={`${c.author} avatar`} className="w-full h-full object-cover" /> : c.author.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 w-full overflow-hidden">
                    <div className="flex items-center flex-wrap gap-2 mb-1.5 pr-20">
                      {c.is_pinned && <span className="text-[10px] font-black text-cyan-400">{t('📌 置顶', '📌 Pinned')}</span>}
                      <span className="font-bold text-white text-sm">{c.author}</span>
                      {c.author === selectedPost.author && <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">OP</span>}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border ${cBadge.color}`}>{cBadge.title}</span>
                      <span className="text-xs text-zinc-600 ml-auto hidden sm:block">{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">{c.content}</div>
                    {user && user.id !== c.author_user_id && <button onClick={()=>handleReport('comment',c.id)} className="mt-2 text-[11px] font-bold text-amber-500 hover:text-amber-300">⚑ {t('举报评论','Report comment')}</button>}
                  </div>
                  
                  {user?.role === 'admin' && (
                    <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handlePinComment(c.id, !c.is_pinned)} className="p-1.5 bg-zinc-800 hover:bg-amber-500/20 text-zinc-500 hover:text-amber-400 rounded text-[10px] font-bold transition-colors">{c.is_pinned ? t('取消置顶', 'Unpin') : t('📌 置顶', '📌 Pin')}</button>
                      <button onClick={() => handleDeleteComment(c.id)} className="p-1.5 bg-zinc-800 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              )})}
          </div>
          <div className="relative">
            <textarea value={commentInput} onChange={e => setCommentInput(e.target.value)} placeholder={user ? t("写下你的独到见解...", "Write your insights...") : t("请先登录系统后再发表您的回复", "Please login to reply")} disabled={!user} rows="4" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-white focus:border-cyan-500 focus:outline-none resize-none mb-4 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner transition-colors"></textarea>
            <div className="flex justify-end"><button onClick={submitComment} disabled={!user || isCommenting} className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold rounded-xl text-sm transition-all shadow-[0_0_15px_rgba(8,145,178,0.3)]">{isCommenting ? t('同步中...', 'Syncing...') : t('发表回复', 'Reply')}</button></div>
          </div>
        </div>
      </div>
    )}
    {forumView === 'create' && (
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 shadow-2xl animate-in fade-in">
        <h2 className="text-2xl font-bold text-white mb-8">{t('发表新主题', 'Post New Topic')}</h2>
        <div className="space-y-6">
          <div><label className="block text-sm font-bold text-zinc-400 mb-2">{t('选择版块', 'Category')}</label><select value={newPost.category} onChange={e => setNewPost({...newPost, category: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none appearance-none">{categories.filter(c => c !== '全部').map(c => <option key={c} value={c}>{tCat(c)}</option>)}</select></div>
          <div><label className="block text-sm font-bold text-zinc-400 mb-2">{t('帖子标题', 'Title')}</label><input type="text" value={newPost.title} onChange={e => setNewPost({...newPost, title: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:outline-none" /></div>
          <div><label className="block text-sm font-bold text-zinc-400 mb-2">{t('正文内容', 'Content')}</label><textarea value={newPost.content} onChange={e => setNewPost({...newPost, content: e.target.value})} rows="12" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-cyan-500 focus:outline-none resize-none"></textarea></div>
          <div className="flex justify-end gap-4"><button onClick={() => setForumView('list')} className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-sm transition-colors">{t('取消', 'Cancel')}</button><button onClick={submitPost} className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-sm shadow-[0_0_15px_rgba(8,145,178,0.4)]">{t('发布主题', 'Publish Topic')}</button></div>
        </div>
      </div>
    )}
  </div>
</div>
  );
}
