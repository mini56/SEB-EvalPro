const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error(`SEB EvalPro résultat DOCX: ${message}`);
  process.exit(code);
}

function read(relativePath) {
  const target = path.join(root, relativePath);
  if (!fs.existsSync(target)) fail(`fichier introuvable: ${relativePath}`);
  return { target, text: fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') };
}

function write(target, text) {
  fs.writeFileSync(target, text, 'utf8');
}

// 1. Le résultat stagiaire doit être clairement distingué du bilan.
{
  const { target, text } = read('src/main.js');
  let out = text;
  const oldPattern = '/^[A-Za-z0-9-]+_[A-Za-z0-9-]+_\\d{4}-\\d{2}-\\d{2}\\.docx$/i';
  const newPattern = '/^Resultat_[A-Za-z0-9-]+_[A-Za-z0-9-]+_\\d{4}-\\d{2}-\\d{2}\\.docx$/i';
  const count = out.split(oldPattern).length - 1;
  const candidateFolderRouting = out.includes("const candidateExportDir = getCandidateStore().getActiveExportDir();");
  const minimumExpected = candidateFolderRouting ? 2 : 3;
  if (count < minimumExpected) {
    fail(`motif résultat stagiaire attendu au moins ${minimumExpected} fois, trouvé ${count}`, 3);
  }
  out = out.split(oldPattern).join(newPattern);
  write(target, out);
}

// 2. Nom + couleurs + symboles du résultat stagiaire dans le vrai DOCX.
{
  const { target, text } = read('app/web/qcmv1.0.html');
  let out = text;

  const oldFilename = "    const filename = nom + '_' + prenom + '_' + date + '.docx';";
  const newFilename = "    const filename = 'Resultat_' + nom + '_' + prenom + '_' + date + '.docx';";
  if (!out.includes(oldFilename)) fail('ligne de nom du DOCX candidat introuvable', 4);
  out = out.replace(oldFilename, newFilename);

  const oldRenderer = `    const { Document, Packer, Paragraph, TextRun } = window.docx;
    const lines = resultat.innerText.replace(/\\r/g, '').split('\\n');
    const children = [
      new Paragraph({ children: [new TextRun({ text: 'Résultats de l’évaluation SEB EvalPro', bold: true, size: 28 })] }),
      new Paragraph({ text: '' })
    ];
    lines.forEach((line) => {
      children.push(new Paragraph({ children: [new TextRun({ text: line || ' ', size: 20 })] }));
    });`;

  const newRenderer = `    const { Document, Packer, Paragraph, TextRun } = window.docx;
    const children = [
      new Paragraph({
        children: [new TextRun({ text: 'Résultats de l’évaluation SEB EvalPro', bold: true, size: 28, color: '1A73E8' })],
        spacing: { after: 180 }
      })
    ];

    function runStyleForElement(el, inherited) {
      const next = { ...(inherited || {}) };
      if (!el || !el.tagName) return next;
      const tag = el.tagName.toUpperCase();
      if (tag === 'B' || tag === 'STRONG' || /^H[1-4]$/.test(tag)) next.bold = true;
      if (tag === 'I' || tag === 'EM') next.italics = true;
      if (el.classList?.contains('correct')) next.color = '008000';
      if (el.classList?.contains('incorrect')) next.color = 'FF0000';
      if (el.classList?.contains('commentaire')) next.color = '666666';
      return next;
    }

    function appendRuns(node, runs, inherited, preserveBreaks) {
      if (!node) return;
      if (node.nodeType === Node.TEXT_NODE) {
        let value = String(node.nodeValue || '').replace(/\\r/g, '');
        if (!preserveBreaks) value = value.replace(/\\s+/g, ' ');
        if (!value) return;
        const parts = preserveBreaks ? value.split('\\n') : [value];
        parts.forEach((part, index) => {
          if (index > 0) runs.push(new TextRun({ text: '', break: 1, size: inherited.size || 20 }));
          if (part) runs.push(new TextRun({
            text: part,
            size: inherited.size || 20,
            bold: !!inherited.bold,
            italics: !!inherited.italics,
            color: inherited.color || '000000'
          }));
        });
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const el = node;
      if (el.tagName.toUpperCase() === 'BR') {
        runs.push(new TextRun({ text: '', break: 1, size: inherited.size || 20 }));
        return;
      }

      const style = runStyleForElement(el, inherited);
      const parent = el.parentElement;
      const firstCorrect = el.classList?.contains('correct') && !parent?.classList?.contains('correct');
      const firstIncorrect = el.classList?.contains('incorrect') && !parent?.classList?.contains('incorrect');
      const text = String(el.textContent || '');
      if (firstCorrect && !/[✓✔✅]/.test(text)) {
        runs.push(new TextRun({ text: '✓ ', size: style.size || 20, bold: true, color: '008000' }));
      }
      if (firstIncorrect && !/[✗✘❌]/.test(text)) {
        runs.push(new TextRun({ text: '✗ ', size: style.size || 20, bold: true, color: 'FF0000' }));
      }

      Array.from(el.childNodes).forEach((child) => appendRuns(child, runs, style, preserveBreaks));
    }

    function paragraphFromElement(el) {
      const tag = el.tagName.toUpperCase();
      const heading = /^H[1-4]$/.test(tag);
      const size = tag === 'H3' ? 24 : tag === 'H4' ? 22 : heading ? 24 : 20;
      const base = {
        size,
        bold: heading,
        color: heading ? '1A73E8' : '000000'
      };
      const runs = [];
      appendRuns(el, runs, base, tag === 'PRE');
      if (!runs.length) runs.push(new TextRun({ text: ' ', size }));
      return new Paragraph({
        children: runs,
        spacing: { after: heading ? 100 : 40 }
      });
    }

    const blocks = Array.from(resultat.querySelectorAll('h1,h2,h3,h4,p,pre,div')).filter((el) => {
      const tag = el.tagName.toUpperCase();
      if (tag !== 'DIV') return !!String(el.innerText || el.textContent || '').trim();
      const hasBlockChild = Array.from(el.children).some((child) => /^(DIV|P|PRE|H1|H2|H3|H4)$/.test(child.tagName));
      return !hasBlockChild && !!String(el.innerText || el.textContent || '').trim();
    });

    blocks.forEach((el) => children.push(paragraphFromElement(el)));`;

  if (!out.includes(oldRenderer)) fail('moteur simple du DOCX candidat introuvable', 5);
  out = out.replace(oldRenderer, newRenderer);

  write(target, out);
}

// Contrôles bloquants : on refuse le build si le nom ou les couleurs disparaissent.
{
  const main = read('src/main.js').text;
  const qcm = read('app/web/qcmv1.0.html').text;
  const checks = [
    [main.includes('/^Resultat_[A-Za-z0-9-]+_[A-Za-z0-9-]+_\\d{4}-\\d{2}-\\d{2}\\.docx$/i'), 'filtrage Resultat_ côté Electron'],
    [qcm.includes("const filename = 'Resultat_' + nom + '_' + prenom + '_' + date + '.docx';"), 'préfixe Resultat_'],
    [qcm.includes("color: '008000'") && qcm.includes("color: 'FF0000'"), 'couleurs vert/rouge DOCX'],
    [qcm.includes("text: '✓ '") && qcm.includes("text: '✗ '"), 'symboles correct/incorrect DOCX']
  ];
  const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
  if (failed.length) fail(`contrôles finaux échoués: ${failed.join(', ')}`, 6);
}

console.log('SEB EvalPro résultat DOCX: préfixe Resultat_ + couleurs vert/rouge + symboles ✓/✗ appliqués.');
