import { firebaseConfig, FIREBASE_READY } from "./firebase-config.js";

/* =========================================================
   MAIWORLD — FIXED SCRIPT
   - Safe JSON loading
   - Loading screen cannot stay forever
   - Firebase cannot block the game
   - Realtime multiplayer preserved
   - Local demo fallback preserved
   ========================================================= */

const CDN = "https://www.gstatic.com/firebasejs/12.2.1/";

const appPromise = FIREBASE_READY
  ? Promise.all([
      import(CDN + "firebase-app.js"),
      import(CDN + "firebase-auth.js"),
      import(CDN + "firebase-database.js")
    ]).then(([appMod, authMod, dbMod]) => ({
      ...appMod,
      ...authMod,
      ...dbMod
    }))
  : Promise.resolve(null);

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const uid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/* =========================================================
   STATE
   ========================================================= */

const state = {
  view: "home",
  world: "plaza",

  me: null,
  players: {},
  chat: [],
  keys: new Set(),

  config: {
    name: "Mai",
    skin: "peach",
    hair: "blonde",
    top: "teePink",
    bottom: "jeans",
    dress: "none",
    eyes: "sparkle",
    mouths: "smile",
    shoes: "sneakers",
    accessories: "none",
    bags: "none"
  },

  worlds: [],
  items: [],
  characters: null,
  emotes: [],

  firebase: null,
  audio: null,

  lastSend: 0,

  localDemo: true,
  firebaseStarting: false
};

/* =========================================================
   CANVAS
   ========================================================= */

const gameCanvas = $("#gameCanvas");

if (!gameCanvas) {
  console.error("MAIWORLD ERROR: #gameCanvas tidak ditemukan.");
}

let ctx = gameCanvas
  ? gameCanvas.getContext("2d")
  : null;

if (ctx) {
  ctx.imageSmoothingEnabled = false;
}

/* =========================================================
   HELPERS
   ========================================================= */

function safeBootHide() {
  const boot = $("#boot");

  if (boot) {
    boot.classList.add("hide");
  }
}

