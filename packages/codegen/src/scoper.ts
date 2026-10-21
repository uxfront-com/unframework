// The compiler-owned scoper (plan §4.4, ADR-0009, ADR-0063): one component's sheet, rewritten
// once with Vue's attribute algorithm, so every target attaches the same bytes. It ports
// `@vue/compiler-sfc`'s scoped plugin onto lightningcss's syntax tree, and its tests compare
// every rewrite with `compileStyle({ scoped: true })`. Where Vue rewrites a selector into one that
// matches nothing, or silently drops part of it, the scoper reports UF5004 instead (P2).
import { createDiagnostic } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import type { Span } from "@unframework/ir";
import { offsetOf } from "@unframework/parser";
import { transform } from "lightningcss";
import type {
  Declaration,
  DeclarationBlock,
  Rule,
  Selector,
  SelectorComponent,
  StyleRule,
  StyleSheet,
  TokenOrValue,
} from "lightningcss";

/** A component's sheet, scoped. */
export interface ScopedStylesheet {
  /** The scoped sheet as lightningcss prints it: deterministic, and not minified (P8). */
  code: string;
  /**
   * UF5004 at each selector that cannot be scoped, or UF5002 where the sheet does not parse,
   * in the sheet's own file. A sheet with any is not scoped: `code` is empty.
   */
  diagnostics: Diagnostic[];
  /** Whether a selector uses `:slotted()`, whose content the parent stamps (ADR-0063). */
  slotted: boolean;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Scopes a component's sheet under `scopeId`: `data-uf-<scopeId>` on the last compound of each
 * selector, `:deep()`, `:slotted()` and `:global()` as Vue reads them, the rules of `@media`,
 * `@supports`, `@layer` and `@container` scoped in place, and `@keyframes` names suffixed with
 * the id, with `animation` and `animation-name` in the sheet rewritten to match. `file` names the
 * sheet in diagnostics, as the resolver read it. Never throws for a sheet's content.
 */
export function scopeStylesheet(file: string, source: string, scopeId: string): ScopedStylesheet {
  const scoper = new Scoper(file, source, scopeId);
  let code: string;
  try {
    const result = transform({
      filename: file,
      code: encoder.encode(source),
      errorRecovery: false,
      visitor: { StyleSheet: (sheet) => withoutNulls(scoper.sheet(sheet)) },
    });
    code = decoder.decode(result.code);
  } catch (error) {
    // A visitor that threw is a bug, and lightningcss reports it without a location.
    const { message, loc } = error as { message: string; loc?: { line: number; column: number } };
    if (!loc) throw error;
    const offset = offsetOf(source, loc.line, loc.column);
    return {
      code: "",
      diagnostics: [
        createDiagnostic("UF5002", {
          file,
          span: { start: offset, end: offset },
          message: `This stylesheet is not valid CSS: ${message}.`,
        }),
      ],
      slotted: false,
    };
  }
  return {
    code: scoper.diagnostics.length ? "" : code,
    diagnostics: scoper.diagnostics,
    slotted: scoper.slotted,
  };
}

/**
 * A value without its `null` fields. lightningcss 1.33 gives a visitor some absent fields as
 * `null` (a `var()`'s `from`, a `@container`'s name), and fails to read them back.
 */
function withoutNulls<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutNulls) as T;
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      item === null ? [] : [[key, withoutNulls(item)]],
    ),
  ) as T;
}

/** The scoping pseudo-classes, which take one selector (ADR-0063). */
const SCOPING = new Set(["deep", "slotted", "global"]);

/** A scoping pseudo-class as the sheet writes it: its argument's text, and where that starts. */
interface ScopingCall {
  name: string;
  text: string;
  /** The argument, parsed: set by `check`. */
  selector?: Selector;
}

/** One selector of a rule's list as the sheet writes it. */
interface SelectorText {
  span: Span;
  /** Its scoping pseudo-classes outside any parentheses, in source order. */
  calls: ScopingCall[];
  /** Whether a scoping pseudo-class sits inside parentheses: another's argument, or `:is()`'s. */
  nested: boolean;
  /** Whether it writes `&`: without one, lightningcss adds the `& ` of a relative selector. */
  nesting: boolean;
}

/** A style rule as Vue's scoped plugin tracks it while it rewrites the rule's selectors. */
interface RuleState {
  rule: StyleRule;
  /** Whether it holds style rules of its own (CSS nesting). */
  nested: boolean;
  /** Vue's `rule.__deep`: one of its selectors so far used `:deep()`. */
  deep: boolean;
}

/** A problem with a selector, and how to fix it. */
interface Problem {
  message: string;
  help?: string;
}

