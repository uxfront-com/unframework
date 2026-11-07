import { readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
// The page host, in a real page with no Vitest in it: a stub spec built through Vite and run in
// Chromium with the `playwright` library. `./page-host-vitest.browser.test.ts` holds the answers
// it is compared with to Vitest's own.
import { createServer } from "node:http";
import type { Server } from "node:http";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import type { Browser, BrowserContext } from "playwright";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { callNode, pageConfig } from "../src/hosts/page/config.ts";
import type {
  PageEvent,
  PageFileRecord,
  PageTestRecord,
  PageUnhandledRecord,
} from "../src/hosts/page/protocol.ts";
import {
  ufAriaSnapshot,
  ufColorScheme,
  ufFocus,
  ufInput,
  ufResetInput,
} from "../src/node/commands.ts";
import { pageActions } from "../src/node/page-actions.ts";
import { exposePageHost } from "../src/node/page-host.ts";
import { VIEWPORT } from "../src/node/viewport.ts";
import { MATCHER_FIXTURES, VALUE_FIXTURES } from "./page-host/fixtures.ts";
import recorded from "./page-host/vitest-results.json" with { type: "json" };
import { fixtureHarness, packageRoot, STUB_CAPABILITIES } from "./parity/project.ts";

const here = fileURLToPath(new URL("./page-host/", import.meta.url));
const outDir = join(packageRoot, ".uf-tmp", "page-host");
const harness = fixtureHarness({}, []);

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".woff2": "font/woff2",
};

/**
 * What Vitest calls its frame, which a Playwright timeout's call log prints, and so L8 records:
 * the page host's frame keeps the name, so the text stays the same.
 */
const FRAME = '[data-vitest="true"]';

/** The events one spec file reported. */
interface Run {
  events: PageEvent[];
  tests: Map<string, PageTestRecord>;
  file: PageFileRecord;
  unhandled: PageUnhandledRecord[];
}

let server: Server;
let origin: string;
let browser: Browser;

beforeAll(async () => {
  await build({
    root: here,
    configFile: false,
    logLevel: "error",
    mode: "development",
    plugins: [
      {
        // The package's `sideEffects` names its setup files, not the stub specs and their target,
        // which a build would drop: they only register tests.
        name: "uf-stub-side-effects",
        enforce: "pre",
        transform: (code, id) =>
          id.includes("/test/") ? { code, moduleSideEffects: true, map: null } : undefined,
      },
    ],
    resolve: {
      alias: [
        {
          find: /^vitest$/,
          replacement: join(packageRoot, "src/hosts/page/vitest.ts"),
        },
      ],
    },
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      target: "esnext",
      rolldownOptions: { input: join(here, "iframe.html") },
    },
  });
  server = createServer((request, response) => {
    const path = new URL(request.url!, "http://stub").pathname;
    if (path === "/") {
      response.setHeader("content-type", "text/html");
      response.end(
        `<!doctype html><iframe data-vitest="true" src="about:blank" style="border:0;width:${VIEWPORT.width}px;height:${VIEWPORT.height}px"></iframe>`,
      );
      return;
    }
    readFile(join(outDir, path)).then(
      (contents) => {
        response.setHeader("content-type", TYPES[extname(path)] ?? "application/octet-stream");
        response.end(contents);
      },
      () => {
        response.statusCode = 404;
        response.end();
      },
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});

/** Runs a stub spec in a page of its own, as the driver will, and waits for its file's record. */
async function runSpec(
  spec: string,
  options: { hookTimeout?: number; caseName?: string } = {},
): Promise<Run> {
  const context: BrowserContext = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    forcedColors: "none",
    locale: "en-US",
    timezoneId: "UTC",
  });
  context.setDefaultTimeout(5_000);
  const page = await context.newPage();
  await page.goto(`${origin}/`);
  const frameElement = await page.waitForSelector(FRAME);
  const iframe = page.frameLocator(FRAME);
  const commandContext = {
    page,
    iframe,
    frame: async () => (await frameElement.contentFrame())!,
  };
  const events: PageEvent[] = [];
  let finished: (record: PageFileRecord) => void;
  const done = new Promise<PageFileRecord>((resolve) => {
    finished = resolve;
  });
  await exposePageHost(page, {
    config: {
      provided: {
        target: "dom",
        ufHarness: harness,
        ufCapabilities: STUB_CAPABILITIES,
        ufNoOutput: { "stub/page-no-output": "uf-probe: no output" },
      },
      pollTimeout: 200,
      testTimeout: 30_000,
      hookTimeout: options.hookTimeout ?? 30_000,
      requireAssertions: true,
    },
    commands: {
      ufAriaSnapshot: (locator: never) => ufAriaSnapshot(commandContext as never, locator),
      ufColorScheme: (scheme: never) => ufColorScheme(commandContext as never, scheme),
      ufFocus: (locator: never) => ufFocus(commandContext as never, locator),
      ufInput: (request: never) => ufInput(commandContext as never, request),
      ufResetInput: () => ufResetInput(commandContext as never),
      setActionTimeout: (ms: never) => context.setDefaultTimeout(ms),
      ufUnhover: () => pageActions.ufUnhover(commandContext as never),
      ufFill: (locator: never, text: never) =>
        pageActions.ufFill(commandContext as never, locator, text),
      ufClear: (locator: never) => pageActions.ufClear(commandContext as never, locator),
      ufSelectOptions: (locator: never, values: never) =>
        pageActions.ufSelectOptions(commandContext as never, locator, values),
    },
    onEvent(event) {
      events.push(event);
      if (event.kind === "file") finished(event);
    },
  });
  const filepath = options.caseName
    ? join(harness.casesDir, "stub", options.caseName, spec.slice(spec.indexOf("/") + 1))
    : join(harness.casesDir, "stub", spec);
  const query = new URLSearchParams({ spec, file: filepath });
  await iframe.owner().evaluate((element, url) => {
    (element as HTMLIFrameElement).src = url;
  }, `${origin}/iframe.html?${query}`);
  const file = await done;
  // A last task, so what the page reported on its way out arrives.
  await page.waitForTimeout(100);
  await context.close();
  return {
    events,
    file,
    tests: new Map(
      events.flatMap((event) => (event.kind === "test" ? [[event.name, event] as const] : [])),
    ),
    unhandled: events.filter((event) => event.kind === "unhandled"),
  };
}

