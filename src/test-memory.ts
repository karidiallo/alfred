import "dotenv/config";

import {
  saveMemory,
  getActiveMemories
} from "./supabase.js";

async function main() {
  console.log("🧠 Test pamięci Alfreda...");

  const saved = await saveMemory({
    type: "test",
    content: "Alfred ma działającą trwałą pamięć.",
    source: "memory_test",
    confidence: 1
  });

  console.log("✅ Zapisano pamięć:");
  console.log(saved);

  const memories = await getActiveMemories();

  console.log("\n📚 Aktualne memories:");
  console.log(memories);
}

main().catch(error => {
  console.error("❌ Memory test failed:");
  console.error(error);
  process.exit(1);
});