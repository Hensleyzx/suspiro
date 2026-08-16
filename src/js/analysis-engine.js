import { loadDatapack, loadDatapacks } from './datapack.js';
import { analyzeSurvival } from './survival.js';
import { univariate as coxUnivariate } from './cox.js';
import { runDEA } from './dea.js';
import { median, percentileRank, bhFdr } from './stats.js';
import { technicalReliability } from './quality.js';
import { buildMatchedCohort } from './similarity.js';

function num(v){const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)?x:NaN}
function statusEvent(text,eventTerms){const s=String(text??'').toUpperCase();return eventTerms.test(s)?1:0}
function firstExistingColumn(rows,candidates){
  const names=new Set();
  for(const r of rows) for(const k of Object.keys(r||{})) names.add(k);
  return candidates.find(k=>names.has(k))||null;
}
function timeMonths(row,col){
  if(!col)return NaN;
  const x=num(row?.[col]);
  if(!Number.isFinite(x))return NaN;
  return /DAYS/i.test(col)?x/30.4375:x;
}
function eventFrom(row,col,kind='os'){
  if(!col)return NaN;
  const raw=row?.[col];
  if(raw==null||String(raw).trim()==='')return NaN;
  if(col==='FIRST_EVENT')return String(raw).trim()==='None'?0:1;
  return kind==='os'
    ? statusEvent(raw,/DECEASED|DEAD|DIED|(^|:)1($|:)/)
    : statusEvent(raw,/RECURRED|RELAPSE|EVENT|(^|:)1($|:)/);
}

export function transformExpressionValue(value,pack){const x=Number(value);if(!Number.isFinite(x))return NaN;return pack?.expressionTransform?.key==='log2p1'?Math.log2(Math.max(0,x)+1):x}

