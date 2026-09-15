import "dotenv/config";

import {
  createClient
} from "@supabase/supabase-js";


// ==================================================
// SUPABASE CLIENT
// ==================================================

const supabaseUrl =
  process.env.SUPABASE_URL?.trim();

const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY?.trim();


if (!supabaseUrl) {
  throw new Error(
    "Brak SUPABASE_URL w .env"
  );
}

if (!supabaseSecretKey) {
  throw new Error(
    "Brak SUPABASE_SECRET_KEY w .env"
  );
}


export const supabase =
  createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );


// ==================================================
// HELPERS
// ==================================================

/**
 * Zamienia dedupe key na bezpieczny,
 * przewidywalny format.
 *
 * np.
 * "Preference: Comparison Format"
 *
 * →
 *
 * preference_comparison_format
 */
export function normalizeDedupeKey(
  value: string
): string {

  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    )
    .slice(0, 160);
}


// ==================================================
// MEMORY
// ==================================================

export type MemoryInput = {
  type: string;
  content: string;

  dedupe_key?: string;

  source?: string;
  confidence?: number;

  metadata?: Record<
    string,
    unknown
  >;
};


export async function saveMemory(
  memory: MemoryInput
) {

  const dedupeKey =
    normalizeDedupeKey(
      memory.dedupe_key ??
      `${memory.type}_${memory.content}`
    );


  const { data, error } =
    await supabase
      .from("memories")
      .upsert(
        {
          type:
            memory.type,

          content:
            memory.content,

          dedupe_key:
            dedupeKey,

          source:
            memory.source ??
            "alfred",

          confidence:
            memory.confidence ??
            1,

          metadata:
            memory.metadata ??
            {},

          status:
            "active",

          updated_at:
            new Date()
              .toISOString()
        },
        {
          onConflict:
            "dedupe_key"
        }
      )
      .select()
      .single();


  if (error) {

    throw new Error(
      `Nie udało się zapisać pamięci: ${error.message}`
    );
  }


  return data;
}


export async function getActiveMemories(
  limit = 50
) {

  const { data, error } =
    await supabase
      .from("memories")
      .select("*")
      .eq(
        "status",
        "active"
      )
      .order(
        "updated_at",
        {
          ascending: false
        }
      )
      .limit(limit);


  if (error) {

    throw new Error(
      `Nie udało się pobrać pamięci: ${error.message}`
    );
  }


  return data ?? [];
}


// ==================================================
// CURRENT STATE
// ==================================================

export async function setCurrentState(
  key: string,
  value: unknown,
  source = "alfred",
  confidence = 1
) {

  const normalizedKey =
    normalizeDedupeKey(key);


  const { data, error } =
    await supabase
      .from("current_state")
      .upsert(
        {
          key:
            normalizedKey,

          value,

          source,

          confidence,

          updated_at:
            new Date()
              .toISOString()
        },
        {
          onConflict:
            "key"
        }
      )
      .select()
      .single();


  if (error) {

    throw new Error(
      `Nie udało się zaktualizować current state: ${error.message}`
    );
  }


  return data;
}


export async function getCurrentState() {

  const { data, error } =
    await supabase
      .from("current_state")
      .select("*")
      .order(
        "updated_at",
        {
          ascending: false
        }
      );


  if (error) {

    throw new Error(
      `Nie udało się pobrać current state: ${error.message}`
    );
  }


  return data ?? [];
}


// ==================================================
// DECISIONS
// ==================================================

export type DecisionInput = {
  title: string;
  decision: string;

  dedupe_key?: string;

  rationale?: string;
  review_condition?: string;
};


export async function saveDecision(
  input: DecisionInput
) {

  const dedupeKey =
    normalizeDedupeKey(
      input.dedupe_key ??
      `decision_${input.title}`
    );


  const { data, error } =
    await supabase
      .from("decisions")
      .upsert(
        {
          title:
            input.title,

          decision:
            input.decision,

          dedupe_key:
            dedupeKey,

          rationale:
            input.rationale ??
            null,

          review_condition:
            input.review_condition ??
            null,

          status:
            "active",

          updated_at:
            new Date()
              .toISOString()
        },
        {
          onConflict:
            "dedupe_key"
        }
      )
      .select()
      .single();


  if (error) {

    throw new Error(
      `Nie udało się zapisać decyzji: ${error.message}`
    );
  }


  return data;
}


export async function getActiveDecisions(
  limit = 30
) {

  const { data, error } =
    await supabase
      .from("decisions")
      .select("*")
      .eq(
        "status",
        "active"
      )
      .order(
        "decided_at",
        {
          ascending: false
        }
      )
      .limit(limit);


  if (error) {

    throw new Error(
      `Nie udało się pobrać decyzji: ${error.message}`
    );
  }


  return data ?? [];
}


// ==================================================
// OBJECTIVES
// ==================================================

export type ObjectiveKind =
  | "goal"
  | "project"
  | "commitment"
  | "task";


export type ObjectiveInput = {
  kind: ObjectiveKind;

  title: string;

  dedupe_key?: string;

  description?: string;

  priority?: number;

  due_at?: string | null;
};


export async function saveObjective(
  input: ObjectiveInput
) {

  const dedupeKey =
    normalizeDedupeKey(
      input.dedupe_key ??
      `${input.kind}_${input.title}`
    );


  const { data, error } =
    await supabase
      .from("objectives")
      .upsert(
        {
          kind:
            input.kind,

          title:
            input.title,

          dedupe_key:
            dedupeKey,

          description:
            input.description ??
            null,

          priority:
            input.priority ??
            3,

          due_at:
            input.due_at ??
            null,

          status:
            "active",

          updated_at:
            new Date()
              .toISOString()
        },
        {
          onConflict:
            "dedupe_key"
        }
      )
      .select()
      .single();


  if (error) {

    throw new Error(
      `Nie udało się zapisać objective: ${error.message}`
    );
  }


  return data;
}


export async function getActiveObjectives(
  limit = 50
) {

  const { data, error } =
    await supabase
      .from("objectives")
      .select("*")
      .eq(
        "status",
        "active"
      )
      .order(
        "priority",
        {
          ascending: true
        }
      )
      .limit(limit);


  if (error) {

    throw new Error(
      `Nie udało się pobrać objectives: ${error.message}`
    );
  }


  return data ?? [];
}


// ==================================================
// HISTORY — READ ONLY
// ==================================================

export async function getStateHistory(
  key?: string,
  limit = 50
) {

  let query =
    supabase
      .from("state_history")
      .select("*")
      .order(
        "changed_at",
        {
          ascending: false
        }
      )
      .limit(limit);


  if (key) {

    query =
      query.eq(
        "key",
        normalizeDedupeKey(key)
      );
  }


  const { data, error } =
    await query;


  if (error) {

    throw new Error(
      `Nie udało się pobrać state history: ${error.message}`
    );
  }


  return data ?? [];
}


export async function getEntityHistory(
  entityType?: string,
  limit = 50
) {

  let query =
    supabase
      .from("entity_history")
      .select("*")
      .order(
        "changed_at",
        {
          ascending: false
        }
      )
      .limit(limit);


  if (entityType) {

    query =
      query.eq(
        "entity_type",
        entityType
      );
  }


  const { data, error } =
    await query;


  if (error) {

    throw new Error(
      `Nie udało się pobrać entity history: ${error.message}`
    );
  }


  return data ?? [];
}