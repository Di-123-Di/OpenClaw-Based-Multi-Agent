// skills/email/guardrails.test.ts
// Week 11 -- the "safety guardrail test suite" the handbook's Deliverable
// calls out by name. Matches the earlier weeks' plain PASS/FAIL script
// style (no test framework) since that's what parse.ts/classifyIntent.ts
// already established.
//
// transporter.sendMail is swapped for a spy before anything runs, and never
// restored to the real Gmail transport -- an automated test suite must
// never be able to send a real email, no matter what a test asserts.
//
// Usage: node skills/email/guardrails.test.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { draftEmail, approveDraft, sendApprovedEmail, transporter } from "./emailTool.ts";
import { buildListingAlertEmail } from "./templates.ts";

const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url));

let sendMailCalls: any[] = [];
transporter.sendMail = (async (opts: any) => { sendMailCalls.push(opts); }) as any;

let passed = 0;
let total = 0;
function check(name: string, ok: boolean) {
  total++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (ok) passed++;
}

console.log("=== Email guardrail test suite ===");

// 1. Drafting alone must never touch the transporter.
sendMailCalls = [];
const { draft } = await draftEmail("test@example.com", "Subject", "Body");
check("draftEmail never calls transporter.sendMail", sendMailCalls.length === 0);
check("draftEmail returns status pending_approval", draft.status === "pending_approval");

// 2. Sending an un-approved draft must be refused, structurally -- not by
// convention, and not by trusting the caller.
sendMailCalls = [];
let rejectedUnapproved = false;
try {
  await sendApprovedEmail(draft);
} catch {
  rejectedUnapproved = true;
}
check("sendApprovedEmail refuses a draft that was never approved", rejectedUnapproved);
check("...and still never touches the transporter", sendMailCalls.length === 0);

// 3. Only after explicit approval does a send actually go out.
sendMailCalls = [];
const approved = approveDraft(draft);
await sendApprovedEmail(approved);
check("sendApprovedEmail sends exactly once after approval", sendMailCalls.length === 1);
check("...to the address on the approved draft", sendMailCalls[0]?.to === draft.to);

// 4. No source file in this skill may log a secret. This is a static scan,
// not a runtime check, because "never happens to log it in the paths this
// test exercised" isn't the same guarantee as "the code has no line that
// could."
const sourceFiles = ["emailTool.ts", "templates.ts"];
let noSecretsLogged = true;
for (const file of sourceFiles) {
  const content = readFileSync(path.join(SKILL_DIR, file), "utf-8");
  for (const line of content.split("\n")) {
    const logsSomething = /console\.(log|error|warn|info)|logger\./.test(line);
    const mentionsSecret = /EMAIL_PASSWORD/.test(line);
    if (logsSomething && mentionsSecret) noSecretsLogged = false;
  }
}
check("no console/logger line in emailTool.ts or templates.ts mentions EMAIL_PASSWORD", noSecretsLogged);

// 5. Template builders may only ever draft, never send -- enforced by
// checking the import surface itself, not just by not calling it in tests.
// Scoped to actual `import` lines (not comments/prose) so this can't false-
// positive on a code comment that merely mentions the function by name.
const templatesSource = readFileSync(path.join(SKILL_DIR, "templates.ts"), "utf-8");
const importsSendApproved = templatesSource
  .split("\n")
  .some((line) => /^\s*import\b/.test(line) && /\bsendApprovedEmail\b/.test(line));
check(
  "templates.ts never imports sendApprovedEmail (drafts only, never sends)",
  !importsSendApproved
);

// 6. Row-limit guardrail: "Export or bulk-download full MLS datasets" is a
// NEVER rule. A listing-alert query spanning 15 years must still come back
// capped, the same ≤50-row limit every other skill's queries already
// enforce in property-search/search.ts.
const { matchCount } = await buildListingAlertEmail(
  "test@example.com",
  { city: null, maxPrice: null, minBeds: null, minBaths: null, minSqft: null, type: null, pool: null, hasView: null },
  "2010-01-01"
);
check(`listing alert query is capped at 50 rows (got ${matchCount})`, matchCount <= 50);

console.log(`\n${passed}/${total} guardrail tests passed`);
process.exit(passed === total ? 0 : 1);