class Scoper {
  readonly diagnostics: Diagnostic[] = [];
  slotted = false;
  readonly #file: string;
  readonly #source: string;
  readonly #id: string;
  /** Each `@keyframes` name of the sheet, by the name it had. */
  readonly #keyframes = new Map<string, string>();

  constructor(file: string, source: string, id: string) {
    this.#file = file;
    this.#source = source;
    this.#id = id;
  }

  sheet(sheet: StyleSheet): StyleSheet {
    this.#renameKeyframes(sheet.rules);
    sheet.rules = this.#rules(sheet.rules, false);
    if (this.#keyframes.size) this.#renameAnimations(sheet.rules);
    return sheet;
  }

  /** Scopes a list of rules: style rules and the rules of grouping at-rules, never keyframes. */
  #rules(rules: Rule[], deep: boolean): Rule[] {
    for (const rule of rules) {
      if (rule.type === "style") this.#style(rule.value, deep);
      else if (rule.type === "nesting") this.#style(rule.value.style, deep);
      else if (rule.type !== "keyframes" && hasRules(rule)) {
        rule.value.rules = this.#rules(rule.value.rules, deep);
      }
    }
    return rules;
  }

  /** `processRule`: a style rule's selectors, then its nested rules. */
  #style(rule: StyleRule, deep: boolean): void {
    const start = offsetOf(this.#source, rule.loc.line + 1, rule.loc.column);
    // A `&` rule `wrapDeclarations` made has no text: its parent's is at its location.
    const texts = WRAPPED.has(rule)
      ? [{ span: { start, end: start }, calls: [], nested: false, nesting: true }]
      : selectorTexts(this.#source, start);
    const state: RuleState = {
      rule,
      nested: (rule.rules ?? []).some((child) => child.type === "style"),
      deep: false,
    };
    rule.selectors = rule.selectors.map((selector, index) => {
      const text = texts[index] ?? texts.at(-1)!;
      // lightningcss writes a nested relative selector with its implicit `& `, which Vue never
      // sees: check and rewrite the selector as written, and put it back.
      const implicit =
        !text.nesting &&
        selector[0]?.type === "nesting" &&
        selector[1]?.type === "combinator" &&
        selector[1].value === "descendant";
      const written = implicit ? selector.slice(2) : selector;
      const problem = this.#check(written, text);
      if (problem) {
        this.diagnostics.push(
          createDiagnostic("UF5004", {
            file: this.#file,
            span: text.span,
            message: problem.message,
            ...(problem.help ? { help: problem.help } : {}),
          }),
        );
        return selector;
      }
      const scoped = this.#rewrite(written, text.calls, deep, false, state);
      return implicit ? [selector[0]!, selector[1]!, ...scoped] : scoped;
    });
    if (rule.rules) rule.rules = this.#rules(rule.rules, deep || state.deep);
  }

  /**
   * `rewriteSelector`: the selector with the scope attribute after its last simple selector
   * that is no pseudo-class or pseudo-element, or as `:deep()`, `:slotted()` and `:global()`
   * say. `deep`: a rule around this one used `:deep()`, so nothing is injected.
   */
  #rewrite(
    selector: Selector,
    calls: readonly ScopingCall[],
    deep: boolean,
    slotted: boolean,
    state: RuleState,
  ): Selector {
    const out = [...selector];
    let node: number | undefined;
    let inject = !deep;
    let call = 0;
    for (let index = 0; index < out.length; index++) {
      const item = out[index]!;
      if (isScopingCall(item)) {
        const { name } = item as CustomFunction;
        const { selector: argument } = calls[call++]!;
        if (name === "deep") {
          state.deep = true;
          // `.a :deep(.b)` is `.a[x] .b`: the argument replaces the call, after a descendant
          // combinator unless one is already there.
          const previous = out[index - 1];
          const joined: Selector =
            previous?.type === "combinator" ? argument! : [DESCENDANT, ...argument!];
          out.splice(index, 1, ...joined);
          break;
        }
        if (name === "slotted") {
          this.slotted = true;
          out.splice(index, 1, ...this.#rewrite(argument!, [], deep, true, state));
          inject = false;
          break;
        }
        // `:global()` is the whole selector (`check`): its argument, unscoped.
        return argument!;
      }
      if (item.type === "universal") {
        const previous = out[index - 1];
        const next = out[index + 1];
        if (!previous) {
          if (next) {
            // `* .a` is `.a[x]`, and `*.a` too.
            out.splice(index, isDescendant(next) ? 2 : 1);
            index--;
            continue;
          }
          // `*` alone is `[x]`.
          out.splice(index, 1);
          node = -1;
          break;
        }
        if (node !== undefined) continue;
      }
      if (
        (item.type !== "pseudo-class" &&
          item.type !== "pseudo-element" &&
          item.type !== "combinator") ||
        (item.type === "pseudo-class" &&
          (item.kind === "is" || item.kind === "where") &&
          node === undefined)
      ) {
        node = index;
      }
    }
    if (state.nested) {
      // A rule with nested rules scopes its own declarations through a `&` rule of their own,
      // unless it used `:deep()`, whose nested rules are unscoped.
      if (!state.deep) wrapDeclarations(state.rule);
      inject = state.deep;
    }
    const anchor = node === undefined || node === -1 ? undefined : out[node];
    if (anchor?.type === "pseudo-class" && (anchor.kind === "is" || anchor.kind === "where")) {
      anchor.selectors = anchor.selectors.map((each) =>
        this.#rewrite(each, [], deep, slotted, state),
      );
      inject = false;
    }
    if (inject) {
      const name = `data-uf-${this.#id}${slotted ? "-s" : ""}`;
      out.splice(node === undefined ? 0 : node + 1, 0, {
        type: "attribute",
        name,
        namespace: null,
        operation: null,
      });
    }
    return out;
  }

  /** Why a selector cannot be scoped, or `undefined`. Parses its scoping calls' arguments. */
  #check(selector: Selector, text: SelectorText): Problem | undefined {
    if (text.nested) return NESTED;
    const top = selector.filter(isScopingCall);
    if (top.length !== text.calls.length) {
      return { message: "This selector's scoping pseudo-classes cannot be read." };
    }
    if (top.length > 1) {
      return {
        message: "A selector uses one of `:deep()`, `:slotted()` and `:global()`, once.",
      };
    }
    const [call] = text.calls;
    if (call) {
      const name = `:${call.name}()`;
      if (call.name === "global" && selector.length > 1) {
        return {
          message: `\`${name}\` is the whole selector: the compiler would drop the rest of it.`,
          help: "Write the whole selector inside it, `:global(.page .title)`.",
        };
      }
      const argument = parseSelector(call.text);
      if (!argument) {
        return {
          message: `\`${name}\` takes one selector, and this one ${call.text.trim() ? "holds no single selector" : "is empty"}.`,
        };
      }
      call.selector = argument;
    }
    return problemIn(selector, call?.name === "global", text.calls);
  }

