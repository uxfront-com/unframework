// C1: a target's Storybook opens with one documented command, and stops with everything it started.
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, it } from "vitest";

import { identityOf, listProcesses, membersOf } from "../scripts/measure.ts";
import { REPO_ROOT } from "./paths.ts";
import { STORYBOOK_TARGETS } from "./storybook.ts";

/** A cold dev server's start, and its stop: longer than the harness's 60 s per test. */
const TIMEOUT_MS = 120_000;

describe.each(STORYBOOK_TARGETS)("storybook %s --cases basics/hello", (target) => {
  it(
    "serves the catalogue at the URL it prints, and leaves nothing behind",
    async () => {
      // In a group of its own, as a terminal runs it, so a signal reaches the whole command.
      const child = spawn(
        "pnpm",
        ["--filter", "@unframework/integration", "storybook", target, "--cases", "basics/hello"],
        { cwd: REPO_ROOT, detached: true, stdio: ["ignore", "pipe", "pipe"] },
      );
      const exit = new Promise<void>((resolve) => child.on("exit", () => resolve()));
      const stop = (signal: NodeJS.Signals) => {
        try {
          process.kill(-child.pid!, signal);
        } catch {
          // The group has gone.
        }
      };
      let output = "";
      let errors = "";
      child.stderr.on("data", (chunk: Buffer) => {
        errors += chunk.toString();
      });
      try {
        const url = await new Promise<string>((resolve, reject) => {
          child.stdout.on("data", (chunk: Buffer) => {
            output += chunk.toString();
            const match = /^Storybook at (http:\S+)$/m.exec(output);
            if (match) resolve(match[1]!);
          });
          child.on("exit", (code) => {
            reject(new Error(`The command exited ${code} before it printed a URL:\n${errors}`));
          });
        });
        const page = await fetch(url);
        const index = await fetch(new URL("index.json", url));
        expect(page.status).toBe(200);
        expect(index.status).toBe(200);
        const { entries } = (await index.json()) as { entries: Record<string, unknown> };
        expect(Object.keys(entries)).toContain("basics-hello--initial");
        expect(Object.keys(entries)).not.toContain("state-counter--initial");

        const tree = membersOf(listProcesses(), child.pid!, new Set());
        // The command, the script, Storybook: more than the one process it spawned.
        expect(tree.length).toBeGreaterThan(2);
        const started = new Set(tree.map(identityOf));
        stop("SIGTERM");
        await exit;
        const deadline = Date.now() + 10_000;
        let alive = started;
        while (alive.size && Date.now() < deadline) {
          await delay(200);
          const live = new Set(listProcesses().map(identityOf));
          alive = new Set([...started].filter((process) => live.has(process)));
        }
        expect([...alive]).toEqual([]);
      } finally {
        stop("SIGKILL");
      }
    },
    TIMEOUT_MS,
  );
});
