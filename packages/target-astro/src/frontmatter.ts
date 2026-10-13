// An Astro component's frontmatter (ADR-0034, ADR-0046, ADR-0054): the imports of the children
// it renders, the types its props and its kept setup reach, copied as the source writes them,
// `Props`, which Astro types `Astro.props` and the component's callers by, the props the server
// render reads from `Astro.props` (its models, render props and fallthrough included), the
// setup's values (`./setup.ts`), and each `<component is>` as a constant.
import {
  js,
  keyImports,
  liveTypes,
  printProgram,
  rewriteExpression,
  typeDeclarationCode,
} from "@unframework/codegen";
import type { ChildImport, ImportSet } from "@unframework/codegen";
import { expressionsOf, walk } from "@unframework/ir";
import type { BindingId, InjectItem, ModelItem, UfComponent, UfModule } from "@unframework/ir";

import { isRenderProp } from "./composition.ts";
import type { AstroRender } from "./composition.ts";
import { SERVER, serverBindings, setupCode } from "./setup.ts";
import type { Spelling } from "./spelling.ts";

/** What the frontmatter declares beside the setup: the children, and the tree's own names. */
export interface FrontmatterParts {
  spelling: Spelling;
  /** The children's imports (`import Field from "./Field.astro";`), in the file's name scope. */
  imports: ImportSet;
  render: AstroRender;
  /** Whether the markup names `Astro` (`Astro.slots`, `Astro.self`). */
  markupNamesAstro: boolean;
}

/**
 * The tag each child is written with, and its import (ADR-0053): a default import of its own
 * `.astro` file, each file once, and `Astro.self` for the component itself, which Astro's
 * compiler gives every component.
 */
export function childTags(
  children: readonly ChildImport[],
  imports: ImportSet,
): Map<string, string> {
  const tags = new Map<string, string>();
  for (const child of children) {
    if (child.self) {
      tags.set(child.local, "Astro.self");
      continue;
    }
    const local = imports.addDefault(child.specifier, child.local, { exact: true });
    if (local !== child.local) tags.set(child.local, local);
  }
  return tags;
}

/**
 * The type names TypeScript declares, which an injected value's type may name and no module
 * exports.
 */
const GLOBAL_TYPES: ReadonlySet<string> = new Set([
  "Array",
  "Date",
  "Map",
  "Omit",
  "Partial",
  "Pick",
  "Promise",
  "Readonly",
  "ReadonlyArray",
  "Record",
  "Required",
  "Set",
]);

/**
 * The frontmatter of a component, in order: the children's imports, the type declarations it
 * reaches, `Props`, the props the server render reads, then the setup it keeps (helpers first,
 * then its values in source order), then the constants `<component is>` renders. `Props` is an
 * alias of the props type (`type Props = CardProps;`), or an interface with the members of an
 * inline object type, which reads as Astro's own examples do; a props type already named `Props`
 * is copied as it is. The props type is extended with what a consumer passes beside the source's
 * props: each model, each scoped slot's render prop, and the `class` and `style` that fall
 * through (ADR-0054). Only the props something printed reads are destructured: the markup (but
 * a list's key, which Astro does not print), and the setup's kept values. The whole statement is
 * left out when they read none. The object form keeps its object (`const props = Astro.props;`),
 * so its references stay as written. Only the types the printed code reaches are declared
 * (`liveTypes`), and those the source exports.
 *
 * A component whose file does not name `Astro` exports `Props`, as Astro's docs allow: nothing in
 * the file reads it then, and astro-eslint-parser counts Astro's own read of `Props` only in a
 * file that names `Astro`, so the linter would report it unused (L5). Exported, it is still what
 * Astro types the component's callers by, and eslint-plugin-astro allows type exports.
 */
