
require("dotenv").config();

const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

console.log("Démarrage du bot...");
console.log("Token trouvé :", !!process.env.DISCORD_TOKEN);

const bot = new Client({
  intents: [GatewayIntentBits.Guilds]
});

bot.once("ready", () => {
  console.log(`Bot connecté : ${bot.user.tag}`);
});

bot.on("error", error => {
  console.error("Erreur du bot :", error);
});

bot.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "guerre") {
    const gameUrl = process.env.GAME_URL;

    if (!gameUrl || !gameUrl.startsWith("https://")) {
      await interaction.reply({
        content: "Le lien du jeu n'est pas encore configuré.",
        ephemeral: true
      });
      return;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("JOUER À WARZONE 3D")
        .setStyle(ButtonStyle.Link)
        .setURL(gameUrl)
    );

    await interaction.reply({
      content: "🔥 **WARZONE 3D** : rejoins la bataille !",
      components: [row]
    });
  }
});

bot.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error("Connexion Discord impossible :", error);
});
