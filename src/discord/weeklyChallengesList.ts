import { postToDiscord } from "./discordPoster.js";
import { formatWeeklyChallengesList } from "../league/buildWeeklyChallengesList.js";

export async function postWeeklyChallengesListToDiscord(referenceDate = new Date()): Promise<void> {
    const message = formatWeeklyChallengesList(referenceDate);
    await postToDiscord(message);
}