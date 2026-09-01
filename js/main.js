/* ==========================================================
   MAIWORLD — main.js
   Semua data (rambut/baju/dunia/teman) dari JSON. Progres
   pribadi (karakter, kunjungan objek, high-five) disimpan di
   localStorage.
   ========================================================== */

const LS_KEYS = {
  myChar: "maiworld_my_character",
  hifives: "maiworld_hifives",
  visits: "maiworld_visits"
};

let bodyGrid = null;
let hairStyles = [];
let hairColors = [];
let skinTones = [];
let palettes = [];
let topGrid = null, bottomGrid = null, dressGrid = null;
let accessories = [];
let worldsData = [];
let friendsData = [];

let customizer = {
  skin: "terang",
  hairStyle: "pendek",
  hairColor: "hitam",
  clothingMode: "dress",
  dressColor: "pink",
  topColor: "sky",
  bottomColor: "mint",
  accessory: "none",
  name: ""
};

let currentWorldIndex = 0;
let playerPos = { x: 0, y: 0 };
let tileSize = 44;
let invitedFriend = null;

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function loadLocal(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch (e) { return fallback; }
}
function saveLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* noop */ }
}
function showToast(msg) {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.classList.add("is-visible");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}
function escapeHtml(str = "") {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
function hexOf(list, id) {
  const item = list.find(x => x.id === id);
  return item ? item.hex : "#FF9FC1";
}
function hairGridOf(id) {
  const h = hairStyles.find(h => h.id === id);
  return h ? h.grid : hairStyles[0].grid;
}

/* ---------- build a full render-data object from an appearance config ---------- */
function buildRenderData(appearance) {
  return {
    bodyGrid,
    skinHex: hexOf(skinTones, appearance.skin),
    hairGrid: hairGridOf(appearance.hairStyle),
    hairHex: hexOf(hairColors, appearance.hairColor),
    clothingMode: appearance.clothingMode,
    dressGrid, dressHex: hexOf(palettes, appearance.dressColor),
    topGrid, topHex: hexOf(palettes, appearance.topColor),
    bottomGrid, bottomHex: hexOf(palettes, appearance.bottomColor),
    accessory: appearance.accessory
  };
}

/* ---------- data loading ---------- */
async function loadAllData() {
  const [bodyRes, hairRes, hairColorRes, skinRes, palettesRes, topRes, bottomRes, dressRes, accRes, worldsRes, friendsRes] =
    await Promise.all([
      fetch("data/body.json"),
      fetch("data/hair.json"),
      fetch("data/hairColors.json"),
      fetch("data/skinTones.json"),
      fetch("data/palettes.json"),
      fetch("data/tops.json"),
      fetch("data/bottoms.json"),
      fetch("data/dresses.json"),
      fetch("data/accessories.json"),
      fetch("data/worlds.json"),
      fetch("data/friends.json")
    ]);
  bodyGrid = (await bodyRes.json()).grid;
  hairStyles = (await hairRes.json()).styles;
  hairColors = await hairColorRes.json();
  skinTones = await skinRes.json();
  palettes = await palettesRes.json();
  topGrid = (await topRes.json()).grid;
  bottomGrid = (await bottomRes.json()).grid;
  dressGrid = (await dressRes.json()).grid;
  accessories = await accRes.json();
  worldsData = (await worldsRes.json()).worlds;
  friendsData = await friendsRes.json();
}

/* ---------- customizer ---------- */
function initCustomizer() {
  const saved = loadLocal(LS_KEYS.myChar, null);
  if (saved) customizer = { ...customizer, ...saved };

  $("#skinPicker").innerHTML = skinTones.map(s => `<span class="swatch" data-skin="${s.id}" style="background:${s.hex}" title="${escapeHtml(s.name)}"></span>`).join("");
  $("#hairStylePicker").innerHTML = hairStyles.map(h => `<button type="button" class="option-btn" data-hairstyle="${h.id}">${escapeHtml(h.name)}</button>`).join("");
  $("#hairColorPicker").innerHTML = hairColors.map(c => `<span class="swatch" data-haircolor="${c.id}" style="background:${c.hex}" title="${escapeHtml(c.name)}"></span>`).join("");
  $("#dressColorPicker").innerHTML = palettes.map(p => `<span class="swatch" data-dresscolor="${p.id}" style="background:${p.hex}" title="${escapeHtml(p.name)}"></span>`).join("");
  $("#topColorPicker").innerHTML = palettes.map(p => `<span class="swatch" data-topcolor="${p.id}" style="background:${p.hex}" title="${escapeHtml(p.name)}"></span>`).join("");
  $("#bottomColorPicker").innerHTML = palettes.map(p => `<span class="swatch" data-bottomcolor="${p.id}" style="background:${p.hex}" title="${escapeHtml(p.name)}"></span>`).join("");
  $("#accessoryPicker").innerHTML = accessories.map(a => `<button type="button" class="option-btn" data-accessory="${a.id}">${escapeHtml(a.name)}</button>`).join("");
  $("#charName").value = customizer.name || "";

  syncCustomizerUI();
  renderPreview();

  $$("[data-skin]").forEach(el => el.addEventListener("click", () => { customizer.skin = el.dataset.skin; syncCustomizerUI(); renderPreview(); }));
  $$("[data-hairstyle]").forEach(el => el.addEventListener("click", () => { customizer.hairStyle = el.dataset.hairstyle; syncCustomizerUI(); renderPreview(); }));
  $$("[data-haircolor]").forEach(el => el.addEventListener("click", () => { customizer.hairColor = el.dataset.haircolor; syncCustomizerUI(); renderPreview(); }));
  $$("[data-dresscolor]").forEach(el => el.addEventListener("click", () => { customizer.dressColor = el.dataset.dresscolor; syncCustomizerUI(); renderPreview(); }));
  $$("[data-topcolor]").forEach(el => el.addEventListener("click", () => { customizer.topColor = el.dataset.topcolor; syncCustomizerUI(); renderPreview(); }));
  $$("[data-bottomcolor]").forEach(el => el.addEventListener("click", () => { customizer.bottomColor = el.dataset.bottomcolor; syncCustomizerUI(); renderPreview(); }));
  $$("[data-accessory]").forEach(el => el.addEventListener("click", () => { customizer.accessory = el.dataset.accessory; syncCustomizerUI(); renderPreview(); }));

  $$("#clothingModePicker .option-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      customizer.clothingMode = btn.dataset.mode;
      syncCustomizerUI();
      renderPreview();
    });
  });

  $("#charName").addEventListener("input", (e) => { customizer.name = e.target.value; renderPreview(); });

  $("#btnSaveChar").addEventListener("click", () => {
    saveLocal(LS_KEYS.myChar, customizer);
    showToast(`Karakter "${customizer.name || "kamu"}" tersimpan!`);
    placePlayerSprite();
  });

  $("#btnInvite").addEventListener("click", generateInviteLink);
}

