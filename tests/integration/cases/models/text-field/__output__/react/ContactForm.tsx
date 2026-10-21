import { type CSSProperties, useRef, useState } from "react";

export interface ContactFormAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ContactForm({ className, style, ...attributes }: ContactFormAttributes) {
  const [name, setName] = useState("Ada");
  const nameRef = useRef(name);
  const [email, setEmail] = useState("");

  return (
    <form aria-label="Contact" className={className} style={style} {...scopeAttributes(attributes)}>
      <label>
        Name{" "}
        <input
          value={name}
          onChange={(event) => {
            nameRef.current = event.target.value;
            setName(nameRef.current);
          }}
        />
      </label>
      <label>
        Email{" "}
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <output>
        {name} at {email || "no address"}
      </output>
      <button
        type="button"
        onClick={() => {
          nameRef.current = "Grace";
          setName(nameRef.current);
        }}
      >
        Use Grace
      </button>
    </form>
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
