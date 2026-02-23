// src/league/yearlyStore.ts
// Aggregates results for a whole year from data/league.json

import fs from "node:fs";
import path from "node:path";

type PlayerKey = string; // geoId
type DailyScores = Record<PlayerKey, number>;

type LeagueDay = {
    date: string; // YYYY-MM-DD
    dayIndex: number;
    token: string;
    scores: DailyScores;
};

type LeagueWeek = {
    weekStart: string;
    weekIndex: number;
    days: Record<string, LeagueDay>;
    postedAt?: string;
};

type Store = {
    weeks: Record<string, LeagueWeek>;
    players: Record<string, { nick: string; country?: string; discordId?: string }>;
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "league.json");

function readStore(): Store {
    if (!fs.existsSync(STORE_PATH)) return { weeks: {}, players: {} };
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as Partial<Store>;
    return { weeks: parsed.weeks ?? {}, players: parsed.players ?? {} };
}

function ymdYear(dateYmd: string): number | null {
    // expects YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return null;
    return Number(dateYmd.slice(0, 4));
}

export type YearlyRow = {
    geoId: string;
    total: number;
    daysPlayed: number;
    average: number; // total / daysPlayed
};

export type BestDay = {
    geoId: string;
    date: string;
    score: number;
};

export function getYearlyStats(year: number): {
    rows: YearlyRow[];
    totalDaysInYear: number; // number of recorded challenge-days found in data
    bestDay: BestDay | null;
} {
    const store = readStore();

    const totals = new Map<string, { total: number; daysPlayed: number }>();
    const recordedDays = new Set<string>();

    let bestDay: BestDay | null = null;

    for (const week of Object.values(store.weeks)) {
        for (const day of Object.values(week.days)) {
            if (ymdYear(day.date) !== year) continue;

            recordedDays.add(day.date);

            for (const [geoId, score] of Object.entries(day.scores)) {
                const entry = totals.get(geoId) ?? { total: 0, daysPlayed: 0 };
                entry.total += score;
                entry.daysPlayed += 1;
                totals.set(geoId, entry);

                if (!bestDay || score > bestDay.score) {
                    bestDay = { geoId, date: day.date, score };
                }
            }
        }
    }

    const rows: YearlyRow[] = Array.from(totals.entries()).map(([geoId, v]) => ({
        geoId,
        total: v.total,
        daysPlayed: v.daysPlayed,
        average: v.daysPlayed > 0 ? v.total / v.daysPlayed : 0,
    }));

    rows.sort((a, b) => b.total - a.total);

    return {
        rows,
        totalDaysInYear: recordedDays.size,
        bestDay,
    };
}

/**
 * Players who played EVERY recorded day of that year.
 * (i.e. attendance = totalDaysInYear)
 */
export function getYearlyFullAttendance(year: number): string[] {
    const { rows, totalDaysInYear } = getYearlyStats(year);
    if (totalDaysInYear === 0) return [];
    return rows.filter((r) => r.daysPlayed === totalDaysInYear).map((r) => r.geoId);
}

function fmtInt(n: number): string {
    return Math.round(n).toLocaleString("es-ES");
}

function padR(s: string, w: number) {
    return s.length >= w ? s : s + " ".repeat(w - s.length);
}
function padL(s: string, w: number) {
    return s.length >= w ? s : " ".repeat(w - s.length) + s;
}

/**
 * Table optimized for Discord code blocks (NO emojis).
 * Includes country ISO2 as a separate column so alignment stays perfect.
 */
export function buildYearlyTable(
    year: number,
    topN = Number(process.env.YEARLY_TOP_N ?? "30")
): { title: string; table: string } {
    const store = readStore();
    const { rows, totalDaysInYear } = getYearlyStats(year);
    const sliced = rows.slice(0, topN);

    const printed = sliced.map((r, idx) => {
        const p = store.players[r.geoId];
        return {
            rank: idx + 1,
            nick: p?.nick ?? r.geoId,
            country: (p?.country ?? "").toUpperCase(),
            days: String(r.daysPlayed),
            total: fmtInt(r.total),
            avg: r.daysPlayed ? fmtInt(r.average) : "0",
        };
    });

    const headers = ["#", "NOMBRE", "PAÍS", "DÍAS", "TOTAL", "MEDIA"];
    const rankWidth = Math.max(2, String(printed.length || 1).length);
    const nameWidth = Math.max(12, ...printed.map((r) => r.nick.length));
    const countryWidth = 4;
    const daysWidth = Math.max(headers[3].length, ...printed.map((r) => r.days.length));
    const totalWidth = Math.max(headers[4].length, ...printed.map((r) => r.total.length));
    const avgWidth = Math.max(headers[5].length, ...printed.map((r) => r.avg.length));

    const sep = " | ";

    const headerLine =
        padL(headers[0], rankWidth) +
        "  " +
        padR(headers[1], nameWidth) +
        "  " +
        padR(headers[2], countryWidth) +
        sep +
        padL(headers[3], daysWidth) +
        sep +
        padL(headers[4], totalWidth) +
        sep +
        padL(headers[5], avgWidth);

    const dividerLine =
        "-".repeat(rankWidth) +
        "  " +
        "-".repeat(nameWidth) +
        "  " +
        "-".repeat(countryWidth) +
        sep +
        "-".repeat(daysWidth) +
        sep +
        "-".repeat(totalWidth) +
        sep +
        "-".repeat(avgWidth);

    const lines: string[] = [headerLine, dividerLine];

    for (const r of printed) {
        lines.push(
            padL(String(r.rank), rankWidth) +
            "  " +
            padR(r.nick, nameWidth) +
            "  " +
            padR(r.country, countryWidth) +
            sep +
            padL(r.days, daysWidth) +
            sep +
            padL(r.total, totalWidth) +
            sep +
            padL(r.avg, avgWidth)
        );
    }

    const title = `AÑO ${year} (días registrados: ${totalDaysInYear})`;
    return { title, table: lines.join("\n") };
}
