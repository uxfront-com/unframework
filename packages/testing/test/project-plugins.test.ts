// A project's own Vite plugins and declarations (ADR-0104), end to end: a fixture project whose
// component imports `virtual:uf-fixture`, which only the plugin its `unframework.config.ts` names
// serves, runs on every target with Vitest, and the same component without that plugin fails.
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";
import { startVitest } from "vitest/node";

import { defineTestConfig } from "../src/config/index.ts";

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url));

/** The variables a run reads, restored after each test. */
const SAVED = ["UF_TARGETS", "UF_UPDATE", "UF_TEST_CLI", "UF_PIXELS", "CI"] as const;
const env = Object.fromEntries(SAVED.map((name) => [name, process.env[name]]));
afterEach(() => {
  for (const name of SAVED) {
    if (env[name] === undefined) delete process.env[name];
    else process.env[name] = env[name];
  }
});

interface ModuleResult {
  project: string;
  state: string;
  errors: string[];
}

/**
 * Runs a fixture project's tests as `unframework test` does, and gives each test file's result
 * and what Vite logged as an error: a browser page sees only that an import failed, and the
 * server logs why.
 */
async function runProject(root: string): Promise<{ modules: ModuleResult[]; logged: string }> {
  for (const name of SAVED) delete process.env[name];
  // The command line is this package's test run's, whose arguments are no project's.
  process.env.UF_TEST_CLI = "1";
  const exitCode = process.exitCode;
  // The run's own output, Vite's log included, goes here rather than into this run's.
  let logged = "";
  const output = new Writable({
    write(chunk, _encoding, done) {
      logged += String(chunk);
      done();
    },
  });
  try {
    const config = await defineTestConfig({ root });
    const vitest = await startVitest(
      [],
      { root, run: true, watch: false, config: false, reporters: [] },
      config,
      { stdout: output, stderr: output },
    );
    const results = vitest.state.getTestModules().map((module) => {
      const tests = [...module.children.allTests()];
      const failed = tests.some((test) => test.result().state === "failed");
      return {
        project: module.project.name,
        state: failed ? "failed" : module.state(),
        errors: [...module.errors(), ...tests.flatMap((test) => test.result().errors ?? [])].map(
          (error) => error.message,
        ),
      };
    });
    await vitest.close();
    return { modules: results, logged };
  } finally {
    process.exitCode = exitCode;
  }
}

const SEVEN = ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"];

describe("a project's Vite plugins and declarations", () => {
  it(
    "reach every browser and ssr project, so a module only the project serves renders on every target",
    { timeout: 300_000 },
    async () => {
      const { modules: results } = await runProject(fixture("project-plugins"));
      expect(results.map((each) => each.project).toSorted()).toEqual(
        SEVEN.flatMap((target) => [`browser:${target}`, `ssr:${target}`]).toSorted(),
      );
      for (const result of results) {
        expect(result, result.project).toMatchObject({ state: "passed", errors: [] });
      }
    },
  );

  it(
    "leave a module only the project serves unresolved when the project names no plugin",
    { timeout: 300_000 },
    async () => {
      const { modules: results, logged } = await runProject(fixture("no-project-plugins"));
      expect(results.map((each) => each.project).toSorted()).toEqual(["browser:vue", "ssr:vue"]);
      for (const result of results) expect(result.state, result.project).toBe("failed");
      const unresolved =
        /Failed to resolve import "virtual:uf-fixture" from "[^"]*Greeting\.uf\.tsx/;
      // The page's import fails, and the server says which module it could not resolve.
      const browser = results.find((each) => each.project === "browser:vue")!;
      expect(browser.errors.join("\n")).toContain("Failed to import test file");
      expect(logged).toMatch(unresolved);
      // The server render fails on the same import.
      const ssr = results.find((each) => each.project === "ssr:vue")!;
      expect(ssr.errors.join("\n")).toMatch(/virtual:uf-fixture/);
    },
  );
});
