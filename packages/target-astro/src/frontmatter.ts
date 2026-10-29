// An Astro component's frontmatter (ADR-0034, ADR-0046, ADR-0054): the imports of the children
// it renders, the types its props and its kept setup reach, copied as the source writes them,
// `Props`, which Astro types `Astro.props` and the component's callers by, the props the server
// render reads from `Astro.props` (its models, render props and fallthrough included), the
// setup's values (`./setup.ts`), and each `<component is>` as a constant.
import {
  addTypeImports,
  codeNames,
  js,
  keyImports,
  keyOwner,
  liveTypes,
  parseStatementsSource,
  printProgram,
  rewriteExpression,
  typeDeclarationCode,
  typeExportsCode,
  typeNames,
} from "@unframework/codegen";
import type { ChildImport, ImportSet } from "@unframework/codegen";
import { expressionsOf, walk } from "@unframework/ir";
import type {
  BindingId,
  InjectItem,
  ModelItem,
  TypeParameter,
  UfComponent,
  UfModule,
} from "@unframework/ir";

import { isRenderProp, ownProps } from "./composition.ts";
import type { AstroRender } from "./composition.ts";
import { SERVER, serverBindings, setupCode } from "./setup.ts";
import { renderPropName } from "./spelling.ts";
import type { Spelling } from "./spelling.ts";

