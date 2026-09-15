import OpenAI from "openai";
import { ALFRED_INSTRUCTIONS } from "./instructions.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// v0.1 keeps continuity per Discord channel only while the process is running.
// Persistent memory comes in v0.2/v0.3 via Supabase.
const previousResponseByConversation = new Map<string, string>();

export async function askAlfred(conversationId: string, message: string) {
  const previousResponseId = previousResponseByConversation.get(conversationId);

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
    instructions: ALFRED_INSTRUCTIONS,
    input: message,
    ...(previousResponseId ? { previous_response_id: previousResponseId } : {})
  });

  previousResponseByConversation.set(conversationId, response.id);

  const text = response.output_text?.trim();
  return text || "Nie udało mi się wygenerować odpowiedzi.";
}
