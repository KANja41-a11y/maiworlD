import { firebaseConfig, FIREBASE_READY } from "./firebase-config.js";

const CDN = "https://www.gstatic.com/firebasejs/12.2.1/";
const appPromise = FIREBASE_READY ? Promise.all([
  import(CDN+"firebase-app.js"),
  import(CDN+"firebase-auth.js"),
  import(CDN+"firebase-database.js")
]).then(([appMod, authMod, dbMod]) => ({...appMod, ...authMod, ...dbMod})) : Promise.resolve(null);

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
const state = {
  view:"home", world:"plaza", me:null, players:{}, chat:[], keys:new Set(),
  config:{name:"Mai",skin:"peach",hair:"blonde",top:"teePink",bottom:"jeans",dress:"none",eyes:"sparkle",mouths:"smile",shoes:"sneakers",accessories:"none",bags:"none"},
  worlds:[], items:[], characters:null, emotes:[], firebase:null, audio:null, lastSend:0, localDemo:true
};
let ctx = $("#gameCanvas").getContext("2d");
ctx.imageSmoothingEnabled=false;

async function loadJSON(path){ return fetch(path).then(r=>r.json()); }
async function init(){
  [state.worlds,state.items,state.characters,state.emotes] = await Promise.all([
    loadJSON("./data/world.json"),loadJSON("./data/items.json"),loadJSON("./data/characters.json"),loadJSON("./data/emotes.json")
  ]);
  const saved=localStorage.getItem("maiworld-profile");
  if(saved) Object.assign(state.config, JSON.parse(saved));
  populateEditor(); renderProfileEverywhere(); renderWorldChoices(); renderEmotes(); renderWorld();
  drawHero();
  bindUI();
  setTimeout(()=>$("#boot").classList.add("hide"),650);
  if(FIREBASE_READY) await setupFirebase(); else setConnection("Local demo");
  requestAnimationFrame(loop);
}
function bindUI(){
  $("#playBtn").onclick=()=>enterGame();
  $("#customizeBtn").onclick=()=>openModal("profileModal");
  $("#profileBtn").onclick=()=>openModal("profileModal");
  $("#profileGameBtn").onclick=()=>openModal("profileModal");
  $("#worldBtn").onclick=()=>openModal("worldModal");
  $("#friendsBtn").onclick=()=>{ renderFriendsModal(); openModal("friendsModal"); };
  $("#closeSide").onclick=()=>$(".game-layout").classList.remove("chat-open");
  $("#editNameBtn").onclick=()=>openModal("profileModal");
  $("#saveProfile").onclick=saveProfile;
  $("#chatForm").onsubmit=e=>{e.preventDefault();sendChat($("#chatInput").value);$("#chatInput").value=""};
  $("#musicBtn").onclick=toggleMusic;
  $("#mobileInteract").onclick=interact;
  $$(".mobile-controls [data-key]").forEach(b=>{
    b.addEventListener("touchstart",e=>{e.preventDefault();state.keys.add(b.dataset.key)});
    b.addEventListener("touchend",e=>{e.preventDefault();state.keys.delete(b.dataset.key)});
  });
  addEventListener("keydown",e=>{ if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","w","a","s","d","e"].includes(e.key)) { state.keys.add(e.key); if(e.key.toLowerCase()==="e") interact(); }});
  addEventListener("keyup",e=>state.keys.delete(e.key));
  $$(".modal-x").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
  $("#brandBtn").onclick=()=>showView("home");
  ["skinSelect","hairSelect","eyesSelect","mouthsSelect","topSelect","bottomSelect","dressSelect","shoesSelect","accessoriesSelect","bagsSelect","nameInput"].forEach(id=>$("#"+id).addEventListener("input",previewEditor));
}
function showView(v){ state.view=v; $$(".view").forEach(x=>x.classList.remove("active")); $("#"+v+"View").classList.add("active"); }
function enterGame(){
  showView("game");
  if(!state.me) createLocalPlayer();
  $(".game-layout").classList.add("chat-open");
  setTimeout(()=>$(".game-layout").classList.remove("chat-open"),700);
}
function createLocalPlayer(){
  state.me={uid:"local-"+uid().slice(0,8),...state.config,x:480,y:360,direction:"down",animation:"idle",online:true,lastSeen:Date.now()};
  state.players[state.me.uid]=state.me;
  updateCounts();
}
function populateEditor(){
  const fill=(id,key)=>{ const list=state.characters[key]||[]; const el=$("#"+id); if(!el)return; el.innerHTML=list.map(x=>`<option value="${x.id}">${x.name}</option>`).join(""); const prop=id.replace("Select",""); el.value=state.config[prop]||list[0]?.id; };
  fill("skinSelect","skins");fill("hairSelect","hair");fill("eyesSelect","eyes");fill("mouthsSelect","mouths");
  fill("topSelect","tops");fill("bottomSelect","bottoms");fill("dressSelect","dresses");fill("shoesSelect","shoes");
  fill("accessoriesSelect","accessories");fill("bagsSelect","bags"); $("#nameInput").value=state.config.name;
}
function previewEditor(){ const c=readEditor(); drawAvatar($("#profileAvatar"),c,3); }
function readEditor(){return {name:$("#nameInput").value.trim()||"Mai",skin:$("#skinSelect").value,hair:$("#hairSelect").value,eyes:$("#eyesSelect").value,mouths:$("#mouthsSelect").value,top:$("#topSelect").value,bottom:$("#bottomSelect").value,dress:$("#dressSelect").value,shoes:$("#shoesSelect").value,accessories:$("#accessoriesSelect").value,bags:$("#bagsSelect").value};}
function saveProfile(){
  Object.assign(state.config,readEditor()); localStorage.setItem("maiworld-profile",JSON.stringify(state.config));
  if(state.me){Object.assign(state.me,state.config); state.players[state.me.uid]=state.me; writePlayer();}
  renderProfileEverywhere(); closeModal("profileModal"); toast("Your new look is ready ✨");
}
function renderProfileEverywhere(){
  $("#sideName").textContent=state.config.name; drawAvatar($("#miniAvatar"),state.config,.9); drawAvatar($("#sideAvatar"),state.config,1.45); drawAvatar($("#profileAvatar"),state.config,3);
}
function renderWorldChoices(){
  $("#worldChoices").innerHTML=state.worlds.map(w=>`<button class="world-choice" data-world="${w.id}"><span class="emoji">${w.emoji}</span><strong>${w.name}</strong><small>${w.description}</small></button>`).join("");
  $$(".world-choice").forEach(b=>b.onclick=()=>{changeWorld(b.dataset.world);closeModal("worldModal")});
}
function changeWorld(id){
  const w=state.worlds.find(x=>x.id===id); if(!w)return;
  state.world=id;
  if(state.me){state.me.x=w.spawn[0];state.me.y=w.spawn[1];writePlayer();}
  $("#worldName").textContent=w.name.split(" ").slice(-1)[0];$("#worldTitle").textContent=w.name;$("#locationChip").textContent=w.name;
  renderWorld();toast(`Welcome to ${w.name} ${w.emoji}`);
}
function renderWorld(){ drawWorld(); }
function worldTheme(id){
  return {plaza:["#ffd5e5","#f2dfff","#d5b5e8"],park:["#d9f5d6","#c9ebff","#b7d99e"],school:["#d7ecff","#eadcff","#b9cdea"],cafe:["#ffe8c5","#f5d7e8","#d9b8a0"],studio:["#eadcff","#f8d6eb","#c6a8db"],beach:["#ffe3d4","#ffd0e5","#f0b88d"]}[id]||["#ffd5e5","#f2dfff","#d5b5e8"];
}
function drawWorld(){
  const W=960,H=600, g=ctx.createLinearGradient(0,0,0,H),t=worldTheme(state.world);g.addColorStop(0,t[0]);g.addColorStop(.58,t[1]);g.addColorStop(1,t[2]);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.fillStyle="rgba(255,255,255,.45)";for(let i=0;i<18;i++){let x=(i*97+37)%W,y=(i*61+40)%220;ctx.fillRect(x,y,2,2);ctx.fillRect(x+5,y+4,1,1)}
  drawGround();
  const id=state.world;
  if(id==="park") drawPark(); else if(id==="school") drawSchool(); else if(id==="cafe") drawCafe(); else if(id==="studio") drawStudio(); else if(id==="beach") drawBeach(); else drawPlaza();
  drawItems();
  Object.values(state.players).forEach(p=>drawPlayer(p));
}
function drawGround(){
  ctx.fillStyle="rgba(255,255,255,.38)";ctx.fillRect(0,250,960,350);
  ctx.fillStyle="rgba(164,121,151,.11)";for(let x=0;x<960;x+=48)for(let y=250;y<600;y+=48)ctx.fillRect(x,y,44,44);
}
function box(x,y,w,h,c,r=8){ctx.fillStyle=c;ctx.fillRect(x,y,w,h); if(r){ctx.fillStyle="rgba(255,255,255,.18)";ctx.fillRect(x,y,w,3)}}
function tree(x,y){ctx.fillStyle="#8b5c59";ctx.fillRect(x+19,y+38,10,42);ctx.fillStyle="#8fd2a1";ctx.fillRect(x+5,y+10,38,38);ctx.fillStyle="#aee4b8";ctx.fillRect(x+12,y,24,40);ctx.fillStyle="#6fbc91";ctx.fillRect(x,y+25,48,18)}
function drawPark(){for(let x=70;x<900;x+=150)tree(x,205+(x%70));box(360,400,240,62,"#c79a77",12);box(380,382,200,20,"#e9c7a9",8);ctx.fillStyle="#86cde0";ctx.beginPath();ctx.ellipse(760,410,90,45,0,0,Math.PI*2);ctx.fill();for(let x=100;x<850;x+=85){ctx.fillStyle="#ff9fbe";ctx.fillRect(x,315+(x%30),6,6);ctx.fillStyle="#ffe2a4";ctx.fillRect(x+6,309+(x%30),5,5)}}
function drawSchool(){box(300,150,360,180,"#fff7fb",18);box(325,175,310,35,"#ff9fc5",8);box(355,235,70,95,"#b99ee4",8);box(445,235,70,95,"#b99ee4",8);box(535,235,70,95,"#b99ee4",8);ctx.fillStyle="#ffd6e7";ctx.fillRect(455,115,50,35);ctx.fillStyle="#fff";ctx.font="16px 'Press Start 2P'";ctx.fillText("MOCHI",430,140)}
function drawCafe(){box(300,175,360,165,"#fff8ef",18);box(335,210,110,55,"#dca4c5",10);box(515,210,110,55,"#dca4c5",10);for(let x=120;x<820;x+=170){box(x,400,110,35,"#d49bb5",10);box(x+10,370,90,35,"#fff2d9",10)}}
function drawStudio(){box(270,145,420,200,"#fff5fb",18);box(350,205,260,20,"#d6b7e9",8);box(370,225,30,90,"#b18bd0",5);box(560,225,30,90,"#b18bd0",5);for(let i=0;i<8;i++){ctx.fillStyle=["#ff9fc5","#b9a1e9","#ffd59c","#9edfc2"][i%4];ctx.fillRect(300+(i%4)*95,165+Math.floor(i/4)*65,55,42)}}
function drawBeach(){ctx.fillStyle="#f9b6cf";ctx.fillRect(0,390,960,210);ctx.fillStyle="#f8df9d";ctx.fillRect(0,330,960,60);ctx.fillStyle="#ffd7e8";ctx.beginPath();ctx.arc(820,90,55,0,Math.PI*2);ctx.fill();for(let x=100;x<900;x+=180)ctx.fillText("☁",x,300)}
function drawPlaza(){ctx.fillStyle="#d8b9ef";ctx.beginPath();ctx.arc(480,390,110,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.fillRect(445,335,70,8);ctx.fillStyle="#ff9fc5";ctx.fillRect(465,320,30,15);tree(110,210);tree(790,210);box(370,160,220,70,"#fff7fb",16);ctx.fillStyle="#ff8fb9";ctx.font="16px 'Press Start 2P'";ctx.fillText("MAI",454,205)}
function drawItems(){const spots={plaza:[{x:200,y:390,id:"swing"},{x:710,y:380,id:"swing"}],park:[{x:420,y:400,id:"bench"},{x:780,y:410,id:"flower"}],school:[{x:250,y:350,id:"locker"},{x:680,y:350,id:"bell"}],cafe:[{x:420,y:400,id:"coffee"},{x:600,y:400,id:"jukebox"}],studio:[{x:210,y:360,id:"easel"},{x:730,y:360,id:"gallery"}],beach:[{x:250,y:450,id:"shell"}]}[state.world]||[];spots.forEach(s=>{ctx.fillStyle="#fff";ctx.fillRect(s.x-12,s.y-12,24,24);ctx.fillStyle="#ff9fbe";ctx.fillRect(s.x-6,s.y-6,12,12);ctx.fillStyle="#8b7180";ctx.font="10px 'Baloo 2'";ctx.fillText("E",s.x-4,s.y+29)})}
function drawPlayer(p){const x=Math.round(p.x),y=Math.round(p.y);ctx.save();ctx.translate(x,y);ctx.fillStyle="rgba(85,55,75,.15)";ctx.fillRect(-16,18,32,7);drawAvatar(ctx,p,1.35,true);ctx.restore();ctx.fillStyle="#fff";ctx.strokeStyle="rgba(100,70,90,.12)";ctx.lineWidth=1;const tw=Math.max(42,p.name.length*6+18);ctx.fillRect(x-tw/2,y-65,tw,20);ctx.strokeRect(x-tw/2,y-65,tw,20);ctx.fillStyle="#5a4654";ctx.font="bold 11px 'Baloo 2'";ctx.textAlign="center";ctx.fillText(p.name,x,y-51);ctx.textAlign="left"}
function drawAvatar(target, p, scale=1, centered=false){
  const c=target instanceof HTMLCanvasElement?target.getContext("2d"):target; const W=target instanceof HTMLCanvasElement?target.width:96,H=target instanceof HTMLCanvasElement?target.height:96;
  c.clearRect(0,0,W,H);c.imageSmoothingEnabled=false;c.save();
  if(centered)c.translate(0,0); else c.translate(W/2,H/2);
  const s=scale*10, skin={peach:"#f5b99d",cream:"#f8d0b7",honey:"#d9946f",mocha:"#9f6758"}[p.skin]||"#f5b99d";
  // shadow/body
  c.fillStyle="#6e5962";c.fillRect(-7*s/2,11*s/3,7*s,2*s/3);
  // legs + shoes
  const bottom=p.dress!=="none"?p.dress:{jeans:"#6f9ac8",skirt:"#f18db1",shorts:"#f2cfa8",wide:"#8c7cb8",cargo:"#a5b18d",pleated:"#f0a8c7"}[p.bottom]||"#6f9ac8";
  c.fillStyle=bottom;c.fillRect(-2.5*s,5*s,2*s,6*s);c.fillRect(.5*s,5*s,2*s,6*s);
  const shoe={sneakers:"#ff9fc5",mary:"#7e6c9c",boots:"#c69ae2",sandals:"#f0c37f",loafers:"#8d6d7d",platform:"#d77fa8"}[p.shoes]||"#ff9fc5";
  c.fillStyle=shoe;c.fillRect(-3*s,10*s,3*s,1.7*s);c.fillRect(0*s,10*s,3*s,1.7*s);
  // outfit
  const dress={strawberry:"#ff94b9",lavender:"#b69be9",cloud:"#b9dff2"}[p.dress];
  c.fillStyle=dress||({teePink:"#ff9fc5",teeLilac:"#b7a0e8",hoodie:"#d5b7e6",cardi:"#f2b7a6"}[p.top]||"#ff9fc5");
  if(dress)c.fillRect(-5*s,0,10*s,7*s);else{c.fillRect(-5*s,0,10*s,6*s);c.fillRect(-7*s,1*s,2*s,4*s);c.fillRect(5*s,1*s,2*s,4*s)}
  // head
  c.fillStyle=skin;c.fillRect(-5*s,-9*s,10*s,10*s);c.fillRect(-4*s,-10*s,8*s,12*s);
  // hair
  const hair={blonde:"#f2c477",brown:"#80534b",black:"#3e3543",pink:"#e99dc5"}[p.hair]||"#f2c477";c.fillStyle=hair;c.fillRect(-6*s,-11*s,12*s,5*s);c.fillRect(-6*s,-7*s,3*s,9*s);c.fillRect(3*s,-7*s,3*s,9*s);c.fillRect(-4*s,-12*s,8*s,3*s);
  // eyes
  c.fillStyle="#4b3945";
  const eye=p.eyes||"sparkle";
  if(eye==="sleepy"){c.fillRect(-3*s,-4*s,2*s,1*s);c.fillRect(1*s,-4*s,2*s,1*s)}
  else if(eye==="heart"){c.fillStyle="#e8789f";c.fillRect(-3*s,-5*s,2*s,2*s);c.fillRect(1*s,-5*s,2*s,2*s)}
  else if(eye==="wink"){c.fillRect(-3*s,-4*s,2*s,1*s);c.fillRect(1*s,-5*s,2*s,2*s)}
  else {c.fillRect(-3*s,-5*s,1.5*s,2*s);c.fillRect(1.5*s,-5*s,1.5*s,2*s);c.fillStyle="#fff";c.fillRect(-2.7*s,-5*s,.7*s,.7*s);c.fillRect(1.8*s,-5*s,.7*s,.7*s)}
  c.fillStyle="#ef8ca4";c.fillRect(-4*s,-2*s,2*s,1*s);c.fillRect(2*s,-2*s,2*s,1*s);
  // mouth
  c.fillStyle="#8c5669";const mouth=p.mouths||"smile";
  if(mouth==="open"){c.fillRect(-1.5*s,-1*s,3*s,2*s)}
  else if(mouth==="cat"){c.fillRect(-2*s,-1*s,1*s,1*s);c.fillRect(1*s,-1*s,1*s,1*s);c.fillRect(-1*s,0,2*s,1*s)}
  else if(mouth==="pout"){c.fillRect(-2*s,0,4*s,1*s)}
  else{c.fillRect(-1*s,-1*s,2*s,1*s)}
  // head accessories
  const acc=p.accessories||"none";
  if(acc==="bear"){c.fillStyle="#c99472";c.fillRect(-7*s,-10*s,3*s,3*s);c.fillRect(4*s,-10*s,3*s,3*s)}
  if(acc==="cat"){c.fillStyle="#c78ab1";c.fillRect(-7*s,-11*s,3*s,4*s);c.fillRect(4*s,-11*s,3*s,4*s)}
  if(acc==="bow"){c.fillStyle="#ff7fab";c.fillRect(-8*s,-5*s,3*s,3*s);c.fillRect(5*s,-5*s,3*s,3*s);c.fillRect(-1*s,-4*s,2*s,2*s)}
  if(acc==="flower"){c.fillStyle="#ffd66f";c.fillRect(5*s,-8*s,2*s,2*s);c.fillStyle="#ff9fc5";c.fillRect(6*s,-9*s,2*s,2*s)}
  if(acc==="crown"){c.fillStyle="#ffd66f";c.fillRect(-4*s,-14*s,8*s,3*s);c.fillRect(-3*s,-16*s,2*s,3*s);c.fillRect(1*s,-16*s,2*s,3*s)}
  if(acc==="glasses"){c.strokeStyle="#7f6c7b";c.lineWidth=Math.max(1,s/3);c.strokeRect(-4*s,-6*s,3*s,3*s);c.strokeRect(1*s,-6*s,3*s,3*s);c.beginPath();c.moveTo(-1*s,-4.5*s);c.lineTo(1*s,-4.5*s);c.stroke()}
  if(acc==="headphones"){c.strokeStyle="#9a7cc7";c.lineWidth=Math.max(1,s/2);c.beginPath();c.arc(0,-4*s,7*s,Math.PI,0);c.stroke();c.fillStyle="#9a7cc7";c.fillRect(-7*s,-5*s,2*s,4*s);c.fillRect(5*s,-5*s,2*s,4*s)}
  // bag
  const bag=p.bags||"none"; if(bag!=="none"){c.fillStyle=bag==="heartbag"?"#ff91b8":bag==="teddy"?"#b98970":bag==="backpack"?"#8fb8df":"#c8a9ee";c.fillRect(6*s,2*s,3*s,5*s)}
  c.restore();
}
function drawHero(){const h=$("#heroCanvas").getContext("2d");h.imageSmoothingEnabled=false;h.clearRect(0,0,620,520);h.fillStyle="#ffd7e7";h.fillRect(0,390,620,130);h.fillStyle="#e4c8f6";h.fillRect(0,360,620,30);for(let x=40;x<600;x+=85){h.fillStyle="#fff";h.fillRect(x,340,55,35);h.fillStyle="#ff9fc5";h.fillRect(x+10,320,35,20)};h.save();h.translate(310,370);drawAvatar(h,state.config,3,true);h.restore()}
function loop(t){
  if(state.view==="game"&&state.me){
    let dx=0,dy=0;if(state.keys.has("ArrowLeft")||state.keys.has("a"))dx--;if(state.keys.has("ArrowRight")||state.keys.has("d"))dx++;if(state.keys.has("ArrowUp")||state.keys.has("w"))dy--;if(state.keys.has("ArrowDown")||state.keys.has("s"))dy++;
    if(dx||dy){const len=Math.hypot(dx,dy)||1;state.me.x=clamp(state.me.x+dx/len*2.5,35,925);state.me.y=clamp(state.me.y+dy/len*2.5,285,565);state.me.direction=Math.abs(dx)>Math.abs(dy)?(dx>0?"right":"left"):(dy>0?"down":"up");state.me.animation="walk";if(t-state.lastSend>90){writePlayer();state.lastSend=t}}else state.me.animation="idle";
    ctx.clearRect(0,0,960,600);drawWorld();
  }
  requestAnimationFrame(loop);
}
function nearestItem(){const list={plaza:[[200,390,"swing"],[710,380,"swing"]],park:[[420,400,"bench"],[780,410,"flower"]],school:[[250,350,"locker"],[680,350,"bell"]],cafe:[[420,400,"coffee"],[600,400,"jukebox"]],studio:[[210,360,"easel"],[730,360,"gallery"]],beach:[[250,450,"shell"]]}[state.world]||[];let best=null,bd=70;for(const [x,y,id] of list){const d=Math.hypot(state.me.x-x,state.me.y-y);if(d<bd){best=id;bd=d}}return best}
function interact(){const id=nearestItem();if(!id){toast("Walk closer to something cute ✦");return}const item=state.items.find(x=>x.id===id);if(item){$("#interactionBubble").textContent=item.message;$("#interactionBubble").classList.remove("hidden");clearTimeout(interact.timer);interact.timer=setTimeout(()=>$("#interactionBubble").classList.add("hidden"),3000);sendChat(`♡ ${item.message}`)}}
function renderEmotes(){
  const bar=$("#emoteBar"); if(!bar)return;
  bar.innerHTML=state.emotes.map(e=>`<button class="emote-btn" data-emote="${e.id}" title="${e.label}">${e.emoji} ${e.label}</button>`).join("");
  $$(".emote-btn").forEach(b=>b.onclick=()=>doEmote(b.dataset.emote));
}
function doEmote(id){
  const e=state.emotes.find(x=>x.id===id); if(!e)return;
  const bubble=$("#interactionBubble"); bubble.textContent=e.emoji+" "+e.label; bubble.classList.remove("hidden");
  clearTimeout(doEmote.t); doEmote.t=setTimeout(()=>bubble.classList.add("hidden"),1500);
  sendChat(`${e.emoji} ${e.label}`);
  if(state.me) state.me.emote=id;
}
async function setupFirebase(){
  try{
    const {initializeApp,getApps}=await appPromise;const {getAuth,signInAnonymously}=await appPromise;const {getDatabase,ref,set,onValue,onDisconnect,push}=await appPromise;
    const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);const auth=getAuth(app);const db=getDatabase(app);state.firebase={auth,db,ref,set,onValue,onDisconnect,push};
    const cred=await signInAnonymously(auth);state.me={uid:cred.user.uid,...state.config,x:480,y:360,direction:"down",animation:"idle",online:true,lastSeen:Date.now()};state.localDemo=false;
    setConnection("Online world");
    const playerRef=ref(db,`worlds/${state.world}/players/${state.me.uid}`);
    await set(playerRef,state.me);onDisconnect(playerRef).remove();
    listenWorld();
  }catch(e){console.warn(e);setConnection("Local demo");toast("Firebase not connected — local demo mode");createLocalPlayer()}
}
function listenWorld(){
  const {db,ref,onValue}=state.firebase;onValue(ref(db,`worlds/${state.world}/players`),snap=>{state.players=snap.val()||{};state.me=state.players[state.me.uid]||state.me;updateCounts();renderPlayers()});
  onValue(ref(db,`worlds/${state.world}/chat`),snap=>{const obj=snap.val()||{};state.chat=Object.values(obj).sort((a,b)=>a.timestamp-b.timestamp).slice(-40);renderChat()});
}
async function writePlayer(){
  if(!state.me)return;state.me.lastSeen=Date.now();state.me.online=true;state.players[state.me.uid]=state.me;updateCounts();
  if(state.localDemo)return;
  const {db,ref,set}=state.firebase;await set(ref(db,`worlds/${state.world}/players/${state.me.uid}`),state.me);
}
async function sendChat(text){
  text=text.trim();if(!text)return;
  const msg={uid:state.me?.uid||"local",name:state.config.name,text,timestamp:Date.now()};
  if(state.localDemo){state.chat=[...state.chat,msg].slice(-40);renderChat();return}
  const {db,ref,push,set}=state.firebase;const m=push(ref(db,`worlds/${state.world}/chat`));await set(m,msg);
}
function renderChat(){const log=$("#chatLog");log.innerHTML=state.chat.map(m=>`<div class="chat-msg ${m.uid===state.me?.uid?"me":""}"><b>${escapeHTML(m.name)}</b><br><p>${escapeHTML(m.text)}</p></div>`).join("");log.scrollTop=log.scrollHeight}
function renderPlayers(){
  const arr=Object.values(state.players);$("#playerList").innerHTML=arr.map(p=>`<div class="player-chip"><canvas width="32" height="32" data-pid="${p.uid}"></canvas>${escapeHTML(p.name)}</div>`).join("");arr.forEach(p=>{const c=document.querySelector(`[data-pid="${p.uid}"]`);if(c)drawAvatar(c,p,.35)});
}
function renderFriendsModal(){const arr=Object.values(state.players);$("#friendsModalList").innerHTML=arr.map(p=>`<div class="friend-row"><canvas width="56" height="56" data-fpid="${p.uid}"></canvas><div><b>${escapeHTML(p.name)}</b><br><small>${p.uid===state.me?.uid?"you":"in "+state.world}</small></div><button class="ghost" onclick="window.wavePlayer('${p.uid}')">👋</button></div>`).join("");arr.forEach(p=>{const c=document.querySelector(`[data-fpid="${p.uid}"]`);if(c)drawAvatar(c,p,.55)})}
window.wavePlayer=(id)=>{const p=state.players[id];if(p)toast(`You waved at ${p.name}! 👋`)};
function updateCounts(){const n=Object.values(state.players).length;$("#onlineCount").textContent=n;$("#friendCount").textContent=Math.max(0,n-1)}
function setConnection(t){$("#connectionText").textContent=t}
function openModal(id){$("#"+id).classList.remove("hidden");previewEditor()}
function closeModal(id){$("#"+id).classList.add("hidden")}
function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2400)}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
let audioOn=false;
function toggleMusic(){
  if(!state.audio){const AC=window.AudioContext||window.webkitAudioContext;if(!AC){toast("Your browser does not support Web Audio");return}const ac=new AC();const master=ac.createGain();master.gain.value=.035;master.connect(ac.destination);state.audio={ac,master};}
  const a=state.audio;
  if(audioOn){a.master.gain.setTargetAtTime(0,a.ac.currentTime,.08);audioOn=false;$("#musicBtn").textContent="♫";return}
  if(a.ac.state==="suspended")a.ac.resume();a.master.gain.setTargetAtTime(.035,a.ac.currentTime,.08);audioOn=true;$("#musicBtn").textContent="❚❚";
  const notes=[261.63,329.63,392,329.63,293.66,349.23,440,349.23];let i=0;
  const play=()=>{if(!audioOn)return;const o=a.ac.createOscillator(),g=a.ac.createGain();o.type="sine";o.frequency.value=notes[i++%notes.length];g.gain.setValueAtTime(0,a.ac.currentTime);g.gain.linearRampToValueAtTime(.7,a.ac.currentTime+.04);g.gain.exponentialRampToValueAtTime(.001,a.ac.currentTime+1.1);o.connect(g);g.connect(a.master);o.start();o.stop(a.ac.currentTime+1.15);setTimeout(play,900)};play();
}
init();
