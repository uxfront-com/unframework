import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { project, run } from "./helpers.ts";

const BROKEN = {
  "unframework.config.mjs": 'export default { targets: ["vue"] };\n',
  "src/Widget.uf.tsx":
    'import { useState } from "react";\n\nexport default function Widget() {\n  return <i />;\n}\n',
};
const CLEAN = {
  "unframework.config.mjs": 'export default { targets: ["vue"] };\n',
  "src/Widget.uf.tsx": "export default function Widget() {\n  return <i />;\n}\n",
};

describe("check", () => {
  it("prints a code frame by default, and writes no file", async () => {
    const root = project(BROKEN);
    const { code, stdout } = await run(root, "check");
    expect(code).toBe(1);
    expect(stdout).toMatchSnapshot();
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it("prints --format pretty as the default does", async () => {
    const root = project(BROKEN);
    expect(await run(root, "check", "--format", "pretty")).toEqual(await run(root, "check"));
  });

  it("prints --format json", async () => {
    const { code, stdout } = await run(project(BROKEN), "check", "--format", "json");
    expect(code).toBe(1);
    expect(JSON.parse(stdout)).toMatchSnapshot();
  });

  it("prints --format sarif", async () => {
    const { code, stdout } = await run(project(BROKEN), "check", "--format=sarif");
    expect(code).toBe(1);
    expect(JSON.parse(stdout)).toMatchSnapshot();
  });

  it("exits 0 on a clean project, with each format's empty form", async () => {
    const root = project(CLEAN);
    expect(await run(root, "check")).toEqual({ code: 0, stdout: "", stderr: "" });
    expect(await run(root, "check", "--format", "json")).toEqual({
      code: 0,
      stdout: "[]\n",
      stderr: "",
    });
    const sarif = await run(root, "check", "--format", "sarif");
    expect(sarif.code).toBe(0);
    expect(JSON.parse(sarif.stdout).runs[0].results).toEqual([]);
    expect(existsSync(join(root, "dist"))).toBe(false);
  });

  it("reports no sources as UF7007 in every format, and exits 1", async () => {
    const root = project({});
    const pretty = await run(root, "check");
    expect(pretty.code).toBe(1);
    expect(pretty.stdout).toContain("error[UF7007]");
    const json = await run(root, "check", "--format", "json");
    expect(json.code).toBe(1);
    expect(JSON.parse(json.stdout)[0]).toMatchObject({ code: "UF7007", file: "src" });
    const sarif = await run(root, "check", "--format", "sarif");
    expect(sarif.code).toBe(1);
    expect(JSON.parse(sarif.stdout).runs[0].results[0].ruleId).toBe("UF7007");
    const here = project({ "unframework.config.mjs": 'export default { srcDir: "." };\n' });
    const dot = await run(here, "check", "--format", "json");
    expect(JSON.parse(dot.stdout)[0]).toMatchObject({ code: "UF7007", file: "." });
  });

  it("exits 2 on a config that won't load, in every format", async () => {
    const root = project({ "unframework.config.mjs": "throw new Error('nope');\n" });
    const pretty = await run(root, "check");
    expect(pretty.code).toBe(2);
    expect(pretty.stdout).toContain("error[UF7001]");
    const json = await run(root, "check", "--format", "json");
    expect(json.code).toBe(2);
    expect(JSON.parse(json.stdout)[0]).toMatchObject({ code: "UF7001" });
  });

  it("exits 2 on a config of the wrong shape, and on an unknown target", async () => {
    const wrong = project({ "unframework.config.mjs": "export default { strict: 1 };\n" });
    const shape = await run(wrong, "check");
    expect(shape.code).toBe(2);
    expect(shape.stdout).toContain("error[UF7002]");
    const unknown = project({
      "unframework.config.mjs": 'export default { targets: ["reakt"] };\n',
    });
    const target = await run(unknown, "check", "--format", "sarif");
    expect(target.code).toBe(2);
    expect(JSON.parse(target.stdout).runs[0].results[0].ruleId).toBe("UF7003");
  });

  it("exits 2 on a usage error, and says why", async () => {
    const root = project(CLEAN);
    const format = await run(root, "check", "--format", "xml");
    expect(format).toMatchObject({ code: 2, stdout: "" });
    expect(format.stderr).toContain('--format takes pretty, json or sarif, not "xml"');
    const oracle = await run(root, "check", "--type-oracle", "nope");
    expect(oracle.code).toBe(2);
    expect(oracle.stderr).toContain('--type-oracle takes syntactic or tsgo, not "nope"');
    expect((await run(root, "check", "--nope")).code).toBe(2);
    expect((await run(root, "check", "extra")).code).toBe(2);
    expect((await run(root, "check", "--format")).code).toBe(2);
    expect((await run(root, "build", "--format", "json")).code).toBe(2);
    expect((await run(root, "build", "extra")).code).toBe(2);
  });

  it("agrees with build, whose checks it runs", async () => {
    const root = project({
      ...CLEAN,
      "src/a/Same.uf.tsx": "export default function Same() {\n  return <i>a</i>;\n}\n",
      "src/b/Same.uf.tsx": "export default function Same() {\n  return <i>b</i>;\n}\n",
    });
    const { code, stdout } = await run(root, "check");
    expect(code).toBe(1);
    expect(stdout).toContain("error[UF1104]");
    expect(existsSync(join(root, "dist"))).toBe(false);
  });
});
