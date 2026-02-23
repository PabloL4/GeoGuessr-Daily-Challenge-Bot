import fs from "node:fs";
import path from "node:path";
import { recordDay } from "./weeklyStore.js";
import { getHighscoresByToken } from "../geoguessr-api/highscores.js";

const STORE_PATH = path.join(process.cwd(), "data", "league.json");

function toYmd(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export async function resyncWeek(weekStartKey: string): Promise<{ ok: true; days: number; players: number } | { ok: false; reason: string }> {
    if (!fs.existsSync(STORE_PATH)) return { ok: false, reason: "league.json not found" };

    const store = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as any;
    const week = store.weeks?.[weekStartKey];
    if (!week) return { ok: false, reason: `Week not found: ${weekStartKey}` };

    const monday = new Date(`${weekStartKey}T00:00:00Z`);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setUTCDate(d.getUTCDate() + i);
        dates.push(toYmd(d));
    }

    let totalPlayers = 0;
    let updatedDays = 0;

    for (const date of dates) {
        const dayObj = week.days?.[date];
        const token = dayObj?.token;
        if (!token) continue; // si no hay challenge ese día, saltamos

        const highscores = await getHighscoresByToken(token);
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

        // fecha del día a rellenar (importante)
        recordDay({
            date: new Date(`${date}T12:00:00Z`),
            token,
            scores,
            players,
        });
    }

    return { ok: true, days: updatedDays, players: totalPlayers };
}
