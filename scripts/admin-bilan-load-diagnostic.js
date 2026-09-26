const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const webRoot = path.join(__dirname, '..', 'app', 'web');
const originalPath = path.join(webRoot, 'admin-bilan.html');
const original = fs.readFileSync(originalPath, 'utf8');

const scriptSrcs = Array.from(original.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/gi)).map(m => m[1]);

function variantHtml(count) {
  let seen = 0;
  return original.replace(/<script[^>]+src="([^"]+)"[^>]*><\/script>/gi, (tag) => {
    seen += 1;
    return seen <= count ? tag : '<!-- diagnostic script removed -->';
  });
}

async function testVariant(count) {
  const file = path.join(webRoot, 'admin-bilan-diagnostic-' + count + '.html');
  fs.writeFileSync(file, variantHtml(count), 'utf8');

  const win = new BrowserWindow({
    show:false,
    width:1000,
    height:700,
    webPreferences:{
      preload:path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation:true,
      nodeIntegration:false,
      sandbox:false
    }
  });

  const started = Date.now();
  try {
    const load = win.loadFile(file);
    const result = await Promise.race([
      load.then(() => ({ ok:true })),
      new Promise(resolve => setTimeout(() => resolve({ ok:false, timeout:true }), 8000))
    ]);
    if (!result.ok) {
      try { win.webContents.stop(); } catch (_) {}
      console.log('ADMIN_LOAD_VARIANT count=' + count + ' scripts=' + JSON.stringify(scriptSrcs.slice(0,count)) + ' RESULT=TIMEOUT ms=' + (Date.now()-started));
      return false;
    }
    console.log('ADMIN_LOAD_VARIANT count=' + count + ' scripts=' + JSON.stringify(scriptSrcs.slice(0,count)) + ' RESULT=OK ms=' + (Date.now()-started));
    return true;
  } catch (error) {
    console.log('ADMIN_LOAD_VARIANT count=' + count + ' scripts=' + JSON.stringify(scriptSrcs.slice(0,count)) + ' RESULT=ERROR ' + String(error && error.message || error));
    return false;
  } finally {
    try { win.destroy(); } catch (_) {}
    try { fs.unlinkSync(file); } catch (_) {}
  }
}

app.whenReady().then(async () => {
  console.log('ADMIN_DIAG_SCRIPTS=' + JSON.stringify(scriptSrcs));
  for (let count = 0; count <= scriptSrcs.length; count += 1) {
    const ok = await testVariant(count);
    if (!ok) {
      console.log('ADMIN_DIAG_FIRST_FAILURE=' + count + ' culprit=' + JSON.stringify(scriptSrcs[count-1] || 'PRELOAD_OR_HTML'));
      app.exit(2);
      return;
    }
  }
  console.log('ADMIN_DIAG_ALL_VARIANTS=OK');
  app.exit(0);
});
