const { ipcRenderer } = require('electron');
const path = require('path');

let installed = false;
let savingCurrent = false;

function pageName() {
  try { return path.basename(decodeURIComponent(window.location.pathname)) || ''; }
  catch (_) { return ''; }
}

function isBilanPage() {
  return ['admin-bilan.html', 'bilan.html'].includes(pageName().toLowerCase());
}

function textOf(el) {
  return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
}

function candidateFromPage() {
  let stored = {};
  try { stored = JSON.parse(window.sessionStorage.getItem('candidat_data') || '{}') || {}; } catch (_) {}
  return {
    candidateId: String(window.sessionStorage.getItem('seb_evalpro_admin_candidate_id') || stored.candidateId || '').trim(),
    nom: String(stored.nom || textOf(document.getElementById('nom')) || '').trim(),
    prenom: String(stored.prenom || stored['prénom'] || textOf(document.getElementById('prenom')) || '').trim(),
    date: String(stored.date || textOf(document.getElementById('date')) || '').trim(),
    civilite: ['M.','Mme','Autre'].includes(String(stored.civilite || '')) ? String(stored.civilite) : '',
    lieu: String(stored.lieu || stored.ville || '').trim(),
    groupe: String(stored.groupe || '').trim()
  };
}

function currentBuildLabel() {
  const text = textOf(document.getElementById('seb-evalpro-build'));
  return text.replace(/^Build\s*#?/i, '').trim() || 'DEV';
}

function captureBilanDocument() {
  const table = document.getElementById('bilan');
  if (!table) return null;
  const headers = Array.from(table.querySelectorAll('thead th')).map((th) => textOf(th));
  const rows = [];
  Array.from(table.querySelectorAll('tbody tr')).forEach((tr, index) => {
    const key = String(tr.getAttribute('data-r') || '').trim();
    if (!key) {
      rows.push({
        kind: 'section',
        key: `section-${index + 1}`,
        className: tr.className || '',
        sectionText: textOf(tr),
        moduleText: '',
        level: '', preset: '', comment: '', detail: '', options: []
      });
      return;
    }
    const cells = tr.querySelectorAll('td');
    const active = tr.querySelector('.level.on');
    const select = tr.querySelector('.csel');
    const textarea = tr.querySelector('.ctxt');
    const detail = tr.querySelector('.detail');
    const options = select ? Array.from(select.options).map((opt) => ({
      value: String(opt.value || ''),
      text: textOf(opt),
      level: String(opt.getAttribute('data-l') || '')
    })) : [];
    rows.push({
      kind: 'item',
      key,
      className: tr.className || '',
      moduleText: cells[0] ? String(cells[0].innerText || cells[0].textContent || '').trim() : '',
      sectionText: '',
      level: active ? String(active.getAttribute('data-l') || '') : '',
      preset: select ? String(select.value || '') : '',
      comment: textarea ? String(textarea.value || '') : '',
      detail: detail ? String(detail.innerText || detail.textContent || '').trim() : '',
      options
    });
  });
  return {
    title: 'Bilan institutionnel',
    note: textOf(document.querySelector('.note')),
    summary: String(window.sessionStorage.getItem('seb_evalpro_bilan_synthese') || ''),
    feeling: String(window.sessionStorage.getItem('seb_evalpro_bilan_ressenti') || ''),
    headers: headers.length ? headers : ['Modules', 'NE', 'I', 'II', 'III', 'Commentaires'],
    rows
  };
}

async function archiveCurrentBilan() {
  if (!isBilanPage() || savingCurrent) return;
  const documentState = captureBilanDocument();
  if (!documentState) return;
  savingCurrent = true;
  try {
    const selectedCandidate = candidateFromPage();
    const result = await ipcRenderer.invoke('bilan-history:save-current', {
      candidateId: selectedCandidate.candidateId,
      candidate: selectedCandidate,
      originalBuild: currentBuildLabel(),
      sessionToken: String(window.sessionStorage.getItem('seb_evalpro_replay_token') || ''),
      document: documentState
    });
    const status = document.getElementById('status');
    if (result && result.ok) {
      if (status) status.textContent = result.unchanged
        ? `Bilan déjà archivé · révision ${result.revision}`
        : `Bilan archivé · révision ${result.revision}`;
      window.sessionStorage.setItem('seb_evalpro_bilan_history_file', String(result.filename || ''));
    } else if (status && result && result.error) {
      status.textContent = `Archive bilan : ${result.error}`;
    }
  } catch (_) {
  } finally {
    savingCurrent = false;
  }
}

function installBilanSaveHook() {
  if (!isBilanPage()) return;
  const hook = () => {
    const save = document.getElementById('save');
    if (!save || save.dataset.sebHistoryHook === '1') return !!save;
    save.dataset.sebHistoryHook = '1';
    save.addEventListener('click', () => setTimeout(archiveCurrentBilan, 180));
    return true;
  };
  if (!hook()) setTimeout(hook, 300);
}

function addStyle() {
  if (document.getElementById('seb-bilan-history-style')) return;
  const style = document.createElement('style');
  style.id = 'seb-bilan-history-style';
  style.textContent = `
    #seb-evalpro-old-bilan{background:#f4ecff!important;color:#5a2794!important;border-color:#fff!important;font-weight:700}
    #seb-bilan-history-chooser,#seb-bilan-history-editor{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
    .seb-bh-card{width:min(1040px,96vw);max-height:90vh;background:#fff;border-radius:10px;box-shadow:0 16px 50px rgba(0,0,0,.4);display:flex;flex-direction:column;overflow:hidden}
    .seb-bh-head{display:flex;align-items:center;gap:10px;background:#0070c0;color:#fff;padding:13px 17px}.seb-bh-title{font-size:20px;font-weight:700;flex:1}.seb-bh-badge{background:#fff;color:#0070c0;border-radius:14px;padding:4px 9px;font-size:12px;font-weight:700}
    .seb-bh-body{padding:15px;overflow:auto;background:#f5f7fb}.seb-bh-path{font-size:12px;color:#666;margin-bottom:10px}.seb-bh-row{display:grid;grid-template-columns:1.35fr .55fr .55fr .8fr auto;gap:10px;align-items:center;padding:10px 12px;background:#fff;border:1px solid #d9dfeb;border-radius:7px;margin-bottom:8px}.seb-bh-row strong{font-size:15px}.seb-bh-row small{color:#666}.seb-bh-bad{color:#c00000;font-weight:700}
    .seb-bh-actions{display:flex;justify-content:flex-end;gap:10px;padding:12px 16px;border-top:1px solid #ddd;background:#fff}.seb-bh-row>div:last-child{display:flex;justify-content:flex-end;gap:8px;align-items:center}.seb-bh-actions button,.seb-bh-row button{font:700 14px Arial,sans-serif;padding:8px 14px;border:1px solid #999;border-radius:5px;background:#f2f2f2;cursor:pointer}.seb-bh-actions .primary,.seb-bh-row .primary{background:#0070c0;color:#fff;border-color:#0070c0}.seb-bh-row .danger{background:#c62828;color:#fff;border-color:#c62828}.seb-bh-row .danger.confirm{background:#8b0000;border-color:#8b0000}
    .seb-bh-editor-card{width:98vw;height:94vh;background:#fff;border-radius:8px;box-shadow:0 16px 50px rgba(0,0,0,.42);display:flex;flex-direction:column;overflow:hidden}.seb-bh-editor-head{display:flex;gap:10px;align-items:center;background:#0070c0;color:#fff;padding:10px 15px}.seb-bh-editor-head strong{font-size:18px;flex:1}.seb-bh-warning{background:#fff3cd;color:#6e5200;border-radius:13px;padding:4px 9px;font-size:12px;font-weight:700}.seb-bh-editor-body{flex:1;overflow:auto;padding:16px;background:#fff}
    .seb-bh-meta{display:flex;gap:24px;flex-wrap:wrap;margin:0 0 10px;font-size:14px}.seb-bh-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:13px}.seb-bh-table th,.seb-bh-table td{border:1px solid #000;padding:5px;vertical-align:top}.seb-bh-table th{background:#0070c0;color:#fff}.seb-bh-table th:nth-child(2){background:#ccffff;color:#000}.seb-bh-table th:nth-child(3){background:#92d050;color:#000}.seb-bh-table th:nth-child(4){background:#ed7d31}.seb-bh-table th:nth-child(5){background:#c00000}.seb-bh-section td{background:#9cc2e5;font-weight:700}.seb-bh-module{white-space:pre-line}.seb-bh-level{text-align:center;cursor:pointer;height:42px;user-select:none}.seb-bh-level.on[data-level="NE"]{background:#ccffff}.seb-bh-level.on[data-level="I"]{background:#92d050}.seb-bh-level.on[data-level="II"]{background:#ed7d31;color:#fff}.seb-bh-level.on[data-level="III"]{background:#c00000;color:#fff}.seb-bh-level.on:after{content:none}.seb-bh-select,.seb-bh-comment{width:100%;font:inherit}.seb-bh-select{margin-bottom:5px}.seb-bh-comment{min-height:55px;resize:vertical;padding:5px}.seb-bh-detail{font-size:12px;color:#555;white-space:pre-line;margin-top:4px}.seb-bh-editor-foot{display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid #ddd;background:#f8f8f8}.seb-bh-editor-foot .info{flex:1;font-size:13px;color:#555}.seb-bh-editor-foot button{font:700 14px Arial,sans-serif;padding:8px 14px;border:1px solid #999;border-radius:5px;background:#f2f2f2;cursor:pointer}.seb-bh-editor-foot .primary{background:#0070c0;color:#fff;border-color:#0070c0}
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function candidateLabel(candidate) {
  return [candidate && candidate.nom, candidate && candidate.prenom].map((v) => String(v || '').trim()).filter(Boolean).join(' ') || 'Candidat non identifié';
}

function ensureAdminButton() {
  const bar = document.getElementById('seb-evalpro-topbar');
  if (!bar) return false;
  let button = document.getElementById('seb-evalpro-old-bilan');
  if (!button) {
    button = document.createElement('button');
    button.id = 'seb-evalpro-old-bilan';
    button.type = 'button';
    button.textContent = 'Ouvrir un ancien bilan';
    button.hidden = true;
    button.addEventListener('click', openChooser);
  }
  const left = bar.querySelector('.seb-admin-left-actions');
  const replay = document.getElementById('seb-evalpro-replay');
  const bilan = document.getElementById('seb-evalpro-bilan');
  if (left && button.parentElement !== left) {
    if (replay && replay.parentElement === left) replay.insertAdjacentElement('afterend', button);
    else if (bilan && bilan.parentElement === left) left.insertBefore(button, bilan);
    else left.appendChild(button);
  } else if (!left && !button.isConnected) {
    const admin = document.getElementById('seb-evalpro-admin');
    if (admin) bar.insertBefore(button, admin);
  }
  refreshAdminButton(button);
  return true;
}

async function refreshAdminButton(button = document.getElementById('seb-evalpro-old-bilan')) {
  if (!button) return;
  try { button.hidden = !(await ipcRenderer.invoke('admin:status')); }
  catch (_) { button.hidden = true; }
}

function installAdminButton() {
  addStyle();
  if (!ensureAdminButton()) setTimeout(ensureAdminButton, 150);
  const observer = new MutationObserver(() => {
    ensureAdminButton();
    refreshAdminButton();
  });
  const adminBar = document.getElementById('seb-evalpro-topbar');
  if (adminBar) observer.observe(adminBar, { childList: true, subtree: false });
  document.addEventListener('click', (event) => {
    const admin = event.target && event.target.closest ? event.target.closest('#seb-evalpro-admin') : null;
    if (admin) setTimeout(() => refreshAdminButton(), 60);
  }, true);
}

async function openChooser() {
  const existing = document.getElementById('seb-bilan-history-chooser');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'seb-bilan-history-chooser';
  overlay.innerHTML = `<div class="seb-bh-card"><div class="seb-bh-head"><div class="seb-bh-title">Ouvrir un ancien bilan</div><div class="seb-bh-badge">ARCHIVE ÉDITABLE</div></div><div class="seb-bh-body"><div class="seb-bh-path">Stockage interne SEB EvalPro</div><div id="seb-bh-list">Chargement…</div></div><div class="seb-bh-actions"><button type="button" id="seb-bh-close">Fermer</button></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#seb-bh-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') overlay.remove(); });
  const list = overlay.querySelector('#seb-bh-list');
  try {
    const items = await ipcRenderer.invoke('bilan-history:list');
    if (!items || !items.length) {
      list.innerHTML = '<div style="padding:25px;text-align:center;color:#666">Aucun bilan structuré enregistré pour le moment.<br><small>Les nouveaux bilans seront archivés lorsque vous utiliserez « Enregistrer les modifications ».</small></div>';
      return;
    }
    list.innerHTML = '';
    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'seb-bh-row';
      const date = item.createdAt ? new Date(item.createdAt).toLocaleString('fr-FR') : '';
      row.innerHTML = `<div><strong>${escapeHtml(candidateLabel(item.candidate))}</strong><br><small>Évaluation : ${escapeHtml((item.candidate && item.candidate.date) || '')}</small></div><div>Build #${escapeHtml(item.originalBuild)}</div><div>${item.revision === 0 ? '<b>Original</b>' : `Révision ${item.revision}`}</div><div><small>${escapeHtml(date)}</small></div><div></div>`;
      const cell = row.lastElementChild;
      if (!item.integrityOk) cell.innerHTML = '<span class="seb-bh-bad">Archive invalide</span>';
      else {
        const open = document.createElement('button');
        open.type = 'button'; open.className = 'primary'; open.textContent = 'Ouvrir';
        open.addEventListener('click', async () => {
          const result = await ipcRenderer.invoke('bilan-history:load', item.filename);
          if (!result || !result.ok) { alert(result && result.error ? result.error : 'Ouverture impossible.'); return; }
          overlay.remove();
          openEditor(result.filename, result.archive);
        });
        cell.appendChild(open);
        if (Number(item.revision) > 0) {
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'danger';
          remove.textContent = 'Supprimer';
          let confirmDelete = false;
          let resetTimer = null;
          remove.addEventListener('click', async () => {
            if (!confirmDelete) {
              confirmDelete = true;
              remove.classList.add('confirm');
              remove.textContent = 'Confirmer';
              resetTimer = setTimeout(() => {
                confirmDelete = false;
                remove.classList.remove('confirm');
                remove.textContent = 'Supprimer';
              }, 5000);
              return;
            }
            clearTimeout(resetTimer);
            remove.disabled = true;
            remove.textContent = 'Suppression…';
            const result = await ipcRenderer.invoke('bilan-history:delete-revision', item.filename);
            if (!result || !result.ok) {
              remove.disabled = false;
              confirmDelete = false;
              remove.classList.remove('confirm');
              remove.textContent = 'Supprimer';
              remove.title = (result && result.error) || 'Suppression impossible.';
              return;
            }
            row.remove();
            if (!list.querySelector('.seb-bh-row')) {
              list.innerHTML = '<div style="padding:25px;text-align:center;color:#666">Aucun bilan structuré enregistré pour le moment.</div>';
            }
          });
          cell.appendChild(remove);
        }
      }
      list.appendChild(row);
    });
  } catch (_) {
    list.textContent = 'Impossible de charger les bilans archivés.';
  }
}

