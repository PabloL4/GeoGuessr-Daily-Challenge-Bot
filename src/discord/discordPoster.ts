import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import { ChallengeHighscores, ChallengeSettingsForPost } from '../types.js';

dotenv.config();

const discordToken = process.env.DISCORD_TOKEN || '';
const channelId = process.env.DISCORD_CHANNEL_ID || '';
const challengeUrl: (challengeId: string) => string = (challengeId: string) => `https://www.geoguessr.com/challenge/${challengeId}`;

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
        client.destroy(); // メッセージを投稿したらクライアントを終了
    });

    await client.login(discordToken);
};

export const postChallengeToDiscord = async (settings: ChallengeSettingsForPost) => {
    const timestamp = Math.floor(Date.now() / 1000);
    //const message = `## <t:${timestamp}:D>のデイリーチャレンジ\nリンク：${challengeUrl(settings.token)}\nマップ：${settings.name}\nゲームモード：${settings.mode} 60s`;
    const message = `## 🌍 Desafío diario — <t:${timestamp}:D>
🔗 Enlace: ${challengeUrl(settings.token)}
🗺️ Mapa: ${settings.name}
🎮 Modo: ${settings.mode} (60s)`;

    await postToDiscord(message);
}

export const postResultToDiscord: (ranking: ChallengeHighscores) => Promise<void> = async (ranking: ChallengeHighscores) => {
    // Leaderboard: muestra el top 6
    // const leaderboard = ranking.highscores.items.slice(0, 6)
    //     .map((entry, index) =>
    //         `${index + 1}º: ${entry.game.player.nick}\n\t${entry.game.player.totalScore.amount} puntos`
    //     ).join('\n');
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

