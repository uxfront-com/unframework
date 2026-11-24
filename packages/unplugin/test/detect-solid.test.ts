// The "solid" plugin is both Solid majors' (ADR-0102): vite-plugin-solid and @solidjs/vite-plugin
// register one name, so the unplugin reads the major of the `solid-js` the app resolves.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { detectTarget, solidMajor } from "../src/detect.ts";

const roots: string[] = [];

/** A project root whose `solid-js` is `version`, or none. */
function project(version?: string): string {
  const root = mkdtempSync(join(tmpdir(), "uf-solid-major-"));
  roots.push(root);
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "app", private: true }));
  if (version !== undefined) {
    const dir = join(root, "node_modules", "solid-js");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "solid-js", version }));
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("solid@2 detection", () => {
  it("detects solid@2 from the solid plugin where the app resolves solid-js 2.x", () => {
    const root = project("2.0.0");
    expect(solidMajor(root)).toBe(2);
    expect(detectTarget([{ name: "solid" }], "vite.config.ts", root)).toEqual({ target: "solid2" });
  });

  it("detects solid@1 from the same plugin where the app resolves solid-js 1.x", () => {
    const root = project("1.9.15");
    expect(solidMajor(root)).toBe(1);
    expect(detectTarget([{ name: "solid" }], "vite.config.ts", root)).toEqual({ target: "solid" });
  });

  it("keeps solid@1, as before solid@2, where the app installs no solid-js", () => {
    // What resolves past the root (a global install) is the machine's: only the outcome counts.
    const root = project();
    expect(solidMajor(root)).not.toBe(2);
    expect(detectTarget([{ name: "solid" }], "vite.config.ts", root)).toEqual({ target: "solid" });
  });

  it("names one Solid target beside another framework's plugin, UF7006", () => {
    const root = project("2.0.0");
    const detected = detectTarget(
      [{ name: "solid" }, { name: "vite:vue" }],
      "vite.config.ts",
      root,
    );
    expect(detected).toEqual({ error: expect.stringContaining("UF7006") });
    expect("error" in detected && detected.error).toContain("solid2 (solid)");
    expect("error" in detected && detected.error).not.toContain("solid (solid)");
  });
});