function buildEditorDocument(editor) {
  const rows = [];
  editor.querySelectorAll('tbody tr').forEach((tr, index) => {
    if (tr.classList.contains('seb-bh-section')) {
      rows.push({ kind:'section', key:tr.dataset.key || `section-${index + 1}`, className:'section', sectionText:textOf(tr), moduleText:'', level:'', preset:'', comment:'', detail:'', options:[] });
      return;
    }
    const active = tr.querySelector('.seb-bh-level.on');
    const select = tr.querySelector('.seb-bh-select');
    const comment = tr.querySelector('.seb-bh-comment');
    const detail = tr.querySelector('.seb-bh-detail');
    const options = select ? Array.from(select.options).map((opt) => ({ value:String(opt.value || ''), text:textOf(opt), level:String(opt.dataset.level || '') })) : [];
    rows.push({
      kind:'item', key:String(tr.dataset.key || `row-${index + 1}`), className:String(tr.dataset.className || ''), moduleText:String(tr.dataset.moduleText || ''), sectionText:'',
      level:active ? String(active.dataset.level || '') : '', preset:select ? String(select.value || '') : '', comment:comment ? String(comment.value || '') : '', detail:detail ? String(detail.textContent || '') : '', options
    });
  });
  const summary=sebV7Single(String(editor.querySelector('#seb-bh-history-summary')?.value||editor.dataset.summary||''));
  const feeling=String(editor.querySelector('#seb-bh-history-feeling')?.value||editor.dataset.feeling||'');
  return { title:'Bilan institutionnel', note:String(editor.dataset.note || ''), summary, feeling, headers:['Modules','NE','I','II','III','Commentaires'], rows };
}


function sebBhSummary(card,c){
 const lvl=k=>{const r=[...card.querySelectorAll('tbody tr')].find(x=>x.dataset?.key===k&&!x.classList.contains('seb-bh-section')),a=r?.querySelector('.seb-bh-level.on');return String(a?.dataset.level||'')},rank={I:1,II:2,III:3};
 const worst=ks=>ks.map(k=>[k,lvl(k)]).filter(x=>rank[x[1]]).sort((a,b)=>rank[b[1]]-rank[a[1]])[0]||['',''];
 const allI=ks=>{const v=ks.map(lvl).filter(x=>rank[x]);return v.length&&v.every(x=>x==='I')};
 const n={'fabrication-plan':'la lecture de plan','fabrication-tracage':'le traçage','fabrication-decoupe':'la découpe','fabrication-assemblage':'l’assemblage','fabrication-finition':'les finitions','briques-identification':'la lecture du schéma','briques-manipulation':'l’assemblage des briques','carre':'la résolution de problèmes','organisation':'l’organisation du stock','planning':'la planification','texte':'le traitement de texte','mail':'la messagerie','expression':'l’expression écrite','math-enonce':'la compréhension des consignes mathématiques','math-problemes':'la résolution des problèmes mathématiques'};
 const cv=String(c?.civilite||''),nom=String(c?.nom||'').trim().toUpperCase();let lead='La personne';if(cv==='M.'&&nom)lead='M. '+nom;else if(cv==='Mme'&&nom)lead='Mme '+nom;else if(cv==='Autre'&&nom)lead=nom;
 const out=[],tech=['fabrication-plan','fabrication-tracage','fabrication-decoupe','fabrication-assemblage','fabrication-finition','briques-identification','briques-manipulation'],org=['carre','organisation','planning'],dig=['texte','mail'],fond=['expression','math-enonce','math-problemes'];let w=worst(tech);
 if(w[1]){if(allI(tech))out.push(lead+' réalise les activités techniques avec autonomie.');else if(w[1]==='III')out.push(lead+' rencontre des difficultés dans certaines activités techniques. Le point le plus fragile concerne '+n[w[0]]+'.');else out.push(lead+' réalise les activités techniques de façon globalement satisfaisante. Des repères complémentaires restent utiles pour '+n[w[0]]+'.')}
 w=worst(org);if(w[1])out.push(allI(org)?'Les exercices d’organisation et de planification sont réalisés de manière satisfaisante.':w[1]==='III'?'L’organisation et la planification restent difficiles dans les situations comportant plusieurs contraintes.':'L’organisation est globalement comprise. Quelques repères restent nécessaires dans les tâches sous contraintes.');
 const tt=lvl('tri-temps'),te=lvl('tri-erreurs');if(rank[tt]||rank[te])out.push(tt==='I'&&te==='I'?'Le tri de chevilles est réalisé avec un rythme et une fiabilité satisfaisants.':te==='I'?'Le tri est fiable, mais le rythme de réalisation reste à consolider.':tt==='I'?'Le rythme du tri est satisfaisant. La fiabilité demande encore de l’attention.':'La tâche de tri met en évidence des difficultés de rythme et de fiabilité.');
 w=worst(dig);if(w[1])out.push(allI(dig)?'L’utilisation des outils bureautiques est maîtrisée.':w[1]==='III'?'L’utilisation des outils bureautiques reste difficile et nécessite un accompagnement.':'Les outils bureautiques sont globalement compris, avec encore quelques besoins de repérage.');
 w=worst(fond);if(w[1])out.push(allI(fond)?'Les savoirs fondamentaux évalués sont globalement maîtrisés.':w[1]==='III'?'Des difficultés marquées apparaissent dans les savoirs fondamentaux, notamment pour '+n[w[0]]+'.':'Les savoirs fondamentaux sont partiellement acquis. Un soutien reste utile pour '+n[w[0]]+'.');
 return out.length?out.join('\n\n'):'La synthèse pourra être générée lorsque le bilan comportera des éléments évalués.';
}

// SEB_V4_HISTORY_LONG_SUMMARY

const SEB_V4_ROWS=[["fabrication-plan","la lecture et la compréhension d’un plan"],["fabrication-tracage","le traçage et le repérage"],["fabrication-decoupe","la découpe"],["fabrication-assemblage","le pliage et l’assemblage"],["fabrication-finition","la qualité des finitions"],["briques-identification","la lecture et l’interprétation d’un schéma"],["briques-manipulation","la manipulation et l’assemblage de pièces"],["carre","le raisonnement visuo-spatial et la résolution d’un problème structuré"],["organisation","l’organisation et la gestion logistique"],["planning","la planification de tâches sous contraintes"],["tri-temps","le rythme de réalisation du tri"],["tri-erreurs","la fiabilité et le contrôle dans la tâche de tri"],["texte","l’utilisation du traitement de texte"],["mail","l’utilisation de la messagerie électronique"],["expression","l’expression écrite"],["math-enonce","la compréhension des consignes et énoncés mathématiques"],["math-problemes","les calculs et la résolution de problèmes mathématiques"]];
function sebV4Generate(level,text,lead){
 const out=[lead+' a participé à un ensemble de mises en situation permettant d’apprécier ses compétences techniques, organisationnelles, numériques et ses savoirs fondamentaux.'];
 const points=[],alerts=[];
 for(const [key,label] of SEB_V4_ROWS){
  const l=String(level(key)||'');
  if(l==='I'){out.push('La compétence relative à '+label+' est maîtrisée et constitue un point d’appui dans le parcours.');points.push(label)}
  else if(l==='II'){out.push('La compétence relative à '+label+' est globalement accessible. Des repères, une vérification ou des consignes complémentaires restent utiles pour sécuriser la réalisation.');alerts.push(label)}
  else if(l==='III'){out.push('La compétence relative à '+label+' reste fragile. Elle nécessite un accompagnement plus soutenu, une méthode explicite ou davantage de temps pour être mobilisée efficacement.');alerts.push(label)}
  else if(l==='NE'){out.push('La compétence relative à '+label+' n’a pas pu être évaluée au cours du parcours.')}
 }
 if(points.length)out.push('Les principaux points d’appui observés concernent '+points.slice(0,3).join(', ').replace(/, ([^,]*)$/, ' et $1')+'.');
 if(alerts.length)out.push('Les axes de consolidation prioritaires concernent '+alerts.slice(0,3).join(', ').replace(/, ([^,]*)$/, ' et $1')+'.');
 else out.push('Au regard des éléments évalués, le parcours ne fait pas apparaître de difficulté majeure nécessitant un accompagnement spécifique.');
 return out.slice(0,20).join('\n');
}
function sebV4Identity(c){
 c=c||{};const cv=String(c.civilite||''),n=String(c.nom||'').trim().toUpperCase();
 if(cv==='M.')return{lead:n?'M. '+n:'La personne',title:n?'M. '+n:'la personne'};
 if(cv==='Mme')return{lead:n?'Mme '+n:'La personne',title:n?'Mme '+n:'la personne'};
 if(cv==='Autre')return{lead:n||'La personne',title:n||'la personne'};
 return{lead:'La personne',title:'la personne'};
}

function sebV4HistorySummary(card,c){const tr=k=>[...card.querySelectorAll('tbody tr')].find(x=>x.dataset?.key===k&&!x.classList.contains('seb-bh-section')),l=k=>String(tr(k)?.querySelector('.seb-bh-level.on')?.dataset.level||''),t=k=>String(tr(k)?.querySelector('.seb-bh-comment')?.value||'');return sebV4Generate(l,t,sebV4Identity(c).lead)}
function sebV4HistoryFeelingTitle(c){return 'Ressenti de '+sebV4Identity(c).title+' sur son plateau technique'}

