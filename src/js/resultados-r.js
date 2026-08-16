import '../css/genesis.css';
import { mountLayout, injectFontAwesome, warningBanner, getChartTheme } from './common.js';
import Chart from 'chart.js/auto';

injectFontAwesome();
mountLayout('resultados', 'Resultado validado contra R');

const content=document.getElementById('page-content');
let chart=null;

content.innerHTML=`
${warningBanner()}
<div class="flow-head">
  <div>
    <div class="result-hero__label">REFERÊNCIA R · ETAPA VALIDADA</div>
    <h1 class="page-title">Top 30 Genes Mais Mutados/Alterados</h1>
    <p class="page-desc">Esta página é somente a referência já conferida contra a figura produzida pelo R. Ela não executa os outros módulos e não mistura a referência n=150 com o estudo ativo do navegador.</p>
  </div>
  <a class="btn btn-secondary" href="resultados.html"><i class="fa-solid fa-arrow-left"></i> Voltar aos Resultados</a>
</div>

<div class="clinical-gate mt-4">
  <div><i class="fa-solid fa-shield-halved"></i></div>
  <div><strong>Validação limitada à precisão exibida na saída R fornecida.</strong><p>Os percentuais usados abaixo reproduzem os valores visíveis no gráfico R (por exemplo, NRAS 10,7%). Para validar casas decimais adicionais, variantes e amostras individuais, é necessário o CSV original correspondente.</p></div>
</div>

<div class="card mt-6">
  <div class="card__header">
    <div><div class="card__title"><i class="fa-solid fa-circle-check"></i> Referência validada</div><div class="card__subtitle">TARGET ALL · n=150 amostras · frequência mutacional/alterações.</div></div>
    <span class="quality-badge good"><i class="fa-solid fa-circle-check"></i> VALIDADO CONTRA R</span>
  </div>
  <div class="validated-chart-wrap mt-4"><canvas id="r-top30"></canvas></div>
  <div id="validation-summary" class="mt-4"></div>
</div>

<div class="card mt-6">
  <div class="card__header">
    <div><div class="card__title"><i class="fa-solid fa-list-check"></i> Valores usados no gráfico</div><div class="card__subtitle">Tabela auditável; nenhuma frequência é sorteada ou estimada.</div></div>
    <button class="btn btn-secondary btn-sm" id="toggle-original"><i class="fa-solid fa-image"></i> Comparar com figura R</button>
  </div>
  <div class="table-wrap mt-4"><table class="data-table" id="r-values-table"></table></div>
  <div id="r-original" class="r-reference-box mt-4" hidden>
    <img src="${import.meta.env.BASE_URL}fig1_top30_genes_R_original.jpeg" alt="Figura original do Top 30 fornecida como saída R">
    <p class="chart-note">Figura R usada como referência visual. O gráfico acima é desenhado a partir da tabela numérica validada na precisão exibida.</p>
  </div>
</div>`;

document.getElementById('toggle-original').onclick=()=>{
  const box=document.getElementById('r-original'); box.hidden=!box.hidden;
};

load();
window.addEventListener('genesis:themechange',()=>load(true));

async function load(redrawOnly=false){
  try{
    const res=await fetch(`${import.meta.env.BASE_URL}data/r_validated/top30_genes_mutados.json`,{cache:'no-store'});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const data=await res.json(), genes=Array.isArray(data.genes)?data.genes:[];
    validate(data,genes);
    draw(data,genes);
    if(!redrawOnly){renderTable(genes);renderSummary(data,genes);}
  }catch(e){
    if(chart){chart.destroy();chart=null;}
    document.getElementById('validation-summary').innerHTML=`<div class="alert danger"><i class="fa-solid fa-circle-xmark"></i> Resultado bloqueado: ${esc(e.message)}</div>`;
  }
}

function validate(data,genes){
  if(Number(data.n_samples)!==150)throw new Error('O denominador da referência não é n=150.');
  if(genes.length!==30)throw new Error(`Esperados 30 genes; recebidos ${genes.length}.`);
  const expected=new Map([
    ['NRAS',10.7],['KRAS',5.3],['TP53',4],['PTPN11',4],['JAK2',4],['CREBBP',4],
    ['WHSC1',3.3],['FLT3',3.3],['CDK11A',3.3],['TAS2R19',2.7],['OVGP1',2.7],['NOTCH2',2.7],
    ['UBR4',2],['QRICH2',2],['KMT2D',2],['HLA-C',2],['DOT1L',2],
    ['FCGBP',1.3],['FAM207A',1.3],['EZH2',1.3],['ELL',1.3],['DSPP',1.3],['DNAH8',1.3],
    ['CRLF2',1.3],['CHIT1',1.3],['CECR5',1.3],['C10orf118',1.3],['ATF7IP',1.3],['APOE',1.3],['ACRC',1.3]
  ]);
  for(const row of genes){
    if(!expected.has(row.gene))throw new Error(`Gene inesperado: ${row.gene}`);
    if(Number(row.frequency_pct)!==expected.get(row.gene))throw new Error(`Frequência divergente para ${row.gene}.`);
  }
}

function draw(data,genes){
  if(chart)chart.destroy();
  const t=getChartTheme(),d=[...genes];
  chart=new Chart(document.getElementById('r-top30'),{
    type:'bar',
    data:{labels:d.map(x=>x.gene),datasets:[{data:d.map(x=>x.frequency_pct),backgroundColor:d.map(x=>gradient(x.frequency_pct))}]},
    options:{
      responsive:true,maintainAspectRatio:false,indexAxis:'y',animation:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmtPct(c.raw)}}},
      scales:{
        x:{beginAtZero:true,suggestedMax:12,ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'Frequência de Mutação (%)',color:t.text}},
        y:{ticks:{color:t.text,autoSkip:false},grid:{display:false}}
      }
    },
    plugins:[labelsPlugin()]
  });
}
function labelsPlugin(){return{id:'rExactLabels',afterDatasetsDraw(c){const{ctx}=c;ctx.save();ctx.fillStyle=getChartTheme().text;ctx.font='12px sans-serif';ctx.textBaseline='middle';c.getDatasetMeta(0).data.forEach((bar,i)=>ctx.fillText(fmtPct(c.data.datasets[0].data[i]),bar.x+7,bar.y));ctx.restore();}}}
function gradient(v){const lo=[254,240,217],hi=[215,48,31],min=1.3,max=10.7,t=Math.max(0,Math.min(1,(Number(v)-min)/(max-min)));const rgb=lo.map((x,i)=>Math.round(x+(hi[i]-x)*t));return`rgb(${rgb.join(',')})`}
function renderTable(genes){document.getElementById('r-values-table').innerHTML=`<thead><tr><th>#</th><th>Gene</th><th>Frequência R exibida</th><th>Conferência</th></tr></thead><tbody>${genes.map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x.gene)}</strong></td><td>${fmtPct(x.frequency_pct)}</td><td><span class="match-pill"><i class="fa-solid fa-check"></i> igual</span></td></tr>`).join('')}</tbody>`}
function renderSummary(data,genes){document.getElementById('validation-summary').innerHTML=`<div class="validation-strip"><div><span>Coorte de referência</span><strong>${esc(data.dataset||'TARGET ALL')}</strong></div><div><span>Amostras</span><strong>${data.n_samples}</strong></div><div><span>Genes conferidos</span><strong>${genes.length}/30</strong></div><div><span>Precisão validada</span><strong>igual à exibida no R</strong></div></div>`}
function fmtPct(v){const n=Number(v);return`${n.toLocaleString('pt-BR',{minimumFractionDigits:n%1?1:0,maximumFractionDigits:1})}%`}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
