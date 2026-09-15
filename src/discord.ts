import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  Partials
} from "discord.js";

import { askAlfred } from "./openai.js";

const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

let activeClient: Client | null = null;

function createClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
  });

  client.once(Events.ClientReady, readyClient => {
    console.log(`✅ Alfred online jako ${readyClient.user.tag}`);
  });

  client.on(Events.Error, error => {
    console.error("Discord client error:", error);
  });

  client.on(Events.ShardError, error => {
    console.error("Discord shard error:", error);
  });

  client.on(Events.MessageCreate, async message => {
    if (!shouldRespond(message, client)) return;

    const input = cleanMessage(message, client);

    if (!input) return;

    try {
      await message.channel.sendTyping();

      const conversationId = message.guild
        ? `guild:${message.guild.id}:channel:${message.channel.id}`
        : `dm:${message.author.id}`;

      const answer = await askAlfred(
        conversationId,
        input
      );

      for (const chunk of splitDiscordMessage(answer)) {
        await message.reply({
          content: chunk,
          allowedMentions: {
            repliedUser: false
          }
        });
      }
    } catch (error) {
      console.error("Alfred error:", error);

      await message.reply({
        content:
          "Mam błąd po swojej stronie. Sprawdź terminal Alfreda — tam będzie dokładny log.",
        allowedMentions: {
          repliedUser: false
        }
      });
    }
  });

  return client;
}

/**
 * Decyduje, kiedy Alfred ma odpowiedzieć.
 *
 * 1. Ignoruje boty.
 * 2. W DM odpowiada zawsze.
 * 3. Na kanale #alfred odpowiada zawsze.
 * 4. Jeśli później ustawimy DISCORD_CHANNEL_ID,
 *    ten kanał też będzie traktowany jako dedykowany.
 * 5. Na innych kanałach odpowiada tylko po @Alfred.
 */
function shouldRespond(
  message: Message,
  client: Client
): boolean {
  if (message.author.bot) return false;

  // Prywatna wiadomość do Alfreda
  if (!message.guild) {
    return true;
  }

  // Jeśli kiedyś ustawimy konkretny ID kanału
  const dedicatedChannelId =
    process.env.DISCORD_CHANNEL_ID?.trim();

  if (
    dedicatedChannelId &&
    message.channel.id === dedicatedChannelId
  ) {
    return true;
  }

  // Nasz kanał #alfred
  if (
    "name" in message.channel &&
    message.channel.name === "alfred"
  ) {
    return true;
  }

  // Na pozostałych kanałach Alfred reaguje po oznaczeniu
  return Boolean(
    client.user &&
    message.mentions.has(client.user)
  );
}

/**
 * Usuwa @Alfred z wiadomości,
 * żeby model dostał czysty tekst.
 */
function cleanMessage(
  message: Message,
  client: Client
): string {
  let content = message.content;

  if (client.user) {
    content = content.replace(
      new RegExp(
        `<@!?${client.user.id}>`,
        "g"
      ),
      ""
    );
  }

  return content.trim();
}

/**
 * Discord ma limit długości wiadomości.
 * Dłuższe odpowiedzi Alfreda dzielimy
 * na kilka części.
 */
function splitDiscordMessage(
  text: string,
  max = 1900
): string[] {
  if (text.length <= max) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > max) {
    let cut =
      remaining.lastIndexOf("\n", max);

    if (cut < max * 0.5) {
      cut =
        remaining.lastIndexOf(" ", max);
    }

    if (cut < max * 0.5) {
      cut = max;
    }

    chunks.push(
      remaining
        .slice(0, cut)
        .trim()
    );

    remaining =
      remaining
        .slice(cut)
        .trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

/**
 * Discord.js standardowo pobiera /gateway/bot
 * przez @discordjs/rest.
 *
 * W naszym Codespace Discord czasami zwracał
 * tam losowe 500/503.
 *
 * Native fetch działał poprawnie,
 * dlatego dla tego jednego endpointu
 * robimy własny request z retry.
 */
function patchGatewayRequest(
  client: Client,
  token: string
) {
  const rest = client.rest as any;

  const originalGet =
    rest.get.bind(rest);

  rest.get = async (
    route: any,
    options?: any
  ) => {
    const routeString =
      String(route);

    // Wszystkie inne requesty Discorda
    // działają normalnie przez discord.js
    if (routeString !== "/gateway/bot") {
      return originalGet(
        route,
        options
      );
    }

    let lastError: unknown;

    for (
      let attempt = 1;
      attempt <= 8;
      attempt++
    ) {
      try {
        const response =
          await fetch(
            "https://discord.com/api/v10/gateway/bot",
            {
              headers: {
                Authorization:
                  `Bot ${token}`
              }
            }
          );

        if (response.ok) {
          console.log(
            `✅ Discord gateway info OK — próba ${attempt}`
          );

          return await response.json();
        }

        lastError =
          new Error(
            `Discord gateway HTTP ${response.status}`
          );

        console.warn(
          `⚠️ Discord gateway HTTP ${response.status} — próba ${attempt}/8`
        );
      } catch (error) {
        lastError = error;

        console.warn(
          `⚠️ Discord gateway fetch error — próba ${attempt}/8`
        );
      }

      await sleep(
        attempt * 3000
      );
    }

    throw (
      lastError ??
      new Error(
        "Nie udało się pobrać Discord gateway info."
      )
    );
  };
}

/**
 * Startuje Alfreda.
 *
 * Jeśli Discord chwilowo zwraca błąd,
 * Alfred próbuje ponownie zamiast
 * od razu się wyłączyć.
 */
export async function startDiscordBot() {
  const token =
    process.env
      .DISCORD_BOT_TOKEN
      ?.trim();

  if (!token) {
    throw new Error(
      "Brak DISCORD_BOT_TOKEN w .env"
    );
  }

  for (
    let attempt = 1;
    attempt <= 10;
    attempt++
  ) {
    console.log(
      `Łączenie Alfreda z Discordem — próba ${attempt}/10`
    );

    const client =
      createClient();

    patchGatewayRequest(
      client,
      token
    );

    try {
      await client.login(token);

      activeClient = client;

      return;
    } catch (error) {
      console.error(
        `Discord login nieudany — próba ${attempt}/10`
      );

      console.error(error);

      try {
        await client.destroy();
      } catch {
        // ignorujemy błąd cleanup
      }

      if (attempt < 10) {
        console.log(
          "Ponawiam za 15 sekund..."
        );

        await sleep(15000);
      }
    }
  }

  throw new Error(
    "Alfred nie połączył się z Discordem po 10 próbach."
  );
}