  /** Suffixes every `@keyframes` name with the id, as Vue does. */
  #renameKeyframes(rules: readonly Rule[]): void {
    for (const rule of rules) {
      if (rule.type === "keyframes") {
        const { name } = rule.value;
        if (name.type === "ident" || name.type === "custom") {
          if (!name.value.endsWith(`-${this.#id}`)) {
            const renamed = `${name.value}-${this.#id}`;
            this.#keyframes.set(name.value, renamed);
            name.value = renamed;
          }
        }
      } else if (rule.type === "style") {
        this.#renameKeyframes(rule.value.rules ?? []);
      } else if (hasRules(rule)) {
        this.#renameKeyframes(rule.value.rules);
      }
    }
  }

  /** `animation` and `animation-name` name the renamed keyframes. */
  #renameAnimations(rules: readonly Rule[]): void {
    const rename = (block: DeclarationBlock | undefined) => {
      for (const list of [block?.declarations, block?.importantDeclarations]) {
        for (const declaration of list ?? []) this.#renameAnimation(declaration);
      }
    };
    for (const rule of rules) {
      if (rule.type === "style") {
        rename(rule.value.declarations);
        this.#renameAnimations(rule.value.rules ?? []);
      } else if (rule.type === "nested-declarations") {
        rename(rule.value.declarations);
      } else if (rule.type === "nesting") {
        rename(rule.value.style.declarations);
        this.#renameAnimations(rule.value.style.rules ?? []);
      } else if (rule.type !== "keyframes" && hasRules(rule)) {
        this.#renameAnimations(rule.value.rules);
      }
    }
  }

  #renameAnimation(declaration: Declaration): void {
    const renamed = (name: string) => this.#keyframes.get(name);
    if (declaration.property === "animation-name") {
      for (const name of declaration.value) {
        if (name.type === "ident") name.value = renamed(name.value) ?? name.value;
      }
    } else if (declaration.property === "animation") {
      for (const { name } of declaration.value) {
        if (name.type === "ident") name.value = renamed(name.value) ?? name.value;
      }
    } else if (
      declaration.property === "unparsed" &&
      (declaration.value.propertyId.property === "animation" ||
        declaration.value.propertyId.property === "animation-name")
    ) {
      renameTokens(declaration.value.value, renamed);
    }
  }
}

