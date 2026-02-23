import { postToDiscord } from "./discordPoster.js";
import { buildWeeklyTable, getWeeklyPodium, getWeeklyPerfectAttendance } from "../league/weeklyStore.js";
import { displayNameForGeoId } from "./mention.js";
import { renderTableImage } from "./renderTableImage.js";
import { getWeeklyBestDailyByRounds, getWeeklyBestDailyByRoundsAndMode } from "../league/weeklyStore.js";


/**
 * Posts the weekly summary table (Monday-Sunday) to Discord.
 * weekStartKey must be the Monday date in YYYY-MM-DD (e.g. 2026-01-12).
 */
export async function postWeeklySummaryToDiscord(weekStartKey: string): Promise<void> {

    const roleId = process.env.DISCORD_ROLE_DAILY_ID; // solo números
    const ping = roleId ? `<@&${roleId}>` : "@Desafío Diario";

    const podium = getWeeklyPodium(weekStartKey);
    const perfect = getWeeklyPerfectAttendance(weekStartKey);

    const { title, table } = buildWeeklyTable(weekStartKey);

    const best5Move = getWeeklyBestDailyByRoundsAndMode(weekStartKey, 5, "move");
    const best5Nm = getWeeklyBestDailyByRoundsAndMode(weekStartKey, 5, "nm");
    const best5Nmpz = getWeeklyBestDailyByRoundsAndMode(weekStartKey, 5, "nmpz");

    const best10 = getWeeklyBestDailyByRounds(weekStartKey, 10);

    const fmtPts = (n: number) => n.toLocaleString("es-ES");

    const extraAwardsLines: string[] = [];

    // ✅ Top 5 rounds por modo

    if (best5Nmpz) {
        extraAwardsLines.push(
            `· ${displayNameForGeoId(best5Nmpz.geoId)} por la mejor puntuación en **NMPZ (5️⃣ rondas)**: **${fmtPts(best5Nmpz.score)}** en el desafío **#${best5Nmpz.dayIndex}**.`
        );
    }
    if (best5Nm) {
        extraAwardsLines.push(
            `· ${displayNameForGeoId(best5Nm.geoId)} por la mejor puntuación en **NM (5️⃣ rondas)**: **${fmtPts(best5Nm.score)}** en el desafío **#${best5Nm.dayIndex}**.`
        );
    }

    if (best5Move) {
        extraAwardsLines.push(
            `· ${displayNameForGeoId(best5Move.geoId)} por la mejor puntuación en **Move (5️⃣ rondas)**: **${fmtPts(best5Move.score)}** en el desafío **#${best5Move.dayIndex}**.`
        );
    }
    if (best10) {
        extraAwardsLines.push(
            `· ${displayNameForGeoId(best10.geoId)} por obtener el puntaje más alto en las partidas de 🔟 rondas, con **${fmtPts(best10.score)}** en el desafío **#${best10.dayIndex}**.`
        );
    }

    const extraAwardsBlock = extraAwardsLines.length
        ? `Felicitaciones, también, a:\n${extraAwardsLines.join("\n")}\n\n`
        : "";


    const medals = ["🥇", "🥈", "🥉"];

    // Podio vertical
    const podiumLines = podium
        .slice(0, 3)
        .map((p, i) => `${medals[i]} **${displayNameForGeoId(p.geoId)}**`)
        .join("\n");

    // Constancia en una sola línea con comas
    const perfectLine = perfect.length
        ? perfect.map((geoId) => displayNameForGeoId(geoId)).join(", ")
        : "(nadie todavía)";

    // ✅ NUEVO: renderizar tabla como imagen
    const imagePath = await renderTableImage({
        title: `Resumen semanal — ${title}`,
        lines: table.split("\n"),
        outputFile: `./data/weekly-${weekStartKey}.png`,
    });

    // ✅ Mensaje sin bloque de código (para móvil)
    const message =
        `## RESUMEN ${title} ${ping}\n\n` +
        `¡Hola a todos! Les dejo el resumen con la clasificación general de los últimos 7 desafíos.\n\n` +
        (podium.length
            ? `Felicitaciones a los ganadores de la semana:\n\n${podiumLines}\n\n`
            : "") +
        extraAwardsBlock +
        (perfect.length
            ? `Muchas gracias también a quienes jugararon **todos los desafíos (7/7)**:\n${perfectLine}\n\n`
            : ""
        ) +

        `Comienza una nueva ronda de desafíos, así que ¡prepárense!`;

    await postToDiscord(message, imagePath);
}

