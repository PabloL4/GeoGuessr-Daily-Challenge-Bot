import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import { ChallengeHighscores, ChallengeSettingsForPost } from '../types.js';
import { buildChallengeIntro } from "./challengeMessage.js";

dotenv.config();

const discordToken = process.env.DISCORD_TOKEN || '';
const channelId = process.env.DISCORD_CHANNEL_ID || '';
const challengeUrl: (challengeId: string) => string = (challengeId: string) => `https://www.geoguessr.com/challenge/${challengeId}`;

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
const ROUND_10_MESSAGES = [
  "🔟 **Especial 10 rondas** — hoy toca maratón 🏃‍♂️",
  "🔟 **Día largo** — 10 rondas para los valientes 💪",
  "🔟 **Edición extendida** — que no se diga que fue corto 😏, That's what she said",
  "🔟 **Resistencia épica** — 10 rondas para probar que no eres de los que se rinden fácil 😉",
];

const TIME_10_MESSAGES = [
  "⚡ **Rondas relámpago** — ¡decide en 10 segundos!",
  "⚡ **Modo rayo** — parpadea y ya has elegido 😅",
  "⚡ **Velocidad máxima** — sin tiempo para dudar",
  "⚡ **Intuición express** — 10 segundos para que tu instinto tome el mando 🧠",
];

const FAST_MESSAGES = [
  "🔥 **Muy rápido** — sin tiempo para dudar",
  "🔥 **Presión alta** — piensa rápido o sufre 😈",
  "🔥 **Presión alta** — piensa rápido o el mapa te ganará la partida 😏",
  "🔥 **Acelerador a tope** — reacciona ya, que el mundo no espera por nadie 🚀",
];

const MEDIUM_MESSAGES = [
  "⏱️ **Ritmo ágil** — piensa rápido",
  "⏱️ **Velocidad media** — ni sprint ni paseo",
  "⏱️ **Equilibrio perfecto** — rápido lo justo, sin volverte loco por un giro 🌀",
];

const CALM_MESSAGES = [
  "😌 **Día tranquilito** — respira y observa",
  "😌 **Con calma** — hoy se puede pensar bien",
  "😌 **Sesión relajada** — sin prisas",
  "😌 **Pausa estratégica** — tómate tu tiempo, que las mejores jugadas vienen solas 🌅",
];

const RELAX_MESSAGES = [
  "🧘 **Modo relax** — explora con calma",
  "🧘 **Tiempo de sobra** — disfruta el paisaje",
  "🧘 **Pereza productiva** — avanza despacio, que a veces el atajo es el error más grande 😌",
];


export const postToDiscord = async (message: string) => {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.MessageContent,
        ],
    });

    client.once('ready', async () => {
        const channel = await client.channels.fetch(channelId);
        if (channel instanceof TextChannel) {
            await channel.send(message);
        } else {
            console.error('Channel not found or is not text-based.');
        }
        client.destroy();
    });

    await client.login(discordToken);
};

export const postChallengeToDiscord = async (settings: ChallengeSettingsForPost) => {
    const timestamp = Math.floor(Date.now() / 1000);

    const rounds = settings.rounds ?? 5;
    const timeLimit = settings.timeLimit ?? 60;

    // Texto “gracioso”
const extraLines: string[] = [];

    if (rounds === 10) {
        extraLines.push(pickOne(ROUND_10_MESSAGES));
    }
    if (timeLimit === 10) {
        extraLines.push(pickOne(TIME_10_MESSAGES));
    } else if (timeLimit <= 20) {
        extraLines.push(pickOne(FAST_MESSAGES));
    } else if (timeLimit <= 30) {
        extraLines.push(pickOne(MEDIUM_MESSAGES));
    } else if (timeLimit <= 60) {
        extraLines.push(pickOne(CALM_MESSAGES));
    } else {
        extraLines.push(pickOne(RELAX_MESSAGES));
    }

    const intro = extraLines.length ? `\n${extraLines.join("\n")}\n` : "\n";

    const message =
        `## 🌍 Desafío diario — <t:${timestamp}:D>${intro}🔗 Enlace: ${challengeUrl(settings.token)}
🗺️ Mapa: ${settings.name}
🎮 Modo: ${settings.mode} (${timeLimit}s) — ${rounds} rondas`;

    await postToDiscord(message);
};


export const postResultToDiscord: (ranking: ChallengeHighscores) => Promise<void> = async (ranking: ChallengeHighscores) => {
    const leaderboard = ranking.highscores.items.slice(0, 6)
        .map((entry: any, index: number) => {
            const position = `${index + 1}º`;
            const name = entry.game.player.nick;
            const score = Number(entry.game.player.totalScore.amount)
                .toLocaleString('es-ES');
            return `${position} ${name} – ${score} pts`;
        })
        .join('\n');


    const totalScore = ranking.highscores.items
        .reduce((acc: number, entry: any) => acc + parseInt(entry.game.player.totalScore.amount, 10), 0);

    const average = totalScore / ranking.highscores.items.length;

    const message = `## 📊 Resultados del desafío — <t:${ranking.timestamp}:D>
        🔗 Enlace: ${challengeUrl(ranking.token)}
        📈 Puntuación media: ${Math.round(average)}
        🏆 Ranking:
        \`\`\`
        ${leaderboard}
        \`\`\``;

        await postToDiscord(message);
}

