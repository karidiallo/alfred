import "dotenv/config";

import { createClient } from "@supabase/supabase-js";


// ============================================================
// SUPABASE CLIENT
// ============================================================

const supabaseUrl =
  process.env.SUPABASE_URL?.trim();

const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY?.trim();


if (!supabaseUrl) {
  throw new Error("Brak SUPABASE_URL w .env");
}

if (!supabaseSecretKey) {
  throw new Error("Brak SUPABASE_SECRET_KEY w .env");
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


// ============================================================
// HELPERS
// ============================================================

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
    .slice(0, 180);
}


function nowIso() {
  return new Date().toISOString();
}


function fail(
  context: string,
  error: any
): never {

  throw new Error(
    `${context}: ${error?.message ?? String(error)}`
  );
}


// ============================================================
// CONFIG
// ============================================================

export async function setAlfredConfig(
  key: string,
  value: unknown,
  schemaVersion = "1.0.0"
) {

  const { data, error } =
    await supabase
      .from("alfred_config")
      .upsert(
        {
          key,
          value,
          schema_version:
            schemaVersion
        },
        {
          onConflict: "key"
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać Alfred config",
      error
    );
  }


  return data;
}


export async function getAlfredConfig(
  key?: string
) {

  let query =
    supabase
      .from("alfred_config")
      .select("*");


  if (key) {
    query =
      query.eq("key", key);
  }


  const { data, error } =
    await query;


  if (error) {
    fail(
      "Nie udało się pobrać Alfred config",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// MEMORIES
// existing system + v1 metadata
// ============================================================

export type MemoryInput = {
  type: string;
  content: string;

  dedupe_key?: string;

  source?: string;
  source_type?: string;

  confidence?: number;
  importance?: number;

  stability?:
    | "permanent"
    | "long_term"
    | "medium_term"
    | "temporary"
    | "volatile";

  evidence_count?: number;

  requires_future_confirmation?: boolean;

  last_confirmed_at?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;

  metadata?: Record<string, unknown>;
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

          source_type:
            memory.source_type ??
            "user_explicit",

          confidence:
            memory.confidence ??
            1,

          importance:
            memory.importance ??
            0.5,

          stability:
            memory.stability ??
            "long_term",

          evidence_count:
            memory.evidence_count ??
            1,

          requires_future_confirmation:
            memory.requires_future_confirmation ??
            false,

          last_confirmed_at:
            memory.last_confirmed_at ??
            null,

          valid_from:
            memory.valid_from ??
            null,

          valid_until:
            memory.valid_until ??
            null,

          metadata:
            memory.metadata ??
            {},

          status:
            "active",

          updated_at:
            nowIso()
        },
        {
          onConflict:
            "dedupe_key"
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać pamięci",
      error
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
        "importance",
        {
          ascending: false
        }
      )
      .order(
        "updated_at",
        {
          ascending: false
        }
      )
      .limit(limit);


  if (error) {
    fail(
      "Nie udało się pobrać pamięci",
      error
    );
  }


  return data ?? [];
}


export async function supersedeMemory(
  oldMemoryId: string,
  newMemoryId?: string
) {

  const { data, error } =
    await supabase
      .from("memories")
      .update(
        {
          status:
            "superseded",

          superseded_by:
            newMemoryId ??
            null,

          updated_at:
            nowIso()
        }
      )
      .eq(
        "id",
        oldMemoryId
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się supersede memory",
      error
    );
  }


  return data;
}


// ============================================================
// CURRENT STATE
// ============================================================

export async function setCurrentState(
  key: string,
  value: unknown,
  source = "alfred",
  confidence = 1,
  options?: {
    stability?:
      | "temporary"
      | "volatile"
      | "medium_term";

    importance?: number;

    confirmed_at?: string | null;

    valid_until?: string | null;

    metadata?: Record<string, unknown>;
  }
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

          stability:
            options?.stability ??
            "volatile",

          importance:
            options?.importance ??
            0.5,

          confirmed_at:
            options &&
            Object.prototype.hasOwnProperty.call(
              options,
              "confirmed_at"
            )
              ? options.confirmed_at
              : nowIso(),

          valid_until:
            options?.valid_until ??
            null,

          metadata:
            options?.metadata ??
            {},

          updated_at:
            nowIso()
        },
        {
          onConflict:
            "key"
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zaktualizować current state",
      error
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
        "importance",
        {
          ascending: false
        }
      )
      .order(
        "updated_at",
        {
          ascending: false
        }
      );


  if (error) {
    fail(
      "Nie udało się pobrać current state",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// PROFILE ITEMS
// identity / values / anti-goals / preferences / working style
// ============================================================

export type ProfileCategory =
  | "identity"
  | "value"
  | "anti_goal"
  | "preference"
  | "working_style";


export type ProfileItemInput = {
  id: string;

  category:
    ProfileCategory;

  label?: string;

  content: string;

  source_type?: string;

  confidence?: number;

  importance?: number;

  stability?:
    | "permanent"
    | "long_term"
    | "medium_term"
    | "temporary"
    | "volatile";

  status?:
    | "active"
    | "stale"
    | "superseded"
    | "disputed"
    | "archived";

  evidence_count?: number;

  requires_future_confirmation?: boolean;

  last_confirmed_at?: string | null;

  valid_until?: string | null;

  metadata?: Record<string, unknown>;
};


export async function saveProfileItem(
  input: ProfileItemInput
) {

  const { data, error } =
    await supabase
      .from("profile_items")
      .upsert(
        {
          id:
            input.id,

          category:
            input.category,

          label:
            input.label ??
            null,

          content:
            input.content,

          source_type:
            input.source_type ??
            "user_explicit",

          confidence:
            input.confidence ??
            1,

          importance:
            input.importance ??
            0.5,

          stability:
            input.stability ??
            "long_term",

          status:
            input.status ??
            "active",

          evidence_count:
            input.evidence_count ??
            1,

          requires_future_confirmation:
            input.requires_future_confirmation ??
            false,

          last_confirmed_at:
            input.last_confirmed_at ??
            null,

          valid_until:
            input.valid_until ??
            null,

          metadata:
            input.metadata ??
            {}
        },
        {
          onConflict:
            "id"
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać profile item",
      error
    );
  }


  return data;
}


export async function getProfileItems(
  options?: {
    category?:
      ProfileCategory;

    status?: string;

    limit?: number;
  }
) {

  let query =
    supabase
      .from("profile_items")
      .select("*")
      .order(
        "importance",
        {
          ascending: false
        }
      )
      .limit(
        options?.limit ??
        100
      );


  if (options?.category) {
    query =
      query.eq(
        "category",
        options.category
      );
  }


  if (options?.status) {
    query =
      query.eq(
        "status",
        options.status
      );
  }


  const { data, error } =
    await query;


  if (error) {
    fail(
      "Nie udało się pobrać profile items",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// AREAS
// ============================================================

export type AreaInput = {
  id: string;
  title: string;

  status?: string;

  identity_level?: boolean;

  metadata?: Record<string, unknown>;
};


export async function saveArea(
  input: AreaInput
) {

  const { data, error } =
    await supabase
      .from("areas")
      .upsert(
        {
          id:
            input.id,

          title:
            input.title,

          status:
            input.status ??
            "active",

          identity_level:
            input.identity_level ??
            false,

          metadata:
            input.metadata ??
            {}
        },
        {
          onConflict:
            "id"
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać area",
      error
    );
  }


  return data;
}


export async function getAreas() {

  const { data, error } =
    await supabase
      .from("areas")
      .select("*")
      .order(
        "created_at",
        {
          ascending: true
        }
      );


  if (error) {
    fail(
      "Nie udało się pobrać areas",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// GOALS
// ============================================================

export type GoalInput = {
  id: string;

  area_id?: string | null;

  title: string;

  description?: string | null;

  strategic_priority?: number | null;

  current_priority?: number | null;

  urgency?: number | null;

  urgency_policy?: string | null;

  status?: string;

  review_cycle?: string | null;

  success_metrics?: unknown;

  metadata?: Record<string, unknown>;
};


export async function saveGoal(
  input: GoalInput
) {

  const { data, error } =
    await supabase
      .from("goals")
      .upsert(
        {
          id:
            input.id,

          area_id:
            input.area_id ??
            null,

          title:
            input.title,

          description:
            input.description ??
            null,

          strategic_priority:
            input.strategic_priority ??
            null,

          current_priority:
            input.current_priority ??
            null,

          urgency:
            input.urgency ??
            null,

          urgency_policy:
            input.urgency_policy ??
            null,

          status:
            input.status ??
            "active",

          review_cycle:
            input.review_cycle ??
            null,

          success_metrics:
            input.success_metrics ??
            [],

          metadata:
            input.metadata ??
            {}
        },
        {
          onConflict:
            "id"
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać goal",
      error
    );
  }


  return data;
}


export async function getGoals(
  status?: string
) {

  let query =
    supabase
      .from("goals")
      .select("*")
      .order(
        "current_priority",
        {
          ascending: true,
          nullsFirst: false
        }
      );


  if (status) {
    query =
      query.eq(
        "status",
        status
      );
  }


  const { data, error } =
    await query;


  if (error) {
    fail(
      "Nie udało się pobrać goals",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// PROJECTS
// ============================================================

export type ProjectInput = {
  id: string;

  area_id?: string | null;

  title: string;

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

  major_project?: boolean;

  description?: string | null;

  desired_outcome?: string | null;

  definition_of_done?: unknown;

  success_metrics?: unknown;

  strategic_priority?: number | null;

  current_priority?: number | null;

  urgency?: number | null;

  current_bottleneck?: string | null;

  next_action?: string | null;

  next_action_policy?: string | null;

  blocked_by?: unknown;

  last_progress_at?: string | null;

  review_at?: string | null;

  source_type?: string | null;

  confidence?: number;

  metadata?: Record<string, unknown>;
};


export async function saveProject(
  input: ProjectInput
) {

  const { data, error } =
    await supabase
      .from("projects")
      .upsert(
        {
          id:
            input.id,

          area_id:
            input.area_id ??
            null,

          title:
            input.title,

          status:
            input.status ??
            "idea",

          stage:
            input.stage ??
            null,

          major_project:
            input.major_project ??
            false,

          description:
            input.description ??
            null,

          desired_outcome:
            input.desired_outcome ??
            null,

          definition_of_done:
            input.definition_of_done ??
            [],

          success_metrics:
            input.success_metrics ??
            {},

          strategic_priority:
            input.strategic_priority ??
            null,

          current_priority:
            input.current_priority ??
            null,

          urgency:
            input.urgency ??
            null,

          current_bottleneck:
            input.current_bottleneck ??
            null,

          next_action:
            input.next_action ??
            null,

          next_action_policy:
            input.next_action_policy ??
            null,

          blocked_by:
            input.blocked_by ??
            [],

          last_progress_at:
            input.last_progress_at ??
            null,

          review_at:
            input.review_at ??
            null,

          source_type:
            input.source_type ??
            null,

          confidence:
            input.confidence ??
            1,

          metadata:
            input.metadata ??
            {}
        },
        {
          onConflict:
            "id"
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać project",
      error
    );
  }


  return data;
}


export async function getProjects(
  status?: string
) {

  let query =
    supabase
      .from("projects")
      .select("*")
      .order(
        "current_priority",
        {
          ascending: true,
          nullsFirst: false
        }
      );


  if (status) {
    query =
      query.eq(
        "status",
        status
      );
  }


  const { data, error } =
    await query;


  if (error) {
    fail(
      "Nie udało się pobrać projects",
      error
    );
  }


  return data ?? [];
}


export async function setProjectGoals(
  projectId: string,
  goalIds: string[]
) {

  const deleteResult =
    await supabase
      .from("project_goals")
      .delete()
      .eq(
        "project_id",
        projectId
      );


  if (deleteResult.error) {
    fail(
      "Nie udało się wyczyścić project goals",
      deleteResult.error
    );
  }


  if (
    goalIds.length === 0
  ) {
    return [];
  }


  const rows =
    goalIds.map(
      goalId => ({
        project_id:
          projectId,

        goal_id:
          goalId
      })
    );


  const { data, error } =
    await supabase
      .from("project_goals")
      .insert(rows)
      .select();


  if (error) {
    fail(
      "Nie udało się zapisać project goals",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// TASKS
// ============================================================

export type TaskInput = {
  dedupe_key?: string;

  project_id?: string | null;

  goal_id?: string | null;

  title: string;

  description?: string | null;

  status?:
    | "open"
    | "in_progress"
    | "blocked"
    | "done"
    | "cancelled";

  priority?: number;

  due_at?: string | null;

  next_action?: string | null;

  source_type?: string;

  confidence?: number;

  metadata?: Record<string, unknown>;
};


export async function saveTask(
  input: TaskInput
) {

  const dedupeKey =
    normalizeDedupeKey(
      input.dedupe_key ??
      `task_${input.title}`
    );


  const { data, error } =
    await supabase
      .from("tasks")
      .upsert(
        {
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
            input.description ??
            null,

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
        },
        {
          onConflict:
            "dedupe_key"
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać task",
      error
    );
  }


  return data;
}


export async function getOpenTasks(
  limit = 100
) {

  const { data, error } =
    await supabase
      .from("tasks")
      .select("*")
      .in(
        "status",
        [
          "open",
          "in_progress",
          "blocked"
        ]
      )
      .order(
        "priority",
        {
          ascending: true
        }
      )
      .order(
        "due_at",
        {
          ascending: true,
          nullsFirst: false
        }
      )
      .limit(limit);


  if (error) {
    fail(
      "Nie udało się pobrać tasks",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// COMMITMENTS
// ============================================================

export type CommitmentInput = {
  dedupe_key?: string;

  type:
    | "promise"
    | "deadline"
    | "payment"
    | "appointment"
    | "follow_up"
    | "delivery"
    | "administrative";

  title: string;

  source_type?: string;

  counterparty?: string | null;

  due_at?: string | null;

  status?:
    | "open"
    | "completed"
    | "missed"
    | "cancelled";

  reliability?: number;

  consequence_level?:
    | "low"
    | "medium"
    | "high"
    | "critical"
    | null;

  consequence_if_missed?: string | null;

  next_action?: string | null;

  metadata?: Record<string, unknown>;
};


export async function saveCommitment(
  input: CommitmentInput
) {

  const dedupeKey =
    normalizeDedupeKey(
      input.dedupe_key ??
      `commitment_${input.type}_${input.title}`
    );


  const { data, error } =
    await supabase
      .from("commitments")
      .upsert(
        {
          dedupe_key:
            dedupeKey,

          type:
            input.type,

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

          status:
            input.status ??
            "open",

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

          metadata:
            input.metadata ??
            {}
        },
        {
          onConflict:
            "dedupe_key"
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać commitment",
      error
    );
  }


  return data;
}


export async function getOpenCommitments(
  limit = 100
) {

  const { data, error } =
    await supabase
      .from("commitments")
      .select("*")
      .eq(
        "status",
        "open"
      )
      .order(
        "due_at",
        {
          ascending: true,
          nullsFirst: false
        }
      )
      .limit(limit);


  if (error) {
    fail(
      "Nie udało się pobrać commitments",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// IDEA LAB
// ============================================================

export type IdeaInput = {
  dedupe_key?: string;

  title: string;

  description?: string | null;

  status?:
    | "idea"
    | "candidate"
    | "promoted"
    | "rejected"
    | "archived";

  source_type?: string;

  estimated_upside?: string | null;

  switching_cost?: string | null;

  metadata?: Record<string, unknown>;
};


export async function saveIdea(
  input: IdeaInput
) {

  const dedupeKey =
    normalizeDedupeKey(
      input.dedupe_key ??
      `idea_${input.title}`
    );


  const { data, error } =
    await supabase
      .from("ideas")
      .upsert(
        {
          dedupe_key:
            dedupeKey,

          title:
            input.title,

          description:
            input.description ??
            null,

          status:
            input.status ??
            "idea",

          source_type:
            input.source_type ??
            "user_explicit",

          estimated_upside:
            input.estimated_upside ??
            null,

          switching_cost:
            input.switching_cost ??
            null,

          metadata:
            input.metadata ??
            {}
        },
        {
          onConflict:
            "dedupe_key"
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać idea",
      error
    );
  }


  return data;
}


export async function getIdeas(
  status?: string
) {

  let query =
    supabase
      .from("ideas")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (status) {
    query =
      query.eq(
        "status",
        status
      );
  }


  const { data, error } =
    await query;


  if (error) {
    fail(
      "Nie udało się pobrać ideas",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// INCOME CHANNELS
// ============================================================

export type IncomeChannelInput = {
  id: string;

  area_id?: string | null;

  type: string;

  status: string;

  expected_cash?: number | null;

  currency?: string;

  time_to_cash_days?: number | null;

  certainty?: string | null;

  repeatability?: string | null;

  capital_required?: number | null;

  energy_required?: string | null;

  dependency_count?: number | null;

  strategic_upside?: string | null;

  metadata?: Record<string, unknown>;
};


export async function saveIncomeChannel(
  input: IncomeChannelInput
) {

  const { data, error } =
    await supabase
      .from("income_channels")
      .upsert(
        {
          id:
            input.id,

          area_id:
            input.area_id ??
            null,

          type:
            input.type,

          status:
            input.status,

          expected_cash:
            input.expected_cash ??
            null,

          currency:
            input.currency ??
            "PLN",

          time_to_cash_days:
            input.time_to_cash_days ??
            null,

          certainty:
            input.certainty ??
            null,

          repeatability:
            input.repeatability ??
            null,

          capital_required:
            input.capital_required ??
            null,

          energy_required:
            input.energy_required ??
            null,

          dependency_count:
            input.dependency_count ??
            null,

          strategic_upside:
            input.strategic_upside ??
            null,

          metadata:
            input.metadata ??
            {}
        },
        {
          onConflict:
            "id"
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać income channel",
      error
    );
  }


  return data;
}


export async function getIncomeChannels() {

  const { data, error } =
    await supabase
      .from("income_channels")
      .select("*")
      .order(
        "created_at",
        {
          ascending: true
        }
      );


  if (error) {
    fail(
      "Nie udało się pobrać income channels",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// BEHAVIORAL PATTERNS
// ============================================================

export type BehavioralPatternInput = {
  id: string;

  pattern: string;

  observation: string;

  source_type: string;

  evidence_type?: string | null;

  evidence_count?: number | null;

  confidence?: number;

  importance?: number;

  status?: string;

  intervention?: string | null;

  requires_future_evidence?: boolean;

  last_evidence_at?: string | null;

  metadata?: Record<string, unknown>;
};


export async function saveBehavioralPattern(
  input: BehavioralPatternInput
) {

  const { data, error } =
    await supabase
      .from("behavioral_patterns")
      .upsert(
        {
          id:
            input.id,

          pattern:
            input.pattern,

          observation:
            input.observation,

          source_type:
            input.source_type,

          evidence_type:
            input.evidence_type ??
            null,

          evidence_count:
            input.evidence_count ??
            null,

          confidence:
            input.confidence ??
            0.5,

          importance:
            input.importance ??
            0.5,

          status:
            input.status ??
            "hypothesis_active",

          intervention:
            input.intervention ??
            null,

          requires_future_evidence:
            input.requires_future_evidence ??
            true,

          last_evidence_at:
            input.last_evidence_at ??
            null,

          metadata:
            input.metadata ??
            {}
        },
        {
          onConflict:
            "id"
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać behavioral pattern",
      error
    );
  }


  return data;
}


export async function getBehavioralPatterns(
  limit = 50
) {

  const { data, error } =
    await supabase
      .from("behavioral_patterns")
      .select("*")
      .order(
        "importance",
        {
          ascending: false
        }
      )
      .order(
        "confidence",
        {
          ascending: false
        }
      )
      .limit(limit);


  if (error) {
    fail(
      "Nie udało się pobrać behavioral patterns",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// DECISIONS
// existing table upgraded to learning system
// ============================================================

export type DecisionInput = {
  title: string;

  decision: string;

  dedupe_key?: string;

  rationale?: string;

  review_condition?: string;

  hypothesis?: string;

  expected_outcome?: string;

  actual_outcome?: string;

  lesson?: string;

  review_at?: string | null;

  source_type?: string;

  confidence?: number;

  lifecycle_status?:
    | "proposed"
    | "accepted"
    | "reviewed";
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

          hypothesis:
            input.hypothesis ??
            null,

          expected_outcome:
            input.expected_outcome ??
            null,

          actual_outcome:
            input.actual_outcome ??
            null,

          lesson:
            input.lesson ??
            null,

          review_at:
            input.review_at ??
            null,

          source_type:
            input.source_type ??
            "user_explicit",

          confidence:
            input.confidence ??
            1,

          lifecycle_status:
            input.lifecycle_status ??
            "accepted",

          status:
            "active",

          updated_at:
            nowIso()
        },
        {
          onConflict:
            "dedupe_key"
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać decyzji",
      error
    );
  }


  return data;
}


export async function getActiveDecisions(
  limit = 50
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
    fail(
      "Nie udało się pobrać decyzji",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// EXPERIMENTS
// ============================================================

export type ExperimentInput = {
  project_id?: string | null;

  title: string;

  hypothesis: string;

  expected_outcome?: string | null;

  actual_outcome?: string | null;

  lesson?: string | null;

  status?: string;

  started_at?: string | null;

  review_at?: string | null;

  completed_at?: string | null;

  metadata?: Record<string, unknown>;
};


export async function saveExperiment(
  input: ExperimentInput
) {

  const { data, error } =
    await supabase
      .from("experiments")
      .insert(
        {
          project_id:
            input.project_id ??
            null,

          title:
            input.title,

          hypothesis:
            input.hypothesis,

          expected_outcome:
            input.expected_outcome ??
            null,

          actual_outcome:
            input.actual_outcome ??
            null,

          lesson:
            input.lesson ??
            null,

          status:
            input.status ??
            "planned",

          started_at:
            input.started_at ??
            null,

          review_at:
            input.review_at ??
            null,

          completed_at:
            input.completed_at ??
            null,

          metadata:
            input.metadata ??
            {}
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać experiment",
      error
    );
  }


  return data;
}


export async function getExperiments(
  limit = 50
) {

  const { data, error } =
    await supabase
      .from("experiments")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(limit);


  if (error) {
    fail(
      "Nie udało się pobrać experiments",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// PREDICTIONS
// ============================================================

export type PredictionInput = {
  project_id?: string | null;

  prediction: string;

  confidence: number;

  context?: string | null;

  expected_by?: string | null;

  actual_result?: string | null;

  status?: string;

  resolved_at?: string | null;

  metadata?: Record<string, unknown>;
};


export async function savePrediction(
  input: PredictionInput
) {

  const { data, error } =
    await supabase
      .from("predictions")
      .insert(
        {
          project_id:
            input.project_id ??
            null,

          prediction:
            input.prediction,

          confidence:
            input.confidence,

          context:
            input.context ??
            null,

          expected_by:
            input.expected_by ??
            null,

          actual_result:
            input.actual_result ??
            null,

          status:
            input.status ??
            "open",

          resolved_at:
            input.resolved_at ??
            null,

          metadata:
            input.metadata ??
            {}
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać prediction",
      error
    );
  }


  return data;
}


export async function getOpenPredictions(
  limit = 50
) {

  const { data, error } =
    await supabase
      .from("predictions")
      .select("*")
      .eq(
        "status",
        "open"
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(limit);


  if (error) {
    fail(
      "Nie udało się pobrać predictions",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// OUTCOMES
// ============================================================

export type OutcomeInput = {
  entity_type?: string | null;

  entity_id?: string | null;

  project_id?: string | null;

  title?: string | null;

  expected?: string | null;

  actual: string;

  lesson?: string | null;

  occurred_at?: string;

  metadata?: Record<string, unknown>;
};


export async function saveOutcome(
  input: OutcomeInput
) {

  const { data, error } =
    await supabase
      .from("outcomes")
      .insert(
        {
          entity_type:
            input.entity_type ??
            null,

          entity_id:
            input.entity_id ??
            null,

          project_id:
            input.project_id ??
            null,

          title:
            input.title ??
            null,

          expected:
            input.expected ??
            null,

          actual:
            input.actual,

          lesson:
            input.lesson ??
            null,

          occurred_at:
            input.occurred_at ??
            nowIso(),

          metadata:
            input.metadata ??
            {}
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać outcome",
      error
    );
  }


  return data;
}


export async function getOutcomes(
  limit = 100
) {

  const { data, error } =
    await supabase
      .from("outcomes")
      .select("*")
      .order(
        "occurred_at",
        {
          ascending: false
        }
      )
      .limit(limit);


  if (error) {
    fail(
      "Nie udało się pobrać outcomes",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// FAILED APPROACHES
// ============================================================

export type FailedApproachInput = {
  id: string;

  context: string;

  approach: string;

  result?: string | null;

  lesson: string;

  source_type: string;

  confidence?: number;

  requires_future_confirmation?: boolean;

  metadata?: Record<string, unknown>;
};


export async function saveFailedApproach(
  input: FailedApproachInput
) {

  const { data, error } =
    await supabase
      .from("failed_approaches")
      .upsert(
        {
          id:
            input.id,

          context:
            input.context,

          approach:
            input.approach,

          result:
            input.result ??
            null,

          lesson:
            input.lesson,

          source_type:
            input.source_type,

          confidence:
            input.confidence ??
            0.5,

          requires_future_confirmation:
            input.requires_future_confirmation ??
            false,

          metadata:
            input.metadata ??
            {}
        },
        {
          onConflict:
            "id"
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać failed approach",
      error
    );
  }


  return data;
}


export async function getFailedApproaches(
  limit = 50
) {

  const { data, error } =
    await supabase
      .from("failed_approaches")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(limit);


  if (error) {
    fail(
      "Nie udało się pobrać failed approaches",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// HISTORY
// ============================================================

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
    fail(
      "Nie udało się pobrać state history",
      error
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
    fail(
      "Nie udało się pobrać entity history",
      error
    );
  }


  return data ?? [];
}


// ============================================================
// LEGACY OBJECTIVES
//
// Temporary compatibility layer.
// openai.ts and old tests still use this.
// We remove it only after v1 context migration.
// ============================================================

export type ObjectiveKind =
  | "goal"
  | "project"
  | "commitment"
  | "task";


export type ObjectiveInput = {
  kind:
    ObjectiveKind;

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
            nowIso()
        },
        {
          onConflict:
            "dedupe_key"
        }
      )
      .select()
      .single();


  if (error) {
    fail(
      "Nie udało się zapisać legacy objective",
      error
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
    fail(
      "Nie udało się pobrać legacy objectives",
      error
    );
  }


  return data ?? [];
}