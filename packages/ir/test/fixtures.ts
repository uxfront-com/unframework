// IR the tests share: a module that uses every kind of node, attribute, class part, style
// declaration, reference and binding, and keeps the invariants. Its spans index a source the
// tests never parse: what matters is that each expression's code fills its span and each
// reference spans the name it reads.
import {
  bindingId,
  createBinding,
  createBindingReference,
  createBoundAttribute,
  createBoundStyle,
  createBranch,
  createClassAttribute,
  createComponent,
  createDynamicClass,
  createElement,
  createExport,
  createExpression,
  createFor,
  createFragment,
  createGlobalReference,
  createIf,
  createInterpolation,
  createModule,
  createProp,
  createPropsParameter,
  createSpreadAttribute,
  createSpreadKey,
  createStaticAttribute,
  createStaticClass,
  createStaticStyle,
  createStyleAttribute,
  createText,
  createToggleClass,
  createTypeDeclaration,
  createTypeText,
  span,
} from "../src/index.ts";
import type { BindingId, Expression, Reference, UfModule } from "../src/index.ts";

/**
 * An expression whose code starts at `start`, with a reference for each `[text, binding]`
 * (a global when the binding is left out), found by its text in the code: the `nth` occurrence.
 */
export function expression(
  code: string,
  start: number,
  refs: readonly (readonly [text: string, binding?: BindingId, nth?: number])[] = [],
): Expression {
  const references: Reference[] = refs.map(([text, binding, nth = 0]) => {
    let offset = -1;
    for (let found = 0; found <= nth; found++) offset = code.indexOf(text, offset + 1);
    if (offset === -1) throw new Error(`"${text}" is not in "${code}"`);
    const at = span(start + offset, start + offset + text.length);
    return binding === undefined
      ? createGlobalReference(text, at)
      : createBindingReference(binding, at);
  });
  return createExpression(code, span(start, start + code.length), references);
}

/** The props' bindings and the loop variables of {@link everyKind}. */
export const ids: Readonly<
  Record<"label" | "tone" | "items" | "attrs" | "item" | "index", BindingId>
> = {
  label: bindingId("label", 10),
  tone: bindingId("tone", 20),
  items: bindingId("items", 30),
  attrs: bindingId("attrs", 40),
  item: bindingId("item", 300),
  index: bindingId("index", 306),
};

/** A one-character span at `start`. */
const at = (start: number) => span(start, start + 1);

/** A module whose one component uses every kind of the IR, and keeps the invariants. */
export function everyKind(): UfModule {
  const declaration = "interface Attrs { id?: string }";
  const attrs = createTypeDeclaration("Attrs", true, declaration, span(0, declaration.length));
  const label = createProp(
    "label",
    false,
    createTypeText("string", span(110, 116)),
    at(10),
    ids.label,
  );
  const tone = createProp(
    "tone",
    true,
    createTypeText('"info" | "warn"', span(120, 135)),
    at(20),
    ids.tone,
    expression('"info"', 21),
  );
  const items = createProp(
    "items",
    false,
    createTypeText("string[]", span(140, 148)),
    at(30),
    ids.items,
  );
  const attrsProp = createProp(
    "attrs",
    true,
    createTypeText("Attrs", span(150, 155)),
    at(40),
    ids.attrs,
  );
  const card = createElement(
    "p",
    [
      createClassAttribute(
        [
          createStaticClass("card", at(200)),
          createToggleClass(
            "active",
            expression('tone === "warn"', 201, [["tone", ids.tone]]),
            at(201),
          ),
          createDynamicClass(expression("tone", 220, [["tone", ids.tone]]), at(220)),
        ],
        at(199),
      ),
      createStyleAttribute(
        [
          createStaticStyle("color", "red", at(230)),
          createBoundStyle("margin-top", expression("label", 240, [["label", ids.label]]), at(240)),
        ],
        at(229),
      ),
      createBoundAttribute(
        "title",
        expression("label.trim()", 250, [["label", ids.label]]),
        at(250),
      ),
      createSpreadAttribute(
        expression("attrs", 270, [["attrs", ids.attrs]]),
        [createSpreadKey("id", at(160))],
        at(269),
      ),
    ],
    [
      createText("Hello, ", at(280)),
      createInterpolation(
        expression("String(label)", 290, [["String"], ["label", ids.label]]),
        at(289),
      ),
    ],
    at(198),
  );
  const list = createIf(
    [
      createBranch(
        expression("items.length > 0", 320, [["items", ids.items]]),
        [
          createElement(
            "ul",
            [],
            [
              createFor(
                expression("items", 340, [["items", ids.items]]),
                ids.item,
                expression("index", 350, [["index", ids.index]]),
                createElement(
                  "li",
                  [],
                  [createInterpolation(expression("item", 360, [["item", ids.item]]), at(359))],
                  at(355),
                ),
                at(339),
                ids.index,
              ),
            ],
            at(330),
          ),
        ],
        at(319),
      ),
      createBranch(
        undefined,
        [createElement("p", [], [createText("None", at(380))], at(379))],
        at(378),
      ),
    ],
    at(318),
  );
  const icon = createElement(
    "svg",
    [createStaticAttribute("viewBox", "0 0 2 2", at(400))],
    [
      createElement("circle", [createStaticAttribute("r", "1", at(410))], [], at(409)),
      createElement("text", [], [createText(" ", at(420))], at(419)),
    ],
    at(399),
  );
  return createModule(
    "Card.uf.tsx",
    [
      createComponent(
        "Card",
        createFragment([card, list, icon], at(197)),
        span(100, 500),
        [label, tone, items, attrsProp],
        createPropsParameter("destructured", createTypeText("CardProps", span(105, 114)), at(101)),
        ["Attrs"],
        [
          createBinding("label", "prop", at(10)),
          createBinding("tone", "prop", at(20)),
          createBinding("items", "prop", at(30)),
          createBinding("attrs", "prop", at(40)),
          createBinding("item", "loopVar", at(300)),
          createBinding("index", "loopVar", at(306)),
        ],
      ),
    ],
    [createExport("default", "Card", span(100, 114))],
    [attrs],
  );
}
