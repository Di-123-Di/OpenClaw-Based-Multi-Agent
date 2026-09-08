// skills/email/emailTool.ts
// Week 11 -- the draft-then-approve email workflow. Matches the handbook's
// two-step contract (draftEmail / sendApprovedEmail) but adds one real
// enforcement beyond the letter of the snippet: sendApprovedEmail checks
// draft.status itself, instead of trusting that whoever calls it already
// got a human's yes. "Never send without approval" is a rule a caller can
// forget to honor; a status check the function refuses to skip cannot be
// forgotten the same way -- see guardrails.test.ts for the tests that hold
// this to account.
import nodemailer from "nodemailer";

export type EmailDraft = {
  to: string;
  subject: string;
  body: string;
  status: "pending_approval" | "approved";
};

// Exported (not just module-private) so guardrails.test.ts can swap
// transporter.sendMail for a fake before running its assertions -- the only
// way to prove "draftEmail never sends" and "sendApprovedEmail sends
// exactly once, only after approval" without actually hitting Gmail's SMTP
// server from an automated test run.
export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
});

// STEP 1: Draft -- never sends. Every email use case in templates.ts
// bottoms out here, never at sendApprovedEmail directly.
export async function draftEmail(
  to: string, subject: string, body: string
): Promise<{ draft: EmailDraft; status: string }> {
  const draft: EmailDraft = { to, subject, body, status: "pending_approval" };
  return { draft, status: "pending_approval" };
}

// STEP 2: A human (or the chat flow standing in for one) explicitly signs
// off on the exact drafted content. Returns a new object rather than
// mutating in place, so a caller can't accidentally "approve" a draft by
// holding a stale reference to one that was already shown to the user.
export function approveDraft(draft: EmailDraft): EmailDraft {
  return { ...draft, status: "approved" };
}

// STEP 3: Send only a draft that has actually been through approveDraft().
// This is the one line standing between "drafted" and "delivered" -- it's
// the whole point of the skill, so it's covered first in the guardrail
// suite.
export async function sendApprovedEmail(draft: EmailDraft): Promise<void> {
  if (draft.status !== "approved") {
    throw new Error("Refusing to send: draft has not been approved.");
  }
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: draft.to,
    subject: draft.subject,
    html: draft.body,
  });
}
