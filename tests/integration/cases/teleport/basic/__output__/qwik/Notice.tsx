import {
  type CSSProperties,
  type ClassList,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface NoticeProps {
  message: string;
}

export default component$<NoticeProps & { class?: ClassList; style?: CSSProperties }>(
  ({ message, class: className, style, ...attributes }) => {
    const dismissed = useSignal(0);

    const mounted = useSignal(false);
    useVisibleTask$(
      () => {
        mounted.value = true;
      },
      { strategy: "document-ready" },
    );

    return (
      <section
        class={["inbox", className]}
        aria-label="Inbox"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p>Dismissed {dismissed.value} times</p>
        {mounted.value && (
          <>
            {""}
            <div ref={teleport("body")} data-teleported="true" class="notice">
              <p role="status">
                {message} ({dismissed.value})
              </p>
              <button type="button" onClick$={() => dismissed.value++}>
                Dismiss
              </button>
            </div>
          </>
        )}
      </section>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}

/** The elements `teleport` has taken. */
const teleported = new WeakSet<Element>();

/** The element of a Qwik container, as Qwik selects it. */
const QWIK_CONTAINER = "[q\\:container]:not([q\\:container=html]):not([q\\:container=text])";

/**
 * A ref that moves its element into the element `to` selects once Qwik has inserted it, after the
 * empty text before it. The element sits after an empty text of its own in `to`, which keeps its
 * place: when Qwik moves the element with its component, it goes back after that text, whatever
 * else moved. It removes the element once the element that held it leaves the document: Qwik
 * removes the element itself with its branch, and only the outermost node of an element it
 * removes. It stops watching once the element is gone. Moved out of its Qwik container, the
 * element stands in for it, so its handlers still find their container.
 */
function teleport(to: string): (element: Element) => void {
  return (element) => {
    if (teleported.has(element)) return;
    teleported.add(element);
    let holder: Node | null = null;
    // Where the element sits in `to`: an empty text, which no capture shows and nothing else moves.
    const place = document.createTextNode("");
    const move = () => {
      const active = document.activeElement;
      place.after(element);
      // Moving a node blurs what it holds, which a component inside it may have focused.
      if (active instanceof HTMLElement && element.contains(active)) active.focus();
    };
    const observer = new MutationObserver(() => {
      if (holder === null) {
        if (!element.isConnected) return;
        holder = element.parentNode;
        const target = document.querySelector(to);
        if (!target || !holder || !element.previousSibling) {
          element.remove();
          observer.disconnect();
          return;
        }
        // Qwik finds a handler's container up from its element (`getDomContainer`): outside it,
        // the element stands in for it.
        const container = element.closest(QWIK_CONTAINER);
        if (container && target.closest(QWIK_CONTAINER) !== container) {
          element.setAttribute("q:container", container.getAttribute("q:container") ?? "");
          Object.assign(element, { qContainer: Reflect.get(container, "qContainer") });
        }
        target.append(place);
        move();
        return;
      }
      if (!holder.isConnected) {
        // An element around the teleport, or its component, has gone.
        element.remove();
      } else if (element.isConnected) {
        // Qwik moves a component's nodes with it, as a keyed list reorders it: back to its place.
        if (element.previousSibling !== place) move();
        return;
      }
      // Removed, by Qwik with its branch or here.
      place.remove();
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  };
}
