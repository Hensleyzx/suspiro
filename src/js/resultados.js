import '../css/genesis.css';
import { mountLayout, injectFontAwesome, warningBanner, getChartTheme } from './common.js';
import { renderStudyManager } from './study-ui.js';
import { loadDatapack } from './datapack.js';
import { buildStudyAnalytics, volcanoPoints } from './research-analytics.js';
import { buildReferenceVectors, transformExpressionValue } from './analysis-engine.js';
import { univariate as coxUnivariate } from './cox.js';
import { bhFdr } from './stats.js';
import { analyzeSurvival, atRiskAt } from './survival.js';
import Chart from 'chart.js/auto';

injectFontAwesome();
mountLayout('resultados', 'Resultados');

const content = document.getElementById('page-content');
const HISTORY_KEY = 'genesis_graph_history_v10';
let dp = null;
let analytics = null;
let charts = [];
let customGenes = [];

content.innerHTML = `
${warningBanner()}
<div class="flow-head">
  <div>
    <div class="result-hero__label">ROTA PRINCIPAL · RESULTADOS</div>
    <h1 class="page-title">Escolha o estudo, os genes e os gráficos</h1>
    <p class="page-desc">O GENESIS mantém os resultados centralizados nesta página. Gráficos calculados no navegador são marcados como <strong>exploratórios</strong>; somente resultados conferidos contra a saída correspondente do R recebem o selo <strong>validado contra R</strong>.</p>
  </div>
  <a class="btn btn-secondary" href="dashboard.html"><i class="fa-solid fa-clock-rotate-left"></i> Ver histórico</a>
</div>

<div class="card mt-6">
  <div class="card__header">
    <div>
      <div class="card__title"><i class="fa-solid fa-circle-check"></i> O que já está validado contra o R?</div>
      <div class="card__subtitle">Resultado de referência conferido contra os valores exibidos na saída R fornecida, na mesma precisão mostrada pelo gráfico.</div>
    </div>
    <a class="btn btn-primary" href="resultados-r.html"><i class="fa-solid fa-chart-bar"></i> Abrir Top 30 validado</a>
  </div>
  <div class="validation-route">
    <span class="route-good">VALIDADO CONTRA R</span>
    <strong>Top 30 Genes Mais Mutados/Alterados</strong>
    <span>TARGET ALL · n=150 amostras · NRAS 10,7% · KRAS 5,3% · demais valores auditáveis na própria página.</span>
  </div>
  <div class="alert warning mt-3"><i class="fa-solid fa-triangle-exclamation"></i> O Top 30 validado acima usa <strong>n=150</strong>. Se o estudo ativo abaixo tiver outro denominador (por exemplo, uma coorte basal filtrada), os percentuais podem mudar. Não trate coortes diferentes como se fossem a mesma execução.</div>
</div>

<div class="mt-6">
  <div class="section-route"><span>1</span><div><strong>Escolher / carregar estudo</strong><small>O estudo ativo define a coorte usada nos módulos exploratórios.</small></div></div>
  <div id="study-manager" class="mt-4"></div>
</div>

<div id="results-workspace" class="mt-6"></div>
`;

await renderStudyManager('#study-manager', { simple: true, onReady: async () => { await refreshWorkspace(); } });
await refreshWorkspace();
window.addEventListener('genesis:themechange', () => { if (dp) renderGeneratedGraphs(true); });

async function refreshWorkspace() {
  destroyCharts();
  dp = await loadDatapack().catch(() => null);
  const host = document.getElementById('results-workspace');
  if (!dp) {
    host.innerHTML = `<div class="card"><div class="card__title"><i class="fa-solid fa-database"></i> Nenhum estudo ativo</div><p class="page-desc mt-3">Carregue um estudo LLA acima. Depois disso, o GENESIS calcula o Top 30 da coorte ativa e atualiza automaticamente o painel com os 10 genes mais frequentes.</p></div>`;
    return;
  }
  analytics = buildStudyAnalytics(dp);
  const top10 = analytics.topMut.slice(0, 10).map(x => String(x.symbol).toUpperCase());
  customGenes = customGenes.filter(g => !top10.includes(g));
  renderWorkspace(top10);
}

