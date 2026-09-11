
let S=null;let loading=false;const money=n=>new Intl.NumberFormat('ru-RU').format(Math.round(Number(n)||0))+' ₽';const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));function fmt(x){x=Math.max(0,Math.floor(x));let h=Math.floor(x/3600),m=Math.floor(x%3600/60),s=x%60;return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':')}function rem(t){return t?.running&&t.endsAt?Math.max(0,Math.ceil((Number(t.endsAt)-Date.now())/1000)):null}function toast(x){const e=document.getElementById('toast');e.textContent=x;e.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>e.classList.remove('show'),1800)}async function api(u,opt={}){const r=await fetch(u,{...opt,headers:{'Content-Type':'application/json',...(opt.headers||{})}});const text=await r.text();let d=null;if(text.trim()){try{d=JSON.parse(text)}catch(_){if(!r.ok)throw Error('Ошибка сервера (HTTP '+r.status+')');throw Error('Сервер вернул некорректный ответ')}}if(!r.ok)throw Error((d&&d.error)||('HTTP '+r.status));if(d!==null)return d;try{const sr=await fetch('/api/state',{cache:'no-store'});const st=await sr.json();return {state:st}}catch(_){return {state:null}}}
function normalizeSearch(v){return String(v??'').toLowerCase().replace(/ё/g,'е').replace(/є/g,'е').replace(/[tт]/g,'т').replace(/[aа]/g,'а').replace(/[cс]/g,'с').replace(/[eе]/g,'е').replace(/[oо]/g,'о').replace(/[pр]/g,'р').replace(/[xх]/g,'х').replace(/[kк]/g,'к').replace(/[mм]/g,'м').replace(/[bв]/g,'в').replace(/[yу]/g,'у').replace(/тэт/g,'т').replace(/тип/g,'type').replace(/[^a-zа-я0-9]+/gi,'')}function fuzzyMatch(hay,q){if(!q)return true;if(hay.includes(q))return true;let pos=0;for(const ch of q){pos=hay.indexOf(ch,pos);if(pos<0)return false;pos++;}return true}function render(){if(!S||!Array.isArray(S.tanks))return;const q=normalizeSearch(document.getElementById('search').value||'');const sf=document.getElementById('statusFilter')?.value||'all',nf=document.getElementById('nationFilter')?.value||'all',cf=document.getElementById('classFilter')?.value||'all';const ts=S.tanks.filter(t=>{const a=Number(t.amount)||0,done=t.marked3===true,dead=t.alive===false;const hay=normalizeSearch([t.name,t.nation,t.class,t.id,t.image].join(' '));if(q&&!fuzzyMatch(hay,q))return false;if(nf!=='all'&&t.nation!==nf)return false;if(cf!=='all'&&t.class!==cf)return false;if(sf==='active'&&(dead||done))return false;if(sf==='dead'&&(!dead||done))return false;if(sf==='complete'&&!done)return false;if(sf==='funded'&&a<=0)return false;if(sf==='unfunded'&&a>0)return false;return true});const total=S.tanks.reduce((a,t)=>a+Math.max(0,Number(t.amount)||0),0);const funded=S.tanks.filter(t=>Number(t.amount)>0);const completed=S.tanks.filter(t=>t.marked3===true);document.getElementById('all').textContent=S.tanks.filter(t=>t.marked3!==true).length;document.getElementById('funded').textContent=funded.filter(t=>t.marked3!==true).length;document.getElementById('bank').textContent=money(total);document.getElementById('completed').textContent=completed.length;const ap=document.getElementById('adminProgressBar'); const doneCount=(S.tanks||[]).filter(t=>t.marked3===true).length; if(ap) ap.style.width=((S.tanks||[]).length?Math.min(100,doneCount/(S.tanks||[]).length*100):0)+'%';const recent=Array.isArray(S.recentDonations)?S.recentDonations:[];document.getElementById('recentAdmin').innerHTML=recent.slice(0,8).map(x=>`<div class="item"><b>${esc(x.tankName)}</b><small>${new Date(x.at).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small><strong>+${money(x.amount)}</strong></div>`).join('')||'<div class="hint">Пока изменений нет.</div>';const hist=Array.isArray(S.history)?S.history:[]; const hl=document.getElementById('historyList'); if(hl) hl.innerHTML=hist.map((h,i)=>`<div class="historyItem"><div><b>💀 #${hist.length-i} ${esc(h.tankName||'Танк')}</b><small></small></div><strong>${money(h.amount||0)}</strong></div>`).join('')||'<div class="hint" style="padding:12px">Пока ни один танк не выбыл.</div>'; document.getElementById('rows').innerHTML=ts.map(t=>{const a=Math.max(0,Number(t.amount)||0),share=total?a/total*100:0,done=t.marked3===true;return `<div class="row"><div>#${t.id}</div><div class="tank"><img src="${esc(t.image)}" alt=""><div><div class="tankName">${esc(t.name)}${t.custom?` <span class="customBadge">ДОБАВЛЕН</span>`:``}</div><div class="status ${t.alive===false?'dead':''}">${done?'🏆 3 ОТМЕТКИ ВЗЯТЫ':(t.alive===false?'● ВЫБЫЛ':'● В ИГРЕ')}</div><div class="metaLine">${t.nation?`<span class="metaChip">${esc(t.nation)}</span>`:''}${t.class?`<span class="metaChip">${esc(t.class)}</span>`:''}</div>${done?'<div class="completeBadge">ЦЕЛЬ ВЫПОЛНЕНА</div>':''}</div></div><div><label class="label">СУММА ПОДДЕРЖКИ ₽</label><div class="amountBox"><input id="a${t.id}" type="number" min="0" step="1" value="${a}"><button class="primary" onclick="save(${t.id})">Сохранить сумму</button></div><div class="quick"><button onclick="setVal(${t.id},100)">+100</button><button onclick="setVal(${t.id},500)">+500</button><button onclick="setVal(${t.id},1000)">+1 000</button><button onclick="setVal(${t.id},5000)">+5 000</button></div></div><div><label class="label">ДОЛЯ ОТ ОБЩЕЙ СУММЫ</label><div class="share">${share.toFixed(2)}%</div><div class="bar"><i style="width:${Math.min(100,share)}%"></i></div></div><div class="actions"><button onclick="toggle(${t.id})">${t.alive===false?'↩ Вернуть в игру':'✖ Отметить как выбывший'}</button><button class="completeBtn" onclick="toggleComplete(${t.id})">${done?'↩ Вернуть в челлендж':'🏆 3 ОТМЕТКИ ВЗЯТЫ'}</button>${t.custom?`<button class="customDelete" onclick="deleteTank(${t.id})">🗑 Удалить</button>`:''}</div></div>`}).join('');renderTimer();renderWheel()}
function setVal(id,add){const el=document.getElementById('a'+id);el.value=Math.max(0,Number(el.value)||0)+add;el.focus()}
function renderTimer(){if(!S)return;const t=S.timer||{},r=rem(t);document.getElementById('tv').textContent=fmt(t.running&&r!==null?r:(t.durationSec||3600));document.getElementById('ts').textContent=t.running?(r===0?'Аукцион завершён':'Идёт'):'Не запущен'}
async function load(){if(spinning)return;try{const r=await fetch('/api/state',{cache:'no-store'});if(!r.ok)throw Error('Не удалось получить состояние');const text=await r.text();if(!text.trim())throw Error('Сервер вернул пустое состояние');const d=JSON.parse(text);if(Array.isArray(d.tanks)){S=d;render()}}catch(e){toast(e.message)}}
async function save(id){const el=document.getElementById('a'+id);if(!el)return;const amount=Math.max(0,Math.round(Number(el.value)||0));try{const d=await api('/api/tank',{method:'POST',body:JSON.stringify({id,amount})});S=d.state;render();toast('Сумма сохранена: '+money(amount))}catch(e){toast('Ошибка: '+e.message)}}
async function addTank(){const name=document.getElementById('newTankName').value.trim(),image=document.getElementById('newTankImage').value.trim(),nation=document.getElementById('newTankNation').value.trim(),techClass=document.getElementById('newTankClass').value;if(!name||!image){toast('Укажи название и ссылку на изображение');return}try{const d=await api('/api/add-tank',{method:'POST',body:JSON.stringify({name,image,nation,class:techClass})});S=d.state;document.getElementById('newTankName').value='';document.getElementById('newTankImage').value='';document.getElementById('newTankNation').value='';document.getElementById('newTankClass').value='';render();toast('Танк добавлен на сайт')}catch(e){toast('Ошибка: '+e.message)}}
async function deleteTank(id){const t=S.tanks.find(x=>x.id===id);if(!t)return;if(!confirm(`Удалить танк «${t.name}» со всех страниц?`))return;try{const d=await api('/api/delete-tank',{method:'POST',body:JSON.stringify({id})});S=d.state;render();toast('Танк удалён')}catch(e){toast('Ошибка: '+e.message)}}
async function toggle(id){const t=S.tanks.find(x=>x.id===id);if(!t)return;try{const d=await api('/api/tank',{method:'POST',body:JSON.stringify({id,amount:Number(t.amount)||0,alive:t.alive===false})});S=d.state;render();toast(t.alive===false?'Танк возвращён':'Танк отмечен как выбывший')}catch(e){toast('Ошибка: '+e.message)}}
async function toggleComplete(id){const t=S.tanks.find(x=>x.id===id);if(!t)return;const next=t.marked3!==true;const msg=next?`Отметить «${t.name}» как танк, на котором уже взяты 3 отметки?`:`Вернуть «${t.name}» в активный список?`;if(!confirm(msg))return;try{const d=await api('/api/mark-complete',{method:'POST',body:JSON.stringify({id,marked3:next})});S=d.state;render();toast(next?'🏆 3 отметки отмечены':'↩ Танк возвращён в челлендж')}catch(e){toast('Ошибка: '+e.message)}}
async function timer(action){try{const body={action};if(action==='set')body.minutes=Number(document.getElementById('mins').value)||60;const d=await api('/api/timer',{method:'POST',body:JSON.stringify(body)});S=d.state;render();toast('Таймер обновлён')}catch(e){toast('Ошибка: '+e.message)}}
async function newRound(){if(!confirm('Начать новый этап? Суммы сохранятся, статусы «выбыл» будут сброшены.'))return;try{const d=await api('/api/new-round',{method:'POST'});S=d.state;render();toast('Новый этап')}catch(e){toast('Ошибка: '+e.message)}}
async function resetAll(){if(!confirm('Сбросить суммы и статусы?'))return;try{S=await api('/api/reset',{method:'POST'});render();toast('Аукцион сброшен')}catch(e){toast('Ошибка: '+e.message)}}
async function logout(){try{await api('/api/logout',{method:'POST'});location.href='/admin-login.html'}catch(e){toast(e.message)}}
let wheelAngle=0,spinning=false,audioCtx=null,lastTickSector=-1;
let wheelItemsCache=[],wheelItemsKey='';
function wheelAudio(type='tick'){ return; }
function drawWheel(items, angle=wheelAngle){
 const c=document.getElementById('wheel'); if(!c)return;
 const ctx=c.getContext('2d'),W=c.width,H=c.height,cx=W/2,cy=H/2,r=485;
 ctx.clearRect(0,0,W,H);
 // premium glow / rings
 ctx.save();ctx.translate(cx,cy);
 ctx.beginPath();ctx.arc(0,0,r+18,0,Math.PI*2);ctx.fillStyle='#05080d';ctx.fill();
 ctx.shadowColor='#d7a84b';ctx.shadowBlur=28;ctx.beginPath();ctx.arc(0,0,r+7,0,Math.PI*2);ctx.strokeStyle='#d7a84b';ctx.lineWidth=12;ctx.stroke();ctx.shadowBlur=0;
 ctx.restore();
 ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);
 const weights=items.map(t=>{const a=Math.max(0,Number(t.amount)||0);return a>0?1/a:0;});
 const total=weights.reduce((sum,w)=>sum+w,0);
 if(!items.length||total<=0){ctx.restore();return;}
 let a0=-Math.PI/2;
 const colors=['#a52b26','#d17b1e','#28754b','#24639b','#68458e','#9b356c','#16736b','#9a4a22','#59377d','#147a70','#8d2926','#245b91'];
 items.forEach((t,i)=>{
   const amount=Math.max(0,Number(t.amount)||0),w=amount>0?1/amount:0,da=2*Math.PI*(w/total);
   const grad=ctx.createLinearGradient(0,-r,0,r);grad.addColorStop(0,colors[i%colors.length]);grad.addColorStop(1,'#090d14');
   ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,a0,a0+da);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
   ctx.strokeStyle='#d0b36b';ctx.globalAlpha=.72;ctx.lineWidth=2;ctx.stroke();ctx.globalAlpha=1;
   const mid=a0+da/2;
   ctx.save();ctx.rotate(mid);ctx.textAlign='right';ctx.fillStyle='#fff';ctx.shadowColor='#000';ctx.shadowBlur=7;
   const fontSize=Math.max(13,Math.min(28,11+da*20));ctx.font=`900 ${fontSize}px Segoe UI,Arial`;
   let name=t.name;if(name.length>25)name=name.slice(0,24)+'…';ctx.fillText(name,r-30,2);
   if(da>.16){ctx.font='800 14px Segoe UI,Arial';ctx.fillStyle='#f4d58a';ctx.fillText(money(amount)+' ₽',r-30,24);}
   ctx.restore();a0+=da;
 });
 // inner rim
 ctx.beginPath();ctx.arc(0,0,r-9,0,Math.PI*2);ctx.strokeStyle='#f3d78d';ctx.globalAlpha=.45;ctx.lineWidth=3;ctx.stroke();ctx.globalAlpha=1;
 ctx.restore();
 // fixed center emblem
 ctx.save();ctx.translate(cx,cy);ctx.beginPath();ctx.arc(0,0,82,0,Math.PI*2);ctx.fillStyle='#0a1018';ctx.fill();ctx.strokeStyle='#e3c36d';ctx.lineWidth=7;ctx.shadowColor='#d7a84b';ctx.shadowBlur=18;ctx.stroke();ctx.shadowBlur=0;
 ctx.fillStyle='#f5d47b';ctx.font='1000 27px Segoe UI,Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('LAQ',0,-7);ctx.font='800 12px Segoe UI,Arial';ctx.fillStyle='#fff';ctx.fillText('ВЫБЫВАНИЕ',0,23);ctx.restore();
}
function shuffleWheelItems(items){
 const a=[...items];
 for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
 return a;
}
function getWheelItems(){
 const active=(S?.tanks||[]).filter(t=>t.alive!==false&&Number(t.amount)>0);
 const key=active.map(t=>`${t.id}:${Number(t.amount)||0}`).sort().join('|');
 if(key!==wheelItemsKey || !wheelItemsCache.length){
  wheelItemsCache=shuffleWheelItems(active);
  wheelItemsKey=key;
 }
 const activeIds=new Set(active.map(t=>t.id));
 wheelItemsCache=wheelItemsCache.filter(t=>activeIds.has(t.id));
 for(const t of active){if(!wheelItemsCache.some(x=>x.id===t.id))wheelItemsCache.push(t);}
 return wheelItemsCache.map(x=>active.find(t=>t.id===x.id)||x);
}
function renderWheel(){
 if(!S||spinning)return;
 const items=getWheelItems();
 const sorted=(S.tanks||[]).filter(t=>t.alive!==false&&Number(t.amount)>0);
 const totalSupport=sorted.reduce((s,t)=>s+(Number(t.amount)||0),0);
 drawWheel(items);
 const colors=['#e74c3c','#f39c12','#2ecc71','#3498db','#9b59b6','#e84393','#16a085','#d35400','#8e44ad','#1abc9c','#c0392b','#2980b9'];
 const rows=[...sorted].sort((a,b)=>(Number(b.amount)||0)-(Number(a.amount)||0));
 document.getElementById('wheelRows').innerHTML=rows.map((t,i)=>{const a=Math.max(0,Number(t.amount)||0),share=totalSupport&&a?a/totalSupport*100:0;return `<div class="wheelRow"><div class="wheelNameOnly"><span class="wheelDot" style="background:${colors[i%colors.length]};box-shadow:0 0 10px ${colors[i%colors.length]}"></span><div><b>${esc(t.name)}</b><div class="muted">${money(a)} · <span class="wheelChance">шанс на победу ${share.toFixed(1)}%</span></div></div></div></div>`}).join('')||'<div class="hint" style="padding:14px">Добавь поддержку хотя бы двум танкам.</div>';
}

