import { component$, useSignal, useStyles$, useVisibleTask$ } from "@qwik.dev/core";
import styles from "./Toast.uf.tsx.css?inline";

export interface ToastProps {
  message: string;
}

export default component$<ToastProps>(({ message }) => {
  useStyles$(styles);

  const mounted = useSignal(false);
  useVisibleTask$(
    () => {
      mounted.value = true;
    },
    { strategy: "document-ready" },
  );

  return (
    <>
      {mounted.value && (
        <>
          {""}
          <div
            ref={teleport("body")}
            data-teleported="true"
            class="toast"
            role="alert"
            data-uf-416dbabb=""
          >
            <p data-uf-416dbabb="">{message}</p>
          </div>
        </>
      )}
    </>
  );
});

/** The elements `teleport` has taken. */
const teleported = new WeakSet<Element>();

/** The element of a Qwik container, as Qwik selects it. */
const QWIK_CONTAINER = "[q\\:container]:not([q\\:container=html]):not([q\\:container=text])";

/**
 * A ref that moves its element into the element `to` selects once Qwik has inserted it, after the
 * empty text before it, and removes it once the element that held it leaves the document: Qwik
 * removes the element itself with its branch, and only the outermost node of an element it
 * removes. Moved out of its Qwik container, it stands in for it, so its handlers still find their
 * container.
 */
function teleport(to: string): (element: Element) => void {
  return (element) => {
    if (teleported.has(element)) return;
    teleported.add(element);
    let holder: Node | null = null;
    const observer = new MutationObserver(() => {
      if (holder === null) {
        if (!element.isConnected) return;
        holder = element.parentNode;
        const target = document.querySelector(to);
        if (target && holder && element.previousSibling) {
          // Qwik finds a handler's container up from its element (`getDomContainer`): outside it,
          // the element stands in for it.
          const container = element.closest(QWIK_CONTAINER);
          if (container && target.closest(QWIK_CONTAINER) !== container) {
            element.setAttribute("q:container", container.getAttribute("q:container") ?? "");
            Object.assign(element, { qContainer: Reflect.get(container, "qContainer") });
          }
          const active = document.activeElement;
          target.append(element);
          // Moving a node blurs what it holds, which a component inside it may have focused.
          if (active instanceof HTMLElement && element.contains(active)) active.focus();
          return;
        }
      } else if (holder.isConnected) {
        return;
      }
      element.remove();
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  };
}
