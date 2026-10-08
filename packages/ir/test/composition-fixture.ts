// A module whose one component uses components, slots, models and context (ADR-0055), and
// keeps the invariants: its spans index the source written out below.
import {
  bindingId,
  createBinding,
  createBindingReference,
  createBranch,
  createCode,
  createComponent,
  createComponentNode,
  createElement,
  createExport,
  createExpression,
  createFunctionCode,
  createIf,
  createImportedName,
  createInjectionKeyDeclaration,
  createInjectItem,
  createInlineHandler,
  createInterpolation,
  createListenerAttribute,
  createModelAttribute,
  createModelBindingAttribute,
  createModelItem,
  createModule,
  createModuleImport,
  createProp,
  createPropAttribute,
  createPropsParameter,
  createProvideItem,
  createSlotDeclaration,
  createSlotFill,
  createSlotOutlet,
  createSlotReference,
  createSlots,
  createStateItem,
  createTypeText,
  createWriteReference,
  span,
} from "../src/index.ts";
import type { ComponentApi, Expression, Reference, Span, UfModule } from "../src/index.ts";

export const SOURCE: string = [
  'import Field from "./Field.uf.tsx";',
  'export const ThemeKey: InjectionKey<string> = Symbol("theme");',
  "export default function Form({ label }: { label: string }) {",
  "  const slots = defineSlots<{ default?: () => any; title?: () => any }>();",
  '  const text = ref("");',
  '  const open = defineModel<boolean>("open");',
  "  const theme = inject(ThemeKey);",
  "  provide(ThemeKey, label);",
  "  return (",
  "    <div>",
  "      {slots.title && <h2>{theme}</h2>}",
  "      <Field label={label} v-model:value={text.value} onClear={() => (open.value = false)}>{label}</Field>",
  "      <input v-model={text.value} />",
  "      {slots.default?.() ?? label}",
  "    </div>",
  "  );",
  "}",
].join("\n");

/** The span of the `nth` occurrence of `text` in the source, at or after `from`. */
export function find(text: string, nth = 0, from = 0): Span {
  let offset = from - 1;
  for (let found = 0; found <= nth; found++) offset = SOURCE.indexOf(text, offset + 1);
  if (offset === -1) throw new Error(`"${text}" is not in the source`);
  return span(offset, offset + text.length);
}

/** The span of `name` in the first occurrence of `context`. */
function nameIn(context: string, name: string): Span {
  const { start } = find(context);
  const offset = context.indexOf(name);
  return span(start + offset, start + offset + name.length);
}

/** The text of a span. */
const text = ({ start, end }: Span) => SOURCE.slice(start, end);

export const ids: Readonly<Record<"label" | "slots" | "text" | "open" | "theme", string>> = {
  label: bindingId("label", nameIn("Form({ label }", "label").start),
  slots: bindingId("slots", nameIn("const slots", "slots").start),
  text: bindingId("text", nameIn("const text", "text").start),
  open: bindingId("open", nameIn("const open", "open").start),
  theme: bindingId("theme", nameIn("const theme", "theme").start),
};

/** An expression at `at`, with a reference to a binding for each `[text, binding]` in it. */
export function expression(
  at: Span,
  refs: readonly (readonly [string, string])[] = [],
): Expression {
  const references: Reference[] = refs.map(([part, binding]) => {
    const offset = text(at).indexOf(part);
    return createBindingReference(
      binding,
      span(at.start + offset, at.start + offset + part.length),
    );
  });
  return createExpression(text(at), at, references);
}

/** What `Field.uf.tsx` declares, as the resolver returns it (ADR-0053). */
const FIELD: ComponentApi = {
  name: "Field",
  export: "default",
  props: [{ name: "label", optional: false, type: "string" }],
  events: [{ name: "clear", parameters: [] }],
  models: [{ name: "value", optional: true, type: "string" }],
  slots: [{ name: "default", optional: true }],
  exposes: [],
  inheritAttrs: true,
  root: "element",
  rootTag: "label",
};

