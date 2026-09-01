/* ==========================================================
   MAIWORLD — pixelart.js
   Menggambar karakter chibi berlapis (badan, rambut, pakaian,
   aksesori) ke <canvas> dari data grid JSON. Semua orisinal,
   digambar lewat kode — bebas hak cipta.
   ========================================================== */

const PixelArt = (() => {
  const CELL = 8;   // ukuran satu "pixel" dalam unit canvas asli
  const COLS = 10;
  const ROWS = 14;

  const FIXED = {
    outline: "#4A3B4E",
    eye: "#3A2E39",
    blush: "#FF8FA3",
    shoe: "#7A5A45"
  };

  function drawLayerGrid(ctx, grid, code, hex) {
    if (!grid) return;
    for (let row = 0; row < ROWS; row++) {
      const line = grid[row] || "";
      for (let col = 0; col < COLS; col++) {
        if (line[col] === code) {
          ctx.fillStyle = hex;
          ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
        }
      }
    }
  }

  function drawBody(ctx, grid, skinHex) {
    const map = { S: skinHex, E: FIXED.eye, M: FIXED.blush, F: FIXED.shoe };
    for (let row = 0; row < ROWS; row++) {
      const line = grid[row] || "";
      for (let col = 0; col < COLS; col++) {
        const code = line[col];
        if (code && code !== "." && map[code]) {
          ctx.fillStyle = map[code];
          ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
        }
      }
    }
  }

  /**
   * Draw a full character onto a canvas.
   * @param {HTMLCanvasElement} canvas
   * @param {object} data - all grids + colors + accessory id, e.g.:
   * {
   *   bodyGrid, skinHex,
   *   hairGrid, hairHex,
   *   clothingMode: 'dress' | 'topbottom',
   *   dressGrid, dressHex,
   *   topGrid, topHex, bottomGrid, bottomHex,
   *   accessory
   * }
   */
  function draw(canvas, data) {
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBody(ctx, data.bodyGrid, data.skinHex);
    drawLayerGrid(ctx, data.hairGrid, "H", data.hairHex);

    if (data.clothingMode === "dress") {
      drawLayerGrid(ctx, data.dressGrid, "D", data.dressHex);
    } else {
      drawLayerGrid(ctx, data.topGrid, "T", data.topHex);
      drawLayerGrid(ctx, data.bottomGrid, "L", data.bottomHex);
    }

    drawAccessory(ctx, data.accessory);
  }

  function drawAccessory(ctx, accessory) {
    if (!accessory || accessory === "none") return;

    if (accessory === "kacamata") {
      const y = 3 * CELL + CELL / 2;
      ctx.strokeStyle = FIXED.outline;
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(3.4 * CELL, y, CELL * 0.7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(6.6 * CELL, y, CELL * 0.7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4.1 * CELL, y); ctx.lineTo(5.9 * CELL, y); ctx.stroke();
    }

    if (accessory === "pita") {
      const cx = COLS * CELL / 2;
      const cy = 0.6 * CELL;
      ctx.fillStyle = "#FF6F9C";
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - 12, cy - 7); ctx.lineTo(cx - 12, cy + 7); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 12, cy - 7); ctx.lineTo(cx + 12, cy + 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#E64980";
      ctx.fillRect(cx - 3, cy - 4, 6, 8);
    }

    if (accessory === "topi") {
      const cx = COLS * CELL / 2;
      ctx.fillStyle = "#B8A9FF";
      ctx.beginPath();
      ctx.ellipse(cx, 0.3 * CELL, 4.4 * CELL, 1 * CELL, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#FFE29A";
      ctx.fillRect(cx - 4.4 * CELL, 0.15 * CELL, 8.8 * CELL, CELL * 0.35);
    }

    if (accessory === "tas") {
      ctx.fillStyle = "#FFC9A9";
      ctx.fillRect(8.1 * CELL, 6.6 * CELL, CELL * 1.6, CELL * 1.6);
      ctx.strokeStyle = FIXED.outline;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(8.1 * CELL, 6.6 * CELL, CELL * 1.6, CELL * 1.6);
      ctx.beginPath();
      ctx.moveTo(8.3 * CELL, 6.6 * CELL);
      ctx.quadraticCurveTo(8.9 * CELL, 5.2 * CELL, 9.5 * CELL, 6.6 * CELL);
      ctx.stroke();
    }

    if (accessory === "sayap") {
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.strokeStyle = "#D4C4FF";
      ctx.lineWidth = 1.2;
      [-0.3, COLS + 0.3].forEach((cx, i) => {
        ctx.beginPath();
        ctx.ellipse(cx * CELL, 7.5 * CELL, CELL * 1.1, CELL * 1.7, i === 0 ? 0.4 : -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    if (accessory === "bunga") {
      const cx = 8.6 * CELL, cy = 2.4 * CELL, r = CELL * 0.35;
      ctx.fillStyle = "#FFB6D1";
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 / 5) * i;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, r * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#FFE29A";
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  return { draw, CELL, COLS, ROWS };
})();
