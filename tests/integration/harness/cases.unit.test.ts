// The corpus rules, on corpora of their own in temporary directories: they hold whatever cases
// the real corpus has.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  listCases,
  parityScenarios,
  removeStaleArtefacts,
  sharedArtefacts,
  staleArtefacts,
} from "./cases.ts";

let corpus: string | undefined;
afterEach(() => {
  if (corpus) rmSync(corpus, { recursive: true, force: true });
  corpus = undefined;
});

/** A corpus made of `files`, by path relative to the cases directory. */
function makeCorpus(files: Record<string, string>): string {
  corpus = mkdtempSync(join(tmpdir(), "uf-cases-"));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(corpus, path)), { recursive: true });
    writeFileSync(join(corpus, path), contents);
  }
  return corpus;
}

const input = "export default function Card() {\n  return <p>Card</p>;\n}\n";
const spec = (...names: string[]) =>
  names.map((name) => `await view.expectParity(${name});`).join("\n");

describe("listCases", () => {
  it("lists every case, sorted, with its input, spec and case.json", () => {
    const dir = makeCorpus({
      "widgets/card/Card.uf.tsx": input,
      "widgets/card/card.test.ts": spec('"initial"'),
      "widgets/card/case.json": '{ "ssr": { "empty": { "props": {} } } }',
      "basics/plain/Plain.uf.tsx": input,
      "basics/.hidden/Ignored.uf.tsx": input,
    });
    expect(
      listCases(dir).map((info) => [info.id, info.filename, Boolean(info.spec), info.config]),
    ).toEqual([
      ["basics/plain", "basics/plain/Plain.uf.tsx", false, {}],
      ["widgets/card", "widgets/card/Card.uf.tsx", true, { ssr: { empty: { props: {} } } }],
    ]);
  });

  it("refuses a malformed corpus, loudly", () => {
    expect(() => listCases(makeCorpus({ "basics/.keep": "" }))).toThrow(/No cases under/);
    expect(() => listCases(makeCorpus({ "basics/Card/Card.uf.tsx": input }))).toThrow(
      "Case basics/Card: an area and a case name are kebab-case",
    );
    expect(() => listCases(makeCorpus({ "my area/card/Card.uf.tsx": input }))).toThrow(
      /kebab-case/,
    );
    expect(() => listCases(makeCorpus({ "basics/card/notes.md": "" }))).toThrow(
      "Case basics/card must hold exactly one .uf.tsx input, found none.",
    );
    expect(() =>
      listCases(
        makeCorpus({
          "basics/card/A.uf.tsx": input,
          "basics/card/a.test.ts": "",
          "basics/card/b.test.ts": "",
        }),
      ),
    ).toThrow("Case basics/card has more than one spec: a.test.ts, b.test.ts.");
    expect(() =>
      listCases(
        makeCorpus({ "basics/card/A.uf.tsx": input, "basics/card/case.json": '{ "skip": true }' }),
      ),
    ).toThrow('Case basics/card: case.json has unknown key "skip".');
    expect(() =>
      listCases(
        makeCorpus({
          "basics/card/A.uf.tsx": input,
          "basics/card/case.json": '{ "ssr": { "after--click": {}, "open-": {} } }',
        }),
      ),
    ).toThrow(
      'Case basics/card: case.json has SSR scenario "after--click", which is not kebab-case; SSR scenario "open-", which is not kebab-case.',
    );
  });
});

