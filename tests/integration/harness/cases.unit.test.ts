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
  specProblems,
  specTests,
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

  it("lists a case's sources, the main one named in case.json, each with its IR snapshot", () => {
    const dir = makeCorpus({
      "forms/form/Form.uf.tsx": input,
      "forms/form/Field.uf.tsx": input,
      "forms/form/form.test.ts": spec('"initial"'),
      "forms/form/case.json": '{ "main": "Form.uf.tsx" }',
      "basics/plain/Plain.uf.tsx": input,
      "basics/plain/case.json": '{ "main": "Plain.uf.tsx" }',
    });
    const [plain, form] = listCases(dir);
    expect(form).toMatchObject({
      source: join(dir, "forms/form/Form.uf.tsx"),
      filename: "forms/form/Form.uf.tsx",
      sources: [
        {
          source: join(dir, "forms/form/Field.uf.tsx"),
          filename: "forms/form/Field.uf.tsx",
          ir: "ir.Field.json",
        },
        {
          source: join(dir, "forms/form/Form.uf.tsx"),
          filename: "forms/form/Form.uf.tsx",
          ir: "ir.json",
        },
      ],
    });
    expect(plain!.sources).toEqual([
      { source: plain!.source, filename: "basics/plain/Plain.uf.tsx", ir: "ir.json" },
    ]);
  });

  it("refuses a case of several sources that does not name its main one", () => {
    const files = { "forms/form/Form.uf.tsx": input, "forms/form/Field.uf.tsx": input };
    expect(() => listCases(makeCorpus(files))).toThrow(
      'Case forms/form holds Field.uf.tsx, Form.uf.tsx: name the one the spec mounts in case.json, "main": "Field.uf.tsx".',
    );
    expect(() =>
      listCases(makeCorpus({ ...files, "forms/form/case.json": '{ "main": "Missing.uf.tsx" }' })),
    ).toThrow(
      'Case forms/form: case.json\'s "main" names "Missing.uf.tsx", which is not one of its inputs (Field.uf.tsx, Form.uf.tsx).',
    );
    expect(() =>
      listCases(makeCorpus({ ...files, "forms/form/case.json": '{ "main": 1 }' })),
    ).toThrow(
      'Case forms/form: case.json has "main" must be the file name of one of the case\'s .uf.tsx inputs.',
    );
  });

  it("reads a case's own reference, a target other than Vue (ADR-0057)", () => {
    const files = { "forms/list/List.uf.tsx": input, "forms/list/list.test.ts": spec('"initial"') };
    const [list] = listCases(
      makeCorpus({ ...files, "forms/list/case.json": '{ "reference": "react" }' }),
    );
    expect(list!.config).toEqual({ reference: "react" });
    for (const reference of ['"vue"', '"preact"', "1"]) {
      expect(() =>
        listCases(
          makeCorpus({ ...files, "forms/list/case.json": `{ "reference": ${reference} }` }),
        ),
      ).toThrow(/case\.json has "reference" must name a target other than vue/);
    }
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
      "Case basics/card must hold a .uf.tsx input, found none.",
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
    expect(() =>
      listCases(
        makeCorpus({
          "basics/card/A.uf.tsx": input,
          "basics/card/case.json": '{ "requires": " " }',
        }),
      ),
    ).toThrow(
      'Case basics/card: case.json has "requires" must be a sentence saying why every test requires a capability.',
    );
  });

  it("reads the note that says why every test of a case requires a capability", () => {
    const note = "onMounted writes the state, so every browser capture depends on client code.";
    const dir = makeCorpus({
      "basics/card/Card.uf.tsx": input,
      "basics/card/case.json": JSON.stringify({ requires: note }),
    });
    expect(listCases(dir).map((info) => info.config)).toEqual([{ requires: note }]);
  });
});