/** The `&` rules `wrapDeclarations` makes. */
const WRAPPED = new WeakSet<StyleRule>();

const DESCENDANT: SelectorComponent = { type: "combinator", value: "descendant" };

const isDescendant = (item: SelectorComponent) =>
  item.type === "combinator" && item.value === "descendant";

/** A pseudo-class lightningcss does not know, with arguments. */
type CustomFunction = Extract<SelectorComponent, { type: "pseudo-class"; kind: "custom-function" }>;

/**
 * Whether a selector's item is a scoping pseudo-class with its argument, `:deep(.b)`. Not a type
 * guard: other pseudo-classes of its kind are not.
 */
function isScopingCall(item: SelectorComponent): boolean {
  return item.type === "pseudo-class" && item.kind === "custom-function" && SCOPING.has(item.name);
}

/** A rule that holds rules: a grouping at-rule. */
function hasRules(rule: Rule): rule is Rule & { value: { rules: Rule[] } } {
  return (
    "value" in rule &&
    typeof rule.value === "object" &&
    rule.value !== null &&
    Array.isArray((rule.value as { rules?: unknown }).rules)
  );
}

/**
 * Vue's `extractAndWrapNodes`: a rule's declarations, and those of its nested at-rules, move
 * into a `&` rule at the top of each, which is then scoped as any other.
 */
function wrapDeclarations(rule: StyleRule): void {
  const wrap = (rules: Rule[], own: DeclarationBlock | undefined): Rule[] => {
    const block: Required<DeclarationBlock> = {
      declarations: [...(own?.declarations ?? [])],
      importantDeclarations: [...(own?.importantDeclarations ?? [])],
    };
    const kept = rules.filter((child) => {
      if (child.type !== "nested-declarations") return true;
      block.declarations.push(...(child.value.declarations.declarations ?? []));
      block.importantDeclarations.push(...(child.value.declarations.importantDeclarations ?? []));
      return false;
    });
    if (!block.declarations.length && !block.importantDeclarations.length) return rules;
    const wrapped: StyleRule = {
      selectors: [[{ type: "nesting" }]],
      declarations: block,
      loc: rule.loc,
    };
    WRAPPED.add(wrapped);
    return [{ type: "style", value: wrapped }, ...kept];
  };
  rule.rules = wrap(rule.rules ?? [], rule.declarations);
  rule.declarations = { declarations: [], importantDeclarations: [] };
  for (const child of rule.rules) {
    if (child.type !== "style" && child.type !== "keyframes" && hasRules(child)) {
      child.value.rules = wrap(child.value.rules, undefined);
    }
  }
}

/** Renames identifiers in an unparsed `animation` or `animation-name` value. */
function renameTokens(tokens: TokenOrValue[], renamed: (name: string) => string | undefined): void {
  for (const token of tokens) {
    if (token.type === "token" && token.value.type === "ident") {
      token.value.value = renamed(token.value.value) ?? token.value.value;
    }
  }
}

/**
 * What in a selector, its scoping calls' arguments included, cannot be scoped: `:root`,
 * `html` and `body` outside `:global()`, `:host`, a scoping pseudo-class written another way, and
 * an attribute selector that tells an empty `class` or `style` from none (ADR-0044).
 */
function problemIn(
  selector: Selector,
  global: boolean,
  calls: readonly ScopingCall[],
): Problem | undefined {
  let call = 0;
  for (const item of selector) {
    const inner: Selector[] = [];
    if (isScopingCall(item)) {
      const argument = calls[call++]!.selector!;
      const problem = problemIn(argument, global || (item as CustomFunction).name === "global", []);
      if (problem) return problem;
      continue;
    }
    if (item.type === "pseudo-class") {
      if (item.kind === "root" && !global) return OUTSIDE_PAGE(":root");
      if (
        item.kind === "host" ||
        (item.kind === "custom-function" && item.name === "host-context")
      ) {
        return {
          message: "`:host` matches a shadow root's host, and no target renders one.",
          help: "Select the component's root element by a class instead.",
        };
      }
      if (item.kind === "custom" && SCOPING.has(item.name)) {
        return {
          message: `\`:${item.name}\` takes its selector in parentheses, \`:${item.name}(.child)\`.`,
        };
      }
      if (item.kind === "custom-function" && SCOPING.has(item.name)) return NESTED;
      if ("selectors" in item && Array.isArray(item.selectors)) inner.push(...item.selectors);
      if ("of" in item && item.of) inner.push(...item.of);
      if ("selector" in item && item.selector) inner.push(item.selector);
    } else if (item.type === "pseudo-element") {
      const name =
        item.kind === "custom" || item.kind === "custom-function" ? item.name : item.kind;
      if (SCOPING.has(name) || SCOPING.has(name.replace(/^v-/, ""))) {
        const plain = name.replace(/^v-/, "");
        return {
          message: `\`::${name}\` is not a scoping pseudo-class: write \`:${plain}()\`, with one colon.`,
        };
      }
      if ("selector" in item && item.selector) inner.push(item.selector);
    } else if (item.type === "type") {
      const tag = item.name.toLowerCase();
      if ((tag === "html" || tag === "body") && !global) return OUTSIDE_PAGE(tag);
    } else if (item.type === "attribute") {
      const name = item.name.toLowerCase();
      const { operation } = item;
      if (
        (name === "class" || name === "style") &&
        (!operation ||
          (operation.value === "" &&
            (operation.operator === "equal" || operation.operator === "dash-match")))
      ) {
        return {
          message: `This selector tells an empty \`${name}\` attribute from a missing one, which the targets render differently (ADR-0044).`,
          help: "Select by a class the component sets, or by a data attribute.",
        };
      }
    }
    for (const each of inner) {
      const problem = problemIn(each, global, []);
      if (problem) return problem;
    }
  }
  return undefined;
}