function openEditor(filename, archive) {
  const existing = document.getElementById('seb-bilan-history-editor');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'seb-bilan-history-editor';
  const candidate = archive.candidate || {};
  overlay.innerHTML = `<div class="seb-bh-editor-card"><div class="seb-bh-editor-head"><strong>Ancien bilan — ${escapeHtml(candidateLabel(candidate))}</strong><span class="seb-bh-badge">Build #${escapeHtml(archive.originalBuild || '?')}</span><span class="seb-bh-warning">MODIFICATION = NOUVELLE RÉVISION</span></div><div class="seb-bh-editor-body"><div class="seb-bh-meta"><span><b>Nom :</b> ${escapeHtml(candidate.nom || '')}</span><span><b>Prénom :</b> ${escapeHtml(candidate.prenom || '')}</span><span><b>Date :</b> ${escapeHtml(candidate.date || '')}</span><span><b>Version :</b> ${archive.revision === 0 ? 'Original' : `Révision ${archive.revision}`}</span></div><table class="seb-bh-table"><colgroup><col style="width:39%"><col style="width:5.6%"><col style="width:5.6%"><col style="width:5.6%"><col style="width:5.6%"><col style="width:38.6%"></colgroup><thead><tr><th>Modules</th><th>NE</th><th>I</th><th>II</th><th>III</th><th>Commentaires</th></tr></thead><tbody></tbody></table><section style="margin:16px 0;border:1px solid #9cc2e5;background:#f7fbff;padding:13px"><h2 style="margin:0 0 8px;color:#1f4e79">Synthèse du bilan</h2><button type="button" id="seb-bh-gen-summary" style="background:#0070c0;color:#fff;border:0;border-radius:5px;padding:8px 13px;font-weight:700">Générer / régénérer la synthèse</button><p style="font-size:12px;color:#555">Ancien bilan sans civilité : utilisation de « La personne ».</p><textarea id="seb-bh-history-summary" style="width:100%;min-height:360px;box-sizing:border-box;padding:9px;font:14px Calibri,Arial;line-height:1.45"></textarea></section><section style="margin:14px 0;border:1px solid #b8cce4;background:#fbfdff;padding:13px"><h2 id="seb-bh-history-feeling-title" style="margin:0 0 8px;color:#1f4e79"></h2><p style="font-size:12px;color:#555">Renseigner ici le bilan personnel exprimé par le stagiaire sur son parcours au plateau technique.</p><textarea id="seb-bh-history-feeling" style="width:100%;min-height:180px;box-sizing:border-box;padding:9px;font:14px Calibri,Arial;line-height:1.4"></textarea></section></div><div class="seb-bh-editor-foot"><div class="info" id="seb-bh-editor-info">Archive autonome · le bilan d'origine n'est jamais écrasé.</div><button type="button" id="seb-bh-export">Exporter Word</button><button type="button" id="seb-bh-save-revision" class="primary">Enregistrer une nouvelle révision</button><button type="button" id="seb-bh-editor-close">Fermer</button></div></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector('.seb-bh-editor-card');
  card.dataset.note = String((archive.document && archive.document.note) || '');
  card.dataset.summary = String((archive.document && archive.document.summary) || '');
  const tbody = overlay.querySelector('tbody');
  const rows = archive.document && Array.isArray(archive.document.rows) ? archive.document.rows : [];
  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.dataset.key = String(row.key || `row-${index + 1}`);
    if (row.kind === 'section') {
      tr.className = 'seb-bh-section';
      const td = document.createElement('td'); td.colSpan = 6; td.textContent = row.sectionText || ''; tr.appendChild(td); tbody.appendChild(tr); return;
    }
    tr.dataset.className = String(row.className || '');
    tr.dataset.moduleText = String(row.moduleText || '');
    const module = document.createElement('td'); module.className = 'seb-bh-module'; module.textContent = row.moduleText || ''; tr.appendChild(module);
    ['NE','I','II','III'].forEach((level) => {
      const td = document.createElement('td'); td.className = 'seb-bh-level' + (row.level === level ? ' on' : ''); td.dataset.level = level;
      td.addEventListener('click', () => { tr.querySelectorAll('.seb-bh-level').forEach((cell) => cell.classList.remove('on')); td.classList.add('on'); });
      tr.appendChild(td);
    });
    const comments = document.createElement('td');
    if (Array.isArray(row.options) && row.options.length) {
      const select = document.createElement('select'); select.className = 'seb-bh-select';
      row.options.forEach((opt) => { const option = document.createElement('option'); option.value = opt.value || ''; option.textContent = opt.text || ''; option.dataset.level = opt.level || ''; select.appendChild(option); });
      select.value = row.preset || '';
      select.addEventListener('change', () => {
        const chosen = select.options[select.selectedIndex];
        const level = chosen && chosen.dataset.level;
        if (level && ['NE','I','II','III'].includes(level)) {
          tr.querySelectorAll('.seb-bh-level').forEach((cell) => cell.classList.toggle('on', cell.dataset.level === level));
        } else {
          tr.querySelectorAll('.seb-bh-level').forEach((cell) => cell.classList.remove('on'));
        }
        const comment = tr.querySelector('.seb-bh-comment');
        if (comment) comment.value = chosen ? String(chosen.value || '') : '';
      });
      comments.appendChild(select);
    }
    const textarea = document.createElement('textarea'); textarea.className = 'seb-bh-comment'; textarea.value = row.comment || ''; comments.appendChild(textarea);
    if (row.detail) { const detail = document.createElement('div'); detail.className = 'seb-bh-detail'; detail.textContent = row.detail; comments.appendChild(detail); }
    tr.appendChild(comments); tbody.appendChild(tr);
  });

  const sa=overlay.querySelector('#seb-bh-history-summary');if(sa){sa.value=sebV7Single(String((archive.document&&archive.document.summary)||''));sa.addEventListener('input',()=>card.dataset.summary=sa.value)}
  const gb=overlay.querySelector('#seb-bh-gen-summary');if(gb){const nb=gb.cloneNode(true);gb.replaceWith(nb);nb.addEventListener('click',()=>{sa.value=sebV7Single(sebV4HistorySummary(card,candidate));card.dataset.summary=sa.value})}

  const fa=overlay.querySelector('#seb-bh-history-feeling');if(fa){fa.value=String((archive.document&&archive.document.feeling)||'');fa.addEventListener('input',()=>card.dataset.feeling=fa.value)}const ftitle=overlay.querySelector('#seb-bh-history-feeling-title');if(ftitle)ftitle.textContent=sebV4HistoryFeelingTitle(candidate);

  let currentFilename = filename;
  let currentRevision = Number(archive.revision || 0);
  overlay.querySelector('#seb-bh-editor-close').addEventListener('click', () => overlay.remove());
  const saveRevisionButton = overlay.querySelector('#seb-bh-save-revision');
  let revisionSaveInFlight = false;
  saveRevisionButton.addEventListener('click', async () => {
    if (revisionSaveInFlight) return;
    revisionSaveInFlight = true;
    saveRevisionButton.disabled = true;
    try {
      const info = overlay.querySelector('#seb-bh-editor-info');
      info.textContent = 'Enregistrement de la nouvelle révision…';
      const result = await ipcRenderer.invoke('bilan-history:save-revision', { sourceFilename: currentFilename, document: buildEditorDocument(card) });
      if (result && result.ok) {
        currentFilename = result.filename || currentFilename;
        currentRevision = Number.isFinite(Number(result.revision)) ? Number(result.revision) : currentRevision;
        if (result.unchanged) {
          info.textContent = `Aucune modification : révision ${result.revision} inchangée.`;
        } else {
          const wordFilename = exportHistoricalWord(card, candidate, archive.originalBuild, currentRevision);
          info.textContent = `Révision ${result.revision} enregistrée. Word mis à jour automatiquement : ${wordFilename} dans Documents\\SEB EvalPro\\Bilans. L'ancienne version est conservée.`;
        }
      } else info.textContent = `Erreur : ${(result && result.error) || 'enregistrement impossible'}`;
    } finally {
      revisionSaveInFlight = false;
      saveRevisionButton.disabled = false;
    }
  });
  overlay.querySelector('#seb-bh-export').addEventListener('click', () => {
    const info = overlay.querySelector('#seb-bh-editor-info');
    const wordFilename = exportHistoricalWord(card, candidate, archive.originalBuild, currentRevision);
    if (info) info.textContent = `Word mis à jour : ${wordFilename} dans Documents\\SEB EvalPro\\Bilans.`;
  });
}

function exportHistoricalWord(card, candidate, originalBuild, revision) {
  const edited = buildEditorDocument(card);
  const templateResult = ipcRenderer.sendSync('bilan-history:get-word-template-sync');
  if (!templateResult || !templateResult.ok || !templateResult.html) {
    throw new Error((templateResult && templateResult.error) || 'Chargement du modèle institutionnel impossible.');
  }

  const parsed = new DOMParser().parseFromString(String(templateResult.html), 'text/html');
  const table = parsed.getElementById('bilan');
  if (!table) throw new Error('Tableau institutionnel introuvable dans le modèle.');

  // SEB_WORD_EQUAL_LEVEL_WIDTHS : Word doit recevoir des largeurs explicites.
  const wordWidths = ['40%','7.5%','7.5%','7.5%','7.5%','30%'];
  const oldColgroup = table.querySelector('colgroup');
  if (oldColgroup) oldColgroup.remove();
  const colgroup = parsed.createElement('colgroup');
  wordWidths.forEach((width) => {
    const col = parsed.createElement('col');
    col.style.width = width;
    col.setAttribute('width', width);
    colgroup.appendChild(col);
  });
  table.insertBefore(colgroup, table.firstChild);
  table.querySelectorAll('tr').forEach((tr) => {
    const cells = Array.from(tr.children || []);
    if (cells.length !== 6) return;
    cells.forEach((cell, index) => {
      cell.style.width = wordWidths[index];
      cell.setAttribute('width', wordWidths[index]);
    });
  });

  const byKey = new Map((edited.rows || []).filter((row) => row && row.kind === 'item').map((row) => [String(row.key || ''), row]));
  const colours = { NE:['#CCFFFF','#000000'], I:['#92D050','#000000'], II:['#ED7D31','#FFFFFF'], III:['#C00000','#FFFFFF'] };
  const paint = (el, bg, fg) => {
    if (!el) return;
    el.style.backgroundColor = bg;
    el.setAttribute('bgcolor', bg);
    if (fg) {
      el.style.color = fg;
      el.setAttribute('color', fg);
    }
  };

  const headers = table.querySelectorAll('thead th');
  paint(headers[0], '#0070C0', '#FFFFFF');
  paint(headers[1], '#CCFFFF', '#000000');
  paint(headers[2], '#92D050', '#000000');
  paint(headers[3], '#ED7D31', '#FFFFFF');
  paint(headers[4], '#C00000', '#FFFFFF');
  paint(headers[5], '#0070C0', '#FFFFFF');
  table.querySelectorAll('tr.section td').forEach((el) => paint(el, '#9CC2E5', '#000000'));
  table.querySelectorAll('tr.section2 td').forEach((el) => paint(el, '#B8CCE4', '#000000'));
  table.querySelectorAll('tr.alt td').forEach((el) => paint(el, '#F2F2F2', '#000000'));

  table.querySelectorAll('tbody tr[data-r]').forEach((tr) => {
    const row = byKey.get(String(tr.getAttribute('data-r') || ''));
    if (!row) return;

    const level = ['NE','I','II','III'].includes(String(row.level || '')) ? String(row.level) : '';
    tr.setAttribute('data-level', level);
    tr.querySelectorAll('.level').forEach((cell) => {
      cell.classList.remove('on');
      const isAlt = tr.classList.contains('alt');
      paint(cell, isAlt ? '#F2F2F2' : '#FFFFFF', '#000000');
      if (String(cell.getAttribute('data-l') || '') === level) {
        cell.classList.add('on');
        const c = colours[level];
        if (c) paint(cell, c[0], c[1]);
      }
      // Les cases de niveau restent vides : NE/I/II/III n'apparaissent que
      // dans la première ligne d'en-tête, comme dans le document de référence.
      cell.querySelectorAll('.word-level-label').forEach((label) => label.remove());
    });

    const select = tr.querySelector('.csel');
    if (select) select.remove();

    const textarea = tr.querySelector('.ctxt');
    if (textarea) {
      const div = parsed.createElement('div');
      div.style.whiteSpace = 'pre-wrap';
      div.textContent = String(row.comment || row.preset || '');
      textarea.replaceWith(div);
    }

    const detail = tr.querySelector('.detail');
    if (detail) detail.textContent = String(row.detail || '');

    if (String(row.key) === 'tri-temps') {
      const avg = String(row.moduleText || '').match(/Moyennes+([0-9]{1,2}:[0-9]{2})/i);
      const avgEl = tr.querySelector('#triAvg');
      if (avg && avgEl) avgEl.textContent = avg[1].padStart(5, '0');
    }
    if (String(row.key) === 'tri-erreurs') {
      const err = String(row.moduleText || '').match(/([0-9]+)s+erreur/i);
      const errEl = tr.querySelector('#triErr');
      if (err && errEl) errEl.textContent = err[1] + ' erreur' + (Number(err[1]) > 1 ? 's' : '');
    }
  });

  table.querySelectorAll('.csel').forEach((el) => el.remove());
  table.querySelectorAll('.ctxt').forEach((el) => {
    const div = parsed.createElement('div');
    div.style.whiteSpace = 'pre-wrap';
    div.textContent = String(el.value || '');
    el.replaceWith(div);
  });

  const style = '<style>@page Section1{size:595.35pt 841.95pt;mso-page-orientation:portrait;margin:28pt}div.Section1{page:Section1}body{font-family:Calibri,Arial;font-size:10pt}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #000;padding:4pt;vertical-align:top}th:nth-child(2),th:nth-child(3),th:nth-child(4),th:nth-child(5),td:nth-child(2),td:nth-child(3),td:nth-child(4),td:nth-child(5){width:7.5%}th{background:#0070c0;color:#fff}.nehead{background:#CCFFFF;color:#000}.ihead{background:#92D050;color:#000}.iihead{background:#ED7D31;color:#fff}.iiihead{background:#C00000;color:#fff}.alt td{background:#F2F2F2}.section td{background:#9CC2E5}.section2 td{background:#B8CCE4}.on[data-l="NE"]{background:#CCFFFF}.on[data-l="I"]{background:#92D050}.on[data-l="II"]{background:#ED7D31}.on[data-l="III"]{background:#C00000;color:#fff}</style>';
  const meta = '<p><b>Nom :</b> ' + escapeHtml(candidate.nom || '') + ' &nbsp; <b>Prénom :</b> ' + escapeHtml(candidate.prenom || '') + ' &nbsp; <b>Date :</b> ' + escapeHtml(candidate.date || '') + '</p>';
  const summaryHtml = edited.summary ? '<h2 style="margin-top:18pt">Synthèse de l’évaluation</h2><p style="white-space:pre-wrap">' + escapeHtml(edited.summary) + '</p>' : '';
  const feelingHtml = edited.feeling ? '<h2 style=\"margin-top:18pt\">' + escapeHtml(sebV4HistoryFeelingTitle(candidate)) + '</h2><p style=\"white-space:pre-wrap\">' + escapeHtml(edited.feeling) + '</p>' : '';
  const html = '<!doctype html><html><head><meta charset="utf-8">' + style + '</head><body><div class="Section1">' + meta + table.outerHTML + summaryHtml + feelingHtml + '</div></body></html>';

  const safe = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'CANDIDAT';
  const wordFilename = 'Evaluation_' + safe(candidate.nom).toUpperCase() + '_' + safe(candidate.prenom).toUpperCase() + '_' + safe(candidate.date || '') + '.doc';
  const result = ipcRenderer.sendSync('bilan-history:write-word-sync', { filename: wordFilename, html, candidate });
  if (!result || !result.ok) throw new Error((result && result.error) || 'Écriture du document Word impossible.');
  return result.path || result.filename || wordFilename;
}

function install() {
  if (installed) return;
  installed = true;
  addStyle();
  installAdminButton();
  installBilanSaveHook();
}

module.exports = { install, openEditor };