export function buildReferenceVectors(dp){
  const clinicalRows=dp.clinical?.rows||[];
  const clinicalMap=new Map(clinicalRows.map(r=>[String(r.PATIENT_ID),r]));
  const osTimeCol=firstExistingColumn(clinicalRows,['OS_MONTHS','OVERALL_SURVIVAL_MONTHS','OS_DAYS']);
  const osEventCol=firstExistingColumn(clinicalRows,['OS_STATUS','VITAL_STATUS']);
  const efsTimeCol=firstExistingColumn(clinicalRows,['EFS_MONTHS','DFS_MONTHS','DAYS_TO_EVENT']);
  const efsEventCol=firstExistingColumn(clinicalRows,['EFS_STATUS','DFS_STATUS','FIRST_EVENT']);

  // Mantém a mesma regra do Script.R corrigido: um único endpoint/coluna para
  // a coorte inteira. Não mistura OS_MONTHS e OS_DAYS paciente a paciente.
  const candidates=[];
  if((dp.rnaSampleIds||[]).length){
    for(let i=0;i<dp.rnaSampleIds.length;i++){
      const sampleId=dp.rnaSampleIds[i],patientId=String(dp.sampleToPatient.get(sampleId)||'');
      if(!patientId)continue;
      const clinical=clinicalMap.get(patientId);if(!clinical)continue;
      candidates.push({
        i,patientId,clinical,
        osTime:timeMonths(clinical,osTimeCol),
        osEvent:eventFrom(clinical,osEventCol,'os'),
        efsTime:timeMonths(clinical,efsTimeCol),
        efsEvent:eventFrom(clinical,efsEventCol,'efs')
      });
    }
  }else{
    const allow=new Set((dp.pack?.analysisPatientIds||[]).map(String));
    for(const clinical of clinicalRows){
      const patientId=String(clinical.PATIENT_ID||'');
      if(!patientId||(allow.size&&!allow.has(patientId)))continue;
      candidates.push({
        i:null,patientId,clinical,
        osTime:timeMonths(clinical,osTimeCol),
        osEvent:eventFrom(clinical,osEventCol,'os'),
        efsTime:timeMonths(clinical,efsTimeCol),
        efsEvent:eventFrom(clinical,efsEventCol,'efs')
      });
    }
  }

  const osOk=candidates.filter(x=>Number.isFinite(x.osTime)&&x.osTime>0&&Number.isFinite(x.osEvent));
  const efsOk=candidates.filter(x=>Number.isFinite(x.efsTime)&&x.efsTime>0&&Number.isFinite(x.efsEvent));
  const osEvents=osOk.reduce((a,x)=>a+(x.osEvent?1:0),0);
  const efsEvents=efsOk.reduce((a,x)=>a+(x.efsEvent?1:0),0);

  let selected=[],endpointLabel='Sobrevida',endpointKey='SURV',timeCol=null,eventCol=null;
  if(osOk.length>=20&&osEvents>=5){
    selected=osOk;endpointLabel='Sobrevida Global (OS)';endpointKey='OS';timeCol=osTimeCol;eventCol=osEventCol;
  }else if(efsOk.length>=20&&efsEvents>=5){
    selected=efsOk;endpointLabel='Sobrevida Livre de Evento/Doença';endpointKey='EFS';timeCol=efsTimeCol;eventCol=efsEventCol;
  }else{
    selected=osOk.length>=efsOk.length?osOk:efsOk;
    if(selected===osOk){endpointLabel='Sobrevida Global (OS) — insuficiente';endpointKey='OS';timeCol=osTimeCol;eventCol=osEventCol;}
    else{endpointLabel='Sobrevida Livre de Evento/Doença — insuficiente';endpointKey='EFS';timeCol=efsTimeCol;eventCol=efsEventCol;}
  }

  const sampleIndices=[],time=[],event=[],patients=[],clinicalOut=[];
  for(const x of selected){
    sampleIndices.push(Number.isInteger(x.i)?x.i:null);
    time.push(endpointKey==='OS'?x.osTime:x.efsTime);
    event.push(endpointKey==='OS'?x.osEvent:x.efsEvent);
    patients.push(x.patientId);clinicalOut.push(x.clinical);
  }
  return{
    sampleIndices,time,event,patients,clinicalRows:clinicalOut,endpointLabel,endpointKey,
    endpointTimeColumn:timeCol,endpointEventColumn:eventCol,
    nEvents:event.reduce((a,b)=>a+(b?1:0),0),
    expressionAligned:(dp.rnaSampleIds||[]).length>0,
    endpointAdequate:selected.length>=20&&event.reduce((a,b)=>a+(b?1:0),0)>=5
  };
}

function expressionMap(dp){return new Map((dp.expr||[]).map(r=>[String(r.symbol).toUpperCase(),r]));}
function transformedValues(vectors,exprRow,pack){return vectors.sampleIndices.map(i=>Number.isInteger(i)?transformExpressionValue(exprRow?.values?.[i],pack):NaN);}
function coxForGene(vectors,exprRow,gene,pack){if(!exprRow)return null;const values=transformedValues(vectors,exprRow,pack),rows={[gene]:{values}};return coxUnivariate(vectors.time,vectors.event,[gene],rows)[0]||null;}
function survivalForGene(vectors,exprRow,pack){if(!exprRow)return null;return analyzeSurvival(vectors.time,vectors.event,transformedValues(vectors,exprRow,pack));}
function kmChartData(kmResult){if(!kmResult)return null;return{medianCut:kmResult.medianCut,p:kmResult.logRank?.p,nAlto:kmResult.nAlto,nBaixo:kmResult.nBaixo,groups:kmResult.km.map(g=>({name:g.name,n:g.n,nEvents:g.nEvents,points:g.times.map((x,i)=>({x,y:g.surv[i]}))}))};}

