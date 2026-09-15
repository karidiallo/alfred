import "dotenv/config";

import {
  supabase
} from "./supabase.js";

import {
  saveCommitmentSafely
} from "./safeEntityWrites.js";


const TEST_KEY =
  "test_commitment_lifecycle_v1";


async function main() {

  try {

    // ========================================================
    // 1. CREATE ORIGINAL COMMITMENT
    // ========================================================

    await saveCommitmentSafely({

      dedupe_key:
        TEST_KEY,

      type:
        "delivery",

      title:
        "Send ORIGINAL REPORT",

      counterparty:
        "ORIGINAL CLIENT",

      due_at:
        "2026-09-20T12:00:00+02:00",

      reliability:
        1,

      consequence_level:
        "medium",

      next_action:
        "Finish report",

      status:
        "open",

      source_type:
        "test"
    });


    // ========================================================
    // 2. SIMULATE LATER KEEPER UPDATE
    //
    // Intentionally provide WRONG replacement details.
    // Lifecycle protection should ignore them and only close
    // the commitment.
    // ========================================================

    await saveCommitmentSafely({

      dedupe_key:
        TEST_KEY,

      type:
        "administrative",

      title:
        "WRONG NEW TITLE",

      counterparty:
        "WRONG CLIENT",

      due_at:
        "2030-01-01T00:00:00+01:00",

      status:
        "completed",

      source_type:
        "memory_keeper_v1"
    });


    // ========================================================
    // 3. READ RESULT
    // ========================================================

    const {
      data,
      error
    } =
      await supabase
        .from("commitments")
        .select(
          "dedupe_key, type, title, counterparty, due_at, status, next_action"
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
      "completed"
    ) {

      throw new Error(
        `❌ status should be completed, got ${data.status}`
      );
    }


    if (
      data.title !==
      "Send ORIGINAL REPORT"
    ) {

      throw new Error(
        `❌ original title was overwritten: ${data.title}`
      );
    }


    if (
      data.counterparty !==
      "ORIGINAL CLIENT"
    ) {

      throw new Error(
        `❌ counterparty was overwritten: ${data.counterparty}`
      );
    }


    if (
      data.type !==
      "delivery"
    ) {

      throw new Error(
        `❌ commitment type was overwritten: ${data.type}`
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
      "Finish report"
    ) {

      throw new Error(
        `❌ next_action was overwritten: ${data.next_action}`
      );
    }


    console.log(
      "✅ COMMITMENT LIFECYCLE TEST PASSED"
    );

  } finally {

    // ========================================================
    // CLEANUP
    // ========================================================

    await supabase
      .from("commitments")
      .delete()
      .eq(
        "dedupe_key",
        TEST_KEY
      );


    console.log(
      "🧹 Test commitment cleaned"
    );
  }
}


main()
  .catch(error => {

    console.error(error);

    process.exit(1);
  });