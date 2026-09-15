import "dotenv/config";

import OpenAI from "openai";

import { ALFRED_INSTRUCTIONS } from "./instructions.js";

import {
  getActiveMemories,
  getCurrentState,
  saveMemory
} from "./supabase.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});


// --------------------------------------------------
// SHORT-TERM CONVERSATION CONTINUITY
// --------------------------------------------------

const previousResponseByConversation =
  new Map<string, string>();


// --------------------------------------------------
// MEMORY FORMATTER
// --------------------------------------------------

function formatMemories(
  memories: any[]
): string {
  if (!memories.length) {
    return `
PERSISTENT MEMORY:

No persistent memories are currently available.
`;
  }

  const formatted = memories
    .map((memory, index) => {
      return `${index + 1}. [${memory.type}] ${memory.content}`;
    })
    .join("\n");

  return `
PERSISTENT MEMORY ABOUT KARI:

${formatted}

MEMORY RULES:

- Memories may describe historical information.
- Do not automatically treat a memory as current state.
- Explicit user statements have higher authority than inferred patterns.
- If the current message contradicts a memory, prefer the newer explicit statement.
- Never invent missing memories.
`;
}


// --------------------------------------------------
// CURRENT STATE FORMATTER
// --------------------------------------------------

function formatCurrentState(
  state: any[]
): string {
  if (!state.length) {
    return `
CURRENT STATE:

No current-state records are currently available.
`;
  }

  const formatted = state
    .map(item => {
      const value =
        typeof item.value === "string"
          ? item.value
          : JSON.stringify(item.value);

      return `- ${item.key}: ${value}
  updated_at: ${item.updated_at}
  confidence: ${item.confidence}`;
    })
    .join("\n");

  return `
CURRENT STATE OF KARI'S WORLD:

${formatted}

CURRENT STATE RULES:

- Current state represents what is believed to be true NOW.
- Prefer current_state over conflicting historical memories.
- Pay attention to updated_at.
- Do not claim stale information is current if its freshness is questionable.
- If important current information is missing, say that it is unknown.
`;
}


// --------------------------------------------------
// EXPLICIT MEMORY COMMAND
// --------------------------------------------------

function extractExplicitMemory(
  message: string
): string | null {
  const patterns = [
    /^zapamiętaj[, ]+(?:że\s+)?(.+)$/i,
    /^zapamietaj[, ]+(?:ze\s+)?(.+)$/i,
    /^pamiętaj[, ]+(?:że\s+)?(.+)$/i,
    /^pamietaj[, ]+(?:ze\s+)?(.+)$/i,
    /^remember[, ]+(?:that\s+)?(.+)$/i
  ];

  for (const pattern of patterns) {
    const match =
      message.trim().match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}


// --------------------------------------------------
// SAVE EXPLICIT MEMORY
// --------------------------------------------------

async function handleExplicitMemory(
  message: string
) {
  const memoryContent =
    extractExplicitMemory(message);

  if (!memoryContent) {
    return null;
  }

  const existing =
    await getActiveMemories(100);

  const duplicate =
    existing.some(memory =>
      memory.content
        .trim()
        .toLowerCase() ===
      memoryContent
        .trim()
        .toLowerCase()
    );

  if (!duplicate) {
    await saveMemory({
      type: "explicit_user_memory",
      content: memoryContent,
      source: "explicit_user_command",
      confidence: 1,
      metadata: {
        captured_by: "alfred_v0.3"
      }
    });

    console.log(
      `🧠 Memory saved: ${memoryContent}`
    );
  } else {
    console.log(
      `🧠 Memory already exists: ${memoryContent}`
    );
  }

  return memoryContent;
}


// --------------------------------------------------
// ASK ALFRED
// --------------------------------------------------

export async function askAlfred(
  conversationId: string,
  message: string
) {
  // 1. Explicit memory
  try {
    await handleExplicitMemory(message);
  } catch (error) {
    console.error(
      "Memory save error:",
      error
    );
  }


  // 2. Retrieve persistent memory
  let memoryContext = "";

  try {
    const memories =
      await getActiveMemories(50);

    memoryContext =
      formatMemories(memories);
  } catch (error) {
    console.error(
      "Memory retrieval error:",
      error
    );

    memoryContext = `
PERSISTENT MEMORY:

Memory database is temporarily unavailable.
Do not invent missing memories.
`;
  }


  // 3. Retrieve CURRENT state
  let currentStateContext = "";

  try {
    const state =
      await getCurrentState();

    currentStateContext =
      formatCurrentState(state);
  } catch (error) {
    console.error(
      "Current state retrieval error:",
      error
    );

    currentStateContext = `
CURRENT STATE:

Current-state database is temporarily unavailable.
Do not invent current information.
`;
  }


  // 4. Build Alfred's context
  const instructions = `
${ALFRED_INSTRUCTIONS}

${currentStateContext}

${memoryContext}

CONTEXT PRIORITY:

1. The user's current explicit message
2. Current State
3. Active decisions / objectives when available
4. Persistent Memory
5. General inference

Never allow old memory to override newer confirmed current state.
`;


  // 5. Short-term conversation continuity
  const previousResponseId =
    previousResponseByConversation.get(
      conversationId
    );


  // 6. Call OpenAI
  const response =
    await client.responses.create({
      model:
        process.env.OPENAI_MODEL ||
        "gpt-5.6-sol",

      instructions,

      input: message,

      ...(previousResponseId
        ? {
            previous_response_id:
              previousResponseId
          }
        : {})
    });


  // 7. Save response ID
  previousResponseByConversation.set(
    conversationId,
    response.id
  );


  const text =
    response.output_text?.trim();

  return (
    text ||
    "Nie udało mi się wygenerować odpowiedzi."
  );
}