const SHEET_ID = "179t_fUJ_q0bbwxsiXIQcaxV6YLBv6_cXq8rBbq2i9eg";

const URLS = {
  teams: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Teams`,
  players: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Players`,
  scoring: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Scoring`,
};

// ---------- SIMPLE CSV PARSER ----------
function parseCSV(text) {
  return text
    .trim()
    .split("\n")
    .map(row => row.split(",").map(cell => cell.replace(/"/g, "").trim()));
}

// ---------- FETCH ----------
async function fetchCSV(url) {
  const res = await fetch(url);
  const text = await res.text();
  return parseCSV(text);
}

// ---------- SCORING ----------
function buildScoringMap(scoring) {
  const map = {};
  for (let i = 1; i < scoring.length; i++) {
    const [stage, points] = scoring[i];
    if (stage) map[stage] = Number(points) || 0;
  }
  return map;
}

// ---------- LEADERBOARD ----------
function calculateLeaderboard(playerRows, teamRows, scoringMap) {
  const players = {};

  // 1. Initialize all players from your Players tab so they show up instantly
  for (let i = 1; i < playerRows.length; i++) {
    const playerName = playerRows[i][0];
    if (playerName && playerName.trim() !== "") {
      players[playerName] = {
        player: playerName,
        points: 0,
        teams: []
      };
    }
  }

  // 2. Add team data if owners are assigned
  for (let i = 1; i < teamRows.length; i++) {
    const row = teamRows[i];
    if (!row || row.length < 2) continue;

    const team = row[0];
    const owner = row[1];
    const stage = row[2] || "Group";

    if (owner && players[owner]) {
      const points = scoringMap[stage] || 0;
      players[owner].points += points;
      if (team) players[owner].teams.push(team);
    }
  }

  return Object.values(players).sort((a, b) => b.points - a.points);
}

// ---------- RENDER ----------
function renderLeaderboard(leaderboard) {
  if (leaderboard.length === 0) {
    return `<p style="color: #8a99ad; font-style: italic; margin: 10px 0;">No players found in database.</p>`;
  }

  return leaderboard.map((p, i) => `
    <div style="padding: 12px 0; border-bottom: 1px solid #1f2a44;">
      <b style="font-size: 16px;">#${i + 1} ${p.player}</b> — ${p.points} pts
      <div class="team" style="color: #8a99ad; margin-top: 4px; font-size: 13px;">
        ${p.teams.length > 0 ? p.teams.join(", ") : "<i>🎟️ No teams drawn yet (Draft Pending)</i>"}
      </div>
    </div>
  `).join("");
}

// ---------- LOAD ----------
async function loadData() {
  try {
    const [teams, players, scoring] = await Promise.all([
      fetchCSV(URLS.teams),
      fetchCSV(URLS.players),
      fetchCSV(URLS.scoring),
    ]);

    const scoringMap = buildScoringMap(scoring);
    const leaderboard = calculateLeaderboard(players, teams, scoringMap);

    document.getElementById("leaderboard").innerHTML = renderLeaderboard(leaderboard);

    document.getElementById("lastUpdated").innerText =
      "Last updated: " + new Date().toLocaleString();

  } catch (err) {
    console.error(err);
    document.getElementById("leaderboard").innerHTML =
      "<p style='color:red'>Failed to load data</p>";
  }
}

// Initial pull on load
loadData();

// Re-check for sheet entries automatically every 60 seconds
setInterval(loadData, 60000);
