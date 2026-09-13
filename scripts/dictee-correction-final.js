const fs=require('fs'),path=require('path'),vm=require('vm');
const target=path.resolve(__dirname,'..','app','web','dictee.html');
function fail(m){console.error('SEB EvalPro dictée correction finale: '+m);process.exit(2)}
if(!fs.existsSync(target))fail('dictee.html généré introuvable');
let html=fs.readFileSync(target,'utf8');

// Les fonctions de la dictée sont des fonctions de premier niveau de l'IIFE,
// indentées de deux espaces. On utilise le prochain marqueur de même niveau
// plutôt qu'un analyseur d'accolades : cela évite de confondre les apostrophes
// présentes dans les expressions régulières avec des chaînes JavaScript.
function block(src,name){
  const needle='  function '+name+'(';
  const start=src.indexOf(needle);
  if(start<0)fail('fonction '+name+' introuvable');
  const next=src.indexOf('\n  function ',start+needle.length);
  if(next<0)fail('fonction suivant '+name+' introuvable');
  return{start,end:next};
}
function put(src,name,code){const r=block(src,name);return src.slice(0,r.start)+code+src.slice(r.end)}

const TOK=String.raw`  function tokens(text){
    const source=String(text==null?'':text).normalize('NFC'),out=[];
    const re=/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*(?:\s*[.,;:!?…]+)?/gu;let m;
    while((m=re.exec(source)))out.push(m[0].replace(/\s+([.,;:!?…]+)$/u,'$1'));
    return out;
  }
`;

const ALIGN=String.raw`  function align(referenceTokens,userTokens){
    function core(t){return String(t||'').normalize('NFC').replace(/\s*[.,;:!?…]+$/u,'').replace(/’/g,"'").toLowerCase()}
    function dist(a,b){const l=Array.from(a||''),r=Array.from(b||'');let p=Array.from({length:r.length+1},(_,i)=>i);for(let i=1;i<=l.length;i++){const c=new Array(r.length+1);c[0]=i;for(let j=1;j<=r.length;j++)c[j]=Math.min(c[j-1]+1,p[j]+1,p[j-1]+(l[i-1]===r[j-1]?0:1));p=c}return p[r.length]}
    const gap=1.6,n=referenceTokens.length,m=userTokens.length,dp=Array.from({length:n+1},()=>new Array(m+1).fill(0)),op=Array.from({length:n+1},()=>new Array(m+1).fill(null));
    for(let i=1;i<=n;i++){dp[i][0]=i*gap;op[i][0]='delete'}for(let j=1;j<=m;j++){dp[0][j]=j*gap;op[0][j]='insert'}
    for(let i=1;i<=n;i++)for(let j=1;j<=m;j++){const a=core(referenceTokens[i-1]),b=core(userTokens[j-1]),same=a===b,ratio=same?0:dist(a,b)/Math.max(a.length,b.length,1),sub=same?0:Math.min(1.5,.5+ratio),c=[{v:dp[i-1][j-1]+sub,t:same?'match':'substitute',p:0},{v:dp[i-1][j]+gap,t:'delete',p:1},{v:dp[i][j-1]+gap,t:'insert',p:2}].sort((x,y)=>(x.v-y.v)||(x.p-y.p))[0];dp[i][j]=c.v;op[i][j]=c.t}
    const out=[];let i=n,j=m;while(i||j){const t=op[i][j];if((t==='match'||t==='substitute')&&i&&j){out.push({type:t,expected:referenceTokens[i-1],actual:userTokens[j-1]});i--;j--}else if(t==='delete'&&i){out.push({type:'delete',expected:referenceTokens[i-1],actual:''});i--}else if(j){out.push({type:'insert',expected:'',actual:userTokens[j-1]});j--}else{out.push({type:'delete',expected:referenceTokens[i-1],actual:''});i--}}return out.reverse();
  }
`;

