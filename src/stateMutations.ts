import {
  normalizeDedupeKey,
  setCurrentState,
  supabase
} from "./supabase.js";


type SetCurrentStateOptions =
  Parameters<typeof setCurrentState>[4];


// ============================================================
// HELPERS
// ============================================================

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {

  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}


function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {

  const result:
    Record<string, unknown> = {
      ...base
    };


  for (
    const [key, patchValue]
    of Object.entries(patch)
  ) {

    const baseValue =
      result[key];


    if (
      isPlainObject(baseValue) &&
      isPlainObject(patchValue)
    ) {

      result[key] =
        deepMerge(
          baseValue,
          patchValue
        );

      continue;
    }


    // Arrays, primitives and null intentionally replace
    // the previous value.
    result[key] =
      patchValue;
  }


  return result;
}


// ============================================================
// SAFE CURRENT STATE MERGE
// ============================================================

export async function mergeCurrentState(
  key: string,
  patch: unknown,
  source: string,
  confidence: number,
  options?: SetCurrentStateOptions
) {

  const normalizedKey =
    normalizeDedupeKey(key);


  const {
    data,
    error
  } =
    await supabase
      .from("current_state")
      .select("value")
      .eq(
        "key",
        normalizedKey
      )
      .maybeSingle();


  if (error) {

    throw new Error(
      `Could not load current_state "${normalizedKey}": ${error.message}`
    );
  }


  const existingValue =
    data?.value;


  const mergedValue =
    isPlainObject(existingValue) &&
    isPlainObject(patch)
      ? deepMerge(
          existingValue,
          patch
        )
      : patch;


  return setCurrentState(
    normalizedKey,
    mergedValue,
    source,
    confidence,
    options
  );
}