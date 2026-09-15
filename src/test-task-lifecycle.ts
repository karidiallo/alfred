import "dotenv/config";

import {
  supabase
} from "./supabase.js";

import {
  saveTaskSafely
} from "./safeEntityWrites.js";


const TEST_KEY =
  "test_task_lifecycle_v1";


async function main() {

  try {

    // ========================================================
    // 1. CREATE ORIGINAL TASK
    // ========================================================

    await saveTaskSafely({

      dedupe_key:
        TEST_KEY,

      title:
        "ORIGINAL TASK",

      description:
        "Original description",

      priority:
        2,

      due_at:
        "2026-09-20T15:00:00+02:00",

      next_action:
        "Do original action",

      status:
        "open",

      source_type:
        "test",

      confidence:
        1
    });


    // ========================================================
    // 2. SIMULATE LATER KEEPER UPDATE
    //
    // Intentionally send wrong replacement data.
    // Only lifecycle status should change.
    // ========================================================

    await saveTaskSafely({

      dedupe_key:
        TEST_KEY,

      title:
        "WRONG NEW TITLE",

      description:
        "WRONG DESCRIPTION",

      priority:
        5,

      due_at:
        "2030-01-01T00:00:00+01:00",

      next_action:
        "WRONG ACTION",

      status:
        "done",

      source_type:
        "memory_keeper_v1",

      confidence:
        1
    });


    // ========================================================
    // 3. READ RESULT
    // ========================================================

    const {
      data,
      error
    } =
      await supabase
        .from("tasks")
        .select(
          "dedupe_key, title, description, priority, due_at, next_action, status"
        )
        .eq(
          "dedupe_key",
          TEST_KEY
        )
        .single();


    if (error) {
      throw error;
    }


    console.log("");
    console.log(
      JSON.stringify(
        data,
        null,
        2
      )
    );
    console.log("");


    // ========================================================
    // 4. ASSERTIONS
    // ========================================================

    if (
      data.status !==
      "done"
    ) {
      throw new Error(
        `❌ status should be done, got ${data.status}`
      );
    }


    if (
      data.title !==
      "ORIGINAL TASK"
    ) {
      throw new Error(
        `❌ title was overwritten: ${data.title}`
      );
    }


    if (
      data.description !==
      "Original description"
    ) {
      throw new Error(
        `❌ description was overwritten: ${data.description}`
      );
    }


    if (
      data.priority !==
      2
    ) {
      throw new Error(
        `❌ priority was overwritten: ${data.priority}`
      );
    }


    if (
      !String(data.due_at)
        .startsWith(
          "2026-09-20"
        )
    ) {
      throw new Error(
        `❌ due_at was overwritten: ${data.due_at}`
      );
    }


    if (
      data.next_action !==
      "Do original action"
    ) {
      throw new Error(
        `❌ next_action was overwritten: ${data.next_action}`
      );
    }


    console.log(
      "✅ TASK LIFECYCLE TEST PASSED"
    );

  } finally {

    await supabase
      .from("tasks")
      .delete()
      .eq(
        "dedupe_key",
        TEST_KEY
      );


    console.log(
      "🧹 Test task cleaned"
    );
  }
}


main()
  .catch(error => {

    console.error(error);

    process.exit(1);
  });
  