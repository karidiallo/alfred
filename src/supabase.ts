import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

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

export const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

export type MemoryInput = {
  type: string;
  content: string;
  source?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

export async function saveMemory(
  memory: MemoryInput
) {
  const { data, error } = await supabase
    .from("memories")
    .insert({
      type: memory.type,
      content: memory.content,
      source: memory.source ?? "alfred",
      confidence: memory.confidence ?? 1,
      metadata: memory.metadata ?? {}
    })
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
  limit = 20
) {
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("status", "active")
    .order("updated_at", {
      ascending: false
    })
    .limit(limit);

  if (error) {
    throw new Error(
      `Nie udało się pobrać pamięci: ${error.message}`
    );
  }

  return data ?? [];
}

// --------------------------------------------------
// CURRENT STATE
// --------------------------------------------------

export async function setCurrentState(
  key: string,
  value: unknown,
  source = "alfred",
  confidence = 1
) {
  const { data, error } = await supabase
    .from("current_state")
    .upsert(
      {
        key,
        value,
        source,
        confidence,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "key"
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
  const { data, error } = await supabase
    .from("current_state")
    .select("*")
    .order("updated_at", {
      ascending: false
    });

  if (error) {
    throw new Error(
      `Nie udało się pobrać current state: ${error.message}`
    );
  }

  return data ?? [];
}

// --------------------------------------------------
// DECISIONS
// --------------------------------------------------

export async function saveDecision(input: {
  title: string;
  decision: string;
  rationale?: string;
  review_condition?: string;
}) {
  const { data, error } = await supabase
    .from("decisions")
    .insert({
      title: input.title,
      decision: input.decision,
      rationale: input.rationale ?? null,
      review_condition: input.review_condition ?? null,
      status: "active"
    })
    .select()
    .single();

  if (error) {
    throw new Error(
      `Nie udało się zapisać decyzji: ${error.message}`
    );
  }

  return data;
}


// --------------------------------------------------
// OBJECTIVES
// --------------------------------------------------

export async function saveObjective(input: {
  kind: "goal" | "project" | "commitment" | "task";
  title: string;
  description?: string;
  priority?: number;
}) {
  const { data, error } = await supabase
    .from("objectives")
    .insert({
      kind: input.kind,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? 3,
      status: "active"
    })
    .select()
    .single();

  if (error) {
    throw new Error(
      `Nie udało się zapisać objective: ${error.message}`
    );
  }

  return data;
}

// --------------------------------------------------
// READ ACTIVE DECISIONS
// --------------------------------------------------

export async function getActiveDecisions(
  limit = 30
) {
  const { data, error } = await supabase
    .from("decisions")
    .select("*")
    .eq("status", "active")
    .order("decided_at", {
      ascending: false
    })
    .limit(limit);

  if (error) {
    throw new Error(
      `Nie udało się pobrać decyzji: ${error.message}`
    );
  }

  return data ?? [];
}


// --------------------------------------------------
// READ ACTIVE OBJECTIVES
// --------------------------------------------------

export async function getActiveObjectives(
  limit = 50
) {
  const { data, error } = await supabase
    .from("objectives")
    .select("*")
    .eq("status", "active")
    .order("priority", {
      ascending: true
    })
    .limit(limit);

  if (error) {
    throw new Error(
      `Nie udało się pobrać objectives: ${error.message}`
    );
  }

  return data ?? [];
}