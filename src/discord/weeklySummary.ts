import { postToDiscord } from "./discordPoster.js";
import { buildWeeklyTable, getWeeklyPodium, getWeeklyPerfectAttendance } from "../league/weeklyStore.js";
import { displayNameForGeoId } from "./mention.js";


/**
 * Posts the weekly summary table (Monday-Sunday) to Discord.
 * weekStartKey must be the Monday date in YYYY-MM-DD (e.g. 2026-01-12).
 */
export async function postWeeklySummaryToDiscord(weekStartKey: string): Promise<void> {
    const podium = getWeeklyPodium(weekStartKey);
    const perfect = getWeeklyPerfectAttendance(weekStartKey);

    const { title, table } = buildWeeklyTable(weekStartKey);

    const medals = ["🥇", "🥈", "🥉"];

    // Podio vertical (Opción A)
    const podiumLines = podium
        .slice(0, 3)
        .map((p, i) => `${medals[i]} **${displayNameForGeoId(p.geoId)}**`)
        .join("\n");

    // Constancia en una sola línea con comas
    const perfectLine = perfect.length
        ? perfect.map((geoId) => displayNameForGeoId(geoId)).join(", ")
        : "(nadie todavía)";

    const message =
        `## RESUMEN ${title} @Desafío Diario\n\n` +
        `¡Hola a todos! Les dejo el resumen con la clasificación general de los últimos 7 desafíos.\n\n` +
        (podium.length
            ? `Felicitaciones a los ganadores de la semana:\n\n${podiumLines}\n\n`
            : "") +
        `Muchas gracias también a quienes jugaron **todos los desafíos (7/7)**:\n${perfectLine}\n\n` +
        `Comienza una nueva ronda de desafíos, así que ¡prepárense!\n\n` +
        "```" +
        "\n" +
        table +
        "\n" +
        "```";

    await postToDiscord(message);
}

