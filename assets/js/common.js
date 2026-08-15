(function(){
  const S=window.SuspiroState;
  const page=document.body.dataset.page;
  const appPages=['feed','explore','notifications','profile','settings','report','messages'];

  document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===page)a.classList.add('active')});

  window.toast=function(message){
    let t=document.querySelector('.toast');
    if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t)}
    t.textContent=message;t.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove('show'),2600);
  };

  window.openModal=function(id){const el=document.getElementById(id);if(el){el.classList.add('open');document.body.classList.add('modal-open')}};
  window.closeModal=function(id){const el=document.getElementById(id);if(el){el.classList.remove('open');document.body.classList.remove('modal-open')}};
  document.addEventListener('click',e=>{
    const close=e.target.closest('[data-close-modal]');if(close)closeModal(close.dataset.closeModal);
    if(e.target.classList.contains('modal-backdrop')){e.target.closest('.modal')?.classList.remove('open');document.body.classList.remove('modal-open')}
  });

  async function paintProfile(){
    if(!S)return;
    const p=S.current();if(!p)return;
    document.querySelectorAll('[data-profile-name]').forEach(el=>el.textContent=p.name);
    document.querySelectorAll('[data-profile-user]').forEach(el=>el.textContent='@'+p.username);
    document.querySelectorAll('[data-profile-initial]').forEach(el=>{el.textContent=p.name?.charAt(0)||'S'});
    const url=p.avatar?.src||S.avatarPresetPath('guitar');
    document.querySelectorAll('[data-profile-avatar]').forEach(el=>{el.innerHTML=`<img src="${url}" alt="Foto de perfil">`});
  }
  window.refreshCommonProfile=paintProfile;

  async function syncStaticFollowButtons(){
    document.querySelectorAll('[data-follow-user]').forEach(btn=>{
      if(btn.dataset.remoteBound==='1')return;
      btn.dataset.remoteBound='1';
      btn.addEventListener('click',async()=>{
        const username=btn.dataset.followUser;
        try{
          btn.disabled=true;
          const target=await S.resolveProfileByUsername(username);
          if(!target){toast('Perfil não encontrado.');return}
          const status=await S.toggleFollow(target);
          btn.textContent=status==='pending'?'Solicitado':status==='accepted'?'Seguindo':'Seguir';
          btn.classList.toggle('btn-primary',!!status);
          btn.classList.toggle('btn-outline',!status);
        }catch(error){toast(S.friendlyError(error))}
        finally{btn.disabled=false}
      });
    });
  }
  window.syncStaticFollowButtons=syncStaticFollowButtons;

  window.SuspiroReady=(async()=>{
    if(!S)return null;
    try{
      const data=await S.refreshCurrent();
      if(appPages.includes(page)&&!data){
        const next=location.pathname.split('/').pop()||'feed.html';
        location.replace('auth.html?next='+encodeURIComponent(next));
        return null;
      }
      if(data){
        const theme=S.currentSettings()?.theme||localStorage.getItem('suspiro_theme')||'dark';
        const shown=theme==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):theme;
        document.documentElement.dataset.theme=shown;
        localStorage.setItem('suspiro_theme',theme);
        await paintProfile();
        await syncStaticFollowButtons();
      }
      return data;
    }catch(error){
      console.error('Falha ao iniciar Suspiro:',error);
      if(appPages.includes(page))toast(S.friendlyError(error));
      return null;
    }
  })();

  document.querySelectorAll('[data-logout]').forEach(el=>el.addEventListener('click',async e=>{
    e.preventDefault();
    try{await S.logout()}catch(error){console.warn(error)}
    location.href='index.html';
  }));
})();
