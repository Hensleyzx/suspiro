(function(){
  const S=window.SuspiroState;
  const page=document.body.dataset.page;
  const appPages=['feed','explore','notifications','profile','settings','report','messages'];
  if(S){
    const state=S.load();
    if(appPages.includes(page)&&!state.sessionUserId){
      location.href='auth.html?next='+encodeURIComponent(location.pathname.split('/').pop()||'feed.html');
      return;
    }
    const theme=state.settings?.theme||'dark';
    document.documentElement.dataset.theme=theme;
  }

  document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===page)a.classList.add('active')});

  window.toast=function(message){
    let t=document.querySelector('.toast');
    if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t)}
    t.textContent=message;t.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove('show'),2400);
  };

  window.openModal=function(id){const el=document.getElementById(id);if(el){el.classList.add('open');document.body.classList.add('modal-open')}};
  window.closeModal=function(id){const el=document.getElementById(id);if(el){el.classList.remove('open');document.body.classList.remove('modal-open')}};
  document.addEventListener('click',e=>{
    const close=e.target.closest('[data-close-modal]');if(close)closeModal(close.dataset.closeModal);
    if(e.target.classList.contains('modal-backdrop')){e.target.closest('.modal')?.classList.remove('open');document.body.classList.remove('modal-open')}
  });

  async function paintProfile(){
    if(!S)return;const p=S.current();if(!p)return;
    document.querySelectorAll('[data-profile-name]').forEach(el=>el.textContent=p.name);
    document.querySelectorAll('[data-profile-user]').forEach(el=>el.textContent='@'+p.username);
    document.querySelectorAll('[data-profile-initial]').forEach(el=>{el.textContent=p.name?.charAt(0)||'S'});
    const url=await S.mediaUrl(p.avatar);
    if(url){document.querySelectorAll('[data-profile-avatar]').forEach(el=>{el.innerHTML=`<img src="${url}" alt="Foto de perfil">`})}
  }
  window.refreshCommonProfile=paintProfile;paintProfile();

  function syncFollowButtons(username){document.querySelectorAll(`[data-follow-user="${CSS.escape(username)}"]`).forEach(btn=>{const on=S.isFollowing(username);btn.dataset.follow=on?'1':'0';btn.textContent=on?'Seguindo':'Seguir';btn.classList.toggle('btn-primary',on);btn.classList.toggle('btn-outline',!on)})}
  document.querySelectorAll('[data-follow-user]').forEach(btn=>{const u=btn.dataset.followUser;syncFollowButtons(u);btn.addEventListener('click',()=>{const on=S.toggleFollow(u);syncFollowButtons(u);toast(on?`Agora você segue @${u}.`:`Você deixou de seguir @${u}.`)})});

  document.querySelectorAll('[data-logout]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();S.logout();location.href='index.html'}));
})();
