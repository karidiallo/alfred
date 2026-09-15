import "dotenv/config";

import {
  supabase
} from "./supabase.js";

import {
  saveDecisionSafely
} from "./safeEntityWrites.js";


const TEST_DECISION_KEY =
  "decision_test_outreach_message_v1";


async function main() {

  await saveDecisionSafely({

    dedupe_key:
      TEST_DECISION_KEY,

    title:
      "TEST — outreach message experiment",

    decision:
      "Send 10 TEST outreach messages using version A.",

    rationale:
      "Controlled Alfred learning-loop test.",

    expected_outcome:
      "At least 2 replies from 10 messages.",

    review_condition:
      "Review after all 10 messages have been sent.",

    source_type:
      "test",

    confidence:
      1,

    lifecycle_status:
      "accepted"

  });


  console.log(
    "✅ TEST DECISION CREATED"
  );


  const {
    data,
    error
  } =
    await supabase
      .from("decisions")
      .select(
        "dedupe_key, decision, expected_outcome, lifecycle_status"
      )
      .eq(
        "dedupe_key",
        TEST_DECISION_KEY
      )
      .single();


  if (error) {
    throw error;
  }


  console.log(
    JSON.stringify(
      data,
      null,
      2
    )
  );
}


main()
  .catch(error => {

    console.error(error);

    process.exit(1);
  });