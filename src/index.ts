import "dotenv/config";

import { startDiscordBot } from "./discord.js";

if (!process.env.OPENAI_API_KEY) {
  throw new Error(
    "Brak OPENAI_API_KEY w .env"
  );
}

await startDiscordBot();