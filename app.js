const SHEET_ID = "179t_fUJ_q0bbwxsiXIQcaxV6YLBv6_cXq8rBbq2i9eg";

const URLS = {
  teams: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Teams`,
  players: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Players`,
  scoring: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Scoring`,
};

// ------------------------------
// SAFE CSV PARSER
// ------------------------------
function parseCSV(text) {
  const lines = text.trim().split("\n");

  return lines.map(line => {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  });
}

async function fetchCSV(url) {
  const res = await fetch(url);
  const text = await res.text();
  return parseCSV(text);
}

// ------------------------------
// SCORING MAP
// ------------------------------
function buildScoringMap(scoringRows) {
  const map = {};

  for (let i = 1; i < scoringRows.length; i++) {
    const [stage, points] = scoringRows[i];
    if (!stage) continue;
    map[stage] = Number(points) || 0;
  }

  return map;
}

// ------------------------------
// LEADERBOARD CALCULATION
// ------------------------------
function calculateLeaderboard(teams, scoringMap) {
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
// CARD RENDERING (ESPN STYLE)
// ------------------------------
function renderLeaderboardCards(leaderboard) {
  if (!leaderboard.length) {
    return `<p style="opacity:0.7">No data available</p>`;
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
// MAIN LOAD FUNCTION
// ------------------------------
async function loadData() {
  try {
    const [teams, players, scoring] = await Promise.all([
      fetchCSV(URLS.teams),
      fetchCSV(URLS.players),
      fetchCSV(URLS.scoring),
    ]);

    const scoringMap = buildScoringMap(scoring);
    const leaderboard = calculateLeaderboard(teams, scoringMap);

    document.getElementById("leaderboard").innerHTML =
      `<div class="card-grid">${renderLeaderboardCards(leaderboard)}</div>`;

    document.getElementById("lastUpdated").innerText =
      "Last updated: " + new Date().toLocaleString();

  } catch (err) {
    console.error(err);

    document.getElementById("leaderboard").innerHTML =
      `<p style="color:#ef4444">⚠️ Failed to load data. Check Google Sheet sharing permissions.</p>`;
  }
}

// ------------------------------
// INIT
// ------------------------------
loadData();
setInterval(loadData, 60000);
