(function(){
  'use strict';
  function bind(){
    const el_brique_001 = document.querySelector('[data-seb-handler-click="brique-001"]');
    if (el_brique_001 && el_brique_001.getAttribute('data-seb-bound') !== '1') {
      el_brique_001.setAttribute('data-seb-bound','1');
      el_brique_001.addEventListener('click', function(event) {
        const __result = (function(event){
          goToPage('tri_de_cheville.html')
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true }); else bind();
})();
