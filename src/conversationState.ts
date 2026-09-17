import {
  getAlfredConfig,
  setAlfredConfig
} from "./supabase.js";


// ============================================================
// PERSISTENT CONVERSATION CONTINUITY
// ============================================================

function getConversationKey(
  conversationId: string
): string {

  return `conversation_response:${conversationId}`;
}


// ------------------------------------------------------------
// READ LAST RESPONSE ID
// ------------------------------------------------------------

export async function getStoredResponseId(
  conversationId: string
): Promise<string | null> {

  const rows =
    await getAlfredConfig(
      getConversationKey(conversationId)
    );

  if (!rows.length) {
    return null;
  }

  const value =
    rows[0]?.value;

  if (typeof value === "string") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "response_id" in value &&
    typeof value.response_id === "string"
  ) {
    return value.response_id;
  }

  return null;
}


// ------------------------------------------------------------
// SAVE LAST RESPONSE ID
// ------------------------------------------------------------

export async function saveStoredResponseId(
  conversationId: string,
  responseId: string
): Promise<void> {

  await setAlfredConfig(
    getConversationKey(conversationId),
    {
      response_id: responseId,
      updated_at: new Date().toISOString()
    }
  );
}