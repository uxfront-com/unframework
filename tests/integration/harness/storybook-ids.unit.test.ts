// C2: stories come from one source, the corpus. Their ids match across targets, and no second list
// of cases exists to fall behind it.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { TARGET_NAMES } from "@unframework/compiler";
import { RUNNER_STORY } from "@unframework/visual";
import { describe, expect, it } from "vitest";

import { listCases, specTests } from "./cases.ts";
import { noOutputCases } from "./no-output.ts";
import { selectCases, storiesDir, storyFiles, targetStories } from "./storybook.ts";

const corpus = listCases();

describe("the stories of the corpus", () => {
  it("have one set of ids on all seven targets", () => {
    const sets = TARGET_NAMES.map((target) => targetStories(corpus, target).map(({ id }) => id));
    expect(sets).toHaveLength(7);
    expect(sets[0]!.length).toBeGreaterThan(300);
    for (const set of sets) expect(set).toEqual(sets[0]);
  });

  it("cover every spec case's scenarios and mounts", () => {
    const ids = new Set(targetStories(corpus, "vue").map(({ id }) => id));
    const missing: string[] = [];
    for (const info of corpus) {
      if (!info.spec) continue;
      const prefix = info.id.replace("/", "-");
      const source = readFileSync(info.spec, "utf8");
      const named = [
        ...Object.keys(info.config.ssr ?? {}),
        ...[...source.matchAll(/\bmountScenario\([^,]+,\s*"([^"]+)"/g)].map((match) => match[1]!),
      ];
      for (const test of specTests(source)) {
        if (test.mounts.some((mount) => mount.scenario === undefined)) {
          named.push(test.firstScenario!);
        }
      }
      missing.push(...named.map((name) => `${prefix}--${name}`).filter((id) => !ids.has(id)));
    }
    expect(missing).toEqual([]);
  });

  it("never list the runner story, which every build holds", () => {
    expect(targetStories(corpus, "vue").map(({ id }) => id)).not.toContain(RUNNER_STORY);
    const directory = "/stories";
    const files = storyFiles(selectCases(corpus, "basics/hello"), "vue", directory);
    expect(files.map(({ file }) => file)).toEqual([
      "basics-hello.stories.ts",
      "uf-runner.stories.ts",
    ]);
  });

  it("keep a case's ids on a target with no output for it, with the reason and no component", () => {
    const missing = noOutputCases(corpus, "vue");
    expect(Object.keys(missing)).toContain("semantics/listbox");
    const stories = targetStories(corpus, "vue");
    const listbox = stories.filter(({ title }) => title === "semantics/listbox");
    expect(listbox.length).toBeGreaterThan(0);
    for (const story of listbox) expect(story.noOutput).toContain("has no output for this target");
    expect(stories.filter((story) => story.noOutput).map(({ title }) => title)).toEqual(
      listbox.map(({ title }) => title),
    );
    const others = targetStories(corpus, "react").filter(
      ({ title }) => title === "semantics/listbox",
    );
    expect(others.map(({ id }) => id)).toEqual(listbox.map(({ id }) => id));
    expect(others.every((story) => story.noOutput === undefined)).toBe(true);
    const file = storyFiles(corpus, "vue", "/stories").find(
      (each) => each.file === "semantics-listbox.stories.ts",
    );
    expect(file?.contents).not.toContain("import ");
  });

  it("give the runner story every spec", () => {
    const runner = storyFiles(corpus, "vue", "/stories").at(-1)!;
    for (const info of corpus) {
      if (info.spec) expect(runner.contents).toContain(JSON.stringify(info.spec));
    }
  });
});

describe("a scratch case in a fixture corpus", () => {
  it("appears with no other edit", () => {
    const dir = mkdtempSync(join(tmpdir(), "uf-stories-"));
    try {
      const add = (id: string, name: string, spec: string, config: unknown) => {
        const directory = join(dir, id);
        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, `${name}.uf.tsx`), "export default function X() {}\n");
        writeFileSync(join(directory, `${id.split("/")[1]}.test.ts`), spec);
        writeFileSync(join(directory, "case.json"), JSON.stringify(config));
      };
      add(
        "basics/first",
        "First",
        `import First from "./First.uf.tsx";\nit("a", async () => {\n  const view = await mount(First);\n  await view.expectParity("initial");\n});\n`,
        {},
      );
      const before = targetStories(listCases(dir), "vue").map(({ id }) => id);
      expect(before).toEqual(["basics-first--initial"]);
      add(
        "scratch/new-case",
        "New",
        `import New from "./New.uf.tsx";\nit("a", async () => {\n  const view = await mountScenario(New, "open");\n  await view.expectParity("open");\n});\n`,
        { ssr: { open: { props: { open: true } }, closed: {} } },
      );
      const after = targetStories(listCases(dir), "vue");
      expect(after.map(({ id }) => id)).toEqual([
        "basics-first--initial",
        "scratch-new-case--closed",
        "scratch-new-case--open",
      ]);
      const open = after.find(({ id }) => id === "scratch-new-case--open");
      expect(open?.title).toBe("scratch/new-case");
      expect(open?.args).toBe('{ "open": true }');
      expect(storyFiles(listCases(dir), "vue", "/s").map(({ file }) => file)).toContain(
        "scratch-new-case.stories.ts",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("storiesDir", () => {
  it("keeps a start that names cases apart from a whole build, which it would otherwise empty", () => {
    expect(storiesDir("vue", undefined, "/root")).toBe("/root/.uf-cache/storybook/vue");
    expect(storiesDir("vue", "", "/root")).toBe("/root/.uf-cache/storybook/vue");
    expect(storiesDir("vue", "basics/hello,state/counter", "/root")).toBe(
      "/root/.uf-cache/storybook/vue--basics-hello-state-counter",
    );
  });
});

describe("selectCases", () => {
  it("keeps what it names, every case when it names none, and refuses a typo", () => {
    expect(selectCases(corpus, undefined)).toHaveLength(corpus.length);
    expect(selectCases(corpus, "basics/hello, state/counter").map(({ id }) => id)).toEqual([
      "basics/hello",
      "state/counter",
    ]);
    expect(() => selectCases(corpus, "basics/nope")).toThrow("No such case: basics/nope.");
  });
});
