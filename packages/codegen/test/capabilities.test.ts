import {
  createBinding,
  createBindingReference,
  createBoundAttribute,
  createBoundStyle,
  createBranch,
  createClassAttribute,
  createComponent,
  createDynamicClass,
  createElement,
  createExpression,
  createFor,
  createFragment,
  createIf,
  createInterpolation,
  createModule,
  createProp,
  createPropsParameter,
  createSpreadAttribute,
  createSpreadKey,
  createStaticAttribute,
  createStyleAttribute,
  createText,
  createTypeText,
} from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { CAPABILITY_NAMES, requiredCapabilities } from "../src/index.ts";

const at = (start: number) => ({ start, end: start + 1 });

/** `label`, a reference to the prop of that name, at `start`. */
const label = (start: number) =>
  createExpression("label", { start, end: start + 5 }, [
    createBindingReference("label@10", { start, end: start + 5 }),
  ]);
/** `item`, a reference to the loop variable of that name, at `start`. */
const item = (start: number) =>
  createExpression("item", { start, end: start + 4 }, [
    createBindingReference("item@50", { start, end: start + 4 }),
  ]);

describe("requiredCapabilities", () => {
  it("derives each capability a module uses, with where it is first used", () => {
    const first = createElement(
      "div",
      [],
      [
        createText("a", at(1)),
        createElement(
          "select",
          [createStaticAttribute("name", "s", at(3)), createStaticAttribute("size", "2", at(4))],
          [createElement("option", [], [createText("x", at(6))], at(5))],
          at(2),
        ),
      ],
      at(0),
    );
    const second = createElement(
      "select",
      [createStaticAttribute("size", "3", at(11))],
      [createElement("option", [], [], at(12))],
      at(10),
    );
    const module = createModule(
      "Choice.uf.tsx",
      [createComponent("First", first, at(0)), createComponent("Second", second, at(10))],
      [],
    );
    expect([...requiredCapabilities(module)]).toEqual([
      ["element", at(0)],
      ["text", at(1)],
      ["static-attribute", at(3)],
      ["listbox", at(4)],
    ]);
  });

  // Each of M1's capabilities, derived where the module first uses it: props at the props
  // parameter, a fragment at the root, SVG at its `<svg>`, and the node and attribute kinds.
  it("derives M1's capabilities, each where it is first used", () => {
    const card = createElement(
      "p",
      [
        createClassAttribute([createDynamicClass(label(100), at(100))], at(99)),
        createStyleAttribute([createBoundStyle("color", label(110), at(110))], at(109)),
        createBoundAttribute("title", label(120), at(119)),
        createSpreadAttribute(label(130), [createSpreadKey("id", at(20))], false, at(129)),
        createStaticAttribute("id", "x", at(139)),
      ],
      [createInterpolation(label(150), at(149))],
      at(98),
    );
    const list = createIf(
      [
        createBranch(
          label(160),
          [
            createElement(
              "select",
              [createBoundAttribute("size", label(171), at(170))],
              [
                createFor(
                  label(180),
                  "item@50",
                  item(190),
                  createElement("option", [], [], at(195)),
                  at(179),
                ),
              ],
              at(169),
            ),
          ],
          at(159),
        ),
      ],
      at(158),
    );
    const icon = createElement("svg", [], [createText("x", at(210))], at(200));
    const type = createTypeText("P", at(30));
    const module = createModule(
      "Card.uf.tsx",
      [
        createComponent("Plain", createElement("hr", [], [], at(2)), at(1)),
        createComponent(
          "Card",
          createFragment([card, list, icon], at(97)),
          at(5),
          [createProp("label", false, type, at(10), "label@10")],
          createPropsParameter("destructured", type, at(9)),
          [],
          [createBinding("label", "prop", at(10)), createBinding("item", "loopVar", at(50))],
        ),
      ],
      [],
    );
    expect([...requiredCapabilities(module)]).toEqual([
      ["element", at(2)],
      ["props", at(9)],
      ["fragment", at(97)],
      ["class-binding", at(99)],
      ["style-binding", at(109)],
      ["bound-attribute", at(119)],
      ["attribute-spread", at(129)],
      ["static-attribute", at(139)],
      ["interpolation", at(149)],
      ["conditional", at(158)],
      ["listbox", at(170)],
      ["list", at(179)],
      ["svg", at(200)],
      ["text", at(210)],
    ]);
  });

  it("derives props from the first prop when there is no parameter to point at", () => {
    const type = createTypeText("P", at(30));
    const component = createComponent("A", createElement("p", [], [], at(2)), at(1), [
      createProp("label", false, type, at(10)),
    ]);
    expect(requiredCapabilities(createModule("A.uf.tsx", [component])).get("props")).toEqual(
      at(10),
    );
  });

  it("derives no props for a component whose props type is empty", () => {
    const component = createComponent(
      "A",
      createElement("p", [], [], at(2)),
      at(1),
      [],
      createPropsParameter("destructured", createTypeText("P", at(30)), at(9)),
    );
    expect(requiredCapabilities(createModule("A.uf.tsx", [component])).has("props")).toBe(false);
  });

  it("names each capability once", () => {
    expect(new Set(CAPABILITY_NAMES).size).toBe(CAPABILITY_NAMES.length);
  });
});