function showError(message) {
  console.error("MAIWORLD:", message);

  const boot = $("#boot");

  if (boot) {
    boot.classList.add("hide");
  }

  toast(message);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* =========================================================
   JSON LOADER
   ========================================================= */

async function loadJSON(path) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 8000);

  try {
    const response = await fetch(path, {
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(
        `${path} gagal dimuat — HTTP ${response.status}`
      );
    }

    const data = await response.json();

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`${path} terlalu lama dimuat.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   LOAD GAME DATA
   ========================================================= */

async function loadGameData() {
  const files = {
    worlds: "./data/world.json",
    items: "./data/items.json",
    characters: "./data/characters.json",
    emotes: "./data/emotes.json"
  };

  const results = await Promise.allSettled([
    loadJSON(files.worlds),
    loadJSON(files.items),
    loadJSON(files.characters),
    loadJSON(files.emotes)
  ]);

  const [worlds, items, characters, emotes] = results;

  if (worlds.status === "fulfilled") {
    state.worlds = worlds.value;
  } else {
    console.error("world.json:", worlds.reason);
    state.worlds = [];
  }

  if (items.status === "fulfilled") {
    state.items = items.value;
  } else {
    console.error("items.json:", items.reason);
    state.items = [];
  }

  if (characters.status === "fulfilled") {
    state.characters = characters.value;
  } else {
    console.error("characters.json:", characters.reason);
    state.characters = {
      skins: [],
      hair: [],
      eyes: [],
      mouths: [],
      tops: [],
      bottoms: [],
      dresses: [],
      shoes: [],
      accessories: [],
      bags: []
    };
  }

  if (emotes.status === "fulfilled") {
    state.emotes = emotes.value;
  } else {
    console.error("emotes.json:", emotes.reason);
    state.emotes = [];
  }

  const failed = results.filter(
    (result) => result.status === "rejected"
  );

  if (failed.length) {
    console.warn(
      `${failed.length} data file gagal dimuat. MAIWORLD tetap dilanjutkan.`
    );
  }
}

/* =========================================================
   INIT
   ========================================================= */

async function init() {
  console.log("🌸 MAIWORLD starting...");

  /* -----------------------------------------
     1. Load JSON
     ----------------------------------------- */

  try {
    await loadGameData();
  } catch (error) {
    console.error("Data loading error:", error);
  }

  /* -----------------------------------------
     2. Load saved profile
     ----------------------------------------- */

  try {
    const saved = localStorage.getItem("maiworld-profile");

    if (saved) {
      Object.assign(
        state.config,
        JSON.parse(saved)
      );
    }
  } catch (error) {
    console.warn(
      "Saved profile tidak bisa dibaca:",
      error
    );
  }

  /* -----------------------------------------
     3. Render UI
     ----------------------------------------- */

  try {
    populateEditor();
    renderProfileEverywhere();
    renderWorldChoices();
    renderEmotes();
    renderWorld();
    drawHero();
    bindUI();
  } catch (error) {
    console.error(
      "UI initialization error:",
      error
    );
  }

  /* -----------------------------------------
     4. HIDE LOADING SCREEN
     
     IMPORTANT:
     Loading screen is hidden BEFORE Firebase.
     Firebase can NEVER block the UI.
     ----------------------------------------- */

  setTimeout(() => {
    safeBootHide();
  }, 300);

  /* -----------------------------------------
     5. Create local player immediately
     
     This makes the game usable even while
     Firebase is connecting.
     ----------------------------------------- */

  if (!state.me) {
    createLocalPlayer();
  }

  setConnection(
    FIREBASE_READY
      ? "Connecting..."
      : "Local demo"
  );

  /* -----------------------------------------
     6. Start Firebase WITHOUT blocking UI
     ----------------------------------------- */

  if (FIREBASE_READY) {
    setupFirebase()
      .then(() => {
        console.log("🌐 Firebase connected.");
      })
      .catch((error) => {
        console.warn(
          "Firebase startup failed:",
          error
        );

        if (state.localDemo) {
          setConnection("Local demo");
        }
      });
  }

  /* -----------------------------------------
     7. Start game loop
     ----------------------------------------- */

  requestAnimationFrame(loop);

  console.log("✨ MAIWORLD ready.");
}

/* =========================================================
   UI
   ========================================================= */

function bindUI() {
  const playBtn = $("#playBtn");
  const customizeBtn = $("#customizeBtn");
  const profileBtn = $("#profileBtn");
  const profileGameBtn = $("#profileGameBtn");
  const worldBtn = $("#worldBtn");
  const friendsBtn = $("#friendsBtn");
  const closeSide = $("#closeSide");
  const editNameBtn = $("#editNameBtn");
  const saveProfileBtn = $("#saveProfile");
  const chatForm = $("#chatForm");
  const musicBtn = $("#musicBtn");
  const mobileInteract = $("#mobileInteract");
  const brandBtn = $("#brandBtn");

  if (playBtn) {
    playBtn.onclick = () => enterGame();
  }

  if (customizeBtn) {
    customizeBtn.onclick = () =>
      openModal("profileModal");
  }

  if (profileBtn) {
    profileBtn.onclick = () =>
      openModal("profileModal");
  }

  if (profileGameBtn) {
    profileGameBtn.onclick = () =>
      openModal("profileModal");
  }

  if (worldBtn) {
    worldBtn.onclick = () =>
      openModal("worldModal");
  }

  if (friendsBtn) {
    friendsBtn.onclick = () => {
      renderFriendsModal();
      openModal("friendsModal");
    };
  }

  if (closeSide) {
    closeSide.onclick = () => {
      const layout = $(".game-layout");

      if (layout) {
        layout.classList.remove("chat-open");
      }
    };
  }

  if (editNameBtn) {
    editNameBtn.onclick = () =>
      openModal("profileModal");
  }

  if (saveProfileBtn) {
    saveProfileBtn.onclick = saveProfile;
  }

  if (chatForm) {
    chatForm.onsubmit = (e) => {
      e.preventDefault();

      const input = $("#chatInput");

      if (!input) return;

      sendChat(input.value);

      input.value = "";
    };
  }

  if (musicBtn) {
    musicBtn.onclick = toggleMusic;
  }

  if (mobileInteract) {
    mobileInteract.onclick = interact;
  }

  $$(".mobile-controls [data-key]").forEach(
    (button) => {
      button.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          state.keys.add(button.dataset.key);
        },
        { passive: false }
      );

      button.addEventListener(
        "touchend",
        (e) => {
          e.preventDefault();
          state.keys.delete(button.dataset.key);
        },
        { passive: false }
      );
    }
  );

  addEventListener("keydown", (e) => {
    const allowed = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      " ",
      "w",
      "a",
      "s",
      "d",
      "e"
    ];

    if (!allowed.includes(e.key)) return;

    state.keys.add(e.key);

    if (e.key.toLowerCase() === "e") {
      interact();
    }
  });

  addEventListener("keyup", (e) => {
    state.keys.delete(e.key);
  });

  $$(".modal-x").forEach((button) => {
    button.onclick = () =>
      closeModal(button.dataset.close);
  });

  if (brandBtn) {
    brandBtn.onclick = () =>
      showView("home");
  }

  [
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
  ].forEach((id) => {
    const element = $("#" + id);

    if (element) {
      element.addEventListener(
        "input",
        previewEditor
      );
    }
  });
}

/* =========================================================
   VIEWS
   ========================================================= */

function showView(view) {
  state.view = view;

  $$(".view").forEach((element) =>
    element.classList.remove("active")
  );

  const target = $("#" + view + "View");

  if (target) {
    target.classList.add("active");
  }
}

function enterGame() {
  showView("game");

  if (!state.me) {
    createLocalPlayer();
  }

  const layout = $(".game-layout");

  if (layout) {
    layout.classList.add("chat-open");

    setTimeout(() => {
      layout.classList.remove("chat-open");
    }, 700);
  }
}

/* =========================================================
   PLAYER
   ========================================================= */

function createLocalPlayer() {
  const player = {
    uid: "local-" + uid().slice(0, 8),

    ...state.config,

    x: 480,
    y: 360,

    direction: "down",
    animation: "idle",

    online: true,
    lastSeen: Date.now()
  };

  state.me = player;

  state.players[player.uid] = player;

  updateCounts();
  renderPlayers();
}

function populateEditor() {
  if (!state.characters) return;

  const fill = (id, key) => {
    const list = state.characters[key] || [];
    const element = $("#" + id);

    if (!element) return;

    element.innerHTML = list
      .map(
        (item) =>
          `<option value="${item.id}">${item.name}</option>`
      )
      .join("");

    const prop = id.replace("Select", "");

    element.value =
      state.config[prop] ||
      list[0]?.id ||
      "";
  };

  fill("skinSelect", "skins");
  fill("hairSelect", "hair");
  fill("eyesSelect", "eyes");
  fill("mouthsSelect", "mouths");

  fill("topSelect", "tops");
  fill("bottomSelect", "bottoms");
  fill("dressSelect", "dresses");
  fill("shoesSelect", "shoes");

  fill("accessoriesSelect", "accessories");
  fill("bagsSelect", "bags");

  const nameInput = $("#nameInput");

  if (nameInput) {
    nameInput.value = state.config.name;
  }
}

function previewEditor() {
  const profileAvatar = $("#profileAvatar");

  if (!profileAvatar) return;

  const config = readEditor();

  drawAvatar(
    profileAvatar,
    config,
    3
  );
}

function readEditor() {
  const getValue = (id, fallback = "") => {
    const element = $("#" + id);

    return element
      ? element.value
      : fallback;
  };

  return {
    name:
      getValue(
        "nameInput",
        state.config.name
      ).trim() || "Mai",

    skin: getValue(
      "skinSelect",
      state.config.skin
    ),

    hair: getValue(
      "hairSelect",
      state.config.hair
    ),

    eyes: getValue(
      "eyesSelect",
      state.config.eyes
    ),

    mouths: getValue(
      "mouthsSelect",
      state.config.mouths
    ),

    top: getValue(
      "topSelect",
      state.config.top
    ),

    bottom: getValue(
      "bottomSelect",
      state.config.bottom
    ),

    dress: getValue(
      "dressSelect",
      state.config.dress
    ),

    shoes: getValue(
      "shoesSelect",
      state.config.shoes
    ),

    accessories: getValue(
      "accessoriesSelect",
      state.config.accessories
    ),

    bags: getValue(
      "bagsSelect",
      state.config.bags
    )
  };
}

function saveProfile() {
  Object.assign(
    state.config,
    readEditor()
  );

  try {
    localStorage.setItem(
      "maiworld-profile",
      JSON.stringify(state.config)
    );
  } catch (error) {
    console.warn(
      "Profile tidak bisa disimpan:",
      error
    );
  }

  if (state.me) {
    Object.assign(
      state.me,
      state.config
    );

    state.players[state.me.uid] =
      state.me;

    writePlayer();
  }

  renderProfileEverywhere();

  closeModal("profileModal");

  toast(
    "Your new look is ready ✨"
  );
}

function renderProfileEverywhere() {
  const sideName = $("#sideName");

  if (sideName) {
    sideName.textContent =
      state.config.name;
  }

  const miniAvatar = $("#miniAvatar");
  const sideAvatar = $("#sideAvatar");
  const profileAvatar = $("#profileAvatar");

  if (miniAvatar) {
    drawAvatar(
      miniAvatar,
      state.config,
      0.9
    );
  }

  if (sideAvatar) {
    drawAvatar(
      sideAvatar,
      state.config,
      1.45
    );
  }

  if (profileAvatar) {
    drawAvatar(
      profileAvatar,
      state.config,
      3
    );
  }
}

/* =========================================================
   WORLDS
   ========================================================= */

function renderWorldChoices() {
  const container = $("#worldChoices");

  if (!container) return;

  container.innerHTML = state.worlds
    .map(
      (world) => `
        <button
          class="world-choice"
          data-world="${escapeHTML(world.id)}"
        >
          <span class="emoji">${world.emoji}</span>
          <strong>${escapeHTML(world.name)}</strong>
          <small>${escapeHTML(world.description)}</small>
        </button>
      `
    )
    .join("");

  $$(".world-choice").forEach(
    (button) => {
      button.onclick = () => {
        changeWorld(button.dataset.world);
        closeModal("worldModal");
      };
    }
  );
}

function changeWorld(id) {
  const world = state.worlds.find(
    (item) => item.id === id
  );

  if (!world) return;

  state.world = id;

  if (state.me) {
    state.me.x =
      world.spawn?.[0] ?? 480;

    state.me.y =
      world.spawn?.[1] ?? 360;

    writePlayer();
  }

  const worldName = $("#worldName");
  const worldTitle = $("#worldTitle");
  const locationChip = $("#locationChip");

  if (worldName) {
    worldName.textContent =
      world.name
        .split(" ")
        .slice(-1)[0];
  }

  if (worldTitle) {
    worldTitle.textContent =
      world.name;
  }

  if (locationChip) {
    locationChip.textContent =
      world.name;
  }

  renderWorld();

  toast(
    `Welcome to ${world.name} ${world.emoji}`
  );

  /*
    Re-subscribe to Firebase after changing world.
  */
  if (!state.localDemo && state.firebase) {
    listenWorld();
  }
}

function renderWorld() {
  drawWorld();
}

function worldTheme(id) {
  return (
    {
      plaza: [
        "#ffd5e5",
        "#f2dfff",
        "#d5b5e8"
      ],

      park: [
        "#d9f5d6",
        "#c9ebff",
        "#b7d99e"
      ],

      school: [
        "#d7ecff",
        "#eadcff",
        "#b9cdea"
      ],

      cafe: [
        "#ffe8c5",
        "#f5d7e8",
        "#d9b8a0"
      ],

      studio: [
        "#eadcff",
        "#f8d6eb",
        "#c6a8db"
      ],

      beach: [
        "#ffe3d4",
        "#ffd0e5",
        "#f0b88d"
      ]
    }[id] || [
      "#ffd5e5",
      "#f2dfff",
      "#d5b5e8"
    ]
  );
}

/* =========================================================
   WORLD DRAWING
   ========================================================= */

function drawWorld() {
  if (!ctx) return;

  const W = 960;
  const H = 600;

  const gradient =
    ctx.createLinearGradient(
      0,
      0,
      0,
      H
    );

  const theme =
    worldTheme(state.world);

  gradient.addColorStop(
    0,
    theme[0]
  );

  gradient.addColorStop(
    0.58,
    theme[1]
  );

  gradient.addColorStop(
    1,
    theme[2]
  );

  ctx.fillStyle = gradient;

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  ctx.fillStyle =
    "rgba(255,255,255,.45)";

  for (let i = 0; i < 18; i++) {
    const x =
      (i * 97 + 37) % W;

    const y =
      (i * 61 + 40) % 220;

    ctx.fillRect(
      x,
      y,
      2,
      2
    );

    ctx.fillRect(
      x + 5,
      y + 4,
      1,
      1
    );
  }

  drawGround();

  const id = state.world;

  if (id === "park") {
    drawPark();
  } else if (id === "school") {
    drawSchool();
  } else if (id === "cafe") {
    drawCafe();
  } else if (id === "studio") {
    drawStudio();
  } else if (id === "beach") {
    drawBeach();
  } else {
    drawPlaza();
  }

  drawItems();

  Object.values(
    state.players
  ).forEach((player) => {
    if (
      player &&
      Number.isFinite(player.x) &&
      Number.isFinite(player.y)
    ) {
      drawPlayer(player);
    }
  });
}

function drawGround() {
  if (!ctx) return;

  ctx.fillStyle =
    "rgba(255,255,255,.38)";

  ctx.fillRect(
    0,
    250,
    960,
    350
  );

  ctx.fillStyle =
    "rgba(164,121,151,.11)";

  for (
    let x = 0;
    x < 960;
    x += 48
  ) {
    for (
      let y = 250;
      y < 600;
      y += 48
    ) {
      ctx.fillRect(
        x,
        y,
        44,
        44
      );
    }
  }
}

function box(
  x,
  y,
  w,
  h,
  color,
  radius = 8
) {
  if (!ctx) return;

  ctx.fillStyle = color;

  ctx.fillRect(
    x,
    y,
    w,
    h
  );

  if (radius) {
    ctx.fillStyle =
      "rgba(255,255,255,.18)";

    ctx.fillRect(
      x,
      y,
      w,
      3
    );
  }
}

function tree(x, y) {
  if (!ctx) return;

  ctx.fillStyle = "#8b5c59";
  ctx.fillRect(
    x + 19,
    y + 38,
    10,
    42
  );

  ctx.fillStyle = "#8fd2a1";
  ctx.fillRect(
    x + 5,
    y + 10,
    38,
    38
  );

  ctx.fillStyle = "#aee4b8";
  ctx.fillRect(
    x + 12,
    y,
    24,
    40
  );

  ctx.fillStyle = "#6fbc91";
  ctx.fillRect(
    x,
    y + 25,
    48,
    18
  );
}

function drawPark() {
  if (!ctx) return;

  for (
    let x = 70;
    x < 900;
    x += 150
  ) {
    tree(
      x,
      205 + (x % 70)
    );
  }

  box(
    360,
    400,
    240,
    62,
    "#c79a77",
    12
  );

  box(
    380,
    382,
    200,
    20,
    "#e9c7a9",
    8
  );

  ctx.fillStyle =
    "#86cde0";

  ctx.beginPath();

  ctx.ellipse(
    760,
    410,
    90,
    45,
    0,
    0,
    Math.PI * 2
  );

  ctx.fill();

  for (
    let x = 100;
    x < 850;
    x += 85
  ) {
    ctx.fillStyle =
      "#ff9fbe";

    ctx.fillRect(
      x,
      315 + (x % 30),
      6,
      6
    );

    ctx.fillStyle =
      "#ffe2a4";

    ctx.fillRect(
      x + 6,
      309 + (x % 30),
      5,
      5
    );
  }
}

function drawSchool() {
  if (!ctx) return;

  box(
    300,
    150,
    360,
    180,
    "#fff7fb",
    18
  );

  box(
    325,
    175,
    310,
    35,
    "#ff9fc5",
    8
  );

  box(
    355,
    235,
    70,
    95,
    "#b99ee4",
    8
  );

  box(
    445,
    235,
    70,
    95,
    "#b99ee4",
    8
  );

  box(
    535,
    235,
    70,
    95,
    "#b99ee4",
    8
  );

  ctx.fillStyle =
    "#ffd6e7";

  ctx.fillRect(
    455,
    115,
    50,
    35
  );

  ctx.fillStyle =
    "#fff";

  ctx.font =
    "16px 'Press Start 2P'";

  ctx.fillText(
    "MOCHI",
    430,
    140
  );
}

function drawCafe() {
  if (!ctx) return;

  box(
    300,
    175,
    360,
    165,
    "#fff8ef",
    18
  );

  box(
    335,
    210,
    110,
    55,
    "#dca4c5",
    10
  );

  box(
    515,
    210,
    110,
    55,
    "#dca4c5",
    10
  );

  for (
    let x = 120;
    x < 820;
    x += 170
  ) {
    box(
      x,
      400,
      110,
      35,
      "#d49bb5",
      10
    );

    box(
      x + 10,
      370,
      90,
      35,
      "#fff2d9",
      10
    );
  }
}

function drawStudio() {
  if (!ctx) return;

  box(
    270,
    145,
    420,
    200,
    "#fff5fb",
    18
  );

  box(
    350,
    205,
    260,
    20,
    "#d6b7e9",
    8
  );

  box(
    370,
    225,
    30,
    90,
    "#b18bd0",
    5
  );

  box(
    560,
    225,
    30,
    90,
    "#b18bd0",
    5
  );

  const colors = [
    "#ff9fc5",
    "#b9a1e9",
    "#ffd59c",
    "#9edfc2"
  ];

  for (let i = 0; i < 8; i++) {
    ctx.fillStyle =
      colors[i % colors.length];

    ctx.fillRect(
      300 + (i % 4) * 95,
      165 + Math.floor(i / 4) * 65,
      55,
      42
    );
  }
}

function drawBeach() {
  if (!ctx) return;

  ctx.fillStyle =
    "#f9b6cf";

  ctx.fillRect(
    0,
    390,
    960,
    210
  );

  ctx.fillStyle =
    "#f8df9d";

  ctx.fillRect(
    0,
    330,
    960,
    60
  );

  ctx.fillStyle =
    "#ffd7e8";

  ctx.beginPath();

  ctx.arc(
    820,
    90,
    55,
    0,
    Math.PI * 2
  );

  ctx.fill();

  for (
    let x = 100;
    x < 900;
    x += 180
  ) {
    ctx.fillText(
      "☁",
      x,
      300
    );
  }
}

function drawPlaza() {
  if (!ctx) return;

  ctx.fillStyle =
    "#d8b9ef";

  ctx.beginPath();

  ctx.arc(
    480,
    390,
    110,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.fillStyle =
    "#fff";

  ctx.fillRect(
    445,
    335,
    70,
    8
  );

  ctx.fillStyle =
    "#ff9fc5";

  ctx.fillRect(
    465,
    320,
    30,
    15
  );

  tree(
    110,
    210
  );

  tree(
    790,
    210
  );

  box(
    370,
    160,
    220,
    70,
    "#fff7fb",
    16
  );

  ctx.fillStyle =
    "#ff8fb9";

  ctx.font =
    "16px 'Press Start 2P'";

  ctx.fillText(
    "MAI",
    454,
    205
  );
}

function drawItems() {
  if (!ctx) return;

  const spots =
    {
      plaza: [
        {
          x: 200,
          y: 390,
          id: "swing"
        },
        {
          x: 710,
          y: 380,
          id: "swing"
        }
      ],

      park: [
        {
          x: 420,
          y: 400,
          id: "bench"
        },
        {
          x: 780,
          y: 410,
          id: "flower"
        }
      ],

      school: [
        {
          x: 250,
          y: 350,
          id: "locker"
        },
        {
          x: 680,
          y: 350,
          id: "bell"
        }
      ],

      cafe: [
        {
          x: 420,
          y: 400,
          id: "coffee"
        },
        {
          x: 600,
          y: 400,
          id: "jukebox"
        }
      ],

      studio: [
        {
          x: 210,
          y: 360,
          id: "easel"
        },
        {
          x: 730,
          y: 360,
          id: "gallery"
        }
      ],

      beach: [
        {
          x: 250,
          y: 450,
          id: "shell"
        }
      ]
    }[state.world] || [];

  spots.forEach((spot) => {
    ctx.fillStyle =
      "#fff";

    ctx.fillRect(
      spot.x - 12,
      spot.y - 12,
      24,
      24
    );

    ctx.fillStyle =
      "#ff9fbe";

    ctx.fillRect(
      spot.x - 6,
      spot.y - 6,
      12,
      12
    );

    ctx.fillStyle =
      "#8b7180";

    ctx.font =
      "10px 'Baloo 2'";

    ctx.fillText(
      "E",
      spot.x - 4,
      spot.y + 29
    );
  });
}

/* =========================================================
   PLAYER DRAWING
   ========================================================= */

function drawPlayer(player) {
  if (!ctx || !player) return;

  const x =
    Math.round(
      Number(player.x) || 480
    );

  const y =
    Math.round(
      Number(player.y) || 360
    );

  ctx.save();

  ctx.translate(
    x,
    y
  );

  ctx.fillStyle =
    "rgba(85,55,75,.15)";

  ctx.fillRect(
    -16,
    18,
    32,
    7
  );

  drawAvatar(
    ctx,
    player,
    1.35,
    true
  );

  ctx.restore();

  ctx.fillStyle =
    "#fff";

  ctx.strokeStyle =
    "rgba(100,70,90,.12)";

  ctx.lineWidth = 1;

  const name =
    String(
      player.name || "Mai"
    );

  const width =
    Math.max(
      42,
      name.length * 6 + 18
    );

  ctx.fillRect(
    x - width / 2,
    y - 65,
    width,
    20
  );

  ctx.strokeRect(
    x - width / 2,
    y - 65,
    width,
    20
  );

  ctx.fillStyle =
    "#5a4654";

  ctx.font =
    "bold 11px 'Baloo 2'";

  ctx.textAlign =
    "center";

  ctx.fillText(
    name,
    x,
    y - 51
  );

  ctx.textAlign =
    "left";
}

function drawAvatar(
  target,
  player,
  scale = 1,
  centered = false
) {
  if (!target || !player) return;

  const isCanvas =
    target instanceof HTMLCanvasElement;

  const canvasContext =
    isCanvas
      ? target.getContext("2d")
      : target;

  if (!canvasContext) return;

  const W =
    isCanvas
      ? target.width
      : 96;

  const H =
    isCanvas
      ? target.height
      : 96;

  const c =
    canvasContext;

  c.clearRect(
    0,
    0,
    W,
    H
  );

  c.imageSmoothingEnabled =
    false;

  c.save();

  if (centered) {
    c.translate(
      0,
      0
    );
  } else {
    c.translate(
      W / 2,
      H / 2
    );
  }

  const s =
    scale * 10;

  const skinColors = {
    peach: "#f5b99d",
    cream: "#f8d0b7",
    honey: "#d9946f",
    mocha: "#9f6758"
  };

  const skin =
    skinColors[player.skin] ||
    "#f5b99d";

  /* shadow */

  c.fillStyle =
    "#6e5962";

  c.fillRect(
    (-7 * s) / 2,
    (11 * s) / 3,
    7 * s,
    (2 * s) / 3
  );

  /* legs */

  const bottom =
    player.dress !== "none"
      ? player.dress
      : {
          jeans: "#6f9ac8",
          skirt: "#f18db1",
          shorts: "#f2cfa8",
          wide: "#8c7cb8",
          cargo: "#a5b18d",
          pleated: "#f0a8c7"
        }[player.bottom] ||
        "#6f9ac8";

  c.fillStyle =
    bottom;

  c.fillRect(
    -2.5 * s,
    5 * s,
    2 * s,
    6 * s
  );

  c.fillRect(
    0.5 * s,
    5 * s,
    2 * s,
    6 * s
  );

  /* shoes */

  const shoes = {
    sneakers: "#ff9fc5",
    mary: "#7e6c9c",
    boots: "#c69ae2",
    sandals: "#f0c37f",
    loafers: "#8d6d7d",
    platform: "#d77fa8"
  };

  c.fillStyle =
    shoes[player.shoes] ||
    "#ff9fc5";

  c.fillRect(
    -3 * s,
    10 * s,
    3 * s,
    1.7 * s
  );

  c.fillRect(
    0,
    10 * s,
    3 * s,
    1.7 * s
  );

  /* outfit */

  const dressColors = {
    strawberry: "#ff94b9",
    lavender: "#b69be9",
    cloud: "#b9dff2"
  };

  const dress =
    dressColors[player.dress];

  const topColors = {
    teePink: "#ff9fc5",
    teeLilac: "#b7a0e8",
    hoodie: "#d5b7e6",
    cardi: "#f2b7a6"
  };

  c.fillStyle =
    dress ||
    topColors[player.top] ||
    "#ff9fc5";

  if (dress) {
    c.fillRect(
      -5 * s,
      0,
      10 * s,
      7 * s
    );
  } else {
    c.fillRect(
      -5 * s,
      0,
      10 * s,
      6 * s
    );

    c.fillRect(
      -7 * s,
      1 * s,
      2 * s,
      4 * s
    );

    c.fillRect(
      5 * s,
      1 * s,
      2 * s,
      4 * s
    );
  }

  /* head */

  c.fillStyle =
    skin;

  c.fillRect(
    -5 * s,
    -9 * s,
    10 * s,
    10 * s
  );

  c.fillRect(
    -4 * s,
    -10 * s,
    8 * s,
    12 * s
  );

  /* hair */

  const hairColors = {
    blonde: "#f2c477",
    brown: "#80534b",
    black: "#3e3543",
    pink: "#e99dc5"
  };

  c.fillStyle =
    hairColors[player.hair] ||
    "#f2c477";

  c.fillRect(
    -6 * s,
    -11 * s,
    12 * s,
    5 * s
  );

  c.fillRect(
    -6 * s,
    -7 * s,
    3 * s,
    9 * s
  );

  c.fillRect(
    3 * s,
    -7 * s,
    3 * s,
    9 * s
  );

  c.fillRect(
    -4 * s,
    -12 * s,
    8 * s,
    3 * s
  );

  /* eyes */

  c.fillStyle =
    "#4b3945";

  const eye =
    player.eyes ||
    "sparkle";

  if (eye === "sleepy") {
    c.fillRect(
      -3 * s,
      -4 * s,
      2 * s,
      1 * s
    );

    c.fillRect(
      1 * s,
      -4 * s,
      2 * s,
      1 * s
    );
  } else if (eye === "heart") {
    c.fillStyle =
      "#e8789f";

    c.fillRect(
      -3 * s,
      -5 * s,
      2 * s,
      2 * s
    );

    c.fillRect(
      1 * s,
      -5 * s,
      2 * s,
      2 * s
    );
  } else if (eye === "wink") {
    c.fillRect(
      -3 * s,
      -4 * s,
      2 * s,
      1 * s
    );

    c.fillRect(
      1 * s,
      -5 * s,
      2 * s,
      2 * s
    );
  } else {
    c.fillRect(
      -3 * s,
      -5 * s,
      1.5 * s,
      2 * s
    );

    c.fillRect(
      1.5 * s,
      -5 * s,
      1.5 * s,
      2 * s
    );

    c.fillStyle =
      "#fff";

    c.fillRect(
      -2.7 * s,
      -5 * s,
      0.7 * s,
      0.7 * s
    );

    c.fillRect(
      1.8 * s,
      -5 * s,
      0.7 * s,
      0.7 * s
    );
  }

  /* blush */

  c.fillStyle =
    "#ef8ca4";

  c.fillRect(
    -4 * s,
    -2 * s,
    2 * s,
    1 * s
  );

  c.fillRect(
    2 * s,
    -2 * s,
    2 * s,
    1 * s
  );

  /* mouth */

  c.fillStyle =
    "#8c5669";

  const mouth =
    player.mouths ||
    "smile";

  if (mouth === "open") {
    c.fillRect(
      -1.5 * s,
      -1 * s,
      3 * s,
      2 * s
    );
  } else if (mouth === "cat") {
    c.fillRect(
      -2 * s,
      -1 * s,
      1 * s,
      1 * s
    );

    c.fillRect(
      1 * s,
      -1 * s,
      1 * s,
      1 * s
    );

    c.fillRect(
      -1 * s,
      0,
      2 * s,
      1 * s
    );
  } else if (mouth === "pout") {
    c.fillRect(
      -2 * s,
      0,
      4 * s,
      1 * s
    );
  } else {
    c.fillRect(
      -1 * s,
      -1 * s,
      2 * s,
      1 * s
    );
  }

  /* accessories */

  const accessory =
    player.accessories ||
    "none";

  if (accessory === "bear") {
    c.fillStyle =
      "#c99472";

    c.fillRect(
      -7 * s,
      -10 * s,
      3 * s,
      3 * s
    );

    c.fillRect(
      4 * s,
      -10 * s,
      3 * s,
      3 * s
    );
  }

  if (accessory === "cat") {
    c.fillStyle =
      "#c78ab1";

    c.fillRect(
      -7 * s,
      -11 * s,
      3 * s,
      4 * s
    );

    c.fillRect(
      4 * s,
      -11 * s,
      3 * s,
      4 * s
    );
  }

  if (accessory === "bow") {
    c.fillStyle =
      "#ff7fab";

    c.fillRect(
      -8 * s,
      -5 * s,
      3 * s,
      3 * s
    );

    c.fillRect(
      5 * s,
      -5 * s,
      3 * s,
      3 * s
    );

    c.fillRect(
      -1 * s,
      -4 * s,
      2 * s,
      2 * s
    );
  }

  if (accessory === "flower") {
    c.fillStyle =
      "#ffd66f";

    c.fillRect(
      5 * s,
      -8 * s,
      2 * s,
      2 * s
    );

    c.fillStyle =
      "#ff9fc5";

    c.fillRect(
      6 * s,
      -9 * s,
      2 * s,
      2 * s
    );
  }

  if (accessory === "crown") {
    c.fillStyle =
      "#ffd66f";

    c.fillRect(
      -4 * s,
      -14 * s,
      8 * s,
      3 * s
    );

    c.fillRect(
      -3 * s,
      -16 * s,
      2 * s,
      3 * s
    );

    c.fillRect(
      1 * s,
      -16 * s,
      2 * s,
      3 * s
    );
  }

  if (accessory === "glasses") {
    c.strokeStyle =
      "#7f6c7b";

    c.lineWidth =
      Math.max(
        1,
        s / 3
      );

    c.strokeRect(
      -4 * s,
      -6 * s,
      3 * s,
      3 * s
    );

    c.strokeRect(
      1 * s,
      -6 * s,
      3 * s,
      3 * s
    );

    c.beginPath();

    c.moveTo(
      -1 * s,
      -4.5 * s
    );

    c.lineTo(
      1 * s,
      -4.5 * s
    );

    c.stroke();
  }

  if (accessory === "headphones") {
    c.strokeStyle =
      "#9a7cc7";

    c.lineWidth =
      Math.max(
        1,
        s / 2
      );

    c.beginPath();

    c.arc(
      0,
      -4 * s,
      7 * s,
      Math.PI,
      0
    );

    c.stroke();

    c.fillStyle =
      "#9a7cc7";

    c.fillRect(
      -7 * s,
      -5 * s,
      2 * s,
      4 * s
    );

    c.fillRect(
      5 * s,
      -5 * s,
      2 * s,
      4 * s
    );
  }

  /* bag */

  const bag =
    player.bags ||
    "none";

  if (bag !== "none") {
    c.fillStyle =
      bag === "heartbag"
        ? "#ff91b8"
        : bag === "teddy"
        ? "#b98970"
        : bag === "backpack"
        ? "#8fb8df"
        : "#c8a9ee";

    c.fillRect(
      6 * s,
      2 * s,
      3 * s,
      5 * s
    );
  }

  c.restore();
}

/* =========================================================
   HERO
   ========================================================= */

function drawHero() {
  const heroCanvas =
    $("#heroCanvas");

  if (!heroCanvas) return;

  const hero =
    heroCanvas.getContext("2d");

  if (!hero) return;

  hero.imageSmoothingEnabled =
    false;

  hero.clearRect(
    0,
    0,
    620,
    520
  );

  hero.fillStyle =
    "#ffd7e7";

  hero.fillRect(
    0,
    390,
    620,
    130
  );

  hero.fillStyle =
    "#e4c8f6";

  hero.fillRect(
    0,
    360,
    620,
    30
  );

  for (
    let x = 40;
    x < 600;
    x += 85
  ) {
    hero.fillStyle =
      "#fff";

    hero.fillRect(
      x,
      340,
      55,
      35
    );

    hero.fillStyle =
      "#ff9fc5";

    hero.fillRect(
      x + 10,
      320,
      35,
      20
    );
  }

  hero.save();

  hero.translate(
    310,
    370
  );

  drawAvatar(
    hero,
    state.config,
    3,
    true
  );

  hero.restore();
}

/* =========================================================
   GAME LOOP
   ========================================================= */

function loop(time) {
  if (
    state.view === "game" &&
    state.me
  ) {
    let dx = 0;
    let dy = 0;

    if (
      state.keys.has("ArrowLeft") ||
      state.keys.has("a")
    ) {
      dx--;
    }

    if (
      state.keys.has("ArrowRight") ||
      state.keys.has("d")
    ) {
      dx++;
    }

    if (
      state.keys.has("ArrowUp") ||
      state.keys.has("w")
    ) {
      dy--;
    }

    if (
      state.keys.has("ArrowDown") ||
      state.keys.has("s")
    ) {
      dy++;
    }

    if (dx || dy) {
      const length =
        Math.hypot(dx, dy) || 1;

      state.me.x = clamp(
        state.me.x +
          (dx / length) * 2.5,
        35,
        925
      );

      state.me.y = clamp(
        state.me.y +
          (dy / length) * 2.5,
        285,
        565
      );

      state.me.direction =
        Math.abs(dx) >
        Math.abs(dy)
          ? dx > 0
            ? "right"
            : "left"
          : dy > 0
          ? "down"
          : "up";

      state.me.animation =
        "walk";

      if (
        time - state.lastSend >
        90
      ) {
        writePlayer();

        state.lastSend =
          time;
      }
    } else {
      state.me.animation =
        "idle";
    }

    if (ctx) {
      ctx.clearRect(
        0,
        0,
        960,
        600
      );

      drawWorld();
    }
  }

  requestAnimationFrame(loop);
}

/* =========================================================
   INTERACTIONS
   ========================================================= */

function nearestItem() {
  if (!state.me) return null;

  const list =
    {
      plaza: [
        [200, 390, "swing"],
        [710, 380, "swing"]
      ],

      park: [
        [420, 400, "bench"],
        [780, 410, "flower"]
      ],

      school: [
        [250, 350, "locker"],
        [680, 350, "bell"]
      ],

      cafe: [
        [420, 400, "coffee"],
        [600, 400, "jukebox"]
      ],

      studio: [
        [210, 360, "easel"],
        [730, 360, "gallery"]
      ],

      beach: [
        [250, 450, "shell"]
      ]
    }[state.world] || [];

  let best = null;
  let bestDistance = 70;

  for (
    const [x, y, id] of list
  ) {
    const distance =
      Math.hypot(
        state.me.x - x,
        state.me.y - y
      );

    if (
      distance < bestDistance
    ) {
      best = id;
      bestDistance = distance;
    }
  }

  return best;
}

function interact() {
  const id =
    nearestItem();

  if (!id) {
    toast(
      "Walk closer to something cute ✦"
    );

    return;
  }

  const item =
    state.items.find(
      (x) => x.id === id
    );

  if (!item) return;

  const bubble =
    $("#interactionBubble");

  if (bubble) {
    bubble.textContent =
      item.message;

    bubble.classList.remove(
      "hidden"
    );

    clearTimeout(
      interact.timer
    );

    interact.timer =
      setTimeout(() => {
        bubble.classList.add(
          "hidden"
        );
      }, 3000);
  }

  sendChat(
    `♡ ${item.message}`
  );
}

/* =========================================================
   EMOTES
   ========================================================= */

function renderEmotes() {
  const bar =
    $("#emoteBar");

  if (!bar) return;

  bar.innerHTML =
    state.emotes
      .map(
        (emote) => `
          <button
            class="emote-btn"
            data-emote="${escapeHTML(emote.id)}"
            title="${escapeHTML(emote.label)}"
          >
            ${emote.emoji}
            ${escapeHTML(emote.label)}
          </button>
        `
      )
      .join("");

  $$(".emote-btn").forEach(
    (button) => {
      button.onclick = () =>
        doEmote(
          button.dataset.emote
        );
    }
  );
}

function doEmote(id) {
  const emote =
    state.emotes.find(
      (item) => item.id === id
    );

  if (!emote) return;

  const bubble =
    $("#interactionBubble");

  if (bubble) {
    bubble.textContent =
      emote.emoji +
      " " +
      emote.label;

    bubble.classList.remove(
      "hidden"
    );

    clearTimeout(
      doEmote.timer
    );

    doEmote.timer =
      setTimeout(() => {
        bubble.classList.add(
          "hidden"
        );
      }, 1500);
  }

  sendChat(
    `${emote.emoji} ${emote.label}`
  );

  if (state.me) {
    state.me.emote =
      id;
  }
}

/* =========================================================
   FIREBASE
   ========================================================= */

async function setupFirebase() {
  if (
    !FIREBASE_READY ||
    state.firebaseStarting
  ) {
    return;
  }

  state.firebaseStarting = true;

  try {
    console.log(
      "🔥 Connecting Firebase..."
    );

    const modules =
      await Promise.race([
        appPromise,
        wait(10000).then(() => {
          throw new Error(
            "Firebase modules timeout."
          );
        })
      ]);

    if (!modules) {
      throw new Error(
        "Firebase modules unavailable."
      );
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

    const app =
      getApps().length
        ? getApps()[0]
        : initializeApp(
            firebaseConfig
          );

    const auth =
      getAuth(app);

    const db =
      getDatabase(app);

    state.firebase = {
      auth,
      db,
      ref,
      set,
      onValue,
      onDisconnect,
      push
    };

    /* -----------------------------------------
       Anonymous login
       ----------------------------------------- */

    const credential =
      await Promise.race([
        signInAnonymously(auth),
        wait(10000).then(() => {
          throw new Error(
            "Firebase login timeout."
          );
        })
      ]);

    /* -----------------------------------------
       Replace local player with Firebase player
       ----------------------------------------- */

    state.me = {
      uid: credential.user.uid,

      ...state.config,

      x: 480,
      y: 360,

      direction: "down",
      animation: "idle",

      online: true,
      lastSeen: Date.now()
    };

    state.localDemo = false;

    state.players = {
      [state.me.uid]:
        state.me
    };

    updateCounts();

    setConnection(
      "Online world"
    );

    /* -----------------------------------------
       Player reference
       ----------------------------------------- */

    const playerRef =
      ref(
        db,
        `worlds/${state.world}/players/${state.me.uid}`
      );

    await set(
      playerRef,
      state.me
    );

    onDisconnect(
      playerRef
    ).remove();

    /* -----------------------------------------
       Listen to world
       ----------------------------------------- */

    listenWorld();

    renderPlayers();

    console.log(
      "🌐 Firebase ONLINE"
    );
  } catch (error) {
    console.warn(
      "Firebase connection failed:",
      error
    );

    state.localDemo = true;

    state.firebase =
      null;

    setConnection(
      "Local demo"
    );

    /*
      IMPORTANT:
      Do not create a second player if
      a local player already exists.
    */

    if (!state.me) {
      createLocalPlayer();
    }

    toast(
      "Online unavailable — Local demo mode"
    );
  } finally {
    state.firebaseStarting =
      false;
  }
}

/* =========================================================
   REALTIME LISTENER
   ========================================================= */

function listenWorld() {
  if (
    state.localDemo ||
    !state.firebase ||
    !state.me
  ) {
    return;
  }

  const {
    db,
    ref,
    onValue
  } = state.firebase;

  /* -----------------------------------------
     Players
     ----------------------------------------- */

  onValue(
    ref(
      db,
      `worlds/${state.world}/players`
    ),
    (snapshot) => {
      const data =
        snapshot.val() || {};

      state.players =
        data;

      if (
        state.me &&
        state.me.uid &&
        state.players[state.me.uid]
      ) {
        state.me =
          state.players[
            state.me.uid
          ];
      }

      updateCounts();

      renderPlayers();
    },
    (error) => {
      console.warn(
        "Player listener error:",
        error
      );
    }
  );

  /* -----------------------------------------
     Chat
     ----------------------------------------- */

  onValue(
    ref(
      db,
      `worlds/${state.world}/chat`
    ),
    (snapshot) => {
      const data =
        snapshot.val() || {};

      state.chat =
        Object.values(data)
          .sort(
            (a, b) =>
              (a.timestamp || 0) -
              (b.timestamp || 0)
          )
          .slice(-40);

      renderChat();
    },
    (error) => {
      console.warn(
        "Chat listener error:",
        error
      );
    }
  );
}

/* =========================================================
   WRITE PLAYER
   ========================================================= */

async function writePlayer() {
  if (!state.me) return;

  state.me.lastSeen =
    Date.now();

  state.me.online =
    true;

  state.players[
    state.me.uid
  ] = state.me;

  updateCounts();

  /*
    Local mode:
    no Firebase write.
  */

  if (
    state.localDemo ||
    !state.firebase
  ) {
    return;
  }

  try {
    const {
      db,
      ref,
      set
    } = state.firebase;

    await set(
      ref(
        db,
        `worlds/${state.world}/players/${state.me.uid}`
      ),
      state.me
    );
  } catch (error) {
    console.warn(
      "Could not update player:",
      error
    );
  }
}

/* =========================================================
   CHAT
   ========================================================= */

async function sendChat(text) {
  text =
    String(text || "")
      .trim()
      .slice(0, 120);

  if (!text) return;

  const message = {
    uid:
      state.me?.uid ||
      "local",

    name:
      state.config.name ||
      "Mai",

    text,

    timestamp:
      Date.now()
  };

  /* -----------------------------------------
     Local mode
     ----------------------------------------- */

  if (
    state.localDemo ||
    !state.firebase
  ) {
    state.chat = [
      ...state.chat,
      message
    ].slice(-40);

    renderChat();

    return;
  }

  /* -----------------------------------------
     Firebase mode
     ----------------------------------------- */

  try {
    const {
      db,
      ref,
      push,
      set
    } = state.firebase;

    const messageRef =
      push(
        ref(
          db,
          `worlds/${state.world}/chat`
        )
      );

    await set(
      messageRef,
      message
    );
  } catch (error) {
    console.warn(
      "Chat send failed:",
      error
    );

    /*
      Show locally even if Firebase
      temporarily fails.
    */

    state.chat = [
      ...state.chat,
      message
    ].slice(-40);

    renderChat();
  }
}

/* =========================================================
   CHAT UI
   ========================================================= */

function renderChat() {
  const log =
    $("#chatLog");

  if (!log) return;

  log.innerHTML =
    state.chat
      .map(
        (message) => `
          <div class="chat-msg ${
            message.uid ===
            state.me?.uid
              ? "me"
              : ""
          }">
            <b>
              ${escapeHTML(
                message.name ||
                  "Mai"
              )}
            </b>
            <br>
            <p>
              ${escapeHTML(
                message.text ||
                  ""
              )}
            </p>
          </div>
        `
      )
      .join("");

  log.scrollTop =
    log.scrollHeight;
}

/* =========================================================
   PLAYER LIST
   ========================================================= */

function renderPlayers() {
  const list =
    $("#playerList");

  if (!list) return;

  const players =
    Object.values(
      state.players || {}
    );

  list.innerHTML =
    players
      .map(
        (player) => `
          <div class="player-chip">
            <canvas
              width="32"
              height="32"
              data-pid="${escapeHTML(
                player.uid
              )}"
            ></canvas>
            ${escapeHTML(
              player.name ||
                "Mai"
            )}
          </div>
        `
      )
      .join("");

  players.forEach(
    (player) => {
      const canvas =
        document.querySelector(
          `[data-pid="${CSS.escape(
            player.uid
          )}"]`
        );

      if (canvas) {
        drawAvatar(
          canvas,
          player,
          0.35
        );
      }
    }
  );
}

