// Two modules that use M5's contract (ADR-0067 to ADR-0070) and keep the invariants: a `.uf.ts`
// module with a composable, and a `.uf.tsx` module whose generic component imports types, a
// shared module's value and the composable, reads a top-level `const`, and holds a prop another
// declaration declares. Their spans index the sources written out below.
import {
  bindingId,
  createBinding,
  createBindingReference,
  createBoundAttribute,
  createCode,
  createComponent,
  createComposable,
  createComposableParameter,
  createDeclaredBy,
  createDeclaredTypeExport,
  createElement,
  createExport,
  createExpression,
  createFunctionCode,
  createFunctionItem,
  createGetterArgument,
  createGlobalReference,
  createImportedName,
  createInterpolation,
  createLifecycleItem,
  createModule,
  createModuleConstant,
  createModuleImport,
  createNamedImport,
  createProp,
  createPropsParameter,
  createReturnedMember,
  createSharedModuleImport,
  createSlotDeclaration,
  createSlots,
  createStateItem,
  createTypeDeclaration,
  createTypeExportName,
  createTypeImport,
  createTypeParameter,
  createTypeReExport,
  createTypeText,
  createUsedMember,
  createUseItem,
  createValueArgument,
  createWriteReference,
  span,
} from "../src/index.ts";
import type { ComposableApi, Span, UfModule } from "../src/index.ts";

/** The `.uf.ts` module: one composable, with a value and a getter parameter, and an effect. */
export const COMPOSABLE_SOURCE: string = [
  'import { onMounted, ref } from "unframework";',
  "export function useToggle(initial: boolean, label: () => string) {",
  "  const on = ref(initial);",
  "  function toggle() {",
  "    on.value = !on.value;",
  "  }",
  "  onMounted(() => console.log(label()));",
  "  return { on, toggle };",
  "}",
].join("\n");

/** The `.uf.tsx` module: a generic list that uses the composable and shared values. */
export const SOURCE: string = [
  'import type { Base, Item } from "./types";',
  'import { useToggle } from "./useToggle.uf.ts";',
  'import { sizes } from "./tokens";',
  'export type { Tone } from "./types";',
  'export type Size = "sm" | "md";',
  "const GAP = sizes.sm * 2;",
  "interface ListProps<T extends Item> extends Base { items: T[] }",
  "export default function List<T extends Item>({ items, label }: ListProps<T>) {",
  "  const slots = defineSlots<{ item?: (props: { item: T }) => any }>();",
  "  const { on, toggle } = useToggle(false, () => label);",
  "  return <p title={label}>{on.value ? GAP : sizes.md}</p>;",
  "}",
].join("\n");

/** The span of the `nth` occurrence of `text` in `source`, at or after `from`. */
function locate(source: string, text: string, nth = 0, from = 0): Span {
  let offset = from - 1;
  for (let found = 0; found <= nth; found++) offset = source.indexOf(text, offset + 1);
  if (offset === -1) throw new Error(`"${text}" is not in the source`);
  return span(offset, offset + text.length);
}

/** The span of the `nth` occurrence of `text` in the `.uf.tsx` module's source. */
export function find(text: string, nth = 0, from = 0): Span {
  return locate(SOURCE, text, nth, from);
}

/** The span of `name` in the first occurrence of `context` in `source`. */
function nameIn(source: string, context: string, name: string): Span {
  const { start } = locate(source, context);
  const offset = context.indexOf(name);
  return span(start + offset, start + offset + name.length);
}

/** The text of a span of the `.uf.tsx` module's source. */
const text = ({ start, end }: Span) => SOURCE.slice(start, end);

/** What `useToggle.uf.ts` exports, as the resolver returns it (ADR-0069). */
export const USE_TOGGLE: ComposableApi = {
  name: "useToggle",
  parameters: [
    { name: "initial", kind: "value", type: "boolean" },
    { name: "label", kind: "getter", type: "() => string" },
  ],
  members: [
    { name: "on", kind: "state" },
    { name: "toggle", kind: "function", client: true },
  ],
  hasEffects: true,
};

