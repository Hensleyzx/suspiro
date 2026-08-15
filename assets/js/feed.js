(function(){
 const S=SuspiroState, me=S.current();let selectedFiles=[],filter='all',commentPostId=null;
 const feed=document.getElementById('feed-list'),preview=document.getElementById('media-preview');
 const esc=S.esc;
 function authorAvatar(p){if(p.authorId===me.id&&me.avatar)return `<div class="avatar" data-own-post-avatar>${esc(me.name[0])}</div>`;return `<div class="avatar">${esc((p.author||'?')[0])}</div>`}
 async function hydrateOwnAvatars(root=document){const url=await S.mediaUrl(me.avatar);if(url)root.querySelectorAll('[data-own-post-avatar]').forEach(el=>el.innerHTML=`<img src="${url}" alt="">`)}
 async function mediaHtml(media=[]){let out='';for(const m of media){const url=await S.mediaUrl(m);if(!url)continue;out+=m.kind==='video'?`<video class="post-video" src="${url}" controls preload="metadata"></video>`:`<img src="${url}" alt="Imagem da publicação">`}return out}
 async function render(){
   const state=S.load();let posts=[...state.posts].sort((a,b)=>b.createdAt-a.createdAt);
   if(filter==='following')posts=posts.filter(p=>state.following.includes(p.user));
   if(filter==='mine')posts=posts.filter(p=>p.authorId===state.sessionUserId);
   if(!posts.length){feed.innerHTML='<div class="empty-state">Nenhuma publicação nesta aba ainda.</div>';return}
   const cards=[];
   for(const p of posts){const media=await mediaHtml(p.media);const own=p.authorId===state.sessionUserId;const bookmarked=state.bookmarks.includes(p.id);cards.push(`<article class="post" data-id="${p.id}">${authorAvatar(p)}<div class="post-body"><div class="post-head"><strong>${esc(p.author)}</strong><span class="handle">@${esc(p.user)}</span><span class="time">· ${S.timeAgo(p.createdAt)}</span>${p.kind==='dump'?'<span class="tagline">dump</span>':''}${own?`<button class="post-more" data-delete-post="${p.id}" title="Excluir publicação">⋯</button>`:''}</div><div class="post-text">${esc(p.text)}${p.mood?` <span class="post-mood">${esc(p.mood)}</span>`:''}</div>${media?`<div class="post-media real-media ${p.media.length===1?'single':''}">${media}</div>`:''}<div class="post-actions"><button class="post-action like ${p.liked?'liked':''}" data-like="${p.id}">♡ <span>${p.likes}</span></button><button class="post-action" data-comments="${p.id}">◌ ${p.comments.length}</button><button class="post-action" data-share="${p.id}">↗</button><button class="post-action ${bookmarked?'bookmarked':''}" data-bookmark="${p.id}">⌑</button></div></div></article>`)}
   feed.innerHTML=cards.join('');await hydrateOwnAvatars(feed);bindPostActions();
 }
 function saveMutator(fn){const state=S.load();fn(state);S.save(state);render()}
 function bindPostActions(){
   feed.querySelectorAll('[data-like]').forEach(btn=>btn.onclick=()=>saveMutator(st=>{const p=st.posts.find(x=>x.id===btn.dataset.like);if(!p)return;p.liked=!p.liked;p.likes=Math.max(0,p.likes+(p.liked?1:-1))}));
   feed.querySelectorAll('[data-bookmark]').forEach(btn=>btn.onclick=()=>saveMutator(st=>{const id=btn.dataset.bookmark,i=st.bookmarks.indexOf(id);if(i>=0)st.bookmarks.splice(i,1);else st.bookmarks.push(id)}));
   feed.querySelectorAll('[data-comments]').forEach(btn=>btn.onclick=()=>openComments(btn.dataset.comments));
   feed.querySelectorAll('[data-delete-post]').forEach(btn=>btn.onclick=()=>{if(confirm('Excluir esta publicação?'))saveMutator(st=>st.posts=st.posts.filter(p=>p.id!==btn.dataset.deletePost))});
   feed.querySelectorAll('[data-share]').forEach(btn=>btn.onclick=async()=>{const text=`Suspiro • publicação ${btn.dataset.share}`;try{await navigator.clipboard.writeText(text);toast('Referência da publicação copiada.')}catch(e){toast('Compartilhamento preparado para esta publicação.')}});
 }
 function renderPreview(){preview.innerHTML='';selectedFiles.forEach((file,i)=>{const url=URL.createObjectURL(file),wrap=document.createElement('div');wrap.className='preview-item';wrap.innerHTML=file.type.startsWith('video/')?`<video src="${url}" muted></video>`:`<img src="${url}" alt="Prévia">`;const b=document.createElement('button');b.type='button';b.textContent='×';b.onclick=()=>{selectedFiles.splice(i,1);renderPreview()};wrap.appendChild(b);preview.appendChild(wrap)})}
 document.getElementById('pick-images').onclick=()=>document.getElementById('image-input').click();
 document.getElementById('pick-video').onclick=()=>document.getElementById('video-input').click();
 document.getElementById('image-input').onchange=e=>{const files=[...e.target.files].slice(0,6);selectedFiles=selectedFiles.filter(f=>!f.type.startsWith('video/')).concat(files).slice(0,6);renderPreview();e.target.value=''};
 document.getElementById('video-input').onchange=e=>{const f=e.target.files[0];if(f){selectedFiles=[f];renderPreview()}e.target.value=''};
 document.querySelectorAll('.mood-chip').forEach(c=>c.onclick=()=>{document.querySelectorAll('.mood-chip').forEach(x=>x.classList.remove('active'));c.classList.toggle('active')});
 document.getElementById('publish-post').onclick=async()=>{
   const t=document.getElementById('composer-text'),text=t.value.trim();if(!text&&!selectedFiles.length){toast('Escreva algo ou adicione uma foto/vídeo.');return}
   const mood=document.querySelector('.mood-chip.active')?.dataset.mood||'';const media=[];
   for(const f of selectedFiles){if(f.size>20*1024*1024){toast('Arquivos de até 20 MB nesta versão.');return}const mediaId=await S.putMedia(f);media.push({kind:f.type.startsWith('video/')?'video':'image',mediaId})}
   const st=S.load(),p=S.current();st.posts.unshift({id:S.uid('post'),authorId:p.id,author:p.name,user:p.username,createdAt:Date.now(),text,kind:media.length?'dump':'thought',mood,media,likes:0,liked:false,comments:[]});S.save(st);t.value='';selectedFiles=[];renderPreview();document.querySelectorAll('.mood-chip').forEach(x=>x.classList.remove('active'));toast('Publicado no seu feed.');render();
 };
 document.querySelectorAll('[data-feed-filter]').forEach(btn=>btn.onclick=()=>{filter=btn.dataset.feedFilter;document.querySelectorAll('[data-feed-filter]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');render()});
 function openComments(id){commentPostId=id;const p=S.load().posts.find(x=>x.id===id);if(!p)return;document.getElementById('comments-title').textContent=`@${p.user}`;renderComments(p);openModal('comments-modal')}
 function renderComments(p){const root=document.getElementById('comments-list');root.innerHTML=p.comments.length?p.comments.map(c=>`<div class="comment"><div class="avatar sm">${esc((c.name||'?')[0])}</div><div><strong>${esc(c.name||c.user)}</strong><span>@${esc(c.user)}</span><p>${esc(c.text)}</p></div></div>`).join(''):'<div class="empty-mini">Seja a primeira pessoa a comentar.</div>'}
 document.getElementById('comment-form').onsubmit=e=>{e.preventDefault();const input=document.getElementById('comment-input'),text=input.value.trim();if(!text)return;const st=S.load(),p=st.posts.find(x=>x.id===commentPostId);if(!p)return;p.comments.push({id:S.uid('comment'),user:me.username,name:me.name,text});S.save(st);input.value='';renderComments(p);render();toast('Comentário enviado.')};
 function renderSuggestions(){const root=document.getElementById('feed-suggestions'),people=S.load().people.slice(0,3);root.innerHTML=people.map(p=>`<div class="suggestion"><div class="avatar sm">${esc(p.avatar||p.name[0])}</div><div class="meta"><strong>@${esc(p.username)}</strong><span>${S.compatibility(p)}% em comum</span></div><button class="btn btn-outline btn-sm" data-follow-user="${esc(p.username)}">Seguir</button></div>`).join('');root.querySelectorAll('[data-follow-user]').forEach(btn=>{const u=btn.dataset.followUser;const sync=()=>{const on=S.isFollowing(u);btn.textContent=on?'Seguindo':'Seguir';btn.classList.toggle('btn-primary',on);btn.classList.toggle('btn-outline',!on)};sync();btn.onclick=()=>{S.toggleFollow(u);sync()}})}
 renderSuggestions();render();
})();
