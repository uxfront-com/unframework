import { describe, expect, it } from "vitest";

import { generateRunner, generateStories, RUN_SPEC, RUNNER_STORY } from "../src/index.ts";
import type { Story } from "../src/index.ts";

const directory = "/repo/tests/integration/.uf-cache/storybook/vue";
const source = "/repo/tests/integration/cases/state/counter/Counter.uf.tsx";

const story = (scenario: string, extra: Partial<Story> = {}): Story => ({
  id: `state-counter--${scenario}`,
  title: "state/counter",
  source,
  args: "{}",
  ...extra,
});

describe("generateStories", () => {
  it("writes one file per title, so each case is a chunk of its own", () => {
    const files = generateStories(directory, [
      story("initial"),
      story("big"),
      story("default", { id: "basics-hello--default", title: "basics/hello" }),
    ]);
    expect(files.map(({ file }) => file)).toEqual([
      "state-counter.stories.ts",
      "basics-hello.stories.ts",
    ]);
  });

  it("names each story's id, and imports its component relatively", () => {
    const [file] = generateStories(directory, [story("step-2", { args: '{ "a": undefined }' })]);
    expect(file!.contents).toContain(
      'import Component from "../../../cases/state/counter/Counter.uf.tsx";',
    );
    expect(file!.contents).toContain(
      'export default { title: "state/counter", component: Component };',
    );
    expect(file!.contents).toContain('name: "step-2"');
    expect(file!.contents).toContain('args: { "a": undefined }');
    expect(file!.contents).toContain('__id: "state-counter--step-2"');
  });

  it("keeps a story without output, and imports no component for it", () => {
    const [file] = generateStories(directory, [
      story("initial", { noOutput: 'it expects "UF4001"' }),
    ]);
    expect(file!.contents).not.toContain("import ");
    expect(file!.contents).not.toContain("component:");
    expect(file!.contents).toContain('__id: "state-counter--initial"');
    expect(file!.contents).toContain('ufNoOutput: "it expects \\"UF4001\\""');
  });

  it("refuses two stories of one id", () => {
    expect(() => generateStories(directory, [story("initial"), story("initial")])).toThrow(
      "Two stories have the id state-counter--initial.",
    );
  });

  it("refuses a title whose stories render different components", () => {
    expect(() =>
      generateStories(directory, [
        story("initial"),
        story("big", { source: "/repo/Other.uf.tsx" }),
      ]),
    ).toThrow("state/counter's stories render different components");
    expect(() =>
      generateStories(directory, [story("initial"), story("big", { noOutput: "none" })]),
    ).toThrow("state/counter's stories render different components");
  });
});

describe("generateRunner", () => {
  const spec = "/repo/tests/integration/cases/state/counter/counter.test.ts";
  const { file, contents } = generateRunner(directory, { target: "vue", specs: [spec] });

  it("is a hidden story under its one id", () => {
    expect(file).toBe("uf-runner.stories.ts");
    expect(contents).toContain('tags: ["!dev", "!autodocs", "!test"]');
    expect(contents).toContain(`__id: ${JSON.stringify(RUNNER_STORY)}`);
    expect(contents).toContain("ufRunner: true");
  });

  it("imports the page host and each spec only when a driver asks", () => {
    expect(contents).not.toMatch(/^import /m);
    expect(contents).toContain(`globalThis.${RUN_SPEC} = async`);
    expect(contents).toContain(
      `${JSON.stringify(spec)}: () => import("../../../cases/state/counter/counter.test.ts")`,
    );
    const order = [
      '"@unframework/testing/hosts/page"',
      '"@unframework/testing/setup"',
      '"@unframework/testing/vue"',
      '"@unframework/testing/hosts/page/run"',
    ].map((specifier) => contents.indexOf(specifier));
    expect(order).toEqual(order.toSorted((a, b) => a - b));
    expect(order[0]).toBeGreaterThan(-1);
  });
});
