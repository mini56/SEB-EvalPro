const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

// SEB_MINISTRAL_DETERMINISTIC_REWRITE_V1
const MODEL_FILE = 'Ministral-3-8B-Instruct-2512-Q4_K_M.gguf';
const MODEL_LABEL = 'Ministral 3 8B Instruct Q4_K_M';
const RUNTIME_LABEL = 'llama.cpp b10964';
const MAX_INPUT_CHARS = 18000;
const START_TIMEOUT_MS = 240000;
const REQUEST_TIMEOUT_MS = 600000;

function createLocalAiService({ app }) {
  let serverProcess = null;
  let serverPort = 0;
  let startPromise = null;
  let lastLogs = '';
  let lastExitCode = null;
  let lastStartError = '';
  const activeRequests = new Set();

  function runtimeDir() {
    if (!app.isPackaged) return path.join(__dirname, '..', 'ai-runtime');
    const programData = process.env.ProgramData || process.env.PROGRAMDATA || 'C:\\ProgramData';
    return path.join(programData, 'SEB EvalPro', 'IA');
  }

  function runtimePaths() {
    const dir = runtimeDir();
    return {
      dir,
      server: path.join(dir, process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'),
      model: path.join(dir, MODEL_FILE)
    };
  }

  function hardwareInfo() {
    const totalRamGb = Math.round((os.totalmem() / 1073741824) * 10) / 10;
    const logicalCpus = Math.max(1, (os.cpus() || []).length || 1);
    return { totalRamGb, logicalCpus };
  }

  function status() {
    const p = runtimePaths();
    const available = fs.existsSync(p.server) && fs.existsSync(p.model);
    return {
      available,
      running: !!serverProcess && !serverProcess.killed,
      offline: true,
      model: MODEL_LABEL,
      runtime: RUNTIME_LABEL,
      ...hardwareInfo(),
      error: available ? '' : 'Pack IA Ministral absent ou incomplet. Installez le Pack IA une seule fois sur ce PC Administrateur.'
    };
  }

  function findFreePort() {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.unref();
      srv.once('error', reject);
      srv.listen(0, '127.0.0.1', () => {
        const address = srv.address();
        const port = address && typeof address === 'object' ? Number(address.port) : 0;
        srv.close((error) => error ? reject(error) : resolve(port));
      });
    });
  }

  function requestJson(method, requestPath, body, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const payload = body == null ? null : Buffer.from(JSON.stringify(body), 'utf8');
      const req = http.request({
        host: '127.0.0.1',
        port: serverPort,
        path: requestPath,
        method,
        headers: payload ? {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': payload.length
        } : {},
        timeout: timeoutMs
      }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if ((res.statusCode || 500) >= 400) {
            reject(new Error(`IA locale HTTP ${res.statusCode}: ${raw.slice(0, 500)}`));
            return;
          }
          try { resolve(raw ? JSON.parse(raw) : {}); }
          catch (_) { reject(new Error('Réponse JSON invalide du moteur IA local.')); }
        });
      });
      activeRequests.add(req);
      req.once('close', () => activeRequests.delete(req));
      req.on('timeout', () => req.destroy(new Error('Délai dépassé pour le moteur IA local.')));
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  function runtimeDependencyMessage() {
    const exitCode = Number(lastExitCode);
    const missingDll = exitCode === -1073741515 || exitCode === 3221225781;
    if (missingDll || /VCRUNTIME|MSVCP|Visual C\+\+/i.test(lastLogs + ' ' + lastStartError)) {
      return 'Le composant Microsoft Visual C++ x64 requis par l’IA locale est absent ou endommagé. Réinstallez SEB EvalPro afin de réparer ce composant.';
    }
    return '';
  }

  async function waitUntilReady(deadline) {
    let lastError = null;
    while (Date.now() < deadline) {
      if (!serverProcess || serverProcess.killed) break;
      try {
        const health = await requestJson('GET', '/health', null, 2500);
        if (health && String(health.status || '').toLowerCase().includes('ok')) return true;
        if (health && (health.status === 'ok' || health.status === 'ready')) return true;
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const dependencyMessage = runtimeDependencyMessage();
    if (dependencyMessage) throw new Error(dependencyMessage);
    if (lastStartError) throw new Error('Le moteur IA local n’a pas pu démarrer. ' + lastStartError);
    throw new Error('Le modèle IA local n’a pas pu démarrer.' + (lastError ? ` ${lastError.message}` : ''));
  }

  async function ensureStarted() {
    if (serverProcess && !serverProcess.killed && serverPort) return true;
    if (startPromise) return startPromise;

    startPromise = (async () => {
      const p = runtimePaths();
      if (!fs.existsSync(p.server) || !fs.existsSync(p.model)) {
        throw new Error('Pack IA Ministral absent ou incomplet. Installez le Pack IA sur ce PC Administrateur.');
      }

      serverPort = await findFreePort();
      const threads = Math.max(1, Math.min(8, Math.max(1, hardwareInfo().logicalCpus - 1)));
      const args = [
        '--model', p.model,
        '--host', '127.0.0.1',
        '--port', String(serverPort),
        '--ctx-size', '4096',
        '--threads', String(threads),
        '--n-gpu-layers', '0'
      ];

      lastLogs = '';
      lastExitCode = null;
      lastStartError = '';
      serverProcess = spawn(p.server, args, {
        cwd: p.dir,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const capture = (chunk) => {
        lastLogs = (lastLogs + String(chunk || '')).slice(-8000);
      };
      const spawnedProcess = serverProcess;
      serverProcess.stdout?.on('data', capture);
      serverProcess.stderr?.on('data', capture);
      serverProcess.on('error', (error) => {
        lastStartError = String(error && error.message ? error.message : error || '');
        capture(lastStartError);
        if (serverProcess === spawnedProcess) {
          serverProcess = null;
          serverPort = 0;
        }
      });
      serverProcess.on('exit', (code) => {
        lastExitCode = code;
        if (serverProcess === spawnedProcess) {
          serverProcess = null;
          serverPort = 0;
        }
      });

      await waitUntilReady(Date.now() + START_TIMEOUT_MS);
      return true;
    })().finally(() => { startPromise = null; });

    return startPromise;
  }

  function cancelCurrent(reason = 'Fermeture du candidat') {
    const message = 'Génération IA annulée : ' + String(reason || 'fermeture du candidat') + '.';
    let requestsCancelled = 0;
    for (const req of Array.from(activeRequests)) {
      try {
        requestsCancelled += 1;
        req.destroy(new Error(message));
      } catch (_) {}
    }
    activeRequests.clear();

    const processToStop = serverProcess;
    let processStopped = false;
    try {
      if (processToStop && !processToStop.killed) {
        processToStop.kill();
        processStopped = true;
      }
    } catch (_) {}
    if (serverProcess === processToStop) {
      serverProcess = null;
      serverPort = 0;
    }

    return {
      ok: true,
      cancelled: requestsCancelled > 0 || processStopped,
      requestsCancelled,
      processStopped,
      offline: true
    };
  }

  function cleanModelOutput(raw) {
    let text = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    text = text.replace(/^```(?:text|markdown)?\s*/i, '').replace(/\s*```$/i, '').trim();
    text = text.replace(/^\s*(?:Version reformulée|Synthèse reformulée)\s*:\s*/i, '').trim();
    return text;
  }

  function validateRewrite(source, output) {
    if (!output) throw new Error('L’IA locale n’a produit aucun texte.');
    const ratio = output.length / Math.max(1, source.length);
    if (ratio < 0.55 || ratio > 1.55) {
      throw new Error('La reformulation IA a trop modifié la longueur du bilan. Le texte sans IA est conservé.');
    }
    if (/<think>|```|^\s*[-*]\s+/mi.test(output)) {
      throw new Error('La réponse IA contient un format inattendu. Le texte sans IA est conservé.');
    }
    const sourceDigits = new Set((source.match(/\d+/g) || []));
    const outputDigits = output.match(/\d+/g) || [];
    if (outputDigits.some((n) => !sourceDigits.has(n))) {
      throw new Error('La reformulation IA a ajouté une donnée chiffrée. Le texte sans IA est conservé.');
    }
    if (/n[’']ayant pas été évalu|non évalu/i.test(source) && !/(?:pas|non)[^.!?]{0,45}évalu/i.test(output)) {
      throw new Error('La reformulation IA ne conserve pas clairement un élément non évalué.');
    }
    if (/(abandonn|interromp)/i.test(source) && !/(abandonn|interromp)/i.test(output)) {
      throw new Error('La reformulation IA ne conserve pas clairement l’activité interrompue.');
    }
    return output;
  }

  async function verifySemanticFidelity(source, output) {
    const system = [
      'Tu contrôles la fidélité sémantique d’une synthèse par rapport à sa source, phrase par phrase et compétence par compétence.',
      'Ignore les différences de style, de vocabulaire, de synonymes et de structure uniquement si elles conservent exactement le même fait ET le même degré d’appréciation.',
      'Accepte par exemple « travail minutieux » et « réalisation soignée », ou « capacité à identifier » et « aptitude à repérer » : ce sont des équivalences de sens.',
      'Rejette toute intensification, atténuation ou généralisation absente de la source. Un fait correct ou conforme ne doit pas devenir remarquable, irréprochable, strict, systématique, pleinement maîtrisé ou d’une grande précision si ce degré n’est pas explicitement présent.',
      'Rejette aussi toute réserve inventée : si la source dit seulement qu’une découpe est irrégulière ou incomplète, la synthèse ne peut pas ajouter qu’elle est généralement conforme.',
      'Rejette si la synthèse ajoute ou supprime un fait, inverse une réussite et une difficulté, déplace une observation vers une autre compétence, modifie un abandon ou un élément non évalué, invente une donnée chiffrée, ou ajoute une qualité personnelle, une émotion, une motivation, un diagnostic, une orientation ou une recommandation absente de la source.',
      'Ne rejette pas une phrase simplement parce qu’elle regroupe deux compétences différentes, à condition que chaque compétence conserve son propre résultat sans contamination.',
      'Réponds uniquement OK si tous les faits et leur intensité sont conservés. Sinon réponds REJET: suivi d’une raison très courte indiquant le changement de sens.'
    ].join(' ');
    const user = '<source>\n' + source + '\n</source>\n\n<synthese>\n' + output + '\n</synthese>';
    const body = {
      model: MODEL_FILE,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0,
      top_p: 0.8,
      max_tokens: 120,
      seed: 42,
      stream: false
    };
    const response = await requestJson('POST', '/v1/chat/completions', body, REQUEST_TIMEOUT_MS);
    const verdict = cleanModelOutput(response?.choices?.[0]?.message?.content || '').trim();
    if (!/^OK\b/i.test(verdict)) {
      throw new Error('Le contrôle de sens SEB-IA a refusé la reformulation : ' + (verdict || 'écart factuel détecté.'));
    }
    return true;
  }

  async function rewrite(text) {
    const source = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!source) return { ok: false, error: 'La synthèse sans IA est vide.' };
    if (source.length > MAX_INPUT_CHARS) return { ok: false, error: 'La synthèse est trop longue pour ce prototype IA.' };

    // L’identité n’est pas un élément stylistique : elle reste strictement déterministe.
    // On la retire de la partie confiée au modèle puis on la réinsère telle quelle.
    const introMatch = source.match(/^([^\n]{1,240}a participé aux mises en situation proposées au cours du plateau technique\.)\s*/i);
    const fixedIntro = introMatch ? introMatch[1].trim() : '';
    const rewriteSource = introMatch ? source.slice(introMatch[0].length).trim() : source;

    const startedAt = Date.now();
    try {
      await ensureStarted();
      const system = [
        'Tu es un rédacteur professionnel de bilans d’évaluation socioprofessionnelle en français.',
        'À partir d’un brouillon factuellement validé, rédige une synthèse naturelle, fluide et professionnelle. Évite un style mécanique ou répétitif.',
        'Tu peux varier librement le vocabulaire, employer des synonymes, modifier la structure des phrases et les connecteurs, tant que le sens reste strictement équivalent.',
        'Chaque idée de ta réponse doit être directement justifiée par le brouillon. N’ajoute aucune intensité, qualité, interprétation ou conclusion qui n’y figure pas.',
        'Conserve aussi le degré exact des observations : « correct », « conforme » ou « satisfaisant » ne doivent pas devenir « remarquable », « irréprochable », « systématique », « pleinement maîtrisé » ou « de grande précision ». À l’inverse, ne minimise pas une difficulté.',
        'N’ajoute jamais une réserve positive ou négative absente : une découpe décrite comme irrégulière ou incomplète ne devient pas « généralement conforme », et une réussite simple ne devient pas une performance supérieure.',
        'Une réussite doit rester une réussite. Une difficulté doit rester une difficulté et rester rattachée à la compétence où elle a été observée. Ne déplace jamais une observation vers un autre domaine.',
        'Ne déduis ni potentiel, ni personnalité, ni état émotionnel, ni engagement, ni motivation, ni diagnostic, ni orientation ou recommandation.',
        'Les éléments non évalués, abandonnés ou interrompus doivent rester clairement identifiables lorsqu’ils figurent dans le brouillon. N’invente et ne modifie aucune donnée chiffrée.',
        'Exemples de reformulations équivalentes autorisées : « travail minutieux » peut devenir « réalisation soignée » ; « capacité à identifier » peut devenir « aptitude à repérer ».',
        'Exemples de changements de sens interdits : « a participé » ne doit pas devenir « s’est pleinement investi » ou « a démontré son engagement » ; « conforme aux consignes » ne doit pas devenir « rigoureux », « précis » ou « scrupuleux » si ces qualités ne sont pas observées ; « réalisé de manière adaptée » ne doit pas devenir « méthode efficace » ; « rythme satisfaisant » ne doit pas devenir « rythme soutenu ».',
        'Tu peux regrouper ou relier des observations proches pour améliorer la lecture, à condition de ne rien omettre et de ne pas mélanger des compétences dont les résultats diffèrent.',
        'Corrige l’orthographe, la grammaire et la formulation des textes libres sans en changer le sens.',
        'Conserve globalement l’ordre des grands domaines du brouillon. N’ajoute aucun titre, aucune liste, aucune note ni commentaire sur ta réponse.',
        'Retourne uniquement la synthèse reformulée en français.'
      ].join(' ');
      const user = `Reformule uniquement le texte compris entre <bilan> et </bilan>.\n\n<bilan>\n${rewriteSource}\n</bilan>`;

      const body = {
        model: MODEL_FILE,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.30,
        top_p: 0.8,
        max_tokens: 1500,
        seed: 42,
        stream: false
      };

      const response = await requestJson('POST', '/v1/chat/completions', body, REQUEST_TIMEOUT_MS);
      const raw = response?.choices?.[0]?.message?.content || '';
      const rewrittenBody = cleanModelOutput(raw);
      const output = validateRewrite(source, fixedIntro ? fixedIntro + '\n\n' + rewrittenBody : rewrittenBody);
      await verifySemanticFidelity(source, output);
      return {
        ok: true,
        text: output,
        elapsedMs: Date.now() - startedAt,
        model: MODEL_LABEL,
        runtime: RUNTIME_LABEL,
        offline: true
      };
    } catch (error) {
      return {
        ok: false,
        error: String(error?.message || error || 'Erreur IA locale.'),
        details: lastLogs.slice(-1500),
        elapsedMs: Date.now() - startedAt,
        model: MODEL_LABEL,
        offline: true
      };
    }
  }

  function stop() {
    cancelCurrent('Arrêt de SEB EvalPro');
  }

  return { status, rewrite, cancelCurrent, stop };
}

module.exports = { createLocalAiService };
