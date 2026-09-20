import {
  saveLastSentReminder
} from "./lastReminderState.js";

import {
  getDueReminders,
  markReminderSent
} from "./reminders.js";

import {
  sendProactiveDiscordMessage
} from "./discord.js";


// ============================================================
// REMINDER WORKER
// ============================================================

let workerRunning = false;


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


await markReminderSent(
  reminder.id
);


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