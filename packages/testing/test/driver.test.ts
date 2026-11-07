// The driver with no browser: a fake page stands in for Playwright's, so what happens when a page
// stops answering, or a document can't run its spec, needs no real one to go wrong. The real runs
// are the stub suite's (`./parity/`).
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { commandContext, driverCommands } from "../src/driver/commands.ts";
import type { DriverCommandContext, TargetCommand } from "../src/driver/commands.ts";
import { FRAME_SELECTOR, HOST_HTML, HOST_PATH, RUNNER_PATH } from "../src/driver/host.ts";
import { uncaughtErrors } from "../src/driver/page-errors.ts";
import { unfinishedTests } from "../src/driver/records.ts";
import type { DriverRecord } from "../src/driver/records.ts";
import { failureOf, runSpec, stallLimit } from "../src/driver/run.ts";
import type { DriverBrowser, RunSpecOptions } from "../src/driver/run.ts";
import { serveStatic } from "../src/driver/server.ts";
import { PAGE_CALL, PAGE_REPORT } from "../src/hosts/page/protocol.ts";
import type { PageEvent, PageHostConfig, PageTestRecord } from "../src/hosts/page/protocol.ts";
import { ACTION_TIMEOUT, CHROMIUM_ARGS, CONTEXT_OPTIONS } from "../src/node/browser-options.ts";
import { VIEWPORT } from "../src/node/viewport.ts";
import { fixtureHarness, casesDir, STUB_CAPABILITIES } from "./parity/project.ts";

const filepath = `${casesDir}/stub/match/match.parity.spec.ts`;
const harness = fixtureHarness({}, []);

const config: PageHostConfig = {
  provided: {
    target: "dom",
    ufHarness: harness,
    ufCapabilities: STUB_CAPABILITIES,
    ufNoOutput: {},
  },
  pollTimeout: 5_000,
  testTimeout: 60_000,
  hookTimeout: 30_000,
  requireAssertions: true,
};

/** What a fake page does once its document is told to run the spec. */
type Script = (page: {
  emit(event: PageEvent): void;
  call(name: string, ...args: unknown[]): Promise<unknown>;
  raise(event: "pageerror" | "crash", error?: Error): void;
}) => Promise<void>;

