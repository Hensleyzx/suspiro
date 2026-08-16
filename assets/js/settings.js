(async function(){
  const ready=await window.SuspiroReady;if(!ready)return;
  const S=SuspiroState,client=await S.supabaseClient(),panel=document.getElementById('settings-panel');
  const contentOptions=['livros','filmes','música','jogos','pensamentos'];

  function settings(){return S.currentSettings()||{theme:'dark',language:'pt-BR',content_preferences:{}}}
  function prefs(){return settings().content_preferences||{}}

  async function setPanel(type){
    await S.refreshCurrent();const s=settings(),p=S.current(),cp=prefs();panel.classList.remove('settings-visual');panel.classList.add('card','settings-panel');
    if(type==='account')panel.innerHTML=`<h3>Conta</h3><p>Dados da sua conta autenticada pelo Supabase.</p><div class="option-line"><div><strong>Nome</strong><span>${S.esc(p.name)}</span></div><a class="btn btn-outline btn-sm" href="profile.html">Editar no perfil</a></div><div class="option-line"><div><strong>Usuário</strong><span>@${S.esc(p.username)}</span></div></div><div class="option-line"><div><strong>Email</strong><span>${S.esc(p.email||'Não informado')}</span></div></div>`;
    if(type==='privacy')panel.innerHTML=`<h3>Privacidade</h3><p>Perfis privados exigem aprovação para novos seguidores e limitam a leitura das publicações.</p><div class="option-line"><div><strong>Visibilidade do perfil</strong><span>Aplicada pelo RLS do banco.</span></div><select class="field" id="privacy-select"><option value="public">Público</option><option value="private">Privado</option></select></div>`;
    if(type==='notifications')panel.innerHTML=`<h3>Notificações</h3><p>Escolha quais tipos de interação você quer destacar.</p>${[['notifyLikes','Curtidas'],['notifyComments','Comentários'],['notifyFollows','Novos seguidores']].map(([k,l])=>`<div class="option-line"><div><strong>${l}</strong><span>Preferência salva na sua conta.</span></div><button class="toggle ${cp[k]!==false?'on':''}" data-toggle="${k}" aria-label="${l}"></button></div>`).join('')}`;
    if(type==='appearance')panel.innerHTML=`<h3>Aparência</h3><p>O tema fica sincronizado com sua conta.</p><div class="option-line"><div><strong>Tema</strong><span>Escuro, claro ou sistema.</span></div><select class="field" id="theme-select"><option value="dark">Escuro</option><option value="light">Claro</option><option value="system">Sistema</option></select></div>`;
    if(type==='content')panel.innerHTML=`<h3>Preferências de conteúdo</h3><p>Esses temas ajudam a calcular compatibilidade no Explorar.</p><div class="content-checks">${contentOptions.map(v=>`<label class="check-chip"><input type="checkbox" value="${v}" ${(cp.content||[]).includes(v)?'checked':''}><span>${v}</span></label>`).join('')}</div><button class="btn btn-primary btn-sm" id="save-content" style="margin-top:14px">Salvar preferências</button>`;
    if(type==='language')panel.innerHTML=`<h3>Idioma</h3><p>Preferência de idioma da conta.</p><div class="option-line"><div><strong>Idioma da interface</strong><span>A interface principal ainda está em português.</span></div><select class="field" id="language-select"><option value="pt-BR">Português (Brasil)</option><option value="en-US">English</option></select></div>`;
    bind(type,s,cp,p);
  }

  function bind(type,s,cp,p){
    if(type==='privacy'){
      const el=document.getElementById('privacy-select');el.value=p.isPrivate?'private':'public';
      el.onchange=async()=>{try{const {error}=await client.from('profiles').update({is_private:el.value==='private'}).eq('id',p.id);if(error)throw error;await S.refreshCurrent();toast('Privacidade atualizada.')}catch(error){toast(S.friendlyError(error))}};
    }
    if(type==='appearance'){
      const el=document.getElementById('theme-select');el.value=s.theme||'dark';
      el.onchange=async()=>{try{await S.updateSettings({theme:el.value});const shown=el.value==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):el.value;document.documentElement.dataset.theme=shown;localStorage.setItem('suspiro_theme',el.value);toast('Tema atualizado.')}catch(error){toast(S.friendlyError(error))}};
    }
    if(type==='language'){
      const el=document.getElementById('language-select');el.value=s.language||'pt-BR';
      el.onchange=async()=>{try{await S.updateSettings({language:el.value});toast('Preferência de idioma salva.')}catch(error){toast(S.friendlyError(error))}};
    }
    if(type==='notifications')panel.querySelectorAll('[data-toggle]').forEach(btn=>btn.onclick=async()=>{
      const key=btn.dataset.toggle,next=!(prefs()[key]!==false);
      try{await S.updateContentPreferences({[key]:next});btn.classList.toggle('on',next);toast('Preferência salva.')}catch(error){toast(S.friendlyError(error))}
    });
    if(type==='content')document.getElementById('save-content').onclick=async()=>{
      const vals=[...panel.querySelectorAll('input:checked')].map(x=>x.value);
      try{await S.updateContentPreferences({content:vals});toast('Preferências atualizadas.')}catch(error){toast(S.friendlyError(error))}
    };
  }

  document.querySelectorAll('[data-setting]').forEach(btn=>btn.onclick=()=>setPanel(btn.dataset.setting));
  const reset=document.getElementById('reset-demo');if(reset){reset.textContent='Recarregar dados da conta';reset.onclick=async()=>{reset.disabled=true;try{await S.refreshCurrent();toast('Dados recarregados do Supabase.')}catch(error){toast(S.friendlyError(error))}finally{reset.disabled=false}}}
})();
