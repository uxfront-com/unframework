// The listener names (ADR-0047): a total table over the event vocabulary, pinned against
// Qwik's own registration. Qwik's runtime lower-cases a listener prop's name for the DOM event it
// listens to (`jsxEventToHtmlAttribute`), and its JSX types give each name it knows the event's
// interface: `onKeydown$` would listen alike but hand a plain `Event` (no `key`, TS2339).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { DOM_EVENTS } from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import { QWIK_EVENT_PROPS, qwikEventProp, qwikListenerProp } from "../src/events.ts";
import { toolchain } from "../src/toolchain/index.ts";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const context = {
  toolchainDir: join(repo, "tests/toolchains/qwik"),
  root: join(repo, "tests/integration"),
};
// Scratch components live inside this package, so `@qwik.dev/core` resolves from them.
const scratchRoot = fileURLToPath(new URL("../.uf-tmp", import.meta.url));
mkdirSync(scratchRoot, { recursive: true });
const scratch = mkdtempSync(join(scratchRoot, "events-test-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("Qwik's listener props", () => {
  it("names every event of the vocabulary, as Qwik's runtime reads the name back", () => {
    expect([...QWIK_EVENT_PROPS.keys()]).toEqual([...DOM_EVENTS.keys()]);
    for (const [event, prop] of QWIK_EVENT_PROPS) {
      expect(prop).toMatch(/^on[A-Z][A-Za-z]*\$$/);
      expect(prop.slice(2, -1).toLowerCase()).toBe(event);
    }
    expect(qwikListenerProp("keydown")).toBe("onKeyDown$");
    expect(qwikListenerProp("dblclick")).toBe("onDblClick$");
    expect(qwikListenerProp("click", "window")).toBe("window:onClick$");
    expect(() => qwikListenerProp("hashchange")).toThrow(/not an event a listener may take/);
  });

  it("names a component's events as the QRL props a parent sets", () => {
    expect(qwikEventProp("change")).toBe("onChange$");
    expect(qwikEventProp("valueChange")).toBe("onValueChange$");
  });

  it(
    "hands each listener its event's interface, but for the events Qwik's types do not know",
    { timeout: 120_000 },
    async () => {
      const listeners = [...QWIK_EVENT_PROPS].map(
        ([event, prop]) =>
          `      ${prop}={(event) => { const typed: ${DOM_EVENTS.get(event)} = event; console.info("${event}", typed); }}`,
      );
      const file = join(scratch, "Listeners.tsx");
      writeFileSync(
        file,
        [
          'import { component$ } from "@qwik.dev/core";',
          "",
          "export default component$(() => {",
          "  return (",
          "    <video",
          ...listeners,
          "    />",
          "  );",
          "});",
          "",
        ].join("\n"),
      );
      const messages = (await toolchain.typecheck([file], context)).get(file) ?? [];
      // A message names its line: the listener's, the 6th line of the file onwards.
      const untyped = messages.map((message) => [...QWIK_EVENT_PROPS.keys()][message.line! - 6]);
      // Qwik types these as a plain `Event`: they are no key of its HTML element event map. A
      // listener of one still runs; an author's annotation (`event: MediaEncryptedEvent`) holds.
      expect(untyped).toEqual(["encrypted"]);
    },
  );
});
