import { postToDiscord } from "./discordPoster.js";
import { buildWeeklyTable, getWeeklyPodium, getWeeklyPerfectAttendance } from "../league/weeklyStore.js";
import { mentionForGeoguessrNick } from "./mention.js";



/**
 * Posts the weekly summary table (Monday-Sunday) to Discord.
 * weekStartKey must be the Monday date in YYYY-MM-DD (e.g. 2026-01-12).
 */
export async function postWeeklySummaryToDiscord(weekStartKey: string): Promise<void> {
    
    const podium = getWeeklyPodium(weekStartKey);
    const perfect = getWeeklyPerfectAttendance(weekStartKey);

    const perfectLine = perfect.length
    ? `\n**🎯 Constancia (7/7):** ${perfect.join(", ")}\n`
    : `\n**🎯 Constancia (7/7):** (nadie todavía)\n`;


    const medals = ["🥇", "🥈", "🥉"];
    const podiumLines = podium
    .map((p, i) => `${medals[i]} ${p.name} — ${p.total.toLocaleString("es-ES")} pts`)
    .join("\n");

    const podiumBlock = podiumLines
    ? `\n**Podio semanal**\n${podiumLines}\n`
    : "";
    
    const { title, table } = buildWeeklyTable(weekStartKey);

    const first = podium[0] ? mentionForGeoguessrNick(podium[0].name) : "";
    const second = podium[1] ? mentionForGeoguessrNick(podium[1].name) : "";
    const third = podium[2] ? mentionForGeoguessrNick(podium[2].name) : "";

    const perfectMentions = perfect.map(mentionForGeoguessrNick);

    const message =
        `## RESUMEN ${title} @Desafío Diario\n\n` +
        `¡Hola a todos! Les dejo el resumen con la clasificación general de los últimos 7 desafíos.\n\n` +
        (podium.length
            ? `Felicitaciones a **${first}** 🥇` +
            (second ? `, **${second}** 🥈` : "") +
            (third ? ` y **${third}** 🥉` : "") +
            `.\n\n`
            : "") +
        (perfectMentions.length
            ? `Muchas gracias también a quienes jugaron **todos los desafíos (7/7)**: ${perfectMentions.join(", ")}.\n\n`
            : `\n`) +
        `Comienza una nueva ronda de desafíos, así que ¡prepárense!\n\n` +
        "```" + "\n" +
        table + "\n" +
        "```";


    await postToDiscord(message);
}
