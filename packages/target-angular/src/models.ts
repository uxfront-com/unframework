// A native control's `v-model` on Angular (ADR-0054, ADR-0056): `[value]` and `(input)`, or
// `[checked]` and `(change)`, written on the state's signal through a template variable of the
// control (`#nameField`), which types its value as the element's. Vue's text binding (trim, lazy,
// a number's cast) goes through `modelText`, a checkbox group through `toggle` and a multiple
// select through `selectedValues`: inline helpers the template reads as members.
import {
  angularCode,
  bindingForms,
  mergesWholeStyle,
  rewriteExpression,
} from "@unframework/codegen";
import type { PrintedAttribute } from "@unframework/codegen";
import type { Attribute, ElementNode, EventAttribute, ModelAttribute } from "@unframework/ir";

import { bindingById } from "./plan.ts";
import type { Plan } from "./plan.ts";
import { templateRules } from "./rules.ts";

/** A helper the template calls, declared in the file and read through a member of its name. */
export interface ModelHelper {
  name: string;
  code: string;
}

/** The helpers' code, by their base names. */
const HELPERS = {
  classNames: (name: string) => `/**
 * Class names as Vue's \`normalizeClass\` reads them (ADR-0065): a string as it is, an array's
 * entries and an object's keys whose values are truthy, Angular's \`[class]\` taking the string.
 */
function ${name}(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(${name}).filter(Boolean).join(" ");
  if (!value || typeof value !== "object") return "";
  return Object.entries(value)
    .flatMap(([key, on]) => (on ? [key] : []))
    .join(" ");
}`,
  // Raw, so the regular expressions keep their escapes.
  styleObject: (name: string) => String.raw`/**
 * A style bound to a value as an object of CSS properties (ADR-0065), which a merge spreads: a
 * declaration list splits as Vue's parseStringStyle splits it, and an object's camel-case keys
 * are written in kebab case, as the template writes its declarations.
 */
function ${name}(style: object | string | null | undefined): Record<string, string | null | undefined> {
  const properties: Record<string, string | null | undefined> = {};
  if (typeof style === "string") {
    for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
      const [property, value] = declaration.split(/:([^]+)/);
      const key = property!.trim();
      // Only a CSS identifier is a property: anything else would reach the markup as written.
      if (value !== undefined && /^-?-?[A-Za-z_][\w-]*$/.test(key)) properties[key] = value.trim();
    }
    return properties;
  }
  for (const [key, value] of Object.entries(style ?? {})) {
    const kebab = key.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
    properties[key.startsWith("--") ? key : kebab] = value === null || value === undefined ? value : String(value);
  }
  return properties;
}`,
  modelText: (name: string) => `/**
 * Vue's \`vModelText\` (ADR-0054): the text a field shows for its model's value. It keeps the
 * field's own text where that text already means the value (\`12.5kg\` for \`12.5\` with a number
 * cast), or where the person is editing a trimmed field whose trimmed text is the value.
 */
function ${name}(
  field: HTMLInputElement | HTMLTextAreaElement,
  value: unknown,
  modifiers: { trim?: boolean; number?: boolean },
): string {
  const text = field.value;
  const current = modifiers.number && !/^0\\d/.test(text) ? looseToNumber(text) : text;
  const next = value ?? "";
  if (current === next) return text;
  const editing = field.ownerDocument.activeElement === field && field.type !== "range";
  if (editing && modifiers.trim && text.trim() === next) return text;
  return String(next);
}`,
  writeModelText: (
    name: string,
  ) => `/** What a field's text writes to its model, as Vue's \`vModelText\` reads it (ADR-0054). */
function ${name}<T>(
  model: WritableSignal<T>,
  field: HTMLInputElement | HTMLTextAreaElement,
  modifiers: { trim?: boolean; number?: boolean },
): void {
  const text = modifiers.trim ? field.value.trim() : field.value;
  model.set((modifiers.number ? looseToNumber(text) : text) as T);
}`,
  looseToNumber: (
    name: string,
  ) => `/** Vue's \`looseToNumber\`: the text's leading number, or the text when it has none. */
function ${name}(text: string): string | number {
  const number = Number.parseFloat(text);
  return Number.isNaN(number) ? text : number;
}`,
  toggle: (name: string) => `/**
 * A checkbox group's array once a box is checked or unchecked, as Vue's \`vModelCheckbox\`
 * writes it (ADR-0054): a new array with the box's value added or removed.
 */
function ${name}<T>(values: readonly T[], value: T, checked: boolean): T[] {
  const index = values.indexOf(value);
  if (checked) return index === -1 ? [...values, value] : [...values];
  return values.filter((_, at) => at !== index);
}`,
  optionText: (name: string) => `/**
 * An option's value from its text, as the browser reads it without a \`value\`: its ASCII
 * whitespace stripped and collapsed (ADR-0054). A no-break space is no ASCII whitespace, so it
 * stays.
 */
function ${name}(text: string): string {
  return text.replace(/^[\\t\\n\\f\\r ]+|[\\t\\n\\f\\r ]+$/g, "").replace(/[\\t\\n\\f\\r ]+/g, " ");
}`,
  selectedValues: (
    name: string,
  ) => `/** A multiple select's selected values, as Vue's \`vModelSelect\` writes them (ADR-0054). */
function ${name}(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions, (option) => option.value);
}`,
} as const;

