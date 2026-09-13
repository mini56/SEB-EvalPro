const fs=require('fs');
const path=require('path');
const zlib=require('zlib');
const root=path.resolve(__dirname,'..');
function show(label,text,needle,span=520){
  let from=0,count=0;
  while(true){
    const i=text.toLowerCase().indexOf(needle.toLowerCase(),from);
    if(i<0) break;
    count++;
    const a=Math.max(0,i-span), b=Math.min(text.length,i+needle.length+span);
    console.log(`\n=== ${label} #${count} (${needle}) ===\n${text.slice(a,b)}\n=== END ${label} #${count} ===`);
    from=i+needle.length;
    if(count>=12) break;
  }
}
const payload=path.join(__dirname,'dictee-patch.js.gz.b64');
const decoded=zlib.gunzipSync(Buffer.from(fs.readFileSync(payload,'utf8').trim(),'base64')).toString('utf8');
for(const needle of ['sessionStorage','Mots correctement alignés','motsCorrects','correctWords','score20','score','align','tokenize','Ponctuation','Majuscules']) show('PATCH',decoded,needle);
const htmlPath=path.join(root,'app','web','dictee.html');
if(fs.existsSync(htmlPath)){
  const html=fs.readFileSync(htmlPath,'utf8');
  for(const needle of ['sessionStorage','Mots correctement alignés','Score :','Vérifier','textarea','tri_de_cheville.html']) show('HTML',html,needle);
}
console.log('\nSEB EvalPro audit dictée terminé.');
