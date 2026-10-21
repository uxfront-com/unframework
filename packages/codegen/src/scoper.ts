// The compiler-owned scoper (plan §4.4, ADR-0009, ADR-0063): one component's sheet, rewritten
// once with Vue's attribute algorithm, so every target attaches the same bytes. It ports
// `@vue/compiler-sfc`'s scoped plugin, and its tests compare every rewrite with
// `compileStyle({ scoped: true })`. As Vue does, it rewrites only selectors and keyframe names, in
// the sheet's own text: lightningcss checks that the sheet parses and parses each scoping
// pseudo-class's argument, but never prints the sheet, so every declaration reaches the targets
// as written. Where Vue rewrites a selector into one that matches nothing, or silently drops part
// of it, the scoper reports UF5004 instead (P2).
import { createDiagnostic } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import type { Span } from "@unframework/ir";
import { parseStylesheet } from "@unframework/parser";
import { transform } from "lightningcss";
import { MagicString } from "magic-string";

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
  const { errors } = parseStylesheet(file, source);
  if (errors.length) {
    return {
      code: "",
      diagnostics: errors.map(({ message, span }) =>
        createDiagnostic("UF5002", {
          file,
          span,
          message: `This stylesheet is not valid CSS: ${message}.`,
        }),
      ),
      slotted: false,
    };
  }
  const scoper = new Scoper(file, source, scopeId);
  const nodes = new Parser(source).list(0, source.length, "rules");
  scoper.keyframes(nodes);
  scoper.rules(nodes, false);
  scoper.animations(nodes);
  return {
    code: scoper.diagnostics.length ? "" : scoper.code(),
    diagnostics: scoper.diagnostics,
    slotted: scoper.slotted,
  };
}

/** The scoping pseudo-classes, which take one selector (ADR-0063). */
const SCOPING = new Set(["deep", "slotted", "global"]);

/**
 * The at-rules whose blocks hold rules, scoped in place. An at-rule lightningcss does not know is
 * UF5002 (`parseStylesheet`); the others hold declarations or keyframes.
 */
const GROUPING = new Set([
  "media",
  "supports",
  "layer",
  "container",
  "scope",
  "starting-style",
  "-moz-document",
]);

const KEYFRAMES = /^(-[a-z]+-)?keyframes$/;
const ANIMATION = /^(-[a-z]+-)?animation(-name)?$/;

/** The pseudo-classes whose arguments are selectors, which the checks read too. */
const SELECTOR_ARGUMENTS = new Set([
  "is",
  "where",
  "not",
  "has",
  "matches",
  "any",
  "-webkit-any",
  "-moz-any",
  "nth-child",
  "nth-last-child",
]);

// --- The sheet's structure, as CSS Syntax reads it ----------------------------------------------

/** A declaration: `span` without its `;`, `end` after it. */
interface DeclarationNode {
  kind: "declaration";
  span: Span;
  end: number;
  /** The property, in lower case. */
  property: string;
  value: Span;
}

/** A style rule: its selector list, and what its braces hold. */
interface RuleNode {
  kind: "rule";
  prelude: Span;
  /** Between the braces. */
  block: Span;
  children: Node[];
}

/** An at-rule: its name in lower case, its prelude, and, for a grouping rule, its rules. */
interface AtRuleNode {
  kind: "at-rule";
  name: string;
  prelude: Span;
  block?: Span;
  children: Node[];
}

type Node = DeclarationNode | RuleNode | AtRuleNode;

/** Reads a sheet that lightningcss parsed into its rules and declarations, with their spans. */
class Parser {
  readonly #source: string;

  constructor(source: string) {
    this.#source = source;
  }

