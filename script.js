/* ============================================================
   WEDDING SEATING — script.js
   ============================================================ */

let guests = [];
let dataLoaded = false;

// ── Fetch guest list ─────────────────────────────────────────
fetch("https://opensheet.elk.sh/YOUR_SHEET_ID/Sheet1")
  .then(res => {
    if (!res.ok) throw new Error("Network response was not ok");
    return res.json();
  })
  .then(data => {
    guests = data;
    dataLoaded = true;
  })
  .catch(() => {
    dataLoaded = false;
  });

// ── Enter key support ────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("nameInput");
  if (input) {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") findGuest();
    });
  }
});

// ── Main search ──────────────────────────────────────────────
function findGuest() {
  const raw   = document.getElementById("nameInput").value.trim();
  const query = raw.toLowerCase();
  const resultDiv = document.getElementById("result");

  if (!query) {
    resultDiv.innerHTML = notFoundCard(
      "Nothing entered",
      "Please type your name so we can find your seat."
    );
    return;
  }

  if (!dataLoaded) {
    resultDiv.innerHTML = notFoundCard(
      "Just a moment…",
      "The guest list is still loading. Please try again in a bit."
    );
    return;
  }

  const matches = guests.filter(g =>
    g.Name && g.Name.toLowerCase().includes(query)
  );

  if (matches.length === 0) {
    resultDiv.innerHTML = notFoundCard(
      "Name not found",
      `We couldn't find a match for "<em>${escapeHtml(raw)}</em>". Try a shorter version of your name, or ask one of our team for help.`
    );
    return;
  }

  let html = "";
  if (matches.length > 1) {
    html += `<p class="matches-header">${matches.length} matches found</p>`;
  }
  html += matches.map((g, i) => resultCard(g, i)).join("");
  resultDiv.innerHTML = html;
}

// ── Result card ──────────────────────────────────────────────
function resultCard(guest, delay) {
  const name  = escapeHtml(guest.Name  || "Guest");
  const table = escapeHtml(guest.Table || "—");

  return `
    <div class="result-card" style="animation-delay:${delay * 80}ms">
      <div class="table-badge">
        <span class="badge-label">Table</span>
        <span class="badge-number">${table}</span>
      </div>
      <div class="result-info">
        <div class="result-name">${name}</div>
        <div class="result-desc">We're glad you're here.</div>
      </div>
    </div>
  `;
}

// ── Not found card ───────────────────────────────────────────
function notFoundCard(title, message) {
  return `
    <div class="not-found-card">
      <strong>${title}</strong>
      <p>${message}</p>
    </div>
  `;
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