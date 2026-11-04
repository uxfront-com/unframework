// The project graph (ADR-0071): a change recompiles exactly the modules that depend on it, and
// stops where what a dependent read is unchanged. Each shared module's copy is its own node, and
// an import cycle is UF1205.
import { describe, expect, it } from "vitest";

import { compile, createProject, createSyntacticOracle } from "../src/index.ts";

const PROPS = ["export interface CardProps {", "  label: string;", "}", ""].join("\n");

/** The invalidation fixture of the verification plan (C9). */
const FIXTURE: Record<string, string> = {
  "a.ts": PROPS,
  "B.uf.tsx": [
    'import type { CardProps } from "./a.ts";',
    "export default function B({ label }: CardProps) {",
    "  return <p>{label}</p>;",
    "}",
    "",
  ].join("\n"),
  "useC.uf.ts": [
    'import { computed } from "unframework";',
    'import type { CardProps } from "./a.ts";',
    "export function useC(card: CardProps) {",
    "  const text = computed(() => card.label);",
    "  return { text };",
    "}",
    "",
  ].join("\n"),
  "C.uf.tsx": [
    'import { useC } from "./useC.uf.ts";',
    "export default function C({ label }: { label: string }) {",
    "  const { text } = useC({ label });",
    "  return <p>{text.value}</p>;",
    "}",
    "",
  ].join("\n"),
  "D.uf.tsx": ["export default function D() {", "  return <p>D</p>;", "}", ""].join("\n"),
};

/** A project over in-memory files under `/project`, with a file-backed type oracle over them. */
function memoryProject(initial: Record<string, string>) {
  const files = new Map(Object.entries(initial).map(([path, text]) => [`/project/${path}`, text]));
  const readFile = (path: string) => Promise.resolve(files.get(path));
  const typeOracle = createSyntacticOracle({ root: "/project", readFile });
  const project = createProject({ root: "/project", readFile, typeOracle, targets: ["vue"] });
  const write = (path: string, text: string | undefined) => {
    if (text === undefined) files.delete(`/project/${path}`);
    else files.set(`/project/${path}`, text);
  };
  return { project, write };
}

async function compiledFixture() {
  const { project, write } = memoryProject(FIXTURE);
  for (const file of ["B.uf.tsx", "useC.uf.ts", "C.uf.tsx", "D.uf.tsx"]) {
    await project.compile(file);
  }
  return { project, write };
}

describe("invalidation", () => {
  it("records what each module read", async () => {
    const { project } = await compiledFixture();
    expect(project.dependencies("B.uf.tsx")).toEqual(["a.ts"]);
    expect(project.dependencies("useC.uf.ts")).toEqual(["a.ts"]);
    // C reaches a.ts through useC's API, whose own node reads it.
    expect(project.dependencies("C.uf.tsx")).toEqual(["useC.uf.ts"]);
    expect(project.dependencies("D.uf.tsx")).toEqual([]);
  });

  it("recompiles B, useC and C once each when the props type changes, and never D", async () => {
    const { project, write } = await compiledFixture();
    const before = await project.compile("B.uf.tsx");
    write("a.ts", PROPS.replace("label: string;", "label: string;\n  hint?: string;"));
    expect(await project.update(["a.ts"])).toEqual({
      compiled: ["B.uf.tsx", "C.uf.tsx", "useC.uf.ts"],
      copied: ["a.ts"],
    });
    const after = await project.compile("B.uf.tsx");
    expect(after).not.toBe(before);
    expect(after.outputs.vue?.map(({ path }) => path)).toEqual(["B.vue"]);
    // Nothing changed since: a second update compiles nothing.
    expect(await project.update(["a.ts"])).toEqual({ compiled: [], copied: [] });
  });

  it("recompiles no component when the shape stays, and still refreshes a.ts's copy", async () => {
    const { project, write } = await compiledFixture();
    const before = await project.compile("B.uf.tsx");
    const edited = `${PROPS}export const LABEL = "Label";\n`;
    write("a.ts", edited);
    expect(await project.update(["a.ts"])).toEqual({ compiled: [], copied: ["a.ts"] });
    expect(await project.compile("B.uf.tsx")).toBe(before);
    expect(project.copy("a.ts")).toBe(edited);
  });

  it("recompiles a parent through a child's types when only the parent was compiled", async () => {
    const { project, write } = memoryProject({
      "a.ts": "export interface ChildProps {\n  label: string;\n}\n",
      "Child.uf.tsx":
        'import type { ChildProps } from "./a.ts";\nexport default function Child({ label }: ChildProps) {\n  return <i>{label}</i>;\n}\n',
      "Parent.uf.tsx":
        'import Child from "./Child.uf.tsx";\nexport default function Parent() {\n  return <div><Child label="x" hint="y" /></div>;\n}\n',
    });
    const codes = async () =>
      (await project.compile("Parent.uf.tsx")).diagnostics.map(({ code }) => code);
    expect(await codes()).toEqual(["UF3035"]);
    write("a.ts", "export interface ChildProps {\n  label: string;\n  hint?: string;\n}\n");
    expect((await project.update(["a.ts"])).compiled).toEqual(["Parent.uf.tsx"]);
    expect(await codes()).toEqual([]);
  });

  it("recompiles a module whose own source changed, and only it", async () => {
    const { project, write } = await compiledFixture();
    write("D.uf.tsx", FIXTURE["D.uf.tsx"]!.replace("<p>D</p>", "<p>Changed</p>"));
    expect(await project.update(["D.uf.tsx"])).toEqual({ compiled: ["D.uf.tsx"], copied: [] });
    expect((await project.compile("D.uf.tsx")).outputs.vue?.[0]?.contents).toContain("Changed");
  });
});