  /**
   * The rules and declarations between `start` and `end`: rules only at the top of the sheet and
   * in its grouping rules, and declarations beside nested rules in a style rule (CSS nesting).
   */
  list(start: number, end: number, context: "rules" | "style"): Node[] {
    const source = this.#source;
    const nodes: Node[] = [];
    let index = start;
    for (;;) {
      index = skipTrivia(source, index, end);
      if (index >= end) return nodes;
      if (source[index] === ";") {
        index++;
        continue;
      }
      if (source[index] === "@") {
        const nameEnd = identifierEnd(source, index + 1);
        const name = source.slice(index + 1, nameEnd).toLowerCase();
        const stop = scan(source, nameEnd, end, ";{");
        const prelude = { start: nameEnd, end: stop };
        if (source[stop] === "{") {
          const close = closing(source, stop, end, "{", "}");
          const block = { start: stop + 1, end: close };
          const children = GROUPING.has(name) ? this.list(block.start, block.end, context) : [];
          nodes.push({ kind: "at-rule", name, prelude, block, children });
          index = close + 1;
        } else {
          nodes.push({ kind: "at-rule", name, prelude, children: [] });
          index = stop + 1;
        }
        continue;
      }
      // A custom property's value may hold braces; anything else that reaches a `{` first is a
      // nested rule.
      const custom = context === "style" && source.startsWith("--", index);
      const stop = scan(source, index, end, custom ? ";" : ";{");
      if (source[stop] === "{") {
        const close = closing(source, stop, end, "{", "}");
        const block = { start: stop + 1, end: close };
        const children = this.list(block.start, block.end, "style");
        nodes.push({ kind: "rule", prelude: { start: index, end: stop }, block, children });
        index = close + 1;
        continue;
      }
      const colon = scan(source, index, stop, ":");
      nodes.push({
        kind: "declaration",
        span: trimmed(source, { start: index, end: stop }),
        end: Math.min(stop + 1, end),
        property: source.slice(index, colon).trim().toLowerCase(),
        value: { start: Math.min(colon + 1, stop), end: stop },
      });
      index = stop + 1;
    }
  }
}

// --- Selectors ----------------------------------------------------------------------------------

/** A simple selector, a pseudo-class or pseudo-element, or a combinator, as written. */
interface Item {
  type:
    | "combinator"
    | "universal"
    | "namespace"
    | "type"
    | "id"
    | "class"
    | "attribute"
    | "nesting"
    | "pseudo-class"
    | "pseudo-element";
  span: Span;
  /** A combinator's: ` ` for a descendant, `>`, `+`, `~` or `||`. */
  combinator?: string;
  /** A type's, a pseudo-class's or a pseudo-element's name, in lower case. */
  name?: string;
  /** What a pseudo-class's or a pseudo-element's parentheses hold. */
  args?: Span;
  /** An attribute selector's name, in lower case, operator and unquoted value. */
  attribute?: { name: string; operator?: string; value?: string };
}

/** A selector's items, or `undefined` for one the scoper cannot read. */
function tokenize(source: string, span: Span): Item[] | undefined {
  const items: Item[] = [];
  let space: Span | undefined;
  let index = span.start;
  while (index < span.end) {
    const char = source[index]!;
    if (/\s/.test(char) || source.startsWith("/*", index)) {
      const end = skipTrivia(source, index, span.end);
      space ??= { start: index, end };
      index = end;
      continue;
    }
    if (">+~".includes(char) || source.startsWith("||", index)) {
      const length = char === "|" ? 2 : 1;
      items.push({
        type: "combinator",
        combinator: source.slice(index, index + length),
        span: { start: index, end: index + length },
      });
      space = undefined;
      index += length;
      continue;
    }
    if (space && items.length && items.at(-1)!.type !== "combinator") {
      items.push({ type: "combinator", combinator: " ", span: space });
    }
    space = undefined;
    const item = simpleSelector(source, index, span.end);
    if (!item) return undefined;
    items.push(item);
    index = item.span.end;
  }
  return items;
}

