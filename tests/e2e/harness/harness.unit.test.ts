import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearCopy,
  copyManifest,
  copyMarker,
  copyWorkspace,
  designSystemSource,
  e2eRoot,
  findApps,
  workDir,
  workspaceClosure,
} from "./apps.ts";
import { createEditor } from "./edit.ts";
import globalSetup from "./global-setup.ts";
import globalTeardown from "./global-teardown.ts";
import { clearPorts, HOST, recordedPorts, recordPort, stillListening } from "./ports.ts";

let scratch: string;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "uf-e2e-unit-"));
});

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true });
});

const repository = (): string => {
  const path = join(scratch, "repo");
  mkdirSync(path, { recursive: true });
  return path;
};

const file = (): string => join(scratch, "Hello.tsx");

describe("findApps", () => {
  it("lists each app with the modes under its e2e directory", () => {
    mkdirSync(join(scratch, "vue/e2e/plugin"), { recursive: true });
    mkdirSync(join(scratch, "vue/e2e/package"), { recursive: true });
    mkdirSync(join(scratch, "angular/e2e/package"), { recursive: true });
    writeFileSync(join(scratch, "vue/e2e/notes.md"), "");
    expect(findApps(scratch)).toEqual([
      { name: "angular", modes: ["package"] },
      { name: "vue", modes: ["package", "plugin"] },
    ]);
  });
});

describe("workDir", () => {
  it("accepts a directory outside the repository and creates it", () => {
    const work = join(scratch, "..work", "copies");
    expect(workDir(work, repository()).endsWith(join("..work", "copies"))).toBe(true);
    expect(existsSync(work)).toBe(true);
  });

  it("refuses the repository itself and any directory inside it", () => {
    const repo = repository();
    expect(() => workDir(repo, repo)).toThrow("outside the repository");
    expect(() => workDir(join(repo, "tests/copies"), repo)).toThrow("outside the repository");
  });

  it("refuses a symlink that leads into the repository", () => {
    const repo = repository();
    mkdirSync(join(repo, "inside"));
    symlinkSync(join(repo, "inside"), join(scratch, "link"));
    expect(() => workDir(join(scratch, "link"), repo)).toThrow("outside the repository");
  });

  it("falls back to the system's temporary directory", () => {
    expect(workDir("", repository()).endsWith("unframework-e2e")).toBe(true);
  });
});

describe("workspaceClosure", () => {
  const manifests: Record<string, Record<string, unknown>> = {
    "/a": { name: "a", dependencies: { b: "workspace:*", react: "19.3.0" } },
    "/b": { name: "b", dependencies: { a: "workspace:*", c: "workspace:*" } },
    "/c": { name: "c", devDependencies: { d: "workspace:*" } },
  };
  const packages = new Map([
    ["a", "/a"],
    ["b", "/b"],
    ["c", "/c"],
    ["d", "/d"],
  ]);

  it("follows workspace dependencies through a cycle, and skips dev and registry ones", () => {
    const closure = workspaceClosure(
      [manifests["/a"] as object],
      packages,
      (path) => manifests[path] as object,
    );
    expect(closure).toEqual(["a", "b", "c"]);
  });

  it("fails on a workspace dependency it can't find", () => {
    expect(() =>
      workspaceClosure([{ name: "x", dependencies: { y: "workspace:*" } }], packages),
    ).toThrow("x depends on unknown package y");
  });
});

describe("the copy's manifest and workspace", () => {
  const tarballs = {
    ds: "/t/ds.tgz",
    unframework: "/t/uf.tgz",
    "@unframework/unplugin": "/t/plugin.tgz",
    "@unframework/ir": "/t/ir.tgz",
  };
  const manifest = { name: "app", dependencies: { vue: "3.5.43" } };

  it("adds the design system to an app with the package mode only", () => {
    const copy = copyManifest(
      manifest,
      { name: "a", modes: ["package"] },
      tarballs,
      "ds",
      "pnpm@1",
    );
    expect(copy.packageManager).toBe("pnpm@1");
    expect(copy.dependencies).toEqual({ vue: "3.5.43", ds: "file:/t/ds.tgz" });
  });

  it("adds unframework and the plugin to an app with the plugin mode", () => {
    const copy = copyManifest(
      manifest,
      { name: "a", modes: ["package", "plugin"] },
      tarballs,
      "ds",
      "pnpm@1",
    );
    expect(copy.dependencies).toEqual({
      vue: "3.5.43",
      ds: "file:/t/ds.tgz",
      unframework: "file:/t/uf.tgz",
      "@unframework/unplugin": "file:/t/plugin.tgz",
    });
    expect(manifest.dependencies).toEqual({ vue: "3.5.43" });
  });

  it("overrides every packed package and allows the builds", () => {
    const workspace = JSON.parse(copyWorkspace(tarballs));
    expect(workspace.overrides).toEqual({
      ds: "file:/t/ds.tgz",
      unframework: "file:/t/uf.tgz",
      "@unframework/unplugin": "file:/t/plugin.tgz",
      "@unframework/ir": "file:/t/ir.tgz",
    });
    expect(workspace.allowBuilds).toEqual({
      esbuild: true,
      "@parcel/watcher": true,
      lmdb: true,
      sharp: true,
    });
  });
});

