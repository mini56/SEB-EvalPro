const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'app', 'web', 'qcmv1.0.html');

function fail(message, code = 2) {
  console.error(`SEB EvalPro calculatrice flottante: ${message}`);
  process.exit(code);
}

if (!fs.existsSync(file)) fail('qcmv1.0.html généré introuvable');
let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const runtimeFile = path.join(root, 'app', 'web', 'js', 'qcm-runtime.js');
const runtime = fs.existsSync(runtimeFile)
  ? fs.readFileSync(runtimeFile, 'utf8').replace(/\r\n/g, '\n')
  : '';
const calculatorLogic = html.includes('js/qcm-runtime.js') ? runtime : html;

if (!html.includes('id="calc-container"')) fail('conteneur de calculatrice introuvable', 3);
if (!html.includes('id="calc-display"')) fail('afficheur de calculatrice introuvable', 4);
if (!calculatorLogic.includes('window.openCalculator')) fail('fonction openCalculator introuvable', 5);

const styleId = 'seb-floating-calculator-style';
if (!html.includes(`id="${styleId}"`)) {
  const style = `
<style id="${styleId}">
#calc-container {
  position: fixed !important;
  top: auto !important;
  left: auto !important;
  right: auto !important;
  bottom: auto !important;
  width: 258px !important;
  box-sizing: border-box !important;
  padding: 0 16px 14px !important;
  border: 2px solid #d98200 !important;
  border-radius: 16px !important;
  background: linear-gradient(145deg, #ffd58a 0%, #f9ad32 52%, #ee9418 100%) !important;
  box-shadow: 0 14px 32px rgba(74, 47, 10, .30), 0 4px 10px rgba(74, 47, 10, .18) !important;
  z-index: 3500 !important;
  user-select: none;
}
#calc-container .seb-calc-dragbar {
  height: 38px;
  margin: 0 -16px 12px;
  padding: 0 12px 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 13px 13px 0 0;
  background: linear-gradient(to bottom, #f7b84b, #e99215);
  border-bottom: 1px solid rgba(139, 82, 0, .45);
  color: #5f3800;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: .2px;
  cursor: grab;
  touch-action: none;
  box-shadow: inset 0 1px rgba(255,255,255,.55);
}
#calc-container .seb-calc-dragbar:active { cursor: grabbing; }
#calc-container .seb-calc-grip {
  font-size: 18px;
  letter-spacing: 2px;
  color: rgba(95,56,0,.62);
}
#calc-display {
  box-sizing: border-box !important;
  width: 222px !important;
  height: 50px !important;
  margin: 0 0 12px !important;
  padding: 8px 10px !important;
  border: 2px solid #c67a0b !important;
  border-radius: 9px !important;
  background: #fff8e9 !important;
  color: #3d2b11 !important;
  font: 700 24px/30px Arial, sans-serif !important;
  box-shadow: inset 0 2px 5px rgba(83,55,17,.16) !important;
  overflow: hidden;
}
#calc-container #keypad { text-align: center; }
#calc-container .calc-btn {
  width: 46px !important;
  height: 42px !important;
  margin: 4px !important;
  padding: 0 !important;
  border: 1px solid #cb7d0d !important;
  border-radius: 8px !important;
  background: linear-gradient(to bottom, #fffaf0, #ffe8bf) !important;
  color: #4f3510 !important;
  font-size: 17px !important;
  font-weight: 700 !important;
  cursor: pointer !important;
  box-shadow: 0 2px 3px rgba(96,57,4,.16), inset 0 1px #fff !important;
}
#calc-container .calc-btn:hover {
  background: linear-gradient(to bottom, #ffffff, #ffdda0) !important;
  transform: translateY(-1px);
}
#calc-container .calc-btn:active {
  transform: translateY(1px);
  box-shadow: inset 0 2px 4px rgba(96,57,4,.20) !important;
}
#calc-container .calc-btn-fermez {
  height: 38px !important;
  margin-top: 8px !important;
  padding: 0 18px !important;
  border: 0 !important;
  border-radius: 8px !important;
  background: #b96800 !important;
  color: #fff !important;
  font-size: 15px !important;
  font-weight: 700 !important;
  cursor: pointer !important;
  box-shadow: 0 2px 4px rgba(94,50,0,.24) !important;
}
#calc-container .calc-btn-fermez:hover { background: #9f5900 !important; }
#calc-container .seb-calc-brand {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(133,75,0,.28);
  text-align: center;
  color: #a45e09;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1.8px;
  text-transform: uppercase;
  text-shadow: 0 1px 0 rgba(255,235,195,.85), 0 -1px 0 rgba(117,61,0,.32);
}
</style>
`;
  const headEnd = html.toLowerCase().indexOf('</head>');
  if (headEnd < 0) fail('balise </head> introuvable', 6);
  html = html.slice(0, headEnd) + style + html.slice(headEnd);
}

