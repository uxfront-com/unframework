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
 * empty text before it, and puts it back where it was there when Qwik moves it with its
 * component. It removes the element once the element that held it leaves the document: Qwik
 * removes the element itself with its branch, and only the outermost node of an element it
 * removes. It stops watching once the element is gone. Moved out of its Qwik container, the
 * element stands in for it, so its handlers still find their container.
 */
function teleport(to: string): (element: Element) => void {
  return (element) => {
    if (teleported.has(element)) return;
    teleported.add(element);
    let target: Element | null = null;
    let holder: Node | null = null;
    let next: Node | null = null;
    const move = (before: Node | null) => {
      const active = document.activeElement;
      target!.insertBefore(element, before);
      // Moving a node blurs what it holds, which a component inside it may have focused.
      if (active instanceof HTMLElement && element.contains(active)) active.focus();
    };
    const observer = new MutationObserver(() => {
      if (holder === null) {
        if (!element.isConnected) return;
        holder = element.parentNode;
        target = document.querySelector(to);
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
        move(null);
        next = element.nextSibling;
        return;
      }
      if (!holder.isConnected) {
        // An element around the teleport, or its component, has gone.
        element.remove();
      } else if (element.isConnected) {
        // Qwik moves a component's nodes with it, as a keyed list reorders it: back where it was.
        if (element.parentNode !== target) move(next?.parentNode === target ? next : null);
        next = element.nextSibling;
        return;
      }
      // Removed, by Qwik with its branch or here.
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  };
}
