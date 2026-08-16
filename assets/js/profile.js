(async function(){
  const ready=await window.SuspiroReady;if(!ready)return;
  const S=SuspiroState,client=await S.supabaseClient();
  let me=S.current(),meRaw=S.currentRaw(),viewedRaw=null,viewed=null,viewedFavorites=[],filter='all',followStatus=null;
  const covers={book:'assets/img/book-cover.svg',movie:'assets/img/movie-cover.svg',game:'assets/img/game-cover.svg',music:'assets/img/album.svg'};
  const labels={book:'Livro',movie:'Filme',game:'Jogo',music:'Música'};
  const profileForm=document.getElementById('profile-form');
  const target=new URLSearchParams(location.search).get('user');

  function normalizeTarget(raw){
    return {
      id:raw.id,
      name:raw.display_name||raw.username,
      username:raw.username,
      bio:raw.bio||'',
      avatar:{src:S.profileAvatarUrl(raw)},
      cover:{src:S.profileCoverUrl(raw)},
      isPrivate:!!raw.is_private
    };
  }

  function isOwn(){return !!viewedRaw&&viewedRaw.id===me.id}
  function profileHref(id){return `profile.html?user=${encodeURIComponent(id)}`}

  async function resolveViewedProfile(){
    if(!target||target===me.id||target.replace(/^@/,'').toLowerCase()===me.username.toLowerCase()){
      viewedRaw=meRaw;
      viewed={...me};
      return;
    }
    let data=null,error=null;
    if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(target)){
      const res=await client.from('profiles').select('id,username,display_name,bio,avatar_source,avatar_preset,avatar_path,cover_path,is_private,created_at').eq('id',target).maybeSingle();
      data=res.data;error=res.error;
    }else{
      const clean=target.replace(/^@/,'');
      const res=await client.from('profiles').select('id,username,display_name,bio,avatar_source,avatar_preset,avatar_path,cover_path,is_private,created_at').ilike('username',clean).maybeSingle();
      data=res.data;error=res.error;
    }
    if(error)throw error;
    if(!data){
      document.getElementById('profile-name').textContent='Perfil não encontrado';
      document.getElementById('profile-bio').textContent='Esse perfil não existe ou não está disponível.';
      document.getElementById('profile-posts').innerHTML='<div class="empty-state">Perfil não encontrado.</div>';
      return;
    }
    viewedRaw=data;
    viewed=normalizeTarget(data);
  }

  function selectPreset(src){
    if(!profileForm)return;
    profileForm.presetAvatar.value=src||'';
    profileForm.querySelectorAll('[data-avatar-preset]').forEach(b=>{
      const on=b.dataset.avatarPreset===src;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on?'true':'false');
    });
    if(src)profileForm.avatar.value='';
  }
  profileForm?.querySelectorAll('[data-avatar-preset]').forEach(btn=>btn.addEventListener('click',()=>selectPreset(btn.dataset.avatarPreset)));
  profileForm?.avatar.addEventListener('change',()=>{if(profileForm.avatar.files[0])selectPreset('')});

  async function getStats(){
    const [posts,followers,following]=await Promise.all([
      client.from('posts').select('id',{count:'exact',head:true}).eq('user_id',viewed.id),
      client.from('follows').select('follower_id',{count:'exact',head:true}).eq('following_id',viewed.id).eq('status','accepted'),
      client.from('follows').select('following_id',{count:'exact',head:true}).eq('follower_id',viewed.id).eq('status','accepted')
    ]);
    return{posts:posts.count||0,followers:followers.count||0,following:following.count||0};
  }

  async function loadFavorites(){
    if(isOwn()){
      await S.refreshCurrent();me=S.current();meRaw=S.currentRaw();
      viewedFavorites=S.currentFavorites()||[];
      return viewedFavorites;
    }
    const {data,error}=await client.from('profile_favorites')
      .select('id,user_id,category,title,subtitle,image_url,position')
      .eq('user_id',viewed.id).order('category').order('position');
    if(error)throw error;
    viewedFavorites=data||[];
    return viewedFavorites;
  }

  function favoriteRow(category){return viewedFavorites.find(x=>x.category===category&&x.position===1)||null}

  async function loadPosts(){
    let q=client.from('posts').select('id,user_id,body,post_type,tags,created_at').eq('user_id',viewed.id).order('created_at',{ascending:false});
    if(filter!=='all')q=q.eq('post_type',filter);
    const {data:posts,error}=await q;if(error)throw error;if(!posts?.length)return[];
    const ids=posts.map(p=>p.id);
    const [mediaRes,likesRes,commentsRes]=await Promise.all([
      client.from('post_media').select('id,post_id,storage_path,media_type,sort_order').in('post_id',ids).order('sort_order'),
      client.from('likes').select('post_id,user_id').in('post_id',ids),
      client.from('comments').select('id,post_id').in('post_id',ids)
    ]);
    for(const r of [mediaRes,likesRes,commentsRes])if(r.error)throw r.error;
    const mediaRows=mediaRes.data||[];const urlMap=new Map();
    await Promise.all(mediaRows.map(async m=>urlMap.set(m.id,await S.signedUrl('post-media',m.storage_path,3600))));
    return posts.map(p=>({
      ...p,
      mood:(p.tags||[]).find(x=>String(x).startsWith('mood:'))?.slice(5)||'',
      media:mediaRows.filter(m=>m.post_id===p.id).map(m=>({...m,url:urlMap.get(m.id)||''})),
      likes:(likesRes.data||[]).filter(x=>x.post_id===p.id).length,
      comments:(commentsRes.data||[]).filter(x=>x.post_id===p.id).length
    }));
  }

  function renderFavoriteGrid(){
    const root=document.getElementById('favorite-grid');
    root.innerHTML=Object.keys(labels).map(k=>{
      const row=favoriteRow(k),title=row?.title||'Não definido',img=row?.image_url||covers[k];
      return `<div class="favorite-card"><div class="cover-image"><img src="${S.esc(img)}" alt="${labels[k]}" onerror="this.src='${covers[k]}'"></div><small>${labels[k]}</small><strong title="${S.esc(title)}">${S.esc(title)}</strong></div>`;
    }).join('');
  }

  async function renderPosts(){
    const root=document.getElementById('profile-posts');root.innerHTML='<div class="empty-state">Carregando...</div>';
    try{
      const posts=await loadPosts();
      if(!posts.length){
        const privateMsg=!isOwn()&&viewed.isPrivate&&followStatus?.status!=='accepted'
          ?'Este perfil é privado. Siga a pessoa e aguarde a aprovação para ver as publicações.'
          :isOwn()?'Você ainda não tem publicações nesta aba.':'Nenhuma publicação nesta aba ainda.';
        root.innerHTML=`<div class="empty-state">${privateMsg}</div>`;return;
      }
      root.innerHTML=posts.map(post=>{
        const media=post.media.map(m=>m.url?(m.media_type==='video'?`<video src="${m.url}" controls class="post-video"></video>`:`<img src="${m.url}" alt="Imagem">`):'').join('');
        return `<article class="post"><a class="profile-link-avatar" href="${profileHref(viewed.id)}"><div class="avatar"><img src="${viewed.avatar.src}" alt=""></div></a><div class="post-body"><div class="post-head"><a class="profile-link-name" href="${profileHref(viewed.id)}"><strong>${S.esc(viewed.name)}</strong><span class="handle">@${S.esc(viewed.username)}</span></a><span class="time">· ${S.timeAgo(post.created_at)}</span></div><div class="post-text">${S.esc(post.body||'')}${post.mood?` <span class="post-mood">${S.esc(post.mood)}</span>`:''}</div>${media?`<div class="post-media real-media ${post.media.length===1?'single':''}">${media}</div>`:''}<div class="post-actions"><span class="post-action">♡ ${post.likes}</span><span class="post-action">◌ ${post.comments}</span></div></div></article>`;
      }).join('');
    }catch(error){root.innerHTML=`<div class="empty-state">${S.esc(S.friendlyError(error))}</div>`}
  }

  async function refreshFollowButton(){
    const btn=document.getElementById('profile-follow');
    if(isOwn()){btn.hidden=true;followStatus=null;return}
    followStatus=await S.getFollow(viewed.id);
    btn.hidden=false;
    btn.textContent=followStatus?.status==='pending'?'Solicitado':followStatus?.status==='accepted'?'Seguindo':'Seguir';
    btn.classList.toggle('btn-primary',!!followStatus);
    btn.classList.toggle('btn-outline',!followStatus);
  }

  async function render(){
    await S.refreshCurrent();me=S.current();meRaw=S.currentRaw();if(!me)return;
    await resolveViewedProfile();if(!viewed)return;
    await refreshFollowButton();
    await loadFavorites();
    const stats=await getStats();
    document.title=`${viewed.name} — Suspiro`;
    document.getElementById('profile-page-subtitle').textContent=isOwn()?'Seu espaço dentro do Suspiro.':`Perfil de @${viewed.username}`;
    document.getElementById('profile-name').textContent=viewed.name;
    document.getElementById('profile-username').textContent='@'+viewed.username;
    document.getElementById('profile-bio').textContent=viewed.bio||'Sem bio ainda.';
    document.getElementById('stat-posts').textContent=stats.posts;
    document.getElementById('stat-followers').textContent=stats.followers;
    document.getElementById('stat-following').textContent=stats.following;
    document.getElementById('profile-avatar').innerHTML=`<img src="${viewed.avatar.src}" alt="Foto de perfil">`;
    document.getElementById('profile-cover').style.backgroundImage=`linear-gradient(180deg,transparent,rgba(5,4,8,.55)),url("${viewed.cover.src}")`;
    renderFavoriteGrid();

    document.getElementById('edit-profile').hidden=!isOwn();
    document.getElementById('edit-profile-2').hidden=!isOwn();
    document.getElementById('edit-favorites').hidden=!isOwn();
    document.getElementById('new-post').hidden=!isOwn();
    const msg=document.getElementById('profile-message');msg.hidden=isOwn();msg.href=`messages.html?user=${encodeURIComponent(viewed.id)}`;

    if(isOwn()){
      document.getElementById('about-list').innerHTML=`<div class="about-row"><span>Nome</span><strong>${S.esc(me.name)}</strong></div><div class="about-row"><span>Usuário</span><strong>@${S.esc(me.username)}</strong></div><div class="about-row"><span>Bio</span><strong>${S.esc(me.bio||'')}</strong></div><div class="about-row"><span>Cidade</span><strong>${S.esc(me.city||'—')}</strong></div><div class="about-row"><span>Links</span><strong>${(me.links||[]).map(S.esc).join('<br>')||'—'}</strong></div>`;
    }else{
      document.getElementById('about-list').innerHTML=`<div class="about-row"><span>Nome</span><strong>${S.esc(viewed.name)}</strong></div><div class="about-row"><span>Usuário</span><strong>@${S.esc(viewed.username)}</strong></div><div class="about-row"><span>Bio</span><strong>${S.esc(viewed.bio||'—')}</strong></div><div class="about-row"><span>Privacidade</span><strong>${viewed.isPrivate?'Perfil privado':'Perfil público'}</strong></div>`;
    }
    await renderPosts();
    await refreshCommonProfile();
  }

  function fillProfileForm(){
    if(!isOwn())return;
    const f=profileForm;f.name.value=me.name;f.username.value=me.username;f.bio.value=me.bio||'';f.city.value=me.city||'';f.links.value=(me.links||[]).join('\n');f.avatar.value='';f.cover.value='';
    selectPreset(meRaw.avatar_source==='preset'?S.avatarPresetPath(meRaw.avatar_preset):'');openModal('profile-modal');
  }
  document.getElementById('edit-profile').onclick=fillProfileForm;document.getElementById('edit-profile-2').onclick=fillProfileForm;

  profileForm.onsubmit=async e=>{
    e.preventDefault();if(!isOwn())return;
    const f=e.target;const button=f.querySelector('button[type="submit"],button.btn-primary:last-child');
    const username=f.username.value.trim().replace(/^@/,'').toLowerCase();
    if(!/^[a-z0-9._]{3,30}$/.test(username)){toast('Usuário: 3 a 30 caracteres, usando letras, números, ponto ou underline.');return}
    const avatarFile=f.avatar.files[0],coverFile=f.cover.files[0];
    if(avatarFile&&avatarFile.size>5*1024*1024){toast('A foto de perfil pode ter até 5 MB.');return}
    if(coverFile&&coverFile.size>8*1024*1024){toast('A capa pode ter até 8 MB.');return}
    button.disabled=true;const oldAvatarPath=meRaw.avatar_path,oldCoverPath=meRaw.cover_path;let newAvatarPath=null,newCoverPath=null;
    try{
      const patch={display_name:f.name.value.trim(),username,bio:f.bio.value.trim()};
      if(avatarFile){
        const ext=(avatarFile.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase();newAvatarPath=`${me.id}/${crypto.randomUUID()}.${ext}`;
        const {error}=await client.storage.from('avatars').upload(newAvatarPath,avatarFile,{contentType:avatarFile.type,upsert:false});if(error)throw error;
        Object.assign(patch,{avatar_source:'upload',avatar_path:newAvatarPath});
      }else if(f.presetAvatar.value){Object.assign(patch,{avatar_source:'preset',avatar_preset:S.avatarPresetKey(f.presetAvatar.value),avatar_path:null})}
      if(coverFile){
        const ext=(coverFile.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase();newCoverPath=`${me.id}/${crypto.randomUUID()}.${ext}`;
        const {error}=await client.storage.from('covers').upload(newCoverPath,coverFile,{contentType:coverFile.type,upsert:false});if(error)throw error;patch.cover_path=newCoverPath;
      }
      const {error:updateError}=await client.from('profiles').update(patch).eq('id',me.id);if(updateError)throw updateError;
      await S.updateContentPreferences({city:f.city.value.trim(),links:f.links.value.split('\n').map(x=>x.trim()).filter(Boolean)});
      if(newAvatarPath&&oldAvatarPath)await client.storage.from('avatars').remove([oldAvatarPath]);
      if(f.presetAvatar.value&&oldAvatarPath)await client.storage.from('avatars').remove([oldAvatarPath]);
      if(newCoverPath&&oldCoverPath)await client.storage.from('covers').remove([oldCoverPath]);
      closeModal('profile-modal');toast('Perfil atualizado.');await render();
    }catch(error){
      if(newAvatarPath)await client.storage.from('avatars').remove([newAvatarPath]);
      if(newCoverPath)await client.storage.from('covers').remove([newCoverPath]);
      toast(S.friendlyError(error));
    }finally{button.disabled=false}
  };

  function publicFavoritePath(url){
    const prefix=`${S.SUPABASE_URL}/storage/v1/object/public/covers/`;
    if(!url||!String(url).startsWith(prefix))return null;
    try{return String(url).slice(prefix.length).split('/').map(decodeURIComponent).join('/')}catch(e){return null}
  }

  document.getElementById('edit-favorites').onclick=()=>{
    if(!isOwn())return;
    const f=document.getElementById('favorites-form');
    for(const k of Object.keys(labels)){
      const row=favoriteRow(k);f[k].value=row?.title||'';f[`${k}_image_url`].value=row?.image_url||'';f[`${k}_image_file`].value='';
    }
    f.tags.value=(me.favoriteTags||[]).join(', ');openModal('favorites-modal');
  };

  document.getElementById('favorites-form').onsubmit=async e=>{
    e.preventDefault();if(!isOwn())return;
    const f=e.target,button=f.querySelector('button.btn-primary');button.disabled=true;
    const uploaded=[],removeAfter=[];
    try{
      for(const category of Object.keys(labels)){
        const title=f[category].value.trim();
        const old=favoriteRow(category);const oldStored=publicFavoritePath(old?.image_url);
        if(!title){
          const {error}=await client.from('profile_favorites').delete().eq('user_id',me.id).eq('category',category).eq('position',1);if(error)throw error;
          if(oldStored)removeAfter.push(oldStored);
          continue;
        }
        const file=f[`${category}_image_file`].files[0];
        if(file&&file.size>8*1024*1024)throw new Error(`A capa de ${labels[category].toLowerCase()} pode ter até 8 MB.`);
        let imageUrl=f[`${category}_image_url`].value.trim()||null;
        if(file){
          const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase();
          const path=`${me.id}/favorites/${category}-${crypto.randomUUID()}.${ext}`;
          const {error:upErr}=await client.storage.from('covers').upload(path,file,{contentType:file.type,upsert:false});if(upErr)throw upErr;
          uploaded.push(path);imageUrl=S.publicStorageUrl('covers',path);
        }
        const {error}=await client.from('profile_favorites').upsert({user_id:me.id,category,title,image_url:imageUrl,position:1},{onConflict:'user_id,category,position'});if(error)throw error;
        if(oldStored&&imageUrl!==old?.image_url)removeAfter.push(oldStored);
      }
      await S.updateContentPreferences({tags:f.tags.value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)});
      if(removeAfter.length)await client.storage.from('covers').remove([...new Set(removeAfter)]);
      closeModal('favorites-modal');toast('Favoritos e capas atualizados.');await render();
    }catch(error){
      if(uploaded.length)await client.storage.from('covers').remove(uploaded);
      toast(S.friendlyError(error));
    }finally{button.disabled=false}
  };

  document.getElementById('profile-follow').onclick=async()=>{
    if(isOwn())return;const btn=document.getElementById('profile-follow');btn.disabled=true;
    try{const status=await S.toggleFollow(viewedRaw);followStatus=status?{status}:null;btn.textContent=status==='pending'?'Solicitado':status==='accepted'?'Seguindo':'Seguir';btn.classList.toggle('btn-primary',!!status);btn.classList.toggle('btn-outline',!status);toast(status==='pending'?'Solicitação enviada.':status==='accepted'?`Agora você segue @${viewed.username}.`:`Você deixou de seguir @${viewed.username}.`);await renderPosts()}catch(error){toast(S.friendlyError(error))}finally{btn.disabled=false}
  };

  async function openConnections(mode){
    const title=mode==='followers'?'Seguidores':'Seguindo';
    document.getElementById('connections-title').textContent=title;
    document.getElementById('connections-subtitle').textContent=`@${viewed.username}`;
    const root=document.getElementById('connections-list');root.innerHTML='<div class="empty-mini">Carregando...</div>';openModal('connections-modal');
    try{
      const q=mode==='followers'
        ?client.from('follows').select('follower_id,following_id,status').eq('following_id',viewed.id).eq('status','accepted')
        :client.from('follows').select('follower_id,following_id,status').eq('follower_id',viewed.id).eq('status','accepted');
      const {data,error}=await q;if(error)throw error;
      const ids=(data||[]).map(x=>mode==='followers'?x.follower_id:x.following_id);
      if(!ids.length){root.innerHTML=`<div class="empty-mini">Nenhuma pessoa em ${title.toLowerCase()}.</div>`;return}
      const {data:profiles,error:pErr}=await client.from('profiles').select('id,username,display_name,avatar_source,avatar_preset,avatar_path').in('id',ids);if(pErr)throw pErr;
      const map=new Map((profiles||[]).map(p=>[p.id,p]));
      root.innerHTML=ids.map(id=>map.get(id)).filter(Boolean).map(p=>`<a class="connection-item" href="${profileHref(p.id)}"><div class="avatar sm"><img src="${S.profileAvatarUrl(p)}" alt=""></div><div><strong>${S.esc(p.display_name||p.username)}</strong><span>@${S.esc(p.username)}</span></div><b>Ver perfil →</b></a>`).join('');
    }catch(error){root.innerHTML=`<div class="empty-mini">${S.esc(S.friendlyError(error))}</div>`}
  }
  document.getElementById('followers-button').onclick=()=>openConnections('followers');
  document.getElementById('following-button').onclick=()=>openConnections('following');

  document.getElementById('new-post').onclick=()=>location.href='feed.html';
  document.querySelectorAll('[data-profile-filter]').forEach(btn=>btn.onclick=()=>{filter=btn.dataset.profileFilter;document.querySelectorAll('[data-profile-filter]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');renderPosts()});

  try{await render()}catch(error){console.error(error);toast(S.friendlyError(error))}
})();
