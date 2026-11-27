// What the shell's controls panel and an embed's share (ADR-0113, ADR-0116): the palette, the
// panel's styles, and `controlKit`, which builds the fields, an example's control groups, the
// reference lists and the panel's status line, keeps each field's changed state and its Reset, and
// turns the fields into props. Browser-safe, with type imports only: the frame imports it, and the
// shell writes `controlKit` into its page with `toString()`, as it writes its own script, so it
// reads nothing from outside its body.
import type { PropControl, UncontrolledProp } from "./controls.ts";
import type { ExampleControl, ExampleControlGroup } from "./instrument.ts";

/** The shell's colours, as custom properties: light and dark through `light-dark()`. */
export const PALETTE = `  --bg: light-dark(#ffffff, #16171b);
  --panel: light-dark(#f7f7f9, #1c1d22);
  --raised: light-dark(#ffffff, #23242a);
  --fg: light-dark(#1d1e22, #e4e4e8);
  --muted: light-dark(#5e616c, #9b9ea9);
  --line: light-dark(#e4e5e9, #2c2d34);
  --line-strong: light-dark(#cfd1d7, #3b3c44);
  --hover: light-dark(#eeeff2, #26272d);
  --accent: light-dark(#6d28d9, #a78bfa);
  --selected: light-dark(#ede9fe, #2e2645);
  --ok: light-dark(#17663a, #7fd99b);
  --failed: light-dark(#b0201a, #ff9b93);
`;

/**
 * The controls panel's styles, on a `.controls` element, in the shell and in an embed. A prop's
 * name sits above its field at the panel's full width, and breaks only where `controlField` puts a
 * `<wbr>`, at its camelCase humps. The colours are the palette's alone, so light and dark keep the
 * contrast the proposal measured (UXF-1136): the accent for what changed, `--selected` for the
 * chosen segment.
 */