/** The simple selector, pseudo-class or pseudo-element at `start`. */
function simpleSelector(source: string, start: number, end: number): Item | undefined {
  const char = source[start]!;
  const at = (type: Item["type"], to: number, extra: Partial<Item> = {}): Item => ({
    type,
    span: { start, end: to },
    ...extra,
  });
  // A namespace prefix, `svg|`, `*|` or `|`, but never the `|=` of an attribute or `||`.
  const prefix = (to: number) => source[to] === "|" && !"|=".includes(source[to + 1] ?? "");
  if (char === "|") return at("namespace", start + 1);
  if (char === "*") {
    return prefix(start + 1) ? at("namespace", start + 2) : at("universal", start + 1);
  }
  if (char === "&") return at("nesting", start + 1);
  if (char === "#" || char === ".") {
    const to = identifierEnd(source, start + 1);
    return to > start + 1 ? at(char === "#" ? "id" : "class", to) : undefined;
  }
  if (char === "[") {
    const close = closing(source, start, end, "[", "]");
    const attribute = readAttribute(source.slice(start + 1, close));
    return attribute && close < end ? at("attribute", close + 1, { attribute }) : undefined;
  }
  if (char === ":") {
    const element = source[start + 1] === ":";
    const nameStart = start + (element ? 2 : 1);
    const nameEnd = identifierEnd(source, nameStart);
    if (nameEnd === nameStart) return undefined;
    const name = source.slice(nameStart, nameEnd).toLowerCase();
    const type = element ? "pseudo-element" : "pseudo-class";
    if (source[nameEnd] !== "(") return at(type, nameEnd, { name });
    const close = closing(source, nameEnd, end, "(", ")");
    if (close >= end) return undefined;
    return at(type, close + 1, { name, args: { start: nameEnd + 1, end: close } });
  }
  const to = identifierEnd(source, start);
  if (to === start) return undefined;
  if (prefix(to)) return at("namespace", to + 1);
  return at("type", to, { name: source.slice(start, to).toLowerCase() });
}

