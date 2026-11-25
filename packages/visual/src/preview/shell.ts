// The preview's shell (ADR-0088): one page, served by a plain HTTP server, that lists the examples
// and the components and shows the selection in one labelled iframe per target, each from that
// target's own server. It sends each frame the selection and the props over `postMessage`, and
// takes answers only from those frames, at their origins. The page is static: the catalogue is
// written into it as JSON, and its script is the function below, so no build serves it, and a
// static preview writes it as its `index.html`, with each frame's page at a relative URL (ADR-0111).
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import type { PreviewCatalogue } from "./catalogue.ts";
import type { ExampleControlGroup } from "./instrument.ts";
import { CONTROL_STYLES, controlKit, PALETTE } from "./panel.ts";
import type { ControlKit } from "./panel.ts";
import { EMBED_FILE, EXAMPLE_PARAM, PREVIEW_MESSAGE, TARGET_PARAM } from "./protocol.ts";
import { PREVIEW_HOST } from "./servers.ts";

/**
 * What the shell page is given: each frame page's URL and the catalogue, without file paths. A
 * frame's URL is absolute in development, on its target's server, and relative to the shell in a
 * static preview, where every frame shares the shell's origin.
 */
export interface ShellData {
	frames: Array<{ target: string; src: string }>;
	/** In the catalogue's order, with the metadata of ADR-0110. */
	examples: Array<{
		key: string;
		id: string;
		category: Array<string>;
		title: string;
		description?: string;
		order?: number;
		/** Its controls, by component (ADR-0113): none for one the preview serves as written. */
		controls: Array<ExampleControlGroup>;
	}>;
	components: Array<{
		key: string;
		id: string;
		name: string;
		controls: PreviewCatalogue["components"][number]["controls"];
		uncontrolled: PreviewCatalogue["components"][number]["uncontrolled"];
	}>;
}

/** The shell's data, from the catalogue and the frame pages' URLs. */
export function shellData(
	catalogue: PreviewCatalogue,
	frames: ReadonlyArray<{ target: string; src: string }>,
): ShellData {
	return {
		frames: frames.map(({ target, src }) => ({ target, src })),
		examples: catalogue.examples.map(
			({ key, id, category, title, description, order, controls }) => ({
				key,
				id,
				category,
				title,
				...(description === undefined ? {} : { description }),
				...(order === undefined ? {} : { order }),
				controls,
			}),
		),
		components: catalogue.components.map(({ key, id, name, controls, uncontrolled }) => ({
			key,
			id,
			name,
			controls,
			uncontrolled,
		})),
	};
}

/** JSON safe inside a `<script>` element: no `</script>` or `<!--` can close it. */
export function scriptJson(value: unknown): string {
	return JSON.stringify(value)
		.replaceAll("<", String.raw`\u003c`)
		.replaceAll("\u2028", String.raw`\u2028`)
		.replaceAll("\u2029", String.raw`\u2029`);
}

/** Where the shell keeps the reader's theme, when they chose one over their system's. */
const THEME_KEY = "unframework-preview-theme";

/**
 * The shell's styles: a sidebar, the canvas and the controls panel, in dense type with quiet
 * borders and one accent. Light and dark follow `prefers-color-scheme` through `light-dark()`,
 * and `data-theme` on the root pins one when the reader chose it.
 */
