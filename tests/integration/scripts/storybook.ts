// `storybook <target> [--cases …]`, `storybook:build <target>` and `storybook:check <target>
// [--story <id>]`: a target's Storybook on a dev server, its static build, and a walk of that build
// in one page.
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { extname, join, normalize } from "node:path";

import { RUN_SPEC, RUNNER_STORY } from "@unframework/visual";
import { chromium } from "playwright";
import type { Page } from "playwright";

import { listCases } from "../harness/cases.ts";
import { noOutputCases } from "../harness/no-output.ts";
import { ROOT } from "../harness/paths.ts";
import { CASES_ENV, selectCases, storybookDir, targetStories } from "../harness/storybook.ts";
import { selectTargets } from "../harness/targets.ts";

const USAGE =
  "Usage: storybook.ts serve <target> [--cases <id>[,<id>…]] | build <target> | check <target> [--story <id>]";
/** How long a dev server has to answer, and a story to render. */
const READY_MS = 90_000;
const STORY_MS = 30_000;
const STOP_GRACE_MS = 3000;

/** The chunk a spec builds to: `counter.test-<hash>.js`. */
const SPEC_CHUNK = /\/assets\/[^/]*\.test-[^/]*\.js$/;

const TYPES: Record<string, string> = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/** Storybook's CLI, in the target's own package, run from the Vite root. */
function storybook(target: string, args: readonly string[], env: NodeJS.ProcessEnv): ChildProcess {
  const directory = storybookDir(target);
  return spawn(
    join(directory, "node_modules", ".bin", "storybook"),
    [...args, "--config-dir", join(directory, ".storybook")],
    {
      cwd: ROOT,
      // The stdout is the command's own: one line says where the server is.
      stdio: ["ignore", process.stderr, "inherit"],
      // A group of its own, so what the CLI starts stops with it.
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

async function build(target: string): Promise<number> {
  const output = join(storybookDir(target), "storybook-static");
  const child = storybook(target, ["build", "--quiet", "--output-dir", output], process.env);
  return exited(child);
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
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => {
      stopGroup(child, "SIGTERM");
      setTimeout(() => stopGroup(child, "SIGKILL"), STOP_GRACE_MS).unref();
    });
  }
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

/** Serves a static build on a free port. */
function serveStatic(directory: string): Promise<{ server: Server; origin: string }> {
  const server = createServer((request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url!, "http://build").pathname));
    readFile(join(directory, path)).then(
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
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

/** What opening a story found. */
interface StoryResult {
  error: string | undefined;
  empty: boolean;
  noOutput: boolean;
  text: string;
}

/** Waits for the story on the page to finish rendering, and reads its root. */
async function readStory(page: Page, id: string): Promise<StoryResult> {
  try {
    await page.waitForFunction(
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
    );
  } catch {
    return { error: "it did not finish rendering", empty: true, noOutput: false, text: "" };
  }
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("#storybook-root");
    const { classList } = document.body;
    const error = classList.contains("sb-show-errordisplay")
      ? (document.querySelector("#error-message")?.textContent ?? "the error display is showing")
      : classList.contains("sb-show-nopreview")
        ? "Storybook has no preview of it"
        : undefined;
    return {
      error,
      empty: !root || (root.childElementCount === 0 && !root.textContent.trim()),
      noOutput: Boolean(root?.querySelector("[data-uf-no-output]")),
      text: root?.innerText ?? "",
    };
  });
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
  const result = await readStory(page, RUNNER_STORY);
  const ready = await page.evaluate(
    (name) => typeof (globalThis as Record<string, unknown>)[name] === "function",
    RUN_SPEC,
  );
  return [
    ...(result.error === undefined ? [] : [`${RUNNER_STORY}: ${result.error}`]),
    ...(result.empty ? [] : [`${RUNNER_STORY}: it rendered something`]),
    ...(ready ? [] : [`${RUNNER_STORY}: it doesn't set ${RUN_SPEC}`]),
  ];
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

function difference(a: readonly string[], b: readonly string[]): string[] {
  const other = new Set(b);
  return a.filter((each) => !other.has(each));
}

/** `--story`: prints a story's text. Otherwise walks every story of the build in one page. */
async function check(target: string, story: string | undefined): Promise<number> {
  const directory = join(storybookDir(target), "storybook-static");
  if (!existsSync(join(directory, "index.json"))) {
    console.error(`[uf] No build at ${directory}: run storybook:build ${target} first.`);
    return 1;
  }
  const built = builtStories(directory);
  const cases = listCases();
  const stories = targetStories(cases, target);
  const expected = stories.map(({ id }) => id).toSorted();
  if (story !== undefined && !built.includes(story)) {
    console.error(`[uf] The ${target} build holds no story ${story}.`);
    return 1;
  }
  const { server, origin } = await serveStatic(directory);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const specChunks: string[] = [];
    page.on("request", (request) => {
      if (SPEC_CHUNK.test(new URL(request.url()).pathname)) specChunks.push(request.url());
    });
    const open = (id: string) => page.goto(`${origin}/iframe.html?id=${id}&viewMode=story`);
    if (story !== undefined) {
      await open(story);
      const result = await readStory(page, story);
      console.log(result.text);
      if (result.error !== undefined) console.error(`[uf] ${story}: ${result.error}`);
      return result.error === undefined ? 0 : 1;
    }
    const problems = [
      ...difference(expected, built).map(
        (id) => `${id}: the generator lists it, the build lacks it`,
      ),
      ...difference(built, expected).map(
        (id) => `${id}: the build holds it, the generator lacks it`,
      ),
    ];
    const noOutput: string[] = [];
    for (const [index, id] of built.entries()) {
      if (index === 0) await open(id);
      else await selectStory(page, id);
      const result = await readStory(page, id);
      if (result.error !== undefined) problems.push(`${id}: ${result.error}`);
      else if (result.empty) problems.push(`${id}: its root is empty`);
      if (result.noOutput) noOutput.push(id);
    }
    const wanted = new Set(Object.keys(noOutputCases(cases, target)));
    const shown = new Set(
      stories.filter(({ id }) => noOutput.includes(id)).map(({ title }) => title),
    );
    for (const id of wanted) {
      if (!shown.has(id)) problems.push(`${id}: it has no output, and no story says so`);
    }
    for (const id of shown) {
      if (!wanted.has(id)) problems.push(`${id}: a story says it has no output, and it has`);
    }
    for (const url of specChunks) problems.push(`the catalogue loaded a spec: ${url}`);
    problems.push(...(await checkRunner(page, origin)));
    console.log(`stories: ${built.length} (the generator lists ${expected.length})`);
    console.log(`no output: ${noOutput.length ? noOutput.join(", ") : "none"}`);
    for (const problem of problems) console.error(`[uf] ${problem}`);
    return problems.length ? 1 : 0;
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

/** The value of a flag, comma- or space-separated up to the next flag. */
function flagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const end = args.findIndex((arg, at) => at > index && arg.startsWith("--"));
  const values = args.slice(index + 1, end === -1 ? undefined : end);
  if (!values.length) throw new Error(`${flag} needs a value.\n${USAGE}`);
  return values.join(",");
}

async function main(argv: readonly string[]): Promise<number> {
  const args = argv.filter((arg) => arg !== "--");
  const [command, target] = args;
  if (!command || !target) throw new Error(USAGE);
  // Throws on a name that isn't a target.
  selectTargets(target);
  const rest = args.slice(2);
  if (command === "build" && !rest.length) return build(target);
  if (command === "serve") return serve(target, flagValue(rest, "--cases"));
  if (command === "check") return check(target, flagValue(rest, "--story"));
  throw new Error(USAGE);
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(`[uf] ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
