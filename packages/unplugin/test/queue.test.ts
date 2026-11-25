import { join } from "node:path";
// Requests whose compiles are current don't wait for another file's compile. Qwik loads a
// component's segments inside a test (ADR-0050), the segments are the first modules to import the
// component's children, and on a busy server every request queued behind every other file's
// compile, so a test timed out.
import { setTimeout as sleep } from "node:timers/promises";

import type * as Compiler from "@unframework.dev/compiler";
import { afterEach, describe, expect, it, vi } from "vitest";

import unframework from "../src/vite.ts";
import { codeOf, createProject, startServer } from "./fixtures.ts";
import type { Project, TestServer } from "./fixtures.ts";

// A compile of `held.file` waits for `release` once `held` is set: another file's compile, in
// flight on the same server.
const stub = vi.hoisted(() => ({
	held: undefined as { file: string; started: () => void; release: Promise<void> } | undefined,
}));

vi.mock("@unframework.dev/compiler", async (importActual) => {
	const actual = await importActual<typeof Compiler>();
	return {
		...actual,
		createProject: (options: Parameters<typeof actual.createProject>[0]) => {
			const created = actual.createProject(options);
			return {
				...created,
				compile: async (file: string) => {
					const held = stub.held;
					if (held?.file === file) {
						held.started();
						await held.release;
					}
					return created.compile(file);
				},
			};
		},
	};
});

const USE_LABEL = [
	'import { computed } from "@uxfront/unframework";',
	"",
	"export function useLabel(text: string) {",
	"  const label = computed(() => text.toUpperCase());",
	"  return { label };",
	"}",
	"",
].join("\n");

const PICKER = 'export default function Picker() {\n  return <select aria-label="Pick" />;\n}\n';

const MENU = [
	'import { useLabel } from "./useLabel.uf.ts";',
	'import Picker from "./Picker.uf.tsx";',
	"",
	"export default function Menu() {",
	'  const { label } = useLabel("menu");',
	"  return (",
	"    <nav>",
	"      {label.value}",
	"      <Picker />",
	"    </nav>",
	"  );",
	"}",
	"",
].join("\n");

const ROWS = "export default function Rows() {\n  return <ul />;\n}\n";

const WRAPPER = [
	'import Rows from "./Rows.uf.tsx";',
	"",
	"export default function Wrapper() {",
	"  return <div><Rows /></div>;",
	"}",
	"",
].join("\n");

const PAGE = [
	'import Wrapper from "./Wrapper.uf.tsx";',
	"",
	"export default function Page() {",
	"  return <main><Wrapper /></main>;",
	"}",
	"",
].join("\n");

const OTHER = "export default function Other() {\n  return <p>Other</p>;\n}\n";

/** A segment Qwik's optimizer splits off a module, whose imports are the module's. */
const segmentOf = (file: string, name: string) => `${file}_${name}_component_Jf8mu3bRpe0.js`;

/** What a request gave, or that it was still waiting once the compile had had time to finish. */
const settle = <T>(request: Promise<T>) =>
	Promise.race([request.then((value) => ({ value })), sleep(2000).then(() => "waiting" as const)]);

/** The code a request that settled loaded. */
const loadedCode = (outcome: { value: unknown } | "waiting") => {
	expect(outcome).not.toBe("waiting");
	return outcome === "waiting" ? "" : codeOf(outcome.value);
};

describe("a request whose compile is current", () => {
	let project: Project | undefined;
	let server: TestServer | undefined;
	let release: (() => void) | undefined;

	afterEach(async () => {
		release?.();
		stub.held = undefined;
		await server?.close();
		project?.remove();
	});

	/** A Qwik server over the files, with `Other.uf.tsx`'s compile in flight and held. */
	async function start(load: string[]) {
		project = createProject({
			"useLabel.uf.ts": USE_LABEL,
			"Picker.uf.tsx": PICKER,
			"Menu.uf.tsx": MENU,
			"Rows.uf.tsx": ROWS,
			"Wrapper.uf.tsx": WRAPPER,
			"Page.uf.tsx": PAGE,
			"Other.uf.tsx": OTHER,
		});
		const at = (name: string) => join(project!.root, name);
		server = await startServer(project.root, unframework({ target: "qwik" }));
		const { client } = server;
		// The spec file imports only the main component, so only its module loads before the test.
		for (const name of load) codeOf(await client.pluginContainer.load(at(name)));
		const started = Promise.withResolvers<void>();
		const released = Promise.withResolvers<void>();
		release = released.resolve;
		stub.held = { file: "Other.uf.tsx", started: started.resolve, release: released.promise };
		const other = client.pluginContainer.load(at("Other.uf.tsx"));
		await started.promise;
		return { client, at, other };
	}

	it("resolves a child's output from a segment, and loads it, while another compile runs", async () => {
		const { client, at, other } = await start(["Menu.uf.tsx"]);
		const segment = segmentOf(at("Menu.uf.tsx"), "Menu");
		// The child's first compile ran as its parent loaded.
		const picker = await settle(client.pluginContainer.resolveId("./Picker", segment));
		expect(picker).toEqual({ value: expect.objectContaining({ id: at("Picker.uf.tsx") }) });
		const loaded = await settle(client.pluginContainer.load(at("Picker.uf.tsx")));
		expect(loadedCode(loaded)).toContain('aria-label="Pick"');
		// A module of composables the parent imports, too.
		const composables = await settle(client.pluginContainer.resolveId("./useLabel", segment));
		expect(composables).toEqual({ value: expect.objectContaining({ id: at("useLabel.uf.ts") }) });
		const used = await settle(client.pluginContainer.load(at("useLabel.uf.ts")));
		expect(loadedCode(used)).toContain("useLabel");
		release?.();
		expect(codeOf(await other)).toContain("Other");
	});

	it("reaches a child's children, which only the child imports", async () => {
		const { client, at } = await start(["Page.uf.tsx"]);
		const wrapper = await settle(
			client.pluginContainer.resolveId("./Wrapper", segmentOf(at("Page.uf.tsx"), "Page")),
		);
		expect(wrapper).toEqual({ value: expect.objectContaining({ id: at("Wrapper.uf.tsx") }) });
		const rows = await settle(
			client.pluginContainer.resolveId("./Rows", segmentOf(at("Wrapper.uf.tsx"), "Wrapper")),
		);
		expect(rows).toEqual({ value: expect.objectContaining({ id: at("Rows.uf.tsx") }) });
		const loaded = await settle(client.pluginContainer.load(at("Rows.uf.tsx")));
		expect(loadedCode(loaded)).toContain("<ul");
	});

	it("waits for its turn once a file it reached has changed, and gives the new compile", async () => {
		const { client, at } = await start(["Menu.uf.tsx"]);
		project!.write("Picker.uf.tsx", PICKER.replace('"Pick"', '"Choose"'));
		// No watcher reports the edit: the request finds it on disk, and queues behind the held compile.
		const request = client.pluginContainer.load(at("Picker.uf.tsx"));
		expect(await settle(request)).toBe("waiting");
		release?.();
		const code = codeOf(await request);
		expect(code).toContain('aria-label="Choose"');
		expect(code).not.toContain('aria-label="Pick"');
	});
});
