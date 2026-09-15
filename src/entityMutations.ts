import {
  normalizeDedupeKey,
  supabase
} from "./supabase.js";


type JsonObject =
  Record<string, unknown>;


// ============================================================
// HELPERS
// ============================================================

function isPlainObject(
  value: unknown
): value is JsonObject {

  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}


function mergeObjects(
  base: JsonObject,
  patch: JsonObject
): JsonObject {

  const result: JsonObject = {
    ...base
  };


  for (
    const [key, value]
    of Object.entries(patch)
  ) {

    if (value === undefined) {
      continue;
    }


    if (
      isPlainObject(result[key]) &&
      isPlainObject(value)
    ) {

      result[key] =
        mergeObjects(
          result[key] as JsonObject,
          value
        );

      continue;
    }


    result[key] =
      value;
  }


  return result;
}


function pickAllowedFields(
  patch: JsonObject,
  allowedFields: string[]
): JsonObject {

  const result: JsonObject = {};


  for (
    const field
    of allowedFields
  ) {

    if (
      Object.prototype.hasOwnProperty.call(
        patch,
        field
      ) &&
      patch[field] !== undefined
    ) {

      result[field] =
        patch[field];
    }
  }


  return result;
}


// ============================================================
// GENERIC SAFE PATCH
// ============================================================

async function patchByDedupeKey(
  table: string,
  dedupeKey: string,
  patch: JsonObject,
  allowedFields: string[]
) {

  const normalizedKey =
    normalizeDedupeKey(
      dedupeKey
    );


  const {
    data: existing,
    error: loadError
  } =
    await supabase
      .from(table)
      .select("*")
      .eq(
        "dedupe_key",
        normalizedKey
      )
      .maybeSingle();


  if (loadError) {

    throw new Error(
      `Could not load ${table}/${normalizedKey}: ${loadError.message}`
    );
  }


  if (!existing) {

    throw new Error(
      `Cannot patch missing ${table}/${normalizedKey}`
    );
  }


  const safePatch =
    pickAllowedFields(
      patch,
      allowedFields
    );


  // Preserve existing metadata while allowing partial additions.
  if (
    isPlainObject(existing.metadata) &&
    isPlainObject(safePatch.metadata)
  ) {

    safePatch.metadata =
      mergeObjects(
        existing.metadata,
        safePatch.metadata
      );
  }


  const {
    data,
    error
  } =
    await supabase
      .from(table)
      .update(safePatch)
      .eq(
        "dedupe_key",
        normalizedKey
      )
      .select()
      .single();


  if (error) {

    throw new Error(
      `Could not patch ${table}/${normalizedKey}: ${error.message}`
    );
  }


  return data;
}


// ============================================================
// TASKS
// ============================================================

export async function patchTask(
  dedupeKey: string,
  patch: JsonObject
) {

  return patchByDedupeKey(
    "tasks",
    dedupeKey,
    patch,
    [
      "project_id",
      "goal_id",
      "title",
      "description",
      "status",
      "priority",
      "due_at",
      "next_action",
      "source_type",
      "confidence",
      "metadata"
    ]
  );
}


// ============================================================
// COMMITMENTS
// ============================================================

export async function patchCommitment(
  dedupeKey: string,
  patch: JsonObject
) {

  return patchByDedupeKey(
    "commitments",
    dedupeKey,
    patch,
    [
      "type",
      "title",
      "counterparty",
      "due_at",
      "reliability",
      "consequence_level",
      "consequence_if_missed",
      "next_action",
      "status",
      "source_type",
      "metadata"
    ]
  );
}


// ============================================================
// IDEAS
// ============================================================

export async function patchIdea(
  dedupeKey: string,
  patch: JsonObject
) {

  return patchByDedupeKey(
    "ideas",
    dedupeKey,
    patch,
    [
      "title",
      "description",
      "status",
      "source_type",
      "estimated_upside",
      "switching_cost",
      "metadata"
    ]
  );
}


// ============================================================
// DECISIONS
// ============================================================

export async function patchDecision(
  dedupeKey: string,
  patch: JsonObject
) {

  return patchByDedupeKey(
    "decisions",
    dedupeKey,
    patch,
    [
      "title",
      "decision",
      "rationale",
      "status",
      "review_condition",
      "hypothesis",
      "expected_outcome",
      "actual_outcome",
      "lesson",
      "review_at",
      "source_type",
      "confidence",
      "lifecycle_status",
      "metadata"
    ]
  );
}