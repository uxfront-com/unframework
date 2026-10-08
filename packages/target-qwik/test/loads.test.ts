// The browser build's QRL registry (src/toolchain/loads.ts, ADR-0050): what the plugin
// instruments, how the adapter loads a component's segments and resolves its QRLs before a test
// acts, and that the registry hands each import over as it arrives, never in an order of its own.
// test/loads.browser.test.ts runs it on Qwik's own QRLs in Chromium.
import { fileURLToPath } from "node:url";

import { resolveConfig } from "vite";
import type { Plugin } from "vite";
import { afterEach, describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { QRLS, segmentLoads, SegmentLoads, TRACKER } from "../src/toolchain/loads.ts";

/** The plugin's transform of a module's code; `null` when it leaves the code alone. */
function transform(code: string): string | null {
  const hook = segmentLoads().transform as (code: string) => { code: string } | null;
  return hook(code)?.code ?? null;
}

/** What an instrumented QRL calls: the registry's hook, as `globalThis` holds it. */
function register(load: () => Promise<unknown>): () => Promise<unknown> {
  const hook = (globalThis as Record<string, unknown>)[TRACKER] as
    | ((load: () => Promise<unknown>) => () => Promise<unknown>)
    | undefined;
  if (!hook) throw new Error("No registry is installed.");
  return hook(load);
}

/** A promise and the functions that settle it. */
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** What an instrumented module does with each QRL it creates: hands it to the registry. */
function created<T>(qrl: T): T {
  const hook = (globalThis as Record<string, unknown>)[QRLS] as ((qrl: T) => T) | undefined;
  if (!hook) throw new Error("No registry is installed.");
  return hook(qrl);
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, TRACKER);
  Reflect.deleteProperty(globalThis, QRLS);
});

describe("the segment plugin", () => {
  it("passes the import of every QRL through the registry, in development and in a build", () => {
    const code = [
      'const q_a = qrlDEV(() => import("./A.tsx_a.js"), "a", { file: "A.tsx" });',
      "const q_b = qrl(() => import('./A.tsx_b.js'), \"b\");",
    ].join("\n");
    expect(transform(code)).toBe(
      [
        `const q_a = qrlDEV((globalThis.${TRACKER} ?? ((load) => load))(() => import("./A.tsx_a.js")), "a", { file: "A.tsx" });`,
        `const q_b = qrl((globalThis.${TRACKER} ?? ((load) => load))(() => import('./A.tsx_b.js')), "b");`,
      ].join("\n"),
    );
  });

  it("wraps the QRL factory a module imports from Qwik's core, so each QRL it creates registers", () => {
    const code = [
      'import { componentQrl } from "@qwik.dev/core";',
      'import { qrlDEV } from "/@fs/x/node_modules/@qwik.dev/core/dist/core.mjs?v=1";',
      'import { isServer } from "@qwik.dev/core/build";',
      'const q_a = qrlDEV(() => import("./A.tsx_a.js"), "a");',
    ].join("\n");
    expect(transform(code)).toBe(
      [
        'import { componentQrl } from "@qwik.dev/core";',
        'import { qrlDEV as __uf_qrlDEV } from "/@fs/x/node_modules/@qwik.dev/core/dist/core.mjs?v=1";',
        `const qrlDEV = (...args) => (globalThis.${QRLS} ?? ((qrl) => qrl))(__uf_qrlDEV(...args));`,
        'import { isServer } from "@qwik.dev/core/build";',
        `const q_a = qrlDEV((globalThis.${TRACKER} ?? ((load) => load))(() => import("./A.tsx_a.js")), "a");`,
      ].join("\n"),
    );
  });

  it("leaves a module's other lazy imports alone: they are no segment of the component", () => {
    expect(transform('const load = () => import("./chunk.js");')).toBeNull();
    expect(transform("export const x = 1;")).toBeNull();
  });

  it("runs after Qwik's optimizer, which writes the imports", () => {
    expect(segmentLoads().enforce).toBe("post");
  });
});