const EVAL=String.raw`  function evaluate(){
    const ref=tokens(REFERENCE),user=tokens(textArea.value),alignment=align(ref,user);let matches=0,substitutions=0,omissions=0,additions=0,punct=0,caps=0;
    const p=t=>{const m=String(t||'').trim().match(/([.,;:!?…]+)$/u);return m?m[1]:''},c=t=>String(t||'').normalize('NFC').replace(/\s*[.,;:!?…]+$/u,'').replace(/’/g,"'");
    alignment.forEach(item=>{if(item.type==='match'){matches++;if(p(item.expected)!==p(item.actual))punct++;if(c(item.expected)!==c(item.actual))caps++}else if(item.type==='substitute'){substitutions++;if(p(item.expected)!==p(item.actual))punct++}else if(item.type==='delete')omissions++;else if(item.type==='insert')additions++});
    state.status='verified';state.texte=textArea.value;state.motsCorrects=matches;state.motsTotal=TOTAL_WORDS;state.substitutions=substitutions;state.omissions=omissions;state.ajouts=additions;state.erreursNotees=Math.max(0,TOTAL_WORDS-matches);state.erreursPonctuation=punct;state.erreursMajuscules=caps;state.scoreSur20=Math.round(matches*25)/100;state.alignment=alignment;saveState();renderCorrection();lockVerified();
  }
`;

// Vérifier les trois remplacements eux-mêmes avant de toucher à la page.
for(const [name,code] of [['tokens',TOK],['align',ALIGN],['evaluate',EVAL]]){
  try{new vm.Script(code)}catch(e){fail('fonction '+name+' invalide: '+e.message)}
}

html=put(html,'tokens',TOK);
html=put(html,'align',ALIGN);
html=put(html,'evaluate',EVAL);
if(!html.includes("state.scoreSur20=Math.round(matches*25)/100"))fail('barème mots corrects × 0,25 absent');

// Vérification syntaxique de chaque script réellement généré dans dictee.html.
const scriptRe=/<script\b[^>]*>([\s\S]*?)<\/script>/gi;let sm,scriptNo=0;
while((sm=scriptRe.exec(html))){scriptNo++;const code=sm[1].trim();if(!code)continue;try{new vm.Script(code)}catch(e){fail('JavaScript généré invalide (script '+scriptNo+'): '+e.message)}}

// Test automatique avec le texte réellement saisi par l'utilisateur.
const rm=html.match(/const REFERENCE = (["'])([\s\S]*?)\1;\s*\n\s*const TOTAL_WORDS = 80;/);
if(!rm)fail('référence introuvable');
const reference=rm[2].replace(/\\([\\"'])/g,'$1');
const box={reference,user:"Ce matin un client à téléphoné au service clients de l'entreprise. Il n'était pas content de ça derniere livraison de fournitures. En effet plusieur carton on étés endommagés a l'arrivé. De plus certain articles manquaient dans le colis.Le client a demandé un nouvel envoie rapide ou un rembourcement complet.la secraitaire a noté sa réclamation avec précision. Elle lui a promis une réponce avant la fin de la semaine.Le responsable du magasin doit vérifier le stock disponible dès demain."};
vm.createContext(box);
vm.runInContext(TOK+'\n'+ALIGN+String.raw`;
ref=tokens(reference);u=tokens(user);a=align(ref,u);perfect=align(ref,tokens(reference));extra=align(ref,tokens(reference+' bonus'));split=tokens('dans le colis.Le client');`,box);
const matches=x=>x.filter(i=>i.type==='match').length;
if(box.ref.length!==80)fail('référence '+box.ref.length+'/80');
if(box.split.join('|')!=='dans|le|colis.|Le|client')fail('colis.Le mal découpé');
if(matches(box.perfect)!==80||matches(box.extra)!==80)fail('barème ajout/parfait incorrect');
if(matches(box.a)!==65)fail('cas réel '+matches(box.a)+'/80 au lieu de 65/80');

fs.writeFileSync(target,html,'utf8');
console.log('SEB EvalPro dictée: moteur final validé — cas réel 65/80 = 16,25/20; ponctuation collée découpée; ajouts non déduits deux fois.');
