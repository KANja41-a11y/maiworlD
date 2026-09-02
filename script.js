from pathlib import Path

script = r'''import { firebaseConfig, FIREBASE_READY } from "./firebase-config.js";

/* =========================================================
   MAIWORLD — FINAL CLEAN SCRIPT
   - fixes the broken init()
   - keeps world / interaction / character / chat / emotes
   - Firebase runs in the background
   - no duplicated Firebase functions
   ========================================================= */

const CDN = "https://www.gstatic.com/firebasejs/12.2.1/";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const makeId = () =>
  globalThis.crypto?.randomUUID?.() ||
  Math.random().toString(36).slice(2) + Date.now().toString(36);

const appPromise = FIREBASE_READY
  ? Promise.all([
      import(CDN + "firebase-app.js"),
      import(CDN + "firebase-auth.js"),
      import(CDN + "firebase-database.js")
    ]).then(([app, auth, database]) => ({
      ...app,
      ...auth,
      ...database
    }))
  : Promise.resolve(null);

const canvas = $("#gameCanvas");
const ctx = canvas?.getContext("2d");

if (ctx) ctx.imageSmoothingEnabled = false;

const state = {
  view: "home",
  world: "plaza",
  worlds: [],
  items: [],
  emotes: [],
  characters: {},

  me: null,
  players: {},
  chat: [],
  keys: new Set(),

  config: {
    name: localStorage.getItem("maiworld-name") || "Mai",
    skin: "peach",
    hair: "blonde",
    eyes: "sparkle",
    mouths: "smile",
    top: "teePink",
    bottom: "jeans",
    dress: "none",
    shoes: "sneakers",
    accessories: "none",
    bags: "none"
  },

  interaction: null,
  interactionTimer: null,

  firebase: null,
  localDemo: true,
  uid: null,
  unsubscribePlayers: null,
  unsubscribeChat: null,

  audio: null,
  musicOn: false,
  lastSend: 0,
  lastFrame: performance.now()
};

/* =========================================================
   DATA
   ========================================================= */

async function loadJSON(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
}

function normalizeWorldData(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.worlds)) return data.worlds;
  return [];
}

function normalizeItemsData(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function normalizeEmotesData(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.emotes)) return data.emotes;
  return [];
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================================================
   INIT
   ========================================================= */

async function init() {
  try {
    const [worldsData, itemsData, emotesData, charactersData] =
      await Promise.all([
        loadJSON("./data/world.json"),
        loadJSON("./data/items.json"),
        loadJSON("./data/emotes.json"),
        loadJSON("./data/characters.json")
      ]);

    state.worlds = normalizeWorldData(worldsData);
    state.items = normalizeItemsData(itemsData);
    state.emotes = normalizeEmotesData(emotesData);
    state.characters = charactersData || {};

    loadSavedProfile();

    bindUI();
    bindExtraUI();
    populateEditor();
    setupMusic();

    renderWorldChoices();
    renderEmotes();
    renderProfileEverywhere();
    renderWorld();

    if (!state.me) createLocalPlayer();

    hideBoot();
    loop();

    /* Firebase must NOT block the game from loading. */
    void setupFirebase();

  } catch (error) {
    console.error("MAIWORLD init error:", error);

    /* Show the app even if one optional data file fails. */
    hideBoot();

    if (!state.me) createLocalPlayer();

    toast("MAIWORLD terbuka dalam mode offline ♡");
    loop();
  }
}

/* =========================================================
   BOOT
   ========================================================= */

function hideBoot() {
  $("#boot")?.classList.add("hide");
}

/* =========================================================
   UI
   ========================================================= */

function bindUI() {
  $("#playBtn")?.addEventListener("click", enterGame);
  $("#customizeBtn")?.addEventListener("click", () => openModal("profileModal"));
  $("#profileBtn")?.addEventListener("click", () => openModal("profileModal"));
  $("#profileGameBtn")?.addEventListener("click", () => openModal("profileModal"));

  $("#worldBtn")?.addEventListener("click", () => {
    renderWorldChoices();
    openModal("worldModal");
  });

  $("#friendsBtn")?.addEventListener("click", () => {
    renderFriendsModal();
    openModal("friendsModal");
  });

  $("#musicBtn")?.addEventListener("click", toggleMusic);

  $("#mobileInteract")?.addEventListener("click", () => interact());

  $("#saveProfile")?.addEventListener("click", saveProfile);

  $("#chatForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#chatInput");
    if (!input) return;
    sendChat(input.value);
    input.value = "";
  });

  $("#editNameBtn")?.addEventListener("click", () => openModal("profileModal"));

  $("#closeSide")?.addEventListener("click", () => {
    $(".game-layout")?.classList.remove("chat-open");
  });

  $$(".modal-x").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
  });

  $("#brandBtn")?.addEventListener("click", () => showView("home"));

  const editorIds = [
    "skinSelect",
    "hairSelect",
    "eyesSelect",
    "mouthsSelect",
    "topSelect",
    "bottomSelect",
    "dressSelect",
    "shoesSelect",
    "accessoriesSelect",
    "bagsSelect",
    "nameInput"
  ];

  editorIds.forEach((id) => {
    const element = $("#" + id);
    if (!element) return;
    element.addEventListener("input", previewEditor);
    element.addEventListener("change", previewEditor);
  });

  $$(".mobile-controls [data-key]").forEach((button) => {
    const press = (event) => {
      event.preventDefault();
      state.keys.add(button.dataset.key);
    };

    const release = (event) => {
      event.preventDefault();
      state.keys.delete(button.dataset.key);
    };

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key;
    const valid = [
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
      "w", "a", "s", "d", "W", "A", "S", "D", "e", "E", " "
    ];

    if (!valid.includes(key)) return;

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(key)) {
      event.preventDefault();
    }

    state.keys.add(key);

    if (key.toLowerCase() === "e" && !event.repeat) {
      interact();
    }
  });

  window.addEventListener("keyup", (event) => {
    state.keys.delete(event.key);
  });

  window.addEventListener("blur", () => {
    state.keys.clear();
  });

  canvas?.addEventListener("click", (event) => {
    if (!state.me) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const spot = nearestItem(x, y, 120);

    if (spot && distance(state.me.x, state.me.y, spot.x, spot.y) <= 145) {
      interact(spot);
    }
  });
}

function bindExtraUI() {
  $("#previewCharacterBtn")?.addEventListener("click", () => {
    previewEditor();
    toast("Ini karakter kamu ♡");
  });

  $("#saveNameBtn")?.addEventListener("click", () => {
    const input = $("#nameInput");
    if (input) setPlayerName(input.value);
  });

  $$("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.view) showView(button.dataset.view);
    });
  });
}

/* =========================================================
   VIEW / MODAL
   ========================================================= */

function showView(view) {
  state.view = view;
  $$(".view").forEach((element) => element.classList.remove("active"));
  $("#" + view + "View")?.classList.add("active");
}

function openModal(id) {
  const modal = $("#" + id);
  if (!modal) return;
  modal.classList.add("open");
  modal.classList.add("active");
  modal.removeAttribute("aria-hidden");
  populateEditor();
  previewEditor();
}

function closeModal(id) {
  if (!id) return;
  const modal = $("#" + id);
  if (!modal) return;
  modal.classList.remove("open");
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
}

/* =========================================================
   GAME
   ========================================================= */

function enterGame() {
  showView("game");

  if (!state.me) createLocalPlayer();

  renderWorld();
  renderProfileEverywhere();

  $(".game-layout")?.classList.add("chat-open");

  setTimeout(() => {
    $(".game-layout")?.classList.remove("chat-open");
  }, 700);
}

function createLocalPlayer() {
  const saved = state.config;

  state.me = {
    uid: state.uid || "local-" + makeId().slice(0, 8),
    ...saved,
    x: 480,
    y: 360,
    direction: "down",
    animation: "idle",
    emote: null,
    online: true,
    lastSeen: Date.now()
  };

  state.players[state.me.uid] = { ...state.me };
  updateCounts();
}

/* =========================================================
   MOVEMENT
   ========================================================= */

function updateMovement() {
  if (!state.me || state.view !== "game") return;

  let dx = 0;
  let dy = 0;

  if (state.keys.has("ArrowUp") || state.keys.has("w") || state.keys.has("W")) dy--;
  if (state.keys.has("ArrowDown") || state.keys.has("s") || state.keys.has("S")) dy++;
  if (state.keys.has("ArrowLeft") || state.keys.has("a") || state.keys.has("A")) dx--;
  if (state.keys.has("ArrowRight") || state.keys.has("d") || state.keys.has("D")) dx++;

  if (!dx && !dy) {
    state.me.animation = "idle";
    return;
  }

  const length = Math.hypot(dx, dy) || 1;
  const speed = 3.2;

  dx = (dx / length) * speed;
  dy = (dy / length) * speed;

  state.me.x = clamp(state.me.x + dx, 40, 920);
  state.me.y = clamp(state.me.y + dy, 280, 555);

  if (Math.abs(dx) > Math.abs(dy)) {
    state.me.direction = dx > 0 ? "right" : "left";
  } else {
    state.me.direction = dy > 0 ? "down" : "up";
  }

  state.me.animation = "walk";
  state.me.lastSeen = Date.now();

  state.players[state.me.uid] = { ...state.me };

  if (Date.now() - state.lastSend > 140) {
    state.lastSend = Date.now();
    void writePlayer();
  }
}

/* =========================================================
   WORLD
   ========================================================= */

function renderWorldChoices() {
  const container = $("#worldChoices");
  if (!container) return;

  container.innerHTML = state.worlds.map((world) => `
    <button class="world-choice" data-world="${escapeHTML(world.id)}">
      <span class="emoji">${world.emoji || "🌸"}</span>
      <strong>${escapeHTML(world.name || world.id)}</strong>
      <small>${escapeHTML(world.description || "")}</small>
    </button>
  `).join("");

  $$(".world-choice").forEach((button) => {
    button.addEventListener("click", () => {
      changeWorld(button.dataset.world);
      closeModal("worldModal");
    });
  });
}

function changeWorld(id) {
  const world = state.worlds.find((item) => item.id === id);
  if (!world) return;

  state.world = id;
  state.interaction = null;

  if (state.me) {
    state.me.x = world.spawn?.[0] ?? 480;
    state.me.y = world.spawn?.[1] ?? 360;
    state.players[state.me.uid] = { ...state.me };
    void writePlayer();
  }

  $("#worldName") && ($("#worldName").textContent = world.name?.split(" ").slice(-1)[0] || world.name);
  $("#worldTitle") && ($("#worldTitle").textContent = world.name || id);
  $("#locationChip") && ($("#locationChip").textContent = world.name || id);

  renderWorld();
  toast(`Welcome to ${world.name || id} ${world.emoji || "✦"}`);
  void listenWorld();
}

function worldTheme(id) {
  return {
    plaza: ["#ffd5e5", "#f2dfff", "#d5b5e8"],
    park: ["#d9f5d6", "#c9ebff", "#b7d99e"],
    school: ["#d7ecff", "#eadcff", "#b9cdea"],
    cafe: ["#ffe8c5", "#f5d7e8", "#d9b8a0"],
    studio: ["#eadcff", "#f8d6eb", "#c6a8db"],
    beach: ["#ffe3d4", "#ffd0e5", "#f0b88d"],
    library: ["#e6d8ff", "#f6e8d2", "#b99cc9"],
    arcade: ["#d9d4ff", "#ffd6ef", "#9d8fce"],
    garden: ["#d9f5d6", "#fff0c9", "#a9c98c"],
    concert: ["#d9d7ff", "#f8d5e9", "#8f83bd"]
  }[id] || ["#ffd5e5", "#f2dfff", "#d5b5e8"];
}

function renderWorld() {
  drawWorld();
}

function drawWorld() {
  if (!ctx || !canvas) return;

  const W = canvas.width;
  const H = canvas.height;
  const theme = worldTheme(state.world);

  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, theme[0]);
  gradient.addColorStop(0.58, theme[1]);
  gradient.addColorStop(1, theme[2]);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,.45)";
  for (let i = 0; i < 22; i++) {
    const x = (i * 97 + 37) % W;
    const y = (i * 61 + 40) % 220;
    ctx.fillRect(x, y, 2, 2);
    ctx.fillRect(x + 5, y + 4, 1, 1);
  }

  drawGround();

  switch (state.world) {
    case "park": drawPark(); break;
    case "school": drawSchool(); break;
    case "cafe": drawCafe(); break;
    case "studio": drawStudio(); break;
    case "beach": drawBeach(); break;
    case "library": drawLibrary(); break;
    case "arcade": drawArcade(); break;
    case "garden": drawGarden(); break;
    case "concert": drawConcert(); break;
    default: drawPlaza();
  }

  drawItems();

  Object.values(state.players).forEach((player) => drawPlayer(player));
  drawInteractionEffect();
}

function drawGround() {
  ctx.fillStyle = "rgba(255,255,255,.38)";
  ctx.fillRect(0, 250, 960, 350);

  ctx.fillStyle = "rgba(164,121,151,.11)";
  for (let x = 0; x < 960; x += 48) {
    for (let y = 250; y < 600; y += 48) {
      ctx.fillRect(x, y, 44, 44);
    }
  }
}

function box(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.fillRect(x, y, w, 4);
}

function tree(x, y) {
  ctx.fillStyle = "#8b5c59";
  ctx.fillRect(x + 19, y + 38, 10, 42);

  ctx.fillStyle = "#8fd2a1";
  ctx.fillRect(x + 5, y + 10, 38, 38);

  ctx.fillStyle = "#aee4b8";
  ctx.fillRect(x + 12, y, 24, 40);

  ctx.fillStyle = "#6fbc91";
  ctx.fillRect(x, y + 25, 48, 18);
}

function drawPlaza() {
  for (let x = 70; x < 900; x += 150) tree(x, 180 + (x % 45));

  box(310, 350, 340, 115, "#f8c7dc");
  ctx.fillStyle = "#fff";
  ctx.fillRect(330, 370, 300, 12);

  ctx.fillStyle = "#e7a5c4";
  ctx.fillRect(455, 320, 50, 30);
}

function drawPark() {
  for (let x = 60; x < 900; x += 150) tree(x, 180 + (x % 50));

  box(350, 400, 260, 52, "#c79a77");
  ctx.fillStyle = "#a8795c";
  ctx.fillRect(370, 385, 220, 16);

  ctx.fillStyle = "#7fc88f";
  ctx.fillRect(0, 265, 960, 7);
}

function drawSchool() {
  box(250, 190, 460, 180, "#fff5fb");
  box(285, 220, 110, 95, "#cce8ff");
  box(425, 220, 110, 95, "#eadcff");
  box(565, 220, 110, 95, "#cce8ff");

  ctx.fillStyle = "#d99bb9";
  ctx.fillRect(435, 285, 90, 85);
}

function drawCafe() {
  box(180, 205, 600, 180, "#fff7ec");
  box(260, 240, 160, 90, "#f5d1dc");
  box(540, 240, 160, 90, "#e8d0c0");

  ctx.fillStyle = "#9f725e";
  ctx.fillRect(390, 390, 180, 18);
}

function drawStudio() {
  box(170, 185, 620, 180, "#fffaff");

  ctx.fillStyle = "#d8b8e8";
  ctx.fillRect(250, 235, 150, 100);

  ctx.fillStyle = "#f0c1d9";
  ctx.fillRect(555, 230, 130, 110);

  ctx.fillStyle = "#b28ac5";
  ctx.fillRect(435, 270, 90, 100);
}

function drawBeach() {
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.fillRect(0, 280, 960, 320);

  ctx.fillStyle = "#9edcf0";
  for (let y = 310; y < 570; y += 50) {
    ctx.fillRect(0, y, 960, 4);
  }

  ctx.fillStyle = "#f8d9a8";
  ctx.fillRect(0, 500, 960, 100);
}

function drawLibrary() {
  box(160, 190, 640, 210, "#fff8ed");

  for (let x = 220; x < 760; x += 120) {
    box(x, 230, 85, 130, "#caa7d8");
    ctx.fillStyle = "#f4d5e6";
    for (let y = 245; y < 350; y += 25) ctx.fillRect(x + 10, y, 65, 12);
  }

  ctx.fillStyle = "#b9896f";
  ctx.fillRect(365, 420, 230, 20);
}

function drawArcade() {
  box(180, 185, 600, 190, "#efe7ff");

  for (let x = 250; x < 720; x += 130) {
    box(x, 235, 90, 115, "#a898dc");
    ctx.fillStyle = "#f9d7e9";
    ctx.fillRect(x + 12, 250, 66, 45);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 30, 315, 30, 10);
  }
}

function drawGarden() {
  for (let x = 100; x < 900; x += 120) {
    tree(x, 185 + (x % 45));
  }

  ctx.fillStyle = "#a7d49a";
  for (let x = 180; x < 850; x += 80) {
    ctx.fillRect(x, 420 + (x % 30), 30, 18);
  }
}

function drawConcert() {
  box(170, 175, 620, 200, "#f4edff");

  ctx.fillStyle = "#9f8dcc";
  ctx.fillRect(320, 285, 320, 90);

  ctx.fillStyle = "#d8a9cf";
  ctx.fillRect(365, 225, 230, 65);

  for (let x = 220; x < 760; x += 90) {
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.fillRect(x, 400, 45, 60);
  }
}

/* =========================================================
   ITEMS / INTERACTION
   ========================================================= */

function getWorldSpots() {
  return {
    plaza: [
      { x: 200, y: 390, id: "swing" },
      { x: 710, y: 380, id: "photo" }
    ],
    park: [
      { x: 420, y: 400, id: "bench" },
      { x: 780, y: 410, id: "flower" }
    ],
    school: [
      { x: 250, y: 350, id: "locker" },
      { x: 680, y: 350, id: "bell" }
    ],
    cafe: [
      { x: 420, y: 400, id: "coffee" },
      { x: 600, y: 400, id: "jukebox" }
    ],
    studio: [
      { x: 210, y: 360, id: "easel" },
      { x: 730, y: 360, id: "gallery" }
    ],
    beach: [
      { x: 250, y: 450, id: "shell" }
    ],
    library: [
      { x: 480, y: 390, id: "book" }
    ],
    arcade: [
      { x: 480, y: 390, id: "arcade" }
    ],
    garden: [
      { x: 480, y: 390, id: "seed" }
    ],
    concert: [
      { x: 420, y: 390, id: "mic" },
      { x: 600, y: 390, id: "piano" }
    ]
  }[state.world] || [];
}

const itemIcons = {
  bench: "🪑",
  flower: "🌷",
  bell: "🔔",
  locker: "🩷",
  coffee: "☕",
  jukebox: "🎵",
  easel: "🎨",
  gallery: "🖼️",
  shell: "🐚",
  book: "📖",
  arcade: "🕹️",
  seed: "🌱",
  mic: "🎤",
  piano: "🎹",
  swing: "🎀",
  photo: "📸"
};

const itemMessages = {
  bench: "Duduk sebentar yuk ♡",
  flower: "Bunga kecil untuk kamu 🌷",
  bell: "Ding ding! 🔔✨",
  locker: "Cek loker duluu 🩷",
  coffee: "A little coffee break ☕",
  jukebox: "Let's play some music! 🎵",
  easel: "Ide baru siap digambar 🎨",
  gallery: "Look at this pretty art 🖼️",
  shell: "A tiny seashell found! 🐚",
  book: "Waktunya baca buku 📖",
  arcade: "Game time! 🕹️",
  seed: "Tanam sesuatu yang cantik 🌱",
  mic: "Mic check... one two! 🎤",
  piano: "Play a little melody 🎹",
  swing: "Wheee! 🎀",
  photo: "Say cheese! 📸✨"
};

function nearestItem(x = state.me?.x, y = state.me?.y, radius = 100) {
  if (x == null || y == null) return null;

  let best = null;
  let bestDistance = radius;

  for (const spot of getWorldSpots()) {
    const d = distance(x, y, spot.x, spot.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = spot;
    }
  }

  return best;
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function drawItems() {
  const spots = getWorldSpots();

  spots.forEach((spot, index) => {
    const near = state.me && distance(state.me.x, state.me.y, spot.x, spot.y) < 125;
    const pulse = Math.sin(performance.now() / 250 + index) * 2;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (near) {
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.beginPath();
      ctx.arc(spot.x, spot.y - 25, 25 + pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = "24px sans-serif";
    ctx.fillText(itemIcons[spot.id] || "♡", spot.x, spot.y - 22);

    if (near) {
      ctx.font = "bold 13px sans-serif";
      ctx.fillStyle = "#7b5872";
      ctx.fillText("♡ E Interact!", spot.x, spot.y + 18);
    }

    ctx.restore();
  });

  const nearest = nearestItem();

  if (nearest && state.me) {
    const d = distance(state.me.x, state.me.y, nearest.x, nearest.y);

    if (d < 115) {
      showInteractionHint(nearest);
    } else {
      hideInteractionHint();
    }
  } else {
    hideInteractionHint();
  }
}

function showInteractionHint(spot) {
  const bubble = $("#interactionBubble");
  if (!bubble) return;

  const label = itemMessages[spot.id] || "Interact ♡";
  bubble.textContent = `♡ ${label} · tekan E`;
  bubble.classList.remove("hidden");
}

function hideInteractionHint() {
  const bubble = $("#interactionBubble");
  if (!bubble || state.interaction) return;
  bubble.classList.add("hidden");
}

function interact(spot = nearestItem()) {
  if (!state.me) return;

  if (!spot) {
    toast("Dekati benda yang mau kamu sentuh dulu ya ♡");
    return;
  }

  const d = distance(state.me.x, state.me.y, spot.x, spot.y);

  if (d > 145) {
    toast("Deket sedikit lagi yaa ♡");
    return;
  }

  const message = itemMessages[spot.id] || "Cute! ♡";

  state.interaction = {
    ...spot,
    started: performance.now(),
    message
  };

  clearTimeout(state.interactionTimer);

  const bubble = $("#interactionBubble");
  if (bubble) {
    bubble.textContent = `♡ ${message} ✦`;
    bubble.classList.remove("hidden");
  }

  toast(message);

  state.interactionTimer = setTimeout(() => {
    state.interaction = null;
    hideInteractionHint();
  }, 2200);

  sendChat(`♡ ${message}`);
}

function drawInteractionEffect() {
  if (!state.interaction) return;

  const elapsed = performance.now() - state.interaction.started;
  const progress = elapsed / 2200;

  if (progress >= 1) return;

  const x = state.interaction.x;
  const y = state.interaction.y - 55;

  ctx.save();
  ctx.textAlign = "center";

  const hearts = ["♡", "✦", "♥", "✧"];

  for (let i = 0; i < 4; i++) {
    const offset = (elapsed / 18 + i * 30) % 70;
    const alpha = 1 - offset / 85;

    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = `${12 + (i % 2) * 5}px sans-serif`;
    ctx.fillText(
      hearts[i],
      x - 25 + i * 17,
      y - offset
    );
  }

  ctx.restore();
}

/* =========================================================
   PLAYER DRAWING
   ========================================================= */

function drawPlayer(player) {
  if (!player) return;

  const bob =
    player.animation === "walk"
      ? Math.sin(performance.now() / 100 + player.x) * 3
      : 0;

  drawAvatarAt(
    ctx,
    player.x,
    player.y + bob,
    player,
    1
  );

  if (player.name) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "rgba(86,59,81,.9)";
    ctx.fillText(player.name, player.x, player.y - 57);
    ctx.restore();
  }

  if (player.emote) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "20px sans-serif";
    ctx.fillText(
      typeof player.emote === "string" ? player.emote : "♡",
      player.x,
      player.y - 78
    );
    ctx.restore();
  }
}

function skinColor(id) {
  return {
    peach: "#ffd1b8",
    fair: "#ffe0cc",
    tan: "#d9a17e",
    cocoa: "#a96f52"
  }[id] || "#ffd1b8";
}

function hairColor(id) {
  return {
    blonde: "#f5d36f",
    brown: "#7c5546",
    black: "#3f3440",
    pink: "#e9a7c8",
    lavender: "#bba7df",
    blue: "#8fc7e8"
  }[id] || "#f5d36f";
}

function drawAvatarAt(target, x, y, config, scale = 1) {
  target.save();
  target.translate(x, y);
  target.scale(scale, scale);

  /* shadow */
  target.fillStyle = "rgba(85,55,75,.15)";
  target.beginPath();
  target.ellipse(0, 28, 23, 7, 0, 0, Math.PI * 2);
  target.fill();

  /* legs / shoes */
  target.fillStyle = "#f4f0f5";
  target.fillRect(-13, 13, 9, 18);
  target.fillRect(4, 13, 9, 18);

  target.fillStyle = "#fff";
  target.fillRect(-16, 27, 13, 6);
  target.fillRect(3, 27, 13, 6);

  /* body */
  target.fillStyle =
    config.dress && config.dress !== "none"
      ? "#eab5cf"
      : topColor(config.top);

  target.fillRect(-18, -5, 36, 28);

  /* arms */
  target.fillStyle = skinColor(config.skin);
  target.fillRect(-24, 0, 7, 22);
  target.fillRect(17, 0, 7, 22);

  /* neck */
  target.fillRect(-5, -13, 10, 9);

  /* face */
  target.fillStyle = skinColor(config.skin);
  target.fillRect(-19, -38, 38, 31);

  /* hair */
  target.fillStyle = hairColor(config.hair);
  target.fillRect(-22, -45, 44, 18);
  target.fillRect(-19, -48, 8, 20);
  target.fillRect(11, -48, 8, 20);

  /* eyes */
  target.fillStyle = "#5f4a61";
  if (config.eyes === "sparkle") {
    target.fillRect(-11, -25, 5, 7);
    target.fillRect(6, -25, 5, 7);
    target.fillStyle = "#fff";
    target.fillRect(-10, -25, 2, 2);
    target.fillRect(7, -25, 2, 2);
  } else {
    target.fillRect(-10, -23, 4, 4);
    target.fillRect(6, -23, 4, 4);
  }

  /* mouth */
  target.strokeStyle = "#9c637b";
  target.lineWidth = 2;

  target.beginPath();
  if (config.mouths === "smile") {
    target.arc(0, -17, 5, 0.1, Math.PI - 0.1);
  } else {
    target.moveTo(-3, -17);
    target.lineTo(3, -17);
  }
  target.stroke();

  /* accessory */
  if (config.accessories && config.accessories !== "none") {
    target.font = "13px sans-serif";
    target.textAlign = "center";
    target.fillText("✦", 18, -39);
  }

  /* bag */
  if (config.bags && config.bags !== "none") {
    target.fillStyle = "#d99bbb";
    target.fillRect(21, 8, 8, 13);
  }

  target.restore();
}

function topColor(id) {
  return {
    teePink: "#f3a9c7",
    teeBlue: "#9bc9e9",
    teeLavender: "#bda9df",
    sweater: "#e6c1a7",
    hoodie: "#a8d7bd"
  }[id] || "#f3a9c7";
}

function drawAvatar(target, config, scale = 1) {
  if (!target) return;

  if (target.tagName === "CANVAS") {
    const c = target.getContext("2d");
    c.clearRect(0, 0, target.width, target.height);
    c.imageSmoothingEnabled = false;
    drawAvatarAt(c, target.width / 2, target.height / 2 + 15, config, scale);
    return;
  }

  target.innerHTML = "";
  const c = document.createElement("canvas");
  c.width = 180;
  c.height = 180;
  target.appendChild(c);
  drawAvatar(c, config, scale);
}

/* =========================================================
   CHARACTER EDITOR
   ========================================================= */

function populateEditor() {
  const fields = {
    skinSelect: "skins",
    hairSelect: "hair",
    eyesSelect: "eyes",
    mouthsSelect: "mouths",
    topSelect: "tops",
    bottomSelect: "bottoms",
    dressSelect: "dresses",
    shoesSelect: "shoes",
    accessoriesSelect: "accessories",
    bagsSelect: "bags"
  };

  for (const [id, key] of Object.entries(fields)) {
    const element = $("#" + id);
    if (!element) continue;

    const list = state.characters?.[key] || [];

    element.innerHTML = list.map((item) => `
      <option value="${escapeHTML(item.id)}">${escapeHTML(item.name || item.id)}</option>
    `).join("");

    const configKey = id.replace("Select", "");
    if (state.config[configKey]) {
      element.value = state.config[configKey];
    }
  }

  const nameInput = $("#nameInput");
  if (nameInput) nameInput.value = state.config.name;
}

function readEditor() {
  return {
    name: $("#nameInput")?.value.trim() || "Mai",
    skin: $("#skinSelect")?.value || "peach",
    hair: $("#hairSelect")?.value || "blonde",
    eyes: $("#eyesSelect")?.value || "sparkle",
    mouths: $("#mouthsSelect")?.value || "smile",
    top: $("#topSelect")?.value || "teePink",
    bottom: $("#bottomSelect")?.value || "jeans",
    dress: $("#dressSelect")?.value || "none",
    shoes: $("#shoesSelect")?.value || "sneakers",
    accessories: $("#accessoriesSelect")?.value || "none",
    bags: $("#bagsSelect")?.value || "none"
  };
}

function previewEditor() {
  const config = readEditor();
  const avatar = $("#profileAvatar");
  if (avatar) drawAvatar(avatar, config, 1.8);
}

function saveProfile() {
  Object.assign(state.config, readEditor());

  localStorage.setItem(
    "maiworld-profile",
    JSON.stringify(state.config)
  );

  localStorage.setItem(
    "maiworld-name",
    state.config.name
  );

  if (state.me) {
    Object.assign(state.me, state.config);
    state.players[state.me.uid] = { ...state.me };
    void writePlayer();
  }

  renderProfileEverywhere();
  closeModal("profileModal");
  toast("Your new look is ready ✨");
}

function loadSavedProfile() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("maiworld-profile") || "null"
    );

    if (saved && typeof saved === "object") {
      Object.assign(state.config, saved);
    }
  } catch {
    /* ignore invalid old local data */
  }
}

function setPlayerName(name) {
  state.config.name = String(name || "Mai").trim() || "Mai";
  localStorage.setItem("maiworld-name", state.config.name);

  if (state.me) {
    state.me.name = state.config.name;
    state.players[state.me.uid] = { ...state.me };
    void writePlayer();
  }

  renderProfileEverywhere();
  toast("Nama kamu sudah disimpan ♡");
}

function renderProfileEverywhere() {
  const name = state.config.name;

  if ($("#sideName")) $("#sideName").textContent = name;

  if ($("#miniAvatar")) drawAvatar($("#miniAvatar"), state.config, 0.9);
  if ($("#sideAvatar")) drawAvatar($("#sideAvatar"), state.config, 1.25);
  if ($("#profileAvatar")) drawAvatar($("#profileAvatar"), state.config, 1.8);
}

/* =========================================================
   EMOTES
   ========================================================= */

function renderEmotes() {
  const container = $("#emoteBar");
  if (!container) return;

  container.innerHTML = "";

  state.emotes.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "emote-button";

    const emoji =
      typeof item === "string"
        ? item
        : item.emoji || item.value || item.symbol || "♡";

    const label =
      typeof item === "string"
        ? item
        : item.label || emoji;

    button.textContent = emoji;
    button.title = label;

    button.addEventListener("click", () => doEmote(emoji, label));

    container.appendChild(button);
  });
}

function doEmote(emoji, label = emoji) {
  if (!state.me) return;

  state.me.emote = emoji;
  state.players[state.me.uid] = { ...state.me };

  const bubble = $("#interactionBubble");
  if (bubble) {
    bubble.textContent = `${emoji} ${label}`;
    bubble.classList.remove("hidden");

    setTimeout(() => {
      if (!state.interaction) bubble.classList.add("hidden");
    }, 1500);
  }

  void writePlayer();
  sendChat(`${emoji} ${label}`);

  setTimeout(() => {
    if (!state.me) return;
    state.me.emote = null;
    state.players[state.me.uid] = { ...state.me };
    void writePlayer();
  }, 2500);
}

/* =========================================================
   CHAT
   ========================================================= */

async function sendChat(text) {
  text = String(text || "").trim();
  if (!text || !state.me) return;

  const message = {
    uid: state.me.uid,
    name: state.me.name || "Mai",
    text: text.slice(0, 160),
    timestamp: Date.now()
  };

  if (!state.localDemo && state.firebase) {
    try {
      const { db, ref, push, set } = state.firebase;
      await set(
        push(ref(db, `worlds/${state.world}/chat`)),
        message
      );
      return;
    } catch (error) {
      console.warn("Chat failed:", error);
    }
  }

  state.chat.push(message);
  state.chat = state.chat.slice(-30);
  renderChat();
}

function renderChat() {
  const container =
    $("#chatMessages") ||
    $("#chatList") ||
    $("#messages");

  if (!container) return;

  container.innerHTML = state.chat.slice(-30).map((message) => `
    <div class="chat-message">
      <strong>${escapeHTML(message.name || "Mai")}</strong>
      <span>${escapeHTML(message.text || "")}</span>
    </div>
  `).join("");

  container.scrollTop = container.scrollHeight;
}

/* =========================================================
   FRIENDS
   ========================================================= */

function renderFriendsModal() {
  const container =
    $("#friendsList") ||
    $("#friendsContent");

  if (!container) return;

  const others = Object.values(state.players)
    .filter((player) => player.uid !== state.me?.uid);

  if (!others.length) {
    container.innerHTML =
      `<div class="empty-state">Belum ada teman di world ini ♡</div>`;
    return;
  }

  container.innerHTML = others.map((player) => `
    <div class="friend-row">
      <strong>${escapeHTML(player.name || "Player")}</strong>
      <small>online ♡</small>
    </div>
  `).join("");
}

/* =========================================================
   MUSIC
   ========================================================= */

function setupMusic() {
  if (state.audio) return;

  const audio = new Audio("./music/cozy-jazz.mp3");
  audio.loop = true;
  audio.volume = 0.35;

  state.audio = audio;
  updateMusicButton();
}

function updateMusicButton() {
  const button = $("#musicBtn");
  if (!button) return;

  button.textContent = state.musicOn
    ? "♫ Music On"
    : "♫ Music Off";
}

async function toggleMusic() {
  setupMusic();

  if (!state.audio) return;

  if (state.musicOn) {
    state.audio.pause();
    state.musicOn = false;
  } else {
    try {
      await state.audio.play();
      state.musicOn = true;
    } catch {
      toast("Tekan tombol music sekali lagi untuk memulai ♡");
    }
  }

  updateMusicButton();
}

/* =========================================================
   FIREBASE
   ========================================================= */

async function setupFirebase() {
  try {
    const modules = await appPromise;

    if (!modules) {
      setConnection("Local demo");
      return;
    }

    const {
      initializeApp,
      getApps,
      getAuth,
      signInAnonymously,
      getDatabase,
      ref,
      set,
      onValue,
      onDisconnect,
      push
    } = modules;

    const app = getApps().length
      ? getApps()[0]
      : initializeApp(firebaseConfig);

    const auth = getAuth(app);
    const db = getDatabase(app);

    state.firebase = {
      auth,
      db,
      ref,
      set,
      onValue,
      onDisconnect,
      push
    };

    const credential = await signInAnonymously(auth);

    state.uid = credential.user.uid;
    state.localDemo = false;

    state.me = {
      ...(state.me || {}),
      uid: state.uid,
      ...state.config,
      x: state.me?.x ?? 480,
      y: state.me?.y ?? 360,
      direction: state.me?.direction || "down",
      animation: state.me?.animation || "idle",
      online: true,
      lastSeen: Date.now()
    };

    state.players[state.uid] = { ...state.me };

    setConnection("Online world");

    await uploadCurrentPlayer();
    await listenWorld();

  } catch (error) {
    console.warn("Firebase unavailable — local demo:", error);

    state.firebase = null;
    state.localDemo = true;

    setConnection("Local demo");

    if (!state.me) createLocalPlayer();
  }
}

async function uploadCurrentPlayer() {
  if (!state.firebase || !state.me) return;

  const { db, ref, set, onDisconnect } = state.firebase;

  const playerRef = ref(
    db,
    `worlds/${state.world}/players/${state.me.uid}`
  );

  try {
    await set(playerRef, state.me);
    await onDisconnect(playerRef).remove();
  } catch (error) {
    console.warn("Upload player failed:", error);
  }
}

async function writePlayer() {
  if (!state.me) return;

  state.me.lastSeen = Date.now();
  state.me.online = true;
  state.players[state.me.uid] = { ...state.me };

  updateCounts();

  if (state.localDemo || !state.firebase) return;

  try {
    const { db, ref, set } = state.firebase;

    await set(
      ref(
        db,
        `worlds/${state.world}/players/${state.me.uid}`
      ),
      state.me
    );
  } catch (error) {
    console.warn("Could not update player:", error);
  }
}

async function listenWorld() {
  if (!state.firebase) return;

  const { db, ref, onValue } = state.firebase;

  if (state.unsubscribePlayers) {
    state.unsubscribePlayers();
    state.unsubscribePlayers = null;
  }

  if (state.unsubscribeChat) {
    state.unsubscribeChat();
    state.unsubscribeChat = null;
  }

  const playersRef = ref(
    db,
    `worlds/${state.world}/players`
  );

  state.unsubscribePlayers = onValue(
    playersRef,
    (snapshot) => {
      const data = snapshot.val() || {};

      state.players = { ...data };

      if (state.me) {
        state.players[state.me.uid] = { ...state.me };
      }

      updateCounts();
      renderFriendsModal();
    }
  );

  const chatRef = ref(
    db,
    `worlds/${state.world}/chat`
  );

  state.unsubscribeChat = onValue(
    chatRef,
    (snapshot) => {
      const data = snapshot.val() || {};

      state.chat = Object.values(data)
        .sort(
          (a, b) =>
            (a.timestamp || 0) -
            (b.timestamp || 0)
        )
        .slice(-30);

      renderChat();
    }
  );
}

function setConnection(text) {
  const elements = [
    $("#connectionStatus"),
    $("#onlineStatus"),
    $("#firebaseStatus")
  ];

  elements.forEach((element) => {
    if (element) element.textContent = text;
  });
}

/* =========================================================
   COUNTERS
   ========================================================= */

function updateCounts() {
  const count = Object.keys(state.players || {}).length;

  if ($("#playerCount")) $("#playerCount").textContent = count;
  if ($("#onlineCount")) $("#onlineCount").textContent = count;
}

function updateCounters() {
  updateCounts();
}

/* =========================================================
   TOAST
   ========================================================= */

function toast(message) {
  let element = $("#toast");

  if (!element) {
    element = document.createElement("div");
    element.id = "toast";
    element.className = "toast";
    document.body.appendChild(element);
  }

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    element.classList.remove("show");
  }, 1800);
}

/* =========================================================
   LOOP
   ========================================================= */

function loop(now = performance.now()) {
  const dt = Math.min(50, now - state.lastFrame);
  state.lastFrame = now;

  updateMovement();
  drawWorld();

  requestAnimationFrame(loop);
}

/* =========================================================
   START
   ========================================================= */

init();
'''

path = Path("/mnt/data/script.js")
path.write_text(script, encoding="utf-8")
print(f"Created: {path}")
print(f"Lines: {len(script.splitlines())}")
