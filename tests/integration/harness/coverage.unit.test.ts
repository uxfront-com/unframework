// The coverage gate fails on what the corpus lacks: a kind of every family the IR's records
// list, on features of its own and through a real compile, and an exemption that is stale or
// names nothing.
import { compile, TARGET_NAMES } from "@unframework/compiler";
import {
  ATTRIBUTE_KINDS,
  BINDING_KINDS,
  CODE_REFERENCE_KINDS,
  HANDLER_KINDS,
  RENDER_NODE_KINDS,
  SETUP_ITEM_KINDS,
  WATCH_SOURCE_KINDS,
} from "@unframework/ir";
import type { ModuleFeatures } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { coverageProblems, kindProblems } from "./coverage.ts";

/** Every kind of a record, but `left`. */
const all = <T extends string>(kinds: readonly T[], left?: string) =>
  new Set(kinds.filter((kind) => kind !== left));

/** Features that use every kind of every record, but those `without` names. */
function features(
  without: Readonly<Partial<Record<keyof ModuleFeatures, string>>> = {},
): ModuleFeatures {
  return {
    nodeKinds: all(RENDER_NODE_KINDS, without.nodeKinds),
    attributeKinds: all(ATTRIBUTE_KINDS, without.attributeKinds),
    bindingKinds: all(BINDING_KINDS, without.bindingKinds),
    setupItemKinds: all(SETUP_ITEM_KINDS, without.setupItemKinds),
    handlerKinds: all(HANDLER_KINDS, without.handlerKinds),
    watchSourceKinds: all(WATCH_SOURCE_KINDS, without.watchSourceKinds),
    codeReferenceKinds: all(CODE_REFERENCE_KINDS, without.codeReferenceKinds),
  };
}

describe("kindProblems", () => {
  it("passes a corpus that has every kind", () => {
    expect(kindProblems([features()], {})).toEqual([]);
  });

  it("fails on a missing kind of each family, the four of setup code included", () => {
    expect(kindProblems([features({ setupItemKinds: "WatchEffect" })], {})).toEqual([
      "No case covers the setup item kind WatchEffect.",
    ]);
    expect(kindProblems([features({ handlerKinds: "Inline" })], {})).toEqual([
      "No case covers the handler kind Inline.",
    ]);
    expect(kindProblems([features({ watchSourceKinds: "Getter" })], {})).toEqual([
      "No case covers the watch source kind Getter.",
    ]);
    expect(kindProblems([features({ codeReferenceKinds: "Emit" })], {})).toEqual([
      "No case covers the code reference kind Emit.",
    ]);
    expect(kindProblems([features({ nodeKinds: "For" })], {})).toEqual([
      "No case covers the node kind For.",
    ]);
    expect(kindProblems([features({ attributeKinds: "Ref" })], {})).toEqual([
      "No case covers the attribute kind Ref.",
    ]);
    expect(kindProblems([features({ bindingKinds: "localVar" })], {})).toEqual([
      "No case covers the binding kind localVar.",
    ]);
  });

  it("counts a kind any case has", () => {
    expect(
      kindProblems(
        [features({ setupItemKinds: "Lifecycle" }), features({ handlerKinds: "Function" })],
        {},
      ),
    ).toEqual([]);
  });

  it("excuses an exempt kind, and fails a stale exemption or one that names no kind", () => {
    const missing = [features({ setupItemKinds: "Lifecycle" })];
    expect(kindProblems(missing, { "setup item": { Lifecycle: "M9 adds its case." } })).toEqual([]);
    expect(
      kindProblems([features()], { "setup item": { Lifecycle: "M9 adds its case." } }),
    ).toEqual(["A case covers the setup item kind Lifecycle now: remove its coverage exemption."]);
    expect(kindProblems([features()], { handler: { Model: "M3 adds its case." } })).toEqual([
      "The exemption for Model names no handler kind (M3 adds its case.).",
    ]);
  });
});

describe("coverageProblems", () => {
  it("reads the setup items, handlers, watch sources and code references of a compile", async () => {
    // A `watch` on a ref and an inline handler: no getter source, no `watchEffect`, no handler
    // that names a function, no emit.
    const source = `import { ref, watch } from "unframework";
export default function Clicks() {
  const count = ref(0);
  const last = ref(0);
  watch(count, (value) => {
    last.value = value;
  });
  return (
    <button type="button" onClick={() => count.value++}>
      {count.value} {last.value}
    </button>
  );
}
`;
    const result = await compile(source, {
      filename: "fixture/clicks/Clicks.uf.tsx",
      targets: TARGET_NAMES,
    });
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    const problems = coverageProblems([result]);
    expect(problems).toEqual(
      expect.arrayContaining([
        "No case covers the setup item kind WatchEffect.",
        "No case covers the handler kind Function.",
        "No case covers the watch source kind Getter.",
        "No case covers the code reference kind Emit.",
      ]),
    );
    for (const covered of [
      "No case covers the setup item kind State.",
      "No case covers the setup item kind Watch.",
      "No case covers the handler kind Inline.",
      "No case covers the watch source kind Ref.",
      "No case covers the code reference kind Write.",
    ]) {
      expect(problems).not.toContain(covered);
    }
  });
});
