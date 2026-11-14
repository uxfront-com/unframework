// The Qwik hydrate adapter (browser, L12, ADR-0095): Qwik resumes, so no hydrate call runs. The
// server's whole container goes in the page with its state, vnode data and event registrations,
// and the qwikloader runs each handler from the attributes it finds, loading its code on demand.
// oxlint-disable-next-line import/no-unassigned-import -- the loader is a script run for its side effect
import "@qwik.dev/core/qwikloader.js";
import type { Signal } from "@qwik.dev/core";
// Qwik 2 has no public way to reach a resumed container's state or to wait for its render.
import { _getDomContainer, _waitUntilRendered } from "@qwik.dev/core/internal";
import type { HydrateAdapter, MountListener } from "@unframework.dev/codegen";

import { loads } from "./client.ts";
import { RESUMED_LISTENERS } from "./listener.qwik.ts";
import { nextTask } from "./loads.ts";
import type { ResumeState } from "./resume-host.qwik.ts";

/** The attribute of an event handler the loader runs: `q-e:click`, `q-d:qinit`, `q-w:resize`. */
const HANDLER_ATTRIBUTE = /^q-(?:e|ep|d|dp|w|wp):/;

/**
 * Resumes `html` (from `renderForHydration`): the container, inserted so that its scripts run,
 * then nothing else until an event comes. The adapter reaches the host the server rendered around
 * the component (./resume-host.qwik.ts) through the resumed container's state, and a rerender
 * sets its props, as the mount adapter's does, and an unmount unmounts the component through it,
 * so its cleanups run. The test's listeners are registered where the server's listener QRLs call
 * them (./listener.qwik.ts). Qwik reports what fails to load or throws in a handler as a `qerror`
 * event on the document, which the adapter takes as a mismatch. Resumption runs no render, so a
 * client render that differs from the server's shows only in the `client agreement` sub-check.
 *
 * Before the first input, and after each render, the adapter imports every chunk the container's
 * handler attributes name: the loader keeps a handler once its chunk has loaded, and then runs it
 * inside the event's dispatch, as an app does once each handler has run (ADR-0050).
 */
export const hydrate: HydrateAdapter = async (_component, container, html, options) => {
  const mismatches: string[] = [];
  const onError = (event: Event) => mismatches.push(describeError(event));
  document.addEventListener("qerror", onError);
  container.append(document.createRange().createContextualFragment(html));
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement) || !root.hasAttribute("q:container")) {
    throw new Error(`Qwik hydrate: the server rendered no container:\n${html}`);
  }
  // The loader is on the page already: it reads the new container when the document says so.
  document.dispatchEvent(new Event("readystatechange"));
  const qwik = _getDomContainer(root);
  await processed(qwik);
  const state = hostState(root, qwik);
  const view = state.value.key;
  const registry = ((globalThis as Record<string, unknown>)[RESUMED_LISTENERS] ??= {}) as Record<
    string,
    Readonly<Record<string, MountListener>> | undefined
  >;
  registry[view] = { ...options.on };
  const listenerNames = new Set(
    Object.keys(options.on ?? {}).map(
      (name) => `on${name.charAt(0).toUpperCase()}${name.slice(1)}$`,
    ),
  );
  const listeners = Object.fromEntries(
    Object.entries(state.value.props).filter(([name]) => listenerNames.has(name)),
  );
  let instances = 0;
  const settle = async () => {
    do {
      await loads.idle();
      await _waitUntilRendered(qwik);
    } while (loads.loading);
    await warmHandlers(root);
  };
  await settle();
  return {
    settle,
    async rerender(next) {
      const props = { ...next, ...listeners };
      // As the mount adapter's host: a component that had no props at all gets new ones as a new
      // instance (./client.ts).
      const none = !Object.keys(state.value.props).length;
      if (none && Object.keys(props).length) instances += 1;
      state.value = { props, key: instances ? `${view}-${instances}` : view, mounted: true };
      await settle();
    },
    async interact(action) {
      await warmHandlers(root);
      const outcome = await action();
      // The loader runs a handler whose chunk has loaded in the dispatch, and what it starts
      // loads through the segment registry: until nothing loads for two tasks.
      for (;;) {
        await loads.idle();
        await nextTask();
        await nextTask();
        await _waitUntilRendered(qwik);
        if (!loads.loading) break;
      }
      return outcome;
    },
    async unmount() {
      state.value = { ...state.value, mounted: false };
      await settle();
      document.removeEventListener("qerror", onError);
      Reflect.deleteProperty(registry, view);
      container.replaceChildren();
    },
    takeMismatches: () => mismatches.splice(0),
  };
};

