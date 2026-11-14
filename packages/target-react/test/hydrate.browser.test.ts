// The hydrate adapter in Chromium (L12, ADR-0095): React reports a mismatch on two channels, and
// the adapter takes both. A text that differs from the server's goes to `onRecoverableError`
// (React then renders on the client), and an attribute that differs only to `console.error`, in
// development (React keeps the server's value). HTML that matches reports nothing.
import type { HydratedComponent } from "@unframework.dev/codegen";
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { hydrate } from "../src/toolchain/hydrate.ts";

/** A paragraph whose text and title come from its props. */
function Label({ text, title }: { text: string; title: string }) {
  return createElement("p", { title }, text);
}

let container: HTMLElement;
let hydrated: HydratedComponent | undefined;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  // React logs each mismatch in development: these tests cause them on purpose.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  await hydrated?.unmount();
  hydrated = undefined;
  container.remove();
  vi.restoreAllMocks();
});

it("reports nothing when the server's HTML matches", async () => {
  hydrated = await hydrate(Label, container, '<p title="Plan">Monthly</p>', {
    props: { text: "Monthly", title: "Plan" },
  });
  expect(hydrated.takeMismatches()).toEqual([]);
  expect(container.innerHTML).toBe('<p title="Plan">Monthly</p>');
});

it("reports a text that differs from the server's, through onRecoverableError", async () => {
  hydrated = await hydrate(Label, container, '<p title="Plan">Monthly</p>', {
    props: { text: "Yearly", title: "Plan" },
  });
  expect(hydrated.takeMismatches()).toEqual([
    expect.stringMatching(/didn't match|did not match|Hydration failed/i),
  ]);
  // React rendered on the client instead, and the mismatches were taken.
  expect(container.textContent).toBe("Yearly");
  expect(hydrated.takeMismatches()).toEqual([]);
});

it("reports an attribute that differs from the server's, through console.error", async () => {
  hydrated = await hydrate(Label, container, '<p title="Plan">Monthly</p>', {
    props: { text: "Monthly", title: "Billing" },
  });
  expect(hydrated.takeMismatches()).toEqual([
    expect.stringMatching(
      /^A tree hydrated but some attributes of the server rendered HTML didn't match/,
    ),
  ]);
  // React keeps the server's attribute: only the report says it differs.
  expect(container.querySelector("p")?.title).toBe("Plan");
});