describe("the project's compiles", () => {
  it("leave each shared module's copy to the module's own node", async () => {
    const { project } = memoryProject(FIXTURE);
    const result = await project.compile("B.uf.tsx");
    expect(result.outputs.vue?.map(({ path }) => path)).toEqual(["B.vue"]);
    expect(project.copy("a.ts")).toBe(PROPS);
    expect(project.copy("D.uf.tsx")).toBeUndefined();
  });

  it("give a module's copies at their paths beside it, with their modules' current text", async () => {
    const { project, write } = memoryProject({
      "shared/a.ts": PROPS,
      "src/B.uf.tsx": FIXTURE["B.uf.tsx"]!.replace("./a.ts", "../shared/a.ts"),
    });
    expect(project.copies("src/B.uf.tsx")).toEqual([]);
    await project.compile("src/B.uf.tsx");
    expect(project.copies("src/B.uf.tsx")).toEqual([{ path: "../shared/a.ts", contents: PROPS }]);
    // An edit that leaves the shape alone recompiles nothing, and still reaches the copy.
    const edited = `${PROPS}export const LABEL = "Label";\n`;
    write("shared/a.ts", edited);
    expect((await project.update(["shared/a.ts"])).compiled).toEqual([]);
    expect(project.copies("src/B.uf.tsx")).toEqual([{ path: "../shared/a.ts", contents: edited }]);
  });

  it("give the same result as compile() through the project's resolver", async () => {
    const { project } = memoryProject(FIXTURE);
    const direct = await compile(FIXTURE["D.uf.tsx"]!, {
      filename: "D.uf.tsx",
      targets: ["vue"],
      resolve: project.resolve,
    });
    expect(await project.compile("D.uf.tsx")).toEqual(direct);
  });

  it("recompile a parent when its child's API changes, and not when it stays", async () => {
    const child =
      "export default function Child({ label }: { label: string }) {\n  return <i>{label}</i>;\n}\n";
    const { project, write } = memoryProject({
      "Child.uf.tsx": child,
      "Parent.uf.tsx":
        'import Child from "./Child.uf.tsx";\nexport default function Parent() {\n  return <Child label="Hi" />;\n}\n',
    });
    await project.compile("Parent.uf.tsx");
    expect(project.dependencies("Parent.uf.tsx")).toEqual(["Child.uf.tsx"]);
    write("Child.uf.tsx", child.replace("<i>{label}", "<i>Label: {label}"));
    expect(await project.update(["Child.uf.tsx"])).toEqual({ compiled: [], copied: [] });
    write("Child.uf.tsx", child.replace("label: string", "label?: string"));
    expect(await project.update(["Child.uf.tsx"])).toEqual({
      compiled: ["Parent.uf.tsx"],
      copied: [],
    });
  });

  it("throw for a file the project does not hold", async () => {
    const { project } = memoryProject({});
    await expect(project.compile("Missing.uf.tsx")).rejects.toThrow(
      'The project has no file "Missing.uf.tsx".',
    );
  });
});