function showSpinOverlay({final=false,name='',meta='',image=''}){
 const o=document.getElementById('showOverlay'),c=document.getElementById('showOverlayCard');
 if(!o)return;
 c.classList.toggle('final',final);o.classList.toggle('final',final);
 document.getElementById('showKicker').textContent=final?'🏆🏆🏆 ПОБЕДИТЕЛЬ АУКЦИОНА':'💀 ТАНК ВЫБЫВАЕТ';
 document.getElementById('showTankName').textContent=name;
 document.getElementById('showMeta').textContent=final?'ПОСЛЕДНИЙ ОСТАВШИЙСЯ ТАНК':' '+meta;
 const im=document.getElementById('showTankImage');
 if(im){im.src=image||'';im.style.display=image?'block':'none';im.onerror=()=>{im.style.display='none'}}
 const close=document.getElementById('showClose');if(close)close.style.display=final?'inline-block':'none';
 const badge=document.getElementById('showFinalBadge');if(badge)badge.textContent=final?'🏆 3 ОТМЕТКИ ВЗЯТЫ':'🏆 3 ОТМЕТКИ ВЗЯТЫ';
 o.classList.remove('show');void o.offsetWidth;o.classList.add('show');return o;
}
function hideSpinOverlay(){const o=document.getElementById('showOverlay');if(o)o.classList.remove('show','final')}

