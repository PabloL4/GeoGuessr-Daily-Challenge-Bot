import { resyncDateRange } from "./resyncRange.js";

export async function resyncWeek(weekStartKey: string): Promise<{ ok: true; days: number; players: number } | { ok: false; reason: string }> {
    const monday = new Date(`${weekStartKey}T00:00:00Z`);
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    return resyncDateRange(weekStartKey, sunday.toISOString().slice(0, 10));
}
