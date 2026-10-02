import { describe, expect, it } from "vitest";

import * as api from "../src/index.ts";
import * as devRuntime from "../src/jsx-dev-runtime.ts";
import * as runtime from "../src/jsx-runtime.ts";

/** The runtime surface of `unframework`: plan §4.2, nothing more (everything else is a type). */
const AUTHORING_API = [
  "computed",
  "defineEmits",
  "defineExpose",
  "defineModel",
  "defineOptions",
  "defineSlots",
  "inject",
  "nextTick",
  "onMounted",
  "onUnmounted",
  "provide",
  "ref",
  "useId",
  "useTemplateRef",
  "watch",
  "watchEffect",
];

describe("the authoring API", () => {
  it("exports exactly the plan's functions at runtime", () => {
    expect(Object.keys(api).toSorted()).toEqual(AUTHORING_API);
  });

  it.each(AUTHORING_API)("%s throws when it runs uncompiled, naming itself", (name) => {
    const stub = (api as unknown as Record<string, () => unknown>)[name]!;
    expect(stub).toThrow(
      new Error(
        `unframework: \`${name}\` is compile-time only. This module was not compiled by ` +
          "unframework (is the .uf.tsx file going through the unframework bundler plugin?).",
      ),
    );
  });
});

describe("the JSX runtime entries", () => {
  it("are types only: the compiler lowers JSX, so nothing imports a value from them", () => {
    expect(Object.keys(runtime)).toEqual([]);
    expect(Object.keys(devRuntime)).toEqual([]);
  });
});
