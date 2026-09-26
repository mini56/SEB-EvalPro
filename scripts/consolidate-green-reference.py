import os,re,shutil,json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
GREEN=Path(os.environ.get('GREEN_REF_DIR','/tmp/greenref'))
source=ROOT/'source'
overrides=ROOT/'overrides'
src=ROOT/'src'
source.mkdir(exist_ok=True)
overrides.mkdir(exist_ok=True)

def copy_tree(srcdir,dstdir):
    for p in srcdir.rglob('*'):
        if p.is_file():
            rel=p.relative_to(srcdir)
            dest=dstdir/rel
            dest.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(p,dest)

copy_tree(GREEN/'src',src)

for p in (GREEN/'app'/'web').rglob('*'):
    if not p.is_file():
        continue
    rel=p.relative_to(GREEN/'app'/'web')
    if rel.as_posix() in ('admin-bilan.html','admin-candidats.html'):
        continue
    dest=source/rel
    dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(p,dest)

shutil.copy2(GREEN/'app'/'web'/'admin-candidats.html',overrides/'admin-candidats.html')

for pattern in [
    'qcm-runtime*.js','qcmv1.0-events.js','bilan-page.js','bilan-events.js',
    'brique-runtime*.js','brique-events.js','tri-runtime*.js',
    'introbrique-page.js','admin-bilan-runtime*.js','admin-bilan-events.js'
]:
    for p in (source/'js').glob(pattern):
        p.unlink()

SCRIPT_RE=re.compile(r'<script\b([^>]*)>([\s\S]*?)</script>',re.I)
EVENT_RE=re.compile(r'\s+(on[a-zA-Z]+)\s*=\s*(["\'])(.*?)\2',re.S)
SRC_RE=re.compile(r'\bsrc\s*=\s*(["\'])(.*?)\1',re.I|re.S)

def runtime_names(stem,count):
    mapping={
        'qcmv1.0':['qcm-runtime.js','qcm-runtime-ui.js','qcm-runtime-tail.js'],
        'admin-bilan':['admin-bilan-runtime.js','admin-bilan-runtime-tail.js'],
        'bilan':['bilan-page.js'],
        'introbrique':['introbrique-page.js'],
        'brique':['brique-runtime.js','brique-runtime-tail.js'],
        'tri_de_cheville':['tri-runtime-tail.js']
    }
    names=list(mapping.get(stem,[]))
    while len(names)<count:
        names.append(f'{stem}-runtime-{len(names)+1:02d}.js')
    return names[:count]

def externalize_html(src_html,dest_html,jsdir):
    text=src_html.read_text(encoding='utf-8')
    stem=src_html.stem
    groups=[]
    pending=[]
    pieces=[]
    cursor=0
    for m in SCRIPT_RE.finditer(text):
        pieces.append(text[cursor:m.start()])
        attrs=m.group(1)
        body=m.group(2)
        if SRC_RE.search(attrs):
            if pending:
                idx=len(groups)
                groups.append('\n\n/* ---- migrated final runtime block ---- */\n\n'.join(x.strip('\n') for x in pending if x.strip()))
                pieces.append(f'@@GROUP{idx}@@')
                pending=[]
            pieces.append(m.group(0))
        elif body.strip():
            pending.append(body)
        cursor=m.end()
    if pending:
        idx=len(groups)
        groups.append('\n\n/* ---- migrated final runtime block ---- */\n\n'.join(x.strip('\n') for x in pending if x.strip()))
        pieces.append(f'@@GROUP{idx}@@')
    pieces.append(text[cursor:])
    text=''.join(pieces)

    names=runtime_names(stem,len(groups))
    for idx,body in enumerate(groups):
        name=names[idx]
        (jsdir/name).write_text(body.rstrip()+'\n',encoding='utf-8')
        text=text.replace(f'@@GROUP{idx}@@',f'<script src="js/{name}"></script>')

    text=text.replace('button[onclick="window.openCalculator()"]','button[data-seb-action="open-calculator"]')
    text=text.replace("button[onclick='window.openCalculator()']",'button[data-seb-action="open-calculator"]')

    handlers=[]
    def evsub(m):
        evt=m.group(1)[2:].lower()
        code=m.group(3)
        hid=f'{stem.replace(".","-")}-{len(handlers)+1:03d}'
        handlers.append((evt,hid,code))
        extra=' data-seb-action="open-calculator"' if code.strip().rstrip(';')=='window.openCalculator()' else ''
        return f' data-seb-handler-{evt}="{hid}"'+extra

    text=EVENT_RE.sub(evsub,text)

    if handlers:
        event_name=f'{stem}-events.js'
        lines=["(function(){","  'use strict';","  function bind(){"]
        for evt,hid,code in handlers:
            var=hid.replace('-','_')
            attr=f'data-seb-handler-{evt}'
            lines += [
                f'    const el_{var} = document.querySelector(\'[{attr}="{hid}"]\');',
                f"    if (el_{var} && el_{var}.getAttribute('data-seb-bound') !== '1') {{",
                f"      el_{var}.setAttribute('data-seb-bound','1');",
                f"      el_{var}.addEventListener('{evt}', function(event) {{",
                "        const __result = (function(event){",
                '          '+code.replace('\n','\n          '),
                "        }).call(this,event);",
                "        if (__result === false) { event.preventDefault(); event.stopPropagation(); }",
                "      });",
                "    }"
            ]
        lines += ["  }","  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true }); else bind();","})();",""]
        (jsdir/event_name).write_text('\n'.join(lines),encoding='utf-8')
        tag=f'<script src="js/{event_name}"></script>\n'
        idx=text.lower().rfind('</body>')
        text=text[:idx]+tag+text[idx:] if idx>=0 else text+tag

    dest_html.parent.mkdir(parents=True,exist_ok=True)
    dest_html.write_text(text,encoding='utf-8')