/* =========================================================
   FRIENDS
   ========================================================= */

function renderFriendsModal() {
  const list =
    $("#friendsModalList");

  if (!list) return;

  const players =
    Object.values(
      state.players || {}
    );

  list.innerHTML =
    players
      .map(
        (player) => `
          <div class="friend-row">
            <canvas
              width="56"
              height="56"
              data-fpid="${escapeHTML(
                player.uid
              )}"
            ></canvas>

            <div>
              <b>
                ${escapeHTML(
                  player.name ||
                    "Mai"
                )}
              </b>

              <br>

              <small>
                ${
                  player.uid ===
                  state.me?.uid
                    ? "you"
                    : "in " +
                      escapeHTML(
                        state.world
                      )
                }
              </small>
            </div>

            <button
              class="ghost"
              onclick="window.wavePlayer('${escapeHTML(
                player.uid
              )}')"
            >
              👋
            </button>
          </div>
        `
      )
      .join("");

  players.forEach(
    (player) => {
      const canvas =
        document.querySelector(
          `[data-fpid="${CSS.escape(
            player.uid
          )}"]`
        );

      if (canvas) {
        drawAvatar(
          canvas,
          player,
          0.55
        );
      }
    }
  );
}

window.wavePlayer = (
  playerId
) => {
  const player =
    state.players[
      playerId
    ];

  if (player) {
    toast(
      `You waved at ${player.name}! 👋`
    );
  }
};