/** What the frontmatter declares beside the setup: the children, and the tree's own names. */
export interface FrontmatterParts {
  spelling: Spelling;
  /** The children's imports (`import Field from "./Field.astro";`), in the file's name scope. */
  imports: ImportSet;
  render: AstroRender;
  /** Whether the markup names `Astro` (`Astro.slots`, `Astro.self`). */
  markupNamesAstro: boolean;
  /** The `scopeAttributes` helper's name, when the root takes its parents' (ADR-0063). */
  scope?: string;
  /** The `styleObject` helper's name, when a style bound to a value is merged (ADR-0065). */
  styleObject?: string;
  /** The emitted sheet the component imports, `./Card.uf.tsx.css` (ADR-0063). */
  sheet?: string;
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
 * The types the source imports are imported by name, those the printed code reaches (ADR-0067):
 * from a `.ts` module or a package as written, and from a child's output, `./Field.astro`. An
 * imported `Props` is imported as `OwnProps`, and every reference to it is renamed, since Astro
 * declares its own `Props`. The output of the module's main component also writes the module's
 * other type exports, among the copied types in source order (ADR-0068), and exports its `Props`
 * when the source exports its own. A generic component's `Props` takes its type parameters,
 * `interface Props<T> extends ListProps<T>`, which Astro infers from a consumer's props
 * (ADR-0068). Astro declares them on the component's render function alone, so where the kept
 * setup names one, the frontmatter declares it as its constraint,
 * `type T = Item;` (`unknown` without one), as Angular's slot context takes a constraint.
 *
 * A component whose file does not name `Astro` exports `Props`, as Astro's docs allow: nothing in
 * the file reads it then, and astro-eslint-parser counts Astro's own read of `Props` only in a
 * file that names `Astro`, so the linter would report it unused (L5). Exported, it is still what
 * Astro types the component's callers by, and eslint-plugin-astro allows type exports.
 */
export function frontmatterOf(
  component: UfComponent,
  module: UfModule,
  { spelling, imports, render, markupNamesAstro, scope, styleObject, sheet }: FrontmatterParts,
): string | undefined {
  const parameter = component.propsParameter;
  const live = serverBindings(component);
  const setup = setupCode(component, live, spelling, (item) =>
    injectedType(item, component, module, imports),
  );
  const reads = propsRead(component, live, spelling, render);
  const exported = !reads.length && !setup.readsAstro && !markupNamesAstro;
  // The type imports keep the source's names, which Astro's own names never take, but `Props`.
  const imported = (module.typeImports ?? []).flatMap(({ names }) =>
    names.map(({ local }) => local),
  );
  for (const name of imported) if (name !== "Props") spelling.scope.reserve(name);
  const types = liveTypes(component, module, SERVER);
  const sourceProps = types.find(({ name }) => name === "Props");
  const ownProps =
    imported.includes("Props") ||
    (sourceProps && propsExtras(component, render, (type) => type).length)
      ? spelling.scope.claim("OwnProps")
      : undefined;
  // The source's `Props` under the name it takes beside Astro's (`interface Props extends
  // OwnProps`), in every type the output prints.
  const own = (type: string) => (ownProps ? renameTypeReferences(type, "Props", ownProps) : type);
  const extras = propsExtras(component, render, own);
  addTypeImports(component, module, imports, (name) => `${name}.astro`, {
    live: SERVER,
    local: (name) => (ownProps && name === "Props" ? ownProps : name),
  });
  const sections: string[][] = [];
  const declared = types.map((declaration) => {
    let code =
      exported && parameter && declaration.name === "Props" && !declaration.exported
        ? `export ${declaration.code}`
        : typeDeclarationCode(declaration);
    code = own(code);
    if (ownProps && declaration.name === "Props") code = code.replace(/\bProps\b/, ownProps);
    return { code, span: declaration.span };
  });
  const typeExports = typeExportsCode(component, module, (name) => `${name}.astro`).map(
    ({ code, span }) => ({ code: own(code), span }),
  );
  for (const { code } of [...declared, ...typeExports].toSorted(
    (a, b) => a.span.start - b.span.start,
  )) {
    sections.push([code]);
  }
  for (const statement of keyTypes(component, module, new Set(types.map(({ name }) => name)))) {
    sections.push([statement]);
  }
  const alias = propsDeclaration(
    parameter && own(parameter.type.code),
    extras,
    typeParametersCode(component.typeParameters),
  );
  // Exported where the source exports its own `Props` too, under the same name (ADR-0068).
  if (alias !== undefined) {
    sections.push([exported || sourceProps?.exported ? `export ${alias}` : alias]);
  }
  const scoped = typeParameterAliases(component, [...reads, ...setup.helpers, ...setup.statements]);
  if (scoped.length) sections.push(scoped);
  if (reads.length) sections.push(reads);
  for (const helper of setup.helpers) sections.push([helper]);
  if (scope) sections.push([scopeAttributesHelper(scope)]);
  if (styleObject) sections.push([styleObjectHelper(styleObject)]);
  if (setup.statements.length) sections.push(setup.statements);
  // Each hoisted `<component is>` once, though a branch per set of forwarded slots repeats it.
  const constants = new Map<string, string>();
  for (const [node, { name, hoisted }] of render.dynamics) {
    if (!hoisted || constants.has(name)) continue;
    constants.set(
      name,
      `const ${name} = ${rewriteExpression(node.is, component, spelling.rules)};`,
    );
  }
  if (constants.size) sections.push([...constants.values()]);
  // Imported last: the setup adds the types an injected value names. The sheet follows the
  // children's outputs.
  const declarations = [
    ...(imports.size ? [printProgram(js.program(imports.toDeclarations())).trim()] : []),
    ...(sheet ? [`import ${JSON.stringify(sheet)};`] : []),
  ];
  if (declarations.length) sections.unshift([declarations.join("\n")]);
  return frontmatterCode(sections);
}

/**
 * The `styleObject` helper (`style-binding`, emulated, ADR-0065): a style bound to a value as an
 * object, which a merge spreads. A declaration list splits as Vue's `parseStringStyle` splits
 * it, with camel-case keys, as the consumer's object has them, which Astro writes in kebab case.
 */
function styleObjectHelper(name: string): string {
  // Raw, so the regular expressions keep their escapes.
  return String.raw`/** A style bound to a value as an object: a declaration list becomes one. */
function ${name}(style: object | string | null | undefined): Record<string, string> {
  if (typeof style !== "string") return { ...style };
  const object: Record<string, string> = {};
  for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
    const [property, value] = declaration.split(/:([^]+)/);
    const key = property!.trim();
    // A property is a custom property or a CSS identifier: anything else would reach the markup.
    if (value === undefined || !/^(?:--[^\s"'<>&;:]+|-?[A-Za-z_][\w-]*)$/.test(key)) continue;
    // A standard name is case-insensitive, as the browser reads it: COLOR is color.
    const camel = key.toLowerCase().replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    object[key.startsWith("--") ? key : camel] = value.trim();
  }
  return object;
}`;
}

/**
 * The `scopeAttributes` helper (`child-root-scope`, emulated, ADR-0063): the props' `data-uf-*`
 * keys, each with the empty value the parent passes. It passes on no prop the component
 * declares, which a spread of `Astro.props` would.
 */
function scopeAttributesHelper(name: string): string {
  return [
    "/** The scope attributes of the styled parents that render this component, for its root. */",
    `function ${name}(props: object): Record<string, ""> {`,
    '  const scope: Record<string, ""> = {};',
    '  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";',
    "  return scope;",
    "}",
  ].join("\n");
}

/**
 * The members a consumer passes beside the source's props (ADR-0054): each model, as a prop, a
 * scoped slot as a render prop, and the `class` and `style` that fall through to the root. A
 * consumer's style is an object, which the root spreads after its own declarations.
 */
function propsExtras(
  component: UfComponent,
  render: AstroRender,
  own: (type: string) => string,
): string[] {
  const members: string[] = [];
  for (const item of component.setup) {
    if (item.kind === "Model") {
      const type = item.type ? own(item.type.code) : "unknown";
      members.push(`${item.name}${item.required ? "" : "?"}: ${type}`);
    }
  }
  for (const slot of component.slots?.slots ?? []) {
    if (slot.props) {
      members.push(
        `${renderPropName(slot.name, ownProps(component))}?: (props: ${own(slot.props.code)}) => unknown`,
      );
    }
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
    const prop = renderPropName(slot, ownProps(component));
    if (read.has(slot)) names.push(prop === local ? prop : `${prop}: ${local}`);
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
 * The type an `inject` gives its value (ADR-0054): the type the key's owner exports under the
 * key's name (`keyTypes`), imported from the owner's output unless it is this one.
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
  if (!key.specifier) return key.name;
  return imports.add(key.specifier, key.name, { type: true, local: key.local, exact: true });
}

/**
 * The value type of each injection key the module declares, exported by the output of its main
 * component under the key's name (`export type ThemeKey = Theme;`), for the components that
 * inject it (ADR-0054): Astro drops the key itself, and the type, written where the source wrote
 * it, names what that module declares. A key of a ref gives the ref's value, which the markup
 * reads. Each module type the alias reaches is declared there too.
 */
function keyTypes(
  component: UfComponent,
  module: UfModule,
  declared: ReadonlySet<string>,
): string[] {
  if (!module.keys?.length || keyOwner(module.components, module.exports) !== component.name) {
    return [];
  }
  const statements: string[] = [];
  const named = new Set<string>();
  for (const key of module.keys) {
    const type = key.ref
      ? key.type.code.slice(key.type.code.indexOf("<") + 1, key.type.code.lastIndexOf(">"))
      : key.type.code;
    for (const name of typeNames(type)) named.add(name);
    statements.push(`export type ${key.name} = ${type};`);
  }
  // The module types the aliases reach, through the types they name in turn, as `liveTypes`
  // follows a component's: the analyser lists them in the owner's `types`.
  const owned = new Map(
    module.types
      .filter((each) => component.types.includes(each.name))
      .map((each) => [each.name, each]),
  );
  const pending = [...named];
  for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
    const declaration = owned.get(name);
    if (!declaration) continue;
    for (const next of declarationNames(declaration.code)) {
      if (!named.has(next)) {
        named.add(next);
        pending.push(next);
      }
    }
  }
  const types = module.types
    .filter((each) => named.has(each.name) && owned.has(each.name) && !declared.has(each.name))
    .map(typeDeclarationCode);
  return [...types, ...statements];
}

/** The type names a declaration's code refers to: its references and what it extends. */
function declarationNames(code: string): Set<string> {
  const names = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const each of node) visit(each);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const reference =
      record.type === "TSTypeReference"
        ? record.typeName
        : record.type === "TSInterfaceHeritage"
          ? record.expression
          : undefined;
    let head = reference as Record<string, unknown> | undefined;
    while (head?.type === "TSQualifiedName" || head?.type === "MemberExpression") {
      head = (head.left ?? head.object) as Record<string, unknown>;
    }
    if (head?.type === "Identifier") names.add(head.name as string);
    for (const [key, value] of Object.entries(record)) if (key !== "parent") visit(value);
  };
  visit(parseStatementsSource(code).statements);
  return names;
}

