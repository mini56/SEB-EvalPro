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

  async function rewrite(text) {
    const source = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!source) return { ok: false, error: 'La synthèse sans IA est vide.' };
    if (source.length > MAX_INPUT_CHARS) return { ok: false, error: 'La synthèse est trop longue pour ce prototype IA.' };

    const startedAt = Date.now();
    try {
      await ensureStarted();
      const system = [
        'Tu es un rédacteur professionnel de bilans d’évaluation socioprofessionnelle en français.',
        'À partir d’un brouillon factuellement validé, rédige une synthèse naturelle, fluide et professionnelle. Le texte doit sonner humain et éviter une formulation mécanique ou répétitive.',
        'Tu peux varier librement le vocabulaire, utiliser des synonymes, modifier la structure des phrases et les connecteurs, tant que le sens des observations reste strictement le même.',
        'La première phrase du brouillon doit être conservée mot pour mot afin de préserver exactement l’identité du candidat.',
        'Ne crée aucun fait qui n’existe pas dans le brouillon. Ne déduis ni potentiel, ni personnalité, ni état émotionnel, ni motivation, ni diagnostic, ni orientation ou recommandation.',
        'Une réussite doit rester une réussite. Une difficulté doit rester une difficulté et rester rattachée à la compétence où elle a été observée. Ne déplace jamais une observation vers un autre domaine.',
        'Les éléments non évalués, abandonnés ou interrompus doivent rester clairement identifiables lorsqu’ils figurent dans le brouillon.',
        'N’invente et ne modifie aucune donnée chiffrée.',
        'Une reformulation équivalente est autorisée : par exemple « travail minutieux » peut devenir « réalisation soignée », et « capacité à identifier » peut devenir « aptitude à repérer » si aucune idée supplémentaire n’est ajoutée.',
        'Tu peux regrouper ou relier des observations proches lorsque cela améliore la lecture, à condition de ne rien omettre et de ne pas mélanger des compétences dont les résultats diffèrent.',
        'Corrige l’orthographe, la grammaire et la formulation des textes libres sans en changer le sens.',
        'Varie les formulations et les enchaînements afin que la synthèse ne ressemble pas à une succession de phrases standardisées.',
        'Conserve globalement l’ordre des grands domaines du brouillon. N’ajoute aucun titre, aucune liste, aucune note ni commentaire sur ta réponse.',
        'Retourne uniquement la synthèse reformulée en français.'
      ].join(' ');
      const user = `Reformule uniquement le texte compris entre <bilan> et </bilan>.\n\n<bilan>\n${source}\n</bilan>`;

      const body = {
        model: MODEL_FILE,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.45,
        top_p: 0.8,
        max_tokens: 1500,
        seed: 42,
        stream: false
      };

      const response = await requestJson('POST', '/v1/chat/completions', body, REQUEST_TIMEOUT_MS);
      const raw = response?.choices?.[0]?.message?.content || '';
      const output = validateRewrite(source, cleanModelOutput(raw));
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
