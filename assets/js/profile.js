(async function(){
  const ready=await window.SuspiroReady;if(!ready)return;
  const S=SuspiroState,client=await S.supabaseClient();let me=S.current(),raw=S.currentRaw(),filter='all';
  const covers={book:'assets/img/book-cover.svg',movie:'assets/img/movie-cover.svg',game:'assets/img/game-cover.svg',music:'assets/img/album.svg'};
  const labels={book:'Livro',movie:'Filme',game:'Jogo',music:'Música'};
  const profileForm=document.getElementById('profile-form');

  function selectPreset(src){
    profileForm.presetAvatar.value=src||'';
    profileForm.querySelectorAll('[data-avatar-preset]').forEach(b=>{
      const on=b.dataset.avatarPreset===src;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on?'true':'false');
    });
    if(src)profileForm.avatar.value='';
  }
  profileForm.querySelectorAll('[data-avatar-preset]').forEach(btn=>btn.addEventListener('click',()=>selectPreset(btn.dataset.avatarPreset)));
  profileForm.avatar.addEventListener('change',()=>{if(profileForm.avatar.files[0])selectPreset('')});

  async function getStats(){
    const [posts,followers,following]=await Promise.all([
      client.from('posts').select('id',{count:'exact',head:true}).eq('user_id',me.id),
      client.from('follows').select('follower_id',{count:'exact',head:true}).eq('following_id',me.id).eq('status','accepted'),
      client.from('follows').select('following_id',{count:'exact',head:true}).eq('follower_id',me.id).eq('status','accepted')
    ]);
    return{posts:posts.count||0,followers:followers.count||0,following:following.count||0};
  }

  async function loadOwnPosts(){
    let q=client.from('posts').select('id,user_id,body,post_type,tags,created_at').eq('user_id',me.id).order('created_at',{ascending:false});
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

  async function render(){
    await S.refreshCurrent();me=S.current();raw=S.currentRaw();if(!me)return;
    const stats=await getStats();
    document.getElementById('profile-name').textContent=me.name;
    document.getElementById('profile-username').textContent='@'+me.username;
    document.getElementById('profile-bio').textContent=me.bio||'Sem bio ainda.';
    document.getElementById('stat-posts').textContent=stats.posts;
    document.getElementById('stat-followers').textContent=stats.followers;
    document.getElementById('stat-following').textContent=stats.following;
    document.getElementById('profile-avatar').innerHTML=`<img src="${me.avatar.src}" alt="Foto de perfil">`;
    document.getElementById('profile-cover').style.backgroundImage=`linear-gradient(180deg,transparent,rgba(5,4,8,.55)),url("${me.cover.src}")`;

    const favMap=S.favoriteMap();
    document.getElementById('favorite-grid').innerHTML=Object.keys(labels).map(k=>`<div class="favorite-card"><div class="cover-image"><img src="${covers[k]}" alt="${labels[k]}"></div><small>${labels[k]}</small><strong>${S.esc(favMap[k]||'Não definido')}</strong></div>`).join('');
    document.getElementById('about-list').innerHTML=`<div class="about-row"><span>Nome</span><strong>${S.esc(me.name)}</strong></div><div class="about-row"><span>Usuário</span><strong>@${S.esc(me.username)}</strong></div><div class="about-row"><span>Bio</span><strong>${S.esc(me.bio||'')}</strong></div><div class="about-row"><span>Cidade</span><strong>${S.esc(me.city||'—')}</strong></div><div class="about-row"><span>Links</span><strong>${(me.links||[]).map(S.esc).join('<br>')||'—'}</strong></div>`;
    await renderPosts();
    await refreshCommonProfile();
  }

  async function renderPosts(){
    const root=document.getElementById('profile-posts');root.innerHTML='<div class="empty-state">Carregando...</div>';
    try{
      const posts=await loadOwnPosts();
      if(!posts.length){root.innerHTML='<div class="empty-state">Você ainda não tem publicações nesta aba.</div>';return}
      root.innerHTML=posts.map(post=>{
        const media=post.media.map(m=>m.url?(m.media_type==='video'?`<video src="${m.url}" controls class="post-video"></video>`:`<img src="${m.url}" alt="Imagem">`):'').join('');
        return `<article class="post"><div class="avatar"><img src="${me.avatar.src}" alt=""></div><div class="post-body"><div class="post-head"><strong>${S.esc(me.name)}</strong><span class="handle">@${S.esc(me.username)}</span><span class="time">· ${S.timeAgo(post.created_at)}</span></div><div class="post-text">${S.esc(post.body||'')}${post.mood?` <span class="post-mood">${S.esc(post.mood)}</span>`:''}</div>${media?`<div class="post-media real-media ${post.media.length===1?'single':''}">${media}</div>`:''}<div class="post-actions"><span class="post-action">♡ ${post.likes}</span><span class="post-action">◌ ${post.comments}</span></div></div></article>`;
      }).join('');
    }catch(error){root.innerHTML=`<div class="empty-state">${S.esc(S.friendlyError(error))}</div>`}
  }

  function fillProfileForm(){
    const f=profileForm;f.name.value=me.name;f.username.value=me.username;f.bio.value=me.bio||'';f.city.value=me.city||'';f.links.value=(me.links||[]).join('\n');f.avatar.value='';f.cover.value='';
    selectPreset(raw.avatar_source==='preset'?S.avatarPresetPath(raw.avatar_preset):'');openModal('profile-modal');
  }
  document.getElementById('edit-profile').onclick=fillProfileForm;document.getElementById('edit-profile-2').onclick=fillProfileForm;

  profileForm.onsubmit=async e=>{
    e.preventDefault();const f=e.target;const button=f.querySelector('button[type="submit"],button.btn-primary:last-child');
    const username=f.username.value.trim().replace(/^@/,'').toLowerCase();
    if(!/^[a-z0-9._]{3,30}$/.test(username)){toast('Usuário: 3 a 30 caracteres, usando letras, números, ponto ou underline.');return}
    const avatarFile=f.avatar.files[0],coverFile=f.cover.files[0];
    if(avatarFile&&avatarFile.size>5*1024*1024){toast('A foto de perfil pode ter até 5 MB.');return}
    if(coverFile&&coverFile.size>8*1024*1024){toast('A capa pode ter até 8 MB.');return}
    button.disabled=true;const oldAvatarPath=raw.avatar_path,oldCoverPath=raw.cover_path;let newAvatarPath=null,newCoverPath=null;
    try{
      const patch={display_name:f.name.value.trim(),username,bio:f.bio.value.trim()};
      if(avatarFile){
        const ext=(avatarFile.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase();newAvatarPath=`${me.id}/${crypto.randomUUID()}.${ext}`;
        const {error}=await client.storage.from('avatars').upload(newAvatarPath,avatarFile,{contentType:avatarFile.type,upsert:false});if(error)throw error;
        Object.assign(patch,{avatar_source:'upload',avatar_path:newAvatarPath});
      }else if(f.presetAvatar.value){
        Object.assign(patch,{avatar_source:'preset',avatar_preset:S.avatarPresetKey(f.presetAvatar.value),avatar_path:null});
      }
      if(coverFile){
        const ext=(coverFile.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase();newCoverPath=`${me.id}/${crypto.randomUUID()}.${ext}`;
        const {error}=await client.storage.from('covers').upload(newCoverPath,coverFile,{contentType:coverFile.type,upsert:false});if(error)throw error;
        patch.cover_path=newCoverPath;
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

  document.getElementById('edit-favorites').onclick=()=>{
    const fav=S.favoriteMap(),f=document.getElementById('favorites-form');Object.keys(labels).forEach(k=>f[k].value=fav[k]||'');f.tags.value=(me.favoriteTags||[]).join(', ');openModal('favorites-modal');
  };
  document.getElementById('favorites-form').onsubmit=async e=>{
    e.preventDefault();const f=e.target,button=f.querySelector('button');button.disabled=true;
    try{
      for(const category of Object.keys(labels)){
        const title=f[category].value.trim();
        if(title){
          const {error}=await client.from('profile_favorites').upsert({user_id:me.id,category,title,position:1},{onConflict:'user_id,category,position'});if(error)throw error;
        }else{
          const {error}=await client.from('profile_favorites').delete().eq('user_id',me.id).eq('category',category).eq('position',1);if(error)throw error;
        }
      }
      await S.updateContentPreferences({tags:f.tags.value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)});
      closeModal('favorites-modal');toast('Favoritos atualizados.');await render();
    }catch(error){toast(S.friendlyError(error))}finally{button.disabled=false}
  };

  document.getElementById('new-post').onclick=()=>location.href='feed.html';
  document.querySelectorAll('[data-profile-filter]').forEach(btn=>btn.onclick=()=>{filter=btn.dataset.profileFilter;document.querySelectorAll('[data-profile-filter]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');renderPosts()});

  try{await render()}catch(error){toast(S.friendlyError(error))}
})();
