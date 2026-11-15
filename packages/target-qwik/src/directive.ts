// A directive on Qwik (ADR-0099): Qwik has no directive, so an element that applies one takes a
// signal ref, its template ref's where it has one (`ref` takes one value), and each directive a
// `document-ready` visible task of its own, which tracks the element and the value and calls the
// inline `runDirective`: a new element is `mounted`, a value that changed (`Object.is`)
// `updated`. A visible task never runs on the server. Qwik sets a signal ref only when it creates
// the element, and a conditional's removal runs no task, so the helper watches the document for
// the element leaving (a `MutationObserver`), and the task's cleanup covers the component's own
// unmount: either runs `unmounted` once. The hooks stay module-level code, never `$()`, so the
// optimizer imports them into the task's segment: a `.uf.ts` module's directive is its plain
// hooks object. Qwik's order is its own, so each hook goes through the inline `queueHook`, which
// runs them in Vue's order (`emulated`).
import {
  dependencyImports,
  directiveDependencies,
  directiveHooksObject,
  assertedValue,
  hookQueueCode,
  js,
  rewriteCode,
} from "@unframework.dev/codegen";
import type { EmitContext, OutputFile } from "@unframework.dev/codegen";
import { walk } from "@unframework.dev/ir";
import type {
  DirectiveAttribute,
  ElementNode,
  UfComponent,
  UfDirective,
} from "@unframework.dev/ir";

import type { OutputNames, SetupPlan } from "./plan.ts";

/** The inline helpers a component that applies a directive declares. */
export const DIRECTIVE_HELPER = "runDirective";

/** `const vTrace = { mounted(el: HTMLElement, value: string): void { … } };`, the plain hooks. */
export function hooksCode(directive: UfDirective, exported = false): string {
  return `${exported ? "export " : ""}const ${directive.name} = ${directiveHooksObject(directive)};`;
}

/** `vFocusTrap.ts`: a `.uf.ts` module's directive, as its plain hooks. */
export function emitDirective(directive: UfDirective, context: EmitContext): OutputFile[] {
  const dependencies = directiveDependencies(directive, context.module);
  const imports = dependencyImports(dependencies);
  const code = [
    ...(imports.length ? [imports.join("\n")] : []),
    ...dependencies.types,
    ...(dependencies.constants.length ? [dependencies.constants.join("\n")] : []),
    hooksCode(directive, true),
  ].join("\n\n");
  return [{ path: `${directive.name}.ts`, contents: `${code}\n` }];
}

/** The signal refs and visible tasks of a component's directives, and their helpers. */
export class QwikDirectives {
  readonly #component: UfComponent;
  readonly #plan: SetupPlan;
  /** The signal each element that applies a directive is held in, by element. */
  readonly #signals = new Map<ElementNode, { name: string; own: boolean; type: string }>();
  /**
   * The signal each element's first directive prints as its `ref`, where it has no template ref:
   * the printer's element may be a copy (`qwikTitles`), whose attributes are the same.
   */
  readonly #refs = new Map<DirectiveAttribute, string>();
  readonly #helper:
    | { run: string; hooks: string; element: string; queue: string; values: string }
    | undefined;

