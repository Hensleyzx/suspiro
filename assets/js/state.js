(function(){
  const STATE_KEY='suspiro_state_v3';
  const ACCOUNTS_KEY='suspiro_accounts_v3';
  const MEDIA_DB='suspiro_media_v3';
  const MEDIA_STORE='files';

  const seed={
    version:3,
    sessionUserId:null,
    profiles:{
      'demo-vitoria':{
        id:'demo-vitoria',name:'Vitória Letícia',username:'vitorialecticia',email:'demo@suspiro.local',
        bio:'apaixonada por música, livros e filmes, por aqui compartilho o que me inspira ✨',city:'Mossoró, RN',
        avatar:{src:'assets/img/avatar-vitoria.svg'},cover:{src:'assets/img/concert.svg'},
        links:['youtube.com/@vitoria','spotify.com/vitorialecticia'],
        favorites:{book:'É Assim que Acaba',movie:'Interestelar',game:'The Last of Us',music:'Matilda'},
        favoriteTags:['livros','filmes','música','ficção','drama','jogos'],followers:152,followingCount:128
      }
    },
    people:[
      {name:'Isabela',username:'isabela',interests:['livros','drama','romance','filmes'],avatar:'I'},
      {name:'Gabriel',username:'gabriel',interests:['filmes','música','ficção','jogos'],avatar:'G'},
      {name:'Márcia',username:'marcia',interests:['livros','filmes','romance'],avatar:'M'},
      {name:'Pedro',username:'pedro',interests:['jogos','música','ficção'],avatar:'P'},
      {name:'Ana',username:'ana',interests:['música','pensamentos','filmes'],avatar:'A'},
      {name:'Marina',username:'marina',interests:['livros','romance','pensamentos'],avatar:'M'},
      {name:'Luan',username:'luan',interests:['música','álbuns','filmes'],avatar:'L'}
    ],
    following:['gabriel'],
    bookmarks:[],
    posts:[
      {id:'s1',authorId:'marina',author:'Marina',user:'marina',createdAt:Date.now()-3*60*60*1000,text:'Acabei de terminar esse livro e estou sem palavras... 🥺',kind:'dump',mood:'',media:[{kind:'image',src:'assets/img/book-coffee.svg'}],likes:24,liked:false,comments:[{id:'c1',user:'ana',name:'Ana',text:'Esse final mexe muito comigo 😭'}]},
      {id:'s2',authorId:'luan',author:'Luan',user:'luan',createdAt:Date.now()-6*60*60*1000,text:'Esse álbum é perfeito do início ao fim. 🎧',kind:'dump',mood:'Calmo',media:[{kind:'image',src:'assets/img/album.svg'}],likes:18,liked:false,comments:[{id:'c2',user:'gabriel',name:'Gabriel',text:'Sem faixa ruim.'}]},
      {id:'s3',authorId:'ana',author:'Ana',user:'ana',createdAt:Date.now()-24*60*60*1000,text:'Às vezes tudo que a gente precisa é de um tempo e silêncio.',kind:'thought',mood:'Calmo',media:[],likes:8,liked:false,comments:[]},
      {id:'s4',authorId:'demo-vitoria',author:'Vitória Letícia',user:'vitorialecticia',createdAt:Date.now()-2*60*60*1000,text:'Hoje foi um dia cansativo, mas gratidão pelas pequenas coisas. 💜',kind:'thought',mood:'',media:[],likes:12,liked:false,comments:[{id:'c4',user:'ana',name:'Ana',text:'💜'}]}
    ],
    notifications:[
      {id:'n1',type:'suggestion',text:'Suspiro sugere @isabela porque vocês têm gostos parecidos.',time:'agora',user:'isabela',read:false},
      {id:'n2',type:'interaction',text:'@luan curtiu seu dump.',time:'2h atrás',user:'luan',read:false},
      {id:'n3',type:'interaction',text:'@ana comentou: “amei! 💜”',time:'3h atrás',user:'ana',read:false},
      {id:'n4',type:'following',text:'@gabriel começou a te seguir.',time:'5h atrás',user:'gabriel',read:true},
      {id:'n5',type:'interaction',text:'@leticia comentou: “concordo demais!”',time:'1d atrás',user:'leticia',read:true}
    ],
    conversations:{
      isabela:[
        {id:'m1',from:'isabela',text:'Você já terminou aquele livro?',createdAt:Date.now()-42*60*1000},
        {id:'m2',from:'me',text:'Terminei ontem! Preciso conversar sobre o final 😭',createdAt:Date.now()-39*60*1000}
      ],
      gabriel:[{id:'m3',from:'gabriel',text:'Te mandei uma indicação de filme pro fim de semana.',createdAt:Date.now()-5*60*60*1000}],
      ana:[{id:'m4',from:'ana',text:'Amei seu pensamento de hoje 💜',createdAt:Date.now()-26*60*60*1000}]
    },
    settings:{privacy:'public',notifyLikes:true,notifyComments:true,notifyFollows:true,content:['livros','filmes','música','jogos'],language:'pt-BR',theme:'dark'},
    reports:[]
  };

  function clone(v){return JSON.parse(JSON.stringify(v));}
  function load(){
    try{
      const parsed=JSON.parse(localStorage.getItem(STATE_KEY));
      if(parsed && parsed.version===3) return parsed;
    }catch(e){}
    const s=clone(seed);localStorage.setItem(STATE_KEY,JSON.stringify(s));return s;
  }
  function save(s){localStorage.setItem(STATE_KEY,JSON.stringify(s));}
  function hashLite(input=''){
    let h=2166136261;
    for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619)}
    return (h>>>0).toString(36);
  }
  function accounts(){
    try{const a=JSON.parse(localStorage.getItem(ACCOUNTS_KEY));if(Array.isArray(a)) return a;}catch(e){}
    const a=[{id:'demo-vitoria',name:'Vitória Letícia',username:'vitorialecticia',email:'demo@suspiro.local',passwordHash:hashLite('suspiro123')}];
    localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(a));return a;
  }
  function saveAccounts(a){localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(a));}
  function current(){const s=load();return s.sessionUserId ? s.profiles[s.sessionUserId] : null;}
  function uid(prefix='id'){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;}
  function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function timeAgo(ts){const d=Math.max(0,Date.now()-ts),m=Math.floor(d/60000);if(m<1)return'agora';if(m<60)return`${m}min`;const h=Math.floor(m/60);if(h<24)return`${h}h`;const days=Math.floor(h/24);return`${days}d`;}
  function person(username){return load().people.find(p=>p.username===username)||null;}
  function compatibility(p){
    const me=current();if(!me||!p)return 50;
    const a=new Set((me.favoriteTags||[]).map(x=>x.toLowerCase()));
    const b=new Set((p.interests||[]).map(x=>x.toLowerCase()));
    const inter=[...a].filter(x=>b.has(x)).length, union=new Set([...a,...b]).size||1;
    return Math.round(48+(inter/union)*52);
  }
  function toggleFollow(username){const s=load();const i=s.following.indexOf(username);if(i>=0)s.following.splice(i,1);else s.following.push(username);save(s);return s.following.includes(username);}
  function isFollowing(username){return load().following.includes(username);}
  function addNotification(n){const s=load();s.notifications.unshift({id:uid('n'),read:false,time:'agora',...n});save(s);}
  function updateProfile(patch){const s=load();const id=s.sessionUserId;if(!id)return null;s.profiles[id]={...s.profiles[id],...patch};save(s);return s.profiles[id];}
  function setSession(id){const s=load();s.sessionUserId=id;save(s);}
  function logout(){const s=load();s.sessionUserId=null;save(s);}
  function resetDemo(){localStorage.removeItem(STATE_KEY);localStorage.removeItem(ACCOUNTS_KEY);location.reload();}

  function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(MEDIA_DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(MEDIA_STORE))r.result.createObjectStore(MEDIA_STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});}
  async function putMedia(file,id=uid('media')){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(MEDIA_STORE,'readwrite');tx.objectStore(MEDIA_STORE).put(file,id);tx.oncomplete=()=>resolve(id);tx.onerror=()=>reject(tx.error)});}
  async function getMedia(id){const db=await openDB();return new Promise((resolve,reject)=>{const r=db.transaction(MEDIA_STORE).objectStore(MEDIA_STORE).get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)});}
  const objectUrls=new Map();
  async function mediaUrl(ref){if(!ref)return'';if(ref.src)return ref.src;if(ref.mediaId){if(objectUrls.has(ref.mediaId))return objectUrls.get(ref.mediaId);const blob=await getMedia(ref.mediaId);if(!blob)return'';const url=URL.createObjectURL(blob);objectUrls.set(ref.mediaId,url);return url}return'';}

  window.SuspiroState={load,save,accounts,saveAccounts,hashLite,current,uid,esc,timeAgo,person,compatibility,toggleFollow,isFollowing,addNotification,updateProfile,setSession,logout,resetDemo,putMedia,getMedia,mediaUrl};
})();
