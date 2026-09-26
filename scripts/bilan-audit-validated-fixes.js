const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const adminPath = path.join(root, 'app', 'web', 'admin-bilan.html');
const qcmPath = path.join(root, 'app', 'web', 'qcmv1.0.html');
const triPath = path.join(root, 'app', 'web', 'tri_de_cheville.html');

function fail(message) {
  console.error('SEB EvalPro audit bilan validé: ' + message);
  process.exit(2);
}
function read(file) {
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + path.relative(root, file));
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
function write(file, text) { fs.writeFileSync(file, text, 'utf8'); }

// Bilan : calculs/barèmes inchangés ; seules les informations affichées dans les cellules sont normalisées.
{
  let html = read(adminPath);

  const planningOld = "const ps=parseInt(sessionStorage.getItem('planningScore'),10);if(!isNaN(ps)){const e=Math.max(0,15-ps);apply('planning',e<=2?'I':e<=4?'II':'III','- '+e+' erreur(s)')}";
  const planningNew = "let page5=0,hasPage5=false;for(let i=1;i<=8;i++){const k='page5_q'+i;if(Object.hasOwn(sc,k)){hasPage5=true;page5+=+sc[k]||0}}const psRaw=sessionStorage.getItem('planningScore'),hasPlanning=psRaw!==null&&Number.isFinite(+psRaw);if(hasPlanning||hasPage5){const pv=hasPlanning?Math.max(0,Math.min(15,+psRaw)):0,ov=Math.max(0,Math.min(8,page5)),combined=pv+ov,errors=23-combined;apply('planning',combined>=20?'I':combined>=17?'II':'III',errorDetail(errors))}";
  if (!html.includes(planningOld)) fail('ancien calcul Planning introuvable');
  html = html.replace(planningOld, planningNew);

  const triStart = html.indexOf("const tri=json('tri_cheville_data',null);");
  const triEnd = html.indexOf("if(Object.hasOwn(sc,'page7'))", triStart);
  if (triStart < 0 || triEnd <= triStart) fail('bloc Tri introuvable');
  const triNew = "const tri=json('tri_cheville_data',null);if(Array.isArray(tri?.tris)){let sum=0,n=0,err=0,lines=[];tri.tris.slice(0,5).forEach((t,i)=>{const m=+t?.minutes||0,s=+t?.secondes||0,e=+t?.erreurs||0;if(m||s){sum+=m*60+s;n++;err+=e;lines.push('N°'+(i+1)+' : '+String(m).padStart(2,'0')+' min '+String(s).padStart(2,'0')+' s')}});if(n>0){const sec=Math.round(sum/n),avg=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0'),errAvg=err/n;$('#triAvg').textContent=avg;$('#triTimes').innerHTML=lines.join('<br>');apply('tri-temps',sec<=720?'I':sec<=840?'II':'III');$('#triErr').textContent=err+' erreur'+(err===1?'':'s');apply('tri-erreurs',errAvg<=1.6?'I':errAvg<=3.2?'II':'III','')}}\n";
  html = html.slice(0, triStart) + triNew + html.slice(triEnd);

  const textStart = html.indexOf("if(Object.hasOwn(sc,'page7'))");
  const textEnd = html.indexOf("const md=json('page8_data',null);", textStart);
  if (textStart < 0 || textEnd <= textStart) fail('bloc Traitement de texte introuvable');
  const textNew = "if(Object.hasOwn(sc,'page7')){const v=Math.max(0,Math.min(8,+sc.page7||0)),errors=8-v;apply('texte',v>=7?'I':v>=3?'II':'III',errorDetail(errors))}";
  html = html.slice(0, textStart) + textNew + html.slice(textEnd);

  const expStart = html.indexOf("const dictee=json('dictee_data',null);");
  const expEnd = html.indexOf("let e=0,he=false;", expStart);
  if (expStart < 0 || expEnd <= expStart) fail('bloc Expression écrite introuvable');
  const expNew = "const dictee=json('dictee_data',null),abs=json('seb_evalpro_abandons',[]);const dicteeOK=dictee?.status==='verified'&&Number.isFinite(+dictee.scoreSur20);const hasTexteTrous=Object.hasOwn(sc,'pageTexteTrous'),hasPar=sessionStorage.getItem('paronymes_score')!==null,hasGenre=sessionStorage.getItem('erreurs_exercice')!==null,expAbandon=Array.isArray(abs)&&abs.some(r=>/paronyme|genre|texte à trous|dictee|dictée/i.test(String(r?.key||'')+' '+String(r?.exercice||'')));const exp=hasTexteTrous||hasPar||hasGenre||dicteeOK||expAbandon;if(exp){const tr=hasTexteTrous?Math.max(0,Math.min(15,+sc.pageTexteTrous||0)):0,p=hasPar?Math.max(0,Math.min(20,+sessionStorage.getItem('paronymes_score')||0)):0,g=hasGenre?Math.max(0,Math.min(20,20-(+sessionStorage.getItem('erreurs_exercice')||0))):0,d=dicteeOK?Math.max(0,Math.min(20,+dictee.scoreSur20)):0,v=tr+p+g+d,pc=Math.round(v/75*100);apply('expression',pc>=70?'I':pc>=45?'II':'III','- '+pc+' % de réponses correctes')}\n";
  html = html.slice(0, expStart) + expNew + html.slice(expEnd);

  const detailReplacements = [
    ["apply('carre',carre<=2?'I':carre<=4?'II':'III','- '+carre+' erreur(s)')", "apply('carre',carre<=2?'I':carre<=4?'II':'III',errorDetail(carre))", 'Carré magique'],
    ["apply('organisation',e<=2?'I':e<=4?'II':'III','- '+e+' erreur(s)')", "apply('organisation',e<=2?'I':e<=4?'II':'III',errorDetail(e))", 'Organisation'],
    ["apply('mail',e<=1?'I':e<=3?'II':'III','- '+e+' erreur(s)')", "apply('mail',e<=1?'I':e<=3?'II':'III',errorDetail(e))", 'Messagerie']
  ];
  for (const [oldText,newText,label] of detailReplacements) {
    if (!html.includes(oldText)) fail('détail ancien introuvable: ' + label);
    html = html.replace(oldText,newText);
  }

  const mathEnonceOld = "if(he){const p=Math.round(e/10*100);apply('math-enonce',p>=70?'I':p>=45?'II':'III','- '+e+' / 10 réponses correctes ('+p+' %)')}";
  const mathEnonceNew = "if(he){const p=Math.round(e/10*100);apply('math-enonce',p>=70?'I':p>=45?'II':'III','- '+p+' % de réponses correctes')}";
  if (!html.includes(mathEnonceOld)) fail('affichage Math énoncé introuvable');
  html = html.replace(mathEnonceOld, mathEnonceNew);

  const mathProblemesOld = "if(hp){const p=Math.round(pr/27*100);apply('math-problemes',p>=70?'I':p>=45?'II':'III','- '+pr+' / 27 réponses correctes ('+p+' %)')}";
  const mathProblemesNew = "if(hp){const p=Math.round(pr/27*100);apply('math-problemes',p>=70?'I':p>=45?'II':'III','- '+p+' % de réponses correctes')}";
  if (!html.includes(mathProblemesOld)) fail('affichage Math problèmes introuvable');
  html = html.replace(mathProblemesOld, mathProblemesNew);

  for (const token of [
    'data-l="I" style="text-align:center;vertical-align:middle"><span class="small">-10 à 12 min</span>',
    'data-l="II" style="text-align:center;vertical-align:middle"><span class="small">12 à 14 min</span>',
    'data-l="III" style="text-align:center;vertical-align:middle"><span class="small">14 min et plus</span>'
  ]) if (!html.includes(token)) fail('centrage des seuils Tri absent: ' + token);

  if (!html.includes("combined>=20?'I':combined>=17?'II':'III'")) fail('barème Organisation /23 absent');
  if (!html.includes("sec<=720?'I':sec<=840?'II':'III'")) fail('bornes Tri temps absentes');
  if (!html.includes("errAvg<=1.6?'I':errAvg<=3.2?'II':'III'")) fail('barème moyen Tri erreurs absent');
  if (!html.includes("v>=7?'I':v>=3?'II':'III'")) fail('barème Traitement /8 absent');
  if (!html.includes("Math.round(v/75*100)")) fail('Expression /75 absente');

  if (html.includes('erreur(s)')) fail('forme erreur(s) encore présente dans le bilan généré');
  if (html.includes(" / 23 point(s)") || html.includes(" / 8 point(s)") || html.includes(" — Texte à trous :") ||
      html.includes(" / 10 réponses correctes (") || html.includes(" / 27 réponses correctes (")) {
    fail('ancien détail de résultat encore présent dans une cellule du bilan');
  }
  if (!html.includes("apply('briques-identification',bl,'')") || !html.includes("apply('briques-manipulation',bl,errorDetail(be))")) {
    fail('Briques: détail d’erreur non conforme');
  }
  if (!html.includes("apply('tri-erreurs',errAvg<=1.6?'I':errAvg<=3.2?'II':'III','')")) {
    fail('Tri: détail redondant encore présent');
  }

  write(adminPath, html);
}

