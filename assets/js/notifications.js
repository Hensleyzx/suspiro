(async function(){
  const ready=await window.SuspiroReady;if(!ready)return;
  const S=SuspiroState,client=await S.supabaseClient(),me=S.current();
  let filter='all',notifications=[],actorMap=new Map();
  const root=document.getElementById('notice-list');

  function group(type){
    if(['like','comment','message'].includes(type))return'interaction';
    if(['follow','follow_request','follow_accepted'].includes(type))return'following';
    return'suggestion';
  }
  function textFor(n){
    const actor=actorMap.get(n.actor_id);const user=actor?`@${actor.username}`:'Alguém';
    if(n.type==='like')return`${user} curtiu sua publicação.`;
    if(n.type==='comment')return`${user} comentou na sua publicação.`;
    if(n.type==='message')return`${user} enviou uma mensagem.`;
    if(n.type==='follow')return`${user} começou a seguir você.`;
    if(n.type==='follow_request')return`${user} pediu para seguir você.`;
    if(n.type==='follow_accepted')return`${user} aceitou sua solicitação para seguir.`;
    return n.message||'Você tem uma nova notificação.';
  }
  function iconFor(n){const g=group(n.type);return g==='following'?'♙':g==='suggestion'?'✦':'♡'}

  async function load(){
    const {data,error}=await client.from('notifications')
      .select('id,user_id,actor_id,type,post_id,comment_id,message_id,message,payload,created_at,read_at')
      .eq('user_id',me.id).order('created_at',{ascending:false}).limit(100);
    if(error)throw error;notifications=data||[];
    const ids=[...new Set(notifications.map(n=>n.actor_id).filter(Boolean))];
    if(ids.length){
      const {data:actors,error:actorError}=await client.from('profiles')
        .select('id,username,display_name,avatar_source,avatar_preset,avatar_path,is_private').in('id',ids);
      if(actorError)throw actorError;actorMap=new Map((actors||[]).map(p=>[p.id,p]));
    }else actorMap=new Map();
  }

  function render(){
    const arr=notifications.filter(n=>filter==='all'||group(n.type)===filter);
    root.innerHTML=arr.length?arr.map(n=>{
      const isRequest=n.type==='follow_request';
      return `<div class="notice ${n.read_at?'':'unread'}"><div class="notice-icon">${iconFor(n)}</div><div class="body"><p>${S.esc(textFor(n))}</p><time>${S.timeAgo(n.created_at)}</time></div>${isRequest?`<div style="display:flex;gap:6px"><button class="btn btn-primary btn-sm" data-accept="${n.actor_id}">Aceitar</button><button class="btn btn-outline btn-sm" data-reject="${n.actor_id}">Recusar</button></div>`:''}</div>`;
    }).join(''):'<div class="empty-state">Nenhuma notificação nesta categoria.</div>';

    root.querySelectorAll('[data-accept]').forEach(btn=>btn.onclick=()=>answerFollow(btn.dataset.accept,'accepted',btn));
    root.querySelectorAll('[data-reject]').forEach(btn=>btn.onclick=()=>answerFollow(btn.dataset.reject,'rejected',btn));
  }

  async function answerFollow(followerId,status,btn){
    btn.disabled=true;
    try{
      const {error}=await client.from('follows').update({status})
        .eq('follower_id',followerId).eq('following_id',me.id).eq('status','pending');
      if(error)throw error;toast(status==='accepted'?'Solicitação aceita.':'Solicitação recusada.');await load();render();
    }catch(error){toast(S.friendlyError(error))}finally{btn.disabled=false}
  }

  document.querySelectorAll('[data-notice-filter]').forEach(btn=>btn.onclick=()=>{
    filter=btn.dataset.noticeFilter;document.querySelectorAll('[data-notice-filter]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');render();
  });

  document.getElementById('mark-read').onclick=async()=>{
    try{
      const {error}=await client.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',me.id).is('read_at',null);
      if(error)throw error;toast('Notificações marcadas como lidas.');await load();render();
    }catch(error){toast(S.friendlyError(error))}
  };

  document.getElementById('clear-notifications').onclick=async()=>{
    if(!confirm('Limpar todas as notificações?'))return;
    try{
      const {error}=await client.from('notifications').delete().eq('user_id',me.id);if(error)throw error;
      notifications=[];render();
    }catch(error){toast(S.friendlyError(error))}
  };

  try{await load();render()}catch(error){root.innerHTML=`<div class="empty-state">${S.esc(S.friendlyError(error))}</div>`}

  try{
    client.channel(`notifications-${me.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`user_id=eq.${me.id}`},async()=>{await load();render()})
      .subscribe();
  }catch(e){console.warn('Realtime de notificações indisponível.',e)}
})();
