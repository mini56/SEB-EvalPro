const fs = require('fs');
const path = require('path');
const Module = require('module');

const target = path.join(__dirname, 'build135-audit-fixes.js');
let code = fs.readFileSync(target, 'utf8');

const oldOld = '  const oldPattern = "/^[A-Za-z0-9-]+_[A-Za-z0-9-]+_\\\\d{4}-\\\\d{2}-\\\\d{2}\\\\.docx$/i";';
const newOld = '  const oldPattern = "/^Resultat_[A-Za-z0-9-]+_[A-Za-z0-9-]+_\\\\d{4}-\\\\d{2}-\\\\d{2}\\\\.docx$/i";';
const oldNew = '  const newPattern = "/^[A-Za-z0-9-]+_[A-Za-z0-9-]+_\\\\d{4}-\\\\d{2}-\\\\d{2}(?:_\\\\d+)?\\\\.docx$/i";';
const newNew = '  const newPattern = "/^Resultat_[A-Za-z0-9-]+_[A-Za-z0-9-]+_\\\\d{4}-\\\\d{2}-\\\\d{2}(?:_\\\\d+)?\\\\.docx$/i";';

if (!code.includes(oldOld) || !code.includes(oldNew)) {
  console.error('SEB EvalPro Build #135 runner: motifs Resultat_ à corriger introuvables.');
  process.exit(2);
}

code = code.replace(oldOld, newOld).replace(oldNew, newNew);

const runtime = new Module(target, module);
runtime.filename = target;
runtime.paths = module.paths.slice();
runtime._compile(code, target);
