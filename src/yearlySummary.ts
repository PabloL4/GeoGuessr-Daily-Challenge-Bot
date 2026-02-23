import { getYearlyRanking } from "./league/yearlyStore.js";
import { postToDiscord } from "./discord/discordPoster.js";
import { podiumNameForGeoId, tableNameForGeoId } from "./discord/mention.js";
import { t, getLocale } from "./i18n/index.js";

export async function postYearlySummary(year: number): Promise<void> {
    const ranking = getYearlyRanking(year);

    const roleId = process.env.DISCORD_ROLE_DAILY_ID; //only numbers
    const ping = roleId ? `<@&${roleId}>` : t("discord.ping.dailyChallenge");

    if (!ranking.length) {
        await postToDiscord(t("yearly.noData", { year }));
        return;
    }

    const locale = getLocale();

    const podium = ranking.slice(0, 3);
    const medals = ["🥇", "🥈", "🥉"];

    const podiumLines = podium.map(
        (p, i) => t("yearly.podium.line", { user: podiumNameForGeoId(p.geoId), medal: medals[i] })
    );

    const tableLines = ranking.map((r, i) =>
        t("yearly.table.line", {
            pos: String(i + 1).padStart(2, " "),
            user: tableNameForGeoId(r.geoId),
            total: Math.round(r.total).toLocaleString(locale),
            pointsLabel: t("yearly.pointsLabel"),
            days: r.daysPlayed,
            daysLabel: t("yearly.daysLabel")
        })
    );

    const message =
        t("yearly.title", { year, ping }) + "\n\n" +
        t("yearly.podium.header") + "\n" + podiumLines.join("\n") + "\n\n" +
        t("yearly.table.header") + "\n" +
        "```text\n" +
        tableLines.join("\n") +
        "\n```";

    await postToDiscord(message);
}