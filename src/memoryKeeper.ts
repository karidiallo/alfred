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


// ==================================================
// TYPES
// ==================================================

type KeeperMemory = {
  type: string;

  /**
   * Stabilny semantyczny identyfikator.
   *
   * Np.
   * preference_comparison_format
   *
   * NIE:
   * preference_lubie_tabelki
   */
  dedupe_key: string;

  content: string;

  confidence: number;
};


type KeeperState = {
  /**
   * Stabilny current-state key.
   *
   * np.
   * current_priority
   * primary_business
   * current_job_status
   */
  key: string;

  value: unknown;

  confidence: number;
};


type KeeperDecision = {
  /**
   * Jeden temat decyzji powinien
   * zawsze używać tego samego key.
   *
   * np.
   * dashboard_design_today
   */
  dedupe_key: string;

  title: string;

  decision: string;

  rationale?: string;

  review_condition?: string;
};


type KeeperObjective = {
  kind:
    | "goal"
    | "project"
    | "commitment"
    | "task";

  /**
   * Stabilny identyfikator objective.
   *
   * np.
   * project_digitalmap
   * task_test_memory_keeper
   */
  dedupe_key: string;

  title: string;

  description?: string;

  priority?: number;
};


type KeeperResult = {

  memories:
    KeeperMemory[];

  current_state:
    KeeperState[];

  decisions:
    KeeperDecision[];

  objectives:
    KeeperObjective[];
};


// ==================================================
// JSON PARSER
// ==================================================

function extractJson(
  text: string
): KeeperResult {

  const cleaned =
    text
      .replace(
        /```json/gi,
        ""
      )
      .replace(
        /```/g,
        ""
      )
      .trim();


  const parsed =
    JSON.parse(cleaned);


  return {
    memories:
      Array.isArray(
        parsed.memories
      )
        ? parsed.memories
        : [],

    current_state:
      Array.isArray(
        parsed.current_state
      )
        ? parsed.current_state
        : [],

    decisions:
      Array.isArray(
        parsed.decisions
      )
        ? parsed.decisions
        : [],

    objectives:
      Array.isArray(
        parsed.objectives
      )
        ? parsed.objectives
        : []
  };
}


// ==================================================
// MEMORY KEEPER
// ==================================================

