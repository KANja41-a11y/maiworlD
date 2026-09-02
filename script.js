import { firebaseConfig, FIREBASE_READY } from "./firebase-config.js";

/* =========================================================
   MAIWORLD — FINAL SCRIPT
   ========================================================= */

const CDN = "https://www.gstatic.com/firebasejs/12.2.1/";

const state = {
  worlds: [],
  items: [],
  emotes: [],
  characters: {},

  currentWorld: "plaza",
  me: null,
  uid: null,

  players: {},
  nearbyPlayers: {},

  x: 480,
  y: 300,
  speed: 3.5,

  keys: new Set(),
  lastMove: 0,

  firebase: {
    app: null,
    auth: null,
    db: null,
    ready: false,
    worldUnsubscribe: null,
    playerUnsubscribe: null,
    chatUnsubscribe: null
  },

  avatar: {
    skin: "#FFD7B5",
    hair: "#5B3A29",
    eyes: "#332222",
    mouth: "smile",
    top: "#FF8FB3",
    bottom: "#9C8CFF",
    dress: null,
    shoes: "#FFFFFF",
    accessory: null,
    bag: null
  },

  music: {
    audio: null,
    playing: false
  },

  canvas: null,
  ctx: null,
  dpr: 1,

  interaction: null,
  lastInteraction: 0,

  chatOpen: false,
  friends: [],

  initialized: false
};

/* =========================================================
   HELPERS
   ========================================================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function byId(id) {
  return document.getElementById(id);
}

function safeJSON(value, fallback) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

function randomId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPlayerName() {
  return (
    localStorage.getItem("maiworld_name") ||
    localStorage.getItem("playerName") ||
    "Mimi"
  );
}

function savePlayerName(name) {
  localStorage.setItem("maiworld_name", name);
  localStorage.setItem("playerName", name);
}

function toast(message) {
  let el = byId("maiworldToast");

  if (!el) {
    el = document.createElement("div");
    el.id = "maiworldToast";
    el.style.cssText = `
      position:fixed;
      left:50%;
      bottom:90px;
      transform:translateX(-50%) translateY(10px);
      z-index:99999;
      padding:10px 16px;
      border-radius:999px;
      background:rgba(45,31,45,.94);
      color:#fff;
      font:600 13px/1.2 system-ui,sans-serif;
      box-shadow:0 8px 30px rgba(0,0,0,.18);
      opacity:0;
      pointer-events:none;
      transition:.25s ease;
    `;
    document.body.appendChild(el);
  }

  el.textContent = message;
  el.style.opacity = "1";
  el.style.transform = "translateX(-50%) translateY(0)";

  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(10px)";
  }, 1800);
}

function showBootError(message) {
  const boot = byId("boot");

  if (!boot) {
    toast(message);
    return;
  }

  boot.innerHTML = `
    <div style="
      padding:30px;
      max-width:420px;
      text-align:center;
      font-family:system-ui,sans-serif;
    ">
      <div style="font-size:42px">૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა</div>
      <h2 style="margin:10px 0">MAIWORLD gagal dimuat ♡</h2>
      <p style="opacity:.7">${escapeHTML(message)}</p>
      <button
        id="retryLoad"
        style="
          margin-top:14px;
          padding:10px 18px;
          border:0;
          border-radius:999px;
          cursor:pointer;
        "
      >Coba lagi</button>
    </div>
  `;

  const retry = byId("retryLoad");
  retry?.addEventListener("click", () => location.reload());
}

function hideBoot() {
  const boot = byId("boot");
  if (!boot) return;

  boot.classList.add("hide");

  setTimeout(() => {
    boot.style.display = "none";
  }, 500);
}

/* =========================================================
   DATA NORMALIZATION
   ========================================================= */

function normalizeWorldData(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.worlds)) return data.worlds;
  if (Array.isArray(data?.data)) return data.data;

  if (data && typeof data === "object") {
    return Object.entries(data).map(([id, value]) => ({
      id,
      ...(value || {})
    }));
  }

  return [];
}

function normalizeItemsData(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;

  if (data && typeof data === "object") {
    return Object.entries(data).map(([id, value]) => ({
      id,
      ...(value || {})
    }));
  }

  return [];
}

function normalizeEmotesData(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.emotes)) return data.emotes;
  if (Array.isArray(data?.data)) return data.data;

  if (data && typeof data === "object") {
    return Object.entries(data).map(([id, value]) => ({
      id,
      ...(value || {})
    }));
  }

  return [];
}

/* =========================================================
   FETCH GAME DATA
   ========================================================= */

async function loadGameData() {
  const urls = [
    "./data/world.json",
    "./data/items.json",
    "./data/emotes.json",
    "./data/characters.json"
  ];

  const responses = await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`${url} → ${response.status}`);
      }

      return response.json();
    })
  );

  state.worlds = normalizeWorldData(responses[0]);
  state.items = normalizeItemsData(responses[1]);
  state.emotes = normalizeEmotesData(responses[2]);
  state.characters = responses[3] || {};

  if (!state.worlds.length) {
    state.worlds = defaultWorlds();
  }

  if (!state.items.length) {
    state.items = defaultItems();
  }

  if (!state.emotes.length) {
    state.emotes = defaultEmotes();
  }
}

function defaultWorlds() {
  return [
    {
      id: "plaza",
      name: "Plaza",
      emoji: "🌸",
      color: "#ffd8e7"
    },
    {
      id: "park",
      name: "Park",
      emoji: "🌳",
      color: "#d8f3dc"
    },
    {
      id: "school",
      name: "School",
      emoji: "🏫",
      color: "#fff0c7"
    },
    {
      id: "cafe",
      name: "Cafe",
      emoji: "☕",
      color: "#ead8cc"
    },
    {
      id: "studio",
      name: "Studio",
      emoji: "🎨",
      color: "#e5ddff"
    },
    {
      id: "beach",
      name: "Beach",
      emoji: "🏖️",
      color: "#d8f5ff"
    },
    {
      id: "library",
      name: "Library",
      emoji: "📚",
      color: "#e7e1d5"
    },
    {
      id: "arcade",
      name: "Arcade",
      emoji: "🕹️",
      color: "#eadcff"
    },
    {
      id: "garden",
      name: "Garden",
      emoji: "🌷",
      color: "#dff5df"
    },
    {
      id: "concert",
      name: "Concert",
      emoji: "🎤",
      color: "#ead9ff"
    }
  ];
}

