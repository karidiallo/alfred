begin;

-- =========================================================
-- ALFRED PERSONAL AI
-- DATABASE SCHEMA v1.0.0
-- =========================================================

create extension if not exists pgcrypto;


-- =========================================================
-- UPDATED_AT HELPER
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =========================================================
-- CONFIG / ARCHITECTURE
-- =========================================================

create table if not exists public.alfred_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  schema_version text not null default '1.0.0',
  updated_at timestamptz not null default now()
);

drop trigger if exists alfred_config_updated_at
on public.alfred_config;

create trigger alfred_config_updated_at
before update on public.alfred_config
for each row
execute function public.set_updated_at();


-- =========================================================
-- EXTEND EXISTING MEMORY
-- =========================================================

alter table public.memories
add column if not exists source_type text;

alter table public.memories
add column if not exists last_confirmed_at timestamptz;

alter table public.memories
add column if not exists stability text;

alter table public.memories
add column if not exists importance numeric;

alter table public.memories
add column if not exists evidence_count integer default 1;

alter table public.memories
add column if not exists superseded_by uuid;

alter table public.memories
add column if not exists requires_future_confirmation boolean
not null default false;


create index if not exists memories_status_idx
on public.memories(status);

create index if not exists memories_stability_idx
on public.memories(stability);

create index if not exists memories_importance_idx
on public.memories(importance desc);


-- =========================================================
-- EXTEND CURRENT STATE
-- =========================================================

alter table public.current_state
add column if not exists confirmed_at timestamptz;

alter table public.current_state
add column if not exists valid_until timestamptz;

alter table public.current_state
add column if not exists stability text default 'volatile';

alter table public.current_state
add column if not exists importance numeric default 0.5;

alter table public.current_state
add column if not exists metadata jsonb
not null default '{}'::jsonb;


-- =========================================================
-- EXTEND DECISIONS
-- =========================================================

alter table public.decisions
add column if not exists hypothesis text;

alter table public.decisions
add column if not exists expected_outcome text;

alter table public.decisions
add column if not exists actual_outcome text;

alter table public.decisions
add column if not exists lesson text;

alter table public.decisions
add column if not exists review_at timestamptz;

alter table public.decisions
add column if not exists source_type text;

alter table public.decisions
add column if not exists confidence numeric default 1.0;

alter table public.decisions
add column if not exists lifecycle_status text
not null default 'accepted';


-- =========================================================
-- PROFILE
-- identity / values / anti-goals /
-- preferences / working style
-- =========================================================

