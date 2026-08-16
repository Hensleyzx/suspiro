(async function(){
  const ready=await window.SuspiroReady;if(!ready)return;
  const S=SuspiroState,client=await S.supabaseClient(),me=S.current();
  const list=document.getElementById('conversation-list'),head=document.getElementById('chat-head'),root=document.getElementById('chat-messages');
  let messages=[],profiles=new Map(),active=new URLSearchParams(location.search).get('user')||null;

  function avatarHtml(p,size='sm'){return `<div class="avatar ${size}"><img src="${S.profileAvatarUrl(p)}" alt=""></div>`}

  async function load(){
    const {data:msgRows,error}=await client.from('messages')
      .select('id,sender_id,receiver_id,body,media_path,created_at,read_at')
      .or(`sender_id.eq.${me.id},receiver_id.eq.${me.id}`)
      .order('created_at',{ascending:true}).limit(500);
    if(error)throw error;messages=msgRows||[];

    const ids=new Set();
    for(const m of messages)ids.add(m.sender_id===me.id?m.receiver_id:m.sender_id);
    if(active)ids.add(active);

    const {data:links}=await client.from('follows').select('follower_id,following_id,status')
      .or(`follower_id.eq.${me.id},following_id.eq.${me.id}`).eq('status','accepted').limit(50);
    for(const f of links||[])ids.add(f.follower_id===me.id?f.following_id:f.follower_id);

    if(ids.size){
      const {data:people,error:pError}=await client.from('profiles')
        .select('id,username,display_name,avatar_source,avatar_preset,avatar_path,is_private').in('id',[...ids]);
      if(pError)throw pError;profiles=new Map((people||[]).map(p=>[p.id,p]));
    }else profiles=new Map();

    if(active&&!profiles.has(active))active=null;
    if(!active)active=[...profiles.keys()][0]||null;
  }

  function conversationMessages(userId){return messages.filter(m=>(m.sender_id===me.id&&m.receiver_id===userId)||(m.sender_id===userId&&m.receiver_id===me.id))}

  function renderList(){
    const ids=[...profiles.keys()];
    ids.sort((a,b)=>{
      const am=conversationMessages(a).at(-1)?.created_at||'',bm=conversationMessages(b).at(-1)?.created_at||'';
      return bm.localeCompare(am);
    });
    list.innerHTML=ids.length?ids.map(id=>{
      const p=profiles.get(id),msgs=conversationMessages(id),last=msgs.at(-1);
      return `<button class="conversation-item ${id===active?'active':''}" data-conversation="${id}">${avatarHtml(p)}<div class="body"><strong>${S.esc(p.display_name||p.username)}</strong><span>${last?S.esc(last.body||'Mídia'):'Começar conversa'}</span></div></button>`;
    }).join(''):'<div class="empty-state">Siga alguém ou abra um perfil em Explorar para iniciar uma conversa.</div>';
    list.querySelectorAll('[data-conversation]').forEach(b=>b.onclick=async()=>{active=b.dataset.conversation;history.replaceState(null,'',`messages.html?user=${encodeURIComponent(active)}`);render();await markRead()});
  }

  function renderChat(){
    if(!active){head.innerHTML='<div><strong>Mensagens</strong><span>Escolha uma conversa</span></div>';root.innerHTML='<div class="empty-state">Nenhuma conversa selecionada.</div>';document.getElementById('chat-input').disabled=true;return}
    document.getElementById('chat-input').disabled=false;
    const p=profiles.get(active),msgs=conversationMessages(active);
    head.innerHTML=`${avatarHtml(p)}<div><strong>${S.esc(p.display_name||p.username)}</strong><span>@${S.esc(p.username)}</span></div>`;
    root.innerHTML=msgs.length?msgs.map(m=>`<div class="bubble ${m.sender_id===me.id?'me':''}">${S.esc(m.body||'Mídia')}<time>${S.timeAgo(m.created_at)}</time></div>`).join(''):'<div class="empty-state">Comece a conversa.</div>';
    root.scrollTop=root.scrollHeight;
  }

  function render(){renderList();renderChat()}

  async function markRead(){
    if(!active)return;
    const unread=conversationMessages(active).filter(m=>m.receiver_id===me.id&&!m.read_at).map(m=>m.id);
    if(!unread.length)return;
    const {error}=await client.from('messages').update({read_at:new Date().toISOString()}).in('id',unread);
    if(error)console.warn(error);
  }

  document.getElementById('chat-form').onsubmit=async e=>{
    e.preventDefault();if(!active)return;
    const input=document.getElementById('chat-input'),text=input.value.trim();if(!text)return;
    const button=e.target.querySelector('button');button.disabled=true;
    try{
      const {error}=await client.from('messages').insert({sender_id:me.id,receiver_id:active,body:text});
      if(error)throw error;input.value='';await load();render();toast('Mensagem enviada.');
    }catch(error){toast(S.friendlyError(error))}finally{button.disabled=false}
  };

  try{await load();render();await markRead()}catch(error){console.error(error);list.innerHTML=`<div class="empty-state">${S.esc(S.friendlyError(error))}</div>`}

  try{
    client.channel(`messages-${me.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'messages'},async payload=>{
        const row=payload.new||payload.old;
        if(row&&(row.sender_id===me.id||row.receiver_id===me.id)){await load();render();await markRead()}
      }).subscribe();
  }catch(e){console.warn('Realtime de mensagens indisponível.',e)}
})();