function defaultItems() {
  return [
    { id: "bench", name: "Bench", emoji: "🪑", interaction: "Sit here for a little rest ♡" },
    { id: "flower", name: "Flower", emoji: "🌷", interaction: "A tiny flower says hello!" },
    { id: "bell", name: "Bell", emoji: "🔔", interaction: "Ding ding! ♡" },
    { id: "locker", name: "Locker", emoji: "🗄️", interaction: "Maybe there's a little secret inside..." },
    { id: "coffee", name: "Coffee", emoji: "☕", interaction: "Warm coffee for a cozy day." },
    { id: "jukebox", name: "Jukebox", emoji: "🎵", interaction: "Let's play some music!" },
    { id: "easel", name: "Easel", emoji: "🎨", interaction: "Your creativity is sparkling!" },
    { id: "gallery", name: "Gallery", emoji: "🖼️", interaction: "So many cute creations!" },
    { id: "shell", name: "Shell", emoji: "🐚", interaction: "You found a pretty shell!" },
    { id: "book", name: "Book", emoji: "📖", interaction: "A new story is waiting." },
    { id: "arcade", name: "Arcade", emoji: "🕹️", interaction: "Ready for a game?" },
    { id: "seed", name: "Seed", emoji: "🌱", interaction: "Plant something beautiful." },
    { id: "mic", name: "Microphone", emoji: "🎤", interaction: "Mic check... one, two!" },
    { id: "piano", name: "Piano", emoji: "🎹", interaction: "♪ tiny concert ♪" },
    { id: "swing", name: "Swing", emoji: "🎠", interaction: "Wheee! ♡" },
    { id: "photo", name: "Photo Spot", emoji: "📸", interaction: "Smile! ✨" }
  ];
}

function defaultEmotes() {
  return [
    { id: "wave", name: "Wave", emoji: "👋" },
    { id: "heart", name: "Heart", emoji: "💗" },
    { id: "happy", name: "Happy", emoji: "🥰" },
    { id: "laugh", name: "Laugh", emoji: "😂" },
    { id: "sparkle", name: "Sparkle", emoji: "✨" },
    { id: "dance", name: "Dance", emoji: "💃" }
  ];
}

/* =========================================================
   CANVAS
   ========================================================= */

function setupCanvas() {
  state.canvas = byId("gameCanvas");

  if (!state.canvas) return;

  state.ctx = state.canvas.getContext("2d");
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);

  resizeCanvas();

  window.addEventListener("resize", resizeCanvas);
}

function resizeCanvas() {
  if (!state.canvas || !state.ctx) return;

  const rect = state.canvas.getBoundingClientRect();

  if (!rect.width || !rect.height) return;

  const width = 960;
  const height = 600;

  state.canvas.width = width * state.dpr;
  state.canvas.height = height * state.dpr;

  state.ctx.setTransform(
    state.dpr,
    0,
    0,
    state.dpr,
    0,
    0
  );
}

/* =========================================================
   WORLD
   ========================================================= */

function getCurrentWorld() {
  return (
    state.worlds.find(
      (world) => String(world.id) === String(state.currentWorld)
    ) || {
      id: state.currentWorld,
      name: state.currentWorld,
      emoji: "🌸",
      color: "#ffd8e7"
    }
  );
}

function getWorldItems(worldId = state.currentWorld) {
  const world = state.worlds.find(
    (item) => String(item.id) === String(worldId)
  );

  if (Array.isArray(world?.items)) {
    return world.items;
  }

  if (Array.isArray(world?.objects)) {
    return world.objects;
  }

  return state.items.slice(
    0,
    Math.min(6, state.items.length)
  );
}

function itemPosition(item, index) {
  const x =
    Number(item.x) ||
    100 + ((index * 137) % 760);

  const y =
    Number(item.y) ||
    120 + ((index * 91) % 380);

  return {
    x: clamp(x, 50, 910),
    y: clamp(y, 70, 530)
  };
}

function renderWorld() {
  drawScene();
}

function drawScene() {
  const canvas = state.canvas;
  const ctx = state.ctx;

  if (!canvas || !ctx) return;

  const world = getCurrentWorld();

  ctx.clearRect(0, 0, 960, 600);

  /* background */
  const bg = world.color || "#f8dfea";

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 960, 600);

  /* pixel-like grid */
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = "#5f4b58";
  ctx.lineWidth = 1;

  for (let x = 0; x < 960; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 600);
    ctx.stroke();
  }

  for (let y = 0; y < 600; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(960, y);
    ctx.stroke();
  }

  ctx.restore();

  drawWorldDecoration(world);

  const items = getWorldItems();

  items.forEach((item, index) => {
    drawItem(item, index);
  });

  /* other players */
  Object.values(state.players).forEach((player) => {
    if (!player || player.uid === state.uid) return;
    if (player.world !== state.currentWorld) return;

    drawRemotePlayer(player);
  });

  /* local player */
  drawPlayer({
    ...state.me,
    uid: state.uid,
    name: getPlayerName(),
    x: state.x,
    y: state.y,
    avatar: state.avatar
  });

  drawNameTag(
    state.x,
    state.y - 40,
    getPlayerName(),
    true
  );

  drawInteractionRange();

  updateInteractionTarget();
}

function drawWorldDecoration(world) {
  const id = String(world.id || "").toLowerCase();

  ctxRoundRect(
    state.ctx,
    24,
    24,
    912,
    552,
    28,
    "rgba(255,255,255,.13)"
  );

  if (id.includes("park") || id.includes("garden")) {
    for (let i = 0; i < 18; i++) {
      const x = 40 + ((i * 137) % 880);
      const y = 50 + ((i * 71) % 500);

      drawTree(state.ctx, x, y);
    }
  }

  if (id.includes("beach")) {
    state.ctx.fillStyle = "rgba(255,255,255,.35)";
    for (let i = 0; i < 8; i++) {
      state.ctx.beginPath();
      state.ctx.arc(
        80 + i * 120,
        500 + Math.sin(i) * 10,
        35,
        0,
        Math.PI * 2
      );
      state.ctx.fill();
    }
  }

  if (id.includes("school")) {
    drawBuilding(state.ctx, 80, 70, 180, 100, "SCHOOL");
  }

  if (id.includes("cafe")) {
    drawBuilding(state.ctx, 700, 70, 180, 110, "CAFE");
  }

  if (id.includes("library")) {
    drawBuilding(state.ctx, 60, 70, 200, 110, "LIBRARY");
  }

  if (id.includes("studio")) {
    drawBuilding(state.ctx, 680, 70, 200, 110, "STUDIO");
  }

  if (id.includes("arcade")) {
    drawBuilding(state.ctx, 690, 70, 200, 110, "ARCADE");
  }

  if (id.includes("concert")) {
    drawBuilding(state.ctx, 300, 45, 360, 115, "STAGE");
  }
}

