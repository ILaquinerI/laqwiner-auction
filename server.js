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
['T-100 ЛТ','R132_VNII_100LT.png'],['Т-62А','R87_T62A.png'],['Vulcan','GB139_Vulcan.png'],['CS-63 Wilk','Pl34_CS_63_02.png'],
['Объект 168-122 «Квант»','R246_Object_168_122.png'],['Объект 907','R95_Object_907.png'],['Объект 277','R155_Object_277.png'],['ТЭТ-100','R213_TET_100.png'],
['Объект 780','R178_Object_780.png'],['Объект 268','R88_Object268.png'],['E 50 M','G73_E50_Ausf_M.png'],['Объект 120 «Таран»','R222_Object_120_Taran.png'],
['Erich Konzept I','G165_Erich_Konzept_I.png'],['Maus','G42_Maus.png'],['StuG Maus 17 cm','G181_StuG_Maus_17cm.png'],['Firebird','A175_OTAC_MT_58_02.png'],
['H-3','A163_H_3.png'],['XM57','A165_XM57.png'],['T110E3','A85_T110E3.png'],['Projet Murat','F119_Projet_Murat.png'],
['AMX 50 B','F10_AMX_50B.png'],['Tornade','F137_Tornade.png'],['Manticore','GB100_Manticore.png'],['Concept No. 5','GB120_Concept_No_5.png'],
['Nemesis','GB128_Nemesis.png'],['Vz. 55','Cz17_Vz_55.png'],['Vandal','GB88_T95_Chieftain_turret.png'],['113','Ch22_113.png'],
['BZ-75','Ch48_BZ_75.png'],['116-F3','Ch52_WZ_122_6_F3.png'],['Type 5 Heavy','J20_Type_2605.png'],['CS-63','Pl21_CS_63.png']
].map((x,i)=>({id:i+1,name:x[0],image:CDN+x[1],amount:0,alive:true}));
const initial = () => ({version:3,round:1,tanks:JSON.parse(JSON.stringify(tanks)),history:[],recentDonations:[],lastEliminatedId:null,updatedAt:Date.now()});
let state = initial();
let previousStates = [];
const sessions = new Map();

