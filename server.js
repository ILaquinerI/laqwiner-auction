const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const CDN = 'https://dav-static.tanki.su//ptlru/mt/current/shop/vehicles/600x450/';
const tanks = [
['T-100 ЛТ','R132_VNII_100LT.png','СССР','ЛТ'],['Т-62А','R87_T62A.png','СССР','СТ'],['Vulcan','GB139_Vulcan.png','Великобритания','СТ'],['CS-63 Wilk','Pl34_CS_63_02.png','Польша','СТ'],
['Объект 168-122 «Квант»','R246_Object_168_122.png','СССР','СТ'],['Объект 907','R95_Object_907.png','СССР','СТ'],['Объект 277','R155_Object_277.png','СССР','ТТ'],['ТЭТ-100','R213_TET_100.png','СССР','ТТ'],
['Объект 780','R178_Object_780.png','СССР','ТТ'],['Объект 268','R88_Object268.png','СССР','ПТ-САУ'],['E 50 M','G73_E50_Ausf_M.png','Германия','СТ'],['Объект 120 «Таран»','R222_Object_120_Taran.png','СССР','ПТ-САУ'],
['Erich Konzept I','G165_Erich_Konzept_I.png','Германия','СТ'],['Maus','G42_Maus.png','Германия','ТТ'],['StuG Maus 17 cm','G181_StuG_Maus_17cm.png','Германия','ПТ-САУ'],['Firebird','A175_OTAC_MT_58_02.png','США','СТ'],
['H-3','A163_H_3.png','США','ТТ'],['XM57','A165_XM57.png','США','ПТ-САУ'],['T110E3','A85_T110E3.png','США','ПТ-САУ'],['Projet Murat','F119_Projet_Murat.png','Франция','СТ'],
['AMX 50 B','F10_AMX_50B.png','Франция','ТТ'],['Tornade','F137_Tornade.png','Франция','ПТ-САУ'],['Manticore','GB100_Manticore.png','Великобритания','ЛТ'],['Concept No. 5','GB120_Concept_No_5.png','Великобритания','СТ'],
['Nemesis','GB128_Nemesis.png','Великобритания','СТ'],['Vz. 55','Cz17_Vz_55.png','Чехословакия','ТТ'],['Vandal','GB88_T95_Chieftain_turret.png','Великобритания','ТТ'],['113','Ch22_113.png','Китай','ТТ'],
['BZ-75','Ch48_BZ_75.png','Китай','ТТ'],['116-F3','Ch52_WZ_122_6_F3.png','Китай','ТТ'],['Type 5 Heavy','J20_Type_2605.png','Япония','ТТ'],['CS-63','Pl21_CS_63.png','Польша','СТ'],
['Объект 279 ранний','R157_Object_279R.png','СССР','ТТ'],['T95/FV4201 Chieftain','GB98_T95_FV4201_Chieftain.png','Великобритания','ТТ'],['T57 Heavy Tank','A67_T57_58.png','США','ТТ'],['Leopard 1','G89_Leopard1.png','Германия','СТ'],['ИС-7','R45_IS-7.png','СССР','ТТ'],['Grille 15','G121_Grille_15_L63.png','Германия','ПТ-САУ'],['120 AC Gendarme','https://sun9-66.userapi.com/impg/Y2XHg6ETnUamuzTHz6vY7d5F1c-pkBNehO_ElA/HdsO15EeiS4.jpg?quality=95&sign=6c4d76ce36313b942996563c87ad4b82&size=600x450&type=album','Франция','ПТ-САУ'],['FV215b','GB13_FV215b.png','Великобритания','ТТ'],['BZ-74-1','Ch56_BZ_74_1.png','Китай','ТТ'],['Orso','https://tankist.net/get/inline-images/image-20250227170135-1.png','Италия','ТТ'],['60TP Lewandowskiego','Pl15_60TP_Lewandowskiego.png','Польша','ТТ']
].map((x,i)=>({id:i+1,name:x[0],image:x[1]?CDN+x[1]:'assets/tank-placeholder.svg',nation:x[2],class:x[3],amount:0,weight:50,alive:true}));
const COMPLETED_SEED_IDS = new Set([33,34,35,36,37,38,39,40,41,42,43]);
const completedSeed = tanks.filter(t=>COMPLETED_SEED_IDS.has(t.id)).map(t=>({...t,marked3:true,alive:false}));
const defaultTimer = () => ({durationSec:3600, endsAt:null, running:false});
const initial = () => ({version:10,round:1,tanks:JSON.parse(JSON.stringify(tanks)).map(t=>({...t,marked3:COMPLETED_SEED_IDS.has(t.id),alive:!COMPLETED_SEED_IDS.has(t.id)})),history:[],recentDonations:[],lastEliminatedId:null,timer:defaultTimer(),updatedAt:Date.now()});
let state = initial();
let previousStates = [];
const sessions = new Map();

