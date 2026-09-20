import {
  getAlfredConfig,
  setAlfredConfig
} from "./supabase.js";


// ============================================================
// TYPES
// ============================================================

export type LastSentReminder = {
  reminder_id: string;
  message: string;
  sent_at: string;
};


// ============================================================
// KEY
// ============================================================

function getKey(
  channelId: string
): string {

  return `last_sent_reminder:${channelId}`;
}


// ============================================================
// SAVE
// ============================================================

export async function saveLastSentReminder(
  channelId: string,
  reminder: {
    id: string;
    message: string;
  }
): Promise<void> {

  await setAlfredConfig(
    getKey(channelId),
    {
      reminder_id:
        reminder.id,

      message:
        reminder.message,

      sent_at:
        new Date().toISOString()
    }
  );
}


// ============================================================
// GET
// ============================================================

export async function getLastSentReminder(
  channelId: string
): Promise<LastSentReminder | null> {

  const rows =
    await getAlfredConfig(
      getKey(channelId)
    );

  if (!rows.length) {
    return null;
  }


  const value =
    rows[0]?.value;


  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }


  if (
    !("reminder_id" in value) ||
    typeof value.reminder_id !== "string" ||
    !("message" in value) ||
    typeof value.message !== "string" ||
    !("sent_at" in value) ||
    typeof value.sent_at !== "string"
  ) {
    return null;
  }


  return {
    reminder_id:
      value.reminder_id,

    message:
      value.message,

    sent_at:
      value.sent_at
  };
}