/** The native controls' `v-model`s of a template, and what they need from the class and the file. */
export interface Models {
  /** The attributes each `v-model` writes, by its IR attribute. */
  attributes: ReadonlyMap<ModelAttribute, PrintedAttribute[]>;
  /**
   * The model's write that runs first in the template listener of an author's listener of the
   * same element and event, by that listener's attribute (`writeFirst`).
   */
  writes: ReadonlyMap<EventAttribute, string>;
  /**
   * The `[selected]` binding of each option of a multiple select, by the attribute the template
   * adds to the option (`withSelectedOptions`).
   */
  options: ReadonlyMap<Attribute, string>;
  /** The render tree with those attributes on the options. */
  render: Plan["component"]["render"];
  /** The member that tells the server's render apart, for a select's options (`onServer`). */
  server?: string;
  /** The helpers the template calls, each once. */
  helpers: ModelHelper[];
  /** The files' functions only the helpers call (`looseToNumber`), declared in the file. */
  support: ModelHelper[];
  /** The `classNames` helper's name, where a class part may be an array or an object. */
  classNames?: string;
  /** The `styleObject` helper's name, where a style bound to a value is merged (ADR-0065). */
  styleObject?: string;
}

/** Plans every native control's `v-model` of the component's template. */
export function planModels(plan: Plan): Models {
  const attributes = new Map<ModelAttribute, PrintedAttribute[]>();
  const writes = new Map<EventAttribute, string>();
  const options = new Map<Attribute, string>();
  const helpers = new Map<keyof typeof HELPERS, ModelHelper>();
  const helper = (base: keyof typeof HELPERS): string => {
    let found = helpers.get(base);
    if (!found) {
      // A helper is a function of the file and a member of the class of one name, so it takes
      // a name free in both: the outputs and the props are members too.
      let name = plan.imports.claim(base);
      while (plan.members.has(name)) name = plan.imports.claim(base);
      plan.members.reserve(name);
      const support = base === "modelText" || base === "writeModelText";
      if (support && !helpers.has("looseToNumber")) helper("looseToNumber");
      found = { name, code: "" };
      helpers.set(base, found);
      found.code = HELPERS[base](name);
    }
    return found.name;
  };
  // The binding forms' helpers (ADR-0065), claimed before the template prints, as the class's
  // members are.
  const forms = bindingForms(plan.component);
  const classNames = forms.classCollection ? helper("classNames") : undefined;
  const styleObject = mergesWholeStyle(plan.component) ? helper("styleObject") : undefined;
  const rules = templateRules(plan);
  let server: string | undefined;
  const render = mapElements(plan.component.render, (element) => {
    const model = element.attributes.find(
      (attribute): attribute is ModelAttribute => attribute.kind === "Model",
    );
    if (!model) return element;
    const [reference] = model.value.refs;
    if (reference?.kind !== "Binding") throw new Error("A `v-model` binds no state.");
    const binding = bindingById(plan, reference.binding);
    const signal = `this.${binding.name}`;
    const ref = element.attributes.find((attribute) => attribute.kind === "Ref");
    let variable: string | undefined;
    const field = () => {
      if (ref && ref.kind === "Ref") return bindingById(plan, ref.binding).name;
      variable ??= claimVariable(plan, `${binding.name}Field`);
      return variable;
    };
    const valueOf = () => {
      const value = element.attributes.find(
        (attribute) =>
          (attribute.kind === "Static" || attribute.kind === "Bound") && attribute.name === "value",
      );
      if (value?.kind === "Bound") {
        return rewriteExpression(value.value, plan.component, rules, "render");
      }
      return JSON.stringify(value?.kind === "Static" && value.value !== true ? value.value : "on");
    };
    const printed: PrintedAttribute[] = [];
    const bind = (name: string, code: string) =>
      printed.push({ name, text: `${name}="${angularCode(code, "attribute")}"` });
    const listen = (event: string, statement: string) => {
      const first = writeFirst(element, event);
      if (first) writes.set(first, statement);
      else
        printed.push({
          name: `(${event})`,
          text: `(${event})="${angularCode(statement, "event")}"`,
        });
    };
    const text = model.control === "text" || model.control === "textarea";
    const number = model.control === "number" || model.number === true;
    if ((text || model.control === "number") && (model.trim || number)) {
      const modifiers = `{ ${[model.trim ? "trim: true" : "", number ? "number: true" : ""]
        .filter(Boolean)
        .join(", ")} }`;
      const name = field();
      bind("[value]", `${helper("modelText")}(${name}, ${signal}(), ${modifiers})`);
      const write = `${helper("writeModelText")}(${signal}, ${name}, ${modifiers})`;
      // Vue trims the field's own text once it is committed.
      const trim = model.trim ? `${name}.value = ${name}.value.trim()` : undefined;
      if (model.lazy) listen("change", trim ? `${write}; ${trim}` : write);
      else {
        listen("input", write);
        if (trim) listen("change", trim);
      }
    } else if (text) {
      // A lazy field writes on `change`; Angular sets its value only when the state changes, as
      // Vue's lazy binding leaves the text the person is still editing.
      const name = field();
      bind("[value]", `${signal}()`);
      listen(model.lazy ? "change" : "input", `${signal}.set(${name}.value)`);
    } else if (model.control === "checkbox") {
      const name = field();
      bind("[checked]", `${signal}()`);
      listen("change", `${signal}.set(${name}.checked)`);
    } else if (model.control === "radio") {
      const value = valueOf();
      bind("[checked]", `${signal}() === ${value}`);
      listen("change", `${signal}.set(${value})`);
    } else if (model.control === "checkbox-group") {
      const value = valueOf();
      const name = field();
      bind("[checked]", `${signal}().includes(${value})`);
      listen(
        "change",
        `${signal}.set(${helper("toggle")}(${signal}(), ${value}, ${name}.checked))`,
      );
    } else {
      // A select's options say whether the state holds their values: Angular's server DOM has
      // no selectedness, so there each also sets `defaultSelected`, the attribute the HTML parser
      // reads it from; in the browser it stays unset, as Vue leaves it.
      const multiple = model.control === "select-multiple";
      const name = field();
      listen(
        "change",
        `${signal}.set(${multiple ? `${helper("selectedValues")}(${name})` : `${name}.value`})`,
      );
      server ??= claimVariable(plan, "onServer");
      if (variable !== undefined) printed.unshift({ name: `#${variable}`, text: `#${variable}` });
      attributes.set(model, printed);
      // Every option of the select, wherever it sits: in a list, a conditional or an
      // `<optgroup>`, its value bound or its text's.
      const withSelected = (option: ElementNode): ElementNode => {
        if (option.tag !== "option") return option;
        const added: Attribute = {
          kind: "Static",
          name: "selected",
          value: true,
          span: option.span,
        };
        const value = optionValue(plan, option, rules, () => helper("optionText"));
        const selected = multiple ? `${signal}().includes(${value})` : `${signal}() === ${value}`;
        options.set(
          added,
          `[selected]="${angularCode(selected, "attribute")}" [defaultSelected]="${angularCode(
            `${server} && ${selected}`,
            "attribute",
          )}"`,
        );
        return { ...option, attributes: [...option.attributes, added] };
      };
      return {
        ...element,
        children: element.children.map((child) => mapElements(child, withSelected)),
      };
    }
    if (variable !== undefined) printed.unshift({ name: `#${variable}`, text: `#${variable}` });
    attributes.set(model, printed);
    return element;
  });
  const used = [...helpers.entries()];
  return {
    attributes,
    writes,
    options,
    render,
    ...(server === undefined ? {} : { server }),
    ...(classNames === undefined ? {} : { classNames }),
    ...(styleObject === undefined ? {} : { styleObject }),
    helpers: used.filter(([base]) => base !== "looseToNumber").map(([, each]) => each),
    support: used.filter(([base]) => base === "looseToNumber").map(([, each]) => each),
  };
}

