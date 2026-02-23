import { readFileSync } from "node:fs";
import path from "node:path";

type DailyScores = Record<string, number>;

type LeagueDay = {
    date: string; // YYYY-MM-DD
    dayIndex: number;
    token: string;

    mapId?: string;
    mapName?: string;
    mapUrl?: string;
    mode?: "move" | "nm" | "nmpz";

    roundCount?: number;
    timeLimit?: number;

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

const STORE_PATH = path.join(process.cwd(), "data", "league.json");

function readStore(): Store {
    const raw = readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Store>;
    return { weeks: parsed.weeks ?? {}, players: parsed.players ?? {} };
}

export type FlatDay = LeagueDay & { weekStart: string; weekIndex: number };

export function getDaysInRange(startYmd: string, endYmd: string): FlatDay[] {
    const store = readStore();
    const out: FlatDay[] = [];

    for (const w of Object.values(store.weeks)) {
        for (const d of Object.values(w.days)) {
            if (!d?.date) continue;
            if (d.date < startYmd || d.date > endYmd) continue;
            out.push({ ...d, weekStart: w.weekStart, weekIndex: w.weekIndex });
        }
    }

    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
}

export function monthRange(year: number, month1to12: number): { start: string; end: string } {
    const m = String(month1to12).padStart(2, "0");
    const start = `${year}-${m}-01`;

    // último día del mes
    const dt = new Date(year, month1to12, 0); // mes siguiente, día 0 => último del mes actual
    const end = `${year}-${m}-${String(dt.getDate()).padStart(2, "0")}`;

    return { start, end };
}

export type TopMapRow = { mapId: string; mapName: string; count: number };

export function getTopMaps(days: FlatDay[], topN = 5): TopMapRow[] {
    const counts = new Map<string, { mapName: string; count: number }>();

    for (const d of days) {
        const mapId = d.mapId;
        if (!mapId) continue;

        const mapName = d.mapName ?? mapId;
        const prev = counts.get(mapId);

        if (prev) prev.count += 1;
        else counts.set(mapId, { mapName, count: 1 });
    }

    return Array.from(counts.entries())
        .map(([mapId, v]) => ({ mapId, mapName: v.mapName, count: v.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, topN);
}

export type ModeStats = {
    totalDays: number;
    countedDays: number;
    move: number;
    nm: number;
    nmpz: number;
    unknown: number;
};

export function getModeStats(days: FlatDay[]): ModeStats {
    const s: ModeStats = {
        totalDays: days.length,
        countedDays: 0,
        move: 0,
        nm: 0,
        nmpz: 0,
        unknown: 0,
    };

    for (const d of days) {
        const mode = d.mode;
        if (!mode) {
            s.unknown += 1;
            continue;
        }
        s.countedDays += 1;
        if (mode === "move") s.move += 1;
        else if (mode === "nm") s.nm += 1;
        else if (mode === "nmpz") s.nmpz += 1;
        else s.unknown += 1;
    }

    return s;
}


export type PlayerDaysRow = { geoId: string; daysPlayed: number };

export function getPlayerDaysPlayed(days: FlatDay[]): PlayerDaysRow[] {
    const counts = new Map<string, number>();

    for (const d of days) {
        for (const geoId of Object.keys(d.scores ?? {})) {
            counts.set(geoId, (counts.get(geoId) ?? 0) + 1);
        }
    }

    return Array.from(counts.entries())
        .map(([geoId, daysPlayed]) => ({ geoId, daysPlayed }))
        .sort((a, b) => b.daysPlayed - a.daysPlayed);
}


export type PlayerAvgRow = { geoId: string; daysPlayed: number; total: number; avg: number };

export function getPlayerAverageScore(days: FlatDay[], minDays = 3): PlayerAvgRow[] {
    const totals = new Map<string, { total: number; days: number }>();

    for (const d of days) {
        for (const [geoId, score] of Object.entries(d.scores ?? {})) {
            if (!Number.isFinite(score)) continue;
            const cur = totals.get(geoId) ?? { total: 0, days: 0 };
            cur.total += score as number;
            cur.days += 1;
            totals.set(geoId, cur);
        }
    }

    return Array.from(totals.entries())
        .map(([geoId, v]) => ({
            geoId,
            daysPlayed: v.days,
            total: v.total,
            avg: v.days > 0 ? v.total / v.days : 0,
        }))
        .filter((r) => r.daysPlayed >= minDays)
        .sort((a, b) => b.avg - a.avg);
}

export type BestDayRow = {
    geoId: string;
    score: number;
    date: string;
    dayIndex: number;
    mapName?: string;
    mode?: string;
    roundCount?: number;
    timeLimit?: number;
};

export function getBestSingleDay(days: FlatDay[]): BestDayRow | null {
    let best: BestDayRow | null = null;

    for (const d of days) {
        const dayIndex = d.dayIndex;
        for (const [geoId, score] of Object.entries(d.scores ?? {})) {
            if (!Number.isFinite(score)) continue;

            if (!best || (score as number) > best.score) {
                best = {
                    geoId,
                    score: score as number,
                    date: d.date,
                    dayIndex,
                    mapName: d.mapName,
                    mode: d.mode,
                    roundCount: (d as any).roundCount,
                    timeLimit: (d as any).timeLimit,
                };
            }
        }
    }

    return best;
}

export type ImprovementRow = {
    geoId: string;
    firstDays: number;
    secondDays: number;
    firstAvg: number;
    secondAvg: number;
    delta: number; // secondAvg - firstAvg
};

export function getBiggestImprovement(
    days: FlatDay[],
    minDaysPerHalf = 2
): ImprovementRow | null {
    const byPlayer = new Map<
        string,
        { fTotal: number; fDays: number; sTotal: number; sDays: number }
    >();

    for (const d of days) {
        const dayOfMonth = Number(d.date.slice(8, 10)); // "YYYY-MM-DD" -> DD
        const half = dayOfMonth <= 15 ? "first" : "second";

        for (const [geoId, score] of Object.entries(d.scores ?? {})) {
            if (!Number.isFinite(score)) continue;

            const cur = byPlayer.get(geoId) ?? { fTotal: 0, fDays: 0, sTotal: 0, sDays: 0 };

            if (half === "first") {
                cur.fTotal += score as number;
                cur.fDays += 1;
            } else {
                cur.sTotal += score as number;
                cur.sDays += 1;
            }

            byPlayer.set(geoId, cur);
        }
    }

    let best: ImprovementRow | null = null;

    for (const [geoId, v] of byPlayer.entries()) {
        if (v.fDays < minDaysPerHalf || v.sDays < minDaysPerHalf) continue;

        const firstAvg = v.fTotal / v.fDays;
        const secondAvg = v.sTotal / v.sDays;
        const delta = secondAvg - firstAvg;

        if (!best || delta > best.delta) {
            best = { geoId, firstDays: v.fDays, secondDays: v.sDays, firstAvg, secondAvg, delta };
        }
    }

    return best;
}

export function getTopImprovements(
    days: FlatDay[],
    topN = 3,
    minDaysPerHalf = 2
): ImprovementRow[] {
    const byPlayer = new Map<
        string,
        { fTotal: number; fDays: number; sTotal: number; sDays: number }
    >();

    for (const d of days) {
        const dayOfMonth = Number(d.date.slice(8, 10));
        const half = dayOfMonth <= 15 ? "first" : "second";

        for (const [geoId, score] of Object.entries(d.scores ?? {})) {
            if (!Number.isFinite(score)) continue;

            const cur = byPlayer.get(geoId) ?? { fTotal: 0, fDays: 0, sTotal: 0, sDays: 0 };
            if (half === "first") { cur.fTotal += score as number; cur.fDays += 1; }
            else { cur.sTotal += score as number; cur.sDays += 1; }
            byPlayer.set(geoId, cur);
        }
    }

    const rows: ImprovementRow[] = [];
    for (const [geoId, v] of byPlayer.entries()) {
        if (v.fDays < minDaysPerHalf || v.sDays < minDaysPerHalf) continue;
        const firstAvg = v.fTotal / v.fDays;
        const secondAvg = v.sTotal / v.sDays;
        const delta = secondAvg - firstAvg;
        rows.push({ geoId, firstDays: v.fDays, secondDays: v.sDays, firstAvg, secondAvg, delta });
    }

    rows.sort((a, b) => b.delta - a.delta);
    return rows.slice(0, topN);
}


export type PlayerTotalRow = { geoId: string; total: number; daysPlayed: number };

export function getPlayerMonthlyTotals(days: FlatDay[]): PlayerTotalRow[] {
    const m = new Map<string, { total: number; days: number }>();

    for (const d of days) {
        for (const [geoId, score] of Object.entries(d.scores ?? {})) {
            if (!Number.isFinite(score)) continue;
            const cur = m.get(geoId) ?? { total: 0, days: 0 };
            cur.total += score as number;
            cur.days += 1;
            m.set(geoId, cur);
        }
    }

    return Array.from(m.entries())
        .map(([geoId, v]) => ({ geoId, total: v.total, daysPlayed: v.days }))
        .sort((a, b) => b.total - a.total);
}

export type MapAvgRow = {
    mapId: string;
    mapName: string;
    plays: number;        // total partidas (sumando jugadores)
    days: number;         // días que salió el mapa
    avg: number;          // media global (todas las partidas)
};

export type MapBestPlayerRow = {
    mapId: string;
    mapName: string;
    geoId: string;
    plays: number;
    avg: number;
};

export function getTopMapsByAverageScore(
    days: FlatDay[],
    topN = 5,
    minMapDays = 2
): MapAvgRow[] {
    const mapAgg = new Map<
        string,
        { mapName: string; sum: number; plays: number; daySet: Set<string> }
    >();

    for (const d of days) {
        const mapId = d.mapId;
        if (!mapId) continue;

        const entry =
            mapAgg.get(mapId) ??
            { mapName: d.mapName ?? mapId, sum: 0, plays: 0, daySet: new Set<string>() };

        entry.daySet.add(d.date);

        for (const score of Object.values(d.scores ?? {})) {
            if (!Number.isFinite(score)) continue;
            entry.sum += score as number;
            entry.plays += 1;
        }

        mapAgg.set(mapId, entry);
    }

    const rows: MapAvgRow[] = [];
    for (const [mapId, v] of mapAgg.entries()) {
        const dayCount = v.daySet.size;
        if (dayCount < minMapDays) continue;
        const avg = v.plays > 0 ? v.sum / v.plays : 0;
        rows.push({ mapId, mapName: v.mapName, plays: v.plays, days: dayCount, avg });
    }

    rows.sort((a, b) => b.avg - a.avg);
    return rows.slice(0, topN);
}

export function getBestPlayerPerMap(
    days: FlatDay[],
    mapIds: string[],
    minPlayerPlays = 2
): MapBestPlayerRow[] {
    // mapId -> geoId -> {sum, plays}
    const agg = new Map<string, Map<string, { sum: number; plays: number; mapName: string }>>();

    for (const d of days) {
        const mapId = d.mapId;
        if (!mapId || !mapIds.includes(mapId)) continue;

        const perMap =
            agg.get(mapId) ?? new Map<string, { sum: number; plays: number; mapName: string }>();

        for (const [geoId, score] of Object.entries(d.scores ?? {})) {
            if (!Number.isFinite(score)) continue;
            const cur = perMap.get(geoId) ?? { sum: 0, plays: 0, mapName: d.mapName ?? mapId };
            cur.sum += score as number;
            cur.plays += 1;
            perMap.set(geoId, cur);
        }

        agg.set(mapId, perMap);
    }

    const out: MapBestPlayerRow[] = [];

    for (const [mapId, perMap] of agg.entries()) {
        let best: MapBestPlayerRow | null = null;

        for (const [geoId, v] of perMap.entries()) {
            if (v.plays < minPlayerPlays) continue;
            const avg = v.sum / v.plays;

            if (!best || avg > best.avg) {
                best = { mapId, mapName: v.mapName, geoId, plays: v.plays, avg };
            }
        }

        if (best) out.push(best);
    }

    return out;
}