function renderWorkspace(top10) {
  const topMut = analytics.topMut || [];
  const p = dp.pack;
  const mutationDenom = Number(dp.mut?.totalSamples || p.nMutationSamples || 0);
  const top10Html = top10.length ? top10.map((g, i) => `
    <label class="gene-choice">
      <input type="checkbox" class="result-gene" value="${esc(g)}" ${i === 0 ? 'checked' : ''}>
      <span><strong>${esc(g)}</strong><small>#${i + 1} do Top 30 desta coorte</small></span>
    </label>`).join('') : `<div class="empty-science">O estudo ativo não possui um ranking de mutações suficiente para formar o Top 10.</div>`;

  document.getElementById('results-workspace').innerHTML = `
  <div class="card">
    <div class="active-study-compact">
      <div>
        <div class="result-hero__label">ESTUDO ATIVO</div>
        <h3>${esc(p.studyName)}</h3>
        <p>${esc(p.studyId)} · ${p.nPatients || 0} pacientes · ${p.nAnalysisSamples || 0} amostras de expressão · ${mutationDenom} amostras no denominador mutacional</p>
      </div>
      <div class="cohort-warning"><strong>Identidade da coorte:</strong> estes números pertencem ao estudo ativo e aos filtros locais atuais. Eles não substituem automaticamente a saída R de n=150.</div>
    </div>
  </div>

  <div class="card mt-6">
    <div class="section-route"><span>2</span><div><strong>Genes disponíveis para análise</strong><small>Atualizados pelos 10 primeiros genes do Top 30 do estudo ativo. Você pode escolher 1, vários, todos ou adicionar outro gene.</small></div></div>
    <div class="flex gap-2 mt-4" style="flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" id="select-all-genes">Selecionar os 10</button>
      <button class="btn btn-ghost btn-sm" id="clear-genes">Limpar seleção</button>
    </div>
    <div class="gene-choice-grid mt-4" id="gene-choice-grid">${top10Html}</div>
    <div class="custom-gene-add mt-4" style="display:grid;grid-template-columns:1fr auto;gap:10px">
      <input class="form-input" id="custom-gene" placeholder="Adicionar outro gene HUGO, ex.: STAT2, MIR221, DAPK1">
      <button class="btn btn-secondary" id="add-custom-gene"><i class="fa-solid fa-plus"></i> Adicionar gene</button>
    </div>
    <div id="gene-msg" class="mt-3"></div>
  </div>

  <div class="card mt-6">
    <div class="section-route"><span>3</span><div><strong>Escolher quais gráficos gerar</strong><small>Nenhum gráfico é executado automaticamente. O usuário solicita somente o que quer visualizar.</small></div></div>
    <div class="graph-choice-grid mt-4">
      ${graphChoice('top30','Top 30 genes mais mutados','Ranking da coorte ativa; frequência usa o denominador mutacional desta execução.')}
      ${graphChoice('mutheat','Heatmap mutacional — Top 30','Oncoprint binário simplificado da coorte ativa.')}
      ${graphChoice('degs','Top DEGs — Relapse vs None', dp.pack.scope==='completo' ? 'DEA exploratória em escopo completo. Ainda não é limma/R validado.' : 'Exige escopo Completo para evitar FDR/DEGs calculados sobre painel parcial.', dp.pack.scope!=='completo')}
      ${graphChoice('volcano','Volcano Plot', dp.pack.scope==='completo' ? 'Usa a mesma DEA exploratória completa; validação final depende da saída R corrigida.' : 'Exige escopo Completo; no modo Expresso faltam genes para reproduzir a análise transcriptômica.', dp.pack.scope!=='completo')}
      ${graphChoice('cox','Forest Plot — Cox univariado','Roda somente os genes selecionados acima; HR por 1 DP de expressão.')}
      ${graphChoice('km','Kaplan-Meier por gene','Gera uma curva separada para cada gene selecionado, dividindo expressão pela mediana.')}
    </div>
    <div class="flex gap-2 mt-4" style="flex-wrap:wrap">
      <button class="btn btn-primary" id="generate-selected"><i class="fa-solid fa-play"></i> Gerar gráficos selecionados</button>
      <button class="btn btn-ghost" id="clear-results"><i class="fa-solid fa-broom"></i> Limpar gráficos</button>
    </div>
    <div id="generation-msg" class="mt-3"></div>
  </div>

  <div class="mt-6">
    <div class="section-route"><span>4</span><div><strong>Gráficos solicitados</strong><small>Cada gráfico mostra estudo, denominador/endpoint e status de validação.</small></div></div>
    <div id="generated-results" class="result-graph-stack mt-4"><div class="card"><div class="empty-science">Nenhum gráfico solicitado ainda.</div></div></div>
  </div>`;

  document.getElementById('select-all-genes').onclick = () => document.querySelectorAll('.result-gene').forEach(x => { x.checked = true; });
  document.getElementById('clear-genes').onclick = () => document.querySelectorAll('.result-gene').forEach(x => { x.checked = false; });
  document.getElementById('add-custom-gene').onclick = addCustomGene;
  document.getElementById('custom-gene').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addCustomGene(); } });
  document.getElementById('generate-selected').onclick = () => renderGeneratedGraphs(false);
  document.getElementById('clear-results').onclick = () => { destroyCharts(); document.getElementById('generated-results').innerHTML='<div class="card"><div class="empty-science">Nenhum gráfico solicitado ainda.</div></div>'; msg('generation-msg','Gráficos removidos da tela.',true); };
}

