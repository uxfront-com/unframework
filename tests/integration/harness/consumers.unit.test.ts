// L4's consumer check (ADR-0059): directives read from the fixtures, the inverted judging, the
// copies a canary checks, and the fixture trees, which must name cases of the corpus.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ToolchainMessage } from "@unframework/codegen";
import { TARGET_NAMES } from "@unframework/compiler";
import { afterAll, describe, expect, it } from "vitest";

import { listCases } from "./cases.ts";
import {
  consumerCases,
  consumerFixtures,
  consumerProblems,
  copyFixtures,
  readExpectations,
} from "./consumers.ts";
import type { Fixture } from "./consumers.ts";
import { CASES_DIR } from "./paths.ts";

const info = listCases().find(({ id }) => id === "events/emit-payloads")!;
const vue = (name: string) =>
  consumerFixtures("vue", info.id).find((path) => path.endsWith(`/${name}`))!;
const scratch = mkdtempSync(join(tmpdir(), "uf-consumers-"));

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** A fixture written to the scratch directory, checked as itself. */
function fixture(name: string, contents: string): Fixture {
  const path = join(scratch, name);
  writeFileSync(path, contents);
  return { path, checked: path };
}

/** The results of a checker run over some fixtures. */
function results(
  entries: [Fixture, ToolchainMessage[]][],
): Map<string, readonly ToolchainMessage[]> {
  return new Map(entries.map(([{ checked }, messages]) => [checked, messages]));
}

const mismatch = (line: number): ToolchainMessage => ({
  code: "TS2322",
  message: "Type 'number' is not assignable to type 'string'.",
  line,
  column: 13,
});

describe("readExpectations", () => {
  it("reads a line comment and an HTML comment as the expectation of the next line", () => {
    const contents = [
      "export function MisuseProp() {",
      "  // @uf-expect TS2322 FileRow.prop:path",
      "  return <FileRow path={42} size={12} />;",
      "}",
      "<!-- @uf-expect TS2345 FileRow.event:open -->",
      '<uf-file-row (open)="open($event)" />',
    ].join("\n");
    expect(readExpectations(contents)).toEqual({
      expectations: [
        { line: 3, code: "TS2322", declaration: "FileRow.prop:path", kind: "prop" },
        { line: 6, code: "TS2345", declaration: "FileRow.event:open", kind: "event" },
      ],
      malformed: [],
    });
  });

  it("returns the line of every directive that does not read as one", () => {
    const contents = [
      "// @uf-expect FileRow.prop:path",
      "// @uf-expect TS2322 FileRow.attribute:path",
      "// @uf-expect TS2322 fileRow.prop:path",
      "// @uf-expect TS2322 FileRow.prop:path TS2345",
      "<!-- @uf-expect TS2322 FileRow.prop:path --><!-- @uf-expect TS2322 FileRow.prop:size -->",
    ].join("\n");
    expect(readExpectations(contents)).toEqual({
      expectations: [],
      malformed: [1, 2, 3, 4, 5],
    });
  });
});

