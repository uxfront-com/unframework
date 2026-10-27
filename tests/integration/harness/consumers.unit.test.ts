// L4's consumer check (ADR-0059): directives read from the fixtures, the inverted judging, the
// copies a canary checks, and the fixture trees, which must name cases of the corpus.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ToolchainMessage } from "@unframework/codegen";
import { TARGET_NAMES } from "@unframework/compiler";
import { afterAll, describe, expect, it } from "vitest";

import { listCases } from "./cases.ts";
import type { CaseInfo } from "./cases.ts";
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

describe("the finer gaps (ADR-0059)", () => {
  // `Card` declares a named slot without props, `header`, which Astro does not type.
  const card = listCases().find(({ id }) => id === "slots/named")!;
  const list = listCases().find(({ id }) => id === "slots/scoped")!;

  it("fails a directive for a slot without props on Astro, and checks one with props", () => {
    const named = fixture(
      "MisuseSlot.astro",
      "<!-- @uf-expect TS2322 Card.slot:header -->\n<Card />\n",
    );
    const astro = consumerProblems("astro", card, [named], results([[named, [mismatch(2)]]]));
    expect(astro).toHaveLength(1);
    expect(astro[0]).toMatch(
      /MisuseSlot\.astro:2: astro cannot check a component's named-slots \(Astro does not type .+\)\.$/,
    );
    // Another target types it: the directive is met.
    expect(consumerProblems("vue", card, [named], results([[named, [mismatch(2)]]]))).toEqual([]);
    const scoped = fixture(
      "MisuseScoped.astro",
      "<!-- @uf-expect TS2322 List.slot:item -->\n<List />\n",
    );
    expect(consumerProblems("astro", list, [scoped], results([[scoped, [mismatch(2)]]]))).toEqual(
      [],
    );
  });
});

describe("the type kind and the generic-slot-props part (ADR-0068)", () => {
  // A case of its own: `List.uf.tsx` declares `ListProps<T>` and exports it, re-exports `Tone`
  // from `types.ts`, and passes `T` through its `item` slot, beside a `footer` slot.
  const dir = join(scratch, "generics", "list");
  const span = (source: string, text: string) => {
    const start = source.indexOf(text);
    return { start, end: start + text.length };
  };
  const list = [
    `export type { Tone } from "./types";`,
    `export interface ListProps<T> {`,
    `  items: T[];`,
    `}`,
    `export default function List<T>(props: ListProps<T>) {`,
    `  const slots = defineSlots<{ item?: (props: { item: T }) => unknown; footer?: (props: { count: number }) => unknown }>();`,
    `  return <ul />;`,
    `}`,
    ``,
  ].join("\n");
  const types = `// The tones.\nexport type Tone = "info" | "danger";\n`;
  mkdirSync(join(dir, "__output__"), { recursive: true });
  writeFileSync(join(dir, "List.uf.tsx"), list);
  writeFileSync(join(dir, "types.ts"), types);
  writeFileSync(
    join(dir, "__output__", "ir.json"),
    JSON.stringify({
      file: "generics/list/List.uf.tsx",
      types: [
        {
          name: "ListProps",
          exported: true,
          code: "interface ListProps<T> {\n  items: T[];\n}",
          span: span(list, "interface ListProps"),
        },
      ],
      typeExports: [
        {
          kind: "ReExport",
          specifier: "./types",
          names: [{ imported: "Tone", exported: "Tone", span: span(list, "Tone") }],
          span: span(list, `export type { Tone } from "./types";`),
        },
      ],
      components: [
        {
          name: "List",
          typeParameters: [{ name: "T", span: span(list, "T>(") }],
          props: [{ name: "items", span: span(list, "items") }],
          setup: [],
          slots: {
            slots: [
              { name: "item", props: {}, references: ["T"], span: span(list, "item?") },
              { name: "footer", props: {}, span: span(list, "footer?") },
            ],
          },
        },
      ],
    }),
  );
  const info = { id: "generics/list", dir } as CaseInfo;
  const gaps = { angular: { "generic-slot-props": "slot directives cannot infer T" } };

  it("reads a type directive, and names where an exported type is declared", () => {
    expect(readExpectations("// @uf-expect TS2322 List.type:ListProps\n").expectations).toEqual([
      { line: 2, code: "TS2322", declaration: "List.type:ListProps", kind: "type" },
    ]);
    const misuse = fixture(
      "MisuseType.tsx",
      "// @uf-expect TS2322 List.type:ListProps\nx;\n// @uf-expect TS2322 List.type:Tone\ny;\n",
    );
    // `ListProps` is met; `Tone` is declared in the `.ts` module it is re-exported from.
    expect(consumerProblems("react", info, [misuse], results([[misuse, [mismatch(2)]]]))).toEqual([
      expect.stringMatching(
        /MisuseType\.tsx:4: expected TS2322 for List\.type:Tone \(types\.ts:2\), got none$/,
      ),
    ]);
    const missing = consumerProblems("react", info, [misuse], results([[misuse, []]]));
    expect(missing[0]).toMatch(/:2: expected TS2322 for List\.type:ListProps \(List\.uf\.tsx:2\)/);
    const unknown = fixture("MisuseUnknown.tsx", "// @uf-expect TS2322 List.type:Item\nx;\n");
    expect(consumerProblems("react", info, [unknown], results([[unknown, [mismatch(2)]]]))).toEqual(
      [expect.stringMatching(/List\.type:Item is not declared in generics\/list's IR\.$/)],
    );
  });

  it("fails a slot directive for a generic slot where the part is a gap, and checks the others", () => {
    const misuse = fixture(
      "misuse-slot.ts",
      "// @uf-expect TS2339 List.slot:item\nx;\n// @uf-expect TS2339 List.slot:footer\ny;\n",
    );
    const checked = results([[misuse, [{ ...mismatch(2), code: "TS2339" }]]]);
    const problems = consumerProblems("angular", info, [misuse], checked, gaps);
    expect(problems).toEqual([
      expect.stringMatching(
        /misuse-slot\.ts:2: angular cannot check a component's generic-slot-props \(slot directives cannot infer T\)\.$/,
      ),
      expect.stringMatching(
        /misuse-slot\.ts:4: expected TS2339 for List\.slot:footer \(List\.uf\.tsx:6\), got none$/,
      ),
    ]);
    // Without the gap, the generic slot is checked as any other.
    expect(consumerProblems("react", info, [misuse], checked, gaps)).toEqual([
      expect.stringMatching(/misuse-slot\.ts:4: expected TS2339 for List\.slot:footer/),
    ]);
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
