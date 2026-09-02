import { firebaseConfig, FIREBASE_READY } from "./firebase-config.js";

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

const clamp = (n, a, b) =>
  Math.max(a, Math.min(b, n));

const uid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

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
  localDemo: true
};

let ctx = $("#gameCanvas")?.getContext("2d");

if (ctx) {
  ctx.imageSmoothingEnabled = false;
}


/* =========================================================
   JSON
========================================================= */

async function loadJSON(path) {
  const response = await fetch(path, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }

  return response.json();
}


// =====================================================
// INIT
// =====================================================

async function init() {
  try {

    const [
      worldsData,
      itemsData,
      emotesData,
      charactersData
    ] = await Promise.all([

      fetch("./data/world.json")
        .then(r => r.json()),

      fetch("./data/items.json")
        .then(r => r.json()),

      fetch("./data/emotes.json")
        .then(r => r.json()),

      fetch("./data/characters.json")
        .then(r => r.json())
    ]);


    state.worlds =
      normalizeWorldData(worldsData);

    state.items =
      normalizeItemsData(itemsData);

    state.emotes =
      normalizeEmotesData(emotesData);

    state.characters =
      charactersData || {};


    // UI langsung aktif
    bindUI();

    bindExtraUI();

    setupMusic();


    // Render awal
    renderWorld();

    renderEmotes();

    renderWorldList();

    renderProfile();


    // ⭐ LOADING LANGSUNG HILANG
    hideBoot();


    // Game langsung berjalan
    loop();


    // Firebase jalan di belakang
    setupFirebase();


  } catch (error) {

    console.error(
      "MAIWORLD init error:",
      error
    );

    hideBoot();

    toast(
      "MAIWORLD gagal dimuat ♡"
    );
  }
}
/* =========================================================
   BOOT
========================================================= */

function hideBoot() {
  const boot = $("#boot");

  if (!boot) return;

  boot.classList.add("hide");
}


/* =========================================================
   UI EVENTS
========================================================= */

function bindUI() {

  const playBtn = $("#playBtn");
  if (playBtn) {
    playBtn.onclick = () => enterGame();
  }


  const customizeBtn = $("#customizeBtn");
  if (customizeBtn) {
    customizeBtn.onclick = () =>
      openModal("profileModal");
  }


  const profileBtn = $("#profileBtn");
  if (profileBtn) {
    profileBtn.onclick = () =>
      openModal("profileModal");
  }


  const profileGameBtn = $("#profileGameBtn");
  if (profileGameBtn) {
    profileGameBtn.onclick = () =>
      openModal("profileModal");
  }


  const worldBtn = $("#worldBtn");
  if (worldBtn) {
    worldBtn.onclick = () =>
      openModal("worldModal");
  }


  const friendsBtn = $("#friendsBtn");

  if (friendsBtn) {
    friendsBtn.onclick = () => {
      renderFriendsModal();
      openModal("friendsModal");
    };
  }


  const closeSide = $("#closeSide");

  if (closeSide) {
    closeSide.onclick = () => {
      $(".game-layout")?.classList.remove(
        "chat-open"
      );
    };
  }


  const editNameBtn = $("#editNameBtn");

  if (editNameBtn) {
    editNameBtn.onclick = () =>
      openModal("profileModal");
  }


  const saveProfileBtn = $("#saveProfile");

  if (saveProfileBtn) {
    saveProfileBtn.onclick = saveProfile;
  }


  const chatForm = $("#chatForm");

  if (chatForm) {
    chatForm.onsubmit = (e) => {
      e.preventDefault();

      const input = $("#chatInput");

      if (!input) return;

      sendChat(input.value);

      input.value = "";
    };
  }


  const musicBtn = $("#musicBtn");

  if (musicBtn) {
    musicBtn.onclick = toggleMusic;
  }


  const mobileInteract = $("#mobileInteract");

  if (mobileInteract) {
    mobileInteract.onclick = interact;
  }


  /* Mobile controls */

  $$(".mobile-controls [data-key]")
    .forEach((button) => {

      button.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();

          state.keys.add(
            button.dataset.key
          );
        },
        { passive: false }
      );


      button.addEventListener(
        "touchend",
        (e) => {
          e.preventDefault();

          state.keys.delete(
            button.dataset.key
          );
        },
        { passive: false }
      );

    });


  /* Keyboard */

  addEventListener("keydown", (e) => {

    const validKeys = [
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

    if (!validKeys.includes(e.key)) {
      return;
    }

    state.keys.add(e.key);

    if (e.key.toLowerCase() === "e") {
      interact();
    }

  });


  addEventListener("keyup", (e) => {
    state.keys.delete(e.key);
  });


  /* Modal close buttons */

  $$(".modal-x").forEach((button) => {

    button.onclick = () => {
      closeModal(button.dataset.close);
    };

  });


  /* Brand */

  const brandBtn = $("#brandBtn");

  if (brandBtn) {
    brandBtn.onclick = () =>
      showView("home");
  }


  /* Character editor */

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

    if (!element) return;

    element.addEventListener(
      "input",
      previewEditor
    );

    element.addEventListener(
      "change",
      previewEditor
    );

  });

}


/* =========================================================
   VIEWS
========================================================= */

function showView(view) {

  state.view = view;

  $$(".view").forEach((element) => {
    element.classList.remove("active");
  });

  const target = $("#" + view + "View");

  if (target) {
    target.classList.add("active");
  }
}


/* =========================================================
   ENTER GAME
========================================================= */

function enterGame() {

  showView("game");

  if (!state.me) {
    createLocalPlayer();
  }

  $(".game-layout")?.classList.add(
    "chat-open"
  );

  setTimeout(() => {

    $(".game-layout")?.classList.remove(
      "chat-open"
    );

  }, 700);

}


/* =========================================================
   LOCAL PLAYER
========================================================= */

function createLocalPlayer() {

  state.me = {
    uid: "local-" + uid().slice(0, 8),

    ...state.config,

    x: 480,
    y: 360,

    direction: "down",
    animation: "idle",

    online: true,
    lastSeen: Date.now()
  };

  state.players[state.me.uid] =
    state.me;

  updateCounts();
  renderPlayers();

}


/* =========================================================
   CHARACTER EDITOR
========================================================= */

function populateEditor() {

  const fill = (id, key) => {

    const list =
      state.characters?.[key] || [];

    const element = $("#" + id);

    if (!element) return;

    element.innerHTML = list
      .map(
        (item) =>
          `<option value="${item.id}">
            ${escapeHTML(item.name)}
          </option>`
      )
      .join("");

    const prop =
      id.replace("Select", "");

    if (state.config[prop]) {
      element.value =
        state.config[prop];
    }

    if (!element.value && list[0]) {
      element.value =
        list[0].id;
    }

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
    nameInput.value =
      state.config.name;
  }

}


function previewEditor() {

  const avatar =
    $("#profileAvatar");

  if (!avatar) return;

  const config = readEditor();

  drawAvatar(
    avatar,
    config,
    3
  );

}


function readEditor() {

  return {

    name:
      $("#nameInput")?.value.trim()
      || "Mai",

    skin:
      $("#skinSelect")?.value
      || "peach",

    hair:
      $("#hairSelect")?.value
      || "blonde",

    eyes:
      $("#eyesSelect")?.value
      || "sparkle",

    mouths:
      $("#mouthsSelect")?.value
      || "smile",

    top:
      $("#topSelect")?.value
      || "teePink",

    bottom:
      $("#bottomSelect")?.value
      || "jeans",

    dress:
      $("#dressSelect")?.value
      || "none",

    shoes:
      $("#shoesSelect")?.value
      || "sneakers",

    accessories:
      $("#accessoriesSelect")?.value
      || "none",

    bags:
      $("#bagsSelect")?.value
      || "none"

  };

}


