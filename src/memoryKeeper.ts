import { MEMORY_CLASSIFICATION_POLICY } from "./memoryPolicy.js";

import {
  saveTaskSafely,
  saveCommitmentSafely,
  saveIdeaSafely,
  saveDecisionSafely
} from "./safeEntityWrites.js";

import {
  mergeCurrentState
} from "./stateMutations.js";

import "dotenv/config";

import OpenAI from "openai";

import {
  saveMemory,
  saveProfileItem,

  saveDecision,

  saveTask,
  saveCommitment,
  saveIdea,

  saveProject,
  saveGoal,
  saveOutcome,

  getProjects,
  getGoals,
  getOpenTasks,
  getOpenCommitments,
  getActiveDecisions,

  type ProfileCategory,
  type ProjectInput,
  type GoalInput
} from "./supabase.js";


// ============================================================
// OPENAI CLIENT
// ============================================================

const client =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY
  });


// ============================================================
// TYPES
// ============================================================

type KeeperMemory = {
  type: string;
  dedupe_key: string;
  content: string;

  confidence: number;
  importance?: number;

  stability?:
    | "permanent"
    | "long_term"
    | "medium_term"
    | "temporary"
    | "volatile";
};


type KeeperProfileItem = {
  id: string;

  category:
    ProfileCategory;

  label?: string;

  content: string;

  confidence: number;

  importance?: number;

  stability?:
    | "permanent"
    | "long_term"
    | "medium_term"
    | "temporary"
    | "volatile";

  requires_future_confirmation?: boolean;
};


type KeeperState = {
  key: string;

  value: unknown;

  confidence: number;

  importance?: number;

  stability?:
    | "volatile"
    | "temporary"
    | "medium_term";
};


type KeeperDecision = {
  dedupe_key: string;

  title: string;

  decision: string;

  rationale?: string;

  expected_outcome?: string;

  review_condition?: string;

  confidence?: number;
};


type KeeperTask = {
  dedupe_key: string;

  status?:
    | "open"
    | "in_progress"
    | "blocked"
    | "deferred"
    | "done"
    | "cancelled";

  project_id?: string | null;

  goal_id?: string | null;

  title: string;

  description?: string;

  priority?: number;

  due_at?: string | null;

  next_action?: string | null;

  confidence?: number;
};

type KeeperOutcome = {
  entity_type?:
    | "task"
    | "commitment"
    | "project"
    | "decision"
    | "experiment"
    | null;

  entity_id?: string | null;

  project_id?: string | null;

  title?: string | null;

  expected?: string | null;

  actual: string;

  lesson?: string | null;

  occurred_at?: string | null;
};

type KeeperCommitment = {
  dedupe_key: string;

  type:
    | "promise"
    | "deadline"
    | "payment"
    | "appointment"
    | "follow_up"
    | "delivery"
    | "administrative";

  title: string;

  status?:
    | "open"
    | "completed"
    | "cancelled";

  counterparty?: string | null;

  due_at?: string | null;

  reliability?: number;

  consequence_level?:
    | "low"
    | "medium"
    | "high"
    | "critical"
    | null;

  consequence_if_missed?: string | null;

  next_action?: string | null;
};


type KeeperIdea = {
  dedupe_key: string;

  title: string;

  description?: string;

  estimated_upside?: string;

  switching_cost?: string;
};


type KeeperProjectUpdate = {
  project_id: string;

  status?:
    | "idea"
    | "candidate"
    | "active"
    | "maintenance"
    | "blocked"
    | "paused"
    | "completed"
    | "abandoned"
    | "archived";

  stage?: string | null;

  current_priority?: number | null;

  urgency?: number | null;

  current_bottleneck?: string | null;

  next_action?: string | null;

  blocked_by?: unknown;

  last_progress_at?: string | null;

  confidence?: number;
};


type KeeperGoalUpdate = {
  goal_id: string;

  status?: string;

  current_priority?: number | null;

  urgency?: number | null;
};