/** What the fixture spec's named test left for Node. */
function results(run: Run, name: string): unknown {
  return (run.tests.get(name)!.meta as { results?: unknown }).results;
}

describe("with nothing around it", () => {
  it("imports nothing of Vitest's own but its published expect and utils", () => {
    const dir = join(packageRoot, "src/hosts/page");
    const files = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((file) =>
      file.endsWith(".ts"),
    );
    const specifiers = files.flatMap((file) => [
      ...readFileSync(join(dir, file), "utf8").matchAll(/from "(vitest(?:\/[^"]*)?)"/g),
    ]);
    expect(files.length).toBeGreaterThan(14);
    expect(specifiers).toEqual([]);
  });

  it("refuses to run without the driver's config, saying where it comes from", () => {
    expect(() => pageConfig()).toThrow("__ufPageHostConfig");
  });

  it("refuses a command with no binding to reach Node through", async () => {
    await expect(callNode("ufInput", [])).rejects.toThrow("__ufPageHostCall");
  });
});

describe("the page host, against Vitest's own answers", () => {
  let run: Run;

  beforeAll(async () => {
    run = await runSpec("page-host/fixtures.page.spec.ts");
  }, 120_000);

  it("holds Vitest's answer to every fixture of the 14 matchers", () => {
    expect(new Set(MATCHER_FIXTURES.map(({ matcher }) => matcher))).toEqual(
      new Set([
        "toBeChecked",
        "toBeDisabled",
        "toBeEnabled",
        "toBeInTheDocument",
        "toBeRequired",
        "toBeVisible",
        "toHaveAccessibleDescription",
        "toHaveAttribute",
        "toHaveClass",
        "toHaveFocus",
        "toHaveStyle",
        "toHaveTextContent",
        "toHaveValue",
        "toMatchTextContent",
        // Not ported: `toHaveLength` reads every match, and the other two are chai's business.
        "toHaveLength",
        "toBeTruthy",
        "toBeNonsense",
      ]),
    );
    expect(Object.keys(recorded.matchers)).toEqual([
      ...MATCHER_FIXTURES.map(({ id }) => id),
      ...VALUE_FIXTURES.map(({ id }) => id),
    ]);
  });

  it("gives each matcher's verdict and message", () => {
    expect(results(run, "matchers")).toEqual(recorded.matchers);
  });

  it("serialises each getBy* to Vitest's string", () => {
    expect(results(run, "locators")).toEqual(recorded.locators);
  });

  it("finds what Vitest's locators find", () => {
    expect(results(run, "resolved")).toEqual(recorded.resolved);
  });

  it("answers about the page, and refuses, as Vitest's locators do", () => {
    expect(results(run, "called")).toEqual(recorded.called);
  });

  it("gives the four actions Vitest's result", () => {
    expect(results(run, "actions")).toEqual(recorded.actions);
  });

  it("fails an action that times out with Vitest's text", () => {
    expect(results(run, "action timeouts")).toEqual(recorded.actionTimeouts);
  });

  it("words a clear's timeout as Vitest's, which takes no timeout of its own to compare", () => {
    const { verdict, name, message } = recorded.actionTimeouts.fill;
    expect(results(run, "clear timeout")).toEqual({
      verdict,
      name,
      message: message.replace("locator.fill", "locator.clear"),
    });
  });

  it("passes the tests that record them", () => {
    expect(run.file.state).toBe("pass");
    expect(run.unhandled).toEqual([]);
  });
});

