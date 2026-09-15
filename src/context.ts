import {
  getAlfredConfig,

  getProfileItems,

  getAreas,
  getGoals,
  getProjects,

  getOpenTasks,
  getOpenCommitments,

  getIdeas,
  getIncomeChannels,

  getBehavioralPatterns,

  getActiveMemories,
  getCurrentState,
  getActiveDecisions,

  getExperiments,
  getOpenPredictions,
  getOutcomes,
  getFailedApproaches
} from "./supabase.js";


// ============================================================
// HELPERS
// ============================================================

function removeEmpty(
  value: unknown
): unknown {

  if (Array.isArray(value)) {

    const cleaned =
      value
        .map(removeEmpty)
        .filter(
          item =>
            item !== undefined
        );

    return cleaned;
  }


  if (
    value &&
    typeof value === "object"
  ) {

    const entries =
      Object.entries(
        value as Record<
          string,
          unknown
        >
      )
        .map(
          ([key, val]) => [
            key,
            removeEmpty(val)
          ]
        )
        .filter(
          ([, val]) =>
            val !== undefined
        );


    return Object.fromEntries(
      entries
    );
  }


  if (
    value === null ||
    value === undefined
  ) {
    return undefined;
  }


  return value;
}


function compactJson(
  value: unknown
) {

  return JSON.stringify(
    removeEmpty(value),
    null,
    2
  );
}


// ============================================================
// LOAD ALFRED CONTEXT
// ============================================================

export async function loadAlfredContext() {

  const [
    config,

    profile,

    areas,
    goals,
    projects,

    tasks,
    commitments,

    ideas,
    incomeChannels,

    patterns,

    memories,
    currentState,
    decisions,

    experiments,
    predictions,
    outcomes,
    failedApproaches

  ] =
    await Promise.all([

      getAlfredConfig(),

      getProfileItems({
        status: "active",
        limit: 100
      }),

      getAreas(),

      getGoals(),
      getProjects(),

      getOpenTasks(100),
      getOpenCommitments(100),

      getIdeas(),
      getIncomeChannels(),

      getBehavioralPatterns(50),

      getActiveMemories(50),
      getCurrentState(),
      getActiveDecisions(50),

      getExperiments(30),
      getOpenPredictions(30),
      getOutcomes(50),
      getFailedApproaches(30)

    ]);


  // ==========================================================
  // CONFIG MAP
  // ==========================================================

  const configMap =
    Object.fromEntries(
      config.map(
        item => [
          item.key,
          item.value
        ]
      )
    );


  // ==========================================================
  // SPLIT PROFILE
  // ==========================================================

  const identity =
    profile.filter(
      item =>
        item.category ===
        "identity"
    );


  const values =
    profile.filter(
      item =>
        item.category ===
        "value"
    );


  const antiGoals =
    profile.filter(
      item =>
        item.category ===
        "anti_goal"
    );


  const preferences =
    profile.filter(
      item =>
        item.category ===
        "preference"
    );


  const workingStyle =
    profile.filter(
      item =>
        item.category ===
        "working_style"
    );


  // ==========================================================
  // PROJECT FILTERS
  // ==========================================================

  const activeProjects =
    projects.filter(
      project =>
        [
          "active",
          "maintenance",
          "blocked"
        ].includes(
          project.status
        )
    );


  const inactiveProjects =
    projects.filter(
      project =>
        ![
          "active",
          "maintenance",
          "blocked"
        ].includes(
          project.status
        )
    );


  // ==========================================================
  // GOAL FILTERS
  // ==========================================================

  const activeGoals =
    goals.filter(
      goal =>
        [
          "active",
          "maintenance"
        ].includes(
          goal.status
        )
    );


  // ==========================================================
  // RETURN STRUCTURED CONTEXT
  // ==========================================================

  return {

    architecture: {
      meta:
        configMap.meta,

      operating_policy:
        configMap.operating_policy,

      learning_model:
        configMap.learning_model,

      retrieval_policy:
        configMap.retrieval_policy,

      lifecycle_rules:
        configMap.lifecycle_rules,

      daily_operating_loop:
        configMap.daily_operating_loop
    },


    personal_model: {

      identity,

      values,

      anti_goals:
        antiGoals,

      preferences,

      working_style:
        workingStyle,

      behavioral_patterns:
        patterns
    },


    current_state:
      currentState,


    operating_structure: {

      areas,

      goals:
        activeGoals,

      projects:
        activeProjects,

      inactive_projects:
        inactiveProjects,

      tasks,

      commitments,

      ideas,

      income_channels:
        incomeChannels
    },


    continuity: {

      decisions,

      memories
    },


    learning: {

      experiments,

      predictions,

      outcomes,

      failed_approaches:
        failedApproaches
    }
  };
}


// ============================================================
// FORMAT FOR MODEL
// ============================================================

export async function buildAlfredContextPrompt() {

  const context =
    await loadAlfredContext();


  return `
==================================================
ALFRED PERSONAL CONTEXT
==================================================

This is structured operating context for Kari.

IMPORTANT:

1. CURRENT USER MESSAGE
always has highest priority.

2. CURRENT STATE
represents what is believed to be true now.

3. PROFILE / IDENTITY / VALUES
should influence recommendations but must not
override explicit current instructions.

4. BEHAVIORAL PATTERNS
may contain hypotheses.
Do not present assistant inference as confirmed fact.

5. DECISIONS
protect continuity unless Kari explicitly changes
or reopens a decision.

6. GOALS and PROJECTS
represent adopted direction.

7. IDEAS
are NOT automatically active projects.

8. COMMITMENTS
are stronger than ordinary tasks when consequences
or external obligations exist.

9. VOLATILE INFORMATION
such as money, energy, capacity, availability and
deadlines must not be assumed current when marked
unknown or unconfirmed.

10. USER CORRECTIONS
override assistant inference.

11. Never convert venting, brainstorming or casual
conversation into strategy changes automatically.

12. Prefer execution within existing priorities unless
there is evidence that priorities should change.


-------------------------
PERSONAL MODEL
-------------------------

${compactJson(context.personal_model)}


-------------------------
CURRENT STATE
-------------------------

${compactJson(context.current_state)}


-------------------------
AREAS / GOALS / PROJECTS
-------------------------

${compactJson(context.operating_structure)}


-------------------------
DECISIONS / MEMORY
-------------------------

${compactJson(context.continuity)}


-------------------------
LEARNING HISTORY
-------------------------

${compactJson(context.learning)}


-------------------------
OPERATING POLICY
-------------------------

${compactJson(
  context.architecture
    .operating_policy
)}


-------------------------
LEARNING POLICY
-------------------------

${compactJson(
  context.architecture
    .learning_model
)}

==================================================
END ALFRED PERSONAL CONTEXT
==================================================
`;
}