import { spawn, spawnSync } from "node:child_process";
import { EventEmitter, once } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANALOG_EXTENSION,
  assertInstalledFromTarball,
  copyManifest,
  copyMarker,
  copyWorkspace,
  DESIGN_SYSTEM_TEST_DEPENDENCIES,
  designSystemCopyConfig,
  designSystemCopyManifest,
  designSystemCopyWorkspace,
  designSystemDir,
  designSystemSource,
  e2eRoot,
  findApps,
  packedFile,
  QWIK_VITEST_PEER,
  readCatalog,
  readPacked,
  repoRoot,
  TYPESCRIPT6_OLD,
  startCopy,
  workDir,
  workspaceClosure,
  writePacked,
} from "./apps.ts";
import { spawnNgServe } from "./dev-servers.ts";
import { createEditor, rebuildWatcher } from "./edit.ts";
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

describe("assertInstalledFromTarball", () => {
  const name = "@scope/design-system";
  const store = "node_modules/.pnpm/ds@file/node_modules/@scope/design-system";

  /** A copy whose `node_modules/<name>` links to `target`, as pnpm's does. */
  const copyLinkedTo = (target: string): string => {
    const copy = join(scratch, "copy");
    mkdirSync(join(copy, "node_modules/@scope"), { recursive: true });
    symlinkSync(target, join(copy, "node_modules", name));
    return copy;
  };

  /** The same copy with real files in its virtual store. */
  const installedCopy = (): string => {
    const copy = copyLinkedTo(join(scratch, "copy", store));
    mkdirSync(join(copy, store, "react"), { recursive: true });
    writeFileSync(join(copy, store, "react/index.js"), "");
    return copy;
  };

  it("accepts real files in the copy's virtual store", () => {
    expect(() => assertInstalledFromTarball(installedCopy(), name)).not.toThrow();
  });

  it("refuses a package that links out of the copy", () => {
    const outside = join(scratch, "workspace/design-system");
    mkdirSync(outside, { recursive: true });
    expect(() => assertInstalledFromTarball(copyLinkedTo(outside), name)).toThrow(/virtual store/);
  });

  it("refuses a symbolic link inside the package", () => {
    const copy = installedCopy();
    symlinkSync(join(scratch, "elsewhere"), join(copy, store, "react/linked"));
    expect(() => assertInstalledFromTarball(copy, name)).toThrow(/symbolic link/);
  });

  it("rejects a package that isn't installed", () => {
    const copy = join(scratch, "empty");
    mkdirSync(copy, { recursive: true });
    expect(() => assertInstalledFromTarball(copy, name)).toThrow(/ENOENT/);
  });
});

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
    expect(existsSync(join(repo, "tests"))).toBe(false);
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
    "@uxfront/unframework": "/t/uf.tgz",
    "@unframework.dev/unplugin": "/t/plugin.tgz",
    "@unframework.dev/ir": "/t/ir.tgz",
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
      "@uxfront/unframework": "file:/t/uf.tgz",
      "@unframework.dev/unplugin": "file:/t/plugin.tgz",
    });
    expect(manifest.dependencies).toEqual({ vue: "3.5.43" });
  });

  it("overrides every packed package and allows the builds", () => {
    const workspace = JSON.parse(copyWorkspace(tarballs));
    expect(workspace.overrides).toEqual({
      ds: "file:/t/ds.tgz",
      "@uxfront/unframework": "file:/t/uf.tgz",
      "@unframework.dev/unplugin": "file:/t/plugin.tgz",
      "@unframework.dev/ir": "file:/t/ir.tgz",
    });
    expect(workspace.allowBuilds).toEqual({
      esbuild: true,
      "@parcel/watcher": true,
      lmdb: true,
      "msgpackr-extract": true,
      sharp: true,
    });
  });
});

