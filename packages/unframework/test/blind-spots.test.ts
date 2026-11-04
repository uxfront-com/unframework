// The component-API blind spots the types leave to the compiler (ADR-0023, "Open"): compiled with
// their fixtures, each reports the code its comment in `probes/allowed/blind-spots.uf.tsx` names.
// Each is asserted present, not alone on its line. The file's other "Caught by: compiler" spots
// are not asserted here.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { compile, createFileResolver, createSyntacticOracle } from "@unframework/compiler";
import { beforeAll, describe, expect, it } from "vitest";

import { PROBES_DIRECTORY } from "../scripts/run-probes.ts";

const FILE = "allowed/blind-spots.uf.tsx";

/** Each spot's line, the code its comment names, and a mark that the line still holds it. */
const SPOTS = [
  { line: 33, code: "UF3036", mark: "onChnage", spot: "an unknown event" },
  {
    line: 35,
    code: "UF3038",
    mark: "Unexpected children",
    spot: "children without a default slot",
  },
  { line: 37, code: "UF3037", mark: "v-model:opne", spot: "an unknown model" },
  { line: 39, code: "UF3038", mark: "footer:", spot: "an undeclared slot key" },
];

const readFixture = (path: string) => readFile(path, "utf8").catch(() => undefined);

async function compileBlindSpots() {
  const typeOracle = createSyntacticOracle({ root: PROBES_DIRECTORY, readFile: readFixture });
  try {
    const source = await readFile(join(PROBES_DIRECTORY, FILE), "utf8");
    const result = await compile(source, {
      filename: FILE,
      targets: [],
      resolve: createFileResolver({ root: PROBES_DIRECTORY, readFile: readFixture, typeOracle }),
      typeOracle,
    });
    const lineOf = (offset: number) => source.slice(0, offset).split("\n").length;
    return {
      lines: source.split("\n"),
      reported: result.diagnostics
        .filter((diagnostic) => diagnostic.file === FILE && diagnostic.span)
        .map((diagnostic) => ({ code: diagnostic.code, line: lineOf(diagnostic.span.start) })),
    };
  } finally {
    await typeOracle.dispose();
  }
}

describe("the blind spots the compiler catches", () => {
  let compiled: Awaited<ReturnType<typeof compileBlindSpots>>;
  beforeAll(async () => {
    compiled = await compileBlindSpots();
  });

  it.each(SPOTS)("reports $code for $spot at line $line", ({ line, code, mark }) => {
    expect(compiled.lines[line - 1], `line ${line} holds the spot`).toContain(mark);
    expect(compiled.reported).toContainEqual({ code, line });
  });
});