function mutationHeatmapData(dp,maxGenes=30,maxSamples=60){
  const genes=Object.values(dp?.mut?.byGene||{}).sort((a,b)=>(b.count||0)-(a.count||0)).slice(0,maxGenes);
  const sampleIds=(dp?.pack?.mutationSelection?.sampleIds||[]).slice();
  if(!genes.length||!sampleIds.length)return null;
  const burden=new Map(sampleIds.map(x=>[x,0]));
  for(const g of genes)for(const sid of g.samples||[])if(burden.has(sid))burden.set(sid,(burden.get(sid)||0)+1);
  const selected=sampleIds.sort((a,b)=>(burden.get(b)||0)-(burden.get(a)||0)).slice(0,maxSamples);
  return {genes:genes.map(g=>({gene:g.symbol,frequency:Number(g.frequency||0),values:selected.map(sid=>(g.samples||[]).includes(sid)?1:0)})),samples:selected.map((_,i)=>`A${String(i+1).padStart(2,'0')}`),nShown:selected.length,nTotal:sampleIds.length};
}

function fusionFrequency(clinicalRows,key){let pos=0,n=0;for(const r of clinicalRows){const v=String(r[key]??'').trim();if(!v||/NOT AVAILABLE|UNKNOWN|NA$/i.test(v))continue;n++;if(/POSITIVE|PRESENT|DETECTED|YES/i.test(v))pos++;}return n?{positive:pos,n,frequency:100*pos/n}:null;}

const deaCache=new Map();
function computeDEA(dp){const key=`${dp.pack.studyId}|${dp.pack.buildDate}|${dp.pack.nGenes}`;if(deaCache.has(key))return deaCache.get(key);const clinicalMap=new Map((dp.clinical?.rows||[]).map(r=>[String(r.PATIENT_ID),r]));const groups=dp.rnaSampleIds.map(sampleId=>{const patientId=String(dp.sampleToPatient.get(sampleId)||'');const r=clinicalMap.get(patientId);const event=String(r?.FIRST_EVENT??'').trim().toLowerCase();return event==='relapse'?1:event==='none'?0:-1;});const transform=dp.pack.expressionTransform?.key==='log2p1'?'log2p1':'none';const result=runDEA(dp.expr,groups,{transform});deaCache.set(key,result);return result;}

function evidenceReliability(ev,dataQuality){let score=Math.round((dataQuality?.score||0)*0.35);if(ev.cox){score+=ev.cox.n>=100?15:ev.cox.n>=50?10:ev.cox.n>=20?6:2;score+=ev.cox.nEvents>=20?15:ev.cox.nEvents>=10?10:ev.cox.nEvents>=5?5:0;if(Number.isFinite(ev.cox.q_value)&&ev.cox.q_value<.05)score+=20;else if(Number.isFinite(ev.cox.p_value)&&ev.cox.p_value<.05)score+=10;if(Number.isFinite(ev.cox.HR_lower)&&Number.isFinite(ev.cox.HR_upper)&&!(ev.cox.HR_lower<=1&&ev.cox.HR_upper>=1))score+=10;}if(ev.dea?.significant)score+=5;score=Math.max(0,Math.min(100,Math.round(score)));return{score,label:score>=80?'Alta':score>=60?'Moderada':score>=40?'Baixa-moderada':'Baixa',note:'Força técnica da evidência dentro da coorte; não é probabilidade diagnóstica ou prognóstica individual.'};}
function classifyEvidence(evidences){const favoraveis=evidences.filter(x=>x.sinal==='favoravel').length,desfavoraveis=evidences.filter(x=>x.sinal==='desfavoravel').length,inconclusivas=evidences.length-favoraveis-desfavoraveis;if(!evidences.length||(favoraveis===0&&desfavoraveis===0))return{key:'inconclusivo',label:'Evidências exploratórias inconclusivas',className:'neutral',favoraveis,desfavoraveis,inconclusivas};if(desfavoraveis>favoraveis)return{key:'desfavoravel',label:'Predomínio exploratório de associações desfavoráveis',className:'high',favoraveis,desfavoraveis,inconclusivas};if(favoraveis>desfavoraveis)return{key:'favoravel',label:'Predomínio exploratório de associações favoráveis',className:'low',favoraveis,desfavoraveis,inconclusivas};return{key:'misto',label:'Conjunto exploratório misto',className:'mid',favoraveis,desfavoraveis,inconclusivas};}

