// `<Transition name appear>` on Qwik (ADR-0100). Qwik removes a node at once and has no
// transition primitive, so each transition's rendered branches lag its conditional: a signal lists
// the branches it renders, starting at the condition's value, so the server renders the settled
// child and resumption changes nothing. A document-ready visible task tracks which branch the
// conditional shows: it runs the old branch's leave and drops that branch from the list at the
// leave's end, and adds the new one. The new element enters from its ref, which Qwik calls as it
// creates the element, so it carries `-enter-from` before it is first painted. A ref that was there
// already, a template ref's or a directive's, is called from the transition's.
import { js, jsxElement, rewriteExpression } from "@unframework.dev/codegen";
import type { JsxDialect } from "@unframework.dev/codegen";
import { walk } from "@unframework.dev/ir";
import type { ElementNode, TransitionNode, UfComponent } from "@unframework.dev/ir";

import type { OutputNames, SetupPlan } from "./plan.ts";

/** An element as the JSX printer writes it. */
type PrintedElement = ReturnType<typeof jsxElement>;

/** The names one transition needs. */
interface TransitionLocals {
  /** The signal of the branches it renders. */
  shown: string;
  /** Its state: whether the component has mounted, the branch shown, and the elements. */
  state: string;
}

/** A component's transitions: their names, setup and printing. */
export interface QwikTransitions {
  setup(): string;
  jsx: NonNullable<JsxDialect["transition"]>;
  helpers(): string;
}

/** The transitions of a component, or `undefined` where its template holds none. */
export function qwikTransitions(
  component: UfComponent,
  plan: SetupPlan,
  names: OutputNames,
): QwikTransitions | undefined {
  const nodes: TransitionNode[] = [];
  walk(component.render, {
    enter(node) {
      if (node.kind === "Transition") nodes.push(node);
    },
  });
  if (!nodes.length) return undefined;
  const helper = names.once("transition");
  const run = names.once("runTransition");
  const stateType = names.once("TransitionState");
  const locals = new Map<number, TransitionLocals>(
    nodes.map((node) => [
      node.span.start,
      {
        shown: names.fresh(`${node.name.replace(/\W/g, "_")}Shown`),
        state: names.fresh(`${node.name.replace(/\W/g, "_")}State`),
      },
    ]),
  );
  /** Which branch the conditional shows, as code: its index, or -1 for none. */
  const branchOf = (node: TransitionNode): string => {
    const [child] = node.children;
    if (child?.kind !== "If") return "0";
    const value = (index: number) => (child.branches[index]!.children.length ? `${index}` : "-1");
    let chain =
      child.branches.at(-1)!.condition === undefined ? value(child.branches.length - 1) : "-1";
    const conditioned = child.branches.filter((branch) => branch.condition !== undefined);
    for (let index = conditioned.length - 1; index >= 0; index -= 1) {
      const condition = rewriteExpression(
        conditioned[index]!.condition!,
        component,
        plan.rules(),
        "pure",
      );
      chain = `(${condition}) ? ${value(index)} : ${chain}`;
    }
    return chain;
  };
  return {
    setup: () =>
      nodes
        .flatMap((node) => {
          const { shown, state } = locals.get(node.span.start)!;
          const branch = branchOf(node);
          const conditional = node.children[0]?.kind === "If";
          return [
            `const ${state} = ${names.core("useConstant")}((): ${stateType} => ({ ready: false, current: ${branch}, elements: [] }));`,
            ...(conditional
              ? [
                  `const ${shown} = ${names.core("useSignal")}<number[]>([${branch}].filter((index) => index >= 0));`,
                  [
                    `${names.core("useVisibleTask$")}(`,
                    `  ({ track }) => {`,
                    `    const next = track(() => ${branch});`,
                    `    ${state}.ready = true;`,
                    `    const previous = ${state}.current;`,
                    `    if (next === previous) return;`,
                    `    ${state}.current = next;`,
                    `    if (next >= 0) ${shown}.value = [...${shown}.value.filter((index) => index !== next), next];`,
                    `    const leaving = previous < 0 ? undefined : ${state}.elements[previous];`,
                    `    if (!leaving) {`,
                    `      ${shown}.value = ${shown}.value.filter((index) => index !== previous);`,
                    `      return;`,
                    `    }`,
                    `    ${run}(leaving, ${JSON.stringify(node.name)}, "leave", () => {`,
                    `      ${shown}.value = ${shown}.value.filter((index) => index !== previous);`,
                    `    });`,
                    `  },`,
                    `  { strategy: "document-ready" },`,
                    `);`,
                  ].join("\n"),
                ]
              : [
                  [
                    `${names.core("useVisibleTask$")}(`,
                    `  () => {`,
                    `    ${state}.ready = true;`,
                    `  },`,
                    `  { strategy: "document-ready" },`,
                    `);`,
                  ].join("\n"),
                ]),
          ];
        })
        .join("\n"),
    jsx: (node, context) => {
      const { shown, state } = locals.get(node.span.start)!;
      const [child] = node.children;
      const marked = (element: ElementNode, index: number) =>
        withTransitionRef(jsxElement(element, context), helper, state, node, index);
      if (child?.kind !== "If") return marked(child as ElementNode, 0);
      return js.jsxFragment(
        child.branches.flatMap((branch, index) => {
          const [element] = branch.children;
          if (!element) return [];
          return [
            js.jsxExpressionContainer(
              js.logicalExpression(
                "&&",
                js.callExpression(
                  js.memberExpression(
                    js.memberExpression(js.identifier(shown), "value"),
                    "includes",
                  ),
                  [js.numberLiteral(index)],
                ),
                marked(element as ElementNode, index),
              ),
            ),
          ];
        }),
      );
    },
    helpers: () =>
      transitionHelpers(
        helper,
        run,
        stateType,
        names.imports.add("@qwik.dev/core/build", "isServer"),
      ),
  };
}

