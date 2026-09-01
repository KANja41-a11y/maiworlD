/* ==========================================================
   MAIWORLD — audio.js
   Musik latar santai dibuat langsung lewat Web Audio API
   (pad chord lo-fi + bel lembut sesekali). Tidak memakai file
   audio dari luar sama sekali, jadi 100% bebas hak cipta dan
   tidak akan pernah jadi broken link.
   ========================================================== */

const AmbientMusic = (() => {
  let ctx = null;
  let masterGain = null;
  let isPlaying = false;
  let chordTimer = null;
  let sparkleTimer = null;

  // Progresi chord hangat & santai (frekuensi dalam Hz, oktaf rendah-menengah)
  const CHORDS = [
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
    [220.00, 261.63, 329.63, 392.00], // Am7
    [174.61, 220.00, 261.63, 349.23], // Fmaj7
    [196.00, 246.94, 293.66, 392.00]  // G6
  ];
  const SPARKLE_NOTES = [523.25, 587.33, 659.25, 783.99, 880.00];

  let chordIndex = 0;

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.14;
      masterGain.connect(ctx.destination);
    }
  }

  function playChord(freqs, duration) {
    const now = ctx.currentTime;
    freqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + duration * 0.35);
      gain.gain.linearRampToValueAtTime(0, now + duration);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + duration + 0.1);
    });
  }

  function playSparkle() {
    if (!isPlaying) return;
    const note = SPARKLE_NOTES[Math.floor(Math.random() * SPARKLE_NOTES.length)];
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = note;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 1.3);
    sparkleTimer = setTimeout(playSparkle, 1800 + Math.random() * 2600);
  }

  function loopChords() {
    if (!isPlaying) return;
    const CHORD_DURATION = 4.2;
    playChord(CHORDS[chordIndex], CHORD_DURATION);
    chordIndex = (chordIndex + 1) % CHORDS.length;
    chordTimer = setTimeout(loopChords, CHORD_DURATION * 1000 * 0.92);
  }

  function start() {
    ensureContext();
    if (ctx.state === "suspended") ctx.resume();
    if (isPlaying) return;
    isPlaying = true;
    loopChords();
    sparkleTimer = setTimeout(playSparkle, 1500);
  }

  function stop() {
    isPlaying = false;
    clearTimeout(chordTimer);
    clearTimeout(sparkleTimer);
  }

  function toggle() {
    if (isPlaying) { stop(); return false; }
    start(); return true;
  }

  function setVolume(v) {
    if (masterGain) masterGain.gain.value = Math.max(0, Math.min(0.35, v));
  }

  return { start, stop, toggle, setVolume, get isPlaying() { return isPlaying; } };
})();
