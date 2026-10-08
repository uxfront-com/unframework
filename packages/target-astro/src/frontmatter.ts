// An Astro component's frontmatter (ADR-0034, ADR-0046): the types its
// props and its kept setup reach, copied as the source writes them, `Props`, which Astro types
// `Astro.props` and the component's callers by, the props the server render reads from
// `Astro.props`, and the setup's values (`./setup.ts`).
import { liveTypes, typeDeclarationCode } from "@unframework/codegen";
import type { RewriteRules } from "@unframework/codegen";
import type { BindingId, UfComponent, UfModule } from "@unframework/ir";

import { SERVER, serverBindings, setupCode } from "./setup.ts";
import { spellingOf } from "./spelling.ts";
import type { Spelling } from "./spelling.ts";

/** What the frontmatter declares for the markup to read. */
export interface Frontmatter {
  /** The frontmatter's code, without its fences: absent when it would declare nothing. */
  code?: string;
  /** How the markup spells references: `count.value` as `count`, a renamed props object. */
  rewrite: RewriteRules;
}

/**
 * The frontmatter of a component, in order: the type declarations it reaches, `Props`, the
 * props the server render reads, then the setup it keeps (helpers first, then its values in
 * source order). `Props` is an alias of the props type (`type Props = CardProps;`), or an
 * interface with the members of an inline object type, which reads as Astro's own examples do;
 * a props type already named `Props` is copied as it is. Only the props something printed reads
 * are destructured: the markup (but a list's key, which Astro does not print), and the setup's
 * kept values. The whole statement is left out when they read none. The object form keeps its
 * object (`const props = Astro.props;`), so its references stay as written. Only the types the
 * printed code reaches are declared (`liveTypes`), and those the source exports.
 *
 * A component whose frontmatter does not name `Astro` exports `Props`, as Astro's docs allow:
 * nothing in the file reads it then, and astro-eslint-parser counts Astro's own read of `Props`
 * only in a file that names `Astro`, so the linter would report it unused (L5). Exported, it is
 * still what Astro types the component's callers by, and eslint-plugin-astro allows type exports.
 */
export function frontmatterOf(component: UfComponent, module: UfModule): Frontmatter {
  const spelling = spellingOf(component, module);
  const parameter = component.propsParameter;
  const live = serverBindings(component);
  const setup = setupCode(component, live, spelling);
  const props = parameter ? propsRead(component, live, spelling) : undefined;
  const exported = props === undefined && !setup.readsAstro;
  const sections: string[][] = [];
  for (const declaration of liveTypes(component, module, SERVER)) {
    const code =
      exported && parameter && declaration.name === "Props" && !declaration.exported
        ? `export ${declaration.code}`
        : typeDeclarationCode(declaration);
    sections.push([code]);
  }
  const alias = parameter && propsAlias(parameter.type.code);
  if (alias !== undefined) sections.push([exported ? `export ${alias}` : alias]);
  if (props !== undefined) sections.push([props]);
  for (const helper of setup.helpers) sections.push([helper]);
  if (setup.statements.length) sections.push(setup.statements);
  return { ...frontmatterCode(sections), rewrite: spelling.rules };
}

/**
 * The statement that reads the props something printed reads from `Astro.props`: absent when
 * nothing does. The destructured form lists them in the order the source destructures them,
 * with their defaults; the object form keeps the object, under its own name unless Astro takes
 * it.
 */
function propsRead(
  component: UfComponent,
  live: ReadonlySet<BindingId>,
  spelling: Spelling,
): string | undefined {
  const parameter = component.propsParameter!;
  if (parameter.form === "object") {
    const reads = component.props.some(({ binding }) => binding !== undefined && live.has(binding));
    if (!reads) return undefined;
    return `const ${spelling.propsObject ?? parameter.name!} = Astro.props;`;
  }
  const names = component.props
    .flatMap((prop) =>
      prop.binding !== undefined && live.has(prop.binding)
        ? [{ prop, start: bindingStart(component, prop.binding) }]
        : [],
    )
    .toSorted((a, b) => a.start - b.start)
    .map(({ prop }) => (prop.default ? `${prop.name} = ${prop.default.code}` : prop.name));
  return names.length ? `const { ${names.join(", ")} } = Astro.props;` : undefined;
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

function bindingStart(component: UfComponent, id: BindingId): number {
  return component.bindings.find((binding) => binding.id === id)!.span.start;
}

/** Sections a blank line apart, as oxfmt keeps them; none without. */
function frontmatterCode(sections: readonly (readonly string[])[]): { code?: string } {
  return sections.length ? { code: sections.map(section).join("\n") } : {};
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
