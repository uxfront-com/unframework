// A component's instance script (design §5.3, ADR-0034): the type declarations its props reach,
// copied as written, and one `$props()` declaration. Svelte reads the props through it in runes
// mode, so the markup keeps the source's own names: a destructured prop is a variable of the
// script, and the object form's `props.label` reads the object `$props()` returns.
import {
  componentTypes,
  NameScope,
  referencedBindings,
  sourceNames,
  typeDeclarationCode,
} from "@unframework/codegen";
import type { RewriteRules } from "@unframework/codegen";
import type { UfComponent, UfModule } from "@unframework/ir";

/** What a component's script gives its markup. */
export interface InstanceScript {
  /** The `<script lang="ts">` block: absent for a component that takes no props. */
  block?: string;
  /**
   * How the markup spells references, when the script renames the props object: the
   * expressions are printed as written otherwise.
   */
  rewrite?: RewriteRules;
}

/** One level of a Svelte script's indentation, as Svelte's own documentation writes it. */
const INDENT = "  ";

/**
 * The instance script of a component. Destructured props keep their order in the source and
 * their defaults as written; a prop that no printed expression reads is left out, so the
 * script declares no unused variable (design §5, L5). The type annotation is the source's, a
 * reference to a copied declaration or an object type literal, so the component's props type
 * is the source's (M5's consumers type-check against it).
 */
export function instanceScript(component: UfComponent, module: UfModule): InstanceScript {
  const parameter = component.propsParameter;
  if (!parameter) return {};
  const scope = new NameScope(sourceNames(component, module));
  const read = referencedBindings(component);
  let local: string | undefined;
  let rewrite: RewriteRules | undefined;
  let pattern: string;
  if (parameter.form === "object") {
    local = parameter.name!;
    // An object nothing reads still declares the props, whose type is the component's API,
    // under a name starting with `_`: an unused binding fails L5 (`no-unused-vars`), which
    // leaves such names alone, as React's `_props` (ADR-0034).
    if (!component.bindings.some(({ id, kind }) => kind === "prop" && read.has(id))) {
      // A name `_` and more says it is unused already: it stays the source's.
      if (!/^_./.test(local)) local = scope.claim(`_${local.replace(/^\$/, "")}`);
    } else if (local.startsWith("$")) {
      // Svelte reserves the `$` prefix for its runes and stores: a script variable named
      // `$props` or `$p` does not compile (`dollar_prefix_invalid`), so the object takes the
      // name `props` there, and every `$p.label` reads `props.label`.
      const renamed = scope.claim("props");
      rewrite = {
        binding: (_, binding, written) =>
          binding.kind === "prop" ? `${renamed}.${binding.name}` : written,
      };
      local = renamed;
    }
    pattern = local;
  } else {
    const props = new Map(component.props.map((prop) => [prop.binding, prop]));
    const entries = component.bindings.flatMap(({ id, kind }) => {
      const prop = kind === "prop" && read.has(id) ? props.get(id) : undefined;
      if (!prop) return [];
      return [prop.default ? `${prop.name} = ${prop.default.code}` : prop.name];
    });
    // A component that reads none of its props still declares them, under the object form:
    // the props type is its API, and an empty pattern (`let {}`) is `no-empty-pattern`. The
    // object is named `_props`, as nothing reads it (`no-unused-vars`).
    pattern = entries.length ? `{ ${entries.join(", ")} }` : scope.claim("_props");
  }
  const declarations = componentTypes(component, module).map(typeDeclarationCode);
  const code = [...declarations, `let ${pattern}: ${parameter.type.code} = $props();`];
  const body = code.map((each) => indent(each, INDENT)).join("\n\n");
  return {
    block: `<script lang="ts">\n${body}\n</script>`,
    ...(rewrite ? { rewrite } : {}),
  };
}

/**
 * Copied code indented by `pad`, but for the lines that start inside a string or template
 * literal (a line continuation, a template's text), whose value indenting them would change.
 * The formatter indents the script the same way (ADR-0041); the target indents it too, so the
 * output it serves unformatted reads alike.
 */
export function indent(code: string, pad: string): string {
  const literal = literalLines(code);
  return code
    .split("\n")
    .map((line, index) => (line === "" || literal.has(index) ? line : `${pad}${line}`))
    .join("\n");
}

/**
 * The indices of the lines of `code` that start inside a string or template literal. A scan of
 * the copied code, which is a type declaration or a static default (ADR-0034): comments, string
 * and template literals, and the code in a template's substitutions; no regular expression, as
 * neither may hold one.
 */
function literalLines(code: string): Set<number> {
  const lines = new Set<number>();
  type State = "code" | "line comment" | "block comment" | "'" | '"' | "`";
  let state: State = "code";
  // The depth of `{` inside each open `${…}` substitution, innermost last.
  const substitutions: number[] = [];
  let line = 0;
  for (let index = 0; index < code.length; index++) {
    const char = code[index]!;
    const next = code[index + 1];
    if (char === "\n") {
      line++;
      if (state === "line comment") state = "code";
      else if (state === "'" || state === '"' || state === "`") lines.add(line);
      continue;
    }
    switch (state) {
      case "line comment":
        break;
      case "block comment":
        if (char === "*" && next === "/") {
          state = "code";
          index++;
        }
        break;
      case "'":
      case '"':
      case "`":
        // An escape skips the next character, but for a line continuation's line break,
        // which starts a line inside the literal.
        if (char === "\\") {
          if (next !== "\n") index++;
        } else if (char === state) state = "code";
        else if (state === "`" && char === "$" && next === "{") {
          substitutions.push(0);
          state = "code";
          index++;
        }
        break;
      case "code":
        if (char === "/" && next === "/") state = "line comment";
        else if (char === "/" && next === "*") {
          state = "block comment";
          index++;
        } else if (char === "'" || char === '"' || char === "`") state = char;
        else if (substitutions.length && char === "{") substitutions[substitutions.length - 1]!++;
        else if (substitutions.length && char === "}") {
          if (substitutions.at(-1) === 0) {
            substitutions.pop();
            state = "`";
          } else substitutions[substitutions.length - 1]!--;
        }
        break;
      default:
        state satisfies never;
    }
  }
  return lines;
}
