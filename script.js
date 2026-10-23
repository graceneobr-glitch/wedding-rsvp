/* ============================================================
   WEDDING SEATING — script.js
   ============================================================ */

/* ============================================================
   CONFIGURATION — edit only this block for day-to-day changes
   ============================================================ */

// Your deployed Google Apps Script Web App URL. This endpoint
// searches your sheet SERVER-SIDE and returns only the guest(s)
// matching the requested name — it never sends your full guest
// list to the browser (see Code.gs for why that matters for
// privacy on a public page).
const API_URL = "https://script.google.com/macros/s/AKfycbxGcSqWaRCECq9HZ4cZRoZtZK_OGJ2qEYPMRiorQcItfqjQkCFCsCY0duveYKeBPtus/exec";

// Path to your floorplan image inside /assets/.
const FLOORPLAN_IMAGE = "assets/wedding-floorplan.jpg";

// Table coordinates as PERCENTAGES of the floorplan image's own
// width/height — remapped from the updated floorplan (1366x768px).
// Re-calibrate with seating.html?calibrate=1 if you ever swap in
// a different floorplan image.
const tablePositions = {
  "1":    { x: 0.73,  y: 51.69, width: 9.52,  height: 16.93 },
  "2":    { x: 12.45, y: 79.04, width: 9.52,  height: 16.93 },
  "3":    { x: 12.45, y: 59.51, width: 9.52,  height: 16.93 },
  "4":    { x: 12.45, y: 38.67, width: 9.52,  height: 16.93 },
  "5":    { x: 12.45, y: 16.54, width: 9.52,  height: 16.93 },
  "6":    { x: 23.65, y: 16.54, width: 9.52,  height: 16.93 },
  "7":    { x: 23.65, y: 38.67, width: 9.52,  height: 16.93 },
  "8":    { x: 23.65, y: 59.51, width: 9.52,  height: 16.93 },
  "9":    { x: 23.65, y: 79.04, width: 9.52,  height: 16.93 },
  "10":   { x: 34.77, y: 71.22, width: 9.52,  height: 16.93 },
  "11":   { x: 34.77, y: 49.09, width: 9.52,  height: 16.93 },
  "VIP1": { x: 33.82, y: 25.26, width: 11.42, height: 20.31 },
  "VIP2": { x: 54.47, y: 25.26, width: 11.42, height: 20.31 },
  "12":   { x: 55.42, y: 49.09, width: 9.52,  height: 16.93 },
  "13":   { x: 55.42, y: 71.22, width: 9.52,  height: 16.93 },
  "14":   { x: 65.67, y: 80.34, width: 9.52,  height: 16.93 },
  "15":   { x: 65.67, y: 59.51, width: 9.52,  height: 16.93 },
  "16":   { x: 65.67, y: 38.67, width: 9.52,  height: 16.93 },
  "17":   { x: 65.67, y: 16.54, width: 9.52,  height: 16.93 },
  "18":   { x: 77.09, y: 16.54, width: 9.52,  height: 16.93 },
  "19":   { x: 77.09, y: 38.67, width: 9.52,  height: 16.93 },
  "20":   { x: 77.09, y: 59.51, width: 9.52,  height: 16.93 },
  "21":   { x: 77.09, y: 80.34, width: 9.52,  height: 16.93 },
  "22":   { x: 89.68, y: 51.69, width: 9.52,  height: 16.93 },
};

/* ============================================================
   Below this line is page logic — shouldn't need routine edits.
   ============================================================ */

// Session-level cache: since each search now calls the API (instead
// of one big preload), this just avoids re-hitting it for a name
// that was already searched this visit.
const searchCache = new Map();

// Values in the "Dietary Restrictions" column that mean "no special
// diet" and should NOT show a "Special diet: …" line.
const NO_DIET_VALUES = new Set([
  "", "none", "n/a", "na", "no", "nil", "no restrictions", "no restriction", "no dietary requirements"
]);

function hasDiet(diet) {
  if (diet === null || diet === undefined) return false;
  const cleaned = String(diet).trim().toLowerCase();
  return cleaned.length > 0 && !NO_DIET_VALUES.has(cleaned);
}

// Trim, collapse multiple spaces, lowercase — "Grace Neo",
// "grace neo", and "  GRACE   NEO " all resolve the same way.
function normaliseName(raw) {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

// ── Enter key support + early floorplan image check ─────────
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("nameInput");
  if (input) {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") findGuest();
    });
  }

  // Set the floorplan image source up front (rather than waiting for
  // the first search) so a bad path fails fast and is easy to spot
  // in the console, instead of only surfacing after someone searches.
  const img = document.getElementById("floorplanImg");
  if (img) {
    img.src = FLOORPLAN_IMAGE;
  }
});

