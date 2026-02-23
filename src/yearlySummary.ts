// src/league/yearlySummary.ts
// Posts a yearly summary message to Discord.
//
// NOTE: You must adjust the two imports below to match your project paths:
// - postToDiscord: your existing Discord posting helper
// - displayNameForGeoId: your mention helper (adds flag + nick or mention depending on your logic)

import { buildYearlyTable, getYearlyFullAttendance, getYearlyStats } from "./league/yearlyStore.js";

import { postToDiscord } from "./discord/discordPoster.js";
import { displayNameForGeoId } from "./discord/mention.js";

function fmtInt(n: number): string {
    return Math.round(n).toLocaleString("es-ES");
}

export async function postYearlySummaryToDiscord(year: number): Promise<void> {
    const { rows, totalDaysInYear, bestDay } = getYearlyStats(year);

    const podium = rows.slice(0, 3);
    const medals = ["🥇", "🥈", "🥉"];

    const podiumBlock = podium.length
        ? `Ganadores del año:\n\n${podium
            .map((p, i) => `${medals[i]} **${displayNameForGeoId(p.geoId)}**`)
            .join("\n")}\n\n`
        : "";

    // Constancia anual = jugó todos los días registrados en tu data de ese año
    const fullAttendance = getYearlyFullAttendance(year);
    const attendanceLine = fullAttendance.length
        ? fullAttendance.map((geoId) => displayNameForGeoId(geoId)).join(", ")
        : "(nadie todavía)";

    const bestDayLine = bestDay
        ? `• Mejor día del año: **${displayNameForGeoId(bestDay.geoId)}** (${fmtInt(bestDay.score)} pts — ${bestDay.date})\n`
        : "";

    const statsLine =
        totalDaysInYear > 0
            ? `Datos: ${totalDaysInYear} días registrados en ${year}.\n\n`
            : `Datos: aún no hay días registrados para ${year}.\n\n`;

    const { title, table } = buildYearlyTable(year);

    const message =
        `## RESUMEN ANUAL ${title} @Desafío Diario\n\n` +
        statsLine +
        podiumBlock +
        (bestDayLine ? `🏆 Premios especiales\n${bestDayLine}\n` : "") +
        `🎯 Constancia (jugó todos los días registrados):\n${attendanceLine}\n\n` +
        "```" +
        "\n" +
        table +
        "\n" +
        "```";

    await postToDiscord(message);
}
