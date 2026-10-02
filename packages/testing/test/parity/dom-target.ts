// A framework-free stub target, "dom", for the testing API's own browser tests: its components
// are plain HTML that the adapter sets as the container's innerHTML (as the screenshot spike's
// stand-in targets did), with an optional server-side console and a way to fail on purpose.
import { registerTarget } from "../../src/index.ts";

/** A stub component. */
export interface StubComponent {
  html: string;
  /** Console messages the "server render" emitted, which the adapter hands back (like Astro). */
  console?: { level: "warn" | "error"; message: string }[];
  /** Makes the adapter throw while mounting. */
  fail?: string;
  /** A warning the unmount leaves for later, as a framework's scheduler can. */
  lateWarning?: string;
}

registerTarget("dom", async (component, container) => {
  const stub = component as StubComponent;
  if (stub.fail) throw new Error(stub.fail);
  container.innerHTML = stub.html;
  return {
    settle: async () => {},
    unmount: async () => {
      container.replaceChildren();
      const late = stub.lateWarning;
      if (late !== undefined) setTimeout(() => console.warn(late), 0);
    },
    ...(stub.console ? { console: stub.console } : {}),
  };
});
