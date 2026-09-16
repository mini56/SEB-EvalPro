const fs=require('fs'),path=require('path');
const source=path.join(__dirname,'build165plus-natural-synthesis-v8.js');
const temp=path.join(__dirname,'.build165plus-natural-synthesis-v8-runtime.js');
let s=fs.readFileSync(source,'utf8');
const marker=" s=s.replace('Le traçage et le repérage demandent encore davantage de contrôle et de précision. Le traçage reste lisible, mais les dimensions demandent davantage de contrôle.',";
if(!s.includes(marker))throw new Error('Point insertion V8 introuvable');
const add=" s=s.replace('La découpe demande encore davantage de contrôle et de précision.',\n   'La découpe reste moins maîtrisée et demande encore davantage de contrôle et de précision.');\n";
s=s.replace(marker,add+marker);
fs.writeFileSync(temp,s,'utf8');
try{require(temp)}finally{try{fs.unlinkSync(temp)}catch(_){}}
