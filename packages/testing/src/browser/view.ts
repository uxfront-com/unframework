// `mount()` and the View: a framework-agnostic handle on one mounted component. The project's
// registered adapter does the framework part; everything a spec touches is the same on every
// target.
import type { MountedComponent, MountOptions } from "@unframework/codegen";
import { page } from "vitest/browser";
import type { Locator } from "vitest/browser";

import { normalizeDom } from "../dom/serialize.ts";
import { isNormalizeTarget } from "../normalize/targets.ts";
import { captureExternalConsole } from "./console.ts";
import { installDeterminism, ROOT_ATTRIBUTE, settleFrame } from "./determinism.ts";
import { expectParity } from "./parity.ts";
import type { ParityOptions } from "./parity.ts";
import { registeredAdapter } from "./target.ts";

/** A mounted component. Queries are scoped to its container. */
export interface View {
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
  /** Verifies L7, L10 and L11 for a scenario against the case's shared expectations. */
  expectParity(name: string, options?: ParityOptions): Promise<void>;
  unmount(): Promise<void>;
}

const mounted = new Set<View>();
let roots = 0;

/** Mounts a compiled component with the project's adapter and waits until it has settled. */
export async function mount(component: unknown, options: MountOptions = {}): Promise<View> {
  const { target, mount: adapter } = registeredAdapter();
  await installDeterminism();
  const container = document.createElement("div");
  const testId = `uf-root-${(roots += 1)}`;
  container.setAttribute(ROOT_ATTRIBUTE, "");
  container.setAttribute("data-testid", testId);
  document.body.append(container);

  let instance: MountedComponent;
  try {
    instance = await adapter(component, container, options);
  } catch (error) {
    container.remove();
    throw error;
  }
  if (instance.console?.length) captureExternalConsole(instance.console);

  const locator = page.getByTestId(testId);
  const settle = () => settleFrame(() => instance.settle());
  let unmounted = false;
  const view: View = {
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
