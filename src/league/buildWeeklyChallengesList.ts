import { mondayOf, toYmd } from "./weeklyStore.js";
import fs from "node:fs";
import path from "node:path";
import { t } from "../i18n/index.js";

type StoredLeagueDay = {
    date: string;
    token: string;
    mapName?: string;
    mapUrl?: string;
    mode?: "move" | "nm" | "nmpz";
    roundCount?: number;
    timeLimit?: number;
};

type StoredLeagueWeek = {
    weekStart: string;
    weekIndex: number;
    days: Record<string, StoredLeagueDay>;
};

type Store = {
    weeks: Record<string, StoredLeagueWeek>;
};

export type WeeklyChallengeListItem = {
    date: string;           // YYYY-MM-DD
    dayKey: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";
    token: string;
    challengeUrl: string;
    mapName: string;
    mapUrl?: string;
    mode: "move" | "nm" | "nmpz";
    roundCount: number;
    timeLimit: number;
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "league.json");

function readStore(): Store {
    if (!fs.existsSync(STORE_PATH)) return { weeks: {} };
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as Partial<Store>;
    return { weeks: parsed.weeks ?? {} };
}

function challengeUrl(token: string): string {
    return `https://www.geoguessr.com/challenge/${token}`;
}

function formatMode(mode: "move" | "nm" | "nmpz"): "Move" | "NM" | "NMPZ" {
    if (mode === "nm") return "NM";
    if (mode === "nmpz") return "NMPZ";
    return "Move";
}

function getDayKey(date: Date): WeeklyChallengeListItem["dayKey"] | null {
    const day = date.getDay();
    if (day === 1) return "monday";
    if (day === 2) return "tuesday";
    if (day === 3) return "wednesday";
    if (day === 4) return "thursday";
    if (day === 5) return "friday";
    if (day === 6) return "saturday";
    return null;
}

/**
 * Devuelve los challenges de la semana "actual" en contexto domingo:
 * - calcula el lunes de la semana de referenceDate
 * - devuelve lunes..sábado
 */
export function buildWeeklyChallengesList(referenceDate = new Date()): WeeklyChallengeListItem[] {
    const store = readStore();

    const monday = mondayOf(referenceDate);
    const weekStartKey = toYmd(monday);
    const week = store.weeks[weekStartKey];

    if (!week) return [];

    const items: WeeklyChallengeListItem[] = [];

    for (let i = 0; i < 6; i++) {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);

        const dateKey = toYmd(d);
        const day = week.days?.[dateKey];
        const dayKey = getDayKey(d);
        if (!dayKey) continue;
        if (!day?.token) continue;

        items.push({
            date: dateKey,
            dayKey,
            token: day.token,
            challengeUrl: challengeUrl(day.token),
            mapName: day.mapName ?? "Mapa desconocido",
            mapUrl: day.mapUrl,
            mode: day.mode ?? "move",
            roundCount: day.roundCount ?? 5,
            timeLimit: day.timeLimit ?? 0,
        });
    }

    return items;
}

function getModeTranslationKey(mode: "move" | "nm" | "nmpz"): string {
    return `weeklyChallenges.mode.${mode}`;
}

export function formatWeeklyChallengesList(referenceDate = new Date()): string {
    const items = buildWeeklyChallengesList(referenceDate);

    if (!items.length) {
        return t("weeklyChallenges.empty");
    }

    const lines: string[] = [];
    lines.push(t("weeklyChallenges.title"));
    lines.push("");

    for (const item of items) {
        lines.push(`**${t(`weeklyChallenges.day.${item.dayKey}`)}**`);
        lines.push(item.challengeUrl);
        lines.push(
            t("weeklyChallenges.line", {
                mapName: item.mapName,
                timeLimit: item.timeLimit,
                roundCount: item.roundCount,
                mode: t(getModeTranslationKey(item.mode)),
            })
        );
        lines.push("");
    }

    return lines.join("\n").trim();
}