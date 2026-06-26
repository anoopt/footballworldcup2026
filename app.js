const SHEET_ID = "179t_fUJ_q0bbwxsiXIQcaxV6YLBv6_cXq8rBbq2i9eg";
const cacheBuster = `&_cb=${new Date().getTime()}`;

const URLS = {
  teams: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Teams${cacheBuster}`,
  players: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Players${cacheBuster}`,
  scoring: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Scoring${cacheBuster}`,
};

// Map team names to ISO two-letter country codes for flagcdn urls
const FLAG_MAP = {
  "england": "gb-eng", "france": "fr", "argentina": "ar", "spain": "es", 
  "brazil": "br", "portugal": "pt", "germany": "de", "netherlands": "nl", 
  "belgium": "be", "croatia": "hr"
};

// 🎛️ Simple Tab-Switching Function
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  document.getElementById(tabId).classList.add('active');
  event.currentTarget.classList.add('active');
}

function parseCSV(text) {
  return text.trim().split("\n").map(row => row.split(",").map(cell => cell.replace(/"/g, "").trim()));
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

function calculateLeaderboard(playerRows, teamRows, scoringMap) {
  const players = {};
  for (let i = 1; i < playerRows.length; i++) {
    const row = playerRows[i];
    if (!row || !row[0]) continue;
    const name = row[0].trim();
    players[name.toLowerCase()] = { player: name, points: 0, teams: [] };
  }

  const winVal = scoringMap["MatchWin"] || 0;
  const drawVal = scoringMap["MatchDraw"] || 0;

  for (let i = 1; i < teamRows.length; i++) {
    const row = teamRows[i];
    if (!row || row.length < 2) continue;

    const team = row[0] || "";
    const owner = row[1] || "";
    const stage = row[2] || "Group";
    const wins = Number(row[3]) || 0;
    const draws = Number(row[4]) || 0;
    // 🛑 Grab Losses from column index 5 (6th column in the Google Sheet row)
    const losses = Number(row[5]) || 0;

    const ownerKey = owner.toLowerCase();
    if (players[ownerKey]) {
      const matchPoints = (wins * winVal) + (draws * drawVal);
      const stagePoints = scoringMap[stage] || 0;
      players[ownerKey].points += matchPoints + stagePoints;

      // Pass down losses alongside wins and draws
      players[ownerKey].teams.push({ name: team, wins, draws, losses });
    }
  }
  return Object.values(players).sort((a, b) => b.points - a.points);
}

function renderLeaderboard(leaderboard) {
  let html = '<div class="leaderboard-grid">';
  leaderboard.forEach((p, i) => {
    const initial = p.player.charAt(0).toUpperCase();
    
    html += `
      <div class="player-tile">
        <div class="avatar-initial">${initial}</div>
        <div class="player-info">
          <div class="player-header">
            <span class="player-name">${p.player}</span>
            <div style="text-align: right;">
              <span class="player-pts">${p.points} pts</span>
            </div>
          </div>
          <div class="teams-container">
            ${p.teams.map(t => {
              const code = FLAG_MAP[t.name.toLowerCase()] || "un";
              const flagUrl = `https://flagcdn.com/w40/${code}.png`;
              
              // 📊 Update the stats string to include L (Losses)
              const hasStats = t.wins > 0 || t.draws > 0 || t.losses > 0;
              const stats = hasStats ? ` (${t.wins}W, ${t.draws}D, ${t.losses}L)` : '';
              
              return `
                <span class="badge">
                  <img class="flag-icon" src="${flagUrl}" alt="${t.name}">
                  ${t.name}${stats}
                </span>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  });
  html += '</div>';
  return html;
}


function updatePrizePoolUI(playerCount, scoringMap) {
  const total = playerCount * (scoringMap["EntryFee"] || 0);
  document.getElementById("totalPrize").innerText = `£${total}`;
  document.getElementById("prizeWinner").innerText = `£${scoringMap["PrizeWinner"] || 0}`;
  document.getElementById("prizeRunnerUp").innerText = `£${scoringMap["PrizeRunnerUp"] || 0}`;
  document.getElementById("prizeSemi").innerText = `£${scoringMap["PrizeSemiFinalist"] || 0} each`;
  document.getElementById("prizeLast").innerText = `£${scoringMap["PrizeLastPlace"] || 0}`;
}

async function loadData() {
  try {
    const [teams, players, scoring] = await Promise.all([
      fetchCSV(URLS.teams), fetchCSV(URLS.players), fetchCSV(URLS.scoring)
    ]);
    const scoringMap = buildScoringMap(scoring);
    const leaderboard = calculateLeaderboard(players, teams, scoringMap);

    document.getElementById("leaderboard").innerHTML = renderLeaderboard(leaderboard);
    updatePrizePoolUI(leaderboard.length, scoringMap);
    //document.getElementById("lastUpdated").innerText = "Last updated: " + new Date().toLocaleString('en-GB');
  } catch (err) {
    console.error(err);
  }
}

loadData();
setInterval(loadData, 60000);
