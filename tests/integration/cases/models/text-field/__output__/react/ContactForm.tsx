import { type CSSProperties, useRef, useState } from "react";

export interface ContactFormAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ContactForm({ className, style }: ContactFormAttributes) {
  const [name, setName] = useState("Ada");
  const nameRef = useRef(name);
  const [email, setEmail] = useState("");

  return (
    <form aria-label="Contact" className={className} style={style}>
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
