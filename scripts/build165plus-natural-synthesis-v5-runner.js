const fs=require('fs'),path=require('path');
const source=path.join(__dirname,'build165plus-natural-synthesis-v5.js');
const temp=path.join(__dirname,'.build165plus-natural-synthesis-v5-runtime.js');
let s=fs.readFileSync(source,'utf8');
const fixes=[
  ["if(!h.includes('seb-165plus-institutional-synthesis-v4'))fail('V4 courante absente')","if(!h.includes('seb-v4-institutional-long-summary'))fail('V4 courante absente')"],
  ["if(!s.includes('SEB_HISTORY_INSTITUTIONAL_SYNTHESIS_V4'))fail('V4 historique absente')","if(!s.includes('SEB_V4_HISTORY_LONG_SUMMARY'))fail('V4 historique absente')"],
  ["sebBhSummary=function(card,c){","sebV4HistorySummary=function(card,c){"]
];
for(const [a,b] of fixes){if(!s.includes(a))throw new Error('Correctif V5 introuvable: '+a);s=s.replace(a,b)}
fs.writeFileSync(temp,s,'utf8');
try{require(temp)}finally{try{fs.unlinkSync(temp)}catch(_){}}
