// `storybook <target> [--cases …]`, `storybook:build <target>` and `storybook:check <target>
// [--story <id>]`: a target's Storybook on a dev server, its static build, and a walk of that build
// in one page.
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

import { serveStatic } from "@unframework/testing/driver/server";
import { RUN_SPEC, RUNNER_STORY } from "@unframework/visual";
import { buildIsolated } from "@unframework/visual/preset";
import { chromium } from "playwright";
import type { Page } from "playwright";

import { listCases, selectCases } from "../harness/cases.ts";
import { noOutputCases } from "../harness/no-output.ts";
import { ROOT, storybookDir, storybookOutput } from "../harness/paths.ts";
import {
  catalogueProblems,
  isSpecChunk,
  noOutputStories,
  parseCommand,
  runnerProblems,
  storyProblem,
  UNFINISHED_STORY,
  within,
} from "../harness/storybook-check.ts";
import type { StoryPage } from "../harness/storybook-check.ts";
import { CASES_ENV, storiesDir, targetStories } from "../harness/storybook.ts";

/** How long a dev server has to answer, and a story to render. */
const READY_MS = 90_000;
const STORY_MS = 30_000;
const STOP_GRACE_MS = 3000;

/**
 * Storybook's CLI, in the target's own package, run from the Vite root. It sits in a group of its
 * own, so what it starts stops with it, and a signal to this process reaches it only from here.
 */
function storybook(target: string, args: readonly string[], env: NodeJS.ProcessEnv): ChildProcess {
  const directory = storybookDir(target);
  const child = spawn(
    join(directory, "node_modules", ".bin", "storybook"),
    [...args, "--config-dir", join(directory, ".storybook")],
    {
      cwd: ROOT,
      // The stdout is the command's own: one line says where the server is.
      stdio: ["ignore", process.stderr, "inherit"],
      detached: true,
      env: {
        ...env,
        // Storybook sets `production` unless told otherwise, which turns the frameworks' plugins
        // to their production builds.
        NODE_ENV: "development",
        STORYBOOK_DISABLE_TELEMETRY: "1",
      },
    },
  );
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => {
      stopGroup(child, "SIGTERM");
      setTimeout(() => stopGroup(child, "SIGKILL"), STOP_GRACE_MS).unref();
    });
  }
  return child;
}

function exited(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

function stopGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  try {
    process.kill(-child.pid!, signal);
  } catch {
    // The group has gone.
  }
}

/**
 * A target's static build, of some cases where they're given, again for as long as an abort names a
 * new module to fail. A canary's has its own directory.
 */
export async function build(target: string, cases?: string): Promise<number> {
  const canary = process.env.UF_CANARY?.trim() || null;
  const output = storybookOutput(target, canary);
  // Beside the stories' directories, which a start empties, and gitignored with them. One file per
  // build that can run beside another, since a build fails every module its file names.
  const aborts = `${storiesDir(target, cases)}${canary ? `.${canary}` : ""}.aborts.json`;
  return buildIsolated(aborts, (env) =>
    exited(
      storybook(target, ["build", "--quiet", "--output-dir", output], {
        ...process.env,
        ...(cases ? { [CASES_ENV]: cases } : {}),
        ...env,
      }),
    ),
  );
}