describe("import cycle (UF1205)", () => {
  /** A component that renders the next one by a default import, while `n` lasts. */
  const renders = (
    name: string,
    next: string,
    imported = `import ${next} from "./${next}.uf.tsx";`,
  ) =>
    `${imported}\nexport default function ${name}({ n }: { n: number }) {\n  return <span>{n > 0 ? <${next} n={n - 1} /> : <i>${name}</i>}</span>;\n}\n`;
  const PING = renders("Ping", "Pong");
  const PONG = renders("Pong", "Ping");

  it("reports two components that render each other at the closing import, and withholds the module", async () => {
    const { project } = memoryProject({ "Ping.uf.tsx": PING, "Pong.uf.tsx": PONG });
    const result = await project.compile("Ping.uf.tsx");
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "UF1205",
        file: "Ping.uf.tsx",
        span: { start: PING.indexOf('"./Pong'), end: PING.indexOf(";") },
        message:
          '"./Pong.uf.tsx" closes an import cycle of components, Ping.uf.tsx → Pong.uf.tsx → Ping.uf.tsx: each imports the next to render it, so none of them can load before the others.',
      }),
    ]);
    expect(result.ir).toBeUndefined();
    expect(result.outputs.vue).toEqual([]);
  });

  it("reports a cycle of three, by named imports too, naming its files from the source", async () => {
    const { project } = memoryProject({
      "a/One.uf.tsx": renders("One", "Two", 'import { Two } from "../b/Two.uf.tsx";').replace(
        "export default function One",
        "export function One",
      ),
      "b/Two.uf.tsx": renders("Two", "Three", 'import Three from "./Three.uf.tsx";').replace(
        "export default function Two",
        "export function Two",
      ),
      "b/Three.uf.tsx": renders("Three", "One", 'import { One } from "../a/One.uf.tsx";'),
    });
    for (const [file, specifier, cycle] of [
      [
        "a/One.uf.tsx",
        "../b/Two.uf.tsx",
        "One.uf.tsx → ../b/Two.uf.tsx → ../b/Three.uf.tsx → One.uf.tsx",
      ],
      [
        "b/Two.uf.tsx",
        "./Three.uf.tsx",
        "Two.uf.tsx → Three.uf.tsx → ../a/One.uf.tsx → Two.uf.tsx",
      ],
      [
        "b/Three.uf.tsx",
        "../a/One.uf.tsx",
        "Three.uf.tsx → ../a/One.uf.tsx → Two.uf.tsx → Three.uf.tsx",
      ],
    ] as const) {
      const result = await project.compile(file);
      expect(result.diagnostics.map(({ code, message }) => [code, message])).toEqual([
        [
          "UF1205",
          `"${specifier}" closes an import cycle of components, ${cycle}: each imports the next to render it, so none of them can load before the others.`,
        ],
      ]);
    }
  });

  it("reports nothing for a consumer that imports its provider's key", async () => {
    const { project } = memoryProject({
      "Provider.uf.tsx": [
        'import { provide } from "unframework";',
        'import type { InjectionKey } from "unframework";',
        'import Consumer from "./Consumer.uf.tsx";',
        'export const LabelKey: InjectionKey<string> = Symbol("uf.label");',
        "export default function Provider() {",
        '  provide(LabelKey, "Hi");',
        "  return <div><Consumer /></div>;",
        "}",
        "",
      ].join("\n"),
      "Consumer.uf.tsx": [
        'import { inject } from "unframework";',
        'import { LabelKey } from "./Provider.uf.tsx";',
        "export default function Consumer() {",
        "  const label = inject(LabelKey);",
        "  return <i>{label}</i>;",
        "}",
        "",
      ].join("\n"),
    });
    for (const file of ["Provider.uf.tsx", "Consumer.uf.tsx"]) {
      const result = await project.compile(file);
      expect(result.diagnostics.map(({ code }) => code)).toEqual([]);
    }
  });

  it("reports nothing for a type imported back", async () => {
    const { project } = memoryProject({
      "Card.uf.tsx":
        'import Tag from "./Tag.uf.tsx";\nexport type Tone = "info" | "warning";\nexport default function Card() {\n  return <div><Tag tone="info" /></div>;\n}\n',
      "Tag.uf.tsx":
        'import type { Tone } from "./Card.uf.tsx";\nexport default function Tag({ tone }: { tone: Tone }) {\n  return <i>{tone}</i>;\n}\n',
    });
    for (const file of ["Card.uf.tsx", "Tag.uf.tsx"]) {
      const result = await project.compile(file);
      expect(result.diagnostics.map(({ code }) => code)).toEqual([]);
    }
  });

  it("reports nothing for a cycle of shared .ts modules alone", async () => {
    const { project } = memoryProject({
      "Card.uf.tsx":
        'import { first } from "./first.ts";\nexport default function Card() {\n  return <i>{first}</i>;\n}\n',
      "first.ts":
        'import { second } from "./second.ts";\nexport const first = "first";\nexport const both = () => second;\n',
      "second.ts":
        'import { first } from "./first.ts";\nexport const second = "second";\nexport const back = () => first;\n',
    });
    const result = await project.compile("Card.uf.tsx");
    expect(result.diagnostics.map(({ code }) => code)).not.toContain("UF1205");
    expect(project.copy("second.ts")).toContain("export const second");
  });

  it("reports nothing for a component imported back type-only, in either form", async () => {
    const card =
      'import Tag from "./Tag.uf.tsx";\nexport default function Card() {\n  return <div><Tag /></div>;\n}\nexport function Chip() {\n  return <b />;\n}\n';
    for (const imported of [
      'import type Card from "./Card.uf.tsx";',
      'import type { Chip } from "./Card.uf.tsx";',
      'import { type Chip } from "./Card.uf.tsx";',
    ]) {
      const { project } = memoryProject({
        "Card.uf.tsx": card,
        "Tag.uf.tsx": `${imported}\nexport default function Tag() {\n  return <i>Tag</i>;\n}\n`,
      });
      for (const file of ["Card.uf.tsx", "Tag.uf.tsx"]) {
        expect((await project.compile(file)).diagnostics.map(({ code }) => code)).toEqual([]);
      }
    }
  });

  it("leaves a component that imports itself to UF1203", async () => {
    const source =
      'import Again from "./Countdown.uf.tsx";\nexport default function Countdown({ from }: { from: number }) {\n  return <div>{from > 0 ? <Again from={from - 1} /> : <b>Liftoff</b>}</div>;\n}\n';
    const { project } = memoryProject({ "Countdown.uf.tsx": source });
    const result = await project.compile("Countdown.uf.tsx");
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["UF1203"]);
  });

  it("leaves a cycle the source is not in to its own modules", async () => {
    const { project } = memoryProject({
      "Top.uf.tsx":
        'import Ping from "./Ping.uf.tsx";\nexport default function Top() {\n  return <Ping n={1} />;\n}\n',
      "Ping.uf.tsx": PING,
      "Pong.uf.tsx": PONG,
    });
    const result = await project.compile("Top.uf.tsx");
    expect(result.diagnostics.map(({ code }) => code)).not.toContain("UF1205");
    expect(
      await project.resolve.cycle!({ specifier: "./Top.uf.tsx", importer: "Top.uf.tsx" }),
    ).toBeUndefined();
  });

  it("recompiles a module once the cycle is broken", async () => {
    const { project, write } = memoryProject({ "Ping.uf.tsx": PING, "Pong.uf.tsx": PONG });
    await project.compile("Ping.uf.tsx");
    write("Pong.uf.tsx", PONG.replace(/^import .*\n/, "").replace("<Ping n={n - 1} />", "<b />"));
    expect(await project.update(["Pong.uf.tsx"])).toEqual({
      compiled: ["Ping.uf.tsx"],
      copied: [],
    });
    expect((await project.compile("Ping.uf.tsx")).diagnostics).toEqual([]);
  });
});

