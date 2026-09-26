(function(){
  function place(){
    const button=document.getElementById('seb-evalpro-abandon-fixed');
    const target=document.querySelector('#right');
    if(button&&target&&button.parentElement!==target) target.appendChild(button);
  }
  document.addEventListener('DOMContentLoaded',place,{once:true});
  setTimeout(place,0);
  new MutationObserver(place).observe(document.documentElement,{childList:true,subtree:true});
})();
