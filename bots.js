/**
 * LYCAN — Système de Bots IA (JavaScript pur)
 */
const LycanBots = (() => {
  const EDGE_FUNCTION_URL = "https://sicyjahkxijkxrxtmjhl.supabase.co/functions/v1/bot-action";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpY3lqYWhreGlqa3hyeHRtamhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTczNjksImV4cCI6MjA4ODU5MzM2OX0.LnOf0QkBzdWZUh-IpVC9XNv7SP_SWpIwX-DTzT7y0q4";
  const MAX_BOTS = 17;
  const BOT_NAMES = ["LoupSombre","VilleneuveHugo","NocturneClair","FenrirLeGrand","MidnightRose","SeleneDeNuit","GarouSilencieux","OdysseeNoire","LunaireFred","CrepusculeVif","ThornWatcher","CendreEtSang","LesombresEaux","VespereBlanche","GallouxLouis","NuitProfonde","AuroreMorte"];
  const BOT_AVATARS = ["🐺","🦅","🦉","🦇","🌙","⭐","🔥","❄️","🌑","💀","🌿","🐍","🦁"];
  const PERSONALITIES = ["prudent","agressif","suspicieux","discret","leader","naif","analyste"];
  const ROLE_DIST = {4:["Loup-Garou","Villageois","Villageois","Voyante"],5:["Loup-Garou","Loup-Garou","Villageois","Villageois","Voyante"],6:["Loup-Garou","Loup-Garou","Villageois","Villageois","Voyante","Sorcière"],7:["Loup-Garou","Loup-Garou","Villageois","Villageois","Villageois","Voyante","Sorcière"],8:["Loup-Garou","Loup-Garou","Villageois","Villageois","Villageois","Voyante","Sorcière","Chasseur"],9:["Loup-Garou","Loup-Garou","Loup-Garou","Villageois","Villageois","Villageois","Voyante","Sorcière","Chasseur"],10:["Loup-Garou","Loup-Garou","Loup-Garou","Villageois","Villageois","Villageois","Villageois","Voyante","Sorcière","Chasseur"],12:["Loup-Garou","Loup-Garou","Loup-Garou","Villageois","Villageois","Villageois","Villageois","Villageois","Voyante","Sorcière","Chasseur","Cupidon"],17:["Loup-Garou","Loup-Garou","Loup-Garou","Loup-Garou","Loup-Garou","Villageois","Villageois","Villageois","Villageois","Villageois","Villageois","Villageois","Voyante","Sorcière","Chasseur","Cupidon","Villageois"]};
  const FALLBACK = ["Je surveille tout le monde...","Quelqu'un se comporte bizarrement !","{target} est suspect selon moi.","On devrait voter contre {target}.","Je fais confiance à {target}.","Qui n'a pas encore parlé ?"];

  let _game=null, _bots=[], _botMessages={}, _actionTimers=[], _isRunning=false;

  function init(game){ _game=game; _bots=[]; _botMessages={}; }

  function addBots(count, existingCount){
    existingCount=existingCount||0;
    if(!_game) return [];
    count=Math.min(count, MAX_BOTS-existingCount);
    if(count<=0) return [];
    const total=existingCount+count;
    const roles=getRoles(total).slice(existingCount);
    const used=new Set((_game.players||[]).map(p=>p.name));
    const newBots=[];
    for(let i=0;i<count;i++){
      const name=getUniqueName(used); used.add(name);
      const bot={id:"bot_"+Date.now()+"_"+i,name,avatar:BOT_AVATARS[Math.floor(Math.random()*BOT_AVATARS.length)],role:roles[i]||"Villageois",personality:PERSONALITIES[Math.floor(Math.random()*PERSONALITIES.length)],isAlive:true,isBot:true,suspicions:[],trusts:[],voteTarget:null};
      _bots.push(bot); _botMessages[bot.id]=[]; newBots.push(bot);
      if(_game.addPlayer) _game.addPlayer(bot);
    }
    return newBots;
  }

  function startPhase(){
    if(!_game||!_isRunning) return;
    const state=_game.getState ? _game.getState() : {};
    _bots.filter(b=>b.isAlive).forEach((bot,i)=>{
      const delay=rnd(1800,5500)+i*1200;
      const t=setTimeout(()=>executeBotTurn(bot,state),delay);
      _actionTimers.push(t);
    });
  }

  function setRunning(v){ _isRunning=v; if(!v){_actionTimers.forEach(t=>clearTimeout(t));_actionTimers=[];} }
  function killBot(id){ const b=_bots.find(x=>x.id===id); if(b) b.isAlive=false; }
  function getBots(){ return [..._bots]; }
  function getBot(id){ return _bots.find(b=>b.id===id); }
  function clearBots(){ setRunning(false); _bots.forEach(b=>{if(_game&&_game.removePlayer)_game.removePlayer(b.id);}); _bots=[]; _botMessages={}; }

  async function executeBotTurn(bot, state){
    try{ applyBotAction(bot, await callAPI(bot,state), state); }
    catch(e){ applyFallback(bot,state); }
  }

  async function callAPI(bot, state){
    const r=await fetch(EDGE_FUNCTION_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_ANON_KEY},body:JSON.stringify({bot,gameState:state})});
    if(!r.ok) throw new Error("HTTP "+r.status);
    return r.json();
  }

  function applyBotAction(bot, result, state){
    if(!result) return;
    if(result.message&&result.message!=="null"){ _botMessages[bot.id].push(result.message); if(_game&&_game.sendMessage)_game.sendMessage(bot.id,result.message); }
    if(result.action==="vote"&&result.targetId){ bot.voteTarget=result.targetId; if(_game&&_game.castVote)_game.castVote(bot.id,result.targetId); }
    if((result.action==="accuse"||result.action==="suspect")&&result.targetId&&!bot.suspicions.includes(result.targetId)) bot.suspicions.push(result.targetId);
    if((result.action==="night_kill"||result.action==="night_action")&&result.targetId&&_game&&_game.nightAction) _game.nightAction(bot.id,result.targetId);
  }

  function applyFallback(bot, state){
    const alive=(state.alivePlayers||[]).filter(p=>p.id!==bot.id);
    if(!alive.length) return;
    const target=alive[Math.floor(Math.random()*alive.length)];
    const msg=FALLBACK[Math.floor(Math.random()*FALLBACK.length)].replace("{target}",target.name);
    _botMessages[bot.id].push(msg);
    if(_game&&_game.sendMessage) _game.sendMessage(bot.id,msg);
    if(Math.random()>0.5){ bot.voteTarget=target.id; if(_game&&_game.castVote)_game.castVote(bot.id,target.id); }
  }

  function getRoles(total){
    const keys=Object.keys(ROLE_DIST).map(Number).sort((a,b)=>a-b);
    let best=keys[0]; for(const k of keys){ if(k<=total) best=k; }
    const base=[...ROLE_DIST[best]];
    while(base.length<total) base.push("Villageois");
    return shuffle(base).slice(0,total);
  }

  function getUniqueName(used){ const av=BOT_NAMES.filter(n=>!used.has(n)); return av.length?av[Math.floor(Math.random()*av.length)]:"Bot"+Math.floor(Math.random()*999); }
  function shuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;} return a; }
  function rnd(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

  function renderBotSelector(containerId, currentPlayers, onAdd){
    const el=document.getElementById(containerId);
    if(!el) return;
    const max=Math.min(MAX_BOTS-currentPlayers,16);
    if(max<=0){el.innerHTML='<p style="font-family:\'Cinzel\',serif;font-size:.7rem;color:var(--text-dim)">Salle pleine.</p>';return;}
    el.innerHTML=`<div style="background:linear-gradient(160deg,rgba(8,13,26,.97),rgba(11,18,40,.95));border:1px solid rgba(74,111,165,.25);padding:1.2rem;position:relative;margin-top:.5rem;"><div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(to right,transparent,#4a6fa5,transparent)"></div><div style="font-family:'Cinzel Decorative',serif;font-size:.8rem;color:#d4e0f0;margin-bottom:.8rem;">🤖 Bots IA</div><div style="display:flex;align-items:center;gap:.8rem;margin-bottom:.8rem;"><button onclick="LycanBots._adj(-1)" style="width:30px;height:30px;background:rgba(74,111,165,.15);border:1px solid rgba(74,111,165,.3);color:#d4e0f0;font-size:1.1rem;cursor:pointer;">−</button><div id="botCountDisplay" style="font-family:'Cinzel Decorative',serif;font-size:1.3rem;color:#d4e0f0;min-width:28px;text-align:center;">0</div><button onclick="LycanBots._adj(1)" style="width:30px;height:30px;background:rgba(74,111,165,.15);border:1px solid rgba(74,111,165,.3);color:#d4e0f0;font-size:1.1rem;cursor:pointer;">+</button><span style="font-family:'Cinzel',serif;font-size:.6rem;color:#5a7080;">/ ${max}</span></div><div id="botPreviewNames" style="font-size:.62rem;color:#5a7080;font-family:'Cinzel',serif;margin-bottom:.7rem;line-height:1.6;"></div><button onclick="LycanBots._confirm(${currentPlayers})" style="font-family:'Cinzel',serif;font-size:.65rem;letter-spacing:.15em;padding:.7rem;border:none;cursor:pointer;background:linear-gradient(135deg,#1a3a6e,#4a6fa5);color:#d4e0f0;width:100%;">🐺 Ajouter les bots</button></div>`;
    window._botOnAdd=onAdd; window._botCount=0; window._botMax=max;
  }

  function _adj(delta){ const max=window._botMax||0; let n=Math.max(0,Math.min(max,(window._botCount||0)+delta)); window._botCount=n; const d=document.getElementById("botCountDisplay"); if(d)d.textContent=n; const p=document.getElementById("botPreviewNames"); if(p)p.textContent=n>0?BOT_NAMES.slice(0,n).join(", "):""; }
  function _confirm(cur){ const n=window._botCount||0; if(n&&window._botOnAdd)window._botOnAdd(n); }

  const api={init,addBots,startPhase,setRunning,killBot,getBots,getBot,clearBots,renderBotSelector,_adj,_confirm};
  window.LycanBots=api;
  return api;
})();