function graphChoice(value, title, note, disabled=false) {
  return `<label class="graph-choice ${disabled?'disabled':''}"><input type="checkbox" class="result-graph" value="${value}" ${disabled?'disabled':''}><span><strong>${title}</strong>${disabled?'<em class="graph-lock">ESCopo completo necessário</em>':''}<small>${note}</small></span></label>`;
}

function addCustomGene() {
  const input = document.getElementById('custom-gene');
  const gene = String(input.value || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.-]{1,24}$/.test(gene)) return msg('gene-msg','Informe um símbolo HUGO válido.',false);
  if ([...document.querySelectorAll('.result-gene')].some(x => x.value === gene)) return msg('gene-msg',`${gene} já está no painel.`,false);
  customGenes.push(gene);
  const host = document.getElementById('gene-choice-grid');
  host.insertAdjacentHTML('beforeend', `<label class="gene-choice"><input type="checkbox" class="result-gene" value="${esc(gene)}" checked><span><strong>${esc(gene)}</strong><small>gene adicionado manualmente</small></span></label>`);
  input.value = '';
  msg('gene-msg',`${gene} adicionado. Gráficos dependentes de expressão só serão gerados se esse gene existir no estudo ativo.`,true);
}

async function renderGeneratedGraphs(redrawOnly = false) {
  if (!dp || !analytics) return;
  const selectedGraphs = [...document.querySelectorAll('.result-graph:checked')].map(x => x.value);
  const genes = [...new Set([...document.querySelectorAll('.result-gene:checked')].map(x => x.value.toUpperCase()))];
  if (!selectedGraphs.length) return msg('generation-msg','Escolha pelo menos um gráfico.',false);
  if ((selectedGraphs.includes('cox') || selectedGraphs.includes('km')) && !genes.length) return msg('generation-msg','Forest Plot e Kaplan-Meier exigem pelo menos um gene selecionado.',false);

  destroyCharts();
  const cards = [];
  for (const type of selectedGraphs) {
    if (type === 'top30') cards.push(top30Card());
    if (type === 'mutheat') cards.push(mutationHeatmapCard());
    if (type === 'degs') cards.push(degCard());
    if (type === 'volcano') cards.push(volcanoCard());
    if (type === 'cox') cards.push(coxCard(genes));
    if (type === 'km') genes.forEach(g => cards.push(kmCard(g)));
  }
  const host = document.getElementById('generated-results');
  host.innerHTML = cards.join('') || '<div class="card"><div class="empty-science">Nenhum resultado pôde ser preparado com os dados disponíveis.</div></div>';

  const rendered = [];
  if (selectedGraphs.includes('top30') && drawTop30()) rendered.push({title:'Top 30 genes mais mutados', genes:[]});
  if (selectedGraphs.includes('mutheat') && drawMutationHeatmap()) rendered.push({title:'Heatmap mutacional — Top 30', genes:[]});
  if (selectedGraphs.includes('degs') && drawDEGs()) rendered.push({title:'Top DEGs — Relapse vs None', genes:[]});
  if (selectedGraphs.includes('volcano') && drawVolcano()) rendered.push({title:'Volcano Plot — Relapse vs None', genes:[]});
  if (selectedGraphs.includes('cox') && drawCox(genes)) rendered.push({title:'Forest Plot — Cox univariado', genes});
  if (selectedGraphs.includes('km')) for (const g of genes) if (drawKM(g)) rendered.push({title:`Kaplan-Meier — ${g}`, genes:[g]});

  if (!redrawOnly) {
    saveHistory(rendered);
    msg('generation-msg', `${rendered.length} gráfico(s) gerado(s). Todos os resultados desta execução estão marcados como exploratórios locais até comparação numérica com a saída R correspondente.`, true);
  }
}

