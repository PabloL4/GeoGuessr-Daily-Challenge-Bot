# GeoGuessr Daily Challenge Bot

A fully automated Discord bot for managing **daily GeoGuessr challenges**, tracking results, and publishing **weekly, monthly, and yearly summaries** with stats, rankings, and fun messages.

This project is based on (and heavily extended from) `daily-geoguessr-bot`, rewritten in **Node.js + TypeScript (ESM)** with a focus on automation, data integrity, and long-term league tracking.

---

## ✨ Features

### 🗺️ Daily Challenges
- Automatically creates a new GeoGuessr challenge every day
- Smart **map selection** with:
  - Weighted randomness
  - Cooldowns to avoid repetition
  - Mode restrictions per map
- Dynamic settings:
  - **5 or 10 rounds** (e.g. special weekly day)
  - Time limits (10s, 20s, 30s, 60s, move with 60–120s)
- Fun, contextual Discord messages depending on the challenge type

---

### 📊 Results & Tracking
- Fetches daily highscores from GeoGuessr
- Stores all data in a single JSON store (`league.json`)
- Players are tracked by **GeoGuessr userId** (nicknames may change safely)
- Late plays are supported via **weekly resync**

---

### 🏆 Weekly Summary
- Automatic weekly league (Monday → Sunday)
- Features:
  - Podium 🥇🥈🥉
  - Perfect attendance (7/7)
  - Extra awards (best 5-round day, best 10-round day, etc.)
  - Full ranking table (rendered as an image for mobile readability)
- Weekly resync ensures **late players are included**

---

### 📅 Monthly & Yearly Summaries
- Monthly stats:
  - Total points
  - Days played
  - Best average score
  - Biggest improvement
  - Most played maps
  - Mode distribution (move / nm / nmpz)
- Yearly summary:
  - Global ranking
  - Podium
  - Long-term consistency stats

---

### 🖼️ Table Rendering
- Weekly tables are rendered as **PNG images**
- Mobile-friendly
- Country flags rendered as icons (Twemoji)
- Totals highlighted for readability
- Temporary images are automatically deleted after posting

---

### 👤 Discord ↔ GeoGuessr Linking
- Slash commands:
  - `/link <geoguessrUserId>` (DM, ephemeral)
  - `/unlink` (admin-only)
- Safe linking rules:
  - One GeoGuessr ID ↔ one Discord user
  - Prevents impersonation or overwrites
- Stored directly in `league.json`

---

### 🔔 Role Mentions
- Supports mentioning a role like `@Daily Challenge`
- Allows users to opt-in for challenge notifications
- Safe mentions via `allowedMentions`

---

## 🧱 Architecture

- **Node.js (ESM) + TypeScript**
- No database — everything stored in JSON
- Modules:
  - `league/` — weekly, monthly, yearly logic
  - `discord/` — posting, tables, slash commands
  - `geoguessr/` — challenge creation & highscores
- Express server for manual endpoints
- Cron jobs for automation
- PM2 for production

---

## 📂 Data Format (league.json)

```json
{
  "weeks": {
    "2026-01-19": {
      "weekStart": "2026-01-19",
      "weekIndex": 12,
      "days": {
        "2026-01-21": {
          "date": "2026-01-21",
          "dayIndex": 736,
          "token": "abc123",
          "mapId": "community_world",
          "mapName": "A Community World",
          "mapUrl": "https://www.geoguessr.com/maps/...",
          "mode": "nm",
          "rounds": 5,
          "timeLimit": 30,
          "scores": {
            "geoUserId": 23456
          }
        }
      },
      "postedAt": "2026-01-26T23:00:00.000Z"
    }
  },
  "players": {
    "geoUserId": {
      "nick": "PlayerName",
      "country": "ES",
      "discordId": "1234567890"
    }
  }
}



DISCORD_TOKEN=your_bot_token
DISCORD_CHANNEL_ID=target_channel_id
DISCORD_GUILD_ID=server_id
DISCORD_ROLE_DAILY_ID=role_id_for_mentions

LEAGUE_START_DATE=2024-01-01
WEEK_INDEX_START=1
DAY_INDEX_START=1
WEEKLY_TOP_N=20



npm install
npm run build
npm start



# Create challenge
curl http://localhost:25000/challenge

# Fetch highscores
curl http://localhost:25000/highscores

# Weekly summary
curl http://localhost:25000/weekly?weekStart=2026-01-19

# Backfill a past day
curl http://localhost:25000/backfill?date=2026-01-21


npm run build
pm2 start dist/server.js --name geodaily
pm2 save
pm2 startup


npm run build
pm2 start dist/server.js --name geodaily
pm2 save
pm2 startup


🧠 Design Decisions

JSON instead of DB → transparency & portability

GeoGuessr userId as primary key → nick changes are safe

Weekly resync instead of daily → cheap and reliable

Images for tables → readable on mobile

No user messages in channels → slash commands + DMs


📝 License

MIT — do whatever you want, just don’t pretend you wrote it 😉

Made with ❤️ for GeoGuessr communities