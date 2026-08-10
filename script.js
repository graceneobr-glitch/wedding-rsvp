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
const API_URL = "https://script.google.com/macros/s/AKfycbxLpHNU4FOnezg_n1k60wCDc5VvM4L0EUSEwSykjn9AHP1mIy3_2jHOyRcO13z2n7rV/exec";

// Path to your floorplan image inside /assets/.
const FLOORPLAN_IMAGE = "assets/wedding-floorplan.png";

// Table coordinates as PERCENTAGES of the floorplan image's own
// width/height — measured directly from the floorplan you sent
// (1366 x 768px). Re-calibrate with seating.html?calibrate=1 if you
// ever swap in a different floorplan image.
const tablePositions = {
  "1":  { x: 1.56,  y: 18.36, width: 9.37, height: 16.67 },
  "2":  { x: 1.57,  y: 39.26, width: 9.37, height: 16.67 },
  "3":  { x: 1.56,  y: 60.17, width: 9.37, height: 16.67 },
  "4":  { x: 12.66, y: 81.08, width: 9.37, height: 16.67 },
  "5":  { x: 12.66, y: 60.17, width: 9.37, height: 16.67 },
  "6":  { x: 12.66, y: 39.26, width: 9.37, height: 16.67 },
  "7":  { x: 12.65, y: 18.36, width: 9.37, height: 16.67 },
  "8":  { x: 23.90, y: 18.39, width: 9.37, height: 16.67 },
  "9":  { x: 23.90, y: 39.27, width: 9.37, height: 16.67 },
  "10": { x: 23.89, y: 60.21, width: 9.37, height: 16.67 },
  "11": { x: 23.91, y: 81.12, width: 9.37, height: 16.67 },
  "12": { x: 34.99, y: 60.18, width: 9.37, height: 16.67 },
  "13": { x: 34.99, y: 39.26, width: 9.37, height: 16.67 },
  "14": { x: 55.43, y: 39.27, width: 9.37, height: 16.67 },
  "15": { x: 55.43, y: 60.18, width: 9.37, height: 16.67 },
  "16": { x: 66.52, y: 60.21, width: 9.37, height: 16.67 },
  "17": { x: 66.54, y: 39.28, width: 9.37, height: 16.67 },
  "18": { x: 66.50, y: 18.42, width: 9.37, height: 16.67 },
  "19": { x: 77.75, y: 18.40, width: 9.37, height: 16.67 },
  "20": { x: 77.75, y: 39.30, width: 9.37, height: 16.67 },
  "21": { x: 77.79, y: 60.18, width: 9.37, height: 16.67 },
  "22": { x: 88.88, y: 60.18, width: 9.37, height: 16.67 },
  "23": { x: 88.87, y: 39.26, width: 9.37, height: 16.67 },
  "24": { x: 88.86, y: 18.36, width: 9.37, height: 16.67 },
  "VIP1": { x: 35.01, y: 18.36, width: 9.37, height: 16.67 },
  "VIP2": { x: 55.45, y: 18.35, width: 9.37, height: 16.67 }
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

// ── Enter key support ────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("nameInput");
  if (input) {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") findGuest();
    });
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
    console.error("Seating lookup failed:", err); // technical detail stays in the console
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
    // Duplicate guest names in the sheet. Rather than silently picking
    // one, show every match so the guest (or reception staff) can pick
    // the right one. If this keeps happening, the cleanest long-term
    // fix is adding a unique "Guest ID" column to the sheet and having
    // the Apps Script match on that instead of on name alone.
    let html = `<p class="matches-header">${matches.length} matches found</p>`;
    html += matches.map((g, i) => resultCard(g, i)).join("");
    resultDiv.innerHTML = html;
    return;
  }

  resultDiv.innerHTML = resultCard(matches[0], 0);
  highlightTable(matches[0].table);
}

// ── Result card ──────────────────────────────────────────────
function resultCard(guest, delay) {
  const name  = escapeHtml(guest.name  || "Guest");
  const table = escapeHtml(guest.table || "—");

  const dietHtml = hasDiet(guest.diet)
    ? `<div class="diet-line">Special diet: ${escapeHtml(guest.diet)}</div>`
    : "";

  return `
    <div class="result-card" style="animation-delay:${delay * 80}ms">
      <div class="table-badge">
        <span class="badge-label">Table</span>
        <span class="badge-number">${table}</span>
      </div>
      <div class="result-info">
        <div class="result-name">${name}</div>
        <div class="result-desc">We're glad you're here.</div>
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
  const img = document.getElementById("floorplanImg");
  const frame = document.getElementById("floorplanFrame");
  const spotlight = document.getElementById("spotlight");
  const tag = document.getElementById("spotlightTag");
  const caption = document.getElementById("floorplanCaption");
  if (!wrap || !spotlight) return;

  if (!img.getAttribute("src")) {
    img.src = FLOORPLAN_IMAGE;
  }

  const key = String(tableNumber);
  const pos = tablePositions[key];

  if (!pos) {
    // No coordinates configured for this table — hide the floorplan
    // rather than show a broken/mispositioned highlight.
    wrap.hidden = true;
    console.warn(`No tablePositions entry for table "${key}". Add one in script.js.`);
    return;
  }

  wrap.hidden = false;
  if (caption) caption.textContent = `Table ${key} is highlighted below.`;

  spotlight.style.left   = pos.x + "%";
  spotlight.style.top    = pos.y + "%";
  spotlight.style.width  = pos.width + "%";
  spotlight.style.height = pos.height + "%";
  spotlight.hidden = false;
  if (tag) tag.textContent = key;

  // Calibration helper below only attaches its click listener once.
  if (frame && !frame.dataset.calibrateBound && isCalibrateMode()) {
    bindCalibration(frame, spotlight, tag);
    frame.dataset.calibrateBound = "1";
  }
}

/*
  Optional calibration helper — not shown to guests. Visit the page as
  seating.html?calibrate=1, then search any name so the floorplan
  renders, and click on a table to log its x/y/width/height
  percentages to the console (F12 → Console). Copy them into
  tablePositions above. Useful if you ever swap in a new floorplan.
*/
function isCalibrateMode() {
  return new URLSearchParams(window.location.search).get("calibrate") === "1";
}

function bindCalibration(frame, spotlight, tag) {
  frame.style.cursor = "crosshair";
  frame.addEventListener("click", (e) => {
    const rect = frame.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const box = {
      x: Math.round((xPct - 4.7) * 100) / 100,
      y: Math.round((yPct - 8.3) * 100) / 100,
      width: 9.37,
      height: 16.67
    };
    console.log("Table position:", JSON.stringify(box));
    spotlight.style.left = box.x + "%";
    spotlight.style.top = box.y + "%";
    spotlight.style.width = box.width + "%";
    spotlight.style.height = box.height + "%";
    spotlight.hidden = false;
    if (tag) tag.textContent = "?";
  });
}