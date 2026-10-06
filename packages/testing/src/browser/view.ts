// `mount()` and the View: a framework-agnostic handle on one mounted component. The project's
// registered adapter does the framework part; everything a spec touches is the same on every
// target.
import type { MountedComponent, MountOptions, RenderReport } from "@unframework/codegen";
import { inject, TestRunner } from "vitest";
import type { RunnerTestCase } from "vitest";
import { page } from "vitest/browser";
import type { Locator } from "vitest/browser";

import { normalizeDom } from "../dom/serialize.ts";
import { caseOfFile } from "../harness.ts";
import { isNormalizeTarget } from "../normalize/targets.ts";
import { captureExternalConsole } from "./console.ts";
import { installDeterminism, ROOT_ATTRIBUTE, settleFrame } from "./determinism.ts";
import { expectParity } from "./parity.ts";
import type { ParityOptions } from "./parity.ts";
import { registeredAdapter } from "./target.ts";

/** Props as an adapter takes them. */
export type Props = Readonly<Record<string, unknown>>;

/** A mounted component. Queries are scoped to its container. */
export interface View<P = Props> {
  readonly target: string;
  /**
   * The mount root: a `<div data-uf-root>` directly in the page's `<body>`. No landmark wraps
   * it: the page a component is rendered into owns the landmarks, and a harness `<main>` would
   * make a component's own `<main>` a nested, duplicate one for axe (L11).
   */
  readonly container: HTMLElement;
  /** The container's locator: `page.getByTestId("uf-root-N")`, which stays valid as the DOM changes. */
  readonly locator: Locator;
  readonly getByRole: Locator["getByRole"];
  readonly getByText: Locator["getByText"];
  readonly getByLabelText: Locator["getByLabelText"];
  readonly getByPlaceholder: Locator["getByPlaceholder"];
  readonly getByAltText: Locator["getByAltText"];
  readonly getByTitle: Locator["getByTitle"];
  readonly getByTestId: Locator["getByTestId"];
  /** The container's content as normalised HTML, the form L7 compares. */
  html(): string;
  /** Waits for the framework to flush, the fonts and two frames. */
  settle(): Promise<void>;
  /**
   * Renders the component again with new props, as a parent that re-renders it would, and
   * waits until it has settled, as `mount` does. The props are replaced whole: a prop `props`
   * lacks takes its default again (plan §7.2, L8).
   */
  rerender(props: P): Promise<void>;
  /** Verifies L7, L10 and L11 for a scenario against the case's shared expectations. */
  expectParity(name: string, options?: ParityOptions): Promise<void>;
  unmount(): Promise<void>;
}

/** How a test mounts a component whose props have a type: with props of that type. */
export interface ComponentMountOptions<P> {
  props?: P;
}

/**
 * What a function component cannot be: the untyped overloads take the test stubs' plain
 * objects only, so a component's props are never checked against `MountOptions` instead of
 * its own type.
 */
export type NotAFunction<C> = C extends (...args: never[]) => unknown ? never : C;

const mounted = new Set<View<never>>();
let roots = 0;

/**
 * Mounts a compiled component with the project's adapter and waits until it has settled. A
 * component imported from a `.uf.tsx` is typed as its authored function, so its props are
 * checked against its own props type.
 */
export function mount<P>(
  component: (props: P) => unknown,
  // Not inferred from: the props are checked against the component's type, never widen it.
  options?: ComponentMountOptions<NoInfer<P>>,
): Promise<View<P>>;
/** Mounts what is not a function component, such as a test stub. */
export function mount<C extends object>(
  component: NotAFunction<C>,
  options?: MountOptions,
): Promise<View>;
export function mount(component: unknown, options: MountOptions = {}): Promise<View<never>> {
  return mountWith(component, options.props);
}

/**
 * Mounts a component with the props of one of the case's SSR scenarios, `case.json`'s
 * `ssr[name].props`, so the browser scenario and its server twin render the same props. The
 * test then checks it with `expectParity(name)` under the same name.
 */
