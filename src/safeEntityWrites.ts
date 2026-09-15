import {
  normalizeDedupeKey,
  saveCommitment,
  saveDecision,
  saveIdea,
  saveTask,
  supabase
} from "./supabase.js";

import {
  patchCommitment,
  patchDecision,
  patchIdea,
  patchTask
} from "./entityMutations.js";


// ============================================================
// HELPERS
// ============================================================

type AnyRecord =
  Record<string, any>;


async function findByDedupeKey(
  table: string,
  dedupeKey: string
) {

  const normalizedKey =
    normalizeDedupeKey(
      dedupeKey
    );


  const {
    data,
    error
  } =
    await supabase
      .from(table)
      .select("*")
      .eq(
        "dedupe_key",
        normalizedKey
      )
      .maybeSingle();


  if (error) {
    throw new Error(
      `Could not load ${table}/${normalizedKey}: ${error.message}`
    );
  }


  return data;
}


/**
 * For updates:
 *
 * undefined = not mentioned → preserve old value
 * null      = currently also preserve old value
 *
 * We intentionally do NOT use null to erase information yet.
 * Explicit field clearing will get its own controlled mechanism later.
 */
function removeEmptyUpdateFields(
  input: AnyRecord
) {

  const result:
    AnyRecord = {};


  for (
    const [key, value]
    of Object.entries(input)
  ) {

    if (
      value === undefined ||
      value === null
    ) {
      continue;
    }


    result[key] =
      value;
  }


  return result;
}


// ============================================================
// TASK
// ============================================================

export async function saveTaskSafely(
  input: AnyRecord
) {

  const dedupeKey =
    normalizeDedupeKey(
      input.dedupe_key
    );


  const existing =
    await findByDedupeKey(
      "tasks",
      dedupeKey
    );


  if (!existing) {

    return saveTask({

      dedupe_key:
        dedupeKey,

      project_id:
        input.project_id ??
        null,

      goal_id:
        input.goal_id ??
        null,

      title:
        input.title,

      description:
        input.description,

      status:
        input.status ??
        "open",

      priority:
        input.priority ??
        3,

      due_at:
        input.due_at ??
        null,

      next_action:
        input.next_action ??
        null,

      source_type:
        input.source_type ??
        "user_explicit",

      confidence:
        input.confidence ??
        1,

      metadata:
        input.metadata ??
        {}

    });
  }

  // Lifecycle-only updates must not rewrite the original
    // identity or assignment details of an existing task.
  if (
     input.status === "done" ||
     input.status === "cancelled"
  ) {

    const lifecyclePatch =
        removeEmptyUpdateFields({

        status:
            input.status,

        source_type:
            input.source_type,

        confidence:
            input.confidence,

        metadata:
            input.metadata

     });


  return patchTask(
    dedupeKey,
    lifecyclePatch
  );
}

  const patch =
    removeEmptyUpdateFields({

      project_id:
        input.project_id,

      goal_id:
        input.goal_id,

      title:
        input.title,

      description:
        input.description,

      status:
        input.status,

      priority:
        input.priority,

      due_at:
        input.due_at,

      next_action:
        input.next_action,

      source_type:
        input.source_type,

      confidence:
        input.confidence,

      metadata:
        input.metadata

    });


  return patchTask(
    dedupeKey,
    patch
  );
}


// ============================================================
// COMMITMENT
// ============================================================

