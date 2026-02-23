import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAP_PATH = path.join(__dirname, "../../data/userMap.json");

type PlayerInfo = {
    nick: string;
    discordId?: string;
    country?: string; // ISO-2 like "ES"
};

type MapFile = {
    players: Record<string, PlayerInfo>; // key = GeoGuessr userId
};

function readMap(): MapFile {
    try {
        if (!fs.existsSync(MAP_PATH)) return { players: {} };
        return JSON.parse(fs.readFileSync(MAP_PATH, "utf-8")) as MapFile;
    } catch {
        return { players: {} };
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

export function displayNameForGeoId(geoId: string, fallbackNick?: string): string {
    const map = readMap();
    const p = map.players[geoId];
    if (!p) return fallbackNick ?? geoId;

    const mention = p.discordId ? `<@${p.discordId}>` : (fallbackNick ?? p.nick);
    const flag = flagEmoji(p.country);

    return flag ? `${flag} ${mention}` : mention;
}

// Backward-compatible alias (old code expects this name)
export function mentionForGeoguessrNick(nick: string): string {
  // For now we don't have geoId here, so just return nick (no mention).
  // We'll switch weeklySummary to use geoId in the next step.
    return nick;
}