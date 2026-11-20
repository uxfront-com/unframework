// What the shell's controls panel and an embed's share (ADR-0113, ADR-0116): the palette, the
// panel's styles, and `controlKit`, which builds an example's control groups and turns their
// fields into props. Browser-safe, with type imports only: the frame imports it, and the shell
// writes `controlKit` into its page with `toString()`, as it writes its own script, so it reads
// nothing from outside its body.
import type { PropControl } from "./controls.ts";
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

/** The controls panel's styles, on a `.controls` element, in the shell and in an embed. */
export const CONTROL_STYLES = `.controls { min-height: 0; overflow: auto; background: var(--panel); border-inline-start: 1px solid var(--line); padding: 14px 14px 20px; }
.controls h2 { margin: 0 0 10px; font-size: 13px; font-weight: 600; }
.controls h3, .controls h4 { margin: 16px 0 6px; font-size: 11px; font-weight: 600; color: var(--muted); }
.controls form { display: grid; grid-template-columns: minmax(0, 7rem) minmax(0, 1fr); gap: 6px 10px; align-items: center; }
.controls form[hidden], .controls ul[hidden], .controls h3[hidden], .controls p[hidden] { display: none; }
.controls label { overflow-wrap: anywhere; color: var(--muted); }
.controls input:not([type="checkbox"]), .controls select {
  width: 100%; padding: 3px 6px; border: 1px solid var(--line-strong); border-radius: 4px; background: var(--raised);
}
.controls input[type="checkbox"] { justify-self: start; accent-color: var(--accent); margin: 0; width: 14px; height: 14px; }
.controls p { margin: 0; color: var(--muted); }
.controls ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.controls li { color: var(--muted); overflow-wrap: anywhere; }
.controls li code { color: var(--fg); font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
.controls [data-uf-group] + [data-uf-group] { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line); }
.controls [data-uf-group] > h3:first-child { margin: 0 0 8px; font-size: 12px; color: var(--fg); }
.controls [data-uf-group] h3 span { color: var(--muted); font-weight: 400; }
`;

/** A control's field: a checkbox, a text or number input, or a select. */
export interface ControlField {
  readonly value: string;
  readonly checked?: boolean;
}

/** What {@link controlKit} gives. */
export interface ControlKit {
  /** A control's label and field, its field named `name` with the id `id`. */
  controlField(
    control: PropControl,
    name: string,
    id: string,
  ): [HTMLLabelElement, HTMLInputElement | HTMLSelectElement];
  /** A list of props under a heading of its own, labelling it. */
  propList(
    id: string,
    title: string,
    items: readonly (string | Node)[][],
  ): [HTMLElement, HTMLElement];
  /** A prop's name as code. */
  code(text: string): HTMLElement;
  /**
   * An example's control groups (ADR-0113): one group per component it renders, headed by the
   * component's name, and its id too where two groups share a name.
   */
  exampleGroups(groups: readonly ExampleControlGroup[]): HTMLElement[];
  /** A component's props from its fields, each under the prop's name. */
  componentProps(
    controls: readonly PropControl[],
    field: (name: string) => ControlField,
  ): Record<string, unknown>;
  /** An example's props from its fields, each under its control's key. */
  exampleProps(
    controls: readonly ExampleControl[],
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
    // An optional prop left at "(default)", or blank, is left out, so its default applies.
    if (control.kind === "boolean" && !control.optional) {
      next[name] = Boolean(field.checked);
    } else if (control.kind === "boolean") {
      if (field.value !== "") next[name] = field.value === "true";
    } else if (control.kind === "number") {
      if (field.value !== "") next[name] = Number(field.value);
      else if (!control.optional) next[name] = control.initial;
    } else if (field.value !== "" || !control.optional) {
      next[name] = field.value;
    }
  };
  const componentProps: ControlKit["componentProps"] = (controls, field) => {
    const next: Record<string, unknown> = {};
    for (const control of controls) assign(next, control.name, control, field(control.name));
    return next;
  };
  // An example takes each control under its key, which names one component's prop. Every control
  // at "(default)" sends no props, so the example renders as written, and a static frame matches
  // its build's render. Otherwise every key goes, `undefined` at "(default)": Qwik follows only
  // the props a component had when it first rendered (`late-prop`), and its frame renders new
  // props for an example that had none as a new instance, which then has them all.
  const exampleProps: ControlKit["exampleProps"] = (controls, field) => {
    const next: Record<string, unknown> = {};
    for (const control of controls) assign(next, control.key, control, field(control.key));
    if (!Object.keys(next).length) return next;
    for (const control of controls) if (!(control.key in next)) next[control.key] = undefined;
    return next;
  };

  const option = (value: string, text: string) => {
    const element = document.createElement("option");
    element.value = value;
    element.textContent = text;
    return element;
  };
  const controlField: ControlKit["controlField"] = (control, name, id) => {
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = control.name;
    let field: HTMLInputElement | HTMLSelectElement;
    if (control.kind === "select" || (control.kind === "boolean" && control.optional)) {
      const select = document.createElement("select");
      if (control.optional) select.append(option("", "(default)"));
      const values = control.kind === "select" ? control.options : ["true", "false"];
      for (const value of values) select.append(option(value, value));
      field = select;
    } else {
      const input = document.createElement("input");
      input.type =
        control.kind === "boolean" ? "checkbox" : control.kind === "number" ? "number" : "text";
      if (control.kind === "boolean") input.checked = control.initial;
      else if (!control.optional) input.value = String(control.initial);
      field = input;
    }
    field.id = id;
    field.name = name;
    return [label, field];
  };
  const propList: ControlKit["propList"] = (id, title, items) => {
    const heading = document.createElement("h4");
    heading.id = id;
    heading.textContent = title;
    const list = document.createElement("ul");
    list.setAttribute("aria-labelledby", id);
    for (const parts of items) {
      const item = document.createElement("li");
      item.append(...parts);
      list.append(item);
    }
    return [heading, list];
  };
  const code: ControlKit["code"] = (text) => {
    const element = document.createElement("code");
    element.textContent = text;
    return element;
  };
  const exampleGroups: ControlKit["exampleGroups"] = (groups) =>
    groups.map((group, index) => {
      const section = document.createElement("div");
      section.dataset.ufGroup = group.component;
      section.setAttribute("role", "group");
      const title = document.createElement("h3");
      title.id = `uf-controls-${index}`;
      title.textContent = group.name;
      if (groups.some((other) => other !== group && other.name === group.name)) {
        const id = document.createElement("span");
        id.textContent = ` ${group.component}`;
        title.append(id);
      }
      section.setAttribute("aria-labelledby", title.id);
      section.append(title);
      if (group.controls.length) {
        const fields = document.createElement("form");
        for (const control of group.controls) {
          fields.append(...controlField(control, control.key, `uf-control-${control.key}`));
        }
        section.append(fields);
      }
      if (group.setByExample.length) {
        section.append(
          ...propList(
            `uf-controls-${index}-set`,
            "Set by the example",
            group.setByExample.map((name) => [code(name)]),
          ),
        );
      }
      if (group.uncontrolled.length) {
        section.append(
          ...propList(
            `uf-controls-${index}-uncontrolled`,
            "Not controllable",
            group.uncontrolled.map((each) => [code(each.name), `: ${each.reason}.`]),
          ),
        );
      }
      return section;
    });
  return { controlField, propList, code, exampleGroups, componentProps, exampleProps };
}
