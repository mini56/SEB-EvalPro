(function(){
  'use strict';
  const page = decodeURIComponent((location.pathname.split('/').pop() || '').toLowerCase());
  const KEY = 'seb_evalpro_page_draft_' + page;
  let restoring = false;
  let timer = null;

  function controls(){ return Array.from(document.querySelectorAll('input,textarea,select')); }
  function editables(){ return Array.from(document.querySelectorAll('[contenteditable="true"]')); }

  function stockPositions(){
    if (page !== 'stock.html') return null;
    return Array.from(document.querySelectorAll('.pot')).map(function(pot){
      const id = pot.dataset.potId || '';
      const parent = pot.parentElement;
      if (!parent) return { id, type:'source' };
      if (parent.classList.contains('case')) {
        const level = parent.closest('[data-etagere][data-niveau]');
        return {
          id,
          type:'case',
          etagere:level?.dataset.etagere || '',
          niveau:level?.dataset.niveau || '',
          caseNum:parent.dataset.case || ''
        };
      }
      if (parent.id === 'zone-tri') return { id, type:'tri' };
      return { id, type:'source' };
    });
  }

  function saveDraft(){
    if (restoring) return;
    try {
      const state = {
        controls: controls().map(function(el,index){
          return {
            index,
            id:el.id || '',
            type:(el.type || el.tagName || '').toLowerCase(),
            value:(el.type === 'password' || el.type === 'file') ? '' : el.value,
            checked:!!el.checked,
            disabled:!!el.disabled
          };
        }),
        editables: editables().map(function(el,index){
          return { index, id:el.id || '', html:el.innerHTML };
        }),
        selectedCells:Array.from(document.querySelectorAll('td'))
          .map(function(td,index){ return td.classList.contains('selected') ? index : -1; })
          .filter(function(index){ return index >= 0; }),
        ui:{},
        stock:stockPositions(),
        stockValidated:page === 'stock.html' && sessionStorage.getItem('stockCorrect') !== null
      };

      ['consigne','autoEvalPart','btnValider','btnSuivant','validBtn','autoEvalBtn','startBtn','stopBtn','resetBtn','resMS','resErr','indicator','fichierSelectionne','resultatScore','autoEvalResult'].forEach(function(id){
        const el = document.getElementById(id);
        if (!el) return;
        state.ui[id] = {
          text:(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) ? null : el.textContent,
          className:el.className || '',
          style:el.getAttribute('style') || '',
          disabled:'disabled' in el ? !!el.disabled : null
        };
      });

      sessionStorage.setItem(KEY, JSON.stringify(state));
      if (window.sebEvalPro?.save) window.sebEvalPro.save();
    } catch (_) {}
  }

  function restoreStock(items){
    if (page !== 'stock.html' || !Array.isArray(items)) return;
    setTimeout(function(){
      document.querySelectorAll('.case').forEach(function(c){ c.classList.remove('occupied'); });
      items.forEach(function(saved){
        const pot = document.querySelector('.pot[data-pot-id="' + saved.id + '"]');
        if (!pot) return;
        let target = null;
        if (saved.type === 'case') {
          target = document.querySelector('[data-etagere="' + saved.etagere + '"][data-niveau="' + saved.niveau + '"] .case[data-case="' + saved.caseNum + '"]');
        } else if (saved.type === 'tri') {
          target = document.getElementById('zone-tri');
        } else {
          target = document.getElementById('pots-source');
        }
        if (target) {
          target.appendChild(pot);
          if (target.classList?.contains('case')) target.classList.add('occupied');
        }
      });
    },180);
  }

  function restoreDraft(){
    let state = null;
    try { state = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) {}
    if (!state) return;
    restoring = true;
    try {
      const list = controls();
      (state.controls || []).forEach(function(saved){
        let el = saved.id ? document.getElementById(saved.id) : null;
        if (!el) el = list[saved.index];
        if (!el || el.type === 'password' || el.type === 'file') return;
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!saved.checked;
        else if (saved.value !== undefined) el.value = saved.value;
        if (saved.disabled !== undefined) el.disabled = !!saved.disabled;
      });

      const eds = editables();
      (state.editables || []).forEach(function(saved){
        let el = saved.id ? document.getElementById(saved.id) : null;
        if (!el) el = eds[saved.index];
        if (el && typeof saved.html === 'string') el.innerHTML = saved.html;
      });

      const tds = Array.from(document.querySelectorAll('td'));
      (state.selectedCells || []).forEach(function(index){
        if (tds[index]) tds[index].classList.add('selected');
      });

      Object.entries(state.ui || {}).forEach(function(entry){
        const id = entry[0], saved = entry[1];
        const el = document.getElementById(id);
        if (!el) return;
        if (typeof saved.className === 'string') el.className = saved.className;
        if (typeof saved.style === 'string') {
          if (saved.style) el.setAttribute('style', saved.style); else el.removeAttribute('style');
        }
        if (saved.text !== null && saved.text !== undefined &&
            !(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement) && !(el instanceof HTMLSelectElement)) {
          el.textContent = saved.text;
        }
        if (saved.disabled !== null && saved.disabled !== undefined && 'disabled' in el) el.disabled = !!saved.disabled;
      });

      restoreStock(state.stock);
      if (page === 'stock.html' && state.stockValidated) {
        const btn = document.querySelector('.verify-btn');
        if (btn) {
          btn.innerHTML = '➡️ Suivant';
          btn.onclick = function(){ window.location.href = 'planning.html'; };
        }
      }
    } finally {
      restoring = false;
    }
  }

  function schedule(){
    clearTimeout(timer);
    timer = setTimeout(saveDraft,80);
  }

  document.addEventListener('DOMContentLoaded', function(){
    restoreDraft();
    document.addEventListener('input', schedule, true);
    document.addEventListener('change', schedule, true);
    document.addEventListener('click', schedule, true);
    document.addEventListener('drop', function(){ setTimeout(schedule,30); }, true);
    document.addEventListener('dragend', function(){ setTimeout(schedule,30); }, true);
    setInterval(saveDraft,1000);
  });
})();
