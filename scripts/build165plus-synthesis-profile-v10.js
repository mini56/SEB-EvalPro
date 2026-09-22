const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const adminFile = path.join(root, 'app', 'web', 'admin-bilan.html');
const historyFile = path.join(root, 'src', 'bilan-history-preload.js');
const profileFile = path.join(root, 'src', 'synthesis-profile.js');

function fail(message) {
  console.error('SEB EvalPro synthèse profil V10: ' + message);
  process.exit(2);
}
function read(file) {
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + path.relative(root, file));
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
function write(file, content) { fs.writeFileSync(file, content, 'utf8'); }
function checkInlineScripts(html) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    if (/\bsrc\s*=/.test(match[1] || '')) continue;
    const js = String(match[2] || '').trim();
    if (!js) continue;
    try { new vm.Script(js); }
    catch (error) { fail('JavaScript inline invalide: ' + error.message); }
  }
}

const profileSource = read(profileFile);
const browserProfileSource = profileSource.replace(/^\s*if\s*\(typeof module[^\n]*module\.exports[^\n]*\n/m, '');
if (!browserProfileSource.includes('SebSynthesisProfile')) fail('moteur de profil invalide');

// Bilan courant : remplace seulement le générateur déterministe final V9.
{
  let html = read(adminFile);
  if (!html.includes('seb-165plus-natural-synthesis-v9')) fail('V9 courante absente');
  if (html.includes('seb-synthesis-profile-v10')) fail('V10 courante déjà injectée');
  const end = html.toLowerCase().lastIndexOf('</body>');
  if (end < 0) fail('fin admin-bilan introuvable');

  const block = `\n<script id="seb-synthesis-profile-engine-v10">\n${browserProfileSource}\n</script>\n<script id="seb-synthesis-profile-v10">(()=>{'use strict';\nconst PROFILE_KEY='seb_evalpro_bilan_synthese_profile_v1';\nconst FINAL_KEY='seb_evalpro_bilan_synthese';\nconst SOURCE_KEY='seb_evalpro_bilan_synthese_moteur';\nfunction candidate(){try{return JSON.parse(sessionStorage.getItem('candidat_data')||'{}')||{}}catch(_){return{}}}\nfunction abandons(){try{const v=JSON.parse(sessionStorage.getItem('seb_evalpro_abandons')||'[]');return Array.isArray(v)?v:[]}catch(_){return[]}}\nfunction rowData(key){const r=document.querySelector('tr[data-r="'+key+'"]');if(!r)return{};return{level:String(r.dataset.level||r.querySelector('.level.on')?.dataset.l||''),comment:String(r.querySelector('.ctxt')?.value||''),detail:String(r.querySelector('.detail')?.textContent||'')}}\nfunction build(){const rows={};for(const key of Object.keys(window.SebSynthesisProfile.SPECS))rows[key]=rowData(key);return window.SebSynthesisProfile.buildProfile({candidate:candidate(),rows,abandons:abandons()})}\nfunction install(){\n const area=document.getElementById('seb-bilan-synthese-text'),old=document.getElementById('seb-generate-synthese');if(!area||!old)return;\n const b=old.cloneNode(true);b.id='seb-generate-synthese';b.dataset.profileV10='1';old.replaceWith(b);\n b.addEventListener('click',()=>{const profile=build(),fallback=String(profile.fallback_text||'').trim(),payload=window.SebSynthesisProfile.serialize(profile);area.value=fallback;sessionStorage.setItem(PROFILE_KEY,payload);sessionStorage.setItem(SOURCE_KEY,fallback);sessionStorage.setItem(FINAL_KEY,fallback);area.dispatchEvent(new Event('input',{bubbles:true}));window.sebEvalPro?.save?.();const st=document.getElementById('seb-synthese-status');if(st)st.textContent='Analyse métier structurée prête — rédaction SEB-IA en cours.'});\n window.sebV10BuildCurrentProfile=build;\n}\nif(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,240),{once:true});else setTimeout(install,240);\n})();</script>\n`;
  html = html.slice(0, end) + block + html.slice(end);

  // Word courant : vrais paragraphes au lieu d'un seul <p> avec retours internes.
  const wordOld = `summaryHtml=summaryText?'<h2 style="margin-top:18pt">Synthèse de l’évaluation</h2><p style="white-space:pre-wrap;line-height:1.35">'+esc(summaryText)+'</p>':''`;
  const wordNew = `summaryHtml=summaryText?'<h2 style="margin-top:18pt">Synthèse de l’évaluation</h2>'+summaryText.split(/\\n\\s*\\n/).map(p=>'<p style="margin:0 0 9pt;line-height:1.35">'+esc(p)+'</p>').join(''):''`;
  if (!html.includes(wordOld)) fail('export Word courant: bloc synthèse unique introuvable');
  html = html.replace(wordOld, wordNew);

  checkInlineScripts(html);
  write(adminFile, html);
}

// Historique : même pré-analyse à partir des cellules archivées, sans toucher aux archives existantes.
{
  let js = read(historyFile);
  if (!js.includes('SEB_HISTORY_NATURAL_SYNTHESIS_V9')) fail('V9 historique absente');
  if (js.includes('SEB_HISTORY_SYNTHESIS_PROFILE_V10')) fail('V10 historique déjà injectée');

  js += `\n\n// SEB_HISTORY_SYNTHESIS_PROFILE_V10\n${browserProfileSource}\nfunction sebV10HistoryProfile(card,candidate){\n const rows={};for(const key of Object.keys(globalThis.SebSynthesisProfile.SPECS)){const r=[...card.querySelectorAll('tbody tr')].find(x=>x.dataset?.key===key&&!x.classList.contains('seb-bh-section'));rows[key]=r?{level:String(r.querySelector('.seb-bh-level.on')?.dataset.level||''),comment:String(r.querySelector('.seb-bh-comment')?.value||''),detail:String(r.querySelector('.seb-bh-detail')?.textContent||'')}:{}}\n const profile=globalThis.SebSynthesisProfile.buildProfile({candidate:candidate||{},rows,abandons:[]});card.dataset.sebSynthesisProfile=globalThis.SebSynthesisProfile.serialize(profile);return profile;\n}\nsebV4HistorySummary=function(card,c){return sebV10HistoryProfile(card,c).fallback_text};\n`;

  const histWordOld = `const summaryHtml = edited.summary ? '<h2 style="margin-top:18pt">Synthèse de l’évaluation</h2><p style="white-space:pre-wrap">' + escapeHtml(edited.summary) + '</p>' : '';`;
  const histWordNew = `const summaryHtml = edited.summary ? '<h2 style="margin-top:18pt">Synthèse de l’évaluation</h2>' + edited.summary.split(/\\n\\s*\\n/).map(p => '<p style="margin:0 0 9pt">' + escapeHtml(p) + '</p>').join('') : '';`;
  if (!js.includes(histWordOld)) fail('export Word historique: bloc synthèse unique introuvable');
  js = js.replace(histWordOld, histWordNew);

  try { new vm.Script(js); }
  catch (error) { fail('historique JS invalide: ' + error.message); }
  write(historyFile, js);
}

console.log('SEB EvalPro V10: pré-analyse métier -> JSON structuré -> synthèse de secours en paragraphes, bilan courant et historique.');
