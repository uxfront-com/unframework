import type * as Codegen from "@unframework/codegen";
import { describe, expect, it, vi } from "vitest";

import { compile } from "../src/index.ts";

// oxfmt leaves words alone, so only a formatter that broke reaches UF9002 (ADR-0074).
vi.mock("@unframework/codegen", async (original) => ({
  ...(await original<typeof Codegen>()),
  formatOutput: async (file: { path: string }) => ({
    file: { ...file, contents: "export const nothing = 0;\n" },
  }),
}));

describe("compile with sourceMap, when a map can't follow formatting", () => {
  it("reports UF9002, with its file and target, and keeps the file without a map", async () => {
    const source = `export function Card() {\n  const label = "a long label of its own";\n  return <p>{label}</p>;\n}\n`;
    const result = await compile(source, {
      filename: "src/Card.uf.tsx",
      targets: ["react"],
      sourceMap: true,
    });
    expect(
      result.diagnostics
        .filter(({ code }) => code === "UF9002")
        .map(({ file, target, severity }) => [file, target, severity]),
    ).toEqual([["src/Card.uf.tsx", "react", "error"]]);
    const file = result.outputs.react![0]!;
    expect(file.contents).toBe("export const nothing = 0;\n");
    expect(file).not.toHaveProperty("map");
  });
});
