import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { run, tree, write } from "../helpers.ts";
import { check, consumer, designSystem, inRepository, SOURCE_TREE } from "./helpers.ts";

const qwik = (under?: string) =>
  designSystem({
    config: { targets: ["qwik"], package: { resolveFrom: inRepository("tests/integration") } },
    frameworks: ["@qwik.dev/core"],
    ...(under ? { under } : {}),
  });

const packaged = async (under?: string) => {
  const root = qwik(under);
  const { code, stderr } = await run(root, "build", "--package");
  // The sheet-order note every styled Qwik component gets.
  expect(stderr).not.toContain("error[");
  expect(code).toBe(0);
  return root;
};

describe("build --package: Qwik", () => {
  it("builds one .qwik.mjs under the qwik condition, with declarations beside it", async () => {
    // Qwik's plugin reports on the console directly, past `main`'s `io`.
    const warn = vi.spyOn(console, "warn");
    const error = vi.spyOn(console, "error");
    const root = await packaged();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    const files = tree(join(root, "dist", "package"));
    expect(Object.keys(files)).toEqual(
      [
        "package.json",
        "qwik/Card.d.ts",
        "qwik/CardTitle.d.ts",
        "qwik/index.d.ts",
        "qwik/index.qwik.mjs",
        "qwik/shared/format.d.ts",
        "qwik/useToggle.d.ts",
        ...SOURCE_TREE,
      ].toSorted(),
    );
    const bundle = files["qwik/index.qwik.mjs"] ?? "";
    // The optimiser ran in library mode: every QRL is inline, for the app's optimiser to split.
    expect(bundle).toContain("inlinedQrl");
    expect(bundle).toContain('from "@qwik.dev/core"');
    expect(bundle).toContain("export {");
    // `?inline` was resolved, so the sheet travels in the module and needs no file of its own.
    expect(bundle).toContain(".card[data-uf-");
    expect(bundle).not.toContain("?inline");
    expect(files["qwik/Card.d.ts"]).toContain('import("@qwik.dev/core").Component<');
    expect(files["qwik/useToggle.d.ts"]).toContain("Signal<boolean>");
    const manifest = JSON.parse(files["package.json"] ?? "");
    expect(manifest.exports["./qwik"]).toEqual({
      types: "./qwik/index.d.ts",
      qwik: "./qwik/index.qwik.mjs",
      default: "./qwik/index.qwik.mjs",
    });
    // Conditions match in order: `default` before `qwik` would hide it.
    expect(Object.keys(manifest.exports["./qwik"])).toEqual(["types", "qwik", "default"]);
    expect(manifest.peerDependencies).toEqual({ "@qwik.dev/core": "^2.0.0-beta.47" });
  });

  it.each(["R&D", "C++"])("gives the same package under a directory named %s", async (under) => {
    const expected = tree(join(await packaged(), "dist", "package"));
    expect(tree(join(await packaged(under), "dist", "package"))).toEqual(expected);
  });

  it("keeps import.meta.env for the app's build, and nothing of this one's", async () => {
    vi.stubEnv("VITE_PACKAGING_SECRET", "leaked");
    try {
      const root = qwik();
      write(root, {
        ".env": "VITE_FROM_FILE=leaked\n",
        "src/shared/format.ts": `export const formatLabel = (label: string): string =>
  label + import.meta.env.VITE_PACKAGING_SECRET + import.meta.env.VITE_FROM_FILE + import.meta.env.DEV;
`,
      });
      const { code, stderr } = await run(root, "build", "--package");
      expect(stderr).not.toContain("error[");
      expect(code).toBe(0);
      const bundle = tree(join(root, "dist", "package"))["qwik/index.qwik.mjs"] ?? "";
      expect(bundle).toContain("import.meta.env.VITE_PACKAGING_SECRET");
      expect(bundle).toContain("import.meta.env.DEV");
      expect(bundle).not.toContain("leaked");
      expect(bundle).not.toContain("__unframework");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("keeps a passed-through module an import, and out of the declarations", async () => {
    const root = qwik();
    write(root, {
      "src/Styled.uf.tsx": `import { tone } from "virtual:styled";

import "virtual:styled.css";

export default function Styled() {
  return <p class={tone()}>Hi</p>;
}
`,
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(stderr).not.toContain("error[");
    expect(code).toBe(0);
    const files = tree(join(root, "dist", "package"));
    expect(files["qwik/index.qwik.mjs"]).toContain('from "virtual:styled"');
    expect(files["qwik/index.qwik.mjs"]).toContain('import "virtual:styled.css"');
    expect(files["qwik/Styled.d.ts"]).not.toContain("virtual:styled.css");
  });

  it("puts a dynamic import in the one file, as a chunk wouldn't be named .qwik.mjs", async () => {
    const root = qwik();
    write(root, {
      "src/shared/format.ts": `export const formatLabel = (label: string): string => {
  void import("./lazy");
  return label;
};
`,
      "src/shared/lazy.ts": "export const lazyValue = 41;\n",
    });
    expect((await run(root, "build", "--package")).code).toBe(0);
    const files = tree(join(root, "dist", "package"));
    expect(Object.keys(files).filter((file) => file.endsWith("js"))).toEqual([
      "qwik/index.qwik.mjs",
    ]);
    expect(files["qwik/index.qwik.mjs"]).toContain("lazyValue");
  });

  it("types a consumer that imports the subpath, and stops one that misuses it", async () => {
    const root = await packaged();
    const directory = consumer(root, "qwik", {
      "Consumer.tsx": `import { component$ } from "@qwik.dev/core";
import { Card, useToggle } from "demo-ds/qwik";

export const Consumer = component$(() => {
  const { on } = useToggle(true);
  return (
    <>
      <Card label={String(on.value)} />
      {/* @ts-expect-error label is a string. */}
      <Card label={1} />
    </>
  );
});
`,
    });
    const { code, output } = check("tests/toolchains/qwik", "tsc", ["-p", directory]);
    expect(output).toBe("");
    expect(code).toBe(0);
  });

  it("reports a syntax error as UF7009, and keeps the last good package", async () => {
    const root = await packaged();
    const before = tree(join(root, "dist", "package"));
    write(root, { "src/shared/format.ts": "export const formatLabel = (;\n" });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7009");
    expect(stderr).toContain("(qwik)");
    expect(stderr).toContain("dist/qwik/shared/format.ts");
    expect(stderr).not.toContain(".package-");
    expect(stderr).not.toMatch(/^\s+at /m);
    expect(tree(join(root, "dist", "package"))).toEqual(before);
  });

  it("reports a declaration tsc can't write as UF7009", async () => {
    const root = await packaged();
    write(root, {
      "src/shared/format.ts": `export const formatLabel = (label: string): string => label.trim();
export const Klass = class {
  private y = 1;
};
`,
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7009");
    expect(stderr).toContain("TS4094");
    expect(stderr).toContain("dist/qwik/shared/format.ts");
  });

  it.each([
    ["vite", ["@qwik.dev/core"]],
    ["@qwik.dev/core", ["vite"]],
    ["typescript", ["vite", "@qwik.dev/core"]],
  ] as const)("fires UF7008 naming %s, before anything is written", async (missing, frameworks) => {
    const root = designSystem({ config: { targets: ["qwik"] }, frameworks });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7008");
    expect(stderr).toContain("(qwik)");
    // The package's name, not the file of it that this reads.
    expect(stderr).toContain(`needs ${missing},`);
    expect(existsSync(join(root, "dist"))).toBe(false);
  });
});
