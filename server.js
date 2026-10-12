
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(process.cwd(), "public")));

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Free Fire UID Lookup API is running"
  });
});

// Rate limiting: maximum 10 searches per minute
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many searches. Please wait one minute and try again."
  }
});

app.use("/api/player", searchLimiter);

// Free Fire player lookup
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
        error: "API key is not configured. Add FREE_FIRE_API_KEY in your environment variables."
      });
    }

    let url =
      `https://api.gameskinbo.com/ff-info/get?uid=${encodeURIComponent(uid)}`;

    if (region) {
      url += `&region=${encodeURIComponent(region)}`;
    }

    const response = await fetch(url, {
      headers: {
        "x-api-key": apiKey
      },
      signal: AbortSignal.timeout(15000)
    });

    const raw = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        raw?.error ||
        (response.status === 401
          ? "Invalid or missing API key."
          : response.status === 429
            ? "API rate limit reached. Please try again later."
            : response.status === 402
              ? "The data provider requires an available API plan or credits."
              : "Player not found or the data provider is unavailable.");

      const status =
        response.status === 401 ||
        response.status === 403 ||
        response.status === 429
          ? response.status
          : 502;

      return res.status(status).json({ error: message });
    }

    const account = raw?.AccountInfo || {};
    const profile = raw?.AccountProfileInfo || {};
    const guild = raw?.GuildInfo || {};

    return res.json({
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

    return res.status(500).json({
      error:
        error.name === "TimeoutError"
          ? "The player data provider took too long to respond. Try again."
          : "Something went wrong while fetching player information."
    });
  }
});

// Format numbers
function formatNumber(value) {
  if (value === undefined || value === null || value === "") {
    return "N/A";
  }

  const number = Number(value);

  return Number.isNaN(number)
    ? String(value)
    : number.toLocaleString("en-US");
}

// Format Unix timestamps in Pakistan time
function formatDate(timestamp) {
  if (
    timestamp === undefined ||
    timestamp === null ||
    timestamp === "" ||
    Number(timestamp) === 0
  ) {
    return "N/A";
  }

  let seconds = Number(timestamp);

  if (!Number.isFinite(seconds)) {
    return "N/A";
  }

  // Convert milliseconds to seconds when necessary
  if (seconds > 9999999999) {
    seconds = Math.floor(seconds / 1000);
  }

  const date = new Date(seconds * 1000);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi"
  });
}

// Local development: npm start
// Vercel imports the exported app as a serverless application.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(
      `Free Fire UID Lookup running at http://localhost:${PORT}`
    );
  });
}

export default app;