// SEB_HISTORY_NATURAL_SYNTHESIS_V5

const SEB_NAT_GROUPS={
 fabrication:['fabrication-plan','fabrication-tracage','fabrication-decoupe','fabrication-assemblage','fabrication-finition'],
 briques:['briques-identification','briques-manipulation'],
 organisation:['carre','organisation','planning'],
 tri:['tri-temps','tri-erreurs'],
 numerique:['texte','mail'],
 fondamentaux:['expression','math-enonce','math-problemes']
};
function sebNatIdentity(c){c=c||{};const cv=String(c.civilite||''),n=String(c.nom||'').trim().toUpperCase();if(cv==='M.')return{lead:n?'M. '+n:'La personne',subject:'Il'};if(cv==='Mme')return{lead:n?'Mme '+n:'La personne',subject:'Elle'};if(cv==='Autre')return{lead:n||'La personne',subject:'Iel'};return{lead:'La personne',subject:'La personne'}}
function sebNatJoin(a){a=a.filter(Boolean);return a.length<2?(a[0]||''):a.length===2?a[0]+' et '+a[1]:a.slice(0,-1).join(', ')+' et '+a[a.length-1]}
function sebNatCap(s){s=String(s||'');return s?s.charAt(0).toUpperCase()+s.slice(1):s}
function sebNatDomainScore(level,keys){const v=keys.map(k=>String(level(k)||'')).filter(x=>['I','II','III'].includes(x)).map(x=>x==='I'?3:x==='II'?2:1);return v.length?v.reduce((a,b)=>a+b,0)/v.length:0}
function sebNaturalSummary(level,text,id){
 id=id||{lead:'La personne',subject:'La personne'};const L=k=>String(level(k)||''),T=k=>String(text(k)||'').replace(/\s+/g,' ').trim(),p=[];const all=Object.values(SEB_NAT_GROUPS).flat(),ev=all.filter(k=>['I','II','III'].includes(L(k))).length,ne=all.filter(k=>L(k)==='NE').length,good=all.filter(k=>L(k)==='I').length,hard=all.filter(k=>L(k)==='III').length;
 let intro=id.lead+' a participé aux différentes mises en situation proposées au cours du plateau technique. ';
 if(ev&&good>=Math.ceil(ev*0.65)&&hard<=2)intro+='L’ensemble fait apparaître plusieurs acquis solides et une autonomie globalement satisfaisante, avec quelques points qui restent à consolider.';
 else if(ev)intro+='Les résultats font apparaître un profil contrasté, avec des points d’appui identifiés et des situations qui nécessitent encore des repères ou un accompagnement.';
 else intro+='Le bilan comporte encore trop peu d’éléments évalués pour dégager une tendance générale.';
 if(ne>=3)intro+=' Certaines activités n’ayant pas pu être évaluées, les conclusions doivent être replacées dans le cadre des situations effectivement réalisées.';p.push(intro);
 const fabGood=[],fabMid=[],fabHard=[],fabNE=[];const fabLabels={'fabrication-plan':'la lecture du plan','fabrication-tracage':'le traçage','fabrication-decoupe':'la découpe','fabrication-assemblage':'l’assemblage','fabrication-finition':'les finitions'};
 for(const k of SEB_NAT_GROUPS.fabrication){const l=L(k);if(l==='I')fabGood.push(fabLabels[k]);else if(l==='II')fabMid.push(fabLabels[k]);else if(l==='III')fabHard.push(fabLabels[k]);else if(l==='NE')fabNE.push(fabLabels[k])}
 if(fabGood.length||fabMid.length||fabHard.length||fabNE.length){let s='Dans les activités de fabrication, ';if(fabGood.length>=3)s+='les bases techniques sont bien installées. '+sebNatCap(sebNatJoin(fabGood.slice(0,3)))+' constituent des points d’appui dans la réalisation. ';else if(fabGood.length)s+=sebNatCap(sebNatJoin(fabGood))+' fait partie des éléments maîtrisés. ';if(fabMid.length)s+=sebNatCap(sebNatJoin(fabMid))+(fabMid.length>1?' demandent':' demande')+' encore davantage de contrôle et de précision. ';if(fabHard.length)s+=sebNatCap(sebNatJoin(fabHard))+(fabHard.length>1?' mettent':' met')+' en évidence un besoin d’accompagnement plus important ou d’une méthode plus structurée. ';if(fabNE.length)s+='L’évaluation n’a pas pu porter sur '+sebNatJoin(fabNE)+'.';p.push(s.trim())}
 const bi=L('briques-identification'),bm=L('briques-manipulation');if(['I','II','III','NE'].includes(bi)||['I','II','III','NE'].includes(bm)){let s='La construction à base de briques ';if(bi==='I'&&bm==='I')s+='confirme de bonnes capacités visuo-constructives. '+id.subject+' comprend le schéma proposé, identifie les éléments utiles et réalise l’assemblage de manière satisfaisante. Cette activité montre que les consignes structurées et les supports visuels peuvent être mobilisés efficacement.';else{const bGood=[],bNeed=[];if(bi==='I')bGood.push('la lecture du schéma');else if(bi==='II'||bi==='III')bNeed.push('l’interprétation du schéma');if(bm==='I')bGood.push('la manipulation et l’assemblage');else if(bm==='II'||bm==='III')bNeed.push('la manipulation et l’assemblage');s+='met en évidence des résultats plus nuancés. ';if(bGood.length)s+=sebNatJoin(bGood)+' constitue'+(bGood.length>1?'nt':'')+' un point d’appui. ';if(bNeed.length)s+=sebNatJoin(bNeed)+' demande'+(bNeed.length>1?'nt':'')+' encore des repères, de la vérification ou davantage de temps.';if(bi==='NE'||bm==='NE')s+=' Une partie de cette compétence n’a pas pu être appréciée.'}p.push(s.trim())}
 const ca=L('carre'),og=L('organisation'),pl=L('planning');if([ca,og,pl].some(x=>['I','II','III','NE'].includes(x))){let s='Les exercices sollicitant le raisonnement, l’organisation et la planification ';if(ca==='I'&&og==='I'&&pl==='I')s+='sont réalisés de manière satisfaisante. '+id.subject+' parvient à analyser la situation, organiser les informations et ordonner les étapes attendues avec une autonomie adaptée.';else{s+='font apparaître des résultats contrastés. ';if(ca==='III')s+='La résolution d’un problème structuré reste difficile et nécessite une méthode plus explicite pour construire une stratégie efficace. ';else if(ca==='II')s+='Le raisonnement est accessible, mais la démarche gagne à être structurée et vérifiée. ';else if(ca==='I')s+='Le raisonnement sur une situation structurée constitue un point d’appui. ';if(og==='III')s+='L’organisation d’une tâche comportant plusieurs critères reste également fragile. ';else if(og==='II')s+='L’organisation multicritère est comprise, mais demande encore des vérifications. ';else if(og==='I')s+='La gestion d’une tâche comportant plusieurs critères est correctement appréhendée. ';if(pl==='I'&&(og==='II'||og==='III'||ca==='II'||ca==='III'))s+='À l’inverse, la planification est correctement réalisée : '+id.subject.toLowerCase()+' sait ordonner des étapes lorsque le cadre et les contraintes sont clairement identifiés.';else if(pl==='II')s+='La planification est globalement comprise, avec encore quelques erreurs dans la prise en compte des contraintes.';else if(pl==='III')s+='La planification nécessite un accompagnement pour hiérarchiser les actions et maintenir un ordre d’exécution cohérent.'}p.push(s.trim())}
 const tt=L('tri-temps'),te=L('tri-erreurs');if([tt,te].some(x=>['I','II','III'].includes(x))){let s='Lors de l’activité de tri, ';if(tt==='I'&&te==='I')s+='le rythme de réalisation et la fiabilité sont satisfaisants. La tâche est menée de façon régulière avec un contrôle adapté du travail effectué.';else if(te==='I'&&(tt==='II'||tt==='III'))s+='la réalisation reste fiable, mais le rythme est plus lent que le niveau attendu. La précision constitue donc un point d’appui, tandis que la vitesse d’exécution reste à renforcer.';else if(tt==='I'&&(te==='II'||te==='III'))s+='le rythme est adapté, mais la fiabilité demande davantage d’attention. Une vérification plus systématique permettrait de limiter les erreurs.';else s+='le rythme et la fiabilité restent à consolider. Cette tâche répétitive demande encore de trouver un meilleur équilibre entre vitesse d’exécution et contrôle.';p.push(s)}
 const tx=L('texte'),ma=L('mail');if([tx,ma].some(x=>['I','II','III','NE'].includes(x))){let s='Concernant les outils numériques, ';if(tx==='I'&&ma==='I')s+='les compétences de base sont acquises. '+id.subject+' utilise le traitement de texte et la messagerie électronique avec une autonomie satisfaisante dans les situations proposées.';else if(tx==='III'&&(ma==='I'||ma==='II'))s+='le traitement de texte constitue le principal point de difficulté. Son utilisation nécessite encore un accompagnement pour mobiliser les fonctions demandées de façon autonome. La messagerie électronique est mieux appréhendée'+(ma==='II'?', même si certains repères restent à consolider.':'.');else if(ma==='III'&&(tx==='I'||tx==='II'))s+='le traitement de texte est globalement accessible, alors que l’utilisation de la messagerie électronique reste plus difficile. Un accompagnement est nécessaire pour sécuriser les différentes étapes d’un envoi et l’utilisation des fonctions associées.';else{s+='les acquis sont partiels. ';if(tx==='II')s+='Le traitement de texte est utilisable dans les tâches simples, mais certaines fonctions demandent encore des repères. ';if(ma==='II')s+='La messagerie électronique est également accessible, avec un besoin de vérification pour les opérations moins familières. ';if(tx==='I')s+='Le traitement de texte constitue un point d’appui. ';if(ma==='I')s+='La messagerie électronique est maîtrisée. ';if(tx==='NE'||ma==='NE')s+='Une partie des usages numériques n’a pas pu être évaluée.'}p.push(s.trim())}
 const ex=L('expression'),me=L('math-enonce'),mp=L('math-problemes');if([ex,me,mp].some(x=>['I','II','III','NE'].includes(x))){let s='Sur les savoirs fondamentaux, ';if(ex==='I')s+='l’expression écrite est maîtrisée dans les situations évaluées. ';else if(ex==='II')s+='les acquis en expression écrite sont présents mais demandent encore à être consolidés pour gagner en clarté, en précision et en régularité. ';else if(ex==='III')s+='l’expression écrite reste fragile et nécessite un accompagnement pour structurer les idées et sécuriser les règles de base. ';else if(ex==='NE')s+='l’expression écrite n’a pas pu être évaluée. ';if(me==='I')s+='En mathématiques, la compréhension des consignes et des énoncés constitue un point d’appui. ';else if(me==='II')s+='La compréhension des consignes mathématiques est globalement accessible, mais certaines informations doivent encore être reformulées ou vérifiées. ';else if(me==='III')s+='La compréhension des consignes mathématiques reste difficile et peut freiner l’entrée dans la résolution. ';if(mp==='I')s+='Les calculs et la résolution de problèmes sont ensuite réalisés de manière satisfaisante.';else if(mp==='II')s+='Les calculs et la résolution de problèmes sont accessibles, avec encore quelques erreurs ou imprécisions dans l’application des procédures.';else if(mp==='III')s+='La mise en œuvre des calculs et la résolution de problèmes nécessitent un accompagnement plus soutenu.';else if(mp==='NE')s+='La partie portant sur les calculs et la résolution de problèmes n’ayant pas pu être évaluée, il n’est pas possible de conclure sur ce volet.';p.push(s.trim())}
 const domains=[['les activités techniques',sebNatDomainScore(level,SEB_NAT_GROUPS.fabrication.concat(SEB_NAT_GROUPS.briques))],['l’organisation et le raisonnement',sebNatDomainScore(level,SEB_NAT_GROUPS.organisation)],['les tâches répétitives',sebNatDomainScore(level,SEB_NAT_GROUPS.tri)],['les outils numériques',sebNatDomainScore(level,SEB_NAT_GROUPS.numerique)],['les savoirs fondamentaux',sebNatDomainScore(level,SEB_NAT_GROUPS.fondamentaux)]].filter(x=>x[1]>0);domains.sort((a,b)=>b[1]-a[1]);const strengths=domains.filter(x=>x[1]>=2.55).slice(0,2).map(x=>x[0]),needs=domains.filter(x=>x[1]<2.25).sort((a,b)=>a[1]-b[1]).slice(0,2).map(x=>x[0]);let c='Dans l’ensemble, ';if(strengths.length)c+='les appuis les plus nets se situent dans '+sebNatJoin(strengths)+'. ';else c+='le parcours met en évidence des acquis mobilisables, mais encore inégaux selon les situations. ';if(needs.length)c+='Les principaux axes de progression concernent '+sebNatJoin(needs)+'. ';else c+='Aucune fragilité majeure ne se dégage des domaines effectivement évalués. ';c+='Ces éléments sont à mettre en perspective avec le ressenti exprimé par la personne et avec les exigences du projet professionnel envisagé.';p.push(c);
 return p.filter(Boolean).join('\n\n');
}

sebV4HistorySummary=function(card,c){const tr=k=>[...card.querySelectorAll('tbody tr')].find(x=>x.dataset?.key===k&&!x.classList.contains('seb-bh-section')),lv=k=>String(tr(k)?.querySelector('.seb-bh-level.on')?.dataset.level||''),tx=k=>{const r=tr(k);if(!r)return'';return [r.querySelector('.seb-bh-comment')?.value,r.querySelector('.seb-bh-detail')?.textContent,r.querySelector('.seb-bh-select')?.value].map(x=>String(x||'').trim()).filter(Boolean).join(' ')};return sebNaturalSummary(lv,tx,sebNatIdentity(c||{}))};