describe("the page host's runner", () => {
  let run: Run;

  const test = (name: string): PageTestRecord => {
    const record = run.tests.get(name);
    if (!record) throw new Error(`No record of "${name}".`);
    return record;
  };

  beforeAll(async () => {
    run = await runSpec("page-host/runner.page.spec.ts");
  }, 120_000);

  it("runs a passing test, recording every layer it reached", () => {
    const record = test("passes a test that asserted");
    expect(record.state).toBe("pass");
    expect(record.fullName).toBe("stub/page-host [dom] > passes a test that asserted");
    expect(record.meta.uf?.layers.L8).toEqual({ status: "pass" });
    expect(record.meta.uf?.layers.L13).toEqual({ status: "pass" });
  });

  it("gives a test its task", () => {
    expect(test("gives a test its task").state).toBe("pass");
  });

  it("requires an assertion, in the words L8 reads", () => {
    const record = test("fails a test that asserted nothing");
    expect(record.state).toBe("fail");
    expect(record.errors?.[0]?.message).toBe("expected any number of assertion, but got none");
    expect(record.meta.uf?.layers.L8).toEqual({
      status: "fail",
      message:
        "The test asserted nothing: every test asserts at least one fact about what it rendered (expect.requireAssertions).",
    });
  });

  it("records a failed assertion as L8", () => {
    const record = test("fails a test whose assertion fails, recording it as L8");
    expect(record.state).toBe("fail");
    expect(record.meta.uf?.layers.L8?.status).toBe("fail");
    expect(record.meta.uf?.layers.L13).toEqual({ status: "pass" });
  });

  it("records a locator that finds nothing as the L8 canary reads it", () => {
    const layer = test("fails a test whose locator finds nothing").meta.uf?.layers.L8;
    expect(layer).toMatchObject({ status: "fail" });
    expect((layer as { message: string }).message).toMatch(
      /^(?:VitestBrowserElementError: Cannot find element with locator: getByTestId\('uf-root-\d+'\)\.getBy[A-Za-z]+\(|Error: expect\.poll\(\) function didn't resolve in time\.$)/m,
    );
    expect((layer as { message: string }).message).not.toContain("HTML:");
  });

  it("fails an assertion nobody awaited", () => {
    const record = test("fails a test that left an assertion unawaited");
    expect(record.state).toBe("fail");
    // Each one, as Vitest records both.
    expect(record.errors?.map(({ message }) => message.split(" was ")[0])).toEqual([
      "expect.element(locator).toHaveTextContent()",
      "expect.element(locator).toBeVisible()",
    ]);
  });

  it("fails a test past its time, naming the setting", () => {
    const record = test("fails a test that ran out of time");
    expect(record.state).toBe("fail");
    expect(record.errors?.[0]?.message).toBe(
      'Test timed out in 50ms.\nIf this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".',
    );
  });

  it("judges the console as L13, with the setup's hooks", () => {
    const record = test("records a console message as L13");
    expect(record.state).toBe("fail");
    expect(record.meta.uf?.layers.L13).toMatchObject({
      status: "fail",
      message: expect.stringContaining("uf-probe-warning"),
    });
    expect(record.errors?.map(({ name }) => name)).toEqual(["LayerFailure"]);
  });

  it("gives expect.element the driver's poll timeout", () => {
    expect(test("bounds expect.element by the poll timeout").state).toBe("pass");
  });

  it("records a thrown value as Vitest's result holds it", () => {
    const record = test("records a thrown value that isn't an error as L8");
    expect(record.state).toBe("fail");
    expect(record.errors?.[0]).toEqual({ message: "uf-probe-string" });
    expect(record.meta.uf?.layers.L8).toEqual({
      status: "fail",
      message: "Error: uf-probe-string",
    });
  });

  it("flattens an AggregateError, as Vitest does", () => {
    const record = test("records each error of an AggregateError as L8");
    expect(record.errors?.map(({ message }) => message)).toEqual(["uf-probe-one", "uf-probe-two"]);
  });

  it("fails a body that held the page past its time, when no timer could fire", () => {
    const record = test("fails a test that held the page past its time");
    expect(record.errors?.[0]?.message).toContain("Test timed out in 20ms.");
  });

  it("carries a command's refusal back to the page", () => {
    expect(test("names what a command it doesn't have").state).toBe("pass");
  });

  it("gives what the alias and the port hold", () => {
    expect(test("gives the runtime expect.stringMatching").state).toBe("pass");
    expect(test("gives a spec on the alias its inject").state).toBe("pass");
  });

  it("names a test by every suite around it", () => {
    expect(test("names the test by every suite").fullName).toBe(
      "stub/page-host [dom] > a nested suite > names the test by every suite",
    );
  });

  it("hands on a failed visual comparison", () => {
    expect(test("keeps a failed visual comparison's images for the reporter").artifacts).toEqual([
      { message: "uf-probe-visual", attachments: [] },
    ]);
  });

  it("cuts a long page out of an element error", () => {
    const record = test("cuts a long page out of an element error at Vitest's limit");
    expect(record.meta.uf?.layers.L8).toEqual({ status: "pass" });
  });

  it("tries an assertion again, at Vitest's interval", () => {
    const record = test("tries again until the assertion holds");
    expect(record.errors).toBeUndefined();
    expect(record.state).toBe("pass");
  });

  it("moves the clock only through tick", () => {
    const { layers } = test("moves the clock only through tick").meta.uf!;
    // The spec's own assertions on the count.
    expect(layers.L8).toEqual({ status: "pass" });
    // Each tick is a step of the trace, which this stub has no expectation to compare with.
    expect(layers.L9).toMatchObject({
      status: "fail",
      message: expect.stringContaining("(tick 100ms; tick 250ms)"),
    });
  });

  it("fakes the same two functions, and gives them back", () => {
    const record = test("fakes only the intervals, and gives them back");
    expect(record.errors).toBeUndefined();
    expect(record.state).toBe("pass");
  });

  it("runs a test with what it requires, from inject's values", () => {
    expect(test("runs a test whose required capability is supported").state).toBe("pass");
  });

  it("reports the file as failed, with nothing unhandled", () => {
    expect(run.file.state).toBe("fail");
    expect(run.unhandled).toEqual([]);
  });
});

describe("what nothing catches in a page (C3 page errors, the page side)", () => {
  it("reports a rejection with a reason, on the file's record", async () => {
    const run = await runSpec("page-rejection/page-rejection.fails.spec.ts");
    expect(run.unhandled).toHaveLength(1);
    expect(run.unhandled[0]).toMatchObject({
      type: "Unhandled Rejection",
      name: "Error",
      message: "uf-probe-rejection",
      test: "stub/page-rejection [dom] > rejects with nothing to catch it",
    });
    expect(run.file.unhandled).toEqual(run.unhandled);
    expect(run.tests.get("rejects with nothing to catch it")?.state).toBe("pass");
    expect(run.tests.get("rejects with nothing to catch it")?.meta.uf?.layers.L13).toEqual({
      status: "pass",
    });
  }, 60_000);

  it("reports an error thrown from a timer, on the file's record", async () => {
    const run = await runSpec("page-timer/page-timer.fails.spec.ts");
    expect(run.unhandled).toHaveLength(1);
    expect(run.unhandled[0]).toMatchObject({
      type: "Error",
      name: "Error",
      message: "uf-probe-timer",
    });
    expect(run.file.unhandled).toEqual(run.unhandled);
    expect(run.tests.get("throws from a timer")?.meta.uf?.layers.L13).toEqual({ status: "pass" });
  }, 60_000);

  it("leaves a rejection with no reason to L13", async () => {
    const run = await runSpec("page-null-rejection/page-null-rejection.fails.spec.ts");
    expect(run.unhandled).toEqual([]);
    const record = run.tests.get("rejects with no reason");
    expect(record?.state).toBe("fail");
    expect(record?.meta.uf?.layers.L13).toMatchObject({
      status: "fail",
      message: expect.stringContaining("console.error"),
    });
    expect(
      run.tests.get("logs an error event that holds only a message")?.meta.uf?.layers.L13,
    ).toMatchObject({
      status: "fail",
      message: expect.stringContaining("uf-probe-observer"),
    });
  }, 60_000);
});

describe("a test the setup skips", () => {
  it("skips it with its reason on every layer", async () => {
    const run = await runSpec("page-no-output/page-no-output.fails.spec.ts");
    const record = run.tests.get("has no output on this target");
    expect(record?.state).toBe("skip");
    expect(record?.note).toBe("no output: uf-probe: no output");
    expect(record?.meta.uf?.skipped).toBe("no output: uf-probe: no output");
    expect(record?.meta.uf?.layers.L8).toEqual({
      status: "skip",
      reason: "no output: uf-probe: no output",
    });
    expect(run.file.state).toBe("pass");
  }, 60_000);
});

describe("a locator made before anything has queried the page", () => {
  it("is exact, as Vitest's, and keeps its strings", async () => {
    const run = await runSpec("page-first-query/page-first-query.fails.spec.ts");
    const record = run.tests.get("names a button whose name another holds");
    expect(record?.errors).toBeUndefined();
    expect(record?.state).toBe("pass");
    expect(record?.meta.uf?.layers.L8).toEqual({ status: "pass" });
    expect((record!.meta as { results?: unknown }).results).toEqual({
      selector: 'internal:testid=[data-testid="uf-root-1"s] >> internal:text="Shipping"i',
      locator: "getByTestId('uf-root-1').getByText('Shipping', { exact: false })",
    });
  }, 60_000);
});

describe("a test with a quarantined L8", () => {
  it("passes, with its own errors gone from its result", async () => {
    const run = await runSpec("page-quarantine/page-quarantine.fails.spec.ts", {
      caseName: "behaviour-known",
    });
    const record = run.tests.get("fails its assertion");
    expect(record?.meta.uf?.layers.L8).toMatchObject({ status: "quarantined" });
    expect(record?.state).toBe("pass");
    expect(record?.errors).toBeUndefined();
    expect(run.file.state).toBe("pass");
  }, 60_000);
});

describe("an after hook that never finishes", () => {
  it("fails with the hook's time, and the around hook still judges the test", async () => {
    const run = await runSpec("page-after-each/page-after-each.fails.spec.ts", {
      hookTimeout: 2_000,
    });
    const record = run.tests.get("has a stuck after hook");
    expect(record?.state).toBe("fail");
    expect(record?.errors?.[0]?.message).toBe(
      'Hook timed out in 2000ms.\nIf this is a long-running hook, pass a timeout value as the last argument or configure it globally with "hookTimeout".',
    );
    expect(record?.meta.uf?.layers.L13).toEqual({ status: "pass" });
    expect(record?.meta.uf?.layers.L8).toMatchObject({
      status: "fail",
      message: expect.stringContaining("Hook timed out in 2000ms."),
    });
  }, 60_000);
});

describe("a file's own failures", () => {
  it("fails a file that won't load, with its error", async () => {
    const run = await runSpec("page-load-error/page-load-error.fails.spec.ts");
    expect(run.file.state).toBe("fail");
    expect(run.file.errors?.[0]?.message).toBe("uf-probe-load");
    expect(run.tests.size).toBe(0);
  }, 60_000);

  it("fails a file with no tests", async () => {
    const run = await runSpec("page-empty/page-empty.fails.spec.ts");
    expect(run.file.state).toBe("fail");
    expect(run.file.errors?.[0]?.message).toBe(`No test suite found in file ${run.file.filepath}`);
  }, 60_000);

  it("skips the tests of a beforeAll that throws, with no records", async () => {
    const run = await runSpec("page-before-all/page-before-all.fails.spec.ts");
    expect(run.file.state).toBe("fail");
    expect(run.file.errors?.[0]?.message).toBe("uf-probe-before-all");
    const record = run.tests.get("never runs");
    expect(record?.state).toBe("skip");
    expect(record?.meta.uf).toBeUndefined();
  }, 60_000);

  it("fails the file on a warning after its last test, on the file's own L13", async () => {
    const run = await runSpec("page-late-console/page-late-console.fails.spec.ts");
    expect(run.tests.get("passes")?.state).toBe("pass");
    expect(run.file.state).toBe("fail");
    expect(run.file.errors?.[0]?.message).toContain("L13: after the last test of this file");
    expect(run.file.meta.uf?.layers.L13).toMatchObject({
      status: "fail",
      message: expect.stringContaining("uf-probe-late"),
    });
  }, 60_000);
});
