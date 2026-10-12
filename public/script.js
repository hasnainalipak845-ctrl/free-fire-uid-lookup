const form = document.getElementById("search-form");
const uidInput = document.getElementById("uid");
const regionInput = document.getElementById("region");
const button = document.getElementById("search-button");
const status = document.getElementById("status");
const playerCard = document.getElementById("player-card");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const uid = uidInput.value.trim();
  const region = regionInput.value;

  if (!/^[0-9]{5,15}$/.test(uid)) {
    showMessage("Enter a valid UID containing 5–15 digits.", "error");
    uidInput.focus();
    return;
  }

  setLoading(true);
  playerCard.classList.add("hidden");
  showMessage("Connecting to player database…", "");

  try {
    const response = await fetch("/api/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, region })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to fetch player information.");
    renderPlayer(data);
    showMessage("Player profile loaded.", "success");
    playerCard.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showMessage(error.message || "Request failed. Please try again.", "error");
  } finally {
    setLoading(false);
  }
});

function setLoading(loading) {
  button.disabled = loading;
  button.querySelector("span:first-child").textContent = loading ? "SEARCHING…" : "FIND PLAYER";
  button.querySelector(".button-arrow").textContent = loading ? "…" : "↗";
}

function showMessage(message, type = "") {
  status.textContent = message;
  status.className = `status ${type}`;
}

function renderPlayer(player) {
  const accountItems = [
    ["Experience", player.exp], ["Likes", player.likes], ["Region", player.region],
    ["Season", player.season], ["Account Created", player.createdDate], ["Last Login", player.lastLogin]
  ];
  const rankItems = [
    ["Battle Royale Max Rank", player.brRank], ["BR Rank Points", player.brRankPoints],
    ["Clash Squad Max Rank", player.csRank], ["CS Rank Points", player.csRankPoints]
  ];
  const guildItems = [["Guild Name", player.guildName], ["Guild Members", player.guildMembers]];

  playerCard.innerHTML = `
    <div class="player-head">
      <div class="avatar" aria-hidden="true">🎮</div>
      <div><div class="player-name">${escapeHtml(player.nickname)}</div>
      <div class="player-uid">UID: ${escapeHtml(player.uid)}</div>
      <div class="badge">LEVEL ${escapeHtml(String(player.level))}</div></div>
    </div>
    <div class="result-heading">02 / ACCOUNT OVERVIEW</div><div class="grid">${accountItems.map(([k,v]) => info(k,v)).join("")}</div>
    <div class="result-heading">03 / RANK DETAILS</div><div class="grid">${rankItems.map(([k,v]) => info(k,v)).join("")}</div>
    <div class="result-heading">04 / GUILD INFORMATION</div><div class="grid">${guildItems.map(([k,v]) => info(k,v)).join("")}</div>`;
  playerCard.classList.remove("hidden");
}

function info(label, value) {
  return `<div class="info"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value ?? "N/A"))}</strong></div>`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}