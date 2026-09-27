const { app, BrowserWindow } = require('electron');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = path.join(root, 'app', 'web', 'qcmv1.0.html');

function fail(message, detail) {
  console.error('QCM_PAGE4_FUNCTIONAL_SMOKE: FAIL — ' + message);
  if (detail) console.error(detail);
  app.exit(2);
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForPage(win) {
  for (let i = 0; i < 140; i += 1) {
    const ready = await win.webContents.executeJavaScript(
      "Boolean(window.sebQcmPage4 && window.sebParcours && document.querySelectorAll('#page4 .items-wrapper[data-fraction]').length === 3)",
      true
    );
    if (ready) return;
    await sleep(50);
  }
  throw new Error('Contrôleur Page 4 non initialisé.');
}

async function loadPage(win) {
  await win.loadFile(page, { query:{ page:'4' }, hash:'page4' });
  await waitForPage(win);
  for (let i = 0; i < 80; i += 1) {
    const visible = await win.webContents.executeJavaScript(
      "document.getElementById('page4').classList.contains('visible')", true
    );
    if (visible) return;
    await sleep(40);
  }
  throw new Error('Page 4 non visible après chargement.');
}

async function clearState(win) {
  await win.webContents.executeJavaScript(`
    [
      'reponses_data','scores_data','seb_evalpro_qcm_page4_state',
      'seb_evalpro_qcm_drafts'
    ].forEach(function(key){ sessionStorage.removeItem(key); });
    true;
  `, true);
  await win.reload();
  await waitForPage(win);
  await sleep(160);
}

function roundedPositions(raw) {
  const list = raw && raw['2/8'] ? raw['2/8'] : [];
  return list.map((p) => ({
    x:Math.round(Number(p.x || 0) * 10000) / 10000,
    y:Math.round(Number(p.y || 0) * 10000) / 10000
  }));
}

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show:false,width:1600,height:900,
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false}
  });

  try {
    await loadPage(win);
    await clearState(win);

    const initial = await win.webContents.executeJavaScript(`
      (function(){
        const wrappers=Array.from(document.querySelectorAll('#page4 .items-wrapper[data-fraction]'));
        const infos=wrappers.map(function(w){return window.sebQcmPage4.fractionInfo(w);});
        const cloud=document.querySelector('#page4 .items-wrapper[data-fraction="2/8"]');
        const items=Array.from(cloud.querySelectorAll('.item'));
        const size=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--item-size'))||80;
        let overlap=false;
        for(let i=0;i<items.length;i++){
          const ax=parseFloat(items[i].style.left)||0, ay=parseFloat(items[i].style.top)||0;
          for(let j=i+1;j<items.length;j++){
            const bx=parseFloat(items[j].style.left)||0, by=parseFloat(items[j].style.top)||0;
            if(Math.abs(ax-bx)<size+6 && Math.abs(ay-by)<size+6) overlap=true;
          }
        }
        return {
          fractions:infos.map(function(i){return i.fraction;}),
          totals:infos.map(function(i){return i.total;}),
          expected:infos.map(function(i){return i.expected;}),
          route:window.sebParcours.nextUrl('qcm-4'),
          cloudCount:items.length,
          cloudAbsolute:items.every(function(item){return item.style.position==='absolute';}),
          cloudOverlap:overlap,
          positions:window.sebQcmPage4.collectCloudPositions()
        };
      })()
    `, true);

    if (JSON.stringify(initial.fractions) !== JSON.stringify(['3/4','1/2','2/8'])) {
      throw new Error('Fractions Page 4 incorrectes.');
    }
    if (JSON.stringify(initial.totals) !== JSON.stringify([4,6,12]) ||
        JSON.stringify(initial.expected) !== JSON.stringify([3,3,3])) {
      throw new Error('Calcul fraction -> quantité incorrect.');
    }
    if (initial.route !== 'qcmv1.0.html?page=5#page5') throw new Error('Route Page 4 -> Page 5 incorrecte.');
    if (initial.cloudCount !== 12 || !initial.cloudAbsolute || initial.cloudOverlap) {
      throw new Error('Nuage initial Page 4 incorrect.');
    }

    await win.webContents.executeJavaScript(`
      (function(){
        const items=Array.from(document.querySelector('#page4 .items-wrapper[data-fraction="3/4"]').querySelectorAll('.item'));
        items[0].click();
        items[1].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
        items[2].dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));
        return true;
      })()
    `, true);
    await sleep(160);

    const selected = await win.webContents.executeJavaScript(`
      (function(){
        const wrapper=document.querySelector('#page4 .items-wrapper[data-fraction="3/4"]');
        const items=Array.from(wrapper.querySelectorAll('.item'));
        const state=JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_page4_state')||'null');
        return {
          selected:items.filter(function(item){return item.classList.contains('selected');}).length,
          aria:items.slice(0,3).map(function(item){return item.getAttribute('aria-pressed');}),
          state,
          positions:window.sebQcmPage4.collectCloudPositions()
        };
      })()
    `, true);

    if (selected.selected !== 3 || selected.aria.some(function(v){return v!=='true';}) || !selected.state) {
      throw new Error('Sélection clic/clavier ou aria-pressed incorrecte.');
    }

    const beforeReloadPositions = roundedPositions(selected.positions);

    await win.reload();
    await waitForPage(win);
    await sleep(180);

    const restored = await win.webContents.executeJavaScript(`
      (function(){
        const wrapper=document.querySelector('#page4 .items-wrapper[data-fraction="3/4"]');
        return {
          selected:wrapper.querySelectorAll('.item.selected').length,
          positions:window.sebQcmPage4.collectCloudPositions(),
          response:sessionStorage.getItem('reponses_data'),
          score:sessionStorage.getItem('scores_data')
        };
      })()
    `, true);

    if (restored.selected !== 3) throw new Error('Sélections Page 4 perdues après rechargement.');
    const afterReloadPositions = roundedPositions(restored.positions);
    if (JSON.stringify(beforeReloadPositions) !== JSON.stringify(afterReloadPositions)) {
      throw new Error('Positions du nuage Page 4 perdues après rechargement.');
    }
    if (restored.response !== null || restored.score !== null) {
      throw new Error('Brouillon Page 4 validé avant navigation.');
    }

    const partial = await win.webContents.executeJavaScript("window.sebQcmPage4.save('pass')", true);
    if (!partial || partial.score !== 1 || partial.total !== 3) {
      throw new Error('Score partiel Page 4 incorrect.');
    }

    const partialStored = await win.webContents.executeJavaScript(`
      (function(){
        const r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');
        const s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');
        return {page4:r.page4,score:s.page4,marker:r['4'],markerScore:s['4']};
      })()
    `, true);
    if (partialStored.page4 !== '1/3' || partialStored.score !== 1 ||
        partialStored.marker !== 'Mauvaise' || partialStored.markerScore !== 0) {
      throw new Error('Contrat historique Page 4 partiel incorrect.');
    }

    const beforeResize = await win.webContents.executeJavaScript(`
      (function(){
        const state=JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_page4_state')||'{}');
        return {savedAt:state.savedAt||0};
      })()
    `, true);
    await win.webContents.executeJavaScript("window.dispatchEvent(new Event('resize')); true", true);
    await sleep(320);

    const resize = await win.webContents.executeJavaScript(`
      (function(){
        const cloud=document.querySelector('#page4 .items-wrapper[data-fraction="2/8"]');
        const items=Array.from(cloud.querySelectorAll('.item'));
        const size=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--item-size'))||80;
        let overlap=false;
        for(let i=0;i<items.length;i++){
          const ax=parseFloat(items[i].style.left)||0, ay=parseFloat(items[i].style.top)||0;
          for(let j=i+1;j<items.length;j++){
            const bx=parseFloat(items[j].style.left)||0, by=parseFloat(items[j].style.top)||0;
            if(Math.abs(ax-bx)<size+6 && Math.abs(ay-by)<size+6) overlap=true;
          }
        }
        const state=JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_page4_state')||'{}');
        return {
          overlap,
          savedAt:state.savedAt||0,
          stored:state.positions&&state.positions['2/8']?state.positions['2/8'].length:0,
          current:window.sebQcmPage4.collectCloudPositions()['2/8'].length
        };
      })()
    `, true);

    if (resize.overlap || resize.stored !== 12 || resize.current !== 12 || resize.savedAt < beforeResize.savedAt) {
      throw new Error('Redistribution/sauvegarde du nuage au redimensionnement incorrecte.');
    }

    await clearState(win);
    await win.webContents.executeJavaScript(`
      sessionStorage.setItem('reponses_data', JSON.stringify({
        page2_q1:'1020',page2_1_q6:'10',page3_q1:'9h15',
        pageTexteTrous:[{user:'professionnelle',correct:'professionnelle'}]
      }));
      sessionStorage.setItem('scores_data', JSON.stringify({
        page2_q1:1,page2_1_q6:1,page3_q1:1,pageTexteTrous:15
      }));
      true;
    `, true);
    await win.reload();
    await waitForPage(win);
    await sleep(160);

    const perfect = await win.webContents.executeJavaScript(`
      (function(){
        document.querySelectorAll('#page4 .items-wrapper[data-fraction]').forEach(function(wrapper){
          Array.from(wrapper.querySelectorAll('.item')).slice(0,3).forEach(function(item){
            if(!item.classList.contains('selected')) item.click();
          });
        });
        return window.sebQcmPage4.save('next');
      })()
    `, true);

    if (!perfect || perfect.score !== 3 || perfect.total !== 3) {
      throw new Error('Page 4 parfaite n’obtient pas 3/3.');
    }
    if (!perfect.details['3/4'].correct || !perfect.details['1/2'].correct || !perfect.details['2/8'].correct) {
      throw new Error('Une fraction parfaite est marquée incorrecte.');
    }

    const preserved = await win.webContents.executeJavaScript(`
      (function(){
        const r=JSON.parse(sessionStorage.getItem('reponses_data')||'{}');
        const s=JSON.parse(sessionStorage.getItem('scores_data')||'{}');
        return {
          p2:r.page2_q1,p21:r.page2_1_q6,p3:r.page3_q1,
          text:Array.isArray(r.pageTexteTrous)?r.pageTexteTrous.length:0,
          p2s:s.page2_q1,p21s:s.page2_1_q6,p3s:s.page3_q1,texts:s.pageTexteTrous,
          page4:r.page4,score:s.page4,marker:r['4'],markerScore:s['4'],
          route:window.sebParcours.nextUrl('qcm-4')
        };
      })()
    `, true);

    if (preserved.p2 !== '1020' || preserved.p21 !== '10' || preserved.p3 !== '9h15' ||
        preserved.text !== 1 || preserved.p2s !== 1 || preserved.p21s !== 1 ||
        preserved.p3s !== 1 || preserved.texts !== 15) {
      throw new Error('Page 4 écrase les données précédentes.');
    }
    if (preserved.page4 !== '3/3' || preserved.score !== 3 ||
        preserved.marker !== 'Bonne' || preserved.markerScore !== 1 ||
        preserved.route !== 'qcmv1.0.html?page=5#page5') {
      throw new Error('Contrat parfait Page 4 incorrect.');
    }

    await win.webContents.executeJavaScript("document.getElementById('page4Next').click(); true", true);
    let navigated=false;
    for(let i=0;i<140;i+=1){
      try{
        const state=await win.webContents.executeJavaScript(`
          ({search:location.search,visible:Boolean(document.getElementById('page5')?.classList.contains('visible'))})
        `,true);
        if(state.search.includes('page=5')&&state.visible){navigated=true;break;}
      }catch(_){}
      await sleep(50);
    }
    if(!navigated) throw new Error('Navigation réelle Page 4 -> Page 5 échouée.');

    console.log('QCM_PAGE4_FUNCTIONAL_SMOKE: OK');
    console.log('QCM_PAGE4_FRACTIONS=3/4_1/2_2/8');
    console.log('QCM_PAGE4_EXPECTED_COUNTS=3_3_3');
    console.log('QCM_PAGE4_CLICK_ENTER_SPACE=OK');
    console.log('QCM_PAGE4_ARIA_PRESSED=OK');
    console.log('QCM_PAGE4_DRAFT_SELECTION_RESUME=OK');
    console.log('QCM_PAGE4_CLOUD_POSITION_RESUME=OK');
    console.log('QCM_PAGE4_CLOUD_RESIZE_NO_OVERLAP=OK');
    console.log('QCM_PAGE4_PARTIAL=1/3');
    console.log('QCM_PAGE4_PERFECT=3/3');
    console.log('QCM_PAGE4_PRESERVES_PREVIOUS_DATA=OK');
    console.log('QCM_PAGE4_ROUTE=qcmv1.0.html?page=5#page5');
    win.destroy();
    app.exit(0);
  } catch (error) {
    try { if (!win.isDestroyed()) win.destroy(); } catch (_) {}
    fail(error && error.message ? error.message : String(error), error && error.stack ? error.stack : '');
  }
}).catch((error) => fail('Electron initialization failed', error && error.stack ? error.stack : String(error)));

setTimeout(() => fail('Timeout global du smoke test QCM Page 4.'), 65000);
