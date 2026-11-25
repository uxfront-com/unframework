// Probes (ADR-0119, ADR-0122): an element that may render one of several tags is checked as each
// tag. The first tag's check is the lowering, and each later one runs in a probe of the render
// context, whose findings that the first lacks are reported too, so the order of the tags
// changes nothing.

import { Reporter } from "./context.ts";
import type { RenderContext } from "./render.ts";

/**
 * A copy of the render context that reports into a reporter of its own and leaves the context's
 * lists and the props' rest as they are: each candidate after the first is checked in one, and only what it finds
 * that the first did not is reported.
 */
export function probe(render: RenderContext): RenderContext {
	return {
		...render,
		reporter: new Reporter(render.reporter.file),
		// Each tag lowers the props' rest it spreads once, so a later tag's must not find the first
		// tag's spread (UF2001, ADR-0122).
		...(render.restProps ? { restProps: { ...render.restProps } } : {}),
		bindings: [...render.bindings],
		attached: new Map(render.attached),
		loopVariables: new Map(render.loopVariables),
		facts: {
			nestedCalls: [...render.facts.nestedCalls],
			getterKinds: new Map(render.facts.getterKinds),
			tickCallbacks: [...render.facts.tickCallbacks],
			passed: new Map(render.facts.passed),
		},
	};
}

/** Reports what each later candidate's check found that the first one's did not. */
export function merge(render: RenderContext, mark: number, probes: readonly RenderContext[]): void {
	const seen = new Set(
		render.reporter.diagnostics
			.slice(mark)
			.map((each) => `${each.code} ${each.span.start} ${each.message}`),
	);
	for (const each of probes) {
		for (const diagnostic of each.reporter.diagnostics) {
			const key = `${diagnostic.code} ${diagnostic.span.start} ${diagnostic.message}`;
			if (seen.has(key)) continue;
			seen.add(key);
			render.reporter.diagnostics.push(diagnostic);
		}
	}
}