/**
 * `Props` for a props type annotation and the members a consumer passes beside it: an alias of the
 * annotation, an interface holding an inline object type's members, an interface extending a
 * reference, an intersection with the members for any other type (`Base & { n: number }`), which
 * an interface cannot extend, or nothing when the reference is `Props` itself and nothing extends
 * it. A generic component's `Props` declares its type parameters (`generics`, `<T>`), which its
 * members read.
 */
function propsDeclaration(
  annotation: string | undefined,
  extras: readonly string[],
  generics: string,
): string | undefined {
  // Each member on a line of its own, after the source's members as written: a line break ends
  // a member, and a comment the source ends its last member with.
  const members = extras.map((member) => `\n  ${member};`).join("");
  if (annotation === undefined) return extras.length ? `interface Props {${members}\n}` : undefined;
  const { type, kind } = unwrapped(annotation);
  if (kind === "TSTypeLiteral") {
    return extras.length
      ? `interface Props${generics} ${type.slice(0, -1).trimEnd()}${members}\n}`
      : `interface Props${generics} ${type}`;
  }
  if (!extras.length) return type === "Props" ? undefined : `type Props${generics} = ${type};`;
  if (kind === "TSTypeReference") {
    return `interface Props${generics} extends ${type} {${members}\n}`;
  }
  const operand = kind === "TSIntersectionType" ? type : `(${type})`;
  return `type Props${generics} = ${operand} & {${members}\n};`;
}

