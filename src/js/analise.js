import '../css/genesis.css';
import { mountLayout, injectFontAwesome, warningBanner } from './common.js';

injectFontAwesome();
mountLayout('analise', 'Cadastros');
const content = document.getElementById('page-content');
const PATIENTS_KEY='genesis_patients_v10';
const DOCTORS_KEY='genesis_doctors_v10';
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

content.innerHTML=`
${warningBanner()}
<div class="flow-head"><div><div class="result-hero__label">ROTA 1 · CADASTROS</div><h1 class="page-title">Cadastro simples de pacientes e médicos</h1><p class="page-desc">Esta página não executa análise molecular nem gera prognóstico. Os gráficos ficam centralizados em <strong>Resultados</strong>.</p></div><a class="btn btn-primary" href="resultados.html"><i class="fa-solid fa-chart-column"></i> Ir para Resultados</a></div>
<div class="grid-2 mt-6">
  <div class="card"><div class="card__title"><i class="fa-solid fa-user"></i> Paciente</div><div class="card__subtitle">Identificação administrativa/local. Não é usada para produzir probabilidade individual de sobrevida.</div>
    <div class="form-grid mt-4">
      <div class="form-group"><label class="form-label">Identificador *</label><input class="form-input" id="p-id" placeholder="Ex.: LLA-001"></div>
      <div class="form-group"><label class="form-label">Nome/apelido</label><input class="form-input" id="p-name"></div>
      <div class="form-group"><label class="form-label">Idade</label><input class="form-input" id="p-age" type="number" min="0" max="120"></div>
      <div class="form-group"><label class="form-label">Sexo</label><select class="form-select" id="p-sex"><option value="">Não informado</option><option>Feminino</option><option>Masculino</option></select></div>
      <div class="form-group"><label class="form-label">Subtipo/observação</label><input class="form-input" id="p-subtype" placeholder="Opcional"></div>
    </div><button class="btn btn-primary mt-4" id="save-patient"><i class="fa-solid fa-floppy-disk"></i> Salvar paciente</button><div id="patient-msg" class="mt-3"></div>
  </div>
  <div class="card"><div class="card__title"><i class="fa-solid fa-user-doctor"></i> Médico / pesquisador</div><div class="card__subtitle">Cadastro simples para identificar quem solicitou ou revisou a análise.</div>
    <div class="form-grid mt-4">
      <div class="form-group"><label class="form-label">Nome *</label><input class="form-input" id="d-name"></div>
      <div class="form-group"><label class="form-label">CRM / identificação</label><input class="form-input" id="d-id" placeholder="Opcional"></div>
      <div class="form-group"><label class="form-label">Instituição</label><input class="form-input" id="d-inst"></div>
      <div class="form-group"><label class="form-label">E-mail</label><input class="form-input" id="d-email" type="email"></div>
    </div><button class="btn btn-primary mt-4" id="save-doctor"><i class="fa-solid fa-floppy-disk"></i> Salvar profissional</button><div id="doctor-msg" class="mt-3"></div>
  </div>
</div>
<div class="grid-2 mt-6"><div class="card"><div class="card__title">Pacientes cadastrados</div><div id="patients-list" class="simple-record-list mt-4"></div></div><div class="card"><div class="card__title">Profissionais cadastrados</div><div id="doctors-list" class="simple-record-list mt-4"></div></div></div>`;

function renderLists(){
 const patients=read(PATIENTS_KEY), doctors=read(DOCTORS_KEY);
 document.getElementById('patients-list').innerHTML=patients.length?patients.map((p,i)=>`<div class="simple-record"><div><strong>${esc(p.name||p.id)}</strong><small>${esc(p.id)}${p.age?` · ${p.age} anos`:''}${p.subtype?` · ${esc(p.subtype)}`:''}</small></div><button class="btn btn-ghost btn-sm" data-del-p="${i}"><i class="fa-solid fa-trash"></i></button></div>`).join(''):'<p class="text-muted">Nenhum paciente cadastrado.</p>';
 document.getElementById('doctors-list').innerHTML=doctors.length?doctors.map((d,i)=>`<div class="simple-record"><div><strong>${esc(d.name)}</strong><small>${esc(d.identifier||'Sem CRM informado')}${d.institution?` · ${esc(d.institution)}`:''}</small></div><button class="btn btn-ghost btn-sm" data-del-d="${i}"><i class="fa-solid fa-trash"></i></button></div>`).join(''):'<p class="text-muted">Nenhum profissional cadastrado.</p>';
 document.querySelectorAll('[data-del-p]').forEach(b=>b.onclick=()=>{const v=read(PATIENTS_KEY);v.splice(Number(b.dataset.delP),1);write(PATIENTS_KEY,v);renderLists()});
 document.querySelectorAll('[data-del-d]').forEach(b=>b.onclick=()=>{const v=read(DOCTORS_KEY);v.splice(Number(b.dataset.delD),1);write(DOCTORS_KEY,v);renderLists()});
}

document.getElementById('save-patient').onclick=()=>{const id=document.getElementById('p-id').value.trim();if(!id)return msg('patient-msg','Informe o identificador do paciente.',false);const arr=read(PATIENTS_KEY);arr.unshift({id,name:document.getElementById('p-name').value.trim(),age:Number(document.getElementById('p-age').value)||null,sex:document.getElementById('p-sex').value,subtype:document.getElementById('p-subtype').value.trim(),createdAt:new Date().toISOString()});write(PATIENTS_KEY,arr.slice(0,100));msg('patient-msg','Paciente salvo localmente.',true);renderLists();};
document.getElementById('save-doctor').onclick=()=>{const name=document.getElementById('d-name').value.trim();if(!name)return msg('doctor-msg','Informe o nome do profissional.',false);const arr=read(DOCTORS_KEY);arr.unshift({name,identifier:document.getElementById('d-id').value.trim(),institution:document.getElementById('d-inst').value.trim(),email:document.getElementById('d-email').value.trim(),createdAt:new Date().toISOString()});write(DOCTORS_KEY,arr.slice(0,100));msg('doctor-msg','Profissional salvo localmente.',true);renderLists();};
function msg(id,text,ok){document.getElementById(id).innerHTML=`<div class="alert ${ok?'success':'warning'}">${esc(text)}</div>`}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
renderLists();
