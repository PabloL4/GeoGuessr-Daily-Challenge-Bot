import fs from "node:fs";
import path from "node:path";
import { t } from "../i18n/index.js";

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
        return { ok: false, reason: t("link.invalidGeoIdFormat") };
    }

    const raw = fs.existsSync(STORE_PATH) ? fs.readFileSync(STORE_PATH, "utf8") : "{}";
    const store = JSON.parse(raw) as any;

    store.players ??= {};

    const existingDiscordForGeo = store.players?.[geoId]?.discordId as string | undefined;
    if (existingDiscordForGeo && existingDiscordForGeo !== discordId) {
        return { ok: false, reason: t("link.geoIdAlreadyLinkedToOtherDiscord") };
    }

    for (const [otherGeoId, info] of Object.entries<any>(store.players)) {
        if (otherGeoId === geoId) continue;
        if (info?.discordId === discordId) {
            return {
                ok: false,
                reason: t("link.discordAlreadyLinkedToOtherGeoId", { otherGeoId }),
            };
        }
    }

    store.players[geoId] ??= {};
    store.players[geoId].discordId = discordId;

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
        return { ok: false, reason: t("link.geoIdNotLinked") };
    }

    delete store.players[geoId].discordId;

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

    return { ok: false, reason: t("link.discordNotLinked") };
}

