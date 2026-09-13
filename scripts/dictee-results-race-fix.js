const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const qcmPath=path.join(root,'app','web','qcmv1.0.html');
function fail(m){console.error('SEB EvalPro dictée résultats v4: '+m);process.exit(2)}
if(!fs.existsSync(qcmPath))fail('qcmv1.0.html généré introuvable');
let qcm=fs.readFileSync(qcmPath,'utf8');

// Le renderer v2 installe son propre MutationObserver et peut réécrire le résultat
// après le renderer v3. On le retire de la page générée : v3 devient l'unique
// renderer des déplacements sur la page Résultats.
const legacyRe=/<script id="seb-dictee-moved-results-final">[\s\S]*?<\/script>\s*/g;
const legacyMatches=qcm.match(legacyRe)||[];
if(legacyMatches.length!==1)fail('renderer résultats v2 attendu une fois, trouvé '+legacyMatches.length);
qcm=qcm.replace(legacyRe,'');

// Le garde v3 ne doit pas se fier seulement aux données : si un renderer historique
// réécrit le DOM après coup, v3 doit constater que son affichage a disparu et le
// remettre. On vérifie donc aussi la présence effective de Déplacements et de la
// légende bleue dans le DOM avant de ne rien faire.
const oldGuard="    if(root.dataset.sebDictV3===sig)return;root.dataset.sebDictV3=sig;";
const newGuard="    const lineNow=root.querySelector('p.ligne');\n    const correctionNow=Array.from(root.querySelectorAll('.message-block')).find(b=>String(b.textContent||'').toLowerCase().includes('correction colorée'));\n    const domV3=!!lineNow&&String(lineNow.textContent||'').includes('Déplacements : '+(d.deplacements||0))&&!!correctionNow&&String(correctionNow.textContent||'').includes('Bleu souligné : déplacé');\n    if(root.dataset.sebDictV3===sig&&domV3)return;root.dataset.sebDictV3=sig;";
if(!qcm.includes(oldGuard))fail('garde v3 historique introuvable');
qcm=qcm.replace(oldGuard,newGuard);

if(qcm.includes('seb-dictee-moved-results-final'))fail('renderer v2 encore présent');
if(!qcm.includes('seb-dictee-complex-results-v3'))fail('renderer v3 absent');
if(!qcm.includes("includes('Déplacements : '+(d.deplacements||0))"))fail('contrôle DOM Déplacements absent');
if(!qcm.includes("includes('Bleu souligné : déplacé')"))fail('contrôle DOM légende v3 absent');

// Vérification syntaxique de tous les scripts de la page finale réellement produite.
const scriptRe=/<script\b[^>]*>([\s\S]*?)<\/script>/gi;let m,n=0;
while((m=scriptRe.exec(qcm))){n++;const code=m[1].trim();if(!code)continue;try{new vm.Script(code)}catch(e){fail('JavaScript QCM invalide après correction (script '+n+'): '+e.message)}}

fs.writeFileSync(qcmPath,qcm,'utf8');
console.log('SEB EvalPro dictée résultats v4: renderer v2 retiré; v3 unique et réappliqué si un affichage historique écrase Déplacements.');
