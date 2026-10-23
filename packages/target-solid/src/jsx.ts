// How Solid writes what its JSX writes differently from the codegen defaults (plan §6):
// control flow through Solid's own components (`<Show>`, `<Switch>`/`<Match>`, `<For>`), which
// update the DOM in place where a ternary or `.map` would recreate it, with a callback's accessor
// where a branch reads what its tests narrow (src/narrowing.ts); `class` as one string; kebab-case
// style objects; an object spread for an attribute Solid's types reject on its element
// (src/attributes.ts); and listeners and template refs as src/listeners.ts writes them.
// Everything else (elements, text, bound attributes, spreads key by key) prints as the defaults
// do, with HTML attribute names, which Solid's JSX takes.
import {
  boundJsxAttribute,
  classArrayItems,
  expressionCode,
  js,
  jsxAttributeValue,
  jsxBinding,
  jsxBranch,
  jsxChildren,
  jsxComponent,
  jsxDynamic,
  jsxElement,
  jsxExpression,
  jsxFillValue,
  parseExpression,
  spreadClassReads,
  spreadRead,
  staticJsxAttribute,
} from "@unframework/codegen";
import type { ImportSet, JsxContext, JsxDialect } from "@unframework/codegen";
import { walk } from "@unframework/ir";
import type {
  ClassAttribute,
  ElementNode,
  Expression,
  ForNode,
  IfNode,
  RenderNode,
  Span,
  StyleAttribute,
  UfComponent,
} from "@unframework/ir";

import { isUntyped, untypedAttribute } from "./attributes.ts";
import type { SolidComposition } from "./composition.ts";
import type { SolidListeners } from "./listeners.ts";
import { modelAttribute } from "./models.ts";
import type { ModelHelpers } from "./models.ts";
import {
  carriedPaths,
  declaresFalsyLiteral,
  negatedOperand,
  narrowsFurther,
  pathExpression,
  wholePath,
} from "./narrowing.ts";
import type { Frame, Narrowings, ReferencePath } from "./narrowing.ts";
import { eventProp } from "./props.ts";
import { escapedOnServer } from "./render.ts";
import type { SolidCode } from "./setup.ts";

// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type AstExpression = Parameters<typeof js.callExpression>[0];
type JsxAttribute = ReturnType<typeof js.jsxAttribute>;
type JsxAttributeItem = JsxAttribute | ReturnType<typeof js.jsxSpreadAttribute>;
type JsxChild = ReturnType<typeof jsxChildren>[number];

/** The class helper's name, before the name scope makes it unique. */
export const CLASS_HELPER = "cx";

/** The scope helper's name, before the name scope makes it unique. */
export const SCOPE_HELPER = "scopeAttributes";

/** The style helper's name, before the name scope makes it unique (ADR-0065). */
export const STYLE_HELPER = "styleProperties";

/** The Solid dialect of one output file, and the helpers its JSX ended up calling. */
export interface SolidJsx {
  dialect: JsxDialect;
  /** The inline helpers to print after the component, as source code. */
  helpers: () => string[];
}

/** What a file's composition prints with: its code, its composition and its props object. */
export interface SolidCompose {
  code: SolidCode;
  composition: SolidComposition;
  /** The props object's name: absent where the output reads no prop. */
  object: string | undefined;
  /** The inline helpers the file's `v-model`s call. */
  models: ModelHelpers;
}

/**
 * The Solid dialect for one output file. Imports (`Show`, `For`…), the class helper's name and
 * the names branch callbacks give their accessors (`narrowings`) are claimed from the file's name
 * scope when first used, so they never capture a source name, which that scope reserves. `types`
 * are the texts of the props' types and the declarations they reach.
 */
