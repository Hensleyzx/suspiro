(async function(){
  const ready=await window.SuspiroReady;if(!ready)return;
  const S=SuspiroState,client=await S.supabaseClient(),me=S.current();
  const input=document.getElementById('explore-search'),row=document.getElementById('people-row');
  let category='all',people=[],favoritesByUser=new Map(),followMap=new Map();

  const categoryMap={livros:'book',filmes:'movie','música':'music',jogos:'game'};
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const tokens=s=>new Set(normalize(s).split(/[^a-z0-9]+/).filter(x=>x.length>2));

  function avatarHtml(p){return `<div class="avatar"><img src="${S.profileAvatarUrl(p)}" alt=""></div>`}

  function myInterestTokens(){
    const out=new Set();
    for(const f of S.currentFavorites())for(const t of tokens(`${f.category} ${f.title} ${f.subtitle||''}`))out.add(t);
    const prefs=S.currentSettings()?.content_preferences||{};
    for(const x of [...(prefs.content||[]),...(prefs.tags||[])])for(const t of tokens(x))out.add(t);
    return out;
  }
  const myTokens=myInterestTokens();

  function compatibility(p){
    const favs=favoritesByUser.get(p.id)||[];const theirs=new Set();
    for(const f of favs)for(const t of tokens(`${f.category} ${f.title} ${f.subtitle||''}`))theirs.add(t);
    if(!myTokens.size&&!theirs.size)return 50;
    const inter=[...myTokens].filter(x=>theirs.has(x)).length;
    const union=new Set([...myTokens,...theirs]).size||1;
    return Math.max(50,Math.min(99,Math.round(50+(inter/union)*49)));
  }

  function matchesCategory(p){
    if(category==='all'||category==='pensamentos')return true;
    const key=categoryMap[category];
    return (favoritesByUser.get(p.id)||[]).some(f=>f.category===key);
  }

  function searchHay(p){
    const favs=favoritesByUser.get(p.id)||[];
    return normalize([p.display_name,p.username,p.bio,...favs.flatMap(f=>[f.title,f.subtitle,f.category])].join(' '));
  }

  async function load(){
    const {data:profiles,error}=await client.from('profiles')
      .select('id,username,display_name,bio,avatar_source,avatar_preset,avatar_path,is_private')
      .neq('id',me.id).limit(80);
    if(error)throw error;people=profiles||[];
    const ids=people.map(p=>p.id);
    if(ids.length){
      const [favRes,followRes]=await Promise.all([
        client.from('profile_favorites').select('user_id,category,title,subtitle,position').in('user_id',ids),
        client.from('follows').select('following_id,status').eq('follower_id',me.id).in('following_id',ids)
      ]);
      if(favRes.error)throw favRes.error;if(followRes.error)throw followRes.error;
      favoritesByUser=new Map();
      for(const f of favRes.data||[]){if(!favoritesByUser.has(f.user_id))favoritesByUser.set(f.user_id,[]);favoritesByUser.get(f.user_id).push(f)}
      followMap=new Map((followRes.data||[]).map(f=>[f.following_id,f.status]));
    }
  }

  function renderPopular(){
    const q=normalize(input.value.trim());let visible=0;
    document.querySelectorAll('[data-popular]').forEach(el=>{
      const cat=category==='all'||el.dataset.popular===category;
      const text=normalize(el.dataset.label);
      const on=cat&&(!q||text.includes(q));el.style.display=on?'':'none';if(on)visible++;
    });
    document.getElementById('explore-empty').hidden=!(row.children.length===0&&visible===0);
  }

  function renderPeople(){
    const q=normalize(input.value.trim());
    let filtered=people.filter(p=>matchesCategory(p)&&(!q||searchHay(p).includes(q)));
    filtered.sort((a,b)=>compatibility(b)-compatibility(a));
    row.innerHTML=filtered.map(p=>{
      const score=compatibility(p),status=followMap.get(p.id);
      const favs=(favoritesByUser.get(p.id)||[]).slice(0,2).map(f=>f.title).filter(Boolean).join(' • ');
      const href=`profile.html?user=${encodeURIComponent(p.id)}`;
      return `<div class="person-card" data-person-card><a class="person-profile-link" href="${href}">${avatarHtml(p)}<strong>@${S.esc(p.username)}</strong><span class="compat">${score}% em comum</span><span>${S.esc(favs|| (p.is_private?'Perfil privado':'Novo no Suspiro'))}</span></a><button class="btn ${status?'btn-primary':'btn-outline'} btn-sm" data-follow-id="${p.id}">${status==='pending'?'Solicitado':status?'Seguindo':'Seguir'}</button><a class="btn btn-ghost btn-sm" href="messages.html?user=${encodeURIComponent(p.id)}">Mensagem</a></div>`;
    }).join('');

    row.querySelectorAll('[data-follow-id]').forEach(btn=>btn.onclick=async()=>{
      const p=people.find(x=>x.id===btn.dataset.followId);if(!p)return;btn.disabled=true;
      try{
        const status=await S.toggleFollow(p);if(status)followMap.set(p.id,status);else followMap.delete(p.id);
        btn.textContent=status==='pending'?'Solicitado':status?'Seguindo':'Seguir';
        btn.classList.toggle('btn-primary',!!status);btn.classList.toggle('btn-outline',!status);
      }catch(error){toast(S.friendlyError(error))}finally{btn.disabled=false}
    });

    const best=filtered[0];
    document.getElementById('best-match-score').textContent=best?`${compatibility(best)}%`:'—';
    const bestLink=document.getElementById('best-match-name');
    bestLink.textContent=best?`@${best.username}`:'Sem resultado';
    bestLink.href=best?`profile.html?user=${encodeURIComponent(best.id)}`:'#';
    renderPopular();
  }

  input.addEventListener('input',renderPeople);
  document.querySelectorAll('[data-category]').forEach(btn=>btn.onclick=()=>{
    category=btn.dataset.category;document.querySelectorAll('[data-category]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');renderPeople();
  });
  document.querySelectorAll('#topic-chips .pill').forEach(chip=>chip.onclick=()=>{
    input.value=chip.textContent.replace('#','').trim();category='all';document.querySelectorAll('[data-category]').forEach(x=>x.classList.toggle('active',x.dataset.category==='all'));renderPeople();
  });

  try{await load();renderPeople()}catch(error){console.error(error);row.innerHTML=`<div class="empty-state">${S.esc(S.friendlyError(error))}</div>`}
})();
