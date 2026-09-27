(function(){
  'use strict';
  function bind(){
    const el_bilan_001 = document.querySelector('[data-seb-handler-click="bilan-001"]');
    if (el_bilan_001 && el_bilan_001.getAttribute('data-seb-bound') !== '1') {
      el_bilan_001.setAttribute('data-seb-bound','1');
      el_bilan_001.addEventListener('click', function(event) {
        const __result = (function(event){
          autoRemplirBilan()
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_bilan_002 = document.querySelector('[data-seb-handler-click="bilan-002"]');
    if (el_bilan_002 && el_bilan_002.getAttribute('data-seb-bound') !== '1') {
      el_bilan_002.setAttribute('data-seb-bound','1');
      el_bilan_002.addEventListener('click', function(event) {
        const __result = (function(event){
          verifierDonnees()
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_bilan_003 = document.querySelector('[data-seb-handler-click="bilan-003"]');
    if (el_bilan_003 && el_bilan_003.getAttribute('data-seb-bound') !== '1') {
      el_bilan_003.setAttribute('data-seb-bound','1');
      el_bilan_003.addEventListener('click', function(event) {
        const __result = (function(event){
          alert('OK !')
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_bilan_004 = document.querySelector('[data-seb-handler-click="bilan-004"]');
    if (el_bilan_004 && el_bilan_004.getAttribute('data-seb-bound') !== '1') {
      el_bilan_004.setAttribute('data-seb-bound','1');
      el_bilan_004.addEventListener('click', function(event) {
        const __result = (function(event){
          autoRemplirBilan()
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_bilan_005 = document.querySelector('[data-seb-handler-click="bilan-005"]');
    if (el_bilan_005 && el_bilan_005.getAttribute('data-seb-bound') !== '1') {
      el_bilan_005.setAttribute('data-seb-bound','1');
      el_bilan_005.addEventListener('click', function(event) {
        const __result = (function(event){
          exportToWord()
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true }); else bind();
})();
