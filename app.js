const SHEET_ID = "179t_fUJ_q0bbwxsiXIQcaxV6YLBv6_cXq8rBbq2i9eg";

const URLS = {
  teams: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Teams`,
  players: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Players`,
  scoring: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Scoring`,
};

function parseCSV(text) {
  return text
    .trim()
    .split("\n")
    .map(row => row.split(",").map(cell => cell.replace(/"/g, "").trim()));
}

async function fetchCSV(url) {
  const res = await fetch(url);
  const text = await res.text();
  return parseCSV(text);
}

function buildScoringMap(scoring) {
  const map = {};
  for (let i = 1; i < scoring.length; i++) {
    const [stage, points] = scoring[i];
    if (stage) map[stage] = Number(points) || 0;
  }
  return map;
}

// Helper to determine team highlights dynamically
function getTeamStatusClass(stage) {
  if (!stage || stage === "Group") return "badge-advancing"; 
  if (stage === "Winner") return "badge-winner";
  
  const eliminatedStages = ["Round32", "Round16", "Quarter", "Semi", "RunnerUp"];
  if (eliminatedStages.includes(stage)) {
    return "badge-eliminated";
  }
  return "badge-advancing";
}

function calculateLeaderboard(playerRows, teamRows, scoringMap) {
  const players = {};

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

  for (let i = 1; i < teamRows.length; i++) {
    const row = teamRows[i];
    if (!row || row.length < 2) continue;

    const team = row[0];
    const owner = row[1];
    const stage = row[2] || "Group";

    if (owner && players[owner]) {
      const points = scoringMap[stage] || 0;
      players[owner].points += points;
      if (team) {
        players[owner].teams.push({ name: team, stage: stage });
      }
    }
  }

  return Object.values(players).sort((a, b) => b.points - a.points);
}

function renderLeaderboard(leaderboard) {
  if (leaderboard.length === 0) {
    return `<p style="color: #8a99ad; font-style: italic;">No players found.</p>`;
  }

  let html = '<div class="leaderboard-grid">';
  
  leaderboard.forEach((p, i) => {
    // Get the first character of the name for the initial avatar badge
    const initial = p.player.trim().charAt(0).toUpperCase();

    html += `
      <div class="player-tile">
        <div class="avatar-initial">${initial}</div>
        <div class="player-info">
          <div class="player-header">
            <span class="player-name">${i + 1}. ${p.player}</span>
            <span class="player-pts">${p.points} pts</span>
          </div>
          <div class="teams-container">
            ${p.teams.length > 0 ? 
              p.teams.map(t => `<span class="badge ${getTeamStatusClass(t.stage)}">${t.name} (${t.stage})</span>`).join('') 
              : `<span class="badge badge-pending">🎟️ Draft Pending</span>`
            }
          </div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

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
    
    // Forces the date output to strict UK notation
    document.getElementById("lastUpdated").innerText = 
      "Last updated: " + new Date().toLocaleString('en-GB');

  } catch (err) {
    console.error(err);
    document.getElementById("leaderboard").innerHTML = "<p style='color:red'>Failed to load data</p>";
  }
}

loadData();
setInterval(loadData, 60000);
