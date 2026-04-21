import fs from "node:fs";
import path from "node:path";
import { recordDay } from "./weeklyStore.js";
import { getHighscoresByToken } from "../geoguessr-api/highscores.js";
import { loginAndGetCookie } from "../geoguessr-api/login.js";

const STORE_PATH = path.join(process.cwd(), "data", "league.json");

function toYmd(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDatesInRange(startYmd: string, endYmd: string): string[] {
    const start = new Date(`${startYmd}T00:00:00Z`);
    const end = new Date(`${endYmd}T00:00:00Z`);
    const dates: string[] = [];

    for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        dates.push(toYmd(cursor));
    }

    return dates;
}

type ResyncResult =
    | { ok: true; days: number; players: number }
    | { ok: false; reason: string };

export async function resyncDateRange(startYmd: string, endYmd: string): Promise<ResyncResult> {
    if (!fs.existsSync(STORE_PATH)) return { ok: false, reason: "league.json not found" };

    const store = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as any;
    const dates = getDatesInRange(startYmd, endYmd);
    const delayMs = Math.max(0, Number(process.env.RESYNC_DELAY_MS ?? "350"));
    const cookie = await loginAndGetCookie();

    let totalPlayers = 0;
    let updatedDays = 0;

    for (const [index, date] of dates.entries()) {
        let dayObj: any = null;

        for (const week of Object.values<any>(store.weeks ?? {})) {
            const maybeDay = week?.days?.[date];
            if (maybeDay?.token) {
                dayObj = maybeDay;
                break;
            }
        }

        const token = dayObj?.token;
        if (!token) continue;

        const highscores = await getHighscoresByToken(token, cookie);
        if (!highscores?.items?.length) continue;

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

        totalPlayers += highscores.items.length;
        updatedDays++;

        await recordDay({
            date: new Date(`${date}T12:00:00Z`),
            token,
            scores,
            players,
        });

        if (delayMs > 0 && index < dates.length - 1) {
            await sleep(delayMs);
        }
    }

    return { ok: true, days: updatedDays, players: totalPlayers };
}

export async function resyncMonth(year: number, month1to12: number): Promise<ResyncResult> {
    const month = String(month1to12).padStart(2, "0");
    const start = `${year}-${month}-01`;
    const endDate = new Date(Date.UTC(year, month1to12, 0));
    const end = toYmd(endDate);
    return resyncDateRange(start, end);
}