type KeeperResult = {

  interaction_mode:
    | "conversation"
    | "venting"
    | "brainstorm"
    | "decision"
    | "planning"
    | "execution"
    | "review"
    | "learning";


  profile_items:
    KeeperProfileItem[];


  memories:
    KeeperMemory[];


  current_state:
    KeeperState[];


  decisions:
    KeeperDecision[];


  tasks:
    KeeperTask[];


  commitments:
    KeeperCommitment[];


  ideas:
    KeeperIdea[];


  project_updates:
    KeeperProjectUpdate[];


  goal_updates:
    KeeperGoalUpdate[];
  
  outcomes:
    KeeperOutcome[];
};


// ============================================================
// JSON
// ============================================================

function parseKeeperJson(
  raw: string
): KeeperResult {

  const cleaned =
    raw
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


  const allowedCommitmentTypes = [
    "promise",
    "deadline",
    "payment",
    "appointment",
    "follow_up",
    "delivery",
    "administrative"
  ];


  function inferCommitmentType(
    item: any
  ) {

    if (
      allowedCommitmentTypes.includes(
        item.type
      )
    ) {
      return item.type;
    }


    const text =
      `${item.title ?? ""} ${item.description ?? ""}`
        .toLowerCase();


    if (
      /zapła|opła|payment|invoice|rachunek|faktur/.test(
        text
      )
    ) {
      return "payment";
    }


    if (
      /spotkanie|wizyta|appointment|meeting/.test(
        text
      )
    ) {
      return "appointment";
    }


    if (
      /follow.?up|odpisa|odpowiedz|reply/.test(
        text
      )
    ) {
      return "follow_up";
    }


    if (
      /wyślij|wysłać|wyslac|send|dostarczy|deliver|report/.test(
        text
      )
    ) {
      return "delivery";
    }


    if (
      /deadline|termin/.test(
        text
      )
    ) {
      return "deadline";
    }


    if (
      /obieca|promise/.test(
        text
      )
    ) {
      return "promise";
    }


    return "administrative";
  }


  const commitments =
    Array.isArray(
      parsed.commitments
    )
      ? parsed.commitments.map(
          (item: any) => ({

            dedupe_key:
              item.dedupe_key ??
              item.key,

            type:
              inferCommitmentType(
                item
              ),

            title:
              item.title ??
              item.description,

            counterparty:
              item.counterparty ??
              null,

            due_at:
              item.due_at ??
              null,

            reliability:
              item.reliability ??
              item.confidence ??
              1,

            consequence_level:
              item.consequence_level ??
              null,

            consequence_if_missed:
              item.consequence_if_missed ??
              null,

            next_action:
              item.next_action ??
              null,
            
            status:
              item.status,

          })
        )
      : [];


  const ideas =
    Array.isArray(
      parsed.ideas
    )
      ? parsed.ideas.map(
          (item: any) => ({

            dedupe_key:
              item.dedupe_key ??
              item.key,

            title:
              item.title,

            description:
              item.description,

            estimated_upside:
              item.estimated_upside,

            switching_cost:
              item.switching_cost

          })
        )
      : [];


  return {

    interaction_mode:
      parsed.interaction_mode ??
      "conversation",

    profile_items:
      Array.isArray(
        parsed.profile_items
      )
        ? parsed.profile_items
        : [],

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

    tasks:
      Array.isArray(
        parsed.tasks
      )
        ? parsed.tasks.map(
            (item: any) => ({

              dedupe_key:
                item.dedupe_key ??
                item.key,

              project_id:
                item.project_id ??
                null,

              goal_id:
                item.goal_id ??
                null,

              title:
                item.title ??
                item.description,

              description:
                item.description,

              status:
                item.status,

              priority:
                item.priority,

              due_at:
                item.due_at ??
                null,

              next_action:
                item.next_action ??
                null,

              confidence:
                item.confidence ??
                1

        })
      )
    : [],

    commitments,

    ideas,

    outcomes:
      Array.isArray(
        parsed.outcomes
      )
        ? parsed.outcomes
        : [],

    project_updates:
      Array.isArray(
        parsed.project_updates
      )
        ? parsed.project_updates
        : [],

    goal_updates:
      Array.isArray(
        parsed.goal_updates
      )
        ? parsed.goal_updates
        : []
  };
}



