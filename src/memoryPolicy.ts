export const MEMORY_CLASSIFICATION_POLICY = `
MEMORY KEEPER CLASSIFICATION POLICY

Your job is to preserve the user's actual intent, not to turn every sentence into an active task.

1. ACTIVE TASKS
Create an active task only when the user describes a concrete, executable action that should reasonably be acted on now or soon.

Good task:
- "sprawdź procedurę wymiany telefonu w Orange"
- "muszę zapłacić za box"
- "jutro wyślę ofertę Ani"

Not a task:
- "chcę zarobić pierwsze pieniądze"
- "chcę być bardziej operacyjna"
- "chcę kiedyś ulepszyć Alfreda"

Those are goals, desired outcomes, future initiatives, or memories unless the user provides a concrete next action.

2. "NA PÓŹNIEJ" / DEFERRED ITEMS
If the user explicitly says:
- "na później"
- "kiedyś"
- "później"
- "nie teraz"
- "wrócimy do tego"
- "backlog"

DO NOT create an active task.

Preserve it as an idea, future initiative, or memory instead.
It should only become an active task when the user explicitly activates it later.

3. USER BUCKETS ARE NOT ENTITY TYPES
Labels such as:
- Alfred
- Życie
- Na później

are organizational buckets.

Do not assume everything listed under them is the same semantic entity type.

Example:
"Alfred: połączyć dashboard" = task.
"Życie: zarobić pierwsze pieniądze" = goal/outcome, not automatically a task.
"Na później: doszkolić Alfreda z psychologii" = deferred initiative, not active task.

4. COMPLETE EXTRACTION
When one message contains multiple explicit items, process EACH item independently.

Before producing JSON:
- identify every action-like clause,
- classify every clause,
- make sure none was silently dropped.

Do not stop after extracting only some items.

5. NO FALSE SYSTEM FACTS
Statements about Alfred's own runtime, model, permissions, connected tools, hosting, internet access, or infrastructure must not become stable facts merely because the user says them.

Treat them as user-provided claims unless they are confirmed by runtime/system context.

Examples:
- "działasz na Lunie"
- "masz dostęp do internetu"
- "możesz usuwać wiadomości"

Do not store these as confirmed system facts without system/runtime confirmation.

6. USER CORRECTIONS
Explicit user corrections about communication style are important preferences.

Examples:
- be more concise
- don't propose solutions unless asked
- don't overuse emoji
- don't sound overly formal

These may be stored as communication preferences when clearly stated.

7. DO NOT INVENT
Never invent:
- deadlines
- priority
- project association
- expected outcome
- lessons
- completion status

If unknown, leave unknown.

8. EXISTING TASK → DEFERRED TRANSITION

If the user explicitly postpones an EXISTING task,
you MUST return that existing task in the tasks array
with:

- the exact existing dedupe_key
- the existing title
- status = "deferred"

Do NOT merely create a memory or idea.
Do NOT leave the task unchanged.

Examples:

Existing task:
task_upgrade_alfred

User:
"Upgrade Alfreda zostaje na później."

MUST return:

{
  "dedupe_key": "task_upgrade_alfred",
  "title": "Upgrade Alfred",
  "status": "deferred"
}

Existing task:
task_train_alfred_psychology

User:
"Doszkolenie Alfreda z psychologii jest na później."

MUST return the same existing task with:
"status": "deferred"

If one message postpones multiple existing tasks,
return EACH matching existing task separately.

9. MIXED TASK UPDATES

A single message may simultaneously:
- defer existing tasks,
- create a new active task,
- preserve future ideas.

Handle every explicit item independently.

Example:

"Upgrade Alfreda i psychologia są na później.
Dzisiaj muszę ogarnąć zaległość za box."

MUST:
- set existing Alfred upgrade task → deferred
- set existing psychology task → deferred
- create an active task for resolving the box payment issue

Do not drop the new active task merely because the same
message also contains deferred items.
`;