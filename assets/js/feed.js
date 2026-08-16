(async function(){
  const ready=await window.SuspiroReady;if(!ready)return;
  const S=SuspiroState,client=await S.supabaseClient(),me=S.current();
  let selectedFiles=[],filter='all',commentPostId=null,postCache=new Map();
  const feed=document.getElementById('feed-list'),preview=document.getElementById('media-preview');
  const esc=S.esc;

  function moodFromTags(tags=[]){const item=(tags||[]).find(x=>String(x).startsWith('mood:'));return item?String(item).slice(5):''}
  function profileAvatar(profile,size=''){const url=S.profileAvatarUrl(profile);return `<div class="avatar ${size}"><img src="${url}" alt=""></div>`}
  function profileHref(profile){return profile?.id?`profile.html?user=${encodeURIComponent(profile.id)}`:'explore.html'}

  async function loadPosts(){
    let query=client.from('posts')
      .select('id,user_id,body,post_type,visibility,tags,created_at,updated_at')
      .order('created_at',{ascending:false})
      .limit(100);

    if(filter==='mine')query=query.eq('user_id',me.id);
    if(filter==='following'){
      const {data:follows,error:followsError}=await client.from('follows')
        .select('following_id').eq('follower_id',me.id).eq('status','accepted');
      if(followsError)throw followsError;
      const ids=(follows||[]).map(x=>x.following_id);
      if(!ids.length)return[];
      query=query.in('user_id',ids);
    }

    const {data:posts,error}=await query;if(error)throw error;
    if(!posts?.length)return[];
    const postIds=posts.map(p=>p.id);

    const [mediaRes,likesRes,commentsRes,savedRes]=await Promise.all([
      client.from('post_media').select('id,post_id,user_id,storage_path,media_type,sort_order').in('post_id',postIds).order('sort_order'),
      client.from('likes').select('post_id,user_id').in('post_id',postIds),
      client.from('comments').select('id,post_id,user_id,parent_comment_id,body,created_at').in('post_id',postIds).order('created_at'),
      client.from('saved_posts').select('post_id').eq('user_id',me.id).in('post_id',postIds)
    ]);
    for(const r of [mediaRes,likesRes,commentsRes,savedRes])if(r.error)throw r.error;

    const profileIds=[...new Set([
      ...posts.map(p=>p.user_id),
      ...(commentsRes.data||[]).map(c=>c.user_id)
    ])];
    const {data:profiles,error:profilesError}=profileIds.length
      ? await client.from('profiles').select('id,username,display_name,avatar_source,avatar_preset,avatar_path,is_private').in('id',profileIds)
      : {data:[],error:null};
    if(profilesError)throw profilesError;
    const profileMap=new Map((profiles||[]).map(p=>[p.id,p]));
    const savedSet=new Set((savedRes.data||[]).map(x=>x.post_id));

    const mediaRows=mediaRes.data||[];
    const mediaUrlMap=new Map();
    await Promise.all(mediaRows.map(async m=>{
      const url=await S.signedUrl('post-media',m.storage_path,3600);
      mediaUrlMap.set(m.id,url);
    }));

    return posts.map(p=>{
      const likes=(likesRes.data||[]).filter(x=>x.post_id===p.id);
      const comments=(commentsRes.data||[]).filter(x=>x.post_id===p.id).map(c=>({...c,profile:profileMap.get(c.user_id)}));
      const media=mediaRows.filter(x=>x.post_id===p.id).map(m=>({...m,url:mediaUrlMap.get(m.id)||''}));
      return {...p,profile:profileMap.get(p.user_id),media,likes,comments,saved:savedSet.has(p.id),mood:moodFromTags(p.tags)};
    });
  }

  async function render(){
    feed.innerHTML='<div class="empty-state">Carregando publicações...</div>';
    try{
      const posts=await loadPosts();
      postCache=new Map(posts.map(p=>[p.id,p]));
      if(!posts.length){feed.innerHTML='<div class="empty-state">Nenhuma publicação nesta aba ainda.</div>';return}
      feed.innerHTML=posts.map(p=>{
        const prof=p.profile||{display_name:'Usuário',username:'usuario',avatar_preset:'guitar'};
        const own=p.user_id===me.id;
        const liked=p.likes.some(x=>x.user_id===me.id);
        const media=p.media.map(m=>m.url?(m.media_type==='video'?`<video class="post-video" src="${m.url}" controls preload="metadata"></video>`:`<img src="${m.url}" alt="Imagem da publicação">`):'').join('');
        const href=profileHref(prof);
        return `<article class="post" data-id="${p.id}"><a class="profile-link-avatar" href="${href}">${profileAvatar(prof)}</a><div class="post-body"><div class="post-head"><a class="profile-link-name" href="${href}"><strong>${esc(prof.display_name||prof.username)}</strong><span class="handle">@${esc(prof.username)}</span></a><span class="time">· ${S.timeAgo(p.created_at)}</span>${p.post_type==='dump'?'<span class="tagline">dump</span>':''}${own?`<button class="post-more" data-delete-post="${p.id}" title="Excluir publicação">⋯</button>`:''}</div><div class="post-text">${esc(p.body||'')}${p.mood?` <span class="post-mood">${esc(p.mood)}</span>`:''}</div>${media?`<div class="post-media real-media ${p.media.length===1?'single':''}">${media}</div>`:''}<div class="post-actions"><button class="post-action like ${liked?'liked':''}" data-like="${p.id}">♡ <span>${p.likes.length}</span></button><button class="post-action" data-comments="${p.id}">◌ ${p.comments.length}</button><button class="post-action" data-share="${p.id}">↗</button><button class="post-action ${p.saved?'bookmarked':''}" data-bookmark="${p.id}">⌑</button></div></div></article>`;
      }).join('');
      bindPostActions();
    }catch(error){console.error(error);feed.innerHTML=`<div class="empty-state">${esc(S.friendlyError(error))}</div>`}
  }

  function bindPostActions(){
    feed.querySelectorAll('[data-like]').forEach(btn=>btn.onclick=async()=>{
      const p=postCache.get(btn.dataset.like);if(!p)return;
      btn.disabled=true;
      try{
        const liked=p.likes.some(x=>x.user_id===me.id);
        const q=liked
          ? client.from('likes').delete().eq('post_id',p.id).eq('user_id',me.id)
          : client.from('likes').insert({post_id:p.id,user_id:me.id});
        const {error}=await q;if(error)throw error;await render();
      }catch(error){toast(S.friendlyError(error))}finally{btn.disabled=false}
    });

    feed.querySelectorAll('[data-bookmark]').forEach(btn=>btn.onclick=async()=>{
      const p=postCache.get(btn.dataset.bookmark);if(!p)return;
      btn.disabled=true;
      try{
        const q=p.saved
          ? client.from('saved_posts').delete().eq('post_id',p.id).eq('user_id',me.id)
          : client.from('saved_posts').insert({post_id:p.id,user_id:me.id});
        const {error}=await q;if(error)throw error;await render();
      }catch(error){toast(S.friendlyError(error))}finally{btn.disabled=false}
    });

    feed.querySelectorAll('[data-comments]').forEach(btn=>btn.onclick=()=>openComments(btn.dataset.comments));
    feed.querySelectorAll('[data-delete-post]').forEach(btn=>btn.onclick=async()=>{
      if(!confirm('Excluir esta publicação?'))return;
      const p=postCache.get(btn.dataset.deletePost);if(!p)return;
      try{
        const paths=p.media.map(m=>m.storage_path).filter(Boolean);
        if(paths.length)await client.storage.from('post-media').remove(paths);
        const {error}=await client.from('posts').delete().eq('id',p.id);if(error)throw error;
        toast('Publicação excluída.');await render();
      }catch(error){toast(S.friendlyError(error))}
    });

    feed.querySelectorAll('[data-share]').forEach(btn=>btn.onclick=async()=>{
      const url=new URL(location.href);url.searchParams.set('post',btn.dataset.share);
      try{await navigator.clipboard.writeText(url.href);toast('Link da publicação copiado.')}catch(e){toast('Não foi possível copiar o link.')}
    });
  }

  function renderPreview(){
    preview.innerHTML='';
    selectedFiles.forEach((file,i)=>{
      const url=URL.createObjectURL(file),wrap=document.createElement('div');wrap.className='preview-item';
      wrap.innerHTML=file.type.startsWith('video/')?`<video src="${url}" muted></video>`:`<img src="${url}" alt="Prévia">`;
      const b=document.createElement('button');b.type='button';b.textContent='×';b.onclick=()=>{selectedFiles.splice(i,1);renderPreview()};wrap.appendChild(b);preview.appendChild(wrap);
    });
  }

  document.getElementById('pick-images').onclick=()=>document.getElementById('image-input').click();
  document.getElementById('pick-video').onclick=()=>document.getElementById('video-input').click();
  document.getElementById('image-input').onchange=e=>{const files=[...e.target.files].slice(0,6);selectedFiles=selectedFiles.filter(f=>!f.type.startsWith('video/')).concat(files).slice(0,6);renderPreview();e.target.value=''};
  document.getElementById('video-input').onchange=e=>{const f=e.target.files[0];if(f){selectedFiles=[f];renderPreview()}e.target.value=''};
  document.querySelectorAll('.mood-chip').forEach(c=>c.onclick=()=>{const was=c.classList.contains('active');document.querySelectorAll('.mood-chip').forEach(x=>x.classList.remove('active'));if(!was)c.classList.add('active')});

  document.getElementById('publish-post').onclick=async()=>{
    const button=document.getElementById('publish-post'),t=document.getElementById('composer-text'),text=t.value.trim();
    if(!text&&!selectedFiles.length){toast('Escreva algo ou adicione uma foto/vídeo.');return}
    if(selectedFiles.some(f=>f.size>50*1024*1024)){toast('Cada arquivo pode ter no máximo 50 MB.');return}
    const mood=document.querySelector('.mood-chip.active')?.dataset.mood||'';
    button.disabled=true;button.textContent='Publicando...';
    let createdPost=null,uploaded=[];
    try{
      const {data:post,error:postError}=await client.from('posts').insert({
        user_id:me.id,
        body:text||null,
        post_type:selectedFiles.length?'dump':'thought',
        visibility:'public',
        tags:mood?[`mood:${mood}`]:[]
      }).select().single();
      if(postError)throw postError;createdPost=post;

      for(let i=0;i<selectedFiles.length;i++){
        const file=selectedFiles[i];
        const ext=(file.name.split('.').pop()|| (file.type.startsWith('video/')?'mp4':'jpg')).replace(/[^a-z0-9]/gi,'').toLowerCase();
        const path=`${me.id}/${post.id}/${crypto.randomUUID()}.${ext}`;
        const {error:uploadError}=await client.storage.from('post-media').upload(path,file,{contentType:file.type,upsert:false});
        if(uploadError)throw uploadError;uploaded.push(path);
        const {error:mediaError}=await client.from('post_media').insert({post_id:post.id,user_id:me.id,storage_path:path,media_type:file.type.startsWith('video/')?'video':'image',sort_order:i});
        if(mediaError)throw mediaError;
      }

      t.value='';selectedFiles=[];renderPreview();document.querySelectorAll('.mood-chip').forEach(x=>x.classList.remove('active'));
      toast('Publicado no seu feed.');await render();
    }catch(error){
      console.error(error);
      if(uploaded.length)await client.storage.from('post-media').remove(uploaded);
      if(createdPost)await client.from('posts').delete().eq('id',createdPost.id);
      toast(S.friendlyError(error));
    }finally{button.disabled=false;button.textContent='Publicar'}
  };

  document.querySelectorAll('[data-feed-filter]').forEach(btn=>btn.onclick=()=>{filter=btn.dataset.feedFilter;document.querySelectorAll('[data-feed-filter]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');render()});

  function openComments(id){
    commentPostId=id;const p=postCache.get(id);if(!p)return;
    document.getElementById('comments-title').textContent=`@${p.profile?.username||'usuario'}`;renderComments(p);openModal('comments-modal');
  }
  function renderComments(p){
    const root=document.getElementById('comments-list');
    root.innerHTML=p.comments.length?p.comments.map(c=>{
      const prof=c.profile||{display_name:'Usuário',username:'usuario',avatar_preset:'guitar'};
      const href=profileHref(prof);
      return `<div class="comment"><a class="profile-link-avatar" href="${href}">${profileAvatar(prof,'sm')}</a><div><a class="profile-link-name" href="${href}"><strong>${esc(prof.display_name||prof.username)}</strong><span>@${esc(prof.username)}</span></a><p>${esc(c.body)}</p></div></div>`;
    }).join(''):'<div class="empty-mini">Seja a primeira pessoa a comentar.</div>';
  }

  document.getElementById('comment-form').onsubmit=async e=>{
    e.preventDefault();const input=document.getElementById('comment-input'),text=input.value.trim();if(!text||!commentPostId)return;
    const button=e.target.querySelector('button');button.disabled=true;
    try{
      const {error}=await client.from('comments').insert({post_id:commentPostId,user_id:me.id,body:text});if(error)throw error;
      input.value='';await render();const p=postCache.get(commentPostId);if(p)renderComments(p);toast('Comentário enviado.');
    }catch(error){toast(S.friendlyError(error))}finally{button.disabled=false}
  };

  async function renderSuggestions(){
    const root=document.getElementById('feed-suggestions');
    try{
      const {data:people,error}=await client.from('profiles')
        .select('id,username,display_name,avatar_source,avatar_preset,avatar_path,is_private')
        .neq('id',me.id).limit(3);
      if(error)throw error;
      const ids=(people||[]).map(p=>p.id);
      const {data:follows}=ids.length?await client.from('follows').select('following_id,status').eq('follower_id',me.id).in('following_id',ids):{data:[]};
      const followMap=new Map((follows||[]).map(f=>[f.following_id,f.status]));
      root.innerHTML=(people||[]).map(p=>{
        const status=followMap.get(p.id),href=profileHref(p);return `<div class="suggestion"><a class="profile-link-avatar" href="${href}">${profileAvatar(p,'sm')}</a><a class="meta profile-link-name" href="${href}"><strong>@${esc(p.username)}</strong><span>${p.is_private?'Perfil privado':'Perfil público'}</span></a><button class="btn ${status?'btn-primary':'btn-outline'} btn-sm" data-suggest-id="${p.id}">${status==='pending'?'Solicitado':status?'Seguindo':'Seguir'}</button></div>`;
      }).join('')||'<span class="muted">Sem sugestões por enquanto.</span>';
      root.querySelectorAll('[data-suggest-id]').forEach(btn=>btn.onclick=async()=>{
        const p=people.find(x=>x.id===btn.dataset.suggestId);if(!p)return;btn.disabled=true;
        try{const status=await S.toggleFollow(p);btn.textContent=status==='pending'?'Solicitado':status?'Seguindo':'Seguir';btn.classList.toggle('btn-primary',!!status);btn.classList.toggle('btn-outline',!status)}catch(error){toast(S.friendlyError(error))}finally{btn.disabled=false}
      });
    }catch(error){root.innerHTML='<span class="muted">Não foi possível carregar sugestões.</span>'}
  }

  await renderSuggestions();
  await render();
})();