describe("createEditor", () => {
  it("applies an edit and restores the first version", () => {
    writeFileSync(file(), "one two");
    const editor = createEditor(scratch);
    editor.edit("Hello.tsx", "one", "three");
    expect(readFileSync(file(), "utf8")).toBe("three two");
    editor.edit("Hello.tsx", "two", "four");
    expect(readFileSync(file(), "utf8")).toBe("three four");
    editor.restore();
    expect(readFileSync(file(), "utf8")).toBe("one two");
  });

  it("takes the replacement literally", () => {
    writeFileSync(file(), "price");
    const editor = createEditor(scratch);
    editor.edit("Hello.tsx", "price", "$& and $1");
    expect(readFileSync(file(), "utf8")).toBe("$& and $1");
  });

  it("fails when the text isn't in the file, and changes nothing", () => {
    writeFileSync(file(), "one");
    const editor = createEditor(scratch);
    expect(() => editor.edit("Hello.tsx", "absent", "x")).toThrow('does not contain "absent"');
    expect(readFileSync(file(), "utf8")).toBe("one");
  });
});

describe("the port ledger", () => {
  it("records ports and clears them", () => {
    expect(recordedPorts(scratch)).toEqual([]);
    recordPort(scratch, 5173);
    recordPort(scratch, 5174);
    expect(recordedPorts(scratch).toSorted((a, b) => a - b)).toEqual([5173, 5174]);
    clearPorts(scratch);
    expect(recordedPorts(scratch)).toEqual([]);
  });

  it("reports the ports something still listens on", async () => {
    const server = createServer();
    await new Promise<void>((done) => server.listen(0, HOST, done));
    const { port } = server.address() as { port: number };
    expect(await stillListening([port])).toEqual([port]);
    await new Promise((done) => server.close(done));
    expect(await stillListening([port])).toEqual([]);
  });
});

describe("clearCopy", () => {
  it("removes an earlier copy", () => {
    const copy = join(scratch, "react");
    mkdirSync(copy);
    writeFileSync(join(copy, copyMarker), "");
    clearCopy(copy);
    expect(existsSync(copy)).toBe(false);
  });

  it("leaves a directory it didn't make", () => {
    const copy = join(scratch, "react");
    mkdirSync(copy);
    writeFileSync(join(copy, "keep.txt"), "mine");
    expect(() => clearCopy(copy)).toThrow("isn't a working copy");
    expect(readFileSync(join(copy, "keep.txt"), "utf8")).toBe("mine");
  });
});

describe("designSystemSource", () => {
  it("is the directory until a package exists, then the package", () => {
    expect(designSystemSource(scratch)).toBe(scratch);
    mkdirSync(join(scratch, "dist/package"), { recursive: true });
    expect(designSystemSource(scratch)).toBe(join(scratch, "dist/package"));
  });
});

describe("the global hooks", () => {
  const previous = process.env.UF_E2E_WORK_DIR;

  beforeEach(() => {
    process.env.UF_E2E_WORK_DIR = scratch;
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.UF_E2E_WORK_DIR;
    else process.env.UF_E2E_WORK_DIR = previous;
  });

  it("forgets the ports of a run that was killed", () => {
    recordPort(scratch, 5173);
    globalSetup();
    expect(recordedPorts(scratch)).toEqual([]);
  });

  it("fails the run when a recorded port still listens", async () => {
    const server = createServer();
    await new Promise<void>((done) => server.listen(0, HOST, done));
    const { port } = server.address() as { port: number };
    recordPort(scratch, port);
    await expect(globalTeardown()).rejects.toThrow(`on port ${port}`);
    await new Promise((done) => server.close(done));
    await expect(globalTeardown()).resolves.toBeUndefined();
    expect(recordedPorts(scratch)).toEqual([]);
  });
});

describe("the e2e script", () => {
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ["scripts/e2e.ts", ...args], { cwd: e2eRoot, encoding: "utf8" });

  it("honours the flags after pnpm's `--`", () => {
    const { status, stdout } = run("--", "--list", "--project", "vue:plugin");
    expect(status).toBe(0);
    expect(stdout).toContain("[vue:plugin]");
    expect(stdout).not.toContain("[react:plugin]");
    expect(stdout).not.toContain("[vue:package]");
  }, 30_000);

  it("exits with Playwright's status", () => {
    expect(run("--list", "--project", "no-such-project").status).toBe(1);
  }, 30_000);
});
