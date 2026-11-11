import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import { parseArgs } from "node:util";

import type { OutputFile } from "@unframework.dev/compiler";
import { formatDiagnostics } from "@unframework.dev/diagnostics";

import type { RunCommand } from "./command.ts";
import { compileSources, printable, TYPE_ORACLE_OPTION } from "./compilation.ts";
import { PACKAGE_DIRECTORY, planPackage } from "./package/index.ts";

/** The outputs a `sourceMappingURL` comment can sit in: a sheet or a template has another syntax. */
const JS_OR_TS = /\.[cm]?[jt]sx?$/;

export const run: RunCommand = async (args, io) => {
  const { values } = parseArgs({
    args,
    options: { ...TYPE_ORACLE_OPTION, package: { type: "boolean" } },
  });
  const compilation = await compileSources(
    io,
    values["type-oracle"],
    values.package ? [PACKAGE_DIRECTORY] : [],
  );
  const { status, diagnostics, sources, config, trees, root, authored, configFile } = compilation;
  io.stderr(printable(formatDiagnostics(diagnostics, sources)));
  // A failed build leaves the last good one in place: nothing is cleaned or written.
  if (status !== 0 || !config) return status;
  const plan = values.package
    ? await planPackage({ root, config, trees, authored, configFile })
    : undefined;
  if (plan && plan.diagnostics.length > 0) {
    io.stderr(printable(formatDiagnostics(plan.diagnostics, sources)));
    return 1;
  }
  for (const [target, files] of trees) {
    const directory = join(config.outDir, target);
    await rm(directory, { recursive: true, force: true });
    for (const file of files) await writeOutput(directory, file, config.srcDir);
  }
  const failed = (await plan?.run()) ?? [];
  io.stderr(printable(formatDiagnostics(failed, sources)));
  return failed.length > 0 ? 1 : 0;
};

async function writeOutput(directory: string, file: OutputFile, srcDir: string): Promise<void> {
  const path = join(directory, file.path);
  await mkdir(dirname(path), { recursive: true });
  if (!file.map || !JS_OR_TS.test(file.path)) {
    await writeFile(path, file.contents);
    return;
  }
  const end = file.contents.endsWith("\n") ? "" : "\n";
  await writeFile(path, `${file.contents}${end}//# sourceMappingURL=${basename(path)}.map\n`);
  // `compile()` names a source relative to a file beside it. Each tree mirrors srcDir, so the
  // source is at the file's own path there, and the map names it from where the file was written.
  const sources = file.map.sources.map((source) =>
    relative(dirname(path), join(srcDir, dirname(file.path), source))
      .split(sep)
      .join("/"),
  );
  await writeFile(`${path}.map`, JSON.stringify({ ...file.map, sources }));
}