// SEB_HISTORY_NATURAL_SYNTHESIS_V6

const SEB_V6_GROUPS={
 fabrication:['fabrication-plan','fabrication-tracage','fabrication-decoupe','fabrication-assemblage','fabrication-finition'],
 briques:['briques-identification','briques-manipulation'],
 organisation:['carre','organisation','planning'],
 tri:['tri-temps','tri-erreurs'],
 numerique:['texte','mail'],
 expression:['expression'],
 maths:['math-enonce','math-problemes']
};
const SEB_V6_LABELS={
 'fabrication-plan':'la lecture et la compréhension du plan',
 'fabrication-tracage':'le traçage et le repérage',
 'fabrication-decoupe':'la découpe',
 'fabrication-assemblage':'le pliage et l’assemblage',
 'fabrication-finition':'les finitions',
 'briques-identification':'la lecture du schéma',
 'briques-manipulation':'la manipulation et l’assemblage des briques',
 'carre':'le raisonnement visuo-spatial',
 'organisation':'l’organisation et la gestion logistique',
 'planning':'la planification',
 'tri-temps':'le rythme de réalisation du tri',
 'tri-erreurs':'la fiabilité du tri',
 'texte':'le traitement de texte',
 'mail':'la messagerie électronique',
 'expression':'l’expression écrite',
 'math-enonce':'la compréhension des consignes mathématiques',
 'math-problemes':'les calculs et la résolution de problèmes'
};
function sebV6Identity(c){c=c||{};const cv=String(c.civilite||''),n=String(c.nom||'').trim().toUpperCase();if(cv==='M.')return{lead:n?'M. '+n:'La personne',subject:'Il'};if(cv==='Mme')return{lead:n?'Mme '+n:'La personne',subject:'Elle'};if(cv==='Autre')return{lead:n||'La personne',subject:'Iel'};return{lead:'La personne',subject:'La personne'}}
function sebV6Join(a){a=a.filter(Boolean);if(!a.length)return'';if(a.length===1)return a[0];if(a.length===2)return a[0]+' et '+a[1];return a.slice(0,-1).join(', ')+' et '+a[a.length-1]}
function sebV6Lower(s){s=String(s||'').trim();return s?s.charAt(0).toLowerCase()+s.slice(1):s}
function sebV6CleanComment(v){let s=String(v||'').replace(/\s+/g,' ').trim();s=s.replace(/^(?:NE|I{1,3}|IV)\s*[.\-:;]\s*/i,'');s=s.replace(/\s+([,.;:!?])/g,'$1');if(/^(?:exercice abandonné|non évalué|non evalue|choisissez|aucun commentaire)\.?$/i.test(s))return'';return s.replace(/[.;]\s*$/,'').trim()}
function sebV6AdaptComment(v,id){let s=sebV6CleanComment(v);if(!s)return'';if(id&&id.subject&&id.subject!=='La personne')s=s.replace(/^La personne\b/i,id.subject);return s}
function sebV6Dedupe(v){let s=String(v||'').trim();if(!s)return'';const ps=s.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);for(let n=1;n<=Math.floor(ps.length/2);n++){if(ps.length%n)continue;let ok=true;for(let i=n;i<ps.length;i++){if(ps[i]!==ps[i%n]){ok=false;break}}if(ok)return ps.slice(0,n).join('\n\n')}const first=(ps[0]||'').slice(0,Math.min(90,(ps[0]||'').length));if(first.length>35){const i=s.indexOf(first,first.length);if(i>180){const unit=s.slice(0,i).trim();let rest=s,count=0;while(rest.startsWith(unit)){rest=rest.slice(unit.length).trimStart();count++}if(count>1&&!rest)return unit}}return s}
function sebV6Score(level,keys){const v=keys.map(k=>String(level(k)||'')).filter(x=>['I','II','III'].includes(x)).map(x=>x==='I'?3:x==='II'?2:1);return v.length?v.reduce((a,b)=>a+b,0)/v.length:0}
function sebV6Split(level,keys){const r={I:[],II:[],III:[],NE:[]};for(const k of keys){const l=String(level(k)||'');if(r[l])r[l].push(SEB_V6_LABELS[k])}return r}
function sebV6Evidence(keys,level,text,id,limit){const rank={III:0,II:1,I:2,NE:3};const seen=new Set;const rows=[];for(const k of keys){const c=sebV6AdaptComment(text(k),id);if(!c||c.length<12)continue;const z=c.toLowerCase().replace(/[^a-zà-ÿ0-9]+/g,' ').trim();if(seen.has(z))continue;seen.add(z);rows.push({k,l:String(level(k)||''),c})}rows.sort((a,b)=>(rank[a.l]??9)-(rank[b.l]??9));return rows.slice(0,limit||2).map((x,i)=>(i?'Il est également relevé que ':'Dans le détail, ')+sebV6Lower(x.c)+'.')}
function sebV6Generate(level,text,id){
 id=id||{lead:'La personne',subject:'La personne'};const L=k=>String(level(k)||''),T=k=>String(text(k)||''),all=Object.values(SEB_V6_GROUPS).flat(),evaluated=all.filter(k=>['I','II','III'].includes(L(k))),nI=evaluated.filter(k=>L(k)==='I').length,nII=evaluated.filter(k=>L(k)==='II').length,nIII=evaluated.filter(k=>L(k)==='III').length,nNE=all.filter(k=>L(k)==='NE').length,p=[];
 let intro=id.lead+' a participé aux différentes mises en situation du plateau technique. ';if(!evaluated.length)intro+='Les éléments actuellement renseignés ne permettent pas encore de dégager une lecture globale du parcours.';else if(nIII===0&&nII<=Math.max(2,Math.floor(evaluated.length/3)))intro+='Les observations recueillies font ressortir des acquis globalement solides, avec quelques points qui demandent encore à être consolidés.';else if(nIII<=2)intro+='Le parcours met en évidence plusieurs points d’appui, associés à des besoins de repérage ou d’accompagnement plus marqués dans certaines situations.';else intro+='Le parcours fait apparaître des compétences mobilisables dans plusieurs domaines, mais aussi des difficultés plus importantes qui limitent encore l’autonomie sur certaines tâches.';p.push(intro);
 const f=sebV6Split(level,SEB_V6_GROUPS.fabrication);if(f.I.length||f.II.length||f.III.length||f.NE.length){let s='Dans les activités de fabrication, ';if(f.I.length>=3)s+='les bases techniques sont bien installées. '+sebV6Join(f.I.slice(0,4))+' constituent des points d’appui dans la réalisation. ';else if(f.I.length)s+=sebV6Join(f.I)+' '+(f.I.length>1?'sont maîtrisées':'est maîtrisée')+'. ';if(f.II.length)s+=sebV6Join(f.II)+' '+(f.II.length>1?'demandent':'demande')+' encore davantage de contrôle, de précision ou de vérification. ';if(f.III.length)s+=sebV6Join(f.III)+' '+(f.III.length>1?'restent difficiles et nécessitent':'reste difficile et nécessite')+' un accompagnement plus soutenu ou une méthode plus structurée. ';if(f.NE.length)s+='L’évaluation n’a pas permis de conclure sur '+sebV6Join(f.NE)+'.';const e=sebV6Evidence(SEB_V6_GROUPS.fabrication,level,text,id,2);if(e.length)s+=' '+e.join(' ');p.push(s.trim())}
 const b=sebV6Split(level,SEB_V6_GROUPS.briques);if(b.I.length||b.II.length||b.III.length||b.NE.length){let s='La construction à base de briques apporte un autre éclairage sur les capacités visuo-constructives. ';if(b.I.length===2)s+=id.subject+' comprend le schéma proposé et réalise l’assemblage avec une autonomie satisfaisante. ';else{if(b.I.length)s+=sebV6Join(b.I)+' constitue'+(b.I.length>1?'nt':'')+' un point d’appui. ';if(b.II.length)s+=sebV6Join(b.II)+' demande'+(b.II.length>1?'nt':'')+' encore quelques repères ou vérifications. ';if(b.III.length)s+=sebV6Join(b.III)+' nécessite'+(b.III.length>1?'nt':'')+' un accompagnement plus important. ';if(b.NE.length)s+='Une partie de cette activité n’a pas pu être appréciée.'}const e=sebV6Evidence(SEB_V6_GROUPS.briques,level,text,id,1);if(e.length)s+=' '+e[0];p.push(s.trim())}
 const ca=L('carre'),og=L('organisation'),pl=L('planning');if([ca,og,pl].some(x=>['I','II','III','NE'].includes(x))){let s='Les exercices de raisonnement, d’organisation et de planification montrent comment '+(id.subject==='La personne'?'la personne':id.subject.toLowerCase())+' aborde une situation comportant plusieurs informations ou contraintes. ';if(ca==='I')s+='Le raisonnement sur une situation structurée est correctement mobilisé. ';else if(ca==='II')s+='Le raisonnement est accessible, mais la démarche gagne à être organisée et vérifiée. ';else if(ca==='III')s+='La résolution d’un problème structuré reste difficile et nécessite une méthode plus explicite. ';if(og==='I')s+='L’organisation d’une tâche comportant plusieurs critères est correctement appréhendée. ';else if(og==='II')s+='L’organisation multicritère est comprise, avec encore un besoin de vérification. ';else if(og==='III')s+='L’organisation d’informations multiples constitue un point de fragilité plus marqué. ';if(pl==='I')s+='La planification constitue en revanche un point d’appui lorsque le cadre et les contraintes sont clairement identifiés.';else if(pl==='II')s+='La planification est globalement comprise, malgré quelques erreurs dans la prise en compte des contraintes.';else if(pl==='III')s+='La planification nécessite encore un accompagnement pour hiérarchiser les actions et maintenir un ordre cohérent.';const e=sebV6Evidence(SEB_V6_GROUPS.organisation,level,text,id,2);if(e.length)s+=' '+e.join(' ');p.push(s.trim())}
 const tt=L('tri-temps'),te=L('tri-erreurs');if([tt,te].some(x=>['I','II','III'].includes(x))){let s='Lors de l’activité de tri, ';if(tt==='I'&&te==='I')s+='le rythme de réalisation et la fiabilité sont satisfaisants. La tâche est menée avec régularité et le contrôle du travail reste adapté. ';else if(te==='I'&&(tt==='II'||tt==='III'))s+='la réalisation reste fiable, mais le rythme est plus lent. La précision constitue un point d’appui alors que la vitesse d’exécution reste à renforcer. ';else if(tt==='I'&&(te==='II'||te==='III'))s+='le rythme est adapté, mais la fiabilité demande davantage d’attention. Une vérification plus systématique permettrait de réduire les erreurs. ';else s+='le rythme et la fiabilité restent à consolider afin de trouver un meilleur équilibre entre vitesse d’exécution et contrôle. ';const e=sebV6Evidence(SEB_V6_GROUPS.tri,level,text,id,1);if(e.length)s+=e[0];p.push(s.trim())}
 const tx=L('texte'),ma=L('mail');if([tx,ma].some(x=>['I','II','III','NE'].includes(x))){let s='Concernant les outils numériques, ';if(tx==='I')s+='le traitement de texte est utilisé avec une autonomie satisfaisante. ';else if(tx==='II')s+='le traitement de texte est accessible pour les tâches courantes, mais certaines fonctions demandent encore des repères. ';else if(tx==='III')s+='le traitement de texte constitue un point de difficulté et nécessite un accompagnement pour mobiliser les fonctions demandées. ';else if(tx==='NE')s+='le traitement de texte n’a pas pu être évalué. ';if(ma==='I')s+='La messagerie électronique est maîtrisée dans les situations proposées.';else if(ma==='II')s+='La messagerie électronique est globalement comprise, avec encore quelques vérifications utiles pour sécuriser les différentes étapes.';else if(ma==='III')s+='La messagerie électronique reste difficile à utiliser de manière autonome.';else if(ma==='NE')s+='La messagerie électronique n’a pas pu être évaluée.';const e=sebV6Evidence(SEB_V6_GROUPS.numerique,level,text,id,2);if(e.length)s+=' '+e.join(' ');p.push(s.trim())}
 const ex=L('expression');if(['I','II','III','NE'].includes(ex)){let s='En expression écrite, ';if(ex==='I')s+='les compétences mobilisées dans les exercices proposés sont satisfaisantes.';else if(ex==='II')s+='les acquis sont présents, mais demandent encore à être consolidés pour gagner en clarté, en précision et en régularité.';else if(ex==='III')s+='des difficultés persistent dans la structuration des idées ou la maîtrise des règles de base, ce qui justifie un accompagnement plus soutenu.';else s+='les éléments disponibles ne permettent pas de conclure.';const e=sebV6Evidence(SEB_V6_GROUPS.expression,level,text,id,1);if(e.length)s+=' '+e[0];p.push(s.trim())}
 const me=L('math-enonce'),mp=L('math-problemes');if([me,mp].some(x=>['I','II','III','NE'].includes(x))){let s='En mathématiques, ';if(me==='I')s+='la compréhension des consignes et des énoncés constitue un point d’appui. ';else if(me==='II')s+='la compréhension des consignes est globalement accessible, même si certaines informations doivent être reformulées ou vérifiées. ';else if(me==='III')s+='la compréhension des consignes reste difficile et peut freiner l’entrée dans la résolution. ';else if(me==='NE')s+='la compréhension des consignes n’a pas pu être appréciée. ';if(mp==='I')s+='Les calculs et la résolution de problèmes sont ensuite réalisés de manière satisfaisante.';else if(mp==='II')s+='Les calculs et la résolution de problèmes sont accessibles, avec encore quelques erreurs ou imprécisions dans l’application des procédures.';else if(mp==='III')s+='La mise en œuvre des calculs et la résolution de problèmes nécessite un accompagnement plus soutenu.';else if(mp==='NE')s+='La partie portant sur les calculs et la résolution de problèmes n’ayant pas été évaluée, aucune conclusion n’est retenue sur ce volet.';const e=sebV6Evidence(SEB_V6_GROUPS.maths,level,text,id,2);if(e.length)s+=' '+e.join(' ');p.push(s.trim())}
 const abandoned=all.filter(k=>L(k)==='NE'&&/exercice abandonné/i.test(T(k))).length;if(abandoned)p.push((abandoned===1?'Une activité a été interrompue au cours du parcours. ':'Plusieurs activités ont été interrompues au cours du parcours. ')+'Les compétences correspondantes restent volontairement hors interprétation dans cette synthèse.');else if(nNE>=3)p.push('Plusieurs éléments sont restés non évalués. Ils ne sont pas interprétés et limitent la portée des conclusions dans les domaines concernés.');
 const ds=[['les activités techniques et de manipulation',sebV6Score(level,SEB_V6_GROUPS.fabrication.concat(SEB_V6_GROUPS.briques))],['l’organisation, le raisonnement et la planification',sebV6Score(level,SEB_V6_GROUPS.organisation)],['le rythme et le contrôle dans le tri',sebV6Score(level,SEB_V6_GROUPS.tri)],['l’utilisation des outils numériques',sebV6Score(level,SEB_V6_GROUPS.numerique)],['l’expression écrite',sebV6Score(level,SEB_V6_GROUPS.expression)],['les compétences mathématiques',sebV6Score(level,SEB_V6_GROUPS.maths)]].filter(x=>x[1]>0);const strengths=ds.filter(x=>x[1]>=2.6).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]),needs=ds.filter(x=>x[1]<=2.15).sort((a,b)=>a[1]-b[1]).slice(0,3).map(x=>x[0]);let conclusion='Dans l’ensemble, ';if(strengths.length)conclusion+='les points d’appui les plus nets concernent '+sebV6Join(strengths)+'. ';else conclusion+='les acquis apparaissent encore variables selon les situations proposées. ';if(needs.length)conclusion+='Les principaux axes de progression concernent '+sebV6Join(needs)+'. ';else conclusion+='Les domaines évalués ne font pas apparaître de fragilité majeure nécessitant un accompagnement renforcé. ';conclusion+='Le ressenti du stagiaire, présenté séparément, complète cette lecture des observations réalisées pendant le plateau technique.';p.push(conclusion);
 return sebV6Dedupe(p.filter(Boolean).join('\n\n'));
}

