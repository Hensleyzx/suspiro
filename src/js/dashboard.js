import '../css/genesis.css';
import { mountLayout, injectFontAwesome, warningBanner } from './common.js';

injectFontAwesome();
mountLayout('dashboard','Dashboard');
const content=document.getElementById('page-content');
const HISTORY_KEY='genesis_graph_history_v10';
const read=()=>{try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch{return[]}};
let history=read();

content.innerHTML=`
${warningBanner()}
<div class="flow-head"><div><div class="result-hero__label">HISTÓRICO</div><h1 class="page-title">Dashboard de resultados gerados</h1><p class="page-desc">Aqui ficam registrados os gráficos que o usuário solicitou na página Resultados. O Dashboard não roda análises automaticamente.</p></div><a class="btn btn-primary" href="resultados.html"><i class="fa-solid fa-chart-column"></i> Gerar novo resultado</a></div>
<div class="kpi-grid mt-6"><div class="kpi-card"><div class="kpi-card__value">${history.length}</div><div class="kpi-card__label">Resultados registrados</div></div><div class="kpi-card"><div class="kpi-card__value">${history.filter(x=>x.status==='validado contra R').length}</div><div class="kpi-card__label">Validados contra R</div></div><div class="kpi-card"><div class="kpi-card__value">${history.filter(x=>x.status==='exploratório local').length}</div><div class="kpi-card__label">Exploratórios</div></div><div class="kpi-card"><div class="kpi-card__value">${new Set(history.map(x=>x.studyId).filter(Boolean)).size}</div><div class="kpi-card__label">Coortes registradas</div></div></div>
<div class="card mt-6"><div class="card__header"><div><div class="card__title"><i class="fa-solid fa-clock-rotate-left"></i> Histórico de gráficos</div><div class="card__subtitle">A mesma coorte pode ter vários gráficos gerados separadamente. O status evita confundir resultado exploratório com saída já validada contra R.</div></div><button class="btn btn-secondary btn-sm" id="clear-history"><i class="fa-solid fa-trash"></i> Limpar histórico</button></div><div id="history-list" class="result-history-grid mt-4"></div></div>`;

function render(){history=read();const host=document.getElementById('history-list');host.innerHTML=history.length?history.map(x=>`<article class="history-result-card"><div><span class="quality-badge ${x.status==='validado contra R'?'good':'warn'}">${x.status==='validado contra R'?'<i class="fa-solid fa-circle-check"></i> validado R':'<i class="fa-solid fa-flask"></i> exploratório'}</span><h3>${esc(x.title)}</h3><p>${esc(x.studyName||x.studyId||'—')}</p>${x.genes?.length?`<small>Genes: ${x.genes.map(esc).join(', ')}</small>`:''}</div><time>${fmtDate(x.createdAt)}</time></article>`).join(''):'<div class="empty-science">Nenhum gráfico foi solicitado ainda. Vá para Resultados, selecione os gráficos e clique em “Gerar gráficos selecionados”.</div>';}
document.getElementById('clear-history').onclick=()=>{if(confirm('Limpar o histórico local de gráficos?')){localStorage.removeItem(HISTORY_KEY);render();location.reload()}};
function fmtDate(v){try{return new Date(v).toLocaleString('pt-BR')}catch{return v||'—'}}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
render();