// ============================================================
// MAIN MEMORY KEEPER
// ============================================================

export async function runMemoryKeeper(
  userMessage: string
): Promise<boolean> {

  const message =
    userMessage.trim();


  if (!message) {
    return false;
  }


  // ==========================================================
  // EXISTING PROJECT / GOAL IDS
  // ==========================================================

  const [
    existingProjects,
    existingGoals,
    existingTasks,
    existingCommitments,
    existingDecisions
  ] =
    await Promise.all([
      getProjects(),
      getGoals(),
      getOpenTasks(),
      getOpenCommitments(),
      getActiveDecisions()
    ]);


  const projectContext =
    existingProjects.map(
      project => ({
        id:
          project.id,

        title:
          project.title,

        status:
          project.status,

        stage:
          project.stage,

        current_priority:
          project.current_priority,

        current_bottleneck:
          project.current_bottleneck,

        next_action:
          project.next_action
      })
    );


  const goalContext =
    existingGoals.map(
      goal => ({
        id:
          goal.id,

        title:
          goal.title,

        status:
          goal.status,

        current_priority:
          goal.current_priority
      })
    );

  const taskContext =
    existingTasks.map(
     task => ({
        dedupe_key:
          task.dedupe_key,

        title:
          task.title,

        project_id:
          task.project_id,

        goal_id:
          task.goal_id,

        status:
          task.status,

        due_at:
          task.due_at,

        next_action:
          task.next_action,

        priority:
          task.priority
      })
    );

  const commitmentContext =
    existingCommitments.map(
      commitment => ({
        dedupe_key:
          commitment.dedupe_key,

        type:
          commitment.type,

        title:
          commitment.title,

        counterparty:
          commitment.counterparty,

        due_at:
          commitment.due_at,

        status:
          commitment.status,

        next_action:
          commitment.next_action
      })
    );

        const decisionContext =
  existingDecisions.map(
    decision => ({
      dedupe_key:
        decision.dedupe_key,

      title:
        decision.title,

      decision:
        decision.decision,

      hypothesis:
        decision.hypothesis,

      expected_outcome:
        decision.expected_outcome,

      review_condition:
        decision.review_condition,

      lifecycle_status:
        decision.lifecycle_status
    })
  );
  // ==========================================================
  // CLASSIFICATION
  // ==========================================================

  const response =
    await client.responses.create({

      model:
        process.env
          .MEMORY_KEEPER_MODEL ||
        "gpt-5.6-luna",


      instructions: `
You are Alfred Memory Keeper v1.

${MEMORY_CLASSIFICATION_POLICY}

You NEVER speak to Kari.

You analyze ONE user message and decide what,
if anything, should update Alfred's structured
personal operating model.

Your job is NOT to save as much as possible.

Your job is to preserve:
- truth
- continuity
- temporal accuracy
- correct entity classification
- user control
- low noise


==================================================
STEP 1 — CLASSIFY INTERACTION MODE
==================================================

Choose exactly one:

conversation
venting
brainstorm
decision
planning
execution
review
learning


IMPORTANT MODE RULES

VENTING:
- do not automatically create tasks
- do not change priorities
- do not create behavioral patterns
- do not interpret frustration as strategy

BRAINSTORM:
- may create IDEAS
- must NOT activate projects
- must NOT change priorities automatically

DECISION:
- explicit accepted choices may become decisions
- major project changes require explicit user intent

PLANNING:
- may create tasks / commitments
- may update explicit next actions

EXECUTION:
- may update progress / project next action
- avoid inventing new strategy

REVIEW:
- may record explicit outcomes or state changes
- do not infer success/failure without evidence


==================================================
PROFILE ITEMS
==================================================

Use profile_items only for relatively stable information.

Allowed categories:

identity
value
anti_goal
preference
working_style

Examples:

"I prefer tables for comparisons."
→ preference

"Music is a major part of who I am."
→ identity

"I value autonomy."
→ value


DO NOT create working-style or personality conclusions
from one temporary event.

Assistant inference must never silently become user fact.

If something is an inference rather than explicit,
prefer NOT storing it here.


==================================================
MEMORIES
==================================================

Use memories for useful historical / contextual facts
that may matter later but are not current state.

Examples:

"DigitalMap originally started as..."
"I used to work with..."
"This approach failed last month..."

Do not duplicate profile items into memories unnecessarily.

==================================================
EXPLICIT EXTRACTION RULE
==================================================

When the user explicitly states information that clearly
matches one of the storage categories, do not omit it merely
because the message also contains testing language, meta
commentary or several different facts.

Process each explicit claim independently.

Examples:

"Moim aktualnym priorytetem jest TEST KEEPER V1."
MUST produce current_state:

{
  "key": "current_priority",
  "value": "TEST KEEPER V1",
  "confidence": 1,
  "importance": 0.9,
  "stability": "temporary"
}

"16 września 2026 o 12:00 muszę wysłać raport do klienta."
MUST produce a commitment, even if the same message also
contains brainstorming, testing language or another idea.

A mixed message may legitimately produce several different
entity types at the same time.

Do not force the entire message into only one category.

==================================================
CURRENT STATE
==================================================

Current state = what is true NOW.

Examples:

"My current priority is X."
"I have 300 PLN available right now."
"I am waiting for client feedback."
"I have low energy today."

Never convert historical information to current state.

"Miesiąc temu miałam 300 zł"
IS NOT
current money = 300.

Volatile state should use stability = volatile.

Examples of volatile data:
- money
- energy
- availability
- location
- urgent deadlines
- current capacity


==================================================
DECISIONS
==================================================

Create a decision ONLY when Kari clearly accepts
or states a choice.

Examples:

"I decided I won't redesign before outreach."
"Okay, let's pause project X."

Do NOT create decisions from:
- questions
- possibilities
- brainstorm
- emotional reactions
- "maybe"


==================================================
TASKS
==================================================

Task = an actionable item Kari intends to do.

Examples:

"Tomorrow I need to send 5 applications."
"I have to call the dentist."

Do NOT automatically convert every problem into a task.

During venting:
tasks should usually remain empty unless Kari clearly
states an actual obligation or intended action.

==================================================
TASK LIFECYCLE
==================================================

A task may have status:

open
in_progress
blocked
deferred
done
cancelled

Use "deferred" when Kari explicitly says an existing task
is "na później", "później", "nie teraz", "wrócimy do tego"
or otherwise clearly postpones it without cancelling it.

"Deferred" means the task is preserved but is NOT active now.

When referring to an existing task, reuse its exact dedupe_key.

Use "done" only when Kari explicitly says
the task has been finished.

Examples:

"Wysłałam już te CV."
→ existing task status = "done"

"Skończyłam audyt."
→ existing task status = "done"

"Nie robię już tego zadania."
→ existing task status = "cancelled"

When referring to an existing task, reuse its exact
dedupe_key from CURRENT KNOWN OPEN TASKS.

Do not create a second task for the same action.

Do not set status = "open" merely because an existing
task is mentioned again.

==================================================
COMMITMENTS
==================================================

Commitment is stronger than a normal task.

Examples:
- promise to someone
- payment obligation
- appointment
- delivery deadline
- follow-up owed
- administrative obligation

Explicit obligation language such as:

- "muszę"
- "mam termin"
- "obiecałam"
- "mam zapłacić"
- "mam spotkanie"
- "muszę wysłać"
- "mam dostarczyć"

should strongly favor creating a commitment when there is
a real obligation, deadline, counterparty or consequence.

If the obligation is explicit but one optional field is
unknown, still create the commitment and leave that field null.
Do not discard the entire commitment because one detail is missing.

Use commitment only when there is a real obligation,
counterparty, deadline or consequence.

reliability means:
confidence that the obligation/deadline was understood correctly.

consequence_level means:
impact if it is missed.


==================================================
IDEAS
==================================================

New business/product/project ideas go to ideas.

IMPORTANT:

idea != project

Never activate a new project automatically.

Example:

"Maybe an app for farmers..."
→ IDEA

not project.

==================================================
OUTCOMES
==================================================

Outcome = a concrete observed result of an action,
decision, experiment, project or commitment.

An outcome is NOT merely task completion.

Examples:

"Wysłałam 10 CV i dostałam 2 odpowiedzi."
→ outcome:
  actual = "Sent 10 CVs and received 2 responses"

"Zmieniliśmy landing page i konwersja wzrosła z 2% do 3%."
→ outcome

"Zadzwoniłam do klienta."
→ NOT automatically an outcome.
This may only mean a task was completed.

"Skończyłam audyt."
→ task status = done
→ NOT an outcome unless Kari also states what resulted from it.


Create an outcome when the message contains a concrete
result, consequence, measured effect or observed response.

Possible entity_type values:

task
commitment
project
decision
experiment

If the result clearly relates to an existing task or commitment,
reuse its exact dedupe_key as entity_id.

If it clearly relates to a known project,
use the existing project ID.

Do not invent expected results.

Only fill "expected" if the expectation was explicitly known
from context or explicitly stated by Kari.

"lesson" should only be filled when Kari explicitly states
a lesson/conclusion or when the conclusion is extremely direct.

Do not manufacture strategic lessons from one result.

Example:

"Zrobiłam 20 cold maili, 3 osoby odpisały."
→ outcome actual = "20 cold emails sent; 3 replies received"

NOT:
→ lesson = "Cold email is the best acquisition channel"

One observation is evidence, not universal proof.

==================================================
PROJECT UPDATES
==================================================

You may update an EXISTING project only if the user's
message clearly changes its state.

You MUST use an existing project_id from the supplied list.

Never invent a new project ID here.

Examples:

"I finished the Alfred bootstrap."
→ may update Alfred project progress / next action

"I am pausing DigitalMap."
→ status = paused

"DigitalMap is blocked by X."
→ status = blocked
   current_bottleneck = X


Do NOT modify project priority just because Kari mentions
another interesting idea.


==================================================
GOAL UPDATES
==================================================

Use only explicit goal changes.

You MUST use an existing goal_id.

Do not infer changed life priorities from casual conversation.


==================================================
DEDUPE KEYS
==================================================

Keys describe the logical subject,
not wording.

Good:

preference_comparison_format
current_priority
task_send_job_applications
commitment_box_payment
idea_art_marketplace

Bad:

memory_123
kari_said_something_today
new_task


Same subject should produce the same key over time.


==================================================
SOURCE QUALITY
==================================================

This message is an explicit user message.

But interpretation of the message may still be uncertain.

Use confidence:

1.0
= explicit and unambiguous

0.8-0.95
= strong interpretation

below 0.75
= usually do not store


==================================================
NO BEHAVIORAL PATTERN CREATION
==================================================

Do NOT create behavioral patterns from this message.

Patterns require repeated evidence and are handled
by a separate learning process.


==================================================
CURRENT KNOWN PROJECTS
==================================================

${JSON.stringify(
  projectContext,
  null,
  2
)}


==================================================
CURRENT KNOWN GOALS
==================================================

${JSON.stringify(
  goalContext,
  null,
  2
)}

==================================================
CURRENT KNOWN OPEN TASKS
==================================================

${JSON.stringify(
  taskContext,
  null,
  2
)}

When the user's message refers to one of these existing tasks,
reuse its exact dedupe_key.

Do not create a new task for the same action.

If Kari explicitly says the task was finished,
reuse the existing dedupe_key and set:

"status": "completed"

If she explicitly abandons or cancels it:

"status": "cancelled"

==================================================
CURRENT KNOWN OPEN COMMITMENTS
==================================================

${JSON.stringify(
  commitmentContext,
  null,
  2
)}

When the user's message refers to one of these existing
commitments, reuse its exact dedupe_key.

Do not create a new semantic key for the same obligation.

If Kari says an existing obligation was fulfilled,
return that existing dedupe_key with:

"status": "completed"

If it was cancelled:

"status": "cancelled"

==================================================
CURRENT KNOWN ACTIVE DECISIONS
==================================================

${JSON.stringify(
  decisionContext,
  null,
  2
)}

When an outcome clearly evaluates or results from one of these
existing decisions, use:

"entity_type": "decision"

and reuse the decision's exact dedupe_key as:

"entity_id"

Do not invent a new decision key.

Do not link an outcome to a decision merely because the topics
are loosely related.

Only link when the relationship is reasonably clear.

If the outcome directly tests an expected_outcome from a known
decision, prefer linking it to that decision.

==================================================
OUTPUT FORMAT
==================================================

Return ONLY JSON.

No markdown.
No explanation.

Exact shape:

{
  "interaction_mode": "conversation",

  "profile_items": [],

  "memories": [],

  "current_state": [],

  "decisions": [],

  "tasks": [],

  "commitments": [],

  "ideas": [],

  "outcomes": [],

  "project_updates": [],

  "goal_updates": []
}

If nothing should be stored,
return empty arrays.

Prefer storing nothing over storing noise.
`,


      input:
        message
    });


  const raw =
    response.output_text
      ?.trim();


  if (!raw) {
    return false;
  }

  let result:
    KeeperResult;


  try {

    result =
      parseKeeperJson(
        raw
      );

  } catch (error) {

    console.error(
      "🧠 Keeper v1 invalid JSON:"
    );

    console.error(raw);

    return false;
  }

  const hasPersistableChanges =
    result.profile_items.length > 0 ||
    result.memories.length > 0 ||
    result.current_state.length > 0 ||
    result.decisions.length > 0 ||
    result.tasks.length > 0 ||
    result.commitments.length > 0 ||
    result.ideas.length > 0 ||
    result.outcomes.length > 0 ||
    result.project_updates.length > 0 ||
    result.goal_updates.length > 0;

  console.log(
    `🎛️ Interaction mode: ${result.interaction_mode}`
  );


  // ==========================================================
  // PROFILE
  // ==========================================================

  for (
    const item of
    result.profile_items
  ) {

    if (
      !item.id ||
      !item.content
    ) {
      continue;
    }


    await saveProfileItem({

      id:
        item.id,

      category:
        item.category,

      label:
        item.label,

      content:
        item.content,

      source_type:
        "user_explicit",

      confidence:
        item.confidence ??
        1,

      importance:
        item.importance ??
        0.7,

      stability:
        item.stability ??
        "long_term",

      status:
        "active",

      evidence_count:
        1,

      requires_future_confirmation:
        item.requires_future_confirmation ??
        false,

      last_confirmed_at:
        new Date()
          .toISOString()

    });


    console.log(
      `🪪 Profile upsert: ${item.id}`
    );
  }


  // ==========================================================
  // MEMORY
  // ==========================================================

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
        "memory_keeper_v1",

      source_type:
        "user_explicit",

      confidence:
        memory.confidence ??
        0.9,

      importance:
        memory.importance ??
        0.5,

      stability:
        memory.stability ??
        "medium_term",

      evidence_count:
        1,

      last_confirmed_at:
        new Date()
          .toISOString(),

      metadata: {
        captured_by:
          "memory_keeper_v1"
      }

    });


    console.log(
      `🧠 Memory upsert: ${memory.dedupe_key}`
    );
  }


  // ==========================================================
  // CURRENT STATE
  // ==========================================================

  for (
    const state of
    result.current_state
  ) {

    if (!state.key) {
      continue;
    }


    await mergeCurrentState(

      state.key,

      state.value,

      "memory_keeper_v1",

      state.confidence ??
      0.9,

      {
        stability:
          state.stability ??
          "volatile",

        importance:
          state.importance ??
          0.7,

        confirmed_at:
          new Date()
            .toISOString(),

        metadata: {
          captured_by:
            "memory_keeper_v1"
        }
      }
    );


    console.log(
      `🌍 State upsert: ${state.key}`
    );
  }


  // ==========================================================
  // DECISIONS
  // ==========================================================

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


    await saveDecisionSafely({

      dedupe_key:
        decision.dedupe_key,

      title:
        decision.title,

      decision:
        decision.decision,

      rationale:
        decision.rationale,

      expected_outcome:
        decision.expected_outcome,

      review_condition:
        decision.review_condition,

      source_type:
        "user_explicit",

      confidence:
        decision.confidence ??
        1,

      lifecycle_status:
        "accepted"

    });


    console.log(
      `⚖️ Decision upsert: ${decision.dedupe_key}`
    );
  }


  // ==========================================================
  // TASKS
  // ==========================================================

  for (
    const task of
    result.tasks
  ) {

    if (
      !task.dedupe_key ||
      !task.title
    ) {
      continue;
    }


    await saveTaskSafely({

      dedupe_key:
        task.dedupe_key,

      project_id:
        task.project_id ??
        null,

      goal_id:
        task.goal_id ??
        null,

      title:
        task.title,

      description:
        task.description,

      priority:
        task.priority,

      due_at:
        task.due_at ??
        null,

      next_action:
        task.next_action ??
        null,

      source_type:
        "user_explicit",

      confidence:
        task.confidence ??
        1,

      status:
        task.status,

      metadata: {
        captured_by:
          "memory_keeper_v1"
      }

    });


    console.log(
      `✅ Task upsert: ${task.dedupe_key}`
    );
  }


  // ==========================================================
  // COMMITMENTS
  // ==========================================================

  for (
    const commitment of
    result.commitments
  ) {

    if (
      !commitment.dedupe_key ||
      !commitment.title
    ) {
      continue;
    }

    await saveCommitmentSafely({

      dedupe_key:
        commitment.dedupe_key,

      type:
        commitment.type,

      title:
        commitment.title,

      source_type:
        "user_explicit",

      counterparty:
        commitment.counterparty ??
        null,

      due_at:
        commitment.due_at ??
        null,

      reliability:
        commitment.reliability,

      consequence_level:
        commitment.consequence_level ??
        null,

      consequence_if_missed:
        commitment.consequence_if_missed ??
        null,

      next_action:
        commitment.next_action ??
        null,

      status:
        commitment.status,

      metadata: {
        captured_by:
          "memory_keeper_v1"
      }

    });


    console.log(
      `🤝 Commitment upsert: ${commitment.dedupe_key}`
    );
  }


  // ==========================================================
  // IDEAS
  // ==========================================================

  for (
    const idea of
    result.ideas
  ) {

    if (
      !idea.dedupe_key ||
      !idea.title
    ) {
      continue;
    }


    await saveIdeaSafely({

      dedupe_key:
        idea.dedupe_key,

      title:
        idea.title,

      description:
        idea.description,

      source_type:
        "user_explicit",

      estimated_upside:
        idea.estimated_upside,

      switching_cost:
        idea.switching_cost,

      metadata: {
        captured_by:
          "memory_keeper_v1"
      }

    });


    console.log(
      `💡 Idea upsert: ${idea.dedupe_key}`
    );
  }

  // ==========================================================
  // OUTCOMES
  // ==========================================================

  for (
    const outcome of
    result.outcomes
  ) {

  if (
    !outcome.actual
  ) {
    continue;
  }


  await saveOutcome({

    entity_type:
      outcome.entity_type ??
      null,

    entity_id:
      outcome.entity_id ??
      null,

    project_id:
      outcome.project_id ??
      null,

    title:
      outcome.title ??
      null,

    expected:
      outcome.expected ??
      null,

    actual:
      outcome.actual,

    lesson:
      outcome.lesson ??
      null,

    occurred_at:
      outcome.occurred_at ??
      undefined,

    metadata: {
      captured_by:
        "memory_keeper_v1"
    }

  });

  // If this outcome belongs to a known decision,
// mirror the observed result into that decision.
// Do not infer a lesson and do not mark it reviewed yet.
if (
  outcome.entity_type === "decision" &&
  outcome.entity_id
) {

  const matchingDecision =
    existingDecisions.find(
      decision =>
        decision.dedupe_key ===
        outcome.entity_id
    );


  if (matchingDecision) {

    await saveDecisionSafely({

      dedupe_key:
        outcome.entity_id,

      actual_outcome:
        outcome.actual,

      source_type:
        "memory_keeper_v1"

    });


    console.log(
      `🔗 Decision outcome linked: ${outcome.entity_id}`
    );
  }
}

  console.log(
    `📈 Outcome saved: ${outcome.title ?? outcome.actual}`
  );
  }

  // ==========================================================
  // PROJECT UPDATES
  // ==========================================================

  for (
    const update of
    result.project_updates
  ) {

    if (
      !update.project_id
    ) {
      continue;
    }


    const existing =
      existingProjects.find(
        project =>
          project.id ===
          update.project_id
      );


    if (!existing) {

      console.warn(
        `⚠️ Unknown project id ignored: ${update.project_id}`
      );

      continue;
    }


    const merged:
      ProjectInput = {

      id:
        existing.id,

      area_id:
        existing.area_id,

      title:
        existing.title,

      status:
        update.status ??
        existing.status,

      stage:
        update.stage !==
        undefined
          ? update.stage
          : existing.stage,

      major_project:
        existing.major_project,

      description:
        existing.description,

      desired_outcome:
        existing.desired_outcome,

      definition_of_done:
        existing.definition_of_done,

      success_metrics:
        existing.success_metrics,

      strategic_priority:
        existing.strategic_priority,

      current_priority:
        update.current_priority !==
        undefined
          ? update.current_priority
          : existing.current_priority,

      urgency:
        update.urgency !==
        undefined
          ? update.urgency
          : existing.urgency,

      current_bottleneck:
        update.current_bottleneck !==
        undefined
          ? update.current_bottleneck
          : existing.current_bottleneck,

      next_action:
        update.next_action !==
        undefined
          ? update.next_action
          : existing.next_action,

      next_action_policy:
        existing.next_action_policy,

      blocked_by:
        update.blocked_by !==
        undefined
          ? update.blocked_by
          : existing.blocked_by,

      last_progress_at:
        update.last_progress_at ??
        existing.last_progress_at,

      review_at:
        existing.review_at,

      source_type:
        "user_explicit",

      confidence:
        update.confidence ??
        1,

      metadata:
        existing.metadata ??
        {}
    };


    await saveProject(
      merged
    );


    console.log(
      `🚀 Project updated: ${update.project_id}`
    );
  }


  // ==========================================================
  // GOAL UPDATES
  // ==========================================================

  for (
    const update of
    result.goal_updates
  ) {

    if (
      !update.goal_id
    ) {
      continue;
    }


    const existing =
      existingGoals.find(
        goal =>
          goal.id ===
          update.goal_id
      );


    if (!existing) {

      console.warn(
        `⚠️ Unknown goal id ignored: ${update.goal_id}`
      );

      continue;
    }


    const merged:
      GoalInput = {

      id:
        existing.id,

      area_id:
        existing.area_id,

      title:
        existing.title,

      description:
        existing.description,

      strategic_priority:
        existing.strategic_priority,

      current_priority:
        update.current_priority !==
        undefined
          ? update.current_priority
          : existing.current_priority,

      urgency:
        update.urgency !==
        undefined
          ? update.urgency
          : existing.urgency,

      urgency_policy:
        existing.urgency_policy,

      status:
        update.status ??
        existing.status,

      review_cycle:
        existing.review_cycle,

      success_metrics:
        existing.success_metrics,

      metadata:
        existing.metadata ??
        {}
    };


    await saveGoal(
      merged
    );


    console.log(
      `🎯 Goal updated: ${update.goal_id}`
    );
  }
    return hasPersistableChanges;
}