// A framework-free stub target, "dom", for the testing API's own browser tests: its components
// are plain HTML that the adapter sets as the container's innerHTML (as the screenshot spike's
// stand-in targets did), with an optional server-side console and ways to fail on purpose. A
// `text` component renders one element whose text is split over several text nodes, as React,
// Solid and Qwik write `Price: {price} EUR`, and updates those same nodes when it rerenders. A
// component with `setup` has behaviour: listeners on its elements that change the DOM and emit
// the events it declares (`emits`), as a compiled component's handlers and `defineEmits` would;
// with `settle`, the adapter waits for the work they scheduled, as for a framework's render.
import type { MountEvent } from "../../src/index.ts";
import { registerTarget } from "../../src/index.ts";

type Props = Readonly<Record<string, unknown>>;
type Messages = { level: "warn" | "error"; message: string }[];

/** Text split over several nodes, which a rerender updates in place. */
export interface SplitText {
  /** The element holding the text, such as `"p"`. */
  tag: string;
  /** One text node per piece, from the props; a rerender sets each node's data. */
  pieces: (props: Props) => string[];
  /** A comment between each two pieces, as Solid's and Qwik's anchors. */
  anchors?: boolean;
}

/** A stub component: HTML, or split text. */
export interface StubComponent {
  /** Its HTML: fixed, or rendered from the props it is mounted, then rerendered, with. */
  html?: string | ((props: Props) => string);
  text?: SplitText;
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
  /** The events it declares, as `defineEmits` would: the view listens to these. */
  emits?: readonly MountEvent[];
  /**
   * Its behaviour, wired after every render: listeners on its elements (on `signal`, which aborts
   * at the next render and at the unmount) that may change the DOM and call `emit`, which reaches
   * the view's listener for the event.
   */
  setup?(container: HTMLElement, emit: Emit, signal: AbortSignal): void;
  /**
   * Waits for the work its behaviour scheduled, as a framework's adapter waits for a render it
   * has queued; nothing by default.
   */
  settle?(): Promise<void>;
}

/** How a stub's behaviour emits one of its events. */
export type Emit = (name: string, ...args: unknown[]) => void;

registerTarget(
  "dom",
  async (component, container, options) => {
    const stub = component as StubComponent;
    if (stub.fail) throw new Error(stub.fail);
    const nodes: Text[] = [];
    const emit: Emit = (name, ...args) => options.on?.[name]?.(...args);
    let wiring = new AbortController();
    const render = (props: Props) => {
      wiring.abort();
      wiring = new AbortController();
      if (stub.text) renderText(container, stub.text, props, nodes);
      else {
        container.innerHTML =
          typeof stub.html === "function" ? stub.html(props) : (stub.html ?? "");
      }
      stub.setup?.(container, emit, wiring.signal);
    };
    render(options.props ?? {});
    return {
      settle: async () => {
        await stub.settle?.();
      },
      async rerender(props) {
        render(props);
        return stub.rerenderConsole ? { console: stub.rerenderConsole } : {};
      },
      unmount: async () => {
        wiring.abort();
        container.replaceChildren();
        if (stub.failUnmount !== undefined) throw new Error(stub.failUnmount);
        const late = stub.lateWarning;
        if (late !== undefined) setTimeout(() => console.warn(late), 0);
      },
      ...(stub.console ? { console: stub.console } : {}),
    };
  },
  // The stub's components are not compiled: they declare their events themselves.
  { events: (component) => (component as StubComponent).emits ?? [] },
);

/**
 * Renders split text the first time, then, as a framework does, writes each piece into the text
 * node it created for it, which must still be where it put it.
 */
function renderText(container: HTMLElement, text: SplitText, props: Props, nodes: Text[]): void {
  const pieces = text.pieces(props);
  if (nodes.length) {
    for (const [index, piece] of pieces.entries()) nodes[index]!.data = piece;
    return;
  }
  const element = document.createElement(text.tag);
  pieces.forEach((piece, index) => {
    if (index && text.anchors) element.append(document.createComment(""));
    const node = document.createTextNode(piece);
    nodes.push(node);
    element.append(node);
  });
  container.append(element);
}
