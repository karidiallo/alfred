import {
  getAlfredConfig,
  setAlfredConfig
} from "./supabase.js";


// ============================================================
// TYPES
// ============================================================

export type PendingReminder = {
  reminder_message: string | null;
  original_message: string;
  created_at: string;
};


// ============================================================
// KEY
// ============================================================

function getPendingReminderKey(
  conversationId: string
): string {

  return `pending_reminder:${conversationId}`;
}


// ============================================================
// GET
// ============================================================

export async function getPendingReminder(
  conversationId: string
): Promise<PendingReminder | null> {

  const rows =
    await getAlfredConfig(
      getPendingReminderKey(
        conversationId
      )
    );

  if (!rows.length) {
    return null;
  }


  const value =
    rows[0]?.value;


  if (
    !value ||
    typeof value !== "object" ||
    !("active" in value) ||
    value.active !== true
  ) {
    return null;
  }


  if (
    !("original_message" in value) ||
    typeof value.original_message !== "string"
  ) {
    return null;
  }


  return {
    reminder_message:
      "reminder_message" in value &&
      typeof value.reminder_message === "string"
        ? value.reminder_message
        : null,

    original_message:
      value.original_message,

    created_at:
      "created_at" in value &&
      typeof value.created_at === "string"
        ? value.created_at
        : new Date().toISOString()
  };
}


// ============================================================
// SAVE
// ============================================================

export async function savePendingReminder(
  conversationId: string,
  input: {
    reminder_message: string | null;
    original_message: string;
  }
): Promise<void> {

  await setAlfredConfig(
    getPendingReminderKey(
      conversationId
    ),
    {
      active:
        true,

      reminder_message:
        input.reminder_message,

      original_message:
        input.original_message,

      created_at:
        new Date().toISOString()
    }
  );
}


// ============================================================
// CLEAR
// ============================================================

export async function clearPendingReminder(
  conversationId: string
): Promise<void> {

  await setAlfredConfig(
    getPendingReminderKey(
      conversationId
    ),
    {
      active:
        false,

      cleared_at:
        new Date().toISOString()
    }
  );
}