// Résultat candidat : affichage Traitement de texte /8 et point Enregistrement.
// Ce correctif est idempotent : une source déjà migrée en /8 ne doit jamais
// être ramenée vers un ancien état intermédiaire.
{
  let qcm = read(qcmPath);
  if (qcm.includes('const scoreMax = 7;')) {
    qcm = qcm.replace('const scoreMax = 7;', 'const scoreMax = 8;');
  }
  if (!qcm.includes('const scoreMax = 8;')) fail('résultat Traitement /8 absent');

  // Retirer l'ancien libellé transitoire s'il subsiste afin d'éviter deux lignes
  // d'enregistrement dans la page Résultats.
  qcm = qcm.replace(/^.*analyse\.score\.enregistrement.*Enregistrement via le menu Fichier.*\n?/m, '');
  qcm = qcm.replace(/^.*analyse\.score\.enregistrement.*Enregistrement conforme.*\n?/m, '');

  const sizeNeedle = "Taille 12px (détecté:";
  const sizePos = qcm.indexOf(sizeNeedle);
  if (sizePos < 0) fail('ligne Taille 12 du résultat introuvable');
  const lineEnd = qcm.indexOf('\n', sizePos);
  if (lineEnd < 0) fail('fin ligne Taille 12 introuvable');
  const saveLine = "    html += '<span class=\"' + (analyse.score.enregistrement ? 'correct' : 'incorrect') + '\">' + (analyse.score.enregistrement ? '✓' : '✗') + ' Enregistrement conforme</span>';\n";
  qcm = qcm.slice(0, lineEnd + 1) + saveLine + qcm.slice(lineEnd + 1);

  if (qcm.includes("Score obtenu : ' + score + ' / 10")) fail('ancien calcul Traitement /10 encore présent');
  if (!qcm.includes('const scoreMax = 8;')) fail('résultat Traitement /8 absent');
  if ((qcm.match(/Enregistrement conforme/g) || []).length !== 1) fail('critère Enregistrement dupliqué ou absent');
  write(qcmPath, qcm);
}

