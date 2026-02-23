import fs from "node:fs";
import path from "node:path";

const STORE_PATH = path.join(process.cwd(), "data", "league.json");

export function isLikelyGeoId(s: string): boolean {
    const v = s.trim();
    return /^[a-f0-9]{20,40}$/i.test(v);
}

type LinkResult =
    | { ok: true; status: "linked" | "already_linked" }
    | { ok: false; reason: string };

export function linkGeoToDiscord(geoIdRaw: string, discordId: string): LinkResult {
    const geoId = geoIdRaw.trim();

    if (!isLikelyGeoId(geoId)) {
        return { ok: false, reason: "Ese GeoGuessr ID no tiene un formato válido (copia el userId, no el nick)." };
    }

    const raw = fs.existsSync(STORE_PATH) ? fs.readFileSync(STORE_PATH, "utf8") : "{}";
    const store = JSON.parse(raw) as any;

    store.players ??= {};

    // 1) Si este geoId ya está vinculado a otro Discord -> rechazar
    const existingDiscordForGeo = store.players?.[geoId]?.discordId as string | undefined;
    if (existingDiscordForGeo && existingDiscordForGeo !== discordId) {
        return {
            ok: false,
            reason:
                "Ese GeoGuessr ID ya está vinculado a otro usuario de Discord. Si es un error, pídele a un admin que lo revise.",
        };
    }

    // 2) Si este Discord ya está vinculado a OTRO geoId -> rechazar
    for (const [otherGeoId, info] of Object.entries<any>(store.players)) {
        if (otherGeoId === geoId) continue;
        if (info?.discordId === discordId) {
            return {
                ok: false,
                reason:
                    `Tu Discord ya está vinculado a otro GeoGuessr ID (${otherGeoId}). Si quieres cambiarlo, pide a un admin que lo resetee.`,
            };
        }
    }

    // 3) Vinculación (idempotente)
    store.players[geoId] ??= {};
    store.players[geoId].discordId = discordId;

    // fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");

    return { ok: true, status: existingDiscordForGeo ? "already_linked" : "linked" };
}

type UnlinkResult =
    | { ok: true; geoId: string }
    | { ok: false; reason: string };

export function unlinkGeoFromDiscordByGeoId(geoIdRaw: string): UnlinkResult {
    const geoId = geoIdRaw.trim();

    const raw = fs.existsSync(STORE_PATH) ? fs.readFileSync(STORE_PATH, "utf8") : "{}";
    const store = JSON.parse(raw) as any;

    if (!store.players?.[geoId]?.discordId) {
        return { ok: false, reason: "Ese GeoGuessr ID no está vinculado a ningún Discord." };
    }

    delete store.players[geoId].discordId;

    // fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
    const tmp = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, STORE_PATH);

    return { ok: true, geoId };
}

export function unlinkGeoFromDiscordByDiscordId(discordId: string): UnlinkResult {
    const raw = fs.existsSync(STORE_PATH) ? fs.readFileSync(STORE_PATH, "utf8") : "{}";
    const store = JSON.parse(raw) as any;

    for (const [geoId, info] of Object.entries<any>(store.players ?? {})) {
        if (info?.discordId === discordId) {
            delete store.players[geoId].discordId;
            fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
            return { ok: true, geoId };
        }
    }

    return { ok: false, reason: "Ese usuario de Discord no está vinculado a ningún GeoGuessr ID." };
}