export function solidJsx(
  imports: ImportSet,
  narrowings: Narrowings,
  types: readonly string[],
  listeners: SolidListeners,
  compose: SolidCompose,
): SolidJsx {
  let helper: string | undefined;
  let collections = false;
  let scopeHelper: string | undefined;
  let styleHelper: string | undefined;
  const classHelper = () => (helper ??= imports.claim(CLASS_HELPER));
  /** `styleProperties(value)`: a style bound to a value, an object or a declaration list. */
  const styleValue = (value: AstExpression): AstExpression =>
    js.callExpression(js.identifier((styleHelper ??= imports.claim(STYLE_HELPER))), [value]);
  const flow: Flow = { imports, narrowings, falsy: declaresFalsyLiteral(types) };
  const { code, composition, object, models } = compose;
  // What falls through to the root (ADR-0054), merged into its own `class` and `style`, or
  // added after them where it has none.
  const root = composition.fallthrough;
  const printed = { class: false, style: false };
  const pending = new Set(composition.scopeRoots);
  const isRoot = (element: ElementNode) => isSpan(root, element.span);
  const passed = (name: "class" | "style", context: JsxContext): AstExpression =>
    context.placeholders.expression(`${object!}.${name}`, "argument");
  // `class={props.class ? \`card ${props.class}\` : "card"}` for static names: no helper, which
  // two components joined into one module would both declare (the unplugin's `joinModules`).
  const mergedClass = (names: string, context: JsxContext): JsxAttribute => {
    printed.class = true;
    const own = names.replace(/[`\\]|\$\{/g, (match) => `\\${match}`);
    const read = `${object!}.class`;
    const merged = `${read} ? \`${own} \${${read}}\` : ${JSON.stringify(names)}`;
    return js.jsxAttribute(
      "class",
      js.jsxExpressionContainer(context.placeholders.expression(merged)),
    );
  };
  const rootClass = (element: ElementNode, context: JsxContext): AstExpression[] => {
    if (!isRoot(element)) return [];
    printed.class = true;
    return [passed("class", context)];
  };
  const dialect: JsxDialect = {
    expression: (expression, context) => flow.narrowings.code(expression, context),
    conditional: (node, context) => conditional(node, context, flow),
    list: (node, context) => list(node, context, imports, compose),
    staticAttribute(attribute, element, context) {
      if (attribute.name === "class" && typeof attribute.value === "string") {
        const reads = spreadClassReads(element, context);
        if (reads.length) {
          const all = [...reads, ...rootClass(element, context)];
          return [classCall(classHelper(), [js.stringLiteral(attribute.value), ...all])];
        }
        if (isRoot(element)) return [mergedClass(attribute.value, context)];
      }
      if (!isUntyped(element.tag, attribute.name)) {
        return staticJsxAttribute(attribute, element, context);
      }
      const value = js.stringLiteral(attribute.value === true ? "" : attribute.value);
      return untypedJsxAttribute(element, attribute.name, value);
    },
    boundAttribute: (attribute, element, context) =>
      isUntyped(element.tag, attribute.name)
        ? untypedJsxAttribute(element, attribute.name, jsxExpression(attribute.value, context))
        : boundJsxAttribute(attribute, element, context),
    spreadAttribute(attribute, element, context) {
      // One attribute per declared key (ADR-0039); a `class` key goes to the element's own
      // `class`, which merges it, when the element has one.
      const merged = element.attributes.some(
        (item) => item.kind === "Class" || (item.kind === "Static" && item.name === "class"),
      );
      return attribute.keys
        .filter((key) => !(merged && key.name === "class"))
        .flatMap((key) => {
          const value = spreadRead(attribute, key, context);
          // On a root without a `class` of its own, what falls through merges with the key.
          if (key.name === "class" && isRoot(element)) {
            return [classCall(classHelper(), [value, ...rootClass(element, context)])];
          }
          // A `style` key is the element's style (ADR-0065), which the root merges.
          if (key.name === "style") {
            if (!isRoot(element)) {
              return [js.jsxAttribute("style", js.jsxExpressionContainer(styleValue(value)))];
            }
            printed.style = true;
            return [mergedStyle(styleValue(value), passed("style", context))];
          }
          return isUntyped(element.tag, key.name)
            ? untypedJsxAttribute(element, key.name, value)
            : [js.jsxAttribute(key.name, js.jsxExpressionContainer(value))];
        });
    },
    classAttribute(attribute, element, context) {
      if (attribute.items.some((item) => item.kind === "Dynamic" && item.collection)) {
        collections = true;
      }
      const names = attribute.items.flatMap((item) => (item.kind === "Static" ? [item.value] : []));
      if (
        isRoot(element) &&
        names.length === attribute.items.length &&
        !spreadClassReads(element, context).length
      ) {
        return [mergedClass(names.join(" "), context)];
      }
      return classAttribute(attribute, element, context, classHelper, rootClass(element, context));
    },
    styleAttribute(attribute, element, context) {
      if (attribute.value) {
        const value = styleValue(jsxExpression(attribute.value, context));
        if (!isRoot(element)) return [js.jsxAttribute("style", js.jsxExpressionContainer(value))];
        printed.style = true;
        return [mergedStyle(value, passed("style", context))];
      }
      if (!isRoot(element)) return [styleAttribute(attribute, context)];
      printed.style = true;
      return [styleAttribute(attribute, context, () => passed("style", context))];
    },
    eventAttribute: (attribute, element, context) =>
      listeners.eventAttribute(attribute, element, context),
    refAttribute: (attribute, element, context) =>
      isComponentTag(element.tag)
        ? listeners.componentRef(attribute)
        : listeners.refAttribute(attribute, element, context),
    componentEvent: (attribute) => listeners.componentEvent(attribute),
    // A slot's fill is a prop named like it: the default slot's is `children`, which a scoped or
    // forwarded fill passes as a prop too.
    fillAttribute: (fill, _node, context) => [
      js.jsxAttribute(
        fill.slot === "default" ? "children" : fill.slot,
        js.jsxExpressionContainer(jsxFillValue(fill, context)),
      ),
    ],
    // A forwarded slot is the prop as it is, which keeps whether the parent filled it, or its
    // content where the component resolves it, which it then creates once.
    slotValue: (slot, context) => {
      const resolved = composition.resolvedSlot(slot);
      return context.placeholders.expression(
        resolved ? `${resolved}()` : `${object!}.${slot === "default" ? "children" : slot}`,
      );
    },
    slotOutlet(node, context) {
      const slot = code.slot(node.slot);
      const rendered = node.props ? `${slot}?.(${expressionCode(node.props, context)})` : slot;
      const value = context.placeholders.expression(rendered, "operand");
      if (!node.fallback.length) return value;
      return js.logicalExpression("??", value, jsxBranch(node.fallback, context));
    },
    modelAttribute: (attribute, element, context) =>
      modelAttribute(attribute, element, context, code, models, listeners.carries(element)),
    modelBinding(attribute, _node, context) {
      const setter = code.setter(bindingOfValue(attribute.value)!)!;
      return [
        js.jsxAttribute(
          attribute.model,
          js.jsxExpressionContainer(jsxExpression(attribute.value, context)),
        ),
        js.jsxAttribute(
          eventProp(`${attribute.model}Change`),
          js.jsxExpressionContainer(js.identifier(setter)),
        ),
      ];
    },
    dynamic: (node, context) =>
      jsxDynamic(node, imports.add("solid-js/web", "Dynamic"), context, [
        js.jsxAttribute("component", js.jsxExpressionContainer(jsxExpression(node.is, context))),
      ]),
    // After a root's own attributes: the `class` and `style` it has not merged with its own
    // (`class={props.class}`), then the `data-uf-*` attributes of the styled parents that render
    // it, whose names only they know, picked out of the props by name (the child-root rule,
    // ADR-0063).
    // Each root takes them once: the first node printed with its span, which is the root
    // itself, printed before what it holds.
    scopeRootAttributes(element, context) {
      if (!pending.delete(`${element.span.start}:${element.span.end}`)) return [];
      const fallthrough = isRoot(element)
        ? (["class", "style"] as const)
            .filter((name) => !printed[name])
            .map((name) => js.jsxAttribute(name, js.jsxExpressionContainer(passed(name, context))))
        : [];
      scopeHelper ??= imports.claim(SCOPE_HELPER);
      const picked = context.placeholders.expression(`${scopeHelper}(${object!})`, "argument");
      return [...fallthrough, js.jsxSpreadAttribute(picked)];
    },
  };
  return {
    dialect,
    helpers: () => [
      ...(helper ? [classHelperCode(helper, collections)] : []),
      ...(styleHelper ? [styleHelperCode(styleHelper)] : []),
      ...(scopeHelper ? [scopeHelperCode(scopeHelper)] : []),
      ...models.helpers(),
    ],
  };
}

/** Whether a tag names a component (`Field`, Solid's `Dynamic`): an element's is lower case. */
function isComponentTag(tag: string): boolean {
  return /^[A-Z]/.test(tag);
}

/** Whether a span is the one given. */
function isSpan(span: Span | undefined, other: Span): boolean {
  return span !== undefined && span.start === other.start && span.end === other.end;
}

/** The binding a `v-model`'s value reads: a state's or a model's `.value`. */
function bindingOfValue(value: Expression): string | undefined {
  const [ref] = value.refs;
  return ref?.kind === "Binding" ? ref.binding : undefined;
}

/** What a file's control flow prints with: its imports, and the branch callbacks around it. */
interface Flow {
  imports: ImportSet;
  narrowings: Narrowings;
  /** Whether a value its truthiness test narrows may be typed with a falsy literal. */
  falsy: boolean;
}

/**
 * A conditional as Solid's control flow, which keeps a branch's DOM while its condition stays
 * truthy. Both test truthiness, as the IR does (ADR-0036: `0` takes the fallback):
 *
 * - one condition: `<Show when={c} fallback={…}>…</Show>`; an empty first branch before an
 *   else shows the else under the negated condition (`c ? null : <B />` → `<Show when={!c}>`,
 *   and `!c ? null : <B />` → `<Show when={c}>`);
 * - more: `<Switch fallback={…}><Match when={a}>…</Match><Match when={b}>…</Match></Switch>`,
 *   where an empty branch still stops the chain with `{null}`, as Solid's types require
 *   children (ADR-0036).
 *
 * `<Show>`'s and `<Match>`'s children are no branch of their condition to TypeScript. A branch
 * that reads a binding its tests mention (those that hold or fail where it renders) reads what
 * it takes from them through its callback's accessor instead (see {@link narrowed}). An else
 * that does is a last `<Match>`, as is every such branch of a chain, whose `when` repeats the
 * chain up to it; `<Match>` evaluates a condition only where those before it failed.
 */
function conditional(node: IfNode, context: JsxContext, flow: Flow): AstExpression {
  const { branches } = node;
  const tests = branches.flatMap((branch) => (branch.condition ? [branch.condition] : []));
  const testsOf = (index: number) =>
    branches[index]!.condition ? tests.slice(0, index + 1) : tests;
  const around = flow.narrowings.carried();
  const carried = branches.map((branch, index) =>
    carriedPaths(
      branch.children,
      testsOf(index),
      Boolean(branch.condition),
      around,
      flow.narrowings.types,
    ),
  );
  if (carried.every((paths) => !paths.length)) return plain(node, context, flow.imports);
  const last = branches.at(-1)!;
  // The analyser drops an empty else.
  const otherwise = last.condition ? undefined : last;
  const element = (name: string, attributes: JsxAttribute[], children: JsxChild[]) =>
    js.jsxElement(flow.imports.add("solid-js", name), attributes, children);
  if (tests.length === 1) {
    const [first] = branches;
    const test = first!.condition!;
    if (!otherwise || !carried[1]!.length) {
      const shown = narrowed([test], true, first!.children, carried[0]!, context, flow);
      const attributes = branchAttributes(shown);
      if (otherwise) attributes.push(fallbackAttribute(otherwise.children, context));
      return element("Show", attributes, [shown.callback]);
    }
    // `!user ? <i>anon</i> : <p>{user.name}</p>`: the else shows where the operand holds.
    const operand = negatedOperand(test);
    if (operand && !carried[0]!.length) {
      const paths = carriedPaths(
        otherwise.children,
        [operand],
        true,
        around,
        flow.narrowings.types,
      );
      const shown = narrowed([operand], true, otherwise.children, paths, context, flow);
      const attributes = branchAttributes(shown);
      if (first!.children.length) attributes.push(fallbackAttribute(first!.children, context));
      return element("Show", attributes, [shown.callback]);
    }
    if (!first!.children.length) {
      // `c ? null : <B />`: the else alone, under the test failing.
      const shown = narrowed([test], false, otherwise.children, carried[1]!, context, flow);
      return element("Show", branchAttributes(shown), [shown.callback]);
    }
  }
  const matches = branches.flatMap((branch, index) => {
    if (!branch.condition && !carried[index]!.length) return [];
    if (!carried[index]!.length) {
      // An empty branch still stops the chain, with `{null}`: `<Match>` requires children.
      return [
        element(
          "Match",
          [when(jsxExpression(branch.condition!, context))],
          branch.children.length
            ? jsxChildren(branch.children, context)
            : [js.jsxExpressionContainer(js.nullLiteral())],
        ),
      ];
    }
    const holds = Boolean(branch.condition);
    const shown = narrowed(testsOf(index), holds, branch.children, carried[index]!, context, flow);
    return [element("Match", branchAttributes(shown), [shown.callback])];
  });
  const fallback =
    otherwise && !carried.at(-1)!.length ? [fallbackAttribute(otherwise.children, context)] : [];
  return element("Switch", fallback, matches);
}

/** A conditional none of whose branches reads what its tests mention: see {@link conditional}. */
function plain(node: IfNode, context: JsxContext, imports: ImportSet): AstExpression {
  const last = node.branches.at(-1)!;
  const tests = last.condition ? node.branches : node.branches.slice(0, -1);
  // The analyser drops an empty else; an empty one here would only print `fallback={null}`.
  const fallback = last.condition || last.children.length === 0 ? undefined : last.children;
  const [only] = tests;
  if (only && tests.length === 1) {
    if (only.children.length === 0 && fallback) {
      const operand = negatedOperand(only.condition!);
      const negated = operand
        ? jsxExpression(operand, context)
        : js.unaryExpression("!", jsxExpression(only.condition!, context, "operand"));
      return show(negated, fallback, undefined, context, imports);
    }
    return show(jsxExpression(only.condition!, context), only.children, fallback, context, imports);
  }
  const matches = tests.map((branch) =>
    js.jsxElement(
      imports.add("solid-js", "Match"),
      [when(jsxExpression(branch.condition!, context))],
      // An empty branch still stops the chain, with `{null}`: `<Match>` requires children.
      branch.children.length
        ? jsxChildren(branch.children, context)
        : [js.jsxExpressionContainer(js.nullLiteral())],
    ),
  );
  return js.jsxElement(
    imports.add("solid-js", "Switch"),
    fallback ? [fallbackAttribute(fallback, context)] : [],
    matches,
  );
}

/** `<Show when={test} fallback={…}>…</Show>`. */
function show(
  test: AstExpression,
  children: readonly RenderNode[],
  fallback: readonly RenderNode[] | undefined,
  context: JsxContext,
  imports: ImportSet,
): AstExpression {
  const attributes = [when(test)];
  if (fallback) attributes.push(fallbackAttribute(fallback, context));
  return js.jsxElement(imports.add("solid-js", "Show"), attributes, jsxChildren(children, context));
}

/**
 * The `when` of a `<Show>` or `<Match>` whose branch reads `paths` of what `tests` mention, the
 * callback that receives them, and whether the branch is keyed. Where the branch shows when its
 * one test, exactly one of those paths, holds, the `when` is that test:
 * `<Show when={props.user}>{(user) => …user().name…}</Show>`. Otherwise the `when` is the
 * source's chain up to the branch, failed tests leaving nothing, which builds an object of the
 * paths where TypeScript narrows them: `props.count !== undefined ? { count: props.count } :
 * undefined`, read `(narrowed) => …narrowed().count…`. Its truthiness is the branch's own.
 *
 * A branch is not keyed (ADR-0036 as M2 amends it): Solid calls the callback once while the
 * `when` stays truthy, with an accessor of its latest value, so the branch keeps its DOM, focus
 * and state when the value changes. TypeScript narrows no call, though, so a branch whose
 * expressions narrow a path it receives further (`user.nick ? user.nick.trim() : "none"`) is
 * keyed, as M1 wrote every branch: the callback receives the values themselves, and runs again
 * whenever they change (src/narrowing.ts).
 */
function narrowed(
  tests: readonly Expression[],
  holds: boolean,
  children: readonly RenderNode[],
  paths: readonly ReferencePath[],
  context: JsxContext,
  flow: Flow,
): { when: AstExpression; callback: JsxChild; keyed: boolean } {
  const { narrowings } = flow;
  const keyed = narrowsFurther(children, paths);
  const [only] = tests;
  const whole = tests.length === 1 && holds ? wholePath(only!) : undefined;
  const simple =
    whole &&
    paths.length === 1 &&
    paths[0]!.binding === whole.binding &&
    paths[0]!.keys.length === whole.keys.length &&
    paths[0]!.keys.every((key, index) => whole.keys[index] === key);
  let test: AstExpression;
  let frame: Frame;
  let parameter: Parameters<typeof js.arrowFunction>[0][number];
  if (simple) {
    // Solid types the value `NonNullable<T>`, which keeps the falsy literals (`""`, `0`) the
    // test removes; `|| undefined` removes them as the test does.
    test = flow.falsy
      ? js.logicalExpression(
          "||",
          jsxExpression(only!, context, "operand"),
          js.identifier("undefined"),
        )
      : jsxExpression(only!, context);
    const name = narrowings.names(
      paths,
      context,
      keyed ? "keyed" : holdsListeners(children) ? "accessor" : "accessor-only",
    )[0]!;
    frame = {
      parameter: name,
      names: [{ path: paths[0]!, name, read: keyed ? name : `${name}()` }],
    };
    parameter = js.bindingIdentifier(name);
  } else {
    const keys = keyed
      ? narrowings.names(paths, context, "keyed")
      : narrowings.keys(paths, context);
    const accessor = keyed ? undefined : narrowings.accessor();
    // Each read that calls is a parameter, read once, which TypeScript narrows, as it narrows no
    // call: `((user) => (user !== null ? { user } : undefined))(user())`.
    const built = narrowings.once(() => {
      const object = js.objectExpression(
        paths.map((path, index) => {
          const value = pathExpression(path, tests, children);
          const key = keys[index]!;
          // `{ row }` where the value is already read by its name.
          return narrowings.code(value, context) === key
            ? js.property(key, js.identifier(key), { shorthand: true })
            : [key, jsxExpression(value, context)];
        }),
      );
      const nothing = js.identifier("undefined");
      // From the last test outwards: its own holds (or fails, for an else), the others fail.
      let built = holds
        ? js.conditionalExpression(jsxExpression(tests.at(-1)!, context, "test"), object, nothing)
        : object;
      for (const failed of (holds ? tests.slice(0, -1) : tests).toReversed()) {
        built = js.conditionalExpression(jsxExpression(failed, context, "test"), nothing, built);
      }
      return built;
    });
    test = built.parameters.length
      ? js.callExpression(
          js.arrowFunction(
            built.parameters.map((parameter) => js.bindingIdentifier(parameter.name)),
            built.value,
          ),
          built.parameters.map((parameter) =>
            context.placeholders.expression(parameter.read, "argument"),
          ),
        )
      : built.value;
    frame = {
      parameter: accessor ?? "",
      names: paths.map((path, index) => ({
        path,
        name: keys[index]!,
        read: accessor ? `${accessor}().${keys[index]!}` : keys[index]!,
      })),
    };
    parameter = accessor
      ? js.bindingIdentifier(accessor)
      : js.objectPattern(keys.map((key) => js.bindingProperty(key)));
  }
  // Solid calls a function child untracked: a branch that is one interpolation
  // (`user().name + props.label`) would not update when another prop it reads changes, and a
  // fragment, which Solid compiles to a memo, keeps its reads tracked.
  const body = narrowings.within(frame, () =>
    children.length === 1 && children[0]!.kind === "Interpolation"
      ? js.jsxFragment(jsxChildren(children, context))
      : jsxBranch(children, context),
  );
  return {
    when: test,
    callback: js.jsxExpressionContainer(js.arrowFunction([parameter], body)),
    keyed,
  };
}

/** A branch's `when`, keyed when its callback receives the values themselves. */
function branchAttributes(shown: { when: AstExpression; keyed: boolean }): JsxAttribute[] {
  return shown.keyed ? [js.jsxAttribute("keyed"), when(shown.when)] : [when(shown.when)];
}

/** Whether nodes hold a listener or a template ref: client code. */
function holdsListeners(nodes: readonly RenderNode[]): boolean {
  let found = false;
  for (const node of nodes) {
    walk(node, {
      enter(visited) {
        if (visited.kind !== "Element") return;
        if (visited.attributes.some((item) => item.kind === "Event" || item.kind === "Ref")) {
          found = true;
        }
      },
    });
  }
  return found;
}

function when(test: AstExpression): JsxAttribute {
  return js.jsxAttribute("when", js.jsxExpressionContainer(test));
}

/**
 * `fallback="text"` for static text that a quoted value can hold, else `fallback={…}`: one node,
 * or a fragment of several.
 */
function fallbackAttribute(children: readonly RenderNode[], context: JsxContext): JsxAttribute {
  const [only] = children;
  if (children.length === 1 && only?.kind === "Text") {
    return js.jsxAttribute("fallback", jsxAttributeValue(only.value));
  }
  return js.jsxAttribute("fallback", js.jsxExpressionContainer(jsxBranch(children, context)));
}

/**
 * A list as `<For each={source}>{(item, index) => <li>…</li>}</For>`. `<For>` keys its rows
 * by the items themselves, so the source's `key` is not printed (Solid's elements take no
 * `key`; ADR-0036 guarantees content and order only), and the index is an accessor, which
 * the rewrite rules call (`index()`). A parameter nothing reads is left out (L5), the item too
 * when the index is not read either.
 */
function list(
  node: ForNode,
  context: JsxContext,
  imports: ImportSet,
  { composition, object }: SolidCompose,
): AstExpression {
  const item = jsxBinding(node.item, context);
  const index = node.index === undefined ? undefined : jsxBinding(node.index, context);
  const parameters = [];
  if (index && context.referenced.has(index.id)) {
    parameters.push(js.bindingIdentifier(item.name), js.bindingIdentifier(index.name));
  } else if (context.referenced.has(item.id)) {
    parameters.push(js.bindingIdentifier(item.name));
  }
  // The slots each row tests and renders, resolved in the row: one content per row.
  const slots = composition.rowSlots(node.body);
  const row = composition.withinRow(slots, () =>
    node.body.kind === "Element"
      ? jsxElement(node.body, context)
      : jsxComponent(node.body, context),
  );
  const body = slots.size
    ? [
        ...composition
          .statements(object!, slots)
          .map((text) => context.placeholders.statements(text)),
        js.returnStatement(row),
      ]
    : row;
  return js.jsxElement(
    imports.add("solid-js", "For"),
    [js.jsxAttribute("each", js.jsxExpressionContainer(jsxExpression(node.source, context)))],
    [js.jsxExpressionContainer(js.arrowFunction(parameters, body))],
  );
}

/**
 * An attribute Solid's types reject on its element (`isUntyped`), as the object spread Solid
 * renders alike (see `untypedAttribute`).
 */
function untypedJsxAttribute(
  element: ElementNode,
  name: string,
  value: AstExpression,
): JsxAttributeItem[] {
  const object = js.objectExpression([[name, value]]);
  const record = js.typeReference("Record", [js.keywordType("string"), js.keywordType("unknown")]);
  return [
    js.jsxSpreadAttribute(
      untypedAttribute(element.tag, name, hasTypedProps(element)) === "spread"
        ? object
        : js.asExpression(object, record),
    ),
  ];
}

/**
 * Whether an element's props share a key with its type besides the attributes it rejects:
 * children, or an attribute (a spread's key included) the type declares.
 */
function hasTypedProps(element: ElementNode): boolean {
  if (element.children.length) return true;
  return element.attributes.some((attribute) => {
    switch (attribute.kind) {
      case "Static":
      case "Bound":
        return !isUntyped(element.tag, attribute.name);
      case "Spread":
        return attribute.keys.some((key) => !isUntyped(element.tag, key.name));
      // `class`, `style`, a listener and `ref` are props every element's type declares.
      case "Class":
      case "Style":
      case "Event":
      case "Ref":
        return true;
      case "Model":
        return false;
      default:
        return attribute satisfies never;
    }
  });
}

/**
 * A `class` from parts. Solid's `class` takes one string (ADR-0038). Static names and toggles
 * alone print as Solid writes them, `class="a b"` and `classList={{ on: active }}`, which
 * toggle each name in place. A dynamic part, or the class of a spread, goes through an inline
 * helper that joins them all into one string (`class={cx("a", tone, { on: active })}`):
 * Solid sets a dynamic `class` whole, which would drop what a `classList` beside it had
 * toggled on.
 */
function classAttribute(
  attribute: ClassAttribute,
  element: ElementNode,
  context: JsxContext,
  helper: () => string,
  passed: readonly AstExpression[],
): JsxAttribute[] {
  const reads = [...spreadClassReads(element, context), ...passed];
  const [only] = attribute.items;
  if (
    attribute.items.length === 1 &&
    only?.kind === "Dynamic" &&
    !reads.length &&
    isString(only.value, context.component)
  ) {
    // One string is a `class` as it is.
    const value = jsxExpression(escapedOnServer(only.value, "attribute"), context);
    return [js.jsxAttribute("class", js.jsxExpressionContainer(value))];
  }
  // A component takes `class` as one string prop: no `classList` (ADR-0054).
  if (
    reads.length ||
    attribute.items.some(
      (item) => item.kind === "Dynamic" || (item.kind === "Toggle" && isComponentTag(element.tag)),
    )
  ) {
    return [classCall(helper(), [...classArrayItems(attribute, context), ...reads])];
  }
  const names = attribute.items.flatMap((item) => (item.kind === "Static" ? [item.value] : []));
  const toggles = attribute.items.flatMap((item) =>
    item.kind === "Toggle"
      ? [js.property(item.name, toggleCondition(item.condition, context))]
      : [],
  );
  const attributes: JsxAttribute[] = [];
  if (names.length) attributes.push(js.jsxAttribute("class", jsxAttributeValue(names.join(" "))));
  if (toggles.length) {
    attributes.push(
      js.jsxAttribute("classList", js.jsxExpressionContainer(js.objectExpression(toggles))),
    );
  }
  return attributes;
}

/** `class={cx(…parts)}`. */
function classCall(helper: string, parts: AstExpression[]): JsxAttribute {
  return js.jsxAttribute(
    "class",
    js.jsxExpressionContainer(js.callExpression(js.identifier(helper), parts)),
  );
}

/**
 * A toggle's condition as `classList` takes it, a boolean (or `undefined`): as written when it
 * is one, else in `Boolean(…)`, which tests truthiness as the IR's toggle does.
 */
function toggleCondition(condition: Expression, context: JsxContext): AstExpression {
  const code = jsxExpression(condition, context);
  if (isBoolean(condition, context.component)) return code;
  return js.callExpression(js.identifier("Boolean"), [code]);
}

/** The comparison operators, whose result is always a boolean. */
const COMPARISONS = new Set(["==", "!=", "===", "!==", "<", "<=", ">", ">="]);

/**
 * Whether an expression is a boolean by its syntax (a comparison, a negation, a boolean
 * literal, `Boolean(…)`, and `&&`, `||` or `?:` of those), or by the declared type of the
 * prop it reads (`boolean`, which `classList` takes as it is). Anything else may be another
 * kind, which `classList`'s type rejects, so the caller wraps it.
 */
function isBoolean(expression: Expression, component: UfComponent): boolean {
  const type = propType(expression, component);
  if (type !== undefined) return type === "boolean";
  return isBooleanSyntax(parseExpression(expression.code));
}

/** {@link isBoolean} by syntax alone. */
function isBooleanSyntax(node: AstExpression): boolean {
  switch (node.type) {
    case "Literal":
      return typeof node.value === "boolean";
    case "UnaryExpression":
      return node.operator === "!";
    case "BinaryExpression":
      return COMPARISONS.has(node.operator);
    case "LogicalExpression":
      return node.operator !== "??" && isBooleanSyntax(node.left) && isBooleanSyntax(node.right);
    case "ConditionalExpression":
      return isBooleanSyntax(node.consequent) && isBooleanSyntax(node.alternate);
    case "CallExpression":
      return isGlobalCall(node, "Boolean");
    default:
      return false;
  }
}

/** `string`, or a union of string literal types (`"info" | "warn"`), as a prop declares it. */
const STRING_TYPE = /^(?:string|"[^"\\]*"|'[^'\\]*')(?:\s*\|\s*(?:string|"[^"\\]*"|'[^'\\]*'))*$/;

/**
 * Whether an expression is a string by its syntax (a string or template literal, `String(…)`,
 * a `+` with a string operand, a `?:` of those), or by the declared type of the prop it reads
 * (`string` or string literals, which Solid's `class` takes as it is; never `null`). Anything
 * else may be another kind, which `class`'s type rejects.
 */
function isString(expression: Expression, component: UfComponent): boolean {
  const type = propType(expression, component);
  if (type !== undefined) return STRING_TYPE.test(type);
  return isStringSyntax(parseExpression(expression.code));
}

/** {@link isString} by syntax alone. */
function isStringSyntax(node: AstExpression): boolean {
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string";
    case "TemplateLiteral":
      return true;
    case "BinaryExpression":
      return node.operator === "+" && (isStringSyntax(node.left) || isStringSyntax(node.right));
    case "ConditionalExpression":
      return isStringSyntax(node.consequent) && isStringSyntax(node.alternate);
    case "CallExpression":
      return isGlobalCall(node, "String");
    default:
      return false;
  }
}

/**
 * The type a prop declares, as written, when the expression is exactly a read of that prop
 * (`tone`, `props.tone`); `undefined` for anything else, a list's item included.
 */
function propType(expression: Expression, component: UfComponent): string | undefined {
  const [only] = expression.refs;
  if (
    only?.kind !== "Binding" ||
    expression.refs.length !== 1 ||
    only.span.start !== expression.span.start ||
    only.span.end !== expression.span.end
  ) {
    return undefined;
  }
  return component.props.find((prop) => prop.binding === only.binding)?.type.code.trim() ?? "";
}

/** Whether a node calls a global function with one argument: `Boolean(x)`, `String(x)`. */
function isGlobalCall(node: AstExpression, name: string): boolean {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === name &&
    !node.optional &&
    node.arguments.length === 1 &&
    node.arguments[0]!.type !== "SpreadElement"
  );
}