function drawBuilding(ctx, x, y, w, h, label) {
  ctxRoundRect(
    ctx,
    x,
    y,
    w,
    h,
    18,
    "rgba(255,255,255,.65)"
  );

  ctx.fillStyle = "rgba(80,55,75,.8)";
  ctx.font = "bold 18px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2);
}

function drawTree(ctx, x, y) {
  ctx.fillStyle = "#9a6d50";
  ctx.fillRect(x - 5, y + 15, 10, 28);

  ctx.fillStyle = "#78b979";
  ctx.beginPath();
  ctx.arc(x, y, 25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#9bd59a";
  ctx.beginPath();
  ctx.arc(x - 12, y - 8, 13, 0, Math.PI * 2);
  ctx.fill();
}

function drawItem(item, index) {
  const pos = itemPosition(item, index);

  item._renderX = pos.x;
  item._renderY = pos.y;

  const selected =
    state.interaction?.item?.id === item.id;

  if (selected) {
    state.ctx.save();
    state.ctx.globalAlpha = 0.35;
    state.ctx.fillStyle = "#fff";
    state.ctx.beginPath();
    state.ctx.arc(pos.x, pos.y, 31, 0, Math.PI * 2);
    state.ctx.fill();
    state.ctx.restore();
  }

  const emoji =
    item.emoji ||
    item.icon ||
    item.symbol ||
    "✨";

  state.ctx.font = "28px 'Segoe UI Emoji', sans-serif";
  state.ctx.textAlign = "center";
  state.ctx.textBaseline = "middle";

  state.ctx.fillText(
    emoji,
    pos.x,
    pos.y
  );

  if (selected) {
    state.ctx.font = "bold 12px system-ui";
    state.ctx.fillStyle = "#5b4557";
    state.ctx.fillText(
      item.name || "Interact",
      pos.x,
      pos.y + 27
    );
  }
}

function drawInteractionRange() {
  if (!state.interaction?.item) return;

  const pos = state.interaction.position;

  state.ctx.save();
  state.ctx.globalAlpha = 0.12;
  state.ctx.strokeStyle = "#fff";
  state.ctx.lineWidth = 2;

  state.ctx.beginPath();
  state.ctx.arc(
    pos.x,
    pos.y,
    45,
    0,
    Math.PI * 2
  );
  state.ctx.stroke();

  state.ctx.restore();
}

/* =========================================================
   PLAYER DRAWING
   ========================================================= */

function drawPlayer(player) {
  const ctx = state.ctx;

  if (!ctx || !player) return;

  const x = Number(player.x) || 480;
  const y = Number(player.y) || 300;

  const avatar = {
    ...state.avatar,
    ...(player.avatar || {})
  };

  ctx.save();

  /* shadow */
  ctx.fillStyle = "rgba(80,50,70,.16)";
  ctx.beginPath();
  ctx.ellipse(
    x,
    y + 24,
    20,
    7,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  /* body */
  ctx.fillStyle =
    avatar.dress ||
    avatar.top ||
    "#ff8fb3";

  ctxRoundRect(
    ctx,
    x - 15,
    y - 1,
    30,
    30,
    8,
    ctx.fillStyle
  );

  /* bottom */
  if (!avatar.dress) {
    ctx.fillStyle = avatar.bottom || "#9c8cff";

    ctx.fillRect(
      x - 14,
      y + 16,
      12,
      15
    );

    ctx.fillRect(
      x + 2,
      y + 16,
      12,
      15
    );
  }

  /* shoes */
  ctx.fillStyle = avatar.shoes || "#fff";

  ctx.fillRect(
    x - 17,
    y + 29,
    14,
    6
  );

  ctx.fillRect(
    x + 3,
    y + 29,
    14,
    6
  );

  /* head */
  ctx.fillStyle = avatar.skin || "#ffd7b5";

  ctx.beginPath();
  ctx.arc(
    x,
    y - 18,
    18,
    0,
    Math.PI * 2
  );
  ctx.fill();

  /* hair */
  ctx.fillStyle =
    avatar.hair ||
    "#5b3a29";

  ctx.beginPath();
  ctx.arc(
    x,
    y - 23,
    20,
    Math.PI,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillRect(
    x - 19,
    y - 24,
    6,
    19
  );

  ctx.fillRect(
    x + 13,
    y - 24,
    6,
    19
  );

  /* eyes */
  ctx.fillStyle =
    avatar.eyes ||
    "#332222";

  ctx.beginPath();
  ctx.arc(
    x - 6,
    y - 17,
    2,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.beginPath();
  ctx.arc(
    x + 6,
    y - 17,
    2,
    0,
    Math.PI * 2
  );
  ctx.fill();

  /* mouth */
  ctx.strokeStyle = avatar.eyes || "#332222";
  ctx.lineWidth = 1.5;

  ctx.beginPath();

  if (avatar.mouth === "happy") {
    ctx.arc(
      x,
      y - 10,
      4,
      0,
      Math.PI
    );
  } else if (avatar.mouth === "cute") {
    ctx.arc(
      x,
      y - 11,
      3,
      0,
      Math.PI
    );
  } else {
    ctx.arc(
      x,
      y - 12,
      3,
      0,
      Math.PI
    );
  }

  ctx.stroke();

  /* accessory */
  if (avatar.accessory) {
    drawAccessory(
      ctx,
      x,
      y,
      avatar.accessory
    );
  }

  /* bag */
  if (avatar.bag) {
    ctx.fillStyle = "#d99ab9";
    ctx.fillRect(
      x + 16,
      y + 4,
      8,
      13
    );
  }

  ctx.restore();
}

function drawRemotePlayer(player) {
  drawPlayer(player);

  drawNameTag(
    player.x,
    player.y - 40,
    player.name || "Friend",
    false
  );
}

function drawNameTag(x, y, name, isMe) {
  const ctx = state.ctx;

  ctx.save();

  ctx.font = "600 11px system-ui";
  const width =
    ctx.measureText(name).width + 16;

  ctx.fillStyle = isMe
    ? "rgba(255,143,179,.9)"
    : "rgba(255,255,255,.85)";

  ctxRoundRect(
    ctx,
    x - width / 2,
    y - 8,
    width,
    18,
    9,
    ctx.fillStyle
  );

  ctx.fillStyle = isMe
    ? "#fff"
    : "#5b4557";

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(
    name,
    x,
    y + 1
  );

  ctx.restore();
}

function drawAccessory(ctx, x, y, accessory) {
  const value = String(accessory).toLowerCase();

  if (
    value.includes("bow") ||
    value.includes("ribbon")
  ) {
    ctx.fillStyle = "#ff7fab";

    ctx.beginPath();
    ctx.moveTo(x - 16, y - 34);
    ctx.lineTo(x - 28, y - 42);
    ctx.lineTo(x - 25, y - 30);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x - 8, y - 34);
    ctx.lineTo(x - 20, y - 45);
    ctx.lineTo(x - 18, y - 30);
    ctx.closePath();
    ctx.fill();
  }

  if (value.includes("crown")) {
    ctx.fillStyle = "#ffd85a";

    ctx.beginPath();
    ctx.moveTo(x - 13, y - 38);
    ctx.lineTo(x - 7, y - 49);
    ctx.lineTo(x, y - 39);
    ctx.lineTo(x + 7, y - 49);
    ctx.lineTo(x + 13, y - 38);
    ctx.closePath();
    ctx.fill();
  }

  if (value.includes("flower")) {
    ctx.font = "15px sans-serif";
    ctx.fillText("🌸", x + 14, y - 30);
  }
}

function ctxRoundRect(
  ctx,
  x,
  y,
  w,
  h,
  r,
  fill
) {
  ctx.beginPath();

  ctx.roundRect(
    x,
    y,
    w,
    h,
    r
  );

  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

/* =========================================================
   MOVEMENT
   ========================================================= */

function setupMovement() {
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (
      [
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        "w",
        "a",
        "s",
        "d",
        "e"
      ].includes(key)
    ) {
      event.preventDefault();
    }

    state.keys.add(key);

    if (key === "e") {
      interact();
    }
  });

  window.addEventListener("keyup", (event) => {
    state.keys.delete(event.key.toLowerCase());
  });

  window.addEventListener("blur", () => {
    state.keys.clear();
  });

  setupMobileMovement();
}

function setupMobileMovement() {
  const buttons = {
    up: ["mobileUp", "upBtn"],
    down: ["mobileDown", "downBtn"],
    left: ["mobileLeft", "leftBtn"],
    right: ["mobileRight", "rightBtn"]
  };

  Object.entries(buttons).forEach(
    ([direction, ids]) => {
      const key =
        direction === "up"
          ? "arrowup"
          : direction === "down"
          ? "arrowdown"
          : direction === "left"
          ? "arrowleft"
          : "arrowright";

      ids.forEach((id) => {
        const button = byId(id);

        if (!button) return;

        button.addEventListener(
          "pointerdown",
          (event) => {
            event.preventDefault();
            state.keys.add(key);
          }
        );

        button.addEventListener(
          "pointerup",
          (event) => {
            event.preventDefault();
            state.keys.delete(key);
          }
        );

        button.addEventListener(
          "pointercancel",
          () => state.keys.delete(key)
        );

        button.addEventListener(
          "pointerleave",
          () => state.keys.delete(key)
        );
      });
    }
  );

  const interactButton =
    byId("mobileInteract");

  interactButton?.addEventListener(
    "click",
    interact
  );
}

function updateMovement(delta) {
  let dx = 0;
  let dy = 0;

  if (
    state.keys.has("arrowup") ||
    state.keys.has("w")
  ) {
    dy -= 1;
  }

  if (
    state.keys.has("arrowdown") ||
    state.keys.has("s")
  ) {
    dy += 1;
  }

  if (
    state.keys.has("arrowleft") ||
    state.keys.has("a")
  ) {
    dx -= 1;
  }

  if (
    state.keys.has("arrowright") ||
    state.keys.has("d")
  ) {
    dx += 1;
  }

  if (!dx && !dy) return;

  const length = Math.hypot(dx, dy) || 1;

  dx /= length;
  dy /= length;

  const speed =
    state.speed *
    Math.min(delta / 16.67, 2);

  state.x = clamp(
    state.x + dx * speed,
    45,
    915
  );

  state.y = clamp(
    state.y + dy * speed,
    60,
    540
  );

  const now = Date.now();

  if (now - state.lastMove > 70) {
    state.lastMove = now;
    syncPlayer();
  }
}

/* =========================================================
   INTERACTION
   ========================================================= */

function updateInteractionTarget() {
  const items = getWorldItems();

  let closest = null;
  let closestDistance = Infinity;

  items.forEach((item, index) => {
    const pos = itemPosition(item, index);

    const distance = Math.hypot(
      state.x - pos.x,
      state.y - pos.y
    );

    if (
      distance < closestDistance &&
      distance <= 65
    ) {
      closest = {
        item,
        position: pos,
        distance
      };

      closestDistance = distance;
    }
  });

  state.interaction = closest;

  updateInteractionBubble();
}

function updateInteractionBubble() {
  const bubble =
    byId("interactionBubble");

  if (!bubble) return;

  if (!state.interaction) {
    bubble.classList.remove("show");
    bubble.classList.remove("active");
    return;
  }

  const item =
    state.interaction.item;

  bubble.innerHTML = `
    <div style="font-size:20px">
      ${item.emoji || item.icon || "✨"}
    </div>
    <div>
      <strong>${escapeHTML(
        item.name || "Interact"
      )}</strong>
      <small>Press E or tap ♡</small>
    </div>
  `;

  bubble.classList.add("show");
  bubble.classList.add("active");
}

function interact() {
  if (!state.interaction) {
    toast("Dekati benda dulu yaa ♡");
    return;
  }

  const item =
    state.interaction.item;

  const message =
    item.interaction ||
    item.description ||
    `${item.name || "Object"} says hello! ♡`;

  state.lastInteraction = Date.now();

  showInteractionEffect(
    state.interaction.position.x,
    state.interaction.position.y
  );

  toast(message);

  if (
    String(item.id).toLowerCase() ===
    "jukebox"
  ) {
    toggleMusic();
  }

  if (
    String(item.id).toLowerCase() ===
    "photo"
  ) {
    photoMoment();
  }

  if (
    String(item.id).toLowerCase() ===
    "piano" ||
    String(item.id).toLowerCase() ===
    "mic"
  ) {
    sendEmote("sparkle");
  }
}

function showInteractionEffect(x, y) {
  const canvas = state.canvas;
  if (!canvas) return;

  const rect =
    canvas.getBoundingClientRect();

  const scaleX = rect.width / 960;
  const scaleY = rect.height / 600;

  const effect =
    document.createElement("div");

  effect.textContent = "✦ ♡ ✦";

  effect.style.cssText = `
    position:fixed;
    left:${rect.left + x * scaleX}px;
    top:${rect.top + y * scaleY}px;
    transform:translate(-50%,-50%);
    z-index:9999;
    pointer-events:none;
    font-size:20px;
    font-weight:800;
    color:#ff8fb3;
    animation:maiworldPop .9s ease forwards;
  `;

  document.body.appendChild(effect);

  setTimeout(() => effect.remove(), 950);
}

function photoMoment() {
  toast("Cheese! 📸✨");

  if (
    navigator.vibrate
  ) {
    navigator.vibrate(30);
  }
}

/* =========================================================
   CANVAS CLICK INTERACTION
   ========================================================= */

function setupCanvasInteraction() {
  const canvas = state.canvas;

  if (!canvas) return;

  canvas.addEventListener(
    "click",
    (event) => {
      const rect =
        canvas.getBoundingClientRect();

      const x =
        ((event.clientX - rect.left) /
          rect.width) *
        960;

      const y =
        ((event.clientY - rect.top) /
          rect.height) *
        600;

      let nearest = null;
      let distance = Infinity;

      getWorldItems().forEach(
        (item, index) => {
          const pos = itemPosition(
            item,
            index
          );

          const d = Math.hypot(
            x - pos.x,
            y - pos.y
          );

          if (
            d < distance &&
            d < 45
          ) {
            nearest = {
              item,
              position: pos,
              distance: d
            };

            distance = d;
          }
        }
      );

      if (nearest) {
        state.interaction = nearest;
        interact();
      }
    }
  );
}

/* =========================================================
   WORLD LIST
   ========================================================= */

function renderWorldList() {
  const containers = [
    byId("worldList"),
    byId("worldsList"),
    byId("worldContent")
  ].filter(Boolean);

  if (!containers.length) return;

  const html = state.worlds
    .map((world) => {
      const active =
        String(world.id) ===
        String(state.currentWorld);

      return `
        <button
          class="world-choice ${active ? "active" : ""}"
          data-world="${escapeHTML(world.id)}"
          type="button"
        >
          <span style="font-size:24px">
            ${world.emoji || "🌸"}
          </span>

          <span>
            ${escapeHTML(
              world.name ||
                world.title ||
                world.id
            )}
          </span>
        </button>
      `;
    })
    .join("");

  containers.forEach(
    (container) => {
      container.innerHTML = html;

      container
        .querySelectorAll(
          "[data-world]"
        )
        .forEach((button) => {
          button.addEventListener(
            "click",
            () => {
              changeWorld(
                button.dataset.world
              );
            }
          );
        });
    }
  );
}

async function changeWorld(worldId) {
  if (!worldId) return;

  if (
    String(worldId) ===
    String(state.currentWorld)
  ) {
    closeWorldModal();
    return;
  }

  state.currentWorld = worldId;

  const world = getCurrentWorld();

  state.x =
    Number(world.spawnX) ||
    480;

  state.y =
    Number(world.spawnY) ||
    300;

  state.interaction = null;

  renderWorldList();
  renderWorld();

  await syncPlayer();

  listenWorld();

  closeWorldModal();

  toast(
    `Welcome to ${
      world.name || world.id
    } ${world.emoji || "♡"}`
  );
}

/* =========================================================
   PROFILE / CUSTOMIZATION
   ========================================================= */

function loadSavedAvatar() {
  const saved =
    safeJSON(
      localStorage.getItem(
        "maiworld_avatar"
      ),
      null
    );

  if (
    saved &&
    typeof saved === "object"
  ) {
    state.avatar = {
      ...state.avatar,
      ...saved
    };
  }
}

function saveAvatar() {
  localStorage.setItem(
    "maiworld_avatar",
    JSON.stringify(state.avatar)
  );
}

function renderProfile() {
  const nameInput =
    byId("profileName") ||
    byId("nameInput") ||
    byId("playerName");

  if (nameInput) {
    nameInput.value =
      getPlayerName();
  }

  renderAvatarPreview();
  bindCustomizationControls();
}

function renderAvatarPreview() {
  const preview =
    byId("avatarPreview") ||
    byId("characterPreview") ||
    byId("profileAvatar");

  if (!preview) return;

  preview.innerHTML = "";

  const canvas =
    document.createElement("canvas");

  canvas.width = 240;
  canvas.height = 300;

  canvas.style.maxWidth = "100%";

  preview.appendChild(canvas);

  const ctx =
    canvas.getContext("2d");

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.save();

  ctx.translate(
    120,
    150
  );

  drawPreviewAvatar(
    ctx,
    state.avatar
  );

  ctx.restore();
}

function drawPreviewAvatar(ctx, avatar) {
  const fakePlayer = {
    x: 0,
    y: 0,
    avatar
  };

  const oldCtx = state.ctx;

  state.ctx = ctx;

  drawPlayer(fakePlayer);

  state.ctx = oldCtx;
}

function bindCustomizationControls() {
  $$("[data-avatar]").forEach(
    (control) => {
      if (control.dataset.bound) return;

      control.dataset.bound = "1";

      control.addEventListener(
        "click",
        () => {
          const key =
            control.dataset.avatar;

          let value =
            control.dataset.value;

          if (!value) {
            value =
              control.value ||
              control.getAttribute(
                "value"
              );
          }

          if (!key) return;

          state.avatar[key] = value;

          saveAvatar();
          renderAvatarPreview();
          syncPlayer();
        }
      );
    }
  );

  $$("input[data-avatar]").forEach(
    (input) => {
      input.addEventListener(
        "input",
        () => {
          state.avatar[
            input.dataset.avatar
          ] = input.value;

          saveAvatar();
          renderAvatarPreview();
        }
      );
    }
  );
}

function setupProfileActions() {
  const saveButtons = [
    byId("saveProfile"),
    byId("saveProfileBtn"),
    byId("profileSave")
  ].filter(Boolean);

  saveButtons.forEach(
    (button) => {
      button.addEventListener(
        "click",
        saveProfile
      );
    }
  );

  const nameInputs = [
    byId("profileName"),
    byId("nameInput"),
    byId("playerName")
  ].filter(Boolean);

  nameInputs.forEach(
    (input) => {
      input.addEventListener(
        "change",
        () => {
          savePlayerName(
            input.value.trim() ||
              "Mimi"
          );
        }
      );
    }
  );
}

async function saveProfile() {
  const input =
    byId("profileName") ||
    byId("nameInput") ||
    byId("playerName");

  if (input) {
    savePlayerName(
      input.value.trim() ||
        "Mimi"
    );
  }

  saveAvatar();

  state.me = {
    ...(state.me || {}),
    name: getPlayerName(),
    avatar: {
      ...state.avatar
    }
  };

  await syncPlayer();

  toast("Profile tersimpan ♡");

  closeModal("profileModal");
}

/* =========================================================
   EMOTES
   ========================================================= */

function renderEmotes() {
  const bar =
    byId("emoteBar");

  if (!bar) return;

  bar.innerHTML =
    state.emotes
      .map(
        (emote) => `
          <button
            class="emote-button"
            type="button"
            data-emote="${escapeHTML(
              emote.id
            )}"
            title="${escapeHTML(
              emote.name ||
                emote.id
            )}"
          >
            ${emote.emoji || "♡"}
          </button>
        `
      )
      .join("");

  bar
    .querySelectorAll(
      "[data-emote]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () =>
          sendEmote(
            button.dataset.emote
          )
      );
    });
}

