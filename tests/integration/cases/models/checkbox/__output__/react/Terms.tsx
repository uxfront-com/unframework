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
