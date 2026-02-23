import dotenv from 'dotenv';
import express from 'express';
import cron from 'node-cron';
import fs from "node:fs";
import path from "node:path";
import { postChallengeToDiscord, postResultToDiscord } from './discord/index.js';
import { createChallenge, getHighscores } from './geoguessr-api/index.js';
import { defaultChallenge } from './settings.js';
import { postWeeklySummaryToDiscord } from "./discord/index.js";
import { getPreviousWeekKeyIfMonday, markWeekAsPosted, clearWeek } from "./league/weeklyStore.js";
import { recordDay } from "./league/weeklyStore.js";
import { postYearlySummary } from "./yearlySummary.js";
import { postMonthlySummaryToDiscord } from "./monthlySummary.js";
import { getHighscoresByToken } from "./geoguessr-api/highscores.js";
import { resyncWeek } from "./league/resyncWeek.js";



dotenv.config();
const app = express();
const port = 25000;

let didLogStandalone = false;


const toStoreMode = (mode: string): "move" | "nm" | "nmpz" => {
    if (mode === "Move") return "move";
    if (mode === "NM") return "nm";
    return "nmpz";
};

const challenge = async () => {
    const challengePayload = await defaultChallenge(); // { map, mode }

    // console.log("[challenge] payload decided =", {
    //     map: challengePayload.map,
    //     mode: challengePayload.mode,
    //     timeLimit: (challengePayload as any).timeLimit,
    //     roundCount: (challengePayload as any).roundCount,
    // });
    const ChallengeSettings = await createChallenge(challengePayload);

    console.log("[challenge] createChallenge response =", {
        token: ChallengeSettings?.token,
        mode: (ChallengeSettings as any)?.mode,
        timeLimit: (ChallengeSettings as any)?.timeLimit,
        roundCount: (ChallengeSettings as any)?.roundCount,
    });

    if (ChallengeSettings) {
        // ✅ NUEVO: guardar metadata del challenge en league.json (sin scores aún)
        recordDay({
            date: new Date(),
            token: ChallengeSettings.token,
            scores: {}, // todavía no hay highscores
            challenge: {
                mapId: ChallengeSettings.mapId ?? challengePayload.map,
                mapName: ChallengeSettings.name,
                mapUrl: ChallengeSettings.mapUrl ?? `https://www.geoguessr.com/maps/${challengePayload.map}`,
                mode: toStoreMode(ChallengeSettings.mode),

                roundCount: ChallengeSettings.roundCount ?? challengePayload.roundCount,
                timeLimit: ChallengeSettings.timeLimit ?? challengePayload.timeLimit,
            },
        });

        await postChallengeToDiscord(ChallengeSettings);
    }
};

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
            await resyncWeek(forcedWeekStart);
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
        await resyncWeek(weekKey);
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

app.get("/monthly", async (req, res) => {
    try {
        const year = Number(req.query.year);
        const month = Number(req.query.month); // 1..12

        if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
            return res.status(400).send("Use /monthly?year=2026&month=1 (month=1..12)");
        }

        await postMonthlySummaryToDiscord(year, month);
        res.send("ok");
    } catch (e: any) {
        console.error("[/monthly] error:", e);
        res.status(500).send(String(e?.message ?? e));
    }
});



app.get("/yearly", async (req, res) => {
    const year = Number(req.query.year);
    if (!year) {
        res.status(400).send("Missing ?year=YYYY");
        return;
    }

    await postYearlySummary(year);
    res.send(`Yearly summary for ${year} posted.`);
});


//rellenar puntos de un challenge pasado != ayer
app.get("/backfill", async (req, res) => {
    try {
        const date = String(req.query.date ?? "").trim(); // YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            res.status(400).send("Missing/invalid date. Use /backfill?date=YYYY-MM-DD");
            return;
        }

        const storePath = path.join(process.cwd(), "data", "league.json");
        if (!fs.existsSync(storePath)) {
            res.status(404).send("league.json not found");
            return;
        }

        const store = JSON.parse(fs.readFileSync(storePath, "utf8")) as any;

        // ✅ Buscar el día en todas las semanas (sin depender de weekStart)
        let foundWeekKey: string | null = null;
        let dayObj: any = null;

        for (const [weekKey, week] of Object.entries<any>(store.weeks ?? {})) {
            const d = week?.days?.[date];
            if (d?.token) {
                foundWeekKey = weekKey;
                dayObj = d;
                break;
            }
        }

        if (!dayObj?.token) {
            res.status(404).send(`Day not found or missing token for ${date}`);
            return;
        }

        const token = String(dayObj.token);

        const highscores = await getHighscoresByToken(token);
        if (!highscores?.items?.length) {
            res.status(502).send("No highscores items returned");
            return;
        }

        const scores: Record<string, number> = {};
        const players: Record<string, { nick: string; country?: string }> = {};

        for (const entry of highscores.items) {
            const geoId = entry.game.player.id;
            const nick = entry.game.player.nick;
            const country = entry.game.player.countryCode?.toUpperCase();
            const amount = Number(entry.game.player.totalScore.amount);

            scores[geoId] = Number.isFinite(amount) ? amount : 0;
            players[geoId] = { nick, country };
        }

        // usar la fecha del día que rellenamos
        const resultDate = new Date(`${date}T12:00:00Z`);

        recordDay({
            date: resultDate,
            token,
            scores,
            players,
            // no tocamos challenge: mantiene mapId/mapName/mode/rounds/timeLimit ya guardados
        });

        res.send(
            `OK backfilled ${date} (week=${foundWeekKey}) with ${highscores.items.length} players`
        );
    } catch (e: any) {
        console.error(e);
        res.status(500).send(e?.message ?? "Error");
    }
});




const mode = process.argv[2];

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

if (mode === '--standalone') {
    if (!didLogStandalone) {
        console.log("Running in standalone mode.");
        didLogStandalone = true;
    }
    // Diario: recoger highscores (17:55)
    cron.schedule('55 17 * * *', async () => {
        await highscores();
    });

    // Diario: crear challenge (18:00)
    cron.schedule('0 18 * * *', async () => {
        await challenge();
    });

    // Semanal: resumen (domingo 18:05)
    cron.schedule(
        "57 17 * * 1",
        async () => {
            await maybePostWeeklySummary();
        },
        { timezone: "Europe/Madrid" }
    );

    //TEST
    // cron.schedule('* * * * *', async () => {
    //     console.log("Weekly summary cron running...");
    //     await maybePostWeeklySummary("2026-01-19"); // pon aquí el weekStart real que exista


    // 📅 Resumen mensual — día 1 a las 18:15 (mes anterior)
    cron.schedule('59 17 1 * *', async () => {
        const now = new Date();
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const month = now.getMonth() === 0 ? 12 : now.getMonth(); // 1–12

        console.log(`[cron] Posting monthly summary for ${year}-${month}`);
        await postMonthlySummaryToDiscord(year, month);
    });

    // Anual: resumen (1 de enero a las 12:00)
    cron.schedule('0 12 1 1 *', async () => {
        await postYearlySummary(new Date().getFullYear() - 1);
    });
    // }
    // else {
    //     app.listen(port, () => {
    //         console.log(`Server listening at http://localhost:${port}`);
    //     });
    // }
}