const NESTED: Problem = {
  message:
    "`:deep()`, `:slotted()` and `:global()` take a selector at the top of a selector, never inside another pseudo-class's.",
};

function OUTSIDE_PAGE(selector: string): Problem {
  return {
    message: `\`${selector}\` matches an element of the page, never one of this component, so it cannot be scoped.`,
    help: "Wrap the selector in `:global()`, or move the rule to a global stylesheet.",
  };
}

/** One selector, parsed by lightningcss, or `undefined` for none or a list of several. */
function parseSelector(text: string): Selector | undefined {
  if (!text.trim()) return undefined;
  let found: Selector[] | undefined;
  try {
    transform({
      filename: "selector.css",
      code: encoder.encode(`${text}{}`),
      errorRecovery: false,
      visitor: {
        Rule: {
          style(rule) {
            found ??= rule.value.selectors;
          },
        },
      },
    });
  } catch {
    return undefined;
  }
  return found?.length === 1 ? found[0] : undefined;
}

/**
 * The selectors of the rule whose prelude starts at `start`, as written: each one's span, and
 * the scoping pseudo-classes it calls, read past comments, strings and escapes.
 */
function selectorTexts(source: string, start: number): SelectorText[] {
  const texts: SelectorText[] = [];
  let current = { start, calls: [] as ScopingCall[], nested: false, nesting: false };
  const close = (end: number) => {
    let from = current.start;
    let to = end;
    while (from < to && /\s/.test(source[from]!)) from++;
    while (to > from && /\s/.test(source[to - 1]!)) to--;
    texts.push({
      span: { start: from, end: to },
      calls: current.calls,
      nested: current.nested,
      nesting: current.nesting,
    });
  };
  let depth = 0;
  for (let index = start; index < source.length; index++) {
    const char = source[index]!;
    if (char === "\\") {
      index++;
    } else if (char === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 1;
    } else if (char === '"' || char === "'") {
      index = stringEnd(source, index);
    } else if (char === "(" || char === "[") {
      depth++;
    } else if (char === ")" || char === "]") {
      depth--;
    } else if (char === "&") {
      current.nesting = true;
    } else if (char === ":" && source[index - 1] !== ":") {
      const name = /^(deep|slotted|global)\(/.exec(source.slice(index + 1, index + 9))?.[1];
      if (name) {
        const open = index + 1 + name.length;
        if (depth > 0) current.nested = true;
        else {
          const end = closingParenthesis(source, open);
          current.calls.push({ name, text: source.slice(open + 1, end) });
        }
      }
    } else if (depth === 0 && (char === "," || char === "{")) {
      close(index);
      if (char === "{") return texts;
      current = { start: index + 1, calls: [], nested: false, nesting: false };
    }
  }
  close(source.length);
  return texts;
}

/** The index of the quote that closes the string opening at `start`. */
function stringEnd(source: string, start: number): number {
  const quote = source[start];
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === "\\") index++;
    else if (source[index] === quote || source[index] === "\n") return index;
  }
  return source.length;
}

/** The index of the `)` that closes the `(` at `open`. */
function closingParenthesis(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index++) {
    const char = source[index]!;
    if (char === "\\") index++;
    else if (char === '"' || char === "'") index = stringEnd(source, index);
    else if (char === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 1;
    } else if (char === "(") depth++;
    else if (char === ")" && --depth === 0) return index;
  }
  return source.length;
}
