import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import {
  setAlfredConfig,

  saveProfileItem,

  saveArea,
  saveGoal,
  saveProject,
  setProjectGoals,

  saveTask,
  saveCommitment,
  saveIdea,

  saveIncomeChannel,

  setCurrentState,

  saveBehavioralPattern,

  saveMemory,
  saveDecision,

  saveExperiment,
  savePrediction,
  saveOutcome,
  saveFailedApproach
} from "./supabase.js";


// ============================================================
// TYPES
// ============================================================

type JsonObject =
  Record<string, any>;


// ============================================================
// HELPERS
// ============================================================

function loadBootstrap(): JsonObject {

  const filePath =
    path.resolve(
      process.cwd(),
      "data/alfred-bootstrap-v1.json"
    );

  const raw =
    fs.readFileSync(
      filePath,
      "utf-8"
    );

  return JSON.parse(raw);
}


function log(
  icon: string,
  label: string,
  id?: string
) {

  console.log(
    id
      ? `${icon} ${label}: ${id}`
      : `${icon} ${label}`
  );
}


// ============================================================
// IMPORT
// ============================================================

async function main() {

  console.log("");
  console.log(
    "=============================================="
  );
  console.log(
    "🧠 ALFRED BOOTSTRAP v1"
  );
  console.log(
    "=============================================="
  );
  console.log("");


  const bootstrap =
    loadBootstrap();


  // ==========================================================
  // VALIDATE
  // ==========================================================

  if (
    bootstrap.schema_version !==
    "1.0.0"
  ) {

    throw new Error(
      `Unexpected schema version: ${bootstrap.schema_version}`
    );
  }


  console.log(
    `Schema: ${bootstrap.schema_version}`
  );

  console.log(
    `Bootstrap: ${bootstrap.bootstrap_version}`
  );

  console.log(
    `Architecture: ${bootstrap.meta?.architecture_status}`
  );

  console.log("");


  // ==========================================================
  // CONFIG / ARCHITECTURE
  // ==========================================================

  const configSections = [
    "meta",
    "schema_config",
    "commitment_policy",
    "operating_policy",
    "learning_model",
    "retrieval_policy",
    "forgetting_policy",
    "lifecycle_rules",
    "daily_operating_loop"
  ];


  for (
    const section of
    configSections
  ) {

    if (
      bootstrap[section] ===
      undefined
    ) {
      continue;
    }


    await setAlfredConfig(
      section,
      bootstrap[section],
      bootstrap.schema_version
    );


    log(
      "⚙️",
      "Config",
      section
    );
  }


  // ==========================================================
  // IDENTITY
  // ==========================================================

  for (
    const item of
    bootstrap.identity ?? []
  ) {

    await saveProfileItem({

      id:
        item.id,

      category:
        "identity",

      label:
        item.label,

      content:
        item.content,

      source_type:
        item.source,

      confidence:
        item.confidence,

      importance:
        item.importance,

      stability:
        item.stability,

      status:
        item.status,

      evidence_count:
        item.evidence_count ??
        1,

      requires_future_confirmation:
        item.requires_future_confirmation ??
        false

    });


    log(
      "🪪",
      "Identity",
      item.id
    );
  }


  // ==========================================================
  // VALUES
  // ==========================================================

  for (
    const item of
    bootstrap.values ?? []
  ) {

    await saveProfileItem({

      id:
        item.id,

      category:
        "value",

      content:
        item.content,

      source_type:
        item.source,

      confidence:
        item.confidence,

      importance:
        item.importance,

      stability:
        item.stability,

      status:
        item.status,

      evidence_count:
        item.evidence_count ??
        1,

      requires_future_confirmation:
        item.requires_future_confirmation ??
        false

    });


    log(
      "💎",
      "Value",
      item.id
    );
  }


  // ==========================================================
  // ANTI-GOALS
  // ==========================================================

  for (
    const item of
    bootstrap.anti_goals ?? []
  ) {

    await saveProfileItem({

      id:
        item.id,

      category:
        "anti_goal",

      content:
        item.content,

      source_type:
        item.source,

      confidence:
        item.confidence,

      importance:
        item.importance,

      stability:
        item.stability ??
        "long_term",

      status:
        item.status ??
        "active",

      evidence_count:
        item.evidence_count ??
        1,

      requires_future_confirmation:
        item.requires_future_confirmation ??
        false

    });


    log(
      "🚫",
      "Anti-goal",
      item.id
    );
  }


  // ==========================================================
  // PERSONAL MODEL — PREFERENCES
  // ==========================================================

  for (
    const item of
    bootstrap.personal_model
      ?.preferences ?? []
  ) {

    await saveProfileItem({

      id:
        item.id,

      category:
        "preference",

      content:
        item.content,

      source_type:
        item.source,

      confidence:
        item.confidence,

      importance:
        item.importance,

      stability:
        item.stability,

      status:
        item.status ??
        "active",

      evidence_count:
        item.evidence_count ??
        1,

      requires_future_confirmation:
        item.requires_future_confirmation ??
        false

    });


    log(
      "❤️",
      "Preference",
      item.id
    );
  }


  // ==========================================================
  // PERSONAL MODEL — WORKING STYLE
  // ==========================================================

  for (
    const item of
    bootstrap.personal_model
      ?.working_style ?? []
  ) {

    await saveProfileItem({

      id:
        item.id,

      category:
        "working_style",

      content:
        item.content,

      source_type:
        item.source,

      confidence:
        item.confidence,

      importance:
        item.importance,

      stability:
        item.stability,

      status:
        item.status ??
        "active",

      evidence_count:
        item.evidence_count ??
        1,

      requires_future_confirmation:
        item.requires_future_confirmation ??
        false

    });


    log(
      "🛠️",
      "Working style",
      item.id
    );
  }


  // ==========================================================
  // AREAS
  // ==========================================================

  for (
    const area of
    bootstrap.areas ?? []
  ) {

    await saveArea({

      id:
        area.id,

      title:
        area.title,

      status:
        area.status,

      identity_level:
        area.identity_level ??
        false

    });


    log(
      "🗂️",
      "Area",
      area.id
    );
  }


  // ==========================================================
  // GOALS
  // ==========================================================

  for (
    const goal of
    bootstrap.goals ?? []
  ) {

    await saveGoal({

      id:
        goal.id,

      area_id:
        goal.area_id,

      title:
        goal.title,

      description:
        goal.description,

      strategic_priority:
        goal.strategic_priority,

      current_priority:
        goal.current_priority,

      urgency:
        goal.urgency,

      urgency_policy:
        goal.urgency_policy,

      status:
        goal.status,

      review_cycle:
        goal.review_cycle,

      success_metrics:
        goal.success_metrics ??
        []

    });


    log(
      "🎯",
      "Goal",
      goal.id
    );
  }


  // ==========================================================
  // PROJECTS
  // ==========================================================

  for (
    const project of
    bootstrap.projects ?? []
  ) {

    await saveProject({

      id:
        project.id,

      area_id:
        project.area_id,

      title:
        project.title,

      status:
        project.status,

      stage:
        project.stage,

      major_project:
        project.major_project,

      description:
        project.description,

      desired_outcome:
        project.desired_outcome,

      definition_of_done:
        project.definition_of_done,

      success_metrics:
        project.success_metrics,

      strategic_priority:
        project.strategic_priority,

      current_priority:
        project.current_priority,

      urgency:
        project.urgency,

      current_bottleneck:
        project.current_bottleneck,

      next_action:
        project.next_action,

      next_action_policy:
        project.next_action_policy,

      blocked_by:
        project.blocked_by,

      last_progress_at:
        project.last_progress_at,

      review_at:
        project.review_at,

      source_type:
        project.source,

      confidence:
        project.confidence

    });


    await setProjectGoals(
      project.id,
      project.goal_ids ?? []
    );


    log(
      "🚀",
      "Project",
      project.id
    );
  }


  // ==========================================================
  // TASKS
  // ==========================================================

  for (
    const task of
    bootstrap.tasks ?? []
  ) {

    await saveTask({

      dedupe_key:
        task.dedupe_key ??
        task.id,

      project_id:
        task.project_id,

      goal_id:
        task.goal_id,

      title:
        task.title,

      description:
        task.description,

      status:
        task.status,

      priority:
        task.priority,

      due_at:
        task.due_at,

      next_action:
        task.next_action,

      source_type:
        task.source ??
        "user_explicit",

      confidence:
        task.confidence ??
        1,

      metadata:
        task.metadata ??
        {}

    });


    log(
      "✅",
      "Task",
      task.id ??
      task.dedupe_key ??
      task.title
    );
  }


  // ==========================================================
  // COMMITMENTS
  // ==========================================================

  for (
    const commitment of
    bootstrap.commitments ?? []
  ) {

    await saveCommitment({

      dedupe_key:
        commitment.dedupe_key ??
        commitment.id,

      type:
        commitment.type,

      title:
        commitment.title,

      source_type:
        commitment.source ??
        "user_explicit",

      counterparty:
        commitment.counterparty,

      due_at:
        commitment.due_at,

      status:
        commitment.status,

      reliability:
        commitment.reliability,

      consequence_level:
        commitment.consequence_level,

      consequence_if_missed:
        commitment.consequence_if_missed,

      next_action:
        commitment.next_action,

      metadata:
        commitment.metadata ??
        {}

    });


    log(
      "🤝",
      "Commitment",
      commitment.id ??
      commitment.title
    );
  }


  // ==========================================================
  // IDEA LAB
  // ==========================================================

  for (
    const idea of
    bootstrap.idea_lab?.items ??
    []
  ) {

    await saveIdea({

      dedupe_key:
        idea.dedupe_key ??
        idea.id,

      title:
        idea.title,

      description:
        idea.description,

      status:
        idea.status ??
        bootstrap.idea_lab
          ?.default_new_idea_status ??
        "idea",

      source_type:
        idea.source ??
        "user_explicit",

      estimated_upside:
        idea.estimated_upside,

      switching_cost:
        idea.switching_cost,

      metadata:
        idea.metadata ??
        {}

    });


    log(
      "💡",
      "Idea",
      idea.id ??
      idea.title
    );
  }


  // ==========================================================
  // INCOME CHANNELS
  // ==========================================================

  for (
    const channel of
    bootstrap.income_channels ?? []
  ) {

    await saveIncomeChannel({

      id:
        channel.id,

      area_id:
        channel.area_id,

      type:
        channel.type,

      status:
        channel.status,

      expected_cash:
        channel.expected_cash,

      currency:
        channel.currency ??
        "PLN",

      time_to_cash_days:
        channel.time_to_cash_days,

      certainty:
        channel.certainty,

      repeatability:
        channel.repeatability,

      capital_required:
        channel.capital_required,

      energy_required:
        channel.energy_required,

      dependency_count:
        channel.dependency_count,

      strategic_upside:
        channel.strategic_upside

    });


    log(
      "💰",
      "Income channel",
      channel.id
    );
  }


  // ==========================================================
  // CURRENT STATE
  // ==========================================================

  const currentState =
    bootstrap.current_state ??
    {};


  if (
    currentState.financial !==
    undefined
  ) {

    await setCurrentState(
      "financial",
      currentState.financial,
      "kari_bootstrap",
      1,
      {
        stability:
          "volatile",

        importance:
          1,

        confirmed_at:
          null,

        metadata: {
          bootstrap_as_of:
            currentState.as_of,
          confirmation_required:
            true
        }
      }
    );


    log(
      "🌍",
      "Current state",
      "financial"
    );
  }


  if (
    currentState.capacity !==
    undefined
  ) {

    await setCurrentState(
      "capacity",
      currentState.capacity,
      "kari_bootstrap",
      1,
      {
        stability:
          "volatile",

        importance:
          0.9,

        confirmed_at:
          null,

        metadata: {
          bootstrap_as_of:
            currentState.as_of,
          confirmation_required:
            true
        }
      }
    );


    log(
      "🌍",
      "Current state",
      "capacity"
    );
  }


  if (
    currentState.attention !==
    undefined
  ) {

    await setCurrentState(
      "attention",
      currentState.attention,
      "kari_bootstrap",
      0.95,
      {
        stability:
          "temporary",

        importance:
          0.9,

        metadata: {
          bootstrap_as_of:
            currentState.as_of
        }
      }
    );


    log(
      "🌍",
      "Current state",
      "attention"
    );
  }


  if (
    currentState.urgent_commitments !==
    undefined
  ) {

    await setCurrentState(
      "urgent_commitments",
      currentState.urgent_commitments,
      "kari_bootstrap",
      1,
      {
        stability:
          "volatile",

        importance:
          1,

        confirmed_at:
          null,

        metadata: {
          bootstrap_as_of:
            currentState.as_of,
          confirmation_required:
            true
        }
      }
    );


    log(
      "🌍",
      "Current state",
      "urgent_commitments"
    );
  }


  if (
    currentState.constraints !==
    undefined
  ) {

    await setCurrentState(
      "constraints",
      currentState.constraints,
      "kari_bootstrap",
      1,
      {
        stability:
          "volatile",

        importance:
          1,

        confirmed_at:
          null,

        metadata: {
          bootstrap_as_of:
            currentState.as_of,
          confirmation_required:
            true
        }
      }
    );


    log(
      "🌍",
      "Current state",
      "constraints"
    );
  }


  if (
    currentState.current_bottlenecks !==
    undefined
  ) {

    await setCurrentState(
      "current_bottlenecks",
      currentState.current_bottlenecks,
      "kari_bootstrap",
      0.8,
      {
        stability:
          "temporary",

        importance:
          0.9,

        metadata: {
          bootstrap_as_of:
            currentState.as_of,
          contains_inference:
            true
        }
      }
    );


    log(
      "🌍",
      "Current state",
      "current_bottlenecks"
    );
  }


  // ==========================================================
  // BEHAVIORAL PATTERNS
  // ==========================================================

  for (
    const pattern of
    bootstrap.personal_model
      ?.behavioral_patterns ?? []
  ) {

    await saveBehavioralPattern({

      id:
        pattern.id,

      pattern:
        pattern.pattern,

      observation:
        pattern.observation,

      source_type:
        pattern.source,

      evidence_type:
        pattern.evidence_type,

      evidence_count:
        pattern.evidence_count,

      confidence:
        pattern.confidence,

      importance:
        pattern.importance,

      status:
        pattern.status,

      intervention:
        pattern.intervention,

      requires_future_evidence:
        pattern.requires_future_evidence,

      last_evidence_at:
        pattern.last_evidence_at

    });


    log(
      "🧩",
      "Behavioral pattern",
      pattern.id
    );
  }


  // ==========================================================
  // MEMORY
  // ==========================================================

  for (
    const memory of
    bootstrap.memory?.items ?? []
  ) {

    await saveMemory({

      type:
        memory.type,

      dedupe_key:
        memory.id,

      content:
        memory.content,

      source:
        "kari_bootstrap",

      source_type:
        memory.source,

      confidence:
        memory.confidence,

      importance:
        memory.importance,

      stability:
        memory.stability,

      evidence_count:
        memory.evidence_count ??
        1,

      requires_future_confirmation:
        memory.requires_future_confirmation ??
        false,

      last_confirmed_at:
        memory.last_confirmed_at,

      valid_until:
        memory.valid_until,

      metadata: {
        bootstrap_id:
          memory.id,
        bootstrap_version:
          bootstrap.bootstrap_version
      }

    });


    log(
      "🧠",
      "Memory",
      memory.id
    );
  }


  // ==========================================================
  // DECISIONS
  // ==========================================================

  for (
    const decision of
    bootstrap.decisions ?? []
  ) {

    await saveDecision({

      dedupe_key:
        decision.id,

      title:
        decision.title,

      decision:
        decision.decision,

      rationale:
        decision.rationale,

      hypothesis:
        decision.hypothesis,

      expected_outcome:
        decision.expected_outcome,

      actual_outcome:
        decision.actual_outcome,

      lesson:
        decision.lesson,

      review_at:
        decision.review_at,

      source_type:
        decision.source ??
        "bootstrap",

      confidence:
        decision.confidence ??
        1,

      lifecycle_status:
        decision.status ??
        "accepted"

    });


    log(
      "⚖️",
      "Decision",
      decision.id
    );
  }


  // ==========================================================
  // EXPERIMENTS
  // ==========================================================

  for (
    const experiment of
    bootstrap.experiments ?? []
  ) {

    await saveExperiment({

      project_id:
        experiment.project_id,

      title:
        experiment.title,

      hypothesis:
        experiment.hypothesis,

      expected_outcome:
        experiment.expected_outcome,

      actual_outcome:
        experiment.actual_outcome,

      lesson:
        experiment.lesson,

      status:
        experiment.status,

      started_at:
        experiment.started_at,

      review_at:
        experiment.review_at,

      completed_at:
        experiment.completed_at,

      metadata:
        experiment.metadata ??
        {}

    });


    log(
      "🧪",
      "Experiment",
      experiment.id ??
      experiment.title
    );
  }


  // ==========================================================
  // PREDICTIONS
  // ==========================================================

  for (
    const prediction of
    bootstrap.predictions ?? []
  ) {

    await savePrediction({

      project_id:
        prediction.project_id,

      prediction:
        prediction.prediction,

      confidence:
        prediction.confidence,

      context:
        prediction.context,

      expected_by:
        prediction.expected_by,

      actual_result:
        prediction.actual_result,

      status:
        prediction.status,

      resolved_at:
        prediction.resolved_at,

      metadata:
        prediction.metadata ??
        {}

    });


    log(
      "🔮",
      "Prediction",
      prediction.id ??
      prediction.prediction
    );
  }


  // ==========================================================
  // OUTCOMES
  // ==========================================================

  for (
    const outcome of
    bootstrap.outcomes ?? []
  ) {

    await saveOutcome({

      entity_type:
        outcome.entity_type,

      entity_id:
        outcome.entity_id,

      project_id:
        outcome.project_id,

      title:
        outcome.title,

      expected:
        outcome.expected,

      actual:
        outcome.actual,

      lesson:
        outcome.lesson,

      occurred_at:
        outcome.occurred_at,

      metadata:
        outcome.metadata ??
        {}

    });


    log(
      "📈",
      "Outcome",
      outcome.id ??
      outcome.title
    );
  }


  // ==========================================================
  // FAILED APPROACHES
  // ==========================================================

  for (
    const item of
    bootstrap.failed_approaches ?? []
  ) {

    await saveFailedApproach({

      id:
        item.id,

      context:
        item.context,

      approach:
        item.approach,

      result:
        item.result,

      lesson:
        item.lesson,

      source_type:
        item.source,

      confidence:
        item.confidence,

      requires_future_confirmation:
        item.requires_future_confirmation ??
        false

    });


    log(
      "🧯",
      "Failed approach",
      item.id
    );
  }


  // ==========================================================
  // BOOTSTRAP STATUS
  // ==========================================================

  await setAlfredConfig(
    "bootstrap_status",
    {
      version:
        bootstrap.bootstrap_version,

      schema_version:
        bootstrap.schema_version,

      completed_at:
        new Date()
          .toISOString(),

      source_file:
        "data/alfred-bootstrap-v1.json",

      status:
        "completed"
    },
    bootstrap.schema_version
  );


  console.log("");
  console.log(
    "=============================================="
  );
  console.log(
    "✅ ALFRED BOOTSTRAP v1 IMPORT COMPLETE"
  );
  console.log(
    "=============================================="
  );
  console.log("");
}


main().catch(
  error => {

    console.error("");
    console.error(
      "❌ ALFRED BOOTSTRAP FAILED"
    );
    console.error(error);
    console.error("");

    process.exit(1);
  }
);