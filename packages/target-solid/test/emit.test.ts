import { formatOutput } from "@unframework/codegen";
import type { ElementNode } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import target from "../src/index.ts";
import { AVATAR, el, emit, hello, profileCard } from "./fixtures.ts";

async function formatted(render: ElementNode, options?: Parameters<typeof emit>[1]) {
  const { files, reported } = emit(render, options);
  expect(reported).toEqual([]);
  expect(files).toHaveLength(1);
  const outcome = await formatOutput(files[0]!);
  expect(outcome.error).toBeUndefined();
  return outcome.file;
}

describe("solid target", () => {
  it("declares every capability", () => {
    expect(Object.keys(target.capabilities).toSorted()).toEqual([
      "element",
      "interactivity",
      "listbox",
      "static-attribute",
      "text",
    ]);
  });

  it("emits basics/hello as its golden output", async () => {
    expect(await formatted(hello(), { name: "Hello" })).toEqual({
      path: "Hello.tsx",
      contents: [
        "export default function Hello() {",
        '  return <p class="greeting">Hello, world!</p>;',
        "}",
        "",
      ].join("\n"),
    });
  });

  it("emits basics/nested-and-void as its golden output, with HTML attribute names", async () => {
    expect(await formatted(profileCard(), { name: "ProfileCard" })).toEqual({
      path: "ProfileCard.tsx",
      contents: [
        "export default function ProfileCard() {",
        "  return (",
        '    <article class="profile" aria-labelledby="profile-name">',
        '      <header class="profile-header">',
        "        <img",
        `          src="${AVATAR}"`,
        `          alt="Ada's avatar"`,
        '          width="48"',
        '          height="48"',
        "        />",
        '        <h2 id="profile-name">Ada Lovelace</h2>',
        "      </header>",
        "      <p>",
        "        Mathematician &amp; writer",
        "        <br />",
        "        of the first published program",
        "      </p>",
        "      <hr />",
        '      <label for="profile-note">Note</label>',
        '      <input id="profile-note" type="text" name="note" placeholder="Say hello" />',
        "    </article>",
        "  );",
        "}",
        "",
      ].join("\n"),
    });
  });

  it("keeps a named export named", async () => {
    const file = await formatted(hello(), { name: "Hello", kind: "named" });
    expect(file.contents).toMatch(/^export function Hello\(\) \{/);
  });

  it("keeps boolean attributes as written: Solid inlines them into its HTML templates", async () => {
    const file = await formatted(
      el("form", {}, el("input", { disabled: true }), el("input", { readonly: "" })),
    );
    expect(file.contents).toContain('<input disabled />\n      <input readonly="" />');
  });
});