const ATTRIBUTE =
  /^\s*(?:(?:[\w-]*|\*)\|(?!=))?((?:[\w-]|\\.|\P{ASCII})+)\s*(?:([~|^$*]?=)\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s"']+)\s*(?:[iIsS]\s*)?)?$/su;

/** An attribute selector's name, operator and value, from the text between its brackets. */
function readAttribute(text: string): Item["attribute"] | undefined {
  const match = ATTRIBUTE.exec(text);
  if (!match) return undefined;
  const [, name, operator, value] = match;
  return {
    name: name!.toLowerCase(),
    ...(operator ? { operator } : {}),
    ...(value === undefined ? {} : { value: /^["']/.test(value) ? value.slice(1, -1) : value }),
  };
}

const isScopingCall = (item: Item) =>
  item.type === "pseudo-class" && item.args !== undefined && SCOPING.has(item.name!);

/** A style rule as Vue's scoped plugin tracks it while it rewrites the rule's selectors. */
interface RuleState {
  rule: RuleNode;
  /** Whether it holds style rules of its own (CSS nesting). */
  nested: boolean;
  /** Vue's `rule.__deep`: one of its selectors so far used `:deep()`. */
  deep: boolean;
  /** Whether a rule around it used `:deep()`. */
  inDeep: boolean;
  /** Whether its declarations moved into a `&` rule of their own already. */
  wrapped: boolean;
}

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

/** A replacement of a part of the sheet's text. */
interface Edit {
  start: number;
  end: number;
  text: string;
}

class Scoper {
  readonly diagnostics: Diagnostic[] = [];
  slotted = false;
  readonly #file: string;
  readonly #source: string;
  readonly #id: string;
  readonly #code: MagicString;
  /** Each `@keyframes` name of the sheet, by the name it had. */
  readonly #keyframes = new Map<string, string>();
  /** The declarations moved into a `&` rule, written there with their animations renamed. */
  readonly #moved = new Set<DeclarationNode>();

  constructor(file: string, source: string, id: string) {
    this.#file = file;
    this.#source = source;
    this.#id = id;
    this.#code = new MagicString(source);
  }

  code(): string {
    return this.#code.toString();
  }

  /**
   * Suffixes every `@keyframes` name with the id, as Vue does. A quoted name keeps its quotes, and
   * names the same keyframes as the identifier would, so `animation` finds it either way.
   */
  keyframes(nodes: readonly Node[]): void {
    for (const node of nodes) {
      if (node.kind === "declaration") continue;
      if (node.kind === "at-rule" && KEYFRAMES.test(node.name)) {
        const name = trimmed(this.#source, node.prelude);
        const text = this.#source.slice(name.start, name.end);
        const quoted = /^["']/.test(text);
        const value = quoted ? text.slice(1, -1) : text;
        if (value && !value.endsWith(`-${this.#id}`)) {
          const renamed = `${value}-${this.#id}`;
          this.#keyframes.set(value, renamed);
          this.#code.overwrite(
            name.start,
            name.end,
            quoted ? `${text[0]}${renamed}${text[0]}` : renamed,
          );
        }
      }
      this.keyframes(node.children);
    }
  }

  /** Scopes a list of rules: style rules and the rules of grouping at-rules. */
  rules(nodes: readonly Node[], deep: boolean): void {
    for (const node of nodes) {
      if (node.kind === "rule") this.#rule(node, deep);
      else if (node.kind === "at-rule") this.rules(node.children, deep);
    }
  }

  /** `animation` and `animation-name` name the renamed keyframes, but in moved declarations. */
  animations(nodes: readonly Node[]): void {
    if (!this.#keyframes.size) return;
    for (const node of nodes) {
      if (node.kind !== "declaration") this.animations(node.children);
      else if (!this.#moved.has(node)) {
        for (const { start, end, text } of this.#animationEdits(node)) {
          this.#code.overwrite(start, end, text);
        }
      }
    }
  }

  /** `processRule`: a style rule's selectors, then its nested rules. */
  #rule(rule: RuleNode, deep: boolean): void {
    const state: RuleState = {
      rule,
      nested: rule.children.some((child) => child.kind === "rule"),
      deep: false,
      inDeep: deep,
      wrapped: false,
    };
    for (const span of splitList(this.#source, rule.prelude)) {
      const items = tokenize(this.#source, span);
      const problem = items ? this.#check(items) : UNREADABLE;
      if (problem) {
        this.diagnostics.push(
          createDiagnostic("UF5004", {
            file: this.#file,
            span,
            message: problem.message,
            ...(problem.help ? { help: problem.help } : {}),
          }),
        );
        continue;
      }
      this.#rewrite(items!, span, deep, false, state);
    }
    this.rules(rule.children, deep || state.deep);
  }

  /**
   * `rewriteSelector`: the attribute after the selector's last simple selector that is no
   * pseudo-class or pseudo-element, or as `:deep()`, `:slotted()` and `:global()` say. `deep`: a
   * rule around this one used `:deep()`, so nothing is injected.
   */
  #rewrite(items: Item[], span: Span, deep: boolean, slotted: boolean, state: RuleState): void {
    const code = this.#code;
    let node: Item | undefined;
    // Where the attribute goes when no item takes it: the start, or after a kept leading `*`.
    let start = span.start;
    let lone: Item | undefined;
    let inject = !deep;
    for (let index = 0; index < items.length; index++) {
      const item = items[index]!;
      const previous = items[index - 1];
      const next = items[index + 1];
      if (isScopingCall(item)) {
        const args = item.args!;
        if (item.name === "deep") {
          state.deep = true;
          // `.a :deep(.b)` is `.a[x] .b`: the argument replaces the call, after a space unless a
          // combinator is before it.
          if (previous?.type === "combinator") code.remove(item.span.start, args.start);
          else code.overwrite(item.span.start, args.start, " ");
          code.remove(args.end, item.span.end);
          break;
        }
        if (item.name === "slotted") {
          this.slotted = true;
          this.#rewrite(tokenize(this.#source, args)!, args, deep, true, state);
          code.remove(item.span.start, args.start);
          code.remove(args.end, item.span.end);
          inject = false;
          break;
        }
        // `:global()` is the whole selector (`check`): its argument, unscoped.
        code.remove(span.start, args.start);
        code.remove(args.end, span.end);
        return;
      }
      if (item.type === "universal" && !previous) {
        if (!next) {
          // `*` alone is `[x]`.
          lone = item;
          break;
        }
        if (next.type !== "combinator" || next.combinator === " ") {
          // `* .a` and `*.a` are `.a[x]`.
          code.remove(item.span.start, next.type === "combinator" ? next.span.end : item.span.end);
          if (next.type === "combinator") index++;
          continue;
        }
        // Vue drops the `*` of `* + .a` too, and leaves a combinator with nothing before it.
        start = item.span.end;
        continue;
      }
      if (item.type === "universal" && node) continue;
      if (
        (item.type !== "pseudo-class" &&
          item.type !== "pseudo-element" &&
          item.type !== "combinator") ||
        (item.type === "pseudo-class" && (item.name === "is" || item.name === "where") && !node)
      ) {
        node = item;
      }
    }
    if (state.nested) {
      // A rule with nested rules scopes its own declarations through a `&` rule of their own,
      // unless it used `:deep()`, whose nested rules are unscoped.
      if (!state.deep) this.#wrap(state);
      inject = state.deep;
    }
    if (node?.args && (node.name === "is" || node.name === "where")) {
      for (const each of splitList(this.#source, node.args)) {
        const inner = tokenize(this.#source, each);
        if (inner) this.#rewrite(inner, each, deep, slotted, state);
      }
      inject = false;
    }
    if (!inject) return;
    const attribute = this.#attribute(slotted);
    if (lone) code.overwrite(lone.span.start, lone.span.end, attribute);
    else code.appendLeft(node ? node.span.end : start, attribute);
  }

  #attribute(slotted: boolean): string {
    return `[data-uf-${this.#id}${slotted ? "-s" : ""}]`;
  }

  /**
   * Vue's `extractAndWrapNodes`: a rule's declarations, and those of its nested grouping rules,
   * move into a `&` rule at the top of each, scoped unless a rule around it used `:deep()`.
   */
  #wrap(state: RuleState): void {
    if (state.wrapped) return;
    state.wrapped = true;
    const { rule } = state;
    this.#wrapIn(rule.block.start, rule.children, state.inDeep);
    for (const child of rule.children) {
      if (child.kind === "at-rule" && child.block && GROUPING.has(child.name)) {
        this.#wrapIn(child.block.start, child.children, state.inDeep);
      }
    }
  }

  #wrapIn(at: number, children: readonly Node[], deep: boolean): void {
    const declarations = children.filter((child) => child.kind === "declaration");
    if (!declarations.length) return;
    const texts: string[] = [];
    for (const declaration of declarations) {
      this.#moved.add(declaration);
      this.#code.remove(declaration.span.start, declaration.end);
      const { start, end } = declaration.span;
      let text = this.#source.slice(start, end);
      for (const edit of this.#animationEdits(declaration).toReversed()) {
        text = `${text.slice(0, edit.start - start)}${edit.text}${text.slice(edit.end - start)}`;
      }
      texts.push(`${text};`);
    }
    const attribute = deep ? "" : this.#attribute(false);
    this.#code.appendLeft(at, ` &${attribute} { ${texts.join(" ")} }`);
  }

  /**
   * The renamed keyframes in an `animation` or `animation-name`, as Vue finds them: each comma
   * part of `animation-name` that is one, and the first name in each part of `animation`.
   */
  #animationEdits(declaration: DeclarationNode): Edit[] {
    if (!ANIMATION.test(declaration.property)) return [];
    const names = declaration.property.endsWith("-name");
    const edits: Edit[] = [];
    for (const part of splitList(this.#source, declaration.value)) {
      const tokens = valueTokens(this.#source, part);
      for (const token of names && tokens.length !== 1 ? [] : tokens) {
        const text = this.#source.slice(token.start, token.end);
        const quoted = /^["']/.test(text);
        const renamed = this.#keyframes.get(quoted ? text.slice(1, -1) : text);
        if (!renamed) continue;
        edits.push({ ...token, text: quoted ? `${text[0]}${renamed}${text[0]}` : renamed });
        break;
      }
    }
    return edits;
  }

  /** Why a selector cannot be scoped, or `undefined`. */
  #check(items: readonly Item[]): Problem | undefined {
    const calls = items.filter(isScopingCall);
    if (calls.length > 1) {
      return {
        message: "A selector uses one of `:deep()`, `:slotted()` and `:global()`, once.",
      };
    }
    const [call] = calls;
    if (call) {
      const name = `:${call.name}()`;
      if (call.name === "global" && items.length > 1) {
        return {
          message: `\`${name}\` is the whole selector: the compiler would drop the rest of it.`,
          help: "Write the whole selector inside it, `:global(.page .title)`.",
        };
      }
      const text = this.#source.slice(call.args!.start, call.args!.end);
      if (!isOneSelector(text)) {
        return {
          message: `\`${name}\` takes one selector, and this one ${text.trim() ? "holds no single selector" : "is empty"}.`,
        };
      }
    }
    return this.#problemIn(items, call?.name === "global", true);
  }

  /**
   * What in a selector, its pseudo-classes' arguments included, cannot be scoped: `:root`,
   * `html` and `body` outside `:global()`, `:host`, a namespace prefix, a scoping pseudo-class
   * written another way or out of place, and an attribute selector that tells an empty `class` or
   * `style` from none (ADR-0044).
   */
  #problemIn(items: readonly Item[], global: boolean, top: boolean): Problem | undefined {
    for (const item of items) {
      const name = item.name ?? "";
      const args = item.args && this.#source.slice(item.args.start, item.args.end);
      if (item.type === "pseudo-class") {
        if (SCOPING.has(name)) {
          if (!item.args) {
            return {
              message: `\`:${name}\` takes its selector in parentheses, \`:${name}(.child)\`.`,
            };
          }
          if (!top) return NESTED;
          const problem = this.#inArgument(item.args, global || name === "global");
          if (problem) return problem;
          continue;
        }
        if (name === "root" && !global) return outsidePage(":root");
        if (name === "host" || name === "host-context") {
          return {
            message: "`:host` matches a shadow root's host, and no target renders one.",
            help: "Select the component's root element by a class instead.",
          };
        }
        if (item.args && SELECTOR_ARGUMENTS.has(name)) {
          // `:nth-child(2n + 1 of .a)` takes its selectors after `of`.
          const of = name.startsWith("nth-") ? /\bof\b/i.exec(args!) : undefined;
          const selectors = !name.startsWith("nth-")
            ? item.args
            : of
              ? { start: item.args.start + of.index + 2, end: item.args.end }
              : undefined;
          const problem = selectors && this.#inArgument(selectors, global);
          if (problem) return problem;
          continue;
        }
      } else if (item.type === "pseudo-element") {
        const plain = name.replace(/^v-/, "");
        if (SCOPING.has(plain)) {
          return {
            message: `\`::${name}\` is not a scoping pseudo-class: write \`:${plain}()\`, with one colon.`,
          };
        }
      } else if (item.type === "type") {
        if ((name === "html" || name === "body") && !global) return outsidePage(name);
      } else if (item.type === "namespace") {
        return {
          message: `\`${this.#source.slice(item.span.start, item.span.end)}\` is a namespace prefix, which the compiler does not scope.`,
          help: "Select the element without a namespace prefix.",
        };
      } else if (item.type === "attribute") {
        const { name: attribute, operator, value } = item.attribute!;
        if (
          (attribute === "class" || attribute === "style") &&
          (!operator || (value === "" && (operator === "=" || operator === "|=")))
        ) {
          return {
            message: `This selector tells an empty \`${attribute}\` attribute from a missing one, which the targets render differently (ADR-0044).`,
            help: "Select by a class the component sets, or by a data attribute.",
          };
        }
      }
      // Any other function's argument, read as text: a scoping pseudo-class there means nothing.
      if (args && /:(deep|slotted|global)\(/.test(args)) return NESTED;
    }
    return undefined;
  }

  /** The problem in each selector of a pseudo-class's argument. */
  #inArgument(span: Span, global: boolean): Problem | undefined {
    for (const each of splitList(this.#source, span)) {
      const items = tokenize(this.#source, each);
      if (!items) return UNREADABLE;
      const problem = this.#problemIn(items, global, false);
      if (problem) return problem;
    }
    return undefined;
  }
}

const encoder = new TextEncoder();

/** Whether lightningcss reads `text` as exactly one selector. */
function isOneSelector(text: string): boolean {
  if (!text.trim()) return false;
  let count = 0;
  try {
    // The visitor only reads, so lightningcss never reads a value back.
    transform({
      filename: "selector.css",
      code: encoder.encode(`${text}{}`),
      errorRecovery: false,
      visitor: {
        Rule: {
          style(rule) {
            count += rule.value.selectors.length;
          },
        },
      },
    });
  } catch {
    return false;
  }
  return count === 1;
}

// --- Text ---------------------------------------------------------------------------------------

/** The index after whitespace and comments from `index`. */
function skipTrivia(source: string, index: number, end: number): number {
  while (index < end) {
    if (/\s/.test(source[index]!)) index++;
    else if (source.startsWith("/*", index)) {
      const close = source.indexOf("*/", index + 2);
      index = close === -1 || close + 2 > end ? end : close + 2;
    } else break;
  }
  return index;
}

/** `span` without whitespace and comments at either end. */
function trimmed(source: string, span: Span): Span {
  const start = skipTrivia(source, span.start, span.end);
  let end = span.end;
  for (;;) {
    while (end > start && /\s/.test(source[end - 1]!)) end--;
    const open = source.endsWith("*/", end) ? source.lastIndexOf("/*", end - 3) : -1;
    if (open < start) return { start, end };
    end = open;
  }
}

/** The index after the identifier at `index`, escapes and non-ASCII included. */
function identifierEnd(source: string, index: number): number {
  while (index < source.length) {
    const char = source[index]!;
    if (char === "\\") {
      const hex = /^[0-9a-fA-F]{1,6}\s?/.exec(source.slice(index + 1, index + 8));
      index += 1 + (hex ? hex[0].length : 1);
    } else if (/[\w-]/.test(char) || char.charCodeAt(0) >= 0x80) index++;
    else break;
  }
  return index;
}

/** The index after the string that opens at `start`. */
function stringEnd(source: string, start: number, end: number): number {
  const quote = source[start];
  for (let index = start + 1; index < end; index++) {
    if (source[index] === "\\") index++;
    else if (source[index] === quote || source[index] === "\n") return index + 1;
  }
  return end;
}

/**
 * The index of the first of `stops` outside parentheses, brackets, strings and comments from
 * `index`, or of a `}` that closes the block, or `end`. A `{` that is no stop opens a block,
 * skipped whole.
 */
function scan(source: string, index: number, end: number, stops: string): number {
  let depth = 0;
  while (index < end) {
    const char = source[index]!;
    if (char === "\\") index += 2;
    else if (char === '"' || char === "'") index = stringEnd(source, index, end);
    else if (source.startsWith("/*", index)) index = skipTrivia(source, index, end);
    else if (depth === 0 && stops.includes(char)) return index;
    else if (char === "{") index = closing(source, index, end, "{", "}") + 1;
    else if (char === "}" && depth === 0) return index;
    else {
      if (char === "(" || char === "[") depth++;
      else if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
      index++;
    }
  }
  return end;
}

/** The index of the `close` that closes the `open` at `start`, or `end`. */
function closing(source: string, start: number, end: number, open: string, close: string): number {
  let depth = 0;
  for (let index = start; index < end; index++) {
    const char = source[index]!;
    if (char === "\\") index++;
    else if (char === '"' || char === "'") index = stringEnd(source, index, end) - 1;
    else if (source.startsWith("/*", index)) index = skipTrivia(source, index, end) - 1;
    else if (char === open) depth++;
    else if (char === close && --depth === 0) return index;
  }
  return end;
}

/** A comma-separated list's items, trimmed. */
function splitList(source: string, span: Span): Span[] {
  const items: Span[] = [];
  let start = span.start;
  for (;;) {
    const comma = scan(source, start, span.end, ",");
    items.push(trimmed(source, { start, end: comma }));
    if (comma >= span.end) return items;
    start = comma + 1;
  }
}

/** A value's whitespace-separated tokens, outside parentheses and strings. */
function valueTokens(source: string, span: Span): Span[] {
  const tokens: Span[] = [];
  let index = skipTrivia(source, span.start, span.end);
  while (index < span.end) {
    let end = index;
    while (end < span.end && !/\s/.test(source[end]!) && !source.startsWith("/*", end)) {
      const char = source[end]!;
      if (char === '"' || char === "'") end = stringEnd(source, end, span.end);
      else if (char === "(") end = closing(source, end, span.end, "(", ")") + 1;
      else end += char === "\\" ? 2 : 1;
    }
    tokens.push({ start: index, end: Math.min(end, span.end) });
    index = skipTrivia(source, end, span.end);
  }
  return tokens;
}
