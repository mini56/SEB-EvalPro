const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const preload = fs.readFileSync(path.join(root, 'src', 'preload.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const branding = fs.readFileSync(path.join(root, 'scripts', 'generate-installer-branding.ps1'), 'utf8');

function fail(message) {
  console.error('SEB EvalPro garde numéro de build: ' + message);
  process.exit(1);
}

const buildNumber = String(pkg.sebBuildNumber == null ? '' : pkg.sebBuildNumber).trim();
if (!/^\d+$/.test(buildNumber)) fail('sebBuildNumber doit être un entier dans package.json.');
if (/Build\s*#\s*\d+/.test(preload)) fail('numéro de build codé en dur dans src/preload.js.');
if (!preload.includes("const APP_BUILD_NUMBER = String(appPackage.sebBuildNumber || '').trim() || 'DEV';")) {
  fail('la barre applicative ne lit pas sebBuildNumber depuis package.json.');
}
if (!preload.includes('${APP_BUILD_LABEL}')) fail('la barre applicative n’affiche pas APP_BUILD_LABEL.');
if (/buildNumber:\s*["']\d+["']/.test(main)) fail('numéro de build codé en dur dans src/main.js.');
if (!main.includes("const APP_BUILD_NUMBER = String(appPackage.sebBuildNumber || '').trim() || 'DEV';")) fail('main.js ne lit pas sebBuildNumber depuis package.json.');
if (!main.includes('buildNumber: APP_BUILD_NUMBER')) fail('Replay/Historique ne reçoivent pas le build central.');
if (/GITHUB_RUN_NUMBER|SEB_BUILD_NUMBER/.test(branding)) {
  fail('le branding installateur dépend encore du numéro de run GitHub.');
}
if (!branding.includes('$buildNumber = [string]$packageInfo.sebBuildNumber')) {
  fail('le branding installateur ne lit pas sebBuildNumber depuis package.json.');
}
console.log('SEB EvalPro garde numéro de build: Build #' + buildNumber + ' unique pour barre et installateur — OK.');