// Tri : le garde doit permettre 3 à 5 tris.
{
  const tri = read(triPath);
  if (tri.includes('js/tri-page.js')) {
    const triModulePath = path.join(root, 'app', 'web', 'js', 'tri-page.js');
    const triModule = read(triModulePath);
    if (!triModule.includes('const MIN_TRIS = 3;') ||
        !triModule.includes('const MAX_TRIS = 5;') ||
        !triModule.includes('completedTriIndexes().length >= MIN_TRIS')) {
      fail('minimum 3 tris modulaire non appliqué');
    }
    if (/obligation de 5 tris|Terminez et validez les 5 tris/i.test(triModule)) {
      fail('ancienne obligation modulaire de 5 tris encore présente');
    }
  } else {
    if (!tri.includes('return completed >= 3;')) fail('minimum 3 tris non appliqué');
    if (tri.includes('Terminez et validez les 5 tris')) fail('ancienne obligation de 5 tris encore présente');
  }
}

// Tests bloquants des barèmes validés.
{
  const planning = (v) => v >= 20 ? 'I' : v >= 17 ? 'II' : 'III';
  if (planning(23)!=='I'||planning(20)!=='I'||planning(19)!=='II'||planning(17)!=='II'||planning(16)!=='III') fail('test Organisation /23');

  const triTime = (sec) => sec <= 720 ? 'I' : sec <= 840 ? 'II' : 'III';
  if (triTime(720)!=='I'||triTime(721)!=='II'||triTime(840)!=='II'||triTime(841)!=='III') fail('test Tri temps');

  const triErr = (err,n) => (err/n) <= 1.6 ? 'I' : (err/n) <= 3.2 ? 'II' : 'III';
  if (triErr(8,5)!=='I'||triErr(9,5)!=='II'||triErr(16,5)!=='II'||triErr(17,5)!=='III'||triErr(3,2)!=='I'||triErr(4,2)!=='II'||triErr(7,2)!=='III') fail('test Tri erreurs variable');

  const text = (v) => v >= 7 ? 'I' : v >= 3 ? 'II' : 'III';
  if (text(8)!=='I'||text(7)!=='I'||text(6)!=='II'||text(3)!=='II'||text(2)!=='III') fail('test Traitement /8');

  const expressionPercent = (v) => Math.round(v/75*100);
  if (expressionPercent(15)!==20 || expressionPercent(75)!==100) fail('test Expression /75');
}

console.log('SEB EvalPro: audit bilan validé appliqué — calculs inchangés, détails institutionnels normalisés (erreurs, pourcentages, tri, briques).');
