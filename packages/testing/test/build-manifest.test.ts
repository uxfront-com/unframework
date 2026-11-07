import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BUILD_MANIFEST,
  manifestEvents,
  readBuildManifest,
  writeBuildManifest,
} from "../src/node/build-manifest.ts";
import type { BuildManifest } from "../src/node/build-manifest.ts";

const manifest: BuildManifest = {
  target: "vue",
  root: "/root",
  modules: {
    "/root/b/B.uf.tsx": { events: [{ name: "change", optional: [false] }] },
    "/root/a/A.uf.tsx": { error: "two components declare different events" },
  },
  failures: [
    { module: "/root/c/C.uf.tsx.vue", cause: "ngtsc refused it" },
    { module: "/root/d/D.uf.tsx.vue", cause: "plugin-vue refused it" },
    { module: "/root/d/D.uf.tsx.vue", cause: "the unplugin refused it" },
  ],
};

describe("the build manifest", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "uf-manifest-"));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("reads what it wrote", () => {
    writeBuildManifest(directory, manifest);
    expect(readBuildManifest(directory)).toEqual(manifest);
    expect(readBuildManifest(directory).failures).toEqual(manifest.failures);
  });

  it("writes one text for two equal builds, whatever order they compiled in", () => {
    writeBuildManifest(directory, manifest);
    const text = readFileSync(join(directory, BUILD_MANIFEST), "utf8");
    writeBuildManifest(directory, {
      ...manifest,
      modules: Object.fromEntries(Object.entries(manifest.modules).toReversed()),
      failures: manifest.failures.toReversed(),
    });
    expect(readFileSync(join(directory, BUILD_MANIFEST), "utf8")).toBe(text);
    expect(text.indexOf("/root/a/A.uf.tsx")).toBeLessThan(text.indexOf("/root/b/B.uf.tsx"));
  });

  it("says to build first when there is none", () => {
    expect(() => readBuildManifest(directory)).toThrow("build the Storybook first");
  });

  it("gives a main module's events", () => {
    expect(manifestEvents(manifest, "/root/b/B.uf.tsx")).toEqual([
      { name: "change", optional: [false] },
    ]);
  });

  it("throws for a module the build did not compile, or whose events it can't tell", () => {
    expect(() => manifestEvents(manifest, "/root/z/Z.uf.tsx")).toThrow(
      "The vue build compiled no main module /root/z/Z.uf.tsx",
    );
    expect(() => manifestEvents(manifest, "/root/a/A.uf.tsx")).toThrow("different events");
  });
});