describe("dependencies", () => {
  it("copy and list a .ts module that a component only re-exports a type from", async () => {
    const { project } = memoryProject({
      "tone.ts": 'export type Tone = "info" | "warning";\n',
      "Badge.uf.tsx":
        'export type { Tone } from "./tone.ts";\n\nexport default function Badge({ text }: { text: string }) {\n  return <span>{text}</span>;\n}\n',
    });
    const result = await project.compile("Badge.uf.tsx");
    expect(result.diagnostics).toEqual([]);
    expect(result.dependencies).toEqual(["tone.ts"]);
    expect(project.copy("tone.ts")).toBe('export type Tone = "info" | "warning";\n');
    const direct = await compile(
      'export type { Tone } from "./tone";\nexport default function Badge() {\n  return <i />;\n}\n',
      { filename: "Badge.uf.tsx", targets: ["vue"], resolve: project.resolve },
    );
    expect(direct.outputs.vue?.map(({ path }) => path)).toEqual(["Badge.vue", "tone.ts"]);
  });

  it("list a missing .uf.ts module, and recompile its importer once it exists", async () => {
    const caller = FIXTURE["C.uf.tsx"]!;
    const { project, write } = memoryProject({ "C.uf.tsx": caller });
    const result = await project.compile("C.uf.tsx");
    expect(result.dependencies).toEqual(["useC.uf.ts"]);
    expect(result.diagnostics.map(({ code }) => code)).toContain("UF1202");
    write("a.ts", FIXTURE["a.ts"]);
    write("useC.uf.ts", FIXTURE["useC.uf.ts"]);
    expect((await project.update(["a.ts", "useC.uf.ts"])).compiled).toEqual(["C.uf.tsx"]);
    expect((await project.compile("C.uf.tsx")).diagnostics.map(({ code }) => code)).not.toContain(
      "UF1202",
    );
  });
});

