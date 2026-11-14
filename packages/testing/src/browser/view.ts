// `mount()` and the View: a framework-agnostic handle on one mounted component. The project's
// registered adapter does the framework part; everything a spec touches is the same on every
// target.
import type {
  MountedComponent,
  MountEvent,
  MountOptions,
  RenderReport,
} from "@unframework.dev/codegen";
import { inject, TestRunner } from "vitest";
import type { RunnerTestCase } from "vitest";
import { commands, page } from "vitest/browser";
import type { Locator } from "vitest/browser";

import "../commands.ts";
import { normalizeDomWithIds } from "../dom/serialize.ts";
import { formatError } from "../errors.ts";
import { caseOfFile } from "../harness.ts";
import type { HarnessContext } from "../harness.ts";
import { recordLayer } from "../layers.ts";
import { inlineHosts } from "../normalize/rules/aria-hosts.ts";
import { isNormalizeTarget } from "../normalize/targets.ts";
import { assertInteractive } from "./capabilities.ts";
import { advanceClock, checkTick, installClock } from "./clock.ts";
import type { ViewClock } from "./clock.ts";
import { captureExternalConsole } from "./console.ts";
import { installDeterminism, ROOT_ATTRIBUTE, settleFrame } from "./determinism.ts";
import { copyPayload, renumberIds } from "./events.ts";
import type { EmittedEvent } from "./events.ts";
import {
  clientRender,
  compareClientRender,
  compareIds,
  failHydration,
  hydrateInto,
  idsOf,
  idsOfHtml,
  isHydrateProject,
} from "./hydrate.ts";
import type { Hydrated } from "./hydrate.ts";
import { takePreventedNavigations } from "./navigation.ts";
import { expectParity } from "./parity.ts";
import type { ParityOptions } from "./parity.ts";
import { registeredAdapter } from "./target.ts";
import type { TargetOptions } from "./target.ts";
import { expectThrown } from "./thrown.ts";
import { Trace } from "./trace.ts";
import { createUser } from "./user.ts";
import type { Input, ViewUser } from "./user.ts";

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
  /**
   * A person's input to this view: each action runs through the target's adapter, settles until
   * the page is quiet, and records a step of the view's trace, which the next `expectParity`
   * compares (L9). It throws on a target that runs no client code: such a test declares
   * `requires: ["interactivity"]`.
   */
  readonly user: ViewUser;
  /**
   * The page's fake clock, for a view mounted with `{ clock: true }`: `tick(ms)` runs the
   * component's intervals due in the next `ms` milliseconds, one at a time and settled after
   * each, and records a step of the trace, `tick <ms>ms`, holding what they emitted, as an
   * action does. Throws for a view mounted without one.
   */
  readonly clock: ViewClock;
  /** The container's content as normalised HTML, the form L7 compares. */
  html(): string;
  /** Waits for the framework to flush, the fonts and two frames. */
  settle(): Promise<void>;
  /**
   * Renders the component again with new props, as a parent that re-renders it would, and
   * waits until it has settled, as `mount` does. The props are replaced whole: a prop `props`
   * lacks takes its default again (plan §7.2, L8). It records a step of the trace, as an action
   * does.
   */
  rerender(props: P): Promise<void>;
  /**
   * The arguments of each emit of an event the component declares (`emitted("change")` →
   * `[[5]]`), in order, as plain data, with generated ids renamed as `html()` renames them.
   * Throws for an event the component does not declare, and on a target that runs no client
   * code.
   */
  emitted(name: string): unknown[][];
  /** Every emit, in order, as `[name, ...args]`; as {@link View.emitted}. */
  events(): unknown[][];
  /**
   * Verifies L7, L9, L10 and L11 for a scenario against the case's shared expectations: L9 the
   * steps since the mount or the previous `expectParity`.
   */
  expectParity(name: string, options?: ParityOptions): Promise<void>;
  /**
   * Runs a `view.user` step that makes the component throw, and verifies L14: the first `Error`'s
   * top frame in the case maps to the one line of the case's source that holds `throw` (ADR-0078).
   * What the step logs is excused from L13, and it records no step of the trace, since what a
   * framework leaves behind after a throw is no contract.
   */
  expectThrown(step: () => Promise<void>): Promise<void>;
  unmount(): Promise<void>;
}

/** How a view runs, beside the props it mounts with. */
export interface ViewOptions {
  /**
   * Fakes the page's `setInterval` and `clearInterval` before the component mounts, so its
   * intervals fire only when the spec advances `view.clock`, each tick inside a step (ADR-0050).
   * Only one view of a test may have it; the setup gives the page its real timers back when the
   * test ends.
   */
  clock?: boolean;
}