function statusHeader(extra='') {
  return `<div class="validated-result-head"><span class="quality-badge mid"><i class="fa-solid fa-flask"></i> EXPLORATÓRIO LOCAL</span><span class="study-pill">${esc(dp.pack.studyId)}</span>${extra}</div>`;
}

function top30Card() {
  const n = Number(dp.mut?.totalSamples || dp.pack.nMutationSamples || 0);
  if (!analytics.topMut?.length) return noDataCard('Top 30 genes mais mutados','Mutações não disponíveis nesta coorte.');
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">denominador mutacional n=${n}</span>`)}<div class="card__title">Top 30 genes mais mutados — estudo ativo</div><div class="card__subtitle">Este ranking pertence à coorte ativa. Não é o mesmo resultado do Top 30 R validado de n=150 quando o denominador for diferente.</div><div class="single-result-canvas"><canvas id="result-top30"></canvas></div></div>`;
}

function mutationHeatmapCard() {
  if (!analytics.topMut?.length || !(dp.pack?.mutationSelection?.sampleIds||[]).length) return noDataCard('Heatmap mutacional — Top 30','Matriz mutacional basal não disponível.');
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">${dp.pack.mutationSelection.sampleIds.length} amostras basais</span>`)}<div class="card__title">Heatmap mutacional — Top 30 genes</div><div class="card__subtitle">Linhas = genes; colunas = amostras basais sequenciadas; célula preenchida = alteração detectada.</div><div class="mutation-heatmap-scroll mt-4"><canvas id="result-mutheat"></canvas></div></div>`;
}

function degCard() {
  if (dp.pack.scope!=='completo') return noDataCard('Top DEGs — Relapse vs None','Bloqueado no modo Expresso: um painel parcial altera o universo de testes e o FDR. Reconstrua o estudo em escopo Completo.');
  if (!analytics.topDEGs?.length) return noDataCard('Top DEGs — Relapse vs None','Dados insuficientes para DEA significativa nesta coorte.');
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">Relapse ${analytics.dea.n1||0} vs None ${analytics.dea.n0||0}</span><span class="study-pill">escopo completo</span>`)}<div class="card__title">Top DEGs — Relapse vs None</div><div class="card__subtitle">DEA local aproximada em log2(expressão+1). O resultado só recebe selo R após comparação com a tabela limma corrigida.</div><div class="single-result-canvas"><canvas id="result-degs"></canvas></div></div>`;
}

function volcanoCard() {
  if (dp.pack.scope!=='completo') return noDataCard('Volcano Plot','Bloqueado no modo Expresso: o painel parcial não reproduz o universo transcriptômico usado pelo R e altera o FDR.');
  if (!(analytics.dea?.table||[]).length) return noDataCard('Volcano Plot','DEA não disponível nesta coorte.');
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">${esc(dp.pack.expressionTransform?.label||'escala não informada')}</span><span class="study-pill">escopo completo</span>`)}<div class="card__title">Volcano Plot — Relapse vs None</div><div class="card__subtitle">FDR &lt; 0,05 e |log2FC| &gt; 0,5. Esta é uma reprodução exploratória local; para equivalência científica, compare com a saída do Script.R corrigido (limma-trend).</div><div class="single-result-canvas"><canvas id="result-volcano"></canvas></div></div>`;
}

