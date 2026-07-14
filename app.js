const SHEET_ID = "179t_fUJ_q0bbwxsiXIQcaxV6YLBv6_cXq8rBbq2i9eg";
const cacheBuster = `&_cb=${new Date().getTime()}`;

const URLS = {
  teams: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Teams${cacheBuster}`,
  players: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Players${cacheBuster}`,
  scoring: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Scoring${cacheBuster}`,
};

// Map team names to ISO two-letter country codes for flagcdn urls.
const FLAG_MAP = {
  "england": "gb-eng", "france": "fr", "argentina": "ar", "spain": "es", 
  "brazil": "br", "portugal": "pt", "germany": "de", "netherlands": "nl", 
  "belgium": "be", "croatia": "hr"
};

// 🏁 Friendly labels for each knockout stage (shown as a pill on the badge)
const STAGE_LABELS = {
  "Group": "Group Stage",
  "Round32": "Round of 32",
  "Round16": "Round of 16",
  "Quarter": "Quarter-final",
  "Semi": "Semi-final",
  "Final": "Final",
  "RunnerUp": "Runner-up",
  "Winner": "Champion 🏆"
};

// 🎛️ Simple Tab-Switching Function
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  document.getElementById(tabId).classList.add('active');
  event.currentTarget.classList.add('active');
}

// 🔍 Toggle a team's points-breakdown panel open/closed
function toggleDetails(detailsId) {
  const el = document.getElementById(detailsId);
  if (el) el.classList.toggle('open');
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

// ❌ Treat common truthy values in the Eliminated column as "knocked out"
function isEliminated(value) {
  if (!value) return false;
  const v = value.toString().trim().toLowerCase();
  return ["yes", "y", "true", "1", "out", "eliminated", "knocked out"].includes(v);
}

// 🪜 Knockout rounds in order. RunnerUp/Winner are the two possible Final outcomes
// that sit on top of this sequence.
const STAGE_SEQUENCE = ["Round32", "Round16", "Quarter", "Semi", "Final"];

// 🧮 Cumulative stage bonus: a team earns the bonus for EVERY round it has passed.
// Returns an ordered list of { label, points } rows (Group = 0 is skipped).
function stageBreakdown(stage, scoringMap) {
  const rows = [];
  const add = (key) => {
    const pts = scoringMap[key] || 0;
    if (pts) rows.push({ label: STAGE_LABELS[key] || key, points: pts });
  };
  if (!stage || stage === "Group") return rows;

  if (stage === "Winner" || stage === "RunnerUp") {
    STAGE_SEQUENCE.forEach(add);
    add(stage);
    return rows;
  }

  const idx = STAGE_SEQUENCE.indexOf(stage);
  if (idx === -1) { add(stage); return rows; }
  for (let i = 0; i <= idx; i++) add(STAGE_SEQUENCE[i]);
  return rows;
}

// 🔢 Round to 1 decimal and drop a trailing .0 for clean display (group draws give .5s)
function fmt(n) {
  return Number(Number(n).toFixed(1));
}

function calculateLeaderboard(playerRows, teamRows, scoringMap) {
  const players = {};
  for (let i = 1; i < playerRows.length; i++) {
    const row = playerRows[i];
    if (!row || !row[0]) continue;
    const name = row[0].trim();
    const photo = row[1] ? row[1].trim() : null;
    players[name.toLowerCase()] = { player: name, photo, points: 0, teams: [] };
  }

  // 🪙 Small frozen group bonus (group stage only)
  const groupWinVal = scoringMap["GroupWin"] || 0;
  const groupDrawVal = scoringMap["GroupDraw"] || 0;

  for (let i = 1; i < teamRows.length; i++) {
    const row = teamRows[i];
    if (!row || row.length < 2) continue;

    const team = row[0] || "";
    const owner = row[1] || "";
    const stage = row[2] || "Group";
    // D/E/F are the FROZEN group-stage record (group only – knockouts use Stage)
    const wins = Number(row[3]) || 0;
    const draws = Number(row[4]) || 0;
    const losses = Number(row[5]) || 0;
    // ❌ Elimination flag from column index 6 (column G in the Google Sheet)
    const eliminated = isEliminated(row[6]);

    const ownerKey = owner.toLowerCase();
    if (players[ownerKey]) {
      const groupBonus = (wins * groupWinVal) + (draws * groupDrawVal);
      const stageRows = stageBreakdown(stage, scoringMap);
      const stagePoints = stageRows.reduce((sum, r) => sum + r.points, 0);
      const score = groupBonus + stagePoints;

      players[ownerKey].teams.push({
        name: team, wins, draws, losses, eliminated, stage,
        groupBonus, stagePoints, stageRows, score
      });
    }
  }

  // ➕ A player's total is simply both teams added together
  const list = Object.values(players);
  list.forEach(p => {
    p.points = fmt(p.teams.reduce((sum, t) => sum + t.score, 0));
  });

  return list.sort((a, b) => b.points - a.points);
}

function renderLeaderboard(leaderboard) {
  let html = '<div class="leaderboard-grid">';
  leaderboard.forEach((p, i) => {
    const initial = p.player.charAt(0).toUpperCase();
    const avatarHtml = p.photo
      ? `<img class="avatar-photo" src="${p.photo}" alt="${p.player}">`
      : `<div class="avatar-initial">${initial}</div>`;
    
    html += `
      <div class="player-tile">
        <div class="player-header">
          <span class="player-name">${p.player}</span>
          <span class="player-pts">${p.points} pts</span>
        </div>
        <div class="player-teams-row">
          ${avatarHtml}
          <div class="teams-container">
            ${p.teams.map((t, ti) => {
              const code = FLAG_MAP[t.name.toLowerCase()] || "un";
              const flagUrl = `https://flagcdn.com/w40/${code}.png`;

              // ❌ Mark eliminated teams as knocked out
              const badgeClass = t.eliminated ? 'badge eliminated' : 'badge';

              // 🏁 One pill for all: progress for live teams, or ✕ + exit round for eliminated
              const stageLabel = STAGE_LABELS[t.stage] || t.stage || '';
              const stagePill = stageLabel
                ? `<span class="stage-pill${t.eliminated ? ' out' : ''}">${t.eliminated ? '✕ ' : ''}${stageLabel}</span>`
                : '';

              // 🔍 Points breakdown, revealed on click (group bonus + cumulative stage bonuses)
              const detailsId = `details-${i}-${ti}`;
              const stageRowsHtml = t.stageRows.map(r =>
                `<div class="detail-row"><span>🏁 ${r.label}</span><span>${fmt(r.points)} pts</span></div>`
              ).join('');

              return `
                <div class="team-item">
                  <span class="${badgeClass}" onclick="toggleDetails('${detailsId}')">
                    <img class="flag-icon" src="${flagUrl}" alt="${t.name}">
                    <span class="team-label">${t.name}</span>
                    ${stagePill}
                    <span class="expand-caret">▾</span>
                  </span>
                  <div class="badge-details" id="${detailsId}">
                    <div class="detail-row"><span>⚽ Group stage (${t.wins}W ${t.draws}D ${t.losses}L)</span><span>${fmt(t.groupBonus)} pts</span></div>
                    ${stageRowsHtml}
                    <div class="detail-row total"><span>Total</span><span>${fmt(t.score)} pts</span></div>
                  </div>
                </div>
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


// 🧮 Build the Scoring tab: shows each knockout round's bonus, the running total a
// team banks by reaching it, plus the standard 3/1 group-stage points. Driven live
// from Scoring so it always matches the real values.
function renderScoringTable(scoringMap) {
  const base = STAGE_SEQUENCE.reduce((s, k) => s + (scoringMap[k] || 0), 0);

  const rows = [];
  let running = 0;
  STAGE_SEQUENCE.forEach(key => {
    running += scoringMap[key] || 0;
    rows.push({ label: STAGE_LABELS[key] || key, inc: scoringMap[key] || 0, cum: running });
  });
  ["RunnerUp", "Winner"].forEach(key => {
    rows.push({ label: STAGE_LABELS[key] || key, inc: scoringMap[key] || 0, cum: base + (scoringMap[key] || 0), final: true });
  });

  const stageRowsHtml = rows.map(r => `
    <tr${r.final ? ' class="scoring-final"' : ''}>
      <td>${r.label}</td>
      <td class="num">+${fmt(r.inc)}</td>
      <td class="num cum">${fmt(r.cum)}</td>
    </tr>`).join('');

  const gw = fmt(scoringMap["GroupWin"] || 0);
  const gd = fmt(scoringMap["GroupDraw"] || 0);

  return `
    <div class="scoring-card">
      <h2>🧮 How points are scored</h2>
      <p class="scoring-note">Knockout bonuses are <strong>cumulative</strong> — a team banks the bonus for every round it passes. A player's score is simply their <strong>two teams added together</strong>.</p>

      <table class="scoring-table">
        <thead>
          <tr><th>Stage reached</th><th class="num">Bonus</th><th class="num">Banked total</th></tr>
        </thead>
        <tbody>${stageRowsHtml}</tbody>
      </table>

      <h3 class="scoring-subhead">⚽ Group stage (standard 3 / 1)</h3>
      <table class="scoring-table">
        <thead>
          <tr><th>Group result</th><th class="num">Points</th></tr>
        </thead>
        <tbody>
          <tr><td>Win</td><td class="num">${gw}</td></tr>
          <tr><td>Draw</td><td class="num">${gd}</td></tr>
          <tr><td>Loss</td><td class="num">0</td></tr>
        </tbody>
      </table>
    </div>
  `;
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

    // 🔖 Remember which team breakdowns are expanded so the refresh doesn't collapse them
    const openDetailIds = Array.from(
      document.querySelectorAll('.badge-details.open')
    ).map(el => el.id);

    document.getElementById("leaderboard").innerHTML = renderLeaderboard(leaderboard);
    document.getElementById("scoring").innerHTML = renderScoringTable(scoringMap);

    // ♻️ Restore the previously expanded breakdowns after the re-render
    openDetailIds.forEach(id => document.getElementById(id)?.classList.add('open'));

    updatePrizePoolUI(leaderboard.length, scoringMap);
    //document.getElementById("lastUpdated").innerText = "Last updated: " + new Date().toLocaleString('en-GB');
  } catch (err) {
    console.error(err);
  }
}

loadData();
setInterval(loadData, 60000);
