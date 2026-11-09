// One spec file, in one context and one host page of its own: the driver's whole job for a file,
// with no Playwright test runner around it, so a fixture can drive it with no browser.
import type { Browser, Frame, Page } from "playwright";

import type {
  PageCollectedTest,
  PageError,
  PageEvent,
  PageHostConfig,
  PageTestRecord,
  PageUnhandledRecord,
} from "../hosts/page/protocol.ts";
import { ACTION_TIMEOUT, CONTEXT_OPTIONS } from "../node/browser-options.ts";
import { exposePageHost } from "../node/page-host.ts";
import { VIEWPORT } from "../node/viewport.ts";
import { commandContext, driverCommands } from "./commands.ts";
import type { CommandOptions } from "./commands.ts";
import { FRAME_SELECTOR, openHostPage, RUN_SPEC_GLOBAL } from "./host.ts";
import { uncaughtErrors } from "./page-errors.ts";
import { unfinishedRecord, unfinishedTests } from "./records.ts";
import type { DriverFileRecord, DriverRecord } from "./records.ts";

/** How long a document has to load and name its runner, as a dev build's chunks can take a while. */
const LOAD_TIMEOUT = 60_000;

/** A last wait, for what the page reported on its way out. */
const LAST_TASK_MS = 100;

/** How long closing a page that has stopped answering may take, before the run moves on. */
const CLOSE_TIMEOUT = 5_000;

/** The part of a Playwright browser a run needs. */
export type DriverBrowser = Pick<Browser, "newContext">;

/** What a run of one spec file is given. */
export interface RunSpecOptions extends Omit<CommandOptions, "provided"> {
  browser: DriverBrowser;
  /** Where the build is served. */
  origin: string;
  /** The spec file, absolute: the name its build knows it by. */
  filepath: string;
  config: PageHostConfig;
  /** Each record, as it happens. */
  onRecord: (record: DriverRecord) => void;
  /** The longest the page may say nothing; {@link stallLimit} by default. */
  stallMs?: number;
}

/** How a run of one spec file ended. */
export interface SpecOutcome {
  /** Every test's record, in the order they finished, then those that never did. */
  tests: PageTestRecord[];
  file: DriverFileRecord;
}

/**
 * The longest a page may say nothing: a test's time, with its hooks', and some margin for the
 * commands between them. A test that runs past its time ends through the page's own timer, so
 * only a page that no longer runs anything gets here.
 */
export function stallLimit(
  config: Pick<PageHostConfig, "testTimeout" | "hookTimeout">,
  tests: readonly PageCollectedTest[] = [],
): number {
  const longest = Math.max(config.testTimeout, ...tests.map(({ timeout }) => timeout));
  return longest + 2 * config.hookTimeout + 30_000;
}

/** Waits for the runner document: a global of its own, and on a Storybook, a finished render. */
async function readyRunner(page: Page, timeout: number): Promise<Frame> {
  const element = await page.waitForSelector(FRAME_SELECTOR, { timeout });
  const frame = await element.contentFrame();
  if (!frame) throw new Error("The host page's frame has no document.");
  const state = await frame.waitForFunction(
    (name) => {
      const { classList } = document.body ?? { classList: undefined };
      if (classList?.contains("sb-show-errordisplay")) {
        return document.querySelector("#error-message")?.textContent ?? "an error display";
      }
      if (typeof (globalThis as Record<string, unknown>)[name] !== "function") return false;
      const preview = (
        globalThis as { __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } } }
      ).__STORYBOOK_PREVIEW__;
      if (!preview) return "ready";
      const phase = preview.currentRender?.phase;
      return phase === "completed" || phase === "finished" ? "ready" : false;
    },
    RUN_SPEC_GLOBAL,
    { timeout },
  );
  const value = (await state.jsonValue()) as string;
  if (value !== "ready") throw new Error(`The runner story shows ${value}.`);
  return frame;
}

