const SHEET_ID = "179t_fUJ_q0bbwxsiXIQcaxV6YLBv6_cXq8rBbq2i9eg";

const URLS = {
  teams: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Teams`,
  players: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Players`,
  scoring: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Scoring`,
};

// ------------------------------
// SUPER SAFE FETCH (DEBUG ENABLED)
// ------------------------------
async function fetchCSV(url, label) {
  try {
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`${label} HTTP error: ${res.status}`);
    }

    const text = await res.text();

    if (!text || text.includes("<html")) {
      throw new Error(`${label} returned HTML instead of CSV (sheet not public?)`);
    }

    return parseCSV(text);
  } catch (err) {
    console.error(`❌ ${label} failed:`, err);
    return null;
  }
}

// ------------------------------
// ROBUST CSV PARSER
// ------------------------------
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (cell || row.length) {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = "";
      }
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows;
}

// ------------------------------
// SCORING MAP
// ------------------------------
function buildScoringMap(scoringRows) {
  if (!scoringRows) return {};

  const map = {};

  for (let i = 1; i < scoringRows.length; i++) {
    const [stage, points] = scoringRows[i];
    if (!stage) continue;
    map[stage] = Number(points) || 0;
  }

  return map;
}

// ------------------------------
// LEADERBOARD LOGIC
// ------------------------------
function calculateLeaderboard(teams, scoringMap) {
  if (!teams) return [];

  const rows = teams.slice(1);
  const players = {};

  for (const row of rows) {
    const team = row[0];
    const owner = row[1];
    const stage = row[2];

    if (!team || !owner) continue;

    const points = scoringMap[stage] ?? 0;

    if (!players[owner]) {
      players[owner] = {
        player: owner,
        points: 0,
        teams: []
      };
    }

    players[owner].points += points;
    players[owner].teams.push(`${team} (${stage || "Unknown"})`);
  }

  return Object.values(players).sort((a, b) => b.points - a.points);
}

// ------------------------------
// CARD UI
// ------------------------------
function renderLeaderboardCards(leaderboard) {
  if (!leaderboard.length) {
    return `<p style="opacity:0.7">No leaderboard data yet</p>`;
  }

  const maxPoints = Math.max(...leaderboard.map(p => p.points), 1);

  return leaderboard.map((p, i) => {
    const rank = i + 1;

    let statusClass = "red";
    if (rank === 1) statusClass = "gold";
    else if (p.points >= maxPoints * 0.6) statusClass = "green";

    return `
      <div class="player-card ${statusClass}">
        <div class="card-top">
          <div class="rank">#${rank}</div>
          <div class="name">${p.player}</div>
          <div class="points">${p.points} pts</div>
        </div>

        <div class="teams">
          ${p.teams.map(t => `<span class="team-chip">${t}</span>`).join("")}
        </div>
      </div>
    `;
  }).join("");
}

// ------------------------------
// MAIN LOAD
// ------------------------------
async function loadData() {
  const [teams, players, scoring] = await Promise.all([
    fetchCSV(URLS.teams, "Teams"),
    fetchCSV(URLS.players, "Players"),
    fetchCSV(URLS.scoring, "Scoring"),
  ]);

  console.log("Teams:", teams);
  console.log("Players:", players);
  console.log("Scoring:", scoring);

  // graceful fallback UI
  if (!teams || !scoring) {
    document.getElementById("leaderboard").innerHTML =
      `<p style="color:#ef4444">⚠️ Data failed to load. Check Google Sheet sharing (Anyone with link → Viewer)</p>`;
    return;
  }

  const scoringMap = buildScoringMap(scoring);
  const leaderboard = calculateLeaderboard(teams, scoringMap);

  document.getElementById("leaderboard").innerHTML =
    `<div class="card-grid">${renderLeaderboardCards(leaderboard)}</div>`;

  document.getElementById("lastUpdated").innerText =
    "Last updated: " + new Date().toLocaleString();
}

// ------------------------------
loadData();
setInterval(loadData, 60000);