export const CONTROL_STYLES = `.controls { min-height: 0; overflow: auto; background: var(--panel); border-inline-start: 1px solid var(--line); padding: 14px 14px 20px; }
.controls [hidden] { display: none !important; }
.controls .uf-head { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 8px; margin: 0 0 10px; }
.controls h2 { margin: 0; font-size: 13px; font-weight: 600; }
.controls [data-uf-status-line] { flex-basis: 100%; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; margin-top: 2px; font-size: 12px; line-height: 16px; color: var(--muted); }
.controls [data-uf-status-line] p { margin: 0; }
.controls .uf-link {
  border: 0; background: none; padding: 0 2px; border-radius: 3px; font: inherit; font-size: 12px; line-height: 16px; white-space: nowrap;
  color: var(--accent); cursor: pointer; text-decoration: underline; text-underline-offset: 2px;
}
.controls .uf-link:hover { color: var(--fg); }
.controls p { margin: 0; color: var(--muted); }
.controls summary {
  list-style: none; cursor: pointer; display: grid; grid-template-columns: 12px minmax(0, max-content) max-content 1fr; column-gap: 6px;
  align-items: start; line-height: 16px; border-radius: 3px;
}
.controls summary::-webkit-details-marker { display: none; }
.controls .chevron { width: 12px; height: 12px; margin-top: 2px; color: var(--muted); }
.controls details:not([open]) > summary .chevron { rotate: -90deg; }
.controls [data-uf-group] { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; }
.controls [data-uf-group] > details { grid-area: 1 / 1 / 2 / 3; min-width: 0; }
.controls [data-uf-group] > .uf-link { grid-area: 1 / 2; position: relative; margin-top: 2px; }
.controls [data-uf-group] + [data-uf-group] { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
.controls [data-uf-group] > details > summary { padding: 2px 0; font-size: 12px; font-weight: 600; color: var(--fg); }
.controls [data-uf-group]:has(> .uf-link:not([hidden])) > details > summary { padding-inline-end: 4.5rem; }
.controls .uf-title { min-width: 0; overflow-wrap: anywhere; }
.controls .uf-path { grid-area: 2 / 2 / 3 / -1; font-size: 11px; font-weight: 400; line-height: 14px; color: var(--muted); overflow-wrap: normal; }
.controls .uf-count { font-size: 11px; font-weight: 500; color: var(--accent); white-space: nowrap; }
.controls form { display: grid; gap: 10px; margin: 0; }
.controls details > form { padding-top: 8px; }
.controls .uf-field { display: block; min-width: 0; margin: 0; padding: 0; border: 0; }
.controls .uf-field-head { display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px; }
.controls .uf-name {
  padding: 0; min-width: 0; font: 12px/16px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--fg);
  overflow-wrap: normal; word-break: normal;
}
.controls legend.uf-name { float: left; margin: 0 6px 4px 0; }
.controls .uf-type { margin-inline-start: auto; font-size: 11px; line-height: 16px; color: var(--muted); white-space: nowrap; }
.controls legend + .uf-type { display: block; text-align: end; }
.controls .uf-field[data-changed] .uf-name::before {
  content: ""; display: inline-block; width: 6px; height: 6px; margin-inline-end: 6px; border-radius: 50%;
  background: var(--accent); vertical-align: 1px;
}
.controls .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.controls input:not([type="checkbox"], [type="radio"]), .controls select {
  display: block; width: 100%; padding: 3px 6px; border: 1px solid var(--line-strong); border-radius: 4px; background: var(--raised);
}
.controls input::placeholder { color: var(--muted); }
.controls input[type="checkbox"] { display: block; accent-color: var(--accent); margin: 0; width: 14px; height: 14px; }
.controls .uf-field[data-changed] :is(input:not([type="checkbox"], [type="radio"]), select, .uf-segments) { border-color: var(--accent); }
.controls .uf-segments { clear: both; display: flex; border: 1px solid var(--line-strong); border-radius: 5px; background: var(--raised); }
.controls .uf-segments label {
  position: relative; flex: 1 1 auto; padding: 2px 6px; text-align: center; white-space: nowrap; color: var(--muted); cursor: pointer;
}
.controls .uf-segments label:first-child { border-start-start-radius: 4px; border-end-start-radius: 4px; }
.controls .uf-segments label:last-child { border-start-end-radius: 4px; border-end-end-radius: 4px; }
.controls .uf-segments label + label { border-inline-start: 1px solid var(--line-strong); }
.controls .uf-segments label:hover { background: var(--hover); color: var(--fg); }
.controls .uf-segments input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
.controls .uf-segments label:has(input:checked) { background: var(--selected); color: var(--fg); font-weight: 500; box-shadow: inset 0 0 0 1px var(--accent); }
.controls .uf-segments label:has(input:focus-visible) { z-index: 1; outline: 2px solid var(--accent); outline-offset: 1px; }
.controls .uf-segments .uf-default { font-style: italic; }
.controls .uf-reference { margin-top: 10px; border: 1px solid var(--line); border-radius: 5px; background: var(--bg); }
.controls .uf-reference > summary { padding: 4px 8px; font-size: 12px; color: var(--muted); }
.controls .uf-reference > div { display: grid; gap: 8px; padding: 0 8px 8px; }
.controls h3 { margin: 0 0 4px; font-size: 11px; font-weight: 600; color: var(--muted); }
.controls ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
.controls li { color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
.controls li code { color: var(--fg); font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
@media (prefers-reduced-motion: no-preference) {
  .controls .chevron { transition: rotate 120ms ease-out; }
}
`;

/** A control's field: a checkbox, a text or number input, a select, or the checked radio's value. */
export interface ControlField {
	readonly value: string;
	readonly checked?: boolean;
}

