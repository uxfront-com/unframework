import { type CSSProperties, useRef, useState } from "react";

export interface TermsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Terms({ className, style }: TermsAttributes) {
  const [agreed, setAgreed] = useState(false);
  const agreedRef = useRef(agreed);

  return (
    <section aria-label="Terms" className={className} style={style}>
      <label>
        <input
          type="checkbox"
          defaultChecked={agreed}
          ref={(element) => {
            if (!element) return undefined;
            element.checked = agreed;
            const stop = listen(element, "change", () => {
              agreedRef.current = element.checked;
              setAgreed(agreedRef.current);
            });
            return () => {
              stop();
            };
          }}
        />{" "}
        I agree
      </label>
      <output>{agreed ? "Agreed" : "Not agreed"}</output>
      <button
        type="button"
        onClick={() => {
          agreedRef.current = !agreedRef.current;
          setAgreed(agreedRef.current);
        }}
      >
        Toggle
      </button>
    </section>
  );
}

/**
 * Listens to a DOM event natively, where React's synthetic event would not keep the DOM's
 * semantics, and gives back what stops it: the cleanup a ref callback returns.
 */
function listen<K extends keyof HTMLElementEventMap>(
  element: EventTarget | null,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  element?.addEventListener(type, listener as EventListener, options);
  return () => element?.removeEventListener(type, listener as EventListener, options);
}
