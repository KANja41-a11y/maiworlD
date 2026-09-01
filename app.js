/* =========================================
   CREATIVE BOX
   ========================================= */

const state = {

  challenges: [],

  category: "All",

  currentChallenge: null,

  favorites:
    JSON.parse(
      localStorage.getItem("creativebox-favorites") || "[]"
    ),

  history:
    JSON.parse(
      localStorage.getItem("creativebox-history") || "[]"
    ),

  xp:
    Number(
      localStorage.getItem("creativebox-xp") || 0
    ),

  streak:
    Number(
      localStorage.getItem("creativebox-streak") || 0
    ),

  lastCompleted:
    localStorage.getItem("creativebox-last") || "",

  collectionTab: "favorites",

  timer: null,

  seconds: 1200,

  paused: false

};


/* =========================================
   HELPER
   ========================================= */

const $ = (id) =>
  document.getElementById(id);


/* =========================================
   SAVE DATA
   ========================================= */

function saveData() {

  localStorage.setItem(
    "creativebox-favorites",
    JSON.stringify(state.favorites)
  );

  localStorage.setItem(
    "creativebox-history",
    JSON.stringify(state.history)
  );

  localStorage.setItem(
    "creativebox-xp",
    state.xp
  );

  localStorage.setItem(
    "creativebox-streak",
    state.streak
  );

  localStorage.setItem(
    "creativebox-last",
    state.lastCompleted
  );

}


/* =========================================
   LOAD JSON
   ========================================= */

async function loadChallenges() {

  try {

    const response =
      await fetch("data/challenges.json");

    if (!response.ok) {
      throw new Error("Failed to load JSON");
    }

    state.challenges =
      await response.json();

    renderEverything();

  } catch (error) {

    console.error(error);

    $("dailyChallenge").innerHTML = `
      <p>
        Couldn't load the challenges.
        Make sure <b>data/challenges.json</b>
        exists.
      </p>
    `;

  }

}


/* =========================================
   GET CHALLENGE
   ========================================= */

function getChallenge(id) {

  return state.challenges.find(
    challenge => challenge.id === id
  );

}


/* =========================================
   RANDOM CHALLENGE
   ========================================= */

function getRandomChallenge() {

  let available =
    state.challenges.filter(
      challenge =>
        state.category === "All" ||
        challenge.category === state.category
    );

  if (!available.length) {
    return null;
  }

  return available[
    Math.floor(
      Math.random() * available.length
    )
  ];

}


/* =========================================
   RENDER CHALLENGE
   ========================================= */

function renderChallenge(container, challenge) {

  if (!challenge) {

    container.innerHTML = `
      <p>
        No challenge available.
      </p>
    `;

    return;
  }


  const favorite =
    state.favorites.includes(
      challenge.id
    );


  container.innerHTML = `

    <div>

      <div class="challenge-meta">

        ${challenge.icon}

        ${challenge.category.toUpperCase()}

        •

        ${challenge.difficulty.toUpperCase()}

        •

        ${challenge.minutes} MIN

      </div>


      <h3>
        ${challenge.title}
      </h3>


      <p>
        ${challenge.prompt}
      </p>


      <div class="challenge-actions">

        <button
          class="primary-button start-button"
        >
          Start Challenge →
        </button>


        <button
          class="heart-button ${favorite ? "favorite" : ""}"
          title="Favorite"
        >
          ${favorite ? "♥" : "♡"}
        </button>

      </div>

    </div>


    <div class="challenge-icon">

      ${challenge.icon}

    </div>

  `;


  container
    .querySelector(".start-button")
    .onclick =
    () => openChallenge(challenge);


  container
    .querySelector(".heart-button")
    .onclick =
    () => toggleFavorite(challenge.id);

}


/* =========================================
   HOME
   ========================================= */

function renderHome() {

  if (!state.challenges.length) {
    return;
  }


  const today =
    new Date().getDate();


  const challenge =
    state.challenges[
      today %
      state.challenges.length
    ];


  renderChallenge(
    $("dailyChallenge"),
    challenge
  );


  $("streak").textContent =
    state.streak;


  $("xp").textContent =
    state.xp;


  $("completed").textContent =
    state.history.length;


  $("level").textContent =
    Math.floor(state.xp / 100) + 1;

}


/* =========================================
   FILTERS
   ========================================= */