/** What {@link controlKit} gives. */
export interface ControlKit {
	/**
	 * Whether a control is a row of segments, one radio for each choice, rather than a list: an
	 * optional boolean or a union, with at most 4 choices whose texts add up to at most 24
	 * characters, "Default" counted. A required boolean stays a checkbox.
	 */
	segmented(control: PropControl): boolean;
	/**
	 * A control's field: its name above it, with its type on the right, and the control, its
	 * input named `name`. The field is a `fieldset` for segments, whose `legend` names it.
	 */
	controlField(control: PropControl, name: string, id: string): HTMLElement;
	/** The field named `name` inside `root`: for segments, the checked radio's value. */
	field(root: ParentNode, name: string): ControlField;
	/**
	 * The props an example sets and those no control can set, in one closed disclosure that gives
	 * their counts, or nothing when there are none.
	 */
	reference(
		id: string,
		setByExample: ReadonlyArray<string>,
		uncontrolled: ReadonlyArray<UncontrolledProp>,
	): HTMLElement | undefined;
	/**
	 * An example's control groups (ADR-0113): one group per component it renders, headed by the
	 * component's name, and its id too where two groups share a name, with its Reset beside the
	 * heading and outside its `<summary>`.
	 */
	exampleGroups(groups: ReadonlyArray<ExampleControlGroup>): Array<HTMLElement>;
	/**
	 * The panel's status line: how many controls changed, or that none did, with Reset all, which
	 * resets the fields in `scope()` and moves the focus to `focus`.
	 */
	statusLine(scope: () => HTMLElement | undefined, focus: HTMLElement): HTMLElement;
	/** Marks each field in `root` changed or not, and updates the groups' counts and the line. */
	refresh(root: ParentNode | undefined, line: HTMLElement): void;
	/** A component's props from its fields, each under the prop's name. */
	componentProps(
		controls: ReadonlyArray<PropControl>,
		field: (name: string) => ControlField,
	): Record<string, unknown>;
	/** An example's props from its fields, each under its control's key. */
	exampleProps(
		controls: ReadonlyArray<ExampleControl>,
		field: (key: string) => ControlField,
	): Record<string, unknown>;
}

/**
 * The controls' DOM and the props rule. One source for both, so the shell's frames and an embed
 * render an example with the same props for the same fields: Qwik and Astro's static render
 * depend on the rule (ADR-0113).
 */