async function spin(){
 if(spinning)return;
 const active=(S.tanks||[]).filter(t=>t.alive!==false&&Number(t.amount)>0);
 if(active.length<2){toast('Нужно минимум 2 танка с поддержкой');return;}
 const sec=Math.min(120,Math.max(3,Number(document.getElementById('spinSec').value)||20));
 const box=document.querySelector('.wheelBox');
 try{
  spinning=true;
  box.classList.remove('cinematic');
  document.getElementById('spinResult').textContent='⚠️ КОЛЕСО КРУТИТСЯ…';
  document.getElementById('spinResultMeta').textContent='Чем меньше поддержка — тем больше сектор и шанс выбыть';
  const d=await api('/api/spin',{method:'POST',body:JSON.stringify({durationSec:sec})});
  const serverItems=d.participants||[];
  const serverById=new Map(serverItems.map(t=>[t.id,t]));
  const items=wheelItemsCache.map(x=>serverById.get(x.id)).filter(Boolean);
  if(items.length!==serverItems.length){ wheelItemsCache=shuffleWheelItems(serverItems); wheelItemsKey=serverItems.map(t=>`${t.id}:${Number(t.amount)||0}`).sort().join('|'); }
  const stableItems=items.length===serverItems.length?items:wheelItemsCache.map(x=>serverById.get(x.id)).filter(Boolean);
  const target=d.result;
  const itemsForSpin=stableItems;
  const invTotal=itemsForSpin.reduce((sum,t)=>sum+(1/(Number(t.amount)||1)),0);
  let cursor=-Math.PI/2,targetPoint=0;
  for(const t of itemsForSpin){
   const a=Math.max(0,Number(t.amount)||0),da=2*Math.PI*((1/a)/invTotal);
   if(t.id===target.id){
    const margin=Math.min(.20,da/(2*Math.PI)*.42);
    targetPoint=cursor+da*(margin+Math.random()*(1-margin*2));
    break;
   }
   cursor+=da;
  }
  const startAngle=wheelAngle,turns=7.25,targetBase=-Math.PI/2-targetPoint;
  let end=targetBase+Math.ceil((startAngle+turns*2*Math.PI-targetBase)/(2*Math.PI))*2*Math.PI;
  
  const t0=performance.now(),dur=sec*1000;
  let lastSector=-1,nearShown=false;
  const ease=p=>{
   return 1-Math.pow(1-p,4.2);
  };
  function frame(now){
   const p=Math.min(1,(now-t0)/dur),e=ease(p),a=startAngle+(end-startAngle)*e;
   wheelAngle=a;drawWheel(itemsForSpin);
   const norm=(((-a)%(2*Math.PI))+2*Math.PI)%(2*Math.PI);let acc=0,idx=-1;
   for(let i=0;i<itemsForSpin.length;i++){acc+=2*Math.PI*((1/(Number(itemsForSpin[i].amount)||1))/invTotal);if(norm<acc){idx=i;break;}}
   if(idx!==lastSector){lastSector=idx;}
   if(p>.80&&!nearShown){nearShown=true;document.getElementById('spinResult').textContent='⚠️ ПОЧТИ…';document.getElementById('spinResultMeta').textContent='Колесо замедляется…';}
   if(p<1)requestAnimationFrame(frame);else finish();
  }
  async function finish(){
   wheelAngle=end;drawWheel(itemsForSpin);
   box.classList.remove('cinematic');void box.offsetWidth;box.classList.add('cinematic','eliminationFlash'); setTimeout(()=>box.classList.remove('eliminationFlash'),900);
   const targetAmount=Math.max(0,Number(target.amount)||0),share=invTotal&&targetAmount?(1/targetAmount)/invTotal*100:0;
   document.getElementById('spinResult').textContent='💀 '+target.name+' — ВЫБЫВАЕТ!';
   document.getElementById('spinResultMeta').textContent=`Поддержка: ${money(target.amount)} · шанс выбыть: ${share.toFixed(1)}%`;
   showSpinOverlay({name:target.name,meta:`${money(target.amount)} · шанс выбыть ${share.toFixed(1)}%`});
   await new Promise(r=>setTimeout(r,2200));
   try{const e=await api('/api/eliminate',{method:'POST',body:JSON.stringify({id:target.id})});if(!e.state||!Array.isArray(e.state.tanks))throw new Error('Сервер не вернул обновлённое состояние');S=e.state;wheelItemsCache=[];wheelItemsKey='';document.getElementById('remainingMeta').textContent=`Осталось танков с поддержкой: ${e.remaining}`;render();if(e.remaining===1){const winner=(S.tanks||[]).find(t=>t.alive!==false&&Number(t.amount)>0);if(winner){showSpinOverlay({final:true,name:winner.name,meta:'Последний оставшийся танк',image:winner.image||winner.imageUrl||winner.img||''});document.getElementById('spinResult').textContent='🏆 '+winner.name+' — ПОБЕДИТЕЛЬ!';document.getElementById('spinResultMeta').textContent='3 ОТМЕТКИ ВЗЯТЫ';}}else{hideSpinOverlay();}toast(e.remaining===1?'🏆 ПОБЕДИТЕЛЬ АУКЦИОНА!':'💀 '+target.name+' выбыл');}
   catch(err){hideSpinOverlay();toast('Ошибка выбывания: '+err.message);render();}
   spinning=false;setTimeout(()=>box.classList.remove('cinematic'),500);renderWheel();
  }
  requestAnimationFrame(frame);
 }catch(e){spinning=false;box.classList.remove('cinematic');toast('Ошибка: '+e.message);render();}
}

async function copyAuctionLink(){try{await navigator.clipboard.writeText(location.origin+'/');toast('🔗 Ссылка на аукцион скопирована')}catch(e){toast('Не удалось скопировать ссылку')}}
load();setInterval(load,2500);setInterval(renderTimer,500);
