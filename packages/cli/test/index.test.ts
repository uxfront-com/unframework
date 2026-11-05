import { expect, it } from "vitest";

import * as entry from "../src/index.ts";

it("loads", () => {
  expect(entry).toBeTypeOf("object");
});
