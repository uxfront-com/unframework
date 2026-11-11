// `@uxfront/unframework/config` (plan §8.1, ADR-0016): the entry a project's `unframework.config.ts` imports.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { defineConfig } from "../src/config.ts";

const PACKAGE = fileURLToPath(new URL("..", import.meta.url));
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("defineConfig", () => {
  it("returns the configuration it is given", () => {
    const config = { targets: ["vue"] as const };
    expect(defineConfig(config)).toBe(config);
  });

  // Node's own import: Vitest's module runner would compile the file instead of stripping its types.
  it(
    "writes a config that loadConfig reads under Node's type stripping",
    { timeout: 30_000 },
    () => {
      // Inside the package, so that `@uxfront/unframework/config` resolves by its own name. `.probes-*` is ignored.
      const root = mkdtempSync(join(PACKAGE, ".probes-config-"));
      directories.push(root);
      writeFileSync(
        join(root, "unframework.config.ts"),
        `import { defineConfig } from "@uxfront/unframework/config";
import type { UnframeworkConfig } from "@uxfront/unframework/config";

const config: UnframeworkConfig = { targets: ["vue"], srcDir: "components" };
export default defineConfig(config);
`,
      );
      const script = `import { loadConfig, resolveConfig } from "@unframework.dev/compiler";
const loaded = await loadConfig(process.argv[1]);
const resolved = await resolveConfig(loaded.raw, loaded);
console.log(JSON.stringify({ loaded: loaded.diagnostics, ...resolved }));`;
      const run = spawnSync(process.execPath, ["--input-type=module", "-e", script, root], {
        cwd: PACKAGE,
        encoding: "utf8",
      });
      expect(JSON.parse(run.stdout)).toMatchObject({
        loaded: [],
        diagnostics: [],
        config: { targets: ["vue"], srcDir: join(root, "components") },
      });
    },
  );
});