async function sb(pathname, opts={}) {
  if(!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase environment variables are missing');
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + pathname, { ...opts, headers:{ apikey:SUPABASE_KEY, Authorization:'Bearer '+SUPABASE_KEY, 'Content-Type':'application/json', ...(opts.headers||{}) }});
  if(!r.ok) throw new Error('Supabase '+r.status+': '+await r.text());
  return r.status===204 ? null : r.json();
}
function normalizeTanks(list){
 const incoming=Array.isArray(list)?list:[];
 const byId=new Map(incoming.map(t=>[Number(t.id),t]));
 const baseIds=new Set(tanks.map(t=>t.id));
 const base=tanks.map(base=>{
   const t=byId.get(base.id)||{};
   const completed=COMPLETED_SEED_IDS.has(base.id);
   return {...base,...t,name:base.name,image:base.image,nation:base.nation,class:base.class,custom:false,
     marked3:completed ? true : t.marked3===true,
     amount:completed ? 0 : (Number.isFinite(Number(t.amount))?Math.max(0,Number(t.amount)):0),
     weight:Number.isFinite(Number(t.weight))?Math.max(1,Math.min(100,Math.round(Number(t.weight)))):50,
     alive:completed ? false : t.alive!==false};
 });
 const custom=incoming.filter(t=>!baseIds.has(Number(t.id)) && t && String(t.name||'').trim()).map(t=>({
   id:Number(t.id), name:String(t.name).trim().slice(0,80), image:String(t.image||'').trim().slice(0,1000), nation:String(t.nation||'').trim().slice(0,40), class:String(t.class||'').trim().slice(0,20), custom:true, marked3:t.marked3===true,
   amount:Number.isFinite(Number(t.amount))?Math.max(0,Number(t.amount)):0,
   weight:Number.isFinite(Number(t.weight))?Math.max(1,Math.min(100,Math.round(Number(t.weight)))):50,
   alive:t.alive!==false
 })).filter(t=>Number.isInteger(t.id)&&t.id>0&&t.image);
 return [...base,...custom];
}
function ensureCompletedSeeds(){
 const ids=new Set(state.tanks.map(t=>Number(t.id)));
 for(const seed of completedSeed){ if(!ids.has(seed.id)) state.tanks.push(JSON.parse(JSON.stringify(seed))); }
 state.tanks=normalizeTanks(state.tanks);
}
function migrateCompletedSeeds(){
  if(Number(state.version||0) >= 10) return false;
  const completedIds=COMPLETED_SEED_IDS;
  let changed=false;
  state.tanks=state.tanks.map(t=>{
    if(completedIds.has(Number(t.id))){
      changed=true;
      return {...t, marked3:true, alive:false, amount:0, weight:50};
    }
    return t;
  });
  state.version=10;
  return changed;
}
async function loadState(){
  try { const rows=await sb('auction_state?id=eq.1&select=state'); if(rows?.[0]?.state?.tanks?.length) { state=rows[0].state; state.timer={...defaultTimer(),...(state.timer||{})}; state.tanks=normalizeTanks(state.tanks); const migrated=migrateCompletedSeeds(); ensureCompletedSeeds(); if(migrated) state.tanks=normalizeTanks(state.tanks); await saveState(); } else await saveState(); }
  catch(e){ console.error(e.message); }
}
async function saveState(){ state.updatedAt=Date.now(); await sb('auction_state',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:1,state,updated_at:new Date().toISOString()})}); }
function publicState(){ return JSON.parse(JSON.stringify(state)); }
function broadcast(){ const msg=JSON.stringify({type:'state',state:publicState()}); wss.clients.forEach(c=>{if(c.readyState===1)c.send(msg)}); }
function cookieSession(req){ const c=(req.headers.cookie||'').split(';').map(x=>x.trim()); const s=c.find(x=>x.startsWith('laq_session=')); return s?s.split('=')[1]:null; }
function isAdmin(req){ const id=cookieSession(req); return !!(id && sessions.has(id)); }
function json(res,status,obj){ const b=JSON.stringify(obj); res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(b); }
function readBody(req){ return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>2e6)reject(new Error('Body too large'))});req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch(e){reject(e)}});req.on('error',reject)}); }
function serveFile(res,file){ fs.readFile(path.join(ROOT,file),(e,b)=>{if(e)return res.writeHead(404).end('Not found'); const ext=path.extname(file).toLowerCase(); const types={'.html':'text/html; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'}; const type=types[ext]||'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(b);}); }
function activeWeighted(){ const a=state.tanks.filter(t=>t.alive&&t.marked3!==true&&Number(t.amount)>0).map(t=>({...t,amount:Number(t.amount)||0,risk:1})); return {a,total:a.length}; }
// Real server-side weighted randomness. Weight is configured independently in the admin panel.
function randomPick(){ const {a,total}=activeWeighted(); if(!a.length||total<=0)return null; const roll=crypto.randomInt(0,total); let cursor=0; for(const t of a){cursor+=t.risk;if(roll<cursor)return t;} return a[a.length-1]; }
function chances(){ const {a,total}=activeWeighted(); return Object.fromEntries(a.map(t=>[t.id,total>0?(t.risk/total)*100:0])); }
async function handle(req,res){
 const u=new URL(req.url,'http://localhost'); const p=u.pathname;
 try {
  if(req.method==='GET' && (p==='/'||p==='/index.html')) return serveFile(res,'index.html');
  if(req.method==='GET' && (p==='/admin'||p==='/admin.html')) {
    if(!isAdmin(req)){ res.writeHead(302,{Location:'/admin-login.html','Cache-Control':'no-store'}); return res.end(); }
    return serveFile(res,'admin.html');
  }
  if(req.method==='GET' && p==='/admin-login.html') return serveFile(res,'admin-login.html');
  if(req.method==='GET' && p.startsWith('/assets/')) return serveFile(res,p.slice(1));
  if(p==='/api/state'&&req.method==='GET') return json(res,200,publicState());
  if(p==='/api/admin-status'&&req.method==='GET') return json(res,200,{admin:isAdmin(req)});
  if(p==='/api/login'&&req.method==='POST'){const body=await readBody(req);if(!ADMIN_PASSWORD||body.password!==ADMIN_PASSWORD)return json(res,401,{error:'Неверный пароль'});const id=crypto.randomBytes(24).toString('hex');sessions.set(id,Date.now());res.writeHead(200,{'Set-Cookie':`laq_session=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${req.headers['x-forwarded-proto']==='https' || req.headers['x-forwarded-proto']==='https:'?'; Secure':''}`,'Content-Type':'application/json'});return res.end(JSON.stringify({ok:true}))}
  if(p==='/api/logout'&&req.method==='POST'){const id=cookieSession(req);sessions.delete(id);res.writeHead(200,{'Set-Cookie':'laq_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0','Content-Type':'application/json'});return res.end(JSON.stringify({ok:true}))}
  if(['/api/state','/api/tank','/api/add-tank','/api/delete-tank','/api/timer','/api/undo','/api/new-round','/api/reset','/api/spin','/api/eliminate','/api/mark-complete'].includes(p) && !isAdmin(req)) return json(res,403,{error:'Требуется вход администратора'});
  if(p==='/api/tank'&&req.method==='POST'){const body=await readBody(req);const id=Number(body.id);const t=state.tanks.find(x=>x.id===id);if(!t)return json(res,404,{error:'Танк не найден'});const amount=Math.max(0,Math.round(Number(body.amount)||0));previousStates.push(publicState());if(previousStates.length>20)previousStates.shift();const oldAmount=Number(t.amount)||0;t.amount=amount;if(body.weight!==undefined)t.weight=Math.max(1,Math.min(100,Math.round(Number(body.weight)||50)));if(typeof body.alive==='boolean')t.alive=body.alive;if(typeof body.marked3==='boolean')t.marked3=body.marked3;state.tanks=normalizeTanks(state.tanks);if(amount>oldAmount){const delta=amount-oldAmount;state.recentDonations=Array.isArray(state.recentDonations)?state.recentDonations:[];state.recentDonations.unshift({id:crypto.randomBytes(8).toString('hex'),tankId:t.id,tankName:t.name,amount:delta,total:amount,at:Date.now()});state.recentDonations=state.recentDonations.slice(0,12);}await saveState();broadcast();return json(res,200,{state:publicState(),tank:t})}
  if(p==='/api/add-tank'&&req.method==='POST'){
    const body=await readBody(req);
    const name=String(body.name||'').trim().slice(0,80);
    const image=String(body.image||'').trim().slice(0,1000);
    const nation=String(body.nation||'').trim().slice(0,40);
    const techClass=String(body.class||'').trim().slice(0,20);
    if(!name)return json(res,400,{error:'Укажи название танка'});
    if(!/^https?:\/\//i.test(image))return json(res,400,{error:'Укажи прямую ссылку на изображение (http/https)'});
    if(state.tanks.some(t=>t.name.toLowerCase()===name.toLowerCase()))return json(res,400,{error:'Такой танк уже есть'});
    const maxId=state.tanks.reduce((m,t)=>Math.max(m,Number(t.id)||0),0);
    previousStates.push(publicState()); if(previousStates.length>20)previousStates.shift();
    const t={id:maxId+1,name,image,nation,class:techClass,custom:true,amount:0,weight:50,alive:true};
    state.tanks.push(t); state.tanks=normalizeTanks(state.tanks); await saveState(); broadcast(); return json(res,200,{state:publicState(),tank:t});
  }
  if(p==='/api/delete-tank'&&req.method==='POST'){
    const body=await readBody(req); const id=Number(body.id); const t=state.tanks.find(x=>x.id===id);
    if(!t)return json(res,404,{error:'Танк не найден'});
    if(!t.custom)return json(res,400,{error:'Стандартные танки удалить нельзя'});
    previousStates.push(publicState()); if(previousStates.length>20)previousStates.shift();
    state.tanks=state.tanks.filter(x=>x.id!==id); await saveState(); broadcast(); return json(res,200,{state:publicState()});
  }
  if(p==='/api/mark-complete'&&req.method==='POST'){
    const body=await readBody(req); const id=Number(body.id); const t=state.tanks.find(x=>x.id===id);
    if(!t)return json(res,404,{error:'Танк не найден'});
    previousStates.push(publicState()); if(previousStates.length>20)previousStates.shift();
    t.marked3=body.marked3===true; if(t.marked3)t.alive=false; else t.alive=true;
    state.tanks=normalizeTanks(state.tanks); await saveState(); broadcast();
    return json(res,200,{state:publicState(),tank:state.tanks.find(x=>x.id===id)});
  }
  if(p==='/api/state'&&req.method==='PUT'){const body=await readBody(req);if(!body?.tanks?.length)return json(res,400,{error:'Некорректное состояние'});previousStates.push(publicState());if(previousStates.length>20)previousStates.shift();state={...body,version:10,updatedAt:Date.now(),timer:{...defaultTimer(),...(body.timer||{})},tanks:normalizeTanks(body.tanks),};await saveState();broadcast();return json(res,200,publicState())}
  if(p==='/api/spin'&&req.method==='POST'){
    const body=await readBody(req);
    const durationSec=Math.min(120,Math.max(3,Number(body.durationSec)||20));
    const picked=randomPick();
    if(!picked)return json(res,400,{error:'Нет активных танков'});
    const {a,total}=activeWeighted();
    const probability=total>0?100/total:0;
    return json(res,200,{ok:true,result:{id:picked.id,name:picked.name,amount:picked.amount},durationSec,participants:a.map(t=>({id:t.id,name:t.name,amount:t.amount,share:total?(Number(t.amount)||0)/a.reduce((s,x)=>s+(Number(x.amount)||0),0)*100:0}))});
  }
  if(p==='/api/eliminate'&&req.method==='POST'){
    const body=await readBody(req); const id=Number(body.id); const t=state.tanks.find(x=>x.id===id);
    if(!t)return json(res,404,{error:'Танк не найден'});
    if(t.alive===false)return json(res,200,{ok:true,state:publicState(),remaining:state.tanks.filter(x=>x.alive!==false&&x.marked3!==true&&Number(x.amount)>0).length,already:true});
    const alive=state.tanks.filter(x=>x.alive!==false && x.marked3!==true && Number(x.amount)>0);
    if(alive.length<=1)return json(res,400,{error:'Нельзя выбить последний танк'});
    previousStates.push(publicState()); if(previousStates.length>20)previousStates.shift();
    t.alive=false; state.lastEliminatedId=id; state.history=Array.isArray(state.history)?state.history:[];
    state.history.unshift({id:crypto.randomBytes(8).toString('hex'),tankId:id,tankName:t.name,amount:Number(t.amount)||0,at:Date.now(),round:state.round||1});
    state.history=state.history.slice(0,64);
    await saveState(); broadcast(); return json(res,200,{ok:true,state:publicState(),remaining:state.tanks.filter(x=>x.alive!==false&&x.marked3!==true&&Number(x.amount)>0).length});
  }
  if(p==='/api/timer'&&req.method==='POST'){const body=await readBody(req);const action=String(body.action||'');previousStates.push(publicState());if(previousStates.length>20)previousStates.shift();const cur={...defaultTimer(),...(state.timer||{})};if(action==='set'){const minutes=Math.min(10080,Math.max(1,Number(body.minutes)||60));cur.durationSec=Math.round(minutes*60);cur.endsAt=null;cur.running=false}else if(action==='start'){cur.endsAt=Date.now()+Math.max(60,Number(cur.durationSec)||3600)*1000;cur.running=true}else if(action==='pause'){if(cur.running&&cur.endsAt)cur.durationSec=Math.max(0,Math.ceil((Number(cur.endsAt)-Date.now())/1000));cur.endsAt=null;cur.running=false}else if(action==='reset'){cur.endsAt=null;cur.running=false}else return json(res,400,{error:'Неизвестное действие таймера'});state.timer=cur;await saveState();broadcast();return json(res,200,{timer:cur,state:publicState()})}
  if(p==='/api/undo'&&req.method==='POST'){const prev=previousStates.pop();if(!prev)return json(res,400,{error:'Нечего отменять'});state=prev;await saveState();broadcast();return json(res,200,{state:publicState()})}
  if(p==='/api/new-round'&&req.method==='POST'){previousStates.push(publicState());state.round++;state.lastEliminatedId=null;state.history=[];state.tanks.forEach(t=>{if(t.marked3!==true)t.alive=true;});state.timer={...defaultTimer(),...(state.timer||{}),endsAt:null,running:false};await saveState();broadcast();return json(res,200,{state:publicState()})}
  if(p==='/api/reset'&&req.method==='POST'){previousStates=[];state=initial();await saveState();broadcast();return json(res,200,publicState())}
  res.writeHead(404);res.end('Not found');
 } catch(e){ console.error(e); json(res,500,{error:e.message||'Server error'}); }
}
const server=http.createServer(handle); const wss=new WebSocketServer({noServer:true});
server.on('upgrade',(req,socket,head)=>{const u=new URL(req.url,'http://localhost');if(u.pathname!=='/ws')return socket.destroy();wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
wss.on('connection',ws=>ws.send(JSON.stringify({type:'state',state:publicState()})));
loadState().then(()=>server.listen(PORT,()=>console.log('LAQWINER AUCTION listening on '+PORT))).catch(e=>{console.error(e);process.exit(1)});