jsdir=source/'js'
jsdir.mkdir(parents=True,exist_ok=True)

for name in ['qcmv1.0.html','bilan.html','brique.html','tri_de_cheville.html','introbrique.html']:
    externalize_html(GREEN/'app'/'web'/name,source/name,jsdir)

externalize_html(GREEN/'app'/'web'/'admin-bilan.html',overrides/'admin-bilan.html',jsdir)

for name in ['autoeval1.html','autoeval2.html','carre.html','dictee.html','genrenombres.html',
             'nvmail.html','nwtexte.html','paronymes.html','planning.html','stock.html']:
    shutil.copy2(GREEN/'app'/'web'/name,source/name)

prepare=r'''const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'source');
const overridesDir = path.join(root, 'overrides');
const outputDir = path.join(root, 'app', 'web');

function fail(message) {
  console.error('SEB EvalPro prepare:web: ' + message);
  process.exit(2);
}

function copyTree(source, destination, skipNames = new Set()) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (skipNames.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyTree(from, to, skipNames);
    else fs.copyFileSync(from, to);
  }
}

function htmlFiles(directory) {
  let out = [];
  if (!fs.existsSync(directory)) return out;
  for (const entry of fs.readdirSync(directory, { withFileTypes:true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) out = out.concat(htmlFiles(full));
    else if (/\.html?$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function assertCleanHtml(directory, label) {
  for (const file of htmlFiles(directory)) {
    const html = fs.readFileSync(file, 'utf8');
    if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) fail(label + ': script inline interdit dans ' + path.relative(root,file));
    if (/\son(?:click|change|input|submit|ended|load|error|blur|focus|keydown|keyup|keypress|mouseover|mouseout|mouseenter|mouseleave)\s*=/i.test(html)) {
      fail(label + ': événement inline interdit dans ' + path.relative(root,file));
    }
    if (/href\s*=\s*["']javascript:/i.test(html)) fail(label + ': URL javascript: interdite dans ' + path.relative(root,file));
  }
}

for (const required of ['qcmv1.0.html','bilan.html','dictee.html']) {
  if (!fs.existsSync(path.join(sourceDir,required))) fail('source obligatoire absente: ' + required);
}
for (const required of ['admin-bilan.html','admin-candidats.html']) {
  if (!fs.existsSync(path.join(overridesDir,required))) fail('override obligatoire absent: ' + required);
}

assertCleanHtml(sourceDir,'source');
assertCleanHtml(overridesDir,'overrides');

fs.rmSync(outputDir,{recursive:true,force:true});
fs.mkdirSync(outputDir,{recursive:true});
copyTree(sourceDir,outputDir,new Set(['QCM.lnk','README.md']));
copyTree(overridesDir,outputDir);
assertCleanHtml(outputDir,'app/web');

console.log('SEB EvalPro: app/web reconstruit par copie des sources canoniques, sans patch fonctionnel.');
'''
(ROOT/'scripts'/'prepare-web.js').write_text(prepare,encoding='utf-8')

