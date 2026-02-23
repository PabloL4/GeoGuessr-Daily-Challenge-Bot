// src/league/weeklyStore.ts
// Stores daily results and builds a Monday-Sunday weekly table.

import fs from "node:fs";
import path from "node:path";
import { normalizeCountryCode } from "../players.js";
import { t, getLocale } from "../i18n/index.js";

type PlayerKey = string; // nick or stable id

export type DailyScores = Record<PlayerKey, number>;

export type LeagueDay = {
    date: string;      // YYYY-MM-DD
    dayIndex: number;  // e.g. 736
    token: string;

    // NEW (optional): map + mode used that day
    mapId?: string;
    mapName?: string;
    mapUrl?: string;
    mode?: "move" | "nm" | "nmpz";

    roundCount?: number;
    timeLimit?: number;

    scores: DailyScores;
};

export type LeagueWeek = {
    weekStart: string;
    weekIndex: number;
    days: Record<string, LeagueDay>;
    postedAt?: string; // ISO timestamp when weekly summary was posted
};

type Store = {
    weeks: Record<string, LeagueWeek>;
    players: Record<string, { nick: string; country?: string; discordId?: string }>; // key = GeoGuessr id
};


const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "league.json");

function ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore(): Store {
    // console.log("[league] readStore STORE_PATH =", STORE_PATH);
    ensureDataDir();
    if (!fs.existsSync(STORE_PATH)) return { weeks: {}, players: {} };
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as Partial<Store>;
    return { weeks: parsed.weeks ?? {}, players: parsed.players ?? {} };
}

// function writeStore(store: Store): void {
//     console.log("[league] writeStore STORE_PATH =", STORE_PATH, "weeks =", Object.keys(store.weeks));
//     ensureDataDir();
//     fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
// }
function writeStore(store: Store): void {
    ensureDataDir();
    const tmp = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(tmp, STORE_PATH); //atomic replace in practice
}

// --- Date helpers (Monday-based) ---