function saveProfile() {

  Object.assign(
    state.config,
    readEditor()
  );

  localStorage.setItem(
    "maiworld-profile",
    JSON.stringify(state.config)
  );


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


/* =========================================================
   PROFILE
========================================================= */

function renderProfileEverywhere() {

  const sideName = $("#sideName");

  if (sideName) {
    sideName.textContent =
      state.config.name;
  }


  const miniAvatar = $("#miniAvatar");

  if (miniAvatar) {
    drawAvatar(
      miniAvatar,
      state.config,
      0.9
    );
  }


  const sideAvatar = $("#sideAvatar");

  if (sideAvatar) {
    drawAvatar(
      sideAvatar,
      state.config,
      1.45
    );
  }


  const profileAvatar =
    $("#profileAvatar");

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

  const container =
    $("#worldChoices");

  if (!container) return;

  container.innerHTML =
    state.worlds
      .map(
        (world) => `
          <button
            class="world-choice"
            data-world="${escapeHTML(world.id)}"
          >
            <span class="emoji">
              ${world.emoji || "🌸"}
            </span>

            <strong>
              ${escapeHTML(world.name || world.id)}
            </strong>

            <small>
              ${escapeHTML(world.description || "")}
            </small>
          </button>
        `
      )
      .join("");


  $$(".world-choice")
    .forEach((button) => {

      button.onclick = () => {

        changeWorld(
          button.dataset.world
        );

        closeModal("worldModal");

      };

    });

}


function changeWorld(id) {

  const world =
    state.worlds.find(
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


  const worldName =
    $("#worldName");

  if (worldName) {
    worldName.textContent =
      world.name
        .split(" ")
        .slice(-1)[0];
  }


  const worldTitle =
    $("#worldTitle");

  if (worldTitle) {
    worldTitle.textContent =
      world.name;
  }


  const locationChip =
    $("#locationChip");

  if (locationChip) {
    locationChip.textContent =
      world.name;
  }


  renderWorld();

  toast(
    `Welcome to ${world.name} ${world.emoji || "✦"}`
  );

}


function renderWorld() {
  drawWorld();
}


/* =========================================================
   WORLD DRAWING
========================================================= */

function worldTheme(id) {

  return {

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
  ];

}


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

  for (
    let i = 0;
    i < 18;
    i++
  ) {

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

  const id =
    state.world;


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
    drawPlayer(player);
  });

}


function drawGround() {

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


  ctx.fillStyle = "#86cde0";

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

    ctx.fillStyle = "#ff9fbe";

    ctx.fillRect(
      x,
      315 + (x % 30),
      6,
      6
    );

    ctx.fillStyle = "#ffe2a4";

    ctx.fillRect(
      x + 6,
      309 + (x % 30),
      5,
      5
    );

  }

}


function drawSchool() {

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

  ctx.fillStyle = "#fff";

  ctx.font =
    "16px 'Press Start 2P'";

  ctx.fillText(
    "MOCHI",
    430,
    140
  );

}


function drawCafe() {

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


  for (
    let i = 0;
    i < 8;
    i++
  ) {

    ctx.fillStyle =
      colors[i % 4];

    ctx.fillRect(
      300 + (i % 4) * 95,
      165 + Math.floor(i / 4) * 65,
      55,
      42
    );

  }

}


