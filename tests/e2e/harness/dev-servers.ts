import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";

import { rebuildWatcher, type Watcher } from "./edit.ts";
import { HOST } from "./ports.ts";

interface StartedServer {
  port: number;
  watcher: Watcher;
  /** How long an edit waits for the server, when that's longer than the editor's default. */
  editTimeout?: number;
  stop(): Promise<void>;
}

/** A module from the working copy, so that the app runs on what it installed (ADR-0079). */
async function load(copy: string, name: string): Promise<unknown> {
  const require = createRequire(join(copy, "package.json"));
  return import(pathToFileURL(require.resolve(name)).href);
}

async function startVite(copy: string, mode: string): Promise<StartedServer> {
  // The part of Vite's API used here: the suite has no workspace dependency on Vite.
  const vite = (await load(copy, "vite")) as {
    createServer(config: object): Promise<{
      listen(): Promise<unknown>;
      close(): Promise<void>;
      httpServer: { address(): AddressInfo };
      watcher: Watcher;
    }>;
  };
  const server = await vite.createServer({
    configFile: join(copy, `vite.config.${mode}.ts`),
    logLevel: "warn",
    server: { host: HOST, port: 0 },
  });
  try {
    await server.listen();
  } catch (error) {
    await server.close();
    throw error;
  }
  return {
    port: server.httpServer.address().port,
    watcher: server.watcher,
    stop: () => server.close(),
  };
}

async function startAstro(copy: string, mode: string): Promise<StartedServer> {
  const astro = (await load(copy, "astro")) as {
    dev(config: object): Promise<{ address: AddressInfo; watcher: Watcher; stop(): Promise<void> }>;
  };
  // A test run is no one's usage to report.
  process.env.ASTRO_TELEMETRY_DISABLED = "1";
  const server = await astro.dev({
    // Astro would otherwise take the worker's working directory as the project.
    root: copy,
    // Astro joins this to `root`, even when it's absolute.
    configFile: `astro.config.${mode}.mjs`,
    logLevel: "warn",
    server: { host: HOST, port: 0 },
  });
  return { port: server.address.port, watcher: server.watcher, stop: () => server.stop() };
}

interface SpawnedNgServe {
  port: number;
  stdout: Readable;
  stop(): Promise<void>;
}

// Shorter than the fixture's own timeout, so that a slow start reports what `ng serve` printed.
const NG_READY_MS = 90_000;
const NG_STOP_MS = 5000;
const NG_ERRORS_MS = 200;
const NG_OUTPUT_LINES = 40;

/**
 * Starts `ng serve` in its own process group, on a port the system picks, and resolves once it
 * listens. A build that fails, or a process that exits first, rejects with the end of its output,
 * and leaves nothing running.
 */
export function spawnNgServe(
  ng: string,
  cwd: string,
  readyTimeout: number = NG_READY_MS,
): Promise<SpawnedNgServe> {
  const child = spawn(process.execPath, [ng, "serve", "--host", HOST, "--port", "0"], {
    cwd,
    // The group holds the CLI and what it starts, like esbuild's service.
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    // The dev server prefers `PORT` to its `--port` flag.
    env: { ...process.env, PORT: undefined },
  });
  const signal = (name: NodeJS.Signals): void => {
    try {
      process.kill(-(child.pid as number), name);
    } catch (error) {
      // A group that holds only a zombie answers EPERM on macOS: it's as gone as an empty one.
      const { code } = error as NodeJS.ErrnoException;
      if (code !== "ESRCH" && code !== "EPERM") throw error;
    }
  };
  // A worker that exits before its teardown still takes the server with it. One killed by a signal
  // can't, and then the global teardown fails on the port.
  const killGroup = (): void => signal("SIGKILL");
  process.once("exit", killGroup);
  // Every pipe closes once the whole group has gone, so nothing it printed is lost.
  const closed = new Promise<void>((done) => child.once("close", () => done()));

  const stop = async (): Promise<void> => {
    signal("SIGTERM");
    const timer = setTimeout(killGroup, NG_STOP_MS);
    await closed;
    clearTimeout(timer);
    // Anything in the group that let go of the pipes.
    killGroup();
    process.off("exit", killGroup);
  };

  return new Promise((resolve, reject) => {
    let started = false;
    const output: string[] = [];
    const onExit = (code: number | null): void => fail(`exited with ${code}`);
    const fail = (reason: string): void => {
      clearTimeout(timer);
      child.off("exit", onExit);
      void stop().then(() => {
        reject(new Error(`ng serve ${reason}:\n${output.slice(-NG_OUTPUT_LINES).join("\n")}`));
      });
    };
    const timer = setTimeout(() => fail(`didn't listen within ${readyTimeout}ms`), readyTimeout);
    child.once("exit", onExit);
    for (const stream of [child.stdout, child.stderr]) {
      // These also keep the pipes drained for as long as the server runs.
      createInterface({ input: stream }).on("line", (raw) => {
        if (started) return;
        // Under `FORCE_COLOR`, a colour code splits the URL before its port.
        const line = stripVTControlCharacters(raw);
        output.push(line);
        const listening = /Local:\s+http:\/\/[^:]+:(\d+)/.exec(line);
        if (listening) {
          started = true;
          clearTimeout(timer);
          child.off("exit", onExit);
          resolve({ port: Number(listening[1]), stdout: child.stdout, stop });
        } else if (line.includes("generation failed")) {
          // The errors follow this line, on the other pipe.
          clearTimeout(timer);
          setTimeout(() => fail("failed its first build"), NG_ERRORS_MS);
        }
      });
    }
  });
}

// Longer than the editor's default, which only has to cover a file event: this covers a rebuild.
const NG_EDIT_MS = 20_000;

async function startAngular(copy: string): Promise<StartedServer> {
  const server = await spawnNgServe(join(copy, "node_modules/@angular/cli/bin/ng.js"), copy);
  return {
    port: server.port,
    watcher: rebuildWatcher(server.stdout),
    editTimeout: NG_EDIT_MS,
    stop: () => server.stop(),
  };
}

/** Starts the dev server of one app's mode, from its working copy. */
export function startDevServer(app: string, mode: string, copy: string): Promise<StartedServer> {
  if (app === "astro") return startAstro(copy, mode);
  if (app === "angular") return startAngular(copy);
  return startVite(copy, mode);
}
