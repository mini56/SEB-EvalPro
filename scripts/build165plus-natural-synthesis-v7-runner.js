const fs=require('fs'),path=require('path');
const source=path.join(__dirname,'build165plus-natural-synthesis-v7.js');
const temp=path.join(__dirname,'.build165plus-natural-synthesis-v7-runtime.js');
let s=fs.readFileSync(source,'utf8');
const bad="label.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')";
const good="label.replace(/[.*+?^$()|[\\]\\\\{}]/g,'\\\\$&')";
if(!s.includes(bad))throw new Error('Correctif syntaxique V7 introuvable');
s=s.replace(bad,()=>good);
fs.writeFileSync(temp,s,'utf8');
try{require(temp)}finally{try{fs.unlinkSync(temp)}catch(_){}}
