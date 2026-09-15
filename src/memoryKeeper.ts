import "dotenv/config";

import OpenAI from "openai";

import {
  saveMemory,
  setCurrentState,
  saveDecision,
  saveObjective
} from "./supabase.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

type KeeperResult = {
  memories: Array<{
    type: string;
    content: string;
    confidence: number;
  }>;

  current_state: Array<{
    key: string;
    value: unknown;
    confidence: number;
  }>;

  decisions: Array<{
    title: string;
    decision: string;
    rationale?: string;
  }>;

  objectives: Array<{
    kind: "goal" | "project" | "commitment" | "task";
    title: string;
    description?: string;
    priority?: number;
  }>;
};


function extractJson(text: string): KeeperResult {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(cleaned);
}


export async function runMemoryKeeper(
  userMessage: string
) {
  if (!userMessage.trim()) return;

  const response = await client.responses.create({
    model:
      process.env.MEMORY_KEEPER_MODEL ||
      "gpt-5.6-luna",

    instructions: `
You are Alfred's Memory Keeper.

You do NOT talk to Kari.
You analyze one user message and decide whether it contains
information worth storing in Alfred's long-term system.

Be conservative.

Classify information into exactly four categories:

1. memories
Stable or semi-stable information about Kari:
preferences, personal facts, working style, recurring patterns,
relationships, interests, background knowledge.

2. current_state
Facts describing what is true NOW and may later change:
current priority, active project phase, current financial state,
current situation, current location, current work status.

3. decisions
Explicit decisions Kari has made.
A thought, emotion, possibility or idea is NOT a decision.

4. objectives
Goals, projects, commitments or tasks Kari has explicitly adopted.

IMPORTANT RULES:

- idea != project
- thought != decision
- emotion != state unless it describes an explicit current condition
- aspiration != commitment
- historical fact != current state
- do not infer sensitive facts
- do not invent information
- do not save casual conversation
- do not save every sentence
- prefer storing nothing over storing low-value noise
- never turn a business idea into an active project unless Kari clearly commits to it
- current_state keys must be short snake_case identifiers
- confidence must be between 0 and 1

Return ONLY valid JSON.

Schema:

{
  "memories": [
    {
      "type": "preference",
      "content": "string",
      "confidence": 1
    }
  ],
  "current_state": [
    {
      "key": "current_priority",
      "value": "something",
      "confidence": 1
    }
  ],
  "decisions": [
    {
      "title": "short title",
      "decision": "what was decided",
      "rationale": "optional reason"
    }
  ],
  "objectives": [
    {
      "kind": "goal|project|commitment|task",
      "title": "short title",
      "description": "optional",
      "priority": 1
    }
  ]
}

If there is nothing worth storing, return empty arrays.
`,

    input: userMessage
  });

  const raw =
    response.output_text?.trim();

  if (!raw) {
    return;
  }

  let result: KeeperResult;

  try {
    result = extractJson(raw);
  } catch (error) {
    console.error(
      "🧠 Memory Keeper returned invalid JSON:",
      raw
    );

    return;
  }


  // -----------------------------------------------
  // MEMORIES
  // -----------------------------------------------

  for (const memory of result.memories ?? []) {
    await saveMemory({
      type: memory.type,
      content: memory.content,
      source: "memory_keeper",
      confidence:
        memory.confidence ?? 0.8,
      metadata: {
        captured_by:
          "memory_keeper_v0.1"
      }
    });

    console.log(
      `🧠 Auto memory: ${memory.content}`
    );
  }


  // -----------------------------------------------
  // CURRENT STATE
  // -----------------------------------------------

  for (
    const state of
    result.current_state ?? []
  ) {
    await setCurrentState(
      state.key,
      state.value,
      "memory_keeper",
      state.confidence ?? 0.8
    );

    console.log(
      `🌍 State update: ${state.key}`
    );
  }


  // -----------------------------------------------
  // DECISIONS
  // -----------------------------------------------

  for (
    const decision of
    result.decisions ?? []
  ) {
    await saveDecision({
      title: decision.title,
      decision: decision.decision,
      rationale:
        decision.rationale
    });

    console.log(
      `⚖️ Decision saved: ${decision.title}`
    );
  }


  // -----------------------------------------------
  // OBJECTIVES
  // -----------------------------------------------

  for (
    const objective of
    result.objectives ?? []
  ) {
    await saveObjective({
      kind: objective.kind,
      title: objective.title,
      description:
        objective.description,
      priority:
        objective.priority ?? 3
    });

    console.log(
      `🎯 Objective saved: ${objective.title}`
    );
  }
}