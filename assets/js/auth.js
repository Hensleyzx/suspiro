(async function(){
  const S=SuspiroState;
  const next=new URLSearchParams(location.search).get('next')||'feed.html';
  const registerForm=document.querySelector('.auth-form[data-type="register"]');

  function selectPreset(src){
    if(!registerForm)return;
    registerForm.presetAvatar.value=src;
    registerForm.querySelectorAll('[data-avatar-preset]').forEach(b=>{
      const on=b.dataset.avatarPreset===src;
      b.classList.toggle('selected',on);
      b.setAttribute('aria-pressed',on?'true':'false');
    });
  }
  registerForm?.querySelectorAll('[data-avatar-preset]').forEach(btn=>btn.addEventListener('click',()=>selectPreset(btn.dataset.avatarPreset)));

  function showError(form,msg){const el=form.querySelector('[data-error]');if(el)el.textContent=msg||''}
  function setBusy(form,busy,label){
    const btn=form.querySelector('button[type="submit"],button:not([type])');
    if(!btn)return;
    if(!btn.dataset.originalText)btn.dataset.originalText=btn.textContent;
    btn.disabled=busy;
    btn.textContent=busy?label:btn.dataset.originalText;
  }

  try{
    const session=await S.getSession();
    if(session){await S.refreshCurrent();location.replace(next);return}
  }catch(error){console.warn(error)}

  document.querySelectorAll('.auth-form').forEach(form=>form.addEventListener('submit',async e=>{
    e.preventDefault();showError(form,'');
    const type=form.dataset.type;
    const client=await S.supabaseClient();

    try{
      if(type==='register'){
        const name=form.name.value.trim();
        const username=form.username.value.trim().replace(/^@/,'').toLowerCase();
        const email=form.email.value.trim().toLowerCase();
        const pass=form.password.value;
        const confirm=form.confirm.value;
        if(pass!==confirm){showError(form,'As senhas não coincidem.');return}
        if(!/^[a-z0-9._]{3,30}$/.test(username)){showError(form,'Use 3 a 30 caracteres: letras, números, ponto ou underline.');return}

        setBusy(form,true,'Criando...');
        const avatarPreset=S.avatarPresetKey(form.presetAvatar.value||'guitar');
        const emailRedirectTo=new URL('auth.html?confirmed=1',location.href).href;
        const {data,error}=await client.auth.signUp({
          email,
          password:pass,
          options:{
            data:{username,display_name:name,avatar_preset:avatarPreset},
            emailRedirectTo
          }
        });
        if(error)throw error;

        if(data.session){
          await S.refreshCurrent();
          toast('Conta criada. Bem-vindo ao Suspiro!');
          setTimeout(()=>location.replace(next),450);
        }else{
          form.reset();
          selectPreset('assets/img/avatars/guitar.webp');
          showError(form,'Conta criada! Confira seu email para confirmar o cadastro e depois entre.');
          toast('Enviamos a confirmação para seu email.');
        }
      }else{
        const email=form.identity.value.trim().toLowerCase();
        const pass=form.password.value;
        setBusy(form,true,'Entrando...');
        const {error}=await client.auth.signInWithPassword({email,password:pass});
        if(error)throw error;
        await S.refreshCurrent();
        toast('Login realizado.');
        setTimeout(()=>location.replace(next),300);
      }
    }catch(error){
      console.error(error);
      showError(form,S.friendlyError(error));
    }finally{
      setBusy(form,false);
    }
  }));

  if(new URLSearchParams(location.search).get('confirmed')==='1'){
    toast('Email confirmado. Você já pode entrar.');
    location.hash='login';
  }
})();