/**
 * A `style` as an object with kebab-case keys, which Solid sets one property at a time
 * (`setStyleProperty`, removing it for a nullish value): a camelCase key would be no CSS
 * property at all. A number literal prints as its string, which renders alike, because
 * `solid/style-prop` asks for a unit on any number whose property names a length
 * (`line-height` included).
 */
function styleAttribute(
  attribute: StyleAttribute,
  context: JsxContext,
  passed?: () => AstExpression,
): JsxAttribute {
  const declarations = () =>
    attribute.declarations.map((declaration): [string, AstExpression] => [
      declaration.property,
      declaration.kind === "Static"
        ? js.stringLiteral(declaration.value)
        : (numberLiteral(declaration.value) ?? jsxExpression(declaration.value, context)),
    ]);
  if (!passed) {
    return js.jsxAttribute("style", js.jsxExpressionContainer(js.objectExpression(declarations())));
  }
  // What falls through comes last, so the consumer's declaration wins, an `undefined` one
  // included, which removes the root's own (ADR-0054). The root's own declarations are spread
  // too: Solid compiles a static declaration into the element's template, where no later value
  // could remove it.
  const merged = js.objectExpression([
    js.spreadElement(js.objectExpression(declarations())),
    js.spreadElement(passed()),
  ]);
  return js.jsxAttribute("style", js.jsxExpressionContainer(merged));
}