async function analyzeAgainstStudy(dados,dp){
  const evidencias=[],chartExpression=[],chartMutation=[],coxResults=[],kmResults=[];
  const vectors=buildReferenceVectors(dp),expMap=expressionMap(dp),dea=computeDEA(dp),deaMap=new Map((dea.table||[]).map(x=>[String(x.gene).toUpperCase(),x]));
  for(const geneRaw of dados.biomarcadores||[]){
    const gene=String(geneRaw).toUpperCase(),rawPatientExpr=num(dados.expressao?.[gene]),exprRow=expMap.get(gene)||null,deaRef=deaMap.get(gene)||null;let cohortMedian=NaN,patientGroup=null,percentile=NaN,km=null,cox=null;const patientExpr=transformExpressionValue(rawPatientExpr,dp.pack);
    if(exprRow&&vectors.sampleIndices.length>=10){const cohortValues=transformedValues(vectors,exprRow,dp.pack).filter(Number.isFinite);cohortMedian=median(cohortValues);percentile=percentileRank(cohortValues,patientExpr);km=survivalForGene(vectors,exprRow,dp.pack);cox=coxForGene(vectors,exprRow,gene,dp.pack);if(Number.isFinite(patientExpr)&&Number.isFinite(cohortMedian))patientGroup=patientExpr>=cohortMedian?'Alto':'Baixo';if(Number.isFinite(rawPatientExpr)&&Number.isFinite(cohortMedian))chartExpression.push({gene,patientRaw:rawPatientExpr,patient:patientExpr,median:cohortMedian,percentile});if(km)kmResults.push({gene,patientGroup,endpoint:vectors.endpointLabel,...kmChartData(km)});if(cox)coxResults.push(cox);}
    const mut=dp.mut?.byGene?.[gene];if(mut)chartMutation.push({gene,frequency:Number(mut.frequency||0),count:mut.count||0,denominator:dp.mut.totalSamples||0});
    evidencias.push({gene,patientExpressionRaw:Number.isFinite(rawPatientExpr)?rawPatientExpr:null,patientExpression:Number.isFinite(patientExpr)?patientExpr:null,cohortMedian:Number.isFinite(cohortMedian)?cohortMedian:null,percentile:Number.isFinite(percentile)?percentile:null,patientGroup,cox,dea:deaRef?{logFC:deaRef.logFC,adjP:deaRef['adj.P.Val'],significant:deaRef['adj.P.Val']<.05&&Math.abs(deaRef.logFC)>.5}:null,mutationFrequency:mut?Number(mut.frequency||0):null,sinal:'inconclusivo',resumo:'Dados organizados; associação ainda não classificada.'});
  }
  const q=bhFdr(coxResults.map(x=>x.p_value));coxResults.forEach((x,i)=>{x.q_value=q[i];x.converged=x.converged!==false;});const coxByGene=new Map(coxResults.map(x=>[x.Gene,x]));
  for(const ev of evidencias){
    ev.cox=coxByGene.get(ev.gene)||ev.cox;
    if(ev.gene==='BCR-ABL1'){const f=fusionFrequency(dp.clinical?.rows||[],'BCR_ABL1_STATUS');ev.fusionCohort=f;const patientFusion=dados.fusoes?.['BCR-ABL1']||'nao_informado';ev.patientFusion=patientFusion;ev.resumo=patientFusion==='positivo'?`Fusão BCR-ABL1 informada como positiva. Na coorte, ${f?`${f.frequency.toFixed(1)}% (${f.positive}/${f.n}) dos registros com status disponível foram positivos`:'a frequência não pôde ser calculada'}.`:'O GENESIS não infere BCR-ABL1 pela expressão; utiliza apenas o status informado e dados disponíveis na coorte.';continue;}
    const c=ev.cox;if(c&&Number.isFinite(c.q_value)&&c.q_value<.05&&c.nEvents>=10&&ev.patientGroup&&Number.isFinite(ev.patientExpression)){const highWorse=c.HR>1,adverse=(ev.patientGroup==='Alto'&&highWorse)||(ev.patientGroup==='Baixo'&&!highWorse);ev.sinal=adverse?'desfavoravel':'favoravel';ev.resumo=`Expressão ${ev.patientGroup.toLowerCase()} versus mediana da coorte (percentil ${Math.round(ev.percentile)}). Cox por 1 DP: HR=${c.HR.toFixed(3)}, IC95% ${c.HR_lower.toFixed(3)}–${c.HR_upper.toFixed(3)}, p=${c.p_value.toPrecision(3)}, FDR=${c.q_value.toPrecision(3)}, n=${c.n}, eventos=${c.nEvents}.`;}
    else if(c){ev.resumo=`Cox por 1 DP: HR=${c.HR.toFixed(3)}, IC95% ${c.HR_lower.toFixed(3)}–${c.HR_upper.toFixed(3)}, p=${c.p_value.toPrecision(3)}, FDR=${Number.isFinite(c.q_value)?c.q_value.toPrecision(3):'NA'}, n=${c.n}, eventos=${c.nEvents}. Resultado tratado como inconclusivo pelo filtro exploratório.${ev.patientGroup?` Amostra no grupo ${ev.patientGroup}.`:''}`;}
    else if(ev.dea?.significant){ev.resumo=`O gene foi diferencialmente expresso entre Relapse e None nesta coorte (log2FC=${ev.dea.logFC.toFixed(3)}, FDR=${ev.dea.adjP.toPrecision(3)}), porém não houve Cox utilizável para síntese de sobrevida.`;}
    else ev.resumo='Não houve evidência de sobrevida suficiente para síntese deste gene nesta coorte.';
  }
  const dataQuality=technicalReliability(dp,{vectors,dea});for(const ev of evidencias)ev.reliability=evidenceReliability(ev,dataQuality);
  const matched=buildMatchedCohort(dp,vectors,dados,expMap);
  return {studyId:dp.pack.studyId,studyName:dp.pack.studyName,dp,vectors,dea,dataQuality,evidencias,matched,charts:{expression:chartExpression,mutation:chartMutation,cox:coxResults,km:kmResults},referencia:{studyId:dp.pack.studyId,studyName:dp.pack.studyName,nPatients:dp.pack.nPatients,nAnalysisSamples:dp.pack.nAnalysisSamples,nGenes:dp.pack.nGenes,buildDate:dp.pack.buildDate,scope:dp.pack.scope,expressionTransform:dp.pack.expressionTransform,selection:dp.pack.selection,endpoint:vectors.endpointLabel}};
}