export function mountScenario<P>(component: (props: P) => unknown, name: string): Promise<View<P>>;
/** Mounts what is not a function component, such as a test stub, with a scenario's props. */
export function mountScenario<C extends object>(
  component: NotAFunction<C>,
  name: string,
): Promise<View>;
export async function mountScenario(component: unknown, name: string): Promise<View<never>> {
  const test = TestRunner.getCurrentTest<RunnerTestCase | undefined>();
  if (!test) throw new Error("mountScenario must be called inside a test.");
  const harness = inject("ufHarness");
  const caseId = caseOfFile(test.file.filepath, harness);
  const scenarios = harness.cases[caseId]?.ssr ?? {};
  if (!Object.hasOwn(scenarios, name)) {
    const declared = Object.keys(scenarios);
    throw new Error(
      `mountScenario(…, "${name}"): ${caseId}'s case.json declares no SSR scenario "${name}" (${declared.length ? `it declares ${declared.join(", ")}` : "it declares none"}). Declare it under "ssr" with its props, or mount a browser-only scenario with mount(component, { props }).`,
    );
  }
  // A copy: the provided context is shared by every test of the file.
  const props = scenarios[name]?.props;
  return mountWith(component, props === undefined ? undefined : structuredClone(props));
}

async function mountWith(component: unknown, props: unknown): Promise<View<never>> {
  const { target, mount: adapter } = registeredAdapter();
  const initial = checkProps("mount", props);
  await installDeterminism();
  const container = document.createElement("div");
  const testId = `uf-root-${(roots += 1)}`;
  container.setAttribute(ROOT_ATTRIBUTE, "");
  container.setAttribute("data-testid", testId);
  document.body.append(container);

  let instance: MountedComponent;
  try {
    instance = await adapter(component, container, initial ? { props: initial } : {});
  } catch (error) {
    container.remove();
    throw error;
  }
  report(instance);

  const locator = page.getByTestId(testId);
  const settle = () => settleFrame(() => instance.settle());
  let unmounted = false;
  const view: View<never> = {
    target,
    container,
    locator,
    getByRole: (...args) => locator.getByRole(...args),
    getByText: (...args) => locator.getByText(...args),
    getByLabelText: (...args) => locator.getByLabelText(...args),
    getByPlaceholder: (...args) => locator.getByPlaceholder(...args),
    getByAltText: (...args) => locator.getByAltText(...args),
    getByTitle: (...args) => locator.getByTitle(...args),
    getByTestId: (...args) => locator.getByTestId(...args),
    // A target the normaliser does not know (a test stub) has no framework noise to remove.
    html: () => normalizeDom(container, isNormalizeTarget(target) ? { target } : {}),
    settle,
    async rerender(next) {
      if (unmounted) throw new Error("rerender: the view is unmounted.");
      report(await instance.rerender(checkProps("rerender", next) ?? {}));
      await settle();
    },
    expectParity: (name, parityOptions) => expectParity(view, name, parityOptions),
    async unmount() {
      if (unmounted) return;
      unmounted = true;
      mounted.delete(view);
      try {
        await instance.unmount();
      } finally {
        container.remove();
      }
    },
  };
  mounted.add(view);
  await settle();
  return view;
}

/** Hands what a render logged outside the page (Astro's server render) to the L13 capture. */
function report(rendered: RenderReport | void): void {
  if (rendered && rendered.console?.length) captureExternalConsole(rendered.console);
}

/** The props an adapter gets: a plain object, or none. */
function checkProps(action: string, props: unknown): Props | undefined {
  if (props === undefined || isProps(props)) return props;
  throw new TypeError(
    `${action}: props are an object of prop names and values, not ${props === null ? "null" : Array.isArray(props) ? "an array" : typeof props}.`,
  );
}

function isProps(value: unknown): value is Props {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Unmounts every view the current test left mounted, newest first. */
export async function cleanup(): Promise<void> {
  const errors: unknown[] = [];
  for (const view of [...mounted].reverse()) {
    try {
      await view.unmount();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length) throw new AggregateError(errors, `${errors.length} views failed to unmount.`);
}
