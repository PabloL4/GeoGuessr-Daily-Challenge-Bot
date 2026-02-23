import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import { linkGeoToDiscord } from "../league/linkGeoToDiscord.js";
import {
    unlinkGeoFromDiscordByGeoId,
    unlinkGeoFromDiscordByDiscordId,
} from "../league/linkGeoToDiscord.js";

// 1) Definimos el comando
const linkCommand = new SlashCommandBuilder()
    .setName("link")
    .setDescription("Vincula tu GeoGuessr userId con tu usuario de Discord")
    .addStringOption((opt) =>
        opt
            .setName("geoid")
            .setDescription("Tu GeoGuessr userId (ej: 614ae3f096b10b0001ad06e8)")
            .setRequired(true)
    );

const ADMIN_DISCORD_IDS = new Set<string>([
    "MY_DISCORD_ID",
]);

async function registerCommands(discordToken: string, clientId: string, guildId: string) {
    const rest = new REST({ version: "10" }).setToken(discordToken);

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: [linkCommand.toJSON(), unlinkCommand.toJSON()],
    });

    console.log("✅ Slash command /link registered");
}

const unlinkCommand = new SlashCommandBuilder()
    .setName("unlink")
    .setDescription("Desvincula un GeoGuessr ID de un usuario de Discord (admin)")
    .addStringOption((opt) =>
        opt
            .setName("geoid")
            .setDescription("GeoGuessr userId a desvincular")
            .setRequired(false)
    )
    .addUserOption((opt) =>
        opt
            .setName("discord")
            .setDescription("Usuario de Discord a desvincular")
            .setRequired(false)
    );


export async function startLinkBot(): Promise<void> {
    // ✅ leer env AQUÍ (ya con dotenv cargado en el main)
    const discordToken = process.env.DISCORD_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!discordToken) throw new Error("Missing DISCORD_TOKEN");
    if (!guildId) throw new Error("Missing DISCORD_GUILD_ID");

    const client = new Client({
        intents: [GatewayIntentBits.Guilds],
    });

    client.once("ready", async () => {
        if (!client.user) return;

        await registerCommands(discordToken, client.user.id, guildId);
        console.log(`🤖 Link bot ready as ${client.user.tag}`);
    });

    client.on("interactionCreate", async (interaction) => {
        try {
            if (!interaction.isChatInputCommand()) return;

            /* =========================
               /link (usuarios normales)
               ========================= */
            if (interaction.commandName === "link") {
                const geoId = interaction.options.getString("geoid", true);
                const discordId = interaction.user.id;

                const res = linkGeoToDiscord(geoId, discordId);

                if (!res.ok) {
                    await interaction.reply({ content: `❌ ${res.reason}`, ephemeral: true });
                    return;
                }

                await interaction.reply({
                    content:
                        res.status === "already_linked"
                            ? `✅ Ya estabas vinculado.\nGeoGuessr: \`${geoId.trim()}\`\nDiscord: <@${discordId}>`
                            : `✅ Vinculado correctamente.\nGeoGuessr: \`${geoId.trim()}\`\nDiscord: <@${discordId}>`,
                    ephemeral: true,
                });

                return;
            }

            /* =========================
               /unlink (solo admins)
               ========================= */
            if (interaction.commandName === "unlink") {
                if (!ADMIN_DISCORD_IDS.has(interaction.user.id)) {
                    await interaction.reply({
                        content: "❌ No tienes permisos para usar este comando.",
                        ephemeral: true,
                    });
                    return;
                }

                const geoId = interaction.options.getString("geoid");
                const user = interaction.options.getUser("discord");

                if (!geoId && !user) {
                    await interaction.reply({
                        content: "❌ Debes indicar `geoid` o `discord`.",
                        ephemeral: true,
                    });
                    return;
                }

                const res = geoId
                    ? unlinkGeoFromDiscordByGeoId(geoId)
                    : unlinkGeoFromDiscordByDiscordId(user!.id);

                if (!res.ok) {
                    await interaction.reply({ content: `❌ ${res.reason}`, ephemeral: true });
                    return;
                }

                await interaction.reply({
                    content: `✅ Desvinculación correcta.\nGeoGuessr ID: \`${res.geoId}\``,
                    ephemeral: true,
                });

                return;
            }
        } catch (e) {
            console.error(e);
            if (interaction.isRepliable()) {
                await interaction.reply({
                    content: "❌ Error procesando el comando.",
                    ephemeral: true,
                });
            }
        }
    });


    await client.login(discordToken);
}
