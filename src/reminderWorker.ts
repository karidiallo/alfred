import {
  saveLastSentReminder
} from "./lastReminderState.js";

import {
  getDueReminders,
  markReminderSent,
  scheduleNextReminderOccurrence
} from "./reminders.js";

import {
  sendProactiveDiscordMessage
} from "./discord.js";


// ============================================================
// REMINDER WORKER
// ============================================================

let workerRunning = false;

function getNextRecurringDueAt(
  currentDueAt: string,
  repeatRule: string
): string {

  const current =
    new Date(currentDueAt);


  if (
    Number.isNaN(
      current.getTime()
    )
  ) {
    throw new Error(
      `Invalid recurring due_at: ${currentDueAt}`
    );
  }


  const next =
    new Date(current);


  if (
    repeatRule === "daily"
  ) {

    next.setDate(
      next.getDate() + 1
    );

    return next.toISOString();
  }


  const weeklyMatch =
    repeatRule.match(
      /^weekly:([1-7])$/
    );


  if (weeklyMatch) {

    next.setDate(
      next.getDate() + 7
    );

    return next.toISOString();
  }


  throw new Error(
    `Unsupported repeat rule: ${repeatRule}`
  );
}

async function processDueReminders() {

  if (workerRunning) {
    return;
  }

  workerRunning = true;

  try {

    const reminders =
      await getDueReminders();

    for (const reminder of reminders) {

      try {

        const targetChannelId =
  reminder.channel_id ??
  process.env.DISCORD_CHANNEL_ID;


await sendProactiveDiscordMessage(
  reminder.message,
  targetChannelId
);


if (
  reminder.repeat_rule
) {

  const nextDueAt =
    getNextRecurringDueAt(
      reminder.due_at,
      reminder.repeat_rule
    );


  await scheduleNextReminderOccurrence(
    reminder.id,
    nextDueAt
  );


  console.log(
    `🔁 Recurring reminder rescheduled: ${reminder.id} → ${nextDueAt}`
  );

} else {

  await markReminderSent(
    reminder.id
  );
}


if (targetChannelId) {

  await saveLastSentReminder(
    targetChannelId,
    {
      id:
        reminder.id,

      message:
        reminder.message
    }
  );
}

        console.log(
          `⏰ Reminder sent: ${reminder.id}`
        );

      } catch (error) {

        console.error(
          `⚠️ Reminder failed: ${reminder.id}`,
          error
        );
      }
    }

  } catch (error) {

    console.error(
      "⚠️ Reminder worker error:",
      error
    );

  } finally {

    workerRunning = false;
  }
}


// ============================================================
// START WORKER
// ============================================================

export function startReminderWorker() {

  console.log(
    "⏰ Reminder worker started"
  );

  void processDueReminders();

  setInterval(
    () => {
      void processDueReminders();
    },
    30_000
  );
}