// The Solid 2 output, formatted and not, compiled by @solidjs/compiler for the server as
// @solidjs/vite-plugin compiles it (`ssr: true`) and rendered by Solid's server renderer with the
// suite's props: the DOM must be exactly the one the reference describes. The compiler collapses
// raw whitespace in JSX text into one space, so this is where a raw tab or Unicode space would
// show.
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { emitParity, parityProps, paritySuites } from "../../codegen/test/render-parity-node.ts";
import { compareCases, parseHtml } from "../../codegen/test/render-parity.ts";
import type { ParitySuite } from "../../codegen/test/render-parity.ts";
import target from "../src/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { compileForServer, packageDir } from "./fixtures.ts";

const scratch = join(packageDir, ".uf-tmp", `render-parity-${randomUUID()}`);
mkdirSync(scratch, { recursive: true });
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** Compiles and server-renders the parity component, as the `ssr:solid2` project would. */
async function render(suite: ParitySuite, format: boolean): Promise<string> {
	const [file] = await emitParity(target, suite, { format });
	const code = await compileForServer(file!.contents, join(scratch, file!.path));
	const path = join(scratch, `${randomUUID()}.js`);
	writeFileSync(path, code);
	return renderToString(((await import(path)) as { default: unknown }).default, {
		props: parityProps(suite),
	});
}

describe.each([true, false])("solid2 output (formatted: %s), rendered by Solid 2", (format) => {
	it.each(paritySuites())(
		"renders $title exactly as the reference describes them",
		async (suite) => {
			const html = await render(suite, format);
			// Solid 2's hydration key is `_hk`, where Solid 1 wrote `data-hk`.
			const rendered = parseHtml(html, { ignoreAttribute: (name) => name === "_hk" });
			for (const { name, expected, actual } of compareCases(rendered, suite)) {
				expect.soft(actual, name).toEqual(expected);
			}
		},
	);
});
