import { readFile } from "node:fs/promises";
import fsSync from "node:fs";
import path from "path";
import { ChallengePayload, ChallengeSettings, GameMode } from "./types.js";
import { mondayOf, toYmd } from "./league/weeklyStore.js"; // ajusta ruta si hace falta

const STORE_PATH = path.join(process.cwd(), "data", "league.json");

function getWeekdayUTC(): number {
    // 0 = domingo, 1 = lunes, ..., 6 = sábado
    return new Date().getUTCDay();
}

function randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

const TEN_ROUNDS_DAY = 3; // 3 = miércoles
const FAST_ROUND_DAY = 1; // 1 = lunes (por ejemplo)

export function createChallengePayload(settings: ChallengeSettings): ChallengePayload {
    const { map, mode } = settings;

    // ✅ Usa lo que ya decidió defaultChallenge()
    const roundCount = settings.roundCount ?? 5;
    const timeLimit = settings.timeLimit ?? 60;

    // (Opcional) Asegurar múltiplos de 10 si GeoGuessr lo requiere
    const snappedTimeLimit = Math.round(timeLimit / 10) * 10;

    return {
        map,
        forbidMoving: mode === "NM" || mode === "NMPZ",
        forbidRotating: mode === "NMPZ",
        forbidZooming: mode === "NMPZ",
        timeLimit: snappedTimeLimit,
        roundCount,
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
        const raw = await readFile(LEAGUE_PATH, "utf8");
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

function countMovesThisWeek(today = new Date()): number {
    if (!fsSync.existsSync(STORE_PATH)) return 0;
    const raw = fsSync.readFileSync(STORE_PATH, "utf8");
    const store = JSON.parse(raw) as any;

    const weekKey = toYmd(mondayOf(today));
    const week = store.weeks?.[weekKey];
    if (!week?.days) return 0;

    return Object.values<any>(week.days).filter((d) => {
        const m = String(d?.mode ?? "").toLowerCase();
        return m === "move";
    }).length;
}


export async function defaultChallenge(): Promise<ChallengeSettings> {
    const raw = await readFile(MAPS_PATH, "utf8");
    const parsed = JSON.parse(raw) as MapsFile;

    if (!parsed.maps?.length) throw new Error("data/maps.json has no maps");

    const todayYmd = new Date().toISOString().slice(0, 10);
    const recent = await readRecentPicks(60);
    const lastMode = recent[0]?.mode;

    const candidates = filterByCooldown(parsed.maps, todayYmd, recent);
    const pool = candidates.length ? candidates : parsed.maps;

    const chosen = weightedPick(pool, (m) => m.weight ?? 1);

    const map = urlToMapId(chosen.url);
    let modeLower = pickMode(chosen, lastMode, recent);

    // ✅ Regla: máximo 1 MOVE por semana
    const movesSoFar = countMovesThisWeek(new Date());
    if (movesSoFar >= 1 && modeLower === "move") {
        // fuerza a elegir NM/NMPZ si el mapa lo permite
        const allowed = chosen.modes?.allowed ?? ["move", "nm", "nmpz"];
        const nonMove = allowed.filter((m: string) => m !== "move");
        modeLower = (nonMove.includes("nmpz") ? "nmpz" : nonMove[0] ?? "nm") as any;
    }
    const mode = toGameMode(modeLower);

    // ✅ NEW: rounds + timeLimit rules
    const weekday = getWeekdayUTC();
    const roundCount = weekday === TEN_ROUNDS_DAY ? 10 : 5;

    let timeLimit: number;
    if (mode === "Move") {
        timeLimit = randomFrom([60, 90, 120, 180]);
    } else if (weekday === FAST_ROUND_DAY) {
        timeLimit = 10;
    } else {
        timeLimit = randomFrom([20, 30, 60]);
    }

    return { map, mode, timeLimit, roundCount };
}