function coxCard(genes) {
  const available = expressionRowsFor(genes).genes;
  const v=buildReferenceVectors(dp);
  if (!available.length || !v.endpointAdequate) return noDataCard('Forest Plot — Cox univariado','Endpoint/expressão insuficientes: são necessários pelo menos 20 registros válidos e 5 eventos, além de expressão para o(s) gene(s) selecionado(s).');
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">genes: ${available.map(esc).join(', ')}</span><span class="study-pill">${esc(v.endpointKey)} · ${esc(v.endpointTimeColumn||'tempo?')}</span>`)}<div class="card__title">Forest Plot — Cox univariado</div><div class="card__subtitle">Somente os genes escolhidos. HR por +1 DP de expressão em log2; IC95% e p são locais. O FDR é corrigido apenas dentro dos genes selecionados nesta execução. O teste cox.zph do R ainda é necessário antes de validar.</div><div class="single-result-canvas"><canvas id="result-cox"></canvas></div></div>`;
}

function kmCard(gene) {
  const row = expressionRowsFor([gene]).rows[gene];
  const v = buildReferenceVectors(dp);
  if (!row || !v.endpointAdequate) return noDataCard(`Kaplan-Meier — ${gene}`,`${gene} não possui expressão alinhada com um endpoint adequado (mínimo 20 registros e 5 eventos) no estudo ativo.`);
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">${esc(v.endpointLabel||'sobrevida')}</span><span class="study-pill">${esc(v.endpointTimeColumn||'tempo?')}</span><span class="study-pill">gene ${esc(gene)}</span>`)}<div class="card__title">Kaplan-Meier — ${esc(gene)}</div><div class="card__subtitle">Grupos Alto/Baixo definidos pela mediana de expressão em log2 na própria coorte. Curva de grupos de referência, não previsão individual.</div><div class="single-result-canvas"><canvas id="result-km-${safeId(gene)}"></canvas></div><div id="km-meta-${safeId(gene)}" class="mt-3"></div></div>`;
}

function noDataCard(title, note) {
  return `<div class="card result-graph-card">${statusHeader()}<div class="card__title">${esc(title)}</div><div class="empty-science mt-4">${esc(note)}</div></div>`;
}

