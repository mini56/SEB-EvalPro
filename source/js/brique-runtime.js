(function(){
  document.addEventListener('DOMContentLoaded', function(){
    const resetBtn = document.getElementById('resetBtn');
    if (!resetBtn) return;
    resetBtn.onclick = async function(){
      const password = window.prompt('Mot de passe administrateur requis pour remettre le chronomètre à zéro :');
      if (password === null) return;
      const ok = window.sebEvalPro && window.sebEvalPro.verifyAdminPassword
        ? await window.sebEvalPro.verifyAdminPassword(password)
        : false;
      if (!ok) {
        window.alert('Mot de passe incorrect. Remise à zéro annulée.');
        return;
      }
      clearInterval(chronoInterval);
      chronoInterval = null;
      chronoSeconds = 0;
      updateChrono();
      const temps = document.getElementById('temps');
      if (temps) temps.value = '';
      const start = document.getElementById('startBtn');
      const stop = document.getElementById('stopBtn');
      if (start) start.disabled = false;
      if (stop) stop.disabled = true;
    };
  });
})();
