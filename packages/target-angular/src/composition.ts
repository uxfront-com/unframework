// Composition on Angular (ADR-0053 to ADR-0056): the children a template renders, imported from
// their output files and listed in `imports`; a directive per named or scoped slot, which the
// component's file exports and its consumers list beside it; and the injection keys, which the
// output of their module's main component declares as `InjectionToken`s.
import { childImports, kebabCase, keyImports, keyOwner, pascalCase } from "@unframework/codegen";
import { walk } from "@unframework/ir";
import type {
  ApiEvent,
  InjectionKeyDeclaration,
  KeyApi,
  RenderNode,
  SlotDeclaration,
  SlotFill,
  Span,
  UfComponent,
} from "@unframework/ir";

import type { Plan } from "./plan.ts";

/** A slot of the component's own that a directive selects: a named one, or one with props. */
export interface SlotDirective {
  slot: SlotDeclaration;
  /** The directive's class, `CardTitle`. */
  className: string;
  /** The attribute its selector names on an `<ng-template>`, `ufCardTitle`. */
  attribute: string;
  /** The context type's name, for a slot with props: `ListItemContext`. */
  context?: string;
}

/** What a component's composition adds to its file, its metadata and its template. */
export interface Composition {
  /** The selector each component the template renders is written with, by its local name. */
  tags: ReadonlyMap<string, string>;
  /** The classes `imports` lists: the children and the slot directives their fills use. */
  imports: string[];
  /** The component's own slot directives, each declared in its file. */
  slots: SlotDirective[];
  /** Whether the template renders a template with `ngTemplateOutlet`. */
  outlet: boolean;
  /** The injection keys the file declares. */
  keys: InjectionKeyDeclaration[];
  /** The local name of each key the setup names, by that name. */
  keyNames: ReadonlyMap<string, string>;
  /**
   * The children whose selector the component's own or an earlier child's already is, by local
   * name: two components of one name, from two files (`./a/Button.uf.tsx` and
   * `./b/Button.uf.tsx`), match one element (NG8023).
   */
  clashes: ReadonlyMap<string, string>;
}

/** The output file a component's output is named by, without `./` (ADR-0053). */
export const outputFile = (name: string): string => kebabCase(name);

/** The selector a component is written with: `uf-` and its name in kebab case (ADR-0010). */
export function selectorOf(name: string): string {
  return `uf-${kebabCase(name)}`;
}

/**
 * The attribute a slot's directive selects, as `angularDialect` writes a fill: the component's
 * selector in camel case and the slot's name (`ufCardTitle`).
 */
function slotAttribute(name: string, slot: string): string {
  const component = selectorOf(name).replace(/-(\w)/g, (_, next: string) => next.toUpperCase());
  return `${component}${pascalCase(slot)}`;
}

/** Whether a slot is written through a directive: any but the default slot without props. */
export function usesDirective(slot: string, scoped: boolean): boolean {
  return slot !== "default" || scoped;
}

/** Where the template first renders a child, by its local name: the component's span if nowhere. */
export function firstUse(component: UfComponent, local: string): Span {
  let found: Span | undefined;
  walk(component.render, {
    enter(node: RenderNode) {
      if (found) return;
      const names =
        node.kind === "Component"
          ? [node.component]
          : node.kind === "Dynamic"
            ? node.candidates.flatMap((each) => (each.kind === "Component" ? [each.component] : []))
            : [];
      if (names.includes(local)) found = node.span;
    },
  });
  return found ?? component.span;
}