function aggregateEvidence(dados,studyResults){
  const out=[];
  for(const geneRaw of dados.biomarcadores||[]){const gene=String(geneRaw).toUpperCase();const perStudy=studyResults.map(s=>{const ev=s.evidencias.find(x=>x.gene===gene);return ev?{studyId:s.studyId,studyName:s.studyName,...ev}:null;}).filter(Boolean);const fav=perStudy.filter(x=>x.sinal==='favoravel').length,des=perStudy.filter(x=>x.sinal==='desfavoravel').length;let sinal='inconclusivo';if(fav>des)sinal='favoravel';else if(des>fav)sinal='desfavoravel';const scores=perStudy.map(x=>x.reliability?.score).filter(Number.isFinite);const score=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0;const primary=perStudy[0]||{gene};out.push({...primary,gene,sinal,studyEvidence:perStudy,reliability:{score,label:score>=80?'Alta':score>=60?'Moderada':score>=40?'Baixa-moderada':'Baixa',note:'Média da força técnica entre as coortes com dados disponíveis.'},resumo:`${perStudy.length}/${studyResults.length} coorte(s) forneceram dados para ${gene}. Associações favoráveis: ${fav}; desfavoráveis: ${des}; demais/inconclusivas: ${Math.max(0,perStudy.length-fav-des)}.`});}
  return out;
}