function renderFilters() {

  const categories = [

    "All",

    ...new Set(
      state.challenges.map(
        challenge =>
          challenge.category
      )
    )

  ];


  $("categoryFilters").innerHTML =
    categories.map(
      category => `

        <button
          class="filter
          ${state.category === category
            ? "active"
            : ""}"
        >
          ${category}
        </button>

      `
    ).join("");


  document
    .querySelectorAll(".filter")
    .forEach(button => {

      button.onclick = () => {

        state.category =
          button.textContent.trim();

        renderFilters();

        generateChallenge();

      };

    });

}


/* =========================================
   GENERATE
   ========================================= */

function generateChallenge() {

  const challenge =
    getRandomChallenge();

  state.currentChallenge =
    challenge;

  renderChallenge(
    $("challengeDisplay"),
    challenge
  );

}


/* =========================================
   FAVORITE
   ========================================= */

function toggleFavorite(id) {

  const index =
    state.favorites.indexOf(id);


  if (index !== -1) {

    state.favorites.splice(
      index,
      1
    );

  } else {

    state.favorites.push(id);

  }


  saveData();

  renderEverything();

}


/* =========================================
   COLLECTION
   ========================================= */

function renderCollection() {

  const ids =
    state.collectionTab === "favorites"
      ? state.favorites
      : state.history;


  const challenges =
    ids
      .map(id => getChallenge(id))
      .filter(Boolean);


  if (!challenges.length) {

    $("collectionList").innerHTML = `

      <article class="mini-card">

        <h3>
          Nothing here yet ✦
        </h3>

        <p>
          ${
            state.collectionTab === "favorites"
              ? "Tap ♡ on a challenge to save it."
              : "Finish a challenge and it will appear here."
          }
        </p>

      </article>

    `;

    return;

  }


  $("collectionList").innerHTML =
    challenges.map(
      challenge => `

        <article class="mini-card">

          <div class="challenge-meta">

            ${challenge.icon}

            ${challenge.category}

          </div>


          <h3>
            ${challenge.title}
          </h3>


          <p>
            ${challenge.prompt}
          </p>


          <button
            class="ghost-button"
            onclick="openSavedChallenge(${challenge.id})"
          >
            Open
          </button>

        </article>

      `
    ).join("");

}


window.openSavedChallenge =
  function(id) {

    const challenge =
      getChallenge(id);

    openChallenge(challenge);

  };


/* =========================================
   PROFILE
   ========================================= */

function renderProfile() {

  const level =
    Math.floor(state.xp / 100) + 1;


  const currentXP =
    state.xp % 100;


  $("profileLevel").textContent =
    `Level ${level} Creator`;


  $("xpProgress").style.width =
    `${currentXP}%`;


  $("xpProgressText").textContent =
    `${currentXP} / 100 XP to next level`;


  $("profileCompleted").textContent =
    state.history.length;


  $("profileFavorites").textContent =
    state.favorites.length;


  $("profileStreak").textContent =
    state.streak;


  const achievements = [

    {
      icon: "🌱",
      title: "First Spark",
      description:
        "Complete your first challenge.",
      unlocked:
        state.history.length >= 1
    },

    {
      icon: "🔥",
      title: "On Fire",
      description:
        "Reach a 7 day streak.",
      unlocked:
        state.streak >= 7
    },

    {
      icon: "🎨",
      title: "Artist",
      description:
        "Complete 10 challenges.",
      unlocked:
        state.history.length >= 10
    },

    {
      icon: "⚡",
      title: "Speed Creator",
      description:
        "Finish your first challenge.",
      unlocked:
        state.history.length >= 1
    },

    {
      icon: "💎",
      title: "Creative Master",
      description:
        "Earn 500 XP.",
      unlocked:
        state.xp >= 500
    },

    {
      icon: "💜",
      title: "Collector",
      description:
        "Save 5 favorites.",
      unlocked:
        state.favorites.length >= 5
    }

  ];


  $("achievements").innerHTML =
    achievements.map(
      achievement => `

        <article
          class="achievement
          ${achievement.unlocked
            ? ""
            : "locked"}"
        >

          <span>
            ${achievement.icon}
          </span>

          <h3>
            ${achievement.title}
          </h3>

          <p>
            ${achievement.description}
          </p>

        </article>

      `
    ).join("");

}


/* =========================================
   EVERYTHING
   ========================================= */

function renderEverything() {

  renderHome();

  renderFilters();

  if (!state.currentChallenge) {
    generateChallenge();
  } else {
    renderChallenge(
      $("challengeDisplay"),
      state.currentChallenge
    );
  }

  renderCollection();

  renderProfile();

}


/* =========================================
   OPEN MODAL
   ========================================= */

