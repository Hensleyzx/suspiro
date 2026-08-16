(function(){
  const SUPABASE_URL='https://geomrhrzjgttbdikpoec.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY='sb_publishable_AoCh3awld0lRT-HRY35aFA_Q2EgTSPo';

  const AVATAR_PRESETS={
    'guitar':'assets/img/avatars/guitar.webp',
    'headphones':'assets/img/avatars/headphones.webp',
    'controller':'assets/img/avatars/controller.webp',
    'black-cat':'assets/img/avatars/black-cat.webp',
    'fox':'assets/img/avatars/fox.webp',
    'robot':'assets/img/avatars/robot.webp',
    'panda':'assets/img/avatars/panda.webp',
    'skull':'assets/img/avatars/skull.webp',
    'spray':'assets/img/avatars/spray.webp',
    'music-bolt':'assets/img/avatars/music-bolt.webp'
  };

  let libraryPromise=null;
  let clientPromise=null;
  let cache={session:null,user:null,profile:null,settings:null,favorites:[]};

  function loadSupabaseLibrary(){
    if(window.supabase?.createClient)return Promise.resolve(window.supabase);
    if(libraryPromise)return libraryPromise;
    libraryPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async=true;
      script.dataset.suspiroSupabase='1';
      script.onload=()=>window.supabase?.createClient
        ? resolve(window.supabase)
        : reject(new Error('Biblioteca do Supabase não carregou corretamente.'));
      script.onerror=()=>reject(new Error('Não foi possível carregar o Supabase. Verifique sua conexão.'));
      document.head.appendChild(script);
    });
    return libraryPromise;
  }

  async function supabaseClient(){
    if(!clientPromise){
      clientPromise=loadSupabaseLibrary().then(lib=>lib.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
          auth:{
            persistSession:true,
            autoRefreshToken:true,
            detectSessionInUrl:true
          }
        }
      ));
    }
    return clientPromise;
  }

  function avatarPresetKey(value='guitar'){
    const raw=String(value||'guitar');
    const filename=raw.split('/').pop().replace(/\.(webp|png|jpg|jpeg|gif)$/i,'');
    return AVATAR_PRESETS[filename]?filename:'guitar';
  }

  function avatarPresetPath(value='guitar'){
    return AVATAR_PRESETS[avatarPresetKey(value)]||AVATAR_PRESETS.guitar;
  }

  function publicStorageUrl(bucket,path){
    if(!path)return'';
    const clean=String(path).split('/').map(encodeURIComponent).join('/');
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${clean}`;
  }

  function profileAvatarUrl(profile){
    if(!profile)return avatarPresetPath('guitar');
    if(profile.avatar_source==='upload'&&profile.avatar_path){
      return publicStorageUrl('avatars',profile.avatar_path);
    }
    return avatarPresetPath(profile.avatar_preset);
  }

  function profileCoverUrl(profile){
    return profile?.cover_path?publicStorageUrl('covers',profile.cover_path):'assets/img/concert.svg';
  }

  function normalizeProfile(profile,user=cache.user,settings=cache.settings){
    if(!profile)return null;
    const prefs=settings?.content_preferences||{};
    return {
      id:profile.id,
      name:profile.display_name||profile.username,
      username:profile.username,
      email:user?.email||'',
      bio:profile.bio||'',
      city:prefs.city||'',
      links:Array.isArray(prefs.links)?prefs.links:[],
      favoriteTags:Array.isArray(prefs.tags)?prefs.tags:[],
      avatar:{src:profileAvatarUrl(profile)},
      cover:{src:profileCoverUrl(profile)},
      isPrivate:!!profile.is_private,
      avatarSource:profile.avatar_source||'preset',
      avatarPreset:avatarPresetKey(profile.avatar_preset)
    };
  }

  async function refreshCurrent(){
    const client=await supabaseClient();
    const {data:{session},error:sessionError}=await client.auth.getSession();
    if(sessionError)throw sessionError;
    if(!session){
      cache={session:null,user:null,profile:null,settings:null,favorites:[]};
      return null;
    }

    const [profileRes,settingsRes,favoritesRes]=await Promise.all([
      client.from('profiles')
        .select('id,username,display_name,bio,avatar_source,avatar_preset,avatar_path,cover_path,is_private,created_at')
        .eq('id',session.user.id)
        .single(),
      client.from('user_settings')
        .select('user_id,theme,language,allow_messages,email_notifications,push_notifications,content_preferences,updated_at')
        .eq('user_id',session.user.id)
        .maybeSingle(),
      client.from('profile_favorites')
        .select('id,user_id,category,title,subtitle,image_url,position')
        .eq('user_id',session.user.id)
        .order('category')
        .order('position')
    ]);

    if(profileRes.error)throw profileRes.error;
    if(settingsRes.error)throw settingsRes.error;
    if(favoritesRes.error)throw favoritesRes.error;

    cache={
      session,
      user:session.user,
      profile:profileRes.data,
      settings:settingsRes.data||{
        user_id:session.user.id,
        theme:'dark',language:'pt-BR',allow_messages:true,
        email_notifications:true,push_notifications:true,content_preferences:{}
      },
      favorites:favoritesRes.data||[]
    };
    return cache;
  }

  function current(){return normalizeProfile(cache.profile,cache.user,cache.settings)}
  function currentRaw(){return cache.profile}
  function currentSettings(){return cache.settings}
  function currentFavorites(){return cache.favorites||[]}
  function currentUser(){return cache.user}

  async function getSession(){
    const client=await supabaseClient();
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    return data.session||null;
  }

  async function logout(){
    const client=await supabaseClient();
    const {error}=await client.auth.signOut();
    cache={session:null,user:null,profile:null,settings:null,favorites:[]};
    if(error)throw error;
  }

  async function getFollow(targetId){
    const me=current();
    if(!me||!targetId)return null;
    const client=await supabaseClient();
    const {data,error}=await client.from('follows')
      .select('follower_id,following_id,status,created_at')
      .eq('follower_id',me.id)
      .eq('following_id',targetId)
      .maybeSingle();
    if(error)throw error;
    return data||null;
  }

  async function toggleFollow(targetProfile){
    const me=current();
    if(!me||!targetProfile?.id)throw new Error('Perfil inválido.');
    const client=await supabaseClient();
    const existing=await getFollow(targetProfile.id);
    if(existing){
      const {error}=await client.from('follows')
        .delete()
        .eq('follower_id',me.id)
        .eq('following_id',targetProfile.id);
      if(error)throw error;
      return null;
    }
    const status=targetProfile.is_private?'pending':'accepted';
    const {data,error}=await client.from('follows')
      .insert({follower_id:me.id,following_id:targetProfile.id,status})
      .select('status')
      .single();
    if(error)throw error;
    return data?.status||status;
  }

  async function resolveProfileByUsername(username){
    const clean=String(username||'').trim().replace(/^@/,'');
    if(!clean)return null;
    const client=await supabaseClient();
    const {data,error}=await client.from('profiles')
      .select('id,username,display_name,bio,avatar_source,avatar_preset,avatar_path,cover_path,is_private')
      .ilike('username',clean)
      .maybeSingle();
    if(error)throw error;
    return data||null;
  }

  async function signedUrl(bucket,path,expiresIn=3600){
    if(!path)return'';
    const client=await supabaseClient();
    const {data,error}=await client.storage.from(bucket).createSignedUrl(path,expiresIn);
    if(error)return'';
    return data?.signedUrl||'';
  }

  function favoriteMap(rows=cache.favorites){
    const out={book:'',movie:'',game:'',music:''};
    (rows||[]).forEach(r=>{if(r.position===1&&Object.prototype.hasOwnProperty.call(out,r.category))out[r.category]=r.title||''});
    return out;
  }

  function esc(s=''){
    return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function timeAgo(input){
    const ts=typeof input==='number'?input:new Date(input).getTime();
    const d=Math.max(0,Date.now()-ts),m=Math.floor(d/60000);
    if(m<1)return'agora';
    if(m<60)return`${m}min`;
    const h=Math.floor(m/60);if(h<24)return`${h}h`;
    const days=Math.floor(h/24);if(days<30)return`${days}d`;
    const months=Math.floor(days/30);return`${months}m`;
  }

  function uid(prefix='id'){
    if(window.crypto?.randomUUID)return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
  }

  async function updateSettings(patch){
    const me=current();if(!me)throw new Error('Sessão encerrada.');
    const client=await supabaseClient();
    const next={...(cache.settings||{}),...patch,user_id:me.id};
    delete next.updated_at;
    const {data,error}=await client.from('user_settings')
      .update(patch)
      .eq('user_id',me.id)
      .select()
      .single();
    if(error)throw error;
    cache.settings=data;
    return data;
  }

  async function updateContentPreferences(patch){
    const currentPrefs=cache.settings?.content_preferences||{};
    return updateSettings({content_preferences:{...currentPrefs,...patch}});
  }

  function friendlyError(error){
    const raw=String(error?.message||error||'Erro inesperado.');
    if(/Invalid login credentials/i.test(raw))return'Email ou senha inválidos.';
    if(/Email not confirmed/i.test(raw))return'Confirme seu email antes de entrar.';
    if(/User already registered/i.test(raw))return'Já existe uma conta com este email.';
    if(/Password should be at least/i.test(raw))return'A senha precisa ter pelo menos 6 caracteres.';
    if(/duplicate key.*profiles_username/i.test(raw)||error?.code==='23505')return'Esse nome de usuário já está em uso.';
    if(/Failed to fetch|NetworkError/i.test(raw))return'Não foi possível conectar ao servidor. Tente novamente.';
    return raw;
  }

  window.SuspiroState={
    SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,AVATAR_PRESETS,
    supabaseClient,refreshCurrent,getSession,logout,current,currentRaw,currentSettings,currentFavorites,currentUser,
    avatarPresetKey,avatarPresetPath,profileAvatarUrl,profileCoverUrl,publicStorageUrl,signedUrl,
    getFollow,toggleFollow,resolveProfileByUsername,updateSettings,updateContentPreferences,
    favoriteMap,esc,timeAgo,uid,friendlyError
  };
})();