function aggregateQuality(studyResults){if(!studyResults.length)return{score:0,label:'Indisponível',className:'low',note:'Sem coorte.'};const score=Math.round(studyResults.reduce((s,x)=>s+(x.dataQuality?.score||0),0)/studyResults.length);return{score,label:score>=80?'Alta':score>=60?'Moderada':'Baixa',className:score>=80?'high':score>=60?'mid':'low',note:'Média de qualidade técnica das coortes selecionadas; não é confiança diagnóstica.'};}
function buildInterpretation(dados,studyResults,perfil){if(!studyResults.length)return`Nenhuma coorte LLA carregada pôde ser usada. Foram apenas organizados ${dados.biomarcadores?.length||0} biomarcadores.`;const matched=studyResults.filter(x=>x.matched?.available),names=studyResults.map(x=>x.studyName).join('; ');const matchedText=matched.length?`${matched.length} coorte(s) permitiram formar grupos de pacientes com perfil semelhante ao caso usando somente critérios informados e disponíveis (alterações genéticas, expressão, subtipo, idade, leucócitos, sexo e/ou BCR-ABL1). As curvas exibidas pertencem a esses grupos de referência.`:'Os dados informados não foram suficientes para formar grupos de pacientes semelhantes com tamanho mínimo em nenhuma coorte.';return`O GENESIS comparou o caso em ${studyResults.length} estudo(s): ${names}. ${matchedText} A síntese “${perfil.label}” resume concordância exploratória entre biomarcadores e estudos. O sistema não transforma a curva da coorte em porcentagem individual de sobrevivência ou morte e não emite diagnóstico clínico.`;}

export async function analyzePatient(dados){
  let dps=[];const ids=[...new Set((dados.studyIds||[]).filter(Boolean))].slice(0,5);if(ids.length)dps=await loadDatapacks(ids);if(!dps.length){const active=await loadDatapack().catch(()=>null);if(active)dps=[active];}
  const studyResults=[];for(const dp of dps){try{studyResults.push(await analyzeAgainstStudy(dados,dp));}catch(err){console.error(`Falha na análise do estudo ${dp?.pack?.studyId}`,err);}}
  const evidencias=aggregateEvidence(dados,studyResults),perfil=classifyEvidence(evidencias),dataQuality=aggregateQuality(studyResults),interpretacao=buildInterpretation(dados,studyResults,perfil),primary=studyResults[0]||null;
  return {...dados,data:new Date().toISOString(),perfil,evidencias,interpretacao,dataQuality,referencia:primary?.referencia||null,referencias:studyResults.map(x=>x.referencia),studyResults:studyResults.map(x=>({studyId:x.studyId,studyName:x.studyName,dataQuality:x.dataQuality,matched:x.matched,referencia:x.referencia,deaSummary:x.dea?{n0:x.dea.n0,n1:x.dea.n1,nDEG:x.dea.nDEG,transform:x.dea.transform}:null})),deaSummary:primary?.dea?{n0:primary.dea.n0,n1:primary.dea.n1,nDEG:primary.dea.nDEG,transform:primary.dea.transform}:null,charts:{expression:primary?.charts.expression||[],mutation:primary?.charts.mutation||[],mutationHeatmap:primary?mutationHeatmapData(primary.dp):null,cox:primary?.charts.cox||[],km:primary?.charts.km||[],matchedSurvival:studyResults.filter(x=>x.matched?.available).map(x=>({studyId:x.studyId,studyName:x.studyName,endpoint:x.vectors.endpointLabel,...x.matched}))}};
}
