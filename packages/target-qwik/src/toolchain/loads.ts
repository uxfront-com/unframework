// Qwik's lazy code in the browser tests (ADR-0050). A QRL loads its segment with a dynamic
// import the optimizer writes (`qrlDEV(() => import("./X.tsx_s.js"), …)`): a handler, a task or
// a local function runs once its QRL has resolved, and a QRL resolves on its first run.
//
// Qwik's preloader (`@qwik.dev/core/preloader`, 2.0 beta) only fetches the bundles of the page's
// QRLs: a QRL still resolves through its import on its first run, which the browser answers in a
// later task, in an order the page does not decide. Once resolved, a QRL runs inside the event's
// dispatch, so Qwik runs the listeners whose code has run once in the DOM's order. The browser
// projects check that state: before a test acts, the adapter imports every segment the
// component's QRLs reference and resolves the QRLs (`preload`), as an app's listeners are once
// each has run.
//
// So they never see a first run, which ADR-0050 declares outside the contract instead: until its
// code has loaded, a listener runs after the event's dispatch, so it reads the DOM after the
// event's default action (a Backspace has emptied the field), the data an event carries only
// while it is dispatched is gone (`clipboardData`, `dataTransfer`), its controls do nothing, and
// the listeners of one input run in the order their code arrives. Of these the controls are
// reported: a `preventDefault()`, `stopPropagation()` or `stopImmediatePropagation()` that a `$`
// function's body calls on its event while the event is dispatched is logged on the console
// (L13), as in an app it would come too late on the listener's first run. Qwik runs controls at
// dispatch (`sync$`, `preventdefault:click`).
//
// This module is both sides: a Vite plugin that passes every QRL a module creates, and its
// segment's import, through a registry on `globalThis`, and the registry. It instruments the
// browser test build only; the output under test is unchanged, and the registry never orders an
// import: each one is handed over as the browser answers it.
import type { Plugin } from "vite";

/** The registry's hook for a QRL's lazy import of its segment. */
export const TRACKER = "__ufQwikSegment";

/** The registry's hook for a QRL a module creates. */
export const QRLS = "__ufQwikQrl";

/**
 * The lazy import of a QRL, as the optimizer writes it in development (`qrlDEV`) and in a
 * build (`qrl`): `qrlDEV(() => import("./X.js")`. Only a QRL's: a module's other lazy imports
 * are no segment of the component.
 */
