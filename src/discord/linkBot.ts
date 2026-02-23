import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import { linkGeoToDiscord } from "../league/linkGeoToDiscord.js";
import {
    unlinkGeoFromDiscordByGeoId,
    unlinkGeoFromDiscordByDiscordId,
} from "../league/linkGeoToDiscord.js";

// 1) We define the command
const linkCommand = new SlashCommandBuilder()
    .setName("link")
    .setDescription("Vincula tu GeoGuessr userId con tu usuario de Discord")
    .setDMPermission(true)
    .addStringOption((opt) =>
        opt
            .setName("geoid")
            .setDescription("Tu GeoGuessr userId (ej: 614ae3f096b10b0001ad06e8)")
            .setRequired(true)
    );

const ADMIN_DISCORD_IDS = new Set<string>(
    (process.env.ADMIN_DISCORD_IDS ?? process.env.MY_DISCORD_ID ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
);

async function registerCommands(discordToken: string, clientId: string, guildId: string) {
    const rest = new REST({ version: "10" }).setToken(discordToken);

    await rest.put(
    Routes.applicationCommands(clientId),
    { body: [linkCommand.toJSON(), unlinkCommand.toJSON()] }
    );


    console.log("✅ Slash commands /link and /unlink registered");
}

const unlinkCommand = new SlashCommandBuilder()
    .setName("unlink")
    .setDescription("Unlink a GeoGuessr ID from a Discord user (admin)")
    .setDMPermission(true)
    .addStringOption((opt) =>
        opt
            .setName("geoid")
            .setDescription("GeoGuessr userId to unbind")
            .setRequired(false)
    )
    .addUserOption((opt) =>
        opt
            .setName("discord")
            .setDescription("Discord user to unlink")
            .setRequired(false)
    );


export async function startLinkBot(): Promise<void> {
    // ✅ read env HERE (already with dotenv loaded in the main)
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
               /link (normal users)
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
                            ? `✅ You were already linked.\nGeoGuessr: \`${geoId.trim()}\`\nDiscord: <@${discordId}>`
                            : `✅ Linked successfully.\nGeoGuessr: \`${geoId.trim()}\`\nDiscord: <@${discordId}>`,
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
                        content: "❌ You do not have permissions to use this command.",
                        ephemeral: true,
                    });
                    return;
                }

                const geoId = interaction.options.getString("geoid");
                const user = interaction.options.getUser("discord");

                if (!geoId && !user) {
                    await interaction.reply({
                        content: "❌ You must indicate `geoid` or `discord`.",
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
                    content: `✅ Successful unlink.\nGeoGuessr ID: \`${res.geoId}\``,
                    ephemeral: true,
                });

                return;
            }
        } catch (e) {
            console.error(e);
            if (interaction.isRepliable()) {
                await interaction.reply({
                    content: "❌ Error processing the command.",
                    ephemeral: true,
                });
            }
        }
    });


    await client.login(discordToken);
}
