// The main component of hydrate/client-agreement-focus: it takes the focus as it mounts, as an
// async setup's mounted hook may (ADR-0101), so its client render takes it too.
import type { StubComponent } from "../../../dom-target.ts";

export default {
  html: '<label>Note <input type="text"></label>',
  setup(container) {
    container.querySelector("input")?.focus();
  },
} satisfies StubComponent;