function syncCustomizerUI() {
  $$("[data-skin]").forEach(el => el.classList.toggle("is-active", el.dataset.skin === customizer.skin));
  $$("[data-hairstyle]").forEach(el => el.classList.toggle("is-active", el.dataset.hairstyle === customizer.hairStyle));
  $$("[data-haircolor]").forEach(el => el.classList.toggle("is-active", el.dataset.haircolor === customizer.hairColor));
  $$("[data-dresscolor]").forEach(el => el.classList.toggle("is-active", el.dataset.dresscolor === customizer.dressColor));
  $$("[data-topcolor]").forEach(el => el.classList.toggle("is-active", el.dataset.topcolor === customizer.topColor));
  $$("[data-bottomcolor]").forEach(el => el.classList.toggle("is-active", el.dataset.bottomcolor === customizer.bottomColor));
  $$("[data-accessory]").forEach(el => el.classList.toggle("is-active", el.dataset.accessory === customizer.accessory));
  $$("#clothingModePicker .option-btn").forEach(btn => btn.classList.toggle("is-active", btn.dataset.mode === customizer.clothingMode));

  const isDress = customizer.clothingMode === "dress";
  $("#dressColorField").hidden = !isDress;
  $("#topColorField").hidden = isDress;
  $("#bottomColorField").hidden = isDress;
}

