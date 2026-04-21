import fs from "node:fs";
import path from "node:path";
import { postToDiscord } from "../discord/discordPoster.js";
import { t } from "../i18n/index.js";

const DATA_DIR = path.join(process.cwd(), "data");
const ALERT_MARKER_PATH = path.join(DATA_DIR, "cookie-expired-alert.json");

function ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getCooldownMs(): number {
    const hours = Number(process.env.COOKIE_ALERT_COOLDOWN_HOURS ?? "12");
    return Math.max(1, hours) * 60 * 60 * 1000;
}

function shouldSendAlert(now: Date): boolean {
    if (!fs.existsSync(ALERT_MARKER_PATH)) return true;

    try {
        const raw = fs.readFileSync(ALERT_MARKER_PATH, "utf8");
        const parsed = JSON.parse(raw) as { sentAt?: string };
        if (!parsed.sentAt) return true;

        const sentAt = new Date(parsed.sentAt);
        if (Number.isNaN(sentAt.getTime())) return true;

        return now.getTime() - sentAt.getTime() >= getCooldownMs();
    } catch {
        return true;
    }
}

function markAlertSent(now: Date): void {
    ensureDataDir();
    fs.writeFileSync(ALERT_MARKER_PATH, JSON.stringify({ sentAt: now.toISOString() }, null, 2), "utf8");
}

export async function notifyCookieExpired(): Promise<void> {
    const now = new Date();
    if (!shouldSendAlert(now)) return;

    try {
        await postToDiscord(t("geoguessr.cookieExpired"));
        markAlertSent(now);
    } catch (error) {
        console.error("[geoguessr] failed to send cookie-expired alert", error);
    }
}

export async function notifyAuthFailureIfNeeded(status?: number): Promise<void> {
    if (status !== 401 && status !== 403) return;
    await notifyCookieExpired();
}
