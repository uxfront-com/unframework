// When an ssr shard registers L14's deliberate throws (`ssrThrows`, ADR-0078) as their own suite.
// Vitest fails a describe without a test, so the suite registers only when it holds one: a case
// of the shard that throws on purpose and has output on the target. A project the run adds as
// some case's reference renders those cases alone (ADR-0057), so its shards may hold none. The
// one exception keeps a lost L14 corpus loud: when no case of the corpus throws on purpose, every
// shard registers the suite empty, and Vitest fails it.
import type { CaseInfo } from "./cases.ts";

/** Whether a case's server render throws on purpose (`ssrThrows`, ADR-0078). */
export const throwsOnPurpose = (info: Pick<CaseInfo, "config">): boolean =>
	info.config.ssrThrows !== undefined;

/**
 * Whether a shard registers the `ssr [<target>] throws` suite. `shard` is the shard's cases,
 * `corpus` every case of the corpus, whatever the project renders, and `hasOutput` whether a
 * case has output on the target: a case with compile errors has none, and registers no test.
 */
export function registersThrows<T extends Pick<CaseInfo, "config">>(
	shard: readonly T[],
	corpus: readonly T[],
	hasOutput: (info: T) => boolean,
): boolean {
	return (
		shard.some((info) => throwsOnPurpose(info) && hasOutput(info)) || !corpus.some(throwsOnPurpose)
	);
}