const SHELL_STYLES = `
:root {
  color-scheme: light dark;
${PALETTE}  font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
}
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; }
* { box-sizing: border-box; }
body {
  margin: 0; height: 100vh; display: grid; background: var(--bg); color: var(--fg);
  grid-template-columns: 15rem minmax(0, 1fr) 17rem;
}
button, input, select { font: inherit; color: inherit; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.visually-hidden {
  position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}
kbd {
  font: 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 2px 4px; color: var(--muted);
  border: 1px solid var(--line-strong); border-radius: 3px; background: var(--raised);
}
.quiet {
  border: 1px solid transparent; background: none; border-radius: 4px; padding: 2px 6px; cursor: pointer; color: var(--muted);
}
.quiet:hover { background: var(--hover); color: var(--fg); }
.icon { display: grid; place-items: center; width: 26px; height: 26px; padding: 0; }
.icon svg { width: 16px; height: 16px; }
.icon[aria-pressed="true"] { color: var(--accent); }

/* Sidebar */
nav { display: flex; flex-direction: column; min-height: 0; background: var(--panel); border-inline-end: 1px solid var(--line); }
.brand { display: flex; align-items: center; gap: 4px; padding: 10px 10px 6px 14px; }
.brand p { margin: 0; font-weight: 600; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.brand p span { color: var(--muted); font-weight: 400; }
.filter { position: relative; margin: 4px 10px 8px; }
.filter input {
  width: 100%; padding: 4px 28px 4px 8px; border: 1px solid var(--line-strong); border-radius: 5px; background: var(--raised);
}
.filter input::placeholder { color: var(--muted); }
.filter kbd { position: absolute; inset-inline-end: 6px; top: 50%; translate: 0 -50%; pointer-events: none; }
.trees { flex: 1; overflow: auto; padding: 0 6px 10px; }
.trees h2 { margin: 12px 8px 2px; font-size: 11px; font-weight: 600; color: var(--muted); }
.trees h2[hidden] { display: none; }
[role="tree"], [role="group"] { list-style: none; margin: 0; padding: 0; }
[role="treeitem"] { cursor: pointer; }
[role="treeitem"]:focus-visible { outline-offset: -2px; border-radius: 4px; }
.row {
  display: flex; align-items: center; gap: 4px; min-height: 24px; border-radius: 4px; white-space: nowrap;
  padding-inline: calc(var(--depth, 0) * 12px + 6px) 6px;
}
.row:hover { background: var(--hover); }
.row span:last-child { overflow: hidden; text-overflow: ellipsis; }
[aria-selected="true"] > .row { background: var(--selected); color: var(--fg); font-weight: 500; }
.chevron { flex: none; width: 12px; height: 12px; color: var(--muted); }
.leaf .chevron { visibility: hidden; }
[aria-expanded="false"] > .row .chevron { rotate: -90deg; }
[aria-expanded="false"] > [role="group"] { display: none; }
[role="treeitem"][hidden] { display: none; }
.empty { margin: 8px; color: var(--muted); }
.foot { display: flex; padding: 6px 8px; border-top: 1px solid var(--line); }

/* Canvas */
main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.head { display: flex; gap: 12px 24px; align-items: end; flex-wrap: wrap; padding: 14px 20px 12px; border-bottom: 1px solid var(--line); }
.title { flex: 1 1 18rem; min-width: 0; }
.trail { margin: 0 0 2px; color: var(--muted); overflow-wrap: anywhere; }
h1 { margin: 0; font-size: 18px; line-height: 1.3; font-weight: 600; overflow-wrap: anywhere; }
.description { margin: 4px 0 0; max-width: 70ch; color: var(--muted); }
.description[hidden] { display: none; }
.view { display: flex; flex-wrap: wrap; gap: 2px; border: 0; margin: 0; padding: 0; min-width: 0; }
.view[hidden] { display: none; }
.view legend { float: left; padding: 0; margin-inline-end: 8px; line-height: 24px; color: var(--muted); }
.view label {
  position: relative; padding: 2px 8px; border: 1px solid var(--line-strong); border-radius: 4px; cursor: pointer; background: var(--raised);
}
.view input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.view label:has(input:checked) { background: var(--selected); border-color: var(--accent); color: var(--fg); }
.view label:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 1px; }
.frames {
  flex: 1; overflow: auto; padding: 16px 20px; display: grid; gap: 12px; align-content: start;
  grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
}
.frames[data-view="one"] { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); align-content: stretch; }
figure { margin: 0; display: flex; flex-direction: column; min-height: 0; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; background: var(--raised); }
figure[hidden] { display: none; }
figcaption { display: flex; justify-content: space-between; gap: 8px; padding: 4px 10px; border-bottom: 1px solid var(--line); background: var(--panel); }
figcaption span { font-weight: 500; }
figcaption a { flex: none; margin-inline-end: auto; color: var(--muted); white-space: nowrap; text-underline-offset: 2px; }
figcaption a:hover { color: var(--fg); }
figcaption output { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); min-width: 0; overflow-wrap: anywhere; }
figcaption output::before { content: ""; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--line-strong); }
figcaption output[data-state="rendered"]::before { background: var(--ok); }
figcaption output[data-state="failed"] { color: var(--failed); }
figcaption output[data-state="failed"]::before { background: var(--failed); }
iframe { display: block; width: 100%; height: 14rem; border: 0; resize: vertical; background: #ffffff; color-scheme: light; }
.frames[data-view="one"] iframe { flex: 1; height: auto; resize: none; }

/* Controls panel */
${CONTROL_STYLES}
/* Shortcuts */
dialog {
  border: 1px solid var(--line-strong); border-radius: 8px; padding: 16px 18px; min-width: 20rem;
  background: var(--raised); color: var(--fg); box-shadow: 0 12px 32px rgb(0 0 0 / 0.18);
}
dialog::backdrop { background: rgb(0 0 0 / 0.3); }
dialog h2 { margin: 0 0 10px; font-size: 14px; }
dialog dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; margin: 0 0 14px; }
dialog dt { white-space: nowrap; }
dialog dd { margin: 0; color: var(--muted); }
dialog form { text-align: end; }
dialog button { padding: 3px 10px; border: 1px solid var(--line-strong); border-radius: 5px; background: var(--panel); cursor: pointer; }

@media (prefers-reduced-motion: no-preference) {
  .chevron { transition: rotate 120ms ease-out; }
}
/* A narrow window stacks the three: the sidebar, the canvas, then the controls. */
@media (max-width: 56rem) {
  body { height: auto; min-height: 100vh; grid-template-columns: minmax(0, 1fr); }
  nav { max-height: 45vh; border-inline-end: 0; border-bottom: 1px solid var(--line); }
  .frames { overflow: visible; grid-template-columns: minmax(0, 1fr); }
  .frames[data-view="one"] iframe { height: 24rem; flex: none; }
  .controls { border-inline-start: 0; border-top: 1px solid var(--line); }
}
`;

