// The compiler-owned scoper (plan §4.4, ADR-0009, ADR-0063): one component's sheet, rewritten
// once with Vue's attribute algorithm, so every target attaches the same bytes. It is a port of
// `@vue/compiler-sfc`'s scoped plugin on the parsers Vue uses, postcss and postcss-selector-parser,
// which keep the sheet's own text: only selectors and keyframe names change. Its tests compare the
// output with `compileStyle({ scoped: true })`. Where Vue rewrites a selector into one that matches
// nothing or silently drops part of it, the scoper reports UF5004 instead (P2), and where Vue
// writes one that doesn't parse, it writes one that does.
import { createDiagnostic } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import type { Span } from "@unframework/ir";
import { parseStylesheet } from "@unframework/parser";
import postcss from "postcss";
import type { AtRule, ChildNode, Container, Declaration, Root, Rule } from "postcss";
import selectorParser from "postcss-selector-parser";
import type {
  Node as SelectorNode,
  Pseudo,
  Root as SelectorRoot,
  Selector,
} from "postcss-selector-parser";

/** A component's sheet, scoped. */
export interface ScopedStylesheet {
  /** The sheet as written, with its selectors and keyframe names rewritten (P8). */
  code: string;
  /**
   * UF5004 at each selector that cannot be scoped, or UF5002 where the sheet does not parse,
   * in the sheet's own file. A sheet with any is not scoped: `code` is empty.
   */
  diagnostics: Diagnostic[];
  /** Whether a selector uses `:slotted()`, whose content the parent stamps (ADR-0063). */
  slotted: boolean;
}

/**
 * Scopes a component's sheet under `scopeId`: `data-uf-<scopeId>` after the last simple selector
 * of each selector, `:deep()`, `:slotted()` and `:global()` as Vue reads them, the rules of
 * grouping at-rules and nested rules scoped in place, and `@keyframes` names suffixed with the id,
 * with `animation` and `animation-name` in the sheet rewritten to match. `file` names the sheet in
 * diagnostics, as the resolver read it. Never throws.
 */
export function scopeStylesheet(file: string, source: string, scopeId: string): ScopedStylesheet {
  const invalid = (message: string, span: Span): ScopedStylesheet => ({
    code: "",
    diagnostics: [
      createDiagnostic("UF5002", {
        file,
        span,
        message: `This stylesheet is not valid CSS: ${message}.`,
      }),
    ],
    slotted: false,
  });
  // lightningcss judges validity, an unknown at-rule included, as for the analyser (UF5002).
  const [error] = parseStylesheet(file, source).errors;
  if (error) return invalid(error.message, error.span);
  // postcss drops a byte-order mark, and counts its offsets without it.
  const bom = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  let root: Root;
  try {
    root = postcss.parse(source);
  } catch (caught) {
    const { reason, input } = caught as { reason?: string; input?: { offset?: number } };
    const offset = (input?.offset ?? 0) + bom;
    return invalid(reason ?? String(caught), { start: offset, end: offset });
  }
  const scoper = new Scoper(file, scopeId, bom);
  scoper.check(root);
  if (scoper.diagnostics.length) {
    return { code: "", diagnostics: scoper.diagnostics, slotted: false };
  }
  scoper.keyframes(root);
  scoper.rules(root);
  scoper.animations(root);
  return { code: root.toString(), diagnostics: [], slotted: scoper.slotted };
}

/** The scoping pseudo-classes, which take one selector (ADR-0063). */
const SCOPING = new Set([":deep", ":slotted", ":global"]);

const KEYFRAMES = /^(-\w+-)?keyframes$/i;
const ANIMATION_NAME = /^(-\w+-)?animation-name$/i;
const ANIMATION = /^(-\w+-)?animation$/i;

/** A problem with a selector, and how to fix it. */
interface Problem {
  message: string;
  help?: string;
}

const NESTED: Problem = {
  message:
    "`:deep()`, `:slotted()` and `:global()` take a selector at the top of a selector, never inside another pseudo-class's.",
};

const UNREADABLE: Problem = { message: "The compiler cannot read this selector to scope it." };