/** How a test mounts a component whose props have a type: with props of that type. */
export interface ComponentMountOptions<P> extends ViewOptions {
  props?: P;
}

/**
 * What a function component cannot be: the untyped overloads take the test stubs' plain
 * objects only, so a component's props are never checked against `MountOptions` instead of
 * its own type.
 */
export type NotAFunction<C> = C extends (...args: never[]) => unknown ? never : C;

/** The rounds of settling after an action before the page counts as never quiet. */
const SETTLE_ROUNDS = 10;

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
  options?: MountOptions & ViewOptions,
): Promise<View>;
export function mount(
  component: unknown,
  options: MountOptions & ViewOptions = {},
): Promise<View<never>> {
  return mountWith(component, options.props, options);
}

/**
 * Mounts a component with the props of one of the case's SSR scenarios, `case.json`'s
 * `ssr[name].props`, so the browser scenario and its server twin render the same props. The
 * test then checks it with `expectParity(name)` under the same name.
 */
export function mountScenario<P>(
  component: (props: P) => unknown,
  name: string,
  options?: ViewOptions,
): Promise<View<P>>;
/** Mounts what is not a function component, such as a test stub, with a scenario's props. */
export function mountScenario<C extends object>(
  component: NotAFunction<C>,
  name: string,
  options?: ViewOptions,
): Promise<View>;
export async function mountScenario(
  component: unknown,
  name: string,
  options: ViewOptions = {},
): Promise<View<never>> {
  const caseId = currentCase("mountScenario");
  const harness = inject("ufHarness");
  const scenarios = harness.cases[caseId]?.ssr ?? {};
  if (!Object.hasOwn(scenarios, name)) {
    const declared = Object.keys(scenarios);
    throw new Error(
      `mountScenario(…, "${name}"): ${caseId}'s case.json declares no SSR scenario "${name}" (${declared.length ? `it declares ${declared.join(", ")}` : "it declares none"}). Declare it under "ssr" with its props, or mount a browser-only scenario with mount(component, { props }).`,
    );
  }
  // A copy: the provided context is shared by every test of the file.
  const props = scenarios[name]?.props;
  return mountWith(
    component,
    props === undefined ? undefined : structuredClone(props),
    options,
    name,
  );
}

/** The current test's case. */
function currentCase(caller: string): string {
  const test = TestRunner.getCurrentTest<RunnerTestCase | undefined>();
  if (!test) throw new Error(`${caller} must be called inside a test.`);
  return caseOfFile(test.file.filepath, inject("ufHarness"));
}

/**
 * The events a component declares: from the stub target's registration, or from the project's
 * compile of the case's module (the `ufComponentEvents` command), never from a guess.
 */
async function declaredEvents(
  registration: TargetOptions,
  component: unknown,
): Promise<readonly MountEvent[]> {
  if (registration.events) return registration.events(component);
  const { events } = await commands.ufComponentEvents({ case: currentCase("mount") });
  return events;
}

/**
 * Mounts with the project's adapter: a client render, or in a hydrate project (L12, ADR-0095) the
 * server's HTML of the case's main component, hydrated; `scenario` is the SSR scenario whose
 * props `mountScenario` mounts with.
 */
