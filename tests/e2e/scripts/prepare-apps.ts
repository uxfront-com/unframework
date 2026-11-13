// Packs the workspace packages and installs them into working copies of the apps, outside the
// repository (ADR-0079). The order matters: a package must be built before it's packed, because
// its published `exports` name `dist`.
//
// `--pack` stops once the tarballs are packed, and `--reuse-tarballs` skips straight to the
// copies, installing what an earlier run packed. CI's Pack job runs the first and uploads
// `.tarballs`, and the E2E and Design system jobs download it and run the second, so the packages
// are built once. `--only apps` or `--only design-system` installs one kind of copy, as each of
// those jobs needs.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import {
  assertInstalledFromTarball,
  copyManifest,
  copyWorkspace,
  DESIGN_SYSTEM_COPIED,
  designSystemCopyConfig,
  designSystemCopyManifest,
  designSystemCopyName,
  designSystemCopyWorkspace,
  designSystemDir,
  designSystemSource,
  e2eRoot,
  findApps,
  type Packed,
  readManifest,
  readCatalog,
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

// The umbrella reaches testing and visual through optional peers, which the closure doesn't
// follow, so they're named here: the design system's copy runs `unframework test` and `visual`.
const CONSUMED = [
  "@uxfront/unframework",
  "@unframework.dev/unplugin",
  "@unframework.dev/testing",
  "@unframework.dev/visual",
];

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

function installApps({ designSystem, tarballs }: Packed, work: string): void {
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

/**
 * The design system as a project of its own, outside the repository, with what the testing docs
 * list from the tarballs and the catalog (ADR-0089). `design-system` runs its tests there.
 */
function installDesignSystem({ tarballs }: Packed, work: string): void {
  const copy = join(work, designSystemCopyName);
  startCopy(copy);
  for (const entry of DESIGN_SYSTEM_COPIED) {
    cpSync(join(designSystemDir, entry), join(copy, entry), { recursive: true });
  }
  const config = readFileSync(join(designSystemDir, "unframework.config.ts"), "utf8");
  writeFileSync(join(copy, "unframework.config.ts"), designSystemCopyConfig(config));
  const catalog = readCatalog(readFileSync(join(repoRoot, "pnpm-workspace.yaml"), "utf8"));
  const typescript6 = readManifest(join(repoRoot, "tests/toolchains/angular")).devDependencies
    .typescript;
  const { packageManager } = readManifest(repoRoot);
  const manifest = designSystemCopyManifest(tarballs, catalog, typescript6, packageManager);
  writeFileSync(join(copy, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(copy, "pnpm-workspace.yaml"), designSystemCopyWorkspace(tarballs));
  run(copy, "install", "--prefer-offline");
  for (const name of [
    "@uxfront/unframework",
    "@unframework.dev/testing",
    "@unframework.dev/visual",
  ]) {
    assertInstalledFromTarball(copy, name);
  }
  process.stdout.write(`[e2e] ${designSystemCopyName}: ${copy}\n`);
}

const COPIES = ["apps", "design-system"] as const;

// pnpm passes `--` on to the script.
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const only = args.indexOf("--only");
const copies = only === -1 ? COPIES : COPIES.filter((kind) => kind === args[only + 1]);
const flags = only === -1 ? args : args.toSpliced(only, 2);
if (only !== -1 && copies.length !== 1) {
  throw new Error(`--only takes ${COPIES.join(" or ")}, not: ${args[only + 1] ?? "nothing"}`);
}
if (flags.length > 1 || flags.some((flag) => flag !== "--pack" && flag !== "--reuse-tarballs")) {
  throw new Error(
    `prepare-apps takes --pack or --reuse-tarballs, or neither, and --only, not: ${flags.join(" ")}`,
  );
}
if (flags[0] === "--pack" && only !== -1)
  throw new Error("--pack installs no copy, so --only has nothing to select.");

if (flags[0] === "--pack") {
  buildAndPack();
  process.stdout.write(`[e2e] packed: ${tarballsDir}\n`);
} else {
  const packed = flags[0] === "--reuse-tarballs" ? readPacked() : buildAndPack();
  const work = workDir();
  if (copies.includes("apps")) installApps(packed, work);
  if (copies.includes("design-system")) installDesignSystem(packed, work);
}