async function sb(pathname, opts={}) {
  if(!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase environment variables are missing');
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + pathname, { ...opts, headers:{ apikey:SUPABASE_KEY, Authorization:'Bearer '+SUPABASE_KEY, 'Content-Type':'application/json', ...(opts.headers||{}) }});
  if(!r.ok) throw new Error('Supabase '+r.status+': '+await r.text());
  return r.status===204 ? null : r.json();
}
async function loadState(){
  try { const rows=await sb('auction_state?id=eq.1&select=state'); if(rows?.[0]?.state?.tanks?.length) state=rows[0].state; else await saveState(); }
  catch(e){ console.error(e.message); }
}
async function saveState(){ state.updatedAt=Date.now(); await sb('auction_state',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:1,state,updated_at:new Date().toISOString()})}); }
function publicState(){ return JSON.parse(JSON.stringify(state)); }
function broadcast(){ const msg=JSON.stringify({type:'state',state:publicState()}); wss.clients.forEach(c=>{if(c.readyState===1)c.send(msg)}); }
function cookieSession(req){ const c=(req.headers.cookie||'').split(';').map(x=>x.trim()); const s=c.find(x=>x.startsWith('laq_session=')); return s?s.split('=')[1]:null; }
function isAdmin(req){ const id=cookieSession(req); return !!(id && sessions.has(id)); }
function json(res,status,obj){ const b=JSON.stringify(obj); res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(b); }
function readBody(req){ return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>2e6)reject(new Error('Body too large'))});req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch(e){reject(e)}});req.on('error',reject)}); }
function serveFile(res,file){ fs.readFile(path.join(ROOT,file),(e,b)=>{if(e)return res.writeHead(404).end('Not found'); const ext=path.extname(file); const type=ext==='.html'?'text/html; charset=utf-8':'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(b);}); }
function activeWeighted(){ const a=state.tanks.filter(t=>t.alive&&Number(t.amount)>0).map(t=>({...t,amount:Number(t.amount)||0})); const total=a.reduce((s,t)=>s+t.amount,0); return {a,total}; }
function weightedPick(){ const {a}=activeWeighted(); if(!a.length)return null; const total=a.reduce((sum,t)=>sum+1/Math.max(1,t.amount),0); let r=Math.random()*total; for(const t of a){r-=1/Math.max(1,t.amount);if(r<0)return t} return a[a.length-1]; }
function chances(){ const {a}=activeWeighted(); const total=a.reduce((sum,t)=>sum+1/Math.max(1,t.amount),0); return Object.fromEntries(a.map(t=>[t.id,total?(1/Math.max(1,t.amount))/total*100:0])); }
async function handle(req,res){
 const u=new URL(req.url,'http://localhost'); const p=u.pathname;
 try {
  if(req.method==='GET' && (p==='/'||p==='/index.html')) return serveFile(res,'index.html');
  if(req.method==='GET' && (p==='/admin'||p==='/admin.html')) {
    if(!isAdmin(req)){ res.writeHead(302,{Location:'/admin-login.html','Cache-Control':'no-store'}); return res.end(); }
    return serveFile(res,'admin.html');
  }
  if(req.method==='GET' && p==='/admin-login.html') return serveFile(res,'admin-login.html');
  if(req.method==='GET' && (p==='/overlay'||p==='/auction.html')) return serveFile(res,'auction.html');
  if(p==='/api/state'&&req.method==='GET') return json(res,200,publicState());
  if(p==='/api/admin-status'&&req.method==='GET') return json(res,200,{admin:isAdmin(req)});
  if(p==='/api/login'&&req.method==='POST'){const body=await readBody(req);if(!ADMIN_PASSWORD||body.password!==ADMIN_PASSWORD)return json(res,401,{error:'Неверный пароль'});const id=crypto.randomBytes(24).toString('hex');sessions.set(id,Date.now());res.writeHead(200,{'Set-Cookie':`laq_session=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${req.headers['x-forwarded-proto']==='https:'?'; Secure':''}`,'Content-Type':'application/json'});return res.end(JSON.stringify({ok:true}))}
  if(p==='/api/logout'&&req.method==='POST'){const id=cookieSession(req);sessions.delete(id);res.writeHead(200,{'Set-Cookie':'laq_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0','Content-Type':'application/json'});return res.end(JSON.stringify({ok:true}))}
  if(['/api/state','/api/spin','/api/undo','/api/new-round','/api/reset'].includes(p) && !isAdmin(req)) return json(res,403,{error:'Требуется вход администратора'});
  if(p==='/api/state'&&req.method==='PUT'){const body=await readBody(req);if(!body?.tanks?.length)return json(res,400,{error:'Некорректное состояние'});previousStates.push(publicState());if(previousStates.length>20)previousStates.shift();state={...body,version:3,updatedAt:Date.now()};await saveState();broadcast();return json(res,200,publicState())}
  if(p==='/api/spin'&&req.method==='POST'){const {a:active,total}=activeWeighted();if(active.length<2||total<=0)return json(res,400,{error:'Нужно минимум 2 танка с донатами'});const target=weightedPick();previousStates.push(publicState());if(previousStates.length>20)previousStates.shift();target.alive=false;state.lastEliminatedId=target.id;state.history.push({round:state.round,name:target.name,id:target.id,time:Date.now()});await saveState();broadcast();return json(res,200,{targetId:target.id,targetName:target.name,targetChance:(1/Math.max(1,target.amount))/active.reduce((sum,t)=>sum+1/Math.max(1,t.amount),0)*100,weights:chances(),state:publicState()})}
  if(p==='/api/undo'&&req.method==='POST'){const prev=previousStates.pop();if(!prev)return json(res,400,{error:'Нечего отменять'});state=prev;await saveState();broadcast();return json(res,200,{state:publicState()})}
  if(p==='/api/new-round'&&req.method==='POST'){previousStates.push(publicState());state.round++;state.lastEliminatedId=null;state.history=[];state.tanks.forEach(t=>t.alive=true);await saveState();broadcast();return json(res,200,{state:publicState()})}
  if(p==='/api/reset'&&req.method==='POST'){previousStates=[];state=initial();await saveState();broadcast();return json(res,200,publicState())}
  res.writeHead(404);res.end('Not found');
 } catch(e){ console.error(e); json(res,500,{error:e.message||'Server error'}); }
}
const server=http.createServer(handle); const wss=new WebSocketServer({noServer:true});
server.on('upgrade',(req,socket,head)=>{const u=new URL(req.url,'http://localhost');if(u.pathname!=='/ws')return socket.destroy();wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
wss.on('connection',ws=>ws.send(JSON.stringify({type:'state',state:publicState()})));
loadState().then(()=>server.listen(PORT,()=>console.log('LAQWINER AUCTION listening on '+PORT))).catch(e=>{console.error(e);process.exit(1)});
