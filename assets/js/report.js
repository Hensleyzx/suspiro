(async function(){
  const ready=await window.SuspiroReady;if(!ready)return;
  const S=SuspiroState,client=await S.supabaseClient(),me=S.current();
  const form=document.getElementById('report-form'),success=document.getElementById('report-success'),count=document.getElementById('report-count');

  async function renderCount(){
    const {count:total,error}=await client.from('reports').select('id',{count:'exact',head:true}).eq('reporter_id',me.id);
    count.textContent=error?'Não foi possível carregar suas denúncias.':`Denúncias enviadas por você: ${total||0}`;
  }

  form.addEventListener('submit',async e=>{
    e.preventDefault();const fd=new FormData(form),button=form.querySelector('button');button.disabled=true;
    try{
      const username=String(fd.get('user')).trim().replace(/^@/,'');
      const target=await S.resolveProfileByUsername(username);
      if(!target){throw new Error('Usuário não encontrado.')}
      if(target.id===me.id){throw new Error('Você não pode denunciar a própria conta.')}
      const {error}=await client.from('reports').insert({
        reporter_id:me.id,
        reported_user_id:target.id,
        reason:String(fd.get('reason')),
        details:String(fd.get('description')||'').trim()||null
      });
      if(error)throw error;
      form.reset();success.textContent='Denúncia enviada com sucesso.';success.classList.add('show');toast('Denúncia registrada.');await renderCount();setTimeout(()=>success.classList.remove('show'),4500);
    }catch(error){toast(S.friendlyError(error))}finally{button.disabled=false}
  });

  await renderCount();
})();
