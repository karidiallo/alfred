import "dotenv/config";

import {
  setCurrentState,
  supabase
} from "./supabase.js";

import {
  mergeCurrentState
} from "./stateMutations.js";


const TEST_KEY =
  "test_state_merge_v1";


async function main() {

  try {

    // --------------------------------------------------------
    // 1. INITIAL STATE
    // --------------------------------------------------------

    await setCurrentState(
      TEST_KEY,
      {
        financial: {
          spendable: null,
          vault: 500,
          expected_income: [
            {
              source: "test",
              amount: 1000
            }
          ]
        },

        attention: {
          major_active_projects: 2,
          soft_limit: 2
        }
      },
      "state_merge_test",
      1
    );


    // --------------------------------------------------------
    // 2. PARTIAL UPDATE
    // --------------------------------------------------------

    await mergeCurrentState(
      TEST_KEY,
      {
        financial: {
          spendable: 420
        }
      },
      "state_merge_test",
      1
    );


    // --------------------------------------------------------
    // 3. LOAD RESULT
    // --------------------------------------------------------

    const {
      data,
      error
    } =
      await supabase
        .from("current_state")
        .select("value")
        .eq(
          "key",
          TEST_KEY
        )
        .single();


    if (error) {
      throw error;
    }


    const value =
      data.value as any;


    console.log(
      JSON.stringify(
        value,
        null,
        2
      )
    );


    // --------------------------------------------------------
    // 4. ASSERTIONS
    // --------------------------------------------------------

    if (
      value.financial.spendable !==
      420
    ) {
      throw new Error(
        "❌ spendable was not updated"
      );
    }


    if (
      value.financial.vault !==
      500
    ) {
      throw new Error(
        "❌ vault was accidentally overwritten"
      );
    }


    if (
      value.financial
        .expected_income?.[0]
        ?.amount !==
      1000
    ) {
      throw new Error(
        "❌ expected_income was accidentally overwritten"
      );
    }


    if (
      value.attention
        .major_active_projects !==
      2
    ) {
      throw new Error(
        "❌ unrelated nested state was accidentally overwritten"
      );
    }


    console.log("");
    console.log(
      "✅ STATE MERGE TEST PASSED"
    );

  } finally {

    // --------------------------------------------------------
    // CLEANUP
    // --------------------------------------------------------

    await supabase
      .from("current_state")
      .delete()
      .eq(
        "key",
        TEST_KEY
      );


    console.log(
      "🧹 Test state cleaned"
    );
  }
}


main()
  .catch(error => {

    console.error(error);

    process.exit(1);
  });