/** Plans the component's composition: its children, its slots and its keys. */
export function planComposition(plan: Plan): Composition {
  const { component, module, imports } = plan;
  const tags = new Map<string, string>();
  const classes: string[] = [];
  const specifiers = new Map<string, { specifier: string; name: string; self: boolean }>();
  const clashes = new Map<string, string>();
  const selectors = new Set([selectorOf(component.name)]);
  for (const child of childImports(component, module, outputFile)) {
    const selector = selectorOf(child.name);
    if (!child.self && selectors.has(selector)) clashes.set(child.local, selector);
    selectors.add(selector);
    tags.set(child.local, selector);
    specifiers.set(child.local, child);
    // A component that renders itself uses its own selector, with nothing in `imports`.
    if (child.self) continue;
    const local =
      child.export === "default"
        ? imports.addDefault(child.specifier, child.local, { exact: true })
        : imports.add(child.specifier, child.name, { local: child.local, exact: true });
    if (!classes.includes(local)) classes.push(local);
  }
  const slots: SlotDirective[] = (component.slots?.slots ?? [])
    .filter((slot) => usesDirective(slot.name, slot.props !== undefined))
    .map((slot) => {
      const className = imports.claim(`${component.name}${pascalCase(slot.name)}`);
      return {
        slot,
        className,
        attribute: slotAttribute(component.name, slot.name),
        ...(slot.props ? { context: imports.claim(`${className}Context`) } : {}),
      };
    });
  let outlet = false;
  const fillDirectives = (local: string, fills: readonly SlotFill[]) => {
    const child = specifiers.get(local)!;
    for (const fill of fills) {
      // The default slot forwarded re-projects `<ng-content />` (unsupported: `default-slot-presence`).
      if (fill.forward !== undefined && fill.slot !== "default") outlet = true;
      if (!usesDirective(fill.slot, fill.parameter !== undefined)) continue;
      const name = `${child.name}${pascalCase(fill.slot)}`;
      const directive = child.self
        ? slots.find((slot) => slot.slot.name === fill.slot)!.className
        : imports.add(child.specifier, name);
      if (!classes.includes(directive)) classes.push(directive);
    }
  };
  walk(component.render, {
    enter(node: RenderNode) {
      if (node.kind === "Component") fillDirectives(node.component, node.fills);
      if (node.kind === "Dynamic") {
        for (const candidate of node.candidates) {
          if (candidate.kind === "Component") fillDirectives(candidate.component, node.fills ?? []);
        }
      }
      if (node.kind === "SlotOutlet" && usesDirective(node.slot, node.props !== undefined)) {
        outlet = true;
      }
    },
  });
  if (outlet) classes.push(imports.add("@angular/common", "NgTemplateOutlet"));
  const keyNames = new Map<string, string>();
  for (const key of keyImports(component, module, outputFile)) {
    keyNames.set(
      key.local,
      key.specifier
        ? imports.add(key.specifier, key.name, { local: key.local, exact: true })
        : key.local,
    );
  }
  const keys =
    module.keys?.length && keyOwner(module.components, module.exports) === component.name
      ? module.keys
      : [];
  return { tags, imports: classes, slots, outlet, keys, keyNames, clashes };
}

/**
 * A key's declaration or its API, by the local name a component's setup gives it: the module's
 * own, or the one an import names.
 */
export function keyOf(plan: Plan, local: string): InjectionKeyDeclaration | KeyApi {
  const { module } = plan;
  const own = module.keys?.find((key) => key.name === local);
  if (own) return own;
  for (const entry of module.imports ?? []) {
    const name = entry.names.find((each) => each.kind === "Key" && each.local === local);
    const key = name && entry.api.keys.find((each) => each.name === name.imported);
    if (key) return key;
  }
  throw new Error(`No injection key is named ${local}.`);
}

/**
 * The type an injection token holds: the key's, or for a key of a ref (`Ref<number>`) an object
 * with a `value` getter of the ref's type, which `refObject` makes (ADR-0054).
 */
export function tokenType(key: InjectionKeyDeclaration | KeyApi): string {
  const type = typeof key.type === "string" ? key.type : key.type.code;
  if (!key.ref) return type;
  const inner = type.slice(type.indexOf("<") + 1, type.lastIndexOf(">")).trim();
  return `{ readonly value: ${inner} }`;
}