async function mountWith(
  component: unknown,
  props: unknown,
  { clock = false }: ViewOptions,
  scenario?: string,
): Promise<View<never>> {
  const registration = registeredAdapter();
  const { target, mount: adapter } = registration;
  const hydrating = isHydrateProject();
  if (hydrating && !registration.hydrate) {
    throw new Error(
      `mount: this hydrate project has no hydrate adapter for ${target}: a target without one declares its hydration capability unsupported, which skips every test here.`,
    );
  }
  const initial = checkProps("mount", props);
  await installDeterminism();
  const declared = await declaredEvents(registration, component);

  // What the component emits, copied as it arrives; a payload no trace can hold fails the
  // test at its next settle, naming the event.
  const log: EmittedEvent[] = [];
  const refused: string[] = [];
  const on = Object.fromEntries(
    declared.map(({ name }) => [
      name,
      (...args: unknown[]) => {
        try {
          log.push({ name, args: copyPayload(name, args) });
        } catch (error) {
          refused.push(formatError(error));
        }
      },
    ]),
  );

  // Before the component mounts, so the `setInterval` it calls is the clock's.
  if (clock) installClock();
  const container = document.createElement("div");
  const testId = `uf-root-${(roots += 1)}`;
  container.setAttribute(ROOT_ATTRIBUTE, "");
  container.setAttribute("data-testid", testId);
  document.body.append(container);

  let instance: MountedComponent;
  let hydrated: Hydrated | undefined;
  const mountOptions = { ...(initial ? { props: initial } : {}), on, events: declared };
  try {
    if (hydrating) {
      hydrated = await hydrateInto(
        registration.hydrate!,
        currentCase("mount"),
        component,
        container,
        mountOptions,
      );
      instance = hydrated.instance;
    } else {
      instance = await adapter(component, container, mountOptions);
    }
  } catch (error) {
    container.remove();
    throw error;
  }
  report(instance);

  const locator = page.getByTestId(testId);
  // The engine too: Firefox serialises some prefixed properties under its own alias (ADR-0081).
  // Outside the harness (this package's own tests) nothing provides it.
  const engine = (inject("ufHarness") as HarnessContext | undefined)?.browser;
  const normalizeOptions = {
    ...(isNormalizeTarget(target) ? { target } : {}),
    ...(engine ? { engine } : {}),
    // The server's markup of each control's first state, which hydration keeps (rule 4f).
    ...(hydrating ? { hydrated: true } : {}),
  };
  // A target the normaliser does not know (a test stub) has no framework noise to remove.
  const dom = () => normalizeDomWithIds(container, normalizeOptions);
  const html = () => dom().html;
  const aria = async () => {
    // Angular's hosts are inline for the snapshot alone, so they add no space (ADR-0060).
    const restore = inlineHosts(container, isNormalizeTarget(target) ? target : undefined);
    try {
      return await commands.ufAriaSnapshot(locator.serialize());
    } finally {
      restore();
    }
  };
  /** Fails with what the page or the payloads refused since the last settle. */
  const raise = () => {
    const problems = [...takePreventedNavigations(), ...refused.splice(0)];
    if (problems.length) throw new Error(problems.join("\n"));
  };
  /** L12's `mismatch`: what the framework reported since the last settle, in a hydrate project. */
  const takeMismatches = () => {
    for (const message of hydrated?.instance.takeMismatches() ?? []) {
      failHydration(target, "mismatch", message);
    }
  };
  const settle = async () => {
    await settleFrame(() => instance.settle());
    takeMismatches();
    raise();
  };
  /**
   * Settles until the DOM and the emitted events stop changing: two rounds in a row read the
   * same. A handler's work after an `await`, an effect a write scheduled, a lazily loaded
   * handler: each lands in some round, and every target's step records all of it. Once the
   * view is unmounted, a round waits for the page alone: the adapter has nothing left to settle.
   */
  const settleUntilQuiet = async (settleOnce: () => Promise<void> = settle): Promise<boolean> => {
    let previous: string | undefined;
    for (let round = 0; round < SETTLE_ROUNDS; round += 1) {
      await settleOnce();
      const snapshot = `${html()}\n${log.length}`;
      if (snapshot === previous) return true;
      previous = snapshot;
    }
    return false;
  };
  const trace = new Trace({
    root: testId,
    dom,
    aria,
    events: log,
  });
  /** Settles after a step and records it; a page that never quiets fails L9, which it feeds. */
  const step = async (action: string) => {
    if (!(await settleUntilQuiet())) failTrace(target, `did not settle after ${action}`);
    await trace.record(action);
  };
  let unmounted = false;
  /**
   * Runs an action as a step of the view: each input through the adapter and settled before the
   * next is taken (as the time between a person's two inputs lets a framework render), then the
   * step is recorded.
   */
  const perform = async (action: string, inputs: Iterable<Input>) => {
    if (unmounted) throw new Error(`${action}: the view is unmounted.`);
    const pending = inputs[Symbol.iterator]();
    for (let next = pending.next(); !next.done;) {
      const input = next.value;
      await (instance.interact ? instance.interact(input) : input());
      next = pending.next();
      if (!next.done && !(await settleUntilQuiet())) {
        failTrace(target, `did not settle after an input of ${action}`);
      }
    }
    await step(action);
  };
  const declaredNames = declared.map(({ name }) => name);
  const emittedArgs = (what: string): EmittedEvent[] => {
    assertInteractive(what);
    raise();
    const { ids } = dom();
    return log.map((event) => ({ ...event, args: renumberIds(event.args, ids) as unknown[] }));
  };

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
    user: createUser({ testId, perform }),
    clock: {
      async tick(ms) {
        assertInteractive("view.clock.tick");
        if (!clock) {
          throw new Error(
            "view.clock.tick: this view was mounted without a clock. Mount it with { clock: true }, which fakes setInterval before the component starts its intervals.",
          );
        }
        checkTick(ms);
        const action = `tick ${ms}ms`;
        if (!unmounted) {
          // Each interval through the adapter, and settled before the next is due, as the time
          // between them lets a framework that renders in a task of its own render; one step.
          await advanceClock(ms, async (fire) => {
            await (instance.interact ? instance.interact(fire) : fire());
            if (!(await settleUntilQuiet())) {
              failTrace(target, `did not settle after an interval that ${action} ran`);
            }
          });
          await step(action);
          return;
        }
        // Once unmounted, the page alone settles after each interval.
        const settlePage = async () => {
          await settleFrame();
          raise();
        };
        await advanceClock(ms, async (fire) => {
          await fire();
          if (!(await settleUntilQuiet(settlePage))) {
            throw new Error(
              `view.clock.tick: the page did not settle after an interval of ${action} once the view was unmounted: its emitted events still changed after ${SETTLE_ROUNDS} rounds.`,
            );
          }
        });
      },
    },
    html,
    settle,
    async rerender(next) {
      if (unmounted) throw new Error("rerender: the view is unmounted.");
      const props = checkProps("rerender", next) ?? {};
      report(await instance.rerender(props));
      await step(`rerender ${JSON.stringify(props)}`);
    },
    emitted(name) {
      if (!declaredNames.includes(name)) {
        throw new Error(
          `view.emitted("${name}"): the component declares no event "${name}" (${declaredNames.length ? `it declares ${declaredNames.join(", ")}` : "it declares none"}).`,
        );
      }
      return emittedArgs("view.emitted")
        .filter((event) => event.name === name)
        .map((event) => event.args);
    },
    events: () => emittedArgs("view.events").map((event) => [event.name, ...event.args]),
    expectParity: (name, parityOptions) =>
      expectParity({ ...view, trace, dom, aria }, name, parityOptions),
    expectThrown: (action) =>
      expectThrown(
        {
          settle: () => settleFrame(() => instance.settle()),
          stepMark: () => trace.length,
          forgetSteps: (mark) => trace.forget(mark),
        },
        action,
      ),
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
  if (!(await settleUntilQuiet())) {
    throw new Error(
      `mount: the component did not settle: its DOM or its events still changed after ${SETTLE_ROUNDS} rounds. A component that keeps changing on its own (a timer) starts from an action, after the first expectParity (ADR-0050).`,
    );
  }
  if (hydrated) {
    await checkHydrated({
      target,
      caseId: currentCase("mount"),
      scenario,
      container,
      serverHtml: hydrated.html,
      html: html(),
      client: () =>
        clientRender(
          adapter,
          component,
          initial,
          declared,
          (root) => normalizeDomWithIds(root, normalizeOptions).html,
        ),
    });
  }
  return view;
}