/** The shell page. */
export function shellPage(data: ShellData): string {
	// A preview of one target opens on the view that fills the canvas, written into the page so
	// nothing moves once its script runs, and has no switch, since a choice of one is none.
	const single = data.frames.length === 1;
	const constants = {
		message: PREVIEW_MESSAGE,
		themeKey: THEME_KEY,
		embed: { file: EMBED_FILE, example: EXAMPLE_PARAM, target: TARGET_PARAM },
	};
	const chevron = `<svg class="chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
	return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>unframework preview</title>
    <script>try{const t=localStorage.getItem(${scriptJson(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch{}</script>
    <style>${SHELL_STYLES}</style>
  </head>
  <body>
    <nav aria-label="Catalogue">
      <div class="brand">
        <p>unframework <span>preview</span></p>
        <button type="button" class="quiet icon" data-uf-theme aria-pressed="false" title="Dark theme">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
          <span class="visually-hidden">Dark theme</span>
        </button>
      </div>
      <div class="filter" role="search">
        <label class="visually-hidden" for="uf-filter">Filter examples and components</label>
        <input id="uf-filter" type="search" placeholder="Filter" autocomplete="off" spellcheck="false" />
        <kbd aria-hidden="true">/</kbd>
      </div>
      <div class="trees">
        <h2 id="uf-examples-label">Examples</h2>
        <ul role="tree" aria-labelledby="uf-examples-label" data-uf-tree="example"></ul>
        <h2 id="uf-components-label">Components</h2>
        <ul role="tree" aria-labelledby="uf-components-label" data-uf-tree="component"></ul>
        <p class="empty" data-uf-empty hidden>Nothing matches the filter.</p>
      </div>
      <div class="foot">
        <button type="button" class="quiet" data-uf-shortcuts aria-haspopup="dialog">Keyboard shortcuts <kbd aria-hidden="true">?</kbd></button>
      </div>
    </nav>
    <main>
      <div class="head">
        <div class="title">
          <p class="trail" data-uf-trail></p>
          <h1 data-uf-selection>Select an example or a component</h1>
          <p class="description" data-uf-description hidden></p>
        </div>
        <fieldset class="view" data-uf-view${single ? " hidden" : ""}>
          <legend>Targets</legend>
        </fieldset>
      </div>
      <div class="frames" data-view="${single ? "one" : "all"}"></div>
    </main>
    <section class="controls" aria-labelledby="uf-controls-label">
      <h2 id="uf-controls-label">Controls</h2>
      <p data-uf-no-controls>Select an example or a component to set its props.</p>
      <div data-uf-example-controls hidden></div>
      <form data-uf-controls aria-labelledby="uf-controls-label" hidden></form>
      <h3 id="uf-uncontrolled-label" hidden>Not controllable</h3>
      <ul data-uf-uncontrolled aria-labelledby="uf-uncontrolled-label" hidden></ul>
    </section>
    <dialog aria-labelledby="uf-shortcuts-label">
      <h2 id="uf-shortcuts-label">Keyboard shortcuts</h2>
      <dl>
        <dt><kbd>/</kbd></dt><dd>Filter the examples and components</dd>
        <dt><kbd>Esc</kbd></dt><dd>Clear the filter</dd>
        <dt><kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Move through the tree</dd>
        <dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Close or open a group</dd>
        <dt><kbd>Home</kbd> <kbd>End</kbd></dt><dd>First or last item</dd>
        <dt><kbd>Enter</kbd></dt><dd>Show the item</dd>
        <dt><kbd>?</kbd></dt><dd>Show these shortcuts</dd>
      </dl>
      <form method="dialog"><button>Close</button></form>
    </dialog>
    <template id="uf-chevron">${chevron}</template>
    <script type="application/json" id="uf-preview-data">${scriptJson(data)}</script>
    <script>(${shellScript.toString()})(${scriptJson(constants)}, ${controlKit.toString()});</script>
  </body>
</html>
`;
}

