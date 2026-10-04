// A framework-free stub target, "dom", for the testing API's own browser tests: its components
// are plain HTML that the adapter sets as the container's innerHTML (as the screenshot spike's
// stand-in targets did), with an optional server-side console and ways to fail on purpose.
import { registerTarget } from "../../src/index.ts";

type Props = Readonly<Record<string, unknown>>;
type Messages = { level: "warn" | "error"; message: string }[];

/** A stub component. */
export interface StubComponent {
  /** Its HTML: fixed, or rendered from the props it is mounted, then rerendered, with. */
  html: string | ((props: Props) => string);
  /** Console messages the "server render" emitted, which the adapter hands back (like Astro). */
  console?: Messages;
  /** Console messages each rerender's "server render" emitted. */
  rerenderConsole?: Messages;
  /** Makes the adapter throw while mounting. */
  fail?: string;
  /** Makes the unmount throw. */
  failUnmount?: string;
  /** A warning the unmount leaves for later, as a framework's scheduler can. */
  lateWarning?: string;
}

registerTarget("dom", async (component, container, options) => {
  const stub = component as StubComponent;
  if (stub.fail) throw new Error(stub.fail);
  const render = (props: Props) => {
    container.innerHTML = typeof stub.html === "function" ? stub.html(props) : stub.html;
  };
  render(options.props ?? {});
  return {
    settle: async () => {},
    async rerender(props) {
      render(props);
      return stub.rerenderConsole ? { console: stub.rerenderConsole } : {};
    },
    unmount: async () => {
      container.replaceChildren();
      if (stub.failUnmount !== undefined) throw new Error(stub.failUnmount);
      const late = stub.lateWarning;
      if (late !== undefined) setTimeout(() => console.warn(late), 0);
    },
    ...(stub.console ? { console: stub.console } : {}),
  };
});