describe("the design system's copy", () => {
  const tarballs = {
    "@uxfront/unframework": "/t/uf.tgz",
    "@unframework.dev/testing": "/t/testing.tgz",
    "@unframework.dev/visual": "/t/visual.tgz",
    "@unframework.dev/ir": "/t/ir.tgz",
  };
  const rootWorkspace = readFileSync(join(repoRoot, "pnpm-workspace.yaml"), "utf8");
  const catalog = readCatalog(rootWorkspace);

  it("reads the root's catalog, quoted names included", () => {
    expect(catalog.vitest).toMatch(/^\d+\.\d+\.\d+$/);
    expect(catalog["@vitest/browser-playwright"]).toBe(catalog.vitest);
    expect(Object.keys(catalog).length).toBeGreaterThan(50);
  });

  it("refuses a catalog line it can't read, rather than skipping it", () => {
    expect(readCatalog("catalog:\n  a: 1\n  # note\n\nother:\n  b: 2\n")).toEqual({ a: "1" });
    expect(() => readCatalog("catalog:\n  a: { b: 1 }\n")).toThrow(/can't take/);
    expect(() => readCatalog("packages: []\n")).toThrow(/no catalog/);
  });

  it("installs the packed packages from their tarballs and the rest at the catalog's versions", () => {
    const manifest = designSystemCopyManifest(tarballs, catalog, "npm:ts6@6", "pnpm@1");
    expect(manifest.packageManager).toBe("pnpm@1");
    expect(Object.keys(manifest.devDependencies)).toEqual(DESIGN_SYSTEM_TEST_DEPENDENCIES);
    expect(manifest.devDependencies).toMatchObject({
      "@uxfront/unframework": "file:/t/uf.tgz",
      "@unframework.dev/testing": "file:/t/testing.tgz",
      "@unframework.dev/visual": "file:/t/visual.tgz",
      vitest: catalog.vitest,
      "@angular/compiler-cli": catalog["@angular/compiler-cli"],
      typescript: "npm:ts6@6",
    });
    expect(manifest.dependencies).toBeUndefined();
    for (const specifier of Object.values<string>(manifest.devDependencies)) {
      expect(specifier).not.toMatch(/^(workspace|link|catalog):/);
    }
  });

  it("fails on a package that is neither packed nor in the catalog", () => {
    expect(() => designSystemCopyManifest(tarballs, {}, "npm:ts6@6", "pnpm@1")).toThrow(
      /vitest is neither packed nor in the catalog/,
    );
  });

  it("takes TypeScript 6 from the Angular toolchain, as the workspace pins it", () => {
    const toolchain = JSON.parse(
      readFileSync(join(repoRoot, "tests/toolchains/angular/package.json"), "utf8"),
    );
    expect(toolchain.devDependencies.typescript).toMatch(/^npm:@typescript\/typescript6@6\./);
  });

  it("repeats the root's settings for Analog, TypeScript 6 and Qwik's Vitest peer", () => {
    const workspace = JSON.parse(designSystemCopyWorkspace(tarballs));
    expect(workspace.overrides).toMatchObject({
      "@unframework.dev/testing": "file:/t/testing.tgz",
      [TYPESCRIPT6_OLD.key]: TYPESCRIPT6_OLD.value,
    });
    expect(workspace.allowBuilds).toEqual(JSON.parse(copyWorkspace(tarballs)).allowBuilds);
    expect(workspace.packageExtensions).toEqual({ [ANALOG_EXTENSION.key]: ANALOG_EXTENSION.value });
    expect(workspace.peerDependencyRules).toEqual({
      allowedVersions: { [QWIK_VITEST_PEER.key]: QWIK_VITEST_PEER.value },
    });
    // The root's own entries, as it writes them, so the copy can't drift from them.
    expect(rootWorkspace).toContain(`  "${TYPESCRIPT6_OLD.key}": ${TYPESCRIPT6_OLD.value}\n`);
    expect(rootWorkspace).toContain(
      `  "${ANALOG_EXTENSION.key}":\n    peerDependencies:\n      typescript: "${ANALOG_EXTENSION.value.peerDependencies.typescript}"\n`,
    );
    expect(rootWorkspace).toContain(`    "${QWIK_VITEST_PEER.key}": "${QWIK_VITEST_PEER.value}"\n`);
  });

  it("installs what the testing and visual pages tell a project to install", () => {
    const docs = join(repoRoot, "apps/web/content/docs/4.tooling");
    const testing = readFileSync(join(docs, "5.testing.md"), "utf8");
    const section = testing.slice(
      testing.indexOf("### Install what it needs"),
      testing.indexOf("### Configure the run"),
    );
    const named = (text: string): Set<string> =>
      new Set([...text.matchAll(/`((?:@[a-z0-9.-]+\/)?[a-z0-9.-]+)`/g)].map(([, name]) => name!));
    // The table's second column, and the sentence that names Angular's compiler stack.
    const packages = section
      .split("\n")
      .filter((line) => line.startsWith("| `"))
      .map((line) => line.split("|")[2]!)
      .concat(/Angular's compiler stack is [^.]*/.exec(section)![0]);
    for (const name of named(packages.join("\n"))) {
      expect(DESIGN_SYSTEM_TEST_DEPENDENCIES, name).toContain(name);
    }
    const documented = named(section);
    const visual = named(readFileSync(join(docs, "6.visual.md"), "utf8"));
    for (const name of DESIGN_SYSTEM_TEST_DEPENDENCIES) {
      // TypeScript 6 is named in prose, and the umbrella is what the command comes with.
      if (name === "typescript" || name === "@uxfront/unframework") continue;
      expect(documented.has(name) || visual.has(name), name).toBe(true);
    }
  });

  it("keeps the design system's targets, without the repository's toolchain paths", () => {
    const config = readFileSync(join(designSystemDir, "unframework.config.ts"), "utf8");
    const copy = designSystemCopyConfig(config);
    expect(copy).toContain(
      'targets: ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"],',
    );
    expect(copy).not.toMatch(/resolveFrom|toolchains/);
    expect(() => designSystemCopyConfig("export default {};")).toThrow(/names no targets/);
  });
});

describe("the packed tarballs' record", () => {
  const tarball = (name: string): string => {
    const path = join(scratch, name);
    writeFileSync(path, "");
    return path;
  };

  it("names each tarball by its file, and reads it back with its path in the directory", () => {
    const packed = {
      designSystem: "ds",
      tarballs: { ds: tarball("ds.tgz"), "@uxfront/unframework": tarball("uf.tgz") },
    };
    writePacked(
      { ...packed, tarballs: { ds: "/elsewhere/ds.tgz", "@uxfront/unframework": "/x/uf.tgz" } },
      scratch,
    );
    expect(JSON.parse(readFileSync(join(scratch, packedFile), "utf8"))).toEqual({
      designSystem: "ds",
      tarballs: { ds: "ds.tgz", "@uxfront/unframework": "uf.tgz" },
    });
    expect(readPacked(scratch)).toEqual(packed);
  });

  it("fails without a record, so nothing installs from the registry", () => {
    expect(() => readPacked(scratch)).toThrow(`${join(scratch, packedFile)} is missing`);
  });

  it("fails on a tarball that isn't in the directory, or a path that leaves it", () => {
    tarball("ds.tgz");
    writeFileSync(
      join(scratch, packedFile),
      JSON.stringify({ designSystem: "ds", tarballs: { ds: "ds.tgz", ir: "ir.tgz" } }),
    );
    expect(() => readPacked(scratch)).toThrow("names ir.tgz for ir, which isn't in");
    writeFileSync(
      join(scratch, packedFile),
      JSON.stringify({ designSystem: "ds", tarballs: { ds: "../ds.tgz" } }),
    );
    expect(() => readPacked(scratch)).toThrow("names ../ds.tgz for ds");
  });

  it("fails without the design system's tarball", () => {
    writeFileSync(join(scratch, packedFile), JSON.stringify({ designSystem: "ds", tarballs: {} }));
    expect(() => readPacked(scratch)).toThrow("has no tarball for the design system, ds.");
  });
});

describe("createEditor", () => {
  const nextTask = (): Promise<void> => new Promise((done) => setImmediate(done));
  // The fake watcher reports a change only when a test says so, which is what the waits rest on.
  const settled = async (promise: Promise<void>): Promise<boolean> => {
    let done = false;
    void promise.then(() => (done = true));
    await nextTask();
    return done;
  };
  let watcher: EventEmitter;

  beforeEach(() => {
    watcher = new EventEmitter();
  });

  it("applies an edit and restores the first version", async () => {
    writeFileSync(file(), "one two");
    const editor = createEditor(scratch, watcher);
    const first = editor.edit("Hello.tsx", "one", "three");
    watcher.emit("change", file());
    await first;
    expect(readFileSync(file(), "utf8")).toBe("three two");
    const second = editor.edit("Hello.tsx", "two", "four");
    watcher.emit("change", file());
    await second;
    expect(readFileSync(file(), "utf8")).toBe("three four");
    const restored = editor.restore();
    watcher.emit("change", file());
    await restored;
    expect(readFileSync(file(), "utf8")).toBe("one two");
    // Nothing is left to restore, so nothing waits for an event.
    await editor.restore();
  });

  it("takes the replacement literally", async () => {
    writeFileSync(file(), "price");
    const editor = createEditor(scratch, watcher);
    const edited = editor.edit("Hello.tsx", "price", "$& and $1");
    watcher.emit("change", file());
    await edited;
    expect(readFileSync(file(), "utf8")).toBe("$& and $1");
  });

  it("fails when the text isn't in the file, and changes nothing", async () => {
    writeFileSync(file(), "one");
    const editor = createEditor(scratch, watcher);
    await expect(editor.edit("Hello.tsx", "absent", "x")).rejects.toThrow(
      'does not contain "absent"',
    );
    expect(readFileSync(file(), "utf8")).toBe("one");
  });

  it("waits for the watcher to report that file, then a little longer", async () => {
    writeFileSync(file(), "one");
    const edited = createEditor(scratch, watcher).edit("Hello.tsx", "one", "two");
    expect(await settled(edited)).toBe(false);
    watcher.emit("change", join(scratch, "Other.tsx"));
    expect(await settled(edited)).toBe(false);
    watcher.emit("change", file());
    expect(await settled(edited)).toBe(false);
    await edited;
    expect(watcher.listenerCount("change")).toBe(0);
  });

  it("restores every file before it waits, and waits for each", async () => {
    const other = join(scratch, "Other.tsx");
    writeFileSync(file(), "one");
    writeFileSync(other, "one");
    const editor = createEditor(scratch, watcher);
    const edits = [editor.edit("Hello.tsx", "one", "two"), editor.edit("Other.tsx", "one", "two")];
    watcher.emit("change", file());
    watcher.emit("change", other);
    await Promise.all(edits);

    const restored = editor.restore();
    expect(readFileSync(file(), "utf8")).toBe("one");
    expect(readFileSync(other, "utf8")).toBe("one");
    watcher.emit("change", file());
    await new Promise((done) => setTimeout(done, 80));
    expect(await settled(restored)).toBe(false);
    watcher.emit("change", other);
    await restored;
  });

  it("leaves no timer behind once the write is reported", async () => {
    vi.useFakeTimers();
    writeFileSync(file(), "one");
    const edited = createEditor(scratch, watcher).edit("Hello.tsx", "one", "two");
    watcher.emit("change", file());
    await vi.advanceTimersByTimeAsync(50);
    await edited;
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("fails when the watcher never reports the write, and stops listening", async () => {
    writeFileSync(file(), "one");
    const editor = createEditor(scratch, watcher, 10);
    await expect(editor.edit("Hello.tsx", "one", "two")).rejects.toThrow("never reported a change");
    expect(watcher.listenerCount("change")).toBe(0);
    await expect(editor.restore()).rejects.toThrow("never reported a change");
    expect(readFileSync(file(), "utf8")).toBe("one");
  });
});

describe("rebuildWatcher", () => {
  const COMPLETE = "Application bundle generation complete. [0.1 seconds]\n";
  const nextTask = (): Promise<void> => new Promise((done) => setImmediate(done));
  const settled = async (promise: Promise<void>): Promise<boolean> => {
    let done = false;
    void promise.then(() => (done = true));
    // Past the editor's wait after a reported write.
    await new Promise((wait) => setTimeout(wait, 80));
    return done;
  };
  let output: PassThrough;

  beforeEach(() => {
    output = new PassThrough();
    writeFileSync(file(), "one");
  });

  it("holds an edit until a rebuild ends, not until the file changes", async () => {
    const edited = createEditor(scratch, rebuildWatcher(output)).edit("Hello.tsx", "one", "two");
    expect(readFileSync(file(), "utf8")).toBe("two");
    expect(await settled(edited)).toBe(false);
    output.write("Changes detected. Rebuilding...\n");
    expect(await settled(edited)).toBe(false);
    output.write(COMPLETE);
    expect(await settled(edited)).toBe(true);
  });

  it("ends an edit on a rebuild that failed", async () => {
    const edited = createEditor(scratch, rebuildWatcher(output)).edit("Hello.tsx", "one", "two");
    await nextTask();
    output.write("Application bundle generation failed. [0.1 seconds]\n");
    await edited;
  });

  it("reads the line through colour codes", async () => {
    const edited = createEditor(scratch, rebuildWatcher(output)).edit("Hello.tsx", "one", "two");
    await nextTask();
    output.write("\u001b[32mApplication bundle generation\u001b[39m complete.\n");
    await edited;
  });

  it("ignores a rebuild that ended before the write", async () => {
    const watcher = rebuildWatcher(output);
    output.write(COMPLETE);
    await nextTask();
    const edited = createEditor(scratch, watcher).edit("Hello.tsx", "one", "two");
    expect(await settled(edited)).toBe(false);
    output.write(COMPLETE);
    await edited;
  });

  it("holds a restore until the next rebuild ends", async () => {
    const editor = createEditor(scratch, rebuildWatcher(output));
    const edited = editor.edit("Hello.tsx", "one", "two");
    await nextTask();
    output.write(COMPLETE);
    await edited;
    const restored = editor.restore();
    expect(readFileSync(file(), "utf8")).toBe("one");
    expect(await settled(restored)).toBe(false);
    output.write(COMPLETE);
    await restored;
  });

  it("fails when no rebuild follows the write", async () => {
    await expect(
      createEditor(scratch, rebuildWatcher(output), 10).edit("Hello.tsx", "one", "two"),
    ).rejects.toThrow("never reported a change");
  });

  it("stops reporting to a listener once it's removed", async () => {
    const watcher = rebuildWatcher(output);
    const seen: string[] = [];
    const listener = (path: string): void => {
      seen.push(path);
    };
    watcher.on("change", listener);
    output.write(COMPLETE);
    await nextTask();
    expect(seen).toHaveLength(1);
    watcher.off("change", listener);
    output.write(COMPLETE);
    await nextTask();
    expect(seen).toHaveLength(1);
  });
});

describe("spawnNgServe", () => {
  // Not `kill(pid, 0)`, which succeeds on a zombie: in CI's container, PID 1 never reaps the orphan
  // of a killed process, so the process stays a zombie after it's gone. A missing `ps` throws, so
  // that it can't pass as a dead process.
  const isAlive = (pid: number): boolean => {
    const { error, stdout } = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], {
      encoding: "utf8",
    });
    if (error) throw error;
    const state = stdout.trim();
    return state !== "" && !state.startsWith("Z");
  };
  const until = async (done: () => boolean): Promise<void> => {
    for (let tries = 0; tries < 100 && !done(); tries += 1) {
      await new Promise((wait) => setTimeout(wait, 20));
    }
  };
  // A stand-in for the CLI: a script that runs under the same spawn.
  const fakeNg = (body: string): string => {
    const script = join(scratch, "ng.cjs");
    writeFileSync(script, `const { spawn } = require("node:child_process");\n${body}`);
    return script;
  };
  const LISTEN = 'console.log("  \\u279c  Local:   http://127.0.0.1:4321/");';
  const STAY = "setInterval(() => {}, 1000);";

  it("counts a zombie as dead, in the helper these tests lean on", async () => {
    // `exec` leaves a parent that never reaps its child, like PID 1 in CI's container.
    const parent = spawn("sh", ["-c", "sleep 60 & echo $!; exec sleep 60"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    const [line] = (await once(createInterface({ input: parent.stdout }), "line")) as [string];
    const child = Number(line);
    expect(isAlive(child)).toBe(true);
    process.kill(child, "SIGKILL");
    await until(() => !isAlive(child));
    expect(isAlive(child)).toBe(false);
    // Still a process table entry, which is what `kill(pid, 0)` would call alive.
    expect(() => process.kill(child, 0)).not.toThrow();
    parent.kill("SIGKILL");
  });

  it("resolves with the port it prints, and passes the host and a free port", async () => {
    const seen = join(scratch, "args.json");
    const server = await spawnNgServe(
      fakeNg(
        `require("node:fs").writeFileSync(${JSON.stringify(seen)}, JSON.stringify(process.argv.slice(2)));${LISTEN}${STAY}`,
      ),
      scratch,
    );
    expect(server.port).toBe(4321);
    expect(JSON.parse(readFileSync(seen, "utf8"))).toEqual([
      "serve",
      "--host",
      HOST,
      "--port",
      "0",
    ]);
    await server.stop();
  });

  it("reads a port split by colour codes", async () => {
    const server = await spawnNgServe(
      fakeNg(`console.log("Local:   http://127.0.0.1:\\u001b[1m4321\\u001b[22m/");${STAY}`),
      scratch,
    );
    expect(server.port).toBe(4321);
    await server.stop();
  });

  it("hides PORT, which the dev server prefers to its flag", async () => {
    const seen = join(scratch, "port.txt");
    vi.stubEnv("PORT", "4200");
    const server = await spawnNgServe(
      fakeNg(
        `require("node:fs").writeFileSync(${JSON.stringify(seen)}, String(process.env.PORT));${LISTEN}${STAY}`,
      ),
      scratch,
    );
    vi.unstubAllEnvs();
    expect(readFileSync(seen, "utf8")).toBe("undefined");
    await server.stop();
  });

  it("stops the whole process group, and forgets its exit handler", async () => {
    const before = process.listenerCount("exit");
    const pids = join(scratch, "pids");
    const server = await spawnNgServe(
      fakeNg(
        `const child = spawn("sleep", ["60"], { stdio: "ignore" });
        require("node:fs").writeFileSync(${JSON.stringify(pids)}, JSON.stringify([process.pid, child.pid]));
        ${LISTEN}${STAY}`,
      ),
      scratch,
    );
    expect(process.listenerCount("exit")).toBe(before + 1);
    const [parent, child] = JSON.parse(readFileSync(pids, "utf8")) as [number, number];
    expect(isAlive(parent)).toBe(true);
    expect(isAlive(child)).toBe(true);
    await server.stop();
    await until(() => !isAlive(child));
    expect(isAlive(parent)).toBe(false);
    expect(isAlive(child)).toBe(false);
    expect(process.listenerCount("exit")).toBe(before);
  });

  it("kills a process that ignores the polite signal", async () => {
    const server = await spawnNgServe(
      fakeNg(`process.on("SIGTERM", () => {});${LISTEN}${STAY}`),
      scratch,
    );
    const started = Date.now();
    await server.stop();
    expect(Date.now() - started).toBeGreaterThanOrEqual(4000);
  }, 15_000);

  it("kills what ignores the signal after letting go of the pipes", async () => {
    const pids = join(scratch, "pids");
    const server = await spawnNgServe(
      fakeNg(
        `const child = spawn("sh", ["-c", 'trap "" TERM; sleep 60'], { stdio: "ignore" });
        require("node:fs").writeFileSync(${JSON.stringify(pids)}, String(child.pid));
        ${LISTEN}${STAY}`,
      ),
      scratch,
    );
    const child = Number(readFileSync(pids, "utf8"));
    await new Promise((wait) => setTimeout(wait, 100));
    await server.stop();
    await until(() => !isAlive(child));
    expect(isAlive(child)).toBe(false);
  });

  it("rejects with the output when it exits before it listens", async () => {
    await expect(
      spawnNgServe(fakeNg('console.error("no angular.json");process.exit(3);'), scratch),
    ).rejects.toThrow(/exited with 3[\s\S]*no angular\.json/);
  });

  it("rejects with the errors when the first build fails, and stops the server", async () => {
    const pidFile = join(scratch, "pid");
    await expect(
      spawnNgServe(
        fakeNg(
          `require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
          console.log("Application bundle generation failed. [0.1 seconds]");
          console.error("[ERROR] TS2304: Cannot find name");
          ${STAY}`,
        ),
        scratch,
      ),
    ).rejects.toThrow(/failed its first build[\s\S]*TS2304/);
    expect(isAlive(Number(readFileSync(pidFile, "utf8")))).toBe(false);
  });

  it("rejects and stops the server when it never listens", async () => {
    const pidFile = join(scratch, "pid");
    await expect(
      spawnNgServe(
        fakeNg(
          `require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));console.log("building");${STAY}`,
        ),
        scratch,
        2000,
      ),
    ).rejects.toThrow(/didn't listen within 2000ms[\s\S]*building/);
    expect(isAlive(Number(readFileSync(pidFile, "utf8")))).toBe(false);
  });

  it("keeps running through a rebuild that fails after it listened", async () => {
    const pidFile = join(scratch, "pid");
    const server = await spawnNgServe(
      fakeNg(
        `require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
        ${LISTEN}
        console.log("Application bundle generation failed. [0.1 seconds]");
        ${STAY}`,
      ),
      scratch,
    );
    await new Promise((wait) => setTimeout(wait, 400));
    expect(isAlive(Number(readFileSync(pidFile, "utf8")))).toBe(true);
    await server.stop();
  });

  it("hands over the pipe that the rebuilds print to", async () => {
    const server = await spawnNgServe(
      fakeNg(`${LISTEN}
      setInterval(() => console.log("Application bundle generation complete."), 20);`),
      scratch,
    );
    writeFileSync(file(), "one");
    await createEditor(scratch, rebuildWatcher(server.stdout), 1000).edit(
      "Hello.tsx",
      "one",
      "two",
    );
    await server.stop();
  });

  it("stops a server that died before this process could reap it", async () => {
    const server = await spawnNgServe(
      fakeNg(`${LISTEN}setTimeout(() => process.exit(1), 50);`),
      scratch,
    );
    // A busy event loop leaves the dead leader a zombie: macOS then answers a signal to its group
    // with EPERM, where Linux delivers it to nothing.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
    await expect(server.stop()).resolves.toBeUndefined();
  });

  it("stays usable when the server dies after it listened", async () => {
    const server = await spawnNgServe(
      fakeNg(`${LISTEN}setTimeout(() => process.exit(1), 50);`),
      scratch,
    );
    await new Promise((wait) => setTimeout(wait, 150));
    await expect(server.stop()).resolves.toBeUndefined();
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

describe("startCopy", () => {
  it("replaces an earlier copy with an empty, marked one", () => {
    const copy = join(scratch, "react");
    mkdirSync(copy);
    writeFileSync(join(copy, copyMarker), "");
    writeFileSync(join(copy, "old.txt"), "");
    startCopy(copy);
    expect(readdirSync(copy)).toEqual([copyMarker]);
  });

  it("marks a new copy, so that one cut short can be replaced", () => {
    const copy = join(scratch, "react");
    startCopy(copy);
    expect(() => startCopy(copy)).not.toThrow();
  });

  it("leaves a directory it didn't make", () => {
    const copy = join(scratch, "react");
    mkdirSync(copy);
    writeFileSync(join(copy, "keep.txt"), "mine");
    expect(() => startCopy(copy)).toThrow("isn't a working copy");
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
