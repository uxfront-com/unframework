import { Preprocessor } from "content-tag";
import { describe, expect, it } from "vitest";

import { blankTemplates } from "../src/toolchain/lint.ts";

const blank = (contents: string) => blankTemplates(new Preprocessor(), contents);

describe("blankTemplates", () => {
  it("keeps every line of a class's code, and none of its template", () => {
    const source = [
      'import Component from "@glimmer/component";',
      "",
      "export default class Card extends Component {",
      "  get label() {",
      '    return "Hi";',
      "  }",
      "",
      "  <template>",
      "    <p>{{this.label}}</p>",
      "  </template>",
      "}",
      "",
    ].join("\n");
    const blanked = blank(source);
    expect(blanked.split("\n")).toHaveLength(source.split("\n").length);
    expect(blanked).toMatchInlineSnapshot(`
      "import Component from "@glimmer/component";

      export default class Card extends Component {
        get label() {
          return "Hi";
        }

        static { void 0; }
                               
                   
      }
      "
    `);
  });

  it("stands a template-only component's template in for an expression, or the default export", () => {
    expect(blank("const Card = <template><p>Hi</p></template>;\nexport default Card;\n"))
      .toMatchInlineSnapshot(`
        "const Card = 0                             ;
        export default Card;
        "
      `);
    expect(blank("debugger;\n<template><p>Hi</p></template>\n")).toMatchInlineSnapshot(`
      "debugger;
      export default 0              
      "
    `);
  });
});
