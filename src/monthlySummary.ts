import { postToDiscord } from "./discord/discordPoster.js";
import {
    monthRange,
    getDaysInRange,
    getTopMaps,
    getModeStats,
    getPlayerDaysPlayed,
    getPlayerAverageScore,
    getBestSingleDay,
    //getBiggestImprovement,
    getTopImprovements,
    getPlayerMonthlyTotals,
    getTopMapsByAverageScore, 
    getBestPlayerPerMap
} from "./league/stats.js";
import { displayNameForGeoId } from "./discord/mention.js";

export async function postMonthlySummaryToDiscord(year: number, month1to12: number): Promise<void> {
    const { start, end } = monthRange(year, month1to12);
    const days = getDaysInRange(start, end);

    const roleId = process.env.DISCORD_ROLE_DAILY_ID; // solo números
    const ping = roleId ? `<@&${roleId}>` : "@Desafío Diario";

    const topMaps = getTopMaps(days, 5);

    const topMapsBlock = topMaps.length
        ? `**🗺️ Mapas más jugados (Top 5):**\n` +
        topMaps.map((m, i) => `· ${i + 1}. ${m.mapName} — ${m.count} día(s)`).join("\n") +
        `\n\n`
        : "";
    
    
    const topAvgMaps = getTopMapsByAverageScore(days, 5, 2);
    const bestPerTopAvg = getBestPlayerPerMap(days, topAvgMaps.map(m => m.mapId), 2);

    const fmtInt = (n: number) => Math.round(n).toLocaleString("es-ES");

    const bestMapAvgBlock = topAvgMaps.length
        ? `**📍 Mapas donde más se puntúa (media global, Top 5):**\n` +
        topAvgMaps.map((m, i) => {
            const champion = bestPerTopAvg.find((b) => b.mapId === m.mapId);
            const champText = champion
                ? ` · 👑 ${displayNameForGeoId(champion.geoId)} (${fmtInt(champion.avg)} avg, ${champion.plays} partidas)`
                : "";
            return `· ${i + 1}. ${m.mapName} — ${fmtInt(m.avg)} avg (${m.days} día(s))${champText}`;
        }).join("\n") +
        `\n\n`
        : "";

    const ms = getModeStats(days);

    const pct = (n: number, denom: number) =>
        denom > 0 ? `${Math.round((n * 100) / denom)}%` : "0%";

    const modeBlock =
        `**🎮 Modos (por días):**\n` +
        `· Move: ${ms.move} (${pct(ms.move, ms.totalDays)})\n` +
        `· NM: ${ms.nm} (${pct(ms.nm, ms.totalDays)})\n` +
        `· NMPZ: ${ms.nmpz} (${pct(ms.nmpz, ms.totalDays)})` +
        (ms.unknown ? `\n· Sin datos: ${ms.unknown} (${pct(ms.unknown, ms.totalDays)})` : "") +
        `\n\n`;

    const played = getPlayerDaysPlayed(days);
    const topPlayed = played[0];

    const consistencyBlock = topPlayed
        ? `**🎯 Jugador más constante:** ${displayNameForGeoId(topPlayed.geoId)} — **${topPlayed.daysPlayed}** día(s)\n\n`
        : "";

    const minAvgDays = Number(process.env.MONTHLY_MIN_AVG_DAYS ?? "3");
    const avgRows = getPlayerAverageScore(days, minAvgDays);
    const bestAvg = avgRows[0];

    const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");

    const avgBlock = bestAvg
        ? `**📈 Mejor media (mín. ${minAvgDays} días):** ${displayNameForGeoId(bestAvg.geoId)} — **${fmt(bestAvg.avg)}** pts/día (${bestAvg.daysPlayed} días)\n\n`
        : "";

    const totals = getPlayerMonthlyTotals(days);
    const podium = totals.slice(0, 3);
    const medals = ["🥇", "🥈", "🥉"];

    const podiumBlock = podium.length
        ? `**🏆 Podio del mes (por puntos):**\n` +
        podium.map((p, i) =>
            `· ${medals[i]} ${displayNameForGeoId(p.geoId)} — **${Math.round(p.total).toLocaleString("es-ES")}** pts (${p.daysPlayed} días)`
        ).join("\n") +
        `\n\n`
        : "";


    const bestDay = getBestSingleDay(days);
    const bestDayBlock = bestDay
        ? `**🌟 Mejor día del mes:** ${displayNameForGeoId(bestDay.geoId)} — **${bestDay.score.toLocaleString("es-ES")}** pts ` +
        `(desafío **#${bestDay.dayIndex}**, ${bestDay.date})` +
        (bestDay.mapName ? ` — ${bestDay.mapName}` : "") +
        (bestDay.mode ? ` · ${bestDay.mode}` : "") +
        (bestDay.roundCount ? ` · ${bestDay.roundCount}R` : "") +
        (bestDay.timeLimit ? ` · ${bestDay.timeLimit}s` : "") +
        `\n\n`
        : "";

    const minHalfDays = Number(process.env.MONTHLY_MIN_DAYS_PER_HALF ?? "2");
    const topImp = getTopImprovements(days, 3, minHalfDays);

    const improvementBlock = topImp.length
        ? `**📈 Top 3 mejoras (1ª→2ª mitad, mín. ${minHalfDays} días/mitad):**\n` +
        topImp.map((r, i) =>
            `· ${i + 1}. ${displayNameForGeoId(r.geoId)} — ${fmtInt(r.firstAvg)} → ${fmtInt(r.secondAvg)} (Δ **+${fmtInt(r.delta)}**)`
        ).join("\n") +
        `\n\n`
        : "";



    const title = `📅 Resumen mensual — ${year}-${String(month1to12).padStart(2, "0")}`;

    const message =
        `## ${title} ${ping}\n\n` +
        `Días registrados: **${days.length}** (${start} → ${end})\n\n` +
        podiumBlock +
        topMapsBlock +
        bestMapAvgBlock +
        modeBlock +
        consistencyBlock +
        avgBlock +
        bestDayBlock +
        improvementBlock
        ;

    await postToDiscord(message);
}
