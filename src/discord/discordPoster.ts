import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import { ChallengeHighscores, ChallengeSettingsForPost } from '../types.js';
import fs from "node:fs";
import { buildSimpleRankingTable } from "../league/buildSimpleRankingTable.js";
import { renderTableImage } from "../discord/renderTableImage.js";

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
    "🔟 **Maratón de héroes** — 10 rondas para forjar leyendas, ¡no pares ahora! 🏆",
    "🔟 **Rondas interminables** — como esa serie que no puedes soltar, ¡sigue el ritmo! 📺",
    "🔟 **Odisea global** — 10 rondas cruzando continentes, ¿dónde te deja el Street View esta vez? 🌍",
    "🔟 **Desafío decatlón** — 10 paradas en el mapa para coronarte como el rey de la geografía 👑",
    "🔟 **Modo supervivencia** — 10 rondas seguidas, solo los exploradores de verdad llegan al final 🧭",
    "🔟 **Tour mundial sin escalas** — 10 rondas y ni una maleta facturada ✈️🌍",

];

const TIME_10_MESSAGES = [
    "⚡ **Rondas relámpago** — ¡decide en 10 segundos!",
    "⚡ **Modo rayo** — parpadea y ya has elegido 😅",
    "⚡ **Velocidad máxima** — sin tiempo para dudar",
    "⚡ **Intuición express** — 10 segundos para que tu instinto tome el mando 🧠",
    "⚡ **Flash decision** — 10s y listo, ¡como un superhéroe en acción! 🦸‍♂️",
    "⚡ **Tic-tac turbo** — cuenta hasta 10 y elige, o el reloj te elige a ti ⏰",
    "⚡ **Pinchazo rápido** — 10s para clavar el pin antes de que el mapa se mueva 🗺️",
    "⚡ **Intuición GPS** — ¡elige ya o el globo terráqueo te da la vuelta! 🔄",
    "⚡ **Decisión instantánea** — 10s para leer el mundo y clavar el pin 🎯",
    "⚡ **Street View en shock** — 10 segundos y el mapa ya te está juzgando 😬🗺️",

];

const FAST_MESSAGES = [
    "🔥 **Muy rápido** — sin tiempo para dudar",
    "🔥 **Presión alta** — piensa rápido o sufre 😈",
    "🔥 **Presión alta** — piensa rápido o el mapa te ganará la partida 😏",
    "🔥 **Acelerador a tope** — reacciona ya, que el mundo no espera por nadie 🚀",
    "🔥 **Modo infierno** — decisiones a quemarropa, ¡o ardes o brillas! 🌋",
    "🔥 **Turbo caos** — rápido como un rayo, o el juego te deja en el polvo 💨",
    "🔥 **Sprint a toda pastilla** — ¡pincha ya o las señales de tráfico te despistan! 🚦",
    "🔥 **Caos geográfico** — reacciona al rojo vivo, que el Street View no perdona 🔥🗺️",
    "🔥 **Geografía a quemarropa** — o reaccionas o te pierdes en el mapa 💥🗺️",
    "🔥 **Modo taquicardia** — señales borrosas, decisiones rápidas y cero perdón ❤️‍🔥",

];

const MEDIUM_MESSAGES = [
    "⏱️ **Ritmo ágil** — piensa rápido",
    "⏱️ **Velocidad media** — ni sprint ni paseo",
    "⏱️ **Equilibrio perfecto** — rápido lo justo, sin volverte loco por un giro 🌀",
    "⏱️ **Paso constante** — avanza sin prisas locas, pero sin quedarte atrás 🏃‍♂️",
    "⏱️ **Flujo natural** — el tiempo justo para un café mental ☕",
    "⏱️ **Marcha media** — ni héroe ni villano, solo tú dominando el centro 🎯",
    "⏱️ **Ritmo explorador** — analiza las placas y avanza, sin dramas ⏱️🌆",
    "⏱️ **Equilibrio mundial** — tiempo para otear horizontes sin perder el hilo 🏔️",
    "⏱️ **Tiempo táctico** — lo justo para leer una señal… y no liarla 🚧",
    "⏱️ **Ritmo detective** — observa, conecta pistas y clava el país 🕵️‍♂️🌍",

];