/** The `.uf.ts` module, keeping the invariants. */
export function composableModule(): UfModule {
  const at = (context: string, name: string) => nameIn(COMPOSABLE_SOURCE, context, name);
  const where = (part: string, nth = 0) => locate(COMPOSABLE_SOURCE, part, nth);
  const own = {
    initial: bindingId("initial", at("initial: boolean", "initial").start),
    label: bindingId("label", at("label: () => string", "label").start),
    on: bindingId("on", at("const on", "on").start),
    toggle: bindingId("toggle", at("function toggle", "toggle").start),
  };
  const write = where("on.value = !on.value");
  const body = where("{\n    on.value = !on.value;\n  }");
  const hook = where("() => console.log(label())");
  const call = where("console.log(label())");
  const composable = createComposable(
    "useToggle",
    span(where("export function useToggle").start, COMPOSABLE_SOURCE.length),
    [
      createComposableParameter(
        "initial",
        "value",
        createTypeText("boolean", where("boolean")),
        own.initial,
        where("initial: boolean"),
      ),
      createComposableParameter(
        "label",
        "getter",
        createTypeText("() => string", where("() => string")),
        own.label,
        where("label: () => string"),
      ),
    ],
    {
      bindings: [
        createBinding("initial", "argument", at("initial: boolean", "initial")),
        createBinding("label", "argument", at("label: () => string", "label")),
        createBinding("on", "state", at("const on", "on")),
        createBinding("toggle", "localFn", at("function toggle", "toggle")),
      ],
      setup: [
        createStateItem(
          own.on,
          where("const on = ref(initial);"),
          createCode("initial", where("initial", 1), [
            createBindingReference(own.initial, where("initial", 1)),
          ]),
        ),
        createFunctionItem(
          own.toggle,
          "declaration",
          createFunctionCode(
            [],
            createCode(COMPOSABLE_SOURCE.slice(body.start, body.end), body, [
              createWriteReference(
                own.on,
                "=",
                write,
                span(write.start, write.start + "on.value".length),
                span(write.end - "!on.value".length, write.end),
              ),
              createBindingReference(own.on, span(write.end - "on.value".length, write.end)),
            ]),
            span(where("() {").start, body.end),
          ),
          span(where("function toggle").start, body.end),
        ),
        createLifecycleItem(
          "mounted",
          createFunctionCode(
            [],
            createCode("console.log(label())", call, [
              createGlobalReference("console", span(call.start, call.start + "console".length)),
              createBindingReference(
                own.label,
                span(call.start + "console.log(".length, call.start + "console.log(label".length),
                false,
                true,
              ),
            ]),
            hook,
            { expression: true },
          ),
          where("onMounted(() => console.log(label()));"),
        ),
      ],
      returns: [
        createReturnedMember("on", own.on, at("return { on, toggle }", "on")),
        createReturnedMember("toggle", own.toggle, at("return { on, toggle }", "toggle")),
      ],
    },
  );
  return createModule("useToggle.uf.ts", [], [], [], [], [], [], { composables: [composable] });
}

export const ids: Readonly<
  Record<"sizes" | "gap" | "items" | "label" | "slots" | "on" | "toggle", string>
> = {
  sizes: bindingId("sizes", nameIn(SOURCE, "{ sizes }", "sizes").start),
  gap: bindingId("GAP", nameIn(SOURCE, "const GAP", "GAP").start),
  items: bindingId("items", nameIn(SOURCE, "({ items, label }", "items").start),
  label: bindingId("label", nameIn(SOURCE, "({ items, label }", "label").start),
  slots: bindingId("slots", nameIn(SOURCE, "const slots", "slots").start),
  on: bindingId("on", nameIn(SOURCE, "const { on, toggle }", "on").start),
  toggle: bindingId("toggle", nameIn(SOURCE, "const { on, toggle }", "toggle").start),
};

