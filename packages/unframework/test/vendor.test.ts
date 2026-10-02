import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  readUpstream,
  renderVendoredJsx,
  VENDORED_FILE,
  type UpstreamSnapshot,
} from "../scripts/vendor-jsx.ts";

const SOURCE = fileURLToPath(new URL("../src", import.meta.url));

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/** A minimal upstream with the shape the script cuts from. */
function upstream(overrides: Partial<UpstreamSnapshot> = {}): UpstreamSnapshot {
  return {
    version: "3.5.43",
    pinned: "3.5.43",
    license: "MIT",
    declarations: [
      "import * as CSS from 'csstype';",
      "export interface CSSProperties extends CSS.Properties<string | number> {}",
      "export interface ReservedProps {",
      "    ref?: VNodeRef | undefined;",
      "}",
      "export type NativeElements = {",
      "    div: ReservedProps;",
      "};",
      "export declare const render: unknown;",
    ].join("\n"),
    licenceText: "The MIT License (MIT)\n\nCopyright (c) 2018-present, Yuxi (Evan) You\n",
    ...overrides,
  };
}

describe("the vendored JSX types", () => {
  it("are up to date with the pinned @vue/runtime-dom (run `pnpm --filter unframework vendor:jsx`)", () => {
    expect(readFileSync(VENDORED_FILE, "utf8")).toBe(renderVendoredJsx(readUpstream()));
  });

  it("are reached only through the owned alias, src/jsx-upstream.ts", () => {
    const importers = readdirSync(SOURCE, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => join(entry.parentPath, entry.name))
      .filter((file) => !file.includes(join("src", "vendor")))
      .filter((file) => /["'](?:\.{1,2}\/)+vendor\//.test(readFileSync(file, "utf8")))
      .map((file) => file.slice(SOURCE.length + 1));
    expect(importers).toEqual(["jsx-upstream.ts"]);
  });
});

describe("renderVendoredJsx", () => {
  it("copies the region verbatim below a header that records its provenance and licence", () => {
    const input = upstream();
    const output = renderVendoredJsx(input);
    const body = input.declarations.split("\n").slice(1, 8).join("\n") + "\n";

    expect(output.endsWith(`\n${body}`)).toBe(true);
    expect(output).toContain("@vue/runtime-dom@3.5.43, dist/runtime-dom.d.ts lines 2-8");
    expect(output).toContain(`Upstream file sha256: ${sha256(input.declarations)}`);
    expect(output).toContain(`Body sha256:          ${sha256(body)} (no local changes)`);
    expect(output).toContain("Licence:  MIT. Copyright (c) 2018-present, Yuxi (Evan) You.");
    expect(output).toContain(" *   The MIT License (MIT)");
    expect(output).toContain(`import type * as CSS from "csstype";\n`);
    expect(output).toContain("type VNodeRef = unknown;");
    expect(output).not.toContain("export declare const render");
  });

  it("refuses an upstream that is not pinned exactly", () => {
    expect(() => renderVendoredJsx(upstream({ pinned: "^3.5.43" }))).toThrow(
      "@vue/runtime-dom: installed 3.5.43, pinned ^3.5.43. Pin it exactly in devDependencies and reinstall.",
    );
    expect(() => renderVendoredJsx(upstream({ pinned: undefined }))).toThrow("pinned nothing");
  });

  it("refuses an upstream whose JSX region it cannot find", () => {
    const declarations = upstream().declarations.replace("export type NativeElements", "type X");
    expect(() => renderVendoredJsx(upstream({ declarations }))).toThrow(
      "the upstream changed shape",
    );
  });

  it("refuses a region that now depends on something outside it", () => {
    const declarations = upstream().declarations.replace(
      "export interface ReservedProps {",
      "import type { VNode } from '@vue/runtime-core';\nexport interface ReservedProps {",
    );
    expect(() => renderVendoredJsx(upstream({ declarations }))).toThrow(
      "the JSX region now contains `import `",
    );
  });

  it("refuses a licence without a copyright line", () => {
    expect(() => renderVendoredJsx(upstream({ licenceText: "MIT\n" }))).toThrow(
      "no Copyright line",
    );
  });
});