describe("updates", () => {
  it("follow a chain that changed under a module compiled alone, to the cycle it closes later", async () => {
    const leaf = (name: string) =>
      `export default function ${name}() {\n  return <i>${name}</i>;\n}\n`;
    const renders = (name: string, next: string) =>
      `import ${next} from "./${next}.uf.tsx";\nexport default function ${name}() {\n  return <div><${next} /></div>;\n}\n`;
    const { project, write } = memoryProject({
      "A.uf.tsx": renders("A", "B"),
      "B.uf.tsx": renders("B", "C"),
      "C.uf.tsx": leaf("C"),
      "D.uf.tsx": leaf("D"),
    });
    await project.compile("A.uf.tsx");
    expect(project.dependencies("A.uf.tsx")).toEqual(["B.uf.tsx", "C.uf.tsx"]);
    write("B.uf.tsx", renders("B", "D"));
    expect((await project.update(["B.uf.tsx"])).compiled).toEqual([]);
    expect(project.dependencies("A.uf.tsx")).toEqual(["B.uf.tsx", "D.uf.tsx"]);
    write(
      "D.uf.tsx",
      'import A from "./A.uf.tsx";\nexport default function D({ n }: { n: number }) {\n  return <span>{n > 0 ? <A /> : "D"}</span>;\n}\n',
    );
    expect((await project.update(["D.uf.tsx"])).compiled).toEqual(["A.uf.tsx"]);
    expect((await project.compile("A.uf.tsx")).diagnostics.map(({ code }) => code)).toEqual([
      "UF1205",
    ]);
  });

  it("recompile a module whose child's read threw, once the child reads", async () => {
    const files = new Map([
      [
        "/project/Card.uf.tsx",
        'import Child from "./Child.uf.tsx";\nexport default function Card() {\n  return <div><Child /></div>;\n}\n',
      ],
      ["/project/Child.uf.tsx", "export default function Child() {\n  return <i>Child</i>;\n}\n"],
    ]);
    let locked = true;
    const project = createProject({
      root: "/project",
      targets: ["vue"],
      readFile: (path) => {
        if (locked && path === "/project/Child.uf.tsx") return Promise.reject(new Error("EACCES"));
        return Promise.resolve(files.get(path));
      },
    });
    const codes = async () =>
      (await project.compile("Card.uf.tsx")).diagnostics.map(({ code }) => code);
    expect(await codes()).toContain("UF9001");
    expect(project.dependencies("Card.uf.tsx")).toEqual(["Child.uf.tsx"]);
    locked = false;
    expect((await project.update(["Child.uf.tsx"])).compiled).toEqual(["Card.uf.tsx"]);
    expect(await codes()).toEqual([]);
  });

  it("recompile a module once a .ts module that its shared module imports is created", async () => {
    const { project, write } = memoryProject({
      "Card.uf.tsx":
        'import type { First } from "./first.ts";\nexport default function Card({ first }: { first: First }) {\n  return <i>{first}</i>;\n}\n',
      "first.ts": 'import type { Second } from "./second.ts";\nexport type First = Second;\n',
    });
    const codes = async () =>
      (await project.compile("Card.uf.tsx")).diagnostics.map(({ code }) => code);
    expect(await codes()).toContain("UF1202");
    expect(project.dependencies("Card.uf.tsx")).toContain("second.ts");
    write("second.ts", "export type Second = string;\n");
    expect(await project.update(["second.ts"])).toEqual({
      compiled: ["Card.uf.tsx"],
      copied: ["second.ts"],
    });
    expect(await codes()).toEqual([]);
    expect(project.copy("second.ts")).toBe("export type Second = string;\n");
  });

  it("recompile a module whose read threw, once the file reads", async () => {
    const files = new Map([
      [
        "/project/Card.uf.tsx",
        'import { tone } from "./tone.ts";\nexport default function Card() {\n  return <i>{tone}</i>;\n}\n',
      ],
      ["/project/tone.ts", 'export const tone = "info";\n'],
    ]);
    let locked = true;
    const project = createProject({
      root: "/project",
      targets: ["vue"],
      readFile: (path) => {
        if (locked && path === "/project/tone.ts") return Promise.reject(new Error("EACCES"));
        return Promise.resolve(files.get(path));
      },
    });
    const codes = async () =>
      (await project.compile("Card.uf.tsx")).diagnostics.map(({ code }) => code);
    expect(await codes()).toContain("UF9001");
    locked = false;
    expect((await project.update(["tone.ts"])).compiled).toEqual(["Card.uf.tsx"]);
    expect(await codes()).not.toContain("UF9001");
  });

  it("find a cycle that a module created later closes", async () => {
    const { project, write } = memoryProject({
      "A.uf.tsx":
        'import B from "./B.uf.tsx";\nexport default function A() {\n  return <div><B /></div>;\n}\n',
      "B.uf.tsx":
        'import C from "./C.uf.tsx";\nexport default function B() {\n  return <div><C /></div>;\n}\n',
    });
    expect((await project.compile("A.uf.tsx")).diagnostics).toEqual([]);
    write(
      "C.uf.tsx",
      'import A from "./A.uf.tsx";\nexport default function C({ n }: { n: number }) {\n  return <span>{n > 0 ? <A /> : "C"}</span>;\n}\n',
    );
    expect((await project.update(["C.uf.tsx"])).compiled).toEqual(["A.uf.tsx"]);
    expect((await project.compile("A.uf.tsx")).diagnostics.map(({ code }) => code)).toEqual([
      "UF1205",
    ]);
  });

  it("report a copy a recompile adds, and drop one no module reaches any more", async () => {
    const first = 'export const first = "first";\n';
    const { project, write } = memoryProject({
      "Card.uf.tsx":
        'import { first } from "./first.ts";\nexport default function Card() {\n  return <i>{first}</i>;\n}\n',
      "first.ts": first,
    });
    await project.compile("Card.uf.tsx");
    write("first.ts", `import { second } from "./second.ts";\nexport const first = second;\n`);
    write("second.ts", 'export const second = "second";\n');
    expect(await project.update(["first.ts", "second.ts"])).toEqual({
      compiled: ["Card.uf.tsx"],
      copied: ["first.ts", "second.ts"],
    });
    expect(project.copy("second.ts")).toBe('export const second = "second";\n');
    write("first.ts", first);
    expect(await project.update(["first.ts"])).toEqual({
      compiled: ["Card.uf.tsx"],
      copied: ["first.ts", "second.ts"],
    });
    expect(project.copy("second.ts")).toBeUndefined();
  });
});
