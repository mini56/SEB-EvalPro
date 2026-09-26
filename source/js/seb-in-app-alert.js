(function(){
  'use strict';
  if (window.__sebEvalProAlertInstalled) return;
  window.__sebEvalProAlertInstalled = true;

  const queue = [];
  let visible = false;

  function renderNext(){
    if (visible || queue.length === 0) return;
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', renderNext, { once:true });
      return;
    }

    visible = true;
    const message = queue.shift();
    const layer = document.createElement('div');
    layer.id = 'seb-evalpro-alert-layer';
    layer.innerHTML = '<div id="seb-evalpro-alert-box" role="alertdialog" aria-modal="true"><div id="seb-evalpro-alert-title">SEB EvalPro</div><div id="seb-evalpro-alert-message"></div><div id="seb-evalpro-alert-actions"><button id="seb-evalpro-alert-ok" type="button">OK</button></div></div>';
    layer.querySelector('#seb-evalpro-alert-message').textContent = String(message == null ? '' : message);

    const close = function(){
      layer.remove();
      visible = false;
      setTimeout(renderNext, 0);
    };
    layer.querySelector('#seb-evalpro-alert-ok').addEventListener('click', close);
    layer.addEventListener('keydown', function(event){
      if (event.key === 'Enter' || event.key === 'Escape') close();
    });
    document.body.appendChild(layer);
    layer.querySelector('#seb-evalpro-alert-ok').focus();
  }

  window.alert = function(message){
    queue.push(message);
    renderNext();
  };
})();