/**
 * A type's code without the parentheses that enclose the whole of it, and its AST node's kind:
 * `({ a: string })` is the type literal `{ a: string }`, and `(A) & (B)` stays as written.
 */
function unwrapped(annotation: string): { type: string; kind: string | undefined } {
  const prefix = "type T = ";
  const source = `${prefix}${annotation.trim()};`;
  const [statement] = parseStatementsSource(source).statements;
  if (statement?.type !== "TSTypeAliasDeclaration")
    return { type: annotation.trim(), kind: undefined };
  let node = statement.typeAnnotation;
  while (node.type === "TSParenthesizedType") node = node.typeAnnotation;
  return { type: source.slice(node.start, node.end), kind: node.type };
}

/**
 * A type's or a declaration's code with each reference to the type `from` renamed `to`, its
 * members' keys and the names it declares left as written: `Props & { a: Props["a"] }` reads
 * `OwnProps & { a: OwnProps["a"] }`.
 */
function renameTypeReferences(code: string, from: string, to: string): string {
  const declaration = /^\s*(?:export\s+)?(?:interface|type)\s/.test(code);
  const prefix = declaration ? "" : "type T = ";
  const source = declaration ? code : `${prefix}${code};`;
  const starts: number[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const each of node) visit(each);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const reference =
      record.type === "TSTypeReference"
        ? record.typeName
        : record.type === "TSInterfaceHeritage"
          ? record.expression
          : undefined;
    let head = reference as Record<string, unknown> | undefined;
    while (head?.type === "TSQualifiedName" || head?.type === "MemberExpression") {
      head = (head.left ?? head.object) as Record<string, unknown>;
    }
    if (head?.type === "Identifier" && head.name === from) starts.push(head.start as number);
    for (const [key, value] of Object.entries(record)) if (key !== "parent") visit(value);
  };
  visit(parseStatementsSource(source).statements);
  let renamed = source;
  for (const start of starts.toSorted((a, b) => b - a)) {
    renamed = `${renamed.slice(0, start)}${to}${renamed.slice(start + from.length)}`;
  }
  return declaration ? renamed : renamed.slice(prefix.length, -1);
}

/**
 * The type parameters the kept setup's code names, each declared as its constraint at the
 * frontmatter's top level, `type T = Item;`, or `unknown` without one: Astro declares `Props`'
 * type parameters on the component's render function alone, which the frontmatter and the markup
 * are outside. The markup names none: a template expression has no TypeScript syntax (UF1002). A
 * constraint that names another parameter (`U extends T`) declares that one too.
 */
function typeParameterAliases(component: UfComponent, code: readonly string[]): string[] {
  const parameters = component.typeParameters ?? [];
  if (!parameters.length) return [];
  const named = new Set<string>();
  for (const each of code) for (const name of codeNames(each, "statements")) named.add(name);
  for (const parameter of parameters.toReversed()) {
    if (!named.has(parameter.name) || !parameter.constraint) continue;
    for (const name of typeNames(parameter.constraint)) named.add(name);
  }
  return parameters
    .filter(({ name }) => named.has(name))
    .map(({ name, constraint }) => `type ${name} = ${constraint?.code ?? "unknown"};`);
}

/** A component's type parameters as the source writes them, `<T extends Item = Item>`, or none. */
function typeParametersCode(parameters: readonly TypeParameter[] | undefined): string {
  if (!parameters?.length) return "";
  const written = parameters.map(({ name, constraint, default: fallback }) => {
    const bound = constraint ? ` extends ${constraint.code}` : "";
    return `${name}${bound}${fallback ? ` = ${fallback.code}` : ""}`;
  });
  return `<${written.join(", ")}>`;
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