async function sendEmote(emoteId) {
  const emote =
    state.emotes.find(
      (item) =>
        String(item.id) ===
        String(emoteId)
    );

  if (!emote) return;

  const emoji =
    emote.emoji ||
    "♡";

  showFloatingEmoji(
    state.x,
    state.y - 50,
    emoji
  );

  await updateMyPlayer({
    emote: {
      id: emote.id,
      emoji,
      at: Date.now()
    }
  });

  setTimeout(() => {
    updateMyPlayer({
      emote: null
    });
  }, 1600);
}

function showFloatingEmoji(
  x,
  y,
  emoji
) {
  const canvas = state.canvas;

  if (!canvas) return;

  const rect =
    canvas.getBoundingClientRect();

  const scaleX =
    rect.width / 960;

  const scaleY =
    rect.height / 600;

  const el =
    document.createElement("div");

  el.textContent = emoji;

  el.style.cssText = `
    position:fixed;
    left:${rect.left + x * scaleX}px;
    top:${rect.top + y * scaleY}px;
    transform:translate(-50%,-50%);
    z-index:10000;
    pointer-events:none;
    font-size:30px;
    animation:maiworldFloat 1.4s ease forwards;
  `;

  document.body.appendChild(el);

  setTimeout(
    () => el.remove(),
    1500
  );
}

