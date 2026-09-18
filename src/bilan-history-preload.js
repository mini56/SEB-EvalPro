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
  return {
    nom: textOf(document.getElementById('nom')),
    prenom: textOf(document.getElementById('prenom')),
    date: textOf(document.getElementById('date')),
    lieu: '',
    groupe: ''
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
    const result = await ipcRenderer.invoke('bilan-history:save-current', {
      candidate: candidateFromPage(),
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
    .seb-bh-meta{display:flex;gap:24px;flex-wrap:wrap;margin:0 0 10px;font-size:14px}.seb-bh-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:13px}.seb-bh-table th,.seb-bh-table td{border:1px solid #000;padding:5px;vertical-align:top}.seb-bh-table th{background:#0070c0;color:#fff}.seb-bh-table th:nth-child(2){background:#ccffff;color:#000}.seb-bh-table th:nth-child(3){background:#92d050;color:#000}.seb-bh-table th:nth-child(4){background:#ed7d31}.seb-bh-table th:nth-child(5){background:#c00000}.seb-bh-section td{background:#9cc2e5;font-weight:700}.seb-bh-module{white-space:pre-line}.seb-bh-level{text-align:center;cursor:pointer;height:42px;user-select:none}.seb-bh-level.on[data-level="NE"]{background:#ccffff}.seb-bh-level.on[data-level="I"]{background:#92d050}.seb-bh-level.on[data-level="II"]{background:#ed7d31;color:#fff}.seb-bh-level.on[data-level="III"]{background:#c00000;color:#fff}.seb-bh-level.on:after{content:attr(data-level);font-weight:700;font-size:16px}.seb-bh-select,.seb-bh-comment{width:100%;font:inherit}.seb-bh-select{margin-bottom:5px}.seb-bh-comment{min-height:55px;resize:vertical;padding:5px}.seb-bh-detail{font-size:12px;color:#555;white-space:pre-line;margin-top:4px}.seb-bh-editor-foot{display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid #ddd;background:#f8f8f8}.seb-bh-editor-foot .info{flex:1;font-size:13px;color:#555}.seb-bh-editor-foot button{font:700 14px Arial,sans-serif;padding:8px 14px;border:1px solid #999;border-radius:5px;background:#f2f2f2;cursor:pointer}.seb-bh-editor-foot .primary{background:#0070c0;color:#fff;border-color:#0070c0}
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
  observer.observe(document.documentElement, { childList: true, subtree: true });
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
  overlay.innerHTML = `<div class="seb-bh-card"><div class="seb-bh-head"><div class="seb-bh-title">Ouvrir un ancien bilan</div><div class="seb-bh-badge">ARCHIVE ÉDITABLE</div></div><div class="seb-bh-body"><div class="seb-bh-path">Documents\\SEB EvalPro\\Bilans\\Historique</div><div id="seb-bh-list">Chargement…</div></div><div class="seb-bh-actions"><button type="button" id="seb-bh-close">Fermer</button></div></div>`;
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
  return { title:'Bilan institutionnel', note:String(editor.dataset.note || ''), headers:['Modules','NE','I','II','III','Commentaires'], rows };
}

function openEditor(filename, archive) {
  const existing = document.getElementById('seb-bilan-history-editor');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'seb-bilan-history-editor';
  const candidate = archive.candidate || {};
  overlay.innerHTML = `<div class="seb-bh-editor-card"><div class="seb-bh-editor-head"><strong>Ancien bilan — ${escapeHtml(candidateLabel(candidate))}</strong><span class="seb-bh-badge">Build #${escapeHtml(archive.originalBuild || '?')}</span><span class="seb-bh-warning">MODIFICATION = NOUVELLE RÉVISION</span></div><div class="seb-bh-editor-body"><div class="seb-bh-meta"><span><b>Nom :</b> ${escapeHtml(candidate.nom || '')}</span><span><b>Prénom :</b> ${escapeHtml(candidate.prenom || '')}</span><span><b>Date :</b> ${escapeHtml(candidate.date || '')}</span><span><b>Version :</b> ${archive.revision === 0 ? 'Original' : `Révision ${archive.revision}`}</span></div><table class="seb-bh-table"><colgroup><col style="width:39%"><col style="width:5.6%"><col style="width:5.6%"><col style="width:5.6%"><col style="width:5.6%"><col style="width:38.6%"></colgroup><thead><tr><th>Modules</th><th>NE</th><th>I</th><th>II</th><th>III</th><th>Commentaires</th></tr></thead><tbody></tbody></table></div><div class="seb-bh-editor-foot"><div class="info" id="seb-bh-editor-info">Archive autonome · le bilan d'origine n'est jamais écrasé.</div><button type="button" id="seb-bh-export">Exporter Word</button><button type="button" id="seb-bh-save-revision" class="primary">Enregistrer une nouvelle révision</button><button type="button" id="seb-bh-editor-close">Fermer</button></div></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector('.seb-bh-editor-card');
  card.dataset.note = String((archive.document && archive.document.note) || '');
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
      select.addEventListener('change', () => { const chosen = select.options[select.selectedIndex]; const level = chosen && chosen.dataset.level; if (level && ['NE','I','II','III'].includes(level)) { tr.querySelectorAll('.seb-bh-level').forEach((cell) => cell.classList.toggle('on', cell.dataset.level === level)); } });
      comments.appendChild(select);
    }
    const textarea = document.createElement('textarea'); textarea.className = 'seb-bh-comment'; textarea.value = row.comment || ''; comments.appendChild(textarea);
    if (row.detail) { const detail = document.createElement('div'); detail.className = 'seb-bh-detail'; detail.textContent = row.detail; comments.appendChild(detail); }
    tr.appendChild(comments); tbody.appendChild(tr);
  });

  let currentFilename = filename;
  overlay.querySelector('#seb-bh-editor-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#seb-bh-save-revision').addEventListener('click', async () => {
    const info = overlay.querySelector('#seb-bh-editor-info');
    info.textContent = 'Enregistrement de la nouvelle révision…';
    const result = await ipcRenderer.invoke('bilan-history:save-revision', { sourceFilename: currentFilename, document: buildEditorDocument(card) });
    if (result && result.ok) {
      currentFilename = result.filename || currentFilename;
      info.textContent = result.unchanged ? `Aucune modification : révision ${result.revision} inchangée.` : `Révision ${result.revision} enregistrée. L'ancienne version est conservée.`;
    } else info.textContent = `Erreur : ${(result && result.error) || 'enregistrement impossible'}`;
  });
  overlay.querySelector('#seb-bh-export').addEventListener('click', () => exportHistoricalWord(card, candidate, archive.originalBuild));
}

