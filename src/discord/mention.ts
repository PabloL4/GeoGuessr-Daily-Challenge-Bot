import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// league store lives in PROJECT/data/league.json
const STORE_PATH = path.join(__dirname, "../../data/league.json");

type PlayerInfo = {
    nick: string;
    country?: string;
    discordId?: string;
};

type Store = {
    weeks: Record<string, unknown>;
    players: Record<string, PlayerInfo>;
};

function readStore(): Store {
    try {
        if (!fs.existsSync(STORE_PATH)) return { weeks: {}, players: {} };
        const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as Partial<Store>;
        return { weeks: parsed.weeks ?? {}, players: parsed.players ?? {} };
    } catch {
        return { weeks: {}, players: {} };
    }
}

export function flagEmoji(country?: string): string {
    if (!country) return "";
    const cc = country.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return "";
    const A = 0x1f1e6;
    const codePoints = [...cc].map((c) => A + (c.charCodeAt(0) - 65));
    return String.fromCodePoint(...codePoints);
}

export function displayNameForGeoId(geoId: string): string {
    const store = readStore();
    const p = store.players[geoId];

    // fallback if unknown
    if (!p) return geoId;

    const mentionOrNick = p.discordId ? `<@${p.discordId}>` : p.nick;
    const flag = flagEmoji(p.country);

    return flag ? `${flag} ${mentionOrNick}` : mentionOrNick;
}
