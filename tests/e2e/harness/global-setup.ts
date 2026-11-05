import { workDir } from "./apps.ts";
import { clearPorts } from "./ports.ts";

export default function globalSetup(): void {
  // A run that was killed never reached its teardown, and its ports may now be someone else's.
  clearPorts(workDir());
}