function renderPreview() {
  PixelArt.draw($("#previewCanvas"), buildRenderData(customizer));
  $("#previewName").textContent = customizer.name || "Karaktermu";
}

/* ---------- invite link ---------- */
function generateInviteLink() {
  if (!customizer.name) { showToast("Isi nama karaktermu dulu ya sebelum mengundang teman."); return; }
  const params = new URLSearchParams({
    inv_name: customizer.name,
    inv_skin: customizer.skin,
    inv_hairStyle: customizer.hairStyle,
    inv_hairColor: customizer.hairColor,
    inv_clothingMode: customizer.clothingMode,
    inv_dressColor: customizer.dressColor,
    inv_topColor: customizer.topColor,
    inv_bottomColor: customizer.bottomColor,
    inv_accessory: customizer.accessory
  });
  const url = `${location.origin}${location.pathname}?${params.toString()}#dunia`;
  navigator.clipboard?.writeText(url).catch(() => {});
  showToast("Link undangan disalin! Kirim ke temanmu.");
}

function checkInviteFromUrl() {
  const params = new URLSearchParams(location.search);
  if (params.has("inv_name")) {
    invitedFriend = {
      name: params.get("inv_name"),
      skin: params.get("inv_skin") || "terang",
      hairStyle: params.get("inv_hairStyle") || "pendek",
      hairColor: params.get("inv_hairColor") || "hitam",
      clothingMode: params.get("inv_clothingMode") || "dress",
      dressColor: params.get("inv_dressColor") || "pink",
      topColor: params.get("inv_topColor") || "sky",
      bottomColor: params.get("inv_bottomColor") || "mint",
      accessory: params.get("inv_accessory") || "none"
    };
    const banner = $("#inviteBanner");
    banner.hidden = false;
    const canvasId = "inviteCanvas_" + Date.now();
    banner.innerHTML = `<canvas id="${canvasId}" width="80" height="112"></canvas><span>🎉 ${escapeHtml(invitedFriend.name)} mengundangmu main bareng di MAIWORLD! Karakternya ikut nongkrong di dunia ini sekarang.</span>`;
    PixelArt.draw($("#" + canvasId), buildRenderData(invitedFriend));
  }
}

/* ---------- world tabs & engine ---------- */
function initWorldTabs() {
  const tabs = $("#worldTabs");
  tabs.innerHTML = worldsData.map((w, i) => `<button type="button" class="world-tab${i === 0 ? " is-active" : ""}" data-world-index="${i}">${w.icon} ${escapeHtml(w.name)}</button>`).join("");
  $$("[data-world-index]", tabs).forEach(btn => {
    btn.addEventListener("click", () => {
      currentWorldIndex = Number(btn.dataset.worldIndex);
      $$(".world-tab", tabs).forEach(t => t.classList.remove("is-active"));
      btn.classList.add("is-active");
      loadWorld(currentWorldIndex);
    });
  });
}

function currentWorld() { return worldsData[currentWorldIndex]; }

function loadWorld(index) {
  currentWorldIndex = index;
  const world = currentWorld();
  const stage = $("#worldStage");
  stage.dataset.theme = world.theme;

  const grid = $("#worldGrid");
  grid.style.gridTemplateColumns = `repeat(${world.cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${world.rows}, 1fr)`;
  grid.innerHTML = world.tiles.map(row => row.split("").map(ch => `<div class="tile tile-${ch}"></div>`).join("")).join("");

  playerPos = { ...world.start };
  renderTileSize();
  rebuildSpriteLayer();
}

