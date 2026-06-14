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

  // 1. Process player list safely using case-insensitive mapping keys
  for (let i = 1; i < playerRows.length; i++) {
    const row = playerRows[i];
    if (!row || !row[0]) continue;
    
    const playerName = row[0].trim();
    if (playerName !== "") {
      players[playerName.toLowerCase()] = {
        player: playerName, // Retains original casing for UI rendering
        points: 0,
        teams: [] 
      };
    }
  }

  const winValue = scoringMap["MatchWin"] || 0;
  const drawValue = scoringMap["MatchDraw"] || 0;

  // 2. Clear out formatting voids and append multiple teams correctly
  for (let i = 1; i < teamRows.length; i++) {
    const row = teamRows[i];
    if (!row || row.length < 2) continue;

    const team = row[0] ? row[0].trim() : "";
    const owner = row[1] ? row[1].trim() : "";
    const stage = row[2] ? row[2].trim() : "Group";
    
    const wins = Number(row[3]) || 0;
    const draws = Number(row[4]) || 0;

    // Skip empty lines or unassigned draft slots safely
    if (!team || !owner) continue; 

    const ownerKey = owner.toLowerCase();

    // Smoothly aggregate and match data structures
    if (players[ownerKey]) {
      const stagePoints = scoringMap[stage] || 0;
      const matchPoints = (wins * winValue) + (draws * drawValue);
      
      players[ownerKey].points += stagePoints + matchPoints;
      
      const statsString = (wins > 0 || draws > 0) ? ` (${wins}W, ${draws}D)` : '';
      
      players[ownerKey].teams.push({ 
        name: `${team}${statsString}`, 
        stage: stage 
      });
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
    const initial = p.player.trim().charAt(0).toUpperCase();

    html += `
      <div class="player-tile">
        <div class="avatar-initial">${initial}</div>
        <div class="player-info">
          <div class="player-header">
            <span class="player-name">${p.player}</span>
            <span class="player-pts">${p.points} pts</span>
          </div>
          <div class="teams-container">
            ${p.teams.length > 0 ? 
              p.teams.map(t => `<span class="badge ${getTeamStatusClass(t.stage)}">${t.name}</span>`).join('') 
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

function updatePrizePoolUI(playerCount, scoringMap) {
  const entryFee = scoringMap["EntryFee"] || 0;
  const totalPool = playerCount * entryFee;

  const winnerPrize = scoringMap["PrizeWinner"] || 0;
  const runnerUpPrize = scoringMap["PrizeRunnerUp"] || 0;
  const semiPrize = scoringMap["PrizeSemiFinalist"] || 0;
  const lastPrize = scoringMap["PrizeLastPlace"] || 0;

  document.getElementById("totalPrize").innerText = `£${totalPool}`;
  document.getElementById("prizeWinner").innerText = `£${winnerPrize}`;
  document.getElementById("prizeRunnerUp").innerText = `£${runnerUpPrize}`;
  document.getElementById("prizeSemi").innerText = `£${semiPrize} each`;
  document.getElementById("prizeLast").innerText = `£${lastPrize}`;
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
    
    const activePlayerCount = leaderboard.length;
    updatePrizePoolUI(activePlayerCount, scoringMap);

    document.getElementById("lastUpdated").innerText = 
      "Last updated: " + new Date().toLocaleString('en-GB');

  } catch (err) {
    console.error(err);
    document.getElementById("leaderboard").innerHTML = "<p style='color:red'>Failed to load data</p>";
  }
}

loadData();
setInterval(loadData, 60000);