function outsidePage(selector: string): Problem {
  return {
    message: `\`${selector}\` matches an element of the page, never one of this component, so it cannot be scoped.`,
    help: "Wrap the selector in `:global()`, or move the rule to a global stylesheet.",
  };
}

/** Whether a pseudo-class is written with parentheses, `:deep(.a)` or `:deep()`. */
const hasArguments = (node: Pseudo) => String(node).trimEnd().endsWith(")");

/** Whether a node is a scoping pseudo-class with its argument. Not a type guard: other pseudo-classes are not. */
const isScopingCall = (node: SelectorNode): boolean =>
  node.type === "pseudo" && SCOPING.has(node.value) && hasArguments(node);

/** A node a selector holds. */
type Item = Parameters<Selector["insertAfter"]>[0];

const isSpace = (node: SelectorNode) => node.type === "combinator" && /^\s+$/.test(node.value);

/** A rule's selectors, parsed, or `undefined` when postcss-selector-parser cannot read them. */
function parseSelectors(text: string): SelectorRoot | undefined {
  try {
    return selectorParser().astSync(text);
  } catch {
    return undefined;
  }
}

/** Whether a rule sits in `@keyframes`, whose rules are keyframe selectors. */
function inKeyframes(rule: Rule): boolean {
  return rule.parent?.type === "atrule" && KEYFRAMES.test((rule.parent as AtRule).name);
}

/** Whether a rule holds style rules of its own (CSS nesting). */
const hasNestedRules = (rule: Rule) => rule.nodes.some((node) => node.type === "rule");

/** Whether a rule around `rule` passes `test`: Vue's walk up to a parent's `__deep`. */
function anyAncestor(rule: Rule, test: (rule: Rule) => boolean): boolean {
  for (let parent = rule.parent; parent && parent.type !== "root"; parent = parent.parent) {
    if (parent.type === "rule" && test(parent as Rule)) return true;
  }
  return false;
}

class Scoper {
  readonly diagnostics: Diagnostic[] = [];
  slotted = false;
  readonly #file: string;
  readonly #id: string;
  /** What postcss's offsets lack: 1 after a byte-order mark. */
  readonly #bom: number;
  /** Each `@keyframes` name of the sheet, by the name it had. */
  readonly #keyframes = new Map<string, string>();
  /** Vue's `rule.__deep`: the rules one of whose selectors used `:deep()`. */
  readonly #deep = new WeakSet<Rule>();

  constructor(file: string, id: string, bom: number) {
    this.#file = file;
    this.#id = id;
    this.#bom = bom;
  }

  /** Reports UF5004 at each selector that cannot be scoped, before anything is rewritten. */
  check(root: Root): void {
    root.walkRules((rule) => {
      if (inKeyframes(rule)) return;
      const text = rule.raws.selector?.raw ?? rule.selector;
      const offset = (rule.source?.start?.offset ?? 0) + this.#bom;
      const parsed = parseSelectors(text);
      if (!parsed) {
        this.#report(UNREADABLE, { start: offset, end: offset + text.length });
        return;
      }
      const inDeep = anyAncestor(rule, (each) => each.selector.includes(":deep("));
      const nested = hasNestedRules(rule);
      const deep = (selector: Selector) =>
        selector.nodes.some((item) => isScopingCall(item) && item.value === ":deep");
      // Vue unscopes the nested rules of a rule with `:deep()`, and so the rule's other selectors.
      const mixed = nested && parsed.nodes.some(deep) && !parsed.nodes.every(deep);
      for (const selector of parsed.nodes) {
        const problem =
          mixed && !deep(selector)
            ? {
                message:
                  "This selector shares a rule that has nested rules with a `:deep()` selector, which leaves it unscoped.",
                help: "Give the `:deep()` selector a rule of its own.",
              }
            : this.#problem(selector, nested, inDeep);
        if (problem) this.#report(problem, selectorSpan(selector, offset));
      }
    });
  }