/**
 * `style={{ ...own, ...props.style }}` on the root, for a style bound to one value: what falls
 * through comes last, so the consumer's declaration wins (ADR-0054, ADR-0065).
 */
function mergedStyle(own: AstExpression, passed: AstExpression): JsxAttribute {
  const merged = js.objectExpression([js.spreadElement(own), js.spreadElement(passed)]);
  return js.jsxAttribute("style", js.jsxExpressionContainer(merged));
}

/** A number literal (`1.5`, `-1`) as the string it renders as, or `undefined`. */
function numberLiteral(expression: Expression): AstExpression | undefined {
  if (expression.refs.length) return undefined;
  const node = parseExpression(expression.code);
  const value =
    node.type === "Literal" && typeof node.value === "number"
      ? node.value
      : node.type === "UnaryExpression" &&
          (node.operator === "-" || node.operator === "+") &&
          node.argument.type === "Literal" &&
          typeof node.argument.value === "number"
        ? node.operator === "-"
          ? -node.argument.value
          : node.argument.value
        : undefined;
  return value === undefined ? undefined : js.stringLiteral(String(value));
}

/**
 * The inline class helper (emulated `class-binding`, ADR-0038), printed after the component:
 * Vue's class semantics for the parts the output passes it, strings as they are and the names
 * of an object's truthy entries, joined with spaces. Its parameters are `unknown`, so a part of
 * any type the analyser accepts type-checks.
 */
