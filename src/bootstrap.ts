import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import {
  saveMemory,
  saveDecision,
  saveObjective
} from "./supabase.js";

type BootstrapData = {
  memories: Array<{
    type: string;
    dedupe_key: string;
    content: string;
    confidence: number;
  }>;

  decisions: Array<{
    dedupe_key: string;
    title: string;
    decision: string;
    rationale?: string;
    review_condition?: string;
  }>;

  objectives: Array<{
    kind: "goal" | "project" | "commitment" | "task";
    dedupe_key: string;
    title: string;
    description?: string;
    priority?: number;
  }>;
};

async function main() {
  console.log("🧠 Starting Kari bootstrap...");

  const filePath = path.resolve(
    process.cwd(),
    "data/bootstrap-data.json"
  );

  const raw = fs.readFileSync(
    filePath,
    "utf-8"
  );

  const data: BootstrapData =
    JSON.parse(raw);

  // ----------------------------------------------
  // MEMORIES
  // ----------------------------------------------

  for (const memory of data.memories) {
    await saveMemory({
      type: memory.type,
      dedupe_key: memory.dedupe_key,
      content: memory.content,
      confidence: memory.confidence,
      source: "kari_bootstrap",
      metadata: {
        bootstrap_version: "v0.1"
      }
    });

    console.log(
      `🧠 Memory: ${memory.dedupe_key}`
    );
  }

  // ----------------------------------------------
  // DECISIONS
  // ----------------------------------------------

  for (const decision of data.decisions) {
    await saveDecision({
      dedupe_key: decision.dedupe_key,
      title: decision.title,
      decision: decision.decision,
      rationale: decision.rationale,
      review_condition:
        decision.review_condition
    });

    console.log(
      `⚖️ Decision: ${decision.dedupe_key}`
    );
  }

  // ----------------------------------------------
  // OBJECTIVES
  // ----------------------------------------------

  for (const objective of data.objectives) {
    await saveObjective({
      kind: objective.kind,
      dedupe_key: objective.dedupe_key,
      title: objective.title,
      description:
        objective.description,
      priority:
        objective.priority ?? 3
    });

    console.log(
      `🎯 Objective: ${objective.dedupe_key}`
    );
  }

  console.log("");
  console.log("✅ Kari bootstrap complete.");
}

main().catch(error => {
  console.error(
    "❌ Kari bootstrap failed:"
  );

  console.error(error);

  process.exit(1);
});