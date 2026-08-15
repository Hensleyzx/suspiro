(function(){
 const S=SuspiroState;
 const next=new URLSearchParams(location.search).get('next')||'feed.html';
 const registerForm=document.querySelector('.auth-form[data-type="register"]');
 function selectPreset(src){if(!registerForm)return;registerForm.presetAvatar.value=src;registerForm.querySelectorAll('[data-avatar-preset]').forEach(b=>{const on=b.dataset.avatarPreset===src;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on?'true':'false')})}
 registerForm?.querySelectorAll('[data-avatar-preset]').forEach(btn=>btn.addEventListener('click',()=>selectPreset(btn.dataset.avatarPreset)));
 if(S.current()){location.href=next;return}
 function showError(form,msg){const el=form.querySelector('[data-error]');el.textContent=msg||''}
 document.querySelectorAll('.auth-form').forEach(form=>form.addEventListener('submit',e=>{
   e.preventDefault();showError(form,'');const type=form.dataset.type;let accounts=S.accounts();
   if(type==='register'){
     const name=form.name.value.trim(),username=form.username.value.trim().replace(/^@/,'').toLowerCase(),email=form.email.value.trim().toLowerCase(),pass=form.password.value,confirm=form.confirm.value;
     if(pass!==confirm){showError(form,'As senhas não coincidem.');return}
     if(accounts.some(a=>a.email===email)){showError(form,'Já existe uma conta com este email.');return}
     if(accounts.some(a=>a.username===username)){showError(form,'Esse nome de usuário já está em uso.');return}
     const id=S.uid('user');accounts.push({id,name,username,email,passwordHash:S.hashLite(pass)});S.saveAccounts(accounts);
     const state=S.load();state.profiles[id]={id,name,username,email,bio:'Conte um pouco sobre você.',city:'',avatar:{src:form.presetAvatar.value||'assets/img/avatars/guitar.webp'},cover:{src:'assets/img/concert.svg'},links:[],favorites:{book:'',movie:'',game:'',music:''},favoriteTags:[],followers:0,followingCount:0};state.sessionUserId=id;S.save(state);
     toast('Conta criada. Bem-vindo ao Suspiro!');setTimeout(()=>location.href=next,450);
   }else{
     const identity=form.identity.value.trim().replace(/^@/,'').toLowerCase(),pass=form.password.value;
     const acc=accounts.find(a=>a.email===identity||a.username===identity);
     if(!acc||acc.passwordHash!==S.hashLite(pass)){showError(form,'Usuário/email ou senha inválidos.');return}
     S.setSession(acc.id);toast('Login realizado.');setTimeout(()=>location.href=next,350);
   }
 }));
 document.getElementById('demo-login')?.addEventListener('click',()=>{S.setSession('demo-vitoria');toast('Entrando na conta de demonstração...');setTimeout(()=>location.href=next,300)});
})();
