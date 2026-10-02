// The golden guard, on a case of its own in a temporary directory: what it compares does not
// depend on what the corpus holds.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { goldenGuard } from "./guard.ts";

const root = mkdtempSync(join(tmpdir(), "uf-guard-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const golden = "<template>\n  <p>Hello</p>\n</template>\n";
const caseDir = join(root, "cases", "area", "greeting");
const source = join(caseDir, "Greeting.uf.tsx");
mkdirSync(join(caseDir, "__output__", "vue"), { recursive: true });
writeFileSync(source, "export default function Greeting() {\n  return <p>Hello</p>;\n}\n");
writeFileSync(join(caseDir, "__output__", "vue", "Greeting.vue"), golden);

const guard = (target: string, files: { path: string; contents: string }[], file = source) =>
  goldenGuard({ file, target, files }, root);

describe("goldenGuard", () => {
  it("passes a compile that equals the golden files", () => {
    expect(guard("vue", [{ path: "Greeting.vue", contents: golden }])).toBeUndefined();
  });

  it("fails a difference with a diff and the command that updates the goldens", () => {
    const message = guard("vue", [
      { path: "Greeting.vue", contents: golden.replace("Hello", "Goodbye") },
    ]);
    expect(message).toMatch(
      /^\[uf guard\] The vue output of cases\/area\/greeting\/Greeting\.uf\.tsx is not its golden output:/,
    );
    expect(message).toContain("cases/area/greeting/__output__/vue/Greeting.vue differs");
    expect(message).toMatch(/^\+.*<p>Goodbye<\/p>$/m);
    expect(message).toContain("pnpm test:update");
  });

  it("fails missing and extra files", () => {
    const message = guard("vue", [{ path: "Other.vue", contents: "" }]);
    expect(message).toContain(
      "cases/area/greeting/__output__/vue/Greeting.vue is not produced by the compiler.",
    );
    expect(message).toContain("cases/area/greeting/__output__/vue/Other.vue is missing.");
  });

  it("fails a target without golden files, and passes one that produces none", () => {
    expect(guard("react", [{ path: "Greeting.tsx", contents: "" }])).toContain(
      "cases/area/greeting/__output__/react/Greeting.tsx is missing.",
    );
    expect(guard("react", [])).toBeUndefined();
  });
});
