import {
  getPendingReminder,
  savePendingReminder,
  clearPendingReminder
} from "./pendingReminderState.js";

import {
  parseReminderRequest
} from "./reminderParser.js";

import {
  createReminder,
  getScheduledReminders
} from "./reminders.js";

import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  Partials
} from "discord.js";

import { askAlfred } from "./openai.js";
import { runMemoryKeeper } from "./memoryKeeper.js";

const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

let activeClient: Client | null = null;


// --------------------------------------------------
// CREATE DISCORD CLIENT
// --------------------------------------------------

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


  // ------------------------------------------------
  // READY
  // ------------------------------------------------

  client.once(Events.ClientReady, readyClient => {
    console.log(
      `✅ Alfred online jako ${readyClient.user.tag}`
    );
  });


  // ------------------------------------------------
  // ERRORS
  // ------------------------------------------------

  client.on(Events.Error, error => {
    console.error(
      "Discord client error:",
      error
    );
  });

  client.on(Events.ShardError, error => {
    console.error(
      "Discord shard error:",
      error
    );
  });


  // ------------------------------------------------
  // MESSAGE HANDLER
  // ------------------------------------------------

  client.on(
    Events.MessageCreate,
    async message => {

      if (!shouldRespond(message, client)) {
        return;
      }

      const input =
        cleanMessage(message, client);

      if (!input) {
        return;
      }

      try {
        await message.channel.sendTyping();


        // --------------------------------------------
        // Conversation ID
        // --------------------------------------------

        const conversationId =
          message.guild
            ? `guild:${message.guild.id}:channel:${message.channel.id}`
            : `dm:${message.author.id}`;

            // --------------------------------------------
// LIST REMINDERS
// --------------------------------------------

const listRemindersRequest =
  /\b(jakie mam (ustawione )?przypomnienia|pokaż (mi )?przypomnienia|pokaz (mi )?przypomnienia|lista przypomnień|lista przypomnien)\b/i
    .test(input);

if (listRemindersRequest) {

  const reminders =
    await getScheduledReminders();

  if (!reminders.length) {

    await message.reply({
      content:
        "Nie masz obecnie żadnych aktywnych przypomnień.",

      allowedMentions: {
        repliedUser: false
      }
    });

    return;
  }


  const timezone =
    process.env.ALFRED_TIMEZONE ||
    "Europe/Warsaw";


  const lines =
    reminders.map(
      (
        reminder,
        index
      ) => {

        const due =
          new Date(
            reminder.due_at
          );

        const formatted =
          due.toLocaleString(
            "pl-PL",
            {
              timeZone:
                timezone,

              dateStyle:
                "medium",

              timeStyle:
                "short"
            }
          );

        return `${index + 1}. **${reminder.message}** — ${formatted}`;
      }
    );


  await message.reply({
    content:
      `Masz ustawione przypomnienia:\n\n${lines.join("\n")}`,

    allowedMentions: {
      repliedUser: false
    }
  });

  return;
}

// --------------------------------------------
// REMINDER REQUEST
// --------------------------------------------

const explicitReminderRequest =
  /\b(przypomnij|napisz mi za|daj mi znać|remind me)\b/i
    .test(input);

const pendingReminder =
  await getPendingReminder(
    conversationId
  );

const reminderInput =
  pendingReminder &&
  !explicitReminderRequest
    ? `${pendingReminder.original_message}

Follow-up from Kari:
${input}`
    : input;

const shouldCheckReminder =
  explicitReminderRequest ||
  Boolean(pendingReminder);


if (shouldCheckReminder) {

  // Allow cancelling an unfinished reminder
  if (
    pendingReminder &&
    /\b(nieważne|niewazne|anuluj|cancel)\b/i
      .test(input)
  ) {

    await clearPendingReminder(
      conversationId
    );

    await message.reply({
      content:
        "Jasne — nie ustawiam tego przypomnienia.",

      allowedMentions: {
        repliedUser: false
      }
    });

    return;
  }


  const parsedReminder =
    await parseReminderRequest(
      reminderInput
    );


  // ------------------------------------------
  // NEEDS MORE INFORMATION
  // ------------------------------------------

  if (
    parsedReminder.is_reminder &&
    parsedReminder.clarification_needed
  ) {

    await savePendingReminder(
      conversationId,
      {
        reminder_message:
          parsedReminder.reminder_message,

        original_message:
          pendingReminder?.original_message ??
          input
      }
    );

    await message.reply({
      content:
        parsedReminder.clarification_question ??
        "Na kiedy mam ustawić przypomnienie?",

      allowedMentions: {
        repliedUser: false
      }
    });

    return;
  }


  // ------------------------------------------
  // COMPLETE REMINDER
  // ------------------------------------------

  if (
    parsedReminder.is_reminder &&
    parsedReminder.due_at &&
    parsedReminder.reminder_message
  ) {

    await createReminder({

      message:
        parsedReminder.reminder_message,

      due_at:
        parsedReminder.due_at,

      channel_id:
        message.channel.id,

      metadata: {
        source:
          "discord_explicit_reminder",

        original_message:
          pendingReminder?.original_message ??
          input,

        conversation_id:
          conversationId
      }
    });


    if (pendingReminder) {
      await clearPendingReminder(
        conversationId
      );
    }


    const due =
      new Date(
        parsedReminder.due_at
      );


    await message.reply({
      content:
        `Jasne — przypomnę Ci: **${parsedReminder.reminder_message}** o ${due.toLocaleString(
          "pl-PL",
          {
            timeZone:
              process.env.ALFRED_TIMEZONE ||
              "Europe/Warsaw",

            dateStyle:
              "medium",

            timeStyle:
              "short"
          }
        )}.`,

      allowedMentions: {
        repliedUser: false
      }
    });

    return;
  }
}

// --------------------------------------------
// EXPLICIT MEMORY REQUEST
// --------------------------------------------

const explicitMemoryRequest =
  /\b(zapamiętaj|zapamietaj|pamiętaj że|pamietaj ze|zapisz sobie|remember that)\b/i
    .test(input);

let memoryTurnContext:
  string | undefined;


// Jeśli Kari WYRAŹNIE prosi o zapamiętanie,
// zapis musi wydarzyć się PRZED odpowiedzią.
if (explicitMemoryRequest) {

  try {

    const persisted =
      await runMemoryKeeper(input);

    memoryTurnContext =
      persisted
        ? `
The user explicitly asked you to remember information.

Memory Keeper completed successfully and identified
persistent information from this message.

You may accurately confirm that the information was saved.
Do not exaggerate what was saved.
`
        : `
The user explicitly asked you to remember information.

Memory Keeper completed, but no persistent structured
information was saved from this message.

DO NOT say:
- "zapamiętane"
- "zapisałem"
- "mam to zapisane"

Be transparent that you could not confirm a persistent save.
`;

  } catch (error) {

    console.error(
      "Explicit Memory Keeper error:",
      error
    );

    memoryTurnContext = `
The user explicitly asked you to remember information.

The persistence operation FAILED for this turn.

DO NOT claim that anything was saved or remembered persistently.
Tell Kari briefly that the save did not succeed.
`;
  }
}


// --------------------------------------------
// MAIN ALFRED RESPONSE
// --------------------------------------------

const answer =
  await askAlfred(
    conversationId,
    input,
    memoryTurnContext
  );


// --------------------------------------------
// SEND RESPONSE TO DISCORD
// --------------------------------------------

for (
  const chunk of
  splitDiscordMessage(answer)
) {
  await message.reply({
    content: chunk,

    allowedMentions: {
      repliedUser: false
    }
  });
}


// --------------------------------------------
// BACKGROUND MEMORY KEEPER
// --------------------------------------------
//
// Przy zwykłej rozmowie działa po odpowiedzi,
// żeby nie spowalniać Alfreda.
//
// Przy explicit "zapamiętaj" został już
// wykonany PRZED odpowiedzią.
// --------------------------------------------

if (!explicitMemoryRequest) {

  void runMemoryKeeper(input)
    .catch(error => {
      console.error(
        "Memory Keeper error:",
        error
      );
    });
}


      } catch (error) {

        console.error(
          "Alfred error:",
          error
        );

        await message.reply({
          content:
            "Mam błąd po swojej stronie. Sprawdź terminal Alfreda — tam będzie dokładny log.",

          allowedMentions: {
            repliedUser: false
          }
        });
      }
    }
  );

  return client;
}


