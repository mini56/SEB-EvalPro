(function(){
  'use strict';
  function bind(){
    const el_qcmv1_0_001 = document.querySelector('[data-seb-handler-submit="qcmv1-0-001"]');
    if (el_qcmv1_0_001 && el_qcmv1_0_001.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_001.setAttribute('data-seb-bound','1');
      el_qcmv1_0_001.addEventListener('submit', function(event) {
        const __result = (function(event){
          return false;
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_qcmv1_0_002 = document.querySelector('[data-seb-handler-click="qcmv1-0-002"]');
    if (el_qcmv1_0_002 && el_qcmv1_0_002.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_002.setAttribute('data-seb-bound','1');
      el_qcmv1_0_002.addEventListener('click', function(event) {
        const __result = (function(event){
          window.openCalculator()
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_qcmv1_0_003 = document.querySelector('[data-seb-handler-click="qcmv1-0-003"]');
    if (el_qcmv1_0_003 && el_qcmv1_0_003.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_003.setAttribute('data-seb-bound','1');
      el_qcmv1_0_003.addEventListener('click', function(event) {
        const __result = (function(event){
          verifierNomLieu()
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_qcmv1_0_004 = document.querySelector('[data-seb-handler-click="qcmv1-0-004"]');
    if (el_qcmv1_0_004 && el_qcmv1_0_004.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_004.setAttribute('data-seb-bound','1');
      el_qcmv1_0_004.addEventListener('click', function(event) {
        const __result = (function(event){
          nextPage('2')
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_qcmv1_0_005 = document.querySelector('[data-seb-handler-click="qcmv1-0-005"]');
    if (el_qcmv1_0_005 && el_qcmv1_0_005.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_005.setAttribute('data-seb-bound','1');
      el_qcmv1_0_005.addEventListener('click', function(event) {
        const __result = (function(event){
          window.openCalculator()
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_qcmv1_0_006 = document.querySelector('[data-seb-handler-click="qcmv1-0-006"]');
    if (el_qcmv1_0_006 && el_qcmv1_0_006.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_006.setAttribute('data-seb-bound','1');
      el_qcmv1_0_006.addEventListener('click', function(event) {
        const __result = (function(event){
          window.openCalculator()
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_qcmv1_0_007 = document.querySelector('[data-seb-handler-click="qcmv1-0-007"]');
    if (el_qcmv1_0_007 && el_qcmv1_0_007.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_007.setAttribute('data-seb-bound','1');
      el_qcmv1_0_007.addEventListener('click', function(event) {
        const __result = (function(event){
          window.openCalculator()
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_qcmv1_0_008 = document.querySelector('[data-seb-handler-click="qcmv1-0-008"]');
    if (el_qcmv1_0_008 && el_qcmv1_0_008.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_008.setAttribute('data-seb-bound','1');
      el_qcmv1_0_008.addEventListener('click', function(event) {
        const __result = (function(event){
          window.openCalculator()
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_qcmv1_0_009 = document.querySelector('[data-seb-handler-click="qcmv1-0-009"]');
    if (el_qcmv1_0_009 && el_qcmv1_0_009.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_009.setAttribute('data-seb-bound','1');
      el_qcmv1_0_009.addEventListener('click', function(event) {
        const __result = (function(event){
          saveAnswer(9,'Bonne',0); nextPage(10);
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_qcmv1_0_010 = document.querySelector('[data-seb-handler-click="qcmv1-0-010"]');
    if (el_qcmv1_0_010 && el_qcmv1_0_010.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_010.setAttribute('data-seb-bound','1');
      el_qcmv1_0_010.addEventListener('click', function(event) {
        const __result = (function(event){
          saveAnswer(9,'Mauvaise',0); nextPage(10);
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_qcmv1_0_011 = document.querySelector('[data-seb-handler-click="qcmv1-0-011"]');
    if (el_qcmv1_0_011 && el_qcmv1_0_011.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_011.setAttribute('data-seb-bound','1');
      el_qcmv1_0_011.addEventListener('click', function(event) {
        const __result = (function(event){
          saveAnswer(10,'Bonne',0); nextPage(11);
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_qcmv1_0_012 = document.querySelector('[data-seb-handler-click="qcmv1-0-012"]');
    if (el_qcmv1_0_012 && el_qcmv1_0_012.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_012.setAttribute('data-seb-bound','1');
      el_qcmv1_0_012.addEventListener('click', function(event) {
        const __result = (function(event){
          saveAnswer(10,'Mauvaise',0); nextPage(11);
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_qcmv1_0_013 = document.querySelector('[data-seb-handler-click="qcmv1-0-013"]');
    if (el_qcmv1_0_013 && el_qcmv1_0_013.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_013.setAttribute('data-seb-bound','1');
      el_qcmv1_0_013.addEventListener('click', function(event) {
        const __result = (function(event){
          nextPage('finale');
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_qcmv1_0_014 = document.querySelector('[data-seb-handler-click="qcmv1-0-014"]');
    if (el_qcmv1_0_014 && el_qcmv1_0_014.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_014.setAttribute('data-seb-bound','1');
      el_qcmv1_0_014.addEventListener('click', function(event) {
        const __result = (function(event){
          saveAnswer(11,'Mauvaise',0); nextPage('finale');
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_qcmv1_0_015 = document.querySelector('[data-seb-handler-click="qcmv1-0-015"]');
    if (el_qcmv1_0_015 && el_qcmv1_0_015.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_015.setAttribute('data-seb-bound','1');
      el_qcmv1_0_015.addEventListener('click', function(event) {
        const __result = (function(event){
          verifierDonnees()
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_qcmv1_0_016 = document.querySelector('[data-seb-handler-click="qcmv1-0-016"]');
    if (el_qcmv1_0_016 && el_qcmv1_0_016.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_016.setAttribute('data-seb-bound','1');
      el_qcmv1_0_016.addEventListener('click', function(event) {
        const __result = (function(event){
          autoRemplirBilan()
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
    const el_qcmv1_0_017 = document.querySelector('[data-seb-handler-click="qcmv1-0-017"]');
    if (el_qcmv1_0_017 && el_qcmv1_0_017.getAttribute('data-seb-bound') !== '1') {
      el_qcmv1_0_017.setAttribute('data-seb-bound','1');
      el_qcmv1_0_017.addEventListener('click', function(event) {
        const __result = (function(event){
          exportToWord()
        }).call(this,event);
        if (__result === false) { event.preventDefault(); event.stopPropagation(); }
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true }); else bind();
})();