/** A resumed container, as far as the adapter reads it: its objects by their root id. */
interface ResumedContainer {
  $getObjectById$(id: number): unknown;
  /** The parsed state, which the container fills once it has processed its data. */
  $rawStateData$: unknown[];
  /** Where the container is in processing its vnode and state data: 3 once done. */
  $containerDataProcessState$: number;
}

/** The tasks a container gets to process its vnode and state data before resuming fails. */
const PROCESS_TASKS = 50;

/** Qwik's `ContainerDataProcessState.ProcessingStateDone`. */
const PROCESSING_STATE_DONE = 3;

/**
 * Resolves once the container has processed its vnode and state data, which Qwik does in tasks
 * of its own after the container is first read (`isContainerReady`).
 */
async function processed(qwik: unknown): Promise<void> {
  const container = qwik as ResumedContainer;
  for (let task = 0; container.$containerDataProcessState$ !== PROCESSING_STATE_DONE; task += 1) {
    if (task === PROCESS_TASKS) {
      throw new Error(
        `Qwik hydrate: the container did not process its state in ${PROCESS_TASKS} tasks.`,
      );
    }
    await nextTask();
  }
}

/**
 * The resumed container's host signal (./resume-host.qwik.ts): among the container's serialised
 * root objects, the signal whose state is the host's, or the host's props that hold it. A resumed container keeps its component
 * tree in vnode data that no public API walks, and the signal is a root object of its state.
 */
function hostState(root: HTMLElement, qwik: unknown): Signal<ResumeState> {
  const container = qwik as ResumedContainer;
  const roots = container.$rawStateData$.length / 2;
  for (let id = 0; id < roots; id += 1) {
    const value = container.$getObjectById$(id);
    if (isHostSignal(value)) return value;
    // The host's props, `{ component, state }`, which hold the signal.
    const state =
      typeof value === "object" && value !== null ? Reflect.get(value, "state") : undefined;
    if (isHostSignal(state)) return state;
  }
  throw new Error("Qwik hydrate: the resumed container holds no resume host's state.");
}

function isHostSignal(value: unknown): value is Signal<ResumeState> {
  if (typeof value !== "object" || value === null || !("value" in value)) return false;
  const state = (value as { value: unknown }).value;
  return (
    typeof state === "object" &&
    state !== null &&
    typeof (state as Partial<ResumeState>).key === "string" &&
    (state as Partial<ResumeState>).key!.startsWith("uf-resumed-") &&
    typeof (state as Partial<ResumeState>).mounted === "boolean"
  );
}

/** Imports a module by its URL as the loader does, without Vite's `?import` (see testing's hydrate). */
const importModule = new Function("url", "return import(url);") as (
  url: string,
) => Promise<unknown>;

/** The chunks already imported. */
const warmed = new Set<string>();

/** Imports every chunk the container's handler attributes name that is not imported yet. */
async function warmHandlers(root: HTMLElement): Promise<void> {
  const base = new URL(root.getAttribute("q:base") ?? "/", document.baseURI);
  const chunks = new Set<string>();
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const { name, value } of element.attributes) {
      if (!HANDLER_ATTRIBUTE.test(name)) continue;
      for (const qrl of value.split("|")) {
        const chunk = qrl.split("#")[0];
        if (chunk) chunks.add(new URL(chunk, base).href);
      }
    }
  }
  const pending = [...chunks].filter((href) => !warmed.has(href));
  for (const href of pending) warmed.add(href);
  await Promise.all(pending.map((href) => importModule(href)));
}

function describeError(event: Event): string {
  const detail = (event as CustomEvent<{ error?: unknown; symbol?: string } | undefined>).detail;
  const error = detail?.error;
  const message = error instanceof Error ? error.message : String(error);
  return `qerror${detail?.symbol ? ` in ${detail.symbol}` : ""}: ${message}`;
}