/* =========================================================
   CHAT
   ========================================================= */

function setupChat() {
  const input =
    byId("chatInput");

  const send =
    byId("chatSend") ||
    byId("sendChat");

  if (input) {
    input.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Enter"
        ) {
          event.preventDefault();
          sendChat();
        }
      }
    );
  }

  send?.addEventListener(
    "click",
    sendChat
  );
}

async function sendChat() {
  const input =
    byId("chatInput");

  if (!input) return;

  const text =
    input.value.trim();

  if (!text) return;

  input.value = "";

  if (
    state.firebase.ready &&
    state.firebase.db
  ) {
    try {
      const {
        ref,
        push,
        set
      } = await getFirebaseDatabaseModules();

      const chatRef = ref(
        state.firebase.db,
        `worlds/${state.currentWorld}/chat`
      );

      await set(
        push(chatRef),
        {
          uid: state.uid || randomId("guest"),
          name: getPlayerName(),
          text: text.slice(0, 300),
          at: Date.now()
        }
      );

      return;
    } catch (error) {
      console.warn(
        "Firebase chat failed:",
        error
      );
    }
  }

  renderChatMessage({
    uid: state.uid,
    name: getPlayerName(),
    text,
    at: Date.now()
  });
}

function renderChatMessage(message) {
  const containers = [
    byId("chatMessages"),
    byId("chatList"),
    byId("messages")
  ].filter(Boolean);

  if (!containers.length) return;

  const html = `
    <div class="chat-message">
      <strong>
        ${escapeHTML(
          message.name ||
            "Friend"
        )}
      </strong>
      <span>
        ${escapeHTML(
          message.text ||
            ""
        )}
      </span>
    </div>
  `;

  containers.forEach(
    (container) => {
      container.insertAdjacentHTML(
        "beforeend",
        html
      );

      container.scrollTop =
        container.scrollHeight;
    }
  );
}

