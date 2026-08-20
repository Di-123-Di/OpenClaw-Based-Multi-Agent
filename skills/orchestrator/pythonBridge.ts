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

// scriptRelativePath is relative to the project root, e.g. "skills/rag/agent_cli.py".
export function callPythonAgent(scriptRelativePath: string, args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(PROJECT_ROOT, scriptRelativePath);
    const proc = spawn(VENV_PYTHON, [scriptPath, ...args]);

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => { stdout += chunk; });
    proc.stderr.on("data", (chunk) => { stderr += chunk; });

    proc.on("error", reject); // e.g. venv python not found
    proc.on("close", (code) => {
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