export function frontmatterOf(
  component: UfComponent,
  module: UfModule,
  { spelling, imports, render, markupNamesAstro }: FrontmatterParts,
): string | undefined {
  const parameter = component.propsParameter;
  const live = serverBindings(component);
  const setup = setupCode(component, live, spelling, (item) =>
    injectedType(item, component, module, imports),
  );
  const reads = propsRead(component, live, spelling, render);
  const exported = !reads.length && !setup.readsAstro && !markupNamesAstro;
  const extras = propsExtras(component, render);
  const ownProps =
    extras.length && parameter?.type.code.trim() === "Props"
      ? spelling.scope.claim("OwnProps")
      : undefined;
  const sections: string[][] = [];
  for (const declaration of liveTypes(component, module, SERVER)) {
    let code =
      exported && parameter && declaration.name === "Props" && !declaration.exported
        ? `export ${declaration.code}`
        : typeDeclarationCode(declaration);
    // The source's `Props` is extended under another name (`interface Props extends OwnProps`).
    if (ownProps && declaration.name === "Props") code = code.replace(/\bProps\b/, ownProps);
    sections.push([code]);
  }
  const alias = propsDeclaration(parameter?.type.code, extras, ownProps);
  if (alias !== undefined) sections.push([exported ? `export ${alias}` : alias]);
  if (reads.length) sections.push(reads);
  for (const helper of setup.helpers) sections.push([helper]);
  if (setup.statements.length) sections.push(setup.statements);
  const constants = [...render.dynamics].map(
    ([node, name]) => `const ${name} = ${rewriteExpression(node.is, component, spelling.rules)};`,
  );
  if (constants.length) sections.push(constants);
  // Imported last: the setup adds the types an injected value names.
  if (imports.size) sections.unshift([printProgram(js.program(imports.toDeclarations())).trim()]);
  return frontmatterCode(sections);
}

/**
 * The members a consumer passes beside the source's props (ADR-0054): each model, as a prop, a
 * scoped slot as a render prop, and the `class` and `style` that fall through to the root. A
 * consumer's style is an object, which the root spreads after its own declarations.
 */
function propsExtras(component: UfComponent, render: AstroRender): string[] {
  const members: string[] = [];
  for (const item of component.setup) {
    if (item.kind === "Model") {
      members.push(`${item.name}${item.required ? "" : "?"}: ${item.type?.code ?? "unknown"}`);
    }
  }
  for (const slot of component.slots?.slots ?? []) {
    if (slot.props) members.push(`${slot.name}?: (props: ${slot.props.code}) => unknown`);
  }
  if (render.fallthrough) {
    members.push("class?: string", "style?: Record<string, string | number | undefined>");
  }
  return members;
}

/**
 * The statements that read the props something printed reads from `Astro.props`: none when
 * nothing does. The destructured form lists them in the order the source destructures them,
 * with their defaults, then the models, the render props and the fallthrough; the object form
 * keeps the object, under its own name unless Astro takes it, and destructures the rest beside it.
 */
function propsRead(
  component: UfComponent,
  live: ReadonlySet<BindingId>,
  spelling: Spelling,
  render: AstroRender,
): string[] {
  const statements: string[] = [];
  const parameter = component.propsParameter;
  const names: string[] = [];
  if (parameter?.form === "object") {
    if (component.props.some(({ binding }) => binding !== undefined && live.has(binding))) {
      statements.push(`const ${spelling.propsObject ?? parameter.name!} = Astro.props;`);
    }
  } else if (parameter) {
    names.push(
      ...component.props
        .flatMap((prop) =>
          prop.binding !== undefined && live.has(prop.binding)
            ? [{ prop, start: bindingStart(component, prop.binding) }]
            : [],
        )
        .toSorted((a, b) => a.start - b.start)
        .map(({ prop }) => (prop.default ? `${prop.name} = ${prop.default.code}` : prop.name)),
    );
  }
  for (const item of component.setup) {
    if (item.kind === "Model" && live.has(item.binding)) names.push(modelRead(item, spelling));
  }
  const read = renderPropsRead(component);
  for (const [slot, local] of spelling.renderProps) {
    if (read.has(slot)) names.push(slot === local ? slot : `${slot}: ${local}`);
  }
  if (render.fallthrough) {
    const { className, style } = render.fallthrough;
    names.push(`class: ${className}`, style === "style" ? style : `style: ${style}`);
  }
  if (names.length) statements.push(`const { ${names.join(", ")} } = Astro.props;`);
  return statements;
}

