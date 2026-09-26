const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
function fail(m){console.error('SEB EvalPro garde HTML source: '+m);process.exit(2)}
function walk(d){let out=[];if(!fs.existsSync(d))return out;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())out=out.concat(walk(p));else if(/\.html?$/i.test(e.name))out.push(p)}return out}
for(const base of ['source','overrides'])for(const f of walk(path.join(root,base))){const h=fs.readFileSync(f,'utf8');if(/<script(?![^>]*\bsrc=)[^>]*>/i.test(h))fail(path.relative(root,f)+': script inline');if(/\son[a-z]+\s*=/i.test(h))fail(path.relative(root,f)+': événement inline');if(/href\s*=\s*["']javascript:/i.test(h))fail(path.relative(root,f)+': javascript:')}
console.log('SEB EvalPro garde HTML source: source/ et overrides/ sans JavaScript inline — OK.');
