import { postToDiscord } from "./discordPoster.js";
import { buildWeeklyTable, getWeeklyPodium, getWeeklyPerfectAttendance } from "../league/weeklyStore.js";
import { displayNameForGeoId } from "./mention.js";
import { renderTableImage } from "./renderTableImage.js";
import { getWeeklyBestDailyByRounds, getWeeklyBestDailyByRoundsAndMode } from "../league/weeklyStore.js";
import { t, getLocale } from "../i18n/index.js";


/**
 * Posts the weekly summary table (Monday-Sunday) to Discord.
 * weekStartKey must be the Monday date in YYYY-MM-DD (e.g. 2026-01-12).
 */
export async function postWeeklySummaryToDiscord(weekStartKey: string): Promise<void> {

    const roleId = process.env.DISCORD_ROLE_DAILY_ID;
    const ping = roleId ? `<@&${roleId}>` : t("discord.ping.dailyChallenge");

    const podium = getWeeklyPodium(weekStartKey);
    const perfect = getWeeklyPerfectAttendance(weekStartKey);

    const { title, table } = buildWeeklyTable(weekStartKey);

    const best5Move = getWeeklyBestDailyByRoundsAndMode(weekStartKey, 5, "move");
    const best5Nm = getWeeklyBestDailyByRoundsAndMode(weekStartKey, 5, "nm");
    const best5Nmpz = getWeeklyBestDailyByRoundsAndMode(weekStartKey, 5, "nmpz");

    const best10 = getWeeklyBestDailyByRounds(weekStartKey, 10);

    const fmtPts = (n: number) => n.toLocaleString(getLocale());

    const extraAwardsLines: string[] = [];

    // Top 5 rounds per mode

    if (best5Nmpz) {
        extraAwardsLines.push(
            t("weekly.awards.bestByMode", {
                user: displayNameForGeoId(best5Nmpz.geoId),
                mode: "NMPZ",
                roundsEmoji: "5️⃣",
                rounds: 5,
                score: fmtPts(best5Nmpz.score),
                dayIndex: best5Nmpz.dayIndex
            })
        );
    }

    if (best5Nm) {
        extraAwardsLines.push(
            t("weekly.awards.bestByMode", {
                user: displayNameForGeoId(best5Nm.geoId),
                mode: "NM",
                roundsEmoji: "5️⃣",
                rounds: 5,
                score: fmtPts(best5Nm.score),
                dayIndex: best5Nm.dayIndex
            })
        );
    }

    if (best5Move) {
        extraAwardsLines.push(
            t("weekly.awards.bestByMode", {
                user: displayNameForGeoId(best5Move.geoId),
                mode: "Move",
                roundsEmoji: "5️⃣",
                rounds: 5,
                score: fmtPts(best5Move.score),
                dayIndex: best5Move.dayIndex
            })
        );
    }

    if (best10) {
        extraAwardsLines.push(
            t("weekly.awards.best10Rounds", {
                user: displayNameForGeoId(best10.geoId),
                score: fmtPts(best10.score),
                dayIndex: best10.dayIndex
            })
        );
    }

    const extraAwardsBlock = extraAwardsLines.length
        ? t("weekly.awards.block", { lines: extraAwardsLines.join("\n") }) + "\n\n"
        : "";


    const medals = ["🥇", "🥈", "🥉"];

    // Vertical podium
    const podiumLines = podium
        .slice(0, 3)
        .map((p, i) => `${medals[i]} **${displayNameForGeoId(p.geoId)}**`)
        .join("\n");

    // Constancy award for perfect attendance
    const perfectLine = perfect.length
    ? perfect.map((geoId) => displayNameForGeoId(geoId)).join(", ")
    : t("weekly.perfect.none");

    // render table as image
    const imagePath = await renderTableImage({
        title: t("weekly.image.title", { title }),
        lines: table.split("\n"),
        outputFile: `./data/weekly-${weekStartKey}.png`,
    });

    // Message without code block (for mobile)
    const message =
        t("weekly.message.header", { title, ping }) +
        "\n\n" +
        t("weekly.message.intro") +
        "\n\n" +
        (podium.length
            ? t("weekly.message.podiumBlock", { podiumLines }) + "\n\n"
            : "") +
        extraAwardsBlock +
        (perfect.length
            ? t("weekly.message.perfectBlock", { perfectLine }) + "\n\n"
            : "") +
        t("weekly.message.outro");

    await postToDiscord(message, imagePath);
}

