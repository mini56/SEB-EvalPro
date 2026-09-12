const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'app', 'web', 'qcmv1.0.html');

function fail(message, code = 2) {
  console.error(`SEB EvalPro calculatrice moteur: ${message}`);
  process.exit(code);
}

function evaluateTokens(source) {
  if (!Array.isArray(source) || source.length === 0) return NaN;
  const tokens = source.slice();

  // Priorité standard : multiplications et divisions avant additions/soustractions.
  const firstPass = [tokens[0]];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const value = tokens[i + 1];
    if (typeof value !== 'number' || !Number.isFinite(value)) return NaN;

    if (op === '*' || op === '/') {
      const left = firstPass.pop();
      const result = op === '*'
        ? left * value
        : (value === 0 ? NaN : left / value);
      if (!Number.isFinite(result)) return NaN;
      firstPass.push(result);
    } else {
      firstPass.push(op, value);
    }
  }

  let result = firstPass[0];
  for (let i = 1; i < firstPass.length; i += 2) {
    const op = firstPass[i];
    const value = firstPass[i + 1];
    if (op === '+') result += value;
    else if (op === '-') result -= value;
    else return NaN;
  }
  return result;
}

function approx(actual, expected) {
  return Number.isFinite(actual) && Math.abs(actual - expected) < 1e-10;
}

// Contrôles bloquants du moteur avant toute génération du paquet.
const tests = [
  { tokens: [2, '+', 3, '*', 4], expected: 14, label: 'priorité multiplication' },
  { tokens: [10, '-', 2, '*', 3], expected: 4, label: 'priorité multiplication après soustraction' },
  { tokens: [8, '/', 2, '+', 3], expected: 7, label: 'division puis addition' },
  { tokens: [8, '/', 2, '*', 3], expected: 12, label: 'associativité multiplication/division' },
  { tokens: [1.5, '+', 2.25], expected: 3.75, label: 'décimales' },
  { tokens: [5, '*', -2], expected: -10, label: 'nombre négatif' }
];
for (const test of tests) {
  const actual = evaluateTokens(test.tokens);
  if (!approx(actual, test.expected)) {
    fail(`${test.label}: attendu ${test.expected}, obtenu ${actual}`, 3);
  }
}
if (!Number.isNaN(evaluateTokens([10, '/', 0]))) {
  fail('division par zéro non rejetée', 4);
}

if (!fs.existsSync(file)) fail('qcmv1.0.html généré introuvable', 5);
let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

if (!html.includes('id="calc-container"')) fail('conteneur calculatrice introuvable', 6);
if (!html.includes('id="calc-display"')) fail('afficheur calculatrice introuvable', 7);
if (!html.includes('class="calc-btn"')) fail('touches calculatrice introuvables', 8);
if (!html.includes('seb-floating-calculator-script')) fail('correctif calculatrice flottante absent', 9);