/** A model, read as the prop it is, with its default: `value = 0`, `open: expanded = false`. */
function modelRead(item: ModelItem, spelling: Spelling): string {
  const local = spelling.name(item.binding);
  const target = local === item.name ? local : `${item.name}: ${local}`;
  return item.default ? `${target} = ${item.default.code}` : target;
}

/** The scoped slots the markup reads: renders, tests or forwards. */
function renderPropsRead(component: UfComponent): Set<string> {
  const read = new Set<string>();
  walk(component.render, {
    enter(node) {
      if (node.kind === "SlotOutlet" && node.props) read.add(node.slot);
      if (node.kind === "Component" || node.kind === "Dynamic") {
        for (const fill of node.fills ?? []) {
          if (fill.forward !== undefined && isRenderProp(fill, component)) read.add(fill.forward);
        }
      }
    },
  });
  for (const { expression } of expressionsOf(component)) {
    for (const reference of expression.refs)
      if (reference.kind === "Slot") read.add(reference.slot);
  }
  return read;
}

/**
 * The type of the value an `inject` without a fallback would give: the key's, or the type of the
 * ref a key of a ref holds, which the markup reads as a value (ADR-0054). The names it takes from
 * the module that declares an imported key are imported from that module's output.
 */
function injectedType(
  item: InjectItem,
  component: UfComponent,
  module: UfModule,
  imports: ImportSet,
): string {
  const key = keyImports(component, module, (name) => `${name}.astro`).find(
    (each) => each.local === item.key,
  )!;
  let declared: { type: string; ref?: string } | undefined;
  for (const entry of module.imports ?? []) {
    const imported = entry.names.find((name) => name.kind === "Key" && name.local === item.key);
    if (imported) declared = entry.api.keys.find((each) => each.name === imported.imported);
  }
  if (!declared) {
    const own = module.keys!.find((each) => each.name === key.name)!;
    declared = { type: own.type.code, ...(own.ref ? { ref: own.ref } : {}) };
  }
  const type = declared.ref
    ? declared.type.slice(declared.type.indexOf("<") + 1, declared.type.lastIndexOf(">"))
    : declared.type;
  if (key.specifier) {
    for (const [name] of type.matchAll(/(?<![\w$.])[A-Z][\w$]*/g)) {
      if (!GLOBAL_TYPES.has(name)) imports.add(key.specifier, name, { type: true, exact: true });
    }
  }
  return type;
}

/**
 * `Props` for a props type annotation and the members a consumer passes beside it: an alias of a
 * reference, an interface holding an inline object type's members, an interface extending the
 * reference, or nothing when the reference is `Props` itself and nothing extends it. The analyser
 * accepts only those two forms, parenthesised or not.
 */
function propsDeclaration(
  annotation: string | undefined,
  extras: readonly string[],
  ownProps: string | undefined,
): string | undefined {
  if (annotation === undefined) {
    return extras.length ? `interface Props { ${extras.join("; ")} }` : undefined;
  }
  let type = annotation.trim();
  while (type.startsWith("(") && type.endsWith(")")) type = type.slice(1, -1).trim();
  if (type.startsWith("{")) {
    const members = type.slice(1, -1).trim().replace(/[;,]$/, "");
    return `interface Props { ${[...(members ? [members] : []), ...extras].join("; ")} }`;
  }
  if (!extras.length) return type === "Props" ? undefined : `type Props = ${type};`;
  return `interface Props extends ${ownProps ?? type} { ${extras.join("; ")} }`;
}

function bindingStart(component: UfComponent, id: BindingId): number {
  return component.bindings.find((binding) => binding.id === id)!.span.start;
}

/** Sections a blank line apart, as oxfmt keeps them; none without. */
function frontmatterCode(sections: readonly (readonly string[])[]): string | undefined {
  return sections.length ? sections.map(section).join("\n") : undefined;
}

/**
 * A section's statements, each on lines of its own: one-line statements follow each other, and
 * a statement over several lines (a function) has a blank line on each side.
 */
function section(statements: readonly string[]): string {
  return statements
    .map((statement, index) => {
      const previous = statements[index - 1];
      const apart = previous !== undefined && (previous.includes("\n") || statement.includes("\n"));
      return `${apart ? "\n" : ""}${statement}\n`;
    })
    .join("");
}
