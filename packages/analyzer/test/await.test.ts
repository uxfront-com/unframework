// Async setup (ADR-0101): `const user = await loadUser(props.id)` at the top level of an async
// component's setup is an `Await` item. Any other `await` there is UF2038, an `await` after
// another setup item or one that reads more than props, module values, globals and earlier
// awaits is UF2039, and an async component as a `<component is>` candidate is UF1002.
import type { AwaitItem, UfComponent } from "@unframework.dev/ir";
import { describe, expect, it } from "vitest";

import { problems, run } from "./helpers.ts";

/** The resolver's shared module of loaders. */
const MODULES = new Map([["./api", { file: "api.ts" }]]);

/** Analyses a module with the loaders' shared module. */
function analysed(text: string): ReturnType<typeof run> {
  return run(text, "Test.uf.tsx", { modules: MODULES });
}

const IMPORTS = `import { defineEmits, defineModel, defineSlots, onMounted, ref } from "@uxfront/unframework";
import { loadTeam, loadUser, type User } from "./api";
const PREFIX = "user-";
`;

/** A module with an async component `A` whose setup is `setup`. */
function source(setup: string, parameters = "props: { id: string }"): string {
  return `${IMPORTS}export default async function A(${parameters}) {\n${setup}\nreturn <p>{props.id}</p>;\n}`;
}

/** The diagnostics a setup gets, as `code text-at-span`. */
function reported(setup: string): string[] {
  const text = source(setup);
  return problems(text, analysed(text).diagnostics);
}

/** The component a setup lowers to, with no diagnostics. */
function lowered(setup: string): UfComponent {
  const text = source(setup);
  const { module, diagnostics } = analysed(text);
  expect(problems(text, diagnostics)).toEqual([]);
  return module!.components[0]!;
}

describe("async setup", () => {
  it("lowers a top-level awaited const to an Await item with an awaited binding", () => {
    const component = lowered("const user = await loadUser(props.id);");
    const [item] = component.setup as AwaitItem[];
    expect(item!.kind).toBe("Await");
    expect(item!.value.code).toBe("loadUser(props.id)");
    expect(component.bindings.find((binding) => binding.id === item!.binding)?.kind).toBe(
      "awaited",
    );
  });

  it("keeps the annotation as the item's type", () => {
    const component = lowered("const user: User = await loadUser(props.id);");
    expect((component.setup[0] as AwaitItem).type?.code).toBe("User");
  });

  it("lets an await read an earlier await, a module value and a global, and later items read it", () => {
    const component = lowered(
      [
        "const user = await loadUser(PREFIX + props.id);",
        "const team = await loadTeam(user.teamId + String(Math.max(1, 2)));",
        "const visits = ref(user.visits);",
        "const label = `${user.name} (${team.name})`;",
      ].join("\n"),
    );
    expect(component.setup.map((item) => item.kind)).toEqual(["Await", "Await", "State", "Const"]);
  });

  it("lets the compile-time macros sit before the awaits", () => {
    const component = lowered(
      'const emit = defineEmits<{ ready: [name: string] }>();\nconst user = await loadUser(props.id);\nonMounted(() => emit("ready", user.name));',
    );
    expect(component.setup.map((item) => item.kind)).toEqual(["Await", "Lifecycle"]);
  });

  it("lowers an async component with no await as a plain one", () => {
    const component = lowered("");
    expect(component.setup).toEqual([]);
  });

  it("allows an await inside a function the setup declares, as client code", () => {
    const component = lowered(
      "const user = await loadUser(props.id);\nasync function reload() { const next = await loadUser(props.id); console.log(next.name); }",
    );
    expect(component.setup.map((item) => item.kind)).toEqual(["Await", "Function"]);
  });

  describe("UF2038", () => {
    it.each([
      ["destructuring", "const { name } = await loadUser(props.id);", "await loadUser(props.id)"],
      [
        "a larger expression",
        "const name = (await loadUser(props.id)).name;",
        "await loadUser(props.id)",
      ],
      [
        "a nested await",
        "const team = await loadTeam(await loadUser(props.id).then(String));",
        "await loadUser(props.id).then(String)",
      ],
      ["a let", "let user = await loadUser(props.id);", "await loadUser(props.id)"],
      ["a bare statement", "await loadUser(props.id);", "await loadUser(props.id)"],
      ["a condition", "if (props.id) { await loadUser(props.id); }", "await loadUser(props.id)"],
      ["a block", "{ await loadUser(props.id); }", "await loadUser(props.id)"],
      [
        "for await",
        "for await (const user of [loadUser(props.id)]) console.log(user);",
        "for await",
      ],
    ])("is reported at %s", (_, setup, at) => {
      expect(reported(setup)).toEqual([`UF2038 ${at}`]);
    });
  });

  describe("UF2039", () => {
    it("is reported at an await after another setup item", () => {
      expect(reported("const count = ref(0);\nconst user = await loadUser(props.id);")).toEqual([
        "UF2039 await loadUser(props.id)",
      ]);
    });

    it.each([
      ["a constant", "const label = props.id;\nconst user = await loadUser(label);"],
      [
        "a later await",
        "const user = await loadUser(team.name);\nconst team = await loadTeam(props.id);",
      ],
    ])("is reported at an awaited expression that reads %s", (_, setup) => {
      expect(reported(setup)).toContainEqual(expect.stringMatching(/^UF2039 (label|team)$/));
    });

    it("is reported at an awaited expression that reads emit", () => {
      expect(
        reported(
          'const emit = defineEmits<{ load: [id: string] }>();\nconst user = await loadUser(String(emit("load", props.id)));',
        ),
      ).toEqual(["UF2039 emit"]);
    });

    it("is reported at an awaited expression that reads a model", () => {
      expect(
        reported(
          'const user = await loadUser(open.value);\nconst open = defineModel<string>("open");',
        ),
      ).toEqual(["UF2039 open"]);
    });

    it("is reported at an awaited expression that reads a slot", () => {
      expect(
        reported(
          "const slots = defineSlots<{ default?: () => any }>();\nconst user = await loadUser(slots.default ? props.id : PREFIX);",
        ),
      ).toEqual(["UF2039 slots"]);
    });
  });

  describe("the API", () => {
    it("marks an async component's API async, and leaves a sync one's without the field", () => {
      const text = `${IMPORTS}export async function A(props: { id: string }) { const user = await loadUser(props.id); return <p>{user.name}</p>; }
export function B() { return <p />; }`;
      const { api, diagnostics } = analysed(text);
      expect(problems(text, diagnostics)).toEqual([]);
      const [a, b] = api!.components;
      expect(a!.async).toBe(true);
      expect(b).not.toHaveProperty("async");
    });

    it("reports an async component as a <component is> candidate as UF1002", () => {
      const text = `${IMPORTS}async function Member(props: { id: string }) { const user = await loadUser(props.id); return <p>{user.name}</p>; }
function Other(props: { id: string }) { return <p>{props.id}</p>; }
export function A(props: { id: string; wide: boolean }) { return <div><component is={props.wide ? Member : Other} id={props.id} /></div>; }`;
      expect(problems(text, analysed(text).diagnostics)).toEqual(["UF1002 Member"]);
    });
  });
});