function exportHistoricalWord(card, candidate, originalBuild) {
  const doc = buildEditorDocument(card);
  const rows = doc.rows.map((row) => {
    if (row.kind === 'section') return `<tr><td colspan="6" style="background:#9cc2e5;font-weight:bold">${escapeHtml(row.sectionText)}</td></tr>`;
    const levels = ['NE','I','II','III'].map((level) => `<td style="text-align:center;font-weight:bold">${row.level === level ? level : ''}</td>`).join('');
    const comments = [row.preset, row.comment, row.detail].filter(Boolean).map(escapeHtml).join('<br>');
    return `<tr><td style="white-space:pre-line">${escapeHtml(row.moduleText)}</td>${levels}<td>${comments}</td></tr>`;
  }).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:10mm}body{font-family:Calibri,Arial,sans-serif;font-size:10pt}table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:5px;vertical-align:top}th{background:#0070c0;color:#fff}</style></head><body><h2>Bilan institutionnel</h2><p><b>Nom :</b> ${escapeHtml(candidate.nom || '')} &nbsp; <b>Prénom :</b> ${escapeHtml(candidate.prenom || '')} &nbsp; <b>Date :</b> ${escapeHtml(candidate.date || '')} &nbsp; <b>Build d'origine :</b> #${escapeHtml(originalBuild || '?')}</p><table><thead><tr><th>Modules</th><th>NE</th><th>I</th><th>II</th><th>III</th><th>Commentaires</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const blob = new Blob([html], { type:'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = (v) => String(v || '').replace(/[^A-Za-z0-9À-ÿ_-]+/g, '_').replace(/^_+|_+$/g, '');
  a.href = url; a.download = `Bilan_${safe(candidate.nom || 'NOM')}_${safe(candidate.prenom || 'PRENOM')}_${safe(candidate.date || '')}.doc`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function install() {
  if (installed) return;
  installed = true;
  addStyle();
  installAdminButton();
  installBilanSaveHook();
}

module.exports = { install };