const QRL_IMPORT = /\b(qrlDEV|qrl)\(\s*\(\)\s*=>\s*import\(\s*("[^"\n]+"|'[^'\n]+')\s*\)/g;

/** A module's import of the QRL factories from Qwik's core: `import { qrlDEV } from "…";`. */
const CORE_IMPORT =
  /^import\s*\{([^}]*)\}\s*from\s*("[^"\n]*@qwik\.dev\/core(?:\/dist\/[^"\n]*)?"|'[^'\n]*@qwik\.dev\/core(?:\/dist\/[^'\n]*)?');?[ \t]*$/gm;

/**
 * Passes every QRL a module creates through the registry, and the import of its segment:
 * `qrlDEV(() => import("./X.js")` becomes
 * `qrlDEV((globalThis.__ufQwikSegment ?? ((load) => load))(() => import("./X.js"))`, and the
 * `qrlDEV` (or `qrl`) the module imports from Qwik's core is wrapped, so each QRL it creates is
 * handed to `globalThis.__ufQwikQrl`. Without a registry both pass everything through.
 */
export function segmentLoads(): Plugin {
  return {
    name: "uf-qwik-segment-loads",
    // After the optimizer, which writes the imports and the QRLs.
    enforce: "post",
    transform(code) {
      if (!code.includes("import(")) return null;
      const imports = code.replace(
        QRL_IMPORT,
        (_, call: string, specifier: string) =>
          `${call}((globalThis.${TRACKER} ?? ((load) => load))(() => import(${specifier}))`,
      );
      if (imports === code) return null;
      const instrumented = imports.replace(CORE_IMPORT, (statement, list: string, from: string) => {
        const names = list
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean);
        const factories: string[] = names.filter((name) => name === "qrlDEV" || name === "qrl");
        if (!factories.length) return statement;
        const renamed = names.map((name) =>
          factories.includes(name) ? `${name} as __uf_${name}` : name,
        );
        const wrappers = factories.map(
          (name) =>
            `const ${name} = (...args) => (globalThis.${QRLS} ?? ((qrl) => qrl))(__uf_${name}(...args));`,
        );
        return [`import { ${renamed.join(", ")} } from ${from};`, ...wrappers].join("\n");
      });
      return { code: instrumented, map: null };
    },
  };
}

/** A QRL's lazy import of its segment. */
type SegmentLoad = () => Promise<unknown>;

/** What the registry reads of a QRL: Qwik's `resolve()`, which loads and binds its value. */
interface Resolvable {
  resolve(): Promise<unknown>;
}

/** The event controls a `$` function's body may not rely on: on a first run they come late. */
const CONTROLS = ["preventDefault", "stopPropagation", "stopImmediatePropagation"] as const;

/** The events the `$` bodies running now were called with, innermost last. */
const running: Event[] = [];

/** Whether the page's event controls report a call from a running `$` body. */
let reporting = false;

/**
 * Reports each control a `$` body calls on its own event while the event is dispatched, then
 * runs it, once per page. An event the body dispatches itself (`element.click()`) is another
 * event, and a `sync$` handler or a `preventdefault:` attribute runs no `$` body.
 */
function reportControls(): void {
  if (reporting) return;
  reporting = true;
  for (const control of CONTROLS) {
    const original = Event.prototype[control];
    Event.prototype[control] = function (this: Event): void {
      if (running.includes(this) && this.eventPhase !== Event.NONE) {
        console.error(
          `[uf qwik] A \`$\` function's body calls ${control}() on a \`${this.type}\` event while it is dispatched. On its first run a QRL resolves after the dispatch, so in an app the call comes too late there: run the control at dispatch (\`sync$\`, \`preventdefault:${this.type}\`).`,
        );
      }
      original.call(this);
    };
  }
}

/** The segments and QRLs the page's modules create, and the imports in flight. */
export class SegmentLoads {
  /** Every segment a QRL of the page references, in the order the QRLs were created. */
  readonly #segments: SegmentLoad[] = [];
  /** Every QRL the page's modules created. */
  readonly #qrls: Resolvable[] = [];
  /** How many of `#segments` and `#qrls` the last preload loaded and resolved. */
  #preloaded = { segments: 0, qrls: 0 };
  readonly #pending = new Set<Promise<unknown>>();
  /** Each segment module as its QRLs see it: its functions wrapped (`#bodies`). */
  readonly #modules = new WeakMap<object, Record<string, unknown>>();

  /**
   * Installs the registry: each QRL registers itself as it is created, and its segment, whose
   * import it gets back as a load that reports each import it starts and hands the module over
   * as the browser answers, with each function the module exports marked as a `$` body. Then a
   * control a `$` body calls while its event is dispatched is reported on the console.
   */
  install(): void {
    const registry = globalThis as Record<string, unknown>;
    registry[TRACKER] = (load: SegmentLoad): SegmentLoad => {
      this.#segments.push(load);
      return () => this.#track(load()).then((module) => this.#bodies(module));
    };
    registry[QRLS] = (qrl: unknown): unknown => {
      if (isResolvable(qrl)) this.#qrls.push(qrl);
      return qrl;
    };
    reportControls();
  }

  #track(load: Promise<unknown>): Promise<unknown> {
    this.#pending.add(load);
    const done = () => void this.#pending.delete(load);
    load.then(done, done);
    return load;
  }

  /** A segment module whose exported functions count as running `$` bodies while they run. */
  #bodies(module: unknown): unknown {
    if (typeof module !== "object" || module === null) return module;
    const known = this.#modules.get(module);
    if (known) return known;
    const wrapped: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const [name, value] of Object.entries(module)) {
      wrapped[name] = typeof value === "function" ? this.#body(value) : value;
    }
    this.#modules.set(module, wrapped);
    return wrapped;
  }

  #body(fn: (...args: unknown[]) => unknown): (...args: unknown[]) => unknown {
    return function (this: unknown, ...args: unknown[]): unknown {
      // The event a handler, or a local function a handler passed it to, was called with.
      const event = args.find((arg): arg is Event => arg instanceof Event);
      if (event) running.push(event);
      try {
        return fn.apply(this, args);
      } finally {
        if (event) running.splice(running.lastIndexOf(event), 1);
      }
    };
  }

  /**
   * Loads what the page's listeners have loaded once each has run: imports every segment the
   * page's QRLs reference and resolves every QRL, then those the segments just loaded create,
   * until none is left. A segment that fails to load rejects it.
   */
  async preload(): Promise<void> {
    while (
      this.#preloaded.segments < this.#segments.length ||
      this.#preloaded.qrls < this.#qrls.length
    ) {
      const segments = this.#segments.slice(this.#preloaded.segments);
      const qrls = this.#qrls.slice(this.#preloaded.qrls);
      this.#preloaded = { segments: this.#segments.length, qrls: this.#qrls.length };
      await Promise.all(segments.map((load) => load()));
      await Promise.all(qrls.map((qrl) => qrl.resolve()));
    }
  }

  /** Whether a QRL's import is in flight. */
  get loading(): boolean {
    return this.#pending.size > 0;
  }

  /**
   * Resolves once no QRL's import is in flight and a task has passed since the last answered,
   * by which time what waited for it (the QRL's resolution, the handler it runs) has started.
   */
  async idle(): Promise<void> {
    do {
      await Promise.allSettled(this.#pending);
      await nextTask();
    } while (this.#pending.size > 0);
  }
}

function isResolvable(value: unknown): value is Resolvable {
  return (
    (typeof value === "function" || (typeof value === "object" && value !== null)) &&
    typeof (value as { resolve?: unknown }).resolve === "function"
  );
}

/** Resolves after the next task. */
export function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
