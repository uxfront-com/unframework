import type { CompileResult, OutputFile } from "../src/index.ts";

/**
 * A compile's files for a target, without its shared helper modules (ADR-0121): the components',
 * the sheets and the copies, which a test about them counts.
 */
export function ownOutputs(result: CompileResult, target: string): OutputFile[] {
  const helpers = new Set(result.helpers[target] ?? []);
  return (result.outputs[target] ?? []).filter((file) => !helpers.has(file.path));
}
