import "dotenv/config";

import OpenAI from "openai";

import { ALFRED_INSTRUCTIONS } from "./instructions.js";

import {
  getActiveMemories,
  getCurrentState,
  getActiveDecisions,
  getActiveObjectives,
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

  const formatted =
    memories
      .map((memory, index) => {
        return `${index + 1}. [${memory.type}] ${memory.content}
confidence: ${memory.confidence}
source: ${memory.source ?? "unknown"}`;
      })
      .join("\n\n");

  return `
PERSISTENT MEMORY ABOUT KARI:

${formatted}

MEMORY RULES:

- Memories may be historical.
- Do not automatically treat memories as current state.
- Explicit user statements outrank inferred patterns.
- Newer confirmed information outranks older information.
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

  const formatted =
    state
      .map(item => {

        const value =
          typeof item.value === "string"
            ? item.value
            : JSON.stringify(item.value);

        return `- ${item.key}: ${value}
updated_at: ${item.updated_at}
confidence: ${item.confidence}
source: ${item.source ?? "unknown"}`;
      })
      .join("\n\n");

  return `
CURRENT STATE OF KARI'S WORLD:

${formatted}

CURRENT STATE RULES:

- Current State represents what is believed to be true NOW.
- Prefer Current State over conflicting historical memory.
- Consider updated_at before relying on a value.
- Never present questionable stale information as definitely current.
- If an important current fact is missing, say it is unknown.
`;
}


// --------------------------------------------------
// DECISIONS FORMATTER
// --------------------------------------------------

function formatDecisions(
  decisions: any[]
): string {

  if (!decisions.length) {
    return `
ACTIVE DECISIONS:

No active decisions are currently stored.
`;
  }

  const formatted =
    decisions
      .map((decision, index) => {

        let output =
          `${index + 1}. ${decision.title}
Decision: ${decision.decision}`;

        if (decision.rationale) {
          output +=
            `\nRationale: ${decision.rationale}`;
        }

        if (decision.review_condition) {
          output +=
            `\nReview condition: ${decision.review_condition}`;
        }

        output +=
          `\nDecided at: ${decision.decided_at}`;

        return output;
      })
      .join("\n\n");

  return `
ACTIVE DECISIONS:

${formatted}

DECISION RULES:

- Protect continuity.
- Do not casually reopen an active decision.
- If Kari proposes something that conflicts with an active decision,
  surface the conflict.
- Explain the previous decision and rationale when relevant.
- A decision can be reconsidered if Kari explicitly wants to revisit it
  or its review condition has been met.
- Never treat an idea as a decision.
`;
}


// --------------------------------------------------
// OBJECTIVES FORMATTER
// --------------------------------------------------

function formatObjectives(
  objectives: any[]
): string {

  if (!objectives.length) {
    return `
ACTIVE OBJECTIVES:

No active objectives are currently stored.
`;
  }

  const formatted =
    objectives
      .map((objective, index) => {

        let output =
          `${index + 1}. [${objective.kind}] ${objective.title}`;

        if (objective.description) {
          output +=
            `\nDescription: ${objective.description}`;
        }

        output +=
          `\nPriority: ${objective.priority}`;

        if (objective.due_at) {
          output +=
            `\nDue: ${objective.due_at}`;
        }

        return output;
      })
      .join("\n\n");

  return `
ACTIVE OBJECTIVES:

${formatted}

OBJECTIVE RULES:

- Distinguish goals, projects, commitments and tasks.
- Active objectives should influence prioritization.
- Do not automatically promote new ideas into objectives.
- When multiple objectives compete, consider priority and current state.
- Surface conflicts between new requests and existing commitments.
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
      message
        .trim()
        .match(pattern);

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
        captured_by: "alfred_v0.5"
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

  // ------------------------------------------------
  // 1. Explicit memory
  // ------------------------------------------------

  try {

    await handleExplicitMemory(
      message
    );

  } catch (error) {

    console.error(
      "Memory save error:",
      error
    );
  }


  // ------------------------------------------------
  // 2. Retrieve all Alfred context
  // ------------------------------------------------

  let memoryContext = "";
  let currentStateContext = "";
  let decisionsContext = "";
  let objectivesContext = "";


  // MEMORY

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


  // CURRENT STATE

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


  // DECISIONS

  try {

    const decisions =
      await getActiveDecisions(30);

    decisionsContext =
      formatDecisions(decisions);

  } catch (error) {

    console.error(
      "Decisions retrieval error:",
      error
    );

    decisionsContext = `
ACTIVE DECISIONS:

Decision database is temporarily unavailable.
Do not invent prior decisions.
`;
  }


  // OBJECTIVES

  try {

    const objectives =
      await getActiveObjectives(50);

    objectivesContext =
      formatObjectives(objectives);

  } catch (error) {

    console.error(
      "Objectives retrieval error:",
      error
    );

    objectivesContext = `
ACTIVE OBJECTIVES:

Objectives database is temporarily unavailable.
Do not invent goals or commitments.
`;
  }


  // ------------------------------------------------
  // 3. BUILD ALFRED CONTEXT
  // ------------------------------------------------

  const instructions = `
${ALFRED_INSTRUCTIONS}


========================================
CURRENT STATE
========================================

${currentStateContext}


========================================
ACTIVE DECISIONS
========================================

${decisionsContext}


========================================
ACTIVE OBJECTIVES
========================================

${objectivesContext}


========================================
PERSISTENT MEMORY
========================================

${memoryContext}


========================================
CONTEXT PRIORITY
========================================

When sources conflict, use this hierarchy:

1. Kari's explicit statement in the current message
2. Confirmed Current State
3. Active Decisions
4. Active Objectives / Commitments
5. Persistent Memory
6. General inference

IMPORTANT:

- Never allow an old memory to silently override newer state.
- Never turn an idea into a project unless Kari actually commits to it.
- Protect prior decisions from accidental reopening.
- Surface contradictions when they materially affect the answer.
- If the database is uncertain or missing something, acknowledge uncertainty.
`;


  // ------------------------------------------------
  // 4. SHORT-TERM CONVERSATION CONTINUITY
  // ------------------------------------------------

  const previousResponseId =
    previousResponseByConversation.get(
      conversationId
    );


  // ------------------------------------------------
  // 5. CALL OPENAI
  // ------------------------------------------------

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


  // ------------------------------------------------
  // 6. SAVE RESPONSE ID
  // ------------------------------------------------

  previousResponseByConversation.set(
    conversationId,
    response.id
  );


  // ------------------------------------------------
  // 7. RETURN ANSWER
  // ------------------------------------------------

  const text =
    response.output_text?.trim();

  return (
    text ||
    "Nie udało mi się wygenerować odpowiedzi."
  );
}