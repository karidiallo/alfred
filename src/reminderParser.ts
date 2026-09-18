import "dotenv/config";

import OpenAI from "openai";


// ============================================================
// CLIENT
// ============================================================

const client =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY
  });


// ============================================================
// TYPES
// ============================================================

export type ParsedReminder = {
  is_reminder: boolean;

  reminder_message:
    string | null;

  due_at:
    string | null;

  repeat_rule:
    string | null;

  clarification_needed:
    boolean;

  clarification_question:
    string | null;
};


// ============================================================
// PARSE NATURAL LANGUAGE REMINDER
// ============================================================

export async function parseReminderRequest(
  userMessage: string
): Promise<ParsedReminder> {

  const timezone =
    process.env.ALFRED_TIMEZONE ||
    "Europe/Warsaw";

  const now =
    new Date();

  const response =
    await client.responses.create({

      model:
        process.env.MEMORY_KEEPER_MODEL ||
        "gpt-5.6-luna",

      instructions: `
You are Alfred Reminder Parser.

Your ONLY job is to detect and parse explicit reminder requests.

Current UTC time:
${now.toISOString()}

User timezone:
${timezone}

Return ONLY valid JSON.

Exact shape:

{
  "is_reminder": false,
  "reminder_message": null,
  "due_at": null,
  "repeat_rule": null,
  "clarification_needed": false,
  "clarification_question": null
}

RULES:

1. A reminder requires explicit intent such as:
- "przypomnij mi"
- "przypomnij"
- "napisz mi za..."
- "daj mi znać..."
- "remind me"

2. Casual statements about future plans are NOT reminders.

Example:
"Jutro idę na siłownię."
→ is_reminder = false

"Przypomnij mi jutro o siłowni."
→ is_reminder = true

3. reminder_message should contain WHAT Kari wants to be reminded about,
without unnecessary wording.

Example:
"Przypomnij mi za godzinę, żebym zadzwoniła do Orange."
→ "Zadzwoń do Orange"

4. due_at MUST be an ISO 8601 timestamp representing the intended moment.

5. Interpret relative dates using the supplied current time and timezone.

Examples:
- "za 20 minut"
- "za godzinę"
- "jutro o 9"
- "w sobotę o 12"
- "18 września o 16:30"

6. If Kari provides a day but no exact time and the intended time cannot
be safely inferred, set:

clarification_needed = true

and write ONE short clarification question.

Example:
"Przypomnij mi jutro o Orange."
→ ask what time.

7. Do NOT invent a time.

8. For now, recurring reminders are NOT implemented.

If the user asks:
- "codziennie"
- "co tydzień"
- "w każdy poniedziałek"

set:
is_reminder = true
clarification_needed = true
clarification_question =
"Powtarzalne przypomnienia jeszcze nie są włączone. Chcesz ustawić pojedyncze przypomnienie?"

9. repeat_rule should currently always be null.

10. If the message is not a reminder request, return is_reminder=false.

11. Do not include markdown or commentary.
`,

      input:
        userMessage
    });


  const raw =
    response.output_text
      ?.trim();


  if (!raw) {
    throw new Error(
      "Reminder parser returned empty output."
    );
  }


  let parsed:
    ParsedReminder;


  try {

    parsed =
      JSON.parse(raw);

  } catch {

    throw new Error(
      `Reminder parser returned invalid JSON: ${raw}`
    );
  }


  // ==========================================================
  // BASIC VALIDATION
  // ==========================================================

  if (
    parsed.is_reminder &&
    parsed.due_at &&
    !parsed.clarification_needed
  ) {

    const due =
      new Date(
        parsed.due_at
      );

    if (
      Number.isNaN(
        due.getTime()
      )
    ) {

      throw new Error(
        "Reminder parser returned invalid due_at."
      );
    }


    if (
      due.getTime() <=
      Date.now()
    ) {

      return {
        ...parsed,

        due_at:
          null,

        clarification_needed:
          true,

        clarification_question:
          "Ta godzina już minęła. Na kiedy mam ustawić przypomnienie?"
      };
    }
  }


  return parsed;
}