create table if not exists public.profile_items (
  id text primary key,

  category text not null
    check (
      category in (
        'identity',
        'value',
        'anti_goal',
        'preference',
        'working_style'
      )
    ),

  label text,

  content text not null,

  source_type text not null default 'user_explicit',

  confidence numeric not null default 1.0
    check (confidence >= 0 and confidence <= 1),

  importance numeric not null default 0.5
    check (importance >= 0 and importance <= 1),

  stability text not null default 'long_term'
    check (
      stability in (
        'permanent',
        'long_term',
        'medium_term',
        'temporary',
        'volatile'
      )
    ),

  status text not null default 'active'
    check (
      status in (
        'active',
        'stale',
        'superseded',
        'disputed',
        'archived'
      )
    ),

  evidence_count integer not null default 1,

  requires_future_confirmation boolean
    not null default false,

  last_confirmed_at timestamptz,

  valid_until timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists profile_items_category_idx
on public.profile_items(category);

create index if not exists profile_items_status_idx
on public.profile_items(status);

create index if not exists profile_items_importance_idx
on public.profile_items(importance desc);


drop trigger if exists profile_items_updated_at
on public.profile_items;

create trigger profile_items_updated_at
before update on public.profile_items
for each row
execute function public.set_updated_at();


-- =========================================================
-- AREAS
-- =========================================================

create table if not exists public.areas (
  id text primary key,

  title text not null,

  status text not null default 'active',

  identity_level boolean not null default false,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


drop trigger if exists areas_updated_at
on public.areas;

create trigger areas_updated_at
before update on public.areas
for each row
execute function public.set_updated_at();


-- =========================================================
-- GOALS
-- =========================================================

create table if not exists public.goals (
  id text primary key,

  area_id text references public.areas(id)
    on delete set null,

  title text not null,

  description text,

  strategic_priority integer,

  current_priority integer,

  urgency integer,

  urgency_policy text,

  status text not null default 'active',

  review_cycle text,

  success_metrics jsonb not null default '[]'::jsonb,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists goals_area_idx
on public.goals(area_id);

create index if not exists goals_status_idx
on public.goals(status);

create index if not exists goals_current_priority_idx
on public.goals(current_priority);


drop trigger if exists goals_updated_at
on public.goals;

create trigger goals_updated_at
before update on public.goals
for each row
execute function public.set_updated_at();


-- =========================================================
-- PROJECTS
-- =========================================================

create table if not exists public.projects (
  id text primary key,

  area_id text references public.areas(id)
    on delete set null,

  title text not null,

  status text not null default 'idea'
    check (
      status in (
        'idea',
        'candidate',
        'active',
        'maintenance',
        'blocked',
        'paused',
        'completed',
        'abandoned',
        'archived'
      )
    ),

  stage text,

  major_project boolean not null default false,

  description text,

  desired_outcome text,

  definition_of_done jsonb not null default '[]'::jsonb,

  success_metrics jsonb not null default '{}'::jsonb,

  strategic_priority integer,

  current_priority integer,

  urgency integer,

  current_bottleneck text,

  next_action text,

  next_action_policy text,

  blocked_by jsonb not null default '[]'::jsonb,

  last_progress_at timestamptz,

  review_at timestamptz,

  source_type text,

  confidence numeric not null default 1.0,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists projects_area_idx
on public.projects(area_id);

create index if not exists projects_status_idx
on public.projects(status);

create index if not exists projects_priority_idx
on public.projects(current_priority);

create index if not exists projects_major_idx
on public.projects(major_project);


drop trigger if exists projects_updated_at
on public.projects;

create trigger projects_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();


-- =========================================================
-- PROJECT <-> GOAL RELATION
-- =========================================================

create table if not exists public.project_goals (
  project_id text not null
    references public.projects(id)
    on delete cascade,

  goal_id text not null
    references public.goals(id)
    on delete cascade,

  primary key (project_id, goal_id)
);


-- =========================================================
-- TASKS
-- =========================================================

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),

  dedupe_key text unique,

  project_id text references public.projects(id)
    on delete set null,

  goal_id text references public.goals(id)
    on delete set null,

  title text not null,

  description text,

  status text not null default 'open'
    check (
      status in (
        'open',
        'in_progress',
        'blocked',
        'done',
        'cancelled'
      )
    ),

  priority integer not null default 3,

  due_at timestamptz,

  next_action text,

  source_type text not null default 'user_explicit',

  confidence numeric not null default 1.0,

  metadata jsonb not null default '{}'::jsonb,

  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists tasks_status_idx
on public.tasks(status);

create index if not exists tasks_project_idx
on public.tasks(project_id);

create index if not exists tasks_due_idx
on public.tasks(due_at);


drop trigger if exists tasks_updated_at
on public.tasks;

create trigger tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();


-- =========================================================
-- COMMITMENTS
-- =========================================================

create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),

  dedupe_key text unique,

  type text not null
    check (
      type in (
        'promise',
        'deadline',
        'payment',
        'appointment',
        'follow_up',
        'delivery',
        'administrative'
      )
    ),

  title text not null,

  source_type text not null default 'user_explicit',

  counterparty text,

  due_at timestamptz,

  status text not null default 'open'
    check (
      status in (
        'open',
        'completed',
        'missed',
        'cancelled'
      )
    ),

  reliability numeric not null default 1.0
    check (
      reliability >= 0
      and reliability <= 1
    ),

  consequence_level text
    check (
      consequence_level in (
        'low',
        'medium',
        'high',
        'critical'
      )
    ),

  consequence_if_missed text,

  next_action text,

  metadata jsonb not null default '{}'::jsonb,

  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists commitments_status_idx
on public.commitments(status);

create index if not exists commitments_due_idx
on public.commitments(due_at);

create index if not exists commitments_consequence_idx
on public.commitments(consequence_level);


drop trigger if exists commitments_updated_at
on public.commitments;

create trigger commitments_updated_at
before update on public.commitments
for each row
execute function public.set_updated_at();


-- =========================================================
-- IDEA LAB
-- =========================================================

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),

  dedupe_key text unique,

  title text not null,

  description text,

  status text not null default 'idea'
    check (
      status in (
        'idea',
        'candidate',
        'promoted',
        'rejected',
        'archived'
      )
    ),

  source_type text not null default 'user_explicit',

  estimated_upside text,

  switching_cost text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists ideas_status_idx
on public.ideas(status);


drop trigger if exists ideas_updated_at
on public.ideas;

create trigger ideas_updated_at
before update on public.ideas
for each row
execute function public.set_updated_at();


-- =========================================================
-- INCOME CHANNELS
-- =========================================================

create table if not exists public.income_channels (
  id text primary key,

  area_id text references public.areas(id)
    on delete set null,

  type text not null,

  status text not null,

  expected_cash numeric,

  currency text not null default 'PLN',

  time_to_cash_days integer,

  certainty text,

  repeatability text,

  capital_required numeric,

  energy_required text,

  dependency_count integer,

  strategic_upside text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


drop trigger if exists income_channels_updated_at
on public.income_channels;

create trigger income_channels_updated_at
before update on public.income_channels
for each row
execute function public.set_updated_at();


-- =========================================================
-- BEHAVIORAL PATTERNS
-- =========================================================

create table if not exists public.behavioral_patterns (
  id text primary key,

  pattern text not null,

  observation text not null,

  source_type text not null,

  evidence_type text,

  evidence_count integer,

  confidence numeric not null default 0.5
    check (
      confidence >= 0
      and confidence <= 1
    ),

  importance numeric not null default 0.5
    check (
      importance >= 0
      and importance <= 1
    ),

  status text not null default 'hypothesis_active',

  intervention text,

  requires_future_evidence boolean
    not null default true,

  last_evidence_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists patterns_status_idx
on public.behavioral_patterns(status);

create index if not exists patterns_confidence_idx
on public.behavioral_patterns(confidence desc);


drop trigger if exists behavioral_patterns_updated_at
on public.behavioral_patterns;

create trigger behavioral_patterns_updated_at
before update on public.behavioral_patterns
for each row
execute function public.set_updated_at();


-- =========================================================
-- EXPERIMENTS
-- =========================================================

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),

  project_id text references public.projects(id)
    on delete set null,

  title text not null,

  hypothesis text not null,

  expected_outcome text,

  actual_outcome text,

  lesson text,

  status text not null default 'planned',

  started_at timestamptz,

  review_at timestamptz,

  completed_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


drop trigger if exists experiments_updated_at
on public.experiments;

create trigger experiments_updated_at
before update on public.experiments
for each row
execute function public.set_updated_at();


-- =========================================================
-- PREDICTIONS
-- =========================================================

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),

  project_id text references public.projects(id)
    on delete set null,

  prediction text not null,

  confidence numeric not null
    check (
      confidence >= 0
      and confidence <= 1
    ),

  context text,

  expected_by timestamptz,

  actual_result text,

  status text not null default 'open',

  resolved_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


drop trigger if exists predictions_updated_at
on public.predictions;

create trigger predictions_updated_at
before update on public.predictions
for each row
execute function public.set_updated_at();


-- =========================================================
-- OUTCOMES
-- =========================================================

create table if not exists public.outcomes (
  id uuid primary key default gen_random_uuid(),

  entity_type text,

  entity_id text,

  project_id text references public.projects(id)
    on delete set null,

  title text,

  expected text,

  actual text not null,

  lesson text,

  occurred_at timestamptz not null default now(),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);


create index if not exists outcomes_project_idx
on public.outcomes(project_id);

create index if not exists outcomes_entity_idx
on public.outcomes(entity_type, entity_id);


-- =========================================================
-- FAILED APPROACHES
-- =========================================================

create table if not exists public.failed_approaches (
  id text primary key,

  context text not null,

  approach text not null,

  result text,

  lesson text not null,

  source_type text not null,

  confidence numeric not null default 0.5,

  requires_future_confirmation boolean
    not null default false,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


drop trigger if exists failed_approaches_updated_at
on public.failed_approaches;

create trigger failed_approaches_updated_at
before update on public.failed_approaches
for each row
execute function public.set_updated_at();


-- =========================================================
-- SECURITY
-- Backend-only for now.
-- No anon policies.
-- =========================================================

alter table public.alfred_config enable row level security;
alter table public.profile_items enable row level security;
alter table public.areas enable row level security;
alter table public.goals enable row level security;
alter table public.projects enable row level security;
alter table public.project_goals enable row level security;
alter table public.tasks enable row level security;
alter table public.commitments enable row level security;
alter table public.ideas enable row level security;
alter table public.income_channels enable row level security;
alter table public.behavioral_patterns enable row level security;
alter table public.experiments enable row level security;
alter table public.predictions enable row level security;
alter table public.outcomes enable row level security;
alter table public.failed_approaches enable row level security;


-- =========================================================
-- REGISTER ARCHITECTURE VERSION
-- =========================================================

insert into public.alfred_config (
  key,
  value,
  schema_version
)
values (
  'architecture',
  jsonb_build_object(
    'name', 'Alfred Personal AI Chief of Staff',
    'status', 'frozen_v1',
    'architecture_version', '1.0.0',
    'bootstrap_version', '1.0.0',
    'evolution_policy',
    'Change architecture only after evidence from real usage and through versioned migrations.'
  ),
  '1.0.0'
)
on conflict (key)
do update set
  value = excluded.value,
  schema_version = excluded.schema_version,
  updated_at = now();


commit;