// ── Fetch a single guest's matches from the Apps Script endpoint ──
// Returns an array: empty (not found), one item (found), or more
// than one (duplicate names in the sheet).
async function fetchMatches(normalisedName) {
  if (searchCache.has(normalisedName)) {
    return searchCache.get(normalisedName);
  }

  const url = `${API_URL}?name=${encodeURIComponent(normalisedName)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected response shape");
  }

  searchCache.set(normalisedName, data);
  return data;
}

// ── Main search ──────────────────────────────────────────────
async function findGuest() {
  const raw = document.getElementById("nameInput").value.trim();
  const query = normaliseName(raw);
  const resultDiv = document.getElementById("result");

  hideFloorplan();

  if (!query) {
    resultDiv.innerHTML = notFoundCard(
      "Nothing entered",
      "Please type your name so we can find your seat."
    );
    return;
  }

  if (!API_URL || API_URL.includes("PASTE_")) {
    resultDiv.innerHTML = notFoundCard(
      "Just a moment…",
      "Please seek assistance at the reception."
    );
    console.warn("API_URL is not configured yet.");
    return;
  }

  resultDiv.innerHTML = loadingCard();

  let matches;
  try {
    matches = await fetchMatches(query);
  } catch (err) {
    console.error("Seating lookup failed:", err);
    resultDiv.innerHTML = notFoundCard(
      "We're having trouble looking that up",
      "Please seek assistance at the reception."
    );
    return;
  }

  if (matches.length === 0) {
    resultDiv.innerHTML = notFoundCard(
      "Oops — we can't find your name!",
      "But it's us, not you. Please seek assistance at the reception."
    );
    return;
  }

  if (matches.length > 1) {
    let html = `<p class="matches-header">${matches.length} matches found</p>`;
    html += matches.map((g, i) => resultCard(g, i)).join("");
    resultDiv.innerHTML = html;
    return;
  }

  resultDiv.innerHTML = resultCard(matches[0], 0);
  highlightTable(matches[0].table);
}

// ── Result card ──────────────────────────────────────────────
function badgeMarkup(tableValue) {
  const str = String(tableValue).trim();
  const vipMatch = str.match(/^vip\s*(\d+)$/i);

  if (vipMatch) {
    return `
      <span class="badge-vip-line">VIP</span>
      <span class="badge-vip-line">${escapeHtml(vipMatch[1])}</span>
    `;
  }

  return `
    <span class="badge-label">Table</span>
    <span class="badge-number">${escapeHtml(str || "—")}</span>
  `;
}

function resultCard(guest, delay) {
  const name  = escapeHtml(guest.name || "Guest");
  const table = guest.table || "—";

  const dietHtml = hasDiet(guest.diet)
    ? `<div class="diet-line">Special diet: ${escapeHtml(guest.diet)}</div>`
    : "";

  return `
    <div class="result-card" style="animation-delay:${delay * 80}ms">
      <div class="table-badge">
        ${badgeMarkup(table)}
      </div>
      <div class="result-info">
        <div class="result-name">${name}</div>
        <div class="result-desc">We're glad you're here!</div>
        ${dietHtml}
      </div>
    </div>
  `;
}

// ── Not found / error card ──────────────────────────────────
function notFoundCard(title, message) {
  return `
    <div class="not-found-card">
      <strong>${title}</strong>
      <p>${message}</p>
    </div>
  `;
}

// ── Loading card ─────────────────────────────────────────────
function loadingCard() {
  return `<p class="loading-text">Finding your seat…</p>`;
}

// ── Escape HTML to prevent XSS ───────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ============================================================
   Floorplan highlighting
   ============================================================ */

function hideFloorplan() {
  const wrap = document.getElementById("floorplanWrap");
  const spotlight = document.getElementById("spotlight");
  if (wrap) wrap.hidden = true;
  if (spotlight) spotlight.hidden = true;
}

function highlightTable(tableNumber) {
  const wrap = document.getElementById("floorplanWrap");
  const frame = document.getElementById("floorplanFrame");
  const spotlight = document.getElementById("spotlight");
  const caption = document.getElementById("floorplanCaption");
  if (!wrap || !spotlight) return;

  // Normalise: "VIP 1" → "VIP1", "12" stays "12"
  const rawKey = String(tableNumber);
  const key = rawKey.trim().toUpperCase().replace(/\s+/g, "");
  const pos = tablePositions[key];

  if (!pos) {
    wrap.hidden = true;
    console.warn(`No tablePositions entry for table "${rawKey}" (normalised: "${key}"). Add one in script.js.`);
    return;
  }

  wrap.hidden = false;
  if (caption) caption.textContent = "";

  spotlight.style.left   = pos.x + "%";
  spotlight.style.top    = pos.y + "%";
  spotlight.style.width  = pos.width + "%";
  spotlight.style.height = pos.height + "%";
  spotlight.hidden = false;

  if (frame && !frame.dataset.calibrateBound && isCalibrateMode()) {
    bindCalibration(frame, spotlight);
    frame.dataset.calibrateBound = "1";
  }
}

/*
  Optional calibration helper — not shown to guests. Visit the page as
  seating.html?calibrate=1, search any name so the floorplan renders,
  then click a table to log its x/y/width/height percentages to the
  console (F12 → Console). Copy them into tablePositions above.
*/
function isCalibrateMode() {
  return new URLSearchParams(window.location.search).get("calibrate") === "1";
}

function bindCalibration(frame, spotlight) {
  frame.style.cursor = "crosshair";
  frame.addEventListener("click", (e) => {
    const rect = frame.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const r_w = 9.52;
    const r_h = 16.93;
    const box = {
      x: Math.round((xPct - r_w / 2) * 100) / 100,
      y: Math.round((yPct - r_h / 2) * 100) / 100,
      width: r_w,
      height: r_h
    };
    console.log("Table position:", JSON.stringify(box));
    spotlight.style.left   = box.x + "%";
    spotlight.style.top    = box.y + "%";
    spotlight.style.width  = box.width + "%";
    spotlight.style.height = box.height + "%";
    spotlight.hidden = false;
  });
}