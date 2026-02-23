import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import { ChallengeHighscores, ChallengeSettingsForPost } from '../types.js';
import fs from "node:fs";
import { getDayIndexByToken } from "../league/weeklyStore.js";
import { t, getLocale  } from "../i18n/index.js";


dotenv.config();

const discordToken = process.env.DISCORD_TOKEN || '';
const channelId = process.env.DISCORD_CHANNEL_ID || '';
const challengeUrl: (challengeId: string) => string = (challengeId: string) => `https://www.geoguessr.com/challenge/${challengeId}`;

function pickOne<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

const ROUND_10_KEYS = [
    "challenge.fun.round10.1",
    "challenge.fun.round10.2",
    "challenge.fun.round10.3",
    "challenge.fun.round10.4",
    "challenge.fun.round10.5",
    "challenge.fun.round10.6",
    "challenge.fun.round10.7",
    "challenge.fun.round10.8",
    "challenge.fun.round10.9",
    "challenge.fun.round10.10"
] as const;

const TIME_10_KEYS = [
    "challenge.fun.time10.1",
    "challenge.fun.time10.2",
    "challenge.fun.time10.3",
    "challenge.fun.time10.4",
    "challenge.fun.time10.5",
    "challenge.fun.time10.6",
    "challenge.fun.time10.7",
    "challenge.fun.time10.8",
    "challenge.fun.time10.9",
    "challenge.fun.time10.10"
] as const;

const FAST_MESSAGES_KEYS = [
    "challenge.fun.fast10.1",
    "challenge.fun.fast10.2",
    "challenge.fun.fast10.3",
    "challenge.fun.fast10.4",
    "challenge.fun.fast10.5",
    "challenge.fun.fast10.6",
    "challenge.fun.fast10.7",
    "challenge.fun.fast10.8",
    "challenge.fun.fast10.9",
    "challenge.fun.fast10.10"
] as const;

const MEDIUM_MESSAGES_KEYS = [
    "challenge.fun.medium10.1",
    "challenge.fun.medium10.2",
    "challenge.fun.medium10.3",
    "challenge.fun.medium10.4",
    "challenge.fun.medium10.5",
    "challenge.fun.medium10.6",
    "challenge.fun.medium10.7",
    "challenge.fun.medium10.8",
    "challenge.fun.medium10.9",
    "challenge.fun.medium10.10"
] as const;

const CALM_MESSAGES_KEYS = [
    "challenge.fun.calm10.1",
    "challenge.fun.calm10.2",
    "challenge.fun.calm10.3",
    "challenge.fun.calm10.4",
    "challenge.fun.calm10.5",
    "challenge.fun.calm10.6",
    "challenge.fun.calm10.7",
    "challenge.fun.calm10.8",
    "challenge.fun.calm10.9",
    "challenge.fun.calm10.10"
] as const;

const RELAX_MESSAGES_KEYS = [
    "challenge.fun.relax10.1",
    "challenge.fun.relax10.2",
    "challenge.fun.relax10.3",
    "challenge.fun.relax10.4",
    "challenge.fun.relax10.5",
    "challenge.fun.relax10.6",
    "challenge.fun.relax10.7",
    "challenge.fun.relax10.8",
    "challenge.fun.relax10.9",
    "challenge.fun.relax10.10"
] as const;
    
export const postToDiscord = async (message: string, imagePath?: string) => {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.MessageContent,
        ],
    });

    client.once("ready", async () => {
        try {
            const channel = await client.channels.fetch(channelId);

            if (channel instanceof TextChannel) {
                console.log("[discord] posting to channelId =", channelId);

                await channel.send({
                    content: message,
                    files: imagePath ? [imagePath] : [],
                });
            } else {
                console.error(t("discord.errors.channelNotFound"));
            }
        } catch (err) {
            console.error(t("discord.errors.failedToPost"), err);
        } finally {
            // ✅ borrar el PNG después de subirlo (Discord ya lo guarda)
            if (imagePath && fs.existsSync(imagePath)) {
                try {
                    fs.unlinkSync(imagePath);
                    console.log(t("discord.logs.deletedImage", { path: imagePath }));
                } catch (e) {
                    console.error("[discord] failed to delete image:", imagePath, e);
                }
            }

            client.destroy();
        }
    });

    await client.login(discordToken);
};

