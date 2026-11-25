// An attribute only some of a `<component is>`'s tags take, on Qwik's server (ADR-0119). Qwik
// writes an attribute its types don't declare as an object spread, so the guard is on the
// spread's key: a key whose value is `undefined` renders no attribute, as a prop's does.
import { describe, expect, it } from "vitest";

import { renderToString } from "../../src/toolchain/server.ts";

/** A fixture's components, compiled by Qwik's plugin (a computed path: see server.test.ts). */
const load = async (name: string): Promise<Readonly<Record<string, unknown>>> =>
	import(`../fixtures/${name}.tsx`);
const fixtures = await load("UntypedOnly");

describe("an untyped attribute only some tags take, on Qwik's server", () => {
	it("renders on the tag that takes it, and not on the other", async () => {
		const input = await renderToString(fixtures.default, { props: { x: true } });
		expect(input).toMatch(/<input [^>]*form="f1"/);
		expect(input).toMatch(/<input [^>]*list="l1"/);
		const link = await renderToString(fixtures.default, { props: { x: false } });
		expect(link).toMatch(/<a [^>]*aria-label="Field"/);
		expect(link).not.toContain("form=");
		expect(link).not.toContain("list=");
	});
});