const CALM_MESSAGES = [
    "😌 **Día tranquilito** — respira y observa",
    "😌 **Con calma** — hoy se puede pensar bien",
    "😌 **Sesión relajada** — sin prisas",
    "😌 **Pausa estratégica** — tómate tu tiempo, que las mejores jugadas vienen solas 🌅",
    "😌 **Viento suave** — fluye con el juego, sin forzar el destino 🌬️",
    "😌 **Momento zen** — observa, decide, conquista... todo a su ritmo 🧘‍♂️",
    "😌 **Paseo virtual** — disfruta las vistas del mapa como un turista zen ✈️",
    "😌 **Calma cartográfica** — el mundo espera, elige con el alma serena 🗺️😊",
    "😌 **Explorador paciente** — mira postes, matrículas y horizontes sin estrés 🔍",
    "😌 **Modo postal** — disfruta del paisaje antes de poner el pin 📸🗺️",

];

const RELAX_MESSAGES = [
    "🧘 **Modo relax** — explora con calma",
    "🧘 **Tiempo de sobra** — disfruta el paisaje",
    "🧘 **Pereza productiva** — avanza despacio, que a veces el atajo es el error más grande 😌",
    "🧘 **Siesta estratégica** — descansa la mente, las ideas geniales llegan solas 💤",
    "🧘 **Paseo filosófico** — cada paso cuenta, sin correr por correr 🌳",
    "🧘 **Ola zen** — déjate llevar por el flow, el mapa espera por ti 🌊",
    "🧘 **Meditación geográfica** — contempla el horizonte, las coordenadas se alinean solas 🌌",
    "🧘 **Viaje lento** — sorbe el paisaje como un té, GeoGuessr al ritmo de tu paz ☕🗺️",
    "🧘 **Turismo virtual** — sin cronómetro detrás de la oreja, solo tú y el mundo 🌍",
    "🧘 **Mapa en slow motion** — observa con cariño, el país se revela solo 🐢🗺️",

];


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
                console.error("Channel not found or is not text-based.");
            }
        } catch (err) {
            console.error("[discord] failed to post:", err);
        } finally {
            // ✅ borrar el PNG después de subirlo (Discord ya lo guarda)
            if (imagePath && fs.existsSync(imagePath)) {
                try {
                    fs.unlinkSync(imagePath);
                    console.log("[discord] deleted image:", imagePath);
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
    const ping = roleId ? `<@&${roleId}>` : "@Desafío Diario";

    const roundCount = settings.roundCount ?? 5;
    const timeLimit = settings.timeLimit ?? 60; // solo para que TS no se queje en el mensaje


    // Texto “gracioso”
    const extraLines: string[] = [];

    if (roundCount === 10) {
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
        `## 🌍 Desafío diario — <t:${timestamp}:D>  ${ping}${intro}🔗 Enlace: ${challengeUrl(settings.token)}  
🗺️ Mapa: ${settings.name}
🎮 Modo: ${settings.mode} (${timeLimit}s) — ${roundCount} rondas\n\n\u200B`;

    await postToDiscord(message);
};


export const postResultToDiscord = async (ranking: ChallengeHighscores) => {
    const roleId = process.env.DISCORD_ROLE_DAILY_ID; // solo números
    const ping = roleId ? `<@&${roleId}>` : "@Desafío Diario";

    const leaderboard = ranking.highscores.items
        .map((entry: any, index: number) => {
            const position = `${index + 1}º`;
            const name = entry.game.player.nick;
            const score = Number(entry.game.player.totalScore.amount).toLocaleString("es-ES");
            return `${position} ${name} – ${score} pts`;
        })
        .join("\n");

    const totalScore = ranking.highscores.items.reduce(
        (acc: number, entry: any) => acc + Number(entry.game.player.totalScore.amount),
        0
    );

    const average = Math.round(totalScore / ranking.highscores.items.length);

    // ⚠️ importante: sin indentación en el template literal
    const message =
        `## 📊 Resultados del desafío — <t:${ranking.timestamp}:D>  ${ping}
🔗 Enlace: ${challengeUrl(ranking.token)}
📈 Puntuación media: ${average}
🏆 Ranking:

\`\`\`
${leaderboard}
\`\`\``;

    await postToDiscord(message);
}