/** Runs one spec file and reports what it does. Rejects only on a fault of the driver's own. */
export async function runSpec(options: RunSpecOptions): Promise<SpecOutcome> {
  const { browser, origin, filepath, config, onRecord } = options;
  const provided = config.provided;
  const tests: PageTestRecord[] = [];
  const listener: PageUnhandledRecord[] = [];
  const pageErrors: PageError[] = [];
  const logged: string[] = [];
  let collected: PageCollectedTest[] = [];
  let pageFile: Extract<PageEvent, { kind: "file" }> | undefined;

  /** Why the page stopped: its watchdog, a crash or a close. Only the first reason counts. */
  let stop: (reason: string) => void = () => undefined;
  const stopped = new Promise<string>((resolve) => {
    stop = resolve;
  });
  const limit = () => options.stallMs ?? stallLimit(config, collected);
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const heard = () => {
    clearTimeout(watchdog);
    const ms = limit();
    watchdog = setTimeout(() => stop(`the page said nothing for ${ms}ms.`), ms);
  };
  const onEvent = (event: PageEvent) => {
    heard();
    switch (event.kind) {
      case "collected":
        collected = event.tests;
        onRecord(event);
        return;
      case "test":
        tests.push(event);
        onRecord(event);
        return;
      case "unhandled":
        listener.push(event);
        return;
      case "logged-error":
        logged.push(event.message);
        return;
      case "file":
        pageFile = event;
    }
  };

  const context = await browser.newContext({ viewport: VIEWPORT, ...CONTEXT_OPTIONS });
  // Every Playwright call in the context waits this long at most, as Vitest's `actionTimeout` does.
  context.setDefaultTimeout(ACTION_TIMEOUT);
  let reason: string | undefined;
  const fileErrors: PageError[] = [];
  try {
    const page = await context.newPage();
    page.on("pageerror", (error) => {
      pageErrors.push({ name: error.name, message: error.message, stack: error.stack ?? "" });
    });
    page.on("crash", () => stop("the page crashed."));
    const commandOptions: CommandOptions = {
      project: options.project,
      provided,
      ...(options.commands ? { commands: options.commands } : {}),
      ...(options.events ? { events: options.events } : {}),
    };
    const commands = driverCommands(commandContext(page, commandOptions), commandOptions);
    // A command's call and its answer are the page answering. Not paused while one runs: a mouse
    // move has no timeout of its own, and would wait for ever on a page that has stopped.
    const answering = Object.fromEntries(
      Object.entries(commands).map(([name, command]) => [
        name,
        async (...args: never[]) => {
          heard();
          try {
            return await command(...args);
          } finally {
            heard();
          }
        },
      ]),
    );
    await exposePageHost(page, { config, commands: answering, onEvent });
    heard();
    const run = async () => {
      await openHostPage(page, origin, LOAD_TIMEOUT);
      const frame = await readyRunner(page, LOAD_TIMEOUT);
      // The file's record comes through the binding: only a document that can't run it rejects.
      await frame.evaluate(
        async ([name, file]) => {
          const runSpecFile = (globalThis as unknown as Record<string, (path: string) => unknown>)[
            name!
          ]!;
          await runSpecFile(file!);
        },
        [RUN_SPEC_GLOBAL, filepath],
      );
    };
    await Promise.race([
      run().catch((error: unknown) => {
        // Past a stop, this is the context closing under it.
        if (reason === undefined) fileErrors.push(thrown(error));
      }),
      stopped.then((why) => {
        reason = why;
      }),
    ]);
    if (reason === undefined) await new Promise((resolve) => setTimeout(resolve, LAST_TASK_MS));
  } finally {
    clearTimeout(watchdog);
    // A page that has stopped answering may hold its close up too.
    await Promise.race([
      context.close().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, CLOSE_TIMEOUT)),
    ]);
  }

  const why = reason ?? (pageFile ? undefined : fileErrors[0]?.message);
  if (why !== undefined) {
    for (const test of unfinishedTests(collected, tests)) {
      const record = unfinishedRecord(test, {
        filepath,
        target: provided.target,
        harness: provided.ufHarness,
        reason: why,
      });
      tests.push(record);
      onRecord(record);
    }
  }
  if (reason !== undefined) fileErrors.push({ name: "Error", message: reason });
  const errors = [...(pageFile?.errors ?? []), ...fileErrors];
  const file: DriverFileRecord = {
    kind: "file",
    filepath,
    state: pageFile?.state === "pass" && !errors.length ? "pass" : "fail",
    meta: pageFile?.meta ?? {},
    uncaught: uncaughtErrors({ listener, pageErrors, logged }),
    ...(errors.length ? { errors } : {}),
  };
  onRecord(file);
  return { tests, file };
}

/** A thrown value as a file's error. */
function thrown(error: unknown): PageError {
  if (!(error instanceof Error)) return { message: String(error) };
  // What Playwright puts before an error from inside the page.
  const message = error.message.replace(/^frame\.evaluate: (?:Error: )?/, "");
  return { name: error.name, message, ...(error.stack ? { stack: error.stack } : {}) };
}

/** Why a spec file's test fails, or nothing. A quarantined layer leaves the state alone. */
export function failureOf({ tests, file }: SpecOutcome): string | undefined {
  const lines = [
    ...tests
      .filter(({ state }) => state === "fail")
      .map(({ fullName, errors }) => {
        const [first] = errors ?? [];
        return `${fullName}: ${first ? `${first.name ?? "Error"}: ${first.message}` : "failed"}`;
      }),
    ...(file.errors ?? []).map(({ name, message }) => `${name ?? "Error"}: ${message}`),
    ...file.uncaught.map(
      ({ source, name, message }) => `uncaught (${source}): ${name ?? "Error"}: ${message}`,
    ),
    ...tests
      .filter(({ state }) => state === "fail")
      .flatMap(({ artifacts }) => artifacts ?? [])
      .flatMap(({ attachments }) => attachments)
      .map(({ name, path }) => `${name} image: ${path}`),
  ];
  if (lines.length) return lines.join("\n");
  return file.state === "fail"
    ? `${file.filepath}: the file failed, with no error of its own.`
    : undefined;
}