function rebuildSpriteLayer() {
  $("#worldSprites").innerHTML = "";
  renderSpots();
  renderFriendSprites();
  placePlayerSprite();
  if (invitedFriend) renderInvitedSprite();
  checkProximity();
}

function initWorld() {
  loadWorld(0);
  window.addEventListener("resize", () => { renderTileSize(); rebuildSpriteLayer(); });

  const stage = $("#worldStage");
  stage.addEventListener("keydown", handleKeyMove);
  document.addEventListener("keydown", (e) => {
    if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") return;
    if (isWorldInView()) handleKeyMove(e);
  });
  $$(".dpad-btn", $("#dpad")).forEach(btn => btn.addEventListener("click", () => movePlayer(btn.dataset.dir)));
}

function handleKeyMove(e) {
  const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
  const dir = map[e.key];
  if (dir) { e.preventDefault(); movePlayer(dir); }
}

function isWorldInView() {
  const rect = $("#dunia").getBoundingClientRect();
  return rect.top < window.innerHeight * 0.8 && rect.bottom > window.innerHeight * 0.2;
}

function renderTileSize() {
  const stage = $("#worldStage");
  const world = currentWorld();
  const usableWidth = stage.clientWidth - 32;
  tileSize = Math.floor(usableWidth / world.cols);
  const grid = $("#worldGrid");
  grid.style.width = `${tileSize * world.cols}px`;
  grid.style.height = `${tileSize * world.rows}px`;
}

function tileAt(x, y) { return currentWorld().tiles[y]?.[x]; }

function movePlayer(dir) {
  let { x, y } = playerPos;
  if (dir === "up") y -= 1;
  if (dir === "down") y += 1;
  if (dir === "left") x -= 1;
  if (dir === "right") x += 1;
  const world = currentWorld();
  if (x < 0 || y < 0 || x >= world.cols || y >= world.rows) return;
  if (tileAt(x, y) === "W") return;
  playerPos = { x, y };
  placePlayerSprite();
  checkProximity();
}

function spriteXY(x, y) { return { left: x * tileSize, top: y * tileSize }; }

function placePlayerSprite() {
  let el = $("#playerSprite");
  const saved = loadLocal(LS_KEYS.myChar, customizer);
  if (!el) {
    el = document.createElement("div");
    el.id = "playerSprite";
    el.className = "sprite";
    el.innerHTML = `<canvas width="80" height="112"></canvas><span class="sprite-label"></span>`;
    $("#worldSprites").appendChild(el);
  }
  const canvas = el.querySelector("canvas");
  PixelArt.draw(canvas, buildRenderData(saved));
  el.querySelector(".sprite-label").textContent = saved.name || "Kamu";
  canvas.style.width = `${tileSize * 0.85}px`;
  canvas.style.height = `${tileSize * 1.19}px`;
  const { left, top } = spriteXY(playerPos.x, playerPos.y);
  el.style.left = `${left}px`;
  el.style.top = `${top - tileSize * 0.45}px`;
}

function friendsInCurrentWorld() {
  return friendsData.filter(f => f.world === currentWorld().id);
}

function renderFriendSprites() {
  const container = $("#worldSprites");
  friendsInCurrentWorld().forEach(f => {
    const el = document.createElement("div");
    el.className = "sprite";
    el.innerHTML = `<canvas width="80" height="112"></canvas><span class="sprite-label">${escapeHtml(f.name)}</span>`;
    container.appendChild(el);
    const canvas = el.querySelector("canvas");
    PixelArt.draw(canvas, buildRenderData(f.appearance));
    canvas.style.width = `${tileSize * 0.85}px`;
    canvas.style.height = `${tileSize * 1.19}px`;
    const { left, top } = spriteXY(f.x, f.y);
    el.style.left = `${left}px`;
    el.style.top = `${top - tileSize * 0.45}px`;
    el.addEventListener("click", () => openFriendModal(f));
  });
}

