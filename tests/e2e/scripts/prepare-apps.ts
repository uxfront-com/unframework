// Packs the workspace packages and installs them into working copies of the apps, outside the
// repository (ADR-0079). The order matters: a package must be built before it's packed, because
// its published `exports` name `dist`.
//
// `--pack` stops once the tarballs are packed, and `--reuse-tarballs` skips straight to the
// copies, installing what an earlier run packed. CI's Pack job runs the first and uploads
// `.tarballs`, and each E2E job downloads it and runs the second, so the packages are built once.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import {
  copyManifest,
  copyWorkspace,
  designSystemDir,
  designSystemSource,
  e2eRoot,
  findApps,
  type Packed,
  readManifest,
  readPacked,
  repoRoot,
  startCopy,
  tarballsDir,
  workDir,
  workspaceClosure,
  workspacePackages,
  writePacked,
} from "../harness/apps.ts";

const run = (cwd: string, ...args: string[]): void => {
  execFileSync("pnpm", args, { cwd, stdio: "inherit" });
};

const pack = (directory: string): string => {
  const output = execFileSync("pnpm", ["pack", "--json", "--pack-destination", tarballsDir], {
    cwd: directory,
    encoding: "utf8",
  });
  return join(tarballsDir, basename(JSON.parse(output).filename));
};

const CONSUMED = ["@uxfront/unframework", "@unframework.dev/unplugin"];

function buildAndPack(): Packed {
  run(
    repoRoot,
    "exec",
    "turbo",
    "run",
    "build",
    "--ui=stream",
    ...CONSUMED.map((name) => `--filter=${name}`),
  );
  // `pack:dist`, never `build`: the required `Build` check runs every member's `build`.
  run(designSystemDir, "run", "--if-present", "pack:dist");

  const packageDirs = workspacePackages();
  const designSystemPath = designSystemSource();
  const designSystem = readManifest(designSystemPath);
  const roots = CONSUMED.map((name) => readManifest(packageDirs.get(name) as string));

  // Emptied first, so that no tarball from an earlier run can satisfy an install.
  rmSync(tarballsDir, { recursive: true, force: true });
  mkdirSync(tarballsDir, { recursive: true });
  const tarballs: Record<string, string> = {
    [designSystem.name]: pack(designSystemPath),
  };
  const names = new Set([...CONSUMED, ...workspaceClosure([...roots, designSystem], packageDirs)]);
  for (const name of [...names].toSorted()) tarballs[name] = pack(packageDirs.get(name) as string);
  const packed = { designSystem: designSystem.name, tarballs };
  writePacked(packed);
  return packed;
}

function installCopies({ designSystem, tarballs }: Packed): void {
  const work = workDir();
  const { packageManager } = readManifest(repoRoot);
  for (const app of findApps()) {
    const copy = join(work, app.name);
    startCopy(copy);
    cpSync(join(e2eRoot, "apps", app.name), copy, { recursive: true });
    const manifest = copyManifest(readManifest(copy), app, tarballs, designSystem, packageManager);
    writeFileSync(join(copy, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(join(copy, "pnpm-workspace.yaml"), copyWorkspace(tarballs));
    run(copy, "install", "--prefer-offline");
    process.stdout.write(`[e2e] ${app.name}: ${copy}\n`);
  }
}

// pnpm passes `--` on to the script.
const flags = process.argv.slice(2).filter((arg) => arg !== "--");
if (flags.length > 1 || flags.some((flag) => flag !== "--pack" && flag !== "--reuse-tarballs")) {
  throw new Error(
    `prepare-apps takes --pack or --reuse-tarballs, or neither, not: ${flags.join(" ")}`,
  );
}

if (flags[0] === "--pack") {
  buildAndPack();
  process.stdout.write(`[e2e] packed: ${tarballsDir}\n`);
} else {
  installCopies(flags[0] === "--reuse-tarballs" ? readPacked() : buildAndPack());
}
