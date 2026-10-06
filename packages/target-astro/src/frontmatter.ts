// An Astro component's frontmatter (design §5.7, ADR-0034): the types its props reach, copied as
// the source writes them, `Props`, which Astro types `Astro.props` and the component's callers
// by, and the props read from `Astro.props`.
import {
  componentTypes,
  NameScope,
  referencedBindings,
  sourceNames,
  typeDeclarationCode,
} from "@unframework/codegen";
import type { RewriteRules } from "@unframework/codegen";
import type { BindingId, UfComponent, UfModule } from "@unframework/ir";

/** What the frontmatter declares for the markup to read. */
export interface Frontmatter {
  /** The frontmatter's code, without its fences: absent when the component takes no props. */
  code?: string;
  /** How the markup spells references, when the props object is renamed. */
  rewrite?: RewriteRules;
}

/**
 * Names the compiled component already gives a meaning in the frontmatter's scope: the global
 * a component reads its props from, and the component Astro's compiler renders `<>` with. A
 * props object the source names after one is declared under another name.
 */
const ASTRO_NAMES: ReadonlySet<string> = new Set(["Astro", "Fragment"]);

/**
 * The frontmatter of a component, in order: its props' type declarations, `Props`, and the
 * props the markup reads. `Props` is an alias of the props type (`type Props = CardProps;`), or
 * an interface with the members of an inline object type, which reads as Astro's own examples
 * do; a props type already named `Props` is copied as it is. Only the props a printed
 * expression reads are destructured: Astro prints no list keys, so a prop that only a key
 * reads is left out too, as is the whole statement when the markup reads none. The object form
 * keeps its object (`const props = Astro.props;`), so its references stay as written.
 *
 * A component that reads no prop exports `Props`, as Astro's docs allow: nothing in the file
 * reads it then, and astro-eslint-parser counts Astro's own read of `Props` only in a file that
 * names `Astro`, so the linter would report it unused (L5). Exported, it is still what Astro
 * types the component's callers by, and eslint-plugin-astro allows type exports.
 */
export function frontmatterOf(component: UfComponent, module: UfModule): Frontmatter {
  const parameter = component.propsParameter;
  if (!parameter) return {};
  const read = referencedBindings(component, { includeKeys: false });
  const props =
    parameter.form === "object"
      ? objectProps(component, module, read)
      : destructured(component, read);
  const exported = props.statement === undefined;
  const statements = componentTypes(component, module).map((declaration) =>
    exported && declaration.name === "Props" && !declaration.exported
      ? `export ${declaration.code}`
      : typeDeclarationCode(declaration),
  );
  const alias = propsAlias(parameter.type.code);
  if (alias !== undefined) statements.push(exported ? `export ${alias}` : alias);
  if (props.statement !== undefined) statements.push(props.statement);
  return { ...lines(statements), ...(props.rewrite ? { rewrite: props.rewrite } : {}) };
}

/** How the frontmatter reads the props: absent when the markup reads none. */
interface PropsRead {
  statement?: string;
  rewrite?: RewriteRules;
}

/** The destructuring of the props the markup reads, in the order the source destructures them. */
function destructured(component: UfComponent, read: ReadonlySet<BindingId>): PropsRead {
  const names = component.props
    .flatMap((prop) =>
      prop.binding !== undefined && read.has(prop.binding)
        ? [{ prop, start: bindingStart(component, prop.binding) }]
        : [],
    )
    .toSorted((a, b) => a.start - b.start)
    .map(({ prop }) => (prop.default ? `${prop.name} = ${prop.default.code}` : prop.name));
  return names.length ? { statement: `const { ${names.join(", ")} } = Astro.props;` } : {};
}

/**
 * `Props` for a props type annotation: an alias of a reference, an interface holding an inline
 * object type's members, or nothing when the reference is `Props` itself. The analyser accepts
 * only those two forms, parenthesised or not.
 */
function propsAlias(annotation: string): string | undefined {
  let type = annotation.trim();
  while (type.startsWith("(") && type.endsWith(")")) type = type.slice(1, -1).trim();
  if (type.startsWith("{")) return `interface Props ${type}`;
  return type === "Props" ? undefined : `type Props = ${type};`;
}

/**
 * The object form's statement, when the markup reads a prop, and the rewrite that spells the
 * object by its declared name when the source's name is one Astro takes.
 */
function objectProps(
  component: UfComponent,
  module: UfModule,
  read: ReadonlySet<BindingId>,
): PropsRead {
  const name = component.propsParameter!.name!;
  const reads = component.bindings.some(({ id, kind }) => kind === "prop" && read.has(id));
  if (!reads) return {};
  if (!ASTRO_NAMES.has(name)) return { statement: `const ${name} = Astro.props;` };
  const scope = new NameScope([...sourceNames(component, module), ...ASTRO_NAMES]);
  const local = scope.claim("props");
  return {
    statement: `const ${local} = Astro.props;`,
    // A prop reference spans the whole `name.member`: only its object changes.
    rewrite: {
      binding: (_, binding, written) =>
        binding.kind === "prop" ? `${local}${written.slice(name.length)}` : written,
    },
  };
}

function bindingStart(component: UfComponent, id: BindingId): number {
  return component.bindings.find((binding) => binding.id === id)!.span.start;
}

/** Statements on lines of their own, a blank line apart, as oxfmt keeps them; none without. */
function lines(statements: readonly string[]): { code?: string } {
  if (!statements.length) return {};
  return { code: statements.map((statement) => `${statement}\n`).join("\n") };
}
