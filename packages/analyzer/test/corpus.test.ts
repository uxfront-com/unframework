// The corpus (tests/integration/cases) as the analyser reads it: each diagnostics case triggers
// exactly the code it is named after, and every other case compiles without an error, with the
// warnings its golden diagnostics hold. The harness's L1 checks the same through the compiler;
// this keeps the analyser's own suite from accepting a rule that misfires on a valid source.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { catalogue } from "@unframework/diagnostics";
import { parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

import { analyze } from "../src/index.ts";

const CASES = new URL("../../../tests/integration/cases/", import.meta.url).pathname;

/** The case sources under a directory, relative to the cases' root, sorted. */
function sources(directory: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(directory)) {
    if (name.startsWith("__") || name.startsWith(".")) continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) found.push(...sources(path));
    else if (name.endsWith(".uf.tsx")) found.push(relative(CASES, path));
  }
  return found.toSorted();
}

/** The diagnostics cases whose name is not their code's catalogue name, with that code. */
const NAMED_OTHERWISE: Readonly<Record<string, string>> = {
  "arrow-component": "UF1102",
  "framework-import-rejected": "UF1201",
  "non-canonical-event": "UF3004",
  "nullable-bound-value": "UF1002",
};

/** The warnings the corpus's feature cases hold on purpose. */
const WARNINGS: Readonly<Record<string, readonly string[]>> = {
  "jsx/escaping/TemplateTip.uf.tsx": ["UF3011"],
  "semantics/setup-once/WelcomeBanner.uf.tsx": ["UF2007"],
};

const codesByName = new Map([...catalogue.values()].map((entry) => [entry.name, entry.code]));

describe("the corpus", () => {
  const all = sources(CASES);

  it.each(all.filter((file) => file.startsWith("diagnostics/")))(
    "%s triggers exactly its code",
    (file) => {
      const name = file.split("/")[1]!;
      const code = NAMED_OTHERWISE[name] ?? codesByName.get(name);
      expect(code, `no code is named ${name}`).toBeDefined();
      const { diagnostics } = analyze(parseModule(file, readFileSync(join(CASES, file), "utf8")));
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(new Set(diagnostics.map((diagnostic) => diagnostic.code))).toEqual(new Set([code]));
    },
  );

  it.each(all.filter((file) => !file.startsWith("diagnostics/")))(
    "%s compiles with no error, and only its own warnings",
    (file) => {
      const { module, diagnostics } = analyze(
        parseModule(file, readFileSync(join(CASES, file), "utf8")),
      );
      expect(module).toBeDefined();
      expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(WARNINGS[file] ?? []);
    },
  );
});
