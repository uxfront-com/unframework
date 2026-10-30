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
    // C reaches a.ts through useC's API, and the cycle search reads it too.
    expect(project.dependencies("C.uf.tsx")).toEqual(["a.ts", "useC.uf.ts"]);
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
    const child = 'export default function Child({ label }: { label: string }) {\n  return <i>{label}</i>;\n}\n';
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

describe("import cycles (UF1205)", () => {
  const PING =
    'import Pong from "./Pong.uf.tsx";\nexport default function Ping({ n }: { n: number }) {\n  return <span>{n > 0 ? <Pong n={n - 1} /> : <i>Ping</i>}</span>;\n}\n';
  const PONG =
    'import Ping from "./Ping.uf.tsx";\nexport default function Pong({ n }: { n: number }) {\n  return <span>{n > 0 ? <Ping n={n - 1} /> : <i>Pong</i>}</span>;\n}\n';

  it("reports the import that closes a cycle, with its files, and withholds the module", async () => {
    const { project } = memoryProject({ "Ping.uf.tsx": PING, "Pong.uf.tsx": PONG });
    const result = await project.compile("Ping.uf.tsx");
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "UF1205",
        file: "Ping.uf.tsx",
        span: { start: PING.indexOf('"./Pong'), end: PING.indexOf(";") },
        message:
          '"./Pong.uf.tsx" closes an import cycle, Ping.uf.tsx → Pong.uf.tsx → Ping.uf.tsx: none of its modules can load before the others.',
      }),
    ]);
    expect(result.ir).toBeUndefined();
    expect(result.outputs.vue).toEqual([]);
  });

  it("follows shared modules, composables and type imports, and names files from the source", async () => {
    const { project } = memoryProject({
      "ui/Card.uf.tsx":
        'import { tone } from "../shared/tone";\nexport type CardTone = "info";\nexport default function Card() {\n  return <i>{tone}</i>;\n}\n',
      "shared/tone.ts":
        'import type { CardTone } from "../ui/Card.uf.tsx";\nexport const tone: CardTone = "info";\n',
    });
    const result = await project.compile("ui/Card.uf.tsx");
    expect(result.diagnostics.map(({ code, message }) => [code, message])).toContainEqual([
      "UF1205",
      '"../shared/tone" closes an import cycle, Card.uf.tsx → ../shared/tone.ts → Card.uf.tsx: none of its modules can load before the others.',
    ]);
  });

  it("leaves a self-import to UF1203, and a cycle the source is not in to its own modules", async () => {
    const { project } = memoryProject({
      "Top.uf.tsx":
        'import Ping from "./Ping.uf.tsx";\nexport default function Top() {\n  return <Ping n={1} />;\n}\n',
      "Ping.uf.tsx": PING,
      "Pong.uf.tsx": PONG,
    });
    const result = await project.compile("Top.uf.tsx");
    expect(result.diagnostics.map(({ code }) => code)).not.toContain("UF1205");
    expect(await project.resolve.cycle!({ specifier: "./Top.uf.tsx", importer: "Top.uf.tsx" }))
      .toBeUndefined();
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