/** What a fake browser was asked. */
interface FakeUse {
  contextOptions: unknown[];
  defaultTimeout: number | undefined;
  gotos: string[];
  closed: boolean;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function fakeBrowser(script: Script, ready: unknown = "ready"): [DriverBrowser, FakeUse] {
  const used: FakeUse = {
    contextOptions: [],
    defaultTimeout: undefined,
    gotos: [],
    closed: false,
  };
  const bindings = new Map<string, (source: unknown, ...args: unknown[]) => unknown>();
  const listeners = new Map<string, (value?: unknown) => void>();
  let closing: () => void = () => undefined;
  const closed = new Promise<never>((_, reject) => {
    closing = () => reject(new Error("Target page, context or browser has been closed"));
  });
  // A document that never got as far as an evaluate leaves nothing to hear this.
  closed.catch(() => undefined);
  const frame = {
    waitForFunction: () => Promise.resolve({ jsonValue: () => Promise.resolve(ready) }),
    // As a real evaluate does, it rejects when its context closes under it.
    evaluate: () =>
      Promise.race([
        closed,
        script({
          emit: (event) => {
            bindings.get(PAGE_REPORT)!({}, event);
          },
          call: (name, ...args) => Promise.resolve(bindings.get(PAGE_CALL)!({}, name, args)),
          raise: (event, error) => listeners.get(event)?.(error),
        }),
      ]),
  };
  const page = {
    on: (event: string, listener: (value?: unknown) => void) => {
      listeners.set(event, listener);
    },
    addInitScript: () => Promise.resolve(),
    exposeBinding: (name: string, fn: (source: unknown, ...args: unknown[]) => unknown) => {
      bindings.set(name, fn);
      return Promise.resolve();
    },
    frameLocator: () => ({}),
    goto: (url: string) => {
      used.gotos.push(url);
      return Promise.resolve();
    },
    waitForSelector: () => Promise.resolve({ contentFrame: () => Promise.resolve(frame) }),
  };
  const browser = {
    newContext: (options: unknown) => {
      used.contextOptions.push(options);
      return Promise.resolve({
        setDefaultTimeout: (ms: number) => {
          used.defaultTimeout = ms;
        },
        newPage: () => Promise.resolve(page),
        close: () => {
          used.closed = true;
          closing();
          return Promise.resolve();
        },
      });
    },
  } as unknown as DriverBrowser;
  return [browser, used];
}

function options(browser: DriverBrowser, records: DriverRecord[] = []): RunSpecOptions {
  return {
    browser,
    origin: "http://uf.test",
    filepath,
    project: "parity",
    config,
    onRecord: (record) => records.push(record),
  };
}

const collected = (...names: string[]): PageEvent => ({
  kind: "collected",
  filepath,
  tests: names.map((name) => ({ name, fullName: `suite > ${name}`, timeout: 60_000 })),
});

const passed = (name: string): PageEvent => ({
  kind: "test",
  filepath,
  name,
  fullName: `suite > ${name}`,
  state: "pass",
  meta: {},
});

const fileRecord = (unhandled: PageEvent[] = []): PageEvent => ({
  kind: "file",
  filepath,
  state: "pass",
  meta: {},
  unhandled: unhandled as never,
});

describe("a page that stops answering", () => {
  it("fails its remaining tests by name, on L8, and closes its context", async () => {
    const [browser, used] = fakeBrowser(async (page) => {
      page.emit(collected("first", "second", "third"));
      page.emit(passed("first"));
      await new Promise(() => undefined);
    });
    const records: DriverRecord[] = [];
    const outcome = await runSpec({ ...options(browser, records), stallMs: 30 });
    expect(outcome.tests.map(({ name, state }) => [name, state])).toEqual([
      ["first", "pass"],
      ["second", "fail"],
      ["third", "fail"],
    ]);
    const message = `"suite > second" did not finish: the page said nothing for 30ms.`;
    expect(outcome.tests[1]?.errors).toEqual([{ name: "Error", message }]);
    expect(outcome.tests[1]?.meta.uf).toEqual({
      case: "stub/match",
      target: "dom",
      layers: { L8: { status: "fail", message } },
    });
    expect(outcome.file.state).toBe("fail");
    // Only why it stopped: not the context closing under what the page was running.
    expect(outcome.file.errors?.map(({ message }) => message)).toEqual([
      "the page said nothing for 30ms.",
    ]);
    expect(used.closed).toBe(true);
    // Each reached the reporter as it was known, the file's last.
    expect(records.map((record) => record.kind)).toEqual([
      "collected",
      "test",
      "test",
      "test",
      "file",
    ]);
    expect(failureOf(outcome)).toContain('suite > third: Error: "suite > third" did not finish');
  });

  it("tells a page that crashed from one that went quiet", async () => {
    const [browser] = fakeBrowser(async (page) => {
      page.emit(collected("first"));
      page.raise("crash");
      await new Promise(() => undefined);
    });
    const outcome = await runSpec({ ...options(browser), stallMs: 60_000 });
    expect(outcome.tests[0]?.errors?.[0]?.message).toBe(
      '"suite > first" did not finish: the page crashed.',
    );
  });

  it("fails the file by itself when it stops before it has named a test", async () => {
    const [browser] = fakeBrowser(() => new Promise(() => undefined));
    const outcome = await runSpec({ ...options(browser), stallMs: 30 });
    expect(outcome.tests).toEqual([]);
    expect(outcome.file.state).toBe("fail");
    expect(outcome.file.errors?.[0]?.message).toBe("the page said nothing for 30ms.");
  });

  it("counts a command as the page answering", async () => {
    const [browser] = fakeBrowser(async (page) => {
      page.emit(collected("first"));
      // Longer in all than the limit, with no event between them: both its call and its answer
      // count.
      for (let call = 0; call < 2; call += 1) {
        await delay(200);
        await page.call("ufSlow");
      }
      page.emit(passed("first"));
      page.emit(fileRecord());
    });
    const outcome = await runSpec({
      ...options(browser),
      stallMs: 300,
      commands: { ufSlow: () => delay(200) },
    });
    expect(outcome.file.state).toBe("pass");
  });

  it("leaves each test with a record out once, where two share a name", () => {
    const test = { name: "same", fullName: "suite > same", timeout: 1 };
    expect(unfinishedTests([test, test], [{ fullName: "suite > same" }])).toEqual([test]);
  });

  it("allows a test its own time, with its hooks' and a margin", () => {
    expect(stallLimit(config)).toBe(60_000 + 60_000 + 30_000);
    expect(stallLimit(config, [{ name: "long", fullName: "long", timeout: 200_000 }])).toBe(
      200_000 + 60_000 + 30_000,
    );
  });
});

describe("a document that can't run its spec", () => {
  it("fails the file with what it threw, with Playwright's prefix gone", async () => {
    const [browser] = fakeBrowser(() =>
      Promise.reject(new Error("frame.evaluate: Error: This build holds no spec x.")),
    );
    const outcome = await runSpec(options(browser));
    expect(outcome.file.state).toBe("fail");
    expect(outcome.file.errors?.[0]?.message).toBe("This build holds no spec x.");
  });

  it("fails the file with a runner story that shows an error", async () => {
    const [browser] = fakeBrowser(() => Promise.resolve(), "the preview exploded");
    const outcome = await runSpec(options(browser));
    expect(outcome.file.errors?.[0]?.message).toBe("The runner story shows the preview exploded.");
  });

  it("fails the file whose document stopped before its record", async () => {
    const [browser] = fakeBrowser(async (page) => {
      page.emit(collected("first"));
    });
    const outcome = await runSpec(options(browser));
    // No reason was given: the tests stay as they were, and the file's state says it didn't pass.
    expect(outcome.file.state).toBe("fail");
    expect(outcome.tests).toEqual([]);
  });
});

describe("what nothing caught", () => {
  const unhandled = (message: string): PageEvent => ({
    kind: "unhandled",
    type: "Error",
    name: "Error",
    message,
    test: "suite > first",
  });

  it("takes the listeners' reports, and what only pageerror saw, with their sources", async () => {
    const [browser] = fakeBrowser(async (page) => {
      page.raise("pageerror", new Error("uf-before-boot"));
      page.raise("pageerror", new Error("uf-both"));
      page.emit(unhandled("uf-both"));
      page.emit(fileRecord());
    });
    const outcome = await runSpec(options(browser));
    expect(outcome.file.uncaught).toMatchObject([
      { source: "page listener", message: "uf-both", test: "suite > first" },
      { source: "pageerror", message: "uf-before-boot" },
    ]);
    expect(failureOf(outcome)).toContain("uncaught (page listener): Error: uf-both");
    expect(failureOf(outcome)).toContain("uncaught (pageerror): Error: uf-before-boot");
  });

  it("leaves an event with no value to L13, however an engine words it", () => {
    expect(
      uncaughtErrors({
        listener: [],
        pageErrors: [
          { name: "", message: "undefined" },
          { name: "", message: "ResizeObserver loop completed with undelivered notifications." },
        ],
        logged: ["undefined", "ResizeObserver loop completed with undelivered notifications."],
      }),
    ).toEqual([]);
  });

  it("hears from the page what it sent to the console", async () => {
    const [browser] = fakeBrowser(async (page) => {
      page.emit({ kind: "logged-error", message: "undefined" });
      page.raise("pageerror", new Error("undefined"));
      page.emit(fileRecord());
    });
    expect((await runSpec(options(browser))).file.uncaught).toEqual([]);
  });

  it("matches WebKit's wording of a rejection's error", () => {
    expect(
      uncaughtErrors({
        listener: [{ kind: "unhandled", type: "Unhandled Rejection", message: "uf-probe" }],
        pageErrors: [{ name: "Unhandled Promise Rejection", message: "Error: uf-probe" }],
        logged: [],
      }).map(({ source }) => source),
    ).toEqual(["page listener"]);
  });

  it("fails the file's test on an uncaught error though every test passed", async () => {
    const [browser] = fakeBrowser(async (page) => {
      page.emit(collected("first"));
      page.emit(passed("first"));
      page.emit(unhandled("uf-probe"));
      page.emit(fileRecord());
    });
    const outcome = await runSpec(options(browser));
    expect(outcome.tests[0]?.state).toBe("pass");
    expect(outcome.file.state).toBe("pass");
    expect(failureOf(outcome)).toBe("uncaught (page listener): Error: uf-probe");
  });

  it("names a failed test's images, and leaves a passing test's alone", async () => {
    const artifacts = [
      {
        message: "uf-probe-visual",
        attachments: [{ name: "diff" as const, path: "/diffs/a.png", width: 1, height: 1 }],
      },
    ];
    const [browser] = fakeBrowser(async (page) => {
      page.emit({ ...(passed("quarantined") as PageTestRecord), artifacts });
      page.emit(fileRecord());
    });
    // A quarantined L10 leaves its images behind, and its test passes.
    const outcome = await runSpec(options(browser));
    expect(failureOf(outcome)).toBeUndefined();
    const [test] = outcome.tests;
    expect(failureOf({ ...outcome, tests: [{ ...test!, state: "fail" }] })).toContain(
      "diff image: /diffs/a.png",
    );
  });

  it("has nothing to say of a clean file", async () => {
    const [browser] = fakeBrowser(async (page) => {
      page.emit(collected("first"));
      page.emit(passed("first"));
      page.emit(fileRecord());
    });
    expect(failureOf(await runSpec(options(browser)))).toBeUndefined();
  });
});

describe("the browser a spec file opens", () => {
  it("opens one context of the captures' options, with the action timeout", async () => {
    const [browser, used] = fakeBrowser(async (page) => {
      page.emit(fileRecord());
    });
    await runSpec(options(browser));
    expect(used.contextOptions).toEqual([{ viewport: VIEWPORT, ...CONTEXT_OPTIONS }]);
    expect(CONTEXT_OPTIONS).toEqual({
      deviceScaleFactor: 1,
      colorScheme: "light",
      reducedMotion: "reduce",
      forcedColors: "none",
      locale: "en-US",
      timezoneId: "UTC",
    });
    expect(used.defaultTimeout).toBe(5_000);
    expect(ACTION_TIMEOUT).toBe(5_000);
  });

  it("launches Chromium without font hinting and with whole-tile raster, for the captures", () => {
    // Partial raster made a capture depend on what was repainted before it (stub/raster).
    expect(CHROMIUM_ARGS).toEqual(["--font-render-hinting=none", "--disable-partial-raster"]);
  });

  it("opens the host page alone, whose frame is the runner story at Vitest's size", async () => {
    const [browser, used] = fakeBrowser(async (page) => {
      page.emit(fileRecord());
    });
    await runSpec(options(browser));
    expect(used.gotos).toEqual([`http://uf.test${HOST_PATH}`]);
    expect(HOST_HTML).toContain(`src="${RUNNER_PATH}"`);
    expect(HOST_HTML).toContain(`width: ${VIEWPORT.width}px; height: ${VIEWPORT.height}px`);
    expect(HOST_HTML).toContain('data-vitest="true"');
    expect(FRAME_SELECTOR).toBe('[data-vitest="true"]');
  });
});

describe("the commands of a spec file's page", () => {
  const context = commandContext(
    {
      frameLocator: () => ({}),
    } as never,
    { project: "browser:astro", provided: config.provided },
  );
  const commands = (extra: Readonly<Record<string, TargetCommand>> = {}) =>
    driverCommands(context, {
      project: "browser:astro",
      provided: config.provided,
      commands: extra,
    });

  it("binds the testing API's commands and a target's own", () => {
    const names = Object.keys(
      commands({ ufAstroRender: (() => "<p>x</p>") as TargetCommand }),
    ).toSorted();
    expect(names).toEqual([
      "ufAriaSnapshot",
      "ufArtefact",
      "ufAstroRender",
      "ufClear",
      "ufColorScheme",
      "ufComponentEvents",
      "ufFill",
      "ufFocus",
      "ufInput",
      "ufResetInput",
      "ufSelectOptions",
      "ufUnhover",
      "ufVisualCapture",
    ]);
  });

  it("hands a target's command the context first, as Vitest's provider does", () => {
    const seen: unknown[] = [];
    const bound = commands({
      ufAstroRender: ((given: DriverCommandContext, request: unknown) => {
        seen.push(given, request);
      }) as TargetCommand,
    });
    (bound.ufAstroRender as (request: unknown) => void)("request");
    expect(seen).toEqual([context, "request"]);
  });

  it("refuses a target command that would replace one of the testing API's", () => {
    expect(() => commands({ ufArtefact: (() => ({ pass: true })) as TargetCommand })).toThrow(
      /driverCommands\(browser:astro\): ufArtefact would replace the testing API's own/,
    );
    expect(() => commands({ ufFill: (() => undefined) as TargetCommand })).toThrow(
      /ufFill would replace/,
    );
  });

  it("answers a component's events from what the build compiled", () => {
    const events = [{ name: "change", optional: [false] }];
    const asked: string[] = [];
    const bound = driverCommands(context, {
      project: "browser:astro",
      provided: config.provided,
      events: (file) => {
        asked.push(file);
        return events;
      },
    }) as { ufComponentEvents: (request: { case: string }) => { events: unknown } };
    // The stub cases hold no `.uf.tsx`, so a case's own file is the refusal it reaches first.
    expect(() => bound.ufComponentEvents({ case: "stub/match" })).toThrow(
      /must hold one \.uf\.tsx input/,
    );
    expect(asked).toEqual([]);
  });

  it("refuses to answer without a build", () => {
    const bound = commands() as unknown as {
      ufComponentEvents: (request: { case: string }) => unknown;
    };
    expect(() => bound.ufComponentEvents({ case: "stub/match" })).toThrow(
      /no build to read events/,
    );
  });
});

describe("a static build's server", () => {
  it("serves its files by type, its pages by path, and nothing else", async () => {
    const directory = mkdtempSync(join(tmpdir(), "uf-static-"));
    writeFileSync(join(directory, "chunk.js"), "export {};");
    writeFileSync(join(directory, "font.woff2"), "font");
    writeFileSync(join(directory, "blob.bin"), "blob");
    const server = await serveStatic(directory, { "/host.html": "<p>host</p>" });
    try {
      const get = (path: string) => fetch(`${server.origin}${path}`);
      const script = await get("/chunk.js");
      expect(script.status).toBe(200);
      expect(script.headers.get("content-type")).toBe("text/javascript");
      expect((await get("/font.woff2")).headers.get("content-type")).toBe("font/woff2");
      expect((await get("/blob.bin")).headers.get("content-type")).toBe("application/octet-stream");
      const page = await get("/host.html");
      expect(page.headers.get("content-type")).toBe("text/html");
      expect(await page.text()).toBe("<p>host</p>");
      expect((await get("/missing.js")).status).toBe(404);
      // Above the directory, a path stays inside it.
      expect((await get("/%2e%2e/%2e%2e/etc/hosts")).status).toBe(404);
    } finally {
      await server.close();
      rmSync(directory, { recursive: true, force: true });
    }
    await expect(fetch(server.origin)).rejects.toThrow();
  });
});
