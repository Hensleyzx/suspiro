import '../css/genesis.css';
import { mountLayout, injectFontAwesome, warningBanner } from './common.js';
import { PROJECT_INFO } from './data.js';
import { loadDatapack } from './datapack.js';
import { cbio } from './cbio-api.js';

async function init() {
  injectFontAwesome();
  mountLayout('inicio','Início');
  const content = document.getElementById('page-content');
  let history=[]; try{history=JSON.parse(localStorage.getItem('genesis_graph_history_v10')||'[]')}catch{}
  const dp = await loadDatapack().catch(() => null);
  let catalog = null;
  try {
    catalog = await cbio.listLlaStudies();
  } catch {}

  content.innerHTML=`
  ${warningBanner()}
  <section class="hero">
    <span class="hero__badge"><i class="fa-solid fa-dna"></i> Bioinformática · Leucemia Linfoblástica Aguda</span>
    <h1 class="hero__title">${PROJECT_INFO.name}</h1>
    <p class="hero__subtitle">${PROJECT_INFO.subtitle}</p>
    <div class="hero__actions"><a href="resultados.html" class="btn btn-primary btn-lg"><i class="fa-solid fa-chart-column"></i> Abrir Resultados</a><a href="analise.html" class="btn btn-secondary btn-lg"><i class="fa-solid fa-address-card"></i> Cadastros</a><a href="dashboard.html" class="btn btn-ghost btn-lg"><i class="fa-solid fa-chart-line"></i> Dashboard</a></div>
    <div class="hero__stats"><div class="hero__stat"><div class="num">${catalog?catalog.all.length.toLocaleString('pt-BR'):'—'}</div><div class="lbl">Estudos no catálogo cBioPortal</div></div><div class="hero__stat"><div class="num">${catalog?catalog.lla.length.toLocaleString('pt-BR'):'—'}</div><div class="lbl">Estudos LLA filtrados</div></div><div class="hero__stat"><div class="num">${dp?Number(dp.pack.nAnalysisSamples).toLocaleString('pt-BR'):'—'}</div><div class="lbl">Amostras basais no cache</div></div><div class="hero__stat"><div class="num">${history.length}</div><div class="lbl">Gráficos no histórico</div></div></div>
  </section>
  <div class="project-summary">
    <div class="summary-card"><div class="summary-card__icon"><i class="fa-solid fa-chart-column"></i></div><h3>Resultados centralizados</h3><p>Seleção de estudo, genes e gráficos reunida em uma única rota para evitar que o usuário se perca entre páginas.</p></div>
    <div class="summary-card"><div class="summary-card__icon"><i class="fa-solid fa-filter-circle-dollar"></i></div><h3>Coorte basal</h3><p>Em estudos TARGET, o GENESIS prioriza uma amostra primária por paciente (09, depois 03) e exclui recaída, xenoenxerto e normal da coorte basal.</p></div>
    <div class="summary-card"><div class="summary-card__icon"><i class="fa-solid fa-chart-area"></i></div><h3>Análises reproduzíveis</h3><p>Top 30, Kaplan-Meier e Cox podem ser explorados na coorte ativa; DEA/Volcano ficam bloqueados em painéis parciais. Nenhum resultado local recebe selo R sem conferência numérica.</p></div>
    <div class="summary-card"><div class="summary-card__icon"><i class="fa-solid fa-user-shield"></i></div><h3>Pesquisa, não assistência</h3><p>Resultados exploratórios e resultados já validados contra o R ficam identificados separadamente; não há porcentagem individual de sobrevida.</p></div>
  </div>`;
}

init();
