import fs from "fs/promises";
import path from "path";
import { ChallengePayload, ChallengeSettings, GameMode } from "./types.js";

export function createChallengePayload(settings: ChallengeSettings): ChallengePayload {
    const { map, mode } = settings;
    return {
        map,
        forbidMoving: mode === "NM" || mode === "NMPZ",
        forbidRotating: mode === "NMPZ",
        forbidZooming: mode === "NMPZ",
        timeLimit: 60,
        rounds: 5,
    };
}

type AllowedModeLower = "move" | "nm" | "nmpz";

type MapConfig = {
    id: string;
    name: string;
    url: string;
    modes: {
        allowed: AllowedModeLower[];
        recommended?: AllowedModeLower[];
    };
    weight?: number;
    cooldownDays?: number;
    tags?: string[];
};

type MapsFile = { maps: MapConfig[] };

const MAPS_PATH = path.join(process.cwd(), "data", "maps.json");

const urlToMapId = (url: string) => url.split("/").pop() || "";

function toGameMode(m: AllowedModeLower): GameMode {
    if (m === "move") return "Move";
    if (m === "nm") return "NM";
    return "NMPZ";
}

function weightedPick<T>(items: T[], weightOf: (x: T) => number): T {
    const weights = items.map((x) => Math.max(0, weightOf(x)));
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return items[Math.floor(Math.random() * items.length)];

    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
    }
    return items[items.length - 1];
}

function hasTooManyMove(recent: Array<{ mode?: AllowedModeLower }>, limit = 1): boolean {
    const last7 = recent.slice(0, 7);
    const moves = last7.filter((r) => r.mode === "move").length;
    return moves >= limit;
}
function pickMode(
    map: MapConfig,
    lastMode: AllowedModeLower | undefined,
    recent: Array<{ mode?: AllowedModeLower }>
): AllowedModeLower {
    const allowed = map.modes.allowed;
    const recommended = map.modes.recommended ?? [];

    // 70% recomendado si existe
    let pool: AllowedModeLower[] =
        recommended.length > 0 && Math.random() < 0.7 ? recommended : allowed;

    // 🚫 evitar repetir modo de ayer si se puede
    if (lastMode && pool.length > 1 && pool.includes(lastMode)) {
        const filtered = pool.filter((m) => m !== lastMode);
        if (filtered.length > 0) pool = filtered;
    }

    // ✅ regla: MOVE máx 1 en últimos 7 días (ventana deslizante)
    const moveBlocked = hasTooManyMove(recent, 1);
    if (moveBlocked && pool.includes("move")) {
        const withoutMove = pool.filter((m) => m !== "move");
        if (withoutMove.length > 0) pool = withoutMove;
        // si queda vacío (mapa solo permite move), lo dejamos como está
    }

    return pool[Math.floor(Math.random() * pool.length)];
}


type RecentPick = { date: string; mapId: string; mode?: AllowedModeLower };

type LeagueStore = {
    weeks?: Record<string, any>;
};

const LEAGUE_PATH = path.join(process.cwd(), "data", "league.json");

function daysBetween(a: string, b: string): number {
    const ta = new Date(a + "T00:00:00Z").getTime();
    const tb = new Date(b + "T00:00:00Z").getTime();
    return Math.floor(Math.abs(ta - tb) / (1000 * 60 * 60 * 24));
}

async function readRecentPicks(limitDays = 60): Promise<RecentPick[]> {
    try {
        const raw = await fs.readFile(LEAGUE_PATH, "utf8");
        const store = JSON.parse(raw) as LeagueStore;

        const days: any[] = [];
        for (const w of Object.values(store.weeks ?? {})) {
            for (const d of Object.values((w as any).days ?? {})) days.push(d);
        }

        days.sort((a, b) => (a.date < b.date ? 1 : -1)); // desc

        const picks: RecentPick[] = [];
        for (const d of days) {
            if (picks.length >= limitDays) break;
            if (d?.date && d?.mapId) picks.push({ date: d.date, mapId: d.mapId, mode: d.mode });
        }
        return picks;
    } catch {
        return [];
    }
}

function filterByCooldown(
    maps: MapConfig[],
    todayYmd: string,
    recent: RecentPick[]
): MapConfig[] {
    return maps.filter((m) => {
        const cd = m.cooldownDays ?? 0;
        if (cd <= 0) return true;

        const last = recent.find((r) => r.mapId === m.id);
        if (!last) return true;

        return daysBetween(todayYmd, last.date) > cd;
    });
}


export async function defaultChallenge(): Promise<ChallengeSettings> {
    const raw = await fs.readFile(MAPS_PATH, "utf8");
    const parsed = JSON.parse(raw) as MapsFile;

    if (!parsed.maps?.length) throw new Error("data/maps.json has no maps");

    // ✅ NUEVO: histórico + cooldown
    const todayYmd = new Date().toISOString().slice(0, 10);
    const recent = await readRecentPicks(60);
    const lastMode = recent[0]?.mode;

    const candidates = filterByCooldown(parsed.maps, todayYmd, recent);
    const pool = candidates.length ? candidates : parsed.maps; // fallback si todo está en cooldown

    const chosen = weightedPick(pool, (m) => m.weight ?? 1);

    const map = urlToMapId(chosen.url);
    const modeLower = pickMode(chosen, lastMode, recent);

    const mode = toGameMode(modeLower);

    return { map, mode };
}

