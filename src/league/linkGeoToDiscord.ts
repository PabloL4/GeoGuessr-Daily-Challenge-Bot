import fs from "node:fs";
import path from "node:path";

const STORE_PATH = path.join(process.cwd(), "data", "league.json");

// Validación ligera (GeoGuessr userId suele ser hex de 24 chars, pero a veces varía)
export function isLikelyGeoId(s: string): boolean {
    const v = s.trim();
    return /^[a-f0-9]{20,40}$/i.test(v);
}

export function linkGeoToDiscord(geoIdRaw: string, discordId: string): { ok: true } | { ok: false; reason: string } {
    const geoId = geoIdRaw.trim();

    if (!isLikelyGeoId(geoId)) {
        return { ok: false, reason: "Ese GeoGuessr ID no tiene un formato válido (copia el userId, no el nick)." };
    }

    const raw = fs.existsSync(STORE_PATH) ? fs.readFileSync(STORE_PATH, "utf8") : "{}";
    const store = JSON.parse(raw) as any;

    store.players ??= {};
    store.players[geoId] ??= {};

    // solo guardamos discordId (nick/country seguirán viniendo de tus highscores)
    store.players[geoId].discordId = discordId;

    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
    return { ok: true };
}
