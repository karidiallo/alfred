import "dotenv/config";

import {
  setCurrentState,
  getCurrentState
} from "./supabase.js";

async function main() {
  console.log("🌍 Aktualizuję current state...");

  await setCurrentState(
    "test_current_priority",
    {
      value: "DEEP WORK",
      description: "Nowy testowy aktualny priorytet Kari"
    },
    "current_state_update_test",
    1
  );

  console.log("✅ Current state zmieniony z OUTREACH → DEEP WORK");

  const state = await getCurrentState();

  console.log("\n🌍 CURRENT STATE:");
  console.log(state);
}

main().catch(error => {
  console.error("❌ Current state update failed:");
  console.error(error);
  process.exit(1);
});