function openChallenge(challenge) {

  if (!challenge) {
    return;
  }


  state.currentChallenge =
    challenge;


  state.seconds =
    challenge.minutes * 60;


  state.paused =
    false;


  $("modalChallenge").innerHTML = `

    <div class="challenge-meta">

      ${challenge.icon}

      ${challenge.category}

      •

      ${challenge.difficulty}

    </div>


    <h2>
      ${challenge.title}
    </h2>


    <p>
      ${challenge.prompt}
    </p>

  `;


  $("timer").textContent =
    formatTime(state.seconds);


  $("pauseTimer").textContent =
    "Pause";


  $("modal").classList.add("show");


  clearInterval(state.timer);


  state.timer =
    setInterval(
      updateTimer,
      1000
    );

}


/* =========================================
   TIMER
   ========================================= */

function updateTimer() {

  if (
    state.paused ||
    state.seconds <= 0
  ) {
    return;
  }


  state.seconds--;


  $("timer").textContent =
    formatTime(
      state.seconds
    );


  if (state.seconds === 0) {

    $("timer").textContent =
      "00:00";

  }

}


function formatTime(seconds) {

  const minutes =
    Math.floor(
      seconds / 60
    );


  const remaining =
    seconds % 60;


  return (

    String(minutes)
      .padStart(2,"0")

    +

    ":" +

    String(remaining)
      .padStart(2,"0")

  );

}


/* =========================================
   FINISH
   ========================================= */

function finishChallenge() {

  const challenge =
    state.currentChallenge;


  if (!challenge) {
    return;
  }


  clearInterval(
    state.timer
  );


  if (
    !state.history.includes(
      challenge.id
    )
  ) {

    state.history.push(
      challenge.id
    );

    state.xp +=
      challenge.xp;

  }


  const today =
    new Date()
      .toISOString()
      .slice(0,10);


  if (
    state.lastCompleted !== today
  ) {

    state.streak++;

    state.lastCompleted =
      today;

  }


  saveData();


  $("modal")
    .classList
    .remove("show");


  renderEverything();

}


/* =========================================
   NAVIGATION
   ========================================= */

document
  .querySelectorAll(".nav-btn")
  .forEach(button => {

    button.onclick = () => {

      document
        .querySelectorAll(".nav-btn")
        .forEach(btn =>
          btn.classList.remove(
            "active"
          )
        );


      button.classList.add(
        "active"
      );


      document
        .querySelectorAll(".page")
        .forEach(page =>
          page.classList.remove(
            "active"
          )
        );


      $(
        button.dataset.page
      ).classList.add(
        "active"
      );


      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

    };

  });


/* =========================================
   HOME BUTTONS
   ========================================= */

$("heroChallenge").onclick =
  () => {

    state.category =
      "All";

    generateChallenge();

    openChallenge(
      state.currentChallenge
    );

  };


$("shuffleHome").onclick =
  () => {

    state.category =
      "All";

    const challenge =
      getRandomChallenge();

    state.currentChallenge =
      challenge;

    renderChallenge(
      $("dailyChallenge"),
      challenge
    );

  };


/* =========================================
   COLLECTION TABS
   ========================================= */

document
  .querySelectorAll(".tab")
  .forEach(button => {

    button.onclick = () => {

      document
        .querySelectorAll(".tab")
        .forEach(tab =>
          tab.classList.remove(
            "active"
          )
        );


      button.classList.add(
        "active"
      );


      state.collectionTab =
        button.dataset.tab;


      renderCollection();

    };

  });


/* =========================================
   MODAL
   ========================================= */

$("closeModal").onclick =
  () => {

    $("modal")
      .classList
      .remove("show");

    clearInterval(
      state.timer
    );

  };


$("modal").onclick =
  event => {

    if (
      event.target.id === "modal"
    ) {

      $("modal")
        .classList
        .remove("show");

      clearInterval(
        state.timer
      );

    }

  };


$("pauseTimer").onclick =
  () => {

    state.paused =
      !state.paused;


    $("pauseTimer").textContent =
      state.paused
        ? "Resume"
        : "Pause";

  };


$("finishChallenge").onclick =
  finishChallenge;


/* =========================================
   DARK MODE
   ========================================= */

$("themeBtn").onclick =
  () => {

    document.body
      .classList
      .toggle("dark");


    localStorage.setItem(
      "creativebox-dark",
      document.body.classList.contains(
        "dark"
      )
    );

  };


if (
  localStorage.getItem(
    "creativebox-dark"
  ) === "true"
) {

  document.body
    .classList
    .add("dark");

}


/* =========================================
   START
   ========================================= */

loadChallenges();
