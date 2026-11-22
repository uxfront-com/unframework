// dev/client-warning: `if (isDev)` in a lifecycle hook checks the rendered DOM in a development
// build (ADR-0117). Astro runs no client code, so its interactive cell skips the spec by
// capability, and its output holds no hook.
import {
  allowConsole,
  capturedConsole,
  describeTargets,
  it,
  mount,
} from "@unframework.dev/testing";
import { expect } from "vitest";

import IconLink from "./IconLink.uf.tsx";

const WARNING = /IconLink has no accessible name/;

describeTargets("dev/client-warning", () => {
  it(
    "warns its author once mounted when it has no accessible name",
    { requires: ["interactivity"] },
    async () => {
      allowConsole(WARNING, "The development-only warning this case checks for (ADR-0117).");
      const view = await mount(IconLink, { props: { href: "#next" } });
      await view.expectParity("unlabelled");
      await expect.element(view.getByRole("link")).toBeVisible();
      // Present, never counted: a framework may mount more than once in development.
      await expect
        .poll(() => capturedConsole().some(({ message }) => WARNING.test(message)))
        .toBe(true);
    },
  );
});
