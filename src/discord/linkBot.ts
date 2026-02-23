import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import { linkGeoToDiscord } from "../league/linkGeoToDiscord.js";

const discordToken = process.env.DISCORD_TOKEN!;
const guildId = process.env.DISCORD_GUILD_ID!; // servidor donde registras el comando

if (!discordToken) throw new Error("Missing DISCORD_TOKEN");
if (!guildId) throw new Error("Missing DISCORD_GUILD_ID");

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

async function registerCommands(clientId: string) {
    const rest = new REST({ version: "10" }).setToken(discordToken);

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: [linkCommand.toJSON()],
    });

    console.log("✅ Slash command /link registered");
}

export async function startLinkBot(): Promise<void> {
    const client = new Client({
        intents: [GatewayIntentBits.Guilds],
    });

    client.once("ready", async () => {
        if (!client.user) return;

        await registerCommands(client.user.id);
        console.log(`🤖 Link bot ready as ${client.user.tag}`);
    });

    client.on("interactionCreate", async (interaction) => {
        try {
            if (!interaction.isChatInputCommand()) return;
            if (interaction.commandName !== "link") return;

            const geoId = interaction.options.getString("geoid", true);
            const discordId = interaction.user.id;

            const res = linkGeoToDiscord(geoId, discordId);

            if (!res.ok) {
                await interaction.reply({ content: `❌ ${res.reason}`, ephemeral: true });
                return;
            }

            await interaction.reply({
                content: `✅ Vinculado correctamente.\nGeoGuessr: \`${geoId.trim()}\`\nDiscord: <@${discordId}>`,
                ephemeral: true,
            });
        } catch (e) {
            console.error(e);
            if (interaction.isRepliable()) {
                await interaction.reply({ content: "❌ Error vinculando tu cuenta. Avísame y lo miro.", ephemeral: true });
            }
        }
    });

    await client.login(discordToken);
}
