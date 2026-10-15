// What L10's geometry capture keys: every element, and every laid-out text node. A `<textarea>`'s
// text is its default value, which the control shows as its value: a target that writes it as
// markup (Astro, React's `defaultValue`) and one that sets the property (Vue's `v-model`) render
// the same box.
import { afterEach, expect, it } from "vitest";

import { captureGeometry } from "../src/browser/geometry.ts";

afterEach(() => {
  document.body.replaceChildren();
});

it("captures a textarea's box, not its default value's text", () => {
  const written = document.createElement("div");
  written.innerHTML = "<textarea>Buy milk</textarea><p>after</p>";
  const property = document.createElement("div");
  property.innerHTML = "<textarea></textarea><p>after</p>";
  document.body.append(written, property);
  property.querySelector("textarea")!.value = "Buy milk";
  const keys = Object.keys(captureGeometry(written).nodes);
  expect(keys).toEqual(["textarea[0]", "p[0]", "p[0]/#text[0]"]);
  expect(keys).toEqual(Object.keys(captureGeometry(property).nodes));
});
