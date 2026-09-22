const fs=require('fs'),path=require('path');
const source=path.join(__dirname,'build165plus-natural-synthesis-v7.js');
const temp=path.join(__dirname,'.build165plus-natural-synthesis-v7-runtime.js');
let s=fs.readFileSync(source,'utf8');
const start=s.indexOf('function sebV7Metric(raw,label){');
const end=s.indexOf('\nfunction sebV7Subject',start);
if(start<0||end<0)throw new Error('Fonction sebV7Metric V7 introuvable');
const metricGood="function sebV7Metric(raw,label){const src=sebV7Raw(raw),needle=String(label||''),i=src.toLocaleLowerCase('fr-FR').indexOf(needle.toLocaleLowerCase('fr-FR'));if(i<0)return null;const m=src.slice(i+needle.length).match(/^\\s*:\\s*(\\d+(?:[.,]\\d+)?)\\s*\\/\\s*(\\d+(?:[.,]\\d+)?)/);if(!m)return null;const a=parseFloat(m[1].replace(',','.')),b=parseFloat(m[2].replace(',','.'));return Number.isFinite(a)&&Number.isFinite(b)&&b>0?a/b:null}";
const resultHelpers=String.raw`
function sebV7Result(raw,label){
 const src=sebV7Raw(raw);if(!src||/exercice abandonné|non évalué|non evalue/i.test(src))return'';
 const pct=src.match(/(\d+(?:[.,]\d+)?)\s*%/);
 const score=src.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(?:point\(s\)|points?|réponses? correctes?)?/i);
 const fmt=v=>String(v).replace('.',',');
 if(score){
  const a=parseFloat(score[1].replace(',','.')),b=parseFloat(score[2].replace(',','.'));
  const p=pct?pct[1]:(Number.isFinite(a)&&Number.isFinite(b)&&b>0?String(Math.round(a/b*100)):null);
  return sebV7Cap(label)+' : '+fmt(score[1])+' / '+fmt(score[2])+(p?' ('+fmt(p)+' % de réussite).':'.');
 }
 if(pct)return sebV7Cap(label)+' : '+fmt(pct[1])+' % de réussite.';
 const err=src.match(/(?:-|—)?\s*(\d+)\s*erreur(?:\(s\)|s)?/i);
 if(err){const n=Number(err[1]);return sebV7Cap(label)+' : '+err[1]+' erreur'+(n<=1?'':'s')+'.';}
 return'';
}
function sebV7Results(keys,text,max,level){
 const out=[];for(const k of keys){if(level&&!['II','III'].includes(String(level(k)||'')))continue;const r=sebV7Result(text(k),SEB_V7_LABELS[k]||k);if(r&&!out.includes(r))out.push(r);if(out.length>=(max||2))break}return out;
}`;
s=s.slice(0,start)+metricGood+resultHelpers+s.slice(end);
const exprOld='sebV7GroupInsights(SEB_V7_GROUPS.expression,text,id,3)';
if(!s.includes(exprOld))throw new Error('Limite observations expression V7 introuvable');
s=s.replace(exprOld,'sebV7GroupInsights(SEB_V7_GROUPS.expression,text,id,5)');

const injects=[
 ["const e=sebV7GroupInsights(SEB_V7_GROUPS.fabrication,text,id,2);if(e.length)s+=e.join(' ');p.push(s.trim())","const e=sebV7GroupInsights(SEB_V7_GROUPS.fabrication,text,id,2);if(e.length)s+=e.join(' ');const r=sebV7Results(SEB_V7_GROUPS.fabrication,text,2,level);if(r.length)s+=' '+r.join(' ');p.push(s.trim())"],
 ["const e=sebV7GroupInsights(SEB_V7_GROUPS.briques,text,id,1);if(e.length)s+=e[0];p.push(s.trim())","const e=sebV7GroupInsights(SEB_V7_GROUPS.briques,text,id,1);if(e.length)s+=e[0];const r=sebV7Results(SEB_V7_GROUPS.briques,text,2,level);if(r.length)s+=' '+r.join(' ');p.push(s.trim())"],
 ["const e=sebV7GroupInsights(SEB_V7_GROUPS.organisation,text,id,2);if(e.length)s+=e.join(' ');p.push(s.trim())","const e=sebV7GroupInsights(SEB_V7_GROUPS.organisation,text,id,2);if(e.length)s+=e.join(' ');const r=sebV7Results(SEB_V7_GROUPS.organisation,text,2,level);if(r.length)s+=' '+r.join(' ');p.push(s.trim())"],
 ["const e=sebV7GroupInsights(SEB_V7_GROUPS.tri,text,id,1);if(e.length&&!/fiabilité sont satisfaisants/i.test(s))s+=' '+e[0];p.push(s.trim())","const e=sebV7GroupInsights(SEB_V7_GROUPS.tri,text,id,1);if(e.length&&!/fiabilité sont satisfaisants/i.test(s))s+=' '+e[0];const r=sebV7Results(SEB_V7_GROUPS.tri,text,2,level);if(r.length)s+=' '+r.join(' ');p.push(s.trim())"],
 ["const e=sebV7GroupInsights(SEB_V7_GROUPS.numerique,text,id,2);if(e.length)s+=e.join(' ');p.push(s.trim())","const e=sebV7GroupInsights(SEB_V7_GROUPS.numerique,text,id,2);if(e.length)s+=e.join(' ');const r=sebV7Results(SEB_V7_GROUPS.numerique,text,2,level);if(r.length)s+=' '+r.join(' ');p.push(s.trim())"],
 ["const e=sebV7GroupInsights(SEB_V7_GROUPS.expression,text,id,5);if(e.length)s+=e.join(' ');p.push(s.trim())","const e=sebV7GroupInsights(SEB_V7_GROUPS.expression,text,id,5);if(e.length)s+=e.join(' ');const r=sebV7Results(SEB_V7_GROUPS.expression,text,2,level);if(r.length)s+=' '+r.join(' ');p.push(s.trim())"],
 ["const e=sebV7GroupInsights(SEB_V7_GROUPS.maths,text,id,1);if(e.length)s+=e[0];p.push(s.trim())","const e=sebV7GroupInsights(SEB_V7_GROUPS.maths,text,id,1);if(e.length)s+=e[0];const r=sebV7Results(SEB_V7_GROUPS.maths,text,2,level);if(r.length)s+=' '+r.join(' ');p.push(s.trim())"]
];
for(const [oldValue,newValue] of injects){if(!s.includes(oldValue))throw new Error('Point d’injection des résultats V7 introuvable');s=s.replace(oldValue,newValue)}

// Les données chiffrées utiles doivent désormais atteindre la synthèse déterministe,
// afin que l'IA locale puisse les reformuler sans les inventer.
if(!s.includes('sebV7Results(SEB_V7_GROUPS.expression,text,2,level)'))throw new Error('Résultats expression non injectés');
if(!s.includes('sebV7Results(SEB_V7_GROUPS.maths,text,2,level)'))throw new Error('Résultats maths non injectés');

fs.writeFileSync(temp,s,'utf8');
try{require(temp)}finally{try{fs.unlinkSync(temp)}catch(_){}}