export function toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export function mondayOf(d: Date): Date {
    const copy = new Date(d);
    const day = copy.getDay(); // 0=Sun, 1=Mon, ...
    const diff = (day === 0 ? -6 : 1) - day; // move to Monday
    copy.setDate(copy.getDate() + diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function daysBetween(a: Date, b: Date): number {
    const ms = 24 * 60 * 60 * 1000;
    const a0 = new Date(a); a0.setHours(0, 0, 0, 0);
    const b0 = new Date(b); b0.setHours(0, 0, 0, 0);
    return Math.round((b0.getTime() - a0.getTime()) / ms);
}

export function getWeekIndexFor(date: Date): number {
    const startStr = process.env.LEAGUE_START_DATE ?? "2024-01-01";
    const start = new Date(startStr);
    const baseWeek = Number(process.env.WEEK_INDEX_START ?? "1");

    const weekStart = mondayOf(date);
    const startWeek = mondayOf(start);
    const weeks = Math.floor(daysBetween(startWeek, weekStart) / 7);
    return baseWeek + weeks;
}

export function getDayIndexFor(date: Date): number {
    const startStr = process.env.LEAGUE_START_DATE ?? "2024-01-01";
    const start = new Date(startStr);
    const baseDay = Number(process.env.DAY_INDEX_START ?? "1");

    return baseDay + daysBetween(start, date);
}

export function getDayIndexByToken(token: string): number | null {
    const store = readStore();

    for (const week of Object.values(store.weeks ?? {})) {
        for (const day of Object.values(week.days ?? {})) {
            if (day.token === token) {
                return day.dayIndex ?? null;
            }
        }
    }

    return null;
}


function flagEmoji(country?: string): string {
    if (!country) return "";
    const cc = country.toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return "";
    const A = 0x1f1e6;
    return String.fromCodePoint(...[...cc].map(c => A + (c.charCodeAt(0) - 65)));
}

// function countryCodeToFlagEmoji(code?: string): string {
//     if (!code) return "";

//     const c = code.trim().toUpperCase();
//     if (!/^[A-Z]{2}$/.test(c)) return "";

//     const base = 0x1f1e6;
//     const A = "A".charCodeAt(0);

//     return String.fromCodePoint(
//         base + (c.charCodeAt(0) - A),
//         base + (c.charCodeAt(1) - A)
//     );
// }



// --- Public API ---

export function recordDay(params: {
    date: Date;
    token: string;
    scores: DailyScores; // now keyed by geoId
    players?: Record<string, { nick: string; country?: string }>;
    challenge?: {
        mapId: string;
        mapName: string;
        mapUrl: string;
        mode: "move" | "nm" | "nmpz";
        roundCount: number;
        timeLimit: number;
    };
}): void {
    const store = readStore();

    if (params.players) {
        for (const [geoId, info] of Object.entries(params.players)) {
            const existing = store.players[geoId];

            store.players[geoId] = {
                nick: info.nick,
                country: normalizeCountryCode(info.country ?? existing?.country),
                discordId: existing?.discordId,
            };
        }
    }

    const weekStartDate = mondayOf(params.date);
    const weekStartKey = toYmd(weekStartDate);

    const weekIndex = getWeekIndexFor(params.date);

    const dateKey = toYmd(params.date);

    const week: LeagueWeek = store.weeks[weekStartKey] ?? {
        weekStart: weekStartKey,
        weekIndex,
        days: {},
    };

    const existingDay = week.days[dateKey];

  // dayIndex stable and NOT stepped on if it already exists
    const computedDayIndex = getDayIndexFor(new Date(`${dateKey}T12:00:00Z`));
    const finalDayIndex = existingDay?.dayIndex ?? computedDayIndex;

    // Don't overwrite if already exists one
    const finalToken = existingDay?.token ?? params.token;

    week.days[dateKey] = {
        date: dateKey,
        dayIndex: finalDayIndex,
        token: finalToken,

        //Keep the existing if there is no a new challenge
        mapId: params.challenge?.mapId ?? existingDay?.mapId,
        mapName: params.challenge?.mapName ?? existingDay?.mapName,
        mapUrl: params.challenge?.mapUrl ?? existingDay?.mapUrl,
        mode: params.challenge?.mode ?? existingDay?.mode,
        roundCount: params.challenge?.roundCount ?? existingDay?.roundCount,
        timeLimit: params.challenge?.timeLimit ?? existingDay?.timeLimit,

        // Merge scores to avoid problems with resync
        scores: { ...(existingDay?.scores ?? {}), ...(params.scores ?? {}) },
    };

    store.weeks[weekStartKey] = week;
    writeStore(store);
}


export function getPreviousWeekKeyIfMonday(today: Date): string | null {
    // Only returns a week key when today is Monday.
    // TEMP TEST: treat every day as Monday
    // if (today.getDay() !== 1) return null;

    const thisWeekStart = mondayOf(today);
    const prevWeekStart = new Date(thisWeekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const key = toYmd(prevWeekStart);
    const store = readStore();
    const w = store.weeks[key];
    if (!w) return null;
    if (w.postedAt) return null; // already posted
    return key;
}

export function buildWeeklyTable(weekStartKey: string): { title: string; table: string } {
    const store = readStore();
    const week = store.weeks[weekStartKey];

    const locale = getLocale();

    console.log("[league] buildWeeklyTable weekStartKey =", weekStartKey, "available weeks =", Object.keys(store.weeks));
    if (!week) throw new Error(t("weeklyStore.errors.weekNotFound", { weekStartKey }));

    // Dates Monday..Sunday (UTC estable)
    const monday = new Date(`${weekStartKey}T00:00:00Z`);

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setUTCDate(d.getUTCDate() + i);
        dates.push(d.toISOString().slice(0, 10)); // YYYY-MM-DD
    }

    // Resolve day indexes Dxxx for each date
    const dCols = dates.map((d) => {
        const day = week.days[d];
        if (day?.dayIndex) return day.dayIndex;
        return getDayIndexFor(new Date(`${d}T00:00:00Z`));
    });

    // Collect players
    const playersSet = new Set<string>();
    for (const d of dates) {
        const day = week.days[d];
        if (!day) continue;
        Object.keys(day.scores).forEach((p) => playersSet.add(p));
    }
    const players = Array.from(playersSet);

    // Build rows
    const rows = players.map((name) => {
        const perDay = dates.map((d) => {
            const day = week.days[d];
            if (!day) return null;
            const v = day.scores[name];
            return Number.isFinite(v) ? v : null;
        });
        const total = perDay.reduce<number>((acc, v) => acc + (v ?? 0), 0);
        return { name, perDay, total };
    });

    rows.sort((a, b) => b.total - a.total);

    const topN = Number(process.env.WEEKLY_TOP_N ?? "20");
    const sliced = rows.slice(0, topN);

    const fmt = (n: number) => n.toLocaleString(locale);

    const printed = sliced.map((r, idx) => {
        const player = store.players[r.name]; // geoId
        const rawNick = player?.nick ?? r.name;
        const maxNick = Number(process.env.MAX_NICK_LEN ?? "16");
        const nick = rawNick.length > maxNick ? rawNick.slice(0, maxNick - 1) + "…" : rawNick;
        const country = (player?.country ?? "").toUpperCase(); //ISO2 normalized
        const flag = flagEmoji(country);


        const cells = r.perDay.map((v) => (v == null ? "-" : fmt(v)));
        const totalStr = fmt(r.total);
        const cc = country || "";               // "FR", "ES", ...
        const nameWithFlag = cc ? `[${cc}] ${nick}` : nick;
        return { rank: idx + 1, nick, cc, nameWithFlag, cells, totalStr };
    });

    // Headers
    const headers = ["#", t("weeklyStore.headers.name"), ...dCols.map((n) => `D${n}`), t("weeklyStore.headers.total")];

    //Dynamic + minimum widths
    const visibleLen = (s: string) =>
        s.replace(/\p{Extended_Pictographic}/gu, "XX").length;
    const rankWidth = Math.max(2, String(printed.length).length);
    const nameWidth = Math.max(12, ...printed.map((r) => r.nameWithFlag.length));

    const dayWidths = Array.from({ length: 7 }, (_, i) =>
        Math.max(6, headers[i + 2].length, ...printed.map((r) => r.cells[i].length))
    );
    const totalWidth = Math.max(6, headers[9].length, ...printed.map((r) => r.totalStr.length));


    const padR = (s: string, w: number) => {
        const len = visibleLen(s);
        return len >= w ? s : s + " ".repeat(w - len);
    }; const padL = (s: string, w: number) => (s.length >= w ? s : " ".repeat(w - s.length) + s);

    const sep = " | ";

    const headerLine =
        padL(headers[0], rankWidth) +
        "  " +
        padR(headers[1], nameWidth) +
        sep +
        dayWidths.map((w, i) => padL(headers[i + 2], w)).join(sep) +
        sep +
        padL(headers[9], totalWidth);

    const dividerLine =
        "-".repeat(rankWidth) +
        "  " +
        "-".repeat(nameWidth) +
        sep +
        dayWidths.map((w) => "-".repeat(w)).join(sep) +
        sep +
        "-".repeat(totalWidth);


    const lines: string[] = [headerLine, dividerLine];

    for (const r of printed) {
        lines.push(
            padL(String(r.rank), rankWidth) +
            "  " +
            padR(r.nameWithFlag, nameWidth) +
            sep +
            r.cells.map((c, i) => padL(c, dayWidths[i])).join(sep) +
            sep +
            padL(r.totalStr, totalWidth)
        );
    }

    const title = t("weeklyStore.title", { weekIndex: week.weekIndex, weekStart: week.weekStart });
    return { title, table: lines.join("\n") };
}

export function getWeeklyPodium(weekStartKey: string): Array<{ geoId: string; total: number }> {
    const store = readStore();
    const week = store.weeks[weekStartKey];
    if (!week) return [];

    // Dates Monday..Sunday
    const monday = new Date(weekStartKey);
    monday.setHours(0, 0, 0, 0);

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        dates.push(toYmd(d));
    }

    // Collect players (these are GeoGuessr IDs now)
    const playerIds = new Set<string>();
    for (const d of dates) {
        const day = week.days[d];
        if (!day) continue;
        Object.keys(day.scores).forEach((geoId) => playerIds.add(geoId));
    }

    const rows = Array.from(playerIds).map((geoId) => {
        const total = dates.reduce((acc, d) => {
            const day = week.days[d];
            const v = day?.scores[geoId];
            return acc + (Number.isFinite(v) ? v! : 0);
        }, 0);

        return { geoId, total };
    });

    rows.sort((a, b) => b.total - a.total);
    return rows.slice(0, 3);
}


export function getWeeklyPerfectAttendance(weekStartKey: string): string[] {
    const store = readStore();
    const week = store.weeks[weekStartKey];
    if (!week) return [];

    const monday = new Date(weekStartKey);
    monday.setHours(0, 0, 0, 0);

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        dates.push(toYmd(d));
    }

    // Gather all players who appeared at least once
    const players = new Set<string>();
    for (const d of dates) {
        const day = week.days[d];
        if (!day) continue;
        Object.keys(day.scores).forEach((p) => players.add(p));
    }

    // Keep only players who have a score entry for every day
    const perfect: string[] = [];
    for (const name of players) {
        const playedAll = dates.every((d) => {
            const day = week.days[d];
            if (!day) return false;
            return Object.prototype.hasOwnProperty.call(day.scores, name);
        });
        if (playedAll) perfect.push(name);
    }

    return perfect;
}