describe("consumerProblems", () => {
  const prop = { path: vue("MisuseProp.vue"), checked: vue("MisuseProp.vue") };
  const consumer = { path: vue("Consumer.vue"), checked: vue("Consumer.vue") };

  it("passes when every directive is met on its line and the correct consumer is clean", () => {
    const checked = results([
      [prop, [mismatch(7)]],
      [consumer, []],
    ]);
    expect(consumerProblems("vue", info, [prop, consumer], checked)).toEqual([]);
    // A case without fixtures has nothing to judge.
    expect(consumerProblems("vue", info, [], checked)).toEqual([]);
  });

  it("fails an expected error that is missing, naming the declaration's .uf.tsx line", () => {
    expect(consumerProblems("vue", info, [prop], results([[prop, []]]))).toEqual([
      "tests/toolchains/vue/consumers/events/emit-payloads/MisuseProp.vue:7: expected TS2322 for FileRow.prop:path (FileRow.uf.tsx:9), got none",
    ]);
    // Another code on the line does not meet it, and is unexpected itself.
    const other = { ...mismatch(7), code: "TS2353", message: "Unknown property." };
    expect(consumerProblems("vue", info, [prop], results([[prop, [other]]]))).toEqual([
      "tests/toolchains/vue/consumers/events/emit-payloads/MisuseProp.vue:7: expected TS2322 for FileRow.prop:path (FileRow.uf.tsx:9), got none",
      "tests/toolchains/vue/consumers/events/emit-payloads/MisuseProp.vue:7: unexpected TS2353 Unknown property.",
    ]);
  });

  it("fails every diagnostic no directive expects, in a correct consumer too", () => {
    const checked = results([
      [prop, [mismatch(7), mismatch(6)]],
      [consumer, [mismatch(10), { code: "TS6053", message: "File not found." }]],
    ]);
    expect(consumerProblems("vue", info, [prop, consumer], checked)).toEqual([
      "tests/toolchains/vue/consumers/events/emit-payloads/MisuseProp.vue:6: unexpected TS2322 Type 'number' is not assignable to type 'string'.",
      "tests/toolchains/vue/consumers/events/emit-payloads/Consumer.vue:10: unexpected TS2322 Type 'number' is not assignable to type 'string'.",
      "tests/toolchains/vue/consumers/events/emit-payloads/Consumer.vue: unexpected TS6053 File not found.",
    ]);
  });

  it("fails a fixture the checker reported nothing for", () => {
    expect(consumerProblems("vue", info, [prop], new Map())).toEqual([
      "tests/toolchains/vue/consumers/events/emit-payloads/MisuseProp.vue: the checker reported nothing for this file.",
    ]);
  });

  it("fails a directive for a declared gap, an undeclared name, or one that does not read", () => {
    const event = fixture(
      "MisuseEvent.astro",
      "<!-- @uf-expect TS2322 FileRow.event:open -->\n<FileRow />\n",
    );
    const unknown = fixture(
      "MisuseName.vue",
      "<!-- @uf-expect TS2322 FileRow.prop:title -->\n<!-- @uf-expect TS2322 FileRow -->\n",
    );
    const astro = consumerProblems("astro", info, [event], results([[event, [mismatch(2)]]]));
    expect(astro).toHaveLength(1);
    expect(astro[0]).toMatch(
      /MisuseEvent\.astro:2: astro cannot check a component's events \(Astro has no events: .+\)\.$/,
    );
    const vueProblems = consumerProblems("vue", info, [unknown], results([[unknown, []]]));
    expect(vueProblems).toHaveLength(2);
    expect(vueProblems[0]).toMatch(/MisuseName\.vue:2: a directive reads `@uf-expect <code> /);
    expect(vueProblems[1]).toMatch(
      /MisuseName\.vue:2: FileRow\.prop:title is not declared in events\/emit-payloads's IR\.$/,
    );
  });
});

describe("copyFixtures", () => {
  it("copies a case's fixtures beside a canary's compile, importing it on the same lines", () => {
    const root = join(scratch, ".canary", "L4-consumer", "vue");
    const [copy] = copyFixtures([vue("MisuseProp.vue")], root, info.id);
    expect(copy!.path).toBe(vue("MisuseProp.vue"));
    expect(copy!.checked).toBe(
      join(root, "consumers", "events", "emit-payloads", "MisuseProp.vue"),
    );
    const original = readFileSync(copy!.path, "utf8");
    const copied = readFileSync(copy!.checked, "utf8");
    expect(original).toContain(
      '"../../../../../integration/cases/events/emit-payloads/__output__/vue/FileRow.vue"',
    );
    expect(copied).toBe(original.replace('"../../../../../integration/cases/', `"../../../cases/`));
    expect(copied.split("\n")).toHaveLength(original.split("\n").length);
  });
});

describe("the consumer fixtures", () => {
  const cases = new Set(listCases(CASES_DIR).map(({ id }) => id));

  it.each(TARGET_NAMES)("of %s name cases of the corpus, and exist", (target) => {
    const trees = consumerCases(target);
    expect(trees.length).toBeGreaterThan(0);
    for (const id of trees) {
      expect(cases.has(id), `tests/toolchains/${target}/consumers/${id}`).toBe(true);
      expect(consumerFixtures(target, id).length, id).toBeGreaterThan(0);
    }
  });
});
