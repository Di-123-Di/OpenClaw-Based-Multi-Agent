// skills/orchestrator/pythonBridge.ts
// Week 9 -- runs a Python agent CLI script (recommendation/agent_cli.py,
// rag/agent_cli.py) as a subprocess and parses its single line of JSON
// stdout. This is how the TypeScript orchestrator reaches skills that were
// built in Python (they need numpy/sklearn/openai, not available in Node)
// without reimplementing them.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const VENV_PYTHON = path.join(PROJECT_ROOT, "venv", "bin", "python3");
const TIMEOUT_MS = 30_000;

// scriptRelativePath is relative to the project root, e.g. "skills/rag/agent_cli.py".
export function callPythonAgent(scriptRelativePath: string, args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(PROJECT_ROOT, scriptRelativePath);
    // stdin: "ignore" -- these scripts never read from stdin. Leaving the
    // default open, unwritten pipe there was observed to occasionally stall
    // Node's detection that the child had finished, even though the Python
    // process itself ran and exited normally (confirmed by running the same
    // script directly, outside Node, with no issue).
    const proc = spawn(VENV_PYTHON, [scriptPath, ...args], { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => { stdout += chunk; });
    proc.stderr.on("data", (chunk) => { stderr += chunk; });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`${scriptRelativePath} timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    proc.on("error", (err) => { clearTimeout(timer); reject(err); }); // e.g. venv python not found
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`${scriptRelativePath} exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error(`${scriptRelativePath} did not return valid JSON.\nstdout: ${stdout}\nstderr: ${stderr}`));
      }
    });
  });
}