export function clearWeek(weekStartKey: string): void {
    const store = readStore();
    delete store.weeks[weekStartKey];
    writeStore(store);
}

export function markWeekAsPosted(weekStartKey: string, when = new Date()): void {
    const store = readStore();
    const week = store.weeks[weekStartKey];
    if (!week) return;

    week.postedAt = when.toISOString();
    store.weeks[weekStartKey] = week;
    writeStore(store);
}

export type WeeklyBestDaily = {
    geoId: string;
    score: number;
    dayIndex: number;
    date: string;      // YYYY-MM-DD
    roundCount: number;
};

export function getWeeklyBestDailyByRounds(
    weekStartKey: string,
    targetRounds: number
): WeeklyBestDaily | null {
    const store = readStore();
    const week = store.weeks[weekStartKey];
    if (!week) return null;

    // Monday..Sunday
    const monday = new Date(weekStartKey);
    monday.setHours(0, 0, 0, 0);

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        dates.push(toYmd(d));
    }

    let best: WeeklyBestDaily | null = null;

    for (const date of dates) {
        const day = week.days[date];
        if (!day) continue;

        const roundCount = day.roundCount;
        if (!Number.isFinite(roundCount) || roundCount !== targetRounds) continue;

        const dayIndex = day.dayIndex ?? getDayIndexFor(new Date(date));

        for (const [geoId, score] of Object.entries(day.scores ?? {})) {
            if (!Number.isFinite(score)) continue;

            if (!best || score > best.score) {
                best = { geoId, score: score as number, dayIndex, date, roundCount };
            }
        }
    }
    return best;
}

