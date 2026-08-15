(function(){
 const S=SuspiroState,panel=document.getElementById('settings-panel');
 const contentOptions=['livros','filmes','música','jogos','pensamentos'];
 function updateSetting(fn){const st=S.load();fn(st.settings,st);S.save(st)}
 function setPanel(type){const st=S.load(),s=st.settings,p=S.current();panel.classList.remove('settings-visual');panel.classList.add('card','settings-panel');
   if(type==='account')panel.innerHTML=`<h3>Conta</h3><p>Dados básicos da conta local desta demonstração.</p><div class="option-line"><div><strong>Nome</strong><span>${S.esc(p.name)}</span></div><a class="btn btn-outline btn-sm" href="profile.html">Editar no perfil</a></div><div class="option-line"><div><strong>Usuário</strong><span>@${S.esc(p.username)}</span></div></div><div class="option-line"><div><strong>Email</strong><span>${S.esc(p.email||'Não informado')}</span></div></div>`;
   if(type==='privacy')panel.innerHTML=`<h3>Privacidade</h3><p>Escolha quem poderá visualizar suas publicações quando o backend estiver conectado.</p><div class="option-line"><div><strong>Visibilidade do perfil</strong><span>Preferência salva localmente.</span></div><select class="field" id="privacy-select"><option value="public">Público</option><option value="followers">Seguidores</option><option value="private">Privado</option></select></div>`;
   if(type==='notifications')panel.innerHTML=`<h3>Notificações</h3><p>Ative ou desative categorias de interação.</p>${[['notifyLikes','Curtidas'],['notifyComments','Comentários'],['notifyFollows','Novos seguidores']].map(([k,l])=>`<div class="option-line"><div><strong>${l}</strong><span>Receber notificações de ${l.toLowerCase()}.</span></div><button class="toggle ${s[k]?'on':''}" data-toggle="${k}" aria-label="${l}"></button></div>`).join('')}`;
   if(type==='appearance')panel.innerHTML=`<h3>Aparência</h3><p>O tema é aplicado imediatamente e salvo neste navegador.</p><div class="option-line"><div><strong>Tema</strong><span>Escuro ou claro.</span></div><select class="field" id="theme-select"><option value="dark">Escuro</option><option value="light">Claro</option></select></div>`;
   if(type==='content')panel.innerHTML=`<h3>Preferências de conteúdo</h3><p>Esses temas ajudam a organizar suas sugestões nesta demonstração.</p><div class="content-checks">${contentOptions.map(v=>`<label class="check-chip"><input type="checkbox" value="${v}" ${s.content.includes(v)?'checked':''}><span>${v}</span></label>`).join('')}</div><button class="btn btn-primary btn-sm" id="save-content" style="margin-top:14px">Salvar preferências</button>`;
   if(type==='language')panel.innerHTML=`<h3>Idioma</h3><p>Seleção preparada para expansão futura.</p><div class="option-line"><div><strong>Idioma da interface</strong><span>Atualmente o conteúdo principal está em português.</span></div><select class="field" id="language-select"><option value="pt-BR">Português (Brasil)</option><option value="en-US">English</option></select></div>`;
   bind(type,s);
 }
 function bind(type,s){
   if(type==='privacy'){const el=document.getElementById('privacy-select');el.value=s.privacy;el.onchange=()=>{updateSetting(x=>x.privacy=el.value);toast('Privacidade atualizada.')}}
   if(type==='appearance'){const el=document.getElementById('theme-select');el.value=s.theme;el.onchange=()=>{updateSetting(x=>x.theme=el.value);document.documentElement.dataset.theme=el.value;toast('Tema atualizado.')}}
   if(type==='language'){const el=document.getElementById('language-select');el.value=s.language;el.onchange=()=>{updateSetting(x=>x.language=el.value);toast('Preferência de idioma salva.')}}
   if(type==='notifications')panel.querySelectorAll('[data-toggle]').forEach(btn=>btn.onclick=()=>{updateSetting(x=>x[btn.dataset.toggle]=!x[btn.dataset.toggle]);btn.classList.toggle('on');toast('Preferência salva.')});
   if(type==='content')document.getElementById('save-content').onclick=()=>{const vals=[...panel.querySelectorAll('input:checked')].map(x=>x.value);updateSetting(x=>x.content=vals);toast('Preferências atualizadas.')}
 }
 document.querySelectorAll('[data-setting]').forEach(btn=>btn.onclick=()=>setPanel(btn.dataset.setting));
 document.getElementById('reset-demo').onclick=()=>{if(confirm('Restaurar o protótipo para o estado inicial? Isso apaga publicações e alterações locais.'))S.resetDemo()};
})();
