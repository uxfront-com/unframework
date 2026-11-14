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
 * empty text before it, and removes it once that text leaves the document. Moved out of its Qwik
 * container, it stands in for it, so its handlers still find their container.
 */
function teleport(to: string): (element: Element) => void {
  return (element) => {
    if (teleported.has(element)) return;
    teleported.add(element);
    let anchor: Node | null = null;
    const observer = new MutationObserver(() => {
      if (anchor === null) {
        if (!element.isConnected) return;
        anchor = element.previousSibling;
        const target = document.querySelector(to);
        if (target && anchor) {
          // Qwik finds a handler's container up from its element (`getDomContainer`): outside it,
          // the element stands in for it.
          const container = element.closest(QWIK_CONTAINER);
          if (container && target.closest(QWIK_CONTAINER) !== container) {
            element.setAttribute("q:container", container.getAttribute("q:container") ?? "");
            Object.assign(element, { qContainer: Reflect.get(container, "qContainer") });
          }
          target.append(element);
          return;
        }
      } else if (anchor.isConnected) {
        return;
      }
      element.remove();
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  };
}