/**
 * The event a child declares under a name: from its module's API, or from the module's own
 * component, as `ApiEvent`.
 */
export function childEvent(plan: Plan, local: string, event: string): ApiEvent {
  const { module } = plan;
  for (const entry of module.imports ?? []) {
    const imported = entry.names.find((name) => name.kind === "Component" && name.local === local);
    if (!imported) continue;
    const api = entry.api.components.find((each) =>
      imported.imported === "default"
        ? each.export === "default"
        : each.export === "named" && each.name === imported.imported,
    );
    const found = api?.events.find((each) => each.name === event);
    if (found) return found;
  }
  const own = module.components.find((each) => each.name === local);
  const declared = own?.emits?.events.find((each) => each.name === event);
  if (!declared) throw new Error(`${local} declares no event ${event}.`);
  return {
    name: declared.name,
    parameters: declared.parameters.map((parameter) => ({
      name: parameter.name,
      type: parameter.type.code,
      ...(parameter.optional ? { optional: true as const } : {}),
    })),
  };
}

/**
 * A slot directive's code (ADR-0056): the selector its consumers' `<ng-template>` names and, for
 * a scoped slot, the context guard that types their `let-` variables as the slot's props, by
 * name and whole (`$implicit`).
 */
export function slotDirectiveCode(
  component: string,
  directive: SlotDirective,
  decorator: string,
): string {
  const { slot, className, attribute, context } = directive;
  const selector = `@${decorator}({ selector: "ng-template[${attribute}]" })`;
  // A slot without props passes an empty context, so a consumer's `let-` variable is an error.
  const type = context ? `${context} & { $implicit: ${context} }` : "Record<never, never>";
  return [
    ...(context
      ? [
          `/** What a template of \`${component}\`'s \`${slot.name}\` slot reads: the slot's props. */`,
          `export type ${context} = ${slot.props!.code}${aliases(slot.props!.code)};`,
          "",
        ]
      : []),
    `/** A template of \`${component}\`'s \`${slot.name}\` slot, ${context ? "its `let-` variables typed" : "which takes no `let-` variable"} (ADR-0056). */`,
    selector,
    `export class ${className} {`,
    `  static ngTemplateContextGuard(`,
    `    _directive: ${className},`,
    `    _context: unknown,`,
    `  ): _context is ${type} {`,
    `    return true;`,
    `  }`,
    `}`,
    "",
  ].join("\n");
}

/** `refObject`'s code: a ref's value through a getter, as a descendant reads a provided ref. */
export function refObjectCode(name: string): string {
  return `/** A ref as a descendant injects it (ADR-0054): its value through a getter, read as it changes. */
function ${name}<T>(ref: () => T): { readonly value: T } {
  return {
    get value() {
      return ref();
    },
  };
}
`;
}

/**
 * The context's names for the slot's props whose names no template variable can read
 * (`"data-id"`, which a `let-` value would read as `data - id`): each in camel case, of the
 * prop's type (` & { dataId: string }`), as `angularDialect` writes the outlet's context and
 * the fill's `let-` values.
 */
function aliases(props: string): string {
  const found = [...props.matchAll(/["']([^"']+)["']\??\s*:\s*([^;,}]+)/g)].filter(
    ([, key]) => !/^[A-Za-z_$][\w$]*$/.test(key!),
  );
  if (!found.length) return "";
  return ` & { ${found.map(([, key, type]) => `${contextAlias(key!)}: ${type!.trim()}`).join("; ")} }`;
}

/** A prop's name as a context key a template variable can read: `data-id` → `dataId`. */
function contextAlias(key: string): string {
  return key
    .replace(/[^A-Za-z0-9_$]+(.)?/g, (_, next: string | undefined) => next?.toUpperCase() ?? "")
    .replace(/^(?=\d)/, "_");
}