function classHelperCode(name: string, collections: boolean): string {
  return `/** Joins class names: strings as they are, and the names of an object's truthy entries. */
function ${name}(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    ${
      collections
        ? `else if (Array.isArray(part)) {
      const joined = ${name}(...part);
      if (joined) names.push(joined);
    } `
        : ""
    }else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}`;
}

/**
 * The inline style helper (emulated `style-binding`, ADR-0065), printed after the component: a
 * style bound to a value as an object with kebab-case keys, which Solid sets one property at a
 * time. A declaration list splits as Vue's `parseStringStyle` splits it; an object, keyed as an
 * object literal's are, keeps its present values, its camel-case keys in kebab case. Only a custom
 * property or a CSS identifier is kept as a property, since Solid's server escapes an object's
 * values, not its keys.
 */
function styleHelperCode(name: string): string {
  // Raw, so the regular expressions keep their escapes.
  return String.raw`/** A style bound to a value as an object of CSS properties. */
function ${name}(style: object | string | null | undefined): Record<string, string> | undefined {
  if (style === null || style === undefined) return undefined;
  // A property is a custom property or a CSS identifier: Solid's server writes keys as they are.
  const PROPERTY = /^(?:--[^\s"'<>&;:]+|-?[A-Za-z_][\w-]*)$/;
  const properties: Record<string, string> = {};
  if (typeof style === "string") {
    for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
      const [property, value] = declaration.split(/:([^]+)/);
      const key = property!.trim();
      // A standard name is case-insensitive, as the browser reads it: COLOR is color.
      if (value !== undefined && PROPERTY.test(key)) {
        properties[key.startsWith("--") ? key : key.toLowerCase()] = value.trim();
      }
    }
    return properties;
  }
  for (const [key, value] of Object.entries(style)) {
    if (value === null || value === undefined || !PROPERTY.test(key)) continue;
    const kebab = key.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
    properties[key.startsWith("--") ? key : kebab] = String(value);
  }
  return properties;
}`;
}

/**
 * The inline scope helper (emulated `child-root-scope`, ADR-0063), printed after the component:
 * the props' `data-uf-*` keys, each with the empty value the parent passes. It reads the names
 * alone, so it never runs a prop's getter (a slot's `children`), and passes on no prop the
 * component declares.
 */
function scopeHelperCode(name: string): string {
  return `/** The scope attributes of the styled parents that render this component, for its root. */
function ${name}(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}`;
}