describe("the shared artefacts a case owns", () => {
  it("are read from the spec's expectParity calls", () => {
    const [info] = listCases(
      makeCorpus({
        "basics/card/Card.uf.tsx": input,
        "basics/card/card.test.ts": spec('"initial"', "'open'", "`after-click`"),
      }),
    );
    expect(parityScenarios(info!)).toEqual(["after-click", "initial", "open"]);
  });

  it("need each scenario named once: a name names one scenario", () => {
    const [info] = listCases(
      makeCorpus({
        "basics/card/Card.uf.tsx": input,
        "basics/card/card.test.ts": spec('"initial"', "'open'", "`initial`"),
      }),
    );
    expect(() => parityScenarios(info!)).toThrow(
      'Case basics/card: card.test.ts checks scenario(s) under a name twice: "initial". Each scenario is unique in its case.',
    );
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

  it("are the diagnostics, each SSR scenario's HTML, and each parity scenario's DOM, ARIA, trace, geometry and pixels", () => {
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
      // Its interaction trace, which the browser run decides must exist or not (L9).
      "__expected__/trace.initial.json",
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

describe("the spec rules", () => {
  /** The spec rules' problems of a case with this spec and case.json. */
  const problems = (source: string, config?: object) => {
    const [info] = listCases(
      makeCorpus({
        "basics/card/Card.uf.tsx": input,
        "basics/card/card.test.ts": source,
        ...(config ? { "basics/card/case.json": JSON.stringify(config) } : {}),
      }),
    );
    return specProblems(info!);
  };
  const renders = `it("renders", async () => {
    const view = await mount(Card);
    await view.expectParity("initial");
  });`;
  const clicks = (name = "clicks") => `it("${name}", { requires: ["interactivity"] }, async () => {
    const view = await mount(Card);
    await view.user.click(view.getByRole("button"));
    await view.expectParity("after-click");
  });`;

  it("reads each test's name, its requires, whether it checks before it acts, and its steps", () => {
    const rerenders = `it("rerenders", { requires: ["interactivity", "event-once"] }, async () => {
    const view = await mount(Card);
    await view.rerender({ label: "New" });
    await view.expectParity("rerendered");
  });`;
    expect(
      specTests(`${renders}\n${clicks()}\n${rerenders}\ntest('types', async () => {})`),
    ).toEqual([
      {
        name: "renders",
        requires: [],
        checksFirst: true,
        acts: false,
        rerenders: false,
        firstAssertion: undefined,
        uncompared: [],
      },
      {
        name: "clicks",
        requires: ["interactivity"],
        checksFirst: false,
        acts: true,
        rerenders: false,
        firstAssertion: undefined,
        uncompared: [],
      },
      {
        name: "rerenders",
        requires: ["interactivity", "event-once"],
        // A rerender is no action: a static target runs a rerender too.
        checksFirst: true,
        acts: false,
        rerenders: true,
        firstAssertion: undefined,
        uncompared: [],
      },
      {
        name: "types",
        requires: [],
        checksFirst: false,
        acts: false,
        rerenders: false,
        firstAssertion: undefined,
        uncompared: [],
      },
    ]);
  });

  it("refuse a requires the harness cannot read", () => {
    expect(() => specTests(`it("clicks", { requires: capabilities }, async () => {});`)).toThrow(
      /declares requires that is not an array of capability names in string literals/,
    );
  });

  it("accept a spec that checks before it acts, and acts through view.user", () => {
    expect(problems(`${renders}\n${clicks()}`)).toEqual([]);
  });

  it("refuse two tests of one name", () => {
    expect(problems(`${renders}\n${clicks("renders")}`)).toEqual([
      'basics/card/card.test.ts: two tests are named "renders"; each test\'s name is its own.',
    ]);
  });

  it("refuse actions that bypass view.user", () => {
    expect(
      problems(`import { page, userEvent } from "vitest/browser";
${renders}
it("acts", async () => {
  const view = await mount(Card);
  await view.getByRole("button").click();
  await userEvent.keyboard("{Enter}");
});`),
    ).toEqual([
      "basics/card/card.test.ts: imports from vitest/browser. A spec acts through view.user and queries through the view, so every action settles and is recorded in the trace.",
      expect.stringMatching(
        /^basics\/card\/card\.test\.ts:8: calls click\(\) directly\. Act through view\.user/,
      ),
      expect.stringMatching(/^basics\/card\/card\.test\.ts:9: calls keyboard\(\) directly\./),
    ]);
  });

  it("need a test to assert after the expectParity that compares its steps", () => {
    const typed = `it("types", { requires: ["interactivity"] }, async () => {
      const view = await mount(Card);
      await view.user.type(view.getByLabelText("Name"), "Ada");
      await view.user.tab();
      await expect.element(view.getByRole("status")).toHaveTextContent("Ada");
      await view.user.click(view.getByRole("button"));
      await view.expectParity("submitted");
      expect(view.emitted("submit")).toEqual([["Ada"]]);
    });`;
    expect(problems(`${renders}\n${typed}`)).toEqual([
      expect.stringMatching(
        /^basics\/card\/card\.test\.ts:7: "types" asserts \(expect\.element\(…\)\) after view\.user\.type\(…\) before an expectParity compares the step\. Call expectParity\("<scenario>"\) right after the step, then assert/,
      ),
    ]);
    // Steps in a row are compared together, and a step no expectParity follows is uncompared.
    const trailing = `it("types", { requires: ["interactivity"] }, async () => {
      const view = await mount(Card);
      await view.user.type(view.getByLabelText("Name"), "Ada");
      await view.user.tab();
      await view.expectParity("typed");
      await expect.element(view.getByRole("status")).toHaveTextContent("Ada");
      await view.rerender({ label: "New" });
    });`;
    expect(problems(`${renders}\n${trailing}`)).toEqual([
      expect.stringMatching(
        /^basics\/card\/card\.test\.ts:11: "types" ends with view\.rerender\(…\) uncompared\./,
      ),
    ]);
  });

  it("let a test assert after an unmount's clock tick, which is no step, and read no comments", () => {
    const unmounted = `it("stops", { requires: ["interactivity"] }, async () => {
      const view = await mount(Card, { clock: true });
      await view.user.click(view.getByRole("button"));
      // view.user.click(view.getByRole("button")) would be a step, but this is a comment.
      await view.expectParity("started");
      await expect.element(view.getByRole("status")).toHaveTextContent("On");
      await view.unmount();
      await view.clock.tick(1000);
      expect(view.emitted("tick")).toEqual([]);
    });`;
    expect(problems(`${renders}\n${unmounted}`)).toEqual([]);
    const mounted = unmounted.replace("await view.unmount();\n", "");
    expect(problems(`${renders}\n${mounted}`)).toEqual([
      expect.stringMatching(
        /^basics\/card\/card\.test\.ts:\d+: "stops" asserts \(expect\(…\)\) after view\.clock\.tick\(…\)/,
      ),
    ]);
  });

  it("refuse steps outside a test, where the harness cannot tell which test takes them", () => {
    const helper = `async function submit(view) {
  await view.user.click(view.getByRole("button"));
}
${renders}`;
    expect(problems(helper)).toEqual([
      "basics/card/card.test.ts: acts or rerenders outside a test. Each test takes its own steps in its own body, where the harness reads which tests act and rerender.",
    ]);
  });

  it("need a test that requires nothing to assert first through a locator", () => {
    const asserting = (first: string) => `it("renders", async () => {
    const view = await mount(Card);
    await view.expectParity("initial");
    ${first};
    await expect.element(view.getByText("Card")).toBeVisible();
  });`;
    expect(
      problems(asserting('await expect.element(view.getByRole("heading")).toBeVisible()')),
    ).toEqual([]);
    expect(problems(asserting('await expect.poll(() => view.html()).toContain("Card")'))).toEqual(
      [],
    );
    expect(
      problems(asserting('expect(view.getByRole("listitem").elements()).toHaveLength(2)')),
    ).toEqual([
      'basics/card/card.test.ts: "renders" requires nothing, and its first assertion after its expectParity is expect(…). Assert first through a locator (await expect.element(view.getBy…)…): on a render of nothing it then fails as a query that finds nothing, on every target, a static one included.',
    ]);
    // A test that requires a capability fails first at an action, or is skipped on a static target.
    expect(
      problems(
        `${renders}\nit("counts", { requires: ["interactivity"] }, async () => {
    const view = await mount(Card);
    await view.expectParity("counted");
    expect(view.emitted("count")).toEqual([]);
  });`,
      ),
    ).toEqual([]);
    expect(specTests(asserting("expect(1).toBe(1)"))[0]!.firstAssertion).toBe("expect(");
  });

  it("need a test that checks a scenario before it acts", () => {
    expect(problems(clicks(), { requires: "onMounted writes the status." })).toEqual([
      "basics/card/card.test.ts: no test checks a scenario before it acts. One test at least calls expectParity before any view.user action, so a static target and the canaries reach the case.",
    ]);
  });

  it("need the requires note exactly when every test requires a capability", () => {
    const mounted = `it("renders", { requires: ["interactivity"] }, async () => {
      const view = await mount(Card);
      await view.expectParity("initial");
    });`;
    expect(problems(`${mounted}\n${clicks()}`)).toEqual([
      "basics/card/card.test.ts: every test requires a capability. Say why in case.json's \"requires\" note (the case's client code changes what it mounts), or check the initial render in a test that requires nothing.",
    ]);
    expect(
      problems(`${mounted}\n${clicks()}`, { requires: "onMounted writes the status." }),
    ).toEqual([]);
    expect(
      problems(`${renders}\n${clicks()}`, { requires: "onMounted writes the status." }),
    ).toEqual([
      'basics/card/card.test.ts: case.json\'s "requires" note says every test requires a capability, but "renders" requires none.',
    ]);
  });

  it("have nothing to say of a case without a spec", () => {
    const [info] = listCases(makeCorpus({ "basics/card/Card.uf.tsx": input }));
    expect(specProblems(info!)).toEqual([]);
  });
});