/* =========================================================
   COUNTERS
   ========================================================= */

function updateCounts() {
  const count =
    Object.values(
      state.players || {}
    ).length;

  const onlineCount =
    $("#onlineCount");

  const friendCount =
    $("#friendCount");

  if (onlineCount) {
    onlineCount.textContent =
      count;
  }

  if (friendCount) {
    friendCount.textContent =
      Math.max(
        0,
        count - 1
      );
  }
}

/* =========================================================
   MODALS
   ========================================================= */

function setConnection(text) {
  const element =
    $("#connectionText");

  if (element) {
    element.textContent =
      text;
  }
}

function openModal(id) {
  const modal =
    $("#" + id);

  if (!modal) return;

  modal.classList.remove(
    "hidden"
  );

  previewEditor();
}

function closeModal(id) {
  const modal =
    $("#" + id);

  if (!modal) return;

  modal.classList.add(
    "hidden"
  );
}

/* =========================================================
   TOAST
   ========================================================= */

function toast(message) {
  const element =
    $("#toast");

  if (!element) return;

  element.textContent =
    message;

  element.classList.add(
    "show"
  );

  clearTimeout(
    toast.timer
  );

  toast.timer =
    setTimeout(() => {
      element.classList.remove(
        "show"
      );
    }, 2400);
}

