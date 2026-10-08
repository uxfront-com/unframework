import { defineTarget } from "@unframework/codegen";
import { builtinTargets, TARGET_NAMES } from "@unframework/compiler";
import { describe, expect, it } from "vitest";

import { moduleIdCandidates, moduleIdFilter, specifierFilter } from "../src/ids.ts";
import { ID_SUFFIXES, idSuffix, moduleId, parseModuleId, SCAN_ID_PREFIX } from "../src/index.ts";

const html = defineTarget({
  name: "html",
  framework: { package: "none", range: "*" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    listbox: { support: "native" },
    interactivity: { support: "native" },
    props: { support: "native" },
    interpolation: { support: "native" },
    conditional: { support: "native" },
    list: { support: "native" },
    fragment: { support: "native" },
    "bound-attribute": { support: "native" },
    "class-binding": { support: "native" },
    "style-binding": { support: "native" },
    "attribute-spread": { support: "native" },
    svg: { support: "native" },
    "event-capture": { support: "native" },
    "event-once": { support: "native" },
    "event-passive": { support: "native" },
    "event-semantics": { support: "native" },
    "conditional-event-control": { support: "native" },
    "use-id": { support: "native" },
    "next-tick": { support: "native" },
    "late-prop": { support: "native" },
    component: { support: "native" },
    "component-event": { support: "native" },
    "default-slot": { support: "native" },
    "named-slot": { support: "native" },
    "scoped-slot": { support: "native" },
    "slot-fallback": { support: "native" },
    "default-slot-presence": { support: "native" },
    "slot-forwarding": { support: "native" },
    model: { support: "native" },
    "two-way-binding": { support: "native" },
    "model-array": { support: "native" },
    "model-modifiers": { support: "native" },
    fallthrough: { support: "native" },
    "contextual-root": { support: "native" },
    expose: { support: "native" },
    context: { support: "native" },
    "reactive-context": { support: "native" },
    "dynamic-component": { support: "native" },
  },
  emit: (component) => [{ path: `${component.name}.html`, contents: "<p></p>\n" }],
});

describe("ID_SUFFIXES", () => {
  it("names the extension each framework's plugin claims", () => {
    expect(ID_SUFFIXES).toEqual({
      react: "",
      vue: ".vue",
      svelte: ".svelte",
      solid: "",
      angular: ".ts",
      qwik: "",
      astro: ".astro",
    });
    expect(Object.keys(ID_SUFFIXES).toSorted()).toEqual(TARGET_NAMES.toSorted());
  });
});

describe("idSuffix", () => {
  it("finds built-in targets by name and as objects", () => {
    expect(idSuffix("vue")).toBe(".vue");
    expect(idSuffix(builtinTargets.angular)).toBe(".ts");
    expect(idSuffix(builtinTargets.react)).toBe("");
  });

  it("takes an explicit extension, also over a built-in one", () => {
    expect(idSuffix(html, ".html")).toBe(".html");
    expect(idSuffix(html, "")).toBe("");
    expect(idSuffix("astro", ".static.js")).toBe(".static.js");
  });

  it("requires an extension for a third-party target", () => {
    expect(() => idSuffix(html)).toThrow(
      'The "html" target is not built in, so its module ids need an explicit `extension`',
    );
  });

  it("rejects unknown names and extensions that are not extensions", () => {
    expect(() => idSuffix("vuee" as never)).toThrow('Unknown target "vuee".');
    for (const extension of ["vue", ".vue?x", "./vue", ".v ue", "."]) {
      expect(() => idSuffix(html, extension), extension).toThrow("is not a file extension");
    }
  });
});

describe("moduleId and parseModuleId", () => {
  it("round-trip a file, a suffix and a query", () => {
    expect(moduleId("/p/Hello.uf.tsx", ".vue")).toBe("/p/Hello.uf.tsx.vue");
    expect(moduleId("/p/Hello.uf.tsx", ".astro", "?container")).toBe(
      "/p/Hello.uf.tsx.astro?container",
    );
    expect(parseModuleId("/p/Hello.uf.tsx.astro?container", ".astro")).toEqual({
      file: "/p/Hello.uf.tsx",
      query: "?container",
    });
    expect(parseModuleId("/p/Hello.uf.tsx", "")).toEqual({ file: "/p/Hello.uf.tsx", query: "" });
  });

  it("matches the path only, so a framework's sub-request is still recognised", () => {
    expect(parseModuleId("/p/Hello.uf.tsx.vue?vue&type=style&index=0&lang.css", ".vue")).toEqual({
      file: "/p/Hello.uf.tsx",
      query: "?vue&type=style&index=0&lang.css",
    });
  });

  it("rejects ids of other suffixes and other files", () => {
    expect(parseModuleId("/p/Hello.uf.tsx", ".vue")).toBeUndefined();
    expect(parseModuleId("/p/Hello.vue", ".vue")).toBeUndefined();
    expect(parseModuleId("/p/Hello.uf.tsx.vue", "")).toBeUndefined();
    // Qwik's segments are named after their parent, and are not module ids.
    expect(parseModuleId("/p/Hello.uf.tsx_Hello_component_Pu61aqUpnug.js", "")).toBeUndefined();
  });
});

