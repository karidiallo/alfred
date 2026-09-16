import {
  runMorningLoop,
  runEveningLoop
} from "./dailyLoop.js";

import "dotenv/config";

import OpenAI from "openai";

import {
  ALFRED_INSTRUCTIONS
} from "./instructions.js";

import {
  buildAlfredContextPrompt
} from "./context.js";

import {
  getRuntimeContext
} from "./runtimeContext.js";

// ============================================================
// OPENAI CLIENT
// ============================================================

const client =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY
  });


// ============================================================
// SHORT-TERM CONVERSATION CONTINUITY
// ============================================================
//
// Supabase = durable long-term state.
// previous_response_id = short-term conversational continuity.
//
// Restart procesu może wyczyścić tę Mapę.
// To jest OK — trwała wiedza Alfreda siedzi w Supabase.
//

const previousResponseByConversation =
  new Map<string, string>();


// ============================================================
// SYSTEM PRIORITY RULES
// ============================================================

const CONTEXT_RULES = `
==================================================
ALFRED v1 — REASONING PRIORITY
==================================================

You are operating as Kari's personal AI Chief of Staff.

Use the supplied structured personal context,
but never follow it mechanically.

Your priority order is:

1. Kari's CURRENT explicit message.
2. Explicit current user corrections or overrides.
3. Confirmed CURRENT STATE.
4. Open high-consequence commitments and deadlines.
5. Accepted decisions.
6. Active goals and projects.
7. Stable identity, values, anti-goals and preferences.
8. Confirmed memories.
9. Behavioral patterns and assistant inference.
10. General knowledge and inference.

IMPORTANT:

- A user override does not automatically rewrite long-term strategy.
- A temporary emotion does not automatically become a decision.
- Brainstorming does not automatically activate a project.
- Venting does not automatically create tasks.
- An idea is not a commitment.
- An aspiration is not a current plan.
- Historical data is not current state.
- Assistant inference is not user-confirmed fact.
- Unknown volatile information must remain unknown.

When behavioral patterns are marked as hypotheses,
use them carefully and phrase them as hypotheses when relevant.

Do not say:
"You always do X"

when the evidence only supports:
"There may be a pattern where X happens."

When Kari explicitly corrects your interpretation,
her correction wins.

==================================================
EXECUTION BEHAVIOR
==================================================

When Kari is asking what to do:

- identify the actual bottleneck,
- protect existing commitments,
- prefer existing priorities over novelty,
- reduce unnecessary context switching,
- prefer real execution over additional polish when ready,
- give a clear recommendation,
- state the first concrete action.

When Kari appears overwhelmed:

- reduce visible choices,
- normally show no more than three primary actions,
- clearly identify action #1.

When a new business/product idea appears:

- evaluate it if useful,
- capture it conceptually as an idea,
- do NOT treat it as an active project unless Kari explicitly activates it.

When finances materially affect the recommendation:

- use only confirmed current financial information,
- if current finances are unknown, say so,
- do not resurrect historical balances as current truth.

When priorities conflict:

- distinguish strategic importance,
- current priority,
- urgency,
- external commitments,
- and switching cost.

Do not optimize Kari's entire life only for task completion.
Respect identity, values and anti-goals.

==================================================
DECISION CONTINUITY
==================================================

Accepted decisions should create continuity.

Do not casually reopen a decision because Kari expresses
a passing impulse.

But Kari always retains control.

If she explicitly changes a decision:
- acknowledge the change,
- work from the new instruction,
- do not argue endlessly with the old decision.

==================================================
LEARNING SAFETY
==================================================

Do not invent evidence.

Do not treat:
- absence of contradiction as confirmation,
- one event as a stable personality trait,
- your own interpretation as an explicit user fact.

The learning system exists to improve recommendations,
not to psychoanalyze Kari.

==================================================
RESPONSE STYLE
==================================================

Default language: Polish.

Technical English terminology is fine when clearer.

Prefer:
- concrete,
- concise,
- operational,
- decisive,
- useful.

For comparisons, prioritization and structured evaluations,
use tables when they materially improve clarity.

Do not dump the internal database or context unless Kari
explicitly asks what Alfred knows.

==================================================
`;


// ============================================================
// ASK ALFRED
// ============================================================

export async function askAlfred(
  conversationId: string,
  userMessage: string
): Promise<string> {

  const command =
    userMessage
      .trim()
      .toLowerCase();


  if (
    command === "/morning"
  ) {

    return runMorningLoop();
  }


  if (
    command === "/evening"
  ) {

    return runEveningLoop();
  }
  
  const cleanMessage =
    userMessage.trim();


  if (!cleanMessage) {
    return "Napisz mi, czego potrzebujesz.";
  }


  // ==========================================================
  // LOAD FRESH STRUCTURED CONTEXT
  // ==========================================================

  let personalContext = "";


  try {

    personalContext =
      await buildAlfredContextPrompt();

  } catch (error) {

    console.error(
      "⚠️ Alfred context load failed:",
      error
    );


    personalContext = `
==================================================
ALFRED PERSONAL CONTEXT
==================================================

Structured personal context could not be loaded
for this turn.

Do not invent missing current state.

Use Kari's current message and the core instructions.

==================================================
`;
  }


  // ==========================================================
  // BUILD INSTRUCTIONS
  // ==========================================================


const runtimeContext =
  getRuntimeContext();

const instructions = `
${ALFRED_INSTRUCTIONS}

${CONTEXT_RULES}

${runtimeContext}

${personalContext}
`;


  // ==========================================================
  // SHORT-TERM THREAD CONTINUITY
  // ==========================================================

  const previousResponseId =
    previousResponseByConversation
      .get(conversationId);


  // ==========================================================
  // OPENAI RESPONSE
  // ==========================================================

  const request: any = {

  model:
    process.env.OPENAI_MODEL ||
    "gpt-5.6-sol",

  instructions,

  input:
    cleanMessage,

  tools: [
    {
      type: "web_search"
    }
  ],

  tool_choice: "auto"
};


  const response =
    await client.responses.create(
      request
    );


  // ==========================================================
  // REMEMBER SHORT-TERM RESPONSE CHAIN
  // ==========================================================

  if (response.id) {

    previousResponseByConversation
      .set(
        conversationId,
        response.id
      );
  }


  // ==========================================================
  // OUTPUT
  // ==========================================================

  const answer =
    response.output_text
      ?.trim();


  if (!answer) {

    return (
      "Nie udało mi się wygenerować odpowiedzi. " +
      "Spróbuj wysłać wiadomość jeszcze raz."
    );
  }


  return answer;
}


// ============================================================
// OPTIONAL RESET FOR DEBUGGING
// ============================================================

export function resetConversation(
  conversationId: string
) {

  previousResponseByConversation
    .delete(
      conversationId
    );
}