export function controlKit(): ControlKit {
	/** Puts a control's value under `name`, unless it is an optional one left at its default. */
	const assign = (
		next: Record<string, unknown>,
		name: string,
		control: PropControl,
		field: ControlField,
	): void => {
		// An optional prop left at "Default", or blank, is left out, so its default applies.
		if (control.kind === "boolean" && !control.optional) {
			next[name] = Boolean(field.checked);
		} else if (control.kind === "boolean") {
			if (field.value !== "") {
				next[name] = field.value === "true";
			}
		} else if (control.kind === "number") {
			if (field.value !== "") {
				next[name] = Number(field.value);
			} else if (!control.optional) {
				next[name] = control.initial;
			}
		} else if (field.value !== "" || !control.optional) {
			next[name] = field.value;
		}
	};
	const componentProps: ControlKit["componentProps"] = (controls, field) => {
		const next: Record<string, unknown> = {};
		for (const control of controls) {
			assign(next, control.name, control, field(control.name));
		}
		return next;
	};
	// An example takes each control under its key, which names one component's prop. Every control
	// at "Default" sends no props, so the example renders as written, and a static frame matches
	// its build's render. Otherwise every key goes, `undefined` at "Default": Qwik follows only
	// the props a component had when it first rendered (`late-prop`), and its frame renders new
	// props for an example that had none as a new instance, which then has them all.
	const exampleProps: ControlKit["exampleProps"] = (controls, field) => {
		const next: Record<string, unknown> = {};
		for (const control of controls) {
			assign(next, control.key, control, field(control.key));
		}
		if (!Object.keys(next).length) {
			return next;
		}
		for (const control of controls) {
			if (!(control.key in next)) {
				next[control.key] = undefined;
			}
		}
		return next;
	};
	// What a control sends for one field alone, `undefined` where it leaves the prop out. A field
	// has changed when this differs from what it sent first, so a required number cleared to ""
	// sends its initial value again and is unchanged, and a space in an optional text field is not.
	const sends = (control: PropControl, field: ControlField): unknown => {
		const next: Record<string, unknown> = {};
		assign(next, "value", control, field);
		return next.value;
	};

	const choices = (control: PropControl): Array<string> | undefined => {
		const unset = control.optional ? ["Default"] : [];
		if (control.kind === "select") {
			return [...unset, ...control.options];
		}
		return control.kind === "boolean" && control.optional ? [...unset, "true", "false"] : undefined;
	};
	const segmented: ControlKit["segmented"] = (control) => {
		const each = choices(control);
		return each !== undefined && each.length <= 4 && each.join("").length <= 24;
	};
	const typeText = (control: PropControl): string => {
		const kind =
			control.kind !== "select"
				? control.kind
				: segmented(control)
					? control.options.join(" | ")
					: `${control.options.length} values`;
		return control.optional ? kind : `${kind} · required`;
	};
	/** A text with a `<wbr>` wherever `at` says a line may break, before the character `next`. */
	const breaks = (
		text: string,
		at: (previous: string, next: string) => boolean,
	): Array<string | Node> => {
		const parts: Array<string | Node> = [];
		// Prop names and paths are identifiers and file names: one code unit per character.
		let current = "";
		for (let index = 0; index < text.length; index += 1) {
			if (current && at(text.charAt(index - 1), text.charAt(index))) {
				parts.push(current, document.createElement("wbr"));
				current = "";
			}
			current += text.charAt(index);
		}
		parts.push(current);
		return parts;
	};
	const chevron = (): SVGElement => {
		const space = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(space, "svg");
		svg.setAttribute("class", "chevron");
		svg.setAttribute("viewBox", "0 0 12 12");
		svg.setAttribute("aria-hidden", "true");
		const path = document.createElementNS(space, "path");
		for (const [name, value] of [
			["d", "M3 4.5 6 7.5 9 4.5"],
			["fill", "none"],
			["stroke", "currentColor"],
			["stroke-width", "1.5"],
			["stroke-linecap", "round"],
			["stroke-linejoin", "round"],
		]) {
			path.setAttribute(name!, value!);
		}
		svg.append(path);
		return svg;
	};
	const element = <K extends keyof HTMLElementTagNameMap>(
		tag: K,
		className?: string,
		text?: string,
	): HTMLElementTagNameMap[K] => {
		const each = document.createElement(tag);
		if (className) {
			each.className = className;
		}
		if (text !== undefined) {
			each.textContent = text;
		}
		return each;
	};

	// Each field's control, its input's name and its first value, by the field's element.
	const states = new WeakMap<
		Element,
		{ control: PropControl; name: string; initial: ControlField }
	>();
	const inputs = (root: ParentNode, name: string) =>
		root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[name="${CSS.escape(name)}"]`);
	const field: ControlKit["field"] = (root, name) => {
		for (const input of inputs(root, name)) {
			if (input.type !== "radio") {
				return input;
			}
			if (input.checked) {
				return { value: input.value };
			}
		}
		return { value: "" };
	};
	const changed = (wrapper: Element): boolean => {
		const state = states.get(wrapper);
		return (
			state !== undefined &&
			!Object.is(
				sends(state.control, field(wrapper, state.name)),
				sends(state.control, state.initial),
			)
		);
	};
	/** Puts every field in `scope` back at its first value. */
	const restore = (scope: ParentNode) => {
		for (const wrapper of scope.querySelectorAll("[data-uf-field]")) {
			const state = states.get(wrapper);
			if (!state) {
				continue;
			}
			for (const input of inputs(wrapper, state.name)) {
				if (input.type === "radio") {
					input.checked = input.value === state.initial.value;
				} else if (input.type === "checkbox") {
					input.checked = Boolean(state.initial.checked);
				} else {
					input.value = state.initial.value;
				}
			}
		}
	};
	/** Resets the fields in `scope` and renders once with them, as a change to one field does. */
	const reset = (scope: HTMLElement, focus: HTMLElement) => {
		restore(scope);
		scope.dispatchEvent(new Event("input", { bubbles: true }));
		// The button hides once nothing is changed: the focus stays in the panel.
		focus.focus();
	};

	const controlField: ControlKit["controlField"] = (control, name, id) => {
		const segments = segmented(control);
		const wrapper = element(segments ? "fieldset" : "div", "uf-field");
		wrapper.dataset.ufField = name;
		// The name breaks only before a camelCase hump. Its accessible name is the prop's name and,
		// once it changed, " (changed)": the type is its description, so a lookup by name holds.
		const title = element(segments ? "legend" : "label", "uf-name");
		title.append(
			...breaks(control.name, (previous, next) => /[a-z\d]/.test(previous) && /[A-Z]/.test(next)),
			element("span", "visually-hidden"),
		);
		const type = element("span", "uf-type", typeText(control));
		type.id = `${id}-type`;
		if (segments) {
			const row = element("div", "uf-segments");
			const values = control.kind === "select" ? control.options : ["true", "false"];
			const entries = [
				...(control.optional ? [["", "Default"]] : []),
				...values.map((each) => [each, each]),
			];
			for (const [value, text] of entries as Array<[string, string]>) {
				const label = element("label", value === "" ? "uf-default" : undefined);
				const radio = element("input");
				radio.type = "radio";
				radio.name = name;
				radio.value = value;
				radio.checked = control.optional ? value === "" : value === control.initial;
				label.append(radio, text);
				row.append(label);
			}
			wrapper.id = id;
			wrapper.setAttribute("aria-describedby", type.id);
			wrapper.append(title, type, row);
		} else {
			(title as HTMLLabelElement).htmlFor = id;
			let input: HTMLInputElement | HTMLSelectElement;
			if (control.kind === "select") {
				const select = element("select");
				if (control.optional) {
					select.append(new Option("Default", ""));
				}
				for (const value of control.options) {
					select.append(new Option(value, value));
				}
				input = select;
			} else {
				const box = element("input");
				box.type =
					control.kind === "boolean" ? "checkbox" : control.kind === "number" ? "number" : "text";
				if (control.kind === "boolean") {
					box.checked = control.initial;
				} else if (control.optional) {
					box.placeholder = "Default";
				} else {
					box.value = String(control.initial);
				}
				input = box;
			}
			input.id = id;
			input.name = name;
			input.setAttribute("aria-describedby", type.id);
			const head = element("div", "uf-field-head");
			head.append(title, type);
			wrapper.append(head, input);
		}
		const first = field(wrapper, name);
		states.set(wrapper, { control, name, initial: { value: first.value, checked: first.checked } });
		return wrapper;
	};

	const propList = (id: string, title: string, items: ReadonlyArray<Array<string | Node>>) => {
		const box = element("div");
		const heading = element("h3", undefined, title);
		heading.id = id;
		const list = element("ul");
		list.setAttribute("aria-labelledby", id);
		for (const parts of items) {
			const item = element("li");
			item.append(...parts);
			list.append(item);
		}
		box.append(heading, list);
		return box;
	};
	const code = (text: string) => element("code", undefined, text);
	const reference: ControlKit["reference"] = (id, setByExample, uncontrolled) => {
		if (!setByExample.length && !uncontrolled.length) {
			return undefined;
		}
		const details = element("details", "uf-reference");
		const summary = element("summary");
		const counts = [
			setByExample.length ? `${setByExample.length} set by the example` : "",
			uncontrolled.length ? `${uncontrolled.length} not controllable` : "",
		];
		summary.append(chevron(), element("span", undefined, counts.filter(Boolean).join(" · ")));
		const body = element("div");
		if (setByExample.length) {
			body.append(
				propList(
					`${id}-set`,
					"Set by the example",
					setByExample.map((name) => [code(name)]),
				),
			);
		}
		if (uncontrolled.length) {
			body.append(
				propList(
					`${id}-uncontrolled`,
					"Not controllable",
					uncontrolled.map((each) => [code(each.name), `: ${each.reason}, `, code(each.type)]),
				),
			);
		}
		details.append(summary, body);
		return details;
	};

	const exampleGroups: ControlKit["exampleGroups"] = (groups) =>
		groups.map((group, index) => {
			const section = element("div");
			section.dataset.ufGroup = group.component;
			section.setAttribute("role", "group");
			const details = element("details");
			details.open = true;
			const summary = element("summary");
			// The group's name is its title, and its path where two groups share the title, on a row
			// of its own: the count and Reset are not part of it.
			const title = element("span", "uf-title", group.name);
			title.id = `uf-controls-${index}`;
			summary.append(chevron(), title, element("span", "uf-count"));
			const twin = groups.some((other) => other !== group && other.name === group.name);
			if (twin) {
				const path = element("span", "uf-path");
				path.id = `${title.id}-path`;
				path.append(...breaks(group.component, (previous) => previous === "/"));
				summary.append(path);
			}
			section.setAttribute("aria-labelledby", twin ? `${title.id} ${title.id}-path` : title.id);
			details.append(summary);
			if (group.controls.length) {
				const fields = element("form");
				for (const control of group.controls) {
					fields.append(controlField(control, control.key, `uf-control-${control.key}`));
				}
				details.append(fields);
			}
			const lists = reference(`uf-controls-${index}`, group.setByExample, group.uncontrolled);
			if (lists) {
				details.append(lists);
			}
			// Beside the heading, outside the `<summary>`: a click on it never folds the group, and it
			// stays while the group is folded.
			const button = element("button", "uf-link", "Reset");
			button.type = "button";
			button.hidden = true;
			button.setAttribute("aria-label", `Reset ${group.name}${twin ? `, ${group.component}` : ""}`);
			button.addEventListener("click", () => reset(section, summary));
			section.append(details, button);
			return section;
		});

	const statusLine: ControlKit["statusLine"] = (scope, focus) => {
		const line = element("div");
		line.dataset.ufStatusLine = "";
		line.hidden = true;
		// The live region holds the count alone: a button inside it would be read out again on
		// every change.
		const status = element("p");
		status.setAttribute("role", "status");
		const separator = element("span", undefined, "·");
		separator.setAttribute("aria-hidden", "true");
		const button = element("button", "uf-link", "Reset all");
		button.type = "button";
		button.addEventListener("click", () => {
			const root = scope();
			if (root) {
				reset(root, focus);
			}
		});
		line.append(status, separator, button);
		return line;
	};
	const refresh: ControlKit["refresh"] = (root, line) => {
		const wrappers = root ? [...root.querySelectorAll("[data-uf-field]")] : [];
		let total = 0;
		for (const wrapper of wrappers) {
			const now = changed(wrapper);
			wrapper.toggleAttribute("data-changed", now);
			wrapper.querySelector(".uf-name > .visually-hidden")!.textContent = now ? " (changed)" : "";
			total += Number(now);
		}
		for (const group of root?.querySelectorAll<HTMLElement>("[data-uf-group]") ?? []) {
			const count = group.querySelectorAll("[data-uf-field][data-changed]").length;
			const badge = group.querySelector<HTMLElement>(":scope > details > summary > .uf-count")!;
			badge.textContent = count ? `${count} changed` : "";
			badge.hidden = !count;
			group.querySelector<HTMLElement>(":scope > .uf-link")!.hidden = !count;
		}
		line.hidden = !wrappers.length;
		const [status, separator, button] = [...line.children] as Array<HTMLElement>;
		const text = total ? `${total} changed` : "Every control at its default";
		// The same text again would be announced again.
		if (status!.textContent !== text) {
			status!.textContent = text;
		}
		separator!.hidden = button!.hidden = !total;
	};

	return {
		segmented,
		controlField,
		field,
		reference,
		exampleGroups,
		statusLine,
		refresh,
		componentProps,
		exampleProps,
	};
}