export type WeeklyBestDailyByMode = {
    mode: "move" | "nm" | "nmpz";
    geoId: string;
    score: number;
    dayIndex: number;
    date: string;
    roundCount: number;
};

export function getWeeklyBestDailyByRoundsAndMode(
    weekStartKey: string,
    targetRounds: number,
    targetMode: "move" | "nm" | "nmpz"
): WeeklyBestDailyByMode | null {
    const store = readStore();
    const week = store.weeks[weekStartKey];
    if (!week) return null;

    const monday = new Date(weekStartKey);
    monday.setHours(0, 0, 0, 0);

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        dates.push(toYmd(d));
    }

    let best: WeeklyBestDailyByMode | null = null;

    for (const date of dates) {
        const day = week.days[date];
        if (!day) continue;

        const roundCount = day.roundCount;
        if (!Number.isFinite(roundCount) || roundCount !== targetRounds) continue;

        //filter by mode of the day
        if (day.mode !== targetMode) continue;

        const dayIndex = day.dayIndex ?? getDayIndexFor(new Date(date));

        for (const [geoId, score] of Object.entries(day.scores ?? {})) {
            const s = Number(score);
            if (!Number.isFinite(s)) continue;

            if (!best || s > best.score) {
                best = { mode: targetMode, geoId, score: s, dayIndex, date, roundCount };
            }
        }
    }

    return best;
}



