import "dotenv/config";

import {
  startDiscordBot,
  sendProactiveDiscordMessage
} from "./discord.js";

if (!process.env.OPENAI_API_KEY) {
  throw new Error(
    "Brak OPENAI_API_KEY w .env"
  );
}

await startDiscordBot();

await sendProactiveDiscordMessage(
  "Test proaktywnej wiadomości: mogę napisać pierwszy."
);