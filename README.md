Current commands:

npm start
npm run linkbot

curl.exe  "http://localhost:25000/challenge"
Invoke-WebRequest "http://localhost:25000/highscores" -UseBasicParsing 
curl.exe "http://localhost:25000/weekly?weekStart=2026-01-19"     

# GeoGuessr Daily Challenge Bot + League (Discord)

An advanced fork of **daily-geoguessr-bot** that creates a daily GeoGuessr challenge, posts it to Discord, collects highscores, and maintains a weekly league — all without a database.

This version adds:
- a modern map selector with cooldowns and weights
- weekly and yearly summaries
- variable rounds and time limits
- playful daily challenge messages
- a persistent Discord bot for securely linking GeoGuessr ↔ Discord users via slash commands

---

## Features

### Daily GeoGuessr Challenge
- Automatically creates a daily challenge on GeoGuessr.
- Posts the challenge to Discord with:
  - challenge link
  - map name
  - game mode (Move / NM / NMPZ)
  - number of rounds
  - time per round
  - a fun, dynamic intro message (⚡, 😌, 🔟, etc.)

### Smart Map Selection (`data/maps.json`)
- Weighted random selection (`weight`)
- Optional cooldown per map (`cooldownDays`)
- Allowed modes per map (`move`, `nm`, `nmpz`)
- Recommended modes per map
- Avoids repeating the same mode as the previous day when possible
- Limits **Move** challenges to **max 1 per last 7 days** (unless unavoidable)

### Rounds & Time Rules
- **One fixed weekday** (e.g. Wednesday): **10 rounds**
- **One fixed weekday** (e.g. Monday):  
  - if NOT Move → **10 seconds per round**
- **NM / NMPZ on other days**: **20 / 30 / 60 seconds**
- **Move challenges**: random “clean” values between **60–120s**
  (60, 75, 90, 105, 120)

### Weekly League (JSON, no database)
- Stored in `data/league.json`
- Tracks:
  - daily challenges
  - scores per GeoGuessr userId
  - map metadata and mode
- Weekly summary:
  - podium (🥇🥈🥉)
  - perfect attendance (7/7)
  - ASCII leaderboard table
- Yearly summary supported (when you decide to enable it)

### GeoGuessr ↔ Discord Linking
A **persistent Discord bot** (separate process) with slash commands:

- `/link geoid:<GeoGuessrUserId>`
- `/unlink geoid:<...>` or `/unlink discord:<@user>` (admin only)

Notes:
- Uses **IDs**, not nicknames (safe if names change)
- Replies are **ephemeral** (private)
- Works even in read-only channels

---

## Requirements
- Node.js (ESM + TypeScript)
- npm
- GeoGuessr account
- Discord bot + server

---

## Setup

### 1) Install dependencies
```bash
npm install


Build:
npm run build


data/maps.json
{
  "maps": [
    {
      "id": "community_world",
      "name": "A Community World",
      "url": "https://www.geoguessr.com/maps/62a44b22040f04bd36e8a914",
      "modes": {
        "allowed": ["move", "nm", "nmpz"]
      },
      "weight": 3,
      "tags": ["world", "community"]
    },
    {
      "id": "arbitrary_world",
      "name": "An Arbitrary World",
      "url": "https://www.geoguessr.com/maps/6089bfcff6a0770001f645dd",
      "modes": {
        "allowed": ["move", "nm", "nmpz"],
        "recommended": ["nmpz"]
      },
      "weight": 2,
      "cooldownDays": 7,
      "tags": ["world", "varied"]
    }
  ]
}



Running the Project

Server mode (manual endpoints)

npm start


Typical endpoints:

GET /challenge

GET /highscores

GET /weekly?weekStart=YYYY-MM-DD

yearly summary endpoint
curl.exe "http://localhost:25000/yearly?year=2026"

Windows example:
curl.exe "http://localhost:25000/challenge"


Standalone mode (internal cron)

If enabled in your fork, the main process can:

create daily challenges

fetch highscores

post weekly summaries

Recommended for production:

define explicit cron schedules (daily / weekly)

Discord link bot (required)

Must run continuously to handle slash commands:

npm run linkbot


Commands:

/link geoid:<GeoGuessrUserId>

/unlink geoid:<...> (admin)

/unlink discord:<@user> (admin)


Discord Permissions

Channel can be read-only

Must allow:

Use Application Commands

/unlink can be restricted:

via code (admin ID check)

or via Discord → Integrations → Commands

Notes

GeoGuessr cookies/sessions may expire; re-login if needed.

No database required — league.json is the source of truth.

Designed to be easy to extend (more stats, awards, messages).


Scripts

npm start — server mode

npm run linkbot — persistent slash-command bot

npm run build — compile TypeScript

Project Structure (overview)

src/settings.ts — map/mode selection, rounds & time rules

src/challenge.ts — GeoGuessr challenge creation

src/server.ts — Express server / standalone cron

src/league/weeklyStore.ts — league persistence & logic

src/discord/discordPoster.ts — Discord posting

src/discord/linkBot.ts — /link & /unlink

src/linkBotMain.ts — link bot entrypoint



License

MIT