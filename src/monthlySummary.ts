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
import { t, getLocale } from "./i18n/index.js";

export async function postMonthlySummaryToDiscord(year: number, month1to12: number): Promise<void> {
    const { start, end } = monthRange(year, month1to12);
    const days = getDaysInRange(start, end);

    const roleId = process.env.DISCORD_ROLE_DAILY_ID; // solo números
    const ping = roleId ? `<@&${roleId}>` : t("discord.ping.dailyChallenge");

    const topMaps = getTopMaps(days, 5);

    const topMapsBlock = topMaps.length
        ? t("monthly.topMaps.header") + "\n" +
        topMaps.map((m, i) =>
            t("monthly.topMaps.line", { i: i + 1, mapName: m.mapName, count: m.count })
        ).join("\n") +
        "\n\n"
        : "";


    const topAvgMaps = getTopMapsByAverageScore(days, 5, 2);
    const bestPerTopAvg = getBestPlayerPerMap(days, topAvgMaps.map(m => m.mapId), 2);

    const locale = getLocale();
    const fmtInt = (n: number) => Math.round(n).toLocaleString(locale);
    const fmt = (n: number) => Math.round(n).toLocaleString(locale);

    const bestMapAvgBlock = topAvgMaps.length
        ? t("monthly.topAvgMaps.header") + "\n" +
        topAvgMaps.map((m, i) => {
            const champion = bestPerTopAvg.find((b) => b.mapId === m.mapId);
            const champText = champion
                ? t("monthly.topAvgMaps.champion", {
                    user: displayNameForGeoId(champion.geoId),
                    avg: fmtInt(champion.avg),
                    plays: champion.plays
                })
                : "";
            return t("monthly.topAvgMaps.line", {
                i: i + 1,
                mapName: m.mapName,
                avg: fmtInt(m.avg),
                days: m.days,
                champText
            });
        }).join("\n") +
        "\n\n"
        : "";

    const ms = getModeStats(days);

    const pct = (n: number, denom: number) =>
        denom > 0 ? `${Math.round((n * 100) / denom)}%` : "0%";

    const modeBlock =
        t("monthly.modes.header") + "\n" +
        t("monthly.modes.line", { mode: "Move", count: ms.move, pct: pct(ms.move, ms.totalDays) }) + "\n" +
        t("monthly.modes.line", { mode: "NM", count: ms.nm, pct: pct(ms.nm, ms.totalDays) }) + "\n" +
        t("monthly.modes.line", { mode: "NMPZ", count: ms.nmpz, pct: pct(ms.nmpz, ms.totalDays) }) +
        (ms.unknown
            ? "\n" + t("monthly.modes.unknown", { count: ms.unknown, pct: pct(ms.unknown, ms.totalDays) })
            : ""
        ) +
        "\n\n";

    const played = getPlayerDaysPlayed(days);
    const topPlayed = played[0];

    const consistencyBlock = topPlayed
        ? t("monthly.consistency", {
            user: displayNameForGeoId(topPlayed.geoId),
            days: topPlayed.daysPlayed
        }) + "\n\n"
        : "";

    const minAvgDays = Number(process.env.MONTHLY_MIN_AVG_DAYS ?? "3");
    const avgRows = getPlayerAverageScore(days, minAvgDays);
    const bestAvg = avgRows[0];

    const avgBlock = bestAvg
        ? t("monthly.bestAvg", {
            minDays: minAvgDays,
            user: displayNameForGeoId(bestAvg.geoId),
            avg: fmt(bestAvg.avg),
            days: bestAvg.daysPlayed
        }) + "\n\n"
        : "";

    const totals = getPlayerMonthlyTotals(days);
    const podium = totals.slice(0, 3);
    const medals = ["🥇", "🥈", "🥉"];

    const podiumBlock = podium.length
        ? t("monthly.podium.header") + "\n" +
        podium.map((p, i) =>
            t("monthly.podium.line", {
                medal: medals[i],
                user: displayNameForGeoId(p.geoId),
                total: fmtInt(p.total),
                days: p.daysPlayed
            })
        ).join("\n") +
        "\n\n"
        : "";

    const bestDay5 = getBestSingleDay(days, { rounds: 5 });
    const bestDay10 = getBestSingleDay(days, { rounds: 10 });

    const formatBestDay = (label: string, bd: any) =>
        t("monthly.bestDay.line", {
            label,
            user: displayNameForGeoId(bd.geoId),
            score: bd.score.toLocaleString(locale),
            dayIndex: bd.dayIndex,
            date: bd.date,
            mapPart: bd.mapName ? t("monthly.bestDay.mapPart", { map: bd.mapName }) : "",
            modePart: bd.mode ? t("monthly.bestDay.modePart", { mode: bd.mode }) : "",
            roundsPart: bd.roundCount ? t("monthly.bestDay.roundsPart", { rounds: bd.roundCount }) : "",
            timePart: bd.timeLimit ? t("monthly.bestDay.timePart", { seconds: bd.timeLimit }) : ""
        });

    const bestDayBlock =
        (bestDay5 ? formatBestDay(t("monthly.bestDay.label5"), bestDay5) : "") +
        (bestDay10 ? formatBestDay(t("monthly.bestDay.label10"), bestDay10) : "");

    const bestDayFinal = bestDayBlock ? bestDayBlock + "\n\n" : "";


    const minHalfDays = Number(process.env.MONTHLY_MIN_DAYS_PER_HALF ?? "2");
    const topImp = getTopImprovements(days, 3, minHalfDays);

    const improvementBlock = topImp.length
        ? t("monthly.improvements.header", { minHalfDays }) + "\n" +
        topImp.map((r, i) =>
            t("monthly.improvements.line", {
                i: i + 1,
                user: displayNameForGeoId(r.geoId),
                firstAvg: fmtInt(r.firstAvg),
                secondAvg: fmtInt(r.secondAvg),
                delta: fmtInt(r.delta)
            })
        ).join("\n") +
        "\n\n"
        : "";


    const title = t("monthly.title", {
        year,
        month: String(month1to12).padStart(2, "0")
    });

    const message =
        `## ${title} ${ping}\n\n` +
        t("monthly.daysRegistered", {
            count: days.length,
            start,
            end
        }) +
        "\n\n" +
        podiumBlock +
        topMapsBlock +
        bestMapAvgBlock +
        modeBlock +
        consistencyBlock +
        avgBlock +
        bestDayFinal +
        improvementBlock;

    await postToDiscord(message);
}
