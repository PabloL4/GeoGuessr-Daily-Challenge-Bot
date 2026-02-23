import dotenv from 'dotenv';
import express from 'express';
import cron from 'node-cron';
import { postChallengeToDiscord, postResultToDiscord } from './discord/index.js';
import { createChallenge, getHighscores } from './geoguessr-api/index.js';
import { defaultChallenge } from './settings.js';
import { postWeeklySummaryToDiscord } from "./discord/index.js";
import { buildWeeklyTable } from "./league/weeklyStore.js";
import { getPreviousWeekKeyIfMonday, markWeekAsPosted, clearWeek } from "./league/weeklyStore.js";
import { recordDay } from "./league/weeklyStore.js";
import { postYearlySummaryToDiscord } from "./yearlySummary.js";



dotenv.config();
const app = express();
const port = 25000;

const toStoreMode = (mode: string): "move" | "nm" | "nmpz" => {
    if (mode === "Move") return "move";
    if (mode === "NM") return "nm";
    return "nmpz";
};

const challenge = async () => {
    const challengePayload = await defaultChallenge(); // { map, mode }
    const ChallengeSettings = await createChallenge(challengePayload);

    if (ChallengeSettings) {
        // ✅ NUEVO: guardar metadata del challenge en league.json (sin scores aún)
        recordDay({
            date: new Date(),
            token: ChallengeSettings.token,
            scores: {}, // todavía no hay highscores
            challenge: {
                mapId: ChallengeSettings.mapId ?? challengePayload.map, // fallback seguro
                mapName: ChallengeSettings.name,
                mapUrl:
                    ChallengeSettings.mapUrl ?? `https://www.geoguessr.com/maps/${challengePayload.map}`,
                mode: toStoreMode(ChallengeSettings.mode),
            },
        });

        await postChallengeToDiscord(ChallengeSettings);
    }
};


// const highscores = async () => {
//     const highscores = await getHighscores();
//     if (highscores) {
//         await postResultToDiscord(highscores);
//     }
// };
const highscores = async () => {
    const hs = await getHighscores();
    if (!hs) return;

    await postResultToDiscord(hs);

    const scores: Record<string, number> = {};
    const players: Record<string, { nick: string; country?: string }> = {};

    for (const entry of hs.highscores.items) {
        const geoId = entry.game.player.id;
        const nick = entry.game.player.nick;
        const country = entry.game.player.countryCode?.toUpperCase();

        const amount = Number(entry.game.player.totalScore.amount);
        scores[geoId] = Number.isFinite(amount) ? amount : 0;

        players[geoId] = { nick, country };
    }


    const resultDate = new Date(hs.timestamp * 1000);

    recordDay({
        date: resultDate,
        token: hs.token,
        scores,
        players,
    });
};

const maybePostWeeklySummary = async (forcedWeekStart?: string) => {
    if (forcedWeekStart) {
        try {
            await postWeeklySummaryToDiscord(forcedWeekStart);
            markWeekAsPosted(forcedWeekStart);
        } catch (err) {
            console.error("[weekly] failed to post summary for", forcedWeekStart, err);
            throw err;
        }
        return;
    }

    const weekKey = getPreviousWeekKeyIfMonday(new Date());
    if (!weekKey) return;

    try {
        await postWeeklySummaryToDiscord(weekKey);
        markWeekAsPosted(weekKey);
    } catch (err) {
        console.error("[weekly] failed to post summary for", weekKey, err);
    }
};

app.get('/challenge', (req, res) => {
    challenge();
    res.send('Challenge created.\n');
});

app.get('/highscores', (req, res) => {
    highscores();
    res.send('Highscores posted.\n');
});

app.get("/weekly", async (req, res) => {
    try {
        const weekStart = String(req.query.weekStart ?? "");
        if (!weekStart) {
            res.status(400).send("Missing weekStart. Example: /weekly?weekStart=2026-01-12");
            return;
        }

        await maybePostWeeklySummary(weekStart);
        res.send("Weekly summary posted.");
    } catch (err) {
        console.error("[/weekly] error:", err);
        if (err instanceof Error) {
            console.error("[/weekly] message:", err.message);
            console.error("[/weekly] stack:", err.stack);
        }
        res.status(500).send("Failed to post weekly summary.");
    }
});

app.get("/yearly", async (req, res) => {
    try {
        const yearStr = String(req.query.year ?? "");
        const year = Number(yearStr);

        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
            res.status(400).send("Missing/invalid year. Example: /yearly?year=2026");
            return;
        }

        await postYearlySummaryToDiscord(year);
        res.send(`OK yearly summary posted for ${year}`);
    } catch (err: any) {
        console.error(err);
        res.status(500).send(err?.message ?? "Error");
    }
});


const mode = process.argv[2];

if (mode === '--standalone') {
    console.log('Running in standalone mode.');
    cron.schedule('0 0 * * *', async () => {
        await maybePostWeeklySummary();
        await challenge();
    });
    cron.schedule('0 23 * * *', () => {
        highscores();
    });
} else {
    app.listen(port, () => {
        console.log(`Server listening at http://localhost:${port}`);
    });
}