sebV4HistorySummary=function(card,c){const tr=k=>[...card.querySelectorAll('tbody tr')].find(x=>x.dataset?.key===k&&!x.classList.contains('seb-bh-section')),lv=k=>String(tr(k)?.querySelector('.seb-bh-level.on')?.dataset.level||''),tx=k=>{const r=tr(k);if(!r)return'';return [r.querySelector('.seb-bh-comment')?.value,r.querySelector('.seb-bh-detail')?.textContent].map(x=>String(x||'').trim()).filter(Boolean).join(' ')};return sebV6Generate(lv,tx,sebV6Identity(c||{}))};


// SEB_HISTORY_NATURAL_SYNTHESIS_V7

const SEB_V7_GROUPS={
 fabrication:['fabrication-plan','fabrication-tracage','fabrication-decoupe','fabrication-assemblage','fabrication-finition'],
 briques:['briques-identification','briques-manipulation'],
 organisation:['carre','organisation','planning'],
 tri:['tri-temps','tri-erreurs'],
 numerique:['texte','mail'],
 expression:['expression'],
 maths:['math-enonce','math-problemes']
};
const SEB_V7_LABELS={
 'fabrication-plan':'la lecture et la compréhension du plan',
 'fabrication-tracage':'le traçage et le repérage',
 'fabrication-decoupe':'la découpe',
 'fabrication-assemblage':'le pliage et l’assemblage',
 'fabrication-finition':'les finitions',
 'briques-identification':'la lecture du schéma',
 'briques-manipulation':'la manipulation et l’assemblage',
 'carre':'le raisonnement',
 'organisation':'l’organisation de plusieurs informations',
 'planning':'la planification',
 'tri-temps':'le rythme du tri',
 'tri-erreurs':'la fiabilité du tri',
 'texte':'le traitement de texte',
 'mail':'la messagerie électronique',
 'expression':'l’expression écrite',
 'math-enonce':'la compréhension des consignes mathématiques',
 'math-problemes':'les calculs et la résolution de problèmes'
};
function sebV7Identity(c){c=c||{};const cv=String(c.civilite||''),n=String(c.nom||'').trim().toUpperCase();if(cv==='M.')return{lead:n?'M. '+n:'La personne',subject:'Il'};if(cv==='Mme')return{lead:n?'Mme '+n:'La personne',subject:'Elle'};if(cv==='Autre')return{lead:n||'La personne',subject:'Iel'};return{lead:'La personne',subject:'La personne'}}
function sebV7Cap(s){s=String(s||'').trim();return s?s.charAt(0).toUpperCase()+s.slice(1):s}
function sebV7Lower(s){s=String(s||'').trim();return s?s.charAt(0).toLowerCase()+s.slice(1):s}
function sebV7Join(a){a=a.filter(Boolean);if(!a.length)return'';if(a.length===1)return a[0];if(a.length===2)return a[0]+' et '+a[1];return a.slice(0,-1).join(', ')+' et '+a[a.length-1]}
function sebV7Single(v){const s=String(v||'').replace(/\r\n/g,'\n').trim();if(!s)return'';const out=[],seen=new Set;for(const p of s.split(/\n\s*\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean)){const k=p.toLocaleLowerCase('fr-FR');if(seen.has(k))continue;seen.add(k);out.push(p)}return out.join('\n\n')}
function sebV7Raw(v){return String(v||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim()}
function sebV7Clean(v){let s=sebV7Raw(v);s=s.replace(/^(?:NE|I{1,3}|IV)\s*[.\-:;]\s*/i,'');s=s.replace(/\s+([,.;:!?])/g,'$1');s=s.replace(/\s*[-—]\s*\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\s*(?:point\(s\)|points?|réponses? correctes?)?(?:\s*\([^)]*\))?.*$/i,'');s=s.replace(/\s*[-—]\s*\d+\s*erreur\(s\).*$/i,'');s=s.replace(/[.;]\s*$/,'').trim();if(/^(?:exercice abandonné|non évalué|non evalue|choisissez|aucun commentaire)$/i.test(s))return'';return s}
function sebV7Metric(raw,label){const src=sebV7Raw(raw),needle=String(label||''),i=src.toLocaleLowerCase('fr-FR').indexOf(needle.toLocaleLowerCase('fr-FR'));if(i<0)return null;const m=src.slice(i+needle.length).match(/^\s*:\s*(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/);if(!m)return null;const a=parseFloat(m[1].replace(',','.')),b=parseFloat(m[2].replace(',','.'));return Number.isFinite(a)&&Number.isFinite(b)&&b>0?a/b:null}
function sebV7Result(raw,label){
 const src=sebV7Raw(raw);if(!src||/exercice abandonné|non évalué|non evalue/i.test(src))return'';
 const pct=src.match(/(\d+(?:[.,]\d+)?)\s*%/);
 const score=src.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(?:point\(s\)|points?|réponses? correctes?)?/i);
 const fmt=v=>String(v).replace('.',',');
 if(score){
  const a=parseFloat(score[1].replace(',','.')),b=parseFloat(score[2].replace(',','.'));
  const p=pct?pct[1]:(Number.isFinite(a)&&Number.isFinite(b)&&b>0?String(Math.round(a/b*100)):null);
  return sebV7Cap(label)+' : '+fmt(score[1])+' / '+fmt(score[2])+(p?' ('+fmt(p)+' % de réussite).':'.');
 }
 if(pct)return sebV7Cap(label)+' : '+fmt(pct[1])+' % de réussite.';
 const err=src.match(/(?:-|—)?\s*(\d+)\s*erreur(?:\(s\)|s)?/i);
 if(err)return sebV7Cap(label)+' : '+err[1]+' erreur'+(err[1]==='1'?'':'s')+'.';
 return'';
}
function sebV7Results(keys,text,max){
 const out=[];for(const k of keys){const r=sebV7Result(text(k),SEB_V7_LABELS[k]||k);if(r&&!out.includes(r))out.push(r);if(out.length>=(max||2))break}return out;
}
function sebV7Subject(id){return id&&id.subject?id.subject:'La personne'}
function sebV7Sentence(s){s=String(s||'').replace(/\s+/g,' ').trim();if(!s)return'';s=sebV7Cap(s);return /[.!?]$/.test(s)?s:s+'.'}
function sebV7GenericInsight(raw,id){let s=sebV7Clean(raw);if(!s||s.length<12||s.length>220)return'';const sub=sebV7Subject(id);if(/^la personne\b/i.test(s)){if(sub!=='La personne')s=s.replace(/^la personne\b/i,sub);return sebV7Sentence(s)}if(/^(?:il|elle|iel)\b/i.test(s))return sebV7Sentence(s);if(/^(?:a besoin|a des difficultés|réalise|comprend|ne sait|rencontre|présente|utilise|effectue|parvient|commet|oublie|identifie|respecte|demande|semble|fait)\b/i.test(s))return sebV7Sentence(sub+' '+sebV7Lower(s));if(/^(?:le|la|les|l’|l')\b/i.test(s))return sebV7Sentence(s);return''}
function sebV7Insights(key,raw,id){const src=sebV7Raw(raw),low=src.toLocaleLowerCase('fr-FR'),out=[];const push=x=>{x=sebV7Sentence(x);if(x&&!out.includes(x))out.push(x)};
 if(key==='fabrication-decoupe'){
  if(/découp.*(?:pas droites?|non droites?|incompl)/i.test(src))push('La découpe manque encore de régularité et certaines réalisations restent incomplètes');
  if(/cutter|contre[- ]sens|sens de découpe/i.test(src))push('L’utilisation de l’outil de découpe demande encore à être sécurisée');
 }
 if(key==='fabrication-tracage'&&/(?:pas aux dimensions|dimensions? indiquées?|dimension)/i.test(src))push('Le traçage reste lisible, mais les dimensions demandent davantage de contrôle');
 if(SEB_V7_GROUPS.fabrication.includes(key)&&/n['’]a pas besoin d['’]aide|sans aide/i.test(src))push('L’entrée dans l’exercice se fait sans aide');
 if(SEB_V7_GROUPS.briques.includes(key)&&/n['’]a pas besoin d['’]aide|sans aide/i.test(src))push('L’entrée dans l’activité se fait sans aide');
 if(key==='carre'&&/difficult.*(?:identifier|contrainte|relation)|contraintes?.*relations?/i.test(src))push('L’identification des contraintes et la mise en relation des éléments du problème restent difficiles');
 if(key==='organisation'&&/(?:nombreuses erreurs|beaucoup d['’]erreurs|accompagnement)/i.test(src))push('L’organisation de plusieurs critères génère encore de nombreuses erreurs et nécessite un accompagnement');
 if(key==='planning'&&/contraintes?.*(?:oubli|erreur)|(?:oubli|erreur).*contraintes?/i.test(src))push('La prise en compte simultanée des contraintes doit encore être vérifiée');
 if(key==='tri-erreurs'&&/fiabilit[eé].*satisfaisante/i.test(src)){}else if(SEB_V7_GROUPS.tri.includes(key)&&/(?:fatigue|douleur|gêne)/i.test(src))push('Une fatigue ou une gêne a été observée au cours de cette activité');
 if(key==='texte'){
  if(/ne sait pas utiliser.*traitement de texte|traitement de texte.*(?:non maîtris|diffic)/i.test(src))push('Le traitement de texte n’est pas encore maîtrisé et nécessite un accompagnement rapproché');
  else if(/a besoin d['’]aide|accompagnement/i.test(src))push('Certaines fonctions du traitement de texte nécessitent encore une aide');
 }
 if(key==='mail'){
  if(/a besoin d['’]aide.*(?:envoyer|message)|(?:envoyer|message).*a besoin d['’]aide/i.test(src))push('L’envoi d’un message nécessite encore une aide, et certaines consignes peuvent être oubliées');
  else if(/oubli.*consigne/i.test(src))push('Certaines consignes restent à sécuriser lors de l’utilisation de la messagerie');
 }
 if(key==='expression'){
  if(/structure des phrases.*(?:correct|satisf)|idées? présentées? de manière ordonnée/i.test(src))push('La structuration des phrases et l’organisation des idées sont satisfaisantes');
  const trou=sebV7Metric(src,'Texte à trous'),par=sebV7Metric(src,'Paronymes'),gn=sebV7Metric(src,'Genre / Nombre'),dic=sebV7Metric(src,'Dictée');
  if(par!==null&&par>=.8)push('Le travail sur les paronymes constitue un point d’appui');
  if(gn!==null&&gn>=.7)push('Les accords de genre et de nombre sont globalement acquis');
  if(trou!==null&&trou<.5)push('Les automatismes de langue évalués dans le texte à trous restent fragiles');
  if(dic!==null&&dic<.5)push('L’orthographe en situation de dictée reste plus fragile');
 }
 if(key==='math-enonce'&&/comprend et exécute une consigne unique|consigne unique/i.test(src))push('La compréhension et l’exécution d’une consigne simple sont acquises');
 if(key==='math-problemes'&&/(?:erreurs?|difficult)/i.test(src)&&!/non évalu/i.test(src))push('La résolution des problèmes demande encore de la méthode et des vérifications');
 if(!out.length){const g=sebV7GenericInsight(src,id);if(g)push(g)}
 return out;
}
function sebV7GroupInsights(keys,text,id,max){const out=[],seen=new Set;for(const k of keys){for(const x of sebV7Insights(k,text(k),id)){const z=x.toLocaleLowerCase('fr-FR').replace(/[^a-zà-ÿ0-9]+/g,' ').trim();if(seen.has(z))continue;seen.add(z);out.push(x);if(out.length>=(max||2))return out}}return out}
function sebV7Split(level,keys){const r={I:[],II:[],III:[],NE:[]};for(const k of keys){const l=String(level(k)||'');if(r[l])r[l].push(SEB_V7_LABELS[k])}return r}
function sebV7Score(level,keys){const v=keys.map(k=>String(level(k)||'')).filter(x=>['I','II','III'].includes(x)).map(x=>x==='I'?3:x==='II'?2:1);return v.length?v.reduce((a,b)=>a+b,0)/v.length:0}
function sebV7Generate(level,text,id){
 id=id||{lead:'La personne',subject:'La personne'};const L=k=>String(level(k)||''),T=k=>String(text(k)||''),all=Object.values(SEB_V7_GROUPS).flat(),ev=all.filter(k=>['I','II','III'].includes(L(k))),nII=ev.filter(k=>L(k)==='II').length,nIII=ev.filter(k=>L(k)==='III').length,nNE=all.filter(k=>L(k)==='NE').length,p=[];
 let intro=id.lead+' a participé aux différentes mises en situation proposées au cours du plateau technique. ';if(!ev.length)intro+='Les éléments actuellement renseignés ne permettent pas encore de dégager une lecture globale du parcours.';else if(nIII===0&&nII<=Math.max(2,Math.floor(ev.length/3)))intro+='Les observations recueillies font ressortir des acquis globalement solides, avec quelques points qui restent à consolider.';else if(nIII<=2)intro+='Le parcours met en évidence plusieurs points d’appui, associés à des besoins d’accompagnement plus marqués dans certaines situations.';else intro+='Le parcours met en évidence des compétences mobilisables dans plusieurs domaines, mais aussi des difficultés qui limitent encore l’autonomie sur certaines tâches.';p.push(intro);
 const f=sebV7Split(level,SEB_V7_GROUPS.fabrication);if(f.I.length||f.II.length||f.III.length||f.NE.length){let s='Dans les activités de fabrication, ';if(f.I.length>=3)s+='plusieurs acquis sont bien installés. '+sebV7Cap(sebV7Join(f.I))+' constituent des points d’appui dans la réalisation. ';else if(f.I.length)s+=sebV7Cap(sebV7Join(f.I))+' '+(f.I.length>1?'sont maîtrisés':'est maîtrisée')+'. ';if(f.II.length)s+=sebV7Cap(sebV7Join(f.II))+' '+(f.II.length>1?'demandent':'demande')+' encore davantage de contrôle et de précision. ';if(f.III.length)s+=sebV7Cap(sebV7Join(f.III))+' '+(f.III.length>1?'nécessitent':'nécessite')+' un accompagnement plus soutenu ou une méthode plus structurée. ';if(f.NE.length)s+='Les éléments non évalués ne sont pas interprétés. ';const e=sebV7GroupInsights(SEB_V7_GROUPS.fabrication,text,id,2);if(e.length)s+=e.join(' ');const r=sebV7Results(SEB_V7_GROUPS.fabrication,text,2);if(r.length)s+=' '+r.join(' ');p.push(s.trim())}
 const b=sebV7Split(level,SEB_V7_GROUPS.briques);if(b.I.length||b.II.length||b.III.length||b.NE.length){let s='La construction à base de briques apporte un éclairage complémentaire sur les capacités visuo-constructives. ';if(b.I.length===2)s+=sebV7Subject(id)+' comprend le schéma proposé et réalise l’assemblage avec une autonomie satisfaisante. ';else{if(b.I.length)s+=sebV7Cap(sebV7Join(b.I))+' constitue'+(b.I.length>1?'nt':'')+' un point d’appui. ';if(b.II.length)s+=sebV7Cap(sebV7Join(b.II))+' demande'+(b.II.length>1?'nt':'')+' encore quelques repères ou vérifications. ';if(b.III.length)s+=sebV7Cap(sebV7Join(b.III))+' nécessite'+(b.III.length>1?'nt':'')+' un accompagnement plus important. ';if(b.NE.length)s+='Une partie de cette activité n’a pas pu être appréciée. '}const e=sebV7GroupInsights(SEB_V7_GROUPS.briques,text,id,1);if(e.length)s+=e[0];const r=sebV7Results(SEB_V7_GROUPS.briques,text,2);if(r.length)s+=' '+r.join(' ');p.push(s.trim())}
 const ca=L('carre'),og=L('organisation'),pl=L('planning');if([ca,og,pl].some(x=>['I','II','III','NE'].includes(x))){let s='Les exercices de raisonnement, d’organisation et de planification permettent d’apprécier la manière dont '+(sebV7Subject(id)==='La personne'?'la personne':sebV7Subject(id).toLowerCase())+' traite plusieurs informations ou contraintes. ';if(ca==='I')s+='Le raisonnement sur une situation structurée est correctement mobilisé. ';else if(ca==='II')s+='Le raisonnement est accessible, mais la démarche gagne à être organisée et vérifiée. ';else if(ca==='III')s+='La résolution d’un problème structuré reste difficile et nécessite une méthode plus explicite. ';if(og==='I')s+='L’organisation d’une tâche comportant plusieurs critères est correctement appréhendée. ';else if(og==='II')s+='L’organisation de plusieurs informations est comprise, avec encore un besoin de vérification. ';else if(og==='III')s+='L’organisation de plusieurs informations constitue un point de fragilité plus marqué. ';if(pl==='I')s+='La planification constitue en revanche un point d’appui lorsque le cadre et les contraintes sont clairement identifiés. ';else if(pl==='II')s+='La planification est globalement comprise, malgré quelques erreurs dans la prise en compte des contraintes. ';else if(pl==='III')s+='La planification nécessite encore un accompagnement pour hiérarchiser les actions et maintenir un ordre cohérent. ';const e=sebV7GroupInsights(SEB_V7_GROUPS.organisation,text,id,2);if(e.length)s+=e.join(' ');const r=sebV7Results(SEB_V7_GROUPS.organisation,text,2);if(r.length)s+=' '+r.join(' ');p.push(s.trim())}
 const tt=L('tri-temps'),te=L('tri-erreurs');if([tt,te].some(x=>['I','II','III'].includes(x))){let s='Lors de l’activité de tri, ';if(tt==='I'&&te==='I')s+='le rythme de réalisation et la fiabilité sont satisfaisants. La tâche est menée avec régularité et le contrôle du travail reste adapté.';else if(te==='I'&&(tt==='II'||tt==='III'))s+='la réalisation reste fiable, mais le rythme est plus lent. La précision constitue un point d’appui alors que la vitesse d’exécution reste à renforcer.';else if(tt==='I'&&(te==='II'||te==='III'))s+='le rythme est adapté, mais la fiabilité demande davantage d’attention. Une vérification plus systématique permettrait de réduire les erreurs.';else s+='le rythme et la fiabilité restent à consolider afin de trouver un meilleur équilibre entre vitesse d’exécution et contrôle.';const e=sebV7GroupInsights(SEB_V7_GROUPS.tri,text,id,1);if(e.length&&!/fiabilité sont satisfaisants/i.test(s))s+=' '+e[0];const r=sebV7Results(SEB_V7_GROUPS.tri,text,2);if(r.length)s+=' '+r.join(' ');p.push(s.trim())}
 const tx=L('texte'),ma=L('mail');if([tx,ma].some(x=>['I','II','III','NE'].includes(x))){let s='Concernant les outils numériques, ';if(tx==='I')s+='le traitement de texte est utilisé avec une autonomie satisfaisante. ';else if(tx==='II')s+='le traitement de texte est accessible pour les tâches courantes, mais certaines fonctions demandent encore des repères. ';else if(tx==='III')s+='le traitement de texte constitue un point de difficulté et nécessite un accompagnement pour mobiliser les fonctions demandées. ';else if(tx==='NE')s+='le traitement de texte n’a pas pu être évalué. ';if(ma==='I')s+='La messagerie électronique est maîtrisée dans les situations proposées. ';else if(ma==='II')s+='La messagerie électronique est globalement comprise, avec encore quelques vérifications utiles pour sécuriser les différentes étapes. ';else if(ma==='III')s+='La messagerie électronique reste difficile à utiliser de manière autonome. ';else if(ma==='NE')s+='La messagerie électronique n’a pas pu être évaluée. ';const e=sebV7GroupInsights(SEB_V7_GROUPS.numerique,text,id,2);if(e.length)s+=e.join(' ');const r=sebV7Results(SEB_V7_GROUPS.numerique,text,2);if(r.length)s+=' '+r.join(' ');p.push(s.trim())}
 const ex=L('expression');if(['I','II','III','NE'].includes(ex)){let s='En expression écrite, ';if(ex==='I')s+='les compétences mobilisées dans les exercices proposés sont satisfaisantes. ';else if(ex==='II')s+='les acquis sont présents, mais restent hétérogènes et demandent encore à être consolidés. ';else if(ex==='III')s+='des difficultés persistent dans la structuration de l’écrit ou la maîtrise des règles de base, ce qui justifie un accompagnement plus soutenu. ';else s+='les éléments disponibles ne permettent pas de conclure. ';const e=sebV7GroupInsights(SEB_V7_GROUPS.expression,text,id,5);if(e.length)s+=e.join(' ');const r=sebV7Results(SEB_V7_GROUPS.expression,text,2);if(r.length)s+=' '+r.join(' ');p.push(s.trim())}
 const me=L('math-enonce'),mp=L('math-problemes');if([me,mp].some(x=>['I','II','III','NE'].includes(x))){let s='En mathématiques, ';if(me==='I')s+='la compréhension des consignes et des énoncés constitue un point d’appui. ';else if(me==='II')s+='la compréhension des consignes est globalement accessible, même si certaines informations doivent être reformulées ou vérifiées. ';else if(me==='III')s+='la compréhension des consignes reste difficile et peut freiner l’entrée dans la résolution. ';else if(me==='NE')s+='la compréhension des consignes n’a pas pu être appréciée. ';if(mp==='I')s+='Les calculs et la résolution de problèmes sont réalisés de manière satisfaisante. ';else if(mp==='II')s+='Les calculs et la résolution de problèmes sont accessibles, avec encore quelques erreurs ou imprécisions. ';else if(mp==='III')s+='La mise en œuvre des calculs et la résolution de problèmes nécessite un accompagnement plus soutenu. ';else if(mp==='NE')s+='La partie consacrée aux calculs et à la résolution de problèmes n’ayant pas été évaluée, aucune conclusion n’est formulée sur ce volet. ';const e=sebV7GroupInsights(SEB_V7_GROUPS.maths,text,id,1);if(e.length)s+=e[0];const r=sebV7Results(SEB_V7_GROUPS.maths,text,2);if(r.length)s+=' '+r.join(' ');p.push(s.trim())}
 const abandoned=all.filter(k=>L(k)==='NE'&&/exercice abandonné/i.test(T(k))).length;if(abandoned)p.push((abandoned===1?'Une activité a été interrompue au cours du parcours. ':'Plusieurs activités ont été interrompues au cours du parcours. ')+'Les compétences correspondantes ne sont pas interprétées dans cette synthèse.');else if(nNE>=3)p.push('Plusieurs éléments sont restés non évalués. Ils ne sont pas interprétés et limitent les conclusions dans les domaines concernés.');
 const strengths=[],needs=[];const add=(a,l,s)=>{if(l&&!a.some(x=>x.l===l))a.push({l,s})};
 if(sebV7Score(level,SEB_V7_GROUPS.fabrication)>=2.6)add(strengths,'les activités techniques de fabrication',3);
 if(L('briques-identification')==='I'&&L('briques-manipulation')==='I')add(strengths,'la lecture de schéma et la manipulation',3);
 if(tt==='I'&&te==='I')add(strengths,'le rythme et la fiabilité dans le tri',3);
 if(pl==='I')add(strengths,'la planification',2);
 if(me==='I')add(strengths,'la compréhension des consignes mathématiques',2);
 if(ex==='I')add(strengths,'l’expression écrite',2);
 const need=(k,l,s)=>{const v=L(k);if(v==='III')add(needs,l,s+2);else if(v==='II')add(needs,l,s)};
 need('fabrication-decoupe','la précision dans la découpe',1);need('fabrication-tracage','le contrôle du traçage',1);need('fabrication-finition','la qualité des finitions',1);need('carre','le raisonnement',3);need('organisation','l’organisation de plusieurs informations',3);need('planning','la planification',2);need('texte','le traitement de texte',4);need('mail','l’utilisation autonome de la messagerie',2);need('expression','certains aspects de l’expression écrite',2);if(mp!=='NE')need('math-problemes','les calculs et la résolution de problèmes',3);
 strengths.sort((a,b)=>b.s-a.s);needs.sort((a,b)=>b.s-a.s);let c='Dans l’ensemble, ';const ss=strengths.slice(0,4).map(x=>x.l),nn=needs.slice(0,4).map(x=>x.l);if(ss.length)c+='les principaux points d’appui concernent '+sebV7Join(ss)+'. ';else c+='les acquis restent variables selon les situations proposées. ';if(nn.length)c+='Les besoins d’accompagnement se situent davantage dans '+sebV7Join(nn)+'. ';else c+='Les domaines effectivement évalués ne font pas apparaître de fragilité majeure nécessitant un accompagnement renforcé. ';c+='Le ressenti du stagiaire, renseigné séparément, complète cette lecture du parcours.';p.push(c);
 return sebV7Single(p.filter(Boolean).join('\n\n'));
}

sebV4HistorySummary=function(card,c){const tr=k=>[...card.querySelectorAll('tbody tr')].find(x=>x.dataset?.key===k&&!x.classList.contains('seb-bh-section')),lv=k=>String(tr(k)?.querySelector('.seb-bh-level.on')?.dataset.level||''),tx=k=>{const r=tr(k);if(!r)return'';return [r.querySelector('.seb-bh-comment')?.value,r.querySelector('.seb-bh-detail')?.textContent].map(x=>String(x||'').trim()).filter(Boolean).join(' ')};return sebV9Style(sebV8Polish(sebV7Generate(lv,tx,sebV7Identity(c||{}))))};


// SEB_HISTORY_NATURAL_SYNTHESIS_V8

function sebV8Single(v){const s=String(v||'').replace(/\r\n/g,'\n').trim();if(!s)return'';const out=[],seen=new Set;for(const p of s.split(/\n\s*\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean)){const k=p.toLocaleLowerCase('fr-FR');if(seen.has(k))continue;seen.add(k);out.push(p)}return out.join('\n\n')}
function sebV8Polish(v){
 let s=sebV8Single(v);
 // Les observations déjà résumées par le domaine ne doivent pas être répétées comme une ligne de tableau.
 s=s.replace(/\s*L’entrée dans l’exercice se fait sans aide\./g,'');
 s=s.replace(/\s*L’entrée dans l’activité se fait sans aide\./g,'');
 s=s.replace(/\s*Les traits sont droits, le traçage est conforme aux spécificités du plan\./gi,'');
 s=s.replace(/le pliage et l’assemblage et les finitions/gi,'le pliage, l’assemblage et les finitions');

 // Fabrication : intégrer l’observation dans le constat au lieu de l’ajouter après.
 s=s.replace('La découpe demande encore davantage de contrôle et de précision. La découpe manque encore de régularité et certaines réalisations restent incomplètes.',
   'La découpe reste moins maîtrisée : elle manque encore de régularité et certaines réalisations restent incomplètes.');
 s=s.replace('La découpe demande encore davantage de contrôle et de précision.',
   'La découpe reste moins maîtrisée et demande encore davantage de contrôle et de précision.');
 s=s.replace('Le traçage et le repérage demandent encore davantage de contrôle et de précision. Le traçage reste lisible, mais les dimensions demandent davantage de contrôle.',
   'Le traçage reste lisible, mais le respect des dimensions demande encore davantage de contrôle.');

 // Raisonnement / organisation : l’observation précise le constat, elle ne le répète pas.
 if(s.includes('La résolution d’un problème structuré reste difficile et nécessite une méthode plus explicite.')&&s.includes('L’identification des contraintes et la mise en relation des éléments du problème restent difficiles.')){
  s=s.replace('La résolution d’un problème structuré reste difficile et nécessite une méthode plus explicite.',
    'La résolution d’un problème structuré reste difficile : l’identification des contraintes et la mise en relation des éléments nécessitent une méthode plus explicite.');
  s=s.replace(/\s*L’identification des contraintes et la mise en relation des éléments du problème restent difficiles\./,'');
 }
 if(s.includes('L’organisation de plusieurs informations constitue un point de fragilité plus marqué.')&&s.includes('L’organisation de plusieurs critères génère encore de nombreuses erreurs et nécessite un accompagnement.')){
  s=s.replace('L’organisation de plusieurs informations constitue un point de fragilité plus marqué.',
    'L’organisation de plusieurs informations constitue un point de fragilité plus marqué : la prise en compte de plusieurs critères génère encore de nombreuses erreurs et nécessite un accompagnement.');
  s=s.replace(/\s*L’organisation de plusieurs critères génère encore de nombreuses erreurs et nécessite un accompagnement\./,'');
 }

 // Numérique : fusionner niveau et commentaire concret dans une seule idée.
 if(s.includes('le traitement de texte constitue un point de difficulté et nécessite un accompagnement pour mobiliser les fonctions demandées.')&&s.includes('Le traitement de texte n’est pas encore maîtrisé et nécessite un accompagnement rapproché.')){
  s=s.replace('le traitement de texte constitue un point de difficulté et nécessite un accompagnement pour mobiliser les fonctions demandées.',
    'le traitement de texte reste difficile et nécessite un accompagnement rapproché pour mobiliser les fonctions demandées.');
  s=s.replace(/\s*Le traitement de texte n’est pas encore maîtrisé et nécessite un accompagnement rapproché\./,'');
 }
 if(s.includes('le traitement de texte est accessible pour les tâches courantes, mais certaines fonctions demandent encore des repères.')&&s.includes('Certaines fonctions du traitement de texte nécessitent encore une aide.')){
  s=s.replace('le traitement de texte est accessible pour les tâches courantes, mais certaines fonctions demandent encore des repères.',
    'le traitement de texte est accessible pour les tâches courantes, mais certaines fonctions nécessitent encore une aide ou des repères.');
  s=s.replace(/\s*Certaines fonctions du traitement de texte nécessitent encore une aide\./,'');
 }
 if(s.includes('La messagerie électronique est globalement comprise, avec encore quelques vérifications utiles pour sécuriser les différentes étapes.')&&s.includes('L’envoi d’un message nécessite encore une aide, et certaines consignes peuvent être oubliées.')){
  s=s.replace('La messagerie électronique est globalement comprise, avec encore quelques vérifications utiles pour sécuriser les différentes étapes.',
    'La messagerie électronique est mieux appréhendée, mais l’envoi d’un message demande encore une aide et certaines consignes peuvent être oubliées.');
  s=s.replace(/\s*L’envoi d’un message nécessite encore une aide, et certaines consignes peuvent être oubliées\./,'');
 }
 if(s.includes('La messagerie électronique reste difficile à utiliser de manière autonome.')&&s.includes('L’envoi d’un message nécessite encore une aide, et certaines consignes peuvent être oubliées.')){
  s=s.replace('La messagerie électronique reste difficile à utiliser de manière autonome.',
    'La messagerie électronique reste difficile à utiliser de manière autonome : l’envoi d’un message demande encore une aide et certaines consignes peuvent être oubliées.');
  s=s.replace(/\s*L’envoi d’un message nécessite encore une aide, et certaines consignes peuvent être oubliées\./,'');
 }

 // Mathématiques : ne pas redire deux fois que la compréhension d’une consigne est acquise.
 if(s.includes('En mathématiques, la compréhension des consignes et des énoncés constitue un point d’appui.')&&s.includes('La compréhension et l’exécution d’une consigne simple sont acquises.')){
  s=s.replace('En mathématiques, la compréhension des consignes et des énoncés constitue un point d’appui.',
    'En mathématiques, la compréhension et l’exécution d’une consigne simple constituent un point d’appui.');
  s=s.replace(/\s*La compréhension et l’exécution d’une consigne simple sont acquises\./,'');
 }

 // Nettoyage final : espaces et éventuels doublons de paragraphes.
 s=s.replace(/[ \t]{2,}/g,' ').replace(/ +\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
 return sebV8Single(s);
}



// SEB_HISTORY_NATURAL_SYNTHESIS_V9

function sebV9Cap(s){s=String(s||'').trim();return s?s.charAt(0).toUpperCase()+s.slice(1):s}
function sebV9Single(v){const s=String(v||'').replace(/\r\n/g,'\n').trim();if(!s)return'';const out=[],seen=new Set;for(const p of s.split(/\n\s*\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean)){const k=p.toLocaleLowerCase('fr-FR');if(seen.has(k))continue;seen.add(k);out.push(p)}return out.join('\n\n')}
function sebV9BreakLongSentences(v){
 const paras=String(v||'').split(/\n\n+/);
 return paras.map(p=>{
  const sentences=p.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[p];
  const out=[];
  for(let sentence of sentences){
   sentence=sentence.trim();
   if(sentence.length>190&&sentence.includes(': ')){
    const i=sentence.indexOf(': '),a=sentence.slice(0,i).trim(),b=sentence.slice(i+2).trim();
    if(a.length>45&&b.length>45){out.push((/[.!?]$/.test(a)?a:a+'.'));out.push(sebV9Cap(b));continue}
   }
   if(sentence.length>190&&sentence.includes(', mais ')){
    const i=sentence.indexOf(', mais '),a=sentence.slice(0,i).trim(),b=sentence.slice(i+7).trim();
    if(a.length>45&&b.length>45){out.push((/[.!?]$/.test(a)?a:a+'.'));out.push('Cependant, '+b);continue}
   }
   out.push(sentence);
  }
  return out.join(' ');
 }).join('\n\n');
}
function sebV9Style(v){
 let s=sebV9Single(v);

 // Introduction : phrase plus courte et formulation moins catégorique.
 s=s.replace('Le parcours met en évidence des compétences mobilisables dans plusieurs domaines, mais aussi des difficultés qui limitent encore l’autonomie sur certaines tâches.',
   'Le parcours met en évidence des compétences mobilisables dans plusieurs domaines. Des difficultés persistent toutefois et nécessitent encore un accompagnement dans certaines situations.');

 // Fabrication : éviter une longue énumération chargée de « et ».
 s=s.replace('La lecture et la compréhension du plan, le traçage et le repérage, le pliage, l’assemblage et les finitions constituent des points d’appui dans la réalisation.',
   'La lecture du plan est bien maîtrisée. Le traçage et le repérage sont satisfaisants. Le pliage, l’assemblage et les finitions constituent également des points d’appui.');
 s=s.replace('La lecture et la compréhension du plan, le traçage et le repérage, le pliage et l’assemblage et les finitions constituent des points d’appui dans la réalisation.',
   'La lecture du plan est bien maîtrisée. Le traçage et le repérage sont satisfaisants. Le pliage, l’assemblage et les finitions constituent également des points d’appui.');

 // Raisonnement / organisation : une idée principale par phrase.
 s=s.replace('La résolution d’un problème structuré reste difficile : l’identification des contraintes et la mise en relation des éléments nécessitent une méthode plus explicite.',
   'La résolution d’un problème structuré reste difficile. L’identification des contraintes demande encore des repères. La mise en relation des différents éléments nécessite une méthode plus explicite.');
 s=s.replace('L’organisation de plusieurs informations constitue un point de fragilité plus marqué : la prise en compte de plusieurs critères génère encore de nombreuses erreurs et nécessite un accompagnement.',
   'L’organisation de plusieurs informations reste fragile. La prise en compte simultanée de plusieurs critères génère encore de nombreuses erreurs. Un accompagnement reste nécessaire dans ce type de situation.');

 // Expression écrite : alléger les phrases à deux constats.
 s=s.replace('En expression écrite, les acquis sont présents, mais restent hétérogènes et demandent encore à être consolidés.',
   'En expression écrite, les acquis sont présents mais restent hétérogènes. Certains éléments demandent encore à être consolidés.');
 s=s.replace('L’orthographe en situation de dictée reste plus fragile.','L’orthographe en situation de dictée reste fragile.');

 // Conclusion : répartir les listes sur plusieurs phrases et supprimer les chaînes de « et ».
 s=s.replace('Dans l’ensemble, les principaux points d’appui concernent les activités techniques de fabrication, la lecture de schéma et la manipulation, le rythme et la fiabilité dans le tri et la planification.',
   'Dans l’ensemble, les activités techniques de fabrication constituent un point d’appui important. La lecture de schéma et la manipulation sont également bien maîtrisées. Le rythme de travail, la fiabilité du tri et la planification complètent ces acquis.');
 s=s.replace('Les besoins d’accompagnement se situent davantage dans le traitement de texte, le raisonnement, l’organisation de plusieurs informations et l’utilisation autonome de la messagerie.',
   'Les besoins d’accompagnement concernent principalement le traitement de texte et le raisonnement. L’organisation de plusieurs informations reste également à consolider. L’utilisation autonome de la messagerie demande encore des repères.');

 s=sebV9BreakLongSentences(s);
 s=s.replace(/[ \t]{2,}/g,' ').replace(/ +\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
 return sebV9Single(s);
}



// SEB_HISTORY_SEB_IA_V1
const sebIaHistoryEngine=require('./seb-ia-engine');
function sebIaHistoryRows(card){
  return Object.keys(sebIaHistoryEngine.META).map((key)=>{
    const row=[...card.querySelectorAll('tbody tr')].find((x)=>x.dataset?.key===key&&!x.classList.contains('seb-bh-section'));
    if(!row)return{key,level:'',comment:'',detail:'',moduleText:''};
    return{
      key,
      level:String(row.querySelector('.seb-bh-level.on')?.dataset.level||''),
      comment:String(row.querySelector('.seb-bh-comment')?.value||'').trim(),
      detail:String(row.querySelector('.seb-bh-detail')?.textContent||'').trim(),
      moduleText:String(row.querySelector('td')?.innerText||row.querySelector('td')?.textContent||'').trim()
    };
  });
}
sebV4HistorySummary=function(card,candidate){
  const result=sebIaHistoryEngine.generate({candidate:candidate||{},rows:sebIaHistoryRows(card)});
  return result&&result.ok?result.text:'';
};