const marker = 'seb-calculator-engine-v2';
if (!html.includes(`id="${marker}"`)) {
  const script = `
<script id="${marker}">
(function(){
  const container = document.getElementById('calc-container');
  const display = document.getElementById('calc-display');
  if (!container || !display) return;

  let tokens = [];
  let current = '';
  let justEvaluated = false;
  let errorState = false;

  function render(value) {
    display.textContent = value;
  }

  function reset(renderZero) {
    tokens = [];
    current = '';
    justEvaluated = false;
    errorState = false;
    if (renderZero !== false) render('0');
  }

  function isOperator(value) {
    return value === '+' || value === '-' || value === '*' || value === '/';
  }

  function normalizeOperator(value) {
    return value === 'x' ? '*' : value;
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return 'ERR';
    if (Object.is(value, -0) || Math.abs(value) < 1e-12) return '0';
    return String(Number.parseFloat(value.toPrecision(12)));
  }

  function calculate(source) {
    if (!Array.isArray(source) || source.length === 0) return NaN;
    const list = source.slice();
    const firstPass = [list[0]];

    for (let i = 1; i < list.length; i += 2) {
      const op = list[i];
      const value = list[i + 1];
      if (typeof value !== 'number' || !Number.isFinite(value)) return NaN;

      if (op === '*' || op === '/') {
        const left = firstPass.pop();
        const result = op === '*'
          ? left * value
          : (value === 0 ? NaN : left / value);
        if (!Number.isFinite(result)) return NaN;
        firstPass.push(result);
      } else {
        firstPass.push(op, value);
      }
    }

    let result = firstPass[0];
    for (let i = 1; i < firstPass.length; i += 2) {
      const op = firstPass[i];
      const value = firstPass[i + 1];
      if (op === '+') result += value;
      else if (op === '-') result -= value;
      else return NaN;
    }
    return result;
  }

  function prepareForNumberEntry() {
    if (justEvaluated || errorState) reset(false);
  }

  function inputDigit(value) {
    prepareForNumberEntry();
    if (current === '' || current === '0') current = value;
    else if (current === '-0') current = '-' + value;
    else current += value;
    render(current);
  }

  function inputDecimal() {
    prepareForNumberEntry();
    if (current === '') current = '0.';
    else if (current === '-') current = '-0.';
    else if (!current.includes('.')) current += '.';
    render(current);
  }

  function inputOperator(rawOperator) {
    const op = normalizeOperator(rawOperator);
    if (errorState) {
      reset();
      return;
    }

    if (justEvaluated) {
      const previous = Number(display.textContent);
      tokens = Number.isFinite(previous) ? [previous] : [];
      current = '';
      justEvaluated = false;
    }

    // Autorise un nombre négatif en début de calcul ou après un opérateur.
    if (op === '-' && current === '' && (tokens.length === 0 || isOperator(tokens[tokens.length - 1]))) {
      current = '-';
      render('-');
      return;
    }

    if (current !== '' && current !== '-') {
      const value = Number(current);
      if (!Number.isFinite(value)) return;
      tokens.push(value);
      current = '';
    } else if (current === '-') {
      return;
    }

    if (tokens.length === 0) return;
    if (isOperator(tokens[tokens.length - 1])) tokens[tokens.length - 1] = op;
    else tokens.push(op);
  }

  function evaluate() {
    if (errorState) {
      reset();
      return;
    }

    if (current !== '' && current !== '-') {
      const value = Number(current);
      if (!Number.isFinite(value)) return;
      tokens.push(value);
      current = '';
    }

    if (tokens.length === 0) return;
    if (isOperator(tokens[tokens.length - 1])) tokens.pop();
    if (tokens.length === 0) return;

    const result = calculate(tokens);
    const text = formatNumber(result);
    render(text);
    tokens = [];

    if (text === 'ERR') {
      current = '';
      errorState = true;
      justEvaluated = false;
      return;
    }

    current = text;
    justEvaluated = true;
    errorState = false;
  }

  // Capture avant les anciens écouteurs : le moteur V2 devient l'unique moteur des touches.
  container.addEventListener('click', function(event){
    const button = event.target.closest('.calc-btn');
    if (!button || !container.contains(button)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const value = (button.textContent || '').trim();
    if (/^\\d$/.test(value)) inputDigit(value);
    else if (value === '.') inputDecimal();
    else if (value === '=') evaluate();
    else if (value === 'C') reset();
    else if (['+','-','/','x'].includes(value)) inputOperator(value);
  }, true);

  const previousOpenCalculator = window.openCalculator;
  window.openCalculator = function(){
    if (typeof previousOpenCalculator === 'function') previousOpenCalculator();
    reset();
  };

  window.__sebCalculatorEngineV2 = {
    calculate: calculate,
    reset: reset
  };
})();
</script>
`;

  const bodyEnd = html.toLowerCase().lastIndexOf('</body>');
  if (bodyEnd < 0) fail('balise </body> introuvable', 10);
  html = html.slice(0, bodyEnd) + script + html.slice(bodyEnd);
}

if (!html.includes('seb-calculator-engine-v2')) fail('moteur V2 non injecté', 11);
if (!html.includes('value.toPrecision(12)')) fail('formatage décimal propre absent', 12);
if (!html.includes('event.stopImmediatePropagation()')) fail('neutralisation de l’ancien moteur absente', 13);

fs.writeFileSync(file, html, 'utf8');
console.log('SEB EvalPro calculatrice moteur: priorité opératoire, division par zéro, décimales et nouveau calcul après = validés.');