/* =========================================================
   MODALS
   ========================================================= */

function openModal(id) {
  const modal =
    byId(id);

  if (!modal) return;

  modal.classList.add("active");
  modal.classList.add("open");
  modal.setAttribute(
    "aria-hidden",
    "false"
  );
}

function closeModal(id) {
  const modal =
    byId(id);

  if (!modal) return;

  modal.classList.remove("active");
  modal.classList.remove("open");
  modal.setAttribute(
    "aria-hidden",
    "true"
  );
}

function closeWorldModal() {
  closeModal("worldModal");
}

function setupModalButtons() {
  $$("[data-close-modal]").forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          closeModal(
            button.dataset.closeModal
          );
        }
      );
    }
  );

  $$(".modal").forEach(
    (modal) => {
      modal.addEventListener(
        "click",
        (event) => {
          if (
            event.target === modal
          ) {
            closeModal(
              modal.id
            );
          }
        }
      );
    }
  );
}

/* =========================================================
   FRIENDS
   ========================================================= */

function renderFriends() {
  const containers = [
    byId("friendsList"),
    byId("friendsContent")
  ].filter(Boolean);

  if (!containers.length) return;

  const players =
    Object.values(
      state.players
    ).filter(
      (player) =>
        player &&
        player.uid !== state.uid
    );

  const unique = [];

  players.forEach(
    (player) => {
      if (
        !unique.some(
          (item) =>
            item.uid ===
            player.uid
        )
      ) {
        unique.push(player);
      }
    }
  );

  if (!unique.length) {
    containers.forEach(
      (container) => {
        container.innerHTML = `
          <div style="
            text-align:center;
            padding:24px;
            opacity:.65;
          ">
            Belum ada teman online ♡
          </div>
        `;
      }
    );

    return;
  }

  const html = unique
    .map(
      (player) => `
        <div class="friend-card">
          <div>
            <strong>
              ${escapeHTML(
                player.name ||
                  "Friend"
              )}
            </strong>

            <small>
              ${
                player.world ===
                state.currentWorld
                  ? "Online di sini ♡"
                  : `Di ${
                      player.world ||
                      "world lain"
                    }`
              }
            </small>
          </div>

          <button
            type="button"
            data-follow="${escapeHTML(
              player.uid
            )}"
          >
            ♡
          </button>
        </div>
      `
    )
    .join("");

  containers.forEach(
    (container) => {
      container.innerHTML = html;

      container
        .querySelectorAll(
          "[data-follow]"
        )
        .forEach(
          (button) => {
            button.addEventListener(
              "click",
              () => {
                const player =
                  state.players[
                    button.dataset
                      .follow
                  ];

                if (!player)
                  return;

                if (
                  player.world !==
                  state.currentWorld
                ) {
                  changeWorld(
                    player.world
                  );
                  return;
                }

                state.x =
                  clamp(
                    Number(
                      player.x
                    ) + 40,
                    45,
                    915
                  );

                state.y =
                  clamp(
                    Number(
                      player.y
                    ) + 40,
                    60,
                    540
                  );

                toast(
                  `Hii ${
                    player.name ||
                    "friend"
                  } ♡`
                );
              }
            );
          }
        );
    }
  );
}