htmlguard=r'''const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
function fail(m){console.error('SEB EvalPro garde HTML source: '+m);process.exit(2)}
function walk(d){let out=[];if(!fs.existsSync(d))return out;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())out=out.concat(walk(p));else if(/\.html?$/i.test(e.name))out.push(p)}return out}
for(const base of ['source','overrides'])for(const f of walk(path.join(root,base))){const h=fs.readFileSync(f,'utf8');if(/<script(?![^>]*\bsrc=)[^>]*>/i.test(h))fail(path.relative(root,f)+': script inline');if(/\son[a-z]+\s*=/i.test(h))fail(path.relative(root,f)+': événement inline');if(/href\s*=\s*["']javascript:/i.test(h))fail(path.relative(root,f)+': javascript:')}
console.log('SEB EvalPro garde HTML source: source/ et overrides/ sans JavaScript inline — OK.');
'''
(ROOT/'scripts'/'source-html-architecture-guard.js').write_text(htmlguard,encoding='utf-8')

qcm_read="read('app/web/qcmv1.0.html')"
qcm_combined="read('app/web/qcmv1.0.html') + '\\n' + read('app/web/js/qcm-runtime.js') + '\\n' + read('app/web/js/qcm-runtime-ui.js') + '\\n' + read('app/web/js/qcm-runtime-tail.js')"
for p in list((ROOT/'scripts').glob('*architecture-guard.js'))+[ROOT/'scripts'/'parcours-registry-guard.js']:
    s=p.read_text(encoding='utf-8')
    if qcm_read in s:
        p.write_text(s.replace(qcm_read,qcm_combined),encoding='utf-8')

p=ROOT/'scripts'/'build159-clean-regression-guard.js'
s=p.read_text(encoding='utf-8')
s=s.replace(
    "const admin = read('app/web/admin-bilan.html');\nconst qcm = read('app/web/qcmv1.0.html');",
    "const admin = read('app/web/admin-bilan.html') + '\\n' + read('app/web/js/admin-bilan-runtime.js') + '\\n' + read('app/web/js/admin-bilan-runtime-tail.js');\nconst qcm = read('app/web/qcmv1.0.html') + '\\n' + read('app/web/js/qcm-runtime.js') + '\\n' + read('app/web/js/qcm-runtime-ui.js') + '\\n' + read('app/web/js/qcm-runtime-tail.js');"
)
p.write_text(s,encoding='utf-8')

p=ROOT/'scripts'/'nwtexte-architecture-guard.js'
s=p.read_text(encoding='utf-8')
s=s.replace(
    "const bilan = read('app/web/admin-bilan.html');",
    "const bilan = read('app/web/admin-bilan.html') + '\\n' + read('app/web/js/admin-bilan-runtime.js') + '\\n' + read('app/web/js/admin-bilan-runtime-tail.js');"
)
p.write_text(s,encoding='utf-8')

pkg_path=ROOT/'package.json'
pkg=json.loads(pkg_path.read_text(encoding='utf-8'))
guards=[
'source-html-architecture-guard.js','build159-clean-regression-guard.js','build161-regression-guard.js',
'nwtexte-architecture-guard.js','parcours-registry-guard.js','nvmail-architecture-guard.js','autoeval2-architecture-guard.js',
'paronymes-architecture-guard.js','carre-architecture-guard.js','tri-architecture-guard.js','autoeval1-architecture-guard.js',
'brique-architecture-guard.js','stock-architecture-guard.js','planning-architecture-guard.js','genrenombres-architecture-guard.js',
'dictee-architecture-guard.js','qcm-final-architecture-guard.js','qcm-page2-architecture-guard.js','qcm-page2-1-architecture-guard.js',
'qcm-page3-architecture-guard.js','qcm-texte-trous-architecture-guard.js','qcm-page4-architecture-guard.js','qcm-page5-architecture-guard.js',
'qcm-page5-1-architecture-guard.js','qcm-page6-architecture-guard.js'
]
pkg['scripts']['prepare:web']='node scripts/prepare-web.js && '+' && '.join('node scripts/'+g for g in guards)
pkg_path.write_text(json.dumps(pkg,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

print('SEB EvalPro consolidation: green generated reference migrated into canonical source/src; functional patch chain removed from prepare:web.')
