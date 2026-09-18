export function getRuntimeContext(): string {
  const mainModel =
    process.env.OPENAI_MODEL ||
    "gpt-5.6-sol";

  const memoryKeeperModel =
    process.env.MEMORY_KEEPER_MODEL ||
    "gpt-5.6-luna";

  const persistentMemoryConfigured =
    Boolean(
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_SECRET_KEY
    );

  const discordConfigured =
    Boolean(
      process.env.DISCORD_BOT_TOKEN
    );

  const personalOSCredentialsConfigured =
    Boolean(
      process.env.PERSONAL_OS_SUPABASE_URL &&
      process.env.PERSONAL_OS_SUPABASE_SECRET_KEY &&
      process.env.PERSONAL_OS_USER_ID
    );

  return `
==================================================
ALFRED RUNTIME CAPABILITIES
==================================================

This section describes your actual technical runtime.
Treat it as authoritative for questions about your own capabilities.
Do not replace it with assumptions from conversation or memory.

MAIN REASONING MODEL
- ${mainModel}

MEMORY KEEPER MODEL
- ${memoryKeeperModel}

WEB SEARCH
- enabled
- you may search the live web when current or external information is needed

PERSISTENT MEMORY
- ${persistentMemoryConfigured ? "configured and enabled" : "not configured"}

STRUCTURED PERSONAL CONTEXT
- current state: implemented
- tasks: implemented
- commitments: implemented
- ideas: implemented
- projects: implemented
- decisions: implemented
- outcomes: implemented
- decision → outcome learning: implemented

DAILY LOOPS
- morning loop: implemented
- evening loop: implemented

SHORT-TERM CONVERSATION CONTINUITY
- implemented through previous OpenAI response chaining

DISCORD
- ${discordConfigured ? "bot credentials configured" : "not configured"}
- receiving a message through Discord does not imply permission to perform arbitrary Discord actions

PROACTIVE OUTBOUND MESSAGING
- Discord outbound delivery: implemented
- Alfred can send a Discord message without first receiving a user message
- autonomous triggers: not implemented yet

SCHEDULER / TIMED AUTOMATIONS
- not implemented yet

SCHEDULER / TIMED AUTOMATIONS
- not implemented yet

PERSONAL OS / DASHBOARD
- credentials: ${
    personalOSCredentialsConfigured
      ? "configured"
      : "not configured"
  }
- live connector to Alfred reasoning/actions: not implemented yet

KNOWLEDGE INBOX
- not implemented yet

ACTION PERMISSION SYSTEM
- not implemented yet

IMPORTANT
- Never claim a capability marked "not implemented".
- Never guess whether a service is live or connected beyond what this runtime context confirms.
- User statements about your technical setup do not override this runtime context.
`;
}