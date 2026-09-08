
let S=null,lastRecentId=null,tankFilter='all',nationFilter='all',classFilter='all',viewFilter='active';
const DA='https://www.donationalerts.com/r/laqwiner';
const NATION_ORDER=['СССР','Германия','США','Китай','Франция','Великобритания','Чехословакия','Швеция','Япония','Польша','Италия'];
const CLASS_ORDER=[['ЛТ','⚡','Лёгкие танки'],['СТ','🛡️','Средние танки'],['ТТ','💪','Тяжёлые танки'],['ПТ-САУ','💥','ПТ-САУ']];
const NATION_RANK=Object.fromEntries(NATION_ORDER.map((n,i)=>[n,i]));
const CLASS_RANK=Object.fromEntries(CLASS_ORDER.map(([n],i)=>[n,i]));
function sortTanksByGameOrder(arr){return [...arr].sort((a,b)=>{const na=NATION_RANK[String(a.nation||'')]??999, nb=NATION_RANK[String(b.nation||'')]??999;if(na!==nb)return na-nb;const ca=CLASS_RANK[String(a.class||'')]??999, cb=CLASS_RANK[String(b.class||'')]??999;if(ca!==cb)return ca-cb;return String(a.name||'').localeCompare(String(b.name||''),'ru',{numeric:true,sensitivity:'base'})})}
const FLAG={СССР:'ussr',Россия:'ru',Германия:'de',Великобритания:'gb',США:'us',Франция:'fr',Китай:'cn',Польша:'pl',Чехословакия:'cz',Япония:'jp',Италия:'it',Швеция:'se'};
const money=n=>new Intl.NumberFormat('ru-RU').format(Math.round(Number(n)||0))+' ₽';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function fmt(x){x=Math.max(0,Math.floor(x));let h=Math.floor(x/3600),m=Math.floor(x%3600/60),s=x%60;return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':')}
function rem(t){return t?.running&&t.endsAt?Math.max(0,Math.ceil((Number(t.endsAt)-Date.now())/1000)):null}
function flagFor(n){return FLAG[n]||''}
function flagSrc(code){return code==='ussr'?'/assets/flag-ussr.png':`/assets/flag-${code}.svg`}
function flagImg(n,cls='pillFlag'){const code=flagFor(n);return code?`<span class="${cls}"><img src="${flagSrc(code)}" alt="${esc(n||'')}" loading="lazy"></span>`:''}
function renderTimer(){if(!S)return;const t=S.timer||{},r=rem(t),v=document.getElementById('timerValue'),st=document.getElementById('timerState'),box=document.getElementById('timerBox');v.textContent=fmt(t.running&&r!==null?r:(t.durationSec||3600));st.textContent=t.running?(r===0?'ЧЕЛЛЕНДЖ ЗАВЕРШЁН':'ЧЕЛЛЕНДЖ ИДЁТ'):'ТАЙМЕР НЕ ЗАПУЩЕН';box.classList.toggle('expired',t.running&&r===0)}
function renderNationPills(){const el=document.getElementById('nationPills');if(!el||!S)return;const available=new Set((S.tanks||[]).map(t=>String(t.nation||'').trim()).filter(n=>FLAG[n]));const nations=NATION_ORDER.filter(n=>available.has(n));el.innerHTML=[['all','Все нации'],...nations.map(n=>[n,n])].map(([v,label])=>`<button type="button" class="filterPill ${nationFilter===v?'active':''}" data-nation-filter="${esc(v)}">${v==='all'?'<span class="pillFlag">🌍</span>':flagImg(v)}<span>${esc(label)}</span></button>`).join('');el.querySelectorAll('[data-nation-filter]').forEach(b=>b.addEventListener('click',()=>{nationFilter=b.dataset.nationFilter;render()}))}
function renderClassPills(){const el=document.getElementById('classPills');if(!el)return;el.innerHTML=[['all','🎯','Все классы'],...CLASS_ORDER].map(([v,icon,label])=>`<button type="button" class="filterPill ${classFilter===v?'active':''}" data-class-filter="${esc(v)}"><span class="pillIcon">${icon}</span><span>${label}</span></button>`).join('');el.querySelectorAll('[data-class-filter]').forEach(b=>b.addEventListener('click',()=>{classFilter=b.dataset.classFilter;render()}))}
function resetFilters(){tankFilter='all';nationFilter='all';classFilter='all';const q=document.getElementById('tankSearch');if(q)q.value='';render()}
function setTankFilter(v){tankFilter=v;render()}
function setView(v){viewFilter=v;document.querySelectorAll('.viewTab').forEach(b=>b.classList.toggle('active',b.dataset.view===v));document.getElementById('activeTools').style.display=v==='active'?'block':'none';document.getElementById('completedGrid').style.display=v==='completed'?'grid':'none';render()}
function cardHtml(t,completed=false){const a=Math.max(0,Number(t.amount)||0),nation=String(t.nation||''),techClass=String(t.class||''),flag=flagFor(nation);return `<article class="${completed?'completedCard':'card'}">${flag?`<div class="nationBackdrop" aria-hidden="true"><img src="${flagSrc(flag)}" alt=""></div>`:''}${completed?'<div class="completedBadge">🏆 3 ОТМЕТКИ</div>':''}<div class="tankVisual"><img class="img" src="${esc(t.image)}" alt="${esc(t.name)}" loading="lazy" onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='https://www.wotgarage.net/img/tanks/japan-J40_Type_71.png';}else{this.src='/assets/tank-placeholder.svg'}">${flag?`<div class="tankFlagOverlay" title="${esc(nation)}"><img src="${flagSrc(flag)}" alt="${esc(nation)}"></div>`:''}${completed?'<div class="mark95">95%</div>':''}</div><div class="name">${esc(t.name)}</div><div class="tankMeta"><span class="metaChip nationChip">${flag?`<img class="miniFlag" src="${flagSrc(flag)}" alt="">`:''}${esc(nation||'Нация не указана')}</span>${techClass?`<span class="metaChip">${esc(techClass)}</span>`:''}</div>${(!completed||a>0)?`<div class="amount">${money(a)}</div>`:''}${completed?'<div class="shareCard" style="color:#e0bf72">Эта цель уже выполнена — 3 отметки взяты.</div>':`<div class="shareCard">Доля общей поддержки: <b>${(currentTotal? a/currentTotal*100:0).toFixed(2)}%</b></div><div class="progress"><i style="width:${Math.min(100,currentTotal?a/currentTotal*100:0)}%"></i></div><a class="orderBtn" href="${DA}" target="_blank" rel="noopener noreferrer">ПОДДЕРЖАТЬ ТАНК</a><div class="orderHint">Можно поддержать повторно — сумма добавится</div>`}</article>`}
let currentTotal=0;
function render(){
 if(!S)return;
 renderNationPills(); renderClassPills();
 const q=(document.getElementById('tankSearch')?.value||'').trim().toLowerCase();
 const ts=S.tanks||[];
 const completed=ts.filter(t=>t.marked3===true);
 const active=ts.filter(t=>t.marked3!==true);
 const total=ts.reduce((sum,t)=>sum+Math.max(0,Number(t.amount)||0),0);
 const funded=active.filter(t=>Number(t.amount)>0);
 const free=active.length-funded.length;
 currentTotal=total;
 document.getElementById('all').textContent=active.length;
 document.getElementById('bank').textContent=money(total);
 document.getElementById('completedCount').textContent=completed.length;
 document.getElementById('round').textContent=S.round||1;
 const share=t=>total>0?(Math.max(0,Number(t.amount)||0)/total*100):0;
 const top=[...active].filter(t=>Number(t.amount)>0).sort((a,b)=>Number(b.amount)-Number(a.amount));
 document.getElementById('fundedTable').innerHTML=top.length
  ? '<div class="tr th"><div>ТАНК</div><div>ПОДДЕРЖКА</div><div>ШАНС ВЫИГРАТЬ</div></div>'+top.slice(0,8).map((t,i)=>`<div class="tr"><div><div class="tankName">${['🥇','🥈','🥉'][i]||'•'} ${esc(t.name)}</div><div class="sub">Место #${i+1}</div></div><div class="money">${money(t.amount)}</div><div><div class="share">${share(t).toFixed(2)}%</div><div class="bar"><i style="width:${Math.min(100,share(t))}%"></i></div></div></div>`).join('')
  : '<div style="padding:22px;color:#718197">Пока ни один танк не поддержан.</div>';
 const source=viewFilter==='completed'?completed:active;
 const orderedSource=sortTanksByGameOrder(source);
 const visible=orderedSource.filter(t=>{
   const a=Number(t.amount)||0;
   const byFilter=viewFilter==='completed'?true:(tankFilter==='funded'?a>0:tankFilter==='free'?a<=0:true);
   const byNation=nationFilter==='all'||String(t.nation||'')===nationFilter;
   const byClass=classFilter==='all'||String(t.class||'')===classFilter;
   return byFilter&&byNation&&byClass&&String(t.name).toLowerCase().includes(q);
 });
 if(viewFilter==='completed'){
   document.getElementById('completedGrid').innerHTML=visible.map(t=>cardHtml(t,true)).join('')||'<div class="completedEmpty">🏆 Пока ни на одном танке не взяты 3 отметки.</div>';
   document.getElementById('cards').innerHTML='';
 }else{
   document.getElementById('cards').innerHTML=visible.map(t=>cardHtml(t,false)).join('')||'<div class="hint" style="grid-column:1/-1;padding:20px">По этим фильтрам танков не найдено.</div>';
   document.getElementById('completedGrid').innerHTML='';
 }
 renderTimer();
}
document.querySelectorAll('.tankFilters button').forEach(b=>b.addEventListener('click',()=>setTankFilter(b.dataset.filter)));document.querySelectorAll('.viewTab').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
async function load(){try{const r=await fetch('/api/state',{cache:'no-store'});if(!r.ok)throw Error();S=await r.json();render()}catch(e){}}
load();setInterval(load,1500);setInterval(renderTimer,250);let ws;try{ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.state){S=m.state;render()}}catch(_){}}}catch(e){}
