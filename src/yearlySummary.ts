import { getYearlyRanking } from "./league/yearlyStore.js";
import { postToDiscord } from "./discord/discordPoster.js";
import { podiumNameForGeoId, tableNameForGeoId } from "./discord/mention.js";



export async function postYearlySummary(year: number): Promise<void> {
    const ranking = getYearlyRanking(year);

    if (!ranking.length) {
        await postToDiscord(`❌ No data available for year ${year}.`);
        return;
    }

    const podium = ranking.slice(0, 3);

    const podiumLines = podium.map(
        (p, i) => `• ${podiumNameForGeoId(p.geoId)} ${["🥇", "🥈", "🥉"][i]}`
    );

    const tableLines = ranking.map((r, i) =>
        `${String(i + 1).padStart(2, " ")}. ${tableNameForGeoId(r.geoId)} — ` +
        `${r.total.toLocaleString()} puntos (${r.daysPlayed} días)`
    );

    const message =
        `## 🏆 Resumen anual ${year}\n\n` +
        `**Podio:**\n${podiumLines.join("\n")}\n\n` +
        `**Clasificación completa:**\n` +
        "```text\n" +
        tableLines.join("\n") +
        "\n```";

    await postToDiscord(message);
}
