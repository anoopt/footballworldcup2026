const SHEET_ID = "179t_fUJ_q0bbwxsiXIQcaxV6YLBv6_cXq8rBbq2i9eg";

const URLS = {
  teams: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Teams`,
  players: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Players`,
  scoring: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Scoring`,
};

// safer CSV parser
function parseCSV(text) {
  const lines = text.trim().split("\n");
  return lines.map(line => {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) {
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

function tableHTML(rows) {
  return `
    <table>
      ${rows.map(r => `
        <tr>${r.map(c => `<td>${c || ""}</td>`).join("")}</tr>
      `).join("")}
    </table>
  `;
}

function buildScoringMap(scoringRows) {
  const map = {};
  for (let i = 1; i < scoringRows.length; i++) {
    const [stage, points] = scoringRows[i];
    map[stage] = Number(points);
  }
  return map;
}

function calculateLeaderboard(teams, scoringMap) {
  const teamData = teams.slice(1);

  const playerScores = {};

  for (const row of teamData) {
    const team = row[0];
    const owner = row[1];
    const stage = row[2];

    if (!owner) continue;

    const points = scoringMap[stage] || 0;

    if (!playerScores[owner]) {
      playerScores[owner] = {
        player: owner,
        points: 0,
        teams: []
      };
    }

    playerScores[owner].points += points;
    playerScores[owner].teams.push(`${team} (${stage})`);
  }

  return Object.values(playerScores)
    .sort((a, b) => b.points - a.points);
}

async function loadData() {
  try {
    const [teams, players, scoring] = await Promise.all([
      fetchCSV(URLS.teams),
      fetchCSV(URLS.players),
      fetchCSV(URLS.scoring),
    ]);

    const scoringMap = buildScoringMap(scoring);
    const leaderboard = calculateLeaderboard(teams, scoringMap);

    // Leaderboard UI (better format)
    const leaderboardRows = [
      ["Player", "Points", "Teams"],
      ...leaderboard.map(p => [
        p.player,
        p.points,
        p.teams.join(" | ")
      ])
    ];

    document.getElementById("teams").innerHTML = tableHTML(teams);
    document.getElementById("scoring").innerHTML = tableHTML(scoring);
    document.getElementById("leaderboard").innerHTML = tableHTML(leaderboardRows);

    document.getElementById("lastUpdated").innerText =
      "Last updated: " + new Date().toLocaleString();

  } catch (err) {
    console.error(err);
    document.getElementById("leaderboard").innerHTML =
      "<p>⚠️ Error loading data — check Google Sheet sharing settings</p>";
  }
}

loadData();
setInterval(loadData, 60000);
