// @unframework/testing/driver: declares one Playwright test per spec file (plan §7.3). The tests run
// in the page through the page host, and Playwright owns the run, the pages, real input, ARIA and
// screenshots. `@playwright/test` loads here alone, so what a Vitest test imports (`./run.ts`,
// `./reporter.ts`, `./host.ts`) stays out of its way.
import { relative, sep } from "node:path";

import { test as base } from "@playwright/test";

import type { PageHostConfig } from "../hosts/page/protocol.ts";
import type { CommandOptions } from "./commands.ts";
import { HOST_HTML, HOST_PATH } from "./host.ts";
import { RECORD_ATTACHMENT } from "./records.ts";
import type { DriverRecord } from "./records.ts";
import { failureOf, runSpec } from "./run.ts";
import { serveStatic } from "./server.ts";
import type { StaticServer } from "./server.ts";

export type { TargetCommand } from "./commands.ts";

/** What a project's worker needs to run its specs. */
export interface ProjectDriver extends Omit<CommandOptions, "project" | "provided"> {
  /** The static build to serve. */
  directory: string;
  /** What the page reads from Node. */
  config: PageHostConfig;
}

/** What {@link declareSpecTests} declares. */
export interface SpecTests {
  /** Each spec file, absolute. */
  specs: readonly string[];
  /** What a test's title is relative to. */
  root: string;
  /** The driver of a project, by the `target` in its metadata. */
  project(target: string): ProjectDriver | Promise<ProjectDriver>;
}

/** What a worker holds for its project. */
interface WorkerState {
  driver: ProjectDriver;
  server: StaticServer;
}

/** Declares one Playwright test per spec file, in the file that calls it. */
export function declareSpecTests(options: SpecTests): void {
  const test = base.extend<object, { ufWorker: WorkerState }>({
    ufWorker: [
      // Playwright reads the fixtures a function wants from this pattern, so it can't be left out.
      // oxlint-disable-next-line no-empty-pattern
      async ({}, use, workerInfo) => {
        const { target } = workerInfo.project.metadata as { target: string };
        const driver = await options.project(target);
        const server = await serveStatic(driver.directory, { [HOST_PATH]: HOST_HTML });
        await use({ driver, server });
        await server.close();
      },
      { scope: "worker" },
    ],
  });
  for (const filepath of options.specs) {
    test(
      relative(options.root, filepath).split(sep).join("/"),
      async ({ browser, ufWorker }, info) => {
        // In order, each done before the test ends, however the page's calls interleave.
        let attached: Promise<unknown> = Promise.resolve();
        const onRecord = (record: DriverRecord) => {
          const body = JSON.stringify(record);
          attached = attached.then(() =>
            info.attach(RECORD_ATTACHMENT, { body, contentType: "application/json" }),
          );
        };
        const { driver, server } = ufWorker;
        const outcome = await runSpec({
          browser,
          origin: server.origin,
          filepath,
          project: info.project.name,
          config: driver.config,
          ...(driver.commands ? { commands: driver.commands } : {}),
          ...(driver.events ? { events: driver.events } : {}),
          onRecord,
        });
        await attached;
        const failure = failureOf(outcome);
        if (failure !== undefined) throw new Error(failure);
      },
    );
  }
}
