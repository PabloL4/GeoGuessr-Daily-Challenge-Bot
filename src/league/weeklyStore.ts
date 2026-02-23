// src/league/weeklyStore.ts
// Stores daily results and builds a Monday-Sunday weekly table.

import fs from "node:fs";
import path from "node:path";

type PlayerKey = string; // nick or stable id

export type DailyScores = Record<PlayerKey, number>;

export type LeagueDay = {
    date: string;      // YYYY-MM-DD
    dayIndex: number;  // e.g. 736
    token: string;
    scores: DailyScores;
};

export type LeagueWeek = {
    weekStart: string;
    weekIndex: number;
    days: Record<string, LeagueDay>;
    postedAt?: string; // ISO timestamp when weekly summary was posted
};

type Store = {
    weeks: Record<string, LeagueWeek>; // key: weekStart (YYYY-MM-DD)
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "league.json");

function ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore(): Store {
    console.log("[league] readStore STORE_PATH =", STORE_PATH);
    ensureDataDir();
    if (!fs.existsSync(STORE_PATH)) return { weeks: {} };
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as Store;
}

function writeStore(store: Store): void {
    console.log("[league] writeStore STORE_PATH =", STORE_PATH, "weeks =", Object.keys(store.weeks));
    ensureDataDir();
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
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

// --- Public API ---

export function recordDay(params: { date: Date; token: string; scores: DailyScores }): void {
    const store = readStore();

    const weekStartDate = mondayOf(params.date);
    const weekStartKey = toYmd(weekStartDate);

    const weekIndex = getWeekIndexFor(params.date);
    const dayIndex = getDayIndexFor(params.date);

    const dateKey = toYmd(params.date);

    const week: LeagueWeek = store.weeks[weekStartKey] ?? {
        weekStart: weekStartKey,
        weekIndex,
        days: {},
    };

    week.weekIndex = weekIndex; // keep updated
    week.days[dateKey] = {
        date: dateKey,
        dayIndex,
        token: params.token,
        scores: params.scores,
    };

    store.weeks[weekStartKey] = week;
    console.log("[league] writing to:", STORE_PATH);
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
    console.log("[league] buildWeeklyTable weekStartKey =", weekStartKey, "available weeks =", Object.keys(store.weeks));
    if (!week) throw new Error(`Week not found: ${weekStartKey}`);

    // Dates Monday..Sunday
    const monday = new Date(weekStartKey);
    monday.setHours(0, 0, 0, 0);

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        dates.push(toYmd(d));
    }

    // Resolve day indexes Dxxx for each date
    const dCols = dates.map((d) => {
        const day = week.days[d];
        if (day?.dayIndex) return day.dayIndex;
        return getDayIndexFor(new Date(d));
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

    const fmt = (n: number) => n.toLocaleString("es-ES");

    // Column widths for monospace table
    const nameWidth = Math.min(
        18,
        Math.max(6, ...sliced.map((r) => r.name.length))
    );
    const colWidth = 6;

    const pad = (s: string, w: number) =>
        s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);
    const padL = (s: string, w: number) =>
        s.length >= w ? s.slice(0, w) : " ".repeat(w - s.length) + s;

    const lines: string[] = [];

    // Header
    lines.push(
        pad("NOMBRE", nameWidth) +
        " " +
        dCols.map((x) => padL(`D${x}`, colWidth)).join(" ") +
        " " +
        padL("TOTAL", colWidth)
    );

    // Rows
    for (const r of sliced) {
        const cells = r.perDay.map((v) => (v == null ? "-" : fmt(v)));
        lines.push(
            pad(r.name, nameWidth) +
            " " +
            cells.map((c) => padL(c, colWidth)).join(" ") +
            " " +
            padL(fmt(r.total), colWidth)
        );
    }

    const title = `Semana ${week.weekIndex} (${week.weekStart})`;
    return { title, table: lines.join("\n") };
}

export function getWeeklyPodium(weekStartKey: string): Array<{ name: string; total: number }> {
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

    // Collect players
    const players = new Set<string>();
    for (const d of dates) {
        const day = week.days[d];
        if (!day) continue;
        Object.keys(day.scores).forEach((p) => players.add(p));
    }

    const rows = Array.from(players).map((name) => {
        const total = dates.reduce((acc, d) => {
            const day = week.days[d];
            const v = day?.scores[name];
            return acc + (Number.isFinite(v) ? v! : 0);
        }, 0);
        return { name, total };
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