describe("the segment registry", () => {
  it("preloads every segment the QRLs reference, and those their segments' QRLs reference", async () => {
    const loads = new SegmentLoads();
    loads.install();
    const imported: string[] = [];
    // The component's module creates the component's QRL; its segment, once evaluated, creates
    // a handler's and a local function's, whose segments create none.
    register(async () => {
      imported.push("component");
      register(async () => void imported.push("handler"));
      register(async () => {
        imported.push("helper");
        register(async () => void imported.push("nested"));
      });
    });
    await loads.preload();
    expect(imported).toEqual(["component", "handler", "helper", "nested"]);
    // Nothing is left to load: a second preload imports nothing again.
    await loads.preload();
    expect(imported).toHaveLength(4);
    expect(loads.loading).toBe(false);
  });

  it("resolves every QRL the page created, and those the segments it loads create", async () => {
    const loads = new SegmentLoads();
    loads.install();
    const resolved: string[] = [];
    /** A QRL as Qwik's `resolve()` sees it: loading its segment may create more QRLs. */
    const qrl = (name: string, then?: () => void) => ({
      resolve: async () => {
        resolved.push(name);
        then?.();
      },
    });
    created(qrl("component", () => created(qrl("handler"))));
    created(qrl("task"));
    await loads.preload();
    expect(resolved).toEqual(["component", "task", "handler"]);
    // A value that is no QRL passes through, unregistered.
    expect(created("text")).toBe("text");
    await loads.preload();
    expect(resolved).toHaveLength(3);
  });

  it("hands a QRL its segment's functions marked as `$` bodies, which return what they return", async () => {
    const loads = new SegmentLoads();
    loads.install();
    const segment = { Handler_abc: (value: number) => value * 2, lo: 1 };
    const module = (await register(async () => segment)()) as typeof segment;
    expect(module.Handler_abc(21)).toBe(42);
    expect(module.lo).toBe(1);
    // One wrapper per module, as Qwik's QRLs of one segment share its exports.
    expect(await register(async () => segment)()).toBe(module);
  });

  it("rejects the preload with a segment that fails to load", async () => {
    const loads = new SegmentLoads();
    loads.install();
    register(() => Promise.reject(new Error("[vite] Failed to load ./A.tsx_a.js")));
    await expect(loads.preload()).rejects.toThrow("Failed to load ./A.tsx_a.js");
  });

  it("hands each load over as it arrives, not in the order it was asked for", async () => {
    const loads = new SegmentLoads();
    loads.install();
    const first = deferred<string>();
    const second = deferred<string>();
    const loadFirst = register(() => first.promise.then((name) => ({ name })));
    const loadSecond = register(() => second.promise.then((name) => ({ name })));
    const arrived: string[] = [];
    // The QRLs of two events of one action, asked for in dispatch order.
    const handlers = [
      loadFirst().then((module) => void arrived.push((module as { name: string }).name)),
      loadSecond().then((module) => void arrived.push((module as { name: string }).name)),
    ];
    expect(loads.loading).toBe(true);
    // The browser answers the second first (its module has no static import): its handler runs
    // first, as in a preloaded app. A registry that waited for the first would hide that.
    second.resolve("second");
    await handlers[1];
    expect(arrived).toEqual(["second"]);
    first.resolve("first");
    await Promise.all(handlers);
    expect(arrived).toEqual(["second", "first"]);
    await loads.idle();
    expect(loads.loading).toBe(false);
  });

  it("waits in idle until every load in flight, failed ones too, has settled", async () => {
    const loads = new SegmentLoads();
    loads.install();
    const pending = deferred();
    const failing = register(() => Promise.reject(new Error("offline")));
    const loading = register(() => pending.promise);
    await expect(failing()).rejects.toThrow("offline");
    void loading();
    let idle = false;
    const waiting = loads.idle().then(() => (idle = true));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(idle).toBe(false);
    pending.resolve(undefined);
    await waiting;
    expect(loads.loading).toBe(false);
  });
});

describe("Qwik's error reports in the test builds", () => {
  // Qwik's plugin defines `qTest` as true under Vitest, and Qwik then neither logs nor rethrows
  // a handler's error: L13 and Vitest's unhandled errors would never see one.
  it.each(["browser", "ssr"] as const)("turn `qTest` off in %s projects", async (mode) => {
    const root = fileURLToPath(new URL("fixtures", import.meta.url));
    const fragment = await toolchain.vite(mode, { toolchainDir: "/unused", root });
    // Qwik's plugin also assigns its flags to this process's globals, for a server render here.
    const flags = ["qDev", "qTest", "qInspector"].map(
      (name) => [name, Reflect.get(globalThis, name) as unknown] as const,
    );
    const config = await resolveConfig(
      { ...fragment, root, configFile: false, logLevel: "silent" },
      "serve",
    ).finally(() => {
      for (const [name, value] of flags) Reflect.set(globalThis, name, value);
    });
    expect(config.define?.["globalThis.qTest"]).toBe(false);
    const names = config.plugins.map((plugin: Plugin) => plugin.name);
    expect(names.indexOf("uf-qwik-report-errors")).toBeGreaterThan(
      names.indexOf("vite-plugin-qwik"),
    );
  });
});