/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {
  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[character])
  );
}

/* =========================================================
   MUSIC
   ========================================================= */

let audioOn = false;

function toggleMusic() {
  if (!state.audio) {
    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) {
      toast(
        "Your browser does not support Web Audio"
      );

      return;
    }

    const audioContext =
      new AudioContext();

    const master =
      audioContext.createGain();

    master.gain.value =
      0.035;

    master.connect(
      audioContext.destination
    );

    state.audio = {
      ac: audioContext,
      master
    };
  }

  const audio =
    state.audio;

  if (audioOn) {
    audio.master.gain.setTargetAtTime(
      0,
      audio.ac.currentTime,
      0.08
    );

    audioOn = false;

    const musicButton =
      $("#musicBtn");

    if (musicButton) {
      musicButton.textContent =
        "♫";
    }

    return;
  }

  if (
    audio.ac.state ===
    "suspended"
  ) {
    audio.ac.resume();
  }

  audio.master.gain.setTargetAtTime(
    0.035,
    audio.ac.currentTime,
    0.08
  );

  audioOn = true;

  const musicButton =
    $("#musicBtn");

  if (musicButton) {
    musicButton.textContent =
      "❚❚";
  }

  const notes = [
    261.63,
    329.63,
    392,
    329.63,
    293.66,
    349.23,
    440,
    349.23
  ];

  let index = 0;

  const playNote = () => {
    if (!audioOn) return;

    const oscillator =
      audio.ac.createOscillator();

    const gain =
      audio.ac.createGain();

    oscillator.type =
      "sine";

    oscillator.frequency.value =
      notes[
        index++ %
          notes.length
      ];

    gain.gain.setValueAtTime(
      0,
      audio.ac.currentTime
    );

    gain.gain.linearRampToValueAtTime(
      0.7,
      audio.ac.currentTime +
        0.04
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audio.ac.currentTime +
        1.1
    );

    oscillator.connect(
      gain
    );

    gain.connect(
      audio.master
    );

    oscillator.start();

    oscillator.stop(
      audio.ac.currentTime +
        1.15
    );

    setTimeout(
      playNote,
      900
    );
  };

  playNote();
}

/* =========================================================
   GLOBAL ERROR PROTECTION
   ========================================================= */

window.addEventListener(
  "error",
  (event) => {
    console.error(
      "MAIWORLD runtime error:",
      event.error ||
        event.message
    );

    /*
      Never let an uncaught error
      trap the user on the loading screen.
    */

    safeBootHide();
  }
);

window.addEventListener(
  "unhandledrejection",
  (event) => {
    console.error(
      "MAIWORLD promise error:",
      event.reason
    );

    safeBootHide();
  }
);

/* =========================================================
   START
   ========================================================= */

init().catch((error) => {
  console.error(
    "MAIWORLD fatal initialization error:",
    error
  );

  safeBootHide();

  /*
    Emergency fallback:
    show the game even if initialization
    has an unexpected error.
  */

  try {
    if (!state.me) {
      createLocalPlayer();
    }

    renderProfileEverywhere();
    renderWorld();
    drawHero();
    requestAnimationFrame(loop);
  } catch (fallbackError) {
    console.error(
      "MAIWORLD fallback failed:",
      fallbackError
    );
  }
});
