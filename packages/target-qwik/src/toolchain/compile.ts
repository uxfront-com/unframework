// L3 for Qwik: the Rust optimizer, the compiler a Qwik build runs. It is imported from
// @qwik.dev/optimizer directly: @qwik.dev/core/optimizer only exports the Vite and Rolldown
// plugins at runtime (its d.ts still declares createOptimizer), and the direct import also
// bypasses `QWIK_OPTIMIZER=ts`. The TypeScript optimizer silently repairs a mismatched closing
// tag, so it can never be the L3 compiler. The Rust optimizer repairs one too when the tag is
// nested (`<div><h2>…</span></div>` compiles without a diagnostic), so every file is also
// parsed strictly as TSX first: output that is not valid TSX never passes as accepted.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname } from "node:path";

import type { Diagnostic, Optimizer, TransformModulesOptions } from "@qwik.dev/optimizer";
import type { FrameworkCompileResult, ToolchainFile, ToolchainMessage } from "@unframework/codegen";
import { assertFilesToCompile } from "@unframework/codegen/toolchain-node";
import { parseSync } from "oxc-parser";

const require = createRequire(import.meta.url);
let optimizer: Promise<Optimizer> | undefined;

/**
 * Runs the optimizer's `transformModules` on each file, for the client and then the server,
 * with the `segment` entry strategy so `$` closures are extracted as in a real build.
 * Diagnostics of category `error` and `sourceError` are errors; `warning` is a warning. A file
 * the optimizer throws on gets that error, so one bad file never hides the others.
 */
export async function compileWithOptimizer(
  files: readonly ToolchainFile[],
): Promise<Map<string, FrameworkCompileResult>> {
  assertFilesToCompile(files);
  optimizer ??= loadOptimizer();
  const qwik = await optimizer;
  const results = new Map<string, FrameworkCompileResult>();
  for (const file of files) {
    const result: FrameworkCompileResult = { errors: syntaxErrors(file), warnings: [] };
    const seen = new Set<string>();
    for (const isServer of [false, true]) {
      const options: TransformModulesOptions = {
        input: [{ path: basename(file.path), code: file.contents }],
        srcDir: dirname(file.path),
        entryStrategy: { type: "segment" },
        minify: "simplify",
        transpileTs: true,
        transpileJsx: true,
        explicitExtensions: true,
        mode: "dev",
        isServer,
      };
      let diagnostics: readonly Diagnostic[];
      try {
        ({ diagnostics } = await qwik.transformModules(options));
      } catch (error) {
        result.errors.push({
          message: `The Qwik optimizer threw on the ${isServer ? "server" : "client"} pass: ${error instanceof Error ? error.message : String(error)}`,
        });
        continue;
      }
      // The client and server passes report most problems twice; keep one of each.
      for (const diagnostic of diagnostics) {
        const message = toMessage(diagnostic);
        const key = `${diagnostic.category}|${message.code}|${message.line}|${message.column}|${message.message}`;
        if (seen.has(key)) continue;
        seen.add(key);
        (diagnostic.category === "warning" ? result.warnings : result.errors).push(message);
      }
    }
    results.set(file.path, result);
  }
  return results;
}

/**
 * Creates the optimizer once, after checking it is the one @qwik.dev/core itself runs. Loaded
 * on first use: the harness imports every toolchain to build its configuration.
 */
async function loadOptimizer(): Promise<Optimizer> {
  const ours = versionOf("@qwik.dev/optimizer", require);
  const core = createRequire(require.resolve("@qwik.dev/core/package.json"));
  const theirs = versionOf("@qwik.dev/optimizer", core);
  if (ours !== theirs) {
    throw new Error(
      `L3 cannot start: @qwik.dev/core runs @qwik.dev/optimizer@${theirs}, but the Qwik toolchain loads ${ours}. Pin them to the same version.`,
    );
  }
  const { createOptimizer } = await import("@qwik.dev/optimizer");
  return createOptimizer();
}

function versionOf(name: string, from: NodeJS.Require): string {
  const manifest: unknown = JSON.parse(readFileSync(from.resolve(`${name}/package.json`), "utf8"));
  if (typeof manifest !== "object" || manifest === null || !("version" in manifest)) {
    throw new Error(`${name}'s package.json has no version.`);
  }
  return String(manifest.version);
}

/** Parses a file strictly as TSX, and returns its syntax errors with 1-based positions. */
function syntaxErrors(file: ToolchainFile): ToolchainMessage[] {
  const { errors } = parseSync(file.path, file.contents, { lang: "tsx", sourceType: "module" });
  return errors.map((error) => {
    const offset = error.labels[0]?.start ?? 0;
    const before = file.contents.slice(0, offset).split("\n");
    return {
      message: `Not valid TSX: ${error.message}`,
      line: before.length,
      column: before.at(-1)!.length + 1,
      code: "TSX_SYNTAX",
    };
  });
}

/** The optimizer's lines and columns are both 1-based, as the toolchain contract's are. */
function toMessage(diagnostic: Diagnostic): ToolchainMessage {
  const [at] = diagnostic.highlights ?? [];
  return {
    message: diagnostic.message,
    ...(at ? { line: at.startLine, column: at.startCol } : {}),
    ...(diagnostic.code ? { code: diagnostic.code } : {}),
  };
}
