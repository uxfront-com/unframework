// A directive on Qwik (ADR-0099): Qwik has no directive, so an element that applies one takes a
// signal ref, its template ref's where it has one (`ref` takes one value), and each directive a
// `document-ready` visible task of its own, which tracks the element and the value and calls the
// inline `runDirective`. A visible task never runs on the server. Qwik sets a signal ref only when
// it creates the element, which may be before a slot projects it, and a conditional's removal
// runs no task, so the runner follows the element's place in the document (`directive-runner.ts`
// in the codegen), and the task's cleanup covers the component's own unmount. The hooks stay
// module-level code, never `$()`, so the optimizer imports them into the task's segment: a
// `.uf.ts` module's directive is its plain hooks object. Qwik's order is its own, so each hook
// goes through the inline `queueHook`, which runs them in Vue's order (`emulated`).
//
// A directive whose value reads a list's row or a scoped fill's props has a value for each
// element, which one task can't read (ADR-0108). Its element's `ref` passes them instead: a
// function `ref` is a new function at each render of the row, and Qwik calls a new one again
// with the element, so `collectValues(list, [item.label])` keeps each element in the list with
// the values of its directives that read the row, and the task runs each element's own. The
// values are read as the row renders, in the call's arguments, never in the function it
// returns, which Qwik calls outside the component's tracking: a value that reads the
// component's state too renders the row again when that state changes.
import {
  dependencyImports,
  directiveDependencies,
  directiveHooksObject,
  directiveRunnerCode,
  expressionCode,
  waitCode,
  assertedValue,
  hookQueueCode,
  js,
  readsElementScope,
  rewriteCode,
} from "@unframework.dev/codegen";
import type { EmitContext, JsxContext, OutputFile } from "@unframework.dev/codegen";
import { childrenOf, walk } from "@unframework.dev/ir";
import type {
  DirectiveAttribute,
  ElementNode,
  RefAttribute,
  RenderNode,
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
export function emitDirective(directive: UfDirective, context: EmitContext): Array<OutputFile> {
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

/** The element lists and visible tasks of a component's directives, and their helpers. */
export class QwikDirectives {
  readonly #component: UfComponent;
  readonly #plan: SetupPlan;
  /**
   * The signal of the elements each element node's directives run on, by the node: one use may
   * render several, as a slot a child renders in a list (ADR-0099), and the template ref the
   * node's `ref` also fills, where it has one.
   */
  readonly #lists = new Map<
    ElementNode,
    { name: string; type: string; templateRef?: string; values: Array<DirectiveAttribute> }
  >();
  /**
   * The list each node's first directive collects into with its `ref`, by the directive: the
   * printer's element may be a copy (`qwikTitles`), whose attributes are the same. `values` are
   * the node's directives whose value reads the row or a fill's props, which the `ref` passes
   * (ADR-0108).
   */
  readonly #refs = new Map<
    DirectiveAttribute,
    { list: string; templateRef?: string; values: Array<DirectiveAttribute> }
  >();
  /** The template refs that a directive's `ref` fills instead of a `ref` of their own. */
  readonly #templateRefs = new Set<RefAttribute>();
  /** The elements in a conditional's branch, whose value the task reads only while they're in. */
  readonly #branched = new Set<ElementNode>();
  readonly #helper:
    | {
        run: string;
        hooks: string;
        element: string;
        queue: string;
        values: string;
        watch: string;
        watches: string;
        checker: string;
        leftWatch: string;
        collect: string;
        forget: string;
        /** `waitForDocument`, where a value in a branch waits for its element (ADR-0099). */
        wait?: string;
        /**
         * `collectValues`, `forgetValues` and `DirectiveValue`, where an element passes its
         * directives' values (ADR-0108).
         */
        passed?: { collect: string; forget: string; type: string };
      }
    | undefined;

  constructor(component: UfComponent, plan: SetupPlan, names: OutputNames) {
    this.#component = component;
    this.#plan = plan;
    walk(component.render, {
      enter: (node) => {
        if (node.kind !== "Element") {
          return;
        }
        const [first] = node.attributes.filter(
          (attribute): attribute is DirectiveAttribute => attribute.kind === "Directive",
        );
        if (!first) {
          return;
        }
        const ref = node.attributes.find(
          (attribute): attribute is RefAttribute => attribute.kind === "Ref",
        );
        if (ref) {
          this.#templateRefs.add(ref);
        }
        const templateRef = ref
          ? component.bindings.find(({ id }) => id === ref.binding)!.name
          : undefined;
        const list = names.fresh(`${first.name[1]!.toLowerCase()}${first.name.slice(2)}Elements`);
        const values = node.attributes.filter(
          (attribute): attribute is DirectiveAttribute =>
            attribute.kind === "Directive" && readsElementScope(attribute, component),
        );
        // The element's type the directive's own hooks take, which its module names.
        this.#lists.set(node, {
          name: list,
          type: `DirectiveElement<typeof ${first.name}>`,
          ...(templateRef ? { templateRef } : {}),
          values,
        });
        this.#refs.set(first, { list, ...(templateRef ? { templateRef } : {}), values });
      },
    });
    // The elements in a conditional's branch whose directive reads a value.
    const branched = (node: RenderNode, inBranch: boolean): void => {
      if (node.kind === "If") {
        for (const branch of node.branches) {
          for (const child of branch.children) {
            branched(child, true);
          }
        }
        return;
      }
      if (
        inBranch &&
        node.kind === "Element" &&
        node.attributes.some(
          (attribute) =>
            attribute.kind === "Directive" &&
            attribute.value.refs.length > 0 &&
            // A value the element passes is read as it renders, so it never waits (ADR-0108).
            !readsElementScope(attribute, component),
        )
      ) {
        this.#branched.add(node);
      }
      for (const child of childrenOf(node)) {
        branched(child, inBranch);
      }
    };
    for (const child of childrenOf(component.render)) {
      branched(child, false);
    }
    const waits = this.#branched.size > 0;
    const passes = [...this.#lists.values()].some(({ values }) => values.length > 0);
    this.#helper = this.#lists.size
      ? {
          run: names.fresh(DIRECTIVE_HELPER),
          hooks: names.fresh("DirectiveHooks"),
          element: names.fresh("DirectiveElement"),
          queue: names.fresh("queueHook"),
          values: names.fresh("directiveStates"),
          watch: names.fresh("watchDocument"),
          watches: names.fresh("documentWatches"),
          checker: names.fresh("directiveCheck"),
          leftWatch: names.fresh("watchLeft"),
          collect: names.fresh("collectElement"),
          forget: names.fresh("forgetElement"),
          ...(waits ? { wait: names.fresh("waitForDocument") } : {}),
          ...(passes
            ? {
                passed: {
                  collect: names.fresh("collectValues"),
                  forget: names.fresh("forgetValues"),
                  type: names.fresh("DirectiveValue"),
                },
              }
            : {}),
        }
      : undefined;
  }

  /**
   * The element's `ref`, at its first directive: a function that adds each element it receives
   * to the directive's list, and fills the element's template ref too where it has one.
   */
  attribute(
    attribute: DirectiveAttribute,
    context: JsxContext,
    passedRef?: string,
  ): Array<ReturnType<typeof js.jsxAttribute>> {
    const ref = this.#refs.get(attribute);
    const helper = this.#helper;
    if (ref === undefined || !helper) {
      return [];
    }
    // What the element's ref fills besides the directive's list: its template ref, and on the
    // root, a consumer's ref (ADR-0118).
    const fills = [
      ...(ref.templateRef ? [`${ref.templateRef}.value = element;`] : []),
      ...(passedRef === undefined ? [] : [`if (${passedRef}) ${passedRef}.value = element;`]),
    ];
    if (ref.values.length && helper.passed) {
      // Read as the row renders, where what a branch around it narrows still holds (ADR-0108).
      const values = ref.values.map((each) => expressionCode(each.value, context));
      const collect = `${helper.passed.collect}(${ref.list}, [${values.join(", ")}])`;
      const code = fills.length
        ? `${helper.passed.collect}(${ref.list}, [${values.join(", ")}], (element) => {\n  ${fills.join("\n  ")}\n})`
        : collect;
      return [
        js.jsxAttribute("ref", js.jsxExpressionContainer(context.placeholders.expression(code))),
      ];
    }
    const collect = `${helper.collect}(${ref.list}, element)`;
    const code = fills.length
      ? `(element) => {\n  ${fills.join("\n  ")}\n  ${collect};\n}`
      : `(element) => ${collect}`;
    return [
      js.jsxAttribute("ref", js.jsxExpressionContainer(context.placeholders.expression(code))),
    ];
  }

  /** Whether a template ref is filled by its element's directive `ref`, so prints none itself. */
  fillsTemplateRef(attribute: RefAttribute): boolean {
    return this.#templateRefs.has(attribute);
  }

  /** The statements of the component's body: the element lists, then a task per directive. */
  setup(names: OutputNames): string {
    const helper = this.#helper;
    if (!helper) {
      return "";
    }
    const statements: Array<string> = [];
    for (const [element, list] of this.#lists) {
      const type = list.type.replace("DirectiveElement", helper.element);
      // An element that passes its directives' values is listed with them (ADR-0108).
      const passed = list.values.length ? helper.passed : undefined;
      const entry = passed
        ? `{ element: ${type}; values: [${list.values.map((each) => `${passed.type}<typeof ${each.name}>`).join(", ")}] }`
        : type;
      statements.push(`const ${list.name} = ${names.core("useSignal")}<${entry}[]>([]);`);
      for (const attribute of element.attributes) {
        if (attribute.kind !== "Directive") {
          continue;
        }
        // The task's own names, apart from the component's.
        const track = names.once("track");
        const cleanup = names.once("cleanup");
        const local = names.once("element");
        const context = [
          track === "track" ? track : `track: ${track}`,
          cleanup === "cleanup" ? cleanup : `cleanup: ${cleanup}`,
        ].join(", ");
        // The element's own value, which its `ref` passed, or one the task reads.
        const index = list.values.indexOf(attribute);
        const valuesName = passed ? names.once("values") : undefined;
        const lines: Array<string> = [];
        let value: string;
        if (index >= 0) {
          value = `${valuesName}[${index}]`;
        } else {
          // Read outside the branches around the element, so what they narrow is asserted.
          const code = rewriteCode(
            assertedValue(attribute.value),
            this.#component,
            this.#plan.rules(),
            "client",
          );
          value = names.once("value");
          lines.push(
            `const ${value} = ${attribute.value.refs.length ? `${track}(() => ${code})` : code};`,
          );
        }
        const elements = `${track}(${list.name})`;
        const each = passed
          ? `{ ${field("element", local)}, ${field("values", valuesName!)} }`
          : local;
        const follow = passed
          ? [
              `      leave: (left) => ${passed.forget}(${list.name}, left),`,
              `      back: ${passed.collect}(${list.name}, ${valuesName}),`,
            ]
          : [
              `      leave: (left) => ${helper.forget}(${list.name}, left),`,
              `      back: (kept) => ${helper.collect}(${list.name}, kept),`,
            ];
        const run = [
          ...lines,
          `for (const ${each} of ${elements}) {`,
          `  ${cleanup}(`,
          `    ${helper.run}(${attribute.name}, ${local}, ${value}, {`,
          ...follow,
          "    }),",
          "  );",
          "}",
        ];
        // An element Qwik removed stays in its list, with what its branch narrows gone, so a
        // value in a branch is read only while one of the elements is in the document: until a
        // slot puts one there, the task waits, and runs again once it is. A value the element
        // passed was read as it rendered, so it never waits.
        const listed = passed
          ? `${list.name}.value.map(({ element }) => element)`
          : `${list.name}.value`;
        const connected = passed
          ? `${elements}.some(({ element: ${local} }) => ${local}.isConnected)`
          : `${elements}.some((${local}) => ${local}.isConnected)`;
        const body =
          !this.#branched.has(element) || !helper.wait || index >= 0
            ? run
            : [
                `if (${connected}) {`,
                ...run.map((line) => `  ${line}`),
                "} else {",
                `  for (const ${local} of ${listed}) {`,
                `    ${cleanup}(${helper.wait}(${local}, () => ${list.name}.trigger()));`,
                "  }",
                "}",
              ];
        statements.push(
          [
            `${names.core("useVisibleTask$")}(`,
            `  ({ ${context} }) => {`,
            ...body.map((line) => `    ${line}`),
            "  },",
            '  { strategy: "document-ready" },',
            ");",
          ].join("\n"),
        );
      }
    }
    return statements.join("\n\n");
  }

  /** The module's helpers: the hooks' type, the runner the tasks call, and the queue. */
  helpers(names: OutputNames): Array<string> {
    const helper = this.#helper;
    if (!helper) {
      return [];
    }
    const { run, hooks, element, queue, values, watch, watches, wait, collect, forget } = helper;
    const signal = names.core("Signal", { type: true });
    // The plain list's helpers, where an element's directives' values are all the tasks'.
    const plain = [...this.#lists.values()].some((list) => !list.values.length);
    return [
      ...directiveRunnerCode({
        run,
        hooks,
        states: values,
        watch,
        watches,
        checker: helper.checker,
        leftWatch: helper.leftWatch,
        queue,
      }),
      ...(wait ? [waitCode(wait, watch)] : []),
      ...(plain ? plainHelpers(collect, forget, signal) : []),
      ...(helper.passed ? valuesHelpers(helper.passed, hooks, signal) : []),
      `/** The element a directive's hooks take. */
type ${element}<D> = D extends ${hooks}<infer E extends Element, never> ? E : never;`,
      hookQueueCode(queue),
    ];
  }
}

/** The list of elements alone, for an element whose directives' values the tasks read. */
function plainHelpers(collect: string, forget: string, signal: string): Array<string> {
  return [
    `/**
 * Adds an element a directive's \`ref\` receives to the directive's elements, once: on the server
 * a reference the client resumes as the element, so every element one use renders is followed.
 */
function ${collect}<E extends Element>(elements: ${signal}<E[]>, element: E): void {
  if (elements.untrackedValue.includes(element)) return;
  elements.value = [...elements.untrackedValue, element];
}`,
    `/**
 * Drops an element that left the document from its directive's elements, once \`unmounted\` ran,
 * so the list holds only the elements in it; one Qwik projects again comes back through the
 * runner's weak watch.
 */
function ${forget}<E extends Element>(elements: ${signal}<E[]>, element: E): void {
  elements.untrackedValue = elements.untrackedValue.filter((each) => each !== element);
}`,
  ];
}

/**
 * The list of elements with the values they pass (ADR-0108): `collectValues`, which a row's
 * `ref` calls as it renders, `forgetValues` and the value's type.
 */
function valuesHelpers(
  names: { collect: string; forget: string; type: string },
  hooks: string,
  signal: string,
): Array<string> {
  const { collect, forget, type } = names;
  return [
    `/**
 * The \`ref\` of an element whose directives' values read its row or its slot's props: it adds the
 * element to its directives' elements with the values, read as the element renders, or gives it
 * the values of this render where one changed (\`Object.is\`), so the tasks run it again. A
 * function \`ref\` is new at each render, and Qwik calls the new one with the element. \`then\`
 * fills the element's template ref too.
 */
function ${collect}<E extends Element, V extends unknown[]>(
  elements: ${signal}<{ element: E; values: V }[]>,
  values: NoInfer<V>,
  then?: (element: E) => void,
): (element: E) => void {
  return (element) => {
    then?.(element);
    const listed = elements.untrackedValue;
    const found = listed.find((each) => each.element === element);
    if (found?.values.every((value, index) => Object.is(value, values[index]))) return;
    elements.value = found
      ? listed.map((each) => (each === found ? { element, values } : each))
      : [...listed, { element, values }];
  };
}`,
    `/**
 * Drops an element that left the document from its directives' elements, once \`unmounted\` ran;
 * one Qwik projects again comes back with the values it last had, through the runner's weak watch.
 */
function ${forget}<E extends Element, V>(
  elements: ${signal}<{ element: E; values: V }[]>,
  element: E,
): void {
  elements.untrackedValue = elements.untrackedValue.filter((each) => each.element !== element);
}`,
    `/** The value a directive's hooks take. */
type ${type}<D> = D extends ${hooks}<never, infer T> ? T : never;`,
  ];
}

/** A destructured field: `element`, or `element: element_1` where its local is renamed. */
function field(name: string, renamed: string): string {
  return renamed === name ? name : `${name}: ${renamed}`;
}
