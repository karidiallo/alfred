import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  Partials
} from "discord.js";
import { askAlfred } from "./openai.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

function shouldRespond(message: Message): boolean {
  if (message.author.bot) return false;

  const dedicatedChannelId = process.env.DISCORD_CHANNEL_ID?.trim();
  if (dedicatedChannelId) return message.channel.id === dedicatedChannelId;

  // In DMs Alfred answers everything.
  if (!message.guild) return true;

  // Without a dedicated channel, answer only when mentioned.
  return Boolean(client.user && message.mentions.has(client.user));
}

function cleanMessage(message: Message): string {
  let content = message.content;
  if (client.user) {
    content = content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "");
  }
  return content.trim();
}

function splitDiscordMessage(text: string, max = 1900): string[] {
  if (text.length <= max) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > max) {
    let cut = remaining.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = remaining.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;

    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

client.once(Events.ClientReady, readyClient => {
  console.log(`Alfred online jako ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async message => {
  if (!shouldRespond(message)) return;

  const input = cleanMessage(message);
  if (!input) return;

  try {
    await message.channel.sendTyping();

    const conversationId = message.guild
      ? `guild:${message.guild.id}:channel:${message.channel.id}`
      : `dm:${message.author.id}`;

    const answer = await askAlfred(conversationId, input);

    for (const chunk of splitDiscordMessage(answer)) {
      await message.reply({ content: chunk, allowedMentions: { repliedUser: false } });
    }
  } catch (error) {
    console.error("Alfred error:", error);
    await message.reply({
      content: "Mam błąd po swojej stronie. Sprawdź terminal Alfreda — tam będzie dokładny log.",
      allowedMentions: { repliedUser: false }
    });
  }
});

export async function startDiscordBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("Brak DISCORD_BOT_TOKEN w .env");
  await client.login(token);
}