function drawTop30() {
  const el = document.getElementById('result-top30'); if (!el) return false;
  const d = [...analytics.topMut].slice(0,30).reverse(); const t = getChartTheme();
  charts.push(new Chart(el,{type:'bar',data:{labels:d.map(x=>x.symbol),datasets:[{data:d.map(x=>x.frequency),backgroundColor:'rgba(155,89,182,.72)'}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${Number(c.raw).toFixed(2)}%`,afterLabel:c=>`${d[c.dataIndex].count} amostra(s) alterada(s)`}}},scales:{x:{beginAtZero:true,ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'Frequência de mutação (%)',color:t.text}},y:{ticks:{color:t.text},grid:{display:false}}}}}));
  return true;
}

function drawMutationHeatmap() {
  const canvas = document.getElementById('result-mutheat'); if (!canvas) return false;
  const genes = analytics.topMut.slice(0,30), allSamples=(dp.pack?.mutationSelection?.sampleIds||[]).slice(); if (!genes.length||!allSamples.length) return false;
  const geneSets=genes.map(g=>({gene:g.symbol,freq:g.frequency,set:new Set(g.samples||[])}));
  const burden=new Map(allSamples.map(s=>[s,0])); for(const g of geneSets) for(const sid of g.set) if(burden.has(sid)) burden.set(sid,(burden.get(sid)||0)+1);
  const samples=[...allSamples].sort((a,b)=>(burden.get(b)||0)-(burden.get(a)||0)).slice(0,90);
  const rowH=22,colW=Math.max(7,Math.min(12,Math.floor(760/Math.max(1,samples.length)))),labelW=116,rightW=72,topH=34,bottomH=20;
  canvas.width=labelW+samples.length*colW+rightW; canvas.height=topH+geneSets.length*rowH+bottomH; canvas.style.width=`${canvas.width}px`; canvas.style.height=`${canvas.height}px`;
  const ctx=canvas.getContext('2d'),t=getChartTheme(); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.font='11px sans-serif'; ctx.textBaseline='middle';
  geneSets.forEach((g,r)=>{const y=topH+r*rowH;ctx.fillStyle=t.text;ctx.fillText(g.gene,4,y+rowH/2);for(let c=0;c<samples.length;c++){const x=labelW+c*colW;ctx.fillStyle=g.set.has(samples[c])?'#8e44ad':'rgba(130,140,160,.14)';ctx.fillRect(x+1,y+2,colW-2,rowH-4);}ctx.fillStyle=t.muted;ctx.fillText(`${Number(g.freq||0).toFixed(1)}%`,labelW+samples.length*colW+8,y+rowH/2);});
  ctx.fillStyle=t.muted;ctx.font='10px sans-serif';ctx.fillText(`${samples.length}/${allSamples.length} amostras exibidas`,labelW,15);
  return true;
}

function drawDEGs() {
  if(dp.pack.scope!=='completo') return false;
  const el=document.getElementById('result-degs'); if(!el) return false; const d=[...analytics.topDEGs].slice(0,15).sort((a,b)=>a.logFC-b.logFC); const t=getChartTheme();
  charts.push(new Chart(el,{type:'bar',data:{labels:d.map(x=>x.gene),datasets:[{data:d.map(x=>x.logFC),backgroundColor:d.map(x=>x.logFC>0?'rgba(231,76,60,.78)':'rgba(46,127,240,.78)')}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`log2FC=${Number(c.raw).toFixed(4)}`,afterLabel:c=>`FDR=${fmtP(d[c.dataIndex]['adj.P.Val'])}`}}},scales:{x:{ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'log2 Fold Change (Relapse − None)',color:t.text}},y:{ticks:{color:t.text},grid:{display:false}}}}})); return true;
}

function drawVolcano() {
  if(dp.pack.scope!=='completo') return false;
  const el=document.getElementById('result-volcano'); if(!el) return false; const pts=volcanoPoints(analytics.dea),ns=pts.filter(x=>!x.significant),up=pts.filter(x=>x.significant&&x.x>0),down=pts.filter(x=>x.significant&&x.x<0),t=getChartTheme();
  charts.push(new Chart(el,{type:'scatter',data:{datasets:[{label:'NS',data:ns,backgroundColor:'rgba(133,144,168,.48)',pointRadius:2},{label:'Up',data:up,backgroundColor:'rgba(231,76,60,.78)',pointRadius:3},{label:'Down',data:down,backgroundColor:'rgba(46,127,240,.78)',pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,parsing:false,animation:false,plugins:{legend:{labels:{color:t.text}},tooltip:{callbacks:{label:c=>`${c.raw.gene}: log2FC=${c.raw.x.toFixed(4)} · FDR=${fmtP(c.raw.adjP)}`}}},scales:{x:{ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'log2 Fold Change',color:t.text}},y:{ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'−log10(FDR)',color:t.text}}}},plugins:[thresholdPlugin(.5,-Math.log10(.05))]})); return true;
}

function drawCox(genes) {
  const el=document.getElementById('result-cox'); if(!el) return false; const v=buildReferenceVectors(dp),x=expressionRowsFor(genes); if(!x.genes.length||!v.endpointAdequate) return false;
  let d=coxUnivariate(v.time,v.event,x.genes,x.rows).filter(r=>Number.isFinite(r.HR)&&r.HR>0&&r.HR_lower>0&&r.HR_upper>0); if(!d.length) return false;
  const q=bhFdr(d.map(r=>r.p_value)); d.forEach((r,i)=>r.q_value=q[i]); d=d.sort((a,b)=>a.HR-b.HR);
  const points=d.map((r,i)=>({x:r.HR,y:i,gene:r.Gene,lo:r.HR_lower,hi:r.HR_upper,p:r.p_value,q:r.q_value,n:r.n,events:r.nEvents})),t=getChartTheme();
  charts.push(new Chart(el,{type:'scatter',data:{datasets:[{data:points,backgroundColor:points.map(p=>p.q<.05?(p.x>1?'#e74c3c':'#2e7ff0'):'#8590a8'),pointRadius:7}]},options:{responsive:true,maintainAspectRatio:false,parsing:false,animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.raw.gene}: HR=${c.raw.x.toFixed(3)} · IC95% ${c.raw.lo.toFixed(3)}–${c.raw.hi.toFixed(3)}`,afterLabel:c=>`p=${fmtP(c.raw.p)} · FDR=${fmtP(c.raw.q)} · eventos=${c.raw.events}/${c.raw.n}`}}},scales:{x:{type:'logarithmic',min:Math.max(.05,Math.min(...points.map(p=>p.lo))*.8),max:Math.max(2,Math.max(...points.map(p=>p.hi))*1.2),ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'Hazard Ratio (escala log)',color:t.text}},y:{min:-1,max:d.length,ticks:{color:t.text,callback:v=>Number.isInteger(v)&&d[v]?d[v].Gene:''},grid:{display:false}}}},plugins:[forestCIPlugin()]})); return true;
}