/** What the sub-checks right after a hydration read. */
interface HydratedState {
  target: string;
  caseId: string;
  /** The SSR scenario `mountScenario` mounted, whose expected DOM the `DOM` sub-check reads. */
  scenario: string | undefined;
  container: HTMLElement;
  /** The server HTML the page hydrated. */
  serverHtml: string;
  /** The hydrated root, normalised as L7 normalises it. */
  html: string;
  /** The same target's client render of the props, normalised the same way. */
  client(): Promise<string>;
}

/**
 * L12's sub-checks right after hydration has settled, before any step (ADR-0095): the raw ids
 * are the server's (`ids`), the root is the scenario's expected DOM (`DOM`, for `mountScenario`,
 * where a spec checks that scenario) and the target's own client render (`client agreement`).
 * Each records its failure as L12, and the test goes on, as `expectParity` does.
 */
async function checkHydrated(state: HydratedState): Promise<void> {
  const { target } = state;
  const ids = compareIds(idsOfHtml(state.serverHtml), idsOf(state.container));
  if (ids) failHydration(target, "ids", ids);
  if (state.scenario !== undefined) {
    const dom = await commands.ufArtefact({
      case: state.caseId,
      file: `dom.${state.scenario}.html`,
      contents: `${state.html.replace(/\n+$/, "")}\n`,
      optional: true,
    });
    if (!dom.pass) failHydration(target, "DOM", dom.message);
  }
  try {
    const agreement = compareClientRender(state.html, await state.client());
    if (agreement) failHydration(target, "client agreement", agreement);
  } catch (error) {
    failHydration(target, "client agreement", formatError(error));
  }
}

/** Records an L9 failure on the current test: a step that never settled cannot be compared. */
function failTrace(target: string, message: string): void {
  const test = TestRunner.getCurrentTest<RunnerTestCase | undefined>();
  if (!test) throw new Error(message);
  const harness = inject("ufHarness");
  recordLayer(
    test,
    { case: caseOfFile(test.file.filepath, harness), target, quarantine: harness.quarantine },
    "L9",
    {
      status: "fail",
      message: `${message}: the DOM or the emitted events still changed after ${SETTLE_ROUNDS} rounds of settling.`,
    },
  );
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
