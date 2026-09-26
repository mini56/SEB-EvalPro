(function(){
  'use strict';
  const APP_NAME = 'SEB-éval-PRO';

  function applyBranding(){
    if (document.title !== APP_NAME) document.title = APP_NAME;
    document.querySelectorAll('.seb-evalpro-name').forEach(function(el){
      if (el.textContent !== APP_NAME) el.textContent = APP_NAME;
    });
    const alertTitle = document.getElementById('seb-evalpro-alert-title');
    if (alertTitle && alertTitle.textContent !== APP_NAME) alertTitle.textContent = APP_NAME;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyBranding);
  else applyBranding();

  const observer = new MutationObserver(applyBranding);
  observer.observe(document.documentElement, { childList:true, subtree:true });
})();