describe("specifierFilter", () => {
  it("matches every specifier that can name a .uf.tsx file, and module ids coming back", () => {
    const vue = specifierFilter(".vue");
    for (const specifier of [
      "./Hello.uf.tsx",
      "./Hello.uf",
      "./Hello.uf.js",
      "./Hello.uf.jsx",
      "~/Hello.uf.tsx?container",
      "/abs/Hello.uf.tsx.vue",
      "/abs/Hello.uf.tsx.vue?vue&type=style&index=0&lang.css",
    ]) {
      expect(vue.test(specifier), specifier).toBe(true);
    }
    for (const specifier of [
      "./Hello.tsx",
      "./Hello.uf.ts",
      "./Hello.uf.mjs",
      "./Hello.uf.tsx.svelte",
      "./Hello.uf.css",
      "./Hello.uf.tsx_Hello_component_Pu61aqUpnug.js",
      "@ds/core/hello",
    ]) {
      expect(vue.test(specifier), specifier).toBe(false);
    }
    expect(specifierFilter("").test("./Hello.uf.tsx.vue")).toBe(false);
  });
});

describe("moduleIdFilter", () => {
  it("matches the module ids of a suffix, with any query", () => {
    expect(moduleIdFilter(".vue").test("/p/Hello.uf.tsx.vue?vue&type=style")).toBe(true);
    expect(moduleIdFilter(".vue").test("/p/Hello.uf.tsx")).toBe(false);
    expect(moduleIdFilter("").test("/p/Hello.uf.tsx?raw")).toBe(true);
    expect(moduleIdFilter("").test("/p/Hello.uf.tsx.vue")).toBe(false);
  });
});

describe("moduleIdCandidates", () => {
  it("resolves relative ids against their importer, never the root", () => {
    expect(moduleIdCandidates("./Hello.uf.tsx.vue", "/root", "/root/sub/main.ts")).toEqual([
      "/root/sub/Hello.uf.tsx.vue",
    ]);
    expect(moduleIdCandidates("../Hello.uf.tsx.vue", "/root", "/root/sub/main.ts?v=1")).toEqual([
      "/root/Hello.uf.tsx.vue",
    ]);
    expect(moduleIdCandidates("./Hello.uf.tsx.vue", "/root", undefined)).toEqual([]);
  });

  it("reads a /-prefixed path as a root-relative URL first, then as an absolute id", () => {
    expect(moduleIdCandidates("/root/Hello.uf.tsx.vue", "/root", undefined)).toEqual([
      "/root/Hello.uf.tsx.vue",
    ]);
    expect(moduleIdCandidates("/cases/Hello.uf.tsx.vue", "/root", undefined)).toEqual([
      "/root/cases/Hello.uf.tsx.vue",
      "/cases/Hello.uf.tsx.vue",
    ]);
  });

  it("keeps Windows ids in Vite's form, with forward slashes", () => {
    const root = "C:/proj/tests/integration";
    expect(moduleIdCandidates("/cases/hello/Hello.uf.tsx.vue", root, undefined)).toEqual([
      "C:/proj/tests/integration/cases/hello/Hello.uf.tsx.vue",
      "/cases/hello/Hello.uf.tsx.vue",
    ]);
    expect(moduleIdCandidates("D:/elsewhere/Hello.uf.tsx.vue", root, undefined)).toEqual([
      "D:/elsewhere/Hello.uf.tsx.vue",
    ]);
    expect(moduleIdCandidates("./Hello.uf.tsx.vue", root, `${root}/sub/main.ts`)).toEqual([
      "C:/proj/tests/integration/sub/Hello.uf.tsx.vue",
    ]);
  });

  it("gives a bare specifier nothing: it names a package", () => {
    expect(moduleIdCandidates("pkg/Hello.uf.tsx.vue", "/root", "/root/main.ts")).toEqual([]);
  });
});

describe("SCAN_ID_PREFIX", () => {
  it("contains \\0, which Vite's dependency scanner externalises", () => {
    expect(SCAN_ID_PREFIX).toContain("\0");
  });
});
