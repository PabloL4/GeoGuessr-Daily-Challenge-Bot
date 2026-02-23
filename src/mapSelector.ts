// src/league/mapSelector.ts
import fs from "node:fs";
import path from "node:path";

export type AllowedMode = "move" | "nm" | "nmpz";

export type MapConfig = {
    id: string;
    name: string;
    url: string;
    modes: {
        allowed: AllowedMode[];
        recommended?: AllowedMode[];
    };
    weight?: number;
    cooldownDays?: number;
    tags?: string[];
};

type MapsFile = { maps: MapConfig[] };

export type RecentPick = {
    date: string;   // YYYY-MM-DD
    mapId: string;
    mode: AllowedMode;
};

export type PickResult = {
    map: MapConfig;
    mode: AllowedMode;
};

const MAPS_PATH = path.join(process.cwd(), "data", "maps.json");

function readMaps(): MapConfig[] {
    const raw = fs.readFileSync(MAPS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as MapsFile;
    return parsed.maps ?? [];
}

function daysBetween(a: string, b: string): number {
    const ta = new Date(a + "T00:00:00Z").getTime();
    const tb = new Date(b + "T00:00:00Z").getTime();
    return Math.floor(Math.abs(ta - tb) / (1000 * 60 * 60 * 24));
}

function weightedPick<T>(items: T[], w: (x: T) => number): T {
    const weights = items.map((x) => Math.max(0, w(x)));
    const total = weights.reduce((s, v) => s + v, 0);
    if (total <= 0) return items[Math.floor(Math.random() * items.length)];

    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
    }
    return items[items.length - 1];
}

function pickMode(map: MapConfig, lastMode?: AllowedMode): AllowedMode {
    const allowed = map.modes.allowed;
    const recommended = map.modes.recommended ?? [];

    // 70% recomendado si existe
    let pool: AllowedMode[] =
        recommended.length > 0 && Math.random() < 0.7 ? recommended : allowed;

    // evita repetir modo de ayer si se puede
    if (lastMode && pool.length > 1 && pool.includes(lastMode)) {
        const filtered = pool.filter((m) => m !== lastMode);
        if (filtered.length) pool = filtered;
    }

    return pool[Math.floor(Math.random() * pool.length)];
}

export function selectDailyMap(today: string, recent: RecentPick[]): PickResult {
    const maps = readMaps();
    if (!maps.length) throw new Error("maps.json has no maps");

    const lastMode = recent[0]?.mode;

    const candidates = maps.filter((m) => {
        const cd = m.cooldownDays ?? 0;
        if (cd <= 0) return true;

        const last = recent.find((r) => r.mapId === m.id);
        if (!last) return true;

        return daysBetween(today, last.date) > cd;
    });

    const pool = candidates.length ? candidates : maps;
    const map = weightedPick(pool, (m) => m.weight ?? 1);
    const mode = pickMode(map, lastMode);

    // safety
    const finalMode = map.modes.allowed.includes(mode) ? mode : map.modes.allowed[0];
    return { map, mode: finalMode };
}
