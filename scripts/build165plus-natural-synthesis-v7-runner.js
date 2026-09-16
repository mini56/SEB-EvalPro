const fs=require('fs'),path=require('path');
const source=path.join(__dirname,'build165plus-natural-synthesis-v7.js');
const temp=path.join(__dirname,'.build165plus-natural-synthesis-v7-runtime.js');
let s=fs.readFileSync(source,'utf8');
const start=s.indexOf('function sebV7Metric(raw,label){');
const end=s.indexOf('\nfunction sebV7Subject',start);
if(start<0||end<0)throw new Error('Fonction sebV7Metric V7 introuvable');
const metricGood="function sebV7Metric(raw,label){const src=sebV7Raw(raw),needle=String(label||''),i=src.toLocaleLowerCase('fr-FR').indexOf(needle.toLocaleLowerCase('fr-FR'));if(i<0)return null;const m=src.slice(i+needle.length).match(/^\\s*:\\s*(\\d+(?:[.,]\\d+)?)\\s*\\/\\s*(\\d+(?:[.,]\\d+)?)/);if(!m)return null;const a=parseFloat(m[1].replace(',','.')),b=parseFloat(m[2].replace(',','.'));return Number.isFinite(a)&&Number.isFinite(b)&&b>0?a/b:null}";
s=s.slice(0,start)+metricGood+s.slice(end);
const exprOld='sebV7GroupInsights(SEB_V7_GROUPS.expression,text,id,3)';
if(!s.includes(exprOld))throw new Error('Limite observations expression V7 introuvable');
s=s.replace(exprOld,'sebV7GroupInsights(SEB_V7_GROUPS.expression,text,id,5)');
fs.writeFileSync(temp,s,'utf8');
try{require(temp)}finally{try{fs.unlinkSync(temp)}catch(_){}}
