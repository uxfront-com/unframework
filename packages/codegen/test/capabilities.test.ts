import {
  createComponent,
  createElement,
  createModule,
  createStaticAttribute,
  createText,
} from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { requiredCapabilities } from "../src/index.ts";

const at = (start: number) => ({ start, end: start + 1 });

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
});
