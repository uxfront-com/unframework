import { workDir } from "./apps.ts";
import { clearPorts, recordedPorts, stillListening } from "./ports.ts";

export default async function globalTeardown(): Promise<void> {
  const work = workDir();
  const ports = recordedPorts(work);
  const open = await stillListening(ports);
  if (open.length > 0) {
    throw new Error(`Dev servers outlived the run, on port ${open.join(", ")}.`);
  }
  clearPorts(work);
  process.stdout.write(`[e2e] dev server ports closed: ${ports.join(", ") || "none"}\n`);
}