// --------------------------------------------------
// SHOULD ALFRED RESPOND?
// --------------------------------------------------

function shouldRespond(
  message: Message,
  client: Client
): boolean {

  // Ignorujemy wiadomości innych botów
  if (message.author.bot) {
    return false;
  }


  // -----------------------------------------------
  // DM
  // -----------------------------------------------

  // W prywatnych wiadomościach
  // Alfred odpowiada zawsze.

  if (!message.guild) {
    return true;
  }


  // -----------------------------------------------
  // DEDICATED CHANNEL ID
  // -----------------------------------------------

  const dedicatedChannelId =
    process.env
      .DISCORD_CHANNEL_ID
      ?.trim();

  if (
    dedicatedChannelId &&
    message.channel.id ===
      dedicatedChannelId
  ) {
    return true;
  }


  // -----------------------------------------------
  // #alfred
  // -----------------------------------------------

  // Na naszym kanale #alfred
  // nie trzeba pisać @Alfred.

  if (
    "name" in message.channel &&
    message.channel.name === "alfred"
  ) {
    return true;
  }


  // -----------------------------------------------
  // OTHER CHANNELS
  // -----------------------------------------------

  // Na pozostałych kanałach
  // Alfred reaguje tylko po oznaczeniu.

  return Boolean(
    client.user &&
    message.mentions.has(
      client.user
    )
  );
}