function drawKM(gene) {
  const el=document.getElementById(`result-km-${safeId(gene)}`); if(!el) return false;
  const v=buildReferenceVectors(dp),x=expressionRowsFor([gene]),row=x.rows[gene]; if(!row||!v.endpointAdequate) return false;
  const s=analyzeSurvival(v.time,v.event,row.values); if(!s||!s.km?.length) return false;
  const t=getChartTheme(),palette={Alto:'#c0392b',Baixo:'#2980b9'};
  const datasets=[];
  for(const g of s.km){
    datasets.push({
      type:'line',label:`${g.name} (n=${g.n})`,
      data:g.times.map((xx,i)=>({x:xx,y:g.surv[i]})),
      borderColor:palette[g.name]||t.primary,backgroundColor:'transparent',
      stepped:true,pointRadius:0,borderWidth:2.5
    });
    if(g.censorTimes?.length){
      datasets.push({
        type:'scatter',label:`Censura ${g.name}`,
        data:g.censorTimes.map((xx,i)=>({x:xx,y:g.censorSurv[i]})),
        borderColor:palette[g.name]||t.primary,backgroundColor:palette[g.name]||t.primary,
        pointStyle:'cross',pointRadius:4,pointHoverRadius:5,showLine:false
      });
    }
  }
  charts.push(new Chart(el,{
    type:'line',
    data:{datasets},
    options:{
      responsive:true,maintainAspectRatio:false,parsing:false,animation:false,
      plugins:{
        legend:{labels:{color:t.text,filter:item=>!String(item.text).startsWith('Censura')}},
        tooltip:{callbacks:{label:c=>String(c.dataset.label).startsWith('Censura')?`Censura · t=${Number(c.raw.x).toFixed(2)} meses`:`${c.dataset.label}: S(t)=${Number(c.raw.y).toFixed(3)}`}}
      },
      scales:{
        x:{type:'linear',ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'Tempo (meses)',color:t.text}},
        y:{min:0,max:1,ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'Probabilidade de sobrevida do grupo',color:t.text}}
      }
    }
  }));

  const maxTime=Math.max(...v.time.filter(Number.isFinite),0);
  const riskTimes=[0,50,100,150].filter((x,i)=>x<=Math.max(150,maxTime)||i===0);
  const riskRows=s.km.map(g=>({name:g.name,vals:atRiskAt(g,riskTimes)}));
  const riskTable=`<div class="km-risk-wrap"><strong>Número em risco</strong><div class="table-wrap"><table class="data-table km-risk-table"><thead><tr><th>Grupo</th>${riskTimes.map(x=>`<th>${x} m</th>`).join('')}</tr></thead><tbody>${riskRows.map(r=>`<tr><td>${esc(r.name)}</td>${r.vals.map(n=>`<td>${n}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  const meta=document.getElementById(`km-meta-${safeId(gene)}`);
  if(meta) meta.innerHTML=`<div class="validation-strip"><div><span>Gene</span><strong>${esc(gene)}</strong></div><div><span>Corte de expressão</span><strong>mediana = ${Number(s.medianCut).toFixed(4)}</strong></div><div><span>Grupos</span><strong>Alto n=${s.nAlto} · Baixo n=${s.nBaixo}</strong></div><div><span>Log-rank</span><strong>p=${fmtP(s.logRank?.p)}</strong></div><div><span>Endpoint</span><strong>${esc(v.endpointKey)} · ${esc(v.endpointTimeColumn||'—')}</strong></div><div><span>Eventos</span><strong>${s.events}/${s.n}</strong></div></div>${riskTable}<p class="chart-note mt-3">A implementação local usa o mesmo corte por mediana do Script.R corrigido e um único endpoint de coorte. Ainda assim, o selo “validado contra R” só é permitido depois de conferir pacientes, tempos, eventos, curva e p-valor contra a saída R correspondente.</p>`;
  return true;
}

function expressionRowsFor(genes) {
  const v=buildReferenceVectors(dp),map=new Map((dp.expr||[]).map(r=>[String(r.symbol).toUpperCase(),r])),rows={},available=[];
  for(const gene of genes){const src=map.get(gene); if(!src) continue; const values=v.sampleIndices.map(i=>Number.isInteger(i)?transformExpressionValue(src.values?.[i],dp.pack):NaN); rows[gene]={values}; available.push(gene);}
  return {rows,genes:available};
}

function saveHistory(items) {
  if (!items.length) return;
  let history=[]; try{history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch{}
  const now=new Date().toISOString();
  for(const x of items) history.unshift({id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,title:x.title,genes:x.genes,studyId:dp.pack.studyId,studyName:dp.pack.studyName,status:'exploratório local',createdAt:now});
  localStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(0,100)));
}

function destroyCharts(){charts.forEach(c=>{try{c.destroy()}catch{}});charts=[];}
function thresholdPlugin(xCut,yCut){return{id:'genesisThresholds',afterDraw(chart){const{x,y}=chart.scales,ctx=chart.ctx;ctx.save();ctx.setLineDash([5,5]);ctx.strokeStyle='rgba(130,140,160,.7)';ctx.lineWidth=1;for(const v of[-xCut,xCut]){const px=x.getPixelForValue(v);ctx.beginPath();ctx.moveTo(px,y.top);ctx.lineTo(px,y.bottom);ctx.stroke();}const py=y.getPixelForValue(yCut);ctx.beginPath();ctx.moveTo(x.left,py);ctx.lineTo(x.right,py);ctx.stroke();ctx.restore();}}}
function forestCIPlugin(){return{id:'genesisForestCI',beforeDatasetsDraw(chart){const ds=chart.data.datasets[0],meta=chart.getDatasetMeta(0),x=chart.scales.x,ctx=chart.ctx;ctx.save();ctx.strokeStyle='rgba(130,140,160,.9)';ctx.lineWidth=2;ds.data.forEach((p,i)=>{const el=meta.data[i];if(!el||!Number.isFinite(p.lo)||!Number.isFinite(p.hi))return;const y=el.y,x1=x.getPixelForValue(p.lo),x2=x.getPixelForValue(p.hi);ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();ctx.beginPath();ctx.moveTo(x1,y-4);ctx.lineTo(x1,y+4);ctx.moveTo(x2,y-4);ctx.lineTo(x2,y+4);ctx.stroke();});const one=x.getPixelForValue(1);ctx.setLineDash([5,4]);ctx.strokeStyle='rgba(110,120,140,.8)';ctx.beginPath();ctx.moveTo(one,chart.chartArea.top);ctx.lineTo(one,chart.chartArea.bottom);ctx.stroke();ctx.restore();}}}
function msg(id,text,ok){const el=document.getElementById(id);if(el)el.innerHTML=`<div class="alert ${ok?'success':'warning'}"><i class="fa-solid ${ok?'fa-circle-check':'fa-triangle-exclamation'}"></i> ${esc(text)}</div>`;}
function safeId(s){return String(s).replace(/[^A-Za-z0-9_-]/g,'_');}
function fmtP(x){const v=Number(x);if(!Number.isFinite(v))return'—';return v<.001?v.toExponential(2):v.toFixed(4);}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
