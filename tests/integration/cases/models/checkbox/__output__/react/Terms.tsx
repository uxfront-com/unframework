import { type CSSProperties, useRef, useState } from "react";

export interface TermsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Terms({ className, style, ...attributes }: TermsAttributes) {
  const [agreed, setAgreed] = useState(false);
  const agreedRef = useRef(agreed);

  return (
    <section
      aria-label="Terms"
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