/**
 * The element with the transition's ref, `ref={transition(fadeState, "fade", 0, false)}`, which
 * takes the element's own ref, if any, as its last argument.
 */
function withTransitionRef(
  element: PrintedElement,
  helper: string,
  state: string,
  node: TransitionNode,
  index: number,
): PrintedElement {
  const attributes = element.openingElement.attributes;
  const own = attributes.findIndex(
    (attribute) =>
      attribute.type === "JSXAttribute" &&
      attribute.name.type === "JSXIdentifier" &&
      attribute.name.name === "ref",
  );
  const value =
    own < 0
      ? undefined
      : (
          attributes[own] as Extract<
            PrintedElement["openingElement"]["attributes"][number],
            { type: "JSXAttribute" }
          >
        ).value;
  const inner =
    value?.type === "JSXExpressionContainer" && value.expression.type !== "JSXEmptyExpression"
      ? value.expression
      : undefined;
  const ref = js.jsxAttribute(
    "ref",
    js.jsxExpressionContainer(
      js.callExpression(js.identifier(helper), [
        js.identifier(state),
        js.stringLiteral(node.name),
        js.numberLiteral(index),
        js.booleanLiteral(node.appear === true),
        ...(inner ? [inner] : []),
      ]),
    ),
  );
  if (own < 0) attributes.push(ref);
  else attributes[own] = ref;
  return element;
}

/** The inline helpers, after the component. */
function transitionHelpers(
  helper: string,
  run: string,
  stateType: string,
  isServer: string,
): string {
  return `/** A transition's state: whether its component has mounted, the branch shown, and its elements. */
interface ${stateType} {
  ready: boolean;
  current: number;
  elements: Element[];
}

/**
 * Runs Vue's transition classes of \`name\` of one phase on \`element\`, then \`done\`: \`-from\` and
 * \`-active\`, \`-to\` for \`-from\` two frames later, and none once the element's own
 * \`transitionend\` or \`animationend\` fires, or its longest duration and delay pass.
 */
function ${run}(element: Element, name: string, phase: "enter" | "leave", done?: () => void): void {
  const from = \`\${name}-\${phase}-from\`;
  const active = \`\${name}-\${phase}-active\`;
  const to = \`\${name}-\${phase}-to\`;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const end = (event?: Event) => {
    if (event && event.target !== element) return;
    clearTimeout(timer);
    element.removeEventListener("transitionend", end);
    element.removeEventListener("animationend", end);
    element.classList.remove(from, active, to);
    done?.();
  };
  element.classList.add(from, active);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      element.classList.remove(from);
      element.classList.add(to);
      const style = getComputedStyle(element);
      const longest = (delays: string, durations: string) => {
        const each = (list: string) => list.split(", ").map((time) => Number(time.slice(0, -1)) * 1000);
        const delay = each(delays);
        return Math.max(0, ...each(durations).map((duration, index) => duration + (delay[index % delay.length] ?? 0)));
      };
      const time = Math.max(
        longest(style.transitionDelay, style.transitionDuration),
        longest(style.animationDelay, style.animationDuration),
      );
      if (!time) {
        end();
        return;
      }
      element.addEventListener("transitionend", end);
      element.addEventListener("animationend", end);
      timer = setTimeout(end, time + 1);
    });
  });
}

/**
 * The ref of a transition's element: it records the element, and runs its enter once the
 * component has mounted, or with \`appear\`. Qwik calls a ref again when its value changes, and
 * each render makes a new one, so it takes an element once. It calls the element's own ref first.
 */
function ${helper}(
  state: ${stateType},
  name: string,
  index: number,
  appear: boolean,
  own?: ((element: Element) => void) | { value: Element | undefined },
): (element: Element) => void {
  return (element) => {
    if (typeof own === "function") own(element);
    else if (own) own.value = element;
    // Qwik's server render calls a ref too, with no DOM: the server renders the settled child.
    if (${isServer}) return;
    if (state.elements[index] === element) return;
    state.elements[index] = element;
    if (state.ready || appear) ${run}(element, name, "enter");
  };
}`;
}