/** A module whose component uses components, slots, models and context, keeping the invariants. */
export function composition(): UfModule {
  const fieldLine = find("<Field label");
  const fieldEnd = find("</Field>");
  const handler = find("() => (open.value = false)");
  const body = find("(open.value = false)");
  const field = createComponentNode(
    "Field",
    [
      createPropAttribute(
        "label",
        expression(find("label", 0, find("<Field").end)),
        find("label={label}"),
      ),
      createModelBindingAttribute(
        "value",
        expression(find("text.value", 0, fieldLine.start), [["text.value", ids.text]]),
        find("v-model:value={text.value}"),
      ),
      createListenerAttribute(
        "clear",
        createInlineHandler(
          createFunctionCode(
            [],
            createCode(text(body), body, [
              createWriteReference(
                ids.open,
                "=",
                body,
                find("open.value", 0, body.start),
                find("false", 0, body.start),
                true,
              ),
            ]),
            handler,
            { expression: true },
          ),
          handler,
        ),
        find("onClear={() => (open.value = false)}"),
      ),
    ],
    [
      createSlotFill(
        "default",
        [
          createInterpolation(
            expression(find("label", 0, find(">{label}").start), [["label", ids.label]]),
            find("{label}", 0, find(">{label}").start),
          ),
        ],
        find("{label}", 0, find(">{label}").start),
      ),
    ],
    span(find("<Field").start, fieldEnd.end),
  );
  const presence = find("slots.title");
  const branch = createIf(
    [
      createBranch(
        createExpression(text(presence), presence, [createSlotReference("title", presence)]),
        [
          createElement(
            "h2",
            [],
            [
              createInterpolation(
                expression(find("theme", 0, find("<h2>").start), [["theme", ids.theme]]),
                find("{theme}"),
              ),
            ],
            find("<h2>{theme}</h2>"),
          ),
        ],
        find("slots.title && <h2>{theme}</h2>"),
      ),
    ],
    find("{slots.title && <h2>{theme}</h2>}"),
  );
  const input = createElement(
    "input",
    [
      createModelAttribute(
        expression(find("text.value", 0, find("<input").start), [["text.value", ids.text]]),
        "text",
        find("v-model={text.value}", 0, find("<input").start),
      ),
    ],
    [],
    find("<input v-model={text.value} />"),
  );
  const outlet = createSlotOutlet(
    "default",
    [
      createInterpolation(
        expression(find("label", 0, find("?? label").start), [["label", ids.label]]),
        find("label", 0, find("?? label").start),
      ),
    ],
    find("{slots.default?.() ?? label}"),
  );
  const render = createElement(
    "div",
    [],
    [branch, field, input, outlet],
    span(find("<div>").start, find("</div>").end),
  );
  const component = createComponent(
    "Form",
    render,
    span(find("export default function").start, SOURCE.length),
    [
      createProp(
        "label",
        false,
        createTypeText("string", find("string", 0, find("{ label: string }").start)),
        find("label: string"),
        ids.label,
      ),
    ],
    createPropsParameter(
      "destructured",
      createTypeText("{ label: string }", find("{ label: string }")),
      find("{ label }: { label: string }"),
    ),
    [],
    [
      createBinding("label", "prop", nameIn("Form({ label }", "label")),
      createBinding("slots", "slots", nameIn("const slots", "slots")),
      createBinding("text", "state", nameIn("const text", "text")),
      createBinding("open", "model", nameIn("const open", "open")),
      createBinding("theme", "context", nameIn("const theme", "theme")),
    ],
    [
      createStateItem(ids.text, find('const text = ref("");'), createCode('""', find('""'))),
      createModelItem(ids.open, "open", find('const open = defineModel<boolean>("open");'), {
        type: createTypeText("boolean", find("boolean")),
      }),
      createInjectItem(ids.theme, "ThemeKey", find("const theme = inject(ThemeKey);")),
      createProvideItem(
        "ThemeKey",
        createCode("label", find("label", 0, find("provide(").start), [
          createBindingReference(ids.label, find("label", 0, find("provide(").start)),
        ]),
        find("provide(ThemeKey, label);"),
      ),
    ],
    undefined,
    {
      slots: createSlots(
        ids.slots,
        createTypeText(
          "{ default?: () => any; title?: () => any }",
          find("{ default?: () => any; title?: () => any }"),
        ),
        [
          createSlotDeclaration("default", true, find("default?: () => any")),
          createSlotDeclaration("title", true, find("title?: () => any")),
        ],
        find("const slots = defineSlots<{ default?: () => any; title?: () => any }>();"),
      ),
    },
  );
  return createModule(
    "Form.uf.tsx",
    [component],
    [createExport("default", "Form", find("export default function"))],
    [],
    [
      createModuleImport(
        "./Field.uf.tsx",
        "Field.uf.tsx",
        { file: "Field.uf.tsx", components: [FIELD], keys: [] },
        [createImportedName("Component", "default", "Field", find("Field"))],
        find('import Field from "./Field.uf.tsx";'),
      ),
    ],
    [
      createInjectionKeyDeclaration(
        "ThemeKey",
        "theme",
        createTypeText("string", find("string")),
        find('export const ThemeKey: InjectionKey<string> = Symbol("theme");'),
      ),
    ],
  );
}
