import assert from 'node:assert/strict';
import { logRank, analyzeSurvival, atRiskAt } from '../src/js/survival.js';
import { univariate } from '../src/js/cox.js';
import { buildReferenceVectors } from '../src/js/analysis-engine.js';

function near(actual,expected,tol=1e-9,msg=''){
  assert.ok(Number.isFinite(actual),`${msg} não finito: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tol,`${msg}: ${actual} != ${expected}`);
}

// 1) Log-rank: referência independente statsmodels.survdiff
{
  const time=[5,6,6,7,10,12,15,18,20,22,25,30];
  const event=[1,1,0,1,1,0,1,1,0,1,1,0];
  const group=['A','B','A','B','A','B','A','B','A','B','A','B'];
  const r=logRank(time,event,group);
  near(r.chi2,0.06907582617182202,1e-12,'logrank chi2');
  near(r.p,0.7926871584028927,1e-12,'logrank p');
}

// 2) Cox Efron padronizado: referência independente statsmodels.PHReg
{
  const time=[5,6,6,7,10,12,15,18,20,22,25,30,35,40,42,50];
  const event=[1,1,0,1,1,0,1,1,0,1,1,0,1,0,1,0];
  const x=[1.2,0.7,1.5,0.4,1.1,0.9,1.7,1.3,2.0,1.8,2.2,2.4,2.0,2.8,2.6,3.0];
  const r=univariate(time,event,['G'],{G:{values:x}})[0];
  near(r.HR,0.07428768465924318,1e-10,'cox HR');
  near(r.HR_lower,0.015097856894411585,1e-10,'cox lower');
  near(r.HR_upper,0.365526056487783,1e-9,'cox upper');
  near(r.p_value,0.001384376913493579,2e-6,'cox p');
}

// 3) Endpoint único: se OS_MONTHS existe, não mistura OS_DAYS em quem está sem mês.
{
  const rows=[],rna=[],map=new Map();
  for(let i=1;i<=24;i++){
    const pid=`P${i}`,sid=`S${i}`;rna.push(sid);map.set(sid,pid);
    rows.push({
      PATIENT_ID:pid,
      OS_MONTHS:i<=22?String(10+i):'',
      OS_DAYS:String((10+i)*30.4375),
      OS_STATUS:i<=6?'DECEASED':'LIVING',
      EFS_MONTHS:String(5+i),
      EFS_STATUS:i<=10?'EVENT':'0'
    });
  }
  const dp={clinical:{rows},rnaSampleIds:rna,sampleToPatient:map,pack:{analysisPatientIds:rows.map(r=>r.PATIENT_ID)}};
  const v=buildReferenceVectors(dp);
  assert.equal(v.endpointKey,'OS');
  assert.equal(v.endpointTimeColumn,'OS_MONTHS');
  assert.equal(v.time.length,22);
  assert.equal(v.nEvents,6);
  assert.equal(v.endpointAdequate,true);
}

// 4) KM: corte >= mediana e número em risco.
{
  const time=[5,6,7,8,9,10,11,12];
  const event=[1,0,1,0,1,1,0,1];
  const expr=[1,2,3,4,5,6,7,8];
  const s=analyzeSurvival(time,event,expr);
  assert.equal(s.nAlto,4);
  assert.equal(s.nBaixo,4);
  const alto=s.km.find(g=>g.name==='Alto');
  assert.deepEqual(atRiskAt(alto,[0,10,12]),[4,3,1]);
}

console.log('GENESIS scientific smoke tests: OK');