const scriptId = 'seb-floating-calculator-script';
if (!html.includes(`id="${scriptId}"`)) {
  const script = `
<script id="${scriptId}">
(function(){
  const container = document.getElementById('calc-container');
  if (!container) return;

  let dragbar = container.querySelector('.seb-calc-dragbar');
  if (!dragbar) {
    dragbar = document.createElement('div');
    dragbar.className = 'seb-calc-dragbar';
    dragbar.setAttribute('role', 'presentation');
    dragbar.innerHTML = '<span>Calculatrice</span><span class="seb-calc-grip" aria-hidden="true">•••</span>';
    container.insertBefore(dragbar, container.firstChild);
  }

  let brand = container.querySelector('.seb-calc-brand');
  if (!brand) {
    brand = document.createElement('div');
    brand.className = 'seb-calc-brand';
    brand.textContent = 'Sauvegarde 56';
    container.appendChild(brand);
  }

  function setPosition(left, top) {
    const margin = 10;
    const rect = container.getBoundingClientRect();
    const width = rect.width || 258;
    const height = rect.height || 360;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);
    const x = Math.min(Math.max(margin, left), maxLeft);
    const y = Math.min(Math.max(margin, top), maxTop);
    container.style.setProperty('left', x + 'px', 'important');
    container.style.setProperty('top', y + 'px', 'important');
    container.style.setProperty('right', 'auto', 'important');
    container.style.setProperty('bottom', 'auto', 'important');
  }

  function placeInitial() {
    if (container.dataset.sebPositioned === '1') return;
    const rect = container.getBoundingClientRect();
    const width = rect.width || 258;
    const height = rect.height || 360;
    const left = Math.round(window.innerWidth * 0.72 - width / 2);
    const top = Math.round((window.innerHeight - height) / 2);
    setPosition(left, top);
    container.dataset.sebPositioned = '1';
  }

  let dragging = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  dragbar.addEventListener('pointerdown', function(event){
    if (event.button !== undefined && event.button !== 0) return;
    const rect = container.getBoundingClientRect();
    dragging = true;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    if (dragbar.setPointerCapture && pointerId !== undefined) {
      try { dragbar.setPointerCapture(pointerId); } catch (_) {}
    }
    event.preventDefault();
  });

  dragbar.addEventListener('pointermove', function(event){
    if (!dragging || (pointerId !== null && event.pointerId !== pointerId)) return;
    setPosition(startLeft + event.clientX - startX, startTop + event.clientY - startY);
  });

  function stopDrag(event){
    if (!dragging) return;
    if (event && pointerId !== null && event.pointerId !== undefined && event.pointerId !== pointerId) return;
    dragging = false;
    if (dragbar.releasePointerCapture && pointerId !== null) {
      try { dragbar.releasePointerCapture(pointerId); } catch (_) {}
    }
    pointerId = null;
  }

  dragbar.addEventListener('pointerup', stopDrag);
  dragbar.addEventListener('pointercancel', stopDrag);

  window.addEventListener('resize', function(){
    if (container.dataset.sebPositioned !== '1') return;
    const rect = container.getBoundingClientRect();
    setPosition(rect.left, rect.top);
  });

  const originalOpen = window.openCalculator;
  if (typeof originalOpen === 'function') {
    window.openCalculator = function(){
      originalOpen.apply(this, arguments);
      requestAnimationFrame(placeInitial);
    };
  } else {
    console.error('SEB EvalPro: fonction openCalculator absente au moment du patch flottant.');
  }
})();
</script>
`;
  const bodyEnd = html.toLowerCase().lastIndexOf('</body>');
  if (bodyEnd < 0) fail('balise </body> introuvable', 7);
  html = html.slice(0, bodyEnd) + script + html.slice(bodyEnd);
}

if (!html.includes('seb-calc-dragbar')) fail('barre de déplacement non injectée', 8);
if (!html.includes('Sauvegarde 56')) fail('gravure Sauvegarde 56 absente', 9);
if (!html.includes("addEventListener('pointerdown'")) fail('gestion du déplacement absente', 10);
if (!html.includes('background: linear-gradient(145deg, #ffd58a')) fail('habillage orange absent', 11);

fs.writeFileSync(file, html, 'utf8');
console.log('SEB EvalPro calculatrice: fenêtre orange flottante, déplaçable et gravée « Sauvegarde 56 ».');
