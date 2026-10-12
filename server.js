import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Free Fire UID Lookup API is running" });
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many searches. Please wait one minute and try again." }
});

app.use("/api/player", searchLimiter);

app.post("/api/player", async (req, res) => {
  try {
    const { uid, region } = req.body || {};

    if (!uid || !/^[0-9]{5,15}$/.test(String(uid))) {
      return res.status(400).json({
        error: "Please enter a valid Free Fire UID containing 5–15 digits."
      });
    }

    const apiKey = process.env.FREE_FIRE_API_KEY;
    if (!apiKey || apiKey === "put_your_api_key_here") {
      return res.status(500).json({
        error: "API key is not configured. Copy .env.example to .env and add your API key."
      });
    }

    let url = `https://api.gameskinbo.com/ff-info/get?uid=${encodeURIComponent(uid)}`;
    if (region) url += `&region=${encodeURIComponent(region)}`;

    const response = await fetch(url, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(15000)
    });

    const raw = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = raw?.error ||
        (response.status === 401 ? "Invalid or missing API key." :
        response.status === 429 ? "API rate limit reached. Please try again later." :
        "Player not found or the data provider is unavailable.");
      return res.status(response.status === 402 ? 404 : response.status).json({ error: message });
    }

    const account = raw?.AccountInfo || {};
    const profile = raw?.AccountProfileInfo || {};
    const guild = raw?.GuildInfo || {};

    res.json({
      uid: String(uid),
      nickname: account.AccountName || "Unknown",
      level: account.AccountLevel ?? "N/A",
      exp: formatNumber(account.AccountEXP),
      likes: formatNumber(account.AccountLikes),
      region: account.AccountRegion || region || "N/A",
      createdDate: formatDate(account.AccountCreateTime),
      lastLogin: formatDate(account.AccountLastLogin),
      season: account.AccountSeasonId ?? "N/A",
      brRank: profile.BrMaxRank ?? "N/A",
      brRankPoints: formatNumber(profile.BrRankPoint),
      csRank: profile.CsMaxRank ?? "N/A",
      csRankPoints: formatNumber(profile.CsRankPoint),
      guildName: guild.GuildName || "No guild",
      guildMembers: guild.MemberNum ?? "N/A"
    });
  } catch (error) {
    console.error("Player lookup failed:", error.message);
    res.status(500).json({
      error: error.name === "TimeoutError"
        ? "The player data provider took too long to respond. Try again."
        : "Something went wrong while fetching player information."
    });
  }
});

function formatNumber(value) {
  if (value === undefined || value === null || value === "") return "N/A";
  const number = Number(value);
  return Number.isNaN(number) ? String(value) : number.toLocaleString("en-US");
}

function formatDate(timestamp) {
  if (!timestamp) return "N/A";
  let seconds = Number(timestamp);
  if (Number.isNaN(seconds)) return "N/A";
  if (seconds > 9999999999) seconds = Math.floor(seconds / 1000);
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi"
  });
}

app.listen(PORT, () => {
  console.log(`Free Fire UID lookup running at http://localhost:${PORT}`);
});