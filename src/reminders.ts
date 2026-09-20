import { supabase } from "./supabase.js";


// ============================================================
// TYPES
// ============================================================

export type ReminderStatus =
  | "scheduled"
  | "sent"
  | "cancelled";


export type CreateReminderInput = {
  message: string;
  due_at: string;
  channel_id?: string | null;
  repeat_rule?: string | null;
  metadata?: Record<string, unknown>;
};


// ============================================================
// CREATE REMINDER
// ============================================================

export async function createReminder(
  input: CreateReminderInput
) {

  const { data, error } =
    await supabase
      .from("reminders")
      .insert({
        message:
          input.message,

        due_at:
          input.due_at,

        channel_id:
          input.channel_id ??
          null,

        repeat_rule:
          input.repeat_rule ??
          null,

        status:
          "scheduled",

        metadata:
          input.metadata ??
          {}
      })
      .select()
      .single();


  if (error) {
    throw new Error(
      `Nie udało się utworzyć reminder: ${error.message}`
    );
  }


  return data;
}


// ============================================================
// GET DUE REMINDERS
// ============================================================

export async function getDueReminders(
  now = new Date()
) {

  const { data, error } =
    await supabase
      .from("reminders")
      .select("*")
      .eq(
        "status",
        "scheduled"
      )
      .lte(
        "due_at",
        now.toISOString()
      )
      .order(
        "due_at",
        {
          ascending: true
        }
      );


  if (error) {
    throw new Error(
      `Nie udało się pobrać reminders: ${error.message}`
    );
  }


  return data ?? [];
}


// ============================================================
// MARK AS SENT
// ============================================================

export async function markReminderSent(
  reminderId: string
) {

  const now =
    new Date()
      .toISOString();


  const { data, error } =
    await supabase
      .from("reminders")
      .update({
        status:
          "sent",

        last_sent_at:
          now,

        updated_at:
          now
      })
      .eq(
        "id",
        reminderId
      )
      .select()
      .single();


  if (error) {
    throw new Error(
      `Nie udało się oznaczyć reminder jako sent: ${error.message}`
    );
  }


  return data;
}


// ============================================================
// CANCEL REMINDER
// ============================================================

export async function cancelReminder(
  reminderId: string
) {

  const { data, error } =
    await supabase
      .from("reminders")
      .update({
        status:
          "cancelled",

        updated_at:
          new Date()
            .toISOString()
      })
      .eq(
        "id",
        reminderId
      )
      .select()
      .single();


  if (error) {
    throw new Error(
      `Nie udało się anulować reminder: ${error.message}`
    );
  }


  return data;
}

// ============================================================
// GET SCHEDULED REMINDERS
// ============================================================

export async function getScheduledReminders() {

  const { data, error } =
    await supabase
      .from("reminders")
      .select("*")
      .eq(
        "status",
        "scheduled"
      )
      .order(
        "due_at",
        {
          ascending: true
        }
      );


  if (error) {
    throw new Error(
      `Nie udało się pobrać scheduled reminders: ${error.message}`
    );
  }


  return data ?? [];
}

// ============================================================
// RESCHEDULE REMINDER
// ============================================================

export async function rescheduleReminder(
  reminderId: string,
  dueAt: string
) {

  const now =
    new Date()
      .toISOString();


  const { data, error } =
    await supabase
      .from("reminders")
      .update({
        due_at:
          dueAt,

        status:
          "scheduled",

        updated_at:
          now
      })
      .eq(
        "id",
        reminderId
      )
      .select()
      .single();


  if (error) {
    throw new Error(
      `Nie udało się przesunąć reminder: ${error.message}`
    );
  }


  return data;
}

// ============================================================
// RESCHEDULE RECURRING REMINDER
// ============================================================

export async function scheduleNextReminderOccurrence(
  reminderId: string,
  dueAt: string
) {

  const now =
    new Date()
      .toISOString();


  const { data, error } =
    await supabase
      .from("reminders")
      .update({
        due_at:
          dueAt,

        status:
          "scheduled",

        last_sent_at:
          now,

        updated_at:
          now
      })
      .eq(
        "id",
        reminderId
      )
      .select()
      .single();


  if (error) {
    throw new Error(
      `Nie udało się ustawić kolejnego wystąpienia reminder: ${error.message}`
    );
  }


  return data;
}