  constructor(component: UfComponent, plan: SetupPlan, names: OutputNames) {
    this.#component = component;
    this.#plan = plan;
    walk(component.render, {
      enter: (node) => {
        if (node.kind !== "Element") return;
        const [first] = node.attributes.filter(
          (attribute): attribute is DirectiveAttribute => attribute.kind === "Directive",
        );
        if (!first) return;
        const ref = node.attributes.find((attribute) => attribute.kind === "Ref");
        // The element's type the directive's own hooks take, which its module names.
        const type = `DirectiveElement<typeof ${first.name}>`;
        const own = ref?.kind !== "Ref";
        this.#signals.set(
          node,
          ref?.kind === "Ref"
            ? {
                name: component.bindings.find(({ id }) => id === ref.binding)!.name,
                own: false,
                type,
              }
            : {
                name: names.fresh(`${first.name[1]!.toLowerCase()}${first.name.slice(2)}Element`),
                own: true,
                type,
              },
        );
        if (own) this.#refs.set(first, this.#signals.get(node)!.name);
      },
    });
    this.#helper = this.#signals.size
      ? {
          run: names.fresh(DIRECTIVE_HELPER),
          hooks: names.fresh("DirectiveHooks"),
          element: names.fresh("DirectiveElement"),
          queue: names.fresh("queueHook"),
          values: names.fresh("directiveStates"),
        }
      : undefined;
  }

  /** The element's `ref`, at its first directive, where it has no template ref of its own. */
  attribute(attribute: DirectiveAttribute): ReturnType<typeof js.jsxAttribute>[] {
    const signal = this.#refs.get(attribute);
    if (signal === undefined) return [];
    return [js.jsxAttribute("ref", js.jsxExpressionContainer(js.identifier(signal)))];
  }

  /** The statements of the component's body: the signals, then a task for each directive. */
  setup(names: OutputNames): string {
    const helper = this.#helper;
    if (!helper) return "";
    const statements: string[] = [];
    for (const [element, signal] of this.#signals) {
      if (signal.own) {
        const type = signal.type.replace("DirectiveElement", helper.element);
        statements.push(`const ${signal.name} = ${names.core("useSignal")}<${type}>();`);
      }
      for (const attribute of element.attributes) {
        if (attribute.kind !== "Directive") continue;
        // Read outside the branches around the element, so what they narrow is asserted.
        const code = rewriteCode(
          assertedValue(attribute.value),
          this.#component,
          this.#plan.rules(),
          "client",
        );
        const value = attribute.value.refs.length ? `track(() => ${code})` : code;
        statements.push(
          [
            `${names.core("useVisibleTask$")}(`,
            "  ({ track, cleanup }) => {",
            `    const element = track(${signal.name});`,
            // An element Qwik removed stays in its signal, with what narrowed its value gone.
            `    if (element?.isConnected) ${helper.run}(${attribute.name}, element, ${value}, cleanup);`,
            "  },",
            '  { strategy: "document-ready" },',
            ");",
          ].join("\n"),
        );
      }
    }
    return statements.join("\n\n");
  }

  /** The module's helpers: the hooks' type, the queue, and the function the tasks call. */
  helpers(): string[] {
    const helper = this.#helper;
    if (!helper) return [];
    const { run, hooks, element, queue, values } = helper;
    return [
      `/** The hooks of a directive, which \`${run}\` runs on its element. */
interface ${hooks}<E extends Element, T> {
  mounted?(el: E, value: T): unknown;
  updated?(el: E, value: T, oldValue: T): unknown;
  unmounted?(el: E): unknown;
}`,
      `/** The value each directive's element last received, and the watch on its removal. */
const ${values} = new WeakMap<object, WeakMap<Element, { value: unknown; observer: MutationObserver }>>();`,
      `/**
 * Runs a directive's hooks on its element, from the task that tracks the element and the value:
 * \`mounted\` for a new element, \`updated\` for a value that changed, and \`unmounted\` once the
 * element leaves the document, or the component unmounts.
 */
function ${run}<E extends Element, T>(
  directive: ${hooks}<E, T>,
  element: E,
  value: T,
  cleanup: (callback: () => void) => void,
): void {
  let states = ${values}.get(directive);
  if (!states) {
    states = new WeakMap();
    ${values}.set(directive, states);
  }
  const own = states;
  const unmount = () => {
    const state = own.get(element);
    if (!state) return;
    state.observer.disconnect();
    own.delete(element);
    ${queue}(element, () => directive.unmounted?.(element));
  };
  const state = own.get(element);
  if (!state) {
    const observer = new MutationObserver(() => {
      if (!element.isConnected) unmount();
    });
    observer.observe(document, { childList: true, subtree: true });
    own.set(element, { value, observer });
    ${queue}(element, () => directive.mounted?.(element, value));
  } else if (!Object.is(value, state.value)) {
    const previous = state.value as T;
    state.value = value;
    ${queue}(element, () => directive.updated?.(element, value, previous));
  }
  cleanup(() => {
    queueMicrotask(() => {
      if (!element.isConnected) unmount();
    });
  });
}`,
      `/** The element a directive's hooks take. */
type ${element}<D> = D extends ${hooks}<infer E extends Element, never> ? E : never;`,
      hookQueueCode(queue),
    ];
  }
}