function renderInvitedSprite() {
  const world = currentWorld();
  const container = $("#worldSprites");
  const el = document.createElement("div");
  el.className = "sprite";
  const pos = { x: Math.max(0, world.start.x - 1), y: world.start.y };
  el.innerHTML = `<canvas width="80" height="112"></canvas><span class="sprite-label">${escapeHtml(invitedFriend.name)}</span>`;
  container.appendChild(el);
  const canvas = el.querySelector("canvas");
  PixelArt.draw(canvas, buildRenderData(invitedFriend));
  canvas.style.width = `${tileSize * 0.85}px`;
  canvas.style.height = `${tileSize * 1.19}px`;
  const { left, top } = spriteXY(pos.x, pos.y);
  el.style.left = `${left}px`;
  el.style.top = `${top - tileSize * 0.45}px`;
}

function renderSpots() {
  const container = $("#worldSprites");
  currentWorld().spots.forEach(spot => {
    const el = document.createElement("div");
    el.className = "spot-marker";
    el.innerHTML = `${spot.icon}<span class="spot-label">${escapeHtml(spot.label)}</span>`;
    container.appendChild(el);
    const { left, top } = spriteXY(spot.x, spot.y);
    el.style.left = `${left}px`;
    el.style.top = `${top - tileSize * 0.35}px`;
    el.addEventListener("click", () => openObjectModal(spot));
  });
}

function checkProximity() {
  const prompt = $("#worldPrompt");
  const nearFriend = friendsInCurrentWorld().find(f => Math.abs(f.x - playerPos.x) <= 1 && Math.abs(f.y - playerPos.y) <= 1);
  const nearSpot = currentWorld().spots.find(s => Math.abs(s.x - playerPos.x) <= 1 && Math.abs(s.y - playerPos.y) <= 1);

  if (nearFriend) {
    prompt.hidden = false;
    prompt.textContent = `Dekat ${nearFriend.name} — klik karakternya untuk ngobrol!`;
  } else if (nearSpot) {
    prompt.hidden = false;
    prompt.textContent = `${nearSpot.icon} ${nearSpot.label} — klik untuk lihat`;
  } else {
    prompt.hidden = true;
  }
}

/* ---------- object interaction modal ---------- */
function openObjectModal(spot) {
  const visits = loadLocal(LS_KEYS.visits, {});
  const count = (visits[spot.id] || 0) + 1;
  visits[spot.id] = count;
  saveLocal(LS_KEYS.visits, visits);

  const line = spot.lines[Math.floor(Math.random() * spot.lines.length)];
  $("#modalBody").innerHTML = `
    <div class="object-icon">${spot.icon}</div>
    <h3>${escapeHtml(spot.label)}</h3>
    <p style="color:var(--text-dim);">${escapeHtml(line)}</p>
    <p class="visit-count">Kamu sudah ke sini ${count}x</p>
  `;
  $("#modalBackdrop").classList.add("is-open");
}