/** A port nothing listens on now. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

/** Runs the dev server until a signal stops this process. */
async function serve(target: string, cases: string | undefined): Promise<number> {
  // Before the server starts, so a typo is one line rather than a stack in Storybook's log.
  selectCases(listCases(), cases);
  const port = await freePort();
  const url = `http://127.0.0.1:${port}/`;
  const child = storybook(
    target,
    ["dev", "--ci", "--port", String(port), "--exact-port", "--host", "127.0.0.1"],
    { ...process.env, ...(cases ? { [CASES_ENV]: cases } : {}) },
  );
  const exit = exited(child);
  const deadline = Date.now() + READY_MS;
  let ready = false;
  let ended = false;
  void exit.finally(() => {
    ended = true;
  });
  while (!ready && !ended && Date.now() < deadline) {
    ready = await fetch(`${url}index.json`).then(
      (response) => response.ok,
      () => false,
    );
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (ready) console.log(`Storybook at ${url}`);
  else if (!ended) {
    console.error(`[uf] The ${target} Storybook did not answer within ${READY_MS / 1000} s.`);
    stopGroup(child, "SIGKILL");
    return 1;
  }
  return exit;
}

/** Waits for the story on the page to finish rendering, and reads what it shows. */
async function readStory(page: Page, id: string): Promise<StoryPage> {
  const rendered = await within(
    page.waitForFunction(
      (story) => {
        const render = (
          window as unknown as {
            __STORYBOOK_PREVIEW__?: { currentRender?: { id: string; phase?: string } };
          }
        ).__STORYBOOK_PREVIEW__?.currentRender;
        const { classList } = document.body;
        return (
          classList.contains("sb-show-errordisplay") ||
          classList.contains("sb-show-nopreview") ||
          (render?.id === story && (render.phase === "completed" || render.phase === "finished"))
        );
      },
      id,
      { timeout: STORY_MS },
    ),
    STORY_MS,
  );
  if (!rendered) return UNFINISHED_STORY;
  const found = await within(
    page.evaluate(() => {
      const root = document.querySelector<HTMLElement>("#storybook-root");
      const { classList } = document.body;
      return {
        showsError: classList.contains("sb-show-errordisplay"),
        errorMessage: document.querySelector("#error-message")?.textContent ?? undefined,
        noPreview: classList.contains("sb-show-nopreview"),
        root: root ? { elements: root.childElementCount, content: root.textContent } : undefined,
        noOutput: Boolean(root?.querySelector("[data-uf-no-output]")),
        text: root?.innerText ?? "",
      };
    }),
    STORY_MS,
  );
  return found ? { ...found, finished: true } : UNFINISHED_STORY;
}

/** Opens the next story in the same page, as the manager does. */
async function selectStory(page: Page, id: string): Promise<void> {
  await page.evaluate((story) => {
    document.body.classList.remove("sb-show-errordisplay", "sb-show-nopreview");
    (
      window as unknown as {
        __STORYBOOK_PREVIEW__: { channel: { emit(event: string, data: unknown): void } };
      }
    ).__STORYBOOK_PREVIEW__.channel.emit("setCurrentStory", { storyId: story, viewMode: "story" });
  }, id);
}

/** The runner story, in a page of its own load: nothing rendered, and ready to run a spec. */
async function checkRunner(page: Page, origin: string): Promise<string[]> {
  await page.goto(`${origin}/iframe.html?id=${RUNNER_STORY}&viewMode=story`);
  const found = await readStory(page, RUNNER_STORY);
  const ready = await page.evaluate(
    (name) => typeof (globalThis as Record<string, unknown>)[name] === "function",
    RUN_SPEC,
  );
  return runnerProblems(RUNNER_STORY, found, RUN_SPEC, ready);
}

/** The ids of a build's stories, without the runner's. */
function builtStories(directory: string): string[] {
  const index = JSON.parse(readFileSync(join(directory, "index.json"), "utf8")) as {
    entries: Record<string, { type: string }>;
  };
  return Object.entries(index.entries)
    .filter(([id, entry]) => entry.type === "story" && id !== RUNNER_STORY)
    .map(([id]) => id)
    .toSorted();
}

/** `--story`: prints a story's text. Otherwise walks every story of the build in one page. */
async function check(target: string, story: string | undefined): Promise<number> {
  const directory = storybookOutput(target, process.env.UF_CANARY?.trim() || null);
  if (!existsSync(join(directory, "index.json"))) {
    console.error(`[uf] No build at ${directory}: run storybook:build ${target} first.`);
    return 1;
  }
  const built = builtStories(directory);
  const cases = listCases();
  const stories = targetStories(cases, target);
  if (story !== undefined && !built.includes(story)) {
    console.error(`[uf] The ${target} build holds no story ${story}.`);
    return 1;
  }
  const server = await serveStatic(directory);
  const { origin } = server;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const specChunks: string[] = [];
    page.on("request", (request) => {
      if (isSpecChunk(new URL(request.url()).pathname)) specChunks.push(request.url());
    });
    const open = (id: string) => page.goto(`${origin}/iframe.html?id=${id}&viewMode=story`);
    if (story !== undefined) {
      await open(story);
      const found = await readStory(page, story);
      console.log(found.text);
      const problem = storyProblem(found);
      if (problem !== undefined) console.error(`[uf] ${story}: ${problem}`);
      return problem === undefined ? 0 : 1;
    }
    const pages = new Map<string, StoryPage>();
    for (const [index, id] of built.entries()) {
      if (index === 0) await open(id);
      else await selectStory(page, id);
      pages.set(id, await readStory(page, id));
    }
    const problems = catalogueProblems({
      stories,
      pages,
      noOutput: Object.keys(noOutputCases(cases, target)),
      specChunks,
    });
    problems.push(...(await checkRunner(page, origin)));
    const noOutput = noOutputStories(pages);
    console.log(`stories: ${built.length} (the generator lists ${stories.length})`);
    console.log(`no output: ${noOutput.length ? noOutput.join(", ") : "none"}`);
    for (const problem of problems) console.error(`[uf] ${problem}`);
    return problems.length ? 1 : 0;
  } finally {
    await browser.close();
    await server.close();
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const { command, target, value } = parseCommand(argv);
  if (command === "build") return build(target);
  return command === "serve" ? serve(target, value) : check(target, value);
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(`[uf] ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