/**
 * The author's listener of the element's event whose template listener the model's write joins,
 * ahead of the listener's own statement: Vue's `vModel*` directives listen in `created`, before
 * the element's own listeners, so the model is written first whatever the attributes' order, and
 * one template listener per event keeps Angular's attributes unique. That is the first listener of
 * the event in the bubble phase, which writes the template listener: alone, or chaining the others,
 * a `once` or `passive` one among them (./listeners.ts). A capture listener runs before the bubble
 * phase at its target, on Vue too, so it keeps its directive.
 */
function writeFirst(element: ElementNode, event: string): EventAttribute | undefined {
  return element.attributes.find(
    (attribute): attribute is EventAttribute =>
      attribute.kind === "Event" && attribute.event === event && !attribute.capture,
  );
}

/** HTML's ASCII whitespace, which an option's text value strips at its edges and collapses. */
const ASCII_WHITESPACE = /[\t\n\f\r ]+/g;
const ASCII_EDGES = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g;

/**
 * The value an option gives its select's model, as Vue's `vModelSelect` reads it: its bound
 * `value`, its static one, or else its text, which is an option's value without the attribute.
 * HTML strips and collapses the text's ASCII whitespace: a static text here, a text with an
 * interpolation through `optionText` as it renders.
 */
function optionValue(
  plan: Plan,
  option: ElementNode,
  rules: ReturnType<typeof templateRules>,
  optionText: () => string,
): string {
  const value = option.attributes.find(
    (attribute) =>
      (attribute.kind === "Static" || attribute.kind === "Bound") && attribute.name === "value",
  );
  if (value?.kind === "Bound") {
    return rewriteExpression(value.value, plan.component, rules, "render");
  }
  if (value?.kind === "Static") return JSON.stringify(value.value === true ? "" : value.value);
  const [only] = option.children;
  if (option.children.length === 1 && only?.kind === "Text") {
    return JSON.stringify(only.value.replace(ASCII_EDGES, "").replace(ASCII_WHITESPACE, " "));
  }
  const parts = option.children.flatMap((child) => {
    if (child.kind === "Text") return [JSON.stringify(child.value)];
    if (child.kind === "Interpolation") {
      // `{{ }}` renders `null` and `undefined` as no text.
      return [`((${rewriteExpression(child.value, plan.component, rules, "render")}) ?? "")`];
    }
    return [];
  });
  return `${optionText()}(${['""', ...parts].join(" + ")})`;
}

/** A template variable's name, free beside the class's members and the lists' variables. */
function claimVariable(plan: Plan, base: string): string {
  let name = plan.members.claim(base);
  while (plan.loopNames.has(name)) name = plan.members.claim(base);
  return name;
}

/** The render tree with each element replaced by what `map` makes of it, children first. */
function mapElements<T extends { kind: string }>(
  node: T,
  map: (element: ElementNode) => ElementNode,
): T {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (typeof value !== "object" || value === null) return value;
    if ((value as { kind?: string }).kind === "Element") {
      const element = value as ElementNode;
      return map({ ...element, children: element.children.map((child) => visit(child) as never) });
    }
    const copy: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      copy[key] = CHILD_KEYS.has(key) ? visit(child) : child;
    }
    return copy;
  };
  return visit(node) as T;
}

/** The keys under which a render node, a branch or a fill holds render nodes. */
const CHILD_KEYS = new Set(["children", "branches", "body", "fills", "fallback"]);