export async function saveCommitmentSafely(
  input: AnyRecord
) {

  const dedupeKey =
    normalizeDedupeKey(
      input.dedupe_key
    );


  const existing =
    await findByDedupeKey(
      "commitments",
      dedupeKey
    );


  if (!existing) {

    return saveCommitment({

      dedupe_key:
        dedupeKey,

      type:
        input.type ??
        "administrative",

      title:
        input.title,

      source_type:
        input.source_type ??
        "user_explicit",

      counterparty:
        input.counterparty ??
        null,

      due_at:
        input.due_at ??
        null,

      reliability:
        input.reliability ??
        1,

      consequence_level:
        input.consequence_level ??
        null,

      consequence_if_missed:
        input.consequence_if_missed ??
        null,

      next_action:
        input.next_action ??
        null,

      status:
        input.status ??
        "open",

      metadata:
        input.metadata ??
        {}

    });
  }

  // Lifecycle-only updates must not rewrite the identity
// or original details of an existing commitment.
   if (
        input.status === "completed" ||
        input.status === "cancelled"
    
    )   {

  const lifecyclePatch =
    removeEmptyUpdateFields({

      status:
        input.status,

      source_type:
        input.source_type,

      metadata:
        input.metadata

    });


  return patchCommitment(
    dedupeKey,
    lifecyclePatch
  );
}

  const patch =
    removeEmptyUpdateFields({

      type:
        input.type,

      title:
        input.title,

      counterparty:
        input.counterparty,

      due_at:
        input.due_at,

      reliability:
        input.reliability,

      consequence_level:
        input.consequence_level,

      consequence_if_missed:
        input.consequence_if_missed,

      next_action:
        input.next_action,

      status:
        input.status,

      source_type:
        input.source_type,

      metadata:
        input.metadata

    });


  return patchCommitment(
    dedupeKey,
    patch
  );
}


// ============================================================
// IDEA
// ============================================================

export async function saveIdeaSafely(
  input: AnyRecord
) {

  const dedupeKey =
    normalizeDedupeKey(
      input.dedupe_key
    );


  const existing =
    await findByDedupeKey(
      "ideas",
      dedupeKey
    );


  if (!existing) {

    return saveIdea({

      dedupe_key:
        dedupeKey,

      title:
        input.title,

      description:
        input.description,

      status:
        input.status ??
        "idea",

      source_type:
        input.source_type ??
        "user_explicit",

      estimated_upside:
        input.estimated_upside,

      switching_cost:
        input.switching_cost,

      metadata:
        input.metadata ??
        {}

    });
  }


  const patch =
    removeEmptyUpdateFields({

      title:
        input.title,

      description:
        input.description,

      status:
        input.status,

      source_type:
        input.source_type,

      estimated_upside:
        input.estimated_upside,

      switching_cost:
        input.switching_cost,

      metadata:
        input.metadata

    });


  return patchIdea(
    dedupeKey,
    patch
  );
}


// ============================================================
// DECISION
// ============================================================

export async function saveDecisionSafely(
  input: AnyRecord
) {

  const dedupeKey =
    normalizeDedupeKey(
      input.dedupe_key
    );


  const existing =
    await findByDedupeKey(
      "decisions",
      dedupeKey
    );


  if (!existing) {

    return saveDecision({

      dedupe_key:
        dedupeKey,

      title:
        input.title,

      decision:
        input.decision,

      rationale:
        input.rationale,

      review_condition:
        input.review_condition,

      hypothesis:
        input.hypothesis,

      expected_outcome:
        input.expected_outcome,

      actual_outcome:
        input.actual_outcome,

      lesson:
        input.lesson,

      review_at:
        input.review_at,

      source_type:
        input.source_type ??
        "user_explicit",

      confidence:
        input.confidence ??
        1,

      lifecycle_status:
        input.lifecycle_status ??
        "accepted"

    });
  }


  const patch =
    removeEmptyUpdateFields({

      title:
        input.title,

      decision:
        input.decision,

      rationale:
        input.rationale,

      status:
        input.status,

      review_condition:
        input.review_condition,

      hypothesis:
        input.hypothesis,

      expected_outcome:
        input.expected_outcome,

      actual_outcome:
        input.actual_outcome,

      lesson:
        input.lesson,

      review_at:
        input.review_at,

      source_type:
        input.source_type,

      confidence:
        input.confidence,

      lifecycle_status:
        input.lifecycle_status,

      metadata:
        input.metadata

    });


  return patchDecision(
    dedupeKey,
    patch
  );
}