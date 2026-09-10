const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'app', 'web', 'admin-bilan.html');

if (!fs.existsSync(target)) {
  console.error('SEB EvalPro bilan: admin-bilan.html généré introuvable.');
  process.exit(2);
}

let html = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');

function mustReplace(search, replacement, label) {
  const found = typeof search === 'string' ? html.includes(search) : search.test(html);
  if (!found) {
    console.error(`SEB EvalPro bilan: cible introuvable pour ${label}.`);
    process.exit(3);
  }
  if (search instanceof RegExp) search.lastIndex = 0;
  html = html.replace(search, replacement);
}

mustReplace(
  "function apply(id,l,detail){const r=row(id);if(!r)return;level(r,l);if(detail!==undefined)r.querySelector('.detail').textContent=detail||''}",
  "function syncComment(r,l){if(!r||!l)return;const s=r.querySelector('.csel'),t=r.querySelector('.ctxt');if(!s)return;const o=Array.from(s.options).find(opt=>opt.dataset.l===l);if(!o)return;s.value=o.value;if(t)t.value=o.value}function apply(id,l,detail){const r=row(id);if(!r)return;level(r,l);syncComment(r,l);if(detail!==undefined)r.querySelector('.detail').textContent=detail||''}",
  'sélection automatique du commentaire institutionnel'
);

mustReplace(
  "function auto(){const sc=json('scores_data',{});const carre=",
  "function auto(){const sc=json('scores_data',{});const brique=json('eval_brique',null);if(brique&&brique.niveau!==undefined&&brique.niveau!==null&&String(brique.niveau)!==''){const be=parseInt(brique.niveau,10);if(!isNaN(be)){const bl=be<=1?'I':be<=3?'II':'III';apply('briques-identification',bl,'- '+be+' erreur(s)');apply('briques-manipulation',bl,'- '+be+' erreur(s)')}}const carre=",
  'prise en compte des briques dans le bilan'
);

mustReplace(
  "level(row('tri-temps'),sec<720?'I':sec<840?'II':'III');",
  "apply('tri-temps',sec<720?'I':sec<840?'II':'III');",
  'niveau automatique tri temps'
);

mustReplace(
  "level(row('tri-erreurs'),err<=8?'I':err<=16?'II':'III')",
  "apply('tri-erreurs',err<=8?'I':err<=16?'II':'III')",
  'niveau automatique tri erreurs'
);

const wordHelpers = `function wordPaint(el,bg,fg){if(!el)return;el.style.backgroundColor=bg;el.setAttribute('bgcolor',bg);if(fg){el.style.color=fg;el.setAttribute('color',fg)}}function prepareWordColours(t){const h=t.querySelectorAll('thead th');wordPaint(h[0],'#0070C0','#FFFFFF');wordPaint(h[1],'#CCFFFF','#000000');wordPaint(h[2],'#92D050','#000000');wordPaint(h[3],'#ED7D31','#FFFFFF');wordPaint(h[4],'#C00000','#FFFFFF');wordPaint(h[5],'#0070C0','#FFFFFF');t.querySelectorAll('tr.section td').forEach(el=>wordPaint(el,'#9CC2E5','#000000'));t.querySelectorAll('tr.section2 td').forEach(el=>wordPaint(el,'#B8CCE4','#000000'));t.querySelectorAll('tr.alt td').forEach(el=>wordPaint(el,'#F2F2F2','#000000'));const colours={NE:['#CCFFFF','#000000'],I:['#92D050','#000000'],II:['#ED7D31','#FFFFFF'],III:['#C00000','#FFFFFF']};t.querySelectorAll('.level.on[data-l]').forEach(el=>{const l=el.dataset.l,c=colours[l];if(c)wordPaint(el,c[0],c[1]);const lab=document.createElement('div');lab.className='word-level-label';lab.style.fontWeight='700';lab.style.fontSize='14pt';lab.style.textAlign='center';lab.textContent=l;el.appendChild(lab)})}`;
mustReplace(
  "function word(){save();const c=cand(),t=$('#bilan').cloneNode(true);",
  wordHelpers + "function word(){save();const c=cand(),t=$('#bilan').cloneNode(true);prepareWordColours(t);",
  'préservation des couleurs dans export Word'
);

mustReplace(
  "th{background:#0070c0;color:#fff}",
  "th{background:#0070c0;color:#fff}.nehead{background:#CCFFFF;color:#000}.ihead{background:#92D050;color:#000}.iihead{background:#ED7D31;color:#fff}.iiihead{background:#C00000;color:#fff}.alt td{background:#F2F2F2}",
  'styles Word des couleurs institutionnelles'
);

fs.writeFileSync(target, html, 'utf8');
console.log('SEB EvalPro: bilan corrigé (briques + commentaires automatiques + couleurs Word institutionnelles).');