export const postChallengeToDiscord = async (settings: ChallengeSettingsForPost) => {

    // console.log("[discord] posting challenge with =", {
    //     token: settings.token,
    //     mode: settings.mode,
    //     timeLimit: settings.timeLimit,
    //     roundCount: settings.roundCount,
    // });
    const timestamp = Math.floor(Date.now() / 1000);
    const roleId = process.env.DISCORD_ROLE_DAILY_ID; // solo números
    const ping = roleId
    ? `<@&${roleId}>`
    : t("discord.ping.dailyChallenge");

    const roundCount = settings.roundCount ?? 5;
    const timeLimit = settings.timeLimit ?? 60; // solo para que TS no se queje en el mensaje


    // Texto “gracioso”
    const extraLines: string[] = [];

    if (roundCount === 10) {
        extraLines.push(t(pickOne([...ROUND_10_KEYS])));
    }

    if (timeLimit === 10) {
        extraLines.push(t(pickOne([...TIME_10_KEYS])));
    } else if (timeLimit <= 20) {
        extraLines.push(t(pickOne([...FAST_MESSAGES_KEYS])));
    } else if (timeLimit <= 30) {
        extraLines.push(t(pickOne([...MEDIUM_MESSAGES_KEYS])));
    } else if (timeLimit <= 60) {
        extraLines.push(t(pickOne([...CALM_MESSAGES_KEYS])));
    } else {
        extraLines.push(t(pickOne([...RELAX_MESSAGES_KEYS])));
    }

    const intro = extraLines.length ? `\n${extraLines.join("\n")}\n` : "\n";
    const idx = settings.dayIndex ? ` (#${settings.dayIndex})` : "";

const message =
  t("challenge.post.title", { idx, timestamp, ping }) +
  intro +
  t("challenge.post.body", {
    url: challengeUrl(settings.token),
    map: settings.name,
    mode: settings.mode,
    timeLimit,
    roundCount,
  }) +
  "\n\n\u200B";

    await postToDiscord(message);
};


export const postResultToDiscord = async (ranking: ChallengeHighscores) => {
    const roleId = process.env.DISCORD_ROLE_DAILY_ID; // solo números
    const ping = roleId ? `<@&${roleId}>` : t("discord.ping.dailyChallenge");
    //const idx = settings.dayIndex ? ` (#${settings.dayIndex})` : "";

    // ✅ SIEMPRE ordenar por score (desc)
    const sortedItems = [...ranking.highscores.items].sort((a: any, b: any) => {
        const sa = Number(a?.game?.player?.totalScore?.amount ?? 0);
        const sb = Number(b?.game?.player?.totalScore?.amount ?? 0);
        return sb - sa;
    });

    const leaderboard = sortedItems
    .map((entry: any, index: number) => {
        const position = `${index + 1}.`;
        const name = entry.game.player.nick;

        // locale depende de idioma
        const locale = getLocale();
        const score = Number(entry.game.player.totalScore.amount).toLocaleString(locale);

        return `${position} ${name} – ${score} pts`;
    })
    .join("\n");

    const totalScore = sortedItems.reduce(
        (acc: number, entry: any) => acc + Number(entry?.game?.player?.totalScore?.amount ?? 0),
        0
    );

    const average = Math.round(totalScore / (sortedItems.length || 1));

    const dayIndex = getDayIndexByToken(ranking.token);
    const idx = dayIndex ? ` (#${dayIndex})` : "";

    const message =
    t("results.post.title", { idx, timestamp: ranking.timestamp, ping }) +
    "\n" +
    t("results.post.body", {
        url: challengeUrl(ranking.token),
        average,
        leaderboard,
    });

    await postToDiscord(message);
}