/* =========================================================
   MUSIC
   ========================================================= */

function setupMusic() {
  if (
    state.music.audio
  ) {
    return;
  }

  const audio =
    document.createElement("audio");

  audio.src =
    "./music/cozy-jazz.mp3";

  audio.loop = true;
  audio.preload = "auto";

  state.music.audio =
    audio;

  const button =
    byId("musicBtn");

  button?.addEventListener(
    "click",
    toggleMusic
  );
}

async function toggleMusic() {
  const audio =
    state.music.audio;

  if (!audio) return;

  if (state.music.playing) {
    audio.pause();

    state.music.playing =
      false;

    updateMusicButton();

    return;
  }

  try {
    await audio.play();

    state.music.playing =
      true;

    updateMusicButton();
  } catch {
    toast(
      "Tap music sekali lagi untuk mulai ♡"
    );
  }
}

function updateMusicButton() {
  const button =
    byId("musicBtn");

  if (!button) return;

  button.textContent =
    state.music.playing
      ? "♫"
      : "♪";
}

/* =========================================================
   FIREBASE
   ========================================================= */

async function loadFirebaseModules() {
  const [
    appModule,
    authModule,
    databaseModule
  ] = await Promise.all([
    import(
      `${CDN}firebase-app.js`
    ),
    import(
      `${CDN}firebase-auth.js`
    ),
    import(
      `${CDN}firebase-database.js`
    )
  ]);

  return {
    ...appModule,
    ...authModule,
    ...databaseModule
  };
}

let firebaseModulesPromise = null;

function getFirebaseModules() {
  if (!firebaseModulesPromise) {
    firebaseModulesPromise =
      loadFirebaseModules();
  }

  return firebaseModulesPromise;
}

async function getFirebaseDatabaseModules() {
  const modules =
    await getFirebaseModules();

  return {
    ref: modules.ref,
    push: modules.push,
    set: modules.set
  };
}

async function setupFirebase() {
  if (!FIREBASE_READY) {
    console.info(
      "Firebase disabled."
    );
    return;
  }

  if (
    state.firebase.ready
  ) {
    return;
  }

  try {
    const {
      initializeApp,
      getApps,
      getAuth,
      signInAnonymously,
      onAuthStateChanged,
      getDatabase,
      ref,
      onValue,
      onDisconnect,
      set,
      update
    } = await getFirebaseModules();

    state.firebase.app =
      getApps().length
        ? getApps()[0]
        : initializeApp(
            firebaseConfig
          );

    state.firebase.auth =
      getAuth(
        state.firebase.app
      );

    state.firebase.db =
      getDatabase(
        state.firebase.app
      );

    state.firebase.ready =
      true;

    onAuthStateChanged(
      state.firebase.auth,
      async (user) => {
        if (!user) return;

        state.uid = user.uid;

        state.me = {
          uid: user.uid,
          name: getPlayerName(),
          world: state.currentWorld,
          x: state.x,
          y: state.y,
          avatar: {
            ...state.avatar
          }
        };

        await registerPlayer(
          ref,
          set,
          update,
          onDisconnect
        );

        listenWorld();

        listenChat();
      }
    );

    await signInAnonymously(
      state.firebase.auth
    );
  } catch (error) {
    console.warn(
      "Firebase tidak tersedia:",
      error
    );

    state.firebase.ready =
      false;

    toast(
      "Mode offline aktif ♡"
    );
  }
}

async function registerPlayer(
  ref,
  set,
  update,
  onDisconnect
) {
  if (
    !state.firebase.db ||
    !state.uid
  ) {
    return;
  }

  const playerRef = ref(
    state.firebase.db,
    `worlds/${state.currentWorld}/players/${state.uid}`
  );

  const data = {
    uid: state.uid,
    name: getPlayerName(),
    world: state.currentWorld,
    x: state.x,
    y: state.y,
    avatar: {
      ...state.avatar
    },
    online: true,
    updatedAt: Date.now()
  };

  await set(
    playerRef,
    data
  );

  try {
    await onDisconnect(
      playerRef
    ).remove();
  } catch {}

  state.firebase.playerRef =
    playerRef;
}

async function updateMyPlayer(extra = {}) {
  if (
    !state.firebase.ready ||
    !state.firebase.db ||
    !state.uid
  ) {
    return;
  }

  try {
    const {
      ref,
      update
    } = await getFirebaseModules();

    const playerRef = ref(
      state.firebase.db,
      `worlds/${state.currentWorld}/players/${state.uid}`
    );

    await update(
      playerRef,
      {
        uid: state.uid,
        name: getPlayerName(),
        world: state.currentWorld,
        x: state.x,
        y: state.y,
        avatar: {
          ...state.avatar
        },
        online: true,
        updatedAt: Date.now(),
        ...extra
      }
    );
  } catch (error) {
    console.warn(
      "updateMyPlayer:",
      error
    );
  }
}

async function syncPlayer() {
  await updateMyPlayer();
}

function listenWorld() {
  if (
    !state.firebase.ready ||
    !state.firebase.db
  ) {
    return;
  }

  if (
    state.firebase.worldUnsubscribe
  ) {
    state.firebase.worldUnsubscribe();
    state.firebase.worldUnsubscribe =
      null;
  }

  getFirebaseModules()
    .then(
      ({
        ref,
        onValue
      }) => {
        const playersRef =
          ref(
            state.firebase.db,
            `worlds/${state.currentWorld}/players`
          );

        state.firebase.worldUnsubscribe =
          onValue(
            playersRef,
            (snapshot) => {
              const value =
                snapshot.val() ||
                {};

              state.players =
                Object.entries(
                  value
                ).map(
                  ([uid, player]) => ({
                    uid,
                    ...(player || {})
                  })
                )
                .reduce(
                  (
                    result,
                    player
                  ) => {
                    result[
                      player.uid
                    ] = player;

                    return result;
                  },
                  {}
                );

              renderFriends();
            }
          );
      }
    )
    .catch((error) => {
      console.warn(
        "listenWorld:",
        error
      );
    });
}

