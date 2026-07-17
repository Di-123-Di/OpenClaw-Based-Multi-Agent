// skills/property-search/chat.ts
// Week 4 demo — simulate a multi-turn conversation for one user.
import { handleMessage } from "./conversation.ts";
import { clearSession } from "./session.ts";

const userId = "demo-user";
clearSession(userId); // start fresh

// A scripted conversation. Note: the city is said ONCE, in turn 1.
const conversation = [
  "Find homes in Irvine",
  "under 2m",
  "condos with at least 3 beds",
];

for (const message of conversation) {
  console.log(`\nUser:  ${message}`);
  const reply = await handleMessage(userId, message);
  console.log(`Agent: ${reply}`);
}
process.exit(0);