/**
 * The shell page's script, run in the browser as written. It keeps the selection and the props,
 * sends them to every frame on each change and whenever a frame says it is ready (a frame reloads
 * when Vite optimises a dependency it found), and shows each frame's last answer. The sidebar is
 * two trees with the keyboard model of the ARIA tree view pattern: the examples by category
 * (ADR-0110) and the components.
 */
function shellScript(
	constants: {
		message: string;
		themeKey: string;
		embed: { file: string; example: string; target: string };
	},
	makeKit: () => ControlKit,
): void {
	type Control = ShellData["components"][number]["controls"][number];
	type Component = ShellData["components"][number];
	type Example = ShellData["examples"][number];
	const data = JSON.parse(document.getElementById("uf-preview-data")!.textContent) as ShellData;
	const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
	const filter = $<HTMLInputElement>("#uf-filter");
	const trees = [...document.querySelectorAll<HTMLElement>("[data-uf-tree]")];
	const empty = $<HTMLElement>("[data-uf-empty]");
	const trail = $<HTMLElement>("[data-uf-trail]");
	const heading = $<HTMLElement>("[data-uf-selection]");
	const description = $<HTMLElement>("[data-uf-description]");
	const view = $<HTMLFieldSetElement>("[data-uf-view]");
	const grid = $<HTMLElement>(".frames");
	const form = $<HTMLFormElement>("[data-uf-controls]");
	const exampleBox = $<HTMLElement>("[data-uf-example-controls]");
	const noControls = $<HTMLElement>("[data-uf-no-controls]");
	const uncontrolled = $<HTMLElement>("[data-uf-uncontrolled]");
	const uncontrolledLabel = $<HTMLElement>("#uf-uncontrolled-label");
	const themeButton = $<HTMLButtonElement>("[data-uf-theme]");
	const dialog = $<HTMLDialogElement>("dialog");
	const chevron = $<HTMLTemplateElement>("#uf-chevron");
	// The fields and the props rule, shared with an embed's controls (ADR-0116).
	const kit = makeKit();
	let selected: string | undefined;
	// The component whose controls the form shows: one listener reads it on each input.
	let current: Component | undefined;
	// The example whose controls the groups show (ADR-0113).
	let currentExample: Example | undefined;
	let props: Record<string, unknown> = {};
	let seq = 0;

	// Theme: the system's, until the reader picks one, which the page keeps.
	const dark = matchMedia("(prefers-color-scheme: dark)");
	const stored = (): string | null => {
		try {
			return localStorage.getItem(constants.themeKey);
		} catch {
			return null;
		}
	};
	const applyTheme = () => {
		const choice = stored();
		if (choice === "light" || choice === "dark") {
			document.documentElement.dataset.theme = choice;
		} else {
			delete document.documentElement.dataset.theme;
		}
		const isDark = choice ? choice === "dark" : dark.matches;
		themeButton.setAttribute("aria-pressed", String(isDark));
	};
	themeButton.addEventListener("click", () => {
		const next = themeButton.getAttribute("aria-pressed") === "true" ? "light" : "dark";
		try {
			localStorage.setItem(constants.themeKey, next);
		} catch {
			// Storage may be off: the choice then holds until the page reloads.
		}
		document.documentElement.dataset.theme = next;
		themeButton.setAttribute("aria-pressed", String(next === "dark"));
	});
	dark.addEventListener("change", applyTheme);
	applyTheme();

	// Frames, and the choice of all targets or one.
	const frames = data.frames.map(({ target, src }) => {
		// The frame's own origin, to which the shell posts and from which it takes answers.
		const url = new URL(src, location.href);
		const origin = url.origin;
		const figure = document.createElement("figure");
		figure.dataset.target = target;
		const caption = document.createElement("figcaption");
		const label = document.createElement("span");
		label.textContent = target;
		// The example's own URL on this target (ADR-0112), relative to the shell: \`select\` sets it.
		const link = document.createElement("a");
		link.textContent = "Open";
		link.target = "_blank";
		link.rel = "noopener";
		link.hidden = true;
		const status = document.createElement("output");
		caption.append(label, link, status);
		const iframe = document.createElement("iframe");
		iframe.title = `${target} preview`;
		url.searchParams.set("shell", location.origin);
		iframe.src = url.href;
		figure.append(caption, iframe);
		grid.append(figure);
		return { target, origin, iframe, link, status, figure };
	});
	// One target has no choice to make: the page already shows it in the one-target view.
	const choices = frames.length > 1 ? ["all", ...frames.map((each) => each.target)] : [];
	for (const value of choices) {
		const label = document.createElement("label");
		const radio = document.createElement("input");
		radio.type = "radio";
		radio.name = "uf-view";
		radio.value = value;
		radio.checked = value === "all";
		label.append(radio, value === "all" ? "All" : value);
		view.append(label);
	}
	view.addEventListener("change", (event) => {
		const value = (event.target as HTMLInputElement).value;
		grid.dataset.view = value === "all" ? "all" : "one";
		for (const frame of frames) {
			frame.figure.hidden = value !== "all" && frame.target !== value;
		}
	});

	const send = (frame: (typeof frames)[number]) => {
		if (selected === undefined) {
			return;
		}
		frame.status.dataset.state = "rendering";
		frame.status.textContent = "rendering…";
		frame.iframe.contentWindow?.postMessage(
			{ type: constants.message, kind: "render", seq, entry: selected, props },
			frame.origin,
		);
	};
	const sendAll = () => {
		seq += 1;
		for (const frame of frames) {
			send(frame);
		}
	};

	window.addEventListener("message", (event) => {
		const frame = frames.find(
			(each) => each.origin === event.origin && each.iframe.contentWindow === event.source,
		);
		const message = event.data as {
			type?: unknown;
			kind?: unknown;
			seq?: unknown;
			message?: unknown;
		};
		if (!frame || message?.type !== constants.message) {
			return;
		}
		if (message.kind === "ready") {
			send(frame);
		}
		if ((message.kind === "rendered" || message.kind === "failed") && message.seq === seq) {
			frame.status.dataset.state = message.kind;
			frame.status.textContent =
				message.kind === "rendered" ? "rendered" : `failed: ${String(message.message)}`;
		}
	});

	// Controls.
	const propsOf = (controls: ReadonlyArray<Control>): Record<string, unknown> =>
		kit.componentProps(
			controls,
			(name) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement,
		);
	const exampleProps = (example: Example): Record<string, unknown> =>
		kit.exampleProps(
			example.controls.flatMap((group) => group.controls),
			(key) => exampleBox.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${key}"]`)!,
		);

	form.addEventListener("input", () => {
		if (!current) {
			return;
		}
		props = propsOf(current.controls);
		sendAll();
	});
	form.addEventListener("submit", (event) => event.preventDefault());
	exampleBox.addEventListener("input", () => {
		if (!currentExample) {
			return;
		}
		props = exampleProps(currentExample);
		sendAll();
	});
	exampleBox.addEventListener("submit", (event) => event.preventDefault());

	// An example's controls (ADR-0113): one group per component it renders, headed by the
	// component's name, and its id too where two groups share a name.
	const showExampleControls = (example: Example | undefined) => {
		currentExample = example;
		exampleBox.replaceChildren();
		const groups = example?.controls ?? [];
		exampleBox.hidden = !groups.length;
		if (!example) {
			return;
		}
		noControls.hidden = groups.length > 0;
		noControls.textContent = "This example has no controls.";
		exampleBox.append(...kit.exampleGroups(groups));
	};

	const showControls = (component: Component | undefined) => {
		current = component;
		form.replaceChildren();
		uncontrolled.replaceChildren();
		form.hidden = !component?.controls.length;
		uncontrolled.hidden = uncontrolledLabel.hidden = !component?.uncontrolled.length;
		// The message depends on the selection, so it is set on every call: a component
		// with no props must not leave its text behind for the example selected next.
		const bare =
			Boolean(component) && !component?.controls.length && !component?.uncontrolled.length;
		noControls.hidden = Boolean(component) && !bare;
		noControls.textContent = bare
			? "This component has no props."
			: "Select an example or a component to set its props.";
		if (!component) {
			return;
		}
		for (const control of component.controls) {
			form.append(...kit.controlField(control, control.name, `uf-prop-${control.name}`));
		}
		for (const each of component.uncontrolled) {
			const item = document.createElement("li");
			const name = document.createElement("code");
			name.textContent = each.name;
			item.append(name, `: ${each.reason}.`);
			uncontrolled.append(item);
		}
	};

	// The trees. Each item is a `treeitem`; a group holds its children in a `group` list.
	interface Item {
		element: HTMLElement;
		parent: Item | undefined;
		children: Array<Item>;
		key?: string;
		text: string;
	}
	const items = new Map<HTMLElement, Item>();
	const entries = new Map<string, HTMLElement>();
	let idCount = 0;
	const makeItem = (
		list: HTMLElement,
		parent: Item | undefined,
		depth: number,
		label: string,
		key?: string,
	): Item => {
		const element = document.createElement("li");
		element.setAttribute("role", "treeitem");
		element.tabIndex = -1;
		const row = document.createElement("div");
		row.className = "row";
		row.style.setProperty("--depth", String(depth));
		row.append(chevron.content.cloneNode(true));
		const text = document.createElement("span");
		text.textContent = label;
		text.title = label;
		row.append(text);
		element.append(row);
		if (key === undefined) {
			// A group's name is its label alone, not its children's text.
			text.id = `uf-group-${(idCount += 1)}`;
			element.setAttribute("aria-labelledby", text.id);
			element.setAttribute("aria-expanded", "true");
			const group = document.createElement("ul");
			group.setAttribute("role", "group");
			element.append(group);
		} else {
			element.classList.add("leaf");
			element.dataset.entry = key;
			element.setAttribute("aria-selected", "false");
			entries.set(key, element);
		}
		list.append(element);
		const item: Item = { element, parent, children: [], key, text: label.toLowerCase() };
		parent?.children.push(item);
		items.set(element, item);
		return item;
	};
	const listOf = (item: Item | undefined, tree: HTMLElement): HTMLElement =>
		item ? item.element.querySelector<HTMLElement>(":scope > [role='group']")! : tree;

	// Examples by category, each group where its first example puts it, the examples in the
	// catalogue's order (ADR-0110).
	const [exampleTree, componentTree] = trees as [HTMLElement, HTMLElement];
	const groups = new Map<string, Item>();
	for (const { key, category, title } of data.examples) {
		let parent: Item | undefined;
		category.forEach((segment, index) => {
			const path = category.slice(0, index + 1).join("\u0000");
			let group = groups.get(path);
			if (!group) {
				group = makeItem(listOf(parent, exampleTree), parent, index, segment);
				groups.set(path, group);
			}
			parent = group;
		});
		makeItem(listOf(parent, exampleTree), parent, category.length, title, key);
	}
	for (const { key, id } of data.components) {
		makeItem(componentTree, undefined, 0, id, key);
	}
	for (const tree of trees) {
		tree.previousElementSibling!.toggleAttribute("hidden", !tree.children.length);
	}
	for (const tree of trees) {
		tree.hidden = !tree.children.length;
	}

	const visible = (element: HTMLElement): boolean => {
		for (let item = items.get(element); item; item = item.parent) {
			if (item.element.hidden) {
				return false;
			}
			if (item !== items.get(element) && item.element.getAttribute("aria-expanded") === "false") {
				return false;
			}
		}
		return true;
	};
	const visibleItems = (tree: HTMLElement) =>
		[...tree.querySelectorAll<HTMLElement>("[role='treeitem']")].filter(visible);
	// One tab stop per tree: the selected item, or else its first visible one.
	const rove = (tree: HTMLElement, focus?: HTMLElement) => {
		const all = tree.querySelectorAll<HTMLElement>("[role='treeitem']");
		const target =
			focus ??
			[...all].find((each) => each.getAttribute("aria-selected") === "true" && visible(each)) ??
			visibleItems(tree)[0];
		for (const each of all) {
			each.tabIndex = each === target ? 0 : -1;
		}
	};
	const moveTo = (element: HTMLElement | undefined) => {
		if (!element) {
			return;
		}
		rove(element.closest<HTMLElement>("[role='tree']")!, element);
		element.focus();
	};
	const setExpanded = (item: Item, open: boolean) => {
		item.element.setAttribute("aria-expanded", String(open));
	};

	for (const tree of trees) {
		tree.addEventListener("click", (event) => {
			const element = (event.target as Element).closest<HTMLElement>("[role='treeitem']");
			const item = element && items.get(element);
			if (!item) {
				return;
			}
			event.stopPropagation();
			if (item.key) {
				select(item.key);
			} else {
				setExpanded(item, item.element.getAttribute("aria-expanded") === "false");
			}
			moveTo(item.element);
		});
		tree.addEventListener("keydown", (event) => {
			const element = (event.target as Element).closest<HTMLElement>("[role='treeitem']");
			const item = element && items.get(element);
			if (!item || event.altKey || event.ctrlKey || event.metaKey) {
				return;
			}
			const list = visibleItems(tree);
			const index = list.indexOf(item.element);
			const expanded = item.element.getAttribute("aria-expanded");
			let handled = true;
			if (event.key === "ArrowDown") {
				moveTo(list[index + 1]);
			} else if (event.key === "ArrowUp") {
				moveTo(list[index - 1]);
			} else if (event.key === "Home") {
				moveTo(list[0]);
			} else if (event.key === "End") {
				moveTo(list.at(-1));
			} else if (event.key === "ArrowRight") {
				if (expanded === "false") {
					setExpanded(item, true);
				} else if (expanded === "true") {
					moveTo(item.children.find((each) => visible(each.element))?.element);
				}
			} else if (event.key === "ArrowLeft") {
				if (expanded === "true") {
					setExpanded(item, false);
				} else {
					moveTo(item.parent?.element);
				}
			} else if (event.key === "Enter" || event.key === " ") {
				if (item.key) {
					select(item.key);
				} else {
					setExpanded(item, expanded === "false");
				}
			} else {
				handled = false;
			}
			if (handled) {
				event.preventDefault();
			}
		});
	}

	// The filter shows the items whose label, or whose group's label, holds the text.
	const applyFilter = () => {
		const query = filter.value.trim().toLowerCase();
		const show = (item: Item, inherited: boolean): boolean => {
			const match = inherited || item.text.includes(query);
			let any = false;
			for (const child of item.children) {
				any = show(child, match) || any;
			}
			const shown = !query || match || any;
			item.element.hidden = !shown;
			if (query && any && !item.key) {
				setExpanded(item, true);
			}
			return shown;
		};
		let count = 0;
		for (const item of items.values()) {
			if (!item.parent && show(item, false)) {
				count += 1;
			}
		}
		empty.hidden = count > 0;
		for (const tree of trees) {
			rove(tree);
		}
	};
	filter.addEventListener("input", applyFilter);
	filter.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && filter.value) {
			filter.value = "";
			applyFilter();
			event.preventDefault();
		} else if (event.key === "ArrowDown") {
			const first = trees.map(visibleItems).find((each) => each.length)?.[0];
			if (first) {
				event.preventDefault();
				moveTo(first);
			}
		}
	});

	// An entry by its key, `example:<id>` or `component:<id>`: an example beside its component
	// shares its id.
	const select = (key: string) => {
		const component = data.components.find((each) => each.key === key);
		const example = data.examples.find((each) => each.key === key);
		if (!component && !example) {
			return;
		}
		selected = key;
		trail.textContent = component ? "Components" : example!.category.join(" / ");
		heading.textContent = component ? component.name : example!.title;
		description.textContent = component ? component.id : (example!.description ?? example!.id);
		description.hidden = false;
		document.title = `${heading.textContent} · unframework preview`;
		for (const [each, element] of entries) {
			element.setAttribute("aria-selected", String(each === key));
		}
		for (const tree of trees) {
			rove(tree);
		}
		showControls(component);
		showExampleControls(example);
		// An example opens by its own URL on each target. A component takes props, which no URL holds.
		for (const frame of frames) {
			frame.link.hidden = !example;
			if (!example) {
				continue;
			}
			const query = new URLSearchParams({
				[constants.embed.example]: example.id,
				[constants.embed.target]: frame.target,
			});
			frame.link.href = `${constants.embed.file}?${query}`;
			frame.link.setAttribute(
				"aria-label",
				`Open ${example.title} on ${frame.target} in a new tab`,
			);
		}
		// An example starts as written: every control at "(default)", so it takes no props.
		props = component ? propsOf(component.controls) : {};
		if (location.hash !== `#${key}`) {
			history.replaceState(null, "", `#${key}`);
		}
		sendAll();
	};

	// Page-wide keys: `/` for the filter and `?` for the shortcuts, never while typing.
	document.addEventListener("keydown", (event) => {
		if (!filter.isConnected || event.defaultPrevented) {
			return;
		}
		if (event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}
		const typing = (event.target as Element).closest?.(
			"input, select, textarea, [contenteditable]",
		);
		if (typing || dialog.open) {
			return;
		}
		if (event.key === "/") {
			event.preventDefault();
			filter.focus();
			filter.select();
		} else if (event.key === "?") {
			event.preventDefault();
			dialog.showModal();
		}
	});
	$<HTMLButtonElement>("[data-uf-shortcuts]").addEventListener("click", () => dialog.showModal());

	const first = decodeURIComponent(location.hash.slice(1));
	select(entries.has(first) ? first : (data.examples[0]?.key ?? data.components[0]?.key ?? ""));
	// A link to another entry on this page, or the browser's back and forward, changes the hash.
	window.addEventListener("hashchange", () => select(decodeURIComponent(location.hash.slice(1))));
}

/** The running shell server. */
export interface ShellServer {
	url: string;
	port: number;
	close(): Promise<void>;
}

/**
 * Serves the shell page at `/` and the embed page at `/embed.html` (ADR-0112) on `port` (0 for any
 * free one), and resolves once it listens.
 */
export function startShellServer(
	pages: { shell: string; embed: string },
	port: number,
): Promise<ShellServer> {
	const server: Server = createServer((request, response) => {
		const path = new URL(request.url ?? "/", "http://preview").pathname;
		const page = path === "/" ? pages.shell : path === `/${EMBED_FILE}` ? pages.embed : undefined;
		if (page === undefined || (request.method !== "GET" && request.method !== "HEAD")) {
			response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
			response.end("Not found: the preview serves its page at /.");
			return;
		}
		response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
		response.end(request.method === "HEAD" ? undefined : page);
	});
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(port, PREVIEW_HOST, () => {
			server.off("error", reject);
			const actual = (server.address() as AddressInfo).port;
			resolve({
				url: `http://${PREVIEW_HOST}:${actual}/`,
				port: actual,
				close: () =>
					new Promise<void>((done) => {
						server.close(() => done());
						server.closeAllConnections();
					}),
			});
		});
	});
}
