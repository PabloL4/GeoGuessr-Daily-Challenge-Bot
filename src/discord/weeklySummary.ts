import { postToDiscord } from "./discordPoster.js";
import { buildWeeklyTable, getWeeklyPodium } from "../league/weeklyStore.js";

/**
 * Posts the weekly summary table (Monday-Sunday) to Discord.
 * weekStartKey must be the Monday date in YYYY-MM-DD (e.g. 2026-01-12).
 */
export async function postWeeklySummaryToDiscord(weekStartKey: string): Promise<void> {
    
    const podium = getWeeklyPodium(weekStartKey);

    const medals = ["🥇", "🥈", "🥉"];
    const podiumLines = podium
    .map((p, i) => `${medals[i]} ${p.name} — ${p.total.toLocaleString("es-ES")} pts`)
    .join("\n");

    const podiumBlock = podiumLines
    ? `\n**Podio semanal**\n${podiumLines}\n`
    : "";
    
    const { title, table } = buildWeeklyTable(weekStartKey);

    const message =
    `## 🏁 ${title}\n` +
    podiumBlock +
    "```" + "\n" +
    table + "\n" +
    "```";
    
    await postToDiscord(message);
}