  /** Suffixes every `@keyframes` name with the id, as Vue does, a quoted one inside its quotes. */
  keyframes(root: Root): void {
    root.walkAtRules(KEYFRAMES, (rule) => {
      const quoted = /^(["'])(.*)\1$/s.exec(rule.params);
      const name = quoted ? quoted[2]! : rule.params;
      if (!name || name.endsWith(`-${this.#id}`)) return;
      const renamed = `${name}-${this.#id}`;
      this.#keyframes.set(name, renamed);
      rule.params = quoted ? `${quoted[1]}${renamed}${quoted[1]}` : renamed;
    });
  }

  /** Vue's `processRule` for every style rule, outer rules first, as postcss visits them. */
  rules(container: Container): void {
    for (const node of container.nodes ?? []) {
      if (node.type === "rule") {
        if (inKeyframes(node)) continue;
        this.#rule(node);
        this.rules(node);
      } else if (node.type === "atrule" && !KEYFRAMES.test(node.name)) {
        this.rules(node);
      }
    }
  }

  /**
   * `animation` and `animation-name` name the renamed keyframes, as Vue finds them: each comma part
   * of `animation-name` that is one, and the first name in each part of `animation`. A quoted
   * name matches as the identifier does.
   */
  animations(root: Root): void {
    if (!this.#keyframes.size) return;
    const rename = (token: string) => {
      const quoted = /^(["'])(.*)\1$/s.exec(token);
      const renamed = this.#keyframes.get(quoted ? quoted[2]! : token);
      if (!renamed) return undefined;
      return quoted ? `${quoted[1]}${renamed}${quoted[1]}` : renamed;
    };
    root.walkDecls((declaration: Declaration) => {
      if (ANIMATION_NAME.test(declaration.prop)) {
        declaration.value = declaration.value
          .split(",")
          .map((part) => rename(part.trim()) ?? part.trim())
          .join(",");
      }
      if (ANIMATION.test(declaration.prop)) {
        declaration.value = declaration.value
          .split(",")
          .map((part) => {
            const values = part.trim().split(/\s+/);
            const index = values.findIndex((value) => rename(value) !== undefined);
            if (index === -1) return part;
            values.splice(index, 1, rename(values[index]!)!);
            return values.join(" ");
          })
          .join(",");
      }
    });
  }

  #report(problem: Problem, span: Span): void {
    this.diagnostics.push(
      createDiagnostic("UF5004", {
        file: this.#file,
        span,
        message: problem.message,
        ...(problem.help ? { help: problem.help } : {}),
      }),
    );
  }

  /** `processRule`: the rule's selectors, rewritten. */
  #rule(rule: Rule): void {
    const deep = anyAncestor(rule, (each) => this.#deep.has(each));
    rule.selector = selectorParser((root) => {
      root.each((selector) => this.#rewrite(rule, selector, deep));
    }).processSync(rule.selector);
  }

  /**
   * `rewriteSelector`: the attribute after the selector's last simple selector that is no
   * pseudo-class or pseudo-element, or as `:deep()`, `:slotted()` and `:global()` say. `deep`: a
   * rule around this one used `:deep()`, so nothing is injected.
   */
  #rewrite(rule: Rule, selector: Selector, deep: boolean, slotted = false): void {
    let node: SelectorNode | undefined;
    let inject = !deep;
    // A leading `*` before `>`, `+` or `~`: Vue drops it, and its selector then doesn't parse.
    let kept: SelectorNode | undefined;
    // A lone `*`, which the attribute replaces where one is injected.
    let lone: SelectorNode | undefined;
    selector.each((item) => {
      if (isScopingCall(item)) {
        const call = item as Pseudo;
        const [argument] = call.nodes;
        if (call.value === ":deep") {
          this.#deep.add(rule);
          // `.a :deep(.b)` is `.a[x] .b`: the argument replaces the call, after a space.
          let last: Item = item;
          argument!.each((inner) => {
            selector.insertAfter(last, inner);
            last = inner;
          });
          const previous = selector.at(selector.index(item) - 1);
          if (!previous || !isSpace(previous)) {
            selector.insertAfter(item, selectorParser.combinator({ value: " " }));
          }
          item.remove();
          return false;
        }
        if (call.value === ":slotted") {
          this.slotted = true;
          this.#rewrite(rule, argument!, deep, true);
          let last: Item = item;
          argument!.each((inner) => {
            selector.insertAfter(last, inner);
            last = inner;
          });
          item.remove();
          inject = false;
          return false;
        }
        // `:global()` is the whole selector (`check`): its argument, unscoped.
        selector.replaceWith(argument!);
        inject = false;
        return false;
      }
      if (item.type === "universal") {
        const previous = selector.at(selector.index(item) - 1);
        const next = selector.at(selector.index(item) + 1);
        if (!previous) {
          if (!next) {
            lone = item;
            return false;
          }
          if (next.type === "combinator" && !isSpace(next)) {
            kept = item;
            return undefined;
          }
          // `* .a` and `*.a` are `.a[x]`.
          if (next.type === "combinator") next.remove();
          item.remove();
          return undefined;
        }
        if (node) return undefined;
      }
      if (
        (item.type !== "pseudo" && item.type !== "combinator") ||
        (item.type === "pseudo" && (item.value === ":is" || item.value === ":where") && !node)
      ) {
        node = item;
      }
      return undefined;
    });
    if (hasNestedRules(rule)) {
      // A rule with nested rules scopes its own declarations through a `&` rule of their own,
      // unless it used `:deep()`, whose nested rules are unscoped.
      const ruleDeep = this.#deep.has(rule);
      if (!ruleDeep) {
        extractAndWrap(rule);
        for (const child of rule.nodes) if (child.type === "atrule") extractAndWrap(child);
      }
      inject = ruleDeep;
    }
    const anchor = node as Item | undefined;
    if (anchor?.type === "pseudo" && (anchor.value === ":is" || anchor.value === ":where")) {
      for (const each of anchor.nodes) this.#rewrite(rule, each, deep, slotted);
      inject = false;
    }
    // Vue's own spacing: none after the anchor, or before the selector without one.
    if (anchor) anchor.spaces.after = "";
    else if (selector.first) selector.first.spaces.before = "";
    if (!inject) return;
    const name = `data-uf-${this.#id}${slotted ? "-s" : ""}`;
    // As Vue writes it: the value is the name, and with no operator only the name is printed.
    const attribute = selectorParser.attribute({
      attribute: name,
      value: name,
      raws: {},
      quoteMark: '"',
    });
    const alone = lone as Item | undefined;
    const leading = kept as Item | undefined;
    if (alone) alone.replaceWith(attribute);
    else if (anchor) selector.insertAfter(anchor, attribute);
    else if (leading) selector.insertAfter(leading, attribute);
    else selector.prepend(attribute);
  }

  /** Why a selector cannot be scoped, or `undefined`. */
  #problem(selector: Selector, nested: boolean, inDeep: boolean): Problem | undefined {
    const items = selector.nodes.filter((item) => item.type !== "comment");
    const calls = items.filter(isScopingCall) as Pseudo[];
    if (calls.length > 1) {
      return {
        message: "A selector uses one of `:deep()`, `:slotted()` and `:global()`, once.",
      };
    }
    const [call] = calls;
    if (call) {
      const name = `${call.value}()`;
      if (call.value === ":slotted" && (nested || inDeep)) {
        // Vue drops the `-s` attribute there, or writes a selector that doesn't parse.
        return {
          message:
            "`:slotted()` cannot be scoped in a rule with nested rules, or inside a rule that uses `:deep()`.",
          help: "Write the `:slotted()` rule at the top of the sheet, without nested rules.",
        };
      }
      if (call.value === ":global" && items.length > 1) {
        return {
          message: `\`${name}\` is the whole selector: the compiler would drop the rest of it.`,
          help: "Write the whole selector inside it, `:global(.page .title)`.",
        };
      }
      const first = call.nodes[0]?.nodes.find((item) => item.type !== "comment");
      if (call.nodes.length !== 1 || !first || first.type === "combinator") {
        return {
          message: `\`${name}\` takes one selector, and this one ${first ? "holds no single selector" : "is empty"}.`,
        };
      }
    }
    return problemIn(selector, call?.value === ":global", true);
  }
}

/**
 * Vue's `extractAndWrapNodes`: a container's declarations and comments move into a `&` rule at its
 * top, which is then scoped as any other rule.
 */
function extractAndWrap(container: Container): void {
  const nodes = (container.nodes ?? []).filter(
    (node): node is ChildNode => node.type === "decl" || node.type === "comment",
  );
  if (!nodes.length) return;
  for (const node of nodes) node.remove();
  container.prepend(postcss.rule({ nodes, selector: "&" }));
}

/**
 * What in a selector, its pseudo-classes' arguments included, cannot be scoped: `:root`,
 * `html` and `body` outside `:global()`, `:host`, a namespace prefix, a scoping pseudo-class
 * written another way or out of place, and an attribute selector that tells an empty `class` or
 * `style` from none (ADR-0044).
 */
function problemIn(selector: Selector, global: boolean, top: boolean): Problem | undefined {
  for (const item of selector.nodes) {
    if (item.type === "pseudo") {
      const name = item.value.replace(/^::?/, "").toLowerCase();
      if (item.value.startsWith("::")) {
        const plain = name.replace(/^v-/, "");
        if (SCOPING.has(`:${plain}`)) {
          return {
            message: `\`::${name}\` is not a scoping pseudo-class: write \`:${plain}()\`, with one colon.`,
          };
        }
      } else if (SCOPING.has(`:${name}`)) {
        if (!hasArguments(item)) {
          return {
            message: `\`:${name}\` takes its selector in parentheses, \`:${name}(.child)\`.`,
          };
        }
        if (!top) return NESTED;
      } else if (name === "root" && !global) {
        return outsidePage(":root");
      } else if ((name === "is" || name === "where") && !item.nodes.some(hasItems)) {
        return { message: `\`:${name}()\` holds no selector, so it matches nothing.` };
      } else if (name === "host" || name === "host-context") {
        return {
          message: "`:host` matches a shadow root's host, and no target renders one.",
          help: "Select the component's root element by a class instead.",
        };
      }
      for (const each of item.nodes) {
        const problem = problemIn(each, global || item.value === ":global", false);
        if (problem) return problem;
      }
    } else if (item.type === "tag" || item.type === "universal") {
      if ((item as { namespace?: unknown }).namespace !== undefined) {
        return {
          message: `\`${String(item).trim()}\` has a namespace prefix, which the compiler does not scope.`,
          help: "Select the element without a namespace prefix.",
        };
      }
      const tag = item.value.toLowerCase();
      if (item.type === "tag" && (tag === "html" || tag === "body") && !global) {
        return outsidePage(tag);
      }
    } else if (item.type === "attribute") {
      const name = item.attribute.toLowerCase();
      const { operator } = item;
      // A backslash before a line break continues a string and adds nothing to it, but
      // postcss-selector-parser keeps the line break: read it from the value as written.
      const raw = (item.raws as { value?: string }).value;
      const value =
        raw === undefined
          ? item.value
          : raw
              .replace(/^(["'])([^]*)\1(?:\/\*[^]*?\*\/)*$/, "$2")
              .replace(/\\(?:\r\n|[\n\r\f])/g, "");
      if (
        (name === "class" || name === "style") &&
        (!operator || (value === "" && (operator === "=" || operator === "|=")))
      ) {
        return {
          message: `This selector tells an empty \`${name}\` attribute from a missing one, which the targets render differently (ADR-0044).`,
          help: "Select by a class the component sets, or by a data attribute.",
        };
      }
    }
  }
  return undefined;
}

/** Whether a selector holds anything but comments. */
const hasItems = (selector: Selector) => selector.nodes.some((item) => item.type !== "comment");

/** A selector's span in the sheet, without the whitespace and comments around it. */
function selectorSpan(selector: Selector, offset: number): Span {
  const text = String(selector);
  const leading = /^(?:\s|\/\*[\s\S]*?\*\/)*/.exec(text)![0].length;
  const trailing = /(?:\s|\/\*[\s\S]*?\*\/)*$/.exec(text.slice(leading))![0].length;
  const start = offset + selector.sourceIndex;
  return { start: start + leading, end: start + text.length - trailing };
}