describe("the shared artefacts a case owns", () => {
  it("are read from the spec's expectParity calls", () => {
    const [info] = listCases(
      makeCorpus({
        "basics/card/Card.uf.tsx": input,
        "basics/card/card.test.ts": spec('"initial"', "'open'", "`initial`"),
      }),
    );
    expect(parityScenarios(info!)).toEqual(["initial", "open"]);
  });

  it("need literal scenario names in the spec", () => {
    const [info] = listCases(
      makeCorpus({
        "basics/card/Card.uf.tsx": input,
        "basics/card/card.test.ts": spec('"initial"', "name"),
      }),
    );
    expect(() => parityScenarios(info!)).toThrow(
      /card\.test\.ts calls expectParity without naming the scenario in a string literal/,
    );
  });

  it("need kebab-case scenario names, as expectParity and the baseline copy-back do", () => {
    const [info] = listCases(
      makeCorpus({
        "basics/card/Card.uf.tsx": input,
        "basics/card/card.test.ts": spec('"initial"', '"after--click"', "'open-'"),
      }),
    );
    expect(() => parityScenarios(info!)).toThrow(
      'Case basics/card: card.test.ts names scenario(s) that are not kebab-case: "after--click", "open-".',
    );
  });

  it("are the diagnostics, each SSR scenario's HTML, and each parity scenario's DOM, ARIA, geometry and pixels", () => {
    const [info] = listCases(
      makeCorpus({
        "basics/card/Card.uf.tsx": input,
        "basics/card/card.test.ts": spec('"initial"'),
        "basics/card/case.json": '{ "ssr": { "empty": {}, "full": { "props": { "a": 1 } } } }',
        "basics/card/__expected__/diagnostics.json": "[]\n",
      }),
    );
    expect([...sharedArtefacts(info!)].sort()).toEqual([
      "__expected__/aria.initial.yaml",
      "__expected__/diagnostics.json",
      "__expected__/dom.initial.html",
      "__expected__/geometry.initial.json",
      "__expected__/ssr.empty.html",
      "__expected__/ssr.full.html",
      "__screenshots__/initial-chromium-linux.png",
    ]);
  });

  it("leave out the server HTML of a case that has compile errors, and so no output", () => {
    const [info] = listCases(
      makeCorpus({
        "diagnostics/broken/Broken.uf.tsx": input,
        "diagnostics/broken/__expected__/diagnostics.json":
          '[{ "code": "UF1001", "severity": "error" }]\n',
      }),
    );
    expect([...sharedArtefacts(info!)]).toEqual(["__expected__/diagnostics.json"]);
  });

  it("make every other file under __expected__ and __screenshots__ stale", () => {
    const [info] = listCases(
      makeCorpus({
        "basics/card/Card.uf.tsx": input,
        "basics/card/card.test.ts": spec('"open"'),
        "basics/card/__expected__/diagnostics.json": "[]\n",
        "basics/card/__expected__/ssr.default.html": "",
        "basics/card/__expected__/dom.open.html": "",
        // A renamed scenario and a removed SSR scenario.
        "basics/card/__expected__/dom.initial.html": "",
        "basics/card/__expected__/ssr.empty.html": "",
        "basics/card/__screenshots__/initial-chromium-linux.png": "",
        "basics/card/__screenshots__/open-chromium-linux.png": "",
        // Vitest's own failure screenshots, and a file the OS left behind.
        "basics/card/__screenshots__/card.test.ts/renders-1.png": "",
        "basics/card/__expected__/.DS_Store": "",
      }),
    );
    expect(staleArtefacts(info!)).toEqual([
      "__expected__/dom.initial.html",
      "__expected__/ssr.empty.html",
      "__screenshots__/card.test.ts/renders-1.png",
      "__screenshots__/initial-chromium-linux.png",
    ]);
  });

  it("are deleted in update mode, with the directories they leave empty", () => {
    const [info] = listCases(
      makeCorpus({
        "basics/card/Card.uf.tsx": input,
        "basics/card/__expected__/diagnostics.json": "[]\n",
        "basics/card/__expected__/ssr.default.html": "",
        "basics/card/__expected__/dom.initial.html": "",
        "basics/card/__screenshots__/initial-chromium-linux.png": "",
      }),
    );
    expect(removeStaleArtefacts(info!)).toEqual([
      "__expected__/dom.initial.html",
      "__screenshots__/initial-chromium-linux.png",
    ]);
    expect(readdirSync(join(info!.dir, "__expected__")).toSorted()).toEqual([
      "diagnostics.json",
      "ssr.default.html",
    ]);
    expect(existsSync(join(info!.dir, "__screenshots__"))).toBe(false);
    expect(staleArtefacts(info!)).toEqual([]);
  });
});
