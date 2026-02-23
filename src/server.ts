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
import { recordDay, getDayIndexFor  } from "./league/weeklyStore.js";
import { postYearlySummary } from "./yearlySummary.js";
import { postMonthlySummaryToDiscord } from "./monthlySummary.js";
import { getHighscoresByToken } from "./geoguessr-api/highscores.js";
import { resyncWeek } from "./league/resyncWeek.js";
import { postToDiscord } from "./discord/discordPoster.js";
import { setLang, resolveLang, t } from "./i18n/index.js";

dotenv.config();

setLang(resolveLang(process.env.BOT_LANG));

const app = express();
const port = 25000;

app.use(express.json());
app.use("/say", express.text({ type: "*/*" }));


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
        const now = new Date();
        const dayIndex = getDayIndexFor(now);
        // save challenge metadata in league.json (no scores yet)
        recordDay({
            date: now,
            token: ChallengeSettings.token,
            scores: {}, //no highscores yet
            challenge: {
                mapId: ChallengeSettings.mapId ?? challengePayload.map,
                mapName: ChallengeSettings.name,
                mapUrl: ChallengeSettings.mapUrl ?? `https://www.geoguessr.com/maps/${challengePayload.map}`,
                mode: toStoreMode(ChallengeSettings.mode),
                //dayIndex: ChallengeSettings.dayIndex ?? 0, //the important thing is that it is not undefined, the actual day is assigned when saving the entire day with recordDay()
                roundCount: ChallengeSettings.roundCount ?? challengePayload.roundCount,
                timeLimit: ChallengeSettings.timeLimit ?? challengePayload.timeLimit,
            },
        });

        //await postChallengeToDiscord(ChallengeSettings);
        await postChallengeToDiscord({
            ...ChallengeSettings,
            dayIndex,
        });
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
    res.send(t("server.challenge.created"));
});

app.get('/highscores', (req, res) => {
    highscores();
    res.send(t("server.highscores.posted"));
});

app.get("/weekly", async (req, res) => {
    try {
        const weekStart = String(req.query.weekStart ?? "");
        if (!weekStart) {
            res.status(400).send(t("server.weekly.missingWeekStart"));
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
        res.status(500).send(t("server.weekly.failed"));
    }
});

app.get("/monthly", async (req, res) => {
    try {
        const year = Number(req.query.year);
        const month = Number(req.query.month); // 1..12

        if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
            return res.status(400).send(t("server.monthly.badParams"));
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


//fill in points from a past challenge != yesterday
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

        // Search for the day in all weeks (without depending on weekStart)
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
            res.status(404).send(t("server.backfill.notFound", { date }));
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

        //use the date of the day we filled
        const resultDate = new Date(`${date}T12:00:00Z`);

        recordDay({
            date: resultDate,
            token,
            scores,
            players,
        });

        res.send(
            t("server.backfill.ok", {
                date,
                week: foundWeekKey ?? "",
                count: highscores.items.length
            })
        );
    } catch (e: any) {
        console.error(e);
        res.status(500).send(e?.message ?? "Error");
    }
});


app.use((req, _res, next) => {
    if (req.path === "/say") {
        console.log("CT:", req.headers["content-type"]);
    }
    next();
});

app.use("/say", express.text({ type: "*/*" }));

app.post("/say", async (req, res) => {
    console.log("body:", req.body);

    try {
        const adminToken = process.env.ADMIN_TOKEN;
        const provided = String(req.header("x-admin-token") ?? "");

        if (!adminToken || provided !== adminToken) {
            return res.status(401).send(t("server.unauthorized"));
        }

        // const message = String(req.body?.message ?? "").trim();
        const message =
            typeof req.body === "string"
                ? req.body.trim()
                : String(req.body?.message ?? "").trim();
        if (!message) return res.status(400).send("Missing message");

        //avoid giant messages
        if (message.length > 1800) {
            return res.status(400).send("Message too long (max ~1800 chars)");
        }

        await postToDiscord(message);
        return res.send("ok");
    } catch (e) {
        console.error("[/say] error", e);
        return res.status(500).send("error");
    }
});

app.get("/challenge/test", async (req, res) => {
    try {
        const asDateStr = String(req.query.asDate ?? "");
        if (!asDateStr) {
            return res.status(400).send('Missing asDate. Example: ?asDate=2026-02-02');
        }

        // We build Date in “safe” UTC
        const asDate = new Date(`${asDateStr}T12:00:00Z`); //noon avoids TZ trouble
        if (Number.isNaN(asDate.getTime())) {
            return res.status(400).send("Invalid asDate. Use YYYY-MM-DD");
        }

        const challengePayload = await defaultChallenge({ asDate });
        const created = await createChallenge(challengePayload);

        if (!created) return res.status(500).send("Failed to create challenge");

        // post to Discord
        await postChallengeToDiscord(created);

        return res.json({
            ok: true,
            simulatedDate: asDateStr,
            payload: challengePayload,
            created,
        });
    } catch (e: any) {
        console.error(e);
        return res.status(500).send(e?.message ?? "error");
    }
});

const mode = process.argv[2];

app.listen(port, () => {
    console.log(t("server.listening", { url: `http://localhost:${port}` }));
});

if (mode === '--standalone') {
    if (!didLogStandalone) {
        console.log(t("server.standalone"));
        didLogStandalone = true;
    }
    //daily collect highscores (17:55)
    cron.schedule('55 17 * * *', async () => {
        await highscores();
    });

    // daily create challenge (18:00)
    cron.schedule('0 18 * * *', async () => {
        await challenge();
    });

    // Weekly: summary (Monday 18:05)
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
    //     await maybePostWeeklySummary("2026-01-19"); 


    // Monthly summary — day 1 at 18:15 (previous month)
    cron.schedule('59 17 1 * *', async () => {
        const now = new Date();
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const month = now.getMonth() === 0 ? 12 : now.getMonth(); // 1–12

        console.log(t("cron.monthly.posting", { year, month }));
        await postMonthlySummaryToDiscord(year, month);
    });

    //Annual: summary (January 1 at 12:00)
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
