import "dotenv/config";

import {
  startDiscordBot
} from "./discord.js";

import {
  startReminderWorker
} from "./reminderWorker.js";


if (!process.env.OPENAI_API_KEY) {
  throw new Error(
    "Brak OPENAI_API_KEY w .env"
  );
}

await startDiscordBot();

startReminderWorker();