function drawBeach() {

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


  ctx.fillStyle = "#fff";

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


  ctx.fillStyle = "#fff";

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


/* =========================================================
   WORLD ITEMS
========================================================= */

function getWorldSpots() {

  return {

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

}


function drawItems() {

  const spots =
    getWorldSpots();


  spots.forEach((spot) => {

    ctx.fillStyle = "#fff";

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

  if (!player) return;

  const x =
    Math.round(player.x ?? 480);

  const y =
    Math.round(player.y ?? 360);


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


  ctx.fillStyle = "#fff";

  ctx.strokeStyle =
    "rgba(100,70,90,.12)";

  ctx.lineWidth = 1;


  const name =
    player.name || "Mai";

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

  ctx.textAlign = "center";

  ctx.fillText(
    name,
    x,
    y - 51
  );

  ctx.textAlign = "left";

}


/* =========================================================
   AVATAR
========================================================= */

function drawAvatar(
  target,
  player,
  scale = 1,
  centered = false
) {

  if (!target || !player) {
    return;
  }


  const isCanvas =
    target instanceof HTMLCanvasElement;


  const canvasContext =
    isCanvas
      ? target.getContext("2d")
      : target;


  if (!canvasContext) {
    return;
  }


  const W =
    isCanvas
      ? target.width
      : 96;

  const H =
    isCanvas
      ? target.height
      : 96;


  canvasContext.clearRect(
    0,
    0,
    W,
    H
  );


  canvasContext.imageSmoothingEnabled =
    false;


  canvasContext.save();


  if (centered) {
    canvasContext.translate(
      0,
      0
    );
  } else {
    canvasContext.translate(
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
    skinColors[player.skin]
    || "#f5b99d";


  /* Shadow */

  canvasContext.fillStyle =
    "#6e5962";

  canvasContext.fillRect(
    -7 * s / 2,
    11 * s / 3,
    7 * s,
    2 * s / 3
  );


  /* Legs */

  const bottomColors = {
    jeans: "#6f9ac8",
    skirt: "#f18db1",
    shorts: "#f2cfa8",
    wide: "#8c7cb8",
    cargo: "#a5b18d",
    pleated: "#f0a8c7"
  };


  const bottom =
    player.dress !== "none"
      ? player.dress
      : bottomColors[player.bottom]
        || "#6f9ac8";


  canvasContext.fillStyle =
    bottom;


  canvasContext.fillRect(
    -2.5 * s,
    5 * s,
    2 * s,
    6 * s
  );


  canvasContext.fillRect(
    0.5 * s,
    5 * s,
    2 * s,
    6 * s
  );


  /* Shoes */

  const shoeColors = {
    sneakers: "#ff9fc5",
    mary: "#7e6c9c",
    boots: "#c69ae2",
    sandals: "#f0c37f",
    loafers: "#8d6d7d",
    platform: "#d77fa8"
  };


  const shoe =
    shoeColors[player.shoes]
    || "#ff9fc5";


  canvasContext.fillStyle =
    shoe;


  canvasContext.fillRect(
    -3 * s,
    10 * s,
    3 * s,
    1.7 * s
  );


  canvasContext.fillRect(
    0,
    10 * s,
    3 * s,
    1.7 * s
  );


  /* Outfit */

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


  canvasContext.fillStyle =
    dress
    || topColors[player.top]
    || "#ff9fc5";


  if (dress) {

    canvasContext.fillRect(
      -5 * s,
      0,
      10 * s,
      7 * s
    );

  } else {

    canvasContext.fillRect(
      -5 * s,
      0,
      10 * s,
      6 * s
    );

    canvasContext.fillRect(
      -7 * s,
      1 * s,
      2 * s,
      4 * s
    );

    canvasContext.fillRect(
      5 * s,
      1 * s,
      2 * s,
      4 * s
    );

  }


  /* Head */

  canvasContext.fillStyle =
    skin;


  canvasContext.fillRect(
    -5 * s,
    -9 * s,
    10 * s,
    10 * s
  );


  canvasContext.fillRect(
    -4 * s,
    -10 * s,
    8 * s,
    12 * s
  );


  /* Hair */

  const hairColors = {
    blonde: "#f2c477",
    brown: "#80534b",
    black: "#3e3543",
    pink: "#e99dc5"
  };


  const hair =
    hairColors[player.hair]
    || "#f2c477";


  canvasContext.fillStyle =
    hair;


  canvasContext.fillRect(
    -6 * s,
    -11 * s,
    12 * s,
    5 * s
  );

  canvasContext.fillRect(
    -6 * s,
    -7 * s,
    3 * s,
    9 * s
  );

  canvasContext.fillRect(
    3 * s,
    -7 * s,
    3 * s,
    9 * s
  );

  canvasContext.fillRect(
    -4 * s,
    -12 * s,
    8 * s,
    3 * s
  );


  /* Eyes */

  canvasContext.fillStyle =
    "#4b3945";


  const eye =
    player.eyes || "sparkle";


  if (eye === "sleepy") {

    canvasContext.fillRect(
      -3 * s,
      -4 * s,
      2 * s,
      1 * s
    );

    canvasContext.fillRect(
      1 * s,
      -4 * s,
      2 * s,
      1 * s
    );

  } else if (eye === "heart") {

    canvasContext.fillStyle =
      "#e8789f";

    canvasContext.fillRect(
      -3 * s,
      -5 * s,
      2 * s,
      2 * s
    );

    canvasContext.fillRect(
      1 * s,
      -5 * s,
      2 * s,
      2 * s
    );

  } else if (eye === "wink") {

    canvasContext.fillRect(
      -3 * s,
      -4 * s,
      2 * s,
      1 * s
    );

    canvasContext.fillRect(
      1 * s,
      -5 * s,
      2 * s,
      2 * s
    );

  } else {

    canvasContext.fillRect(
      -3 * s,
      -5 * s,
      1.5 * s,
      2 * s
    );

    canvasContext.fillRect(
      1.5 * s,
      -5 * s,
      1.5 * s,
      2 * s
    );


    canvasContext.fillStyle =
      "#fff";

    canvasContext.fillRect(
      -2.7 * s,
      -5 * s,
      0.7 * s,
      0.7 * s
    );

    canvasContext.fillRect(
      1.8 * s,
      -5 * s,
      0.7 * s,
      0.7 * s
    );

  }


  /* Cheeks */

  canvasContext.fillStyle =
    "#ef8ca4";

  canvasContext.fillRect(
    -4 * s,
    -2 * s,
    2 * s,
    1 * s
  );

  canvasContext.fillRect(
    2 * s,
    -2 * s,
    2 * s,
    1 * s
  );


  /* Mouth */

  canvasContext.fillStyle =
    "#8c5669";


  const mouth =
    player.mouths || "smile";


  if (mouth === "open") {

    canvasContext.fillRect(
      -1.5 * s,
      -1 * s,
      3 * s,
      2 * s
    );

  } else if (mouth === "cat") {

    canvasContext.fillRect(
      -2 * s,
      -1 * s,
      1 * s,
      1 * s
    );

    canvasContext.fillRect(
      1 * s,
      -1 * s,
      1 * s,
      1 * s
    );

    canvasContext.fillRect(
      -1 * s,
      0,
      2 * s,
      1 * s
    );

  } else if (mouth === "pout") {

    canvasContext.fillRect(
      -2 * s,
      0,
      4 * s,
      1 * s
    );

  } else {

    canvasContext.fillRect(
      -1 * s,
      -1 * s,
      2 * s,
      1 * s
    );

  }


  /* Accessories */

  const accessory =
    player.accessories || "none";


  if (accessory === "bear") {

    canvasContext.fillStyle =
      "#c99472";

    canvasContext.fillRect(
      -7 * s,
      -10 * s,
      3 * s,
      3 * s
    );

    canvasContext.fillRect(
      4 * s,
      -10 * s,
      3 * s,
      3 * s
    );

  }


  if (accessory === "cat") {

    canvasContext.fillStyle =
      "#c78ab1";

    canvasContext.fillRect(
      -7 * s,
      -11 * s,
      3 * s,
      4 * s
    );

    canvasContext.fillRect(
      4 * s,
      -11 * s,
      3 * s,
      4 * s
    );

  }


  if (accessory === "bow") {

    canvasContext.fillStyle =
      "#ff7fab";

    canvasContext.fillRect(
      -8 * s,
      -5 * s,
      3 * s,
      3 * s
    );

    canvasContext.fillRect(
      5 * s,
      -5 * s,
      3 * s,
      3 * s
    );

    canvasContext.fillRect(
      -1 * s,
      -4 * s,
      2 * s,
      2 * s
    );

  }


  if (accessory === "flower") {

    canvasContext.fillStyle =
      "#ffd66f";

    canvasContext.fillRect(
      5 * s,
      -8 * s,
      2 * s,
      2 * s
    );

    canvasContext.fillStyle =
      "#ff9fc5";

    canvasContext.fillRect(
      6 * s,
      -9 * s,
      2 * s,
      2 * s
    );

  }


  if (accessory === "crown") {

    canvasContext.fillStyle =
      "#ffd66f";

    canvasContext.fillRect(
      -4 * s,
      -14 * s,
      8 * s,
      3 * s
    );

    canvasContext.fillRect(
      -3 * s,
      -16 * s,
      2 * s,
      3 * s
    );

    canvasContext.fillRect(
      1 * s,
      -16 * s,
      2 * s,
      3 * s
    );

  }


  if (accessory === "glasses") {

    canvasContext.strokeStyle =
      "#7f6c7b";

    canvasContext.lineWidth =
      Math.max(
        1,
        s / 3
      );

    canvasContext.strokeRect(
      -4 * s,
      -6 * s,
      3 * s,
      3 * s
    );

    canvasContext.strokeRect(
      1 * s,
      -6 * s,
      3 * s,
      3 * s
    );

    canvasContext.beginPath();

    canvasContext.moveTo(
      -1 * s,
      -4.5 * s
    );

    canvasContext.lineTo(
      1 * s,
      -4.5 * s
    );

    canvasContext.stroke();

  }


  if (accessory === "headphones") {

    canvasContext.strokeStyle =
      "#9a7cc7";

    canvasContext.lineWidth =
      Math.max(
        1,
        s / 2
      );

    canvasContext.beginPath();

    canvasContext.arc(
      0,
      -4 * s,
      7 * s,
      Math.PI,
      0
    );

    canvasContext.stroke();


    canvasContext.fillStyle =
      "#9a7cc7";

    canvasContext.fillRect(
      -7 * s,
      -5 * s,
      2 * s,
      4 * s
    );

    canvasContext.fillRect(
      5 * s,
      -5 * s,
      2 * s,
      4 * s
    );

  }


  /* Bag */

  const bag =
    player.bags || "none";


  if (bag !== "none") {

    canvasContext.fillStyle =
      bag === "heartbag"
        ? "#ff91b8"
        : bag === "teddy"
          ? "#b98970"
          : bag === "backpack"
            ? "#8fb8df"
            : "#c8a9ee";

    canvasContext.fillRect(
      6 * s,
      2 * s,
      3 * s,
      5 * s
    );

  }


  canvasContext.restore();

}


/* =========================================================
   HERO
========================================================= */

function drawHero() {

  const canvas =
    $("#heroCanvas");

  if (!canvas) return;

  const hero =
    canvas.getContext("2d");

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
    state.view === "game"
    && state.me
  ) {

    let dx = 0;
    let dy = 0;


    if (
      state.keys.has("ArrowLeft")
      || state.keys.has("a")
    ) {
      dx--;
    }


    if (
      state.keys.has("ArrowRight")
      || state.keys.has("d")
    ) {
      dx++;
    }


    if (
      state.keys.has("ArrowUp")
      || state.keys.has("w")
    ) {
      dy--;
    }


    if (
      state.keys.has("ArrowDown")
      || state.keys.has("s")
    ) {
      dy++;
    }


    if (dx || dy) {

      const length =
        Math.hypot(
          dx,
          dy
        ) || 1;


      state.me.x =
        clamp(
          state.me.x
            + (dx / length) * 2.5,
          35,
          925
        );


      state.me.y =
        clamp(
          state.me.y
            + (dy / length) * 2.5,
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
        time - state.lastSend > 90
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
   INTERACTION
========================================================= */

function nearestItem() {

  if (!state.me) {
    return null;
  }


  const list =
    getWorldSpots();


  let best = null;
  let bestDistance = 70;


  for (const spot of list) {

    const distance =
      Math.hypot(
        state.me.x - spot.x,
        state.me.y - spot.y
      );


    if (
      distance < bestDistance
    ) {

      best = spot.id;

      bestDistance =
        distance;

    }

  }


  return best;

}


function interact() {

  if (!state.me) {
    return;
  }


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


  if (!item) {
    return;
  }


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


  $$(".emote-btn")
    .forEach((button) => {

      button.onclick = () => {

        doEmote(
          button.dataset.emote
        );

      };

    });

}


function doEmote(id) {

  const emote =
    state.emotes.find(
      (item) => item.id === id
    );


  if (!emote) {
    return;
  }


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

  try {

    const modules =
      await appPromise;


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


    const credential =
      await signInAnonymously(auth);


    state.me = {

      uid:
        credential.user.uid,

      ...state.config,

      x: 480,
      y: 360,

      direction: "down",
      animation: "idle",

      online: true,
      lastSeen: Date.now()

    };


    state.localDemo = false;


    setConnection(
      "Online world"
    );


    await uploadCurrentPlayer();

    listenWorld();


  } catch (error) {

    console.warn(
      "Firebase unavailable:",
      error
    );


    state.firebase = null;
    state.localDemo = true;


    setConnection(
      "Local demo"
    );


    if (!state.me) {
      createLocalPlayer();
    }


    toast(
      "Firebase not connected — local demo mode"
    );

  }

}


/* =========================================================
   FIREBASE PLAYER
========================================================= */

async function uploadCurrentPlayer() {

  if (
    !state.firebase
    || !state.me
  ) {
    return;
  }


  const {
    db,
    ref,
    set,
    onDisconnect
  } = state.firebase;


  const playerRef =
    ref(
      db,
      `worlds/${state.world}/players/${state.me.uid}`
    );


  await set(
    playerRef,
    state.me
  );


  try {
    await onDisconnect(
      playerRef
    ).remove();
  } catch (error) {
    console.warn(
      "onDisconnect failed:",
      error
    );
  }

}


/* =========================================================
   FIREBASE LISTENERS
========================================================= */

function listenWorld() {

  if (!state.firebase) {
    return;
  }


  const {
    db,
    ref,
    onValue
  } = state.firebase;


  onValue(
    ref(
      db,
      `worlds/${state.world}/players`
    ),
    (snapshot) => {

      state.players =
        snapshot.val() || {};


      if (
        state.me
        && state.players[state.me.uid]
      ) {

        state.me =
          state.players[
            state.me.uid
          ];

      }


      updateCounts();

      renderPlayers();

    }
  );


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
              (a.timestamp || 0)
              -
              (b.timestamp || 0)
          )
          .slice(-40);


      renderChat();

    }
  );

}


/* =========================================================
   WRITE PLAYER
========================================================= */

async function writePlayer() {

  if (!state.me) {
    return;
  }


  state.me.lastSeen =
    Date.now();

  state.me.online =
    true;


  state.players[
    state.me.uid
  ] = state.me;


  updateCounts();


  if (
    state.localDemo
    || !state.firebase
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
      .trim();


  if (!text) {
    return;
  }


  if (!state.me) {
    createLocalPlayer();
  }


  const message = {

    uid:
      state.me?.uid
      || "local",

    name:
      state.config.name,

    text,

    timestamp:
      Date.now()

  };


  if (
    state.localDemo
    || !state.firebase
  ) {

    state.chat = [
      ...state.chat,
      message
    ].slice(-40);

    renderChat();

    return;

  }


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
      "Could not send chat:",
      error
    );

  }

}


/* =========================================================
   CHAT RENDER
========================================================= */

function renderChat() {

  const log =
    $("#chatLog");

  if (!log) {
    return;
  }


  log.innerHTML =
    state.chat
      .map(
        (message) => `
          <div
            class="chat-msg ${
              message.uid === state.me?.uid
                ? "me"
                : ""
            }"
          >
            <b>
              ${escapeHTML(
                message.name || "Mai"
              )}
            </b>

            <br>

            <p>
              ${escapeHTML(
                message.text || ""
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
   PLAYERS LIST
========================================================= */

function renderPlayers() {

  const list =
    $("#playerList");

  if (!list) {
    return;
  }


  const players =
    Object.values(
      state.players
    );


  list.innerHTML =
    players
      .map(
        (player) => `
          <div
            class="player-chip"
          >
            <canvas
              width="32"
              height="32"
              data-pid="${escapeHTML(player.uid)}"
            ></canvas>

            ${escapeHTML(
              player.name || "Mai"
            )}
          </div>
        `
      )
      .join("");


  players.forEach((player) => {

    const canvas =
      document.querySelector(
        `[data-pid="${CSS.escape(player.uid)}"]`
      );


    if (canvas) {

      drawAvatar(
        canvas,
        player,
        0.35
      );

    }

  });

}


/* =========================================================
   FRIENDS
========================================================= */

function renderFriendsModal() {

  const container =
    $("#friendsModalList");

  if (!container) {
    return;
  }


  const players =
    Object.values(
      state.players
    );


  container.innerHTML =
    players
      .map(
        (player) => `
          <div class="friend-row">

            <canvas
              width="56"
              height="56"
              data-fpid="${escapeHTML(player.uid)}"
            ></canvas>

            <div>
              <b>
                ${escapeHTML(
                  player.name || "Mai"
                )}
              </b>

              <br>

              <small>
                ${
                  player.uid === state.me?.uid
                    ? "you"
                    : "in " + escapeHTML(state.world)
                }
              </small>
            </div>

            <button
              class="ghost"
              data-wave="${escapeHTML(player.uid)}"
            >
              👋
            </button>

          </div>
        `
      )
      .join("");


  players.forEach((player) => {

    const canvas =
      document.querySelector(
        `[data-fpid="${CSS.escape(player.uid)}"]`
      );


    if (canvas) {

      drawAvatar(
        canvas,
        player,
        0.55
      );

    }

  });


  container
    .querySelectorAll("[data-wave]")
    .forEach((button) => {

      button.onclick = () => {

        wavePlayer(
          button.dataset.wave
        );

      };

    });

}


function wavePlayer(id) {

  const player =
    state.players[id];


  if (!player) {
    return;
  }


  toast(
    `You waved at ${player.name || "Mai"}! 👋`
  );

}


/* =========================================================
   COUNTERS
========================================================= */

function updateCounts() {

  const count =
    Object.values(
      state.players
    ).length;


  const onlineCount =
    $("#onlineCount");

  if (onlineCount) {
    onlineCount.textContent =
      count;
  }


  const friendCount =
    $("#friendCount");

  if (friendCount) {

    friendCount.textContent =
      Math.max(
        0,
        count - 1
      );

  }

}


/* =========================================================
   CONNECTION
========================================================= */

function setConnection(text) {

  const element =
    $("#connectionText");

  if (element) {
    element.textContent =
      text;
  }

}


/* =========================================================
   MODALS
========================================================= */

function openModal(id) {

  const modal =
    $("#" + id);

  if (!modal) {
    return;
  }


  modal.classList.remove(
    "hidden"
  );


  if (
    id === "profileModal"
  ) {
    previewEditor();
  }

}


function closeModal(id) {

  const modal =
    $("#" + id);

  if (!modal) {
    return;
  }


  modal.classList.add(
    "hidden"
  );

}


/* =========================================================
   TOAST
========================================================= */

function toast(text) {

  const element =
    $("#toast");

  if (!element) {
    return;
  }


  element.textContent =
    text;


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
    (character) => ({
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
      window.AudioContext
      || window.webkitAudioContext;


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

      ac:
        audioContext,

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


    const button =
      $("#musicBtn");

    if (button) {
      button.textContent =
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


  const button =
    $("#musicBtn");

  if (button) {
    button.textContent =
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


  let noteIndex = 0;


  const playNote = () => {

    if (!audioOn) {
      return;
    }


    const oscillator =
      audio.ac.createOscillator();


    const gain =
      audio.ac.createGain();


    oscillator.type =
      "sine";


    oscillator.frequency.value =
      notes[
        noteIndex++ %
        notes.length
      ];


    gain.gain.setValueAtTime(
      0,
      audio.ac.currentTime
    );


    gain.gain.linearRampToValueAtTime(
      0.7,
      audio.ac.currentTime + 0.04
    );


    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audio.ac.currentTime + 1.1
    );


    oscillator.connect(
      gain
    );

    gain.connect(
      audio.master
    );


    oscillator.start();

    oscillator.stop(
      audio.ac.currentTime + 1.15
    );


    setTimeout(
      playNote,
      900
    );

  };


  playNote();

}


/* =========================================================
   START
========================================================= */

init();
// =====================================================
// WORLD INTERACTION SPOTS
// =====================================================

function getWorldSpots() {

  return {

    plaza: [
      {
        x: 200,
        y: 390,
        id: "swing"
      },
      {
        x: 710,
        y: 380,
        id: "photo"
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
    ],

    library: [
      {
        x: 480,
        y: 390,
        id: "book"
      }
    ],

    arcade: [
      {
        x: 480,
        y: 390,
        id: "arcade"
      }
    ],

    garden: [
      {
        x: 480,
        y: 390,
        id: "seed"
      }
    ],

    concert: [
      {
        x: 420,
        y: 390,
        id: "mic"
      },
      {
        x: 600,
        y: 390,
        id: "piano"
      }
    ]

  }[state.world] || [];
}


// =====================================================
// ITEM ICONS
// =====================================================

const itemIcons = {

  swing: "🎀",
  photo: "📸",

  bench: "🪑",
  flower: "🌷",

  locker: "🔐",
  bell: "🔔",

  coffee: "☕",
  jukebox: "🎵",

  easel: "🎨",
  gallery: "🖼️",

  shell: "🐚",

  book: "📚",

  arcade: "🕹️",

  seed: "🌱",

  mic: "🎤",
  piano: "🎹"
};


// =====================================================
// FIND NEAREST ITEM
// =====================================================

function nearestItem(
  targetX = null,
  targetY = null,
  radius = 95
) {

  if (!state.me && targetX === null) {
    return null;
  }

  const list = getWorldSpots();

  let x = targetX;
  let y = targetY;

  if (x === null || y === null) {
    x = state.me.x;
    y = state.me.y;
  }

  let best = null;
  let bestDistance = radius;

  for (const spot of list) {

    const distance = Math.hypot(
      x - spot.x,
      y - spot.y
    );

    if (distance < bestDistance) {

      best = spot;
      bestDistance = distance;
    }
  }

  return best;
}


// =====================================================
// DRAW ITEMS
// =====================================================

function drawItems(ctx) {

  const spots = getWorldSpots();

  const nearby = nearestItem();

  const time = Date.now();

  spots.forEach(spot => {

    const item =
      state.items.find(
        x => x.id === spot.id
      );

    const icon =
      itemIcons[spot.id] || "♡";

    const pulse =
      Math.sin(time / 350 + spot.x) * 2;

    // -------------------------------------------------
    // cute item shadow
    // -------------------------------------------------

    ctx.save();

    ctx.fillStyle =
      "rgba(130,90,120,.10)";

    ctx.beginPath();

    ctx.ellipse(
      spot.x,
      spot.y + 20,
      27,
      8,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();


    // -------------------------------------------------
    // item bubble
    // -------------------------------------------------

    ctx.save();

    ctx.font =
      "25px Arial";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
      icon,
      spot.x,
      spot.y - 3 + pulse
    );

    ctx.restore();


    // -------------------------------------------------
    // tiny floating sparkle
    // -------------------------------------------------

    ctx.save();

    ctx.fillStyle =
      "rgba(255,150,200,.8)";

    ctx.font =
      "12px Arial";

    ctx.textAlign = "center";

    ctx.fillText(
      "✦",
      spot.x - 25,
      spot.y - 20 + pulse
    );

    ctx.fillStyle =
      "rgba(190,150,230,.8)";

    ctx.fillText(
      "♡",
      spot.x + 27,
      spot.y - 5 - pulse
    );

    ctx.restore();


    // -------------------------------------------------
    // INTERACT PROMPT
    // -------------------------------------------------

    if (
      nearby &&
      nearby.id === spot.id
    ) {

      const promptY =
        spot.y - 58 + pulse;

      ctx.save();

      ctx.font =
        "700 13px Arial";

      const text =
        "♡ E  Interact!";

      const width =
        ctx.measureText(text).width + 24;

      const height = 30;

      ctx.fillStyle =
        "rgba(255,255,255,.96)";

      ctx.strokeStyle =
        "rgba(255,150,195,.55)";

      ctx.lineWidth = 2;

      ctx.beginPath();

      if (ctx.roundRect) {

        ctx.roundRect(
          spot.x - width / 2,
          promptY - height / 2,
          width,
          height,
          15
        );

      } else {

        ctx.rect(
          spot.x - width / 2,
          promptY - height / 2,
          width,
          height
        );
      }

      ctx.fill();
      ctx.stroke();

      ctx.fillStyle =
        "#76576b";

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillText(
        text,
        spot.x,
        promptY + 1
      );

      ctx.restore();


      // tiny arrow

      ctx.save();

      ctx.fillStyle =
        "rgba(255,255,255,.96)";

      ctx.beginPath();

      ctx.moveTo(
        spot.x - 7,
        promptY + 14
      );

      ctx.lineTo(
        spot.x,
        promptY + 22
      );

      ctx.lineTo(
        spot.x + 7,
        promptY + 14
      );

      ctx.closePath();

      ctx.fill();

      ctx.restore();
    }
  });
}


// =====================================================
// INTERACTION
// =====================================================

function interact(spotOverride = null) {

  if (!state.me) return;

  const spot =
    spotOverride || nearestItem();

  if (!spot) {

    toast(
      "Jalan sedikit lebih dekat yaa ♡"
    );

    return;
  }

  const distance =
    Math.hypot(
      state.me.x - spot.x,
      state.me.y - spot.y
    );

  if (distance > 120) {

    toast(
      "Deketin dulu objeknya ✦"
    );

    return;
  }

  const item =
    state.items.find(
      x => x.id === spot.id
    );

  if (!item) return;


  // -------------------------------------------------
  // save interaction animation
  // -------------------------------------------------

  state.interaction = {

    id: spot.id,

    x: spot.x,

    y: spot.y,

    time: Date.now()
  };


  // -------------------------------------------------
  // HTML interaction bubble
  // -------------------------------------------------

  const bubble =
    $("#interactionBubble");

  if (bubble) {

    bubble.innerHTML = `
      <span class="interaction-heart">♡</span>
      ${escapeHTML(item.message || item.name || "Cute!")}
      <span class="interaction-sparkle">✦</span>
    `;

    bubble.classList.remove("hidden");

    // restart animation
    bubble.style.animation = "none";

    void bubble.offsetWidth;

    bubble.style.animation =
      "cuteInteract .35s ease-out";

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


  // -------------------------------------------------
  // cute toast
  // -------------------------------------------------

  toast(
    `${itemIcons[spot.id] || "♡"} ${item.name || "Cute interaction"} ✦`
  );


  // -------------------------------------------------
  // send to chat
  // -------------------------------------------------

  sendChat(
    `♡ ${item.message || item.name || "I interacted with something cute!"}`
  );


  renderWorld();
}


// =====================================================
// INTERACTION EFFECT
// =====================================================

function drawInteractionEffect(ctx) {

  if (!state.interaction) {
    return;
  }

  const interaction =
    state.interaction;

  const elapsed =
    Date.now() - interaction.time;

  const duration = 900;

  if (elapsed > duration) {

    state.interaction = null;

    return;
  }

  const progress =
    elapsed / duration;

  const alpha =
    1 - progress;

  const rise =
    progress * 55;

  const scale =
    1 + progress * 0.5;

  ctx.save();

  ctx.globalAlpha = alpha;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font =
    `${20 * scale}px Arial`;

  ctx.fillStyle =
    "#ff82b5";

  ctx.fillText(
    "♡",
    interaction.x - 25,
    interaction.y - 35 - rise
  );

  ctx.fillStyle =
    "#c49be7";

  ctx.fillText(
    "✦",
    interaction.x + 22,
    interaction.y - 45 - rise
  );

  ctx.fillStyle =
    "#ffb2cf";

  ctx.font =
    `${15 * scale}px Arial`;

  ctx.fillText(
    "✦",
    interaction.x,
    interaction.y - 70 - rise
  );

  ctx.restore();
}


// =====================================================
// DRAW PLAYER
// =====================================================

function drawPlayer(
  ctx,
  player
) {

  if (!player) return;

  drawAvatar(
    ctx,
    player.x,
    player.y,
    player.character ||
      state.selectedCharacter,
    1
  );

  // name
  ctx.save();

  ctx.font =
    "700 12px Arial";

  ctx.textAlign = "center";

  ctx.fillStyle =
    "rgba(100,75,95,.8)";

  ctx.fillText(
    player.name || "Player",
    player.x,
    player.y - 72
  );

  ctx.restore();


  // emote
  if (player.emote) {

    ctx.save();

    ctx.font =
      "24px Arial";

    ctx.textAlign = "center";

    ctx.fillText(
      player.emote,
      player.x,
      player.y - 88
    );

    ctx.restore();
  }
}


// =====================================================
// DRAW AVATAR
// =====================================================

function drawAvatar(
  ctx,
  x,
  y,
  character = {},
  scale = 1
) {

  ctx.save();

  ctx.translate(
    x,
    y
  );

  ctx.scale(
    scale,
    scale
  );


  // -------------------------------------------------
  // shadow
  // -------------------------------------------------

  ctx.fillStyle =
    "rgba(100,70,100,.12)";

  ctx.beginPath();

  ctx.ellipse(
    0,
    42,
    25,
    8,
    0,
    0,
    Math.PI * 2
  );

  ctx.fill();


  // -------------------------------------------------
  // legs
  // -------------------------------------------------

  ctx.fillStyle =
    "#f4b5cb";

  box(
    ctx,
    -15,
    15,
    11,
    28,
    "#f0c3d3",
    5
  );

  box(
    ctx,
    4,
    15,
    11,
    28,
    "#f0c3d3",
    5
  );


  // -------------------------------------------------
  // shoes
  // -------------------------------------------------

  box(
    ctx,
    -19,
    37,
    19,
    9,
    "#ffffff",
    5
  );

  box(
    ctx,
    1,
    37,
    19,
    9,
    "#ffffff",
    5
  );


  // -------------------------------------------------
  // body
  // -------------------------------------------------

  let topColor =
    "#f7b5cf";

  if (
    character.top === "top2"
  ) {
    topColor = "#bca4e8";
  }

  if (
    character.top === "top3"
  ) {
    topColor = "#a9d9c2";
  }

  box(
    ctx,
    -24,
    -20,
    48,
    45,
    topColor,
    15
  );


  // -------------------------------------------------
  // dress
  // -------------------------------------------------

  if (character.dress) {

    box(
      ctx,
      -30,
      -18,
      60,
      65,
      "#e7b7dc",
      18
    );
  }


  // -------------------------------------------------
  // arms
  // -------------------------------------------------

  ctx.fillStyle =
    "#f6c7b5";

  ctx.beginPath();

  ctx.arc(
    -27,
    -3,
    7,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.beginPath();

  ctx.arc(
    27,
    -3,
    7,
    0,
    Math.PI * 2
  );

  ctx.fill();


  // -------------------------------------------------
  // neck
  // -------------------------------------------------

  ctx.fillStyle =
    "#f6c7b5";

  ctx.fillRect(
    -6,
    -28,
    12,
    12
  );


  // -------------------------------------------------
  // face
  // -------------------------------------------------

  let skin =
    "#f6c7b5";

  if (
    character.skin === "skin2"
  ) {
    skin = "#e9aa8e";
  }

  if (
    character.skin === "skin3"
  ) {
    skin = "#c98568";
  }

  ctx.fillStyle = skin;

  ctx.beginPath();

  ctx.arc(
    0,
    -47,
    29,
    0,
    Math.PI * 2
  );

  ctx.fill();


  // -------------------------------------------------
  // hair
  // -------------------------------------------------

  let hairColor =
    "#5b3d4c";

  if (
    character.hair === "hair2"
  ) {
    hairColor = "#8b5c3f";
  }

  if (
    character.hair === "hair3"
  ) {
    hairColor = "#d79c58";
  }

  if (
    character.hair === "hair4"
  ) {
    hairColor = "#7e75a8";
  }

  ctx.fillStyle =
    hairColor;

  ctx.beginPath();

  ctx.arc(
    0,
    -57,
    31,
    Math.PI,
    Math.PI * 2
  );

  ctx.fill();


  // side hair

  ctx.fillRect(
    -30,
    -60,
    10,
    35
  );

  ctx.fillRect(
    20,
    -60,
    10,
    35
  );


  // -------------------------------------------------
  // eyes
  // -------------------------------------------------

  ctx.fillStyle =
    "#4d3b49";

  ctx.beginPath();

  ctx.arc(
    -10,
    -47,
    4,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.beginPath();

  ctx.arc(
    10,
    -47,
    4,
    0,
    Math.PI * 2
  );

  ctx.fill();


  // eye sparkle

  ctx.fillStyle =
    "#ffffff";

  ctx.beginPath();

  ctx.arc(
    -9,
    -48,
    1.5,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.beginPath();

  ctx.arc(
    11,
    -48,
    1.5,
    0,
    Math.PI * 2
  );

  ctx.fill();


  // -------------------------------------------------
  // mouth
  // -------------------------------------------------

  ctx.strokeStyle =
    "#9c6176";

  ctx.lineWidth = 2;

  ctx.beginPath();

  ctx.arc(
    0,
    -39,
    5,
    0,
    Math.PI
  );

  ctx.stroke();


  // -------------------------------------------------
  // accessory
  // -------------------------------------------------

  if (character.accessory) {

    ctx.fillStyle =
      "#ffb0cf";

    ctx.beginPath();

    ctx.arc(
      23,
      -65,
      7,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }


  // -------------------------------------------------
  // bag
  // -------------------------------------------------

  if (character.bag) {

    ctx.strokeStyle =
      "#a982c6";

    ctx.lineWidth = 5;

    ctx.beginPath();

    ctx.arc(
      29,
      5,
      15,
      -Math.PI / 2,
      Math.PI / 2
    );

    ctx.stroke();
  }


  ctx.restore();
}


// =====================================================
// GAME LOOP
// =====================================================

function loop() {

  updateMovement();

  renderWorld();

  requestAnimationFrame(
    loop
  );
}


// =====================================================
// EMOTES
// =====================================================

function renderEmotes() {

  const container =
    $("#emoteBar");

  if (!container) return;

  container.innerHTML = "";

  state.emotes.forEach(emote => {

    const button =
      document.createElement("button");

    button.className =
      "emote-button";

    const value =
      typeof emote === "string"
        ? emote
        : emote.emoji ||
          emote.value ||
          emote.symbol ||
          "♡";

    button.textContent =
      value;

    button.addEventListener(
      "click",
      () => {

        if (!state.me) return;

        state.me.emote =
          value;

        state.players[state.me.uid] = {
          ...state.me
        };

        writePlayer();

        setTimeout(() => {

          if (
            state.me &&
            state.me.emote === value
          ) {

            state.me.emote = null;

            state.players[state.me.uid] = {
              ...state.me
            };

            writePlayer();
          }

        }, 2500);
      }
    );

    container.appendChild(button);
  });
}
// =====================================================
// FIREBASE SETUP
// =====================================================

async function setupFirebase() {

  if (!FIREBASE_READY) {

    console.warn(
      "Firebase belum diaktifkan."
    );

    state.firebaseReady = false;

    return;
  }

  try {

    const app =
      initializeApp(
        firebaseConfig
      );

    const auth =
      getAuth(app);

    state.db =
      getDatabase(app);

    await signInAnonymously(auth);

    onAuthStateChanged(
      auth,
      user => {

        if (!user) return;

        state.uid =
          user.uid;

        state.firebaseReady =
          true;

        state.online = true;

        if (!state.me) {
          createLocalPlayer();
        } else {

          state.me.uid =
            state.uid;

          state.players[state.uid] = {
            ...state.me
          };
        }

        listenWorld();

        updateConnectionStatus(
          true
        );

        console.log(
          "Firebase connected ♡",
          state.uid
        );
      }
    );

  } catch (error) {

    console.error(
      "Firebase error:",
      error
    );

    state.firebaseReady = false;
    state.online = false;

    updateConnectionStatus(
      false
    );

    toast(
      "Mode offline aktif ♡"
    );
  }
}


// =====================================================
// LISTEN CURRENT WORLD
// =====================================================

function listenWorld() {

  if (
    !state.firebaseReady ||
    !state.db ||
    !state.uid
  ) {
    return;
  }


  // remove old listeners
  if (state.unsubscribePlayers) {

    state.unsubscribePlayers();

    state.unsubscribePlayers =
      null;
  }

  if (state.unsubscribeChat) {

    state.unsubscribeChat();

    state.unsubscribeChat =
      null;
  }


  // ---------------------------------------------------
  // PLAYERS
  // ---------------------------------------------------

  const playersRef =
    ref(
      state.db,
      `worlds/${state.world}/players`
    );

  state.unsubscribePlayers =
    onValue(
      playersRef,
      snapshot => {

        const data =
          snapshot.val() || {};

        state.players = {
          ...data
        };


        // make sure local player stays
        if (state.me) {

          state.players[state.uid] = {
            ...state.me
          };
        }

        renderWorld();
      }
    );


  // ---------------------------------------------------
  // CHAT
  // ---------------------------------------------------

  const chatRef =
    ref(
      state.db,
      `worlds/${state.world}/chat`
    );

  state.unsubscribeChat =
    onValue(
      chatRef,
      snapshot => {

        const data =
          snapshot.val() || {};

        renderChat(
          Object.values(data)
            .sort(
              (a, b) =>
                (a.timestamp || 0) -
                (b.timestamp || 0)
            )
            .slice(-30)
        );
      }
    );
}


// =====================================================
// UPLOAD PLAYER
// =====================================================

async function uploadCurrentPlayer() {

  if (
    !state.firebaseReady ||
    !state.db ||
    !state.uid ||
    !state.me
  ) {
    return;
  }

  const playerRef =
    ref(
      state.db,
      `worlds/${state.world}/players/${state.uid}`
    );

  await set(
    playerRef,
    {
      uid: state.uid,

      name:
        state.me.name ||
        "Khanza",

      x:
        state.me.x || 480,

      y:
        state.me.y || 300,

      speed:
        state.me.speed || 3,

      character:
        state.me.character ||
        state.selectedCharacter,

      emote:
        state.me.emote ||
        null,

      online: true,

      updatedAt:
        Date.now()
    }
  );

  onDisconnect(
    playerRef
  ).remove();
}


// =====================================================
// WRITE PLAYER
// =====================================================

let lastPlayerWrite = 0;

async function writePlayer() {

  if (!state.me) return;

  state.players[state.me.uid] = {
    ...state.me
  };

  renderWorld();


  // prevent too many Firebase writes
  const now =
    Date.now();

  if (
    now - lastPlayerWrite < 80
  ) {
    return;
  }

  lastPlayerWrite = now;

  try {

    await uploadCurrentPlayer();

  } catch (error) {

    console.warn(
      "Could not update player:",
      error
    );
  }
}


// =====================================================
// CHANGE PLAYER NAME
// =====================================================

function setPlayerName(name) {

  if (!state.me) return;

  const cleanName =
    String(name || "")
      .trim()
      .slice(0, 18);

  if (!cleanName) return;

  state.me.name =
    cleanName;

  state.players[state.me.uid] = {
    ...state.me
  };

  writePlayer();

  renderProfile();

  toast(
    `Hi, ${cleanName}! ♡`
  );
}


// =====================================================
// CHAT
// =====================================================

async function sendChat(message) {

  if (!message) return;

  const cleanMessage =
    String(message)
      .trim()
      .slice(0, 120);

  if (!cleanMessage) return;


  // offline
  if (
    !state.firebaseReady ||
    !state.db ||
    !state.uid
  ) {

    addLocalChat(
      cleanMessage
    );

    return;
  }


  try {

    const chatRef =
      ref(
        state.db,
        `worlds/${state.world}/chat`
      );

    const newChat =
      push(chatRef);

    await set(
      newChat,
      {
        uid: state.uid,

        name:
          state.me?.name ||
          "Player",

        message:
          cleanMessage,

        timestamp:
          Date.now()
      }
    );

  } catch (error) {

    console.error(
      "Chat error:",
      error
    );
  }
}


// =====================================================
// LOCAL CHAT
// =====================================================

const localChat = [];

function addLocalChat(message) {

  localChat.push({

    uid:
      state.uid ||
      "local",

    name:
      state.me?.name ||
      "You",

    message,

    timestamp:
      Date.now()
  });

  if (localChat.length > 30) {
    localChat.shift();
  }

  renderChat(
    localChat
  );
}


// =====================================================
// CHAT UI
// =====================================================

function renderChat(messages = []) {

  const container =
    $("#chatMessages");

  if (!container) return;

  container.innerHTML = "";

  messages.forEach(chat => {

    const message =
      document.createElement("div");

    message.className =
      "chat-message";

    message.innerHTML = `
      <strong>
        ${escapeHTML(chat.name || "Player")}
      </strong>
      <span>
        ${escapeHTML(chat.message || "")}
      </span>
    `;

    container.appendChild(
      message
    );
  });

  container.scrollTop =
    container.scrollHeight;
}


// =====================================================
// CHAT SEND BUTTON
// =====================================================

function bindChatUI() {

  const input =
    $("#chatInput");

  const send =
    $("#sendChatBtn");

  if (!input || !send) return;


  send.addEventListener(
    "click",
    () => {

      const message =
        input.value.trim();

      if (!message) return;

      sendChat(message);

      input.value = "";
    }
  );


  input.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter"
      ) {

        event.preventDefault();

        send.click();
      }
    }
  );
}


// =====================================================
// FRIENDS
// =====================================================

function renderFriends() {

  const container =
    $("#friendsList");

  if (!container) return;

  container.innerHTML = "";


  const players =
    Object.values(
      state.players || {}
    );


  const others =
    players.filter(
      player =>
        player.uid !== state.uid
    );


  if (!others.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div>♡</div>
        <p>No friends are here yet.</p>
        <small>Invite someone to join your world ✦</small>
      </div>
    `;

    return;
  }


  others.forEach(player => {

    const card =
      document.createElement("div");

    card.className =
      "friend-card";

    card.innerHTML = `
      <div class="friend-avatar">♡</div>

      <div class="friend-info">
        <strong>
          ${escapeHTML(player.name || "Player")}
        </strong>

        <small>
          ${player.online === false
            ? "offline"
            : "online ♡"}
        </small>
      </div>
    `;

    container.appendChild(
      card
    );
  });
}


// =====================================================
// CONNECTION STATUS
// =====================================================

function updateConnectionStatus(
  online
) {

  const status =
    $("#connectionStatus");

  if (!status) return;

  if (online) {

    status.textContent =
      "● Online";

    status.classList.add(
      "online"
    );

    status.classList.remove(
      "offline"
    );

  } else {

    status.textContent =
      "● Offline";

    status.classList.add(
      "offline"
    );

    status.classList.remove(
      "online"
    );
  }
}


// =====================================================
// COUNTERS
// =====================================================

function updateCounters() {

  const count =
    Object.keys(
      state.players || {}
    ).length;


  const playerCount =
    $("#playerCount");

  if (playerCount) {

    playerCount.textContent =
      `${count} player${count === 1 ? "" : "s"}`;
  }
}


// =====================================================
// MODALS
// =====================================================

function openModal(id) {

  const modal =
    document.getElementById(id);

  if (!modal) return;

  modal.classList.remove(
    "hidden"
  );

  modal.classList.add(
    "open"
  );


  if (
    id === "profileModal"
  ) {

    renderProfile();
  }

  if (
    id === "friendsModal"
  ) {

    renderFriends();
  }
}


function closeModal(id) {

  const modal =
    document.getElementById(id);

  if (!modal) return;

  modal.classList.add(
    "hidden"
  );

  modal.classList.remove(
    "open"
  );
}


function closeAllModals() {

  document
    .querySelectorAll(".modal")
    .forEach(modal => {

      modal.classList.add(
        "hidden"
      );

      modal.classList.remove(
        "open"
      );
    });
}


// =====================================================
// MODAL CLICK OUTSIDE
// =====================================================

function bindModalUI() {

  document
    .querySelectorAll(".modal")
    .forEach(modal => {

      modal.addEventListener(
        "click",
        event => {

          if (
            event.target === modal
          ) {

            modal.classList.add(
              "hidden"
            );

            modal.classList.remove(
              "open"
            );
          }
        }
      );
    });


  document
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const id =
            button.dataset.closeModal;

          if (id) {
            closeModal(id);
          }
        }
      );
    });
}


// =====================================================
// TOAST
// =====================================================

let toastTimer = null;

function toast(message) {

  let element =
    $("#toast");

  if (!element) {

    element =
      document.createElement("div");

    element.id =
      "toast";

    element.className =
      "toast hidden";

    document.body.appendChild(
      element
    );
  }


  element.textContent =
    message;


  element.classList.remove(
    "hidden"
  );

  element.classList.add(
    "show"
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(() => {

      element.classList.remove(
        "show"
      );

      setTimeout(() => {

        element.classList.add(
          "hidden"
        );

      }, 250);

    }, 2200);
}


// =====================================================
// MUSIC
// =====================================================

function setupMusic() {

  if (state.audio) {
    return;
  }

  state.audio =
    new Audio(
      "./music/cozy-jazz.mp3"
    );

  state.audio.loop = true;

  state.audio.volume =
    0.35;
}


async function toggleMusic() {

  setupMusic();

  if (!state.audio) return;


  if (
    state.musicOn
  ) {

    state.audio.pause();

    state.musicOn =
      false;

    updateMusicButton();

    toast(
      "Music off ♡"
    );

    return;
  }


  try {

    await state.audio.play();

    state.musicOn =
      true;

    updateMusicButton();

    toast(
      "Cozy Jazz playing ♪"
    );

  } catch (error) {

    console.warn(
      "Music blocked:",
      error
    );

    toast(
      "Tap music again to play ♪"
    );
  }
}


function updateMusicButton() {

  const button =
    $("#musicBtn");

  if (!button) return;

  button.textContent =
    state.musicOn
      ? "♫ Music On"
      : "♫ Music";
}


// =====================================================
// UPDATE WORLD / PLAYERS
// =====================================================

function updateOnlinePlayers() {

  const count =
    Object.keys(
      state.players || {}
    ).length;

  const counter =
    $("#onlineCount");

  if (counter) {

    counter.textContent =
      count;
  }
}


// =====================================================
// KEYBOARD MOVEMENT SAFETY
// =====================================================

window.addEventListener(
  "blur",
  () => {

    state.keys = {};
  }
);


// =====================================================
// CHARACTER PREVIEW BUTTON
// =====================================================

function bindCharacterPreview() {

  const preview =
    $("#previewCharacterBtn");

  if (!preview) return;

  preview.addEventListener(
    "click",
    () => {

      renderCharacterPreview();

      toast(
        "This is your character ♡"
      );
    }
  );
}


// =====================================================
// AUTO BIND EXTRA UI
// =====================================================

function bindExtraUI() {

  bindChatUI();

  bindModalUI();

  bindCharacterPreview();


  // profile name
  const nameInput =
    $("#nameInput");

  const saveName =
    $("#saveNameBtn");

  if (
    nameInput &&
    saveName
  ) {

    saveName.addEventListener(
      "click",
      () => {

        setPlayerName(
          nameInput.value
        );
      }
    );
  }


  // back buttons
  document
    .querySelectorAll(
      "[data-view]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const view =
            button.dataset.view;

          if (view) {
            showView(view);
          }
        }
      );
    });
}


// =====================================================
// PATCH INITIAL UI
// =====================================================

const originalBindUI =
  bindUI;


// Re-bind additional elements
// after the main UI is ready.

setTimeout(() => {

  bindExtraUI();

  setupMusic();

  updateMusicButton();

}, 100);


// =====================================================
// UPDATE COUNTERS EACH FRAME
// =====================================================

setInterval(() => {

  updateCounters();

  updateOnlinePlayers();

}, 1000);


// =====================================================
// START MAIWORLD
// =====================================================

init();