/** The `.uf.tsx` module, keeping the invariants. */
export function modules(): UfModule {
  const props = find("ListProps<T>", 0, find("export default function").start);
  const slotsType = find("<{ item?: (props: { item: T }) => any }>");
  const getter = find("() => label");
  const shown = find("on.value ? GAP : sizes.md");
  const component = createComponent(
    "List",
    createElement(
      "p",
      [
        createBoundAttribute(
          "title",
          createExpression("label", find("label", 0, find("<p title=").start), [
            createBindingReference(ids.label, find("label", 0, find("<p title=").start)),
          ]),
          find("title={label}"),
        ),
      ],
      [
        createInterpolation(
          createExpression(text(shown), shown, [
            createBindingReference(ids.on, find("on.value", 0, shown.start)),
            createBindingReference(ids.gap, find("GAP", 0, shown.start)),
            createBindingReference(ids.sizes, find("sizes", 0, shown.start)),
          ]),
          find("{on.value ? GAP : sizes.md}"),
        ),
      ],
      find("<p title={label}>{on.value ? GAP : sizes.md}</p>"),
    ),
    span(find("export default function List").start, SOURCE.length),
    [
      createProp("items", false, createTypeText("T[]", find("T[]")), find("items: T[]"), ids.items),
      // `label` comes from `Base`, in another file: its type is that file's text, at the props
      // annotation's span (ADR-0067).
      createProp(
        "label",
        false,
        createTypeText("string", props),
        props,
        ids.label,
        undefined,
        createDeclaredBy("types.ts", "Base", span(40, 54)),
      ),
    ],
    createPropsParameter(
      "destructured",
      createTypeText("ListProps<T>", props),
      find("{ items, label }: ListProps<T>"),
    ),
    ["ListProps"],
    [
      createBinding("sizes", "import", nameIn(SOURCE, "{ sizes }", "sizes")),
      createBinding("GAP", "moduleConst", nameIn(SOURCE, "const GAP", "GAP")),
      createBinding("items", "prop", nameIn(SOURCE, "({ items, label }", "items")),
      createBinding("label", "prop", nameIn(SOURCE, "({ items, label }", "label")),
      createBinding("slots", "slots", nameIn(SOURCE, "const slots", "slots")),
      createBinding("on", "usedState", nameIn(SOURCE, "const { on, toggle }", "on")),
      createBinding("toggle", "usedFn", nameIn(SOURCE, "const { on, toggle }", "toggle")),
    ],
    [
      createUseItem(
        "useToggle",
        [
          createValueArgument(createCode("false", find("false")), find("false")),
          createGetterArgument(
            createFunctionCode(
              [],
              createCode("label", find("label", 0, getter.start), [
                createBindingReference(ids.label, find("label", 0, getter.start)),
              ]),
              getter,
              { expression: true },
            ),
            getter,
          ),
        ],
        [
          createUsedMember("on", ids.on, nameIn(SOURCE, "const { on, toggle }", "on")),
          createUsedMember("toggle", ids.toggle, nameIn(SOURCE, "const { on, toggle }", "toggle")),
        ],
        find("const { on, toggle } = useToggle(false, () => label);"),
        true,
      ),
    ],
    undefined,
    {
      typeParameters: [
        createTypeParameter(
          "T",
          find("T extends Item", 1),
          createTypeText("Item", find("Item", 0, find("List<T extends").start)),
        ),
      ],
      slots: createSlots(
        ids.slots,
        createTypeText(text(slotsType).slice(1, -1), span(slotsType.start + 1, slotsType.end - 1)),
        [
          createSlotDeclaration(
            "item",
            true,
            find("item?: (props: { item: T }) => any"),
            createTypeText("{ item: T }", find("{ item: T }")),
            ["T"],
          ),
        ],
        find("const slots = defineSlots<{ item?: (props: { item: T }) => any }>();"),
      ),
    },
  );
  const sizes = nameIn(SOURCE, "{ sizes }", "sizes");
  const gap = find("sizes.sm * 2");
  return createModule(
    "List.uf.tsx",
    [component],
    [createExport("default", "List", find("export default function List"))],
    [
      createTypeDeclaration(
        "ListProps",
        false,
        "interface ListProps<T extends Item> extends Base { items: T[] }",
        find("interface ListProps<T extends Item> extends Base { items: T[] }"),
      ),
    ],
    [
      createModuleImport(
        "./useToggle.uf.ts",
        "useToggle.uf.ts",
        { file: "useToggle.uf.ts", components: [], keys: [], composables: [USE_TOGGLE] },
        [
          createImportedName(
            "Composable",
            "useToggle",
            "useToggle",
            nameIn(SOURCE, "{ useToggle }", "useToggle"),
          ),
        ],
        find('import { useToggle } from "./useToggle.uf.ts";'),
      ),
    ],
    [],
    [],
    {
      typeImports: [
        createTypeImport(
          "./types",
          [
            createNamedImport("Base", "Base", nameIn(SOURCE, "{ Base, Item }", "Base")),
            createNamedImport("Item", "Item", nameIn(SOURCE, "{ Base, Item }", "Item")),
          ],
          find('import type { Base, Item } from "./types";'),
        ),
      ],
      typeExports: [
        createTypeReExport(
          "./types",
          [createTypeExportName("Tone", "Tone", nameIn(SOURCE, "{ Tone }", "Tone"))],
          find('export type { Tone } from "./types";'),
        ),
        createDeclaredTypeExport(
          "Size",
          'type Size = "sm" | "md";',
          find('type Size = "sm" | "md";'),
        ),
      ],
      moduleImports: [
        createSharedModuleImport(
          "./tokens",
          "tokens.ts",
          [createNamedImport("sizes", "sizes", sizes)],
          find('import { sizes } from "./tokens";'),
        ),
      ],
      constants: [
        createModuleConstant(
          "GAP",
          ids.gap,
          createCode("sizes.sm * 2", gap, [
            createBindingReference(ids.sizes, span(gap.start, gap.start + "sizes".length)),
          ]),
          find("const GAP = sizes.sm * 2;"),
        ),
      ],
    },
  );
}
