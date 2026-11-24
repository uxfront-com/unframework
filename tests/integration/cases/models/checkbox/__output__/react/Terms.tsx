import { type ComponentPropsWithRef, useRef, useState } from "react";

export type TermsAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Terms({ className, style, ...attributes }: TermsAttributes) {
  const [agreed, setAgreed] = useState(false);
  const agreedRef = useRef(agreed);

  return (
    <section aria-label="Terms" className={className} style={style} {...attributes}>
      <label>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => {
            agreedRef.current = event.target.checked;
            setAgreed(agreedRef.current);
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
