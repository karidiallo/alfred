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