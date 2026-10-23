/* ============================================================
   WEDDING SEATING — script.js
   ============================================================ */

/* ============================================================
   CONFIGURATION — edit only this block for day-to-day changes
   ============================================================ */

const API_URL = "https://script.google.com/macros/s/AKfycbxGcSqWaRCECq9HZ4cZRoZtZK_OGJ2qEYPMRiorQcItfqjQkCFCsCY0duveYKeBPtus/exec";

const FLOORPLAN_IMAGE = "assets/wedding-floorplan.jpg";



/* ============================================================
   Below this line is page logic — shouldn't need routine edits.
   ============================================================ */

const searchCache = new Map();

const NO_DIET_VALUES = new Set([
  "", "none", "n/a", "na", "no", "nil", "no restrictions", "no restriction", "no dietary requirements"
]);

function hasDiet(diet) {
  if (diet === null || diet === undefined) return false;
  const cleaned = String(diet).trim().toLowerCase();
  return cleaned.length > 0 && !NO_DIET_VALUES.has(cleaned);
}

function normaliseName(raw) {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("nameInput");
  if (input) {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") findGuest();
    });
  }
  const img = document.getElementById("floorplanImg");
  if (img) img.src = FLOORPLAN_IMAGE;
});

async function fetchMatches(normalisedName) {
  if (searchCache.has(normalisedName)) return searchCache.get(normalisedName);
  const url = `${API_URL}?name=${encodeURIComponent(normalisedName)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Network response was not ok");
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("Unexpected response shape");
  searchCache.set(normalisedName, data);
  return data;
}

async function findGuest() {
  const raw = document.getElementById("nameInput").value.trim();
  const query = normaliseName(raw);
  const resultDiv = document.getElementById("result");

  hideFloorplan();

  if (!query) {
    resultDiv.innerHTML = notFoundCard("Nothing entered", "Please type your name so we can find your seat.");
    return;
  }

  if (!API_URL || API_URL.includes("PASTE_")) {
    resultDiv.innerHTML = notFoundCard("Just a moment…", "Please seek assistance at the reception.");
    console.warn("API_URL is not configured yet.");
    return;
  }

  resultDiv.innerHTML = loadingCard();

  let matches;
  try {
    matches = await fetchMatches(query);
  } catch (err) {
    console.error("Seating lookup failed:", err);
    resultDiv.innerHTML = notFoundCard("We're having trouble looking that up", "Please seek assistance at the reception.");
    return;
  }

  if (matches.length === 0) {
    resultDiv.innerHTML = notFoundCard("Oops — we can't find your name!", "But it's us, not you. Please seek assistance at the reception.");
    return;
  }

  if (matches.length > 1) {
    let html = `<p class="matches-header">${matches.length} matches found</p>`;
    html += matches.map((g, i) => resultCard(g, i)).join("");
    resultDiv.innerHTML = html;
    showFloorplan();
    return;
  }

  resultDiv.innerHTML = resultCard(matches[0], 0);
  showFloorplan();
}

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
      <div class="table-badge">${badgeMarkup(table)}</div>
      <div class="result-info">
        <div class="result-name">${name}</div>
        <div class="result-desc">We're glad you're here!</div>
        ${dietHtml}
      </div>
    </div>
  `;
}

function notFoundCard(title, message) {
  return `<div class="not-found-card"><strong>${title}</strong><p>${message}</p></div>`;
}

function loadingCard() {
  return `<p class="loading-text">Finding your seat…</p>`;
}

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
  if (wrap) wrap.hidden = true;
}

function showFloorplan() {
  const wrap    = document.getElementById("floorplanWrap");
  const caption = document.getElementById("floorplanCaption");
  if (!wrap) return;
  wrap.hidden = false;
  if (caption) caption.textContent = "";
}