// --------------------------------------------------
// CLEAN MESSAGE
// --------------------------------------------------

function cleanMessage(
  message: Message,
  client: Client
): string {

  let content =
    message.content;

  // Usuwamy @Alfred z tekstu,
  // zanim wiadomość trafi do modelu.

  if (client.user) {

    content =
      content.replace(
        new RegExp(
          `<@!?${client.user.id}>`,
          "g"
        ),
        ""
      );
  }

  return content.trim();
}


// --------------------------------------------------
// SPLIT LONG DISCORD MESSAGES
// --------------------------------------------------

function splitDiscordMessage(
  text: string,
  max = 1900
): string[] {

  if (text.length <= max) {
    return [text];
  }

  const chunks: string[] = [];

  let remaining =
    text;

  while (
    remaining.length > max
  ) {

    let cut =
      remaining.lastIndexOf(
        "\n",
        max
      );

    if (
      cut < max * 0.5
    ) {

      cut =
        remaining.lastIndexOf(
          " ",
          max
        );
    }

    if (
      cut < max * 0.5
    ) {
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
    chunks.push(
      remaining
    );
  }

  return chunks;
}


// --------------------------------------------------
// DISCORD GATEWAY PATCH
// --------------------------------------------------

/**
 * discord.js standardowo pobiera:
 *
 * GET /gateway/bot
 *
 * przez @discordjs/rest.
 *
 * W naszym Codespace Discord
 * czasami zwracał tam losowe:
 *
 * 500
 * 503
 *
 * Native fetch działał poprawnie,
 * dlatego tylko dla tego endpointu
 * robimy własny request + retry.
 */

function patchGatewayRequest(
  client: Client,
  token: string
) {

  const rest =
    client.rest as any;

  const originalGet =
    rest.get.bind(rest);


  rest.get = async (
    route: any,
    options?: any
  ) => {

    const routeString =
      String(route);


    // ---------------------------------------------
    // Wszystkie inne Discord API requests
    // działają normalnie.
    // ---------------------------------------------

    if (
      routeString !==
      "/gateway/bot"
    ) {

      return originalGet(
        route,
        options
      );
    }


    // ---------------------------------------------
    // /gateway/bot
    // ---------------------------------------------

    let lastError:
      unknown;


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

        lastError =
          error;


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

// --------------------------------------------------
// PROACTIVE DISCORD MESSAGE
// --------------------------------------------------

export async function sendProactiveDiscordMessage(
  content: string,
  channelId?: string
): Promise<void> {

  if (!activeClient?.isReady()) {
    throw new Error(
      "Discord client is not ready."
    );
  }

  const targetChannelId =
    channelId?.trim() ||
    process.env.DISCORD_CHANNEL_ID?.trim();

  if (!targetChannelId) {
    throw new Error(
      "Brak DISCORD_CHANNEL_ID."
    );
  }

  const channel =
    await activeClient.channels.fetch(
      targetChannelId
    );

  if (
    !channel ||
    !channel.isTextBased() ||
    !("send" in channel)
  ) {
    throw new Error(
      "Docelowy kanał Discord nie obsługuje wiadomości tekstowych."
    );
  }

  for (
    const chunk of
    splitDiscordMessage(content)
  ) {
    await channel.send({
      content: chunk,

      allowedMentions: {
        parse: []
      }
    });
  }
}

// --------------------------------------------------
// START DISCORD BOT
// --------------------------------------------------

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

await client.login(
  token
);

if (!client.isReady()) {

  await new Promise<void>(
    (resolve, reject) => {

      const timeout =
        setTimeout(
          () => {
            reject(
              new Error(
                "Discord client did not become ready within 20 seconds."
              )
            );
          },
          20000
        );

      client.once(
        Events.ClientReady,
        () => {
          clearTimeout(timeout);
          resolve();
        }
      );
    }
  );
}

activeClient =
  client;

return;

    } catch (error) {

      console.error(
        `Discord login nieudany — próba ${attempt}/10`
      );

      console.error(
        error
      );


      try {

        await client.destroy();

      } catch {

        // ignorujemy błąd cleanup

      }


      if (
        attempt < 10
      ) {

        console.log(
          "Ponawiam za 15 sekund..."
        );

        await sleep(
          15000
        );
      }
    }
  }


  throw new Error(
    "Alfred nie połączył się z Discordem po 10 próbach."
  );
}