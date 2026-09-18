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

        await sendProactiveDiscordMessage(
          reminder.message,
          reminder.channel_id ??
          undefined
        );

        await markReminderSent(
          reminder.id
        );

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