function listenChat() {
  if (
    !state.firebase.ready ||
    !state.firebase.db
  ) {
    return;
  }

  if (
    state.firebase.chatUnsubscribe
  ) {
    state.firebase.chatUnsubscribe();
    state.firebase.chatUnsubscribe =
      null;
  }

  getFirebaseModules()
    .then(
      ({
        ref,
        onValue,
        query,
        limitToLast
      }) => {
        const chatRef =
          ref(
            state.firebase.db,
            `worlds/${state.currentWorld}/chat`
          );

        const limited =
          query(
            chatRef,
            limitToLast(30)
          );

        state.firebase.chatUnsubscribe =
          onValue(
            limited,
            (snapshot) => {
              const value =
                snapshot.val() ||
                {};

              const messages =
                Object.values(
                  value
                ).sort(
                  (a, b) =>
                    (a.at || 0) -
                    (b.at || 0)
                );

              const containers = [
                byId("chatMessages"),
                byId("chatList"),
                byId("messages")
              ].filter(Boolean);

              containers.forEach(
                (container) => {
                  container.innerHTML =
                    "";

                  messages.forEach(
                    (message) => {
                      renderChatMessage(
                        message
                      );
                    }
                  );
                }
              );
            }
          );
      }
    )
    .catch((error) => {
      console.warn(
        "listenChat:",
        error
      );
    });
}

/* =========================================================
   UI
   ========================================================= */

function bindUI() {
  byId("playBtn")?.addEventListener(
    "click",
    () => {
      hideBoot();
      toast("Welcome to MAIWORLD ♡");
    }
  );

  byId("customizeBtn")?.addEventListener(
    "click",
    () =>
      openModal(
        "profileModal"
      )
  );

  byId("profileBtn")?.addEventListener(
    "click",
    () =>
      openModal(
        "profileModal"
      )
  );

  byId("profileGameBtn")?.addEventListener(
    "click",
    () =>
      openModal(
        "profileModal"
      )
  );

  byId("worldBtn")?.addEventListener(
    "click",
    () => {
      renderWorldList();
      openModal(
        "worldModal"
      );
    }
  );

  byId("friendsBtn")?.addEventListener(
    "click",
    () => {
      renderFriends();
      openModal(
        "friendsModal"
      );
    }
  );

  byId("musicBtn")?.addEventListener(
    "click",
    toggleMusic
  );
}

function bindExtraUI() {
  setupModalButtons();
  setupProfileActions();
  setupChat();

  $$("[data-open-modal]").forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          openModal(
            button.dataset
              .openModal
          );
        }
      );
    }
  );

  $$("[data-world]").forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          changeWorld(
            button.dataset.world
          );
        }
      );
    }
  );
}

/* =========================================================
   COUNTERS / HUD
   ========================================================= */

function updateHUD() {
  const world =
    getCurrentWorld();

  const worldName =
    byId("currentWorld") ||
    byId("worldName");

  if (worldName) {
    worldName.textContent =
      `${world.emoji || "🌸"} ${
        world.name ||
        world.id
      }`;
  }

  const online =
    Object.values(
      state.players
    ).filter(
      (player) =>
        player &&
        player.world ===
          state.currentWorld
    ).length;

  const onlineElements = [
    byId("onlineCount"),
    byId("playerCount"),
    byId("onlinePlayers")
  ].filter(Boolean);

  onlineElements.forEach(
    (element) => {
      element.textContent =
        String(
          Math.max(
            online,
            state.uid ? 1 : 0
          )
        );
    }
  );
}

/* =========================================================
   GAME LOOP
   ========================================================= */

let lastFrame = performance.now();

function loop(now = performance.now()) {
  const delta =
    now - lastFrame;

  lastFrame = now;

  updateMovement(delta);
  drawScene();
  updateHUD();

  requestAnimationFrame(
    loop
  );
}

/* =========================================================
   STARTUP
   ========================================================= */

async function init() {
  if (state.initialized)
    return;

  state.initialized =
    true;

  try {
    loadSavedAvatar();

    setupCanvas();
    setupMovement();
    setupCanvasInteraction();

    await loadGameData();

    bindUI();
    bindExtraUI();

    setupMusic();

    renderWorld();
    renderEmotes();
    renderWorldList();
    renderProfile();
    renderFriends();

    injectAnimations();

    hideBoot();

    requestAnimationFrame(
      loop
    );

    /* Firebase should NEVER block the game */
    setupFirebase();

    console.log(
      "♡ MAIWORLD berhasil dimuat"
    );
  } catch (error) {
    console.error(
      "MAIWORLD error:",
      error
    );

    showBootError(
      error?.message ||
        "Terjadi kesalahan saat memuat game."
    );
  }
}

/* =========================================================
   EXTRA ANIMATIONS
   ========================================================= */

function injectAnimations() {
  if (
    byId("maiworldAnimations")
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "maiworldAnimations";

  style.textContent = `
    @keyframes maiworldPop {
      0% {
        opacity:0;
        transform:
          translate(-50%,-50%)
          scale(.5);
      }

      30% {
        opacity:1;
        transform:
          translate(-50%,-65%)
          scale(1.15);
      }

      100% {
        opacity:0;
        transform:
          translate(-50%,-120%)
          scale(.9);
      }
    }

    @keyframes maiworldFloat {
      0% {
        opacity:0;
        transform:
          translate(-50%,-30%)
          scale(.7);
      }

      20% {
        opacity:1;
        transform:
          translate(-50%,-50%)
          scale(1.15);
      }

      100% {
        opacity:0;
        transform:
          translate(-50%,-170%)
          scale(1);
      }
    }

    .world-choice,
    .emote-button,
    .friend-card button {
      cursor:pointer;
    }

    #interactionBubble {
      transition:
        opacity .2s ease,
        transform .2s ease;
    }

    #interactionBubble:not(.show):not(.active) {
      opacity:0;
      pointer-events:none;
    }
  `;

  document.head.appendChild(
    style
  );
}

/* =========================================================
   PAGE VISIBILITY
   ========================================================= */

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.hidden
    ) {
      state.keys.clear();
      return;
    }

    syncPlayer();
  }
);

/* =========================================================
   START
   ========================================================= */

if (
  document.readyState ===
  "maiworlD berhasil dimuat"
) {
  document.addEventListener(
    "DOMContentLoaded",
    init,
    { once: true }
  );
} else {
  init();
}
