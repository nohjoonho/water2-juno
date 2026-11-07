/* 대항해시대2 로컬 웹: original game files + user-supplied port auto-supply V3 patch.
 * Runtime is js-dos 6.22. Keep the original game's files and save slots isolated.
 * No trackers, analytics, logins, or network upload of saves.
 */
(() => {
  'use strict';
  const GAME = {
    corrected_auto: { enhanced:true, title: '교정판 v1.08 · 편의 기능 수정판 1', zip: 'mod_correction_v1.08_autosupply.zip', save: 'KOUKAI2.DAT' },
    original_auto:  { enhanced:true, title: '원작 · 편의 기능 수정판 1', zip: 'water2_autosupply.zip', save: 'KOUKAI2.DAT' },
    corrected:      { title: '버그·번역 교정판 v1.08', zip: 'mod_correction_v1.08.zip', save: 'KOUKAI2.DAT' },
    original:       { title: '대항해시대2 원작', zip: 'water2.zip', save: 'KOUKAI2.DAT' },
    ernst:          { title: '에르네스트 모드 v1.11', zip: 'mod_ernst_v1.11.zip', save: 'KOUKAI2.DAT', entry: 'PLAY.BAT' },
    junghwa:        { title: '정화편 v3.0', zip: 'mod_junghwa_v3.0.zip', save: 'CHENGHO.DAT' },
    eojeon1:        { title: '밀란다편 1', zip: 'mod_eojeon_161126_p1.zip', save: 'KOUKAI2.DAT' },
    eojeon2:        { title: '밀란다편 2', zip: 'mod_eojeon_161126_p2.zip', save: 'KOUKAI2.DAT' },
    eojeon3:        { title: '살바도르편', zip: 'mod_eojeon_161126_p3.zip', save: 'KOUKAI2.DAT' }
  };
  const $ = id => document.getElementById(id);
  const status = txt => { $('status').textContent = txt; };
  const indicator = txt => { $('saveIndicator').textContent = txt; };
  let commandInterface = null, conveniences = null;
  const optionDefaults={buildReduction:0,fastTravel:false};
  let convenienceOptions={...optionDefaults};
  try { const saved=JSON.parse(localStorage.getItem('UW2_conveniences')||'null');
    if(saved){convenienceOptions.buildReduction=[0,25,50,75,100].includes(saved.buildReduction)?saved.buildReduction:0;convenienceOptions.fastTravel=saved.fastTravel===true;}
  } catch(_) {}

  const heldKeys = new Set();
  const aliases = {KeyQ:111,KeyW:106,KeyE:109,KeyR:107,KeyU:103,KeyI:104,KeyO:105,KeyJ:100,KeyK:101,KeyL:102,KeyM:97,Comma:98,Period:99,ArrowLeft:100,ArrowUp:104,ArrowRight:102,ArrowDown:98,Enter:13};
  let fs = null, config = null, db = null, lastModified = null;
  let currentMode = null;
  const audioContexts = [];
  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (NativeAudioContext) {
    class TrackedAudioContext extends NativeAudioContext { constructor(...args){super(...args); audioContexts.push(this);} }
    window.AudioContext = TrackedAudioContext;
    if (window.webkitAudioContext) window.webkitAudioContext = TrackedAudioContext;
  }
  const audioFocus = async () => {
    if (!$('muteOnBlur').checked) return;
    const active = document.hasFocus() && !document.hidden;
    for(const ctx of audioContexts){
      try {
        if (!active && ctx.state === 'running') await ctx.suspend();
        if (active && ctx.state === 'suspended') await ctx.resume();
      } catch(_err) { /* audio engine may not allow resume outside user gesture */ }
    }
  };
  window.addEventListener('blur', audioFocus);
  window.addEventListener('focus', audioFocus);
  document.addEventListener('visibilitychange', audioFocus);
  $('muteOnBlur').addEventListener('change', () => {
    if ($('muteOnBlur').checked) audioFocus();
    else audioContexts.forEach(ctx => { if(ctx.state==='suspended') ctx.resume().catch(()=>{}); });
  });
  document.addEventListener('pointerdown', () => { if(document.hasFocus()) audioFocus(); }, {passive:true});

  function openDb(name) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('UW2_local_' + name, 1);
      req.onupgradeneeded = () => { if(!req.result.objectStoreNames.contains('files')) req.result.createObjectStore('files'); };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }
  function store(action,key,value){
    return new Promise((resolve,reject)=>{
      const tx = db.transaction('files', action==='get'?'readonly':'readwrite');
      const s = tx.objectStore('files');
      const req = action === 'get' ? s.get(key) : action === 'put' ? s.put(value,key) : s.delete(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  // Use js-dos' command interface; it dispatches initialized events to its canvas.
  function sendDosKey(type, code){
    if(!commandInterface) return;
    if(type === 'keydown') heldKeys.add(code); else heldKeys.delete(code);
    commandInterface.simulateKeyEvent(code, type === 'keydown');
  }
  function releaseKeys(){
    for(const code of [...heldKeys]) sendDosKey('keyup', code);
  }
  function onKey(ev){
    if(!commandInterface || !ev.isTrusted) return;
    if($('optionsDialog').open){ev.stopImmediatePropagation();return;}
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
    if(ev.ctrlKey || ev.metaKey || ev.altKey || ev.code?.startsWith('F')) return;
    const code = aliases[ev.code] ?? (/^Key[A-Z]$/.test(ev.code) ? ev.code.charCodeAt(3) : ev.keyCode);
    if(!Number.isFinite(code)) return;
    if(ev.repeat && !['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(ev.code)) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if(ev.type==='keydown'&&code===101&&config?.enhanced&&convenienceOptions.fastTravel){try{conveniences.requestTravel();}catch(_){}}
    sendDosKey(ev.type, code);
  }
  window.addEventListener('keydown',onKey,true);
  window.addEventListener('keyup',onKey,true);
  window.addEventListener('blur',releaseKeys);

  // Match wan2land's renderer: maximum 4:3 rectangle, browser interpolation.
  function fitCanvas(){
    if(!currentMode) return;
    const canvas=$('canvas'), area=document.querySelector('.play-area');
    const available=area.getBoundingClientRect();
    const width=Math.floor(Math.min(available.width,available.height*640/480));
    const height=Math.floor(width*480/640);
    if(width<=0 || height<=0) return;
    const wrap=document.querySelector('.canvas-wrap');
    wrap.style.width=width+'px';
    wrap.style.height=height+'px';
  }
  new ResizeObserver(fitCanvas).observe(document.querySelector('.play-area'));
  new ResizeObserver(()=>{const bar=document.querySelector('.toolbar');document.querySelector('.bottom-controls').style.setProperty('--controls-height',bar.getBoundingClientRect().height+'px');}).observe(document.querySelector('.toolbar'));
  new MutationObserver(fitCanvas).observe($('canvas'), {attributes:true,attributeFilter:['width','height']});
  document.addEventListener('fullscreenchange',()=>requestAnimationFrame(fitCanvas));
  window.addEventListener('resize',fitCanvas);
  $('hideControlsBtn').addEventListener('click',()=>{document.body.classList.add('controls-hidden');});
  $('showControlsBtn').addEventListener('click',()=>{document.body.classList.remove('controls-hidden');});
  $('keyboardBtn').addEventListener('click',()=>{
    const hidden=$('touchKeyboard').classList.toggle('hidden');
    $('keyboardBtn').setAttribute('aria-expanded',String(!hidden));
    requestAnimationFrame(fitCanvas);
  });

  function renderOptions(){
    $('buildReduction').value=String(convenienceOptions.buildReduction);
    $('fastTravelEnabled').checked=convenienceOptions.fastTravel;
    $('travelBtn').classList.toggle('hidden',!convenienceOptions.fastTravel || !config?.enhanced);
  }
  function updateMoneyLabel(){
    try{$('moneyStatus').textContent='현재 소지금(금화 환산) '+conveniences.money().toLocaleString();}
    catch(_){$('moneyStatus').textContent='게임을 시작하거나 불러온 뒤 사용할 수 있습니다.';}
  }
  $('optionsBtn').addEventListener('click',()=>{
    if(!config?.enhanced){alert('편의 설정은 원작 자동보급판과 교정판 자동보급판에서 사용할 수 있습니다.');return;}
    releaseKeys();renderOptions();updateMoneyLabel();$('optionsFeedback').textContent='';$('optionsDialog').showModal();
  });
  $('closeOptionsBtn').addEventListener('click',()=>$('optionsDialog').close());
  $('optionsDialog').addEventListener('close',()=>{$('canvas').focus();});
  function changeConveniences(){
    const next={buildReduction:Number($('buildReduction').value),fastTravel:$('fastTravelEnabled').checked};
    try{
      if(![0,25,50,75,100].includes(next.buildReduction))throw Error('건조 기간 설정이 올바르지 않습니다.');
      conveniences.apply(next);convenienceOptions=next;
      try{localStorage.setItem('UW2_conveniences',JSON.stringify(next));}catch(_){}
      renderOptions();$('optionsFeedback').textContent='적용했습니다.';
    }catch(err){renderOptions();$('optionsFeedback').textContent=err.message;}
  }
  $('buildReduction').addEventListener('change',changeConveniences);
  $('fastTravelEnabled').addEventListener('change',changeConveniences);
  $('addMoneyBtn').addEventListener('click',()=>{
    try{
      const result=conveniences.addMoney();updateMoneyLabel();
      $('optionsFeedback').textContent='금화 '+result.added.toLocaleString()+' 추가 → '+result.after.toLocaleString()+'. 게임 안에서 저장하세요.';
    }catch(err){$('optionsFeedback').textContent=err.message;}
  });
  $('travelBtn').addEventListener('click',()=>{
    if(!convenienceOptions.fastTravel)return;
    try{conveniences.requestTravel();}catch(err){alert(err.message);return;}
    sendDosKey('keydown',101);setTimeout(()=>sendDosKey('keyup',101),100);
  });
  renderOptions();

  $('supplyBtn').addEventListener('click',()=>{
    sendDosKey('keydown',65);
    setTimeout(()=>sendDosKey('keyup',65),100);
  });
  $('ammoSupplyBtn').addEventListener('click',()=>{
    sendDosKey('keydown',83);setTimeout(()=>sendDosKey('keyup',83),100);
  });
  const keyLayout = [
    ['ESC',27],['Q /',111],['W *',106],['E -',109],['R +',107],['A 보급',65,'feature'],['ENTER',13],
    ['7',55],['8',56],['9',57],['↑',104],['S 포탄+보급',83,'feature'],['5',53],['N5',101],
    ['4',52],['5',53],['6',54],['←',100],['↓',98],['→',102],['SPACE',32],
    ['1',49],['2',50],['3',51],['0',48],['DEL',8],['Y',89],['N',78]
  ];
  keyLayout.forEach(([label,code,klass])=>{
    const b = document.createElement('button');b.type='button';b.textContent=label;
    if(klass)b.className=klass;
    b.addEventListener('pointerdown',e=>{e.preventDefault();try{b.setPointerCapture(e.pointerId);}catch(_){}sendDosKey('keydown',code);});
    b.addEventListener('pointerup',e=>{e.preventDefault();sendDosKey('keyup',code);});
    b.addEventListener('pointercancel',()=>sendDosKey('keyup',code));
    b.addEventListener('lostpointercapture',()=>{if(heldKeys.has(code))sendDosKey('keyup',code);});
    $('touchKeyboard').appendChild(b);
  });

  function loadScript(src){return new Promise((resolve,reject)=>{
    const tag=document.createElement('script');tag.src=src;tag.onload=resolve;tag.onerror=()=>reject(new Error('게임 엔진 파일을 불러오지 못했습니다: '+src));document.head.appendChild(tag);
  });}
  function checkSaveLoop(){
    setInterval(async()=>{
      if(!fs||!db||!config)return;
      try{
        const modified = fs.fs.stat(config.save).mtime.getTime();
        if(lastModified!==null && modified!==lastModified){
          const data = fs.fs.readFile(config.save);
          await store('put',config.save,new Uint8Array(data));
          indicator('✓ 브라우저 저장 완료 · '+new Date().toLocaleTimeString());
        }
        lastModified=modified;
      }catch(_){lastModified=null;}
    },600);
  }
  checkSaveLoop();
  async function run(id){
    if(currentMode)return;
    currentMode=id;config=GAME[id];
    $('gameTitle').textContent=config.title;
    document.body.classList.add('playing');
    $('selectScreen').classList.add('hidden');
    $('gameScreen').classList.remove('hidden');
    status('엔진 준비 중');
    const cover=$('overlay'); cover.classList.remove('hidden','error');
    cover.querySelector('span').textContent='게임을 준비하고 있습니다…';
    requestAnimationFrame(fitCanvas);
    try {
      db=await openDb(id); // Original, patched, correction all have independent saves
      if(typeof window.Dos!=='function')await loadScript('vendor/js-dos.js');
      const engine = await window.Dos($('canvas'), {
        wdosboxUrl:'/vendor/wdosbox.js',
        SDL_numSimultaneouslyQueuedBuffers:10
      });
      const ready={dosFS:engine.fs,main:engine.main};
      fs=ready.dosFS;
      cover.querySelector('span').textContent='게임 데이터를 불러오는 중…';
      await fs.extract('/game/'+config.zip);
      if(config.enhanced){
        const mainBytes=fs.fs.readFile('MAIN.EXE'),menu=fs.fs.readFile('MENU.DAT');
        fs.fs.writeFile('MAIN.EXE',window.UW2Enhancements.prepare(mainBytes,menu,convenienceOptions));
        conveniences=window.UW2Enhancements.connect(fs.em);
      }
      renderOptions();

      const previous=await store('get',config.save);
      if(previous){ fs.fs.writeFile(config.save,new Uint8Array(previous)); indicator('✓ 이전 세이브 파일 불러옴'); }
      else indicator('새 게임 · 저장 공간 준비 완료');
      commandInterface = await ready.main(['-c',config.entry||'KOEI.COM']);
      if(typeof commandInterface?.simulateKeyEvent !== 'function') throw new Error('DOSBox 입력 연결에 실패했습니다.');
      $('canvas').focus();
      fitCanvas();
      status('게임 실행 중');
      cover.classList.add('hidden');
      setTimeout(audioFocus,500);
    }catch(err){
      console.error(err);status('실행 실패');
      cover.classList.add('error');cover.querySelector('span').textContent='게임 실행 실패: '+(err?.message||String(err))+' · 인터넷 연결과 vendor 파일을 확인해 주세요.';
    }
  }
  document.querySelectorAll('[data-game]').forEach(btn=>btn.addEventListener('click',()=>run(btn.dataset.game)));
  $('backBtn').addEventListener('click',()=>{if(confirm('현재 진행을 저장했는지 확인해 주세요. 게임 선택 화면으로 돌아갈까요?'))location.reload();});
  $('fullscreenBtn').addEventListener('click',async()=>{try{if(!document.fullscreenElement) await $('gameScreen').requestFullscreen();else await document.exitFullscreen();}catch(err){alert(err.message);}});
  $('downloadBtn').addEventListener('click',async()=>{
    if(!db||!config)return;
    try{
      const bytes=await store('get',config.save);
      if(!bytes){alert('저장된 세이브 파일이 없습니다. 게임 안에서 먼저 저장하세요.');return;}
      const u=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
      const a=document.createElement('a');a.href=u;a.download=idFilename(config.save,currentMode);document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);
    }catch(err){alert('내려받기 실패: '+err.message);}
  });
  function idFilename(name,mode){return mode+'_'+name;}
  $('uploadBtn').addEventListener('click',()=>{if(config)$('uploadFile').click();});
  $('uploadFile').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file||!db)return;
    if(!confirm('현재 세이브 파일을 교체하고 페이지를 다시 시작합니다. 계속할까요?'))return;
    try{
      const bytes=new Uint8Array(await file.arrayBuffer());await store('put',config.save,bytes);
      alert('세이브 파일을 저장했습니다. 새로고침 후 같은 모드로 실행하면 불러옵니다.');location.reload();
    }catch(err){alert('세이브 파일 불러오기 실패: '+err.message);}
  });
})();