/* ---------- friend mini-dialogue & hi-five ---------- */
function openFriendModal(friend) {
  const hifives = loadLocal(LS_KEYS.hifives, {});
  const count = hifives[friend.id] || 0;
  const body = $("#modalBody");
  body.innerHTML = `
    <canvas id="modalCreatureCanvas" width="80" height="112"></canvas>
    <h3>${escapeHtml(friend.name)}</h3>
    <p style="color:var(--text-dim);margin-bottom:.6rem;">${escapeHtml(friend.story)}</p>
    <div class="reply-options" id="replyOptions">
      ${friend.replies.map((r, i) => `<button class="reply-btn" data-reply-index="${i}">${escapeHtml(r.text)}</button>`).join("")}
    </div>
    <div id="reactionBox"></div>
    <button class="btn btn-primary" id="btnHiFive" style="margin-top:1rem;">🙌 High Five (${count})</button>
  `;
  PixelArt.draw($("#modalCreatureCanvas"), buildRenderData(friend.appearance));

  $$("[data-reply-index]", body).forEach(btn => {
    btn.addEventListener("click", () => {
      const reply = friend.replies[Number(btn.dataset.replyIndex)];
      $("#reactionBox").innerHTML = `<div class="reaction-box">${escapeHtml(reply.reaction)}</div>`;
      $("#replyOptions").querySelectorAll(".reply-btn").forEach(b => b.disabled = true);
    });
  });

  $("#btnHiFive").addEventListener("click", () => {
    const hf = loadLocal(LS_KEYS.hifives, {});
    hf[friend.id] = (hf[friend.id] || 0) + 1;
    saveLocal(LS_KEYS.hifives, hf);
    $("#btnHiFive").textContent = `🙌 High Five (${hf[friend.id]})`;
    showToast(`Kamu high-five sama ${friend.name}!`);
  });

  $("#modalBackdrop").classList.add("is-open");
}
function closeModal() { $("#modalBackdrop").classList.remove("is-open"); }

/* ---------- friend cards (list section) ---------- */
function renderFriendCards() {
  const grid = $("#friendGrid");
  const hifives = loadLocal(LS_KEYS.hifives, {});
  grid.innerHTML = friendsData.map(f => {
    const world = worldsData.find(w => w.id === f.world);
    return `
      <div class="friend-card">
        <span class="friend-world-badge" title="${escapeHtml(world?.name || "")}">${world?.icon || ""}</span>
        <canvas data-friend-canvas="${f.id}" width="80" height="112"></canvas>
        <h3>${escapeHtml(f.name)}</h3>
        <p class="friend-story">${escapeHtml(f.story)}</p>
        <button class="hifive-btn" data-hifive="${f.id}">🙌 High Five (${hifives[f.id] || 0})</button>
      </div>
    `;
  }).join("");
  friendsData.forEach(f => PixelArt.draw($(`[data-friend-canvas="${f.id}"]`, grid), buildRenderData(f.appearance)));
  $$("[data-hifive]", grid).forEach(btn => {
    btn.addEventListener("click", () => {
      const hf = loadLocal(LS_KEYS.hifives, {});
      hf[btn.dataset.hifive] = (hf[btn.dataset.hifive] || 0) + 1;
      saveLocal(LS_KEYS.hifives, hf);
      btn.textContent = `🙌 High Five (${hf[btn.dataset.hifive]})`;
    });
  });
}

/* ---------- music toggle ---------- */
function bindMusicToggle() {
  const btn = $("#musicToggle");
  btn.addEventListener("click", () => {
    const playing = AmbientMusic.toggle();
    btn.classList.toggle("is-playing", playing);
    btn.textContent = playing ? "🔊" : "🎵";
    btn.title = playing ? "Matikan musik" : "Putar musik santai";
  });
}

/* ---------- header / nav ---------- */
function bindHeader() {
  const header = $("#siteHeader");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 40);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  const toggle = $("#navToggle");
  const nav = $("#mainNav");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  $$("#mainNav a").forEach(a => a.addEventListener("click", () => { nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); }));
}

/* ---------- init ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  $("#year").textContent = new Date().getFullYear();
  bindHeader();
  bindMusicToggle();
  checkInviteFromUrl();

  try {
    await loadAllData();
  } catch (e) {
    console.error("Gagal memuat data JSON:", e);
    showToast("Gagal memuat data. Jalankan lewat server lokal / GitHub Pages, bukan file langsung.");
    return;
  }

  initCustomizer();
  initWorldTabs();
  initWorld();
  renderFriendCards();

  $("#modalClose").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
});
