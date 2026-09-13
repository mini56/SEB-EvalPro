const fs=require('fs'),path=require('path'),vm=require('vm');
const target=path.resolve(__dirname,'..','app','web','dictee.html');
function fail(m){console.error('SEB EvalPro dictée correction finale: '+m);process.exit(2)}
if(!fs.existsSync(target))fail('dictee.html généré introuvable');
let html=fs.readFileSync(target,'utf8');

function range(src,name){
  const m=new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`).exec(src);if(!m)fail(`fonction ${name} introuvable`);
  const start=m.index,brace=src.indexOf('{',start),q={v:null,e:false,line:false,block:false};let depth=0;
  for(let i=brace;i<src.length;i++){
    const c=src[i],n=src[i+1];
    if(q.line){if(c==='\n')q.line=false;continue} if(q.block){if(c==='*'&&n==='/'){q.block=false;i++}continue}
    if(q.v){if(q.e){q.e=false;continue}if(c==='\\'){q.e=true;continue}if(c===q.v)q.v=null;continue}
    if(c==='/'&&n==='/'){q.line=true;i++;continue} if(c==='/'&&n==='*'){q.block=true;i++;continue}
    if(c==="'"||c==='"'||c==='`'){q.v=c;continue} if(c==='{')depth++; if(c==='}'&&--depth===0)return{start,end:i+1};
  } fail(`fin de fonction ${name} introuvable`);
}
function put(src,name,code){const r=range(src,name);return src.slice(0,r.start)+code+src.slice(r.end)}

const TOK=String.raw`function tokens(text){
    const source=String(text==null?'':text).normalize('NFC'),out=[];
    const re=/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*(?:\s*[.,;:!?…]+)?/gu;let m;
    while((m=re.exec(source)))out.push(m[0].replace(/\s+([.,;:!?…]+)$/u,'$1'));
    return out;
  }`;

const ALIGN=String.raw`function align(referenceTokens,userTokens){
    function core(t){return String(t||'').normalize('NFC').replace(/\s*[.,;:!?…]+$/u,'').replace(/’/g,"'").toLowerCase()}
    function dist(a,b){const l=Array.from(a||''),r=Array.from(b||'');let p=Array.from({length:r.length+1},(_,i)=>i);for(let i=1;i<=l.length;i++){const c=new Array(r.length+1);c[0]=i;for(let j=1;j<=r.length;j++)c[j]=Math.min(c[j-1]+1,p[j]+1,p[j-1]+(l[i-1]===r[j-1]?0:1));p=c}return p[r.length]}
    const gap=1.6,n=referenceTokens.length,m=userTokens.length,dp=Array.from({length:n+1},()=>new Array(m+1).fill(0)),op=Array.from({length:n+1},()=>new Array(m+1).fill(null));
    for(let i=1;i<=n;i++){dp[i][0]=i*gap;op[i][0]='delete'}for(let j=1;j<=m;j++){dp[0][j]=j*gap;op[0][j]='insert'}
    for(let i=1;i<=n;i++)for(let j=1;j<=m;j++){const a=core(referenceTokens[i-1]),b=core(userTokens[j-1]),same=a===b,ratio=same?0:dist(a,b)/Math.max(a.length,b.length,1),sub=same?0:Math.min(1.5,.5+ratio),c=[{v:dp[i-1][j-1]+sub,t:same?'match':'substitute',p:0},{v:dp[i-1][j]+gap,t:'delete',p:1},{v:dp[i][j-1]+gap,t:'insert',p:2}].sort((x,y)=>(x.v-y.v)||(x.p-y.p))[0];dp[i][j]=c.v;op[i][j]=c.t}
    const out=[];let i=n,j=m;while(i||j){const t=op[i][j];if((t==='match'||t==='substitute')&&i&&j){out.push({type:t,expected:referenceTokens[i-1],actual:userTokens[j-1]});i--;j--}else if(t==='delete'&&i){out.push({type:'delete',expected:referenceTokens[i-1],actual:''});i--}else if(j){out.push({type:'insert',expected:'',actual:userTokens[j-1]});j--}else{out.push({type:'delete',expected:referenceTokens[i-1],actual:''});i--}}return out.reverse();
  }`;

const EVAL=String.raw`function evaluate(){
    const ref=tokens(REFERENCE),user=tokens(textArea.value),alignment=align(ref,user);let matches=0,substitutions=0,omissions=0,additions=0,punct=0,caps=0;
    const p=t=>{const m=String(t||'').trim().match(/([.,;:!?…]+)$/u);return m?m[1]:''},c=t=>String(t||'').normalize('NFC').replace(/\s*[.,;:!?…]+$/u,'').replace(/’/g,"'");
    alignment.forEach(item=>{if(item.type==='match'){matches++;if(p(item.expected)!==p(item.actual))punct++;if(c(item.expected)!==c(item.actual))caps++}else if(item.type==='substitute'){substitutions++;if(p(item.expected)!==p(item.actual))punct++}else if(item.type==='delete')omissions++;else if(item.type==='insert')additions++});
    state.status='verified';state.texte=textArea.value;state.motsCorrects=matches;state.motsTotal=TOTAL_WORDS;state.substitutions=substitutions;state.omissions=omissions;state.ajouts=additions;state.erreursNotees=Math.max(0,TOTAL_WORDS-matches);state.erreursPonctuation=punct;state.erreursMajuscules=caps;state.scoreSur20=Math.round(matches*25)/100;state.alignment=alignment;saveState();renderCorrection();lockVerified();
  }`;

html=put(html,'tokens',TOK);html=put(html,'align',ALIGN);html=put(html,'evaluate',EVAL);fs.writeFileSync(target,html,'utf8');
if(!html.includes("state.scoreSur20=Math.round(matches*25)/100"))fail('barème mots corrects × 0,25 absent');

const rm=html.match(/const REFERENCE = (["'])([\s\S]*?)\1;\s*\n\s*const TOTAL_WORDS = 80;/);if(!rm)fail('référence introuvable');
const reference=rm[2].replace(/\\([\\"'])/g,'$1'),rt=range(html,'tokens'),ra=range(html,'align'),box={reference,user:"Ce matin un client à téléphoné au service clients de l'entreprise. Il n'était pas content de ça derniere livraison de fournitures. En effet plusieur carton on étés endommagés a l'arrivé. De plus certain articles manquaient dans le colis.Le client a demandé un nouvel envoie rapide ou un rembourcement complet.la secraitaire a noté sa réclamation avec précision. Elle lui a promis une réponce avant la fin de la semaine.Le responsable du magasin doit vérifier le stock disponible dès demain."};
vm.createContext(box);vm.runInContext(html.slice(rt.start,rt.end)+';'+html.slice(ra.start,ra.end)+`;ref=tokens(reference);u=tokens(user);a=align(ref,u);perfect=align(ref,tokens(reference));extra=align(ref,tokens(reference+' bonus'));split=tokens('dans le colis.Le client')`,box);
const matches=x=>x.filter(i=>i.type==='match').length;
if(box.ref.length!==80)fail(`référence ${box.ref.length}/80`);if(box.split.join('|')!=='dans|le|colis.|Le|client')fail('colis.Le mal découpé');if(matches(box.perfect)!==80||matches(box.extra)!==80)fail('barème ajout/parfait incorrect');if(matches(box.a)!==65)fail(`cas réel ${matches(box.a)}/80 au lieu de 65/80`);
console.log('SEB EvalPro dictée: moteur final validé — cas réel 65/80 = 16,25/20; ponctuation collée découpée; ajouts non déduits deux fois.');
