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



dotenv.config();
const app = express();
const port = 25000;

const challenge = async () => {
    const challengePayload = await defaultChallenge();
    const ChallengeSettings = await createChallenge(challengePayload);
    if (ChallengeSettings) {
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
    for (const entry of hs.highscores.items) {
        const name = entry.game.player.nick;
        const amount = Number(entry.game.player.totalScore.amount);
        scores[name] = Number.isFinite(amount) ? amount : 0;
    }

    const resultDate = new Date(hs.timestamp * 1000);

    recordDay({
        date: resultDate,
        token: hs.token,
        scores,
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