export async function runMemoryKeeper(
  userMessage: string
) {

  if (
    !userMessage.trim()
  ) {
    return;
  }


  const response =
    await client.responses.create({

      model:
        process.env
          .MEMORY_KEEPER_MODEL ||
        "gpt-5.6-luna",


      instructions: `
You are Alfred's Memory Keeper.

You NEVER speak to Kari.

Your only job is to analyze one user message
and decide whether it should change Alfred's
long-term model of Kari's life.

You are a conservative information architect.

Do not maximize how much you save.

Maximize:
- correctness
- continuity
- deduplication
- usefulness
- temporal accuracy


========================================
THE FOUR STORAGE TYPES
========================================


1. MEMORY

Relatively stable or semi-stable information.

Examples:

- preferences
- working style
- personal background
- stable interests
- recurring patterns
- communication preferences
- long-lived facts


Example:

"Kiedy porównujesz opcje, wolę tabelki."

→

{
  "type": "preference",
  "dedupe_key": "preference_comparison_format",
  "content": "Kari prefers comparisons presented in tables.",
  "confidence": 1
}


----------------------------------------


2. CURRENT STATE

What is believed to be true NOW
and could later change.

Examples:

- current priority
- current project phase
- current work situation
- current financial situation
- active focus
- current location
- current status of something


Example:

"Teraz moim priorytetem jest outreach."

→

{
  "key": "current_priority",
  "value": "outreach",
  "confidence": 1
}


----------------------------------------


3. DECISION

An explicit choice Kari has made.

Not:
- an idea
- a possibility
- an emotion
- a question
- something she is merely considering


Example:

"Nie ruszam designu przed pierwszym outreach."

→

{
  "dedupe_key": "digitalmap_design_before_outreach",
  "title": "DigitalMap design before outreach",
  "decision": "Do not redesign DigitalMap before completing initial outreach.",
  "rationale": "Execution and validation take priority over polishing."
}


----------------------------------------


4. OBJECTIVE

Something Kari has actually adopted as:

- goal
- project
- commitment
- task


Example:

"Dzisiaj muszę wysłać 10 wiadomości."

→

{
  "kind": "task",
  "dedupe_key": "task_send_10_outreach_messages",
  "title": "Send 10 outreach messages",
  "description": "Complete today.",
  "priority": 1
}


========================================
CRITICAL DEDUPLICATION RULE
========================================

dedupe_key represents the LOGICAL SUBJECT,
not the wording of the sentence.

Two statements about the same underlying fact,
decision or objective MUST use the same dedupe_key.

Example:

"Kiedy coś porównujesz, dawaj tabelkę."

and

"Wolę comparisony w tabelach."

must BOTH produce:

preference_comparison_format


Another example:

"DigitalMap jest teraz moim głównym biznesem."

and later:

"Moim głównym biznesem jest nadal DigitalMap."

should both use:

primary_business


Another example:

"Nie zmieniam dziś designu dashboardu."

and later:

"Jednak dzisiaj redesign dashboardu jest OK."

should both use:

dashboard_design_today

The VALUE / DECISION changes.

The dedupe_key does NOT.


========================================
KEY NAMING
========================================

Keys must:

- be lowercase
- use snake_case
- contain only useful semantic concepts
- stay stable when wording changes
- avoid dates unless the date is fundamental
- avoid copying whole sentences
- avoid random identifiers


GOOD:

preference_comparison_format
current_priority
primary_business
digitalmap_current_phase
dashboard_design_today
project_digitalmap
career_job_search
fitness_training_frequency


BAD:

kari_likes_tables_very_much
today_kari_said_she_likes_tables
memory_123
new_memory
thing_about_dashboard


========================================
UPDATE LOGIC
========================================

You do NOT decide whether something already exists.

Your job is to produce the SAME semantic key
for the same logical subject.

The database will then:

same key
→ UPDATE

new key
→ CREATE

The database keeps history separately.


========================================
TEMPORAL RULES
========================================

Always distinguish:

HISTORICAL
vs
CURRENT

Example:

"Miesiąc temu miałam 500 zł."

DO NOT save:

current_balance = 500

That is historical information.


Example:

"Teraz mam 500 zł."

May become current_state.


Never silently convert an old value
into current state.


========================================
IDEAS ARE NOT PROJECTS
========================================

Kari generates many ideas.

Example:

"Może zrobię aplikację dla galerii."

This is NOT automatically:

project

goal

commitment

task

or decision.

Usually store nothing unless the message contains
stable information worth remembering.


========================================
ASPIRATION IS NOT COMMITMENT
========================================

"I'd love to live in Paris someday"

is not necessarily an objective.

"I decided I'm moving to Paris in June"

may contain both:

decision
+
objective


========================================
EMOTION IS NOT DECISION
========================================

"I'm frustrated with DigitalMap"

does not mean:

close DigitalMap

pivot DigitalMap

stop DigitalMap


========================================
NOISE FILTER
========================================

Do NOT store:

- greetings
- jokes
- casual commentary
- rhetorical questions
- temporary wording
- assistant instructions
- speculation
- random brainstorms
- information already implied only by inference
- trivial details with no likely future value


========================================
CONFIDENCE
========================================

Use:

1.0
for explicit clear statements.

0.8-0.95
for highly reliable interpretation.

Below 0.75:
prefer NOT storing it.


========================================
SENSITIVE INFERENCE
========================================

Never infer sensitive personal attributes.

Only store information explicitly provided
when appropriate for Alfred's function.


========================================
OUTPUT
========================================

Return ONLY valid JSON.

Never markdown.

Never explanations.

Never text before or after JSON.

Always use this exact shape:

{
  "memories": [
    {
      "type": "preference",
      "dedupe_key": "preference_comparison_format",
      "content": "Kari prefers comparisons presented in tables.",
      "confidence": 1
    }
  ],

  "current_state": [
    {
      "key": "current_priority",
      "value": "outreach",
      "confidence": 1
    }
  ],

  "decisions": [
    {
      "dedupe_key": "dashboard_design_today",
      "title": "Dashboard design today",
      "decision": "Do not redesign the dashboard today.",
      "rationale": "Current priority is testing Alfred.",
      "review_condition": "Reconsider after the Alfred test is completed."
    }
  ],

  "objectives": [
    {
      "kind": "task",
      "dedupe_key": "task_test_alfred_memory",
      "title": "Test Alfred memory",
      "description": "Complete the memory test.",
      "priority": 1
    }
  ]
}

If nothing deserves storage:

{
  "memories": [],
  "current_state": [],
  "decisions": [],
  "objectives": []
}
`,


      input:
        userMessage
    });


  const raw =
    response
      .output_text
      ?.trim();


  if (!raw) {
    return;
  }


  let result:
    KeeperResult;


  try {

    result =
      extractJson(raw);

  } catch (error) {

    console.error(
      "🧠 Memory Keeper returned invalid JSON:"
    );

    console.error(raw);

    return;
  }


  // ==================================================
  // MEMORIES
  // ==================================================

  for (
    const memory of
    result.memories
  ) {

    if (
      !memory.dedupe_key ||
      !memory.content
    ) {
      continue;
    }


    await saveMemory({

      type:
        memory.type ||
        "general",

      dedupe_key:
        memory.dedupe_key,

      content:
        memory.content,

      source:
        "memory_keeper",

      confidence:
        memory.confidence ??
        0.8,

      metadata: {
        captured_by:
          "memory_keeper_v0.2"
      }
    });


    console.log(
      `🧠 Memory upsert: ${memory.dedupe_key}`
    );
  }


  // ==================================================
  // CURRENT STATE
  // ==================================================

  for (
    const state of
    result.current_state
  ) {

    if (!state.key) {
      continue;
    }


    await setCurrentState(

      state.key,

      state.value,

      "memory_keeper",

      state.confidence ??
      0.8
    );


    console.log(
      `🌍 State upsert: ${state.key}`
    );
  }


  // ==================================================
  // DECISIONS
  // ==================================================

  for (
    const decision of
    result.decisions
  ) {

    if (
      !decision.dedupe_key ||
      !decision.decision
    ) {
      continue;
    }


    await saveDecision({

      dedupe_key:
        decision.dedupe_key,

      title:
        decision.title,

      decision:
        decision.decision,

      rationale:
        decision.rationale,

      review_condition:
        decision.review_condition
    });


    console.log(
      `⚖️ Decision upsert: ${decision.dedupe_key}`
    );
  }


  // ==================================================
  // OBJECTIVES
  // ==================================================

  for (
    const objective of
    result.objectives
  ) {

    if (
      !objective.dedupe_key ||
      !objective.title
    ) {
      continue;
    }


    await saveObjective({

      kind:
        objective.kind,

      dedupe_key:
        objective.dedupe_key,

      title:
        objective.title,

      description:
        objective.description,

      priority:
        objective.priority ??
        3
    });


    console.log(
      `🎯 Objective upsert: ${objective.dedupe_key}`
    );
  }
}